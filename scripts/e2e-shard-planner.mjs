#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SPEC_RE = /\.(?:spec|test)\.(?:[cm]?[jt]sx?)$/i;

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function listSpecFiles(rootDir = "tests/e2e") {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && SPEC_RE.test(entry.name)) {
        out.push(full.split(path.sep).join("/"));
      }
    }
  };
  walk(rootDir);
  return out.sort();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walkJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

export function loadHistory(historyDir) {
  const byRun = new Map();
  for (const file of walkJson(historyDir)) {
    let report;
    try {
      report = readJson(file);
    } catch {
      continue;
    }
    if (report?.schemaVersion !== 1 || report?.status !== "passed" || !report?.runId) continue;
    const runId = String(report.runId);
    const run = byRun.get(runId) ?? { files: new Map(), shards: new Map(), headSha: report.headSha || "" };
    const shard = Number(report.shard || 0);
    let shardMs = run.shards.get(shard) ?? 0;
    for (const entry of Array.isArray(report.entries) ? report.entries : []) {
      if (!entry?.file || !Number.isFinite(Number(entry.durationMs))) continue;
      const normalized = String(entry.file).split(path.sep).join("/");
      const durationMs = Math.max(0, Number(entry.durationMs));
      run.files.set(normalized, (run.files.get(normalized) ?? 0) + durationMs);
      shardMs += durationMs;
    }
    run.shards.set(shard, shardMs);
    byRun.set(runId, run);
  }
  return byRun;
}

