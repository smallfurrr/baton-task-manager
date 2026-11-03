import type pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TASK_STATUSES } from "../domain/task.js";
import { closePool, getPool } from "./pool.js";
import { assertTestDatabase, resetDatabase } from "../test/db.js";
import { insertTask } from "../test/fixtures.js";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

let pool: pg.Pool;

async function insertId(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(`${sql} RETURNING id`, params);
  return rows[0]!.id;
}

async function expectPgError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(async () => {
  pool = getPool();
  await resetDatabase(pool);
});

afterAll(closePool);

describe("test database guard", () => {
  it("is connected to a *_test database", async () => {
    await expect(assertTestDatabase(pool)).resolves.toBeUndefined();
  });
});

describe("schema constraints", () => {
  it("rejects a duplicate developer name", async () => {
    await pool.query("INSERT INTO developers (name) VALUES ('Alice')");

    await expectPgError(pool.query("INSERT INTO developers (name) VALUES ('Alice')"), UNIQUE_VIOLATION);
  });

  it("rejects a duplicate skill name", async () => {
    await pool.query("INSERT INTO skills (name) VALUES ('Frontend')");

    await expectPgError(pool.query("INSERT INTO skills (name) VALUES ('Frontend')"), UNIQUE_VIOLATION);
  });

  it("rejects a duplicate developer/skill pair", async () => {
    const developerId = await insertId("INSERT INTO developers (name) VALUES ('Alice')");
    const skillId = await insertId("INSERT INTO skills (name) VALUES ('Frontend')");
    const link = "INSERT INTO developer_skills (developer_id, skill_id) VALUES ($1, $2)";
    await pool.query(link, [developerId, skillId]);

    await expectPgError(pool.query(link, [developerId, skillId]), UNIQUE_VIOLATION);
  });

  it("rejects a duplicate task/skill pair", async () => {
    const taskId = await insertId("INSERT INTO tasks (title) VALUES ('t')");
    const skillId = await insertId("INSERT INTO skills (name) VALUES ('Frontend')");
    const link = "INSERT INTO task_skills (task_id, skill_id) VALUES ($1, $2)";
    await pool.query(link, [taskId, skillId]);

    await expectPgError(pool.query(link, [taskId, skillId]), UNIQUE_VIOLATION);
  });

  it("defaults a new task to todo with no assignee", async () => {
    const { rows } = await pool.query("INSERT INTO tasks (title) VALUES ('t') RETURNING status, assignee_id");

    expect(rows[0]).toEqual({ status: "todo", assignee_id: null });
  });

  // Keeps the CHECK constraint and TASK_STATUSES in step: a status added to one must be added to the other.
  it.each(TASK_STATUSES)("accepts the status %s", async (status) => {
    await expect(pool.query("INSERT INTO tasks (title, status) VALUES ('t', $1)", [status])).resolves.toBeDefined();
  });

  it("rejects an unknown status", async () => {
    await expectPgError(pool.query("INSERT INTO tasks (title, status) VALUES ('t', 'blocked')"), CHECK_VIOLATION);
  });

  it.each([["empty", ""], ["blank", "   "], ["too long", "x".repeat(501)]])(
    "rejects a %s title",
    async (_label, title) => {
      await expectPgError(pool.query("INSERT INTO tasks (title) VALUES ($1)", [title]), CHECK_VIOLATION);
    },
  );

  it("accepts a title of exactly 500 characters", async () => {
    await expect(pool.query("INSERT INTO tasks (title) VALUES ($1)", ["x".repeat(500)])).resolves.toBeDefined();
  });

  it("clears the assignee when the developer is deleted", async () => {
    const developerId = await insertId("INSERT INTO developers (name) VALUES ('Alice')");
    const taskId = await insertId("INSERT INTO tasks (title, assignee_id) VALUES ('t', $1)", [developerId]);

    await pool.query("DELETE FROM developers WHERE id = $1", [developerId]);

    const { rows } = await pool.query("SELECT assignee_id FROM tasks WHERE id = $1", [taskId]);
    expect(rows[0]).toEqual({ assignee_id: null });
  });
});

