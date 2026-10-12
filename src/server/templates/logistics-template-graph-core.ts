import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  ProjectTemplateSnapshot,
  TemplateProcessMappingSnapshotItem,
  TemplateTargetSnapshotItem,
} from "../../contracts/project-templates";
import { ProcessCatalogRepository } from "../repositories/process-catalog-repository-core";

type Graph = Pick<NonNullable<ProjectTemplateSnapshot["logistics"]>,
  "schemaVersion" | "processMappings" | "targets">;

export class LogisticsTemplateGraphError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "LogisticsTemplateGraphError";
  }
}
function reject(code: string, message: string): never {
  throw new LogisticsTemplateGraphError(code, message);
}
type RawMapping = {
  process_code: string; occurrence_public_id: string; area_public_id: string | null;
};
type RawTarget = {
  id: number; code: string; name: string; scope: "process" | "project_common";
  process_code: string | null; occurrence_public_id: string | null;
  area_public_id: string | null; active: number; description: string;
};
type RawMember = {
  target_id: number; kind: "equipment" | "system";
  instance_code: string | null;
};

/** Snapshot the graph inside the caller's already-authorized source transaction.
 * Only stable global occurrence/WorkArea public IDs cross projects; local members
 * use typed, project-unique instance codes as snapshot-local keys. */
export function snapshotLogisticsTemplateGraph(
  db: Database.Database, sourceProjectId: number,
): { schemaVersion: 2; processMappings: TemplateProcessMappingSnapshotItem[];
     targets: TemplateTargetSnapshotItem[] } {
  const mappings = db.prepare(
    "SELECT p.code process_code, o.public_id occurrence_public_id, " +
    "w.public_id area_public_id FROM project_process_occurrence_mappings m " +
    "JOIN project_processes p ON p.project_id=m.project_id AND p.id=m.project_process_id " +
    "JOIN site_product_processes o ON o.id=m.occurrence_id " +
    "LEFT JOIN work_areas w ON w.id=m.work_area_id " +
    "WHERE m.project_id=? ORDER BY p.code",
  ).all(sourceProjectId) as RawMapping[];
  const targets = db.prepare(
    "SELECT t.id,t.code,t.name,t.scope,p.code process_code, " +
    "o.public_id occurrence_public_id,w.public_id area_public_id,t.active,t.description " +
    "FROM logistics_targets t " +
    "LEFT JOIN project_processes p ON p.project_id=t.project_id AND p.id=t.project_process_id " +
    "LEFT JOIN site_product_processes o ON o.id=t.occurrence_id " +
    "LEFT JOIN work_areas w ON w.id=t.work_area_id " +
    "WHERE t.project_id=? ORDER BY t.code",
  ).all(sourceProjectId) as RawTarget[];
  const members = db.prepare(
    "SELECT m.target_id,m.kind,COALESCE(e.code,s.code) instance_code " +
    "FROM logistics_target_members m " +
    "LEFT JOIN project_equipment e ON e.project_id=m.project_id AND e.id=m.equipment_id " +
    "LEFT JOIN project_logistics_systems s ON s.project_id=m.project_id AND s.id=m.system_id " +
    "WHERE m.project_id=? ORDER BY m.target_id,m.kind,instance_code",
  ).all(sourceProjectId) as RawMember[];
  const byTarget = new Map<number, RawMember[]>();
  for (const item of members) {
    if (!item.instance_code) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "An existing Target member is missing its instance.");
    byTarget.set(item.target_id, [...(byTarget.get(item.target_id) ?? []), item]);
  }
  const resultTargets = targets.map((target): TemplateTargetSnapshotItem => {
    const rows = byTarget.get(target.id) ?? [];
    if (!rows.length) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "An existing Target has no members.");
    if (target.scope === "process" && (!target.process_code || !target.occurrence_public_id))
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "An existing process Target has no mapping.");
    return {
      code: target.code,
      name: target.name,
      scope: target.scope,
      processCode: target.process_code,
      occurrenceId: target.occurrence_public_id,
      workAreaId: target.area_public_id,
      active: target.active === 1,
      description: target.description,
      members: rows.map((member) => ({
        kind: member.kind, instanceCode: member.instance_code!,
      })),
    };
  });
  return {
    schemaVersion: 2,
    processMappings: mappings.map((m) => ({
      processCode: m.process_code,
      occurrenceId: m.occurrence_public_id,
      workAreaId: m.area_public_id,
    })),
    targets: resultTargets,
  };
}

