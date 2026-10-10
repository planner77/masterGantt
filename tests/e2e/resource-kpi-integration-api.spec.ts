import { inflateRawSync } from "node:zlib";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { integrationAdminPassword, seedResourceKpiIntegration } from "./fixtures/resource-kpi-integration-ui";
import { calculateResourceKpi } from "../../src/domain/resources/resource-kpi";
import type { ResourceDashboardDetailsDto, ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import type { ProjectExcelExportRequest } from "../../src/contracts/project-excel-export";
import { RESOURCE_KPI_INTEGRATION as c, resourceKpiIntegrationFixture } from "../fixtures/resource-kpi-integration";

test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: integrationAdminPassword });
function unzip(bytes: Buffer) { const entries = new Map<string, string>(); let at = 0; while (at + 30 <= bytes.length && bytes.readUInt32LE(at) === 0x04034b50) { const size = bytes.readUInt32LE(at + 18), length = bytes.readUInt16LE(at + 26), start = at + 30 + length + bytes.readUInt16LE(at + 28); entries.set(bytes.toString("utf8", at + 30, at + 30 + length), inflateRawSync(bytes.subarray(start, start + size)).toString()); at = start + size; } return entries; }

test("#530 같은 실제 HTTP 원장: Domain·SQLite API·XLSX·exact drill·읽기 권한·stale", async ({ page, browser, baseURL, restartIsolatedApplication }, info) => {
  test.setTimeout(180000);
  const origin = baseURL!, seed = await seedResourceKpiIntegration(page.request, origin), canonical = await seed.getSnapshot();
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const input = resourceKpiIntegrationFixture(), filters = { from: c.from, to: c.to, asOfDate: c.asOfDate, mdPerMm: c.mdPerMm };
    const parameters = new URLSearchParams({ from: c.from, to: c.to, asOfDate: c.asOfDate, mdPerMm: String(c.mdPerMm) });
    const response = await readonly.request.get(`${seed.api}/resource-dashboard?${parameters}`); expect(response.status()).toBe(200);
    const report = (await response.json()).data as ResourceDashboardDto, domain = calculateResourceKpi(input);
    expect(report.summary).toMatchObject({ taskCount: 4, resourceCount: 2, assignmentCount: 5, effort: { knownMd: domain.total.effort.knownMd, plannedMm: 0.575, unsetCount: 1, state: "partial" } });
    expect(report.asOfDate).toBe(c.asOfDate); expect(report.timezone).toBe(input.timezone); expect(report.range).toEqual(domain.range); expect(report.projectRevision).toBe(canonical.data.project.revision);
    expect(report.groups.find(g => g.id === seed.groups.G1)!.summary.effort.knownMd).toBe(11.5); expect(report.groups.find(g => g.id === seed.groups.G2)!.summary.effort.knownMd).toBe(5.5);
    expect(report.resources.map(r => r.id).sort()).toEqual(Object.values(seed.resources).sort());
    expect(report.diagnostics).toMatchObject({ denominator: 6, completelyUnassigned: { count: 1 }, groupOnly: { count: 1 }, unsetAssignmentCount: 1 });
    for (const stage of report.stages) expect(stage.full.ready).toBe(false);
    for (const granularity of ["week", "month"]) {
      const r = (await (await readonly.request.get(`${seed.api}/resource-dashboard?${parameters}&granularity=${granularity}&mode=group`)).json()).data as ResourceDashboardDto;
      expect(r.snapshotId).toBe(report.snapshotId); expect(r.summary).toEqual(report.summary); expect(r.plan!.totals.summary.selected.capacityMd).toBe(10); expect(r.plan!.totals.summary.selected.knownMd).toBeCloseTo(11.5, 14);
      const daily = await readonly.request.get(`${seed.api}/resource-dashboard/plan/daily?${parameters}&snapshotId=${r.snapshotId}&granularity=${granularity}&periodId=all&row=total&demandScope=selected&limit=2`); expect(daily.status()).toBe(200); expect((await daily.json()).data).toMatchObject({ totalCount: 5, nextOffset: 2 });
    }
    const detailsResponse = await readonly.request.get(`${seed.api}/resource-dashboard/details?${parameters}&snapshotId=${report.snapshotId}&dimension=all&metric=all&view=assignments&limit=100`); expect(detailsResponse.status()).toBe(200);
    const details = (await detailsResponse.json()).data as ResourceDashboardDetailsDto;
    expect(details.rows).toHaveLength(5);
    const mapped = details.rows.map(row => { const task = Object.entries(seed.tasks).find(([, t]) => t.taskId === row.taskId)![0], resource = Object.entries(seed.resources).find(([, id]) => id === row.assignment!.resourceId)![0]; return { ...row, key: `${task}-${resource}` }; });
    expect(mapped.map(row => row.key).sort()).toEqual(domain.total.assignmentIds);
    for (const row of mapped) { const raw = domain.assignments.find(a => a.assignmentId === row.key)!; expect(row.assignment).toMatchObject({ allocationPercent: raw.allocationPercent, from: raw.from, to: raw.to, effectiveWorkingDays: raw.effectiveWorkingDays, plannedMd: raw.plannedMd, plannedMm: raw.plannedMm }); expect(row.taskStart).toBe(c.from); expect(row.taskEnd).toBe(c.to); expect(row.status).toBe("not_started"); }
    const body: ProjectExcelExportRequest = { scope: "project", scale: "day", includeDependencies: false, hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] }, resourceDashboard: { basis: "current", expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters }, granularities: ["week", "month"] } };
    const exportFile = (data = body, headers = { Origin: origin, "If-Match": `"${report.projectRevision}"` }) => readonly.request.post(`${seed.api}/exports/excel`, { headers, data });
    const file = await exportFile(); expect(file.status(), await file.text()).toBe(200);
    const bytes = await file.body(), entries = unzip(bytes), names = [...entries.get("xl/workbook.xml")!.matchAll(/name="([^"]+)"/g)].map(m => m[1]);
    const xml = entries.get(`xl/worksheets/sheet${names.indexOf("Resource Assignments") + 1}.xml`)!;
    expect([...xml.matchAll(/<row /g)]).toHaveLength(6);
    for (const detail of mapped) { const row = [...xml.matchAll(/<row[^>]*>(.*?)<\/row>/g)].find(row => row[1].includes(detail.assignment!.assignmentId))![1]; const numeric = /<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/.exec(row); if (detail.assignment!.plannedMd === null) expect(row).toMatch(/<c r="Y\d+"[^>]*\/>/); else expect(Number(numeric![1])).toBe(detail.assignment!.plannedMd); }
    expect([...xml.matchAll(/<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/g)].reduce((n, m) => n + Number(m[1]), 0)).toBe(report.summary.effort.knownMd);
    expect([...entries.values()].join("")).not.toMatch(/<f>|passwordHash|passwordSalt|tokenHash/);
    const links = [...entries.values()].filter(xml => xml.includes('TargetMode="External"')); expect(links).toHaveLength(1); expect(links[0]).toContain(`Target="${origin}/projects/${seed.publicId}"`);
    expect(file.headers()["cache-control"]).toBe("private, no-store"); expect(file.headers()["set-cookie"]).toBeUndefined(); expect(file.headers()["x-content-type-options"]).toBe("nosniff");
    const exactId = mapped.find(row => row.key === "T1-A")!.assignment!.assignmentId;
    const exact = { sourceContext: report.resourceScopeContext, scope: { kind: "exactAssignments", assignmentIds: [exactId] }, filters, projection: { kind: "report" } };
    const scoped = await readonly.request.post(`${seed.api}/resource-dashboard/query`, { headers: { Origin: origin }, data: exact }); expect(scoped.status()).toBe(200); expect((await scoped.json()).data.summary).toMatchObject({ assignmentCount: 1, effort: { knownMd: 2.5 } });
    expect((await readonly.request.post(`${seed.api}/resource-dashboard/query`, { data: exact })).status()).toBe(403);
    expect((await readonly.request.post(`${seed.api}/resource-dashboard/query`, { headers: { Origin: "https://foreign.example" }, data: exact })).status()).toBe(403);
    expect((await readonly.request.patch(`${seed.api}/tasks/${seed.tasks.T1.taskId}`, { headers: { Origin: origin, "If-Match": `"${report.projectRevision}"` }, data: { name: "Unauthorized" } })).status()).toBe(401);
    expect((await exportFile(body, { Origin: origin, "If-Match": '"99999"' })).status()).toBe(412);
    expect((await exportFile(body, { Origin: "https://foreign.example", "If-Match": `"${report.projectRevision}"` })).status()).toBe(403);
    const foreignContext = await browser.newContext({ baseURL: origin });
    try {
    const other = await foreignContext.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Foreign #530", ownerName: "E2E 자동화", description: "synthetic", editPassword: "Other530!" } }); expect(other.status()).toBe(201);
    const otherId = (await other.json()).data.project.publicId, otherTask = await foreignContext.request.post(`/api/projects/${otherId}/tasks`, { headers: { Origin: origin, "If-Match": '"1"' }, data: { name: "foreign", type: "task", start: c.from, duration: 1, progress: 0 } }); expect(otherTask.status()).toBe(201);
    const foreignTaskId = (await otherTask.json()).data.tasks[0].taskId;
    expect((await readonly.request.get(`${seed.api}/resource-dashboard?${parameters}&taskIds=${foreignTaskId}`)).status()).toBe(400);
    } finally { await foreignContext.close(); }
    expect((await readonly.request.get(`${seed.api}/resource-dashboard?from=2026-01-01&to=2027-01-02`)).status()).toBe(422);
    expect(await readonly.cookies()).toEqual([]); expect(await seed.getSnapshot()).toEqual(canonical);
    await restartIsolatedApplication();
    const restart = (await (await readonly.request.get(`${seed.api}/resource-dashboard?${parameters}`)).json()).data as ResourceDashboardDto; expect(restart.snapshotId).toBe(report.snapshotId); expect(restart.calendarRevision).toBe(report.calendarRevision);
    await seed.mutate(`/tasks/${seed.tasks.T2.taskId}`, { name: "Changed source #530" }, "patch");
    const stale = await exportFile(); expect(stale.status()).toBe(412); expect(stale.headers()["content-type"]).toContain("json");
    const staleDrill = await readonly.request.post(`${seed.api}/resource-dashboard/query`, { headers: { Origin: origin }, data: exact }); expect(staleDrill.status()).toBe(409); expect((await staleDrill.json()).error.code).toBe("REPORT_STALE");
    await info.attach("resource-kpi-integration-api-raw", { body: JSON.stringify({ projectPublicId: seed.publicId, snapshotId: report.snapshotId, revisions: { project: report.projectRevision, catalog: report.catalogRevision, calendar: report.calendarRevision }, raw: mapped.map(row => ({ key: row.key, taskId: row.taskId, ...row.assignment })), totals: report.summary, xlsxBytes: bytes.length, sheets: names, restartSnapshotId: restart.snapshotId }), contentType: "application/json" });
  } finally { await readonly.close(); }
});
