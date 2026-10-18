import type Database from "better-sqlite3";
import type { TemplateEquipmentWorkAreasSnapshotItem, TemplateTaskContextSnapshotItem } from "../../contracts/project-templates";
import { PublicApiError } from "../http/api-error-core";
import { ProcessContextError, ProcessContextRepository } from "../repositories/process-context-repository-core";

type LocalInstance = { id: number; publicId: string };
function invalid(): never {
  throw new PublicApiError(409, "PROCESS_CONTEXT_TRANSFER_INVALID", "공정·WorkArea 참조를 손실 없이 복원할 수 없습니다.");
}
function validateTransfer<T>(validate: () => T): T {
  try { return validate(); }
  catch (error) { if (error instanceof ProcessContextError) invalid(); throw error; }
}

/** Snapshot explicit rows only. Missing Task markers remain legacy null, never explicit empty. */
export function snapshotProjectContexts(db: Database.Database, projectId: number): {
  equipmentWorkAreas: TemplateEquipmentWorkAreasSnapshotItem[];
  taskContexts: TemplateTaskContextSnapshotItem[];
} {
  const equipment = db.prepare("SELECT e.code,p.code process_code,w.public_id FROM equipment_work_areas l JOIN project_equipment e ON e.project_id=l.project_id AND e.id=l.equipment_id JOIN project_processes p ON p.project_id=l.project_id AND p.id=l.process_id JOIN work_areas w ON w.id=l.work_area_id WHERE l.project_id=? ORDER BY e.code,p.code,w.public_id").all(projectId) as {code:string;process_code:string;public_id:string}[];
  const byEquipment = new Map<string,TemplateEquipmentWorkAreasSnapshotItem["workAreaLinks"]>();
  for (const row of equipment) byEquipment.set(row.code,[...(byEquipment.get(row.code)??[]),{processCode:row.process_code,workAreaId:row.public_id}]);
  const contexts = db.prepare("SELECT t.id,t.external_id FROM task_process_contexts c JOIN tasks t ON t.project_id=c.project_id AND t.id=c.task_id WHERE c.project_id=? ORDER BY t.external_id").all(projectId) as {id:number;external_id:string}[];
  const processes = db.prepare("SELECT l.task_id,p.code,l.scope FROM task_process_links l JOIN project_processes p ON p.project_id=l.project_id AND p.id=l.process_id WHERE l.project_id=? ORDER BY l.task_id,p.code").all(projectId) as {task_id:number;code:string;scope:"self"|"subtree"}[];
  const areas = db.prepare("SELECT l.task_id,p.code,w.public_id,l.scope FROM task_work_area_links l JOIN project_processes p ON p.project_id=l.project_id AND p.id=l.process_id JOIN work_areas w ON w.id=l.work_area_id WHERE l.project_id=? ORDER BY l.task_id,p.code,w.public_id").all(projectId) as {task_id:number;code:string;public_id:string;scope:"self"|"subtree"}[];
  const byTaskProcess = new Map<number,NonNullable<TemplateTaskContextSnapshotItem["processLinks"]>>();
  const byTaskArea = new Map<number,NonNullable<TemplateTaskContextSnapshotItem["workAreaLinks"]>>();
  for (const row of processes) {
    const links = byTaskProcess.get(row.task_id) ?? [];
    links.push({processCode:row.code,scope:row.scope});
    byTaskProcess.set(row.task_id,links);
  }
  for (const row of areas) {
    const links = byTaskArea.get(row.task_id) ?? [];
    links.push({processCode:row.code,workAreaId:row.public_id,scope:row.scope});
    byTaskArea.set(row.task_id,links);
  }
  return {
    equipmentWorkAreas: [...byEquipment].map(([equipmentCode,workAreaLinks])=>({equipmentCode,workAreaLinks})),
    taskContexts: contexts.map(task=>({taskExternalId:task.external_id,
      processLinks: byTaskProcess.get(task.id) ?? [],
      workAreaLinks: byTaskArea.get(task.id) ?? [],
    })),
  };
}

