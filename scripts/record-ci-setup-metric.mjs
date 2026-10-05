import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const metric = arg("metric");
const startedMs = Number(arg("started-ms"));
const cache = arg("cache", "n/a");

if (!metric || !Number.isFinite(startedMs) || startedMs <= 0) {
  throw new Error("Usage: node scripts/record-ci-setup-metric.mjs --metric NAME --started-ms EPOCH_MS [--cache VALUE]");
}

const endedMs = Date.now();
const durationMs = Math.max(0, endedMs - startedMs);
const runnerTemp = process.env.RUNNER_TEMP;
if (!runnerTemp) throw new Error("RUNNER_TEMP is required.");

const job = process.env.GITHUB_JOB || "unknown-job";
const file = process.env.CI_SETUP_METRICS_FILE || join(runnerTemp, `ci-setup-metrics-${job}.jsonl`);
mkdirSync(dirname(file), { recursive: true });

const first = !existsSync(file);
const record = {
  schemaVersion: 1,
  issue: 439,
  runId: process.env.GITHUB_RUN_ID || "",
  runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 0),
  job,
  eventName: process.env.GITHUB_EVENT_NAME || "",
  headSha: process.env.GITHUB_SHA || "",
  metric,
  durationMs,
  cache,
  recordedAt: new Date(endedMs).toISOString(),
};
appendFileSync(file, JSON.stringify(record) + "\n", "utf8");

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  if (first) {
    appendFileSync(
      summary,
      [
        "",
        "### CI setup/cache 계측 (#439)",
        "",
        "| 항목 | 시간 | cache |",
        "| --- | ---: | --- |",
      ].join("\n") + "\n",
      "utf8",
    );
  }
  appendFileSync(
    summary,
    `| ${metric} | ${(durationMs / 1000).toFixed(2)}s | ${cache} |\n`,
    "utf8",
  );
}

process.stdout.write(`${metric}: ${durationMs}ms cache=${cache}\n`);
