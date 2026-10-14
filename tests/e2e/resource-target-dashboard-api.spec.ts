import type { APIResponse } from "@playwright/test";
import type { LogisticsTargetDto, LogisticsTargetMutationResponse } from "../../src/contracts/logistics-targets";
import type { ResourceDashboardDetailsDto, ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import type { ProcessCatalogResponse } from "../../src/contracts/process-catalog";
import type { TaskMutationResponse } from "../../src/contracts/projects";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { createTargetProject, targetMasterPassword } from "./fixtures/target-project";

const resourcePassword = "Target620Resource!";
test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: resourcePassword });

async function success(response: APIResponse, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  return response;
}

test("#620 실제 HTTP Target 교집합·공동담당 exact drill·readonly·변경 stale·재시작", async ({ page, browser, isolatedApplication: origin, restartIsolatedApplication }, info) => {
  test.setTimeout(240_000);
  const f = await createTargetProject(page, origin);
  const target = async (code: string, index: number, shared?: string) => {
    const response = await f.mutate("/logistics/targets", {
      code, name: `Target ${code}`, scope: "process", projectProcessId: f.processIds[index],
      ...(index === 0 ? { workAreaId: f.catalog.data.workAreas[0].id } : {}),
      members: [
        { kind: "equipment", create: { code: `AMR-${code}`, name: `AMR ${code}`, equipmentType: "amr", managementUnit: "fleet", quantity: index === 0 ? 10 : 5 } },
        { kind: "system", create: { code: `ACS-${code}`, name: `ACS ${code}`, systemType: "acs", layer: "controller", scope: "project" } },
        shared ? { kind: "system", entityId: shared } : { kind: "system", create: { code: "MCS-SHARED", name: "Shared MCS", systemType: "mcs", layer: "coordinator", scope: "project" } },
      ],
    });
    return ((await response.json()) as LogisticsTargetMutationResponse).data.target!;
  };
  let a = await target("A", 0);
  const mcs = a.members.find(member => member.code === "MCS-SHARED")!.entityId;
  const b = await target("B", 1, mcs);
  const addTask = async (name: string, parentTaskId?: string) => {
    const response = await f.mutate("/tasks", { name, type: "task", ...(parentTaskId ? { parentTaskId } : {}), start: "2026-10-14", duration: 2, progress: 0 });
    return ((await response.json()) as TaskMutationResponse).data.tasks.find(task => task.name === name)!;
  };
  const secondary = await addTask("B-only");
  const legacy = await addTask("Legacy direct shared MCS");
  const unassigned = await addTask("A unassigned", f.parentTask.taskId);
  const subset = await addTask("A ACS subset unset");
  const whole = (targetId: string, scope: "self" | "subtree" = "self") => ({ targetId, scope, selection: "whole", memberIds: [] });
  await f.mutate(`/tasks/${f.parentTask.taskId}/target-bindings`, { bindings: [whole(a.id, "subtree")] }, "put");
  await f.mutate(`/tasks/${f.task.taskId}/target-bindings`, { bindings: [whole(a.id), whole(b.id)] }, "put");
  await f.mutate(`/tasks/${secondary.taskId}/target-bindings`, { bindings: [whole(b.id)] }, "put");
  await f.mutate(`/tasks/${subset.taskId}/target-bindings`, { bindings: [{ targetId: a.id, scope: "self", selection: "subset", memberIds: [a.members.find(member => member.code === "ACS-A")!.id] }] }, "put");
  await f.mutate(`/tasks/${legacy.taskId}/logistics-links`, { equipmentLinks: [], systemLinks: [{ systemId: mcs, scope: "self" }] }, "put");

  await success(await page.request.post("/api/resource-catalog/admin-sessions", { headers: { Origin: origin }, data: { password: resourcePassword } }), 201);
  let catalog = (await (await page.request.get("/api/resources")).json()).data;
  const resourceIds: string[] = [];
  for (const code of ["R620-A", "R620-B"]) {
    const response = await success(await page.request.post("/api/resources", { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data: { code, name: code, roles: ["DEVELOPER"], developerGrade: "ADVANCED" } }), 201);
    catalog = (await response.json()).data;
    resourceIds.push(catalog.resources.find((resource: { code: string }) => resource.code === code).id);
  }
  const allocation = (id: string, percent: number | null) => ({ kind: "resource", id, ...(percent === null ? {} : { allocation: { start: null, end: null, percent } }) });
  for (const [taskId, targets] of [
    [f.task.taskId, [allocation(resourceIds[0], 100), allocation(resourceIds[1], 50)]],
    [secondary.taskId, [allocation(resourceIds[0], 50)]],
    [legacy.taskId, [allocation(resourceIds[0], 25)]],
    [subset.taskId, [allocation(resourceIds[1], null)]],
  ] as const) await f.mutate(`/tasks/${taskId}/assignments`, { catalogRevision: catalog.revision, targets }, "put");

  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const publicPage = await readonly.newPage();
    await publicPage.goto("/");
    const base = new URLSearchParams({ from: "2026-10-14", to: "2026-10-15", mdPerMm: "null" });
    const getReport = async (extra: Record<string, string> = {}) => {
      const parameters = new URLSearchParams({ ...Object.fromEntries(base), ...extra });
      const response = await success(await readonly.request.get(`${f.api}/resource-dashboard?${parameters}`));
      expect(response.headers()).toMatchObject({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
      expect(response.headers()["set-cookie"]).toBeUndefined();
      return (await response.json()).data as ResourceDashboardDto;
    };
    const detail = async (report: ResourceDashboardDto, extra: Record<string, string> = {}) => {
      const parameters = new URLSearchParams({ ...Object.fromEntries(base), snapshotId: report.snapshotId, dimension: "all", view: "assignments", ...extra });
      return readonly.request.get(`${f.api}/resource-dashboard/details?${parameters}`);
    };
    const before = await f.snapshot();
    const old = await getReport();
    expect(old.summary).toMatchObject({ taskCount: 4, assignmentCount: 5, effort: { knownMd: 4.5, unsetCount: 1, plannedMm: null } });
    expect(old.targetProjection).toBeUndefined();
    const projected = await getReport({ projectionOrder: "target,group,resource" });
    expect(projected.summary).toEqual(old.summary);
    for (const projectionOrder of ["resource,group,target", "group,target,resource"]) {
      const reordered = await getReport({ projectionOrder });
      expect(reordered.summary).toEqual(old.summary);
      expect(reordered.targetProjection!.order).toEqual(projectionOrder.split(","));
      expect(reordered.resourceScopeContext!.dataSnapshotId).toBe(projected.resourceScopeContext!.dataSnapshotId);
      expect(reordered.snapshotId).toBe(projected.snapshotId);
    }
    expect(projected.targetProjection!.relatedMembers).toMatchObject({ equipmentQuantity: 15, systemCount: 3 });
    expect(projected.targetProjection!.metadata.subtotalsAdditive).toBe(false);
    const aNode = projected.targetProjection!.children.find(node => node.id === a.id)!;
    const bNode = projected.targetProjection!.children.find(node => node.id === b.id)!;
    expect(aNode.summary.effort.knownMd).toBe(3);
    expect(bNode.summary.effort.knownMd).toBe(4);
    expect(aNode.summary.effort.knownMd + bNode.summary.effort.knownMd).toBeGreaterThan(projected.summary.effort.knownMd);
    const pageOne = await success(await detail(projected, { projectionOrder: "target,group,resource", dimension: "targetProjection", targetPath: JSON.stringify(aNode.summary.selector.targetPath), limit: "1" }));
    const first = (await pageOne.json()).data as ResourceDashboardDetailsDto;
    expect(first).toMatchObject({ totalCount: 3, nextOffset: 1 });
    expect(first.rows).toHaveLength(1);
    const pageTwo = await success(await detail(projected, { projectionOrder: "target,group,resource", dimension: "targetProjection", targetPath: JSON.stringify(aNode.summary.selector.targetPath), limit: "1", offset: "1" }));
    expect(((await pageTwo.json()).data as ResourceDashboardDetailsDto).rows[0].assignment!.assignmentId).not.toBe(first.rows[0].assignment!.assignmentId);
    const selected = await getReport({ targetIds: a.id });
    expect(selected.summary).toMatchObject({ taskCount: 2, assignmentCount: 3, effort: { knownMd: 3, unsetCount: 1, state: "partial" } });
    expect(selected.targetProjection!.projectReference.effort).toEqual(old.summary.effort);
    const selectedPlan = await getReport({ targetIds: a.id, granularity: "week" });
    expect(selectedPlan.plan!.totals.summary.selected.knownMd).toBe(3);
    expect(selectedPlan.plan!.totals.summary.project.knownMd).toBe(4.5);
    expect(selected.diagnostics).toMatchObject({ denominator: 3, personallyUnassigned: { count: 1 } });
    const rows = (await (await success(await detail(selected, { targetIds: a.id }))).json()).data as ResourceDashboardDetailsDto;
    expect(rows.rows.map(row => row.taskId).sort()).toEqual([f.task.taskId, f.task.taskId, subset.taskId].sort());
    const primarySources = rows.rows.find(row => row.taskId === f.task.taskId)!.targetSources!;
    const sharedMcs = primarySources.effectiveMembers.find(member => member.entityId === mcs)!;
    expect(sharedMcs.provenance.filter(source => source.targetId === a.id)).toHaveLength(2);
    expect(sharedMcs.provenance.some(source => source.inherited)).toBe(true);
    expect((await getReport({ targetIds: b.id })).summary.effort.knownMd).toBe(4);
    expect((await getReport({ targetIds: `${a.id},${b.id}` })).summary.effort.knownMd).toBe(4);
    expect((await getReport({ targetIds: a.id, memberEquipmentIds: b.members.find(member => member.kind === "equipment")!.entityId })).summary.assignmentCount).toBe(0);
    expect((await getReport({ targetIds: a.id, memberEquipmentIds: a.members.find(member => member.kind === "equipment")!.entityId })).summary).toMatchObject({ assignmentCount: 2, effort: { knownMd: 3 } });
    expect((await getReport({ memberSystemIds: mcs })).summary.effort.knownMd).toBe(4);
    expect((await getReport({ directSystemIds: mcs })).summary.effort.knownMd).toBe(0.5);
    expect((await getReport({ targetIds: "unassigned" })).summary).toMatchObject({ taskCount: 1, assignmentCount: 1, effort: { knownMd: 0.5 } });
    expect((await getReport({ workAreaIds: "unassigned" })).summary.effort.knownMd).toBe(4);
    const axisFilters: Record<string, string>[] = [
      { projectProcessIds: f.processIds[0] },
      { processOccurrenceIds: a.occurrenceId! },
      { workAreaIds: a.workAreaId! },
      { targetScopes: "process", targetIds: a.id },
      { equipmentTypeCodes: "amr", targetIds: a.id },
      { systemTypeCodes: "acs", targetIds: a.id },
    ];
    for (const extra of axisFilters) expect((await getReport(extra)).summary.effort.knownMd).toBe(3);
    expect((await getReport({ processTypeIds: f.catalog.data.types[0].id })).summary.effort.knownMd).toBe(4);

    const exactId = rows.rows.find(row => row.assignment?.resourceId === resourceIds[0])!.assignment!.assignmentId;
    const body = { sourceContext: selected.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [exactId] }, filters: { from: "2026-10-14", to: "2026-10-15", mdPerMm: null, targetIds: [a.id] }, projection: { kind: "report" } };
    const query = async (data: object) => readonly.request.post(`${f.api}/resource-dashboard/query`, { headers: { Origin: origin }, data });
    const fetched = await publicPage.evaluate(async ({ path, body }) => {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { status: response.status, cache: response.headers.get("cache-control"), nosniff: response.headers.get("x-content-type-options"), body: await response.json() };
    }, { path: `${f.api}/resource-dashboard/query`, body });
    expect(fetched).toMatchObject({ status: 200, cache: "private, no-store", nosniff: "nosniff" });
    expect(fetched.body.drill).toMatchObject({ projectReferenceScope: "same-resource-population-and-period", targetProjectReferenceScope: "full-canonical-project-same-period" });
    const exactReport = fetched.body.data as ResourceDashboardDto;
    expect(exactReport.summary).toMatchObject({ assignmentCount: 1, resourceCount: 1, effort: { knownMd: 2 } });
    const exactDetails = await query({ ...body, projection: { kind: "details", snapshotId: exactReport.snapshotId, selector: { dimension: "all", id: null, metric: "all" }, view: "assignments", offset: 0, limit: 1 } });
    const exactRows = (await (await success(exactDetails)).json()).data as ResourceDashboardDetailsDto;
    expect(exactRows.totalCount).toBe(1);
    expect(exactRows.rows[0].assignment?.assignmentId).toBe(exactId);
    const otherTarget = await query({ ...body, filters: { ...body.filters, targetIds: [b.id] } });
    expect((await (await success(otherTarget)).json()).data.summary).toMatchObject({ assignmentCount: 1, effort: { knownMd: 2 } });
    const emptyIntersection = await query({ ...body, filters: { ...body.filters, targetIds: [a.id], memberSystemIds: [b.members.find(member => member.code === "ACS-B")!.entityId] } });
    expect((await (await success(emptyIntersection)).json()).data.summary.assignmentCount).toBe(0);
    expect((await readonly.request.post(`${f.api}/resource-dashboard/query`, { data: body })).status()).toBe(403);
    expect((await readonly.request.patch(`${f.api}/tasks/${f.task.taskId}`, { headers: { Origin: origin, "If-Match": `"${before.data.project.revision}"` }, data: { name: "Denied" } })).status()).toBe(401);
    const invalid = ["targetIds=00000000-0000-4000-8000-000000000001", "memberSystemIds=00000000-0000-4000-8000-000000000001", "unknownTargetFilter=true", "targetIds=unassigned&memberSystemIds=" + mcs, "targetScopes=invalid"];
    for (const extra of invalid) {
      const response = await readonly.request.get(`${f.api}/resource-dashboard?${base}&${extra}`);
      expect(response.status(), extra).toBe(400);
      expect((await response.json()).data).toBeUndefined();
    }
    const oversized = await readonly.request.get(`${f.api}/resource-dashboard?from=2026-01-01&to=2027-01-02&targetIds=${a.id}`);
    expect(oversized.status()).toBe(422);
    expect((await oversized.json()).data).toBeUndefined();
    const foreign = await browser.newContext({ baseURL: origin });
    try {
      const created = await success(await foreign.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Foreign #620", ownerName: "E2E", description: "", editPassword: "Foreign620!" } }), 201);
      const foreignId = (await created.json()).data.project.publicId;
      const createdTarget = await success(await foreign.request.post(`/api/projects/${foreignId}/logistics/targets`, { headers: { Origin: origin, "If-Match": '"1"' }, data: { code: "FOREIGN", name: "Foreign", scope: "project_common", members: [{ kind: "system", create: { code: "MCS-FOREIGN", systemType: "mcs", layer: "coordinator", scope: "project" } }] } }), 201);
      const foreignTarget = ((await createdTarget.json()) as LogisticsTargetMutationResponse).data.target!;
      expect((await readonly.request.get(`${f.api}/resource-dashboard?${base}&targetIds=${foreignTarget.id}`)).status()).toBe(400);
      expect((await readonly.request.get(`${f.api}/resource-dashboard?${base}&memberSystemIds=${foreignTarget.members[0].entityId}`)).status()).toBe(400);
    } finally { await foreign.close(); }
    expect(await readonly.cookies()).toEqual([]);
    expect(await f.snapshot()).toEqual(before);
    await restartIsolatedApplication();
    expect((await getReport({ targetIds: a.id })).snapshotId).toBe(selected.snapshotId);
    expect((await (await success(await query(body))).json()).data.snapshotId).toBe(exactReport.snapshotId);

    const assertStale = async (previous: ResourceDashboardDto, label: string) => {
      const response = await detail(previous, { targetIds: a.id });
      expect(response.status(), label).toBe(409);
      const stale = await response.json();
      expect(stale.error.code).toBe("REPORT_STALE");
      expect(stale.data).toBeUndefined();
      const current = await getReport({ targetIds: a.id });
      expect(current.snapshotId, label).not.toBe(previous.snapshotId);
      return current;
    };
    await f.mutate(`/logistics/targets/${a.id}`, { name: "Renamed Target A" }, "patch");
    let current = await assertStale(selected, "Target rename");
    expect((await query(body)).status()).toBe(409);
    const spare = await f.mutate("/logistics/systems", { code: "MEMBER-ADDED", name: "New member", systemType: "mcs", layer: "coordinator", scope: "project" });
    const spareId = (await spare.json()).data.logistics.systems.find((system: { code: string }) => system.code === "MEMBER-ADDED").id as string;
    current = await getReport({ targetIds: a.id });
    const members = [...a.members.map(member => ({ kind: member.kind, entityId: member.entityId })), { kind: "system", entityId: spareId }];
    const preview = await f.mutate(`/logistics/targets/${a.id}/impact`, { members });
    const impactToken = (await preview.json()).data.impactToken;
    const updated = await f.mutate(`/logistics/targets/${a.id}`, { members, impactToken, confirmImpact: true }, "patch");
    a = ((await updated.json()) as LogisticsTargetMutationResponse).data.target as LogisticsTargetDto;
    current = await assertStale(current, "Target member addition");
    const processCatalog = (await (await success(await page.request.get("/api/process-catalog/admin"))).json()) as ProcessCatalogResponse;
    await success(await page.request.patch(`/api/process-catalog/admin/types/${f.catalog.data.types[0].id}`, { headers: { Origin: origin, "If-Match": `"${processCatalog.data.processCatalogRevision}"` }, data: { name: "Renamed process type" } }));
    current = await assertStale(current, "Process master rename");
    await restartIsolatedApplication();
    expect((await getReport({ targetIds: a.id })).snapshotId).toBe(current.snapshotId);
    await info.attach("target620-http-evidence", { contentType: "application/json", body: JSON.stringify({ originalSnapshot: selected.snapshotId, exactSnapshot: exactReport.snapshotId, currentSnapshot: current.snapshotId, exactAssignmentId: exactId, unassignedTaskId: unassigned.taskId, taskCount: before.data.tasks.length }) });
  } finally { await readonly.close(); }
});
