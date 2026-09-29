import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleGetActiveLogisticsTypes } from "@/server/logistics/logistics-type-catalog-handlers-core";
import { getLogisticsTypeCatalogService } from "@/server/logistics/logistics-type-catalog-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
export const runtime="nodejs";export const dynamic="force-dynamic";
const ROUTE="/api/logistics-catalog/types";
export async function GET(request:Request):Promise<Response>{return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},requestId=>handleGetActiveLogisticsTypes(request,{catalogService:getLogisticsTypeCatalogService,...readApplicationConfiguration(process.env),requestId:()=>requestId}));}
