import type { Queryable } from "../db/pool.js";
import type { SkillRow } from "./skillRepository.js";

export interface DeveloperRow {
  id: number;
  name: string;
  skills: SkillRow[];
}

export interface DeveloperTaskRow {
  id: number;
  title: string;
  status: string;
}

const DEVELOPER_WITH_SKILLS = `
  SELECT d.id, d.name,
         COALESCE(
           json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
             FILTER (WHERE s.id IS NOT NULL),
           '[]'
         ) AS skills
  FROM developers d
  LEFT JOIN developer_skills ds ON ds.developer_id = d.id
  LEFT JOIN skills s ON s.id = ds.skill_id`;

export async function listDevelopers(db: Queryable): Promise<DeveloperRow[]> {
  const { rows } = await db.query<DeveloperRow>(`${DEVELOPER_WITH_SKILLS} GROUP BY d.id ORDER BY d.name`);
  return rows;
}

export async function findDeveloperById(db: Queryable, id: number): Promise<DeveloperRow | undefined> {
  const { rows } = await db.query<DeveloperRow>(`${DEVELOPER_WITH_SKILLS} WHERE d.id = $1 GROUP BY d.id`, [id]);
  return rows[0];
}

export async function listTasksAssignedTo(db: Queryable, developerId: number): Promise<DeveloperTaskRow[]> {
  const { rows } = await db.query<DeveloperTaskRow>(
    "SELECT id, title, status FROM tasks WHERE assignee_id = $1 ORDER BY created_at DESC, id DESC",
    [developerId],
  );
  return rows;
}
