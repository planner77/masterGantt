import { randomUUID } from "node:crypto";
import type { AuthorizationResult } from "../projects/project-service-core";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { LogisticsTargetError, LogisticsTargetService } from "./logistics-targets-service-core";

interface Dependencies {
  service: LogisticsTargetService | (()=>LogisticsTargetService);
  projectService: { authorize(id:string,token:string|undefined):AuthorizationResult } |
    (()=>{authorize(id:string,token:string|undefined):AuthorizationResult});
  applicationBaseUrl:string|undefined; allowInsecureHttp?:string;
  environment:string|undefined; requestId?:()=>string;
}
const resolve = <T,>(x:T|(()=>T)):T => typeof x==="function"?(x as ()=>T)():x;
function urlFor(d:Dependencies):URL {
  try { return parseApplicationBaseUrl(d.applicationBaseUrl,d.environment,d.allowInsecureHttp); }
  catch(error) {
    if(error instanceof ConfigurationError) throw new PublicApiError(500,"CONFIGURATION_ERROR","Service configuration invalid.");
    throw error;
  }
}
function access(request:Request,projectId:string,d:Dependencies) {
  if (!isCanonicalUuidV4(projectId)) throw new PublicApiError(404,"PROJECT_NOT_FOUND","Project not found.");
  const url=urlFor(d);
  const cookie=parseEditSessionCookie(request.headers.get("cookie"),d.environment,url);
  const result=resolve(d.projectService).authorize(projectId,cookie.state==="present"?cookie.rawToken:undefined);
  if (result.kind==="projectNotFound") throw new PublicApiError(404,"PROJECT_NOT_FOUND","Project not found.");
  return {result,url};
}
function fail(error:unknown,d:Dependencies):Response {
  const mapped=error instanceof LogisticsTargetError
    ? new PublicApiError(error.status,error.code,error.message) : error;
  const response=apiErrorResponse(mapped,(d.requestId??randomUUID)());
  response.headers.set("Cache-Control","private, no-store");
  return response;
}
function params(request:Request):{limit:number;offset:number;search?:string} {
  const q=new URL(request.url).searchParams;
  if ([...q.keys()].some(k=>!["limit","offset","search"].includes(k)||q.getAll(k).length!==1))
    throw new PublicApiError(400,"INVALID_REQUEST","Invalid search parameters.");
  const lim=q.get("limit")??"50",off=q.get("offset")??"0",search=q.get("search");
  if (!/^[1-9]\d{0,2}$/.test(lim)||Number(lim)>100||
      !/^(0|[1-9]\d{0,4})$/.test(off)||Number(off)>10000||
      (search!==null&&(!search.trim()||search.length>100||/[\u0000-\u001f\u007f]/.test(search))))
    throw new PublicApiError(400,"INVALID_REQUEST","Invalid search parameters.");
  return {limit:Number(lim),offset:Number(off),...(search===null?{}:{search:search.trim()})};
}
export function handleListTargets(request:Request,projectId:string,d:Dependencies):Response {
  try {
    const {result}=access(request,projectId,d);
    const response=resolve(d.service).list(projectId,params(request));
    return Response.json({data:{...response,permission:result.kind==="authorized"?"edit":"readonly"}},
      {headers:{"Cache-Control":"private, no-store",ETag:'"'+response.projectRevision+'"'}});
  }catch(e){return fail(e,d);}
}
export function handleGetTarget(request:Request,projectId:string,targetId:string,d:Dependencies,usage=false):Response {
  try {
    access(request,projectId,d);
    if (new URL(request.url).search) throw new PublicApiError(400,"INVALID_REQUEST","Unknown parameters.");
    const service=resolve(d.service);
    return Response.json({data:usage?service.usage(projectId,targetId):service.get(projectId,targetId)},
      {headers:{"Cache-Control":"private, no-store"}});
  }catch(e){return fail(e,d);}
}
export async function handleMutateTarget(request:Request,projectId:string,d:Dependencies,
  action:"create"|"update"|"delete",targetId?:string):Promise<Response> {
  try {
    const {result,url}=access(request,projectId,d);
    if (!isExactAllowedOrigin(request.headers.get("origin"),url))
      throw new PublicApiError(403,"ORIGIN_NOT_ALLOWED","Origin not allowed.");
    if (result.kind!=="authorized") throw new PublicApiError(401,"EDIT_SESSION_REQUIRED","Valid edit session required.");
    if (new URL(request.url).search) throw new PublicApiError(400,"INVALID_REQUEST","Unknown parameters.");
    const expected=parseRequiredIfMatch(request);
    const service=resolve(d.service);
    if (action==="delete"&&request.body!==null) throw new PublicApiError(400,"INVALID_REQUEST","DELETE must not have body.");
    const body=action==="delete"?null:await readBoundedJson(request);
    const value=action==="create"?service.create(result.authorization,expected,body)
      :action==="update"?service.update(result.authorization,expected,targetId!,body)
      :service.delete(result.authorization,expected,targetId!);
    return Response.json(value,{status:action==="create"?201:200,
      headers:{"Cache-Control":"private, no-store",ETag:'"'+value.data.projectRevision+'"'}});
  }catch(e){return fail(e,d);}
}
