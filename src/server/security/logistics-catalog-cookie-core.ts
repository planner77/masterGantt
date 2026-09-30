import { MAX_COOKIE_HEADER_BYTES, MAX_COOKIE_PAIRS } from "./cookie-core";

export const LOGISTICS_CATALOG_ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

export function logisticsCatalogAdminCookieName(environment:string|undefined, applicationUrl:URL):string {
  return environment==="production" && applicationUrl.protocol==="https:"
    ? "__Host-mastergantt_logistics_admin"
    : "mastergantt_logistics_admin";
}
function attributes(applicationUrl:URL):string[]{const result=["Path=/","HttpOnly","SameSite=Strict"];if(applicationUrl.protocol==="https:")result.push("Secure");return result;}
export function serializeLogisticsCatalogAdminCookie(rawToken:string,applicationUrl:URL,environment:string|undefined):string{
  if(!/^[A-Za-z0-9_-]{43}$/.test(rawToken))throw new Error("Invalid logistics admin session token.");
  return [`${logisticsCatalogAdminCookieName(environment,applicationUrl)}=${rawToken}`,`Max-Age=${LOGISTICS_CATALOG_ADMIN_SESSION_TTL_SECONDS}`,...attributes(applicationUrl)].join("; ");
}
export function serializeExpiredLogisticsCatalogAdminCookie(applicationUrl:URL,environment:string|undefined):string{
  return [`${logisticsCatalogAdminCookieName(environment,applicationUrl)}=`,"Max-Age=0","Expires=Thu, 01 Jan 1970 00:00:00 GMT",...attributes(applicationUrl)].join("; ");
}
export function parseLogisticsCatalogAdminCookie(header:string|null,environment:string|undefined,applicationUrl:URL):string|undefined{
  if(!header||Buffer.byteLength(header,"utf8")>MAX_COOKIE_HEADER_BYTES)return undefined;
  const pairs=header.split(";");if(pairs.length>MAX_COOKIE_PAIRS)return undefined;
  const name=logisticsCatalogAdminCookieName(environment,applicationUrl);let token:string|undefined;
  for(const pair of pairs){const [rawName,...rest]=pair.trim().split("=");if(rawName!==name)continue;if(token!==undefined)return undefined;token=rest.join("=");}
  return token&&/^[A-Za-z0-9_-]{43}$/.test(token)?token:undefined;
}
