import { getPool, withTransaction } from "../db/pool.js";
import { InvalidReferenceError, NotFoundError, SkillMismatchError } from "../errors.js";
import * as developers from "../repositories/developerRepository.js";
import * as tasks from "../repositories/taskRepository.js";
import { missingSkills } from "./assignment.js";

export type Task = tasks.TaskRow;

export interface CreateTaskInput {
  title: string;
  skillIds: number[];
}

export function listTasks(): Promise<Task[]> {
  return tasks.listTasks(getPool());
}

export async function getTask(id: number): Promise<Task> {
  const task = await tasks.findTaskById(getPool(), id);
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

/**
 * Assign a task to a developer, or clear the assignee with `null`.
 * Enforces the skill rule: the developer must hold every skill the task requires.
 */
export async function assignTask(taskId: number, developerId: number | null): Promise<Task> {
  await withTransaction(async (client) => {
    const task = await tasks.findTaskById(client, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    if (developerId !== null) {
      const developer = await developers.findDeveloperById(client, developerId);
      if (!developer) throw new InvalidReferenceError(`Developer ${developerId} not found`);

      const missing = missingSkills(task.skills, developer.skills);
      if (missing.length > 0) throw new SkillMismatchError(developer.name, missing);
    }

    await tasks.setAssignee(client, taskId, developerId);
  });

  return getTask(taskId);
}
