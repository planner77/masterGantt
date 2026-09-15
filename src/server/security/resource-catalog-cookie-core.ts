import { MAX_COOKIE_HEADER_BYTES, MAX_COOKIE_PAIRS } from "./cookie-core";

export const RESOURCE_CATALOG_ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

export function resourceCatalogAdminCookieName(environment: string | undefined, applicationUrl: URL): string {
  return environment === "production" && applicationUrl.protocol === "https:"
    ? "__Host-mastergantt_resource_admin"
    : "mastergantt_resource_admin";
}

function attributes(applicationUrl: URL): string[] {
  const result = ["Path=/", "HttpOnly", "SameSite=Strict"];
  if (applicationUrl.protocol === "https:") result.push("Secure");
  return result;
}

export function serializeResourceCatalogAdminCookie(
  rawToken: string,
  applicationUrl: URL,
  environment: string | undefined,
): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) throw new Error("Invalid resource admin session token.");
  return [
    `${resourceCatalogAdminCookieName(environment, applicationUrl)}=${rawToken}`,
    `Max-Age=${RESOURCE_CATALOG_ADMIN_SESSION_TTL_SECONDS}`,
    ...attributes(applicationUrl),
  ].join("; ");
}

export function serializeExpiredResourceCatalogAdminCookie(
  applicationUrl: URL,
  environment: string | undefined,
): string {
  return [
    `${resourceCatalogAdminCookieName(environment, applicationUrl)}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...attributes(applicationUrl),
  ].join("; ");
}

export function parseResourceCatalogAdminCookie(
  header: string | null,
  environment: string | undefined,
  applicationUrl: URL,
): string | undefined {
  if (!header || Buffer.byteLength(header, "utf8") > MAX_COOKIE_HEADER_BYTES) return undefined;
  const pairs = header.split(";");
  if (pairs.length > MAX_COOKIE_PAIRS) return undefined;
  const name = resourceCatalogAdminCookieName(environment, applicationUrl);
  let token: string | undefined;
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split("=");
    if (rawName !== name) continue;
    if (token !== undefined) return undefined;
    token = rest.join("=");
  }
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
