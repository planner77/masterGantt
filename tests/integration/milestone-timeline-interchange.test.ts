import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/server/db/core";
import { TaskFieldProjectService } from "../../src/server/projects/task-field-project-service";
import { ProjectImportService } from "../../src/server/imports/project-import-service-core";
import { ProjectCopyService } from "../../src/server/projects/project-copy-service-core";
import { ProjectTemplateService } from "../../src/server/templates/project-template-service-core";
import { TaskHierarchyService } from "../../src/server/projects/task-hierarchy-service-core";
import { ScheduleRepository } from "../../src/server/repositories/schedule-repository-core";
import { ProjectExportSnapshotService } from "../../src/server/exports/project-export-snapshot-service-core";
import { buildProjectJsonExport } from "../../src/server/exports/project-json-export-core";
import { buildProjectExcelWorkbook } from "../../src/server/exports/project-excel-export-core";
import { buildProjectGanttSvg } from "../../src/server/exports/project-svg-export-core";
import { ResourceDashboardService } from "../../src/server/resources/resource-dashboard-service-core";
import { ResourceCatalogRepository } from "../../src/server/repositories/resource-catalog-repository-core";
import { StageGateError } from "../../src/domain/milestones/stage-gates";
import type { ProjectExcelExportRequest } from "../../src/contracts/project-excel-export";
import type { ProjectSnapshotResponse } from "../../src/contracts/projects";
import { canonicalInterchangeFixture, canonicalMeaning, fixtureBytes, logicalHash, workbookEntries, workbookSheet } from "../fixtures/issue-553/canonical-interchange";

const clock = () => new Date("2026-10-09T00:00:00.000Z");
const hashPassword = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
const databases: ReturnType<typeof openDatabase>["database"][] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const excel: ProjectExcelExportRequest = { includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] } };
async function fixture() {
  const db = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
  databases.push(db);
  const projects = new TaskFieldProjectService(db, { clock, hashPassword }), imports = new ProjectImportService(db, { clock, projectService: projects });
  const create = async () => {
    const created = await projects.create({ name: "MT5", description: "synthetic", ownerName: "Synthetic", editPassword: "test" });
    const publicId = created.response.data.project.publicId, token = created.rawSessionToken;
    const authorized = projects.authorize(publicId, token);
    if (authorized.kind !== "authorized") throw new Error("expected session");
    const get = () => projects.getReadonlySnapshot(publicId)!;
    const commit = (bytes: Uint8Array) => { const p = imports.preview(publicId, token, bytes); return imports.commit(publicId, token, p.baseRevision, p.previewDigest, bytes); };
    return { publicId, token, authorization: authorized.authorization, get, commit };
  };
  const source = await create(); source.commit(fixtureBytes());
  const task = (externalId: string) => source.get().data.tasks.find(t => t.externalId === externalId)!;
  const patch = (externalId: string, input: Parameters<typeof projects.updateTask>[3]) => projects.updateTask(source.authorization, source.get().data.project.revision, task(externalId).taskId, input);
  const state = () => ({ projects: db.prepare("SELECT public_id,revision FROM projects ORDER BY id").all(), tasks: db.prepare("SELECT * FROM tasks ORDER BY id").all(), links: db.prepare("SELECT * FROM links ORDER BY id").all(), memberships: db.prepare("SELECT * FROM task_milestone_memberships ORDER BY project_id,member_task_id").all() });
  return { db, projects, imports, create, source, task, patch, state };
}
function independentIds(source: ProjectSnapshotResponse, target: ProjectSnapshotResponse) {
  const ids = new Set([...source.data.tasks.map(t => t.taskId), ...source.data.links.map(l => l.id)]);
  expect(target.data.tasks.every(t => /^[0-9a-f-]{36}$/.test(t.taskId) && !ids.has(t.taskId))).toBe(true);
  expect(target.data.links.every(l => !ids.has(l.id))).toBe(true);
}

