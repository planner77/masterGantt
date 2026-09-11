import { EDIT_SESSION_TTL_SECONDS } from "./session-core";

export const MAX_COOKIE_HEADER_BYTES = 8 * 1_024;
export const MAX_COOKIE_PAIRS = 100;

export type ParsedEditSessionCookie =
  | { state: "absent" }
  | { state: "malformed" }
  | { state: "present"; rawToken: string };

export function editSessionCookieName(environment: string | undefined): string {
  return environment === "production"
    ? "__Host-mastergantt_edit"
    : "mastergantt_edit";
}

function cookieAttributes(
  applicationUrl: URL,
  environment: string | undefined,
): string[] {
  const secure = environment === "production" || applicationUrl.protocol === "https:";
  const attributes = ["Path=/", "HttpOnly", "SameSite=Strict"];
  if (secure) {
    attributes.push("Secure");
  }
  return attributes;
}

export function serializeEditSessionCookie(
  rawToken: string,
  applicationUrl: URL,
  environment: string | undefined,
): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    throw new Error("Edit session token has an invalid format.");
  }

  const name = editSessionCookieName(environment);
  const attributes = [
    `${name}=${rawToken}`,
    ...cookieAttributes(applicationUrl, environment),
  ];

  const secure = attributes.at(-1) === "Secure";
  if (secure) {
    attributes.splice(attributes.length - 1, 0, `Max-Age=${EDIT_SESSION_TTL_SECONDS}`);
  } else {
    attributes.push(`Max-Age=${EDIT_SESSION_TTL_SECONDS}`);
  }

  return attributes.join("; ");
}

export function serializeExpiredEditSessionCookie(
  applicationUrl: URL,
  environment: string | undefined,
): string {
  return [
    `${editSessionCookieName(environment)}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...cookieAttributes(applicationUrl, environment),
  ].join("; ");
}

export function parseEditSessionCookie(
  header: string | null,
  environment: string | undefined,
): ParsedEditSessionCookie {
  if (header === null || header === "") {
    return { state: "absent" };
  }
  if (Buffer.byteLength(header, "utf8") > MAX_COOKIE_HEADER_BYTES) {
    return { state: "malformed" };
  }

  const pairs = header.split(";");
  if (pairs.length > MAX_COOKIE_PAIRS) {
    return { state: "malformed" };
  }

  const targetName = editSessionCookieName(environment);
  let target: string | undefined;
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const separator = trimmed.indexOf("=");
    if (
      separator <= 0 ||
      !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(trimmed.slice(0, separator)) ||
      !/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/.test(trimmed.slice(separator + 1))
    ) {
      return { state: "malformed" };
    }

    if (trimmed.slice(0, separator) !== targetName) {
      continue;
    }
    if (target !== undefined) {
      return { state: "malformed" };
    }
    target = trimmed.slice(separator + 1);
  }

  if (target === undefined) {
    return { state: "absent" };
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(target)) {
    return { state: "malformed" };
  }
  return { state: "present", rawToken: target };
}
