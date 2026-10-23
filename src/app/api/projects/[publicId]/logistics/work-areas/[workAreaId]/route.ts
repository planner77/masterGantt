import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLogisticsService } from "@/server/logistics/logistics-service";
import { handleMutateWorkArea } from "@/server/logistics/logistics-handlers-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{publicId:string;workAreaId:string}> }) {
  const {publicId,workAreaId}=await context.params;
  return withApiRequestLogging(request,{route:"/api/projects/[publicId]/logistics/work-areas/[workAreaId]",trustProxy:process.env.TRUST_PROXY},requestId=>{
    const {logistics,project}=getLogisticsService();
    return handleMutateWorkArea(request,publicId,workAreaId,"update",{logisticsService:logistics,projectService:project,...readApplicationConfiguration(process.env),requestId:()=>requestId});
  });
}

export async function DELETE(request: Request, context: { params: Promise<{publicId:string;workAreaId:string}> }) {
  const {publicId,workAreaId}=await context.params;
  return withApiRequestLogging(request,{route:"/api/projects/[publicId]/logistics/work-areas/[workAreaId]",trustProxy:process.env.TRUST_PROXY},requestId=>{
    const {logistics,project}=getLogisticsService();
    return handleMutateWorkArea(request,publicId,workAreaId,"delete",{logisticsService:logistics,projectService:project,...readApplicationConfiguration(process.env),requestId:()=>requestId});
  });
}
