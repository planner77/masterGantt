import { randomUUID } from "node:crypto";

import type { ReplaceProjectWorkCalendarRequest } from "../../contracts/work-calendar";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import type { AuthorizationResult } from "../projects/project-service-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "../security/origin-core";
import {
  WorkCalendarConflictError,
  WorkCalendarCountryUnavailableError,
  WorkCalendarDependencyStructureError,
  WorkCalendarEditSessionInvalidError,
  WorkCalendarInvalidInputError,
  WorkCalendarManualConflictError,
  WorkCalendarProjectNotFoundError,
  WorkCalendarRevisionMismatchError,
  type WorkCalendarService,
} from "./work-calendar-service-core";

const NO_STORE={"Cache-Control":"private, no-store"};

interface ProjectAuthorizationService {
  authorize(publicId:string,rawToken:string|undefined):AuthorizationResult;
}
export interface WorkCalendarHandlerDependencies {
  calendarService:WorkCalendarService|(()=>WorkCalendarService);
  projectService?:ProjectAuthorizationService|(()=>ProjectAuthorizationService);
  applicationBaseUrl?:string;
  allowInsecureHttp?:string;
  environment?:string;
  requestId?:()=>string;
}

function calendarService(deps:WorkCalendarHandlerDependencies):WorkCalendarService {
  return typeof deps.calendarService==="function"?deps.calendarService():deps.calendarService;
}
function projectService(deps:WorkCalendarHandlerDependencies):ProjectAuthorizationService {
  if(!deps.projectService) throw new Error("Project service dependency is missing.");
  return typeof deps.projectService==="function"?deps.projectService():deps.projectService;
}
function applicationUrl(deps:WorkCalendarHandlerDependencies):URL {
  try {
    return parseApplicationBaseUrl(deps.applicationBaseUrl,deps.environment,deps.allowInsecureHttp);
  } catch(error) {
    if(error instanceof ConfigurationError) throw new PublicApiError(500,"CONFIGURATION_ERROR","The service is not configured correctly.");
    throw error;
  }
}
function authorize(request:Request,publicId:string,deps:WorkCalendarHandlerDependencies,url:URL) {
  const cookie=parseEditSessionCookie(request.headers.get("cookie"),deps.environment,url);
  const result=projectService(deps).authorize(publicId,cookie.state==="present"?cookie.rawToken:undefined);
  if(result.kind==="projectNotFound") throw new PublicApiError(404,"PROJECT_NOT_FOUND","Project not found.");
  if(result.kind!=="authorized") throw new PublicApiError(401,"EDIT_SESSION_REQUIRED","A valid edit session is required.");
  return result.authorization;
}
function requireOrigin(request:Request,url:URL):void {
  if(!isExactAllowedOrigin(request.headers.get("origin"),url)) {
    throw new PublicApiError(403,"ORIGIN_NOT_ALLOWED","The request origin is not allowed.");
  }
}
function mapped(error:unknown):unknown {
  if(error instanceof WorkCalendarProjectNotFoundError) return new PublicApiError(404,"PROJECT_NOT_FOUND","Project not found.");
  if(error instanceof WorkCalendarInvalidInputError) return new PublicApiError(400,"INVALID_WORK_CALENDAR","Work calendar input is invalid.");
  if(error instanceof WorkCalendarCountryUnavailableError) return new PublicApiError(
    422,"COUNTRY_CALENDAR_UNAVAILABLE","Country calendar data is unavailable for the requested year.",
    [{path:"countryRules",code:"COUNTRY_CALENDAR_UNAVAILABLE",message:`${error.countryCode} ${error.year}`}],
  );
  if(error instanceof WorkCalendarConflictError) return new PublicApiError(
    409,"CALENDAR_EXCEPTION_CONFLICT","WORKING and NON_WORKING exceptions conflict on the same date.",
    [{path:"date",code:"CALENDAR_EXCEPTION_CONFLICT",message:error.date}],
  );
  if(error instanceof WorkCalendarManualConflictError) {
    const dependencyConflict=error.conflicts.some((conflict)=>conflict.reason==="DEPENDENCY");
    const code=dependencyConflict?"MANUAL_DEPENDENCY_CONFLICT":"MANUAL_TASK_CALENDAR_CONFLICT";
    return new PublicApiError(
      409,code,dependencyConflict
        ?"Manual tasks conflict with FS dependency constraints under the proposed work calendar."
        :"Manual tasks conflict with the proposed work calendar.",
      error.conflicts.map((conflict)=>({
        path:`tasks.${conflict.taskId}`,
        code:conflict.reason==="DEPENDENCY"?"MANUAL_DEPENDENCY_CONFLICT":"MANUAL_TASK_CALENDAR_CONFLICT",
        message:conflict.date,
      })),
    );
  }
  if(error instanceof WorkCalendarRevisionMismatchError) return new PublicApiError(412,"REVISION_MISMATCH","Project changed. Reload and retry.");
  if(error instanceof WorkCalendarEditSessionInvalidError) return new PublicApiError(401,"EDIT_SESSION_REQUIRED","A valid edit session is required.");
  if(error instanceof WorkCalendarDependencyStructureError) return new PublicApiError(
    409,error.code,error.code==="DEPENDENCY_CYCLE"
      ?"The persisted dependency graph contains a cycle."
      :"The persisted dependency graph contains an unsupported structure.",
  );
  return error;
}
function json(body:unknown,status=200,etag?:number):Response {
  return Response.json(body,{status,headers:{...NO_STORE,"Content-Type":"application/json; charset=utf-8",...(etag===undefined?{}:{ETag:`"${etag}"`})}});
}
function fail(error:unknown,requestId:string):Response {
  const response=apiErrorResponse(mapped(error),requestId);
  response.headers.set("Cache-Control",NO_STORE["Cache-Control"]);
  return response;
}

