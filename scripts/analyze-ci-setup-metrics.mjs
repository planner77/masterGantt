import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p90(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.9) - 1)];
}

const input = arg("input", ".ci-setup-metrics");
const minSamples = Number(arg("min-samples", "10"));
const output = arg("output", "");
const summary = arg("summary", process.env.GITHUB_STEP_SUMMARY || "");

const records = [];
for (const file of walk(input)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (value?.schemaVersion === 1 && value?.issue === 439 && Number.isFinite(Number(value.durationMs))) {
        records.push(value);
      }
    } catch {
      // Ignore malformed historical metric files instead of breaking current CI.
    }
  }
}

const groups = new Map();
for (const record of records) {
  const key = `${record.eventName || "unknown"}::${record.metric}`;
  const group = groups.get(key) ?? {
    eventName: record.eventName || "unknown",
    metric: record.metric,
    durations: [],
    cache: new Map(),
  };
  group.durations.push(Number(record.durationMs));
  const cache = String(record.cache || "n/a");
  group.cache.set(cache, (group.cache.get(cache) ?? 0) + 1);
  groups.set(key, group);
}

const result = [...groups.values()]
  .map((group) => ({
    eventName: group.eventName,
    metric: group.metric,
    samples: group.durations.length,
    enoughSamples: group.durations.length >= minSamples,
    medianMs: Math.round(median(group.durations)),
    p90Ms: Math.round(p90(group.durations)),
    cache: Object.fromEntries([...group.cache.entries()].sort(([a], [b]) => a.localeCompare(b))),
  }))
  .sort((a, b) => a.eventName.localeCompare(b.eventName) || a.metric.localeCompare(b.metric));

const payload = {
  schemaVersion: 1,
  issue: 439,
  minSamples,
  records: records.length,
  metrics: result,
};

if (output) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(output, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

if (summary) {
  const { appendFileSync } = await import("node:fs");
  const lines = [
    "",
    "## CI setup/cache baseline 분석 (#439)",
    "",
    `- 최소 표본: \`${minSamples}\``,
    `- 수집 record: \`${records.length}\``,
    "",
    "| event | metric | samples | median | p90 | cache |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...result.map((item) =>
      `| ${item.eventName} | ${item.metric} | ${item.samples}${item.enoughSamples ? "" : " ⚠"} | ${(item.medianMs / 1000).toFixed(2)}s | ${(item.p90Ms / 1000).toFixed(2)}s | ${Object.entries(item.cache).map(([k, v]) => `${k}=${v}`).join(", ") || "n/a"} |`
    ),
  ];
  appendFileSync(summary, lines.join("\n") + "\n", "utf8");
}

process.stdout.write(JSON.stringify(payload) + "\n");
