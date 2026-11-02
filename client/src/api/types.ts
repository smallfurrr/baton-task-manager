/** Shapes returned by the API. Kept in sync by hand with the server's responses. */

export interface Skill {
  id: number;
  name: string;
}

export interface Developer {
  id: number;
  name: string;
  skills: Skill[];
}

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  skills: Skill[];
  assignee: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  skillIds: number[];
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  /** `null` clears the assignee; omitted leaves it unchanged. */
  assigneeId?: number | null;
}
