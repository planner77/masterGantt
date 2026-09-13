import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

// This package has no "type": "module", so Playwright loads this .ts config
// as CommonJS. Anchor paths to this file without ESM-only import.meta or cwd.
const repositoryRoot = resolve(__dirname, "../..");

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? "http://127.0.0.1:3100";
const isolatedDatabasePath = resolve(repositoryRoot, ".data", "playwright.sqlite3");

export default defineConfig({
  testDir: resolve(repositoryRoot, "tests/e2e"),
  outputDir: resolve(repositoryRoot, "test-results"),
  // CI uploads this directory on failure. Without the HTML reporter no report
  // existed, and the retained traces/error context were lost with the runner.
  reporter: [
    ["list"],
    ["html", { outputFolder: resolve(repositoryRoot, "playwright-report"), open: "never" }],
  ],
  // Serial execution limits resource usage but does not isolate server memory.
  // Real-backend specs use fixtures/isolated-application; this shared server
  // remains for mock-backed UI and demo specs. See docs/CI_36_REVIEW.md.
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
