import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Historical Core-browser fixtures remain immutable. The ONLY allowed drift
 * from their captured npm graph is the pinned Next.js 16.3.8 -> 16.4.2
 * security correction from Issue #752. This is a source-integrity comparison,
 * NOT a new execution of the historical browser session or a production PASS.
 */
export function assertCapturedInstall(root: string): void {
  const captured = (name: string) => JSON.parse(readFileSync(resolve(root,
    "tests/fixtures/gantt-state-consistency/capture-sources/" + name + "-original.snapshot.txt"), "utf8"));
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const oldManifest = captured("package");
  const oldLock = captured("package-lock");
  const manifestError = "Historical capture requires unchanged package metadata except version and pinned Next security patch";
  const lockError = "Historical capture requires the same complete locked dependency tree except pinned Next security patch";

  // Issue #699 introduced exactly this local-only development alias.
  if (Object.hasOwn(manifest.scripts ?? {}, "verify:prepr")) {
    assert.equal(manifest.scripts["verify:prepr"], "node scripts/verify-prepr.mjs",
      "Only the exact local verification alias may differ from the historical manifest");
    delete manifest.scripts["verify:prepr"];
  }

  const originalNext = "16.3.8";
  const securityNext = "16.4.2";
  assert.equal(oldManifest.dependencies.next, originalNext, manifestError);
  assert.equal(oldLock.packages["node_modules/next"].version, originalNext, lockError);
  if (manifest.dependencies.next === securityNext) {
    // Verify the active package metadata before normalizing ONLY known fields
    // to the captured graph. Any unrelated metadata drift remains detectable.
    assert.equal(manifest.dependencies["@next/env"], securityNext, manifestError);
    manifest.dependencies.next = oldManifest.dependencies.next;
    manifest.dependencies["@next/env"] = oldManifest.dependencies["@next/env"];

    const lockRoot = lock.packages[""];
    const previousRoot = oldLock.packages[""];
    assert.equal(lockRoot.dependencies.next, securityNext, lockError);
    assert.equal(lockRoot.dependencies["@next/env"], securityNext, lockError);
    lockRoot.dependencies.next = previousRoot.dependencies.next;
    lockRoot.dependencies["@next/env"] = previousRoot.dependencies["@next/env"];

    // Do not overwrite metadata beyond the signed/versioned npm tarball
    // identity. The final deepEqual rejects changes to any other field/node.
    function normalizeTarball(name: string): void {
      const key = "node_modules/" + name;
      const before = oldLock.packages[key];
      const current = lock.packages[key];
      assert.ok(before && current, lockError);
      assert.equal(before.version, originalNext, lockError);
      assert.equal(current.version, securityNext, lockError);
      assert.equal(typeof before.resolved, "string", lockError);
      const suffix = "-" + originalNext + ".tgz";
      assert.ok(before.resolved.endsWith(suffix), lockError);
      const patchedUrl = before.resolved.slice(0, -suffix.length) + "-" + securityNext + ".tgz";
      assert.equal(current.resolved, patchedUrl, lockError);
      current.version = before.version;
      current.resolved = before.resolved;
    }
    normalizeTarball("next");
    normalizeTarball("@next/env");

    const runtime = lock.packages["node_modules/next"];
    const historicRuntime = oldLock.packages["node_modules/next"];
    assert.equal(runtime.dependencies["@next/env"], securityNext, lockError);
    runtime.dependencies["@next/env"] = historicRuntime.dependencies["@next/env"];
    assert.equal(runtime.optionalDependencies.sharp, "^0.35.5", lockError);
    assert.equal(lock.packages["node_modules/sharp"].version, "0.35.5", lockError);
    runtime.optionalDependencies.sharp = historicRuntime.optionalDependencies.sharp;

    const swcKeys = Object.keys(oldLock.packages).filter((key) =>
      key.startsWith("node_modules/@next/swc-"));
    assert.equal(swcKeys.length, 8, lockError);
    for (const key of swcKeys) {
      const name = key.slice("node_modules/".length);
      assert.equal(runtime.optionalDependencies[name], securityNext, lockError);
      normalizeTarball(name);
      runtime.optionalDependencies[name] = historicRuntime.optionalDependencies[name];
    }
  }

  manifest.version = oldManifest.version;
  lock.version = oldLock.version;
  lock.packages[""].version = oldLock.packages[""].version;
  assert.deepEqual(manifest, oldManifest, manifestError);
  assert.deepEqual(lock, oldLock, lockError);
}
