#!/usr/bin/env node
/* Issue #751: warning-only. Artifact sources are untrusted until provenance review. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";

function nearestRank(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}
const valid = v => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function summarize(payloads, minimumSamples = 10) {
  const groups = new Map(), slow = [], requestStats = new Map(), serverStats = new Map();
  let invalid = 0, recorded = 0, discarded = 0;
  for (const p of payloads) {
    if (p?.schemaVersion !== 1 || !Array.isArray(p.receipts) || !p.environment) {
      invalid++;
      continue;
    }
    for (const r of p.receipts) {
      if (r?.schemaVersion !== 2 || !r.source || !Array.isArray(r.stages) ||
          !Array.isArray(r.requests)) { invalid++; continue; }
      recorded++;
      discarded += r.discardedRequests || 0;
      for (const entry of r.requests) {
        const label = typeof entry.route === "string" ? entry.route : "other-api";
        const prev = requestStats.get(label) || { calls: 0, failed: 0, cancelled: 0 };
        prev.calls++;
        if (entry.outcome === "abort") prev.cancelled++;
        else if (!["complete", "http_error"].includes(entry.outcome)) prev.failed++;
        requestStats.set(label, prev);
      }
      if (r.serverEventsDiscarded === 0 && Array.isArray(r.serverRequests)) {
        for (const sr of r.serverRequests) {
          if (!sr || typeof sr.route !== "string") continue;
          const route = /^(process-context|assignment-targets|task-logistics-links|resource-dashboard|target-bindings|other-api)$/.test(sr.route) ? sr.route : "other-api";
          const previous = serverStats.get(route) || { observed: 0, serverMs: 0, sqlCalls: 0, sqlMs: 0 };
          previous.observed++;
          if (valid(sr.serverMs)) previous.serverMs += sr.serverMs;
          if (valid(sr.sqlStatementCount)) previous.sqlCalls += sr.sqlStatementCount;
          if (valid(sr.sqlExecutionMs)) previous.sqlMs += sr.sqlExecutionMs;
          serverStats.set(route, previous);
        }
      }
      if (r.resultStatus !== "passed" || r.status !== "ok" || r.source.retry !== 0) continue;
      for (const stage of r.stages) {
        if (!valid(stage.durationMs) || stage.outcome !== "ok" || typeof stage.stage !== "string") continue;
        const key = [p.environment.os, p.environment.node, p.environment.fullyParallel,
          p.shard, p.shardCount, r.source.project, r.source.testId, stage.stage].join("|");
        const group = groups.get(key) || { stage: stage.stage, durations: [], budgetMs: stage.stage === "fixture_setup" ? 120000 : r.timeoutBudgets?.testMs };
        group.durations.push(stage.durationMs);
        groups.set(key, group);
        slow.push({ stage: stage.stage, durationMs: stage.durationMs,
          testId: r.source.testId, sourceRun: p.runId, attempt: p.runAttempt,
          status: stage.durationMs >= (group.budgetMs || Infinity) * .8 ? "PROVISIONAL_WARNING" : "OBSERVED" });
      }
    }
  }
  const rows = [...groups.values()].map(g => {
    const sufficient = g.durations.length >= minimumSamples;
    const p50 = sufficient ? nearestRank(g.durations, .5) : null;
    const p95 = sufficient ? nearestRank(g.durations, .95) : null;
    return { stage: g.stage, count: g.durations.length, p50, p95,
      verdict: !sufficient ? "INSUFFICIENT_DATA" :
        valid(g.budgetMs) && p95 >= .8 * g.budgetMs ? "WARNING_PROVISIONAL_80_PERCENT" : "OBSERVED" };
  });
  return {
    schemaVersion: 2, warningOnly: true, minimumSamples, invalidReceipts: invalid,
    recordedReceipts: recorded, discardedBrowserRequests: discarded, rows,
    slowest: slow.sort((a, b) => b.durationMs - a.durationMs).slice(0, 8),
    requests: [...requestStats.entries()].map(([route, counts]) => ({ route, ...counts })),
    server: [...serverStats.entries()].map(([route, observation]) => ({
      route, ...observation,
      sqlShare: observation.serverMs > 0 ? Math.round(observation.sqlMs / observation.serverMs * 10000) / 100 : null,
      candidate: observation.serverMs > 0 && observation.sqlMs / observation.serverMs >= 0.5
        ? "SQL_SHARE_HIGH_CANDIDATE" : "NON_SQL_SERVER_OR_COMPILE_CANDIDATE",
    })),
  };
}
function main() {
  const paths = process.argv.slice(2);
  const inputs = paths.map(path => {
    try {
      const p = JSON.parse(readFileSync(path, "utf8"));
      return p;
    } catch { return {}; }
  });
  const result = summarize(inputs);
  process.stdout.write("## Issue #751 E2E performance — warning only\n\n");
  process.stdout.write("- Sources: " + paths.length + "; receipts: " + result.recordedReceipts +
    "; invalid: " + result.invalidReceipts + "; dropped: " + result.discardedBrowserRequests + "\n");
  const first = inputs.find(p => p?.schemaVersion === 1);
  const repo = process.env.GITHUB_REPOSITORY || "";
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) && /^\d+$/.test(first?.runId || "")) {
    process.stdout.write("- [GitHub Actions source / 30-day timing artifacts](https://github.com/" +
      repo + "/actions/runs/" + first.runId + ") · Run/attempt " + first.runId + "/" + first.runAttempt + "\n");
  }
  process.stdout.write("- Same OS, Node, shard, parallelism and test ID; at least 10 success samples per group\n");
  for (const row of result.rows.slice(0, 10))
    process.stdout.write("- " + row.stage + ": n=" + row.count + " P50=" + (row.p50 ?? "N/A") +
      "ms P95=" + (row.p95 ?? "N/A") + "ms " + row.verdict + "\n");
  for (const item of result.slowest)
    process.stdout.write("- Slow observed " + item.stage + ": " + item.durationMs +
      "ms (" + item.status + "; diagnostic, not proven cause)\n");
  for (const item of result.requests.slice(0, 8))
    process.stdout.write("- HTTP " + item.route + ": " + item.calls +
      " recorded, failed=" + item.failed + ", cancelled=" + item.cancelled + "\n");
  for (const item of result.server.slice(0, 8))
    process.stdout.write("- Server " + item.route + ": requests=" + item.observed +
      ", server total=" + Math.round(item.serverMs) + "ms, SQL calls=" + item.sqlCalls +
      ", SQL total=" + Math.round(item.sqlMs) + "ms, SQL share=" +
      (item.sqlShare ?? "N/A") + "% (" + item.candidate + "; not proven causality)\n");
  if (!result.rows.length) process.stdout.write("- INSUFFICIENT_DATA\n");
  process.stdout.write("- SQL, lazy compilation and fan-out are causal candidates, not conclusions; no gating changes\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
