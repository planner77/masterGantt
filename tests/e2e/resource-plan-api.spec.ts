import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../src/contracts/projects";
import type { ResourceDashboardDto, ResourcePlanDayAssignmentsDto, ResourcePlanDayResourcesDto, ResourcePlanDailyDto } from "../../src/contracts/resource-dashboard";
const password = "Synthetic527Admin!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: password });

test("#527 실제 Chromium·SQLite public Plan 범위·원인·예산·restart·권한을 보존한다", async ({ page, baseURL, browser, restartIsolatedApplication }, testInfo) => {
  test.setTimeout(180_000);
  const origin = baseURL!;
  const created = await page.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Resource Plan API #527", ownerName: "E2E", description: "synthetic", editPassword: "API527!" } }); expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string, api = `/api/projects/${publicId}`;
  const get = async () => (await (await page.request.get(api)).json()) as ProjectSnapshotResponse;
  let snapshot = await get();
  const mutate = async (path: string, data: unknown, method: "post" | "put" | "patch" = "post", expected = 200) => { const response = await page.request[method](`${api}${path}`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data }); expect(response.status(), await response.text()).toBe(expected); snapshot = await get(); return response; };
  const add = async (name: string, type: "task" | "milestone" = "task", start = "2026-10-19") => { const response = await mutate("/tasks", { name, type, start, duration: type === "task" ? 1 : 0, progress: 0 }, "post", 201); return (await response.json()).data.tasks.find((task: ProjectTaskDto) => task.name === name) as ProjectTaskDto; };
  const a = await add("M1 80%"), b = await add("M2 60%"), outside = await add("기간 밖 이력", "task", "2025-01-06"), m1 = await add("Milestone 1", "milestone"), m2 = await add("Milestone 2", "milestone");
  await mutate("/milestone-memberships", { changes: [{ taskId: a.taskId, milestoneTaskId: m1.taskId }, { taskId: b.taskId, milestoneTaskId: m2.taskId }] });
  expect((await page.request.post("/api/resource-catalog/admin-sessions", { headers: { Origin: origin }, data: { password } })).status()).toBe(201);
  let catalog = (await (await page.request.get("/api/resources")).json()).data;
  const catalogMutate = async (path: string, data: unknown, method: "post" | "put" = "post", expected = 201) => { const response = await page.request[method](path, { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data }); expect(response.status(), await response.text()).toBe(expected); catalog = (await response.json()).data; };
  const ids: string[] = [];
  for (const code of ["R1", "R0", "HIDDEN"]) { await catalogMutate("/api/resources", { name: code, code, roles: ["DEVELOPER"], developerGrade: "ADVANCED" }); ids.push(catalog.resources.find((r: { code: string }) => r.code === code).id as string); }
  const [r1, r0, hidden] = ids;
  await catalogMutate("/api/resource-groups", { name: "Plan Group", code: "PG" }); const groupId = catalog.groups.find((g: { code: string }) => g.code === "PG").id as string;
  await catalogMutate(`/api/resource-groups/${groupId}/members`, { resourceIds: ids }, "put", 200);
  for (const [task, id, percent] of [[a, r1, 80], [b, r1, 60], [outside, r0, 50]] as const) await mutate(`/tasks/${task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id, allocation: { start: null, end: null, percent } }] }, "put");
  const query = new URLSearchParams({ from: "2026-10-19", to: "2026-10-20", mdPerMm: "null", milestoneIds: m1.taskId, granularity: "week" });
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const publicPage = await readonly.newPage(); await publicPage.goto("/");
    const fetched = await publicPage.evaluate(async path => { const response = await fetch(path); return { status: response.status, cache: response.headers.get("cache-control"), nosniff: response.headers.get("x-content-type-options"), body: await response.json() }; }, `${api}/resource-dashboard?${query}`);
    expect(fetched).toMatchObject({ status: 200, cache: "private, no-store", nosniff: "nosniff" });
    const report = fetched.body.data as ResourceDashboardDto;
    expect(report.plan!.population.resourceCount).toBe(2); expect(report.plan!.population.resourceIds).not.toContain(hidden); expect(report.plan!.resources.map(r => r.resourceId)).toContain(r0);
    const person = report.plan!.resources.find(r => r.resourceId === r1)!; expect(person.summary.selected.knownMd).toBe(.8); expect(person.summary.project.knownMd).toBeCloseTo(1.4); expect(person.summary.project.peakDailyLoadPercent).toBe(140);
    const plainQuery = new URLSearchParams(query); plainQuery.delete("granularity"); const plain = (await (await readonly.request.get(`${api}/resource-dashboard?${plainQuery}`)).json()).data;
    expect(plain.snapshotId).toBe(report.snapshotId); expect(plain).not.toHaveProperty("plan");
    const detail = (row: string, scope: string, extra: Record<string, string> = {}) => new URLSearchParams({ ...Object.fromEntries(query), snapshotId: report.snapshotId, periodId: "all", row, demandScope: scope, ...extra });
    const dailyResponse = await readonly.request.get(`${api}/resource-dashboard/plan/daily?${detail("resource", "project", { resourceId: r1, limit: "1" })}`); expect(dailyResponse.status()).toBe(200);
    const daily = (await dailyResponse.json()).data as ResourcePlanDailyDto; expect(daily).toMatchObject({ periodId: "all", granularity: "week", demandScope: "project", totalCount: 2, nextOffset: 1, filters: report.filters }); expect(daily.rows[0].metrics.knownMd).toBeCloseTo(1.4);
    const resourcesResponse = await readonly.request.get(`${api}/resource-dashboard/plan/day-resources?${detail("group", "project", { groupId, date: "2026-10-19" })}`); expect(resourcesResponse.status()).toBe(200);
    const resources = (await resourcesResponse.json()).data as ResourcePlanDayResourcesDto; expect(resources.rows.find(r => r.resourceId === r0)!.metrics).toMatchObject({ knownMd: 0, capacityMd: 1 }); expect(resources.totalCount).toBe(2);
    const assignmentsQuery = detail("resource", "project", { resourceId: r1, date: "2026-10-19", limit: "1" });
    const causeResponse = await readonly.request.get(`${api}/resource-dashboard/plan/day-assignments?${assignmentsQuery}`); expect(causeResponse.status()).toBe(200); const first = (await causeResponse.json()).data as ResourcePlanDayAssignmentsDto;
    expect(first).toMatchObject({ totalCount: 2, nextOffset: 1, demandScope: "project", date: "2026-10-19" }); assignmentsQuery.set("offset", "1"); const second = (await (await readonly.request.get(`${api}/resource-dashboard/plan/day-assignments?${assignmentsQuery}`)).json()).data as ResourcePlanDayAssignmentsDto;
    expect([first.rows[0].taskName, second.rows[0].taskName].sort()).toEqual(["M1 80%", "M2 60%"]); expect(second.nextOffset).toBeNull();
    expect((await readonly.request.get(`${api}/resource-dashboard/plan/daily?${detail("resource", "project", { resourceId: hidden })}`)).status()).toBe(400);
    expect((await readonly.request.get(`${api}/resource-dashboard/plan/day-assignments?${detail("resource", "project", { resourceId: r1, periodId: "2026-W43", date: "2026-10-18" })}`)).status()).toBe(400);
    for (const kind of ["daily", "day-resources", "day-assignments"]) expect((await readonly.request.post(`${api}/resource-dashboard/plan/${kind}`)).status()).toBe(405);
    expect((await readonly.request.get(`${api}/resource-dashboard?${query}&to=2027-12-31`)).status()).toBe(400);
    const tooLong = new URLSearchParams(query); tooLong.set("to", "2027-12-31"); expect((await readonly.request.get(`${api}/resource-dashboard?${tooLong}`)).status()).toBe(422);
    const protectedWrite = await readonly.request.patch(`${api}/tasks/${a.taskId}`, { headers: { Origin: origin, "If-Match": `"${report.projectRevision}"` }, data: { name: "Denied" } }); expect(protectedWrite.status()).toBe(401);
    expect(await readonly.cookies()).toEqual([]); expect((await get()).data.project.revision).toBe(report.projectRevision);
    await restartIsolatedApplication(); const persisted = (await (await readonly.request.get(`${api}/resource-dashboard?${query}`)).json()).data; expect(persisted.snapshotId).toBe(report.snapshotId); expect(persisted.plan.totals).toEqual(report.plan!.totals);
    await mutate(`/tasks/${a.taskId}`, { name: "Changed source" }, "patch"); const stale = await readonly.request.get(`${api}/resource-dashboard/plan/daily?${detail("resource", "project", { resourceId: hidden })}`); expect(stale.status()).toBe(409); expect((await stale.json()).error.code).toBe("REPORT_STALE");
    await testInfo.attach("actual-527-api", { body: JSON.stringify({ publicId, projectRevision: report.projectRevision, snapshotId: report.snapshotId, selected: person.summary.selected, project: person.summary.project, daily, resources, causes: [first.rows[0], second.rows[0]] }), contentType: "application/json" });
  } finally { await readonly.close(); }
});
