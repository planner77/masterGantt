import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function key(metric) {
  return JSON.stringify([metric.workflow, metric.eventName, metric.job, metric.metric]);
}
function pct(before, after) {
  if (!Number.isFinite(before) || before <= 0 || !Number.isFinite(after)) return null;
  return Number((((after - before) / before) * 100).toFixed(2));
}
function change(before, after) {
  return Number.isFinite(before) && Number.isFinite(after) ? Math.round(after - before) : null;
}
function indexMetrics(metrics, label) {
  if (!Array.isArray(metrics)) throw new Error(`${label}.metrics must be an array`);
  const result = new Map();
  for (const metric of metrics) {
    if (!metric || [metric.workflow, metric.eventName, metric.job, metric.metric].some((value) => typeof value !== "string" || !value)) {
      throw new Error(`${label}.metrics contains an invalid workload key`);
    }
    const metricKey = key(metric);
    if (result.has(metricKey)) throw new Error(`${label}.metrics contains duplicate workload key: ${metricKey}`);
    result.set(metricKey, metric);
  }
  return result;
}
function statisticsValid(metric) {
  return metric && Number.isInteger(metric.successfulRuns) && metric.successfulRuns >= 0 &&
    Number.isFinite(metric.medianMs) && metric.medianMs > 0 &&
    Number.isFinite(metric.p90Ms) && metric.p90Ms >= metric.medianMs &&
    Number.isFinite(metric.runnerMinutesPerSuccessfulRun) && metric.runnerMinutesPerSuccessfulRun > 0;
}

const baselinePath = arg("baseline");
const currentPath = arg("current");
const output = arg("output");
const summary = arg("summary", process.env.GITHUB_STEP_SUMMARY || "");
const minImprovementPercent = Number(arg("min-improvement-percent", "5"));
const maxRunnerIncreasePercent = Number(arg("max-runner-increase-percent", "0"));
const minSamples = Number(arg("min-samples", "10"));
const scope = {
  workflow: arg("scope-workflow"), eventName: arg("scope-event"), metric: arg("scope-metric"),
  beforeJob: arg("before-job"), afterJob: arg("after-job"),
};
const renameEvidence = arg("rename-evidence");
const scopeValues = Object.values(scope);
const focused = scopeValues.some(Boolean);

