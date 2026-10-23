import { withApiRequestLogging } from '@/server/http/request-context-core';
import { readApplicationConfiguration } from '@/server/security/origin-core';
import { getProjectService } from '@/server/projects/project-service';
import { getProcessCatalogService } from '@/server/process-catalog/process-catalog-service';
import { handleGetTaskProcessContext, handleReplaceTaskProcessContext } from '@/server/process-catalog/process-catalog-handlers-core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ROUTE='/api/projects/[publicId]/tasks/[taskId]/process-context';
type Context={params:Promise<{publicId:string;taskId:string}>};
const dependencies=(requestId:string)=>({service:getProcessCatalogService,projectService:getProjectService,...readApplicationConfiguration(process.env),requestId:()=>requestId});
export async function GET(request:Request,context:Context):Promise<Response>{
 const {publicId,taskId}=await context.params;
 return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},id=>handleGetTaskProcessContext(request,publicId,taskId,dependencies(id)));
}
export async function PUT(request:Request,context:Context):Promise<Response>{
 const {publicId,taskId}=await context.params;
 return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},id=>handleReplaceTaskProcessContext(request,publicId,taskId,dependencies(id)));
}
