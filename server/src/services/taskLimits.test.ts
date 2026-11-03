import { describe, expect, it } from "vitest";
import { ValidationError } from "../errors.js";
import { chain } from "../test/trees.js";
import { checkTreeLimits, MAX_TASK_DEPTH, MAX_TASKS_PER_REQUEST } from "./taskLimits.js";

type Node = { title: string; subtasks: Node[] };

/** A root with `count - 1` direct subtasks, `count` tasks in total. */
function wide(count: number): Node {
  return { title: "root", subtasks: Array.from({ length: count - 1 }, () => ({ title: "child", subtasks: [] })) };
}

describe("checkTreeLimits", () => {
  it("accepts a single task and a task without a subtasks field", () => {
    expect(() => checkTreeLimits({ title: "t" })).not.toThrow();
    expect(() => checkTreeLimits({ title: "t", subtasks: [] })).not.toThrow();
  });

  it(`accepts a tree exactly ${MAX_TASK_DEPTH} levels deep`, () => {
    expect(() => checkTreeLimits(chain(MAX_TASK_DEPTH))).not.toThrow();
  });

  it(`rejects a tree ${MAX_TASK_DEPTH + 1} levels deep`, () => {
    const error = (() => {
      try {
        checkTreeLimits(chain(MAX_TASK_DEPTH + 1));
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain(`${MAX_TASK_DEPTH} levels`);
  });

  it(`accepts exactly ${MAX_TASKS_PER_REQUEST} tasks`, () => {
    expect(() => checkTreeLimits(wide(MAX_TASKS_PER_REQUEST))).not.toThrow();
  });

  it(`rejects ${MAX_TASKS_PER_REQUEST + 1} tasks`, () => {
    expect(() => checkTreeLimits(wide(MAX_TASKS_PER_REQUEST + 1))).toThrow(ValidationError);
  });

  it("counts tasks across branches and levels, not just siblings", () => {
    const branch = (): Node => ({ title: "b", subtasks: [{ title: "c", subtasks: [] }, { title: "c", subtasks: [] }] });
    const root: Node = { title: "root", subtasks: Array.from({ length: 34 }, branch) }; // 1 + 34 * 3 = 103

    expect(() => checkTreeLimits(root)).toThrow(ValidationError);
  });

  it("rejects a very deep payload without overflowing the stack", () => {
    expect(() => checkTreeLimits(chain(5000))).toThrow(ValidationError);
  });

  it("leaves malformed shapes for the schema to report", () => {
    expect(() => checkTreeLimits(undefined)).not.toThrow();
    expect(() => checkTreeLimits("nope")).not.toThrow();
    expect(() => checkTreeLimits({ title: "t", subtasks: "x" })).not.toThrow();
    expect(() => checkTreeLimits({ title: "t", subtasks: [1, null, "x"] })).not.toThrow();
  });
});
