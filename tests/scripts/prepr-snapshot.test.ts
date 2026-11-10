import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createBrowserSnapshot, inspectBrowserSnapshot, installedDependenciesEvidence, removeBrowserSnapshot, snapshotRunnerRoot, validateNextGenerated, validateSnapshotAudit, writeBrowserSnapshotAudit, type BrowserSnapshot } from "../../scripts/prepr-snapshot.mjs";
import { inventory, runnerCoverage, selectImpact, sourceEvidence } from "../../scripts/prepr-core.mjs";

const originalRoot = resolve(__dirname, "../..");
const folders: string[] = [];
const snapshots: BrowserSnapshot[] = [];
afterEach(() => {
  for (const snapshot of snapshots.splice(0)) removeBrowserSnapshot(snapshot);
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function declarations(dist = ".next") {
  return ['/// <reference types="next" />', '/// <reference types="next/image-types/global" />', `import "./${dist}/types/routes.d.ts";`, `import "./${dist}/types/root-params.d.ts";`, "", "// NOTE: This file should not be edited", "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.", ""].join("\n");
}
function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "mastergantt-source-snapshot-"));
  folders.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main"); git("config", "user.name", "Snapshot Fixture"); git("config", "user.email", "snapshot@example.invalid");
  mkdirSync(resolve(root, "tests/fixtures"), { recursive: true });
  mkdirSync(resolve(root, "node_modules/next/dist/lib/typescript"), { recursive: true });
  mkdirSync(resolve(root, "node_modules/next/bin"), { recursive: true });
  mkdirSync(resolve(root, "node_modules/.bin"), { recursive: true });
  writeFileSync(resolve(root, "node_modules/next/dist/lib/typescript/writeAppTypeDeclarations.js"), "// synthetic generator identity\n");
  writeFileSync(resolve(root, "node_modules/next/package.json"), JSON.stringify({ name: "next", version: "0.0.0-synthetic" }));
  writeFileSync(resolve(root, "node_modules/next/bin/next.js"), '#!/usr/bin/env node\nconsole.log("synthetic local Next binary");\n');
  chmodSync(resolve(root, "node_modules/next/bin/next.js"), 0o755);
  symlinkSync("../next/bin/next.js", resolve(root, "node_modules/.bin/next"));
  writeFileSync(resolve(root, ".gitignore"), "node_modules/\n.prepr-reports/\n.next-e2e*/\n");
  writeFileSync(resolve(root, "product.ts"), "export const count = 1;\n");
  writeFileSync(resolve(root, "AGENTS.md"), "## Source instructions\n");
  writeFileSync(resolve(root, "tests/fixtures/synthetic.json"), '{"synthetic":1}\n');
  writeFileSync(resolve(root, "next-env.d.ts"), declarations());
  const config = { compilerOptions: { strict: true }, include: ["next-env.d.ts", ".next/types/**/*.ts", "src/**/*.ts"] };
  writeFileSync(resolve(root, "tsconfig.json"), JSON.stringify(config, null, 2) + "\n");
  git("add", "."); git("commit", "-m", "synthetic snapshot source");
  const source = sourceEvidence(root, "HEAD");
  const reportDir = resolve(root, ".prepr-reports/synthetic-run"); mkdirSync(reportDir, { recursive: true });
  const create = () => { const snapshot = createBrowserSnapshot(root, reportDir, source); snapshots.push(snapshot); return snapshot; };
  return { root, git, source, reportDir, config, create };
}

