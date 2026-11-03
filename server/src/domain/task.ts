/**
 * Task vocabulary shared by every layer. The database CHECK on `tasks.status`
 * (migration 001) must list the same values; `db/schema.test.ts` guards that.
 */
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** A descendant that is not Done yet, as reported when a task cannot become Done. */
export interface OpenSubtask {
  id: number;
  title: string;
  status: TaskStatus;
}
