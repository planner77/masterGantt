import { MAX_COOKIE_HEADER_BYTES, MAX_COOKIE_PAIRS } from "./cookie-core";

export const PROJECT_MASTER_ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

export function projectMasterAdminCookieName(environment: string | undefined, applicationUrl: URL): string {
  return environment === "production" && applicationUrl.protocol === "https:"
    ? "__Host-mastergantt_project_master_admin"
    : "mastergantt_project_master_admin";
}

function attributes(applicationUrl: URL): string[] {
  const result = ["Path=/", "HttpOnly", "SameSite=Strict"];
  if (applicationUrl.protocol === "https:") result.push("Secure");
  return result;
}

export function serializeProjectMasterAdminCookie(rawToken: string, applicationUrl: URL, environment: string | undefined): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) throw new Error("Invalid project master admin session token.");
  return [
    `${projectMasterAdminCookieName(environment, applicationUrl)}=${rawToken}`,
    `Max-Age=${PROJECT_MASTER_ADMIN_SESSION_TTL_SECONDS}`,
    ...attributes(applicationUrl),
  ].join("; ");
}

export function serializeExpiredProjectMasterAdminCookie(applicationUrl: URL, environment: string | undefined): string {
  return [
    `${projectMasterAdminCookieName(environment, applicationUrl)}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...attributes(applicationUrl),
  ].join("; ");
}

export function parseProjectMasterAdminCookie(header: string | null, environment: string | undefined, applicationUrl: URL): string | undefined {
  if (!header || Buffer.byteLength(header, "utf8") > MAX_COOKIE_HEADER_BYTES) return undefined;
  const pairs = header.split(";");
  if (pairs.length > MAX_COOKIE_PAIRS) return undefined;
  const name = projectMasterAdminCookieName(environment, applicationUrl);
  let token: string | undefined;
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split("=");
    if (rawName !== name) continue;
    if (token !== undefined) return undefined;
    token = rest.join("=");
  }
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
