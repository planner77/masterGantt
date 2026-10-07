import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MilestoneDashboardDto } from "../../../src/contracts/milestone-dashboard";
import type { ProjectExcelExportRequest } from "../../../src/contracts/project-excel-export";
import { openDatabase } from "../../../src/server/db/core";
import { buildProjectExcelWorkbook } from "../../../src/server/exports/project-excel-export-core";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { MilestoneDashboardService } from "../../../src/server/projects/milestone-dashboard-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";

const NOW = "2026-10-06T15:00:00.000Z";
const dbs: ReturnType<typeof openDatabase>["database"][] = [];
afterEach(() => { vi.restoreAllMocks(); dbs.splice(0).forEach((db) => db.close()); });
function fixture(mdPerMmEnvironment?: string) {
  const db = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") }).database; dbs.push(db);
  const projects = new ProjectRepository(db), schedules = new ScheduleRepository(db), catalog = new ResourceCatalogRepository(db);
  const project = projects.insert({ publicId: randomUUID(), name: "=단계\n프로젝트😀", description: "", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16), passwordHash: Buffer.alloc(32), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: NOW, updatedAt: NOW });
  const add = (name: string, type: "task" | "summary" | "milestone" = "task", parentId: number | null = null, progress = 0) => schedules.insertTask({ projectId: project.id, publicId: randomUUID(), externalId: name, name, description: "=,+,-,@ 한글 <&>\r\n\"😀", url: "https://example.com/", type, parentId, sortOrder: schedules.nextSiblingSortOrder(project.id, parentId), scheduleMode: "auto", requestedStart: type === "summary" ? null : "2026-10-05", startDate: "2026-10-05", endDate: type === "milestone" ? "2026-10-05" : "2026-10-09", duration: type === "milestone" ? 0 : 5, progress, createdAt: NOW, updatedAt: NOW });
  const m1 = add("=M1", "milestone"), m2 = add("+M2", "milestone"), m3 = add("@M3", "milestone");
  for (const before of [m1, m2]) schedules.insertLink({ publicId: randomUUID(), projectId: project.id, predecessorTaskId: before.id, successorTaskId: m3.id, type: "FS", lag: 0, createdAt: NOW, updatedAt: NOW });
  const summary = add("S", "summary"), nested = add("Nested", "summary", summary.id), inherited = add("Inherited", "task", nested.id, 50), overridden = add("Override", "task", nested.id, 100), unassigned = add("U");
  const members = new MilestoneMembershipRepository(db); members.set(project.id, summary.id, m1.id); members.set(project.id, overridden.id, m2.id);
  schedules.updateTaskBaseline(project.id, inherited.publicId, { baselineStart: "2026-10-05", baselineDuration: 5, baselineEnd: "2026-10-09", updatedAt: NOW });
  const resource = catalog.insertResource({ publicId: randomUUID(), name: "=개발자", code: "@R", description: "", developerGrade: "EXPERT", now: NOW });
  catalog.replaceResourceRoles(resource.id, ["DEVELOPER"], NOW);
  const groups = ["G1", "G2"].map((name) => catalog.insertGroup({ publicId: randomUUID(), name, code: name, description: "", now: NOW }));
  groups.forEach((group) => catalog.replaceGroupMembers(group.id, [resource.id], NOW));
  for (const [task, percent] of [[inherited, 50], [overridden, 25], [unassigned, null]] as const) catalog.replaceTaskAssignments({ projectId: project.id, taskId: task.id, now: NOW, targets: [{ publicId: resource.publicId, kind: "resource", internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: percent }] });
  const clock = vi.fn(() => new Date(NOW)), service = new ProjectExportSnapshotService(db, { clock, mdPerMmEnvironment });
  const bundle = () => service.get(project.publicId, true)!;
  const state = () => JSON.stringify({ p: projects.findById(project.id), tasks: schedules.listTasks(project.id), links: schedules.listLinks(project.id), members: members.list(project.id), assignments: catalog.listAssignments(project.id), catalog: catalog.getRevision() });
  const request = (input = exportRequest, revision = 1, origin = "https://gantt.example") => new Request(`https://gantt.example/api/projects/${project.publicId}/exports/excel`, { method: "POST", headers: { Origin: origin, "If-Match": `"${revision}"`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const dependencies = { service: new TaskFieldProjectService(db), getExportBundle: service.get.bind(service), applicationBaseUrl: "https://gantt.example", environment: "test", requestId: () => "excel-stage-test" };
  return { db, project, schedules, catalog, service, clock, bundle, state, request, dependencies, m1, m2, m3, summary, nested, inherited, overridden, unassigned, add, members };
}
const exportRequest: ProjectExcelExportRequest = { includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] } };
function unzip(bytes: Uint8Array): Map<string, string> {
  const b = Buffer.from(bytes), entries = new Map<string, string>(); let offset = 0;
  while (offset + 30 <= b.length && b.readUInt32LE(offset) === 0x04034b50) {
    const size = b.readUInt32LE(offset + 18), nameSize = b.readUInt16LE(offset + 26), extraSize = b.readUInt16LE(offset + 28);
    const start = offset + 30 + nameSize + extraSize;
    entries.set(b.toString("utf8", offset + 30, offset + 30 + nameSize), inflateRawSync(b.subarray(start, start + size)).toString("utf8")); offset = start + size;
  }
  return entries;
}
function worksheet(entries: Map<string, string>, name: string): string {
  const id = entries.get("xl/workbook.xml")!.match(new RegExp(`name="${name}" sheetId="(\\d+)"`))![1];
  return entries.get(`xl/worksheets/sheet${id}.xml`)!;
}
function workbook(f: ReturnType<typeof fixture>, includeDependencies = false) {
  const b = f.bundle(); return unzip(buildProjectExcelWorkbook(b.snapshot, { ...exportRequest, includeDependencies }, b.resourceWorkload, b.stageDashboard));
}

