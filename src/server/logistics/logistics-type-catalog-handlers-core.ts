import { randomUUID } from "node:crypto";
import type { CreateLogisticsTypeRequest, LogisticsTypeKind, UpdateLogisticsTypeRequest } from "../../contracts/logistics";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { logisticsAdminUnlockRateLimiter, UNATTRIBUTED_LOGISTICS_ADMIN_RATE_KEY } from "../security/rate-limit-core";
import { parseLogisticsCatalogAdminCookie, serializeExpiredLogisticsCatalogAdminCookie, serializeLogisticsCatalogAdminCookie } from "../security/logistics-catalog-cookie-core";
import {
  LogisticsCatalogAuthorizationError,
  LogisticsCatalogConflictError,
  LogisticsCatalogInvalidInputError,
  LogisticsCatalogNotFoundError,
  LogisticsCatalogRevisionMismatchError,
  LogisticsCatalogTypeInactiveError,
  type LogisticsTypeCatalogService,
} from "./logistics-type-catalog-service-core";

const NO_STORE={"Cache-Control":"private, no-store"};

export interface LogisticsCatalogHandlerDependencies{
  catalogService:LogisticsTypeCatalogService|(()=>LogisticsTypeCatalogService);
  applicationBaseUrl:string|undefined;
  allowInsecureHttp?:string;
  environment:string|undefined;
  adminPassword?:string;
  requestId?:()=>string;
}
function service(d:LogisticsCatalogHandlerDependencies){return typeof d.catalogService==="function"?d.catalogService():d.catalogService;}
function appUrl(d:LogisticsCatalogHandlerDependencies):URL{try{return parseApplicationBaseUrl(d.applicationBaseUrl,d.environment,d.allowInsecureHttp);}catch(e){if(e instanceof ConfigurationError)throw new PublicApiError(500,"CONFIGURATION_ERROR","The service is not configured correctly.");throw e;}}
function requireOrigin(request:Request,url:URL){if(!isExactAllowedOrigin(request.headers.get("origin"),url))throw new PublicApiError(403,"ORIGIN_NOT_ALLOWED","The request origin is not allowed.");}
function token(request:Request,d:LogisticsCatalogHandlerDependencies,url:URL){return parseLogisticsCatalogAdminCookie(request.headers.get("cookie"),d.environment,url);}
function json(data:unknown,status=200,etag?:number){return Response.json(data,{status,headers:{...NO_STORE,"Content-Type":"application/json; charset=utf-8",...(etag?{ETag:`"${etag}"`}:{})}});}
function mapError(error:unknown):unknown{
  if(error instanceof LogisticsCatalogAuthorizationError)return new PublicApiError(401,"LOGISTICS_ADMIN_SESSION_REQUIRED","A valid logistics catalog administrator session is required.");
  if(error instanceof LogisticsCatalogRevisionMismatchError)return new PublicApiError(412,"LOGISTICS_CATALOG_REVISION_MISMATCH","Logistics type catalog changed. Reload and retry.");
  if(error instanceof LogisticsCatalogNotFoundError)return new PublicApiError(404,"LOGISTICS_TYPE_NOT_FOUND","Logistics type not found.");
  if(error instanceof LogisticsCatalogTypeInactiveError)return new PublicApiError(409,"LOGISTICS_TYPE_INACTIVE","Inactive logistics types cannot be newly assigned.");
  if(error instanceof LogisticsCatalogConflictError)return new PublicApiError(409,"LOGISTICS_CATALOG_CONFLICT","The logistics catalog change conflicts with existing data.");
  if(error instanceof LogisticsCatalogInvalidInputError)return new PublicApiError(400,"INVALID_REQUEST","The logistics type catalog request is invalid.");
  const code=(error as {code?:unknown}|null)?.code;if(typeof code==="string"&&code.startsWith("SQLITE_CONSTRAINT"))return new PublicApiError(409,"LOGISTICS_CATALOG_CONFLICT","The logistics catalog change conflicts with existing data.");
  return error;
}
function fail(error:unknown,id:string){const r=apiErrorResponse(mapError(error),id);r.headers.set("Cache-Control",NO_STORE["Cache-Control"]);return r;}
function validBootstrap(password:string|undefined){if(typeof password!=="string"||password.length===0)return false;const n=Array.from(password).length;return n<=512&&(n<=12||n>=16)&&new TextEncoder().encode(password).byteLength<=1024;}

