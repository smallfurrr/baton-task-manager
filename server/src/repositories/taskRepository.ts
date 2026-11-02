import type { Queryable } from "../db/pool.js";
import type { SkillRow } from "./skillRepository.js";

/** One task as stored: subtasks are separate rows pointing at their parent. */
export interface TaskRow {
  id: number;
  parentId: number | null;
  title: string;
  status: string;
  skills: SkillRow[];
  assignee: { id: number; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

const SELECT_TASK = `
  SELECT t.id, t.parent_id AS "parentId", t.title, t.status,
         t.created_at AS "createdAt", t.updated_at AS "updatedAt",
         CASE WHEN d.id IS NULL THEN NULL
              ELSE json_build_object('id', d.id, 'name', d.name) END AS assignee,
         COALESCE((
           SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
           FROM task_skills ts JOIN skills s ON s.id = ts.skill_id
           WHERE ts.task_id = t.id
         ), '[]') AS skills
  FROM tasks t
  LEFT JOIN developers d ON d.id = t.assignee_id`;

export async function listTasks(db: Queryable): Promise<TaskRow[]> {
  const { rows } = await db.query<TaskRow>(`${SELECT_TASK} ORDER BY t.created_at DESC, t.id DESC`);
  return rows;
}

export async function findTaskById(db: Queryable, id: number): Promise<TaskRow | undefined> {
  const { rows } = await db.query<TaskRow>(`${SELECT_TASK} WHERE t.id = $1`, [id]);
  return rows[0];
}

/** The task and all its descendants, in no particular order. Empty if the task does not exist. */
export async function findSubtreeRows(db: Queryable, rootId: number): Promise<TaskRow[]> {
  const { rows } = await db.query<TaskRow>(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM tasks WHERE id = $1
       UNION ALL
       SELECT t.id FROM tasks t JOIN subtree s ON t.parent_id = s.id
     )
     ${SELECT_TASK}
     WHERE t.id IN (SELECT id FROM subtree)`,
    [rootId],
  );
  return rows;
}

export async function insertTask(db: Queryable, title: string, parentId: number | null): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO tasks (title, parent_id) VALUES ($1, $2) RETURNING id",
    [title, parentId],
  );
  return rows[0]!.id;
}

export async function insertTaskSkills(db: Queryable, taskId: number, skillIds: number[]): Promise<void> {
  if (skillIds.length === 0) return;
  await db.query("INSERT INTO task_skills (task_id, skill_id) SELECT $1, unnest($2::int[])", [taskId, skillIds]);
}

/** Returns the subset of `ids` that exist as skills. */
export async function findExistingSkillIds(db: Queryable, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query<{ id: number }>("SELECT id FROM skills WHERE id = ANY($1::int[])", [ids]);
  return rows.map((row) => row.id);
}

export interface TaskChanges {
  status?: string;
  /** `null` clears the assignee; `undefined` leaves it unchanged. */
  assigneeId?: number | null;
}

export async function updateTask(db: Queryable, taskId: number, changes: TaskChanges): Promise<void> {
  await db.query(
    `UPDATE tasks
     SET status      = CASE WHEN $2::boolean THEN $3::text ELSE status END,
         assignee_id = CASE WHEN $4::boolean THEN $5::int ELSE assignee_id END,
         updated_at  = now()
     WHERE id = $1`,
    [
      taskId,
      changes.status !== undefined,
      changes.status ?? null,
      changes.assigneeId !== undefined,
      changes.assigneeId ?? null,
    ],
  );
}
