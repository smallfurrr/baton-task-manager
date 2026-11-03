import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { closePool, getPool } from "../db/pool.js";
import { seed } from "../db/seed.js";
import { resetDatabase } from "../test/db.js";
import { idOf } from "../test/fixtures.js";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(getPool());
  await seed(getPool());
});

afterAll(closePool);

describe("GET /api/skills", () => {
  it("lists all skills ordered by name", async () => {
    const res = await request(app).get("/api/skills");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: "Backend" },
      { id: expect.any(Number), name: "Frontend" },
    ]);
  });
});

describe("GET /api/skills/:id", () => {
  it("returns the skill with the developers who have it", async () => {
    const res = await request(app).get(`/api/skills/${await idOf("skills", "Frontend")}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Frontend");
    expect(res.body.developers.map((d: { name: string }) => d.name)).toEqual(["Alice", "Carol"]);
  });

  it("returns 404 for an unknown skill", async () => {
    const res = await request(app).get("/api/skills/999999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it.each(["abc", "0", "-1", "1.5", "99999999999"])("returns 400 for id %s", async (id) => {
    const res = await request(app).get(`/api/skills/${id}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
