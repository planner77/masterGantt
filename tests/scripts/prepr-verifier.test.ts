import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCapturedInstall } from "../fixtures/gantt-state-consistency/capture-install";
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
  it("maps HIGH HTTP/SQLite to the importing module's own direct test plus negative browser smoke", () => {
    const s = selectImpact({ changed: ["src/server/projects/project-copy-service-core.ts"], tests, risk: "HIGH" });
    expect(s.state).toBe("READY");
    expect(s.selected.map((x) => x.path)).toContain("tests/server/projects/project-copy-service.test.ts");
    expect(s.selected.find((x) => x.path === "tests/server/projects/project-copy-service.test.ts")?.reasons).toContain("Direct import of changed server module");
    expect(s.selected.map((x) => x.path)).toContain("tests/e2e/project-edit-authorization.spec.ts");
    expect(s.selected.map((x) => x.path)).toContain("tests/e2e/project-task-persistence.spec.ts");
  });
  it("does not mistake generic HTTP smoke for direct service coverage", () => {
    const s = selectImpact({ changed: ["src/server/projects/unknown-new-service-core.ts"], tests, risk: "HIGH" });
    expect(s.state).toBe("BLOCKED");
    expect(s.unknown[0].reason).toContain("No actual direct server-module test import");
  });
  it("blocks unmapped implementation and missing/renamed consumer tests", () => {
    const unmapped = selectImpact({ changed: ["src/features/new-contract.ts"], tests, risk: "MEDIUM" });
    expect(unmapped.state).toBe("BLOCKED");
    expect(unmapped.unknown[0].path).toBe("src/features/new-contract.ts");
    const missing = selectImpact({ changed: ["src/features/gantt/core-canonical-state.ts"], tests: { unit: [], e2e: [] }, risk: "HIGH" });
    expect(missing.state).toBe("BLOCKED");
    expect(missing.missing.length).toBeGreaterThan(0);
  });
  it("fails closed on removed test files and shared Playwright fixtures/config", () => {
    const deleted = selectImpact({ changed: ["tests/e2e/removed-project.spec.ts"], tests, risk: "MEDIUM" });
    expect(deleted.state).toBe("BLOCKED");
    expect(deleted.missing.map((x) => x.path)).toContain("tests/e2e/removed-project.spec.ts");
    for (const path of ["tests/config/playwright.config.ts", "tests/e2e/fixtures/isolated-application.ts"]) {
      const changed = selectImpact({ changed: [path], tests, risk: "HIGH" });
      expect(changed.state).toBe("BLOCKED");
      expect(changed.unknown.some((x) => x.path === path)).toBe(true);
    }
  });
  it("maps the historical capture assertion to all three real Core capture regression tests", () => {
    const s = selectImpact({ changed: ["tests/fixtures/gantt-state-consistency/capture-install.ts"], tests, risk: "HIGH" });
    expect(s.state).toBe("READY");
    expect(s.selected.map((x) => x.path)).toEqual(expect.arrayContaining([
      "tests/features/gantt/canonical-recovery-runtime.test.ts",
      "tests/features/gantt/state-consistency-runtime-fixture.test.ts",
      "tests/features/gantt/axis-transaction-runtime-fixture.test.ts",
    ]));
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
  it("maps Issue #552 shared UI, lockfile and browser helper to real direct/adjacent/negative consumers", () => {
    const paths = [
      "package-lock.json", "src/features/gantt/gantt-scale-toolbar.css",
      "src/features/gantt/project-gantt.tsx",
      "src/features/projects/project-copy-membership-confirm.tsx",
      "src/features/projects/project-readonly-view.tsx",
      "tests/e2e/helpers/milestone-ui.ts",
    ];
    const selection = selectImpact({ changed: paths, tests, risk: "HIGH" });
    expect(selection.state).toBe("READY");
    expect(selection.unknown).toEqual([]);
    expect(selection.missing).toEqual([]);
    expect(selection.matched.map(item => item.path)).toEqual(expect.arrayContaining(paths));
    expect(selection.selected.map(item => item.path)).toEqual(expect.arrayContaining([
      "tests/scripts/prepr-verifier.test.ts",
      "tests/features/gantt/canonical-recovery-runtime.test.ts",
      "tests/features/gantt/milestone-visibility.test.ts",
      "tests/e2e/project-notifications.spec.ts",
      "tests/e2e/projection-row-alignment.spec.ts",
      "tests/e2e/milestone-timeline-lane.spec.ts",
      "tests/e2e/project-multi-task-copy-paste.spec.ts",
    ]));
    const unknown = selectImpact({ changed: ["tests/e2e/helpers/unknown-bridge.ts"], tests, risk: "HIGH" });
    expect(unknown.state).toBe("BLOCKED");
    expect(unknown.unknown.map(item => item.path)).toContain("tests/e2e/helpers/unknown-bridge.ts");
  });
  it("maps batch preparation scripts to their actual safety tests without adding browser requirements", () => {
    const s = selectImpact({
      changed: ["scripts/pr-batch-core.mjs", "scripts/pr-batch-core.d.mts", "scripts/verify-pr-batch.mjs"],
      tests, risk: "HIGH",
    });
    expect(s.state).toBe("READY");
    expect(s.selected.map((x) => x.path)).toEqual(["tests/scripts/pr-batch-verifier.test.ts"]);
    expect(s.selected.every((x) => x.kind === "unit")).toBe(true);
    expect(s.notSelectedReason).toMatch(/remote Required/);
    expect(() => selectImpact({ changed: ["scripts/verify-pr-batch.mjs"], tests, risk: "LOW" })).toThrow(/below path floor/);
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
  it("retains both old and new changed paths when a test is renamed", () => {
    const { dir, git } = repository();
    const old = resolve(dir, "tests/e2e/legacy.spec.ts");
    mkdirSync(resolve(dir, "tests/e2e"), { recursive: true });
    writeFileSync(old, "it('legacy', () => {});");
    git("add", ".");
    git("commit", "-m", "add original test");
    git("mv", "tests/e2e/legacy.spec.ts", "tests/e2e/replacement.spec.ts");
    const changed = sourceEvidence(dir).changed;
    expect(changed).toContain("tests/e2e/legacy.spec.ts");
    expect(changed).toContain("tests/e2e/replacement.spec.ts");
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
  it("refuses unverified custom Chromium binaries before a claimed pinned browser run", () => {
    const verdict = e2eSafety({ env: { PLAYWRIGHT_CHROMIUM_EXECUTABLE: "/usr/bin/old-chromium" } });
    expect(verdict.state).toBe("BLOCKED");
    expect(verdict.reasons.join(" ")).toContain("PLAYWRIGHT_CHROMIUM_EXECUTABLE");
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

describe("Issue #699/#752/#762/#556 — immutable historical capture with reviewed Next/Zod security patches", () => {
  it("allows only the exact local CLI alias while preserving all captured dependencies and scripts", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "mastergantt-capture-test-"));
    created.push(dir);
    const snapshots = "tests/fixtures/gantt-state-consistency/capture-sources";
    mkdirSync(resolve(dir, snapshots), { recursive: true });
    for (const file of ["package-original.snapshot.txt", "package-lock-original.snapshot.txt"]) {
      const original = resolve(root, snapshots, file);
      const isolated = resolve(dir, snapshots, file);
      expect(isolated).not.toBe(original);
      expect(isolated.startsWith(dir + "/")).toBe(true);
      copyFileSync(original, isolated);
      expect(readFileSync(isolated)).toEqual(readFileSync(original));
    }
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
    const write = () => {
      writeFileSync(resolve(dir, "package.json"), JSON.stringify(manifest));
      writeFileSync(resolve(dir, "package-lock.json"), JSON.stringify(lock));
    };
    write();
    expect(() => assertCapturedInstall(dir)).not.toThrow();
    manifest.scripts["verify:prepr"] = "node scripts/unrelated-tool.mjs";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Only the exact local verification alias/);
    manifest.scripts["verify:prepr"] = "node scripts/verify-prepr.mjs";
    manifest.scripts["ignore-product-tests"] = "true";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Historical capture requires unchanged package metadata/);
    delete manifest.scripts["ignore-product-tests"];
    manifest.dependencies.next = "0.0.0";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Historical capture requires unchanged package metadata/);
    manifest.dependencies.next = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).dependencies.next;
    lock.packages[""].dependencies.next = "0.0.0";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/same complete locked dependency tree/);
    lock.packages[""].dependencies.next = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8")).packages[""].dependencies.next;

    // A security exception must require the EXACT reviewed npm package
    // metadata, not merely a version string or a matched root manifest.
    const installedNext = lock.packages["node_modules/next"];
    const savedNextIntegrity = installedNext.integrity;
    installedNext.integrity = "sha512-unverified-security-payload";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved Next.js security patch exact locked package metadata mismatch/);
    installedNext.integrity = savedNextIntegrity;

    const installedSwc = lock.packages["node_modules/@next/swc-linux-x64-gnu"];
    const savedSwcResolved = installedSwc.resolved;
    installedSwc.resolved = "https://untrusted.example.invalid/swc.tgz";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved Next.js security patch exact locked package metadata mismatch/);
    installedSwc.resolved = savedSwcResolved;

    manifest.dependencies["@next/env"] = "16.3.8";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Historical capture requires unchanged package metadata/);
    manifest.dependencies["@next/env"] = "16.4.2";

    lock.packages[""].dependencies["@next/env"] = "16.3.8";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/same complete locked dependency tree/);
    lock.packages[""].dependencies["@next/env"] = "16.4.2";

    const originalReact = lock.packages["node_modules/react"].version;
    lock.packages["node_modules/react"].version = "0.0.0";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/same complete locked dependency tree/);
    lock.packages["node_modules/react"].version = originalReact;

    // Preserve Issue #752's extra negative contracts while retaining #762's
    // stricter, reviewed Next.js lock/SRI/SWC metadata allowlist.
    const savedNextVersion = manifest.dependencies.next;
    manifest.dependencies.next = "16.4.3";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/unchanged package metadata/);
    manifest.dependencies.next = savedNextVersion;

    const nextOptional = lock.packages["node_modules/next"].optionalDependencies;
    const savedSharpRange = nextOptional.sharp;
    nextOptional.sharp = "^0.35.4";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved Next.js security patch exact locked package metadata mismatch/);
    nextOptional.sharp = savedSharpRange;

    const swcLibc = lock.packages["node_modules/@next/swc-linux-x64-gnu"];
    const savedLibc = swcLibc.libc;
    swcLibc.libc = ["unsafe"];
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved Next.js security patch exact locked package metadata mismatch/);
    swcLibc.libc = savedLibc;

    const ganttCore = lock.packages["node_modules/@svar-ui/react-gantt"];
    const savedGanttVersion = ganttCore.version;
    ganttCore.version = "0.0.0";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/same complete locked dependency tree/);
    ganttCore.version = savedGanttVersion;

    // #556 F-002 — actual current manifest/lock may differ only by the
    // reviewed Zod security update. Keep the historic snapshots unchanged.
    const installedZod = lock.packages["node_modules/zod"];
    const savedManifestZod = manifest.dependencies.zod;
    manifest.dependencies.zod = "4.6.6";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Only reviewed Zod 4\.6\.7 security patch/);
    manifest.dependencies.zod = savedManifestZod;

    const savedLockZod = lock.packages[""].dependencies.zod;
    lock.packages[""].dependencies.zod = "4.6.2";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Only reviewed Zod 4\.6\.7 security patch/);
    lock.packages[""].dependencies.zod = savedLockZod;

    const savedZodIntegrity = installedZod.integrity;
    installedZod.integrity = "sha512-unreviewed-zod";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved Zod security patch exact locked package metadata mismatch/);
    installedZod.integrity = savedZodIntegrity;

    const savedZodResolved = installedZod.resolved;
    installedZod.resolved = "https://untrusted.example.invalid/zod.tgz";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved Zod security patch exact locked package metadata mismatch/);
    installedZod.resolved = savedZodResolved;

    const savedZodPackageVersion = installedZod.version;
    installedZod.version = "4.6.8";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved Zod security patch exact locked package metadata mismatch/);
    installedZod.version = savedZodPackageVersion;

    installedZod.optionalDependencies = { rogue: "1.0.0" };
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved Zod security patch exact locked package metadata mismatch/);
    delete installedZod.optionalDependencies;

    // No changes to the frozen original browser capture are permitted.
    write();
    expect(() => assertCapturedInstall(dir)).not.toThrow();
    for (const file of ["package-original.snapshot.txt", "package-lock-original.snapshot.txt"]) {
      expect(readFileSync(resolve(dir, snapshots, file))).toEqual(readFileSync(resolve(root, snapshots, file)));
    }
  });
});
