import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

test.afterEach(async ({ page }, info) => {
  const observation = await page.evaluate(() => window.__issue569 ? { sample: window.__issue569.sample(), trace: window.__issue569.trace() } : null);
  if (observation) await info.attach("adapter-last-observation.json", { body: JSON.stringify(observation, null, 2), contentType: "application/json" });
  if (observation && process.env.ISSUE569_EVIDENCE_DIR) {
    await mkdir(process.env.ISSUE569_EVIDENCE_DIR, { recursive: true });
    await writeFile(join(process.env.ISSUE569_EVIDENCE_DIR, `last-${info.title.match(/\d+px/)?.[0]}-${info.title.includes("week") ? "week" : "day"}.json`), JSON.stringify({ status: info.status, observation }, null, 2));
  }
});

for (const width of [390, 768, 1024, 1440, 1920]) for (const scale of ["day", "week"] as const) {
  test(`Issue569 ${width}px ${scale} A/B/C 실제 Adapter PoC`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    const trials: unknown[] = [];
    for (const mode of ["A", "B", "C"] as const) {
      await page.goto(`/diagnostics/gantt-adapter?mode=${mode}&scale=${scale}`);
      await expect.poll(() => page.evaluate(() => !!window.__issue569)).toBe(true);
      await page.evaluate(({ run, head }) => window.__issue569!.configure(run, head), { run: `poc-${width}-${scale}-${mode}`, head: process.env.ISSUE569_HEAD ?? "uncommitted" });
      const initial = await page.evaluate(() => window.__issue569!.sample());
      let fallback = false;
      if (width === 390) {
        await expect(page.getByLabel("합성 Milestone 읽기 목록")).toBeVisible();
        expect(initial.geometry).toEqual({ ok: false, result: "NO_SCROLL_CAPACITY" });
        expect(await page.evaluate(() => window.__issue569!.settle())).toBe("NO_SCROLL_CAPACITY");
        await page.getByRole("button", { name: "Chart 확대 / Grid 복원" }).click();
        expect(await page.evaluate(() => window.__issue569!.settle())).toBe("NATIVE_LAYOUT_SETTLED");
        fallback = true;
      } else expect(await page.evaluate(() => window.__issue569!.settle())).toBe("NATIVE_LAYOUT_SETTLED");
      const ready = await page.evaluate(() => window.__issue569!.sample());
      expect(ready.core.selected).toEqual(["synthetic-10"]);
      expect(ready.apiInstance).toBe(initial.apiInstance); expect(ready.geometry.ok).toBe(true);
      const align = async () => {
        expect(await page.evaluate(() => window.__issue569!.scroll({ left: 0, top: 0 }))).toBe("NATIVE_LAYOUT_SETTLED");
        const date = new Date(2026, 0, scale === "day" ? 12 : 11).getTime();
        let point = await page.evaluate(date => window.__issue569!.point(date), date);
        if (!point.ok && mode === "A") {
          expect(point.result).toBe("UNMEASURABLE");
          const observed = await page.evaluate(() => window.__issue569!.sample());
          expect(observed.core.originMs).not.toBe(new Date(2026, 0, 4).getTime());
          return { classification: "UNMEASURABLE: AUTO_SCALE_ORIGIN_CHANGED", point, observed };
        }
        expect(point.ok).toBe(true); if (!point.ok) throw new Error("Axis not calibrated");
        expect(await page.evaluate(date => window.__issue569!.revealDate(date), date)).toBe("NATIVE_LAYOUT_SETTLED");
        point = await page.evaluate(date => window.__issue569!.point(date), date);
        if (!point.ok) throw new Error("Reveal axis not calibrated");
        const native = await page.evaluate(scale => {
          const chart = document.querySelector<HTMLElement>('[data-testid="adapter-root"] .wx-chart')!;
          const bar = document.querySelector<HTMLElement>(`.wx-bar[data-task-id=":synthetic-${scale === "day" ? 8 : 7}"]`)!;
          const tick = [...document.querySelectorAll<HTMLElement>(".wx-scale .wx-cell")].find(cell => cell.textContent?.trim() === (scale === "day" ? "12 Jan" : "11 Jan"))!;
          const barBox = bar.getBoundingClientRect(), chartBox = chart.getBoundingClientRect(), tickBox = tick.getBoundingClientRect();
          return { bar: barBox.x - chartBox.x, tick: tickBox.x - chartBox.x, barCenter: barBox.y + barBox.height / 2 };
        }, scale);
        expect(Math.abs(native.bar - point.value.viewportX)).toBeLessThanOrEqual(1);
        expect(Math.abs(native.tick - point.value.viewportX)).toBeLessThanOrEqual(1);
        let verticalAlignment: unknown = "NOT TESTED: Chart 확대에서는 Grid 숨김";
        if (!fallback) {
          const cell = await page.getByRole("gridcell", { name: `합성 작업 ${scale === "day" ? 8 : 7}`, exact: true }).boundingBox();
          expect(cell).not.toBeNull();
          const delta = Math.abs(native.barCenter - (cell!.y + cell!.height / 2));
          expect(delta).toBeLessThanOrEqual(1); verticalAlignment = { delta, gridCenter: cell!.y + cell!.height / 2, barCenter: native.barCenter };
        }
        const inverse = await page.evaluate(x => window.__issue569!.inverse(x), point.value.viewportX);
        expect(inverse.ok).toBe(true); if (inverse.ok) expect(Math.abs(inverse.value - date)).toBeLessThanOrEqual(1);
        return { point, native, inverse, verticalAlignment };
      };
      const alignmentBefore = await align();
      const edge = async () => {
        const s = await page.evaluate(() => window.__issue569!.sample());
        if (!s.geometry.ok) throw new Error("No measurable edge");
        const left = Math.floor(Math.max(0, Math.min(s.geometry.value.scrollWidth - s.geometry.value.chartWidth, (s.core.scaleWidth ?? 0) - (s.core.chartWidth ?? 0))));
        const top = Math.min(96, Math.max(0, s.geometry.value.scrollHeight - s.geometry.value.verticalClientHeight));
        const result = await page.evaluate(position => window.__issue569!.scroll(position), { left, top });
        const after = await page.evaluate(() => window.__issue569!.sample());
        if (result === "TIMED_OUT") {
          expect(after.core).toMatchObject({ left, top }); expect(after.geometry.ok).toBe(true);
          if (after.geometry.ok) expect(Math.abs(after.geometry.value.left - left)).toBeGreaterThan(1);
          const trace = await page.evaluate(() => window.__issue569!.trace());
          expect(trace.entries.at(-1)).toMatchObject({ result: "TIMED_OUT" });
        } else expect(result).toBe("NATIVE_LAYOUT_SETTLED");
        return { result, requested: { left, top }, sample: after };
      };
      const edgeBefore = await edge();
      const chart = page.locator('[data-testid="adapter-root"] .wx-chart');
      await chart.hover(); await page.mouse.wheel(30, 0);
      expect(await page.evaluate(() => window.__issue569!.settle())).toBe("NATIVE_LAYOUT_SETTLED");
      const unchangedScroll = await page.evaluate(() => window.__issue569!.sample());
      // unchanged Task scroll과 명시 prop 갱신을 혼합하지 않는다.
      expect(unchangedScroll.core.endMs).toBe(edgeBefore.sample.core.endMs);
      const extensions: unknown[] = [];
      let remainingExtensionsNotTested = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        const edgeObservation = await edge();
        if (edgeObservation.result !== "NATIVE_LAYOUT_SETTLED") { extensions.push({ supported: false, phase: "before-extension", edgeObservation }); remainingExtensionsNotTested = 3 - attempt; break; }
        const extension = await page.evaluate(() => window.__issue569!.extend()) as { supported: boolean; result: string };
        extensions.push(extension);
        if (!extension.supported) { remainingExtensionsNotTested = 2 - attempt; break; }
      }
      // 관측된 지원/미지원 profile을 고정하여 지원 후퇴를 수집 성공으로 숨기지 않는다.
      if (width === 390 && !(scale === "day" && mode === "C")) {
        expect(extensions).toHaveLength(3); expect(remainingExtensionsNotTested).toBe(0);
        for (const extension of extensions) expect(extension).toMatchObject({ supported: true, result: "NATIVE_LAYOUT_SETTLED", checks: { instance: true, selection: true, origin: true, position: true, range: true, capacity: true } });
      } else if (width === 390) {
        expect(extensions).toHaveLength(1); expect(remainingExtensionsNotTested).toBe(2);
        expect(extensions[0]).toMatchObject({ supported: false, result: "TIMED_OUT", checks: { instance: true, selection: true, origin: true, position: false, range: true, capacity: true } });
      } else {
        expect(extensions).toHaveLength(2); expect(remainingExtensionsNotTested).toBe(2);
        expect(extensions[0]).toMatchObject({ supported: true, result: "NATIVE_LAYOUT_SETTLED", checks: { instance: true, selection: true, origin: true, position: true, range: true, capacity: true } });
        expect(extensions[1]).toMatchObject({ supported: false, phase: "before-extension", edgeObservation: { result: "TIMED_OUT" } });
      }
      const budget = remainingExtensionsNotTested === 0 ? await page.evaluate(() => window.__issue569!.extend()) : "NOT TESTED: 앞선 후보 실패로 중단";
      if (remainingExtensionsNotTested === 0) expect(budget).toMatchObject({ result: "BOUND_EXCEEDED" });
      const alignmentAfter = await align();
      const grid = await page.evaluate(() => window.__issue569!.resizeGrid());
      const split = await page.evaluate(() => window.__issue569!.split());
      const splitSample = await page.evaluate(() => window.__issue569!.sample());
      const splitAlignment = splitSample.geometry.ok ? await align() : { classification: "NO_SCROLL_CAPACITY", sample: splitSample };
      if (!splitSample.geometry.ok) expect(splitSample.geometry.result).toBe("NO_SCROLL_CAPACITY");
      await page.evaluate(() => window.__issue569!.split());
      await page.getByRole("button", { name: "전체 화면", exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
      const fullscreen = { result: await page.evaluate(() => window.__issue569!.settle()), sample: await page.evaluate(() => window.__issue569!.sample()) };
      expect(fullscreen.result).toBe("NATIVE_LAYOUT_SETTLED");
      await page.evaluate(() => document.exitFullscreen());
      expect(await page.evaluate(() => window.__issue569!.settle())).toBe("NATIVE_LAYOUT_SETTLED");
      expect(await page.evaluate(() => window.__issue569!.scroll({ left: 0, top: 0 }))).toBe("NATIVE_LAYOUT_SETTLED");
      const empty = await page.evaluate(() => window.__issue569!.variant("empty"));
      expect(empty).toMatchObject({ result: "NATIVE_LAYOUT_SETTLED" });
      const emptyTasks = await page.evaluate(() => window.__issue569!.taskEvidence());
      expect(emptyTasks.core).toEqual([]);
      expect(emptyTasks.dom).toEqual([]);
      const milestone = await page.evaluate(() => window.__issue569!.variant("milestone"));
      expect(milestone).toMatchObject({ result: "NATIVE_LAYOUT_SETTLED" });
      const milestoneTasks = await page.evaluate(() => window.__issue569!.taskEvidence());
      // SVAR의 Milestone은 시작 시점만 직렬화하며 end 필드를 제공하지 않는다.
      expect(milestoneTasks.core).toEqual([{ id: "synthetic-6", type: "milestone",
        startMs: new Date(2026, 0, 10).getTime(), endMs: null }]);
      expect(milestoneTasks.dom).toContain("synthetic-6");
      expect(milestoneTasks.dom.every(id => id === "synthetic-6")).toBe(true);
      const normal = await page.evaluate(() => window.__issue569!.variant("normal"));
      expect(normal).toMatchObject({ result: "NATIVE_LAYOUT_SETTLED" });
      const normalTasks = await page.evaluate(() => window.__issue569!.taskEvidence());
      expect(normalTasks.core).toHaveLength(40);
      const futureTask = mode === "A" ? await page.evaluate(() => window.__issue569!.futureTask()) : "N/A";
      if (mode === "A") {
        expect(futureTask).toMatchObject({ result: "NATIVE_LAYOUT_SETTLED" });
        const futureEvidence = await page.evaluate(() => window.__issue569!.taskEvidence());
        expect(futureEvidence.core).toHaveLength(40);
        expect(futureEvidence.core?.find(task => task.id === "synthetic-40")).toMatchObject({
          startMs: new Date(2028, 0, 5).getTime(), endMs: new Date(2028, 0, 8).getTime(),
        });
      }
      let shortAxis: unknown = "N/A";
      if (width === 1440 && scale === "week" && mode === "B") {
        await page.evaluate(() => window.__issue569!.scroll({ left: 0, top: 0 }));
        shortAxis = await page.evaluate(async () => {
          const commit = await window.__issue569!.shortAxis();
          const date = new Date(2026, 0, 11).getTime();
          return { commit, point: window.__issue569!.point(date), reveal: await window.__issue569!.revealDate(date), tickWidth: document.querySelector(".wx-scale .wx-cell")?.getBoundingClientRect().width };
        });
        expect(shortAxis).toMatchObject({ point: { ok: false, result: "UNMEASURABLE" }, reveal: "UNMEASURABLE" });
      }
      const performance = await page.evaluate(() => window.__issue569!.performance());
      const trace = await page.evaluate(() => window.__issue569!.trace());
      expect(trace.dropped).toBe(0);
      trials.push({ mode, width, scale, initial, ready, fallback, alignmentBefore, edgeBefore, unchangedScroll, extensions, remainingExtensionsNotTested, budget, alignmentAfter, grid, split, splitAlignment, fullscreen, empty, milestone, futureTask, shortAxis, performance, trace });
      if (process.env.ISSUE569_EVIDENCE_DIR && (width === 390 || width === 1440) && mode === "B") {
        await mkdir(process.env.ISSUE569_EVIDENCE_DIR, { recursive: true });
        await page.screenshot({ path: join(process.env.ISSUE569_EVIDENCE_DIR, `fixture-${width}-${scale}.png`) });
      }
    }
    const body = JSON.stringify({ width, scale, trials }, null, 2);
    await testInfo.attach("adapter-poc.json", { body, contentType: "application/json" });
    if (process.env.ISSUE569_EVIDENCE_DIR) {
      await mkdir(process.env.ISSUE569_EVIDENCE_DIR, { recursive: true });
      await writeFile(join(process.env.ISSUE569_EVIDENCE_DIR, `poc-${width}-${scale}.json`), body);
    }
  });
}

test("Issue569 동시 확장 요청은 BUSY로 거부하고 1회만 집계한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/diagnostics/gantt-adapter?mode=B&scale=day");
  await expect.poll(() => page.evaluate(() => !!window.__issue569)).toBe(true);
  expect(await page.evaluate(() => window.__issue569!.settle())).toBe("NATIVE_LAYOUT_SETTLED");
  const receipt = await page.evaluate(async () => {
    const firstPending = window.__issue569!.extend();
    const second = await window.__issue569!.extend();
    const first = await firstPending;
    const followup = await window.__issue569!.extend();
    return { first, second, followup, sample: window.__issue569!.sample() };
  });
  expect(receipt.second).toMatchObject({ result: "BUSY" });
  expect(receipt.first).toMatchObject({ extension: 1 });
  expect(receipt.second).not.toHaveProperty("extension");
  expect(receipt.followup).toMatchObject({ extension: 2 });
});
