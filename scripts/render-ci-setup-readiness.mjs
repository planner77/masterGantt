import { readFileSync, writeFileSync } from "node:fs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const input = arg("input");
const output = arg("output");
const repository = arg("repository", process.env.GITHUB_REPOSITORY || "planner77/masterGantt");
const issue = Number(arg("issue", "444"));
const runId = arg("run-id", process.env.GITHUB_RUN_ID || "");
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";

if (!input || !output) {
  throw new Error("Usage: node scripts/render-ci-setup-readiness.mjs --input analysis.json --output comment.md [--issue 444]");
}
if (!Number.isInteger(issue) || issue <= 0) throw new Error("--issue must be a positive integer.");

const analysis = JSON.parse(readFileSync(input, "utf8"));
const minSamples = Number(analysis.minSamples || 10);
const lanes = ["PR", "Main", "Release"];

const laneRows = lanes.map((lane) => {
  const metrics = (analysis.metrics ?? []).filter((item) => item.lane === lane);
  const readyGroups = metrics.filter((item) => item.enoughSamples).length;
  const minimumRuns = metrics.length > 0
    ? Math.min(...metrics.map((item) => Number(item.successfulRuns || 0)))
    : 0;
  return {
    lane,
    groups: metrics.length,
    readyGroups,
    minimumRuns,
    ready: metrics.length > 0 && readyGroups === metrics.length,
  };
});

const blockers = (analysis.metrics ?? [])
  .filter((item) => lanes.includes(item.lane) && !item.enoughSamples)
  .sort((a, b) =>
    a.lane.localeCompare(b.lane) ||
    Number(a.successfulRuns || 0) - Number(b.successfulRuns || 0) ||
    a.job.localeCompare(b.job) ||
    a.metric.localeCompare(b.metric)
  );

const topCandidates = (analysis.candidates ?? []).slice(0, 10);
const status = analysis.phase2Ready ? "READY" : "COLLECTING";
const generatedAt = new Date().toISOString();
const runUrl = runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : "";

const lines = [
  "<!-- mastergantt-ci-setup-readiness:v1 -->",
  `## Issue #${issue} Phase 2 readiness — ${status}`,
  "",
  `자동 재평가 시각: \`${generatedAt}\``,
  runUrl ? `Readiness workflow: ${runUrl}` : "",
  "",
  "| lane | ready groups | 최소 distinct successful runs | 상태 |",
  "| --- | ---: | ---: | --- |",
  ...laneRows.map((item) =>
    `| ${item.lane} | ${item.readyGroups}/${item.groups} | ${item.minimumRuns}/${minSamples} | ${item.ready ? "READY" : "COLLECTING"} |`
  ),
  "",
];

if (analysis.phase2Ready) {
  lines.push(
    "모든 PR/Main/Release 비교 그룹이 Phase 2 최소 표본을 충족했습니다.",
    "**자동으로 cache 변경이나 PR을 만들지는 않습니다.** Issue #444에서 비용 상위 후보와 stale/security risk를 검토한 뒤 최적화를 명시적으로 재개해야 합니다.",
    "",
  );
} else {
  lines.push(
    "최소 표본이 충족되지 않아 신규 cache 최적화는 계속 보류합니다.",
    "",
    "### 표본 부족 그룹",
    "",
    "| lane | job | metric | distinct runs | 필요 |",
    "| --- | --- | --- | ---: | ---: |",
    ...blockers.slice(0, 30).map((item) =>
      `| ${item.lane} | ${item.job} | ${item.metric} | ${item.successfulRuns} | ${Math.max(0, minSamples - Number(item.successfulRuns || 0))} |`
    ),
    blockers.length > 30 ? `\n그 외 ${blockers.length - 30}개 그룹은 artifact의 analysis JSON에서 확인합니다.\n` : "",
  );
}

if (topCandidates.length > 0) {
  lines.push(
    "### 현재 비용 상위 후보",
    "",
    "| rank | lane | job | metric | median | p90 | runner min/run | cache hit |",
    "| ---: | --- | --- | --- | ---: | ---: | ---: | ---: |",
    ...topCandidates.map((item) =>
      `| ${item.rank} | ${item.lane} | ${item.job} | ${item.metric} | ${(Number(item.medianMs) / 1000).toFixed(2)}s | ${(Number(item.p90Ms) / 1000).toFixed(2)}s | ${Number(item.runnerMinutesPerSuccessfulRun).toFixed(3)} | ${item.cacheHitRate === null || item.cacheHitRate === undefined ? "n/a" : (Number(item.cacheHitRate) * 100).toFixed(1) + "%"} |`
    ),
    "",
  );
}

lines.push(
  "판정 기준: workflow/event/job/metric별 서로 다른 successful run ID ≥ " + minSamples + ". matrix shard와 rerun은 새 run 표본으로 계산하지 않습니다.",
  "successful workflow run의 setup-metric artifact만 입력으로 사용하며 cache hit은 required CI PASS 증거가 아닙니다.",
  "",
);

writeFileSync(output, lines.join("\n") + "\n", "utf8");
process.stdout.write(JSON.stringify({ status, issue, minSamples, lanes: laneRows, blockers: blockers.length }) + "\n");
