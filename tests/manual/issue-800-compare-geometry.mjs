#!/usr/bin/env node
/**
 * Issue #800: opt-in, fail-closed comparison of #798/#799 dashboard capture manifests.
 * Read-only input: same seeded fixture and actual per-viewport screenshot/DOM evidence.
 * No E2E discovery, CI gate, application mutation, or fabricated source attribution.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";

const [beforeArg, afterArg, outputArg] = process.argv.slice(2);
if (!beforeArg || !afterArg) {
  console.error("Usage: node tests/manual/issue-800-compare-geometry.mjs <before-dir> <after-dir> [output.json]");
  process.exit(2);
}
const beforeDir = resolve(beforeArg), afterDir = resolve(afterArg);
if (beforeDir === afterDir) throw new Error("Before and after must be separate capture directories");
const widths = [390, 768, 1024, 1440, 1920];
const kinds = ["kpi", "milestone", "process", "equipment", "system", "resource"];
const keys = widths.flatMap(width => kinds.map(kind => kind + "-" + width));
const sha256 = text => createHash("sha256").update(text).digest("hex");
const failures = [], results = [], nonComparables = [];
const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const check = (ok, reason) => { if (!ok) failures.push(reason); return ok; };
const stable = object => JSON.stringify(object, Object.keys(object ?? {}).sort());
const approx = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

async function source(dir) {
  const manifest = await readJson(join(dir, "dashboards-manifest.json"));
  check(manifest.schemaVersion === 2, dir + ": unsupported manifest schema");
  check(manifest.baselineComparable === true, dir + ": collection is not a comparable baseline");
  check(manifest.phase === "dashboards", dir + ": not a dashboard-phase capture");
  check(manifest.preservationPassed === true && manifest.faults?.length === 0,
    dir + ": incomplete/modified fixture or capture fault");
  check(manifest.plannedSamples === 30 && manifest.observations?.length === 30,
    dir + ": expected exactly 30 measured samples");
  check(/^[a-f0-9]{40}$/.test(manifest.sourceSha ?? ""), dir + ": missing checkout SHA");
  check(manifest.sourceHashes && Object.keys(manifest.sourceHashes).length > 0, dir + ": missing actual product source hashes");
  check(manifest.collectorHashAtStart === manifest.collectorHashAtEnd, dir + ": collector changed during capture");
  const observations = new Map();
  for (const entry of manifest.observations ?? []) {
    if (observations.has(entry.key)) failures.push(dir + ": duplicate sample " + entry.key);
    observations.set(entry.key, entry);
  }
  check(keys.every(key => observations.has(key)) && observations.size === keys.length,
    dir + ": sample keys differ from six perspectives × five widths");
  const captured = new Map();
  for (const key of keys) {
    if (!observations.has(key)) continue;
    const record = await readJson(join(dir, key + ".json"));
    const width = Number(key.split("-").at(-1)), kind = key.slice(0, key.lastIndexOf("-"));
    const primary = record.metrics?.primary, facts = record.facts;
    const env = facts?.environment;
    check(record.key === key, dir + ": record key mismatch " + key);
    check(record.captureRunId === manifest.captureRunId, dir + ": run identity mismatch " + key);
    check(record.collectorHashAtStart === manifest.collectorHashAtStart, dir + ": collector identity mismatch " + key);
    check(record.expectedViewport?.width === width && record.expectedViewport?.height === 900 &&
          facts?.viewport?.width === width && facts.viewport.height === 900,
      dir + ": actual viewport mismatch " + key);
    check(record.domAppVersion === "v" + manifest.appVersion, dir + ": DOM/runtime version mismatch " + key);
    check(primary?.kind === kind && primary?.valueCount > 0 && primary?.rowCount > 0,
      dir + ": missing populated primary state " + key);
    check(kind === "kpi" || primary?.ready === "true", dir + ": dashboard not ready " + key);
    check(facts?.document?.scrollWidth - facts?.document?.clientWidth <= 1,
      dir + ": document-owned horizontal overflow " + key);
    check(env?.locale === "ko-KR" && env.timezone === "Asia/Seoul" && env.dpr === 1 &&
          env.visualViewportScale === 1 && !!env.rootFont,
      dir + ": environment mismatch " + key);
    // Each archived PNG is checked against its actual dimensions, not the filename.
    const png = await readFile(join(dir, key + ".png"));
    check(png.subarray(1, 4).toString("ascii") === "PNG" && png.readUInt32BE(16) === width,
      dir + ": fullPage PNG width invalid " + key);
    if (width === 390 || width === 1440) {
      const viewportPng = await readFile(join(dir, key + "-viewport.png"));
      check(viewportPng.readUInt32BE(16) === width && viewportPng.readUInt32BE(20) === 900,
        dir + ": viewport PNG dimension invalid " + key);
    }
    captured.set(key, { record, primary, facts, env });
  }
  return { manifest, captured,
    productFingerprint: sha256(JSON.stringify(Object.entries(manifest.sourceHashes ?? {}).sort(([a], [b]) => a.localeCompare(b)))),
  };
}

const before = await source(beforeDir), after = await source(afterDir);
const a = before.manifest, b = after.manifest;
for (const field of ["appVersion", "installedNextVersion", "installedPlaywrightVersion"]) {
  check(a[field] === b[field], "Different runtime " + field + "; cross-version improvement is NOT COMPARABLE");
}
check(a.beforeSnapshot?.fingerprint && a.beforeSnapshot.fingerprint === b.beforeSnapshot?.fingerprint,
  "Different source fixture fingerprints; NOT COMPARABLE");
check(a.beforeSnapshot?.revision === b.beforeSnapshot?.revision,
  "Different canonical revisions; NOT COMPARABLE");
for (const path of [
  "tests/e2e/fixtures/target-project.ts", "tests/e2e/fixtures/wbs-view-composer.ts",
  "tests/e2e/helpers/ui-geometry.ts", "node_modules/next/package.json",
  "node_modules/@playwright/test/package.json",
]) {
  check(a.hashes?.[path] && a.hashes[path] === b.hashes?.[path],
    "Test/fixture/runtime hash changed: " + path + "; NOT COMPARABLE");
}
for (const key of keys) {
  const x = before.captured.get(key), y = after.captured.get(key);
  if (!x || !y) continue;
  const kind = key.slice(0, key.lastIndexOf("-"));
  const sameEnvironment = stable(x.env) === stable(y.env) &&
    x.record.browserVersion === y.record.browserVersion;
  check(sameEnvironment, "Browser context/locale/DPR mismatch " + key + "; NOT COMPARABLE");
  const xSummary = x.primary.firstSummary?.y, ySummary = y.primary.firstSummary?.y;
  const xTable = x.primary.table?.y, yTable = y.primary.table?.y;
  const rowInvariant = x.primary.rowCount === y.primary.rowCount;
  const metricInvariant = x.primary.valueCount === y.primary.valueCount &&
    JSON.stringify(x.primary.values?.map(value => value.text)) ===
    JSON.stringify(y.primary.values?.map(value => value.text));
  check(rowInvariant && metricInvariant, "Metric values/row count changed: " + key);
  // Empty or incomplete async read receipts are missing evidence, never equality.
  // Every dynamic perspective must report a populated response for its own root.
  const validReports = evidence => Array.isArray(evidence) && evidence.length > 0 &&
    evidence.every(report => report !== null && typeof report === "object" &&
      typeof report.snapshotId === "string" && report.snapshotId.length > 0 &&
      report.spec && typeof report.spec === "object" && report.spec.root === kind &&
      report.filters && typeof report.filters === "object" && !Array.isArray(report.filters) &&
      report.totals && typeof report.totals === "object" && !Array.isArray(report.totals) &&
      report.range && typeof report.range.from === "string" && typeof report.range.to === "string" &&
      typeof report.asOfDate === "string");
  const reportEvidence = kind === "kpi" ||
    (validReports(x.record.reports) && validReports(y.record.reports));
  check(reportEvidence, "Missing populated read-only report receipt for " + key);
  const sameReports = kind === "kpi" ||
    (reportEvidence && JSON.stringify(x.record.reports) === JSON.stringify(y.record.reports));
  check(sameReports, "Read-only snapshot/spec/filter/totals changed or missing: " + key);
  const overflowFree = [x, y].every(o => o.facts.document.scrollWidth - o.facts.document.clientWidth <= 1);
  const noRegress = Number.isFinite(xSummary) && Number.isFinite(ySummary) &&
    Number.isFinite(xTable) && Number.isFinite(yTable) &&
    ySummary <= xSummary + 1 && yTable <= xTable + 1 &&
    y.primary.fullyVisibleValues >= x.primary.fullyVisibleValues &&
    y.primary.fullyVisibleRows >= x.primary.fullyVisibleRows;
  const kpiKeep = kind !== "kpi" ||
    (approx(xSummary, ySummary) && approx(xTable, yTable) &&
     x.primary.fullyVisibleValues === y.primary.fullyVisibleValues &&
     x.primary.fullyVisibleRows === y.primary.fullyVisibleRows);
  check(overflowFree && noRegress && kpiKeep, "First-data/visible-workspace/KPI KEEP regression " + key);
  const delta = { summaryY: Number.isFinite(xSummary) ? +(ySummary - xSummary).toFixed(2) : null,
    tableY: Number.isFinite(xTable) ? +(yTable - xTable).toFixed(2) : null,
    visibleMetrics: y.primary.fullyVisibleValues - x.primary.fullyVisibleValues,
    visibleRows: y.primary.fullyVisibleRows - x.primary.fullyVisibleRows };
  results.push({ key, status: sameEnvironment && rowInvariant && metricInvariant && reportEvidence && sameReports && overflowFree && noRegress && kpiKeep ?
    kind === "kpi" ? "KEEP" : "PASS_GEOMETRY" : "FAIL_OR_NOT_COMPARABLE", delta });
}
const report = {
  schema: "issue-800:historical-capture-comparison:v1",
  status: failures.length ? "FAIL_OR_NOT_COMPARABLE" : "PASS_LOCAL_CAPTURE_COMPARISON",
  sourceAttribution: {
    beforeCheckoutSha: a.sourceSha, afterCheckoutSha: b.sourceSha,
    beforeActualProductFingerprint: before.productFingerprint,
    afterActualProductFingerprint: after.productFingerprint,
    note: "Checkout SHA alone does not identify an uncommitted CSS/TSX capture; actual source file hashes are mandatory.",
  },
  fixtureFingerprint: a.beforeSnapshot?.fingerprint ?? null,
  appVersion: a.appVersion, beforeRun: a.captureRunId, afterRun: b.captureRunId,
  count: results.length, results, failures, nonComparables,
  notTested: ["native 125% / real device / screen reader (#517)", "production/remote CI",
    "cross-source comparison without matching fixture/runtime/provenance",
    "normal/error/stale/readonly/disabled × all widths"],
};
if (outputArg) {
  const target = resolve(outputArg);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