export function handleListWorkCalendarCountries(deps:WorkCalendarHandlerDependencies):Response {
  const requestId=(deps.requestId??randomUUID)();
  try { return json(calendarService(deps).listCountries()); }
  catch(error) { return fail(error,requestId); }
}

export function handleGetProjectWorkCalendar(request:Request,publicId:string,deps:WorkCalendarHandlerDependencies):Response {
  const requestId=(deps.requestId??randomUUID)();
  try {
    const url=applicationUrl(deps);
    authorize(request,publicId,deps,url);
    const result=calendarService(deps).get(publicId);
    if(!result) throw new PublicApiError(404,"PROJECT_NOT_FOUND","Project not found.");
    return json(result,200,result.data.projectRevision);
  } catch(error) { return fail(error,requestId); }
}

export async function handlePreviewProjectWorkCalendar(request:Request,publicId:string,deps:WorkCalendarHandlerDependencies):Promise<Response> {
  const requestId=(deps.requestId??randomUUID)();
  try {
    const url=applicationUrl(deps);
    requireOrigin(request,url);
    const authorization=authorize(request,publicId,deps,url);
    const expected=parseRequiredIfMatch(request);
    if(authorization.projectRevision!==expected) throw new WorkCalendarRevisionMismatchError();
    const input=await readBoundedJson(request) as ReplaceProjectWorkCalendarRequest;
    const result=calendarService(deps).preview(publicId,input);
    if(result.data.projectRevision!==expected) throw new WorkCalendarRevisionMismatchError();
    return json(result,200,result.data.projectRevision);
  } catch(error) { return fail(error,requestId); }
}

export async function handleReplaceProjectWorkCalendar(request:Request,publicId:string,deps:WorkCalendarHandlerDependencies):Promise<Response> {
  const requestId=(deps.requestId??randomUUID)();
  try {
    const url=applicationUrl(deps);
    requireOrigin(request,url);
    const authorization=authorize(request,publicId,deps,url);
    const expected=parseRequiredIfMatch(request);
    const input=await readBoundedJson(request) as ReplaceProjectWorkCalendarRequest;
    const result=calendarService(deps).replace(authorization,expected,input);
    return json(result,200,result.data.projectRevision);
  } catch(error) { return fail(error,requestId); }
}
