import type { TaskStatus } from "../api/types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To-do",
  in_progress: "In progress",
  done: "Done",
};
