import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleLogoutLogisticsCatalogAdmin,handleUnlockLogisticsCatalogAdmin } from "@/server/logistics/logistics-type-catalog-handlers-core";
import { getLogisticsTypeCatalogService } from "@/server/logistics/logistics-type-catalog-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
export const runtime="nodejs";export const dynamic="force-dynamic";
const ROUTE="/api/logistics-catalog/admin-sessions";
const deps=(requestId:string)=>({catalogService:getLogisticsTypeCatalogService,...readApplicationConfiguration(process.env),adminPassword:process.env.LOGISTICS_CATALOG_ADMIN_PASSWORD,requestId:()=>requestId});
export async function POST(request:Request){return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},id=>handleUnlockLogisticsCatalogAdmin(request,deps(id)));}
export async function DELETE(request:Request){return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},id=>handleLogoutLogisticsCatalogAdmin(request,deps(id)));}