type LocalInstance = { id: number; publicId: string };
type LocalMaps = {
  processes: Map<string, LocalInstance>;
  equipment: Map<string, LocalInstance>;
  systems: Map<string, LocalInstance>;
};
type Triple = {
  business_unit_id: number | null;
  product_id: number | null;
  site_entity_id: number | null;
};
function requiredText(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value :
    reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Template graph contains an invalid identifier.");
}
function nullableText(value: unknown): string | null {
  return value === null ? null : requiredText(value);
}

/** Restore after local Project/processes/Equipment/Systems are instantiated.
 * Called inside the outer Template instantiate transaction; never increments
 * revision or writes common process/type masters. Any mismatch rejects the
 * entire new Project instead of silently skipping one member or mapping. */
export function restoreLogisticsTemplateGraph(
  db: Database.Database, projectId: number,
  graph: NonNullable<ProjectTemplateSnapshot["logistics"]>,
  local: LocalMaps, now: string,
): { processMappings: number; targets: number; warnings: string[] } {
  if (graph.schemaVersion === undefined) {
    if (graph.processMappings !== undefined || graph.targets !== undefined)
      reject("TEMPLATE_LOGISTICS_VERSION_UNSUPPORTED", "Unversioned template graph must not contain Target references.");
    return { processMappings: 0, targets: 0, warnings: [] };
  }
  if (graph.schemaVersion !== 2 || !Array.isArray(graph.processMappings) || !Array.isArray(graph.targets))
    reject("TEMPLATE_LOGISTICS_VERSION_UNSUPPORTED", "Unsupported or incomplete Template graph version.");

  const catalog = new ProcessCatalogRepository(db);
  const triple = db.prepare(
    "SELECT business_unit_id,product_id,site_entity_id FROM projects WHERE id=?",
  ).get(projectId) as Triple | undefined;
  if (!triple) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Target Project not found.");
  const savedMappings = graph.processMappings;
  const savedTargets = graph.targets;
  const seenProcesses = new Set<string>();
  const warnings: string[] = [];
  for (const raw of savedMappings) {
    if (!raw || typeof raw !== "object") reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Invalid process mapping.");
    const processCode = requiredText(raw.processCode);
    if (seenProcesses.has(processCode)) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Duplicate Project process mapping.");
    seenProcesses.add(processCode);
    const process = local.processes.get(processCode);
    const occurrence = catalog.find("occurrences", requiredText(raw.occurrenceId));
    if (!process || !occurrence ||
      triple!.business_unit_id !== occurrence.business_unit_id ||
      triple!.product_id !== occurrence.product_id ||
      triple!.site_entity_id !== occurrence.site_entity_id)
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Template occurrence does not belong to the selected business unit, product and site.");
    const area = raw.workAreaId === null ? null :
      catalog.find("workAreas", requiredText(raw.workAreaId));
    if (raw.workAreaId !== null && (!area || area.occurrence_id !== occurrence.id))
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Template WorkArea belongs to another process occurrence.");
    catalog.setMapping(projectId, process.id, occurrence, area, now);
    if (!occurrence.active || (area && !area.active))
      warnings.push("INACTIVE_PROCESS_REFERENCE:" + processCode);
  }

  const seenTargets = new Set<string>();
  for (const raw of savedTargets) {
    if (!raw || typeof raw !== "object") reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Invalid Target.");
    const targetCode = requiredText(raw.code);
    if (seenTargets.has(targetCode)) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Duplicate Target code.");
    seenTargets.add(targetCode);
    const isProcess = raw.scope === "process";
    if (!isProcess && raw.scope !== "project_common")
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Invalid Target scope.");
    const processCode = nullableText(raw.processCode);
    const occurrenceId = nullableText(raw.occurrenceId);
    const workAreaId = nullableText(raw.workAreaId);
    if ((isProcess && (!processCode || !occurrenceId)) ||
        (!isProcess && (processCode !== null || occurrenceId !== null || workAreaId !== null)))
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Invalid Target process/common scope.");
    const process = processCode ? local.processes.get(processCode) : undefined;
    const mapping = process ? catalog.mapping(projectId, process.id) : undefined;
    const mappedOccurrence = occurrenceId && catalog.find("occurrences", occurrenceId);
    if (isProcess && (!process || !mapping || !mappedOccurrence ||
      mapping.occurrence_id !== mappedOccurrence.id))
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Target process occurrence no longer matches the Template.");
    const area = workAreaId ? catalog.find("workAreas", workAreaId) : undefined;
    if (workAreaId && (!area || !mapping || area.occurrence_id !== mapping.occurrence_id))
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Target WorkArea is outside its process.");
    if (typeof raw.name !== "string" || typeof raw.description !== "string" || typeof raw.active !== "boolean")
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Invalid Target fields.");
    if (!Array.isArray(raw.members) || !raw.members.length || raw.members.length > 100)
      reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Target must contain at least one member.");

    const resolvedMembers: Array<{kind: "equipment"|"system"; id: number}> = [];
    const seenMembers = new Set<string>();
    for (const m of raw.members) {
      if (!m || (m.kind !== "equipment" && m.kind !== "system"))
        reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Invalid typed Target member.");
      const code = requiredText(m.instanceCode);
      const key = m.kind + ":" + code;
      if (seenMembers.has(key)) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Duplicated Target member.");
      seenMembers.add(key);
      const localInstance = m.kind === "equipment" ? local.equipment.get(code) : local.systems.get(code);
      if (!localInstance) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Target member instance is missing: " + key);
      if (m.kind === "equipment") {
        if (!process) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Equipment is not allowed in a common Target.");
        const e = db.prepare("SELECT process_id FROM project_equipment WHERE project_id=? AND id=?")
          .get(projectId,localInstance.id) as {process_id:number}|undefined;
        if (!e || e.process_id !== process.id)
          reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Equipment process is inconsistent with Target.");
      } else if (!isProcess) {
        const s = db.prepare("SELECT scope FROM project_logistics_systems WHERE project_id=? AND id=?")
          .get(projectId,localInstance.id) as {scope:string}|undefined;
        if (!s || s.scope !== "project")
          reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Common Target requires project-scoped System.");
      }
      resolvedMembers.push({kind:m.kind,id:localInstance.id});
    }
    const inserted = db.prepare(
      "INSERT INTO logistics_targets(public_id,project_id,code,name,scope,project_process_id," +
      "occurrence_id,work_area_id,active,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(randomUUID(),projectId,targetCode,raw.name,raw.scope,process?.id??null,
      mappedOccurrence?.id??null,area?.id??null,raw.active?1:0,raw.description,now,now);
    const targetId = Number(inserted.lastInsertRowid);
    const stmt = db.prepare(
      "INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,equipment_id,system_id,created_at)" +
      " VALUES(?,?,?,?,?,?,?)",
    );
    for (const m of resolvedMembers) stmt.run(randomUUID(),projectId,targetId,m.kind,
      m.kind==="equipment"?m.id:null,m.kind==="system"?m.id:null,now);
    const member = db.prepare(
      "SELECT id FROM logistics_target_members WHERE project_id=? AND target_id=? ORDER BY id LIMIT 1",
    ).get(projectId,targetId) as {id:number}|undefined;
    if (!member) reject("TEMPLATE_LOGISTICS_REFERENCE_INVALID", "Target has no persisted members.");
    db.prepare("UPDATE logistics_targets SET anchor_member_id=? WHERE project_id=? AND id=?")
      .run(member.id,projectId,targetId);
  }
  return {processMappings:savedMappings.length,targets:savedTargets.length,warnings};
}
