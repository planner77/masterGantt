import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLinkService } from "@/server/projects/project-service";
import { handleDeleteLink } from "@/server/projects/link-handlers-core";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const ROUTE="/api/projects/[publicId]/links/[linkId]";
export async function DELETE(request:Request,context:{params:Promise<{publicId:string;linkId:string}>}){const{publicId,linkId}=await context.params;return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},requestId=>handleDeleteLink(request,publicId,linkId,{service:getLinkService,...readApplicationConfiguration(process.env),requestId:()=>requestId}));}
