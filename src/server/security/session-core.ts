import { createHash, randomBytes } from "node:crypto";

export const EDIT_SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface NewSessionToken {
  rawToken: string;
  tokenHash: Buffer;
}

export function hashSessionToken(rawToken: string): Buffer {
  return createHash("sha256").update(rawToken, "utf8").digest();
}

export function createSessionToken(): NewSessionToken {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, tokenHash: hashSessionToken(rawToken) };
}

export function sessionExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + EDIT_SESSION_TTL_SECONDS * 1_000);
}
