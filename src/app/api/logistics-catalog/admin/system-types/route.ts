import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleCreateLogisticsType,handleGetLogisticsCatalogAdmin } from "@/server/logistics/logistics-type-catalog-handlers-core";
import { getLogisticsTypeCatalogService } from "@/server/logistics/logistics-type-catalog-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
export const runtime="nodejs";export const dynamic="force-dynamic";const ROUTE="/api/logistics-catalog/admin/system-types";
const deps=(id:string)=>({catalogService:getLogisticsTypeCatalogService,...readApplicationConfiguration(process.env),requestId:()=>id});
export async function GET(request:Request){return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},id=>handleGetLogisticsCatalogAdmin(request,deps(id)));}
export async function POST(request:Request){return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},id=>handleCreateLogisticsType(request,"system",deps(id)));}
