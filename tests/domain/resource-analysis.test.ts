import { describe, expect, it } from "vitest";
import { acceptResourceAnalysisResponse, assertResourceAnalysisSource, buildResourceAnalysis, rankResourceAnalysisCells, rankResourceAnalysisOverload, selectResourceAnalysisDetails, selectResourceAnalysisPlanDetails } from "../../src/domain/resources/resource-analysis";
import type { ResourceAnalysisQuery, ResourceAnalysisSource } from "../../src/contracts/resource-analysis";
import { resolveWbsTaskLedger, selectWbsTaskLedger, summarizeWbsTaskLedger } from "../../src/domain/resources/wbs-task-ledger";
import { wbsTaskLedgerFixture, ledgerMembership } from "../fixtures/wbs-task-ledger";
import { resourceKpiTask } from "../fixtures/resource-kpi";

const sourceFor = (ledger = wbsTaskLedgerFixture()): ResourceAnalysisSource => ({ fetchGeneration: 1, filters: ledger.kpi.filters ?? {}, sourceContext: {
  schema: "wbs-view-source/1", contextSourceVersion: "explicit-task-context:v1", snapshotId: "wbs-snapshot", dataSnapshotId: "canonical-snapshot",
  projectPublicId: ledger.kpi.projectPublicId, projectRevision: 1, catalogRevision: 2, calendarRevision: "calendar-snapshot",
  spec: { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "resource" }, path: [],
  range: { from: ledger.kpi.from, to: ledger.kpi.to }, asOfDate: ledger.kpi.asOfDate, mdPerMm: ledger.kpi.mdPerMm ?? null, mdPerMmSource: "query", mdPerMmProvided: true,
} });
const build = (query: ResourceAnalysisQuery = {}, ledger = wbsTaskLedgerFixture(), source = sourceFor(ledger)) => buildResourceAnalysis({ ledger, query, source, expectedSource: source });

