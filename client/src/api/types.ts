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
  /** Id of the parent task, or null for a top-level task. */
  parentId: number | null;
  title: string;
  status: TaskStatus;
  skills: Skill[];
  assignee: { id: number; name: string } | null;
  /** Subtasks in creation order, each with its own subtasks, to any depth. */
  subtasks: Task[];
  createdAt: string;
  updatedAt: string;
}

/** A task to create, with any subtasks to create under it (to any depth). */
export interface CreateTaskInput {
  title: string;
  skillIds: number[];
  subtasks: CreateTaskInput[];
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  /** `null` clears the assignee; omitted leaves it unchanged. */
  assigneeId?: number | null;
}
