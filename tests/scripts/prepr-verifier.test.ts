import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCapturedInstall } from "../fixtures/gantt-state-consistency/capture-install";
import {
  COMMON_CHECKS, environmentEvidence, evaluateAdmission, reportChecksum, runnerCoverage, diagnosticSubset, e2eSafety, inferRisk, inventory, isPathWithin, resolveBase, selectImpact, sourceEvidence,
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
  it("gives docs-only a safe LOW empty-test plan with explicit unselected local coverage", () => {
    const s = selectImpact({ changed: ["docs/README.md"], tests, risk: "LOW" });
    expect(s.state).toBe("READY");
    expect(s.selected).toHaveLength(0);
    expect(s.notSelectedReason).toMatch(/unselected local tests/);
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
  it("정확한 HIGH 밀도 모듈을 직접 Unit과 실제 geometry·입력 소비자에 연결한다", () => {
    const path = "src/features/gantt/gantt-density.ts";
    const selection = selectImpact({ changed: [path], tests, risk: "HIGH" });
    expect(selection.state).toBe("READY");
    expect(selection.unknown).toEqual([]);
    expect(selection.missing).toEqual([]);
    expect(selection.selected.map((item) => item.path)).toEqual([
      "tests/e2e/project-gantt-scale.spec.ts",
      "tests/e2e/project-summary-bar-visual.spec.ts",
      "tests/e2e/project-task-delete-context.spec.ts",
      "tests/e2e/project-task-hover-tooltip.spec.ts",
      "tests/e2e/projection-row-alignment.spec.ts",
      "tests/features/gantt/gantt-density.test.ts",
    ]);
    expect(inferRisk([path])).toBe("HIGH");
    expect(() => selectImpact({ changed: [path], tests, risk: "MEDIUM" })).toThrow(/below path floor/);
  });
  it("인접 미등록 밀도 모듈과 직접 소비자 누락은 계속 BLOCKED한다", () => {
    const adjacent = "src/features/gantt/gantt-density-experimental.ts";
    const unknown = selectImpact({ changed: [adjacent], tests, risk: "HIGH" });
    expect(unknown.state).toBe("BLOCKED");
    expect(unknown.unknown.map((item) => item.path)).toEqual([adjacent]);
    const missing = selectImpact({
      changed: ["src/features/gantt/gantt-density.ts"],
      tests: { ...tests, unit: tests.unit.filter((path) => path !== "tests/features/gantt/gantt-density.test.ts") },
      risk: "HIGH",
    });
    expect(missing.state).toBe("BLOCKED");
    expect(missing.missing.map((item) => item.path)).toContain("tests/features/gantt/gantt-density.test.ts");
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
    expect(s.notSelectedReason).toMatch(/unselected local tests/);
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
    expect(help.stdout).toContain("PR/원격 CI를 실행하지 않습니다");
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

    // #885 reviewable dependency snapshot rejects replaced SRI and extra packages.
    const editorPackage = lock.packages["node_modules/@mdxeditor/editor"];
    const savedEditorIntegrity = editorPackage.integrity;
    editorPackage.integrity = "sha512-unverified-markdown-payload";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved #885 Markdown package metadata mismatch/);
    editorPackage.integrity = savedEditorIntegrity;

    lock.packages["node_modules/unapproved-extra-package"] = {
      version: "1.0.0", resolved: "https://registry.npmjs.org/unapproved-extra-package/-/unapproved-extra-package-1.0.0.tgz",
      integrity: "sha512-unverified-payload",
    };
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Approved #885 package set mismatch/);
    delete lock.packages["node_modules/unapproved-extra-package"];
    write();
    expect(() => assertCapturedInstall(dir)).not.toThrow();

    // #556 F-002 — actual current manifest/lock may differ only by the
    // reviewed Zod security update. Keep the historic snapshots unchanged.
    const installedZod = lock.packages["node_modules/zod"];
    const savedManifestZod = manifest.dependencies.zod;
    manifest.dependencies.zod = "4.6.6";
    write();
    expect(() => assertCapturedInstall(dir)).toThrow(/Only reviewed Zod 4\.6\.7 security patch/);
    manifest.dependencies.zod = savedManifestZod;
    // #785의 과거 취약 버전으로 직접 되돌리는 입력도 별도로 거부한다.
    manifest.dependencies.zod = "4.6.2";
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


describe("Issue #908 — local-only publication admission", () => {
  function setup() {
    const repo = repository();
    mkdirSync(resolve(repo.dir, "tests/fixtures"), { recursive: true });
    writeFileSync(resolve(repo.dir, "tests/fixtures/synthetic.json"), '{"fixture":1}');
    writeFileSync(resolve(repo.dir, "package-lock.json"), '{"lockfileVersion":3}');
    repo.git("add", "."); repo.git("commit", "-m", "synthetic verification inputs");
    // Documentation scope has no Docker/browser requirement; every common
    // command still needs real PASS-shaped coverage before admission.
    const source = { ...sourceEvidence(repo.dir, "HEAD~1"), changed: ["docs/synthetic.md"] };
    const environment = environmentEvidence(repo.dir, { LANG: "C", FIXTURE_SETTING: "one" });
    const selection = selectImpact({ changed: source.changed, tests, risk: "LOW" });
    const seal = <T extends object>(report: T) => ({ ...report, integritySha256: reportChecksum(report) });
    const report = seal({
      schemaVersion: 2, tool: "mastergantt-local-verify", issue: 908, mode: "fast", status: "PASS", dryRun: false, interrupted: false,
      startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-01T00:01:00.000Z",
      sourceStart: source, sourceEnd: source, sourceStable: true,
      environmentStart: environment, environmentEnd: environment, environmentStable: true,
      selection, errors: [] as string[],
      steps: Object.entries(COMMON_CHECKS).map(([label, command]) => ({ label, command: label === "Unit" ? [...command, "--reporter=default", "--reporter=json", "--outputFile=/synthetic/.prepr-reports/run/vitest-results.json"] : command, status: "PASS", exitCode: 0, signal: null as null | string, caseCount: label === "Unit" ? 50 : null, coveredTests: [] as string[], logSha256: "b".repeat(64) })),
    });
    const admit = (reports: unknown[] = [report], inputSource = source, inputEnvironment = environment, inputSelection = selection) => evaluateAdmission({ reports, source: inputSource, environment: inputEnvironment, selection: inputSelection, issue: 908, now: Date.parse("2026-01-02T00:00:00Z") });
    return { ...repo, source, environment, selection, report, seal, admit };
  }
  it("combines common completed commands for the exact clean source and environment", () => {
    const { admit } = setup();
    expect(admit()).toMatchObject({ status: "PASS", publishAllowed: true });
  });
  it("rejects partial results, fabricated status/command coverage and modified report bytes", () => {
    const { report, seal, admit } = setup();
    expect(admit([{ ...report, status: "FAIL" }]).publishAllowed).toBe(false);
    expect(admit([seal({ ...report, steps: report.steps.filter((step) => step.label !== "Production build") })]).reasons.join(" ")).toContain("Production build");
    expect(admit([seal({ ...report, steps: report.steps.map((step) => step.label === "Lint" ? { ...step, command: ["true"] } : step) })]).publishAllowed).toBe(false);
    expect(admit([{ ...report, errors: ["changed without checksum"] }]).reasons.join(" ")).toContain("checksum");
  });
  it("rejects FAIL/BLOCKED/NOT TESTED, cancellation, dry-run and incomplete logs", () => {
    const { report, seal, admit } = setup();
    for (const status of ["FAIL", "BLOCKED", "NOT TESTED"]) expect(admit([seal({ ...report, status })]).publishAllowed).toBe(false);
    expect(admit([seal({ ...report, dryRun: true })]).publishAllowed).toBe(false);
    expect(admit([seal({ ...report, interrupted: true })]).publishAllowed).toBe(false);
    expect(admit([seal({ ...report, steps: report.steps.map((step) => ({ ...step, logSha256: "" })) })]).publishAllowed).toBe(false);
  });
  it("never reuses an old green scope after a newer failed run; preserves recovery history", () => {
    const { report, seal, admit } = setup();
    const failed = seal({ ...report, status: "FAIL", completedAt: "2026-01-01T00:02:00.000Z" });
    expect(admit([report, failed]).publishAllowed).toBe(false);
    const recovered = seal({ ...report, completedAt: "2026-01-01T00:03:00.000Z" });
    expect(admit([report, failed, recovered]).publishAllowed).toBe(true);
  });
  it("rejects dirty checkout, changed head/base/content and fixture/environment drift", () => {
    const { report, source, environment, seal, admit, dir } = setup();
    expect(admit([report], { ...source, dirty: true }).publishAllowed).toBe(false);
    expect(admit([report], { ...source, fingerprint: "f".repeat(64) }).publishAllowed).toBe(false);
    expect(admit([seal({ ...report, sourceStart: { ...source, headSha: "c".repeat(40) } })]).publishAllowed).toBe(false);
    expect(admit([seal({ ...report, sourceEnd: { ...source, fixtureSha256: "f".repeat(64) } })]).publishAllowed).toBe(false);
    expect(admit([report], source, { ...environment, fingerprint: "f".repeat(64) }).publishAllowed).toBe(false);
    writeFileSync(resolve(dir, "tests/fixtures/synthetic.json"), '{"fixture":2}');
    expect(sourceEvidence(dir).fixtureSha256).not.toBe(source.fixtureSha256);
    expect(sourceEvidence(dir).dirty).toBe(true);
  });
  it("binds the Git index even when working bytes are restored to HEAD", () => {
    const { dir, git, source } = setup();
    writeFileSync(resolve(dir, "tracked.txt"), "staged-only\n"); git("add", "tracked.txt");
    writeFileSync(resolve(dir, "tracked.txt"), "v1\n");
    const changed = sourceEvidence(dir);
    expect(changed.contentSha256).toBe(source.contentSha256);
    expect(changed.indexSha256).not.toBe(source.indexSha256);
    expect(changed.dirty).toBe(true);
  });
  it("blocks hidden assume-unchanged/skip-worktree inputs and never prints .env values", () => {
    const { dir, git } = setup();
    git("update-index", "--assume-unchanged", "tracked.txt");
    writeFileSync(resolve(dir, "tracked.txt"), "concealed mutation\n");
    expect(() => sourceEvidence(dir)).toThrow(/assume-unchanged/);
    git("update-index", "--no-assume-unchanged", "tracked.txt");
    git("update-index", "--skip-worktree", "tracked.txt");
    expect(() => sourceEvidence(dir)).toThrow(/skip-worktree/);
    git("update-index", "--no-skip-worktree", "tracked.txt");
    writeFileSync(resolve(dir, ".env.production.local"), "SECRET=never-print-this-value\n");
    try { sourceEvidence(dir); throw new Error("expected block"); } catch (error) {
      expect(String(error)).toContain(".env"); expect(String(error)).not.toContain("never-print-this-value");
    }
  });
  it("hashes installed lock and relevant environment without exposing credentials", () => {
    const { dir, environment } = setup();
    const changed = environmentEvidence(dir, { LANG: "C", FIXTURE_SETTING: "two", TOKEN: "synthetic-secret-value" });
    expect(changed.fingerprint).not.toBe(environment.fingerprint);
    expect(JSON.stringify(changed)).not.toContain("synthetic-secret-value");
    mkdirSync(resolve(dir, "node_modules"), { recursive: true });
    writeFileSync(resolve(dir, "node_modules/.package-lock.json"), '{"tampered":true}');
    expect(environmentEvidence(dir, { LANG: "C", FIXTURE_SETTING: "one" }).fingerprint).not.toBe(environment.fingerprint);
  });
  it("blocks unknown build/root inputs and selected exclusions", () => {
    const { report, source, environment } = setup();
    for (const path of ["next.config.ts", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs", "unknown.build-input"]) {
      const selection = selectImpact({ changed: [path], tests, risk: "HIGH" });
      expect(selection.state).toBe("BLOCKED");
      expect(evaluateAdmission({ reports: [report], source, environment, selection, issue: 908 }).publishAllowed).toBe(false);
    }
    const selection = selectImpact({ changed: ["scripts/verify-prepr.mjs"], tests, risk: "HIGH", excludes: ["tests/scripts/prepr-verifier.test.ts:synthetic exclusion"] });
    expect(evaluateAdmission({ reports: [report], source, environment, selection, issue: 908 }).reasons.join(" ")).toContain("제외");
  });
  it("requires Docker runtime/API persistence for non-doc source and actual selected consumer coverage", () => {
    const { report, source, environment, seal } = setup();
    const paths = ["scripts/verify-prepr.mjs"];
    const selection = selectImpact({ changed: paths, tests, risk: "HIGH" });
    const changed = { ...source, changed: paths };
    const receipt = seal({ ...report, sourceStart: changed, sourceEnd: changed, selection });
    const result = evaluateAdmission({ reports: [receipt], source: changed, environment, selection, issue: 908 });
    expect(result.publishAllowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("Docker API/SQLite persistence");
    expect(result.reasons.join(" ")).toContain("tests/scripts/prepr-verifier.test.ts");
  });

  it("derives coverage from actual per-file results and excludes skip-only/missing consumers", () => {
    const unit = runnerCoverage("vitest", { testResults: [
      { name: resolve(root, "tests/scripts/pass.test.ts"), assertionResults: [{ status: "passed" }] },
      { name: resolve(root, "tests/scripts/skip.test.ts"), assertionResults: [{ status: "pending" }] },
    ] }, root);
    expect(unit.find((file) => file.path.endsWith("skip.test.ts"))).toMatchObject({ passed: 0, skipped: 1 });
    const browser = runnerCoverage("playwright", { suites: [{ specs: [
      { file: "pass.spec.ts", tests: [{ expectedStatus: "passed", results: [{ status: "passed" }] }] },
      { file: "skip.spec.ts", tests: [{ expectedStatus: "passed", results: [{ status: "skipped" }] }] },
    ] }] }, root);
    expect(browser.filter((file) => file.passed > 0).map((file) => file.path)).toEqual(["tests/e2e/pass.spec.ts"]);
    expect(() => runnerCoverage("vitest", { testResults: [{ name: "/outside/rogue.test.ts", assertionResults: [{ status: "passed" }] }] }, root)).toThrow(/tests 밖/);
    expect(() => runnerCoverage("playwright", {}, root)).toThrow(/suites/);
  });
  it("blocks missing or different Primary Issue receipts", () => {
    const { report, source, environment, selection, seal, admit } = setup();
    expect(evaluateAdmission({ reports: [report], source, environment, selection }).publishAllowed).toBe(false);
    expect(admit([seal({ ...report, issue: 906 })]).reasons.join(" ")).toContain("Primary Issue");
  });
  it("blocks empty or same-head baseline admission", () => {
    const { report, source, admit } = setup();
    expect(admit([report], { ...source, changed: [] }).publishAllowed).toBe(false);
    expect(admit([report], { ...source, baseSha: source.headSha }).publishAllowed).toBe(false);
  });
  it("blocks operational DB/URL environment before any local command launches", () => {
    const path = resolve(root, ".prepr-reports", `safety-test-${process.pid}-${Date.now()}`);
    created.push(path);
    const child = spawnSync(process.execPath, ["scripts/verify-prepr.mjs", "--mode=targeted", `--report-dir=${path}`], { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_PATH: "/synthetic-operational-do-not-touch.sqlite3" } });
    expect(child.status).toBe(1);
    const report = JSON.parse(readFileSync(resolve(path, "report.json"), "utf8"));
    expect(report.status).toBe("BLOCKED"); expect(report.steps).toHaveLength(0);
    expect(report.errors.join(" ")).toContain("DATABASE_PATH");
  });
  it("checks actual log bytes and every artifact symlink before admission", () => {
    const repo = repository();
    mkdirSync(resolve(repo.dir, "scripts"), { recursive: true });
    for (const file of ["verify-prepr.mjs", "prepr-core.mjs", "prepr-snapshot.mjs", "prepr-docker.mjs"]) copyFileSync(resolve(root, "scripts", file), resolve(repo.dir, "scripts", file));
    copyFileSync(resolve(root, "package.json"), resolve(repo.dir, "package.json"));
    copyFileSync(resolve(root, "package-lock.json"), resolve(repo.dir, "package-lock.json"));
    writeFileSync(resolve(repo.dir, ".gitignore"), ".prepr-reports/\n");
    repo.git("add", "."); repo.git("commit", "-m", "verification fixture tool");
    const base = repo.git("rev-parse", "HEAD");
    mkdirSync(resolve(repo.dir, "docs")); writeFileSync(resolve(repo.dir, "docs/change.md"), "synthetic docs change\n");
    repo.git("add", "."); repo.git("commit", "-m", "synthetic docs-only change");
    const source = sourceEvidence(repo.dir, base);
    const path = resolve(repo.dir, ".prepr-reports/receipt"); mkdirSync(path, { recursive: true });
    // Deliberately incomplete synthetic receipt: test the artifact rejection
    // reason, never pretend these local fixture commands actually ran.
    const report = {
      schemaVersion: 2, tool: "mastergantt-local-verify", issue: 908, mode: "fast", status: "PASS",
      sourceStart: source, steps: [{ label: "Version contract", command: COMMON_CHECKS["Version contract"], status: "PASS", exitCode: 0, logFile: "step-1.log", logSha256: "0".repeat(64) }],
    };
    const write = () => writeFileSync(resolve(path, "report.json"), JSON.stringify({ ...report, integritySha256: reportChecksum(report) }));
    writeFileSync(resolve(path, "step-1.log"), "synthetic changed log\n"); write();
    const run = () => {
      const output = resolve(repo.dir, ".prepr-reports", `admit-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const child = spawnSync(process.execPath, ["scripts/verify-prepr.mjs", "--mode=admit", "--issue=908", `--base=${base}`, `--report-dir=${output}`], { cwd: repo.dir, encoding: "utf8" });
      expect(child.status).toBe(1);
      return JSON.parse(readFileSync(resolve(output, "report.json"), "utf8")).errors.join(" ");
    };
    expect(run()).toContain("로그 bytes/checksum");
    rmSync(resolve(path, "step-1.log"));
    symlinkSync(resolve(repo.dir, "tracked.txt"), resolve(path, "step-1.log"));
    expect(run()).toContain("symlink");
  }, 15000);
  it("excludes local raw logs and outputs from the Docker build context", () => {
    const dockerignore = readFileSync(resolve(root, ".dockerignore"), "utf8");
    expect(dockerignore.split(/\r?\n/)).toContain(".prepr-reports");
    expect(dockerignore.split(/\r?\n/)).toContain(".next-prepr");
  });
  it("recovers same-source admission after a cancelled run without runner JSON while preserving its history", () => {
    const repo = repository();
    mkdirSync(resolve(repo.dir, "scripts"), { recursive: true });
    for (const file of ["verify-prepr.mjs", "prepr-core.mjs", "prepr-snapshot.mjs", "prepr-docker.mjs"]) copyFileSync(resolve(root, "scripts", file), resolve(repo.dir, "scripts", file));
    for (const file of ["package.json", "package-lock.json"]) copyFileSync(resolve(root, file), resolve(repo.dir, file));
    writeFileSync(resolve(repo.dir, ".gitignore"), ".prepr-reports/\n");
    mkdirSync(resolve(repo.dir, "tests")); writeFileSync(resolve(repo.dir, "tests/synthetic.test.ts"), "// synthetic receipt parsing fixture only\n");
    repo.git("add", "."); repo.git("commit", "-m", "local admission fixture");
    const base = repo.git("rev-parse", "HEAD");
    mkdirSync(resolve(repo.dir, "docs")); writeFileSync(resolve(repo.dir, "docs/change.md"), "synthetic docs\n");
    repo.git("add", "."); repo.git("commit", "-m", "synthetic scope");
    const source = sourceEvidence(repo.dir, base), environment = environmentEvidence(repo.dir);
    const selection = selectImpact({ changed: source.changed, tests: { unit: ["tests/synthetic.test.ts"], e2e: [] }, risk: "LOW", includes: ["tests/synthetic.test.ts"] });
    const timestamp = Date.now() - 20_000;
    const common = { schemaVersion: 2, tool: "mastergantt-local-verify", issue: 908, mode: "fast", sourceStart: source, sourceEnd: source, sourceStable: true, environmentStart: environment, environmentEnd: environment, environmentStable: true, selection, dryRun: false, startedAt: new Date(timestamp).toISOString() };
    const save = (folder: string, report: object) => {
      mkdirSync(folder, { recursive: true });
      writeFileSync(resolve(folder, "report.json"), JSON.stringify({ ...report, integritySha256: reportChecksum(report) }));
    };
    const cancelledPath = resolve(repo.dir, ".prepr-reports/cancelled");
    const cancelled = { ...common, completedAt: new Date(timestamp + 1_000).toISOString(), status: "FAIL", interrupted: true, errors: ["synthetic SIGINT"], steps: [{ label: "Unit", status: "FAIL", exitCode: null, signal: "SIGINT" }] };
    save(cancelledPath, cancelled);
    const passedPath = resolve(repo.dir, ".prepr-reports/passed"); mkdirSync(passedPath, { recursive: true });
    const runnerBytes = JSON.stringify({ testResults: [{ name: resolve(repo.dir, "tests/synthetic.test.ts"), assertionResults: [{ status: "passed" }] }] });
    writeFileSync(resolve(passedPath, "vitest-results.json"), runnerBytes);
    const digest = (value: string) => createHash("sha256").update(value).digest("hex");
    const steps = Object.entries(COMMON_CHECKS).map(([label, command], index) => {
      const logFile = `step-${index + 1}.log`, bytes = `synthetic fixture ${label}\n`;
      writeFileSync(resolve(passedPath, logFile), bytes);
      return { label, command: label === "Unit" ? [...command, "--reporter=default", "--reporter=json", `--outputFile=${resolve(passedPath, "vitest-results.json")}`] : command, status: "PASS", exitCode: 0, signal: null, logFile, logSha256: digest(bytes), caseCount: label === "Unit" ? 1 : null, coveredTests: label === "Unit" ? ["tests/synthetic.test.ts"] : [], ...(label === "Unit" ? { runner: { kind: "vitest", resultFile: "vitest-results.json", resultSha256: digest(runnerBytes), fileResults: [{ path: "tests/synthetic.test.ts", passed: 1, failed: 0, skipped: 0 }] } } : {}) };
    });
    save(passedPath, { ...common, completedAt: new Date(timestamp + 2_000).toISOString(), status: "PASS", interrupted: false, errors: [], steps });
    const run = () => {
      const output = resolve(repo.dir, ".prepr-reports", `admit-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const child = spawnSync(process.execPath, ["scripts/verify-prepr.mjs", "--mode=admit", "--issue=908", "--include=tests/synthetic.test.ts", `--base=${base}`, `--report-dir=${output}`], { cwd: repo.dir, encoding: "utf8" });
      return { child, report: JSON.parse(readFileSync(resolve(output, "report.json"), "utf8")) };
    };
    const recovered = run();
    expect(recovered.child.status, recovered.report.errors.join(" ")).toBe(0);
    expect(recovered.report.admission.publishAllowed).toBe(true);
    expect(readFileSync(resolve(cancelledPath, "report.json"), "utf8")).toContain("synthetic SIGINT");
    save(cancelledPath, { ...cancelled, completedAt: new Date(timestamp + 3_000).toISOString() });
    const latestFailure = run();
    expect(latestFailure.child.status).toBe(1);
    expect(latestFailure.report.admission.publishAllowed).toBe(false);
    expect(latestFailure.report.errors.join(" ")).toContain("최신 실행");
  }, 20000);
});
