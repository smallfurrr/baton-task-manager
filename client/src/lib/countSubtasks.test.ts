import { describe, expect, it } from "vitest";
import { countSubtasks } from "./countSubtasks";

describe("countSubtasks", () => {
  it("is 0 for a task with no subtasks", () => {
    expect(countSubtasks({ subtasks: [] })).toBe(0);
  });

  it("counts subtasks at every depth", () => {
    const task = {
      subtasks: [{ subtasks: [{ subtasks: [] }, { subtasks: [] }] }, { subtasks: [] }],
    };

    expect(countSubtasks(task)).toBe(4);
  });
});
