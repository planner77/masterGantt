import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Old browser captures retain their original manifest bytes. A version-only
 * bump can use those records only while the complete dependency tree agrees. */
export function assertCapturedInstall(root: string): void {
  const captured = (name: string) => JSON.parse(readFileSync(resolve(root,
    `tests/fixtures/gantt-state-consistency/capture-sources/${name}-original.snapshot.txt`), "utf8"));
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const oldManifest = captured("package"), oldLock = captured("package-lock");
  // Issue #699 adds one development-only, exact command alias.
  // Keep original capture-sources immutable and reject changes to ANY other
  // command, production metadata or lockfile instead of refreshing the snapshot.
  if (Object.hasOwn(manifest.scripts ?? {}, "verify:prepr")) {
    assert.equal(manifest.scripts["verify:prepr"], "node scripts/verify-prepr.mjs",
      "Only the exact local verification alias may differ from the historical manifest");
    delete manifest.scripts["verify:prepr"];
  }
  manifest.version = oldManifest.version;
  lock.version = oldLock.version;
  lock.packages[""].version = oldLock.packages[""].version;
  assert.deepEqual(manifest, oldManifest, "Historical capture requires unchanged package metadata except version");
  assert.deepEqual(lock, oldLock, "Historical capture requires the same complete locked dependency tree");
}
