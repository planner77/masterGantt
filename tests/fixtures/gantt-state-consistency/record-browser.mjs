import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = async path => JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8"));
const fixtureDirectory = "tests/fixtures/gantt-state-consistency";
const observed = await read("output/playwright/issue-663/runtime-observation.json");
const environment = await read("output/playwright/issue-663/browser-environment.json");
const snapshot = observed.snapshot;
if (observed.result !== "NATIVE_LAYOUT_SETTLED" || observed.trace.capacity !== 32 || observed.trace.dropped !== 0) throw new Error("Synthetic reader observation did not settle within its trace budget");
if (!snapshot || ["serializeTasks", "serializeTree", "serializeLinks"].some(key => !Array.isArray(snapshot[key]))) throw new Error("Missing public serialize collection");
for (const task of [...snapshot.serializeTasks, ...snapshot.serializeTree]) {
  if (!task.id.startsWith("fixture-") || !task.text.startsWith("Synthetic ")) throw new Error("Only synthetic fixture data may be recorded");
}
await writeFile(resolve(repositoryRoot, fixtureDirectory, "actual-core-2.7.3.json"), JSON.stringify(snapshot, null, 2) + "\n");
const files = ["package.json", "package-lock.json", `${fixtureDirectory}/browser.tsx`, `${fixtureDirectory}/prepare-browser.mjs`, `${fixtureDirectory}/record-browser.mjs`, `${fixtureDirectory}/actual-core-2.7.3.json`, "src/features/gantt/diagnostics/core-action-trace.ts", "src/features/gantt/diagnostics/core-trace-observer.ts"];
const sha256 = Object.fromEntries(await Promise.all(files.map(async path => [path, createHash("sha256").update(await readFile(resolve(repositoryRoot, path))).digest("hex")])));
const provenance = {
  schemaVersion: 1, fixtureVersion: "1.0.0", sourceBase: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  standardVersion: "1.0.0-candidate", collection: "SYNTHETIC_CORE_BROWSER",
  installedGanttVersion: (await read("node_modules/@svar-ui/react-gantt/package.json")).version,
  installedStoreVersion: (await read("node_modules/@svar-ui/gantt-store/package.json")).version,
  esbuildVersion: (await read("node_modules/esbuild/package.json")).version,
  capturedAt: new Date().toISOString(), environment, sha256,
  commands: ["npm ci", `node ${fixtureDirectory}/prepare-browser.mjs`, "playwright-cli -s=issue663 open file:///<worktree>/output/playwright/issue-663/core-reader.html --config output/playwright/issue-663/cli-config.json", "playwright-cli -s=issue663 eval 'async () => window.__gsc663.observe()' --raw > output/playwright/issue-663/runtime-observation.json", "playwright-cli -s=issue663 eval '() => ({browser: navigator.userAgent, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, viewport: {width: innerWidth, height: innerHeight}})' --raw > output/playwright/issue-663/browser-environment.json", `node ${fixtureDirectory}/record-browser.mjs`],
  publicSerialize: { tasks: "full DFS flat array; nested data references preserved", tree: "same full DFS flat array, not nested roots only", links: "array with id/source/target/type" },
  counts: { tasks: snapshot.serializeTasks.length, tree: snapshot.serializeTree.length, links: snapshot.serializeLinks.length },
  trace: { result: observed.result, snapshot: observed.trace },
  originalFailures: [
    { phase: "CLI_SETUP", result: "BLOCKED", reason: "Default Chrome channel absent; existing Chromium1243 selected" },
    { phase: "CLI_SETUP", result: "BLOCKED", reason: "file protocol disabled by CLI default; local synthetic file access enabled in session config" },
    { phase: "UNIT", result: "FAIL", reason: "Initial store-version expectation 2.7.3 differed from authenticated installed version 2.7.2; corrected expectation, original capture already recorded 2.7.2" },
  ],
  notTested: ["production wiring/recovery/receipt/axis behavior", "actual HTTP/SQLite", "SC-14 1000 Task plus 2000 Milestone and repeated mount/unmount", "full PR CI and Trusted QA", "main/GHCR/release"],
};
await writeFile(resolve(repositoryRoot, fixtureDirectory, "actual-core-provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
console.log(JSON.stringify({ collection: provenance.collection, counts: provenance.counts, result: observed.result }));
