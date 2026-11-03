import { getPool } from "../db/pool.js";

/** The id of the seeded skill or developer with this name. */
export async function idOf(table: "skills" | "developers", name: string): Promise<number> {
  const { rows } = await getPool().query<{ id: number }>(`SELECT id FROM ${table} WHERE name = $1`, [name]);
  return rows[0]!.id;
}

/** How many tasks exist, subtasks included. */
export async function taskCount(): Promise<number> {
  const { rows } = await getPool().query<{ n: number }>("SELECT count(*)::int AS n FROM tasks");
  return rows[0]!.n;
}

/** Insert a task row directly, skipping the service and its rules. */
export async function insertTask(title: string, parentId: number | null = null): Promise<number> {
  const { rows } = await getPool().query<{ id: number }>(
    "INSERT INTO tasks (title, parent_id) VALUES ($1, $2) RETURNING id",
    [title, parentId],
  );
  return rows[0]!.id;
}
