import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  diagnosticSubset, e2eSafety, inferRisk, inventory, isPathWithin, resolveBase, selectImpact, sourceEvidence,
} from "../../scripts/prepr-core.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const tests = inventory(root);
const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function repository() {
  const dir = mkdtempSync(resolve(tmpdir(), "mastergantt-prepr-"));
  created.push(dir);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Prepr Fixture");
  git("config", "user.email", "prepr@example.invalid");
  writeFileSync(resolve(dir, "tracked.txt"), "v1\n");
  git("add", ".");
  git("commit", "-m", "fixture baseline");
  return { dir, git };
}
const head = "a".repeat(40);
const failure = (runId: string, file: string) => ({
  pr: 695, runId, attempt: 1, headSha: head, status: "FAIL", file,
});
describe("Issue #699 — risk/path/real test selection", () => {
  it("gives docs-only a safe LOW empty-test plan without weakening remote checks", () => {
    const s = selectImpact({ changed: ["docs/README.md"], tests, risk: "LOW" });
    expect(s.state).toBe("READY");
    expect(s.selected).toHaveLength(0);
    expect(s.notSelectedReason).toMatch(/remote Required/);
  });
  it("uses a real Chromium direct and negative consumer for MEDIUM Task editor", () => {
    const s = selectImpact({ changed: ["src/features/gantt/task-editor-model.ts"], tests, risk: "MEDIUM" });
    expect(s.state).toBe("READY");
    expect(s.selected.map((v) => v.path)).toContain("tests/e2e/project-task-delete-context.spec.ts");
    expect(s.selected.map((v) => v.path)).toContain("tests/features/gantt/task-editor-model.test.ts");
  });
  it("expands shared HIGH canonical change across browser and unit consumers", () => {
    const s = selectImpact({ changed: ["src/features/gantt/core-canonical-state.ts"], tests, risk: "HIGH" });
    expect(s.state).toBe("READY");
    expect(s.selected.map((v) => v.path)).toEqual(expect.arrayContaining([
      "tests/e2e/project-multi-task-copy-paste.spec.ts",
      "tests/e2e/resource-drill-ui.spec.ts",
      "tests/e2e/viewport-coordinator.spec.ts",
      "tests/features/gantt/canonical-recovery.test.ts",
    ]));
    expect(s.selected.some((x) => x.kind === "chromium")).toBe(true);
  });
  it("maps HIGH HTTP/SQLite to actual browser API/authorization smoke", () => {
    const s = selectImpact({ changed: ["src/server/projects/persistence.ts"], tests, risk: "HIGH" });
    expect(s.state).toBe("READY");
    expect(s.selected.map((x) => x.path)).toContain("tests/e2e/project-edit-authorization.spec.ts");
    expect(s.selected.map((x) => x.path)).toContain("tests/e2e/project-task-persistence.spec.ts");
  });
  it("blocks unmapped implementation and missing/renamed consumer tests", () => {
    const unmapped = selectImpact({ changed: ["src/features/new-contract.ts"], tests, risk: "MEDIUM" });
    expect(unmapped.state).toBe("BLOCKED");
    expect(unmapped.unknown[0].path).toBe("src/features/new-contract.ts");
    const missing = selectImpact({ changed: ["src/features/gantt/core-canonical-state.ts"], tests: { unit: [], e2e: [] }, risk: "HIGH" });
    expect(missing.state).toBe("BLOCKED");
    expect(missing.missing.length).toBeGreaterThan(0);
  });
  it("rejects risk downgrade, missing include and unjustified/manual exclusion", () => {
    expect(inferRisk(["docs/TEST_PLAN.md"])).toBe("HIGH");
    expect(() => selectImpact({ changed: ["src/server/auth.ts"], tests, risk: "LOW" })).toThrow(/below path floor/);
    expect(() => selectImpact({ changed: [], tests, risk: "LOW", excludes: ["tests/e2e/project-task-editor.spec.ts"] })).toThrow(/reason/);
    const missing = selectImpact({ changed: [], tests, risk: "LOW", includes: ["tests/e2e/renamed.spec.ts"] });
    expect(missing.state).toBe("BLOCKED");
    const excluded = selectImpact({ changed: ["src/features/gantt/task-editor-model.ts"], tests, risk: "MEDIUM",
      excludes: ["tests/e2e/project-task-editor.spec.ts:Owner accepted keyboard test excluded, other editor cases retained"] });
    expect(excluded.excluded[0].reason).toMatch(/Owner accepted/);
    expect(excluded.selected.some((x) => x.path === "tests/e2e/project-task-editor.spec.ts")).toBe(false);
  });
  it("maps pre-PR tooling into actual CLI regression tests", () => {
    const s = selectImpact({ changed: ["scripts/verify-prepr.mjs", "scripts/prepr-core.mjs", "tests/scripts/prepr-verifier.test.ts"], tests, risk: "HIGH" });
    expect(s.state).toBe("READY");
    expect(s.selected.map((x) => x.path)).toContain("tests/scripts/prepr-verifier.test.ts");
  });
});
describe("Issue #699 — source identity/dirty protection", () => {
  it("tracks committed head, changed files and untracked content changes", () => {
    const { dir, git } = repository();
    const base = resolveBase(dir);
    const first = sourceEvidence(dir);
    expect(first.baseSha).toBe(base.sha);
    expect(first.dirty).toBe(false);
    writeFileSync(resolve(dir, "tracked.txt"), "v2\n");
    writeFileSync(resolve(dir, "new.txt"), "untracked-a\n");
    const second = sourceEvidence(dir);
    expect(second.dirty).toBe(true);
    expect(second.changed).toEqual(["new.txt", "tracked.txt"]);
    expect(second.fingerprint).not.toBe(first.fingerprint);
    writeFileSync(resolve(dir, "new.txt"), "untracked-b\n");
    expect(sourceEvidence(dir).fingerprint).not.toBe(second.fingerprint);
    git("add", "tracked.txt");
    expect(sourceEvidence(dir).fingerprint).not.toBe(first.fingerprint);
  });
  it("rejects path traversal and never follows files outside repository", () => {
    expect(isPathWithin(root, resolve(root, "tests/e2e"))).toBe(true);
    expect(isPathWithin(root, resolve(root, "../secret"))).toBe(false);
  });
});
describe("Issue #699 — bounded fail-fast-off diagnostic evidence", () => {
  const one = "tests/e2e/project-task-editor.spec.ts";
  const two = "tests/e2e/resource-drill-ui.spec.ts";
  it("requires two distinct PR runs and consumers and preserves UNKNOWN classifications", () => {
    const s = diagnosticSubset({ failures: [failure("100", one), failure("101", two)] }, tests.e2e, 695);
    expect(s.files).toEqual([one, two]);
    expect(s.attempts).toBe(2);
    expect(s.evidence.every((x) => x.classification === "UNKNOWN")).toBe(true);
  });
  it("rejects one run, invented PASS, another PR, non-browser tests and missing files", () => {
    expect(() => diagnosticSubset({ failures: [failure("100", one)] }, tests.e2e, 695)).toThrow();
    expect(() => diagnosticSubset({ failures: [failure("100", one), failure("100", two)] }, tests.e2e, 695)).toThrow();
    expect(() => diagnosticSubset({ failures: [failure("100", one), { ...failure("101", two), status: "PASS" }] }, tests.e2e, 695)).toThrow();
    expect(() => diagnosticSubset({ failures: [failure("100", one), { ...failure("101", two), pr: 694 }] }, tests.e2e, 695)).toThrow();
    expect(() => diagnosticSubset({ failures: [failure("100", one), failure("101", "tests/e2e/missing.spec.ts")] }, tests.e2e, 695)).toThrow();
  });
  it("reports at most 12 distinct browser cases to avoid unbounded diagnostic cost", () => {
    const paths = tests.e2e.slice(0, 13);
    expect(paths).toHaveLength(13);
    expect(() => diagnosticSubset({ failures: paths.map((file, i) => failure(String(100 + i), file)) }, tests.e2e, 695)).toThrow(/>12/);
  });
});

