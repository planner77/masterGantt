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
    for (const value of ["PLAYWRIGHT_BASE_URL", "PLAYWRIGHT_CHROMIUM_EXECUTABLE", 'NEXT_DIST_DIR: ".next-e2e"', "workers: 1", 'process.env.CI_E2E_FULLY_PARALLEL === "true"', 'trace: "retain-on-failure"']) {
      expect(browser).toContain(value);
    }
  });
  it("runs cross-cwd discovery in CI and keeps configs out of images", () => {
    expect(text(".github/workflows/ci.yml")).toContain("node scripts/verify-test-discovery.mjs");
    expect(text(".dockerignore").split(/\r?\n/)).toContain("tests");
    expect(JSON.parse(text("tsconfig.json")).include).toContain("tests/**/*.ts");
  });
  it("routes expensive Docker evidence only when its contract can change", () => {
    const ci = text(".github/workflows/ci.yml");
    expect(ci).toContain("docker_baseline:");
    expect(ci).toContain("transport:");
    expect(ci).toContain("if: needs.changes.outputs.docker_baseline == 'true'");
    expect(ci).toContain("if: needs.changes.outputs.transport == 'true'");
    expect(ci).toContain("github.event_name != 'pull_request' || steps.filter.outputs.transport == 'true'");
    expect(ci).toContain("- 'src/server/projects/**'");
  });
  it("records historical E2E timing and keeps optimizer fail-safe", () => {
    const browser = text("tests/config/playwright.config.ts");
    const ci = text(".github/workflows/ci.yml");
    const release = text(".github/workflows/release-image.yml");
    const optimizer = text(".github/workflows/e2e-shard-optimizer.yml");
    expect(browser).toContain("./e2e-timing-reporter.cjs");
    for (const workflow of [ci, release]) {
      expect(workflow).toContain("scripts/e2e-shard-planner.mjs select");
      expect(workflow).toContain("tests/config/e2e-shard-plan.json");
      expect(workflow).toContain("E2E_TIMING_OUTPUT");
      expect(workflow).toContain("native 6-way sharding fallback");
    }
    expect(ci).toContain("e2e-timing-ci-shard-");
    expect(release).toContain("e2e-timing-release-shard-");
    expect(optimizer).toContain("event=push&branch=main&status=success");
    expect(optimizer).toContain("scripts/e2e-shard-planner.mjs analyze");
    expect(optimizer).toContain("[Issue #437] ci: refresh E2E shard plan");
    expect(optimizer).toContain("Refs #437");
    expect(optimizer).not.toContain("gh pr merge");
  });
  it("keeps completed Issue #118 evidence manual-only", () => {
    const evidence = text(".github/workflows/issue-118-before-after-evidence.yml");
    expect(evidence).toContain("workflow_dispatch:");
    expect(evidence).not.toContain("pull_request:");
  });
});
