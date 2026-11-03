/** Must list the same values as the server's `TASK_STATUSES` (`server/src/domain/task.ts`); kept in sync by hand. */
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To-do",
  in_progress: "In progress",
  done: "Done",
};
