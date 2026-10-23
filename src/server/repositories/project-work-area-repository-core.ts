import type Database from "better-sqlite3";
import type { ProjectWorkAreaDto } from "../../contracts/process-catalog";
import { PublicApiError } from "../http/api-error-core";

// Legacy sources were independently bounded to 200 areas and 200 mappings.
// Preserve their full Cartesian alias relation without applying the new local cap to it.
export const PROJECT_WORK_AREA_LIMITS = Object.freeze({local:200,legacyAliases:40_000});
export interface ProjectWorkAreaRecord {
  id: number; public_id: string; project_id: number; process_id: number;
  code: string; name: string; active: number; sort_order: number; created_at: string; updated_at: string;
}
const usage = `(SELECT COUNT(*) FROM equipment_project_work_areas WHERE project_id=w.project_id AND work_area_id=w.id)+(SELECT COUNT(*) FROM task_project_work_area_links WHERE project_id=w.project_id AND work_area_id=w.id)`;
/** Project-local ownership and legacy mapping aliases are deliberately separate identities. */
export class ProjectWorkAreaRepository {
  constructor(private readonly db: Database.Database) {}
  find(projectId: number, publicId: string): ProjectWorkAreaRecord | undefined {
    return this.db.prepare("SELECT * FROM project_work_areas WHERE project_id=? AND public_id=?").get(projectId, publicId) as ProjectWorkAreaRecord | undefined;
  }
  list(projectId: number): ProjectWorkAreaDto[] {
    const local = this.db.prepare(`SELECT w.public_id id,p.public_id processId,NULL occurrenceId,'project' source,w.code,w.name,w.active,w.sort_order sortOrder,${usage} usageCount,1 editable FROM project_work_areas w JOIN project_processes p ON p.project_id=w.project_id AND p.id=w.process_id WHERE w.project_id=? ORDER BY w.sort_order,w.name,w.public_id LIMIT 201`).all(projectId);
    const legacy = this.db.prepare(`SELECT w.public_id id,p.public_id processId,o.public_id occurrenceId,'legacy' source,(SELECT COUNT(*) FROM project_process_occurrence_mappings shared WHERE shared.occurrence_id=o.id) sharedOwnerCount,(project.business_unit_id IS o.business_unit_id AND project.product_id IS o.product_id AND project.site_entity_id IS o.site_entity_id) classificationValid,w.code,w.name,(w.active=1 AND p.active=1 AND o.active=1 AND pt.active=1 AND b.active=1 AND product.active=1 AND s.active=1 AND (st.id IS NULL OR st.active=1)) active,w.sort_order sortOrder,(SELECT COUNT(*) FROM equipment_work_areas WHERE project_id=m.project_id AND process_id=p.id AND work_area_id=w.id)+(SELECT COUNT(*) FROM task_work_area_links WHERE project_id=m.project_id AND process_id=p.id AND work_area_id=w.id)+(SELECT COUNT(*) FROM logistics_targets WHERE project_id=m.project_id AND project_process_id=p.id AND work_area_id=w.id)+COALESCE(m.work_area_id=w.id,0) usageCount,0 editable FROM project_process_occurrence_mappings m JOIN projects project ON project.id=m.project_id JOIN project_processes p ON p.project_id=m.project_id AND p.id=m.project_process_id JOIN site_product_processes o ON o.id=m.occurrence_id JOIN work_areas w ON w.occurrence_id=o.id JOIN process_types pt ON pt.id=o.process_type_id JOIN project_master_items b ON b.id=o.business_unit_id JOIN project_master_items product ON product.id=o.product_id JOIN project_master_items s ON s.id=o.site_entity_id LEFT JOIN product_standard_processes st ON st.id=o.standard_process_id WHERE m.project_id=? ORDER BY p.public_id,w.sort_order,w.public_id LIMIT 40001`).all(projectId);
    if (local.length > PROJECT_WORK_AREA_LIMITS.local || legacy.length > PROJECT_WORK_AREA_LIMITS.legacyAliases) throw new PublicApiError(422,"PROCESS_CATALOG_LIMIT_EXCEEDED","프로젝트 WorkArea 조회 한도를 초과했습니다.");
    return [...local,...legacy].map(raw => { const row=raw as Omit<ProjectWorkAreaDto,"active"|"editable"> & {active:number;editable:number;sharedOwnerCount?:number;classificationValid?:number};
      const {sharedOwnerCount,classificationValid,...dto}=row;
      return {...dto,active:row.active===1,editable:row.editable===1,...(row.source==="legacy"?{diagnostics:[...(sharedOwnerCount!>1?["shared" as const]:[]),...(!row.active?["inactive" as const]:[]),...(classificationValid===0?["classification_mismatch" as const]:[])]}:{})}; });
  }
  usage(projectId: number, id: number): number {
    return this.db.prepare(`SELECT ${usage} FROM project_work_areas w WHERE w.project_id=? AND w.id=?`).pluck().get(projectId,id) as number;
  }
  insert(row: {publicId:string;projectId:number;processId:number;code:string;name:string;active:boolean;sortOrder:number;now:string}): void {
    this.db.prepare("INSERT INTO project_work_areas(public_id,project_id,process_id,code,name,active,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(row.publicId,row.projectId,row.processId,row.code,row.name,row.active?1:0,row.sortOrder,row.now,row.now);
  }
  update(projectId:number,id:number,input:{code?:string;name?:string;active?:boolean;sortOrder?:number},now:string):void {
    this.db.prepare("UPDATE project_work_areas SET code=COALESCE(?,code),name=COALESCE(?,name),active=COALESCE(?,active),sort_order=COALESCE(?,sort_order),updated_at=? WHERE project_id=? AND id=?").run(input.code??null,input.name??null,input.active===undefined?null:input.active?1:0,input.sortOrder??null,now,projectId,id);
  }
  remove(projectId:number,id:number):void {this.db.prepare("DELETE FROM project_work_areas WHERE project_id=? AND id=?").run(projectId,id);}
}
