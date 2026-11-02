import { getPool, withTransaction } from "../db/pool.js";
import { InvalidReferenceError, NotFoundError } from "../errors.js";
import * as tasks from "../repositories/taskRepository.js";

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
