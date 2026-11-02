import type { Queryable } from "../db/pool.js";

export interface SkillRow {
  id: number;
  name: string;
}

export async function listSkills(db: Queryable): Promise<SkillRow[]> {
  const { rows } = await db.query<SkillRow>("SELECT id, name FROM skills ORDER BY name");
  return rows;
}

export async function findSkillById(db: Queryable, id: number): Promise<SkillRow | undefined> {
  const { rows } = await db.query<SkillRow>("SELECT id, name FROM skills WHERE id = $1", [id]);
  return rows[0];
}

export async function listDevelopersWithSkill(db: Queryable, skillId: number): Promise<SkillRow[]> {
  const { rows } = await db.query<SkillRow>(
    `SELECT d.id, d.name
     FROM developers d
     JOIN developer_skills ds ON ds.developer_id = d.id
     WHERE ds.skill_id = $1
     ORDER BY d.name`,
    [skillId],
  );
  return rows;
}
