import { parseApplicationBaseUrl } from "../security/origin-core";

const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Build a public link from trusted deployment configuration, never request headers. */
export function buildProjectShareUrl(
  applicationBaseUrl: string | undefined,
  environment: string | undefined,
  publicId: string,
): string | null {
  if (!PUBLIC_ID_PATTERN.test(publicId)) return null;
  try {
    const base = parseApplicationBaseUrl(applicationBaseUrl, environment);
    return new URL(`/projects/${encodeURIComponent(publicId)}`, base).href;
  } catch {
    // A missing/invalid deployment URL must not produce a misleading share link.
    return null;
  }
}
