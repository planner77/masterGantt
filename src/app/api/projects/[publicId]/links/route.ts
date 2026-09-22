import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLinkService } from "@/server/projects/project-service";
import { handleCreateLink } from "@/server/projects/link-handlers-core";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const ROUTE="/api/projects/[publicId]/links";
export async function POST(request:Request,context:{params:Promise<{publicId:string}>}){const{publicId}=await context.params;return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},requestId=>handleCreateLink(request,publicId,{service:getLinkService,...readApplicationConfiguration(process.env),requestId:()=>requestId}));}
