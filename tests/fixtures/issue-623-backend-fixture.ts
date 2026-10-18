import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { join } from "node:path";
import { openDatabase } from "../../src/server/db/core";
import { ProjectRepository, EditSessionRepository } from "../../src/server/repositories/project-repository-core";
import { ProjectMasterRepository } from "../../src/server/repositories/project-master-repository-core";
import { ScheduleRepository } from "../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogRepository } from "../../src/server/repositories/resource-catalog-repository-core";
import { LogisticsRepository } from "../../src/server/repositories/logistics-repository-core";
import { TaskTargetBindingRepository } from "../../src/server/repositories/task-target-binding-repository-core";
import { MilestoneMembershipRepository } from "../../src/server/repositories/milestone-membership-repository-core";
import { WorkCalendarRepository } from "../../src/server/repositories/work-calendar-repository-core";
import { ResourceDashboardService } from "../../src/server/resources/resource-dashboard-service-core";
import { TaskFieldProjectService } from "../../src/server/projects/task-field-project-service";
import { createSessionToken, sessionExpiry } from "../../src/server/security/session-core";
import type { DependencyType } from "../../src/contracts/projects";
import type { ResourceRole, DeveloperGrade } from "../../src/contracts/resources";
import { issue623TargetResourceFixture } from "./issue-623-target-resource";
export const ISSUE_623_NOW = new Date("2026-10-15T01:00:00.000Z"), stamp = ISSUE_623_NOW.toISOString();
export const issue623Uuid = (logical: string) => { const hex = createHash("sha256").update(`issue-623:${logical}`).digest("hex"); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`; };
/** Persist the shared pure oracle without deriving expectations from server output. */
export function issue623BackendFixture(input = issue623TargetResourceFixture(), filename = ":memory:") {
  const db = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database, id = issue623Uuid;
  const project = new ProjectRepository(db).insert({ publicId: id(input.projectPublicId), name: "Q1 canonical acceptance", description: "", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: stamp, updatedAt: stamp });
  const token = createSessionToken();
  new EditSessionRepository(db).insert({ projectId: project.id, tokenHash: token.tokenHash, authVersion: project.authVersion, createdAt: stamp, expiresAt: sessionExpiry(ISSUE_623_NOW).toISOString() });
  const projectService = new TaskFieldProjectService(db, { clock: () => ISSUE_623_NOW }), authorized = projectService.authorize(project.publicId, token.rawToken);
  if (authorized.kind !== "authorized") throw Error("Fixture authorization failed");
  const masters = new ProjectMasterRepository(db), item = (category: "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY", code: string) => masters.insertItem({ publicId: id(code), category, code, name: code, active: true, sortOrder: 0, now: stamp });
  const bu = item("BUSINESS_UNIT", "BU"), product = item("PRODUCT", "PRODUCT"), siteA = item("SITE_ENTITY", "SITE-A"), siteB = item("SITE_ENTITY", "SITE-B");
  db.prepare("INSERT INTO business_unit_products VALUES(?,?)").run(bu.id, product.id);
  for (const site of [siteA, siteB]) db.prepare("INSERT INTO business_unit_product_sites VALUES(?,?,?)").run(bu.id, product.id, site.id);
  db.prepare("UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?").run(bu.id, product.id, siteA.id, project.id);
  const type = Number(db.prepare("INSERT INTO process_types(public_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?)").run(id("TYPE"), "ASSEMBLY", "Assembly", stamp, stamp).lastInsertRowid);
  const standard = Number(db.prepare("INSERT INTO product_standard_processes(public_id,product_id,process_type_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(id("STANDARD"), product.id, type, "ASSEMBLY", "Assembly", stamp, stamp).lastInsertRowid);
  const occurrences = new Map<string, number>();
  for (const logical of [...new Set([...input.logistics.processes.map(p => p.occurrenceId).filter((v): v is string => v !== null), "SITE-B-OCC"])]) {
    const occurrence = Number(db.prepare("INSERT INTO site_product_processes(public_id,business_unit_id,product_id,site_entity_id,process_type_id,standard_process_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id(logical), bu.id, product.id, logical === "SITE-B-OCC" ? siteB.id : siteA.id, type, standard, logical, logical, stamp, stamp).lastInsertRowid);
    occurrences.set(logical, occurrence);
  }
  const areas = new Map(input.logistics.workAreas.map(area => [area.id, Number(db.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(id(area.id), occurrences.get(area.occurrenceId)!, area.id, area.id, stamp, stamp).lastInsertRowid)]));
  const logistics = new LogisticsRepository(db), processes = new Map(input.logistics.processes.map(process => [process.id, logistics.insertProcess({ projectId: project.id, publicId: id(process.id), code: process.id, name: process.id, parentId: null, active: 1, now: stamp })]));
  for (const process of input.logistics.processes) if (process.occurrenceId) db.prepare("INSERT INTO project_process_occurrence_mappings(project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(project.id, processes.get(process.id)!.id, occurrences.get(process.occurrenceId)!, bu.id, product.id, siteA.id, stamp, stamp);
  const instances = new Map(input.logistics.instances.map(instance => [instance.entityId, instance.kind === "equipment" ? logistics.insertEquipment({ projectId: project.id, publicId: id(instance.entityId), code: instance.entityId, name: instance.entityId, processId: processes.get(instance.projectProcessId!)!.id, equipmentType: "amr", managementUnit: "fleet", quantity: instance.quantity, now: stamp }) : logistics.insertSystem({ projectId: project.id, publicId: id(instance.entityId), code: instance.entityId, name: instance.entityId, systemType: instance.typeCode, layer: instance.typeCode === "mcs" ? "coordinator" : "controller", scope: "project", now: stamp })]));
  const schedules = new ScheduleRepository(db), tasks = new Map<string, ReturnType<ScheduleRepository["insertTask"]>>();
  for (const task of input.tasks) tasks.set(task.taskId, schedules.insertTask({ projectId: project.id, publicId: id(task.taskId), externalId: task.taskId, name: task.taskId, type: task.type, parentId: task.parentTaskId ? tasks.get(task.parentTaskId)!.id : null, scheduleMode: "auto", requestedStart: task.type === "summary" ? null : task.start, startDate: task.start, endDate: task.end, duration: task.duration, progress: task.progress, status: task.status, sortOrder: tasks.size, createdAt: stamp, updatedAt: stamp }));
  const catalog = new ResourceCatalogRepository(db), resources = new Map(input.resources.map(resource => {
    const stored = catalog.insertResource({ publicId: id(resource.resourceId), name: resource.name ?? resource.resourceId, code: resource.resourceId, description: "", developerGrade: resource.developerGrade as DeveloperGrade | null, now: stamp });
    catalog.replaceResourceRoles(stored.id, resource.roles.filter(role => role !== "UNSPECIFIED") as ResourceRole[], stamp); return [resource.resourceId, stored];
  }));
  const groups = new Map([...new Set(input.resources.flatMap(resource => resource.groupIds))].map(group => {
    const stored = catalog.insertGroup({ publicId: id(group), name: group, code: group, description: "", now: stamp }); catalog.replaceGroupMembers(stored.id, input.resources.filter(resource => resource.groupIds.includes(group)).map(resource => resources.get(resource.resourceId)!.id), stamp); return [group, stored];
  }));
  for (const task of input.tasks) catalog.replaceTaskAssignments({ projectId: project.id, taskId: tasks.get(task.taskId)!.id, now: stamp, targets: input.assignments.filter(assignment => assignment.taskId === task.taskId).map(assignment => ({ kind: assignment.kind, publicId: id(assignment.targetId), internalId: (assignment.kind === "resource" ? resources : groups).get(assignment.targetId)!.id, assignmentPublicId: id(assignment.assignmentId), assignmentStart: assignment.start ?? null, assignmentEnd: assignment.end ?? null, allocationPercent: assignment.allocationPercent })) });
  for (const membership of input.memberships) new MilestoneMembershipRepository(db).set(project.id, tasks.get(membership.taskId)!.id, tasks.get(membership.milestoneTaskId)!.id);
  for (const link of input.links) schedules.insertLink({ publicId: id(link.id), projectId: project.id, predecessorTaskId: tasks.get(link.predecessorTaskId)!.id, successorTaskId: tasks.get(link.successorTaskId)!.id, type: link.type as DependencyType, lag: link.lag, createdAt: stamp, updatedAt: stamp });
  const calendars = new WorkCalendarRepository(db);
  for (const exception of input.projectCalendar.exceptions) schedules.insertHoliday(project.id, exception.date, exception.name ?? "Oracle holiday", stamp);
  for (const exception of input.calendarExceptions ?? []) {
    const rule = calendars.insertRule({ projectId: project.id, publicId: id(exception.ruleId), name: exception.ruleName, kind: "CUSTOM", countryCode: null, targetType: exception.targetType, targetPublicId: id(exception.targetId), scope: "FULL_PROJECT", effectiveFrom: null, effectiveTo: null, sourceVersion: null, now: stamp });
    calendars.insertDate({ calendarRuleId: rule.id, date: exception.date, dayType: exception.dayType, name: exception.name ?? null, sourceKey: null, sourceVersion: null, now: stamp });
  }
  db.transaction(() => {
    for (const target of input.logistics.targets) {
      const targetPk = Number(db.prepare("INSERT INTO logistics_targets(public_id,project_id,code,name,scope,project_process_id,occurrence_id,work_area_id,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id(target.id), project.id, target.id, target.id, target.scope, target.projectProcessId ? processes.get(target.projectProcessId)!.id : null, target.occurrenceId ? occurrences.get(target.occurrenceId)! : null, target.workAreaId ? areas.get(target.workAreaId)! : null, target.active === false ? 0 : 1, stamp, stamp).lastInsertRowid);
      let anchor = 0;
      for (const member of target.members) { const pk = Number(db.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,equipment_id,system_id,created_at) VALUES(?,?,?,?,?,?,?)").run(id(member.id), project.id, targetPk, member.kind, member.kind === "equipment" ? instances.get(member.entityId)!.id : null, member.kind === "system" ? instances.get(member.entityId)!.id : null, stamp).lastInsertRowid); anchor ||= pk; }
      db.prepare("UPDATE logistics_targets SET anchor_member_id=? WHERE id=?").run(anchor, targetPk);
    }
    const bindings = new TaskTargetBindingRepository(db);
    for (const task of input.tasks) bindings.replace(project.id, tasks.get(task.taskId)!.id, input.logistics.bindings.filter(binding => binding.taskId === task.taskId).map(binding => ({ ...binding, id: id(binding.id), taskId: id(binding.taskId), targetId: id(binding.targetId), memberIds: binding.memberIds.map(id), coverageByMember: binding.coverageByMember?.map(value => ({ ...value, memberId: id(value.memberId) })) })), stamp);
    for (const legacy of input.logistics.legacy) if (legacy.kind === "system") logistics.replaceTaskSystemLinks(project.id, tasks.get(legacy.taskId)!.id, [{ systemId: instances.get(legacy.entityId)!.id, scope: legacy.scope }], stamp);
  })();
  const service = new ResourceDashboardService(db, { clock: () => ISSUE_623_NOW });
  const filters = { from: input.from, to: input.to, asOfDate: input.asOfDate, mdPerMm: input.mdPerMm, granularity: "week" as const };
  return { db, input, project, id, tasks, resources, groups, processes, instances, service, catalog, schedules, token, auth: authorized.authorization, projectService, bu, product, siteA, siteB, occurrences, areas, filters };
}
export function issue623WorkbookEntries(bytes: Uint8Array) {
  const b = Buffer.from(bytes), entries = new Map<string, string>(); let offset = 0;
  while (offset + 30 <= b.length && b.readUInt32LE(offset) === 0x04034b50) { const length = b.readUInt32LE(offset + 18), start = offset + 30 + b.readUInt16LE(offset + 26) + b.readUInt16LE(offset + 28); entries.set(b.toString("utf8", offset + 30, offset + 30 + b.readUInt16LE(offset + 26)), inflateRawSync(b.subarray(start, start + length)).toString()); offset = start + length; }
  const names = [...entries.get("xl/workbook.xml")!.matchAll(/name="([^"]+)"/g)].map(match => match[1]);
  return { entries, names, sheet: (name: string) => entries.get(`xl/worksheets/sheet${names.indexOf(name) + 1}.xml`)! };
}
export function issue623Table(xml: string) {
  const rows = [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row => {
    const values: (string | number | null)[] = [];
    for (const match of row[1].matchAll(/<c\b[^>]*?r="([A-Z]+)\d+"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const index = [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1, content = match[2] ?? "", text = /<t[^>]*>([\s\S]*?)<\/t>/.exec(content), value = /<v>(.*?)<\/v>/.exec(content);
      values[index] = text ? text[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&") : value ? Number(value[1]) : null;
    } return values;
  });
  const headers = rows.shift() ?? []; return rows.map(row => Object.fromEntries(headers.map((header, index) => [String(header), row[index] ?? null])));
}
