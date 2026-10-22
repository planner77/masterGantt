import { projectStageGates, type StageSnapshot } from "../../../src/domain/milestones/stage-gates";
import { describe, expect, it } from "vitest";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { MILESTONE_WBS_DEFAULT_SPEC, MILESTONE_WBS_PRESETS, milestoneWbsPresentation, milestoneFullGateLabel, milestoneMetadataForReport } from "../../../src/features/milestones/milestone-wbs-dashboard-model";
import { validateWbsViewSpec } from "../../../src/features/resources/wbs-view-model";
import type { WbsViewReportDto } from "../../../src/contracts/wbs-dashboard-views";

const filters = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
describe("#732 Milestone consumer", () => {
  it.each(["direct", "target", "mixed"] as const)("retains server unions and full Gate in every preset (%s)", mode => {
    const f = wbsDashboardViewsFixture(mode);
    try {
      const before = f.state();
      for (const preset of MILESTONE_WBS_PRESETS) {
        const spec = { ...MILESTONE_WBS_DEFAULT_SPEC, levels: preset.levels };
        expect(validateWbsViewSpec(spec).ok).toBe(true);
        const data = f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto;
        const view = milestoneWbsPresentation(data);
        expect(view.tasks).toBe(data.totals.tasks);
        expect(view.assignments).toBe(data.totals.assignments);
        expect(view.fullMilestones).toBe(data.fullMilestones);
        expect(view.fullMilestones[0].stageGate.memberCount).toBe(3);
        expect(view.fullMilestones[0].stageGate.ready).toBe(false);
        expect(data.children.find(row => row.selector.id === f.tasks.get("M")!.publicId)!.taskIds).toHaveLength(3);
      }
      expect(f.state()).toEqual(before);
    } finally { f.database.close(); }
  });
  it("distinguishes selected zero tasks from actual full membership and excludes Milestone effort", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      const data = f.service.queryWbsView(f.project.publicId, { spec: MILESTONE_WBS_DEFAULT_SPEC, filters: { ...filters, taskSearch: "no matching task" } }) as WbsViewReportDto;
      const view = milestoneWbsPresentation(data);
      expect(view.tasks.taskCount).toBe(0);
      expect(view.assignments.effort.knownMd).toBe(0);
      expect(view.fullMilestones[0].stageGate.memberCount).toBe(3);
      expect(view.fullMilestones[0].stageGate.ready).toBe(false);
    } finally { f.database.close(); }
  });
  it("uses report metadata and never mixes an old Gate with a newer Milestone completion", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      const report = f.service.queryWbsView(f.project.publicId, { spec: MILESTONE_WBS_DEFAULT_SPEC, filters }) as WbsViewReportDto;
      const milestoneId = f.tasks.get("M")!.publicId;
      const originalName = report.configurationCatalog.milestones.find(row => row.id === milestoneId)!.name;
      const original = [{ taskId: milestoneId, start: "2026-10-07", status: "not_started" as const }];
      expect(milestoneMetadataForReport(report, report.projectRevision, original, milestoneId)).toEqual({
        name: originalName, start: "2026-10-07", status: "not_started", stale: false,
      });
      const changed = [{ taskId: milestoneId, name: "새 Milestone 이름", start: "2026-10-30", status: "completed" as const }];
      expect(milestoneMetadataForReport(report, report.projectRevision + 1, changed, milestoneId)).toEqual({
        name: originalName, start: null, status: null, stale: true,
      });
      expect(report.fullMilestones.find(row => row.milestoneTaskId === milestoneId)!.stageGate.ready).toBe(false);
      const refreshed = { ...report, projectRevision: report.projectRevision + 1,
        configurationCatalog: { ...report.configurationCatalog, milestones: report.configurationCatalog.milestones.map(row => row.id === milestoneId ? { ...row, name: changed[0].name } : row) } };
      expect(milestoneMetadataForReport(refreshed, refreshed.projectRevision, changed, milestoneId)).toEqual({
        name: "새 Milestone 이름", start: "2026-10-30", status: "completed", stale: false,
      });
    } finally { f.database.close(); }
  });

});

describe("Milestone full Gate independent labels", () => {
  it("keeps a manual event's predecessor Blocked and explicit completion inconsistency visible", () => {
    const snapshot: StageSnapshot = {
      tasks: ["predecessor", "manual"].map(taskId => ({ taskId, type: "milestone", parentTaskId: null, duration: 0, progress: 0, status: "not_started" })),
      memberships: [], links: [{ id: "dependency", predecessorTaskId: "predecessor", successorTaskId: "manual", type: "SS", lag: 0 }],
    };
    let gate = projectStageGates(snapshot).gates.get("manual")!;
    expect(gate).toMatchObject({ manualEvent: true, ready: null, blocked: true });
    expect(milestoneFullGateLabel(gate)).toContain("수동 이벤트 · Ready N/A");
    expect(milestoneFullGateLabel(gate)).toContain("Blocked");
    snapshot.tasks[1].status = "completed";
    gate = projectStageGates(snapshot).gates.get("manual")!;
    expect(gate.completionInconsistent).toBe(true);
    expect(milestoneFullGateLabel(gate)).toContain("완료 조건 불일치 진단");
    snapshot.tasks[0].status = "completed";
    gate = projectStageGates(snapshot).gates.get("manual")!;
    expect(milestoneFullGateLabel(gate)).not.toContain("Blocked");
    expect(milestoneFullGateLabel(gate)).not.toContain("완료 조건 불일치 진단");
  });
});
