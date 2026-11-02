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
      parentId: null,
      title: "Write the docs",
      status: "todo",
      skills: [],
      assignee: null,
      subtasks: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("creates a task when skillIds is an explicit empty array", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "No skills yet", skillIds: [] });

    expect(res.status).toBe(201);
    expect(res.body.skills).toEqual([]);
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

describe("PATCH /api/tasks/:id", () => {
  async function createTask(title: string, ...skillNames: string[]): Promise<number> {
    const skillIds = await Promise.all(skillNames.map((name) => idOf("skills", name)));
    const res = await request(app).post("/api/tasks").send({ title, skillIds });
    return res.body.id;
  }

  it("changes the status", async () => {
    const id = await createTask("t");

    const res = await request(app).patch(`/api/tasks/${id}`).send({ status: "in_progress" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
  });

  it.each(["todo", "in_progress", "done"])("accepts status %s", async (status) => {
    const res = await request(app).patch(`/api/tasks/${await createTask("t")}`).send({ status });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(status);
  });

  it("assigns a qualified developer", async () => {
    const id = await createTask("t", "Frontend", "Backend");
    const carol = await idOf("developers", "Carol");

    const res = await request(app).patch(`/api/tasks/${id}`).send({ assigneeId: carol });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toEqual({ id: carol, name: "Carol" });
  });

  it("returns 409 SKILL_MISMATCH naming the missing skill when the developer is not qualified", async () => {
    const id = await createTask("t", "Frontend", "Backend");

    const res = await request(app)
      .patch(`/api/tasks/${id}`)
      .send({ assigneeId: await idOf("developers", "Alice") });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SKILL_MISMATCH");
    expect(res.body.error.details.missingSkills.map((s: { name: string }) => s.name)).toEqual(["Backend"]);
    expect((await request(app).get(`/api/tasks/${id}`)).body.assignee).toBeNull();
  });

  it("unassigns with null", async () => {
    const id = await createTask("t", "Backend");
    await request(app).patch(`/api/tasks/${id}`).send({ assigneeId: await idOf("developers", "Bob") });

    const res = await request(app).patch(`/api/tasks/${id}`).send({ assigneeId: null });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBeNull();
  });

  it("leaves the assignee alone on a status-only change", async () => {
    const id = await createTask("t", "Backend");
    const bob = await idOf("developers", "Bob");
    await request(app).patch(`/api/tasks/${id}`).send({ assigneeId: bob });

    const res = await request(app).patch(`/api/tasks/${id}`).send({ status: "done" });

    expect(res.body.assignee).toEqual({ id: bob, name: "Bob" });
    expect(res.body.status).toBe("done");
  });

  it("applies status and assignee together", async () => {
    const id = await createTask("t", "Backend");

    const res = await request(app)
      .patch(`/api/tasks/${id}`)
      .send({ status: "in_progress", assigneeId: await idOf("developers", "Dave") });

    expect(res.body.status).toBe("in_progress");
    expect(res.body.assignee.name).toBe("Dave");
  });

  it("changes nothing when the assignment in a combined update is rejected", async () => {
    const id = await createTask("t", "Backend");

    const res = await request(app)
      .patch(`/api/tasks/${id}`)
      .send({ status: "done", assigneeId: await idOf("developers", "Alice") });

    expect(res.status).toBe(409);
    expect((await request(app).get(`/api/tasks/${id}`)).body.status).toBe("todo");
  });

  it("returns 422 for an unknown developer", async () => {
    const res = await request(app).patch(`/api/tasks/${await createTask("t")}`).send({ assigneeId: 999999 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_REFERENCE");
  });

  it("returns 404 for an unknown task", async () => {
    const res = await request(app).patch("/api/tasks/999999").send({ status: "done" });

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed task id", async () => {
    const res = await request(app).patch("/api/tasks/abc").send({ status: "done" });

    expect(res.status).toBe(400);
  });

  it.each([
    ["an empty body", {}],
    ["an unknown status", { status: "blocked" }],
    ["a non-string status", { status: 1 }],
    ["a string assigneeId", { assigneeId: "1" }],
    ["a zero assigneeId", { assigneeId: 0 }],
    ["a fractional assigneeId", { assigneeId: 1.5 }],
    ["an unknown property such as title", { status: "done", title: "new title" }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await request(app).patch(`/api/tasks/${await createTask("t")}`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a request with no body", async () => {
    const res = await request(app).patch(`/api/tasks/${await createTask("t")}`);

    expect(res.status).toBe(400);
  });
});

describe("subtasks in task responses", () => {
  async function insertTask(title: string, parentId: number | null = null): Promise<number> {
    const { rows } = await getPool().query<{ id: number }>(
      "INSERT INTO tasks (title, parent_id) VALUES ($1, $2) RETURNING id",
      [title, parentId],
    );
    return rows[0]!.id;
  }

  /** Compact view of a task tree: "title(child, child(grandchild))" */
  function render(task: { title: string; subtasks: unknown[] }): string {
    const children = (task.subtasks as { title: string; subtasks: unknown[] }[]).map(render);
    return children.length ? `${task.title}(${children.join(", ")})` : task.title;
  }

  it("lists only top-level tasks, with subtasks nested under them", async () => {
    const root = await insertTask("root");
    const child = await insertTask("child", root);
    await insertTask("grandchild", child);
    await insertTask("second root");

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(["second root", "root"]);
    expect(render(res.body[1])).toBe("root(child(grandchild))");
  });

  it("orders subtasks by creation order, not alphabetically", async () => {
    const root = await insertTask("root");
    await insertTask("zebra", root);
    await insertTask("apple", root);

    const res = await request(app).get("/api/tasks");

    expect(render(res.body[0])).toBe("root(zebra, apple)");
  });

  it("includes parentId, skills and assignee on nested subtasks", async () => {
    const frontend = await idOf("skills", "Frontend");
    const alice = await idOf("developers", "Alice");
    const root = await insertTask("root");
    const child = await insertTask("child", root);
    await getPool().query("INSERT INTO task_skills (task_id, skill_id) VALUES ($1, $2)", [child, frontend]);
    await getPool().query("UPDATE tasks SET assignee_id = $1 WHERE id = $2", [alice, child]);

    const res = await request(app).get("/api/tasks");

    expect(res.body[0].subtasks[0]).toMatchObject({
      id: child,
      parentId: root,
      skills: [{ id: frontend, name: "Frontend" }],
      assignee: { id: alice, name: "Alice" },
      subtasks: [],
    });
  });

  it("returns a top-level task with its whole subtree by id", async () => {
    const root = await insertTask("root");
    const child = await insertTask("child", root);
    await insertTask("grandchild", child);
    await insertTask("unrelated");

    const res = await request(app).get(`/api/tasks/${root}`);

    expect(res.status).toBe(200);
    expect(res.body.parentId).toBeNull();
    expect(render(res.body)).toBe("root(child(grandchild))");
  });

  it("returns a subtask by id with its own subtree, but not its siblings or ancestors", async () => {
    const root = await insertTask("root");
    const first = await insertTask("first", root);
    await insertTask("under first", first);
    await insertTask("second", root);

    const res = await request(app).get(`/api/tasks/${first}`);

    expect(res.status).toBe(200);
    expect(res.body.parentId).toBe(root);
    expect(render(res.body)).toBe("first(under first)");
  });

  it("includes the subtree in the response to a status change", async () => {
    const root = await insertTask("root");
    await insertTask("child", root);

    const res = await request(app).patch(`/api/tasks/${root}`).send({ status: "in_progress" });

    expect(res.status).toBe(200);
    expect(render(res.body)).toBe("root(child)");
  });

  it("updates a subtask by its own id", async () => {
    const root = await insertTask("root");
    const child = await insertTask("child", root);

    const res = await request(app).patch(`/api/tasks/${child}`).send({ status: "in_progress" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: child, parentId: root, status: "in_progress" });
  });
});

describe("POST /api/tasks with subtasks", () => {
  type NodeInput = { title: string; skillIds?: number[]; subtasks?: NodeInput[] };

  /** Compact view of a task tree: "title(child, child(grandchild))" */
  function render(task: { title: string; subtasks: unknown[] }): string {
    const children = (task.subtasks as { title: string; subtasks: unknown[] }[]).map(render);
    return children.length ? `${task.title}(${children.join(", ")})` : task.title;
  }

  const post = (body: unknown) => request(app).post("/api/tasks").send(body as object);

  function chain(levels: number): NodeInput {
    let node: NodeInput = { title: "leaf" };
    for (let level = 1; level < levels; level++) node = { title: `level ${levels - level}`, subtasks: [node] };
    return node;
  }

  it("creates a task with nested subtasks in one request", async () => {
    const res = await post({
      title: "root",
      subtasks: [{ title: "a", subtasks: [{ title: "a1" }, { title: "a2" }] }, { title: "b" }],
    });

    expect(res.status).toBe(201);
    expect(render(res.body)).toBe("root(a(a1, a2), b)");
    expect(await taskCount()).toBe(5);
  });

  it("links each subtask to its parent and starts every task To-do and unassigned", async () => {
    const res = await post({ title: "root", subtasks: [{ title: "child", subtasks: [{ title: "grandchild" }] }] });

    const child = res.body.subtasks[0];
    const grandchild = child.subtasks[0];
    expect(res.body.parentId).toBeNull();
    expect(child.parentId).toBe(res.body.id);
    expect(grandchild.parentId).toBe(child.id);
    for (const task of [res.body, child, grandchild]) {
      expect(task).toMatchObject({ status: "todo", assignee: null });
    }
  });

  it("gives each task its own skills", async () => {
    const frontend = await idOf("skills", "Frontend");
    const backend = await idOf("skills", "Backend");

    const res = await post({
      title: "root",
      skillIds: [frontend, backend],
      subtasks: [{ title: "ui", skillIds: [frontend] }, { title: "plain" }, { title: "api", skillIds: [backend, backend] }],
    });

    const names = (task: { skills: { name: string }[] }) => task.skills.map((s) => s.name);
    expect(names(res.body)).toEqual(["Backend", "Frontend"]);
    expect(names(res.body.subtasks[0])).toEqual(["Frontend"]);
    expect(names(res.body.subtasks[1])).toEqual([]);
    expect(names(res.body.subtasks[2])).toEqual(["Backend"]);
  });

  it("keeps subtasks in the order given", async () => {
    const res = await post({ title: "root", subtasks: [{ title: "zebra" }, { title: "apple" }, { title: "mango" }] });

    expect(render(res.body)).toBe("root(zebra, apple, mango)");
    const fetched = await request(app).get(`/api/tasks/${res.body.id}`);
    expect(render(fetched.body)).toBe("root(zebra, apple, mango)");
  });

  it("returns the same tree on a later read", async () => {
    const created = await post({ title: "root", subtasks: [{ title: "child", subtasks: [{ title: "grandchild" }] }] });

    const fetched = await request(app).get(`/api/tasks/${created.body.id}`);

    expect(fetched.body).toEqual(created.body);
  });

  it("shows only the root at the top level of the list", async () => {
    await post({ title: "root", subtasks: [{ title: "child" }] });

    const res = await request(app).get("/api/tasks");

    expect(res.body.map((t: { title: string }) => t.title)).toEqual(["root"]);
  });

  it("trims every title in the tree", async () => {
    const res = await post({ title: "  root  ", subtasks: [{ title: "  child  " }] });

    expect(render(res.body)).toBe("root(child)");
  });

  it("returns 422 and saves nothing when a deep subtask has an unknown skill", async () => {
    const frontend = await idOf("skills", "Frontend");

    const res = await post({
      title: "root",
      skillIds: [frontend],
      subtasks: [{ title: "ok" }, { title: "a", subtasks: [{ title: "deep", skillIds: [999999] }] }],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_REFERENCE");
    expect(res.body.error.message).toContain("999999");
    expect(await taskCount()).toBe(0);
  });

  it("lists every unknown skill id across the tree", async () => {
    const res = await post({
      title: "root",
      skillIds: [777777],
      subtasks: [{ title: "a", skillIds: [888888] }],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.details.skillIds).toEqual([777777, 888888]);
  });

  it.each([
    ["an empty subtask title", { title: "root", subtasks: [{ title: "" }] }, "subtasks.0.title"],
    ["a blank nested title", { title: "root", subtasks: [{ title: "ok", subtasks: [{ title: "   " }] }] }, "subtasks.0.subtasks.0.title"],
    ["a missing subtask title", { title: "root", subtasks: [{}] }, "subtasks.0.title"],
    ["a subtask title over 500 characters", { title: "root", subtasks: [{ title: "x".repeat(501) }] }, "subtasks.0.title"],
    ["an unknown key on a subtask", { title: "root", subtasks: [{ title: "a", assigneeId: 1 }] }, "subtasks.0"],
    ["subtasks that is not an array", { title: "root", subtasks: "nope" }, "subtasks"],
    ["a subtask that is not an object", { title: "root", subtasks: ["nope"] }, "subtasks.0"],
    ["a bad skill id on a subtask", { title: "root", subtasks: [{ title: "a", skillIds: [0] }] }, "subtasks.0.skillIds.0"],
  ])("rejects %s with 400, naming the path, and saves nothing", async (_label, body, path) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
    expect(await taskCount()).toBe(0);
  });

  it("accepts a tree 10 levels deep and rejects 11", async () => {
    expect((await post(chain(10))).status).toBe(201);

    const res = await post(chain(11));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("10 levels");
  });

  it("accepts 100 tasks in one request and rejects 101", async () => {
    const wide = (count: number) => ({
      title: "root",
      subtasks: Array.from({ length: count - 1 }, (_, i) => ({ title: `child ${i}` })),
    });

    expect((await post(wide(100))).status).toBe(201);
    expect(await taskCount()).toBe(100);

    const res = await post(wide(101));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("100 tasks");
    expect(await taskCount()).toBe(100);
  });

  it("rejects an extremely deep payload with 400 rather than crashing", async () => {
    const res = await post(chain(2000));

    expect(res.status).toBe(400);
  });
});
