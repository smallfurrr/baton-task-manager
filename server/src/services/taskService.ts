import { getPool, withTransaction } from "../db/pool.js";
import { InvalidReferenceError, NotFoundError, SkillMismatchError } from "../errors.js";
import * as developers from "../repositories/developerRepository.js";
import * as tasks from "../repositories/taskRepository.js";
import { missingSkills } from "./assignment.js";
import { nestTasks, type Task } from "./taskTree.js";

export type { Task };

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface CreateTaskInput {
  title: string;
  skillIds: number[];
}

/** Top-level tasks, newest first, each with its subtasks nested underneath. */
export async function listTasks(): Promise<Task[]> {
  const rows = await tasks.listTasks(getPool());
  const rootIds = rows.filter((row) => row.parentId === null).map((row) => row.id);
  return nestTasks(rows, rootIds);
}

/** One task (top-level or a subtask) with its whole subtree. */
export async function getTask(id: number): Promise<Task> {
  const rows = await tasks.findSubtreeRows(getPool(), id);
  const [task] = nestTasks(rows, [id]);
  if (!task) throw new NotFoundError(`Task ${id} not found`);
  return task;
}

export async function createTask({ title, skillIds }: CreateTaskInput): Promise<Task> {
  const uniqueSkillIds = [...new Set(skillIds)];

  const id = await withTransaction(async (client) => {
    const existing = new Set(await tasks.findExistingSkillIds(client, uniqueSkillIds));
    const unknown = uniqueSkillIds.filter((skillId) => !existing.has(skillId));
    if (unknown.length > 0) {
      throw new InvalidReferenceError(`Unknown skill id(s): ${unknown.join(", ")}`, { skillIds: unknown });
    }
    const taskId = await tasks.insertTask(client, title);
    await tasks.insertTaskSkills(client, taskId, uniqueSkillIds);
    return taskId;
  });

  return getTask(id);
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  /** `null` clears the assignee; omitted leaves it unchanged. */
  assigneeId?: number | null;
}

/**
 * Change a task's status and/or assignee in one transaction, so a rejected
 * change leaves the task untouched. Enforces the skill rule whenever an
 * assignee is set: the developer must hold every skill the task requires.
 */
export async function updateTask(taskId: number, changes: UpdateTaskInput): Promise<Task> {
  await withTransaction(async (client) => {
    const task = await tasks.findTaskById(client, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    const { assigneeId } = changes;
    if (assigneeId !== undefined && assigneeId !== null) {
      const developer = await developers.findDeveloperById(client, assigneeId);
      if (!developer) throw new InvalidReferenceError(`Developer ${assigneeId} not found`);

      const missing = missingSkills(task.skills, developer.skills);
      if (missing.length > 0) throw new SkillMismatchError(developer.name, missing);
    }

    await tasks.updateTask(client, taskId, changes);
  });

  return getTask(taskId);
}
