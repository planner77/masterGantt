import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { TaskHierarchyService, TaskCopyAssignmentUnsupportedError } from "../../../src/server/projects/task-hierarchy-service-core";
import { ProjectJsonExportService } from "../../../src/server/exports/project-json-export-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { parseProjectImportBytes } from "../../../src/server/imports/project-import-parser-core";
import { loadTaskTargetBindingSnapshot, TaskTargetBindingRepository } from "../../../src/server/repositories/task-target-binding-repository-core";
import { resolveAllTaskTargetBindings } from "../../../src/domain/logistics/task-target-bindings";
import { PublicApiError } from "../../../src/server/http/api-error-core";
import { issue623BackendFixture, ISSUE_623_NOW as now } from "../../fixtures/issue-623-backend-fixture";
import type { TaskHierarchyCommandRequest } from "../../../src/contracts/projects";
const fixtures: ReturnType<typeof issue623BackendFixture>[] = [];
const fixture = () => { const f = issue623BackendFixture(); fixtures.push(f); return f; };
afterEach(() => fixtures.splice(0).forEach(f => f.db.close()));
const password = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
const revision = (f: ReturnType<typeof fixture>) => Number(f.db.prepare("SELECT revision FROM projects WHERE id=?").pluck().get(f.project.id));
const masterTables = ["project_master_items", "process_types", "product_standard_processes", "site_product_processes", "work_areas", "resources", "resource_groups"] as const;
const masterRows = (f: ReturnType<typeof fixture>) => masterTables.map(table => ({ table, rows: f.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all() }));
function approveImpact(f: ReturnType<typeof fixture>, command: Extract<TaskHierarchyCommandRequest, { kind: "reparent" }>) {
  const service = new TaskHierarchyService(f.db, { clock: () => now }), before = loadTaskTargetBindingSnapshot(f.db, f.project.id), base = revision(f);
  try { return service.execute(f.auth, base, command); } catch (error) {
    if (!(error instanceof PublicApiError) || error.code !== "TASK_TARGET_IMPACT_REVIEW_REQUIRED") throw error;
    expect(loadTaskTargetBindingSnapshot(f.db, f.project.id)).toEqual(before); expect(revision(f)).toBe(base);
    const digest = error.details.find(detail => detail.path === "targetImpactDigest")!.message;
    expect(() => service.execute(f.auth, base, { ...command, targetImpactDigest: "0".repeat(64) })).toThrow();
    expect(loadTaskTargetBindingSnapshot(f.db, f.project.id)).toEqual(before);
    return service.execute(f.auth, base, { ...command, targetImpactDigest: digest });
  }
}
describe("#623 Target Copy/Template/site/coverage and safe-format integration acceptance", () => {
  it("reuses global catalogs, preserves inactive and unmapped references while Copy and v3 Template remap all local identities with one shared MCS", async () => {
    const f = fixture(), db = f.db;
    db.prepare("UPDATE logistics_targets SET active=0 WHERE public_id=?").run(f.id("TARGET-A"));
    db.prepare("UPDATE site_product_processes SET active=0 WHERE public_id=?").run(f.id("OCC-A-ASSEMBLY"));
    db.prepare("UPDATE work_areas SET active=0 WHERE public_id=?").run(f.id("WA-A"));
    db.prepare("UPDATE resources SET active=0 WHERE public_id=?").run(f.id("R1"));
    db.prepare("UPDATE project_processes SET active=0 WHERE public_id=?").run(f.id("LEGACY-PROCESS"));
    const source = loadTaskTargetBindingSnapshot(db, f.project.id), globals = masterRows(f);
    const localTables = ["project_equipment", "project_logistics_systems", "task_assignments"] as const;
    const sourceIds = new Map(localTables.map(table => [table, new Set(db.prepare(`SELECT public_id FROM ${table} WHERE project_id=?`).pluck().all(f.project.id))]));
    const templates = new ProjectTemplateService(db, { clock: () => now, hashPassword: password }), template = templates.createTemplateFromProject(f.auth, revision(f), { name: "Q1 complete graph" });
    const saved = JSON.parse(db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").pluck().get(template.id) as string);
    expect(saved.logistics.schemaVersion).toBe(3); expect(saved.logistics.taskTargetBindings).toHaveLength(10);
    const copy = await new ProjectCopyService(db, { clock: () => now, hashPassword: password }).copy(f.auth, revision(f), { name: "Copied Q1", description: "", ownerName: "Owner", editPassword: "password123" });
    const instantiated = await templates.instantiateProject(template.id, { name: "Template Q1", ownerName: "Owner", editPassword: "password123", projectStartDate: "2026-10-05" });
    for (const data of [copy.response.data, instantiated.response.data]) {
      const pid = Number(db.prepare("SELECT id FROM projects WHERE public_id=?").pluck().get(data.project.publicId)), graph = loadTaskTargetBindingSnapshot(db, pid);
      expect(graph.bindings).toHaveLength(source.bindings.length);
      for (const table of localTables) {
        const ids = db.prepare(`SELECT public_id FROM ${table} WHERE project_id=?`).pluck().all(pid);
        expect(ids).toHaveLength(sourceIds.get(table)!.size); expect(ids.every(id => !sourceIds.get(table)!.has(id))).toBe(true);
      }
      for (const key of ["tasks", "targets", "bindings"] as const) expect(graph[key].every(row => !source[key].some(original => original.id === row.id))).toBe(true);
      const originalMemberIds = new Set(source.targets.flatMap(target => target.members.map(member => member.id)));
      expect(graph.targets.flatMap(target => target.members).every(member => !originalMemberIds.has(member.id))).toBe(true);
      expect(db.prepare("SELECT COUNT(*) FROM project_logistics_systems WHERE project_id=? AND code='MCS-1'").pluck().get(pid)).toBe(1);
      const shared = db.prepare("SELECT s.public_id entityId FROM logistics_target_members m JOIN project_logistics_systems s ON s.project_id=m.project_id AND s.id=m.system_id WHERE m.project_id=? AND s.code='MCS-1'").all(pid) as {entityId:string}[];
      expect(shared).toHaveLength(2); expect(new Set(shared.map(row => row.entityId)).size).toBe(1); expect(shared[0].entityId).not.toBe(f.id("MCS-1"));
      expect(db.prepare("SELECT active FROM logistics_targets WHERE project_id=? AND code='TARGET-A'").pluck().get(pid)).toBe(0);
      expect(db.prepare("SELECT COUNT(*) FROM project_process_occurrence_mappings WHERE project_id=?").pluck().get(pid)).toBe(1);
      expect(db.prepare("SELECT occurrence_id FROM project_process_occurrence_mappings WHERE project_id=?").pluck().get(pid)).toBe(f.occurrences.get("OCC-A-ASSEMBLY"));
      expect(db.prepare("SELECT p.active FROM project_processes p LEFT JOIN project_process_occurrence_mappings m ON m.project_id=p.project_id AND m.project_process_id=p.id WHERE p.project_id=? AND p.code='LEGACY-PROCESS' AND m.project_process_id IS NULL").pluck().get(pid)).toBe(0);
      const reused = db.prepare("SELECT DISTINCT r.public_id FROM task_assignments a JOIN resources r ON r.id=a.resource_id WHERE a.project_id=? ORDER BY r.public_id").pluck().all(pid);
      expect(reused).toEqual([...f.resources.values()].map(resource => resource.publicId).sort());
      const copiedShared = graph.tasks.find(task => data.tasks.find(row => row.taskId === task.id)?.externalId === "SHARED")!;
      const provenance = resolveAllTaskTargetBindings(graph).get(copiedShared.id)!;
      expect(provenance.bindings).toHaveLength(2); expect(provenance.inheritedBindings).toHaveLength(1);
    }
    expect(masterRows(f)).toEqual(globals); expect(db.pragma("foreign_key_check")).toEqual([]);
  });
  it("rejects cross-site Template mappings and cross-occurrence WorkArea atomically instead of silently retargeting", async () => {
    const f = fixture(), templates = new ProjectTemplateService(f.db, { clock: () => now, hashPassword: password });
    const template = templates.createTemplateFromProject(f.auth, revision(f), { name: "Same-site template" });
    const original = f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").pluck().get(template.id) as string;
    const globals = masterRows(f), before = f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get();
    const changed = JSON.parse(original); changed.projectMaster.siteEntityId = f.siteB.publicId;
    f.db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?").run(JSON.stringify(changed), template.id);
    await expect(templates.instantiateProject(template.id, { name: "Wrong site", ownerName: "Owner", editPassword: "password123", projectStartDate: "2026-10-05" })).rejects.toThrow("selected business unit, product and site");
    expect(f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get()).toBe(before); expect(masterRows(f)).toEqual(globals);
    expect(() => f.db.prepare("UPDATE projects SET site_entity_id=? WHERE id=?").run(f.siteB.id, f.project.id)).toThrow("PROJECT_PROCESS_MAPPING_IN_USE");
    const wrongArea = randomUUID(); f.db.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(wrongArea, f.occurrences.get("SITE-B-OCC")!, "OTHER", "Other Site WorkArea", now.toISOString(), now.toISOString());
    const areaChanged = JSON.parse(original); areaChanged.logistics.targets[0].workAreaId = wrongArea;
    f.db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?").run(JSON.stringify(areaChanged), template.id);
    await expect(templates.instantiateProject(template.id, { name: "Wrong area", ownerName: "Owner", editPassword: "password123", projectStartDate: "2026-10-05" })).rejects.toThrow("WorkArea is outside");
    expect(f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get()).toBe(before); expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it("preserves explicit equipment coverage through Task copy and cut/reparent while inherited scope changes require current impact approval", () => {
    const f = fixture(), task = f.tasks.get("ZERO")!, binding = { id: f.id("ZERO-A"), taskId: task.publicId, targetId: f.id("TARGET-A"), scope: "self" as const, selection: "subset" as const, memberIds: [f.id("MEM-A-AMR")], coverageByMember: [{ memberId: f.id("MEM-A-AMR"), coverage: 4 }] };
    f.db.transaction(() => new TaskTargetBindingRepository(f.db).replace(f.project.id, task.id, [binding], now.toISOString()))();
    const copyCommand = { kind: "copy" as const, taskId: task.publicId, anchorTaskId: f.id("S"), placement: "child" as const, acknowledgedMembershipExclusions: true };
    const assignedBefore = loadTaskTargetBindingSnapshot(f.db, f.project.id), assignedRevision = revision(f);
    expect(() => new TaskHierarchyService(f.db, { clock: () => now }).execute(f.auth, assignedRevision, copyCommand)).toThrow(TaskCopyAssignmentUnsupportedError);
    expect(loadTaskTargetBindingSnapshot(f.db, f.project.id)).toEqual(assignedBefore); expect(revision(f)).toBe(assignedRevision);
    // Task-copy currently rejects Resource/Group assignments. Exercise supported
    // coverage copying with a deliberately unassigned source, preserving that guard.
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: now.toISOString(), targets: [] });
    const before = loadTaskTargetBindingSnapshot(f.db, f.project.id), copied = new TaskHierarchyService(f.db, { clock: () => now }).execute(f.auth, revision(f), copyCommand);
    const newTask = copied.data.tasks.find(row => row.taskId !== task.publicId && row.name === "ZERO")!;
    const afterCopy = loadTaskTargetBindingSnapshot(f.db, f.project.id), copiedBinding = afterCopy.bindings.find(row => row.taskId === newTask.taskId)!;
    expect(copiedBinding.id).not.toBe(binding.id); expect(copiedBinding.coverageByMember).toEqual(binding.coverageByMember);
    expect(resolveAllTaskTargetBindings(afterCopy).get(newTask.taskId)!.inheritedBindings).toHaveLength(1);
    expect(afterCopy.bindings.find(row => row.id === binding.id)).toEqual(before.bindings.find(row => row.id === binding.id));
    approveImpact(f, { kind: "reparent", taskId: newTask.taskId, anchorTaskId: f.id("LEGACY"), placement: "after" });
    const moved = loadTaskTargetBindingSnapshot(f.db, f.project.id), resolved = resolveAllTaskTargetBindings(moved).get(newTask.taskId)!;
    expect(moved.bindings.find(row => row.id === copiedBinding.id)).toEqual(copiedBinding); expect(resolved.inheritedBindings).toHaveLength(0);
    expect(resolved.effectiveMembers[0].provenance[0]).toMatchObject({ bindingId: copiedBinding.id, coverage: 4, coverageMode: "partial" });
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it("rejects lossy JSON/plain Excel and unsupported bindings import without changing the source graph", () => {
    const f = fixture(), revisionValue = revision(f);
    expect(() => new ProjectJsonExportService(f.db, { clock: () => now }).get(f.project.publicId, revisionValue)).toThrow(expect.objectContaining({ code: "TASK_TARGET_EXPORT_UNSUPPORTED" }));
    expect(() => new ProjectExportSnapshotService(f.db, { clock: () => now }).get(f.project.publicId, false, undefined, revisionValue)).toThrow(expect.objectContaining({ code: "TASK_TARGET_EXPORT_UNSUPPORTED" }));
    expect(() => parseProjectImportBytes(new TextEncoder().encode(JSON.stringify({ schemaVersion: "1.1", project: { name: "Unsafe", description: "" }, tasks: [{ externalId: "NEW", targetBindings: [] }] })))).toThrow(expect.objectContaining({ code: "TARGET_BINDING_IMPORT_UNSUPPORTED" }));
    expect(f.db.prepare("SELECT revision FROM projects WHERE id=?").pluck().get(f.project.id)).toBe(revisionValue);
    expect(loadTaskTargetBindingSnapshot(f.db, f.project.id).bindings).toHaveLength(10);
  });
});
