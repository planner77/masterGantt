import { randomUUID } from "node:crypto";
import type { LinkMutationResponse } from "../../contracts/projects";
import { SchedulingError } from "../../domain/scheduling";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { isCanonicalUuidV4 } from "./project-contract";
import { EditSessionInvalidError, RevisionMismatchError, type AuthorizationResult, type AuthorizedEditSession } from "./project-service-core";
import { LinkConflictError, LinkNotFoundError, LinkService } from "./link-service-core";
import { parseCreateLinkInput } from "./link-contract";

interface ServiceApi {
 authorize(publicId:string,rawToken:string|undefined):AuthorizationResult;
 create(a:AuthorizedEditSession,r:number,i:{predecessorExternalId:string;successorExternalId:string;type:"FS";lag:0}):LinkMutationResponse;
 delete(a:AuthorizedEditSession,r:number,id:string):LinkMutationResponse;
}
export interface LinkHandlerDependencies {service:ServiceApi|(()=>ServiceApi);applicationBaseUrl:string|undefined;allowInsecureHttp?:string;environment:string|undefined;requestId?:()=>string}
function service(d:LinkHandlerDependencies){return typeof d.service==="function"?d.service():d.service;}
function appUrl(d:LinkHandlerDependencies){try{return parseApplicationBaseUrl(d.applicationBaseUrl,d.environment,d.allowInsecureHttp);}catch(e){if(e instanceof ConfigurationError)throw new PublicApiError(500,"CONFIGURATION_ERROR","The service is not configured correctly.");throw e;}}
function auth(request:Request,publicId:string,s:ServiceApi,d:LinkHandlerDependencies,url:URL){const c=parseEditSessionCookie(request.headers.get("cookie"),d.environment,url),a=s.authorize(publicId,c.state==="present"?c.rawToken:undefined);if(a.kind==="projectNotFound")throw new PublicApiError(404,"PROJECT_NOT_FOUND","Project not found.");if(a.kind==="unauthorized")throw new PublicApiError(401,"EDIT_SESSION_REQUIRED","A valid edit session is required.");return a.authorization;}
function finish(e:unknown,id:string){let x=e;if(e instanceof EditSessionInvalidError)x=new PublicApiError(401,"EDIT_SESSION_REQUIRED","A valid edit session is required.");else if(e instanceof RevisionMismatchError)x=new PublicApiError(412,"REVISION_MISMATCH","Project changed. Reload and retry.");else if(e instanceof LinkNotFoundError)x=new PublicApiError(404,"LINK_NOT_FOUND","Link not found.");else if(e instanceof LinkConflictError)x=new PublicApiError(409,e.code,e.code.replaceAll("_"," ").toLowerCase()+".");else if(e instanceof SchedulingError)x=new PublicApiError(409,e.code,"The dependency graph is invalid.");const r=apiErrorResponse(x,id);r.headers.set("Cache-Control","private, no-store");return r;}
function success(result:LinkMutationResponse,status:200|201){return Response.json(result,{status,headers:{"Cache-Control":"private, no-store",ETag:`"${result.data.project.revision}"`}});}
function requireOrigin(request:Request,url:URL){if(!isExactAllowedOrigin(request.headers.get("origin"),url))throw new PublicApiError(403,"ORIGIN_NOT_ALLOWED","The request origin is not allowed.");}
export async function handleCreateLink(request:Request,publicId:string,d:LinkHandlerDependencies){const id=(d.requestId??randomUUID)();try{const url=appUrl(d);requireOrigin(request,url);const raw=await readBoundedJson(request),parsed=parseCreateLinkInput(raw);if(!parsed.success)throw new PublicApiError(400,"INVALID_REQUEST","The link input is invalid.",parsed.details);const s=service(d),a=auth(request,publicId,s,d,url);return success(s.create(a,parseRequiredIfMatch(request),parsed.data),201);}catch(e){return finish(e,id);}}
export function handleDeleteLink(request:Request,publicId:string,linkId:string,d:LinkHandlerDependencies){const id=(d.requestId??randomUUID)();try{const url=appUrl(d);requireOrigin(request,url);const s=service(d),a=auth(request,publicId,s,d,url);if(!isCanonicalUuidV4(linkId))throw new LinkNotFoundError();return success(s.delete(a,parseRequiredIfMatch(request),linkId),200);}catch(e){return finish(e,id);}}
