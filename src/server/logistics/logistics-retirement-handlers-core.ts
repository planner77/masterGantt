import { randomUUID } from "node:crypto";
import type { AuthorizationResult } from "../projects/project-service-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch } from "../http/request-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";

export interface LogisticsReadDependencies {
  projectService: {authorize(id:string,token:string|undefined):AuthorizationResult} | (()=>{authorize(id:string,token:string|undefined):AuthorizationResult});
  applicationBaseUrl:string|undefined;
  environment:string|undefined;
  allowInsecureHttp?:string;
  requestId?:()=>string;
}

export function logisticsRouteAccess(request: Request, publicId: string, d: LogisticsReadDependencies, write=false) {
  if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404,"PROJECT_NOT_FOUND","프로젝트를 찾을 수 없습니다.");
  let url:URL;
  try { url=parseApplicationBaseUrl(d.applicationBaseUrl,d.environment,d.allowInsecureHttp); }
  catch(error) { if(error instanceof ConfigurationError) throw new PublicApiError(500,"CONFIGURATION_ERROR","서비스 설정을 확인해 주세요."); throw error; }
  if (write && !isExactAllowedOrigin(request.headers.get("origin"),url)) throw new PublicApiError(403,"ORIGIN_NOT_ALLOWED","요청 출처를 확인해 주세요.");
  const cookie=parseEditSessionCookie(request.headers.get("cookie"),d.environment,url);
  const service=typeof d.projectService === "function"?d.projectService():d.projectService;
  const auth=service.authorize(publicId,cookie.state==="present"?cookie.rawToken:undefined);
  if (auth.kind==="projectNotFound") throw new PublicApiError(404,"PROJECT_NOT_FOUND","프로젝트를 찾을 수 없습니다.");
  if (write) {
    if(auth.kind!=="authorized") throw new PublicApiError(401,"EDIT_SESSION_REQUIRED","편집 권한이 필요합니다.");
    if(parseRequiredIfMatch(request)!==auth.authorization.projectRevision) throw new PublicApiError(412,"REVISION_MISMATCH","프로젝트가 변경되었습니다. 최신 자료를 다시 조회해 주세요.");
  }
  return auth;
}

/** Public retirement boundary: keep access guards, never read a body or invoke a writer. */
export function handleRetiredLogisticsRoute(request: Request, publicId: string, d: LogisticsReadDependencies): Response {
  try {
    logisticsRouteAccess(request,publicId,d,request.method!=="GET"&&request.method!=="HEAD");
    throw new PublicApiError(410,"LOGISTICS_API_RETIRED","이 연결 API는 종료되었습니다. 공정·WorkArea·설비·물류 시스템의 직접 연결을 이용해 주세요.");
  } catch(error) {
    const response=apiErrorResponse(error,(d.requestId??randomUUID)());
    response.headers.set("Cache-Control","private, no-store");
    response.headers.set("X-Content-Type-Options","nosniff");
    return response;
  }
}
