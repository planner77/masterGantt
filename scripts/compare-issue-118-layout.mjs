import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** #118과 #896이 공유하는 화면 식별과 부호 있는 측정 차이. */
export const layoutCaseKey = (item) => `${item.viewport.width}x${item.viewport.height}-${item.state}`;
export const geometryDelta = (before, after) => Math.round((after - before) * 100) / 100;

/**
 * 파일 무결성을 확인한 v2 증거를 명시적 DESIGN 계약으로 비교한다.
 * 좌표 일치는 스크린샷 동일성이나 DESIGN/Owner 수용을 뜻하지 않는다.
 */
export function compareUiEvidenceGeometry(before, after, contract) {
  const blocked = (reason) => ({ status: "BLOCKED", reason, measurements: [] });
  const sha = /^[a-f0-9]{40}$/;
  if (!contract || !sha.test(contract.baselineSha ?? "") || !sha.test(contract.sourceSha ?? ""))
    return blocked("정확한 baseline/source SHA 계약이 필요합니다");
  if (before?.schema !== "mastergantt-ui-evidence/v2" || after?.schema !== "mastergantt-ui-evidence/v2")
    return blocked("v2 증거가 필요합니다; historical v1은 비교 기준으로 승격하지 않습니다");
  if (before.sourceSha !== contract.baselineSha || after.sourceSha !== contract.sourceSha
      || after.baselineSha !== contract.baselineSha)
    return blocked("baseline/source SHA가 비교 계약과 다릅니다");
  const environment = (value) => {
    const stringFields = ["browser", "browserVersion", "playwrightVersion", "os", "osRelease",
      "locale", "documentLocale", "font", "theme", "cssZoom", "timezone", "observedTime"];
    if (!value || stringFields.some((key) => typeof value[key] !== "string" || value[key].length === 0)
        || !Number.isFinite(value.deviceScaleFactor) || value.deviceScaleFactor <= 0
        || !Number.isInteger(value.viewport?.width) || value.viewport.width <= 0
        || !Number.isInteger(value.viewport?.height) || value.viewport.height <= 0) return null;
    return [...stringFields.map((key) => value[key]), value.deviceScaleFactor,
      value.viewport.width, value.viewport.height];
  };
  const previousEnvironment = environment(before.environment);
  const currentEnvironment = environment(after.environment);
  if (!previousEnvironment || !currentEnvironment
      || JSON.stringify(previousEnvironment) !== JSON.stringify(currentEnvironment))
    return blocked("브라우저/OS/폰트/locale/viewport/clock 환경이 없거나 다릅니다");
  if (before.issue !== after.issue
      || layoutCaseKey({ viewport: before.environment.viewport, state: before.state })
         !== layoutCaseKey({ viewport: after.environment.viewport, state: after.state }))
    return blocked("Issue 또는 화면 상태가 다릅니다");
  if (before.fixture?.kind !== "synthetic" || after.fixture?.kind !== "synthetic"
      || before.fixture.name !== after.fixture.name
      || before.fixture.scope !== "DATA_CAPTURED" || after.fixture.scope !== "DATA_CAPTURED"
      || !/^[a-f0-9]{64}$/.test(before.fixture.sha256 ?? "")
      || before.fixture.sha256 !== after.fixture.sha256)
    return blocked("합성 fixture fingerprint가 없거나 다릅니다");
  if (!Array.isArray(contract.measurements) || contract.measurements.length === 0
      || contract.measurements.length > 80)
    return blocked("명시적 DESIGN 측정 계약이 필요합니다");
  const rectMap = (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    const map = new Map();
    for (const rect of items) {
      if (!rect || typeof rect.name !== "string" || map.has(rect.name)) return null;
      map.set(rect.name, rect);
    }
    return map;
  };
  const previous = rectMap(before.geometry);
  const current = rectMap(after.geometry);
  if (!previous || !current || previous.size !== current.size
      || [...previous.keys()].some((name) => !current.has(name)))
    return blocked("geometry identity가 없거나 중복/변경되었습니다");
  const measurements = [];
  const identities = new Set();
  for (const rule of contract.measurements) {
    if (!rule || typeof rule.name !== "string" || !["x", "y", "width", "height"].includes(rule.field)
        || !Number.isFinite(rule.tolerance) || rule.tolerance < 0
        || typeof rule.designRef !== "string" || !/^((docs\/)?[A-Za-z0-9_-]+\.md)#.+$/.test(rule.designRef))
      return blocked("측정 허용오차와 DESIGN 근거를 명시해야 합니다");
    const identity = `${rule.name}.${rule.field}`;
    if (identities.has(identity)) return blocked("중복 측정 계약입니다");
    identities.add(identity);
    const oldValue = previous.get(rule.name)?.[rule.field];
    const newValue = current.get(rule.name)?.[rule.field];
    if (!Number.isFinite(oldValue) || !Number.isFinite(newValue))
      return blocked("측정값이 누락되었거나 유한수가 아닙니다");
    const delta = geometryDelta(oldValue, newValue);
    // 원시값을 비교하여 반올림으로 계약 위반을 PASS로 바꾸지 않는다.
    const outcome = Math.abs(newValue - oldValue) <= rule.tolerance ? "PASS" : "FAIL";
    measurements.push({ name: rule.name, field: rule.field, before: oldValue,
      after: newValue, delta, tolerance: rule.tolerance, designRef: rule.designRef, outcome });
  }
  return { status: measurements.some((item) => item.outcome === "FAIL") ? "FAIL" : "GEOMETRY_MATCH_NOT_UAT",
    measurements };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--ui-evidence") {
    const [, beforePath, afterPath, contractPath, outputArg] = args;
    if (args.length !== 5) {
      console.error("사용법: node scripts/compare-issue-118-layout.mjs --ui-evidence <beforeManifest> <afterManifest> <contractJson> <outputDir>");
      return 2;
    }
    const [before, after, contract] = await Promise.all([beforePath, afterPath, contractPath]
      .map(async (path) => JSON.parse(await readFile(resolve(path), "utf8"))));
    const result = compareUiEvidenceGeometry(before, after, contract);
    const markdown = ["# 합성 UI 기하 비교 (사용자 수용 아님)", "",
      "PNG·geometry 파일 무결성은 scripts/ui_evidence.py로 별도 확인합니다.", "",
      `판정: ${result.status}`, result.reason ?? "", "",
      ...result.measurements.map((item) => `- ${item.name}.${item.field}: ${item.before} → ${item.after}, delta=${item.delta}px, 허용=${item.tolerance}px, ${item.outcome} (${item.designRef})`), ""].join("\n");
    await writeFile(resolve(outputArg, "comparison.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
    await writeFile(resolve(outputArg, "summary.md"), markdown, "utf8");
    console.log(markdown);
    return result.status === "GEOMETRY_MATCH_NOT_UAT" ? 0 : 1;
  }
  const [beforePath, afterPath, outputArg] = args;
  if (!beforePath || !afterPath || !outputArg) {
    console.error("사용법: node scripts/compare-issue-118-layout.mjs <beforeMetrics> <afterMetrics> <outputDir>");
    return 2;
  }

  const before = JSON.parse(await readFile(resolve(beforePath), "utf8"));
  const after = JSON.parse(await readFile(resolve(afterPath), "utf8"));
  const outputDir = resolve(outputArg);

  const key = layoutCaseKey;
  const beforeMap = new Map(before.map((item) => [key(item), item]));
  const rows = [];
  const failures = [];
  const comparison = [];

  for (const current of after) {
    const baseline = beforeMap.get(key(current));
    if (!baseline) {
      failures.push(`기준 측정값이 없습니다: ${key(current)}`);
      continue;
    }

    const delta = geometryDelta(baseline.ganttVisibleHeight, current.ganttVisibleHeight);
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
      failures.push(`${item.case}: Gantt 가시 높이가 개선되어야 합니다. delta=${delta}px`);
    }
    if (current.documentOverflowX) {
      failures.push(`${item.case}: 변경 후 문서에 가로 overflow가 있습니다`);
    }
    if (current.infoLineCount !== 1) {
      failures.push(`${item.case}: 정보 컨트롤이 여러 줄로 줄바꿈됩니다: ${current.infoLineCount}줄`);
    }

    rows.push(
      `| ${current.viewport.width}×${current.viewport.height} | ${current.state} | ${baseline.ganttVisibleHeight} | ${current.ganttVisibleHeight} | ${delta >= 0 ? "+" : ""}${delta} |`,
    );
  }

  const markdown = [
    "# Issue #118 구현 전/후 레이아웃 증거",
    "",
    "기준(Before): `703a6f08595dea06a918366192df464d7215108e`",
    "",
    "변경 후(After): `6386db860af69635cfb0fe626fd1a937905b9a56` (#118 기능 병합 SHA)",
    "",
    "| Viewport | 상태 | Before Gantt 가시 높이(px) | After Gantt 가시 높이(px) | 개선(px) |",
    "|---|---|---:|---:|---:|",
    ...rows,
    "",
    "두 revision에 동일 측정 harness, 동일 Project/Task mock 데이터, 동일 viewport, 동일 편집 상태를 적용합니다.",
    "구현 전/후 screenshot과 원시 측정값은 Workflow artifact에 저장합니다.",
    "",
    failures.length ? "## 판정: FAIL" : "## 판정: PASS",
    ...(failures.length ? ["", ...failures.map((failure) => `- ${failure}`)] : []),
    "",
  ].join("\n");

  await writeFile(resolve(outputDir, "comparison.json"), JSON.stringify(comparison, null, 2) + "\n", "utf8");
  await writeFile(resolve(outputDir, "summary.md"), markdown, "utf8");
  console.log(markdown);

  return failures.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error("BLOCKED: 레이아웃 증거를 읽거나 비교할 수 없습니다:", error.message);
    process.exitCode = 1;
  }
}
