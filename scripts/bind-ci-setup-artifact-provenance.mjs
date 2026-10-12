import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (entry.endsWith(".jsonl")) files.push(full);
  }
  return files.sort();
}

const input = arg("input");
const runId = arg("run-id");
const runAttempt = Number(arg("run-attempt"));
const workflow = arg("workflow");
const eventName = arg("event");
const headSha = arg("head-sha");

if (!input || !/^\d+$/.test(runId)) throw new Error("--input and numeric --run-id are required.");
if (!Number.isInteger(runAttempt) || runAttempt <= 0) throw new Error("--run-attempt must be a positive integer.");
if (!workflow.startsWith(".github/workflows/") || !/\.ya?ml$/.test(workflow)) throw new Error("--workflow must be a workflow path.");
if (!eventName) throw new Error("--event is required.");
if (!/^[0-9a-f]{40}$/i.test(headSha)) throw new Error("--head-sha must be a 40-character SHA.");

let accepted = 0;
let rejected = 0;
for (const file of walk(input)) {
  const output = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      const job = String(value?.job || "").trim();
      const metric = String(value?.metric || "").trim();
      const durationMs = Number(value?.durationMs);
      if (
        value?.schemaVersion !== 2 ||
        value?.issue !== 439 ||
        !job ||
        !metric ||
        !Number.isFinite(durationMs) ||
        durationMs < 0
      ) {
        rejected += 1;
        continue;
      }
      output.push(JSON.stringify({
        ...value,
        runId,
        runAttempt,
        workflow,
        eventName,
        headSha: headSha.toLowerCase(),
        provenanceBound: true,
        provenanceSource: "github-actions-run-api",
      }));
      accepted += 1;
    } catch {
      rejected += 1;
    }
  }
  const temp = `${file}.bound.tmp`;
  writeFileSync(temp, output.length ? output.join("\n") + "\n" : "", "utf8");
  renameSync(temp, file);
}

process.stdout.write(JSON.stringify({
  runId,
  runAttempt,
  workflow,
  eventName,
  headSha: headSha.toLowerCase(),
  accepted,
  rejected,
}) + "\n");
