import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? "http://127.0.0.1:3100";
const isolatedDatabasePath = resolve(repositoryRoot, ".data", "playwright.sqlite3");

export default defineConfig({
  testDir: resolve(repositoryRoot, "tests/e2e"),
  outputDir: resolve(repositoryRoot, "test-results"),
  // The application intentionally applies a process-global create limiter.
  // Keep browser specs serial while each spec can still exercise HTTP races explicitly.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
        cwd: repositoryRoot,
        url: baseURL,
        reuseExistingServer: false,
        env: {
          ...process.env,
          APP_BASE_URL: baseURL,
          DATABASE_PATH: isolatedDatabasePath,
          NEXT_DIST_DIR: ".next-e2e",
        },
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumExecutable
          ? { executablePath: chromiumExecutable }
          : undefined,
      },
    },
  ],
});