describe("Issue #908 browser source snapshots", () => {
  it("runs from identical exact-head bytes while strict Next metadata generation leaves the original unchanged", () => {
    const { root, source, config, create } = fixture();
    const snapshot = create();
    expect(sourceEvidence(snapshot.snapshotRoot, source.baseSha).contentSha256).toBe(source.contentSha256);
    writeFileSync(resolve(snapshot.snapshotRoot, "next-env.d.ts"), declarations(".next-e2e-isolated-123-synthetic/dev"));
    writeFileSync(resolve(snapshot.snapshotRoot, "tsconfig.json"), JSON.stringify({ ...config, include: [...config.include, ".next-e2e-isolated-123-synthetic/dev/types/**/*.ts"] }, null, 2) + "\n");
    const { audit, verification } = inspectBrowserSnapshot(snapshot, source);
    expect(verification.status).toBe("PASS");
    expect(verification.generatedChanges.map((change) => change.path)).toEqual(["next-env.d.ts", "tsconfig.json"]);
    expect(verification.beforeManifestSha256).not.toBe(verification.afterManifestSha256);
    expect(validateSnapshotAudit(audit, source)).toEqual(verification);
    expect(sourceEvidence(root, source.baseSha).fingerprint).toBe(source.fingerprint);
    expect(readFileSync(resolve(root, "next-env.d.ts"), "utf8")).toBe(declarations());
  });
  it("rejects product/test fixture mutations instead of excluding them from the fingerprint", () => {
    const { source, create } = fixture();
    const snapshot = create();
    writeFileSync(resolve(snapshot.snapshotRoot, "product.ts"), "export const count = 2;\n");
    expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/source\/fixture/);
    writeFileSync(resolve(snapshot.snapshotRoot, "product.ts"), "export const count = 1;\n");
    writeFileSync(resolve(snapshot.snapshotRoot, "tests/fixtures/synthetic.json"), '{"synthetic":2}\n');
    expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/source\/fixture/);
  });
  it("rejects compiler options, removed/reordered includes, rogue includes and arbitrary declaration code", () => {
    const { source, config, create } = fixture();
    const snapshot = create();
    const configFile = resolve(snapshot.snapshotRoot, "tsconfig.json");
    for (const changed of [
      { ...config, compilerOptions: { strict: false }, include: [...config.include, ".next-e2e/dev/types/**/*.ts"] },
      { ...config, include: [...config.include].reverse() },
      { ...config, include: [...config.include, "unreviewed/**/*.ts"] },
    ]) {
      writeFileSync(configFile, JSON.stringify(changed, null, 2) + "\n");
      expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/tsconfig/);
    }
    writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
    writeFileSync(resolve(snapshot.snapshotRoot, "next-env.d.ts"), declarations(".next-e2e/dev") + 'import "malicious-payload";\n');
    expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/next-env/);
    for (const dist of ["../outside", ".next-unreviewed", ".next-e2e/../../outside"]) {
      expect(() => validateNextGenerated({ "next-env.d.ts": declarations(), "tsconfig.json": null }, { "next-env.d.ts": declarations(dist), "tsconfig.json": null })).toThrow(/next-env/);
    }
  });
  it("blocks dirty or stale source before creating a snapshot and refuses reused/outside/symlink destinations", () => {
    const { root, source, reportDir, create } = fixture();
    writeFileSync(resolve(root, "product.ts"), "changed after source capture\n");
    expect(create).toThrow(/원본 source/);
    expect(() => createBrowserSnapshot(root, reportDir, sourceEvidence(root))).toThrow(/clean exact HEAD/);
    writeFileSync(resolve(root, "product.ts"), "export const count = 1;\n");
    const outside = mkdtempSync(resolve(tmpdir(), "mastergantt-snapshot-outside-")); folders.push(outside);
    expect(() => createBrowserSnapshot(root, outside, source)).toThrow(/허용 범위/);
    symlinkSync(outside, resolve(root, ".prepr-reports/linked"), "junction");
    expect(() => createBrowserSnapshot(root, resolve(root, ".prepr-reports/linked"), source)).toThrow(/symlink/);
    const snapshot = create();
    expect(() => createBrowserSnapshot(root, reportDir, source)).toThrow(/재사용/);
    expect(sourceEvidence(root, source.baseSha).fingerprint).toBe(source.fingerprint);
    expect(snapshot.snapshotRoot).toBe(resolve(reportDir, "browser-source"));
  });
  it("rejects untracked source and operational dotenv files in the browser workspace", () => {
    const { source, create } = fixture();
    const snapshot = create();
    writeFileSync(resolve(snapshot.snapshotRoot, "unexpected.ts"), "unreviewed source\n");
    expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/파일 목록/);
    rmSync(resolve(snapshot.snapshotRoot, "unexpected.ts"));
    writeFileSync(resolve(snapshot.snapshotRoot, ".env.local"), "SYNTHETIC=do-not-print\n");
    expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/\.env/);
  });
  it("rejects staged-only snapshot mutation even when working bytes were restored", () => {
    const { source, create } = fixture();
    const snapshot = create();
    writeFileSync(resolve(snapshot.snapshotRoot, "product.ts"), "staged snapshot mutation\n");
    execFileSync("git", ["add", "product.ts"], { cwd: snapshot.snapshotRoot });
    writeFileSync(resolve(snapshot.snapshotRoot, "product.ts"), "export const count = 1;\n");
    expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/index/);
  });
  it("binds audit input/head and runner paths to this exact snapshot instead of accepting paths outside tests", () => {
    const { root, source, reportDir, create } = fixture();
    const snapshot = create();
    const { audit } = inspectBrowserSnapshot(snapshot, source);
    expect(() => validateSnapshotAudit({ ...audit, headSha: "0".repeat(40) }, source)).toThrow(/Head/);
    expect(() => validateSnapshotAudit({ ...audit, inputContentSha256: "0".repeat(64) }, source)).toThrow(/입력/);
    expect(snapshotRunnerRoot(reportDir, snapshot.snapshotRoot)).toBe(snapshot.snapshotRoot);
    expect(() => snapshotRunnerRoot(reportDir, root)).toThrow(/runner source/);
    expect(runnerCoverage("playwright", { suites: [{ specs: [{ file: resolve(snapshot.snapshotRoot, "tests/e2e/synthetic.spec.ts"), tests: [{ expectedStatus: "passed", results: [{ status: "passed" }] }] }] }] }, snapshot.snapshotRoot)).toEqual([{ path: "tests/e2e/synthetic.spec.ts", passed: 1, failed: 0, skipped: 0 }]);
    for (const file of ["../../outside.spec.ts", "/outside/rogue.spec.ts", "..\\outside.spec.ts"]) expect(() => runnerCoverage("playwright", { suites: [{ specs: [{ file, tests: [{ expectedStatus: "passed", results: [{ status: "passed" }] }] }] }] }, snapshot.snapshotRoot)).toThrow(/경로|tests 밖/);
  });
  it("maps the snapshot producer to direct regression and a real existing Chromium consumer", () => {
    const tests = inventory(originalRoot);
    const selected = selectImpact({ changed: ["scripts/prepr-snapshot.mjs"], tests, risk: "HIGH" });
    expect(selected.state).toBe("READY");
    expect(selected.selected.map((test) => test.path)).toEqual(expect.arrayContaining(["tests/scripts/prepr-snapshot.test.ts", "tests/scripts/prepr-verifier.test.ts", "tests/e2e/gantt-demo.spec.ts"]));
  });
  it("resolves Next and relative .bin links inside the copied hermetic root", () => {
    const { root, source, create } = fixture();
    const before = installedDependenciesEvidence(resolve(root, "node_modules"));
    const snapshot = create();
    const localRequire = createRequire(resolve(snapshot.snapshotRoot, "package.json"));
    expect(realpathSync(localRequire.resolve("next/package.json"))).toBe(resolve(snapshot.snapshotRoot, "node_modules/next/package.json"));
    expect(readlinkSync(resolve(snapshot.snapshotRoot, "node_modules/.bin/next"))).toBe("../next/bin/next.js");
    const binary = spawnSync(resolve(snapshot.snapshotRoot, "node_modules/.bin/next"), [], { cwd: snapshot.snapshotRoot, encoding: "utf8" });
    expect(binary.status, binary.stderr).toBe(0);
    expect(binary.stdout).toContain("synthetic local Next binary");
    expect(installedDependenciesEvidence(resolve(snapshot.snapshotRoot, "node_modules"))).toEqual(before);
    expect(inspectBrowserSnapshot(snapshot, source).verification.dependenciesManifestSha256).toBe(before.manifestSha256);
  });
  it("rejects external, absolute and dangling installed links before executing the snapshot", () => {
    const { root, create } = fixture();
    const link = resolve(root, "node_modules/.bin/untrusted");
    for (const target of ["../../product.ts", resolve(root, "node_modules/next/bin/next.js"), "../missing-package/bin.js"]) {
      symlinkSync(target, link);
      expect(create).toThrow(/symlink/);
      rmSync(link);
    }
    expect(readFileSync(resolve(root, "product.ts"), "utf8")).toBe("export const count = 1;\n");
  });
  it("blocks dependency byte drift and never shares original file writes through a hardlink", () => {
    const { root, source, create } = fixture();
    const snapshot = create();
    const original = resolve(root, "node_modules/next/package.json"), copied = resolve(snapshot.snapshotRoot, "node_modules/next/package.json");
    const before = readFileSync(original, "utf8");
    writeFileSync(copied, '{"name":"mutated-copy"}');
    expect(readFileSync(original, "utf8")).toBe(before);
    expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/설치 의존성/);
    writeFileSync(copied, before);
    writeFileSync(original, '{"name":"mutated-original"}');
    expect(readFileSync(copied, "utf8")).toBe(before);
    expect(() => inspectBrowserSnapshot(snapshot, source)).toThrow(/설치 의존성/);
  });
  it("saves a blocked raw source audit before cleanup instead of losing an AGENTS drift failure", () => {
    const { source, reportDir, create } = fixture();
    const snapshot = create();
    writeFileSync(resolve(snapshot.snapshotRoot, "AGENTS.md"), "# Unexpected instructions rewrite\n");
    const proof = writeBrowserSnapshotAudit(snapshot, source);
    expect(proof.status).toBe("BLOCKED");
    const auditPath = resolve(reportDir, proof.auditFile);
    const audit = JSON.parse(readFileSync(auditPath, "utf8"));
    expect(audit.captureError).toContain("AGENTS.md");
    expect(audit.before.find((file: {path: string}) => file.path === "AGENTS.md").sha256).not.toBe(audit.after.find((file: {path: string}) => file.path === "AGENTS.md").sha256);
    removeBrowserSnapshot(snapshot); snapshots.splice(snapshots.indexOf(snapshot), 1);
    expect(existsSync(snapshot.snapshotRoot)).toBe(false);
    expect(existsSync(auditPath)).toBe(true);
  });
});
