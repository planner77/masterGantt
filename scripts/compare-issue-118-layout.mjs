import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [beforePath, afterPath, outputArg] = process.argv.slice(2);
if (!beforePath || !afterPath || !outputArg) {
  console.error("Usage: node scripts/compare-issue-118-layout.mjs <beforeMetrics> <afterMetrics> <outputDir>");
  process.exit(2);
}

const before = JSON.parse(await readFile(resolve(beforePath), "utf8"));
const after = JSON.parse(await readFile(resolve(afterPath), "utf8"));
const outputDir = resolve(outputArg);

const key = (item) => `${item.viewport.width}x${item.viewport.height}-${item.state}`;
const beforeMap = new Map(before.map((item) => [key(item), item]));
const rows = [];
const failures = [];
const comparison = [];

for (const current of after) {
  const baseline = beforeMap.get(key(current));
  if (!baseline) {
    failures.push(`Missing baseline for ${key(current)}`);
    continue;
  }

  const delta = Math.round((current.ganttVisibleHeight - baseline.ganttVisibleHeight) * 100) / 100;
  const item = {
    case: key(current),
    viewport: current.viewport,
    state: current.state,
    beforeVisibleHeight: baseline.ganttVisibleHeight,
    afterVisibleHeight: current.ganttVisibleHeight,
    delta,
    beforeGanttY: baseline.gantt?.y ?? null,
    afterGanttY: current.gantt?.y ?? null,
    beforeOverflowX: baseline.documentOverflowX,
    afterOverflowX: current.documentOverflowX,
    beforeScreenshot: baseline.screenshot,
    afterScreenshot: current.screenshot,
  };
  comparison.push(item);

  if ([390, 768].includes(current.viewport.width) && delta <= 0) {
    failures.push(`${item.case}: expected Gantt visible height improvement, delta=${delta}px`);
  }
  if (current.documentOverflowX) {
    failures.push(`${item.case}: after state has document horizontal overflow`);
  }
  if (current.infoLineCount !== 1) {
    failures.push(`${item.case}: info control wraps to ${current.infoLineCount} lines`);
  }

  rows.push(
    `| ${current.viewport.width}×${current.viewport.height} | ${current.state} | ${baseline.ganttVisibleHeight} | ${current.ganttVisibleHeight} | ${delta >= 0 ? "+" : ""}${delta} |`,
  );
}

const markdown = [
  "# Issue #118 before/after layout evidence",
  "",
  "Baseline: `703a6f08595dea06a918366192df464d7215108e`",
  "",
  "After: `6386db860af69635cfb0fe626fd1a937905b9a56` (#118 merge SHA)",
  "",
  "| Viewport | State | Before visible Gantt px | After visible Gantt px | Delta px |",
  "|---|---|---:|---:|---:|",
  ...rows,
  "",
  "The workflow uses the same measurement harness, mocked project/task data, viewport, and edit state for both revisions.",
  "Screenshots and raw metrics are uploaded in the workflow artifact.",
  "",
  failures.length ? "## Gate: FAIL" : "## Gate: PASS",
  ...(failures.length ? ["", ...failures.map((failure) => `- ${failure}`)] : []),
  "",
].join("\n");

await writeFile(resolve(outputDir, "comparison.json"), JSON.stringify(comparison, null, 2) + "\n", "utf8");
await writeFile(resolve(outputDir, "summary.md"), markdown, "utf8");
console.log(markdown);

if (failures.length) process.exit(1);
