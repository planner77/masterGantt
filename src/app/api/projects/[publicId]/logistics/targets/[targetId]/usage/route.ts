import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getDatabase } from "@/server/db";
import { TaskFieldProjectService } from "@/server/projects/task-field-project-service";
import { handleRetiredLogisticsRoute } from "@/server/logistics/logistics-retirement-handlers-core";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const ROUTE="/api/projects/[publicId]/logistics/targets/[targetId]/usage";
type Context={params:Promise<{publicId:string;targetId:string}>};
async function retired(request:Request,context:Context) {
  const {publicId}=await context.params;
  return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},requestId=>handleRetiredLogisticsRoute(request,publicId,{
    projectService:()=>new TaskFieldProjectService(getDatabase()),...readApplicationConfiguration(process.env),requestId:()=>requestId,
  }));
}
export const GET=retired;
