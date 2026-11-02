/**
 * Derive the test database URL from DATABASE_URL by replacing only the
 * pathname. A string replace would also hit the username (`baton`).
 */
export function testDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  return withDatabase(databaseUrl, "baton_test");
}

export function withDatabase(databaseUrl: string, database: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}
