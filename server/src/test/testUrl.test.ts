import { describe, expect, it } from "vitest";
import { testDatabaseUrl, withDatabase } from "./testUrl.js";

describe("testDatabaseUrl", () => {
  it("replaces only the database name, leaving the username intact", () => {
    const url = new URL(testDatabaseUrl("postgres://baton:secret@localhost:5432/baton"));

    expect(url.username).toBe("baton");
    expect(url.pathname).toBe("/baton_test");
    expect(url.host).toBe("localhost:5432");
  });

  it("preserves a password containing special characters", () => {
    const url = new URL(testDatabaseUrl("postgres://baton:p%40ss%2Fw%3Ard@db:5432/baton"));

    expect(url.password).toBe("p%40ss%2Fw%3Ard");
    expect(url.pathname).toBe("/baton_test");
  });

  it("preserves the query string", () => {
    const url = new URL(testDatabaseUrl("postgres://baton:secret@db:5432/baton?sslmode=disable"));

    expect(url.search).toBe("?sslmode=disable");
  });

  it("is idempotent", () => {
    const once = testDatabaseUrl("postgres://baton:secret@db:5432/baton");

    expect(testDatabaseUrl(once)).toBe(once);
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => testDatabaseUrl(undefined)).toThrow("DATABASE_URL is not set");
  });
});

describe("withDatabase", () => {
  it("points the URL at another database on the same server", () => {
    expect(new URL(withDatabase("postgres://baton:secret@db:5432/baton", "postgres")).pathname).toBe("/postgres");
  });
});