describe("#553 canonical Milestone interchange integration", () => {
  it("uses one fixed authored fixture and verifies inherited/override/manual/full gates and schedule-adjusted Summary", async () => {
    const f = await fixture(), snapshot = f.source.get();
    expect(snapshot.data.tasks).toHaveLength(33); expect(snapshot.data.links).toHaveLength(8);
    expect(new Set(snapshot.data.links.map(l => `${l.type}:${l.lag}`))).toEqual(new Set(["FS:1", "SS:-1", "FF:1", "SF:-1"]));
    expect(f.task("INHERITED").membership).toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: f.task("M-SAME-A").taskId, inheritedFromTaskId: f.task("S").taskId });
    expect(f.task("OVERRIDE").membership?.effectiveMilestoneTaskId).toBe(f.task("M-SAME-B").taskId);
    expect(f.task("EMPTY")).toMatchObject({ start: null, end: null, duration: null, progress: null });
    expect(f.task("M-ONLY")).toMatchObject({ start: f.task("M-INTERNAL").start, end: f.task("M-INTERNAL").end, duration: 1 });
    expect(f.task("M-MANUAL").stageGate).toMatchObject({ manualEvent: true, ready: null, memberTaskIds: [] });
    expect(f.task("M-READY").stageGate).toMatchObject({ ready: true, memberCount: 1 });
    expect(f.task("M-SS-Q").stageGate).toMatchObject({ blocked: true, predecessorMilestoneTaskIds: [f.task("M-SS-P").taskId] });
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it("JSON1.1 round trip allocates every UUID and remaps parent/link/explicit membership with exact semantic equality", async () => {
    const f = await fixture(), source = f.source.get(), original = f.state();
    const output = buildProjectJsonExport(source, clock().toISOString());
    expect(output.tasks).toHaveLength(33); expect(output.memberships).toHaveLength(5);
    expect(Object.keys(output).sort()).toEqual(["memberships", "project", "schemaVersion", "source", "tasks"]);
    const target = await f.create(); target.commit(Buffer.from(JSON.stringify(output)));
    const imported = target.get(); independentIds(source, imported);
    expect(canonicalMeaning(imported)).toEqual(canonicalMeaning(source));
    expect(logicalHash(canonicalMeaning(imported))).toBe(logicalHash(canonicalMeaning(source)));
    expect(f.source.get()).toEqual(source);
    expect(f.state().tasks.filter((row: unknown) => original.tasks.some(old => JSON.stringify(old) === JSON.stringify(row)))).toHaveLength(original.tasks.length);
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it.each([false, true])("whole Project Copy preserves full canonical hierarchy/membership and honors progress reset=%s", async resetProgress => {
    const f = await fixture(), source = f.source.get();
    const copied = await new ProjectCopyService(f.db, { clock, hashPassword }).copy(f.source.authorization, source.data.project.revision, { name: "Copy", description: "", editPassword: "test", resetProgress });
    const target = f.projects.getReadonlySnapshot(copied.response.data.project.publicId)!;
    independentIds(source, target);
    expect(target.data.tasks).toHaveLength(33); expect(target.data.links).toHaveLength(8);
    if (!resetProgress) expect(canonicalMeaning(target)).toEqual(canonicalMeaning(source));
    else {
      expect(target.data.tasks.filter(t => t.type !== "summary").every(t => t.status === "not_started" && t.progress === 0)).toBe(true);
      const reset = canonicalMeaning(target), original = canonicalMeaning(source);
      expect(reset.links).toEqual(original.links);
      const structural = (task: typeof reset.tasks[number]) => { const copy: Partial<typeof task> = { ...task }; delete copy.progress; delete copy.status; delete copy.gate; return copy; };
      expect(reset.tasks.map(structural)).toEqual(original.tasks.map(structural));
      expect(target.data.tasks.find(t => t.externalId === "M-CLOSED")?.stageGate?.ready).toBe(false);
    }
    expect(f.source.get()).toEqual(source); expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it("Template saves all explicit refs, instantiates fresh identities and resets leaf state/baselines without source edits", async () => {
    const f = await fixture(), before = f.source.get(), service = new ProjectTemplateService(f.db, { clock, hashPassword });
    const saved = service.createTemplateFromProject(f.source.authorization, before.data.project.revision, { name: "MT5", description: "" });
    const instantiated = await service.instantiateProject(saved.id, { name: "Template", ownerName: "Synthetic", editPassword: "test", projectStartDate: "2026-10-06" });
    const target = f.projects.getReadonlySnapshot(instantiated.response.data.project.publicId)!;
    independentIds(before, target); expect(target.data.tasks).toHaveLength(33); expect(canonicalMeaning(target).links).toEqual(canonicalMeaning(before).links);
    expect(canonicalMeaning(target).tasks.map(t => [t.externalId, t.parentExternalId, t.membership])).toEqual(canonicalMeaning(before).tasks.map(t => [t.externalId, t.parentExternalId, t.membership]));
    expect(target.data.tasks.filter(t => t.type !== "summary").every(t => t.progress === 0 && t.status === "not_started" && t.baselineStart == null)).toBe(true);
    expect(f.source.get()).toEqual(before); expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it("multi-root Copy retains hidden M-only descendants, internal membership and relations while Cut keeps identities", async () => {
    const f = await fixture(), before = f.source.get(), hierarchy = new TaskHierarchyService(f.db, { clock });
    const names = ["S", "M-SAME-A", "M-SAME-B", "T-FS-P", "T-FS-Q"], roots = names.map(name => f.task(name).taskId);
    const result = hierarchy.execute(f.source.authorization, before.data.project.revision, { kind: "copy", taskIds: roots.reverse(), anchorTaskId: f.task("DEST").taskId, placement: "child", acknowledgedMembershipExclusions: true });
    const oldIds = new Set(before.data.tasks.map(t => t.taskId)), created = result.data.tasks.filter(t => !oldIds.has(t.taskId));
    expect(created).toHaveLength(11);
    const copyOf = (name: string) => created.find(t => t.name === f.task(name).name && t.type === f.task(name).type);
    const copiedS = copyOf("S")!, copiedInherited = copyOf("INHERITED")!;
    const copiedTarget = created.find(t => t.taskId === copiedS.membership?.explicitMilestoneTaskId)!;
    expect(copiedTarget.type).toBe("milestone");
    expect(copiedInherited.membership).toMatchObject({ effectiveMilestoneTaskId: copiedTarget.taskId, inheritedFromTaskId: copiedS.taskId });
    expect(created.some(t => t.name === "M-INTERNAL" && t.type === "milestone")).toBe(true);
    expect(result.data.links.filter(l => !before.data.links.some(old => old.id === l.id))).toHaveLength(1);
    const current = f.source.get(), free = f.task("FREE");
    const moved = hierarchy.execute(f.source.authorization, current.data.project.revision, { kind: "reparent", taskId: free.taskId, anchorTaskId: f.task("DEST").taskId, placement: "child" });
    expect(moved.data.tasks.find(t => t.taskId === free.taskId)).toMatchObject({ parentExternalId: "DEST", membership: { effectiveMilestoneTaskId: f.task("M-LONG").taskId, inheritedFromTaskId: f.task("DEST").taskId } });
    expect(new Set(moved.data.tasks.map(t => t.taskId))).toEqual(new Set(current.data.tasks.map(t => t.taskId)));
    expect(moved.data.links).toEqual(current.data.links);
  });
  it("historical completion mismatch stays visible, completed membership boundary Copy is locked and legacy JSON import rejects atomically", async () => {
    const f = await fixture(); f.patch("CLOSED-T", { status: "not_started" });
    expect(f.task("M-CLOSED").stageGate).toMatchObject({ ready: false, completionInconsistent: true });
    let before = f.state();
    expect(() => new TaskHierarchyService(f.db, { clock }).execute(f.source.authorization, f.source.get().data.project.revision, { kind: "copy", taskIds: [f.task("M-CLOSED").taskId], anchorTaskId: f.task("DEST").taskId, placement: "child", acknowledgedMembershipExclusions: true })).toThrow(new StageGateError("COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED", [f.task("M-CLOSED").taskId]));
    expect(f.state()).toEqual(before);
    f.patch("CLOSED-T", { status: "completed" });
    const repo = new ScheduleRepository(f.db), p = repo.findTaskByPublicId(f.source.authorization.projectId, f.task("FREE").taskId)!, q = repo.findTaskByPublicId(f.source.authorization.projectId, f.task("M-MANUAL").taskId)!;
    repo.insertLink({ projectId: f.source.authorization.projectId, publicId: randomUUID(), predecessorTaskId: p.id, successorTaskId: q.id, type: "SS", lag: 0, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
    const output = buildProjectJsonExport(f.source.get(), clock().toISOString());
    expect(output.tasks.find(t => t.externalId === "M-MANUAL")?.predecessors).toContainEqual({ externalId: "FREE", type: "SS", lag: 0 });
    const canonical = f.source.get(), copy = await new ProjectCopyService(f.db, { clock, hashPassword }).copy(f.source.authorization, canonical.data.project.revision, { name: "Legacy copy", description: "", editPassword: "test" });
    expect(canonicalMeaning(f.projects.getReadonlySnapshot(copy.response.data.project.publicId)!)).toEqual(canonicalMeaning(canonical));
    const templates = new ProjectTemplateService(f.db, { clock, hashPassword }), saved = templates.createTemplateFromProject(f.source.authorization, canonical.data.project.revision, { name: "Legacy template", description: "" });
    const restored = await templates.instantiateProject(saved.id, { name: "Legacy restored", ownerName: "Synthetic", editPassword: "test", projectStartDate: "2026-10-06" });
    expect(restored.response.data.links.find(l => l.predecessorExternalId === "FREE" && l.successorExternalId === "M-MANUAL")).toMatchObject({ type: "SS", lag: 0, legacyMixed: true });
    expect(f.source.get()).toEqual(canonical);
    const target = await f.create(); before = f.state();
    expect(() => target.commit(Buffer.from(JSON.stringify(output)))).toThrowError(expect.objectContaining({ code: "MIXED_DEPENDENCY_UNSUPPORTED", status: 422 }));
    expect(target.get().data.tasks).toEqual([]); expect(f.state()).toEqual(before);
  });
  it.each(["import", "projectCopy", "template", "subtree"] as const)("rolls back every row/revision on forced membership failure during %s", async kind => {
    const f = await fixture(), template = new ProjectTemplateService(f.db, { clock, hashPassword });
    const saved = template.createTemplateFromProject(f.source.authorization, f.source.get().data.project.revision, { name: "Rollback", description: "" }), target = await f.create(), before = f.state();
    f.db.exec("CREATE TRIGGER reject_mt5_membership BEFORE INSERT ON task_milestone_memberships BEGIN SELECT RAISE(ABORT,'synthetic-mt5-membership-failure'); END");
    if (kind === "import") expect(() => target.commit(fixtureBytes())).toThrow("synthetic-mt5-membership-failure");
    if (kind === "projectCopy") await expect(new ProjectCopyService(f.db, { clock, hashPassword }).copy(f.source.authorization, f.source.get().data.project.revision, { name: "Fail", description: "", editPassword: "test" })).rejects.toThrow("synthetic-mt5-membership-failure");
    if (kind === "template") await expect(template.instantiateProject(saved.id, { name: "Fail", ownerName: "Synthetic", editPassword: "test", projectStartDate: "2026-10-06" })).rejects.toThrow("synthetic-mt5-membership-failure");
    if (kind === "subtree") expect(() => new TaskHierarchyService(f.db, { clock }).execute(f.source.authorization, f.source.get().data.project.revision, { kind: "copy", taskIds: [f.task("S").taskId, f.task("M-SAME-A").taskId, f.task("M-SAME-B").taskId], anchorTaskId: f.task("DEST").taskId, placement: "child", acknowledgedMembershipExclusions: true })).toThrow("synthetic-mt5-membership-failure");
    expect(f.state()).toEqual(before); expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it("Excel Tasks/Gantt/full stage preserve hidden canonical rows without Dependencies and Resource report remains opt-in", async () => {
    const f = await fixture(), catalog = new ResourceCatalogRepository(f.db), repo = new ScheduleRepository(f.db), now = clock().toISOString();
    const resource = catalog.insertResource({ publicId: randomUUID(), name: "=MT5 Resource", code: "R553", description: "", developerGrade: "ADVANCED", now });
    catalog.replaceResourceRoles(resource.id, ["DEVELOPER"], now);
    const group = catalog.insertGroup({ publicId: randomUUID(), name: "MT5 Group", code: "G553", description: "", now });
    catalog.replaceGroupMembers(group.id, [resource.id], now);
    for (const [externalId, percent] of [["INHERITED", 50], ["FREE", null], ["T-FS-P", 25]] as const) {
      const task = repo.findTaskByPublicId(f.source.authorization.projectId, f.task(externalId).taskId)!;
      catalog.replaceTaskAssignments({ projectId: f.source.authorization.projectId, taskId: task.id, now, targets: [{ publicId: resource.publicId, kind: "resource", internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: percent }] });
    }
    f.patch("FREE", { explicitMilestoneTaskId: f.task("M-SAME-A").taskId });
    const before = f.state(), service = new ProjectExportSnapshotService(f.db, { clock });
    const bundle = service.get(f.source.publicId)!;
    const entries = workbookEntries(buildProjectExcelWorkbook(bundle.snapshot, excel, bundle.resourceWorkload, bundle.stageDashboard));
    expect(entries.get("xl/workbook.xml")).not.toContain('name="Dependencies"'); expect(entries.get("xl/workbook.xml")).not.toContain('name="Resource Report"');
    const tasks = workbookSheet(entries, "Tasks"), stages = workbookSheet(entries, "Milestone Stages"), gantt = workbookSheet(entries, "Gantt");
    for (const task of f.source.get().data.tasks) expect(tasks).toContain(task.taskId);
    expect(gantt).toContain("M-INTERNAL"); expect(gantt).toContain("M-ONLY");
    expect(tasks).toContain(f.task("M-SAME-A").taskId); expect(tasks).toContain(f.task("S").taskId);
    expect(stages).toContain("M/M 환산 미설정은 0이 아님"); expect(stages).toContain("unset");
    expect(bundle.stageDashboard.effort.plannedMm).toBeNull();
    expect(bundle.stageDashboard.effort.assignmentIds).toHaveLength(3);
    for (const row of bundle.stageDashboard.rows) { expect(stages).toContain(row.milestoneTaskId); for (const id of row.stageGate.memberTaskIds) expect(stages).toContain(id); }
    const filters = { taskIds: [f.task("INHERITED").taskId], mdPerMm: null };
    const dashboard = new ResourceDashboardService(f.db, { clock }).getDashboard(f.source.publicId, filters)!;
    expect(dashboard.summary.assignmentCount).toBe(1);
    const outsidePeriod = new ResourceDashboardService(f.db, { clock }).getDashboard(f.source.publicId, { from: "2030-01-01", to: "2030-01-02", mdPerMm: null })!;
    expect(outsidePeriod.summary.effort.knownMd).toBe(0); expect(outsidePeriod.mdPerMm).toBeNull();
    expect(f.task("M-SAME-A").stageGate!.memberTaskIds).toHaveLength(2);
    const options = { basis: "current" as const, expectedReport: { context: dashboard.resourceScopeContext!, snapshotId: dashboard.snapshotId, filters }, granularities: ["week" as const] };
    const withReport = service.get(f.source.publicId, false, options, bundle.snapshot.data.project.revision)!;
    withReport.resourceDashboard!.canonicalProjectUrl = `https://gantt.example/projects/${f.source.publicId}`;
    const expanded = workbookEntries(buildProjectExcelWorkbook(withReport.snapshot, { ...excel, resourceDashboard: options }, undefined, withReport.stageDashboard, withReport.resourceDashboard));
    expect(workbookSheet(expanded, "Tasks")).toBe(tasks); expect(workbookSheet(expanded, "Gantt")).toBe(gantt);
    expect(expanded.get("xl/workbook.xml")).toContain('name="Resource Report"'); expect(f.state()).toEqual(before);
    expect(workbookSheet(expanded, "Resource Assignments")).toContain(f.task("INHERITED").taskId);
    expect(workbookSheet(expanded, "Resource Assignments")).not.toContain(f.task("FREE").taskId);
    expect(workbookSheet(expanded, "Milestone Stages")).toContain(f.task("FREE").taskId);
  });
  it("SVG refuses unsupported signed/non-FS links and supported FS0 variant keeps full WBS/escaping/date clip/size guard", async () => {
    const f = await fixture(), snapshot = f.source.get(), before = f.state();
    expect(() => buildProjectGanttSvg(snapshot, { scope: "project", scale: "day", hierarchyDisplay: "expanded" })).toThrow(/unsupported dependency/);
    const supportedInput = canonicalInterchangeFixture(); supportedInput.tasks.forEach(t => t.predecessors.forEach(l => { l.type = "FS"; l.lag = 0; }));
    const target = await f.create(); target.commit(Buffer.from(JSON.stringify(supportedInput)));
    const full = target.get(); full.data.project.name = '<script>alert("x")</script>&';
    const svg = buildProjectGanttSvg(full, { scope: "project", scale: "week", hierarchyDisplay: "expanded" });
    expect(svg).toContain("M-INTERNAL"); expect(svg).toContain("M-ONLY"); expect(svg.match(/<polygon /g)).toHaveLength(full.data.tasks.filter(t => t.type === "milestone").length);
    expect(svg).not.toContain("<script>"); expect(svg).toContain("&lt;script&gt;");
    const clipped = buildProjectGanttSvg(full, { scope: "range", scale: "day", hierarchyDisplay: "expanded", startDate: "2026-10-06", endDate: "2026-10-07" });
    expect(clipped).toContain('width="64"'); expect(clipped).not.toContain("M-ONLY");
    expect(() => buildProjectGanttSvg(full, { scope: "range", scale: "day", hierarchyDisplay: "expanded", startDate: "1900-01-01", endDate: "2199-12-31" })).toThrow(/limit/);
    expect(f.state().tasks.filter((row: unknown) => before.tasks.some(old => JSON.stringify(old) === JSON.stringify(row)))).toHaveLength(before.tasks.length);
  });
});
