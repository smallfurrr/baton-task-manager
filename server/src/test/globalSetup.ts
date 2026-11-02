import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { testDatabaseUrl, withDatabase } from "./testUrl.js";

const DUPLICATE_DATABASE = "42P04";

/**
 * Create the test database if needed and bring it to the latest migration.
 * Connects through the `postgres` maintenance database, so the dev database
 * is never touched.
 */
export default async function setup(): Promise<void> {
  const testUrl = testDatabaseUrl(process.env.DATABASE_URL);
  const database = decodeURIComponent(new URL(testUrl).pathname.slice(1));

  const admin = new pg.Client({ connectionString: withDatabase(testUrl, "postgres") });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (!rowCount) {
      try {
        await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(database)}`);
      } catch (err) {
        if ((err as { code?: string }).code !== DUPLICATE_DATABASE) throw err;
      }
    }
  } finally {
    await admin.end();
  }

  await runner({
    databaseUrl: testUrl,
    dir: path.resolve(import.meta.dirname, "../../migrations"),
    direction: "up",
    migrationsTable: "pgmigrations",
    log: () => {},
  });
}
