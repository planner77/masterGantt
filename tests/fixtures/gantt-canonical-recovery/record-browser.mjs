import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = "tests/fixtures/gantt-canonical-recovery";
const verifiedSourceBase = () => {
  // This is the merged U1 baseline, not the temporary worktree HEAD.
  const sourceBase = "d445ec58bf9106414c99a150ee8f52599834baf9";
  const runGit = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  if (runGit(["rev-parse", "--is-shallow-repository"]) !== "false") throw new Error("Complete Git history is required for capture provenance");
  if (runGit(["cat-file", "-t", sourceBase]) !== "commit") throw new Error("Capture baseline is not a Git commit");
  runGit(["merge-base", "--is-ancestor", sourceBase, "HEAD"]);
  return sourceBase;
};
const read = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const runtime = await read("output/playwright/issue-664/runtime-observation.json");
const names = ["fresh-dto-no-op", "dnd-412", "dnd-500-not-committed", "date-422", "add-422", "link-delete-422", "task-delete-422", "link-add-422", "metadata-422", "parent-add-422-surviving-child", "type-422", "collapsed-dnd-412"];
if (runtime.rows.length !== names.length || runtime.rows.some((row, index) => row.name !== names[index] || row.outcome !== "SETTLED" || !row.finalMatch || (index > 0 && !row.driftDetected))) throw new Error("Actual Core recovery did not conform in every named scenario");
if (runtime.rows[0].actions.length !== 0 || runtime.serverMutationCalls !== 0) throw new Error("Unexpected no-op or server mutation");
if (runtime.rows.some(row => row.actions.some(action => !["move-task", "update-task", "add-task", "delete-task", "add-link", "delete-link", "open-task"].includes(action)))) throw new Error("Unexpected public data/viewport action");
if (runtime.rows.slice(1).some(row => JSON.stringify(row.selected) !== JSON.stringify(["fixture-b"]))) throw new Error("Passive recovery changed the synthetic selection");
if (runtime.rows.at(-1).treeOpen !== false) throw new Error("Collapsed tree was reopened");
if (runtime.snapshot.tasks.some(task => !task.id.startsWith("fixture-") || !task.text.startsWith("Synthetic "))) throw new Error("Only synthetic data may be recorded");
await writeFile(resolve(root, directory, "actual-recovery-2.7.3.json"), JSON.stringify(runtime, null, 2) + "\n");
const files = ["package.json", "package-lock.json", `${directory}/browser.tsx`, `${directory}/prepare-browser.mjs`, `${directory}/record-browser.mjs`, `${directory}/actual-recovery-2.7.3.json`, "src/features/gantt/canonical-recovery.ts", "src/features/gantt/core-conformance.ts", "src/features/gantt/canonical-snapshot-sync.ts", "src/features/gantt/state-consistency/contracts.ts", "src/features/gantt/state-consistency/core-reader.ts"];
const sha256 = Object.fromEntries(await Promise.all(files.map(async path => [path, createHash("sha256").update(await readFile(resolve(root, path))).digest("hex")])));
const receipt = {
  schemaVersion: 1, fixtureVersion: "1.0.0", collection: "SYNTHETIC_CORE_BROWSER",
  sourceBase: verifiedSourceBase(),
  standardVersion: "1.0.0-candidate", installedGanttVersion: (await read("node_modules/@svar-ui/react-gantt/package.json")).version,
  installedStoreVersion: (await read("node_modules/@svar-ui/gantt-store/package.json")).version,
  capturedAt: new Date().toISOString(), environment: runtime.environment, sha256,
  commands: ["npm ci --ignore-scripts", `node ${directory}/prepare-browser.mjs`, "bash /home/planner/.codex/skills/playwright/scripts/playwright_cli.sh -s=issue664 open file:///<worktree>/output/playwright/issue-664/canonical-recovery.html --config output/playwright/issue-664/cli-config.json", "playwright-cli -s=issue664 eval 'async () => window.__gsc664.run()' --raw > output/playwright/issue-664/runtime-observation.json", `node ${directory}/record-browser.mjs`],
  scenarios: names, result: "PASS", counts: { tasks: runtime.snapshot.tasks.length, links: runtime.snapshot.links.length, scenarios: runtime.rows.length },
  scope: "Actual installed Core public data reconciliation; synthetic GET outcome injection, no actual HTTP/SQLite; viewport coordinates at initial origin only",
  originalFailures: [
    { phase: "CLI_SETUP", result: "BLOCKED", reason: "Wrapper script lacked executable permission; invoked existing script via bash without changing its permission" },
    { phase: "PRE_REVIEW", result: "FAIL", reason: "Independent QA reproduced in-place identity aliases, cumulative deadline overflow and stalled frame/GET timeout; fixed with immutable snapshots, shared budget, independent watchdog/abort wake-up and regression cases before final capture" },
  ],
  notTested: ["actual HTTP/SQLite and server commit ambiguity", "production U5 wiring and full native dirty event registration", "product DnD/Bar geometry and later saves", "nonzero viewport or five-width/DayWeek matrix", "large actual Core recovery performance and mount/unmount", "full PR CI/Trusted QA/Owner ACCEPT", "main/GHCR/release"],
};
await writeFile(resolve(root, directory, "actual-recovery-provenance.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ result: receipt.result, counts: receipt.counts }));
