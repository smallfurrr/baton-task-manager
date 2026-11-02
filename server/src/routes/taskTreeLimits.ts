import { ValidationError } from "../errors.js";

export const MAX_TASK_DEPTH = 10;
export const MAX_TASKS_PER_REQUEST = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reject a create-task body whose subtask tree is too deep or too large.
 * Runs on the raw body, iteratively and before schema validation, so even a
 * very deeply nested payload is rejected without deep recursion.
 */
export function checkTreeLimits(body: unknown): void {
  const pending: Array<{ node: unknown; depth: number }> = [{ node: body, depth: 1 }];
  let count = 0;

  while (pending.length > 0) {
    const { node, depth } = pending.pop()!;
    if (!isRecord(node)) continue;

    count++;
    if (depth > MAX_TASK_DEPTH) {
      throw new ValidationError(`Subtasks can be nested at most ${MAX_TASK_DEPTH} levels deep`, {
        maxDepth: MAX_TASK_DEPTH,
      });
    }
    if (count > MAX_TASKS_PER_REQUEST) {
      throw new ValidationError(`A request can create at most ${MAX_TASKS_PER_REQUEST} tasks including subtasks`, {
        maxTasks: MAX_TASKS_PER_REQUEST,
      });
    }

    if (Array.isArray(node.subtasks)) {
      for (const subtask of node.subtasks) pending.push({ node: subtask, depth: depth + 1 });
    }
  }
}
