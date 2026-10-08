import { describe, expect, it } from "vitest";
import { dashboardQuery, detailsQuery, plannedEffort, readDashboard, readDetails } from "../../../src/features/resources/resource-dashboard-model";
import { resourceDashboardUiFixture, resourceDashboardDetailUiFixture, longResourceDashboardUiFixture, longResourceDashboardDetailUiFixture } from "../../fixtures/resource-dashboard-ui";
import type { StatefulProjectFixture } from "../../fixtures/stateful-project";
import { parseResourceDashboardQuery } from "../../../src/server/resources/resource-dashboard-query-core";
const fixture = { project: { publicId: "a3405d3d-8cb4-4da4-9b0f-43a5de330003", revision: 40 }, tasks: [{}, {}, { taskId: "00000000-0000-4000-8000-000000000003", name: "Stable leaf", externalId: "LEAF-1" }] } as StatefulProjectFixture;
describe("Resource dashboard client contracts", () => {
  it("omits default nullable dates in details and keeps explicit null conversion", () => {
    const data = resourceDashboardUiFixture(fixture, new URLSearchParams("mode=group"));
    const query = detailsQuery(data, data.summary.selector, "assignments", 0);
    expect(query.has("from")).toBe(false); expect(query.has("to")).toBe(false); expect(query.has("asOfDate")).toBe(false); expect(query.has("mdPerMm")).toBe(false);
    expect(() => parseResourceDashboardQuery(query, true)).not.toThrow();
    data.filters.mdPerMmProvided = true; data.filters.mdPerMm = null;
    expect(detailsQuery(data, data.summary.selector, "tasks", 0).get("mdPerMm")).toBe("null");
  });
  it("rejects malformed success, wrong project, scope, revision and filter echoes", () => {
    const query = dashboardQuery({ mode: "group", search: "R-01", statuses: ["in_progress"] });
    const data = resourceDashboardUiFixture(fixture, query);
    expect(readDashboard({ data }, fixture.project.publicId, query)).not.toBeNull();
    for (const changed of [{ ...data, schema: "other" }, { ...data, projectPublicId: "other" }, { ...data, scope: { ...data.scope, identity: "bad" } }, { ...data, calendarRevision: "" }, { ...data, filters: { ...data.filters, search: "other" } }, { ...data, resources: [{ ...data.resources[0], summary: { taskCount: 1 } }] }]) expect(readDashboard({ data: changed }, fixture.project.publicId, query)).toBeNull();
  });
  it("validates snapshot-bound detail, allows null assignment in tasks and rejects it in assignments", () => {
    const data = resourceDashboardUiFixture(fixture, new URLSearchParams("mode=group"));
    const query = detailsQuery(data, data.diagnostics.personallyUnassigned.selector, "tasks", 0);
    const value = resourceDashboardDetailUiFixture(fixture, query);
    expect(readDetails({ data: value }, data, value.selector, "tasks", 0)).not.toBeNull();
    expect(readDetails({ data: { ...value, snapshotId: "b".repeat(64) } }, data, value.selector, "tasks", 0)).toBeNull();
    expect(readDetails({ data: { ...value, view: "assignments" } }, data, value.selector, "assignments", 0)).toBeNull();
  });
  it("keeps the large geometry payload within canonical string and detail bounds", () => {
    const report = longResourceDashboardUiFixture(fixture, new URLSearchParams("mode=group"));
    expect(report.resources).toHaveLength(40); expect(report.groups).toHaveLength(12);
    expect(report.resources.every((row) => row.name.length <= 200 && row.name.length > 150 && row.code!.length <= 64)).toBe(true);
    expect(report.groups.every((row) => row.name.length <= 200 && row.code!.length <= 64)).toBe(true);
    expect(report.catalog.resources.some((row) => !row.active && row.roles.length === 2)).toBe(true); expect(report.catalog.resources.some((row) => row.roles.length === 3)).toBe(true); expect(report.catalog.resources.some((row) => row.roles.length === 0)).toBe(true);
    const query = detailsQuery(report, report.resources[0].summary.selector, "assignments", 0);
    const detail = longResourceDashboardDetailUiFixture(fixture, query);
    expect(detail.rows).toHaveLength(50); expect(detail.totalCount).toBe(120); expect(detail.nextOffset).toBe(50);
    expect(detail.rows.every((row) => row.taskName.length <= 200 && row.externalId.length <= 128 && row.wbsPath.every((part) => part.name.length <= 200))).toBe(true);
    expect(readDashboard({ data: report }, fixture.project.publicId, new URLSearchParams("mode=group"))).not.toBeNull();
    expect(readDetails({ data: detail }, report, report.resources[0].summary.selector, "assignments", 0)).not.toBeNull();
  });
  it("distinguishes unknown, partial, configured zero and empty values", () => {
    const effort = resourceDashboardUiFixture(fixture).summary.effort;
    expect(plannedEffort({ ...effort, state: "unset", plannedMd: null }, "md")).toBe("산정 불가 · 공수 미설정");
    expect(plannedEffort({ ...effort, state: "partial", partial: true }, "md")).toContain("알려진 부분합");
    expect(plannedEffort({ ...effort, state: "empty", plannedMd: 0, plannedMm: 0, partial: false }, "md")).toBe("할당 없음");
    expect(plannedEffort({ ...effort, state: "empty", plannedMd: null, plannedMm: null, partial: false }, "mm")).toBe("할당 없음");
    expect(plannedEffort({ ...effort, state: "configured", plannedMd: 0 }, "md")).toBe("0.00 M/D");
    expect(plannedEffort({ ...effort, state: "configured", plannedMm: 0 }, "mm")).toBe("0.00 M/M");
  });
});