if (!baselinePath || !currentPath) {
  throw new Error("Usage: node scripts/compare-ci-setup-metrics.mjs --baseline BASE.json --current CURRENT.json [--scope-workflow PATH --scope-event EVENT --scope-metric METRIC --before-job JOB --after-job JOB --rename-evidence URL]");
}
if (!Number.isFinite(minImprovementPercent) || minImprovementPercent < 0) throw new Error("--min-improvement-percent must be >= 0");
if (!Number.isFinite(maxRunnerIncreasePercent)) throw new Error("--max-runner-increase-percent must be a number");
if (!Number.isInteger(minSamples) || minSamples < 10) throw new Error("--min-samples must be an integer >= 10");
if (focused && !scopeValues.every(Boolean)) throw new Error("Focused comparison requires all five scope flags");
const renamedJob = focused && scope.beforeJob !== scope.afterJob;
if (renamedJob && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:pull|commit)\/\d+(?:[\w/#.-]*)?$/.test(renameEvidence)) {
  throw new Error("A job rename requires --rename-evidence with a GitHub PR/commit URL (manual workload review remains required)");
}
if (renameEvidence && !renamedJob) throw new Error("--rename-evidence applies only to a focused changed-job comparison");

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const current = JSON.parse(readFileSync(currentPath, "utf8"));
const trustedSources = !focused || [baseline, current].every((payload) =>
  payload?.schemaVersion === 2 && payload?.phase2Issue === 444 && payload?.requireBoundProvenance === true && payload?.minSamples >= 10);
const scopedMetrics = (metrics, job) => !focused ? metrics : (metrics ?? [])
  .filter((m) => m.workflow === scope.workflow && m.eventName === scope.eventName && m.metric === scope.metric && m.job === job)
  .map((m) => ({ ...m, job: scope.beforeJob }));
const baselineMetrics = indexMetrics(scopedMetrics(baseline.metrics, scope.beforeJob), "baseline");
const currentMetrics = indexMetrics(scopedMetrics(current.metrics, scope.afterJob), "current");

const baselineKeys = new Set(baselineMetrics.keys());
const currentKeys = new Set(currentMetrics.keys());
const allKeys = [...new Set([...baselineKeys, ...currentKeys])].sort();
const workloadKeysMatch = baselineKeys.size > 0 && baselineKeys.size === currentKeys.size &&
  [...baselineKeys].every((metricKey) => currentKeys.has(metricKey));
const workloadComparable = workloadKeysMatch && !renamedJob && trustedSources;

const emptyMetric = {
  successfulRuns: 0,
  medianMs: null,
  p90Ms: null,
  runnerMinutesPerSuccessfulRun: null,
  cacheHitRate: null,
};

const comparisons = [];
for (const metricKey of allKeys) {
  const before = baselineMetrics.get(metricKey);
  const after = currentMetrics.get(metricKey);
  const exemplar = before ?? after;
  const presentBoth = Boolean(before && after);
  const enoughSamples = Boolean(before?.enoughSamples && after?.enoughSamples &&
    before.successfulRuns >= minSamples && after.successfulRuns >= minSamples);
  const validStatistics = Boolean(statisticsValid(before) && statisticsValid(after));
  const numericComparable = workloadKeysMatch && presentBoth && enoughSamples && validStatistics && trustedSources;
  const comparable = numericComparable && !renamedJob;

  const medianDeltaPercent = presentBoth ? pct(before.medianMs, after.medianMs) : null;
  const p90DeltaPercent = presentBoth ? pct(before.p90Ms, after.p90Ms) : null;
  const runnerDeltaPercent = presentBoth
    ? pct(before.runnerMinutesPerSuccessfulRun, after.runnerMinutesPerSuccessfulRun)
    : null;
  const wallClockImprovementPercent =
    medianDeltaPercent === null ? null : Number((-medianDeltaPercent).toFixed(2));
  const policyThresholdMet = numericComparable && wallClockImprovementPercent !== null &&
    wallClockImprovementPercent >= minImprovementPercent &&
    runnerDeltaPercent !== null && runnerDeltaPercent <= maxRunnerIncreasePercent;
  const adopted = comparable && policyThresholdMet;

  const recommendation = !workloadKeysMatch ? "WORKLOAD_MISMATCH"
    : !trustedSources ? "PROVENANCE_REQUIRED"
    : !enoughSamples ? "COLLECT_MORE"
    : !validStatistics || medianDeltaPercent === null || runnerDeltaPercent === null ? "INVALID_METRICS"
    : renamedJob ? "REVIEW_REQUIRED"
    : adopted ? "ADOPT" : "DO_NOT_ADOPT";

  comparisons.push({
    workflow: exemplar.workflow,
    eventName: exemplar.eventName,
    lane: exemplar.lane ?? "Other",
    job: exemplar.job,
    ...(focused ? { beforeJob: scope.beforeJob, afterJob: scope.afterJob } : {}),
    metric: exemplar.metric,
    presentBefore: Boolean(before),
    presentAfter: Boolean(after),
    numericComparable, comparable, policyThresholdMet, validStatistics,
    before: before ? {
      successfulRuns: before.successfulRuns,
      medianMs: before.medianMs,
      p90Ms: before.p90Ms,
      runnerMinutesPerSuccessfulRun: before.runnerMinutesPerSuccessfulRun,
      cacheHitRate: before.cacheHitRate ?? null,
    } : emptyMetric,
    after: after ? {
      successfulRuns: after.successfulRuns,
      medianMs: after.medianMs,
      p90Ms: after.p90Ms,
      runnerMinutesPerSuccessfulRun: after.runnerMinutesPerSuccessfulRun,
      cacheHitRate: after.cacheHitRate ?? null,
    } : emptyMetric,
    delta: {
      medianMs: presentBoth ? change(before.medianMs, after.medianMs) : null,
      medianPercent: medianDeltaPercent,
      p90Ms: presentBoth ? change(before.p90Ms, after.p90Ms) : null,
      p90Percent: p90DeltaPercent,
      runnerMinutesPercent: runnerDeltaPercent,
    },
    wallClockImprovementPercent,
    recommendation,
  });
}

comparisons.sort((a, b) =>
  a.workflow.localeCompare(b.workflow) ||
  a.eventName.localeCompare(b.eventName) ||
  a.job.localeCompare(b.job) ||
  a.metric.localeCompare(b.metric)
);

const payload = {
  schemaVersion: 2,
  issue: 444,
  policy: { minImprovementPercent, maxRunnerIncreasePercent, minSamples },
  focused, ...(focused ? { scope, renamedJob, renameEvidence: renameEvidence || null, trustedSources } : {}),
  workloadKeysMatch, workloadComparable,
  baselineMetricGroups: baselineKeys.size,
  currentMetricGroups: currentKeys.size,
  comparableGroups: comparisons.filter((item) => item.comparable).length,
  reviewRequiredGroups: comparisons.filter((item) => item.recommendation === "REVIEW_REQUIRED").length,
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
    `- 최소 양쪽 distinct successful run: \`${minSamples}\``,
    `- workload metric 집합 일치: \`${workloadKeysMatch}\` (before=${baselineKeys.size}, after=${currentKeys.size})`,
    ...(focused ? [
      `- 명시적 scope: \`${scope.workflow}/${scope.eventName}/${scope.metric}\` (before job=\`${scope.beforeJob}\`, after job=\`${scope.afterJob}\`)`,
      `- provenance-bound 입력: \`${trustedSources}\``,
      `- job rename: \`${renamedJob}\` (evidence: ${renameEvidence || "n/a"}); 이름 변경만으로 workload 동등성을 증명할 수 없어 ADOPT는 REVIEW_REQUIRED`,
    ] : []),
    "",
    "| lane | job | metric | runs before/after | median before→after | p90 before→after | runner min Δ | 판정 |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- |",
    ...comparisons.map((item) =>
      `| ${item.lane} | ${item.beforeJob && item.beforeJob !== item.afterJob ? `${item.beforeJob}→${item.afterJob}` : item.job} | ${item.metric} | ${item.before.successfulRuns}/${item.after.successfulRuns} | ${item.before.medianMs === null || item.after.medianMs === null ? "n/a" : (item.before.medianMs / 1000).toFixed(2) + "s→" + (item.after.medianMs / 1000).toFixed(2) + "s (" + (item.delta.medianPercent ?? "n/a") + "%)"} | ${item.before.p90Ms === null || item.after.p90Ms === null ? "n/a" : (item.before.p90Ms / 1000).toFixed(2) + "s→" + (item.after.p90Ms / 1000).toFixed(2) + "s (" + (item.delta.p90Percent ?? "n/a") + "%)"} | ${item.delta.runnerMinutesPercent ?? "n/a"}% | ${item.recommendation} |`
    ),
  ];
  appendFileSync(summary, lines.join("\n") + "\n", "utf8");
}
process.stdout.write(JSON.stringify(payload) + "\n");
