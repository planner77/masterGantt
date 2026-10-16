import { expect, test, type Locator } from "@playwright/test";
import { evaluateGanttReadiness, ganttReadinessStabilityKey, type GanttReadinessExpectation, type GanttReadinessSnapshot } from "./gantt-readiness-state";
export { evaluateGanttReadiness } from "./gantt-readiness-state";
export type { GanttReadinessExpectation, GanttReadinessSnapshot } from "./gantt-readiness-state";

// 이 모듈은 상태 관측만 한다. 초기 위치/축 준비 입력은 소비자의 명시 setup에 둔다.
export async function readGanttReadiness(target: Locator, expected: GanttReadinessExpectation, stableFrames = 0) {
  return target.evaluate(async (node, request) => {
    const frame = node.matches(".project-gantt-frame") ? node as HTMLElement : node.closest<HTMLElement>(".project-gantt-frame");
    const chart = frame?.querySelector<HTMLElement>(".wx-chart"), owner = frame?.querySelector<HTMLElement>(".wx-gantt");
    if (!frame || !chart || !owner) return { samples: [], animated: true };
    const capture = (): GanttReadinessSnapshot => {
      const parse = (key: string) => JSON.parse(frame.dataset[key] ?? "null");
      const probe = Reflect.get(frame, "__masterganttMilestoneTimeline"), core = probe?.read?.();
      const actualScale = Reflect.get(frame, "__masterganttGridReveal")?.scaleUnit ?? null;
      const axis = chart.querySelector<HTMLElement>(".wx-scale")?.getBoundingClientRect();
      const coordinate = request.expected.date ? probe?.coordinate?.(request.expected.date) : null;
      const rect = node.getBoundingClientRect(), x = (Math.max(0, rect.left) + Math.min(innerWidth, rect.right)) / 2,
        y = (Math.max(0, rect.top) + Math.min(innerHeight, rect.bottom)) / 2, hit = document.elementFromPoint(x, y);
      const recovery = parse("ganttCanonicalRecovery");
      return {
        connected: frame.isConnected && node.isConnected && chart.isConnected && owner.isConnected,
        visible: document.visibilityState === "visible", sameOwners: frame.querySelector(".wx-chart") === chart && frame.querySelector(".wx-gantt") === owner,
        api: frame.dataset.projectGanttApiInstance ?? null, scale: frame.dataset.ganttScaleMode ?? null, coreScale: actualScale,
        scope: new URL(location.href).searchParams.get("rootTask")?.trim() || null,
        query: document.querySelector<HTMLInputElement>('input[aria-label="작업명, 설명, External ID 검색"]')?.value ?? null,
        canonical: { generation: frame.dataset.ganttCanonicalSyncGeneration ?? null, settled: frame.dataset.ganttCanonicalSyncSettledGeneration ?? null,
          depth: Number(frame.dataset.ganttCanonicalSyncDepth ?? -1), recovery: recovery?.outcome ?? null },
        lastSuccess: parse("ganttProjectionReceipt"), latestAttempt: parse("ganttProjectionObservation"), semantic: parse("ganttSemanticProjectionReceipt"), currentWork: parse("ganttViewportCoordinator"),
        core: core ? { ready: probe.ready === true, instance: core.instance, left: core.left, top: core.top, width: core.width, chartWidth: core.chartWidth, axisStart: core.start instanceof Date ? core.start.toISOString() : null, axisEnd: core.end instanceof Date ? core.end.toISOString() : null,
          canonicalIds: core.canonicalIds, coreTaskCount: core.coreTaskCount,
          scaleRows: (core.scaleRows ?? []).map((row: { width: number; first: { value: unknown }[]; last: { value: unknown }[] }) => ({ width: row.width, labels: [...row.first, ...row.last].map(cell => cell.value) })) } : null,
        native: { left: chart.scrollLeft, top: owner.scrollTop, capacity: chart.scrollWidth - chart.clientWidth, clientWidth: chart.clientWidth, clientHeight: chart.clientHeight },
        domIds: [...frame.querySelectorAll(".wx-table-container .wx-row[data-id]")].map(row => row.getAttribute("data-id")!.replace(/^:/, "")),
        axisExists: !!axis, header: !!chart.querySelector(request.expected.scale === "week" ? ".project-gantt-week-scale" : ".project-gantt-day-scale"),
        geometry: [chart.clientWidth, chart.clientHeight, chart.scrollWidth, owner.clientWidth, owner.clientHeight, owner.scrollHeight,
          frame.clientWidth, frame.clientHeight, frame.querySelector(".project-gantt-scroll")?.scrollLeft ?? 0,
          axis?.x ?? 0, axis?.y ?? 0, axis?.width ?? 0, axis?.height ?? 0, innerWidth, innerHeight, Number(document.fullscreenElement === frame)],
        coordinate: coordinate ? { insideRange: coordinate.insideRange, contentX: coordinate.contentX } : null,
        hover: request.expected.operation === "hover" ? { hit: !!hit && node.contains(hit), rect: [rect.x, rect.y, rect.width, rect.height, x, y] } : null,
      };
    };
    const samples = [capture()], deadline = performance.now() + 5_000;
    for (let index = 0; index < request.stableFrames; index++) {
      const animated = await new Promise<boolean>(resolve => {
        const finish = (value: boolean) => { cancelAnimationFrame(frameId); clearTimeout(timer); resolve(value); };
        const frameId = requestAnimationFrame(() => finish(true));
        const timer = setTimeout(() => finish(false), Math.max(1, deadline - performance.now()));
      });
      if (!animated) return { samples, animated: false };
      samples.push(capture());
    }
    return { samples, animated: true };
  }, { expected, stableFrames });
}

export async function waitForGanttReadiness(target: Locator, expected: GanttReadinessExpectation) {
  let last: { expected: GanttReadinessExpectation; observations: Awaited<ReturnType<typeof readGanttReadiness>>;
    results: ReturnType<typeof evaluateGanttReadiness>[]; blockers: string[] } | undefined;
  try {
    await expect.poll(async () => {
      const observations = await readGanttReadiness(target, expected, 3);
      const results = observations.samples.map(snapshot => evaluateGanttReadiness(snapshot, expected));
      const blockers = [...new Set(results.flatMap(result => result.blockers))];
      if (!observations.samples.length) blockers.push("DOM_FRAME_MISSING");
      if (!observations.animated) blockers.push("RAF_NOT_DELIVERED");
      if (new Set(observations.samples.map(ganttReadinessStabilityKey)).size > 1) blockers.push("SNAPSHOT_NOT_STABLE");
      last = { expected, observations, results, blockers };
      return blockers;
    }, { message: `Gantt ${expected.operation}: 현재 문맥과 동작별 전제를 확인해야 합니다` }).toEqual([]);
  } catch (error) {
    await test.info().attach("gantt-readiness-failure", { body: JSON.stringify(last ?? { expected, error: error instanceof Error ? error.message : String(error), observations: null }, null, 2), contentType: "application/json" });
    throw error;
  }
  return last!.observations.samples.at(-1)!;
}
