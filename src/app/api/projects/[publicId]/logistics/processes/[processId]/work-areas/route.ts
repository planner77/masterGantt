import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLogisticsService } from "@/server/logistics/logistics-service";
import { handleMutateWorkArea } from "@/server/logistics/logistics-handlers-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{publicId:string;processId:string}> }) {
  const {publicId,processId}=await context.params;
  return withApiRequestLogging(request,{route:"/api/projects/[publicId]/logistics/processes/[processId]/work-areas",trustProxy:process.env.TRUST_PROXY},requestId=>{
    const {logistics,project}=getLogisticsService();
    return handleMutateWorkArea(request,publicId,processId,"create",{logisticsService:logistics,projectService:project,...readApplicationConfiguration(process.env),requestId:()=>requestId});
  });
}
