import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { WbsViewNode, WbsViewQueryInput, WbsViewReportDto, WbsViewScopeDto, WbsViewDetailsDto } from "../../../src/contracts/wbs-dashboard-views";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";

type Fixture = ReturnType<typeof fixture>;
const filters = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
const spec = (root: WbsViewQueryInput["spec"]["root"] = "milestone", levels: WbsViewQueryInput["spec"]["levels"] = []): WbsViewQueryInput["spec"] => ({ version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root, levels });
const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

/** Production read service and actual migrated SQLite, without Target bindings. */
function fixture() {
  const f = wbsDashboardViewsFixture("direct");
  cleanups.push(() => f.database.close());
  const milestone = (name: string, date: string) => f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: name, name, type: "milestone", parentId: null, scheduleMode: "auto", requestedStart: date, startDate: date, endDate: date, duration: 0, progress: 0, status: "not_started", sortOrder: f.schedules.nextRootSortOrder(f.project.id), createdAt: now, updatedAt: now });
  const predecessor = milestone("Predecessor outside selected scope", "2026-09-01");
  const memberZero = milestone("Manual member0 outside report dates", "2026-12-01");
  f.schedules.insertLink({ projectId: f.project.id, publicId: randomUUID(), predecessorTaskId: predecessor.id, successorTaskId: f.tasks.get("M")!.id, type: "FS", lag: 0, createdAt: now, updatedAt: now });
  const report = (view = spec(), extra: Partial<WbsViewQueryInput> = {}) => {
    const data = f.service.queryWbsView(f.project.publicId, { spec: view, filters, ...extra });
    expect(data?.projection).toBe("report"); return data as WbsViewReportDto;
  };
  return { ...f, predecessor, memberZero, report };
}

function node(parent: Pick<WbsViewReportDto, "children"> | WbsViewNode, dimension: WbsViewNode["selector"]["dimension"], id: string | null) {
  const value = parent.children.find(row => row.selector.dimension === dimension && row.selector.id === id);
  expect(value, `${dimension}:${id}`).toBeDefined(); return value!;
}
const ids = (f: Fixture, names: string[]) => names.map(name => f.tasks.get(name)!.publicId).sort();
const assignments = (f: Fixture, names: string[]) => names.map(name => f.assignmentIds.get(name)!).sort();
function assertScope(f: Fixture, row: Pick<WbsViewNode, "taskIds" | "assignmentIds" | "totals">, tasks: string[], assignmentNames: string[], md: number) {
  expect([...row.taskIds].sort()).toEqual(ids(f, tasks));
  expect([...row.assignmentIds].sort()).toEqual(assignments(f, assignmentNames));
  expect(row.totals.tasks.taskCount).toBe(tasks.length);
  expect(row.totals.assignments.effort.knownMd).toBe(md);
}

