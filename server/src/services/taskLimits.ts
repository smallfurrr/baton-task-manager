import { ValidationError } from "../errors.js";

/** Levels counted from the task itself: task, subtask, sub-subtask. */
export const MAX_TASK_DEPTH = 3;
export const MAX_TASKS_PER_REQUEST = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reject a task tree that is too deep or too large. This is the rule behind
 * the caps above; `createTask` enforces it for every caller. It reads the
 * tree iteratively and accepts `unknown`, so the route can also run it on the
 * raw request body before schema validation and reject even a very deeply
 * nested payload without deep recursion.
 */
export function checkTreeLimits(body: unknown): void {
  const pending: Array<{ node: unknown; depth: number }> = [{ node: body, depth: 1 }];
  let count = 0;

  while (pending.length > 0) {
    const { node, depth } = pending.pop()!;
    if (!isRecord(node)) continue;

    count++;
    if (depth > MAX_TASK_DEPTH) {
      throw new ValidationError(`Tasks can be nested at most ${MAX_TASK_DEPTH} levels deep, counting the task itself`, {
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
