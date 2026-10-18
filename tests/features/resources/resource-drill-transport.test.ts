import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizedDrillFilters,
  queryResourceDrill,
  resourceProjectionFetch,
  planScopeProjection,
  drillFilters,
  dashboardSelector,
} from "../../../src/features/resources/resource-drill-transport";
import { readResourceDrillScope } from "../../../src/features/resources/resource-drill-scope-model";
import type {
  ResourceDrillQueryInput,
  ResourceDrillSourceContext,
  ResourceDrillScope,
  ResourceDrillProjection,
} from "../../../src/contracts/resource-drill";
const source: ResourceDrillSourceContext = {
  projectPublicId: "project",
  projectRevision: 4,
  catalogRevision: 7,
  calendarRevision: "a".repeat(64),
  dataSnapshotId: "b".repeat(64),
  range: { from: "2026-10-06", to: "2026-10-08" },
  asOfDate: "2026-10-08",
  mdPerMm: null,
  mdPerMmSource: "query",
  mdPerMmProvided: true,
  sourceProjection: { kind: "schedule" },
};
const input: ResourceDrillQueryInput = {
  sourceContext: source,
  scope: {
    kind: "exactAssignments",
    assignmentIds: ["assignment-B", "assignment-A", "assignment-A"],
  },
  filters: {
    from: "2026-10-06",
    to: "2026-10-08",
    mode: "group",
    mdPerMm: null,
  },
  projection: {
    kind: "scope",
    target: "dashboard",
    snapshotId: "c".repeat(64),
    selector: { dimension: "all", id: null, metric: "all" },
  },
};
const scopeData = {
  schema: "resource-dashboard/1",
  snapshotId: "c".repeat(64),
  sourceContext: {
    ...source,
    sourceProjection: {
      kind: "details",
      selector:
        input.projection.kind === "scope" &&
        input.projection.target === "dashboard"
          ? input.projection.selector
          : {},
      view: "assignments",
    },
  },
  taskIds: ["task"],
  assignmentIds: ["assignment-A", "assignment-B"],
  ancestorSummaryIds: ["root"],
  taskCount: 1,
  assignmentCount: 2,
};
type Echo = {
  sourceContext: ResourceDrillSourceContext;
  scope: ResourceDrillScope;
  projection: ResourceDrillProjection;
  targetFilters: ReturnType<typeof normalizedDrillFilters>;
  assignmentScope: string;
  projectReferenceScope: string;
  targetProjectReferenceScope?: string;
};
type Body = { data: typeof scopeData; drill: Echo };
function install(transform: (body: Body) => Body = (body) => body) {
  const fetcher = vi.fn(async (_path: unknown, options: RequestInit) => {
    const request = JSON.parse(String(options.body));
    return Response.json(
      transform({
        data: scopeData,
        drill: {
          sourceContext: request.sourceContext,
          scope: request.scope,
          projection: request.projection,
          targetFilters: normalizedDrillFilters(request.filters),
          assignmentScope: "exact-source-intersection",
          projectReferenceScope: "same-resource-population-and-period",
          ...(request.filters.projectionOrder ? {targetProjectReferenceScope:"full-canonical-project-same-period"} : {}),
        },
      }),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => vi.unstubAllGlobals());
describe("Resource drill exact descriptor transport", () => {
  it("posts normalized exact IDs without a GET fallback and validates ScopeDto's target filters against its request", async () => {
    const fetcher = install();
    await queryResourceDrill("project", input);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("/api/projects/project/resource-dashboard/query");
    expect(options.method).toBe("POST");
    expect(options.cache).toBe("no-store");
    expect(JSON.parse(String(options.body)).scope.assignmentIds).toEqual([
      "assignment-A",
      "assignment-B",
    ]);
    install((body) => ({
      ...body,
      drill: {
        ...body.drill,
        targetFilters: { ...body.drill.targetFilters, taskSearch: "foreign" },
      },
    }));
    await expect(queryResourceDrill("project", input)).rejects.toThrow(
      "INVALID_RESPONSE",
    );
  });
  it("rejects wrong origin/projection/exact scope/reference semantics even when returned data is otherwise valid", async () => {
    for (const change of [
      (echo: Echo) => ({
        ...echo,
        sourceContext: {
          ...echo.sourceContext,
          dataSnapshotId: "d".repeat(64),
        },
      }),
      (echo: Echo) => ({
        ...echo,
        scope: { kind: "exactAssignments" as const, assignmentIds: [] },
      }),
      (echo: Echo) => ({ ...echo, projection: { kind: "report" as const } }),
      (echo: Echo) => ({ ...echo, assignmentScope: "all" }),
      (echo: Echo) => ({ ...echo, projectReferenceScope: "all" }),
    ]) {
      install((body) => ({ ...body, drill: change(body.drill) }));
      await expect(queryResourceDrill("project", input)).rejects.toThrow(
        "INVALID_RESPONSE",
      );
    }
  });
  it("retains descriptor for report/details/children and all three plan projections, excluding paging from scope", async () => {
    for (const suffix of [
      "?mode=group",
      "/details?snapshotId=c&dimension=resource&id=r&metric=all&view=tasks&offset=50&limit=50",
      "/group-children?snapshotId=c&groupId=ungrouped&offset=50&limit=50",
      "/plan/daily?snapshotId=c&granularity=week&periodId=2026-W41&row=resource&resourceId=r&demandScope=project&offset=50&limit=50",
      "/plan/day-resources?snapshotId=c&granularity=month&periodId=all&row=group&groupId=ungrouped&demandScope=selected&date=2026-10-06&offset=0&limit=50",
      "/plan/day-assignments?snapshotId=c&granularity=week&periodId=2026-W41&row=resourceMilestone&resourceId=r&milestoneTaskId=unassigned&demandScope=selected&date=2026-10-06&offset=0&limit=50",
    ]) {
      const fetcher = install();
      await resourceProjectionFetch(
        input,
        "/api/projects/project/resource-dashboard" + suffix,
      );
      const request = JSON.parse(String(fetcher.mock.calls[0][1].body));
      expect(request.scope.kind).toBe("exactAssignments");
      expect(request.sourceContext).toEqual(source);
      expect(request.projection.kind).not.toBe("scope");
    }
    expect(
      planScopeProjection({
        snapshotId: "c",
        granularity: "week",
        periodId: "all",
        selector: { kind: "total" },
        demandScope: "project",
        offset: 50,
        limit: 50,
      }),
    ).not.toHaveProperty("offset");
  });
  it("rejects a valid ledger with a different scope selector or Plan period", () => {
    if (input.projection.kind !== "scope") throw Error("fixture");
    expect(
      readResourceDrillScope(
        { data: scopeData },
        source,
        scopeData.snapshotId,
        input.projection,
      ),
    ).not.toBeNull();
    const wrong = {
      ...scopeData,
      sourceContext: {
        ...scopeData.sourceContext,
        sourceProjection: {
          ...scopeData.sourceContext.sourceProjection,
          selector: { dimension: "resource", id: "foreign", metric: "all" },
        },
      },
    };
    expect(
      readResourceDrillScope(
        { data: wrong },
        source,
        scopeData.snapshotId,
        input.projection,
      ),
    ).toBeNull();
    expect(
      readResourceDrillScope(
        { data: scopeData },
        source,
        scopeData.snapshotId,
        {
          kind: "scope",
          target: "plan",
          snapshotId: scopeData.snapshotId,
          granularity: "week",
          periodId: "all",
          selector: { kind: "total" },
          demandScope: "project",
        },
      ),
    ).toBeNull();
  });
  it("preserves exact empty descriptors and rejects inconsistent complete scope counts, origin, null policy or ancestor overlap", () => {
    expect(normalizedDrillFilters({ mdPerMm: null })).toMatchObject({
      mdPerMm: null,
      mdPerMmProvided: true,
    });
    expect(
      readResourceDrillScope({ data: scopeData }, source, "c".repeat(64)),
    ).not.toBeNull();
    for (const data of [
      { ...scopeData, taskCount: 2 },
      { ...scopeData, assignmentIds: ["assignment-A", "assignment-A"] },
      { ...scopeData, ancestorSummaryIds: ["task"] },
      {
        ...scopeData,
        sourceContext: { ...scopeData.sourceContext, mdPerMm: 21 },
      },
      {
        ...scopeData,
        sourceContext: {
          ...scopeData.sourceContext,
          dataSnapshotId: "d".repeat(64),
        },
      },
    ])
      expect(
        readResourceDrillScope({ data }, source, "c".repeat(64)),
      ).toBeNull();
    expect(
      readResourceDrillScope(
        {
          data: {
            ...scopeData,
            taskIds: [],
            assignmentIds: [],
            ancestorSummaryIds: [],
            taskCount: 0,
            assignmentCount: 0,
          },
        },
        source,
      )?.taskCount,
    ).toBe(0);
  });
});

describe("#621 bound Target transport", () => {
  const targetId = "00000000-0000-4000-8000-000000000010";
  const targetPath = [{dimension:"target" as const,id:targetId},{dimension:"resource" as const,id:null}];
  it("keeps Target path filters, ordered projection and exact source assignment restriction", async () => {
    const q = new URLSearchParams({projectionOrder:"resource,target,group",targetIds:targetId,memberSystemIds:"system",targetPath:JSON.stringify(targetPath),dimension:"targetProjection",metric:"all",id:"",assignmentScope:"selected"});
    const filters = drillFilters(q);
    expect(filters.projectionOrder).toEqual(["resource","target","group"]);
    expect(normalizedDrillFilters(filters).projectionOrder).toEqual(["resource","target","group"]);
    expect((normalizedDrillFilters(filters) as Record<string, unknown>).targetIds).toEqual([targetId]);
    expect(dashboardSelector(q).targetPath).toEqual(targetPath);
    const fetcher=install();
    await resourceProjectionFetch(input, `/api/projects/project/resource-dashboard/details?${q}`);
    const request=JSON.parse(String(fetcher.mock.calls[0][1].body));
    expect(request.scope.assignmentIds).toEqual(["assignment-A","assignment-B"]);
    expect(request.filters.targetIds).toEqual([targetId]);
    expect(request.projection.selector.targetPath).toEqual(targetPath);
  });
  it("rejects dropped Target echo and wrong full Project reference semantics", async () => {
    const targetInput={...input,filters:{...input.filters,targetIds:[targetId],projectionOrder:["resource","target"] as ("resource"|"target")[]}};
    install(body=>{ const drill={...body.drill}; delete drill.targetProjectReferenceScope; return {...body,drill}; });
    await expect(queryResourceDrill("project",targetInput)).rejects.toThrow("INVALID_RESPONSE");
    install(body=>({...body,drill:{...body.drill,targetFilters:{...body.drill.targetFilters,targetIds:[]}}}));
    await expect(queryResourceDrill("project",targetInput)).rejects.toThrow("INVALID_RESPONSE");
  });
});
