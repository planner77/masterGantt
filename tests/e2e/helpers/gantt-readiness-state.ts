import type { ProjectionReceipt } from "../../../src/features/gantt/projection-settled";

export interface GanttReadinessSnapshot {
  connected: boolean; visible: boolean; sameOwners: boolean;
  api: string | null; scale: string | null; coreScale: string | null; scope: string | null; query: string | null;
  canonical: { generation: string | null; settled: string | null; depth: number; recovery: string | null };
  lastSuccess: ProjectionReceipt | null;
  latestAttempt: { generation: number; stage: string; outcome: string } | null;
  semantic: { semanticId: number; observation: number } | null;
  currentWork: { phase: string; apiInstance: string; kind?: string; outcome?: string; writes?: number; intentEpoch?: number; contextEpoch?: number; gesture?: number; projectionEpoch?: number } | null;
  core: { ready: boolean; instance: string; left: number; top: number; width?: number; chartWidth?: number; axisStart?: string | null; axisEnd?: string | null;
    canonicalIds: string[]; coreTaskCount: number; scaleRows: { width: number; labels: unknown[] }[] } | null;
  native: { left: number; top: number; capacity: number; clientWidth: number; clientHeight: number };
  domIds: string[]; header: boolean; axisExists: boolean; geometry: number[];
  coordinate: { insideRange: boolean; contentX: number } | null;
  hover: { hit: boolean; rect: number[] } | null;
}
export interface GanttReadinessExpectation {
  operation: "observe" | "scroll" | "date-reveal" | "hover";
  api: string | null; revision: number; scale: "day" | "week"; scope: string | null; query: string;
  canonicalIds?: string[]; visibleIds?: string[]; exactDom?: boolean; requireRenderedRows?: boolean;
  targetLeft?: number; date?: string;
  queryWitness: { kind: "unchanged" } | { kind: "changed"; previousFilterKey: string };
  allowCancelledPriorWork?: boolean;
}
export interface GanttReadinessEvaluation {
  contextReady: boolean; operationPrerequisitesReady: boolean; ready: boolean;
  blockers: string[];
  admission: { requestedLeft: number | null; coreCapacity: number | null; nativeCapacity: number; accepted: boolean };
}
const busy = new Set(["WAIT_PROJECTION", "PREPARING_GEOMETRY", "WAIT_GEOMETRY", "APPLYING", "SETTLING"]);
const same = (a: readonly unknown[], b: readonly unknown[]) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a: readonly string[], b: readonly string[]) => same([...a].sort(), [...b].sort());

