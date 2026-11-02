import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { seed } from "../db/seed.js";
import { resetDatabase } from "../test/db.js";

const app = createApp();

async function developerId(name: string): Promise<number> {
  const { rows } = await getPool().query<{ id: number }>("SELECT id FROM developers WHERE name = $1", [name]);
  return rows[0]!.id;
}

beforeEach(async () => {
  await resetDatabase(getPool());
  await seed(getPool());
});

afterAll(closePool);

describe("GET /api/developers", () => {
  it("lists developers with their skills", async () => {
    const res = await request(app).get("/api/developers");

    expect(res.status).toBe(200);
    expect(
      res.body.map((d: { name: string; skills: { name: string }[] }) => [d.name, d.skills.map((s) => s.name)]),
    ).toEqual([
      ["Alice", ["Frontend"]],
      ["Bob", ["Backend"]],
      ["Carol", ["Backend", "Frontend"]],
      ["Dave", ["Backend"]],
    ]);
  });

  it("returns an empty skills array for a developer with no skills", async () => {
    await getPool().query("INSERT INTO developers (name) VALUES ('Erin')");

    const res = await request(app).get("/api/developers");

    expect(res.body.find((d: { name: string }) => d.name === "Erin").skills).toEqual([]);
  });
});

describe("GET /api/developers/:id", () => {
  it("returns the developer with skills and assigned tasks", async () => {
    const carol = await developerId("Carol");
    await getPool().query("INSERT INTO tasks (title, assignee_id) VALUES ('Build profile page', $1)", [carol]);
    await getPool().query("INSERT INTO tasks (title) VALUES ('Unassigned task')");

    const res = await request(app).get(`/api/developers/${carol}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Carol");
    expect(res.body.skills.map((s: { name: string }) => s.name)).toEqual(["Backend", "Frontend"]);
    expect(res.body.tasks).toEqual([{ id: expect.any(Number), title: "Build profile page", status: "todo" }]);
  });

  it("returns 404 for an unknown developer", async () => {
    const res = await request(app).get("/api/developers/999999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it.each(["abc", "0", "-1", "1.5"])("returns 400 for id %s", async (id) => {
    const res = await request(app).get(`/api/developers/${id}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
