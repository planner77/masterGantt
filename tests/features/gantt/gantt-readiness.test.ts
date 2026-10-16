import { describe, expect, it } from "vitest";
import { evaluateGanttReadiness, ganttReadinessStabilityKey, type GanttReadinessExpectation, type GanttReadinessSnapshot } from "../../e2e/helpers/gantt-readiness-state";
function fixture() {
  const expected: GanttReadinessExpectation = { operation: "observe", api: "a", revision: 20, scale: "week", scope: null, query: "", queryWitness: { kind: "unchanged" }, visibleIds: ["s", "t"] };
  const snapshot: GanttReadinessSnapshot = {
    connected: true, visible: true, sameOwners: true, api: "a", scale: "week", coreScale: "week", scope: null, query: "", header: true, axisExists: true,
    canonical: { generation: "5", settled: "5", depth: 0, recovery: "SETTLED" },
    lastSuccess: { apiInstance: "a", revision: 20, generation: 2, reasons: [], outcome: "SETTLED", logicalVisibleIds: ["s", "t"], coreVisibleIds: ["s", "t"], domIds: ["s", "t"], columns: "", scale: "week", scope: null, filterKey: "f1", taskSelectionChanged: false, queryConditionsChanged: false, selectedIds: [] },
    latestAttempt: { generation: 9, stage: "delivery", outcome: "SETTLED" }, semantic: { semanticId: 2, observation: 3 },
    currentWork: { phase: "SETTLED", outcome: "SETTLED", apiInstance: "a" },
    core: { ready: true, instance: "a", left: 0, top: 0, width: 952, chartWidth: 906, canonicalIds: ["s", "t"], coreTaskCount: 2, scaleRows: [{ width: 952, labels: ["W01"] }] },
    native: { left: 0, top: 0, capacity: 47, clientWidth: 905, clientHeight: 500 }, domIds: ["s", "t"], geometry: [952, 905], coordinate: { insideRange: true, contentX: 400 }, hover: { hit: true, rect: [0, 0, 20, 20] },
  };
  return { expected, snapshot };
}
describe("operation별 Gantt 준비 계약", () => {
  it("초기 metadata는 virtualized subset이 비어 있으면 준비로 승인하지 않는다", () => {
    const { snapshot, expected } = fixture(); snapshot.domIds = [];
    expect(evaluateGanttReadiness(snapshot, { ...expected, requireRenderedRows: true }).blockers).toContain("DOM_ROWS_NOT_RENDERED");
    expect(evaluateGanttReadiness(snapshot, expected).ready).toBe(true);
  });
  it("hover는 후행 native X1px를 수용하지 않고 date/scroll의 기존1px 허용은 유지한다", () => {
    const { snapshot, expected } = fixture(); snapshot.native.left = 1;
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "hover" }).blockers).toContain("HOVER_NATIVE_X_NOT_SETTLED");
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "date-reveal" }).ready).toBe(true);
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "scroll" }).ready).toBe(true);
  });
  it("date-reveal는 기존 canonical 배열 순서까지 보존하고 metadata의 set 계약은 구분한다", () => {
    const { snapshot, expected } = fixture(); const canonicalIds = ["t", "s"];
    expect(evaluateGanttReadiness(snapshot, { ...expected, canonicalIds, operation: "date-reveal" }).blockers).toContain("CANONICAL_CORE_IDS_MISMATCH");
    expect(evaluateGanttReadiness(snapshot, { ...expected, canonicalIds }).ready).toBe(true);
  });

  it("같은 membership의 새 검색은 기존 filterKey를 현재 영수증으로 재사용하지 않는다", () => {
    const { snapshot, expected } = fixture(); snapshot.query = "another equivalent query";
    expect(evaluateGanttReadiness(snapshot, { ...expected, query: snapshot.query, queryWitness: { kind: "changed", previousFilterKey: "f1" } }).blockers).toContain("QUERY_RECEIPT_NOT_FRESH");
  });
  it.each(["UNKNOWN", "FAILED", "TIMED_OUT", "NO_SCROLL_CAPACITY"])("terminal %s는 완료 영수증이 아니다", phase => {
    const { snapshot, expected } = fixture(); snapshot.currentWork!.phase = phase;
    expect(evaluateGanttReadiness(snapshot, { ...expected, allowCancelledPriorWork: true }).ready).toBe(false);
  });
  it("취소된 과거 작업 허용은 명시 정책이며 임의 phase는 계속 거부한다", () => {
    const { snapshot, expected } = fixture(); snapshot.currentWork = { phase: "SUPERSEDED", outcome: "SUPERSEDED", apiInstance: "a" };
    expect(evaluateGanttReadiness(snapshot, expected).ready).toBe(false);
    expect(evaluateGanttReadiness(snapshot, { ...expected, allowCancelledPriorWork: true }).ready).toBe(true);
  });
  it("현재유효성은 유지한 counter-only 갱신은 stability를 바꾸지 않고 authority 변경은 바꾼다", () => {
    const { snapshot, expected } = fixture(); const before = ganttReadinessStabilityKey(snapshot);
    snapshot.latestAttempt!.generation++; snapshot.semantic!.observation++; snapshot.currentWork!.writes = 50;
    snapshot.canonical.generation = "6"; snapshot.canonical.settled = "6";
    expect(evaluateGanttReadiness(snapshot, expected).ready).toBe(true); expect(ganttReadinessStabilityKey(snapshot)).toBe(before);
    snapshot.currentWork!.gesture = 1; expect(ganttReadinessStabilityKey(snapshot)).not.toBe(before);
  });
  it("날짜축 없음이나 높이0을 날짜 이동의 준비 완료로 승인하지 않는다", () => {
    const { snapshot, expected } = fixture(); snapshot.axisExists = false; snapshot.native.clientHeight = 0;
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "date-reveal" }).blockers).toContain("DATE_AXIS_NOT_MEASURABLE");
  });

  it("WBS 초기 입력은 native 용량이 충분해도 RANGE 진행·최신 rows 대기를 허용하지 않는다", () => {
    const { snapshot, expected } = fixture();
    snapshot.core!.width = 1800;
    snapshot.native.capacity = 894;
    snapshot.currentWork = { apiInstance: "a", kind: "RANGE_EXTENSION", phase: "APPLYING" };
    const requested = { ...expected, operation: "scroll" as const, targetLeft: 120 };
    const duringRange = evaluateGanttReadiness(snapshot, requested);
    expect(duringRange.admission.accepted).toBe(true);
    expect(duringRange.ready).toBe(false);
    expect(duringRange.blockers).toContain("CURRENT_OPERATION_BUSY");
    snapshot.currentWork = { apiInstance: "a", kind: "RANGE_EXTENSION", phase: "SETTLED", outcome: "SETTLED" };
    snapshot.latestAttempt = { generation: 10, stage: "rows", outcome: "PENDING" };
    expect(evaluateGanttReadiness(snapshot, requested).blockers).toContain("LATEST_ATTEMPT_rows_PENDING");
    snapshot.latestAttempt = { generation: 10, stage: "delivery", outcome: "SETTLED" };
    expect(evaluateGanttReadiness(snapshot, requested).ready).toBe(true);
  });

  it("현재 Week SETTLED와 목표120의 수용 가능성을 구분하며 attempt와 semantic 번호를 혼동하지 않는다", () => {
    const { snapshot, expected } = fixture();
    expect(evaluateGanttReadiness(snapshot, expected).ready).toBe(true);
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "scroll", targetLeft: 120 })).toMatchObject({ contextReady: true, operationPrerequisitesReady: true, ready: false,
      admission: { coreCapacity: 46, nativeCapacity: 47, accepted: false }, blockers: ["TARGET_CORE_CAPACITY_INSUFFICIENT", "TARGET_NATIVE_CAPACITY_INSUFFICIENT"] });
  });
  it.each(["PENDING", "FAILED", "SUPERSEDED"])("마지막 성공이 남아도 최신 시도 %s를 준비 완료로 승인하지 않는다", outcome => {
    const { snapshot, expected } = fixture(); snapshot.latestAttempt = { generation: 8, stage: "rows", outcome };
    expect(evaluateGanttReadiness(snapshot, expected).ready).toBe(false);
    expect(evaluateGanttReadiness(snapshot, expected).blockers).toContain(`LATEST_ATTEMPT_rows_${outcome}`);
  });
  it.each(["api", "revision", "scale", "query", "scope", "semantic", "busy"])("현재 %s 변경을 오래된 성공으로 통과시키지 않는다", field => {
    const { snapshot, expected } = fixture();
    if (field === "api") snapshot.api = "b";
    if (field === "revision") snapshot.lastSuccess = { ...snapshot.lastSuccess!, revision: 19 };
    if (field === "scale") snapshot.coreScale = "day";
    if (field === "query") snapshot.query = "new query";
    if (field === "scope") snapshot.scope = "other-root";
    if (field === "semantic") snapshot.semantic!.semanticId = 3;
    if (field === "busy") snapshot.currentWork!.phase = "SETTLING";
    expect(evaluateGanttReadiness(snapshot, expected).contextReady).toBe(false);
  });
  it.each([119, undefined])("native120이어도 Core 용량 %s은 exact120을 승인하지 않는다", capacity => {
    const { snapshot, expected } = fixture(); snapshot.native.capacity = 120;
    snapshot.core!.width = capacity === undefined ? undefined : snapshot.core!.chartWidth! + capacity;
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "scroll", targetLeft: 120 }).blockers).toContain("TARGET_CORE_CAPACITY_INSUFFICIENT");
  });
  it("양쪽 exact120 용량을 수용하며 DOM 가상화는 logical 순서의 부분집합으로 허용한다", () => {
    const { snapshot, expected } = fixture(); snapshot.native.capacity = 120; snapshot.core!.width = snapshot.core!.chartWidth! + 120; snapshot.domIds = ["t"];
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "scroll", targetLeft: 120 }).ready).toBe(true);
    expect(evaluateGanttReadiness(snapshot, { ...expected, exactDom: true }).blockers).toContain("EXPECTED_DOM_MEMBERSHIP_MISMATCH");
  });
  it("hover/date-reveal는120 용량을 강제하지 않고 각 hit/current-axis 전제를 검사한다", () => {
    const { snapshot, expected } = fixture();
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "hover" }).ready).toBe(true);
    snapshot.hover!.hit = false;
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "hover" }).blockers).toContain("HOVER_TARGET_NOT_HITTABLE");
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "date-reveal" }).ready).toBe(true);
    snapshot.coordinate!.insideRange = false;
    expect(evaluateGanttReadiness(snapshot, { ...expected, operation: "date-reveal" }).blockers).toContain("DATE_OUTSIDE_CURRENT_AXIS");
  });
});