/** Caller owns the authorized transaction and creates local instances before restoring references. */
export function restoreProjectContexts(db: Database.Database, projectId: number,
  graph: ReturnType<typeof snapshotProjectContexts>,
  local: {processes: ReadonlyMap<string,LocalInstance>; equipment: ReadonlyMap<string,LocalInstance>; tasks: ReadonlyMap<string,{id:number}>},
): void {
  const repository = new ProcessContextRepository(db);
  const seenEquipment = new Set<string>(), seenTasks = new Set<string>();
  for (const row of graph.equipmentWorkAreas) {
    if (!row || typeof row.equipmentCode!=="string" || !Array.isArray(row.workAreaLinks) || Object.keys(row).some(key=>!["equipmentCode","workAreaLinks"].includes(key)) || seenEquipment.has(row.equipmentCode)) invalid();
    const equipment = local.equipment.get(row.equipmentCode);
    if (!equipment) invalid();
    seenEquipment.add(row.equipmentCode);
    const links = row.workAreaLinks.map(link=>{
      if (!link || Object.keys(link).some(key=>!["processCode","workAreaId"].includes(key))) invalid();
      const process = local.processes.get(link.processCode);
      if (!process) invalid();
      return {processId:process.publicId,workAreaId:link.workAreaId};
    });
    repository.replaceEquipment(projectId, equipment.id, validateTransfer(()=>repository.validateEquipmentWorkAreas(projectId,links,links)));
  }
  for (const row of graph.taskContexts) {
    if (!row || typeof row.taskExternalId!=="string" || Object.keys(row).some(key=>!["taskExternalId","processLinks","workAreaLinks"].includes(key)) || seenTasks.has(row.taskExternalId)) invalid();
    const task = local.tasks.get(row.taskExternalId);
    if (!task) invalid();
    seenTasks.add(row.taskExternalId);
    if (row.processLinks===null && row.workAreaLinks===null) continue;
    if (!Array.isArray(row.processLinks) || !Array.isArray(row.workAreaLinks)) invalid();
    const processLinks = row.processLinks.map(link=>{
      if (!link || Object.keys(link).some(key=>!["processCode","scope"].includes(key))) invalid();
      const process = local.processes.get(link.processCode);
      if (!process) invalid();
      return {processId:process.publicId,scope:link.scope};
    });
    const workAreaLinks = row.workAreaLinks.map(link=>{
      if (!link || Object.keys(link).some(key=>!["processCode","workAreaId","scope"].includes(key))) invalid();
      const process = local.processes.get(link.processCode);
      if (!process) invalid();
      return {processId:process.publicId,workAreaId:link.workAreaId,scope:link.scope};
    });
    repository.replaceTask(projectId,task.id,validateTransfer(()=>repository.validateTaskContext(projectId,task.id,{processLinks,workAreaLinks},
      {taskId:row.taskExternalId,processLinks,workAreaLinks})));
  }
}

export function copyProjectContexts(db: Database.Database, sourceProjectId: number, targetProjectId: number,
  taskIds: ReadonlyMap<number,number>,
  includeEquipment = true,
): void {
  const equipment = db.prepare("SELECT id,public_id,code FROM project_equipment WHERE project_id=?").all(targetProjectId) as {id:number;public_id:string;code:string}[];
  const processes = db.prepare("SELECT id,public_id,code FROM project_processes WHERE project_id=?").all(targetProjectId) as {id:number;public_id:string;code:string}[];
  const tasks = new Map<string,{id:number}>();
  for (const [sourceId,id] of taskIds) {
    const original = db.prepare("SELECT external_id FROM tasks WHERE project_id=? AND id=?").get(sourceProjectId,sourceId) as {external_id:string}|undefined;
    if (!original) invalid();
    tasks.set(original.external_id,{id});
  }
  const graph = snapshotProjectContexts(db,sourceProjectId);
  restoreProjectContexts(db,targetProjectId,{...graph,equipmentWorkAreas:includeEquipment?graph.equipmentWorkAreas:[],taskContexts:graph.taskContexts.filter(task=>tasks.has(task.taskExternalId))},{
    equipment:new Map(equipment.map(row=>[row.code,{id:row.id,publicId:row.public_id}])),
    processes:new Map(processes.map(row=>[row.code,{id:row.id,publicId:row.public_id}])),tasks,
  });
}

/** Subtree Copy preserves explicit sources without flattening inherited context. */
export function copyTaskProcessContexts(db: Database.Database, projectId: number,
  taskIds: ReadonlyMap<number,number>,
): void {
  copyProjectContexts(db,projectId,projectId,taskIds,false);
}
