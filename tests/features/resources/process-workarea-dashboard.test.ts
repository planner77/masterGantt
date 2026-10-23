import { describe, expect, it } from "vitest";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { PROCESS_WORKAREA_DEFAULT_SPEC, PROCESS_WORKAREA_PRESETS, processWorkareaPresentation } from "../../../src/features/resources/process-workarea-dashboard-model";
import { validateWbsViewSpec } from "../../../src/features/resources/wbs-view-model";
import type { WbsViewReportDto } from "../../../src/contracts/wbs-dashboard-views";

const filters = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
describe("#733 process consumer with the persisted WBS oracle", () => {
  it.each(["direct", "target", "mixed"] as const)("preserves authoritative unions, zero/unknown states and full Gate (%s)", mode => {
    const f = wbsDashboardViewsFixture(mode);
    try {
      const before = f.state();
      const data = f.service.queryWbsView(f.project.publicId, { spec: { ...PROCESS_WORKAREA_DEFAULT_SPEC, levels: PROCESS_WORKAREA_PRESETS[1].levels }, filters }) as WbsViewReportDto;
      const view = processWorkareaPresentation(data);
      expect(view.configuration).toBe(data.totals.configurationReference);
      expect(view.relatedMembers).toBe(data.totals.relatedMembers);
      expect(view.tasks).toBe(data.totals.tasks);
      expect(view.assignments).toBe(data.totals.assignments);
      expect(view.processCount).toBe(2);
      expect(view.projectedWorkAreaCount).toBe(2);
      expect(view.tasks.taskCount).toBe(6);
      expect(view.assignments.effort.knownMd).toBe(14);
      // Process subtotals overlap (8+9); the headline must remain the union14.
      expect(view.processRows.map(row=>row.totals.assignments.effort.knownMd).sort()).toEqual([8,9]);
      expect(view.diagnostics.personallyUnassigned.count).toBe(2);
      expect(view.fullMilestones).toHaveLength(1);
      expect(view.fullMilestones[0].stageGate.memberCount).toBe(3);
      expect(view.fullMilestones[0].stageGate.ready).toBe(false);
      expect(f.database.prepare("SELECT count(*) FROM logistics_targets WHERE project_id=?").pluck().get(f.project.id)).toBe(mode === "direct" ? 0 : 2);
      expect(f.state()).toEqual(before);
    } finally { f.database.close(); }
  });

  it("supports standalone and milestone paths without multiplying totals or leaking another process's tasks", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      for (const preset of PROCESS_WORKAREA_PRESETS) {
        const spec = { ...PROCESS_WORKAREA_DEFAULT_SPEC, levels: preset.levels };
        expect(validateWbsViewSpec(spec).ok).toBe(true);
        const data = f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto;
        const view = processWorkareaPresentation(data);
        expect(view.tasks.taskCount).toBe(6);
        expect(view.assignments.effort.knownMd).toBe(14);
        const processA = view.processRows.find(row=>row.selector.id === f.processA.publicId)!;
        const forbidden = f.tasks.get("T2")!.publicId;
        const visit = (rows: typeof data.children): void => {
          for (const row of rows) { expect(row.taskIds).not.toContain(forbidden); visit(row.children); }
        };
        visit([processA]);
        expect(view.workAreaIncluded).toBe(preset.levels.includes("workArea"));
      }
    } finally { f.database.close(); }
  });
});
