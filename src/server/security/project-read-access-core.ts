import { getProjectService } from "../projects/project-service";
import { parseEditSessionCookie } from "./cookie-core";
import { parseApplicationBaseUrl } from "./origin-core";

/** The canonical project session is the only private read grant; no new credential or role. */
export function projectSessionFromCookie(cookieHeader: string | null): string | undefined {
  try {
    const applicationUrl = parseApplicationBaseUrl(
      process.env.APP_BASE_URL, process.env.NODE_ENV, process.env.ALLOW_INSECURE_HTTP,
    );
    const cookie = parseEditSessionCookie(cookieHeader, process.env.NODE_ENV, applicationUrl);
    return cookie.state === "present" ? cookie.rawToken : undefined;
  } catch {
    // Misconfigured deployments must not silently unlock private data.
    return undefined;
  }
}

/**
 * Enforced before any project-scoped API handler: GET, read-only POST, exports
 * and mutations. The session issuance/current/revocation endpoints keep their
 * own existing authentication and rate-limit semantics.
 */
export function projectScopedAccessResponse(request: Request, requestId: string): Response | null {
  const path = new URL(request.url).pathname;
  const match = /^\/api\/projects\/([^/]+)(\/.*)?$/.exec(path);
  if (!match) return null;
  if (/^\/edit-sessions(?:\/current)?\/?$/.test(match[2] ?? "")) return null;
  const access = getProjectService().projectReadAccess(match[1], projectSessionFromCookie(request.headers.get("cookie")));
  if (access !== "locked") return null;
  return Response.json({
    error: {
      code: "PROJECT_LOCKED",
      message: "A valid session for this private project is required.",
      details: [],
      requestId,
    },
  }, {
    status: 401,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
