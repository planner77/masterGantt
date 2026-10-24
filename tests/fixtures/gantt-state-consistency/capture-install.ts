import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Historic Core/browser captures are immutable evidence for the original install.
// Next.js and Zod security updates are separately pinned; neither changes old
// captures or treats an unverified dependency upgrade as equivalent evidence.
const nextSecurityPackagePaths = [
  "node_modules/next",
  "node_modules/@next/env",
  "node_modules/@next/swc-darwin-arm64",
  "node_modules/@next/swc-darwin-x64",
  "node_modules/@next/swc-linux-arm64-gnu",
  "node_modules/@next/swc-linux-arm64-musl",
  "node_modules/@next/swc-linux-x64-gnu",
  "node_modules/@next/swc-linux-x64-musl",
  "node_modules/@next/swc-win32-arm64-msvc",
  "node_modules/@next/swc-win32-x64-msvc",
] as const;
const approvedPatchUrl = new URL("./approved-next-16.4.2-lock.json", import.meta.url);
const approvedZodUrl = new URL("./approved-zod-4.6.7-lock.json", import.meta.url);

/** Verify immutable Core capture provenance with exact reviewed Next.js 16.4.2
 * and Zod 4.6.7 security patches. All other packages/scripts/metadata and the
 * original captured files remain subject to strict equality. */
export function assertCapturedInstall(root: string): void {
  const captured = (name: string) => JSON.parse(readFileSync(resolve(root,
    `tests/fixtures/gantt-state-consistency/capture-sources/${name}-original.snapshot.txt`), "utf8"));
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const oldManifest = captured("package"), oldLock = captured("package-lock");

  // Keep the historically permitted #699 developer-only command alias strict.
  if (Object.hasOwn(manifest.scripts ?? {}, "verify:prepr")) {
    assert.equal(manifest.scripts["verify:prepr"], "node scripts/verify-prepr.mjs",
      "Only the exact local verification alias may differ from the historical manifest");
    delete manifest.scripts["verify:prepr"];
  }

  // This allowlist is authoritative test data committed separately from the
  // historical snapshots; temp fixture directories cannot supply a replacement.
  const approved = JSON.parse(readFileSync(approvedPatchUrl, "utf8"));
  assert.equal(approved.schema, "mastergantt-next-security-patch-v1");
  assert.equal(approved.capturedVersion, "16.3.8");
  assert.equal(approved.patchedVersion, "16.4.2");
  assert.deepEqual(Object.keys(approved.packages).sort(), [...nextSecurityPackagePaths].sort(),
    "Only the ten reviewed Next.js security packages may differ from historical capture");
  for (const name of ["next", "@next/env"] as const) {
    assert.equal(oldManifest.dependencies[name], approved.capturedVersion,
      "Historical capture baseline is not the expected Next.js 16.3.8 release");
    assert.equal(oldLock.packages[""].dependencies[name], approved.capturedVersion,
      "Historical lock baseline is not the expected Next.js 16.3.8 release");
    assert.equal(manifest.dependencies[name], approved.patchedVersion,
      "Historical capture requires unchanged package metadata outside approved Next.js security patch");
    assert.equal(lock.packages[""].dependencies[name], approved.patchedVersion,
      "Historical capture requires the same complete locked dependency tree outside approved Next.js security patch");
    manifest.dependencies[name] = oldManifest.dependencies[name];
    lock.packages[""].dependencies[name] = oldLock.packages[""].dependencies[name];
  }
  for (const path of nextSecurityPackagePaths) {
    assert.equal(oldLock.packages[path]?.version, approved.capturedVersion,
      `Historical Next.js capture package missing or wrong: ${path}`);
    // Exact metadata, including resolved registry, integrity (SRI), optional
    // SWC architecture, dependencies and Sharp floor: never accept version-only.
    assert.deepEqual(lock.packages[path], approved.packages[path],
      `Approved Next.js security patch exact locked package metadata mismatch: ${path}`);
    lock.packages[path] = oldLock.packages[path];
  }

  // #556 F-002: the original capture used Zod 4.6.2. Do not rewrite
  // historical source snapshots to hide the current production security fix.
  // Trusted approval metadata is imported from this module's own location,
  // not from a directory supplied by a caller or test fixture.
  const approvedZod = JSON.parse(readFileSync(approvedZodUrl, "utf8"));
  assert.equal(approvedZod.schema, "mastergantt-zod-security-patch-v1");
  assert.equal(approvedZod.capturedVersion, "4.6.2");
  assert.equal(approvedZod.patchedVersion, "4.6.7");
  assert.equal(approvedZod.advisory, "GHSA-mrhx-c7xc-m3w5");
  assert.deepEqual(Object.keys(approvedZod.package).sort(),
    ["version", "resolved", "integrity", "license", "funding"].sort(),
    "Approved Zod package must not gain new metadata fields");
  assert.equal(oldManifest.dependencies.zod, approvedZod.capturedVersion,
    "Historic Zod captured manifest unexpectedly changed");
  assert.equal(oldLock.packages[""].dependencies.zod, approvedZod.capturedVersion,
    "Historic Zod captured lock root unexpectedly changed");
  assert.equal(oldLock.packages["node_modules/zod"]?.version, approvedZod.capturedVersion,
    "Historic Zod captured package unexpectedly changed");
  assert.equal(manifest.dependencies.zod, approvedZod.patchedVersion,
    "Only reviewed Zod 4.6.7 security patch is accepted in current manifest");
  assert.equal(lock.packages[""].dependencies.zod, approvedZod.patchedVersion,
    "Only reviewed Zod 4.6.7 security patch is accepted in current lock root");
  assert.deepEqual(lock.packages["node_modules/zod"], approvedZod.package,
    "Approved Zod security patch exact locked package metadata mismatch");
  manifest.dependencies.zod = oldManifest.dependencies.zod;
  lock.packages[""].dependencies.zod = oldLock.packages[""].dependencies.zod;
  lock.packages["node_modules/zod"] = oldLock.packages["node_modules/zod"];

  // Versions of the app itself changed independently of the browser capture.
  manifest.version = oldManifest.version;
  lock.version = oldLock.version;
  lock.packages[""].version = oldLock.packages[""].version;
  assert.deepEqual(manifest, oldManifest,
    "Historical capture requires unchanged package metadata except version and approved security patch");
  assert.deepEqual(lock, oldLock,
    "Historical capture requires the same complete locked dependency tree outside approved security patch");
}
