import { getPool } from "../db/pool.js";
import { NotFoundError } from "../errors.js";
import * as skills from "../repositories/skillRepository.js";

export function listSkills(): Promise<skills.SkillRow[]> {
  return skills.listSkills(getPool());
}

export async function getSkill(id: number): Promise<skills.SkillRow & { developers: skills.SkillRow[] }> {
  const db = getPool();
  const skill = await skills.findSkillById(db, id);
  if (!skill) throw new NotFoundError(`Skill ${id} not found`);
  return { ...skill, developers: await skills.listDevelopersWithSkill(db, id) };
}
