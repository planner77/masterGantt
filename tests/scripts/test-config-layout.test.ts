import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const text = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("test configuration repository layout", () => {
  it("uses one explicit configuration per test runner", () => {
    const scripts = JSON.parse(text("package.json")).scripts;
    expect(scripts.test).toBe("vitest run --config tests/config/vitest.config.ts");
    expect(scripts["test:e2e"]).toBe("playwright test --config tests/config/playwright.config.ts");
    for (const old of ["vitest.config.ts", "playwright.config.ts"]) expect(existsSync(resolve(root, old))).toBe(false);
  });
  it("anchors discovery and browser working paths at repository root", () => {
    const unit = text("tests/config/vitest.config.ts");
    const browser = text("tests/config/playwright.config.ts");
    // Vitest's config loader handles import.meta.url, but Playwright loads this
    // package's .ts config as CommonJS. Both must remain file-relative, not cwd-relative.
    expect(unit).toContain('new URL("../../", import.meta.url)');
    expect(JSON.parse(text("package.json")).type).not.toBe("module");
    expect(browser).toContain('resolve(__dirname, "../..")');
    expect(browser).not.toContain("import.meta.url");
    for (const config of [unit, browser]) expect(config).not.toContain("process.cwd()");
    expect(unit).toContain('include: ["tests/**/*.test.ts"]');
    expect(browser).toContain('testDir: resolve(repositoryRoot, "tests/e2e")');
    expect(browser).toContain("cwd: repositoryRoot");
    expect(browser).toContain('outputDir: resolve(repositoryRoot, "test-results")');
    expect(browser).toContain('resolve(repositoryRoot, ".data", "playwright.sqlite3")');
  });
  it("preserves browser isolation and operator overrides", () => {
    const browser = text("tests/config/playwright.config.ts");
    for (const value of ["PLAYWRIGHT_BASE_URL", "PLAYWRIGHT_CHROMIUM_EXECUTABLE", 'NEXT_DIST_DIR: ".next-e2e"', "workers: 1", "fullyParallel: false", 'trace: "retain-on-failure"']) {
      expect(browser).toContain(value);
    }
  });
  it("runs cross-cwd discovery in CI and keeps configs out of images", () => {
    expect(text(".github/workflows/ci.yml")).toContain("node scripts/verify-test-discovery.mjs");
    expect(text(".dockerignore").split(/\r?\n/)).toContain("tests");
    expect(JSON.parse(text("tsconfig.json")).include).toContain("tests/**/*.ts");
  });
});
