import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("app", () => {
  it("returns the standard error body for an unknown route", async () => {
    const res = await request(createApp()).get("/api/nope");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("/api/nope");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(createApp())
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});
