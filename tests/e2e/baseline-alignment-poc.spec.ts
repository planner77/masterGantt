import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startBaselineAlignmentHarness } from "../poc/baseline-alignment-server";

test("공개 Core 좌표 후보를 측정하고 POC 판정과 증거 수집을 구분한다", async ({ page }, testInfo) => {
  const harness = await startBaselineAlignmentHarness();
  try {
    await page.setViewportSize({ width: 1440, height: 844 });
    await page.goto(harness.url);
    await expect(page.locator('.wx-bar[data-task-id=":task-0"]')).toBeVisible();
    const measurements = [];
    for (const scenario of [{ unit: "day", autoScale: true }, { unit: "week", autoScale: true }, { unit: "week", autoScale: false }, { unit: "day", autoScale: false }] as const) {
      if (scenario.unit === "week" && scenario.autoScale || scenario.unit === "day" && !scenario.autoScale) await page.getByRole("button", { name: "Scale", exact: true }).click();
      if (scenario.unit === "week" && !scenario.autoScale) await page.getByRole("button", { name: "Auto scale", exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as unknown as { baselinePoc: { state(): { scales: { unit: string }[] } } }).baselinePoc.state().scales.at(-1)?.unit)).toBe(scenario.unit);
      await expect.poll(() => page.evaluate(() => (window as unknown as { baselinePoc: { state(): { autoScale: boolean } } }).baselinePoc.state().autoScale)).toBe(scenario.autoScale);
      await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      const measurement = await page.evaluate(({ unit, autoScale }) => {
        const poc = (window as unknown as { baselinePoc: { state(): { start: string; cellWidth: number; gridWidth: number; cellHeight: number; scaleHeight: number; scrollLeft: number; scrollTop: number; resize: { width: number } | null } } }).baselinePoc;
        const state = poc.state();
        const host = document.getElementById("owned-host")!.getBoundingClientRect();
        // Native DOM bounds are comparison oracle only. Never geometry inputs.
        const native = document.querySelector('.wx-bar[data-task-id=":task-0"]')!.getBoundingClientRect();
        const elapsedDays = (new Date(2026, 8, 14).getTime() - new Date(state.start).getTime()) / 86400000;
        const predictedLeft = host.left + state.gridWidth + elapsedDays * state.cellWidth / (unit === "week" ? 7 : 1) - state.scrollLeft;
        const resizePredictedLeft = state.resize ? host.left + host.width - state.resize.width + elapsedDays * state.cellWidth / (unit === "week" ? 7 : 1) - state.scrollLeft : null;
        const predictedWidth = 4 * state.cellWidth / (unit === "week" ? 7 : 1);
        const predictedRowCenter = host.top + 2 * state.scaleHeight + state.cellHeight * 1.5 - state.scrollTop;
        const nativeCenter = native.top + native.height / 2;
        document.getElementById("poc-candidate")?.remove();
        if (resizePredictedLeft !== null) {
          const marker = document.createElement("div");
          marker.id = "poc-candidate";
          marker.setAttribute("aria-hidden", "true");
          Object.assign(marker.style, { position: "absolute", pointerEvents: "none", left: `${resizePredictedLeft - host.left}px`, top: `${predictedRowCenter - host.top - 3}px`, width: `${predictedWidth}px`, height: "6px", background: "#d97706", zIndex: "10" });
          document.getElementById("owned-host")!.append(marker);
        }
        return { unit, autoScale, publicState: state, ownedHost: { left: host.left, top: host.top, width: host.width, height: host.height }, nativeOracle: { left: native.left, top: native.top, width: native.width, height: native.height, rowCenter: nativeCenter }, candidate: { configuredGridLeft: predictedLeft, resizeEventLeft: resizePredictedLeft, width: predictedWidth, rowCenter: predictedRowCenter }, errorsPx: { configuredGridLeft: native.left - predictedLeft, resizeEventLeft: resizePredictedLeft === null ? null : native.left - resizePredictedLeft, width: native.width - predictedWidth, rowCenter: nativeCenter - predictedRowCenter }, withinOnePixel: resizePredictedLeft !== null && Math.abs(native.left - resizePredictedLeft) <= 1 && Math.abs(native.width - predictedWidth) <= 1 && Math.abs(nativeCenter - predictedRowCenter) <= 1 };
      }, scenario);
      expect(Number.isFinite(measurement.errorsPx.configuredGridLeft)).toBe(true);
      expect(measurement.nativeOracle.width).toBeGreaterThan(0);
      expect(measurement.publicState.resize).not.toBeNull();
      for (const value of [measurement.publicState.cellWidth, measurement.publicState.cellHeight, measurement.publicState.scaleHeight, measurement.publicState.gridWidth, measurement.publicState.scrollLeft, measurement.publicState.scrollTop, ...Object.values(measurement.ownedHost), ...Object.values(measurement.nativeOracle), ...Object.values(measurement.candidate), ...Object.values(measurement.errorsPx)]) expect(Number.isFinite(value)).toBe(true);
      await expect(page.locator("#poc-candidate")).toHaveCSS("pointer-events", "none");
      measurements.push(measurement);
      if (process.env.CAPTURE_BASELINE_POC === "1") {
        const output = resolve(__dirname, "../../docs/evidence/issue-253");
        await mkdir(output, { recursive: true });
        await page.screenshot({ path: resolve(output, `core-${scenario.unit}-${scenario.autoScale ? "default" : "fixed-range"}-fixture.png`) });
      }
    }
    const foundationalVerdict = measurements.every((measurement) => measurement.withinOnePixel) ? "PASS" : "FAIL";
    const report = { capturedAt: new Date().toISOString(), baselineSha: "e12a52a9ca5c1f06281e1cc07ffb5db540b25e66", browser: page.context().browser()?.version(), timezone: await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), fixture: "SVAR React Gantt Core 2.7.3; 절대 시작일 2026-09-14·종료일 2026-10-12; gridWidth 620; 프로젝트 day/week unit+step 설정 재현 (시계 mock 미사용)", tolerancePx: 1, foundationalVerdict, featurePoc: foundationalVerdict === "FAIL" ? "FAIL" : "NOT TESTED", remainingMatrix: `NOT TESTED: ${foundationalVerdict === "FAIL" ? "기본 좌표 후보의 정렬 검증 실패" : "기본 좌표만 검증; 전체 인수 기준 검증 필요"}; 스크롤·Grid 크기 변경·접힘/필터·전체 화면·반응형 너비·월/연 장기 범위·상호작용/권한 검증 미실행`, measurements };
    await testInfo.attach("baseline-alignment-measurements", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
    if (process.env.CAPTURE_BASELINE_POC === "1") {
      const output = resolve(__dirname, "../../docs/evidence/issue-253");
      await mkdir(output, { recursive: true });
      await writeFile(resolve(output, "public-state-alignment.json"), `${JSON.stringify(report, null, 2)}\n`);
    }
    expect(measurements).toHaveLength(4);
  } finally { await harness.close(); }
});
