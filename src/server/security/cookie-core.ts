import { EDIT_SESSION_TTL_SECONDS } from "./session-core";

export function serializeEditSessionCookie(
  rawToken: string,
  applicationUrl: URL,
  environment: string | undefined,
): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    throw new Error("Edit session token has an invalid format.");
  }

  const isProduction = environment === "production";
  const secure = isProduction || applicationUrl.protocol === "https:";
  const name = isProduction
    ? "__Host-mastergantt_edit"
    : "mastergantt_edit";
  const attributes = [
    `${name}=${rawToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${EDIT_SESSION_TTL_SECONDS}`,
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