describe("Excel 단계 소속 및 같은 스냅샷 보고", () => {
  it("동일 read transaction과 clock 1회로 전체 DTO를 조회하고 원본을 변경하지 않는다", () => {
    const f = fixture("20"), before = f.state(), original = ProjectRepository.prototype.findByPublicId;
    vi.spyOn(ProjectRepository.prototype, "findByPublicId").mockImplementation(function (this: ProjectRepository, publicId) { expect(f.db.inTransaction).toBe(true); return original.call(this, publicId); });
    const b = f.bundle(); expect(f.clock).toHaveBeenCalledTimes(1);
    expect(b.stageDashboard).toEqual(new MilestoneDashboardService(f.db, { clock: () => new Date(NOW), mdPerMmEnvironment: "20" }).getDashboard(f.project.publicId));
    expect(b.stageDashboard.projectRevision).toBe(b.snapshot.data.project.revision); expect(b.stageDashboard.catalogRevision).toBe(b.resourceWorkload!.data.catalogRevision);
    expect(b.stageDashboard.effort.plannedMd).toBe(b.resourceWorkload!.data.grandTotalMd); expect(b.stageDashboard.effort.assignments).toHaveLength(3);
    expect(b.stageDashboard.effort.buckets.reduce((sum, bucket) => sum + bucket.plannedMd, 0)).toBe(b.stageDashboard.effort.plannedMd);
    expect(b.stageDashboard.rows.find((row) => row.milestoneTaskId === f.m3.publicId)!.stageGate).toMatchObject({ manualEvent: true, ready: null });
    expect(f.state()).toBe(before);
  });
  it.each([false, true])("Dependency 포함 %s에서도 명시/유효/상속 출처와 원시 KPI를 보존한다", (includeDependencies) => {
    const f = fixture("20"), b = f.bundle(), entries = workbook(f, includeDependencies), taskSheet = worksheet(entries, "Tasks"), stageSheet = worksheet(entries, "Milestone Stages");
    expect(entries.get("xl/workbook.xml")!.includes('name="Dependencies"')).toBe(includeDependencies);
    expect(taskSheet).toContain("명시 단계 외부 ID"); expect(taskSheet).toContain("유효 단계 외부 ID(파생)"); expect(taskSheet).toContain("상속 출처 외부 ID(파생)");
    const row = taskSheet.match(/<row[^>]*>[^]*?<\/row>/g)!.find(value => value.includes(f.inherited.publicId))!;
    expect(row).toContain(f.m1.publicId); expect(row).toContain(f.summary.publicId); expect(taskSheet).toContain("Baseline 기간");
    expect(stageSheet).toContain("Grand Total"); expect(stageSheet).toContain("미지정"); expect(stageSheet).toContain("기본 전체 F");
    expect(stageSheet).toContain(`<v>${b.stageDashboard.effort.plannedMd}</v>`); expect(stageSheet).toContain(`<v>${b.stageDashboard.effort.plannedMm}</v>`);
    for (const id of b.stageDashboard.effort.assignmentIds) expect(stageSheet).toContain(id);
    expect(stageSheet).toContain("stage.predecessor"); expect(stageSheet).toContain(f.m3.publicId); expect(stageSheet).toContain("stage.member");
    expect(stageSheet).toContain("mdPerMmSource"); expect(stageSheet).toContain("environment"); expect(stageSheet).toContain("catalogRevision"); expect(stageSheet).toContain(NOW);
    expect(taskSheet).toContain("=,+,-,@ 한글 &lt;&amp;&gt;\r\n&quot;😀"); expect(stageSheet).toContain("=M1"); expect(stageSheet).not.toContain("&apos;=M1");
    for (const value of entries.values()) expect(value).not.toContain("<f>");
  });
  it("환산 미설정은 null 공란과 출처로 보존하며 0 M/M으로 꾸미지 않는다", () => {
    const f = fixture(), b = f.bundle(), sheet = worksheet(workbook(f), "Milestone Stages"); expect(b.stageDashboard.effort.plannedMm).toBeNull(); expect(sheet).toContain("unset");
    expect(sheet).toMatch(/<row[^>]*>.*mdPerMm<\/t>.*<c r="B\d+" s="4"\/>/); expect(sheet).toContain("M/M 환산 미설정은 0이 아님");
  });
  it("단계 DTO 누락과 다른 Project/Revision/Catalog/Stage/필터를 전체 거부한다", () => {
    const f = fixture("20"), b = f.bundle(); expect(() => buildProjectExcelWorkbook(b.snapshot, exportRequest)).toThrow(/must be supplied/);
    const mutations: ((dto: MilestoneDashboardDto) => void)[] = [d => { d.projectPublicId = randomUUID(); }, d => { d.projectRevision--; }, d => { d.catalogRevision++; }, d => { d.rows.pop(); }, d => { d.rows[0].stageGate.ready = !d.rows[0].stageGate.ready; }, d => { d.filters.search = "M"; }, d => { d.scope.taskIds.pop(); }, d => { d.kpi.ready.milestoneTaskIds = [randomUUID()]; }, d => { d.effort.assignments[0].assignmentId = randomUUID(); }];
    for (const change of mutations) { const dto = structuredClone(b.stageDashboard); change(dto); expect(() => buildProjectExcelWorkbook(b.snapshot, exportRequest, b.resourceWorkload, dto)).toThrow(/match/); }
  });
  it("대량 ID는 개별 행으로 보존하고 초과 텍스트/행은 전체 실패한다", () => {
    const f = fixture();
    const ids = Array.from({ length: 1000 }, (_, index) => { const task = f.add(`Large-${index}`); f.members.set(f.project.id, task.id, f.m1.id); return task.publicId; });
    const b = f.bundle(), sheet = worksheet(unzip(buildProjectExcelWorkbook(b.snapshot, exportRequest, undefined, b.stageDashboard)), "Milestone Stages");
    expect(sheet.match(/stage.member<\/t>/g)).toHaveLength(1002); for (const id of ids) expect(sheet).toContain(id);
    b.stageDashboard.rows[0].name = "x".repeat(32768); expect(() => buildProjectExcelWorkbook(b.snapshot, exportRequest, undefined, b.stageDashboard)).toThrow(/cell limit/);
    b.stageDashboard.rows[0].name = "M"; b.stageDashboard.kpi.ready.milestoneTaskIds = Array(50000).fill(f.m1.publicId); expect(() => buildProjectExcelWorkbook(b.snapshot, exportRequest, undefined, b.stageDashboard)).toThrow(/row limit/);
  });
  it("HTTP readonly Excel은 200과 no-store/ETag/정확 파일명을 반환하고 저장하지 않는다", async () => {
    const f = fixture("20"), before = f.state(), response = await handleProjectExcelExport(f.request(), f.project.publicId, f.dependencies);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("etag")).toBe('"1"'); expect(response.headers.get("content-disposition")).toContain(`mastergantt-${f.project.publicId}-r1.xlsx`);
    const entries = unzip(new Uint8Array(await response.arrayBuffer())); expect(worksheet(entries, "Milestone Stages")).toContain(f.m1.publicId); expect(f.state()).toBe(before);
  });
  it("HTTP stale Project/Catalog, Origin, 미설정 DTO를 412/403/500으로 거부한다", async () => {
    const f = fixture("20"), before = f.state();
    expect((await handleProjectExcelExport(f.request(exportRequest, 2), f.project.publicId, f.dependencies)).status).toBe(412);
    expect((await handleProjectExcelExport(f.request(exportRequest, 1, "https://other.example"), f.project.publicId, f.dependencies)).status).toBe(403);
    const response = await handleProjectExcelExport(f.request(), f.project.publicId, { ...f.dependencies, getExportBundle: undefined }); expect(response.status).toBe(500); expect((await response.json()).error.code).toBe("CONFIGURATION_ERROR");
    const mismatch = await handleProjectExcelExport(f.request({ ...exportRequest, includeResourceEffort: true }), f.project.publicId, { ...f.dependencies, getExportBundle: () => { const b = f.bundle(); b.resourceWorkload!.data.catalogRevision++; return b; } }); expect(mismatch.status).toBe(412);
    expect(f.state()).toBe(before);
  });
  it("bundle의 Catalog mismatch는 파일 생성 전 412이며 없는 Project는 404다", async () => {
    const f = fixture(), before = f.state(), original = MilestoneDashboardService.prototype.getDashboard;
    vi.spyOn(MilestoneDashboardService.prototype, "getDashboard").mockImplementation(function (this: MilestoneDashboardService, publicId, filter) {
      const dto = original.call(this, publicId, filter); if (dto) dto.catalogRevision++; return dto;
    });
    const response = await handleProjectExcelExport(f.request(), f.project.publicId, f.dependencies);
    expect(response.status).toBe(412); expect((await response.json()).error.code).toBe("REVISION_MISMATCH"); expect(f.state()).toBe(before);
    expect(f.service.get(randomUUID())).toBeUndefined();
    const absent = await handleProjectExcelExport(f.request(), randomUUID(), f.dependencies); expect(absent.status).toBe(404);
  });
  it("unknown 옵션과 과대 요청 본문은 전체 거부하며 source를 유지한다", async () => {
    const f = fixture(), before = f.state();
    const invalid = new Request(f.request(), { body: JSON.stringify({ ...exportRequest, dashboardFilters: {} }) });
    expect((await handleProjectExcelExport(invalid, f.project.publicId, f.dependencies)).status).toBe(400);
    const large = new Request(f.request(), { body: JSON.stringify({ ...exportRequest, padding: "x".repeat(8192) }) });
    expect((await handleProjectExcelExport(large, f.project.publicId, f.dependencies)).status).toBe(413); expect(f.state()).toBe(before);
  });
});
