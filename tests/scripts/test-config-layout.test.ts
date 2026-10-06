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
    expect(optimizer).toContain("actions: write");
    expect(optimizer).toContain("[Issue #437] ci: E2E 샤드 계획 갱신");
    expect(optimizer).toContain("actions/workflows/ci.yml/dispatches");
    expect(optimizer).toContain('inputs[issue_number]=437');
    expect(optimizer).toContain("--body-file /tmp/e2e-shard-plan-pr-body.md");
    expect(optimizer).not.toMatch(/--body\s*\n/);
    expect(optimizer).toContain("Refs #437");
    expect(optimizer).not.toContain("gh pr merge");
  });
  it("measures setup/cache costs without caching node_modules or Playwright browsers before baseline", () => {
    const ci = text(".github/workflows/ci.yml");
    const release = text(".github/workflows/release-image.yml");
    const nodeSetup = text(".github/actions/node-setup/action.yml");
    const playwrightSetup = text(".github/actions/playwright-setup/action.yml");
    const timingReporter = text("tests/config/e2e-timing-reporter.cjs");

    for (const workflow of [ci, release]) {
      expect(workflow).toContain("./.github/actions/node-setup");
      expect(workflow).toContain("./.github/actions/playwright-setup");
      expect(workflow).toContain("record-ci-setup-metric.mjs");
    }

    expect(nodeSetup).toContain("path: ~/.npm");
    expect(nodeSetup).toContain("runner.arch");
    expect(nodeSetup).toContain("sha256sum package-lock.json");
    expect(nodeSetup).toContain("steps.lock-hash.outputs.value");
    expect(nodeSetup).toContain("npm ci --prefer-offline --no-audit");
    expect(nodeSetup).not.toContain("node_modules");

    expect(playwrightSetup).toContain("playwright install-deps chromium");
    expect(playwrightSetup).toContain("playwright install --only-shell chromium");
    expect(playwrightSetup).toContain('cache "not-enabled"');
    expect(playwrightSetup).not.toContain("actions/cache@");
    expect(playwrightSetup).not.toContain("ms-playwright");

    expect(ci).toContain("next-build-cache");
    expect(ci).toContain("ci-setup-metrics-build");
    expect(ci).toContain("ci-setup-metrics-docker");
    expect(ci).toContain("ci-setup-metrics-main-image");
    expect(release).toContain("release-setup-metrics-static");
    expect(release).toContain("release-setup-metrics-e2e-shard-");
    expect(release).toContain("release-setup-metrics-candidate");

    expect(timingReporter).toContain("E2E_RUN_STARTED_MS");
    expect(timingReporter).toContain("runnerReadyMs");
    expect(existsSync(resolve(root, "scripts/analyze-ci-setup-metrics.mjs"))).toBe(true);
  });

  it("guards Release static metrics after earlier gate failures and keeps source-map-js patched", () => {
    const release = text(".github/workflows/release-image.yml");
    const lock = JSON.parse(text("package-lock.json"));
    const sourceMapVersion = lock.packages["node_modules/source-map-js"]?.version;
    const [major, minor, patch] = String(sourceMapVersion ?? "").split(".").map(Number);
    expect(
      major > 1 ||
        (major === 1 && (minor > 2 || (minor === 2 && patch >= 2))),
    ).toBe(true);
    expect(release).toContain("Release production build 시간 기록");
    expect(release).toContain(
      "if: ${{ always() && steps.release-build-start.outputs.started_ms != '' }}",
    );
  });

  it("keeps release candidate container aligned with registry API smoke allowlist", () => {
    const release = text(".github/workflows/release-image.yml");
    const registrySmoke = text("scripts/verify-registry-api-smoke.mjs");
    expect(release).toContain(
      "verify-registry-api-smoke.mjs http://127.0.0.1:3000 mastergantt-release-candidate",
    );
    expect(registrySmoke).toContain('"mastergantt-release-candidate"');
  });

  it("keeps completed Issue #118 evidence manual-only", () => {
    const evidence = text(".github/workflows/issue-118-before-after-evidence.yml");
    expect(evidence).toContain("workflow_dispatch:");
    expect(evidence).not.toContain("pull_request:");
  });
});
