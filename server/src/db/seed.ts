import { pathToFileURL } from "node:url";
import type pg from "pg";
import { closePool, getPool } from "./pool.js";

export const SEED_SKILLS = ["Frontend", "Backend"] as const;

export const SEED_DEVELOPERS: ReadonlyArray<{ name: string; skills: readonly string[] }> = [
  { name: "Alice", skills: ["Frontend"] },
  { name: "Bob", skills: ["Backend"] },
  { name: "Carol", skills: ["Frontend", "Backend"] },
  { name: "Dave", skills: ["Backend"] },
];

/**
 * Insert the reference data if it is missing. Safe to run repeatedly: every
 * insert is `ON CONFLICT DO NOTHING` against a unique constraint.
 */
export async function seed(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const name of SEED_SKILLS) {
      await client.query("INSERT INTO skills (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [name]);
    }
    for (const developer of SEED_DEVELOPERS) {
      await client.query("INSERT INTO developers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [
        developer.name,
      ]);
      for (const skill of developer.skills) {
        await client.query(
          `INSERT INTO developer_skills (developer_id, skill_id)
           SELECT d.id, s.id FROM developers d, skills s WHERE d.name = $1 AND s.name = $2
           ON CONFLICT DO NOTHING`,
          [developer.name, skill],
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Run as a script: `npm run seed` (dev) or `node dist/db/seed.js` (Docker).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await seed(getPool());
    console.log("Seed complete");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
