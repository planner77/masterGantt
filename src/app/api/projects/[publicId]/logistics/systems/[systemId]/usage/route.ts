import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getDatabase } from "@/server/db";
import { TaskFieldProjectService } from "@/server/projects/task-field-project-service";
import { handleGetLogisticsPhysicalUsage } from "@/server/logistics/logistics-physical-usage-core";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const ROUTE="/api/projects/[publicId]/logistics/systems/[systemId]/usage";
export async function GET(request:Request,context:{params:Promise<{publicId:string;systemId:string}>}) {
 const {publicId,systemId}=await context.params;
 return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},requestId=>handleGetLogisticsPhysicalUsage(request,publicId,"system",systemId,{
   database:getDatabase,projectService:()=>new TaskFieldProjectService(getDatabase()),...readApplicationConfiguration(process.env),requestId:()=>requestId,
 }));
}
