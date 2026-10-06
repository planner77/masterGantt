import { describe, expect, it } from "vitest";
import type { MilestoneDashboardDto, MilestoneDashboardFilterInput, MilestoneDashboardFiltersDto } from "../../src/contracts/milestone-dashboard";
import {
  conversionLabel, dashboardFilterError, dashboardFrom, dashboardMatches,
  dashboardQuery, displayEffort, displayPercent, normalizeDashboardFilters, projectDateAt,
} from "../../src/features/milestones/milestone-dashboard-model";

// Independent response fixture: resolved dates and conversion are not request echoes.
function responseFixture(): MilestoneDashboardDto {
  const effort = { plannedMd: 0, plannedMm: null, assignmentIds: [], unsetAssignmentIds: [], unsetAllocationCount: 0, roleTotals: [] };
  return {
    projectPublicId: "project-a", projectRevision: 7, catalogRevision: 4,
    calculatedAt: "2026-10-06T15:00:00.000Z", timezone: "Asia/Seoul",
    asOfDate: "2026-10-07", horizonDays: 14,
    filters: {
      search: "", milestoneIds: [], asOfDate: null, horizonDays: 14, from: null, to: null,
      resourceIds: [], assignmentRoles: [], developerGrades: [], processIds: [], equipmentIds: [],
      systemIds: [], roleResourceIds: [], systemView: "direct", activeOnly: false,
      includeDescendantProcesses: true, mdPerMm: null, mdPerMmProvided: false,
    },
    workloadRange: { from: "2026-10-01", to: "2026-10-31" }, mdPerMm: 21, mdPerMmSource: "environment",
    kpi: {
      completion: { numerator: 0, denominator: 0, percent: null, completedMilestoneTaskIds: [], milestoneTaskIds: [] },
      ready: { count: 0, milestoneTaskIds: [] }, blocked: { count: 0, milestoneTaskIds: [] },
      overdue: { count: 0, milestoneTaskIds: [] }, upcoming: { count: 0, milestoneTaskIds: [] },
      atRisk: { count: 0, milestoneTaskIds: [] },
      coverage: { numerator: 0, denominator: 0, percent: null, assignedTaskIds: [], taskIds: [] },
    },
    rows: [{
      milestoneTaskId: "milestone-a", name: "검수", externalId: "M1", scheduledDate: "2026-10-08",
      status: "not_started", progress: 0, memberDurationSum: 0, memberWeightedProgressSum: 0,
      stageGate: {
        memberTaskIds: [], memberCount: 0, completedMemberCount: 0, incompleteMemberTaskIds: [],
        memberProgressPercent: null, predecessorMilestoneTaskIds: [], incompletePredecessorMilestoneTaskIds: [],
        membersCompleted: false, predecessorsCompleted: true, ready: null, blocked: false,
        manualEvent: true, completionInconsistent: false,
      },
      overdue: false, upcoming: true, atRisk: false, riskTaskIds: [], risks: [], scopedTaskIds: [], effort: { ...effort },
    }],
    scope: { taskIds: [], assignmentIds: [], milestoneTaskIds: [] },
    effort: { ...effort, buckets: [{ ...effort, milestoneTaskId: null, taskIds: [] }], assignments: [] },
    catalog: { milestones: [], resources: [], processes: [], equipment: [], systems: [] },
  };
}

