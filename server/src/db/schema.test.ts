import type pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePool, getPool } from "./pool.js";
import { assertTestDatabase, resetDatabase } from "../test/db.js";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

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
