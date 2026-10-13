import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getDatabase } from "@/server/db";
import { TaskFieldProjectService } from "@/server/projects/task-field-project-service";
import { LogisticsTargetService } from "@/server/logistics/logistics-targets-service-core";
import { handleListTargets, handleGetTarget, handleMutateTarget } from "@/server/logistics/logistics-targets-handlers-core";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const deps=(requestId:string)=>({service:()=>new LogisticsTargetService(getDatabase()),projectService:()=>new TaskFieldProjectService(getDatabase()),...readApplicationConfiguration(process.env),requestId:()=>requestId});
const ROUTE="/api/projects/[publicId]/logistics/targets/[targetId]/usage";
type Context={params:Promise<{publicId:string;targetId:string}>};
export async function GET(request:Request,context:Context){const {publicId,targetId}=await context.params;return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},id=>handleGetTarget(request,publicId,targetId,deps(id),true));}