describe("Resource analysis canonical read model", () => {
  it("keeps WBS UI/Excel source Task and Assignment sets and raw KPI totals exactly", () => {
    const ledger = wbsTaskLedgerFixture(), prepared = resolveWbsTaskLedger(ledger), selected = selectWbsTaskLedger(prepared);
    const expected = summarizeWbsTaskLedger(prepared, selected), model = build({}, ledger);
    expect(model.total.taskIds).toEqual(selected.taskIds);
    expect(model.total.assignmentIds).toEqual(selected.assignmentIds);
    expect(model.total.assignments).toEqual(expected.assignments);
    expect(model.total.tasks).toEqual(expected.tasks);
    expect(model.fullMilestones).toEqual(expected.fullMilestones);
    expect(model.diagnostics).toEqual(expected.diagnostics);
    expect(model.plan.totals.summary.selected.knownMd).toBe(expected.assignments.effort.knownMd);
    expect(selectResourceAnalysisDetails(model, model.total.selector, model.scope.source).assignmentIds).toEqual(selected.assignmentIds);
    expect(model.metadata.subtotalsAdditive).toBe(false);
  });
  it("keeps shared5 MD across physical paths, then co-assignment7.5 without summing pivots", () => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.assignments = [{ assignmentId: "A3", taskId: "T3", kind: "resource", targetId: "R1", allocationPercent: 100 }];
    const model = build({ pivot: ["process", "workArea"] }, ledger);
    expect(model.total.assignments.effort.knownMd).toBe(5);
    expect(model.cells.filter(cell => cell.assignmentIds.includes("A3")).length).toBeGreaterThan(1);
    expect(model.cells.reduce((sum, cell) => sum + cell.assignments.effort.knownMd, 0)).toBeGreaterThan(5);
    ledger.kpi.assignments = [...ledger.kpi.assignments, { assignmentId: "CO", taskId: "T3", kind: "resource", targetId: "R2", allocationPercent: 50 }];
    const joint = build({ pivot: ["equipment", "milestone"] }, ledger);
    expect(joint.total.assignments.effort.knownMd).toBe(7.5);
    expect(joint.total.assignments.taskCount).toBe(1);
    expect(joint.total.assignments.assignmentCount).toBe(2);
  });
  it("uses same-axis OR, different-axis AND and matches classification on one actual assignee", () => {
    const ledger = wbsTaskLedgerFixture();
    const model = build({ conditions: { process: ["PA", "PB", "PA"], role: ["DEVELOPER"], developerGrade: ["ADVANCED"] }, pivot: ["group", "resource"] }, ledger);
    expect(model.total.assignmentIds).toEqual(["A1", "A2", "A3"]);
    expect(model.scope.conditions.process).toEqual(["PA", "PB"]);
    expect(build({ conditions: { resource: ["R2"], role: ["DEVELOPER"] } }, ledger).total.assignmentIds).toEqual([]);
    expect(model.cells.filter(cell => cell.assignmentIds.includes("A3")).length).toBe(2);
    expect(build({ conditions: { process: ["PA"], workArea: ["WB"] } }, ledger).total.assignmentIds).toEqual(["A3"]);
  });
  it("retains registered/role-only participation separately and never gives it capacity or effort", () => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.resources = [...ledger.kpi.resources, { resourceId: "IDLE", name: "same name", groupIds: ["G1"], roles: ["PI"], developerGrade: "ADVANCED" }];
    ledger.resourceMemberships = [...ledger.resourceMemberships, ledgerMembership("IDLE")];
    const model = build({ pivot: ["resource"] }, ledger);
    expect(model.participation.registeredResourceIds).toContain("IDLE");
    expect(model.plan.population.resourceIds).toEqual(["R1"]);
    expect(model.cells.find(cell => cell.values[0].id === "IDLE")?.assignments.effort).toMatchObject({ plannedMd: 0, state: "empty" });
    expect(model.diagnostics.personallyUnassigned.taskIds).toContain("UNASSIGNED");
    expect(model.diagnostics.personallyUnassigned.taskIds).toContain("GROUP_ONLY");
  });
  it("preserves selected80 versus same-person full-project140, individual peak and overload rank", () => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.tasks = [resourceKpiTask("A", { duration: 5 }), resourceKpiTask("B", { duration: 5 })];
    ledger.taskContexts = ledger.kpi.tasks.map(task => ({ taskId: task.taskId, processLinks: [], workAreaLinks: [] }));
    ledger.kpi.memberships = []; ledger.kpi.logistics.legacy = [];
    ledger.kpi.assignments = [{ assignmentId: "AA", taskId: "A", kind: "resource", targetId: "R1", allocationPercent: 80 }, { assignmentId: "BB", taskId: "B", kind: "resource", targetId: "R1", allocationPercent: 60 }];
    ledger.kpi.filters = { taskIds: ["A"] };
    const model = build({}, ledger);
    expect(model.plan.totals.summary.selected.loadPercent).toBe(80);
    expect(model.plan.totals.summary.project.loadPercent).toBe(140);
    expect(model.plan.totals.summary.project.peakResourceDailyLoadPercent).toBe(140);
    expect(model.plan.totals.summary.project.overAllocatedDayCount).toBe(5);
    expect(model.plan.totals.summary.project.excessMd).toBeCloseTo(2);
    const projectRank = rankResourceAnalysisOverload(model, 1);
    expect(projectRank.rows[0].resourceId).toBe("R1");
    expect(selectResourceAnalysisPlanDetails(model, projectRank.rows[0].selector, model.scope.source).assignmentIds).toEqual(["AA", "BB"]);
    expect(selectResourceAnalysisPlanDetails(model, rankResourceAnalysisOverload(model, 1, "selected").rows[0].selector, model.scope.source).assignmentIds).toEqual(["AA"]);
  });
  it("preserves status-filter denominators and T0 diagnostics before personal conditions", () => {
    const ledger = wbsTaskLedgerFixture(); ledger.kpi.filters = { statuses: ["completed"] };
    const model = build({ conditions: { resource: ["R2"] } }, ledger);
    expect(model.total.tasks.completion).toMatchObject({ numerator: 0, denominator: 0, percent: null });
    expect(model.diagnostics).toMatchObject({ denominator: 1, taskIds: ["T1"] });
    expect(model.diagnostics.inapplicableFilters).toContain("resourceIds");
  });
  it("preserves all-unset, partial, configured nonworking0, empty and missing MM basis", () => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.assignments = [{ assignmentId: "A3", taskId: "T3", kind: "resource", targetId: "R1", allocationPercent: null }];
    ledger.kpi.mdPerMm = null;
    let model = build({}, ledger);
    expect(model.total.assignments.effort).toMatchObject({ plannedMd: null, plannedMm: null, state: "unset", partial: true });
    ledger.kpi.assignments = [...ledger.kpi.assignments, { assignmentId: "A2", taskId: "T2", kind: "resource", targetId: "R1", allocationPercent: 50 }];
    model = build({}, ledger);
    expect(model.total.assignments.effort).toMatchObject({ plannedMd: 2.5, plannedMm: null, state: "partial", unsetCount: 1 });
    ledger.kpi.from = "2026-10-10"; ledger.kpi.to = "2026-10-11";
    ledger.kpi.tasks = ledger.kpi.tasks.map(task => task.type === "task" ? { ...task, start: ledger.kpi.from, end: ledger.kpi.to } : task);
    ledger.kpi.assignments = ledger.kpi.assignments.slice(1);
    model = build({}, ledger);
    expect(model.total.assignments.effort).toMatchObject({ plannedMd: 0, state: "configured" });
    expect(model.plan.totals.summary.selected).toMatchObject({ capacityMd: 0, loadPercent: null });
    expect(build({ conditions: { resource: ["R2"] } }, ledger).total.assignments.effort.state).toBe("empty");
  });
  it("uses existing clipped ISO-year/month periods and calendar overrides without new formulas", () => {
    const ledger = wbsTaskLedgerFixture(); ledger.kpi.from = "2026-12-31"; ledger.kpi.to = "2027-01-04";
    ledger.kpi.tasks = ledger.kpi.tasks.map(task => task.type === "task" ? { ...task, start: ledger.kpi.from, end: ledger.kpi.to } : task);
    const weekly = build({ granularity: "week" }, ledger), monthly = build({ granularity: "month" }, ledger);
    expect(weekly.plan.periods.map(period => period.key)).toEqual(["2026-W53", "2027-W01"]);
    expect(monthly.plan.periods.map(period => period.key)).toEqual(["2026-12", "2027-01"]);
    expect(weekly.plan.periods[0].partial).toBe(true);
    expect(weekly.plan.totals.cells.reduce((sum, cell) => sum + cell.selected.knownMd, 0)).toBeCloseTo(weekly.total.assignments.effort.knownMd);
  });
  it("returns stable exact selectors and deterministic topN without an invented Other subtotal", () => {
    const model = build({ pivot: ["resource", "milestone"] });
    const ranked = rankResourceAnalysisCells(model, "knownMd", 1);
    expect(ranked.omittedCellCount).toBe(model.cells.length - 1);
    expect(ranked.total).toBe(model.total);
    const detail = selectResourceAnalysisDetails(model, ranked.cells[0].selector, model.scope.source);
    expect(detail.assignments.map(row => row.assignmentId)).toEqual(ranked.cells[0].assignmentIds);
    expect(() => selectResourceAnalysisDetails(model, { ...model.total.selector, scopeKey: "another" }, model.scope.source)).toThrow("SOURCE_MISMATCH");
    expect(() => rankResourceAnalysisCells(model, "knownMd", 0)).toThrow("INVALID_QUERY");
  });
  it("rejects unknown IDs, public Target axes, invalid ranges, missing/MM-mixed source and excessive pivots", () => {
    expect(() => build({ conditions: { resource: ["unknown"] } })).toThrow();
    expect(() => build({ conditions: { developerGrade: ["unknown"] } })).toThrow("INVALID_SELECTION");
    expect(() => build({ conditions: { target: ["revived"] } } as never)).toThrow("INVALID_QUERY");
    expect(() => build({ pivot: ["resource", "group", "role"] })).toThrow("INVALID_QUERY");
    const ledger = wbsTaskLedgerFixture(); ledger.kpi.from = "2026-11-01";
    expect(() => build({}, ledger)).toThrow();
    const source = sourceFor(); source.sourceContext.mdPerMm = 19;
    expect(() => build({}, wbsTaskLedgerFixture(), source)).toThrow("SOURCE_MISMATCH");
  });
  it("clears stale, future, mixed snapshot and401/403/412/error replies and accepts only current generation", () => {
    const model = build(), source = model.scope.source, expected = { source, scopeKey: model.scope.scopeKey };
    expect(acceptResourceAnalysisResponse(expected, { status: 200, source, data: model })).toBe(model);
    for (const generation of [0, 2]) expect(acceptResourceAnalysisResponse({ ...expected, source: { ...source, fetchGeneration: generation } }, { status: 200, source, data: model })).toBeNull();
    for (const status of [401, 403, 412, 409, 500]) expect(acceptResourceAnalysisResponse(expected, { status, source, data: model })).toBeNull();
    const different = { ...source, sourceContext: { ...source.sourceContext, snapshotId: "legacy-resource-snapshot" } };
    expect(() => assertResourceAnalysisSource(source, different)).toThrow("SOURCE_MISMATCH");
    expect(acceptResourceAnalysisResponse(expected, { status: 200, source: different, data: model })).toBeNull();
    expect(acceptResourceAnalysisResponse(expected, { status: 200 })).toBeNull();
  });

  it("binds exact existing WBS source selection without broadening co-assignees or Plan project reference", () => {
    const ledger = wbsTaskLedgerFixture(), source = sourceFor(ledger);
    source.sourceContext.path = [{ dimension: "resource", id: "R1" }];
    source.sourceContext.scope = { kind: "exactAssignments", assignmentIds: ["A3"] };
    expect(() => buildResourceAnalysis({ ledger, source, expectedSource: source })).toThrow("SOURCE_MISMATCH");
    const model = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope: { source, taskIds: ["T3"], assignmentIds: ["A3"], diagnosticTaskIds: ["T3"], taskRows: selectWbsTaskLedger(resolveWbsTaskLedger(ledger), [{ dimension: "resource", id: "R1" }]).rows.filter(row => row.taskId === "T3") }, query: { pivot: ["group"] } });
    expect(model.total.taskIds).toEqual(["T3"]);
    expect(model.total.assignmentIds).toEqual(["A3"]);
    expect(model.plan.population.resourceIds).toEqual(["R1"]);
    expect(model.plan.totals.summary.selected.knownMd).toBe(5);
    expect(model.plan.totals.summary.project.knownMd).toBe(14);
    expect(model.diagnostics.taskIds).toEqual(["T3"]);
    const changed = { ...source, filters: { statuses: ["completed"] as const } };
    expect(() => buildResourceAnalysis({ ledger, source: changed, expectedSource: changed })).toThrow("SOURCE_MISMATCH");
    expect(() => buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope: { source, taskIds: ["T1"], assignmentIds: ["A3"], diagnosticTaskIds: ["T3"], taskRows: [] } })).toThrow("INVALID_SELECTION");
  });
  it("rejects a same-generation reply for changed conditions, pivot, period or unit", () => {
    const model = build(), expected = { source: model.scope.source, scopeKey: model.scope.scopeKey };
    for (const query of [{ conditions: { resource: ["R1"] } }, { pivot: ["group"] }, { granularity: "month" }, { unit: "M/M" }] as ResourceAnalysisQuery[]) {
      const changed = build(query);
      expect(acceptResourceAnalysisResponse(expected, { status: 200, source: changed.scope.source, data: changed })).toBeNull();
    }
  });

  it("keeps the original narrowed physical selector rows in OR unions and safe detail output", () => {
    const ledger = wbsTaskLedgerFixture(), prepared = resolveWbsTaskLedger(ledger);
    const selected = selectWbsTaskLedger(prepared, [{ dimension: "equipment", id: "E10" }]);
    const model = build({ conditions: { equipment: ["E10"] } }, ledger);
    expect(model.taskSources.map(row => [row.taskId, row.equipmentIds])).toEqual(selected.rows.map(row => [row.taskId, row.equipmentIds]));
    expect(selectResourceAnalysisDetails(model, model.total.selector, model.scope.source).tasks[0].equipmentIds).toEqual(["E10"]);
    expect(build({ conditions: { equipment: ["E10", "E5"] } }, ledger).taskSources[0].equipmentIds).toEqual(["E10", "E5"]);
    for (const row of model.taskSources) {
      expect(row).not.toHaveProperty("targetIds"); expect(row).not.toHaveProperty("targetSources"); expect(row).not.toHaveProperty("sources");
    }
    const source = sourceFor(ledger); source.sourceContext.path = [{ dimension: "equipment", id: "E10" }];
    const bound = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope: { source, taskIds: selected.taskIds, assignmentIds: selected.assignmentIds, diagnosticTaskIds: selected.selection.t0.map(row => row.taskId), taskRows: selected.rows } });
    expect(bound.taskSources[0].equipmentIds).toEqual(["E10"]);
    expect(bound.scope.scopeKey).not.toContain("targetSources");
    const disjoint = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope: { source, taskIds: selected.taskIds, assignmentIds: selected.assignmentIds, diagnosticTaskIds: selected.selection.t0.map(row => row.taskId), taskRows: selected.rows }, query: { conditions: { equipment: ["E5"] } } });
    expect(disjoint.total.assignmentIds).toEqual([]);
  });

  it("keeps selected Group display scoped while retaining full calendar membership", () => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.calendarExceptions = [{ date: "2026-10-05", dayType: "NON_WORKING", targetType: "RESOURCE_GROUP", targetId: "G2", ruleId: "off", ruleName: "off" }];
    const model = build({ conditions: { group: ["G1"] }, pivot: ["group"] }, ledger);
    expect(model.plan.groups.map(row => row.groupId)).toEqual(["G1"]);
    expect(model.plan.totals.summary.selected.capacityMd).toBe(4);
    expect(model.diagnostics.personalFiltersAppliedToA).toBe(true);
    ledger.kpi.filters = { groupIds: ["G2"] };
    expect(build({}, ledger).plan.groups.map(row => row.groupId)).toEqual(["G2"]);
  });

  it("keeps pivot-cell physical detail exact even when its total contains several instances", () => {
    const model = build({ pivot: ["equipment", "workArea"] });
    const cell = model.cells.find(row => row.values[0].id === "E10" && row.values[1].id === "WB")!;
    const detail = selectResourceAnalysisDetails(model, cell.selector, model.scope.source);
    expect(detail.tasks).toHaveLength(1);
    expect(detail.tasks[0].equipmentIds).toEqual(["E10"]);
    expect(detail.tasks[0].workAreaIds).toEqual(["WB"]);
    expect(model.taskSources.find(row => row.taskId === "T3")!.equipmentIds).toEqual(["E10", "E5"]);
    expect(detail.tasks[0].assignmentIds).toEqual(cell.assignmentIds);
  });
  it("rejects UTF8 reports above the existing 2MiB limit, preserving bounded Plan/cell budgets", () => {
    const ledger = wbsTaskLedgerFixture(), groups = Array.from({ length: 32 }, (_, index) => `G${index}`);
    ledger.kpi.resources = ledger.kpi.resources.map(row => row.resourceId === "R1" ? { ...row, groupIds: groups } : row);
    ledger.kpi.tasks = Array.from({ length: 500 }, (_, index) => resourceKpiTask(`T${index}`, { duration: 5, name: `한글이름${index}` }));
    ledger.kpi.assignments = ledger.kpi.tasks.map(task => ({ assignmentId: `A${task.taskId}`, taskId: task.taskId, kind: "resource", targetId: "R1", allocationPercent: 1 }));
    ledger.taskContexts = ledger.kpi.tasks.map(task => ({ taskId: task.taskId, processLinks: [], workAreaLinks: [] }));
    ledger.kpi.memberships = []; ledger.kpi.logistics.legacy = [];
    expect(() => build({ pivot: ["group"] }, ledger)).toThrow("ANALYSIS_LIMIT_EXCEEDED");
    expect(() => build({ conditions: { group: Array.from({ length: 201 }, () => "G1") } })).toThrow("ANALYSIS_LIMIT_EXCEEDED");
    expect(() => build({ conditions: { group: Array.from({ length: 200 }, () => "G1"), resource: Array.from({ length: 200 }, () => "R1"), role: ["DEVELOPER"] } })).toThrow("ANALYSIS_LIMIT_EXCEEDED");
  });

  it("keeps source personal A separate from source T0 diagnostic Tasks", () => {
    const ledger = wbsTaskLedgerFixture(), prepared = resolveWbsTaskLedger(ledger), source = sourceFor(ledger);
    source.sourceContext.path = [{ dimension: "resource", id: "R1" }];
    const selected = selectWbsTaskLedger(prepared, source.sourceContext.path), expected = summarizeWbsTaskLedger(prepared, selected);
    const sourceScope = { source, taskIds: selected.taskIds, assignmentIds: selected.assignmentIds, diagnosticTaskIds: selected.selection.t0.map(row => row.taskId), taskRows: selected.rows };
    const model = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope });
    expect(model.total.taskIds).toHaveLength(4);
    expect(model.diagnostics).toMatchObject({ denominator: 6, personallyUnassigned: { count: 2 } });
    expect(model.diagnostics.taskIds).toEqual(expected.diagnostics.taskIds);
    expect(model.diagnostics.personalFiltersAppliedToA).toBe(true);
    const empty = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope, query: { conditions: { resource: ["R2"] } } });
    expect(empty.total.assignmentIds).toEqual([]);
    expect(empty.diagnostics.denominator).toBe(6);
  });

  it("removes a co-assigned Task when source and query retain no matching personal Assignment", () => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.assignments = [...ledger.kpi.assignments, { assignmentId: "CO", taskId: "T3", kind: "resource", targetId: "R2", allocationPercent: 50 }];
    const snapshot = resolveWbsTaskLedger(ledger), source = sourceFor(ledger);
    source.sourceContext.path = [{ dimension: "resource", id: "R1" }];
    const selected = selectWbsTaskLedger(snapshot, source.sourceContext.path);
    const model = buildResourceAnalysis({ ledger, source, expectedSource: source,
      sourceScope: { source, taskIds: selected.taskIds, assignmentIds: selected.assignmentIds, diagnosticTaskIds: selected.selection.t0.map(row => row.taskId), taskRows: selected.rows },
      query: { conditions: { resource: ["R2"] } } });
    expect(model.total.assignmentIds).toEqual([]);
    expect(model.total.taskIds).toEqual([]);
    expect(model.total.tasks.completion).toEqual({ numerator: 0, denominator: 0, percent: null });
    expect(model.diagnostics).toMatchObject({ denominator: 6, personallyUnassigned: { count: 2 } });
  });
  it.each(["resource", "group", "role"] as const)("provides the %s null pivot and exact detail for Tasks without personal Assignments", dimension => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.resources = ledger.kpi.resources.map(resource => ({ ...resource, groupIds: ["G1"], roles: ["DEVELOPER"] }));
    const model = build({ pivot: [dimension] }, ledger);
    expect(model.total.taskIds).toHaveLength(6);
    const emptyPerson = model.cells.find(cell => cell.values[0].id === null);
    expect(emptyPerson).toBeDefined();
    expect(emptyPerson!.taskIds).toEqual(["GROUP_ONLY", "UNASSIGNED"]);
    expect(emptyPerson!.assignments.effort).toMatchObject({ plannedMd: 0, state: "empty" });
    const detail = selectResourceAnalysisDetails(model, emptyPerson!.selector, model.scope.source);
    expect(detail.taskIds).toEqual(emptyPerson!.taskIds);
    expect(detail.assignmentIds).toEqual([]);
  });

  it.each([
    { dimension: "resource" as const, id: "R2" },
    { dimension: "group" as const, id: "G3" },
    { dimension: "role" as const, id: "PI" },
    { dimension: "developerGrade" as const, id: "BEGINNER" },
  ])("requires the same retained Assignment for source R1 and $dimension=$id", ({ dimension, id }) => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.resources = ledger.kpi.resources.map(resource => resource.resourceId === "R2" ? { ...resource, groupIds: ["G3"], roles: ["PI"], developerGrade: "BEGINNER" } : resource);
    ledger.kpi.assignments = [...ledger.kpi.assignments, { assignmentId: "CO", taskId: "T3", kind: "resource", targetId: "R2", allocationPercent: 50 }];
    const source = sourceFor(ledger); source.sourceContext.path = [{ dimension: "resource", id: "R1" }];
    const selected = selectWbsTaskLedger(resolveWbsTaskLedger(ledger), source.sourceContext.path);
    const sourceScope = { source, taskIds: selected.taskIds, assignmentIds: selected.assignmentIds, diagnosticTaskIds: selected.selection.t0.map(row => row.taskId), taskRows: selected.rows };
    const empty = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope, query: { conditions: { [dimension]: [id] }, pivot: ["resource", "milestone"] } });
    expect(empty.total).toMatchObject({ taskIds: [], assignmentIds: [], tasks: { taskCount: 0, completion: { denominator: 0, percent: null } } });
    expect(empty.cells.every(cell => cell.taskIds.length === 0 && cell.assignmentIds.length === 0)).toBe(true);
    expect(empty.taskSources).toEqual([]);
    expect(empty.diagnostics).toMatchObject({ denominator: 6, personallyUnassigned: { count: 2 } });
    expect(selectResourceAnalysisDetails(empty, empty.total.selector, source).taskIds).toEqual([]);
    const positive = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope,
      query: { conditions: { resource: ["R1", "R2"], group: ["G1", "G3"], role: ["DEVELOPER", "PI"], developerGrade: ["ADVANCED", "BEGINNER"] } } });
    expect(positive.total.assignmentIds).toEqual(["A0", "A1", "A2", "A3"]);
    expect(positive.total.taskIds).toHaveLength(4);
    expect(positive.plan.population.resourceIds).toEqual(["R1"]);
  });
  it.each(["resource", "group", "role"] as const)("preserves intentional source %s:null Tasks, T0 and empty capacity", dimension => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.resources = ledger.kpi.resources.map(resource => ({ ...resource, groupIds: ["G1"], roles: ["DEVELOPER"] }));
    const source = sourceFor(ledger); source.sourceContext.path = [{ dimension, id: null }];
    const selected = selectWbsTaskLedger(resolveWbsTaskLedger(ledger), source.sourceContext.path);
    const model = buildResourceAnalysis({ ledger, source, expectedSource: source,
      sourceScope: { source, taskIds: selected.taskIds, assignmentIds: selected.assignmentIds, diagnosticTaskIds: selected.selection.t0.map(row => row.taskId), taskRows: selected.rows },
      query: { conditions: { [dimension]: [null] }, pivot: ["resource", "role"] } });
    expect(model.total.taskIds).toEqual(["GROUP_ONLY", "UNASSIGNED"]);
    expect(model.total.assignmentIds).toEqual([]);
    expect(model.total.assignments.effort).toMatchObject({ plannedMd: 0, state: "empty" });
    expect(model.diagnostics).toMatchObject({ denominator: 6, personallyUnassigned: { count: 2 } });
    expect(model.plan.population.resourceIds).toEqual([]);
    expect(model.plan.totals.summary.selected).toMatchObject({ capacityMd: 0, loadPercent: null });
    const cell = model.cells.find(row => row.values.every(value => value.id === null));
    expect(cell?.taskIds).toEqual(model.total.taskIds);
    expect(selectResourceAnalysisDetails(model, cell!.selector, source).taskIds).toEqual(model.total.taskIds);
  });
  it("recomputes exact-Assignment source Task scope without shrinking its diagnostic Task scope", () => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.resources = ledger.kpi.resources.map(resource => resource.resourceId === "R2" ? { ...resource, groupIds: ["G3"], roles: ["PI"] } : resource);
    ledger.kpi.assignments = [...ledger.kpi.assignments, { assignmentId: "CO", taskId: "T3", kind: "resource", targetId: "R2", allocationPercent: 50 }];
    const snapshot = resolveWbsTaskLedger(ledger), selected = selectWbsTaskLedger(snapshot, [{ dimension: "resource", id: "R1" }]);
    const source = sourceFor(ledger); source.sourceContext.scope = { kind: "exactAssignments", assignmentIds: ["A3"] };
    const sourceScope = { source, taskIds: ["T3"], assignmentIds: ["A3"], diagnosticTaskIds: ["T3"], taskRows: selected.rows.filter(row => row.taskId === "T3") };
    const empty = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope, query: { conditions: { role: ["PI"] } } });
    expect(empty.total.taskIds).toEqual([]);
    expect(empty.total.tasks.completion.denominator).toBe(0);
    expect(empty.diagnostics).toMatchObject({ denominator: 1, taskIds: ["T3"], personallyUnassigned: { count: 0 } });
    const retained = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope, query: { conditions: { role: ["DEVELOPER"] } } });
    expect(retained.total.taskIds).toEqual(["T3"]);
    expect(retained.total.assignmentIds).toEqual(["A3"]);
    expect(retained.plan.population.resourceIds).toEqual(["R1"]);
    expect(retained.plan.totals.summary.project.knownMd).toBe(14);
  });

  it.each([
    { dimension: "group" as const, id: "G1" },
    { dimension: "role" as const, id: "DEVELOPER" },
  ])("intersects a $dimension source path with query Assignment identities before Task counts", ({ dimension, id }) => {
    const ledger = wbsTaskLedgerFixture();
    ledger.kpi.resources = ledger.kpi.resources.map(resource => resource.resourceId === "R2" ? { ...resource, groupIds: ["G3"], roles: ["PI"], developerGrade: "BEGINNER" } : resource);
    ledger.kpi.assignments = [...ledger.kpi.assignments, { assignmentId: "CO", taskId: "T3", kind: "resource", targetId: "R2", allocationPercent: 50 }];
    const source = sourceFor(ledger); source.sourceContext.path = [{ dimension, id }];
    const selected = selectWbsTaskLedger(resolveWbsTaskLedger(ledger), source.sourceContext.path);
    const sourceScope = { source, taskIds: selected.taskIds, assignmentIds: selected.assignmentIds, diagnosticTaskIds: selected.selection.t0.map(row => row.taskId), taskRows: selected.rows };
    const model = buildResourceAnalysis({ ledger, source, expectedSource: source, sourceScope, query: { conditions: { resource: ["R2"] }, pivot: ["group", "role"] } });
    expect(model.total).toMatchObject({ taskIds: [], assignmentIds: [], tasks: { completion: { denominator: 0, percent: null } } });
    expect(model.cells.every(cell => cell.taskIds.length === 0)).toBe(true);
    expect(model.diagnostics).toMatchObject({ denominator: 6, personallyUnassigned: { count: 2 } });
  });
  it("does not mutate the caller's canonical collections or source context", () => {
    const ledger = wbsTaskLedgerFixture(), source = sourceFor(ledger), before = JSON.stringify({ ledger, source });
    build({ conditions: { process: ["PB", "PA"] }, pivot: ["role", "developerGrade"] }, ledger, source);
    expect(JSON.stringify({ ledger, source })).toBe(before);
  });
});