describe("Issue #699 — process and existing-data safety", () => {
  it("blocks operational external base URLs and DB environment instead of targeting production", () => {
    const decision = e2eSafety({ env: {
      PLAYWRIGHT_BASE_URL: "https://example.invalid",
      DATABASE_PATH: "/srv/production.sqlite3",
    } });
    expect(decision.state).toBe("BLOCKED");
    expect(decision.reasons.join(" ")).toContain("PLAYWRIGHT_BASE_URL");
    expect(decision.reasons.join(" ")).toContain("DATABASE_PATH");
  });
  it("blocks reserved output/SQLite and occupied port and allows a clean fixture", () => {
    expect(e2eSafety({ existing: [".data/playwright.sqlite3", "playwright-report"] }).state).toBe("BLOCKED");
    expect(e2eSafety({ portFree: false }).state).toBe("BLOCKED");
    expect(e2eSafety({}).state).toBe("READY");
  });
  it("exposes a safe help entry and rejects unknown modes without launching tests", () => {
    const help = spawnSync(process.execPath, ["scripts/verify-prepr.mjs", "--help"], { cwd: root, encoding: "utf8" });
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("never replaces GitHub PR CI");
    const invalid = spawnSync(process.execPath, ["scripts/verify-prepr.mjs", "--mode=none"], { cwd: root, encoding: "utf8" });
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain("Unknown mode");
  });
});