export async function handleGetActiveLogisticsTypes(request:Request,d:LogisticsCatalogHandlerDependencies):Promise<Response>{
  const id=(d.requestId??randomUUID)();try{appUrl(d);return json(service(d).getActiveCatalog());}catch(e){return fail(e,id);}
}
export async function handleUnlockLogisticsCatalogAdmin(request:Request,d:LogisticsCatalogHandlerDependencies):Promise<Response>{
  const id=(d.requestId??randomUUID)();try{
    const url=appUrl(d);requireOrigin(request,url);const body=await readBoundedJson(request,4*1024) as {password?:unknown};
    if(!body||typeof body.password!=="string"||body.password.length>512)throw new PublicApiError(400,"INVALID_REQUEST","Administrator password is invalid.");
    const decision=logisticsAdminUnlockRateLimiter.consume(UNATTRIBUTED_LOGISTICS_ADMIN_RATE_KEY);
    if(!decision.allowed)throw new PublicApiError(429,"RATE_LIMITED","Too many administrator authentication attempts. Retry later.",[],{"Retry-After":String(decision.retryAfterSeconds)});
    const s=service(d);if(!s.adminCredentialConfigured()&&!validBootstrap(d.adminPassword))return fail(new PublicApiError(401,"LOGISTICS_ADMIN_AUTH_FAILED","Logistics catalog administrator authentication failed."),id);
    const unlocked=s.unlockAdmin(body.password,d.adminPassword);if(!unlocked)return fail(new PublicApiError(401,"LOGISTICS_ADMIN_AUTH_FAILED","Logistics catalog administrator authentication failed."),id);
    const response=json({data:{permission:"logistics_catalog_admin",expiresAt:unlocked.expiresAt}},201);response.headers.set("Set-Cookie",serializeLogisticsCatalogAdminCookie(unlocked.rawToken,url,d.environment));return response;
  }catch(e){return fail(e,id);}
}
export async function handleLogoutLogisticsCatalogAdmin(request:Request,d:LogisticsCatalogHandlerDependencies):Promise<Response>{
  const id=(d.requestId??randomUUID)();try{const url=appUrl(d);requireOrigin(request,url);service(d).logoutAdmin(token(request,d,url));const response=new Response(null,{status:204,headers:NO_STORE});response.headers.set("Set-Cookie",serializeExpiredLogisticsCatalogAdminCookie(url,d.environment));return response;}catch(e){return fail(e,id);}
}
export async function handleChangeLogisticsCatalogAdminPassword(request:Request,d:LogisticsCatalogHandlerDependencies):Promise<Response>{
  const id=(d.requestId??randomUUID)();try{const url=appUrl(d);requireOrigin(request,url);const body=await readBoundedJson(request,4*1024) as {newPassword?:unknown;confirmPassword?:unknown};
    if(typeof body?.newPassword!=="string"||body.newPassword!==body.confirmPassword||Array.from(body.newPassword).length<1||Array.from(body.newPassword).length>12)throw new PublicApiError(400,"INVALID_REQUEST","New administrator password must be 1 to 12 characters and confirmation must match.");
    const changed=service(d).changeAdminPassword(token(request,d,url),body.newPassword);const response=json({data:{permission:"logistics_catalog_admin",expiresAt:changed.expiresAt}});response.headers.set("Set-Cookie",serializeLogisticsCatalogAdminCookie(changed.rawToken,url,d.environment));return response;
  }catch(e){return fail(e,id);}
}
export async function handleGetLogisticsCatalogAdmin(request:Request,d:LogisticsCatalogHandlerDependencies):Promise<Response>{
  const id=(d.requestId??randomUUID)();try{const url=appUrl(d);const result=service(d).getCatalog(token(request,d,url));return json(result,200,result.data.revision);}catch(e){return fail(e,id);}
}
export async function handleCreateLogisticsType(request:Request,kind:LogisticsTypeKind,d:LogisticsCatalogHandlerDependencies):Promise<Response>{
  const id=(d.requestId??randomUUID)();try{const url=appUrl(d);requireOrigin(request,url);const rev=parseRequiredIfMatch(request);const body=await readBoundedJson(request) as CreateLogisticsTypeRequest;const result=service(d).create(kind,token(request,d,url),rev,body);return json(result,201,result.data.revision);}catch(e){return fail(e,id);}
}
export async function handleUpdateLogisticsType(request:Request,kind:LogisticsTypeKind,typeCode:string,d:LogisticsCatalogHandlerDependencies):Promise<Response>{
  const id=(d.requestId??randomUUID)();try{const url=appUrl(d);requireOrigin(request,url);const rev=parseRequiredIfMatch(request);const body=await readBoundedJson(request) as UpdateLogisticsTypeRequest;const result=service(d).update(kind,typeCode,token(request,d,url),rev,body);return json(result,200,result.data.revision);}catch(e){return fail(e,id);}
}
