import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? "http://127.0.0.1:3100";
const isolatedDatabasePath = resolve(process.cwd(), ".data", "playwright.sqlite3");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3100",
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
