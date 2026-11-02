import { describe, expect, it } from "vitest";
import type { TaskRow } from "../repositories/taskRepository.js";
import { nestTasks } from "./taskTree.js";

function row(id: number, parentId: number | null = null): TaskRow {
  return {
    id,
    parentId,
    title: `task ${id}`,
    status: "todo",
    skills: [],
    assignee: null,
    createdAt: new Date("2026-11-02T00:00:00Z"),
    updatedAt: new Date("2026-11-02T00:00:00Z"),
  };
}

/** Compact view of a tree: [id, [children...]] */
function shape(tasks: ReturnType<typeof nestTasks>): unknown[] {
  return tasks.map((task) => [task.id, shape(task.subtasks)]);
}

describe("nestTasks", () => {
  it("returns an empty list when there are no roots", () => {
    expect(nestTasks([], [])).toEqual([]);
    expect(nestTasks([row(1)], [])).toEqual([]);
  });

  it("gives a task with no subtasks an empty subtasks array", () => {
    const [task] = nestTasks([row(1)], [1]);

    expect(task?.subtasks).toEqual([]);
  });

  it("nests subtasks to any depth", () => {
    const rows = [row(1), row(2, 1), row(3, 2), row(4, 3)];

    expect(shape(nestTasks(rows, [1]))).toEqual([[1, [[2, [[3, [[4, []]]]]]]]]);
  });

  it("orders children by id regardless of the order of the rows", () => {
    const rows = [row(5, 1), row(1), row(3, 1), row(4, 3), row(2, 1)];

    expect(shape(nestTasks(rows, [1]))).toEqual([[1, [[2, []], [3, [[4, []]]], [5, []]]]]);
  });

  it("keeps roots in the order given", () => {
    const rows = [row(1), row(2), row(3), row(4, 2)];

    expect(shape(nestTasks(rows, [3, 1, 2]))).toEqual([[3, []], [1, []], [2, [[4, []]]]]);
  });

  it("builds only the requested subtree when the root is itself a subtask", () => {
    const rows = [row(1), row(2, 1), row(3, 2), row(4, 1)];

    expect(shape(nestTasks(rows, [2]))).toEqual([[2, [[3, []]]]]);
  });

  it("does not list a subtask at the top level unless asked for", () => {
    const rows = [row(1), row(2, 1)];

    expect(shape(nestTasks(rows, [1]))).toEqual([[1, [[2, []]]]]);
  });

  it("ignores ids that are not in the rows", () => {
    expect(nestTasks([row(1)], [99, 1])).toHaveLength(1);
  });

  it("ignores rows whose parent is not in the rows", () => {
    const rows = [row(2, 1)];

    expect(nestTasks(rows, [2])[0]?.subtasks).toEqual([]);
  });

  it("does not mutate the input rows", () => {
    const rows = [row(1), row(2, 1)];

    nestTasks(rows, [1]);

    expect(rows[0]).not.toHaveProperty("subtasks");
  });
});
