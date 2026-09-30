import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleUpdateLogisticsType } from "@/server/logistics/logistics-type-catalog-handlers-core";
import { getLogisticsTypeCatalogService } from "@/server/logistics/logistics-type-catalog-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
export const runtime="nodejs";export const dynamic="force-dynamic";const ROUTE="/api/logistics-catalog/admin/system-types/[code]";
interface Context{params:Promise<{code:string}>}
export async function PATCH(request:Request,{params}:Context){const {code}=await params;return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},id=>handleUpdateLogisticsType(request,"system",code,{catalogService:getLogisticsTypeCatalogService,...readApplicationConfiguration(process.env),requestId:()=>id}));}
