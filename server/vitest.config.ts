import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./src/test/testUrl.js";

// Load the repo-root .env for local runs; in CI or Docker the variables are already set.
try {
  process.loadEnvFile("../.env");
} catch {
  // no .env file
}

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/globalSetup.ts"],
    // App code under test only ever sees the test database.
    env: { DATABASE_URL: testDatabaseUrl(process.env.DATABASE_URL) },
    // Test files share one database and truncate it between tests.
    fileParallelism: false,
  },
});
