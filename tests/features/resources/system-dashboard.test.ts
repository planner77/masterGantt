import { describe, expect, it } from "vitest";
import { SYSTEM_DEFAULT_SPEC, SYSTEM_PRESETS, selectSystemIds, systemPresentation } from "../../../src/features/resources/system-dashboard-model";
import { validateWbsViewSpec } from "../../../src/features/resources/wbs-view-model";
import { loadWbsViewState, saveWbsViewState, type WbsViewStoredState } from "../../../src/features/resources/wbs-view-storage";
import { readWbsViewResponse } from "../../../src/features/resources/wbs-view-transport";
import { parseWbsViewQuery } from "../../../src/server/resources/wbs-dashboard-views-query-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import type { WbsViewReportDto, WbsViewSpec } from "../../../src/contracts/wbs-dashboard-views";

const filters = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
describe("#735 system consumer", () => {
  it.each(["direct", "target", "mixed"] as const)("retains authoritative unions, task0 and full Gate across three dynamic presets (%s)", mode => {
    const f = wbsDashboardViewsFixture(mode);
    try {
      const before = f.state();
      for (const preset of SYSTEM_PRESETS) {
        const spec = { ...SYSTEM_DEFAULT_SPEC, levels: preset.levels };
        expect(validateWbsViewSpec(spec).ok).toBe(true);
        const data = f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto;
        const view = systemPresentation(data);
        expect(view.tasks).toBe(data.totals.tasks);
        expect(view.configuration).toBe(data.totals.configurationReference);
        expect(view.assignments).toBe(data.totals.assignments);
        expect(view.zeroTaskSystemCount).toBeGreaterThan(0);
        expect(view.systemRows.find(row => row.selector.id === f.idleSystem.publicId)?.taskIds).toEqual([]);
        expect(view.fullMilestones).toHaveLength(1);
        expect(view.fullMilestones[0].stageGate.memberCount).toBe(3);
        expect(view.fullMilestones[0].stageGate.ready).toBe(false);
        expect(view.assignments.effort.knownMd).toBe(14);
      }
      expect(f.state()).toEqual(before);
    } finally { f.database.close(); }
  });
  it("selects canonical attribute IDs, including empty intersections, without fabricating relationship filters", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      const logistics = new LogisticsService(f.database).getLogisticsDto(f.project.id);
      expect(selectSystemIds(logistics, {})).toEqual(logistics.systems.map(row => row.id).sort());
      expect(selectSystemIds(logistics, { layer: "controller" })).toEqual(f.systems.slice(0, 2).map(row => row.publicId).sort());
      expect(selectSystemIds(logistics, { layer: "controller", type: "mcs" })).toEqual([]);
      expect(selectSystemIds(logistics, { scope: "project", process: f.processA.publicId })).toEqual([]);
      expect(selectSystemIds(logistics, { pi: "missing", developer: "missing" })).toHaveLength(logistics.systems.length);
    } finally { f.database.close(); }
  });
  it("normalizes system spec like the server and preserves selection through level changes and storage", () => {
    const id = "aa000000-0000-4000-8000-000000000001";
    for (const value of [ { ...SYSTEM_DEFAULT_SPEC, systemView: "coordination", systemIds: [id, id] }, { ...SYSTEM_DEFAULT_SPEC, systemIds: [] }, { ...SYSTEM_DEFAULT_SPEC }, { ...SYSTEM_DEFAULT_SPEC, systemView: "invalid" }, { ...SYSTEM_DEFAULT_SPEC, systemIds: ["bad"] }, { ...SYSTEM_DEFAULT_SPEC, root: "process", systemView: "direct" } ]) {
      const checked = validateWbsViewSpec(value);
      let server: WbsViewSpec | null = null;
      try { server = parseWbsViewQuery({ spec: value }).spec; } catch {}
      expect(checked.ok).toBe(!!server);
      if (checked.ok) expect(checked.spec).toEqual(server);
    }
    let saved = "";
    const storage = { getItem: () => saved || null, setItem: (_key: string, value: string) => { saved = value; } };
    for (const ids of [[], [id]]) {
      const spec: WbsViewSpec = { ...SYSTEM_DEFAULT_SPEC, levels: SYSTEM_PRESETS[1].levels, systemView: "coordination", systemIds: ids };
      const checked = validateWbsViewSpec({ ...spec, levels: SYSTEM_PRESETS[2].levels });
      expect(checked.ok && checked.spec.systemIds).toEqual(ids);
      expect(checked.ok && checked.spec.systemView).toBe("coordination");
      const state: WbsViewStoredState = { spec, filters: {}, expanded: [], selected: null, scroll: { top: 17, left: 22 }, focus: null };
      expect(saveWbsViewState(storage, "project", "system", state).warning).toBeNull();
      expect(loadWbsViewState(storage, "project", "system").state).toEqual(state);
    }
  });
  it("rejects a report echoed with another system mode or explicit-empty selection", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      const input = { spec: { ...SYSTEM_DEFAULT_SPEC, systemView: "direct" as const }, filters };
      const data = f.service.queryWbsView(f.project.publicId, input) as WbsViewReportDto;
      const options = { projectPublicId: f.project.publicId, projectRevision: data.projectRevision, input };
      expect(readWbsViewResponse({ data }, options)).toBe(data);
      expect(() => readWbsViewResponse({ data }, { ...options, input: { ...input, spec: { ...input.spec, systemView: "coordination" } } })).toThrow();
      expect(() => readWbsViewResponse({ data }, { ...options, input: { ...input, spec: { ...input.spec, systemIds: [] } } })).toThrow();
    } finally { f.database.close(); }
  });
});
