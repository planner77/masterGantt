import { describe, it, expect } from "vitest";
import {
  planUiFixture,
  planDetailsUiFixture,
  planId,
} from "../../fixtures/resource-plan-ui";
import {
  flattenPlanRows,
  planDetailQuery,
  planMetric,
  readPlanDetails,
} from "../../../src/features/resources/resource-plan-model";
import { readDashboard } from "../../../src/features/resources/resource-dashboard-model";
import type { StatefulProjectFixture } from "../../fixtures/stateful-project";
const state = {
  project: { publicId: "a3405d3d-8cb4-4da4-9b0f-43a5de330003", revision: 40 },
  tasks: [
    {},
    {},
    {
      taskId: "00000000-0000-4000-8000-000000000003",
      name: "Stable leaf",
      externalId: "LEAF-1",
    },
  ],
} as StatefulProjectFixture;
describe("Resource Plan UI scope and snapshot contract", () => {
  it("accepts opt-in plan with 0load capacity R independent of Milestone and keeps 54 clipped weeks", () => {
    const query = new URLSearchParams(
        `mode=group&granularity=week&milestoneIds=${planId(4, 0)}`,
      ),
      { data } = planUiFixture(state, query);
    expect(
      readDashboard({ data }, state.project.publicId, query),
    ).not.toBeNull();
    expect(data.plan!.periods).toHaveLength(54);
    expect(data.plan!.population.resourceCount).toBe(8);
    expect(data.plan!.resources.at(-1)!.summary.selected.loadPercent).toBe(0);
    expect(data.plan!.resources[0].summary.selected.loadPercent).toBeCloseTo(
      80,
    );
    expect(data.plan!.resources[0].summary.project.loadPercent).toBeCloseTo(
      140,
    );
    expect(
      readDashboard(
        { data: { ...data, plan: { ...data.plan, granularity: "month" } } },
        state.project.publicId,
        query,
      ),
    ).toBeNull();
  });
  it("rejects mismatched selected raw summary and period known effort without equating capacity R to A", () => {
    const query = new URLSearchParams("granularity=week"),
      { data } = planUiFixture(state, query);
    for (const field of [
      "assignmentCount",
      "unknownAssignmentCount",
      "state",
      "partial",
      "knownMd",
      "plannedMd",
      "plannedMm",
    ] as const) {
      const changed = structuredClone(data),
        selected = changed.plan!.totals.summary.selected;
      if (field === "state") selected.state = "unset";
      else if (field === "partial") selected.partial = !selected.partial;
      else selected[field] = (selected[field] ?? 0) + 1;
      expect(
        readDashboard({ data: changed }, state.project.publicId, query),
      ).toBeNull();
    }
    const changed = structuredClone(data);
    changed.plan!.resources[0].cells[1].project.knownMd += 1;
    expect(
      readDashboard({ data: changed }, state.project.publicId, query),
    ).toBeNull();
    expect(data.plan!.population.resourceCount).toBeGreaterThan(
      data.summary.resourceCount,
    );
    expect(
      readDashboard({ data }, state.project.publicId, query),
    ).not.toBeNull();
  });
  it("expands immutable stable-ID rows with repeated group context and reference-only M", () => {
    const { data } = planUiFixture(
      state,
      new URLSearchParams("mode=group&granularity=month"),
    );
    const first = flattenPlanRows(data.plan!, "group", new Set());
    expect(first).toHaveLength(12);
    const rows = flattenPlanRows(
      data.plan!,
      "group",
      new Set([first[0].key, `${first[0].key}:resource:${planId(1, 0)}`]),
    );
    expect(rows[1].selector.kind).toBe("resource");
    expect(rows[2].selector.kind).toBe("resourceMilestone");
    expect(rows[2].parentResource).toBeDefined();
    expect(rows[2].series.summary.project).toEqual(
      rows[1].series.summary.project,
    );
    expect(data.plan!.groups).toHaveLength(12);
  });
  it("preserves selected/project and parentperiod/date echo across all three detail routes", () => {
    const { data } = planUiFixture(
      state,
      new URLSearchParams("mode=group&granularity=month"),
    );
    for (const kind of ["daily", "day-resources", "day-assignments"] as const) {
      const selector =
        kind === "day-assignments"
          ? { kind: "resource" as const, resourceId: planId(1, 0) }
          : { kind: "group" as const, groupId: planId(2, 0) };
      const input = {
        snapshotId: data.snapshotId,
        granularity: "month" as const,
        periodId: "all",
        selector,
        demandScope: "project" as const,
        ...(kind === "daily" ? {} : { date: "2024-01-01" }),
        offset: 0,
        limit: 50,
      };
      const q = planDetailQuery(data, input),
        detail = planDetailsUiFixture(state, q, kind);
      expect(
        readPlanDetails({ data: detail }, data, input, kind),
      ).not.toBeNull();
      for (const changed of [
        { ...detail, periodId: "2024-01" },
        { ...detail, demandScope: "selected" },
        { ...detail, date: "2024-01-02" },
        { ...detail, snapshotId: "b".repeat(64) },
        { ...detail, limit: 100 },
        { ...detail, filters: { ...detail.filters, search: "bad" } },
      ])
        expect(
          readPlanDetails({ data: changed }, data, input, kind),
        ).toBeNull();
    }
  });
  it("distinguishes unset, nonworking and empty contribution without available-work claim", () => {
    const { data } = planUiFixture(
      state,
      new URLSearchParams("granularity=month"),
    );
    const zero = data.plan!.resources.at(-1)!.summary.selected;
    expect(planMetric(zero, "load", "md")).toContain("0부하");
    expect(
      planMetric({ ...zero, capacityMd: 0, loadPercent: null }, "load", "md"),
    ).toContain("비근무기간");
    expect(
      planMetric(data.plan!.resources[3].summary.selected, "effort", "md"),
    ).toContain("미산정");
    expect(
      planMetric(data.plan!.resources[1].summary.selected, "effort", "md"),
    ).toContain("미설정 포함");
  });
  it("keeps representative week/month payloads within real report and matrix budgets", () => {
    for (const granularity of ["week", "month"]) {
      const { data } = planUiFixture(
        state,
        new URLSearchParams(`granularity=${granularity}`),
      );
      const plan = data.plan!;
      const matrixCells =
        plan.periods.length *
        (1 +
          plan.resources.length +
          plan.groups.length +
          plan.resources.reduce((n, r) => n + r.milestones.length, 0));
      const bytes = new TextEncoder().encode(JSON.stringify({ data })).length;
      expect(matrixCells).toBeLessThanOrEqual(5000);
      expect(bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
      expect(plan.totals.summary.selected.knownMd).toBe(
        data.summary.effort.knownMd,
      );
      console.log(
        JSON.stringify({
          granularity,
          resources: plan.population.resourceCount,
          groups: plan.groups.length,
          periods: plan.periods.length,
          matrixCells,
          bytes,
        }),
      );
    }
  });
  it("rejects wrong current-asOf/population/period projection and represents R0 separately", () => {
    const query = new URLSearchParams("granularity=month"),
      { data } = planUiFixture(state, query);
    for (const plan of [
      { ...data.plan!, asOfDate: "2024-01-01" },
      {
        ...data.plan!,
        population: { ...data.plan!.population, resourceCount: 100 },
      },
      {
        ...data.plan!,
        periods: [data.plan!.periods[0], ...data.plan!.periods],
      },
    ])
      expect(
        readDashboard(
          { data: { ...data, plan } },
          state.project.publicId,
          query,
        ),
      ).toBeNull();
    const { data: empty } = planUiFixture(
      state,
      new URLSearchParams("granularity=week&roles=EQUIPMENT_OWNER"),
    );
    expect(empty.plan!.population.resourceCount).toBe(0);
    expect(empty.plan!.resources).toEqual([]);
    expect(empty.plan!.totals.summary.selected.capacityMd).toBe(0);
  });
});
