import { parseEditSessionCookie } from "./cookie-core";
import { parseApplicationBaseUrl } from "./origin-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";

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

/** Canonicalize the route parameter exactly once (Next route params are decoded). */
export function decodeProjectRoutePublicId(segment: string): string | null {
  try {
    const publicId = decodeURIComponent(segment);
    return isCanonicalUuidV4(publicId) ? publicId : null;
  } catch { return null; }
}

/**
 * Enforced before any project-scoped API handler: GET, read-only POST, exports
 * and mutations. The session issuance/current/revocation endpoints keep their
 * own existing authentication and rate-limit semantics.
 */
export async function projectScopedAccessResponse(request: Request, requestId: string): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const match = /^\/api\/projects\/([^/]+)(\/.*)?$/.exec(path);
  if (!match) return null;
  if (/^\/edit-sessions(?:\/current)?\/?$/.test(match[2] ?? "")) return null;
  // Do not delegate malformed/ambiguous project IDs to handlers with a different decoding policy.
  const publicId = decodeProjectRoutePublicId(match[1]);
  if (publicId === null) {
    return Response.json({ error: { code: "PROJECT_NOT_FOUND", message: "Project not found.", details: [], requestId } },
      { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  const { getProjectService } = await import("../projects/project-service");
  const access = getProjectService().projectReadAccess(publicId, projectSessionFromCookie(request.headers.get("cookie")));
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