// 성공 receipt, 최신 시도, 현재 작업과 목표 수용 범위는 서로 다른 증거다.
export function evaluateGanttReadiness(s: GanttReadinessSnapshot, e: GanttReadinessExpectation): GanttReadinessEvaluation {
  const blockers: string[] = [];
  const check = (ok: unknown, code: string) => { if (!ok) blockers.push(code); };
  check(s.connected && s.visible && s.sameOwners, "DOM_NOT_CURRENT");
  check(e.api && s.api === e.api, "API_MISMATCH");
  check(s.scale === e.scale && s.coreScale === e.scale && s.header, "SCALE_MISMATCH");
  check(s.scope === e.scope && s.query === e.query, "QUERY_OR_SCOPE_MISMATCH");
  check(s.canonical.generation !== null && s.canonical.generation === s.canonical.settled && s.canonical.depth === 0 && s.canonical.recovery === "SETTLED", "CANONICAL_NOT_SETTLED");
  const r = s.lastSuccess;
  check(r?.outcome === "SETTLED" && r.apiInstance === e.api && r.revision === e.revision && r.scale === e.scale && r.scope === e.scope, "SUCCESS_RECEIPT_CONTEXT_MISMATCH");
  check(s.latestAttempt?.stage === "delivery" && s.latestAttempt.outcome === "SETTLED", `LATEST_ATTEMPT_${s.latestAttempt?.stage ?? "MISSING"}_${s.latestAttempt?.outcome ?? "MISSING"}`);
  // attempt.generation은 semanticId와 다른 번호 공간이다.
  check(r && s.semantic?.semanticId === r.generation, "SEMANTIC_RECEIPT_MISMATCH");
  const work = s.currentWork;
  if (work) {
    check(work.apiInstance === e.api, "CURRENT_OPERATION_API_MISMATCH");
    if (busy.has(work.phase)) check(false, "CURRENT_OPERATION_BUSY");
    else if (["NOT_MEASURABLE", "NO_SCROLL_CAPACITY", "TIMED_OUT", "FAILED", "UNSUPPORTED"].includes(work.phase)) check(false, `CURRENT_OPERATION_FAILED_${work.phase}`);
    else if (work.phase === "SUPERSEDED") check(e.allowCancelledPriorWork && work.outcome === "SUPERSEDED", "PRIOR_CANCELLED_OPERATION_NOT_ACCEPTED");
    else check((work.phase === "SETTLED" && work.outcome === "SETTLED") || (work.phase === "IDLE" && work.outcome === undefined), "CURRENT_OPERATION_UNKNOWN_OR_MALFORMED");
  }
  check(s.core?.ready && s.core.instance === e.api, "CORE_READER_NOT_CURRENT");
  check(s.core && Math.abs(s.core.left - s.native.left) <= 1 && Math.abs(s.core.top - s.native.top) <= 1, "CORE_NATIVE_POSITION_MISMATCH");
  check(s.native.clientWidth > 0, "GEOMETRY_NOT_MEASURABLE");
  if (e.queryWitness.kind === "changed") check(r && r.filterKey !== e.queryWitness.previousFilterKey, "QUERY_RECEIPT_NOT_FRESH");
  if (r) {
    check(same(r.logicalVisibleIds, r.coreVisibleIds), "LOGICAL_CORE_MEMBERSHIP_MISMATCH");
    check(same(s.domIds, r.logicalVisibleIds.filter(id => s.domIds.includes(id))), "DOM_MEMBERSHIP_OR_ORDER_MISMATCH");
    if (e.visibleIds) check(sameSet(r.logicalVisibleIds, e.visibleIds), "EXPECTED_MEMBERSHIP_MISMATCH");
    if (e.exactDom && e.visibleIds) check(sameSet(s.domIds, e.visibleIds), "EXPECTED_DOM_MEMBERSHIP_MISMATCH");
  }
  if (e.requireRenderedRows) check(s.domIds.length > 0, "DOM_ROWS_NOT_RENDERED");
  if (e.canonicalIds) check(s.core && (e.operation === "date-reveal" ? same(s.core.canonicalIds, e.canonicalIds) : sameSet(s.core.canonicalIds, e.canonicalIds)) && s.core.coreTaskCount === e.canonicalIds.length, "CANONICAL_CORE_IDS_MISMATCH");
  const contextReady = blockers.length === 0;
  if (e.operation === "date-reveal") {
    check(s.coordinate?.insideRange, "DATE_OUTSIDE_CURRENT_AXIS");
    check(s.axisExists && s.native.clientHeight > 0, "DATE_AXIS_NOT_MEASURABLE");
    const labels = s.core?.scaleRows.at(-1)?.labels ?? [], pattern = e.scale === "week" ? /^W\d{2}$/ : /^\d{1,2}$/;
    check(labels.length > 0 && labels.every(value => typeof value === "string" && pattern.test(value)) && s.core?.scaleRows.every(row => row.width === s.core?.width), "CORE_AXIS_NOT_CURRENT");
  }
  if (e.operation === "hover") {
    // hover 앞의 1px native 후행 scroll도 Tooltip을 닫으므로 기존 exact X를 유지한다.
    check(s.core?.left === s.native.left, "HOVER_NATIVE_X_NOT_SETTLED");
    check(s.hover?.hit && s.hover.rect[2] > 0 && s.hover.rect[3] > 0, "HOVER_TARGET_NOT_HITTABLE");
  }
  const operationPrerequisitesReady = blockers.length === 0;
  const coreCapacity = s.core && Number.isFinite(s.core.width) && Number.isFinite(s.core.chartWidth) ? s.core.width! - s.core.chartWidth! : null;
  const requestedLeft = e.targetLeft ?? null;
  if (requestedLeft !== null) {
    check(Number.isFinite(requestedLeft) && requestedLeft >= 0, "INVALID_TARGET");
    check(coreCapacity !== null && coreCapacity >= requestedLeft, "TARGET_CORE_CAPACITY_INSUFFICIENT");
    check(Number.isFinite(s.native.capacity) && s.native.capacity >= requestedLeft, "TARGET_NATIVE_CAPACITY_INSUFFICIENT");
  }
  return { contextReady, operationPrerequisitesReady, ready: blockers.length === 0, blockers,
    admission: { requestedLeft, coreCapacity, nativeCapacity: s.native.capacity, accepted: requestedLeft === null || (coreCapacity !== null && coreCapacity >= requestedLeft && s.native.capacity >= requestedLeft) } };
}

// 각 sample의 현재 유효성과 의미·authority·실제 geometry의 안정성을 분리한다.
// attempt·동의 receipt 관측·trace 쓰기 counter만의 갱신은 재대기 사유가 아니다.
export function ganttReadinessStabilityKey(s: GanttReadinessSnapshot): string {
  const r = s.lastSuccess, w = s.currentWork;
  return JSON.stringify({ api: s.api, scale: s.scale, coreScale: s.coreScale, scope: s.scope, query: s.query,
    receipt: r && { api: r.apiInstance, revision: r.revision, semanticId: r.generation, filterKey: r.filterKey,
      logicalIds: r.logicalVisibleIds, coreIds: r.coreVisibleIds, selectedIds: r.selectedIds, columns: r.columns },
    semanticId: s.semantic?.semanticId, work: w && { api: w.apiInstance, kind: w.kind, phase: w.phase, outcome: w.outcome,
      intent: w.intentEpoch, context: w.contextEpoch, gesture: w.gesture, projection: w.projectionEpoch },
    core: s.core, native: s.native, domIds: s.domIds, geometry: s.geometry, coordinate: s.coordinate, hover: s.hover });
}