describe("subtasks (parent_id)", () => {
  async function titles(): Promise<string[]> {
    const { rows } = await pool.query<{ title: string }>("SELECT title FROM tasks ORDER BY id");
    return rows.map((row) => row.title);
  }

  it("defaults a new task to having no parent", async () => {
    const { rows } = await pool.query("INSERT INTO tasks (title) VALUES ('t') RETURNING parent_id");

    expect(rows[0]).toEqual({ parent_id: null });
  });

  it("stores a subtask under its parent, to any depth", async () => {
    const root = await insertTask("root");
    const child = await insertTask("child", root);
    const grandchild = await insertTask("grandchild", child);

    const { rows } = await pool.query("SELECT id, parent_id FROM tasks WHERE id = $1", [grandchild]);
    expect(rows[0]).toEqual({ id: grandchild, parent_id: child });
  });

  it("rejects a parent that does not exist", async () => {
    await expectPgError(pool.query("INSERT INTO tasks (title, parent_id) VALUES ('t', 999999)"), FOREIGN_KEY_VIOLATION);
  });

  it("rejects a task being its own parent", async () => {
    const id = await insertTask("t");

    await expectPgError(pool.query("UPDATE tasks SET parent_id = id WHERE id = $1", [id]), CHECK_VIOLATION);
  });

  it("deletes a task's whole subtree with it, leaving unrelated tasks", async () => {
    const root = await insertTask("root");
    const child = await insertTask("child", root);
    await insertTask("grandchild", child);
    await insertTask("unrelated");

    await pool.query("DELETE FROM tasks WHERE id = $1", [root]);

    expect(await titles()).toEqual(["unrelated"]);
  });

  it("leaves the parent and siblings when a subtask is deleted", async () => {
    const root = await insertTask("root");
    const first = await insertTask("first", root);
    await insertTask("second", root);
    await insertTask("under first", first);

    await pool.query("DELETE FROM tasks WHERE id = $1", [first]);

    expect(await titles()).toEqual(["root", "second"]);
  });

  it("keeps a subtask's skills separate from its parent's", async () => {
    const root = await insertTask("root");
    const child = await insertTask("child", root);
    const skillId = await insertId("INSERT INTO skills (name) VALUES ('Frontend')");
    await pool.query("INSERT INTO task_skills (task_id, skill_id) VALUES ($1, $2)", [child, skillId]);

    const { rows } = await pool.query("SELECT task_id FROM task_skills");
    expect(rows).toEqual([{ task_id: child }]);
  });

  it("removes a deleted subtask's skill links with it", async () => {
    const root = await insertTask("root");
    const child = await insertTask("child", root);
    const skillId = await insertId("INSERT INTO skills (name) VALUES ('Frontend')");
    await pool.query("INSERT INTO task_skills (task_id, skill_id) VALUES ($1, $2)", [child, skillId]);

    await pool.query("DELETE FROM tasks WHERE id = $1", [root]);

    const { rows } = await pool.query("SELECT count(*)::int AS n FROM task_skills");
    expect(rows[0]).toEqual({ n: 0 });
  });
});

describe("task_skills.added_by_ai", () => {
  async function taskAndSkill(): Promise<{ taskId: number; skillId: number }> {
    const taskId = await insertId("INSERT INTO tasks (title) VALUES ('t')");
    const skillId = await insertId("INSERT INTO skills (name) VALUES ('Backend')");
    return { taskId, skillId };
  }

  it("defaults to false, so a skill counts as user-chosen unless stated", async () => {
    const { taskId, skillId } = await taskAndSkill();

    const { rows } = await pool.query(
      "INSERT INTO task_skills (task_id, skill_id) VALUES ($1, $2) RETURNING added_by_ai",
      [taskId, skillId],
    );

    expect(rows[0]).toEqual({ added_by_ai: false });
  });

  it("stores true when the classifier added the skill", async () => {
    const { taskId, skillId } = await taskAndSkill();

    const { rows } = await pool.query(
      "INSERT INTO task_skills (task_id, skill_id, added_by_ai) VALUES ($1, $2, true) RETURNING added_by_ai",
      [taskId, skillId],
    );

    expect(rows[0]).toEqual({ added_by_ai: true });
  });

  it("does not accept null", async () => {
    const { taskId, skillId } = await taskAndSkill();

    await expectPgError(
      pool.query("INSERT INTO task_skills (task_id, skill_id, added_by_ai) VALUES ($1, $2, NULL)", [taskId, skillId]),
      "23502",
    );
  });
});
