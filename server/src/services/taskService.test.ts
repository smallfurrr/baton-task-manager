import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePool, getPool } from "../db/pool.js";
import { seed } from "../db/seed.js";
import { InvalidReferenceError, NotFoundError, SkillMismatchError } from "../errors.js";
import { resetDatabase } from "../test/db.js";
import { createTask, getTask, updateTask } from "./taskService.js";

async function idOf(table: "skills" | "developers", name: string): Promise<number> {
  const { rows } = await getPool().query<{ id: number }>(`SELECT id FROM ${table} WHERE name = $1`, [name]);
  return rows[0]!.id;
}

function assignTask(taskId: number, assigneeId: number | null) {
  return updateTask(taskId, { assigneeId });
}

async function taskRequiring(...skillNames: string[]): Promise<number> {
  const skillIds = await Promise.all(skillNames.map((name) => idOf("skills", name)));
  return (await createTask({ title: `Needs ${skillNames.join("+") || "nothing"}`, skillIds })).id;
}

beforeEach(async () => {
  await resetDatabase(getPool());
  await seed(getPool());
});

afterAll(closePool);

describe("assignTask: skill rule", () => {
  it("lets Carol (Frontend + Backend) take a Frontend + Backend task", async () => {
    const taskId = await taskRequiring("Frontend", "Backend");
    const carol = await idOf("developers", "Carol");

    const task = await assignTask(taskId, carol);

    expect(task.assignee).toEqual({ id: carol, name: "Carol" });
  });

  it("lets a developer take a task requiring one skill they hold", async () => {
    const task = await assignTask(await taskRequiring("Backend"), await idOf("developers", "Bob"));

    expect(task.assignee?.name).toBe("Bob");
  });

  it("lets a developer with extra skills take a single-skill task", async () => {
    const task = await assignTask(await taskRequiring("Frontend"), await idOf("developers", "Carol"));

    expect(task.assignee?.name).toBe("Carol");
  });

  it("rejects Alice (Frontend only) on a Frontend + Backend task, naming the missing skill", async () => {
    const taskId = await taskRequiring("Frontend", "Backend");
    const alice = await idOf("developers", "Alice");

    const error = await assignTask(taskId, alice).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SkillMismatchError);
    expect((error as SkillMismatchError).message).toContain("Alice");
    expect((error as SkillMismatchError).message).toContain("Backend");
    expect((error as SkillMismatchError).message).not.toContain("Frontend");
  });

  it("rejects Bob (Backend only) on a Frontend task", async () => {
    const taskId = await taskRequiring("Frontend");

    await expect(assignTask(taskId, await idOf("developers", "Bob"))).rejects.toBeInstanceOf(SkillMismatchError);
  });

  it("rejects Dave (Backend only) on a Frontend + Backend task", async () => {
    const taskId = await taskRequiring("Frontend", "Backend");

    await expect(assignTask(taskId, await idOf("developers", "Dave"))).rejects.toBeInstanceOf(SkillMismatchError);
  });

  it("lets any developer take a task that requires no skills", async () => {
    for (const name of ["Alice", "Bob", "Carol", "Dave"]) {
      const task = await assignTask(await taskRequiring(), await idOf("developers", name));

      expect(task.assignee?.name).toBe(name);
    }
  });

  it("lets a developer with no skills take a task that requires no skills", async () => {
    const { rows } = await getPool().query<{ id: number }>("INSERT INTO developers (name) VALUES ('Erin') RETURNING id");

    const task = await assignTask(await taskRequiring(), rows[0]!.id);

    expect(task.assignee?.name).toBe("Erin");
  });

  it("keeps the existing assignee when a reassignment is rejected", async () => {
    const taskId = await taskRequiring("Backend");
    await assignTask(taskId, await idOf("developers", "Bob"));

    await expect(assignTask(taskId, await idOf("developers", "Alice"))).rejects.toBeInstanceOf(SkillMismatchError);

    expect((await getTask(taskId)).assignee?.name).toBe("Bob");
  });
});

describe("assignTask: other cases", () => {
  it("clears the assignee with null", async () => {
    const taskId = await taskRequiring("Backend");
    await assignTask(taskId, await idOf("developers", "Bob"));

    const task = await assignTask(taskId, null);

    expect(task.assignee).toBeNull();
  });

  it("clearing an already-unassigned task succeeds", async () => {
    const task = await assignTask(await taskRequiring(), null);

    expect(task.assignee).toBeNull();
  });

  it("rejects an unknown developer", async () => {
    await expect(assignTask(await taskRequiring(), 999999)).rejects.toBeInstanceOf(InvalidReferenceError);
  });

  it("rejects an unknown task", async () => {
    await expect(assignTask(999999, await idOf("developers", "Alice"))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not change the status", async () => {
    const taskId = await taskRequiring("Backend");
    await getPool().query("UPDATE tasks SET status = 'in_progress' WHERE id = $1", [taskId]);

    const task = await assignTask(taskId, await idOf("developers", "Bob"));

    expect(task.status).toBe("in_progress");
  });
});