describe("milestone dashboard request normalization", () => {
  it("uses bounded defaults while retaining omitted dates and conversion", () => {
    expect(normalizeDashboardFilters({})).toEqual(responseFixture().filters);
    const query = new URLSearchParams(dashboardQuery({}));
    expect(Object.fromEntries(query)).toEqual({ horizonDays: "14", systemView: "direct", activeOnly: "false", includeDescendantProcesses: "true" });
    for (const key of ["asOfDate", "from", "to", "mdPerMm"]) expect(query.has(key)).toBe(false);
  });

  it("canonicalizes sets and trimmed search without mutating caller selections", () => {
    const input: MilestoneDashboardFilterInput = {
      search: "  설치 & 검수  ", milestoneIds: ["b", "a", "b"], resourceIds: ["r2", "r1", "r2"],
      assignmentRoles: ["PI", "DEVELOPER", "PI"], developerGrades: ["UNSPECIFIED", "BEGINNER", "BEGINNER"],
      processIds: ["p2", "p1", "p2"], equipmentIds: ["e2", "e1", "e1"],
      systemIds: ["s2", "s1", "s2"], roleResourceIds: ["rr2", "rr1", "rr2"],
    };
    const original = structuredClone(input);
    const query = new URLSearchParams(dashboardQuery(input));
    expect(query.get("search")).toBe("설치 & 검수");
    for (const [key, expected] of Object.entries({
      milestoneIds: ["a", "b"], resourceIds: ["r1", "r2"], assignmentRoles: ["DEVELOPER", "PI"],
      developerGrades: ["BEGINNER", "UNSPECIFIED"], processIds: ["p1", "p2"], equipmentIds: ["e1", "e2"],
      systemIds: ["s1", "s2"], roleResourceIds: ["rr1", "rr2"],
    })) expect(query.getAll(key)).toEqual(expected);
    expect(input).toEqual(original);
    expect(dashboardQuery({ milestoneIds: ["b", "a", "a"] })).toBe(dashboardQuery({ milestoneIds: ["a", "b"] }));
  });

  it.each([null, 20, 22.5])("preserves explicit mdPerMm=%s separately from omission", (mdPerMm) => {
    expect(normalizeDashboardFilters({ mdPerMm })).toMatchObject({ mdPerMm, mdPerMmProvided: true });
    expect(new URLSearchParams(dashboardQuery({ mdPerMm })).get("mdPerMm")).toBe(String(mdPerMm));
  });

  it("preserves explicit false options and manual dates", () => {
    const query = new URLSearchParams(dashboardQuery({
      asOfDate: "2026-10-06", from: "2026-10-01", to: "2026-10-31", horizonDays: 90,
      systemView: "coordination", activeOnly: true, includeDescendantProcesses: false,
    }));
    expect(Object.fromEntries(query)).toEqual({ asOfDate: "2026-10-06", from: "2026-10-01", to: "2026-10-31", horizonDays: "90", systemView: "coordination", activeOnly: "true", includeDescendantProcesses: "false" });
  });
});

describe("milestone dashboard input feedback", () => {
  it.each([0, 91, 1.5, NaN, Infinity])("rejects invalid horizon %s", (horizonDays) => {
    expect(dashboardFilterError({ horizonDays })).toBeTruthy();
  });
  it.each([1, 90])("allows inclusive horizon boundary %s", (horizonDays) => {
    expect(dashboardFilterError({ horizonDays })).toBeNull();
  });
  it.each(["2026-02-29", "2026-13-01", "2026-10-06T00:00:00Z", "2026-1-01"])('rejects invalid date "%s" in every date field', (date) => {
    for (const key of ["asOfDate", "from", "to"] as const) expect(dashboardFilterError({ [key]: date })).toBeTruthy();
  });
  it("allows leap-day/single-day filters but rejects reversed ranges", () => {
    expect(dashboardFilterError({ asOfDate: "2028-02-29", from: "2028-02-29", to: "2028-02-29" })).toBeNull();
    expect(dashboardFilterError({ from: "2026-10-07", to: "2026-10-06" })).toBeTruthy();
  });
  it.each([0, -1, NaN, Infinity])("rejects invalid conversion %s", (mdPerMm) => {
    expect(dashboardFilterError({ mdPerMm })).toBeTruthy();
  });
  it.each([undefined, null, 0.5])("allows omitted/null/positive conversion %s", (mdPerMm) => {
    expect(dashboardFilterError({ mdPerMm })).toBeNull();
  });
});

describe("milestone dashboard response identity and filter echoes", () => {
  it("accepts omitted request dates alongside resolved dates and environment conversion", () => {
    const data = responseFixture();
    expect(dashboardMatches(data, "project-a", 7, {}, 4)).toBe(true);
    expect(dashboardFrom({ data })).toBe(data);
  });

  it.each([
    ["other project", "project-b", 7, 4], ["older snapshot", "project-a", 8, 4],
    ["newer snapshot", "project-a", 6, 4], ["older catalog", "project-a", 7, 5],
  ] as const)("rejects %s", (_label, publicId, revision, minimumCatalogRevision) => {
    expect(dashboardMatches(responseFixture(), publicId, revision, {}, minimumCatalogRevision)).toBe(false);
  });

  it("accepts a newer catalog but rejects a response to a previous filter request", () => {
    expect(dashboardMatches(responseFixture(), "project-a", 7, {}, 3)).toBe(true);
    expect(dashboardMatches(responseFixture(), "project-a", 7, { search: "검수" }, 4)).toBe(false);
    expect(dashboardMatches(responseFixture(), "project-a", 7, { milestoneIds: ["deleted-milestone"] }, 4)).toBe(false);
  });

  it.each([
    ["resourceIds", ["resource-a"]], ["assignmentRoles", ["PI"]], ["developerGrades", ["EXPERT"]],
    ["processIds", ["process-a"]], ["equipmentIds", ["equipment-a"]], ["systemIds", ["system-a"]],
    ["roleResourceIds", ["role-a"]], ["systemView", "coordination"], ["activeOnly", true],
    ["includeDescendantProcesses", false], ["from", "2026-10-01"], ["to", "2026-10-31"],
    ["horizonDays", 15],
  ])("rejects stale %s echo", (key, value) => {
    const data = responseFixture();
    Object.assign(data.filters, { [key]: value });
    expect(dashboardMatches(data, "project-a", 7, {})).toBe(false);
  });

  it("does not confuse omitted conversion with explicit null", () => {
    const omitted = responseFixture();
    expect(dashboardMatches(omitted, "project-a", 7, { mdPerMm: null })).toBe(false);
    const explicit = responseFixture();
    explicit.filters.mdPerMmProvided = true;
    explicit.mdPerMm = null; explicit.mdPerMmSource = "unset";
    expect(dashboardMatches(explicit, "project-a", 7, { mdPerMm: null })).toBe(true);
    expect(dashboardMatches(explicit, "project-a", 7, {})).toBe(false);
  });

  it("matches equivalent selection sets, while requiring both manual echo and resolved date", () => {
    const data = responseFixture();
    data.filters.milestoneIds = ["a", "b"];
    data.filters.asOfDate = "2026-10-07";
    const input = { milestoneIds: ["b", "a", "b"], asOfDate: "2026-10-07" };
    expect(dashboardMatches(data, "project-a", 7, input)).toBe(true);
    data.asOfDate = "2026-10-06";
    expect(dashboardMatches(data, "project-a", 7, input)).toBe(false);
  });
});

