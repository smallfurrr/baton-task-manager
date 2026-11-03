import type { TaskStatus } from "../domain/taskStatus";

/** Shapes returned by the API. Kept in sync by hand with the server's responses. */

export interface Skill {
  id: number;
  name: string;
}

/** A skill on a task, and whether the classifier (not the user) added it. */
export interface TaskSkill extends Skill {
  addedByAi: boolean;
}

export interface Developer {
  id: number;
  name: string;
  skills: Skill[];
}

export interface Task {
  id: number;
  /** Id of the parent task, or null for a top-level task. */
  parentId: number | null;
  title: string;
  status: TaskStatus;
  skills: TaskSkill[];
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
