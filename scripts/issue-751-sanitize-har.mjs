#!/usr/bin/env node
/* Issue #751. Local-only HAR conversion: no URLs, cookies, IDs or bodies in output. */
import { readFileSync, writeFileSync, statSync } from "node:fs";
const argv = process.argv.slice(2);
const param = name => { const pos = argv.indexOf(name); return pos < 0 ? "" : argv[pos + 1] ?? ""; };
const input = param("--input"), output = param("--output");
if (!input || !output || input === output) {
  console.error("Usage: node scripts/issue-751-sanitize-har.mjs --input local.har --output sanitized.json");
  process.exit(2);
}
if (statSync(input).size > 50 * 1024 * 1024) {
  console.error("HAR maximum input size exceeded"); process.exit(2);
}
const data = JSON.parse(readFileSync(input, "utf8"));
if (!Array.isArray(data?.log?.entries)) {
  console.error("Invalid HAR format"); process.exit(2);
}
function classify(raw) {
  try {
    const pathname = new URL(raw).pathname;
    if (!pathname.startsWith("/api/")) return null;
    if (pathname.endsWith("/logistics/process-context")) return "process-context";
    if (pathname.endsWith("/assignment-targets")) return "assignment-targets";
    if (/\/tasks\/[^/]+\/logistics-links$/.test(pathname)) return "task-logistics-links";
    if (/\/resource-dashboard(?:\/details)?$/.test(pathname)) return "resource-dashboard";
    if (pathname.endsWith("/target-bindings")) return "target-bindings";
    return "other-api";
  } catch { return null; }
}
const allowMethod = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
const observed = []; let rejected = 0;
for (const event of data.log.entries) {
  const category = classify(event?.request?.url);
  if (!category) continue;
  if (observed.length >= 2048) { rejected++; continue; }
  const started = Date.parse(event.startedDateTime);
  const duration = event.time, status = event?.response?.status;
  if (!Number.isFinite(started) || !Number.isFinite(duration) || duration < 0) { rejected++; continue; }
  observed.push({
    route: category, method: allowMethod.test(event.request.method) ? event.request.method : "OTHER",
    startEpochMs: started, durationMs: Math.round(duration * 100) / 100,
    status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    outcome: status === 0 || status === -1 || !Number.isInteger(status)
      ? "incomplete" : status >= 400 ? "http_error" : "complete",
  });
}
const earliest = observed.length ? Math.min(...observed.map(x => x.startEpochMs)) : 0;
const report = {
  schemaVersion: 1, source: "EXTERNAL_HAR_UNVERIFIED", truncatedEvents: rejected,
  events: observed.map(x => ({
    route: x.route, method: x.method, startMs: x.startEpochMs - earliest,
    durationMs: x.durationMs, status: x.status, outcome: x.outcome,
  })),
};
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", "utf8");
