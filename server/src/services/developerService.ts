import { getPool } from "../db/pool.js";
import { NotFoundError } from "../errors.js";
import * as developers from "../repositories/developerRepository.js";

export function listDevelopers(): Promise<developers.DeveloperRow[]> {
  return developers.listDevelopers(getPool());
}

export async function getDeveloper(
  id: number,
): Promise<developers.DeveloperRow & { tasks: developers.DeveloperTaskRow[] }> {
  const db = getPool();
  const developer = await developers.findDeveloperById(db, id);
  if (!developer) throw new NotFoundError(`Developer ${id} not found`);
  return { ...developer, tasks: await developers.listTasksAssignedTo(db, id) };
}