describe("#732 Target0 canonical Milestone read-view service integration", () => {
  it("keeps standalone, process/WorkArea/typed-instance/resource and resource/process roots on the same raw union without mutations", () => {
    const f = fixture(), before = f.state();
    const writesBefore = f.database.prepare("SELECT total_changes()").pluck().get();
    const views = [spec(), spec("milestone", ["process", "workArea", { kind: "siblings", dimensions: ["equipment", "system"] }, "resource"]), spec("milestone", ["resource", "process"])];
    const first = f.report(views[0]), firstM = node(first, "milestone", f.tasks.get("M")!.publicId);
    assertScope(f, firstM, ["T1", "T2", "T3"], ["A1", "A2", "A3"], 12);
    for (const view of views) {
      const report = f.report(view), m = node(report, "milestone", f.tasks.get("M")!.publicId);
      expect(m.taskIds).toEqual(firstM.taskIds); expect(m.assignmentIds).toEqual(firstM.assignmentIds); expect(m.totals).toEqual(firstM.totals);
      expect(report.fullMilestones).toEqual(first.fullMilestones);
      const keys: string[] = [];
      const visit = (row: WbsViewNode) => { keys.push(row.viewRowKey); row.children.forEach(visit); };
      report.children.forEach(visit); expect(new Set(keys).size).toBe(keys.length);
    }
    const chain = node(f.report(views[1]), "milestone", f.tasks.get("M")!.publicId);
    const area = node(node(chain, "process", f.processA.publicId), "workArea", f.areaId);
    expect(new Set(area.children.map(row => row.selector.dimension))).toEqual(new Set(["equipment", "system"]));
    expect(area.children.every(row => row.children.every(child => child.selector.dimension === "resource"))).toBe(true);
    expect(f.database.prepare("SELECT COUNT(*) FROM logistics_targets WHERE project_id=?").pluck().get(f.project.id)).toBe(0);
    expect(f.database.prepare("SELECT total_changes()").pluck().get()).toBe(writesBefore);
    expect(f.state()).toEqual(before);
  });

  it("preserves E1→M→T1 and E2→M→T2 intersections while the full canonical gate remains Blocked", () => {
    const f = fixture(), view = spec("equipment", ["milestone", "resource", "process"]), report = f.report(view);
    const mId = f.tasks.get("M")!.publicId;
    for (const [equipment, task, assignment, md] of [[f.equipment[0], "T1", "A1", 3], [f.equipment[1], "T2", "A2", 4]] as const) {
      const m = node(node(report, "equipment", equipment.publicId), "milestone", mId);
      assertScope(f, m, [task], [assignment], md);
      const resource = node(m, "resource", f.resources.get("R1")!.publicId);
      assertScope(f, resource, [task], [assignment], md);
      for (const kind of ["scope", "details"] as const) {
        const response = f.service.queryWbsView(f.project.publicId, { spec: view, filters, projection: { kind, snapshotId: report.snapshotId, path: resource.path, ...(kind === "details" ? { view: "assignments", offset: 0, limit: 100 } : {}) } });
        if (kind === "scope") {
          expect((response as WbsViewScopeDto).taskIds).toEqual(ids(f, [task]));
          expect((response as WbsViewScopeDto).assignmentIds).toEqual(assignments(f, [assignment]));
        } else {
          const details = response as WbsViewDetailsDto;
          expect(details.totalCount).toBe(1); expect(details.rows[0].taskId).toBe(f.tasks.get(task)!.publicId);
          expect(details.rows[0].assignment?.assignmentId).toBe(f.assignmentIds.get(assignment));
        }
      }
    }
    const gate = report.fullMilestones.find(row => row.milestoneTaskId === mId)!.stageGate;
    expect([...gate.memberTaskIds].sort()).toEqual(ids(f, ["T1", "T2", "T3"]));
    expect([...gate.incompleteMemberTaskIds].sort()).toEqual(ids(f, ["T2", "T3"]));
    expect(gate.incompletePredecessorMilestoneTaskIds).toEqual([f.predecessor.publicId]);
    expect(gate).toMatchObject({ memberCount: 3, completedMemberCount: 1, ready: false, blocked: true });
    const selected = f.report(spec(), { scope: { kind: "scheduleSelection", nodeIds: [f.tasks.get("T1")!.publicId] } });
    assertScope(f, node(selected, "milestone", mId), ["T1"], ["A1"], 3);
    expect(selected.fullMilestones).toEqual(report.fullMilestones);
  });

  it("deduplicates Task and raw Assignment unions when the same member appears under two process/WorkArea branches", () => {
    const f = fixture(), view = spec("milestone", ["process", "workArea", "resource"]), report = f.report(view);
    const m = node(report, "milestone", f.tasks.get("M")!.publicId);
    const paths = [[f.processA.publicId, f.areaId], [f.processB.publicId, f.areaBPublicId]] as const;
    for (const [processId, areaId] of paths) {
      const area = node(node(m, "process", processId), "workArea", areaId);
      assertScope(f, area, ["T3"], ["A3"], 5);
      assertScope(f, node(area, "resource", f.resources.get("R1")!.publicId), ["T3"], ["A3"], 5);
    }
    expect(paths.reduce((sum, [processId, areaId]) => sum + node(node(m, "process", processId), "workArea", areaId).totals.assignments.effort.knownMd, 0)).toBe(10);
    assertScope(f, m, ["T1", "T2", "T3"], ["A1", "A2", "A3"], 12);
    expect(new Set(m.taskIds).size).toBe(m.taskIds.length); expect(new Set(m.assignmentIds).size).toBe(m.assignmentIds.length);
    expect(f.schedules.listTasks(f.project.id).find(row => row.publicId === f.tasks.get("M")!.publicId)?.status).toBe("not_started");
  });

  it("shows dated member0 Milestone roots outside Task date/selection filters without inventing ordinary Task members", () => {
    const f = fixture();
    for (const view of [spec(), spec("milestone", ["resource", "process"])]) {
      const report = f.report(view, { scope: { kind: "scheduleSelection", nodeIds: [] } });
      for (const milestone of [f.tasks.get("M")!, f.memberZero, f.predecessor]) {
        const row = node(report, "milestone", milestone.publicId);
        expect(row.taskIds).toEqual([]); expect(row.assignmentIds).toEqual([]);
        expect(row.totals.tasks.taskCount).toBe(0);
      }
      expect(report.configurationCatalog.milestones.map(row => row.id)).toContain(f.memberZero.publicId);
      expect(report.fullMilestones.find(row => row.milestoneTaskId === f.memberZero.publicId)?.stageGate).toMatchObject({ memberCount: 0, manualEvent: true, ready: null });
    }
  });

  it("does not infer Milestone Completed from all completed members and predecessors, or from selected completion100", () => {
    const f = fixture(), mId = f.tasks.get("M")!.publicId;
    f.database.prepare("UPDATE tasks SET status='completed',progress=100 WHERE public_id IN (?,?,?)").run(f.tasks.get("T2")!.publicId, f.tasks.get("T3")!.publicId, f.predecessor.publicId);
    const before = f.state(), writesBefore = f.database.prepare("SELECT total_changes()").pluck().get();
    const report = f.report(), m = node(report, "milestone", mId);
    expect(m.totals.tasks.completion.percent).toBe(100);
    expect(report.fullMilestones.find(row => row.milestoneTaskId === mId)?.stageGate).toMatchObject({ membersCompleted: true, predecessorsCompleted: true, ready: true, blocked: false });
    expect(f.schedules.findTaskByPublicId(f.project.id, mId)).toMatchObject({ status: "not_started", progress: 0 });
    expect(f.database.prepare("SELECT total_changes()").pluck().get()).toBe(writesBefore);
    expect(f.state()).toEqual(before);
  });
});
