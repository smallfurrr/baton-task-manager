import type { TaskRow } from "../repositories/taskRepository.js";

/** A task with its subtasks nested underneath, to any depth. */
export type Task = TaskRow & { subtasks: Task[] };

/**
 * Build the nested tree for the tasks in `rootIds` (kept in that order) from a
 * flat list of rows. Children are ordered by id, which is creation order.
 * Rows that are not reachable from a root are ignored.
 */
export function nestTasks(rows: readonly TaskRow[], rootIds: readonly number[]): Task[] {
  const nodes = new Map<number, Task>(rows.map((row) => [row.id, { ...row, subtasks: [] }]));

  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const parent = row.parentId === null ? undefined : nodes.get(row.parentId);
    if (parent) parent.subtasks.push(nodes.get(row.id)!);
  }

  return rootIds.flatMap((id) => {
    const node = nodes.get(id);
    return node ? [node] : [];
  });
}
