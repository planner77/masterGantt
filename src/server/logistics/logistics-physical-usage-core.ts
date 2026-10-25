import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { resolveAllTaskTargetBindings, TaskTargetResolutionError } from "../../domain/logistics/task-target-bindings";
import { RESOURCE_DASHBOARD_LIMITS } from "../../contracts/resource-dashboard";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { ProjectRepository } from "../repositories/project-repository-core";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { loadBoundedTaskLogisticsSnapshot, LogisticsCompatibilityError } from "./task-logistics-compatibility-core";
import { logisticsRouteAccess, type LogisticsReadDependencies } from "./logistics-retirement-handlers-core";

export function readLogisticsPhysicalUsage(db: Database.Database, publicId:string, kind:"equipment"|"system", entityId:string) {
  if(!isCanonicalUuidV4(entityId)) throw new PublicApiError(404,"LOGISTICS_NOT_FOUND","물류 기준정보를 찾을 수 없습니다.");
  return db.transaction(()=>{
    const project=new ProjectRepository(db).findByPublicId(publicId);
    if(!project) throw new PublicApiError(404,"PROJECT_NOT_FOUND","프로젝트를 찾을 수 없습니다.");
    const table=kind==="equipment"?"project_equipment":"project_logistics_systems";
    if(!db.prepare(`SELECT 1 FROM ${table} WHERE project_id=? AND public_id=?`).get(project.id,entityId)) throw new PublicApiError(404,"LOGISTICS_NOT_FOUND","물류 기준정보를 찾을 수 없습니다.");
    const snapshot=loadBoundedTaskLogisticsSnapshot(db,project.id);
    const resolved=resolveAllTaskTargetBindings(snapshot);
    const relatedTasks=snapshot.tasks.filter(task=>{
      const row=resolved.get(task.id)!;
      return (kind==="equipment"?row.effectiveEquipmentIds:row.effectiveSystemIds).includes(entityId);
    }).map(task=>({taskId:task.id,type:task.type})).sort((a,b)=>a.taskId.localeCompare(b.taskId));
    const directTaskCount=relatedTasks.filter(task=>resolved.get(task.taskId)!.legacySources.some(source=>source.kind===kind&&source.entityId===entityId)).length;
    const compatibilityTaskCount=relatedTasks.filter(task=>resolved.get(task.taskId)!.effectiveMembers.some(member=>member.kind===kind&&member.entityId===entityId)).length;
    const result={projectRevision:project.revision,kind,entityId,relatedTasks,directTaskCount,compatibilityTaskCount};
    if(Buffer.byteLength(JSON.stringify({data:result}))>RESOURCE_DASHBOARD_LIMITS.reportBytes) throw new PublicApiError(422,"LOGISTICS_SOURCE_LIMIT_EXCEEDED","물류 연결 응답 한도를 초과했습니다.");
    return result;
  }).deferred();
}

export function handleGetLogisticsPhysicalUsage(request:Request,publicId:string,kind:"equipment"|"system",entityId:string,d:LogisticsReadDependencies&{database:()=>Database.Database}):Response {
  try {
    logisticsRouteAccess(request,publicId,d);
    if(new URL(request.url).search) throw new PublicApiError(400,"INVALID_REQUEST","조회 조건을 확인해 주세요.");
    const data=readLogisticsPhysicalUsage(d.database(),publicId,kind,entityId);
    return Response.json({data},{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",ETag:`"${data.projectRevision}"`}});
  } catch(error) {
    const mapped=error instanceof LogisticsCompatibilityError||error instanceof TaskTargetResolutionError
      ?new PublicApiError(409,"LOGISTICS_SOURCE_INVALID","기존 물류 연결 원본의 참조를 확인해 주세요. 원본 자료는 보존됩니다."):error;
    const response=apiErrorResponse(mapped,(d.requestId??randomUUID)());response.headers.set("Cache-Control","private, no-store");response.headers.set("X-Content-Type-Options","nosniff");return response;
  }
}
