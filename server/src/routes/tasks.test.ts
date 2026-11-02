import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { seed } from "../db/seed.js";
import { resetDatabase } from "../test/db.js";

const app = createApp();

async function idOf(table: "skills" | "developers", name: string): Promise<number> {
  const { rows } = await getPool().query<{ id: number }>(`SELECT id FROM ${table} WHERE name = $1`, [name]);
  return rows[0]!.id;
}

async function taskCount(): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>("SELECT count(*) AS n FROM tasks");
  return Number(rows[0]!.n);
}

beforeEach(async () => {
  await resetDatabase(getPool());
  await seed(getPool());
});

afterAll(closePool);

describe("POST /api/tasks", () => {
  it("creates an unassigned to-do task with no skills", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "Write the docs" });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/tasks/${res.body.id}`);
    expect(res.body).toEqual({
      id: expect.any(Number),
      title: "Write the docs",
      status: "todo",
      skills: [],
      assignee: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("creates a task with the requested skills, ordered by name", async () => {
    const frontend = await idOf("skills", "Frontend");
    const backend = await idOf("skills", "Backend");

    const res = await request(app).post("/api/tasks").send({ title: "Profile page", skillIds: [frontend, backend] });

    expect(res.status).toBe(201);
    expect(res.body.skills.map((s: { name: string }) => s.name)).toEqual(["Backend", "Frontend"]);
  });

  it("ignores duplicate skill ids", async () => {
    const frontend = await idOf("skills", "Frontend");

    const res = await request(app).post("/api/tasks").send({ title: "Homepage", skillIds: [frontend, frontend] });

    expect(res.status).toBe(201);
    expect(res.body.skills).toHaveLength(1);
  });

  it("trims the title", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "  Padded title  " });

    expect(res.body.title).toBe("Padded title");
  });

  it("accepts a title of exactly 500 characters", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "x".repeat(500) });

    expect(res.status).toBe(201);
  });

  it.each([
    ["a missing title", {}],
    ["an empty title", { title: "" }],
    ["a blank title", { title: "   " }],
    ["a title over 500 characters", { title: "x".repeat(501) }],
    ["a non-string title", { title: 42 }],
    ["an unknown property such as assigneeId", { title: "t", assigneeId: 1 }],
    ["skillIds that is not an array", { title: "t", skillIds: 1 }],
    ["a non-integer skill id", { title: "t", skillIds: ["1"] }],
    ["a zero skill id", { title: "t", skillIds: [0] }],
  ])("rejects %s with 400 and creates nothing", async (_label, body) => {
    const res = await request(app).post("/api/tasks").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(await taskCount()).toBe(0);
  });

  it("rejects a request with no body", async () => {
    const res = await request(app).post("/api/tasks");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 for an unknown skill id and creates nothing", async () => {
    const frontend = await idOf("skills", "Frontend");

    const res = await request(app).post("/api/tasks").send({ title: "t", skillIds: [frontend, 999999] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_REFERENCE");
    expect(res.body.error.message).toContain("999999");
    expect(await taskCount()).toBe(0);
  });
});

describe("GET /api/tasks", () => {
  it("returns an empty list when there are no tasks", async () => {
    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists tasks newest first with skills and assignee", async () => {
    const frontend = await idOf("skills", "Frontend");
    await request(app).post("/api/tasks").send({ title: "First" });
    const second = await request(app).post("/api/tasks").send({ title: "Second", skillIds: [frontend] });
    const alice = await idOf("developers", "Alice");
    await getPool().query("UPDATE tasks SET assignee_id = $1 WHERE id = $2", [alice, second.body.id]);

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(["Second", "First"]);
    expect(res.body[0].assignee).toEqual({ id: alice, name: "Alice" });
    expect(res.body[0].skills).toEqual([{ id: frontend, name: "Frontend" }]);
    expect(res.body[1].assignee).toBeNull();
  });
});

describe("GET /api/tasks/:id", () => {
  it("returns the task", async () => {
    const created = await request(app).post("/api/tasks").send({ title: "Find me" });

    const res = await request(app).get(`/api/tasks/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body);
  });

  it("returns 404 for an unknown task", async () => {
    const res = await request(app).get("/api/tasks/999999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it.each(["abc", "0", "1.5"])("returns 400 for id %s", async (id) => {
    const res = await request(app).get(`/api/tasks/${id}`);

    expect(res.status).toBe(400);
  });
});
