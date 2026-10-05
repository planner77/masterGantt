import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function key(metric) {
  return JSON.stringify([metric.workflow, metric.eventName, metric.job, metric.metric]);
}
function pct(before, after) {
  if (!Number.isFinite(before) || before <= 0) return null;
  return Number((((after - before) / before) * 100).toFixed(2));
}
function change(before, after) {
  return Math.round(after - before);
}

const baselinePath = arg("baseline");
const currentPath = arg("current");
const output = arg("output");
const summary = arg("summary", process.env.GITHUB_STEP_SUMMARY || "");
const minImprovementPercent = Number(arg("min-improvement-percent", "5"));
const maxRunnerIncreasePercent = Number(arg("max-runner-increase-percent", "0"));

if (!baselinePath || !currentPath) {
  throw new Error("Usage: node scripts/compare-ci-setup-metrics.mjs --baseline BASE.json --current CURRENT.json [--output result.json]");
}
if (!Number.isFinite(minImprovementPercent) || minImprovementPercent < 0) throw new Error("--min-improvement-percent must be >= 0");
if (!Number.isFinite(maxRunnerIncreasePercent)) throw new Error("--max-runner-increase-percent must be a number");

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const current = JSON.parse(readFileSync(currentPath, "utf8"));
const baselineMetrics = new Map((baseline.metrics ?? []).map((metric) => [key(metric), metric]));
const currentMetrics = new Map((current.metrics ?? []).map((metric) => [key(metric), metric]));

const comparisons = [];
for (const [metricKey, before] of baselineMetrics) {
  const after = currentMetrics.get(metricKey);
  if (!after) continue;
  const comparable = Boolean(before.enoughSamples && after.enoughSamples);
  const medianDeltaPercent = pct(before.medianMs, after.medianMs);
  const p90DeltaPercent = pct(before.p90Ms, after.p90Ms);
  const runnerDeltaPercent = pct(before.runnerMinutesPerSuccessfulRun, after.runnerMinutesPerSuccessfulRun);
  const wallClockImprovementPercent = medianDeltaPercent === null ? null : Number((-medianDeltaPercent).toFixed(2));
  const adopted =
    comparable &&
    wallClockImprovementPercent !== null &&
    wallClockImprovementPercent >= minImprovementPercent &&
    (runnerDeltaPercent === null || runnerDeltaPercent <= maxRunnerIncreasePercent);

  comparisons.push({
    workflow: before.workflow,
    eventName: before.eventName,
    lane: before.lane ?? after.lane ?? "Other",
    job: before.job,
    metric: before.metric,
    comparable,
    before: {
      successfulRuns: before.successfulRuns,
      medianMs: before.medianMs,
      p90Ms: before.p90Ms,
      runnerMinutesPerSuccessfulRun: before.runnerMinutesPerSuccessfulRun,
      cacheHitRate: before.cacheHitRate ?? null,
    },
    after: {
      successfulRuns: after.successfulRuns,
      medianMs: after.medianMs,
      p90Ms: after.p90Ms,
      runnerMinutesPerSuccessfulRun: after.runnerMinutesPerSuccessfulRun,
      cacheHitRate: after.cacheHitRate ?? null,
    },
    delta: {
      medianMs: change(before.medianMs, after.medianMs),
      medianPercent: medianDeltaPercent,
      p90Ms: change(before.p90Ms, after.p90Ms),
      p90Percent: p90DeltaPercent,
      runnerMinutesPercent: runnerDeltaPercent,
    },
    wallClockImprovementPercent,
    recommendation: !comparable ? "COLLECT_MORE" : adopted ? "ADOPT" : "DO_NOT_ADOPT",
  });
}

comparisons.sort((a, b) =>
  a.workflow.localeCompare(b.workflow) ||
  a.eventName.localeCompare(b.eventName) ||
  a.job.localeCompare(b.job) ||
  a.metric.localeCompare(b.metric)
);

const payload = {
  schemaVersion: 1,
  issue: 444,
  policy: { minImprovementPercent, maxRunnerIncreasePercent },
  comparableGroups: comparisons.filter((item) => item.comparable).length,
  adoptGroups: comparisons.filter((item) => item.recommendation === "ADOPT").length,
  comparisons,
};

if (output) writeFileSync(output, JSON.stringify(payload, null, 2) + "\n", "utf8");
if (summary) {
  const lines = [
    "",
    "## CI setup/cache before/after 비교 (#444)",
    "",
    `- 최소 wall-clock 개선: \`${minImprovementPercent}%\``,
    `- 허용 runner-minutes 증가: \`${maxRunnerIncreasePercent}%\``,
    "",
    "| lane | job | metric | runs before/after | median before→after | p90 before→after | runner min Δ | 판정 |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- |",
    ...comparisons.map((item) =>
      `| ${item.lane} | ${item.job} | ${item.metric} | ${item.before.successfulRuns}/${item.after.successfulRuns} | ${(item.before.medianMs / 1000).toFixed(2)}s→${(item.after.medianMs / 1000).toFixed(2)}s (${item.delta.medianPercent ?? "n/a"}%) | ${(item.before.p90Ms / 1000).toFixed(2)}s→${(item.after.p90Ms / 1000).toFixed(2)}s (${item.delta.p90Percent ?? "n/a"}%) | ${item.delta.runnerMinutesPercent ?? "n/a"}% | ${item.recommendation} |`
    ),
  ];
  appendFileSync(summary, lines.join("\n") + "\n", "utf8");
}
process.stdout.write(JSON.stringify(payload) + "\n");