export function lptPlan(weights, shardCount) {
  const bins = Array.from({ length: shardCount }, (_, index) => ({
    shard: index + 1,
    totalMs: 0,
    files: [],
  }));
  const ordered = [...weights.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [file, durationMs] of ordered) {
    bins.sort((a, b) => a.totalMs - b.totalMs || a.shard - b.shard);
    bins[0].files.push(file);
    bins[0].totalMs += durationMs;
  }
  return bins.sort((a, b) => a.shard - b.shard);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function selectShardFiles({ plan, currentFiles, shard, total }) {
  if (!plan || plan.schemaVersion !== 1 || plan.shardCount !== total || !Array.isArray(plan.shards)) {
    return null;
  }
  const current = new Set(currentFiles);
  const assigned = new Map();
  for (const group of plan.shards) {
    if (!Number.isInteger(group?.shard) || !Array.isArray(group.files)) continue;
    for (const file of group.files) {
      if (current.has(file) && !assigned.has(file)) assigned.set(file, group.shard);
    }
  }
  for (const file of currentFiles) {
    if (!assigned.has(file)) assigned.set(file, (stableHash(file) % total) + 1);
  }
  return currentFiles.filter((file) => assigned.get(file) === shard);
}

export function analyzeHistory({
  historyDir,
  shardCount = 6,
  minRuns = 10,
  recentWindow = 5,
  imbalanceThreshold = 1.35,
  minBreaches = 3,
  minImprovementRatio = 0.15,
  minImprovementMs = 120000,
  cooldownDays = 7,
  currentPlanPath = "tests/config/e2e-shard-plan.json",
  now = new Date(),
}) {
  const currentFiles = listSpecFiles();
  const history = loadHistory(historyDir);
  const runs = [...history.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  const samples = new Map(currentFiles.map((file) => [file, []]));

  for (const [, run] of runs) {
    for (const file of currentFiles) {
      const value = run.files.get(file);
      if (Number.isFinite(value)) samples.get(file).push(value);
    }
  }

  const sampledValues = [...samples.values()].flat();
  const globalFallback = sampledValues.length ? median(sampledValues) : 60000;
  const weights = new Map();
  let filesWithSamples = 0;
  for (const file of currentFiles) {
    const values = samples.get(file) ?? [];
    if (values.length) filesWithSamples += 1;
    weights.set(file, values.length ? median(values) : globalFallback);
  }

  const recent = runs.slice(-recentWindow);
  const recentImbalances = recent.map(([, run]) => {
    const values = [...run.shards.entries()]
      .filter(([key]) => key > 0)
      .sort((a, b) => a[0] - b[0])
      .map(([, value]) => value);
    if (!values.length) return 0;
    const med = median(values);
    return med > 0 ? Math.max(...values) / med : 0;
  });
  const breachCount = recentImbalances.filter((value) => value > imbalanceThreshold).length;
  const recentCritical = recent
    .map(([, run]) => Math.max(0, ...[...run.shards.values()]))
    .filter((value) => value > 0);
  const baselineCriticalMs = median(recentCritical);

  const proposedBins = lptPlan(weights, shardCount);
  const proposedCriticalMs = Math.max(0, ...proposedBins.map((bin) => bin.totalMs));
  const improvementMs = Math.max(0, baselineCriticalMs - proposedCriticalMs);
  const improvementRatio = baselineCriticalMs > 0 ? improvementMs / baselineCriticalMs : 0;
  const coverage = currentFiles.length ? filesWithSamples / currentFiles.length : 0;

  let cooldownOk = true;
  let currentPlan = null;
  if (fs.existsSync(currentPlanPath)) {
    try {
      currentPlan = readJson(currentPlanPath);
      if (currentPlan?.generatedAt) {
        const elapsed = now.getTime() - Date.parse(currentPlan.generatedAt);
        cooldownOk = elapsed >= cooldownDays * 86400000;
      }
    } catch {
      cooldownOk = true;
    }
  }

  const enoughRuns = runs.length >= minRuns;
  const enoughCoverage = coverage >= 0.8;
  const imbalanced = breachCount >= Math.min(minBreaches, recent.length || minBreaches);
  const worthwhile = improvementRatio >= minImprovementRatio || improvementMs >= minImprovementMs;
  const shouldUpdate = Boolean(enoughRuns && enoughCoverage && imbalanced && worthwhile && cooldownOk);

  const candidateShardCounts = [];
  const totalTestMs = [...weights.values()].reduce((sum, value) => sum + value, 0);
  for (let count = 4; count <= 8; count += 1) {
    const bins = lptPlan(weights, count);
    const criticalMs = Math.max(0, ...bins.map((bin) => bin.totalMs));
    const setupOverheadMs = 60000;
    candidateShardCounts.push({
      shardCount: count,
      projectedCriticalMs: criticalMs + setupOverheadMs,
      projectedRunnerMinutes: (totalTestMs + setupOverheadMs * count) / 60000,
    });
  }

  const plan = {
    schemaVersion: 1,
    issue: 437,
    shardCount,
    generatedAt: now.toISOString(),
    estimator: "median",
    sourceRunIds: runs.slice(-20).map(([runId]) => runId),
    metrics: {
      runCount: runs.length,
      fileCoverage: coverage,
      recentImbalanceRatios: recentImbalances,
      imbalanceThreshold,
      breachCount,
      baselineCriticalMs,
      projectedCriticalMs: proposedCriticalMs,
      improvementMs,
      improvementRatio,
    },
    shards: proposedBins.map((bin) => ({
      shard: bin.shard,
      projectedMs: Math.round(bin.totalMs),
      files: [...bin.files].sort(),
    })),
  };

  return {
    shouldUpdate,
    reason: {
      enoughRuns,
      enoughCoverage,
      imbalanced,
      worthwhile,
      cooldownOk,
    },
    plan,
    candidateShardCounts,
  };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function writeSummary(result, file) {
  const m = result.plan.metrics;
  const lines = [
    "## E2E shard optimizer",
    "",
    `- historical successful runs: \`${m.runCount}\``,
    `- file timing coverage: \`${(m.fileCoverage * 100).toFixed(1)}%\``,
    `- recent imbalance ratios: \`${m.recentImbalanceRatios.map((v) => v.toFixed(2)).join(" / ") || "N/A"}\``,
    `- baseline critical test time: \`${(m.baselineCriticalMs / 60000).toFixed(2)}m\``,
    `- proposed critical test time: \`${(m.projectedCriticalMs / 60000).toFixed(2)}m\``,
    `- projected improvement: \`${(m.improvementRatio * 100).toFixed(1)}%\` / \`${(m.improvementMs / 60000).toFixed(2)}m\``,
    `- plan update: **${result.shouldUpdate ? "recommended" : "not recommended"}**`,
    "",
    "| shard candidate | projected critical | projected runner-minutes |",
    "| ---: | ---: | ---: |",
    ...result.candidateShardCounts.map((item) =>
      `| ${item.shardCount} | ${(item.projectedCriticalMs / 60000).toFixed(2)}m | ${item.projectedRunnerMinutes.toFixed(1)} |`
    ),
  ];
  fs.appendFileSync(file, lines.join("\n") + "\n", "utf8");
}

const args = parseArgs(process.argv.slice(2));
if (args.command === "select") {
  const shard = Number(args.shard);
  const total = Number(args.total);
  let plan = null;
  if (args.plan && fs.existsSync(args.plan)) {
    try {
      plan = readJson(args.plan);
    } catch {
      plan = null;
    }
  }
  const files = selectShardFiles({ plan, currentFiles: listSpecFiles(), shard, total });
  if (files === null) process.exit(2);
  for (const file of files) process.stdout.write(file + "\n");
} else if (args.command === "analyze") {
  const result = analyzeHistory({
    historyDir: args.history || ".e2e-history",
    shardCount: Number(args.shards || 6),
    minRuns: Number(args["min-runs"] || 10),
    currentPlanPath: args["current-plan"] || "tests/config/e2e-shard-plan.json",
  });
  const output = args.output || ".e2e-shard-proposal.json";
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", "utf8");
  if (args.summary) writeSummary(result, args.summary);
  process.stdout.write(JSON.stringify({ shouldUpdate: result.shouldUpdate, output }) + "\n");
} else if (import.meta.url === `file://${process.argv[1]}`) {
  console.error("usage: e2e-shard-planner.mjs select|analyze [options]");
  process.exit(2);
}