describe("milestone dashboard response shape", () => {
  it.each([null, {}, { data: null }, { data: [] }])("rejects missing response envelope %j", (body) => {
    expect(dashboardFrom(body)).toBeNull();
  });
  it.each([
    ["projectRevision", NaN], ["catalogRevision", "4"], ["calculatedAt", "invalid"],
    ["asOfDate", "2026-02-29"], ["mdPerMm", Infinity], ["mdPerMmSource", "fallback"],
  ])("rejects malformed %s", (key, value) => {
    expect(dashboardFrom({ data: { ...responseFixture(), [key]: value } })).toBeNull();
  });
  it("rejects missing selection echoes and malformed server-owned ID collections", () => {
    const echo = responseFixture();
    delete (echo.filters as Partial<MilestoneDashboardFiltersDto>).resourceIds;
    expect(dashboardFrom({ data: echo })).toBeNull();
    const gate = responseFixture();
    Object.assign(gate.rows[0].stageGate, { incompleteMemberTaskIds: [12] });
    expect(dashboardFrom({ data: gate })).toBeNull();
    const kpi = responseFixture();
    Object.assign(kpi.kpi.ready, { milestoneTaskIds: null });
    expect(dashboardFrom({ data: kpi })).toBeNull();
  });
  it("retains server gate, risk and effort without deriving from visible rows", () => {
    const data = responseFixture();
    data.rows[0].scopedTaskIds = [];
    data.rows[0].stageGate.incompleteMemberTaskIds = ["hidden-member"];
    data.rows[0].stageGate.memberTaskIds = ["hidden-member"];
    data.rows[0].stageGate.memberCount = 1;
    data.rows[0].stageGate.ready = false;
    data.rows[0].stageGate.manualEvent = false;
    data.rows[0].riskTaskIds = ["hidden-member"];
    data.rows[0].atRisk = true;
    data.effort.plannedMd = 12.5;
    const before = structuredClone(data);
    const parsed = dashboardFrom({ data });
    expect(parsed).toBe(data);
    expect(parsed).toEqual(before);
  });
});

describe("project-local date and nullable presentation", () => {
  it.each([
    ["2026-10-06T14:59:59.999Z", "2026-10-06"], ["2026-10-06T15:00:00.000Z", "2026-10-07"],
    ["2026-12-31T15:00:00.000Z", "2027-01-01"], ["2028-02-28T15:00:00.000Z", "2028-02-29"],
  ])("resolves Asia/Seoul %s to %s", (instant, date) => {
    expect(projectDateAt("Asia/Seoul", new Date(instant))).toBe(date);
  });
  it("uses the supplied project timezone rather than the machine calendar day", () => {
    const instant = new Date("2026-10-06T15:00:00.000Z");
    expect(projectDateAt("UTC", instant)).toBe("2026-10-06");
    expect(projectDateAt("Asia/Seoul", instant)).toBe("2026-10-07");
  });
  it("distinguishes no denominator/unconfigured effort from zero", () => {
    expect(displayPercent(null)).toBe("대상 없음"); expect(displayPercent(0)).toBe("0%");
    expect(displayEffort(null)).toBe("—"); expect(displayEffort(0)).toBe("0");
    expect(conversionLabel(null, "unset")).toBe("M/M 환산 기준 미설정");
    expect(conversionLabel(20, "query")).toContain("명시 기준");
    expect(conversionLabel(21, "environment")).toContain("환경 설정 기준");
  });
});
