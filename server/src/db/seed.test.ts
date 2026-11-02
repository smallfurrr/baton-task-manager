import type pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePool, getPool } from "./pool.js";
import { seed } from "./seed.js";
import { resetDatabase } from "../test/db.js";

let pool: pg.Pool;

async function count(table: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`);
  return Number(rows[0]!.n);
}

async function skillsByDeveloper(): Promise<Record<string, string[]>> {
  const { rows } = await pool.query<{ developer: string; skill: string }>(
    `SELECT d.name AS developer, s.name AS skill
     FROM developer_skills ds
     JOIN developers d ON d.id = ds.developer_id
     JOIN skills s ON s.id = ds.skill_id
     ORDER BY d.name, s.name`,
  );
  const result: Record<string, string[]> = {};
  for (const row of rows) (result[row.developer] ??= []).push(row.skill);
  return result;
}

beforeEach(async () => {
  pool = getPool();
  await resetDatabase(pool);
});

afterAll(closePool);

describe("seed", () => {
  it("creates the developers, skills and skill assignments from the brief", async () => {
    await seed(pool);

    expect(await skillsByDeveloper()).toEqual({
      Alice: ["Frontend"],
      Bob: ["Backend"],
      Carol: ["Backend", "Frontend"],
      Dave: ["Backend"],
    });
  });

  it("is safe to run repeatedly: no duplicates", async () => {
    await seed(pool);
    await seed(pool);
    await seed(pool);

    expect(await count("developers")).toBe(4);
    expect(await count("skills")).toBe(2);
    expect(await count("developer_skills")).toBe(5);
  });

  it("fills in what is missing without touching existing rows", async () => {
    await pool.query("INSERT INTO developers (name) VALUES ('Alice'), ('Erin')");

    await seed(pool);

    expect(await count("developers")).toBe(5);
    expect((await skillsByDeveloper()).Alice).toEqual(["Frontend"]);
  });
});
