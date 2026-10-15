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
  manifest.version = oldManifest.version;
  lock.version = oldLock.version;
  lock.packages[""].version = oldLock.packages[""].version;
  assert.deepEqual(manifest, oldManifest, "Historical capture requires unchanged package metadata except version");
  assert.deepEqual(lock, oldLock, "Historical capture requires the same complete locked dependency tree");
}
