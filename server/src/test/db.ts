import type pg from "pg";

/** Refuse to touch any database whose name does not end in `_test`. */
export async function assertTestDatabase(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query<{ name: string }>("SELECT current_database() AS name");
  const name = rows[0]?.name ?? "";
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to modify database "${name}": test databases must end in "_test"`);
  }
}

/** Empty every table and restart identity counters. Test databases only. */
export async function resetDatabase(pool: pg.Pool): Promise<void> {
  await assertTestDatabase(pool);
  await pool.query(
    "TRUNCATE task_skills, tasks, developer_skills, developers, skills RESTART IDENTITY CASCADE",
  );
}
