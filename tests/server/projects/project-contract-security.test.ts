import { describe, expect, it } from "vitest";

import { readBoundedJson } from "../../../src/server/http/request-core";
import {
  isCanonicalUuidV4,
  parseCreateProjectInput,
} from "../../../src/server/projects/project-contract";
import { serializeEditSessionCookie } from "../../../src/server/security/cookie-core";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "../../../src/server/security/origin-core";
import {
  AsyncCapacityLimiter,
  hashEditPassword,
  PasswordHashCapacityError,
  SCRYPT_PARAMETERS,
} from "../../../src/server/security/password-core";
import { FixedWindowRateLimiter } from "../../../src/server/security/rate-limit-core";
import {
  createSessionToken,
  EDIT_SESSION_TTL_SECONDS,
  hashSessionToken,
  sessionExpiry,
} from "../../../src/server/security/session-core";

describe("project input contract", () => {
  it("trims project name and owner while preserving description and password", () => {
    const password = "  열두글자 암호 문구  ";
    const result = parseCreateProjectInput({
      name: "  설비 확장  ",
      ownerName: "  생산기술팀 이대리  ",
      description: "  설명은 보존됩니다.\n",
      editPassword: password,
    });

    expect(result).toEqual({
      success: true,
      data: {
        name: "설비 확장",
        ownerName: "생산기술팀 이대리",
        description: "  설명은 보존됩니다.\n",
        editPassword: password,
      },
    });
  });

  it("counts Unicode code points and enforces each boundary", () => {
    const valid = parseCreateProjectInput({
      name: "😀".repeat(200),
      ownerName: "😀".repeat(100),
      description: "한".repeat(4_000),
      editPassword: "😀".repeat(12),
    });
    expect(valid.success).toBe(true);

    for (const invalid of [
      { name: " ", ownerName: "Owner", description: "", editPassword: "123456789012" },
      { name: "n".repeat(201), ownerName: "Owner", description: "", editPassword: "123456789012" },
      { name: "Valid", ownerName: " ", description: "", editPassword: "123456789012" },
      { name: "Valid", ownerName: "o".repeat(101), description: "", editPassword: "123456789012" },
      { name: "Valid", ownerName: "Owner", description: "d".repeat(4_001), editPassword: "123456789012" },
      { name: "Valid", ownerName: "Owner", description: "", editPassword: "short" },
      { name: "Valid", ownerName: "Owner", description: "", editPassword: "😀".repeat(257) },
      { name: "Valid", description: "", editPassword: "123456789012" },
    ]) {
      expect(parseCreateProjectInput(invalid).success).toBe(false);
    }
  });

  it("rejects unknown, null, mistyped, and malformed Unicode values", () => {
    const cases: unknown[] = [
      null,
      { name: "Valid", ownerName: "Owner", description: "", editPassword: "123456789012", extra: true },
      { name: null, ownerName: "Owner", description: "", editPassword: "123456789012" },
      { name: 42, ownerName: "Owner", description: "", editPassword: "123456789012" },
      { name: "Valid", ownerName: 42, description: "", editPassword: "123456789012" },
      { name: "\ud800", ownerName: "Owner", description: "", editPassword: "123456789012" },
      { name: "Valid", ownerName: "\ud800", description: "", editPassword: "123456789012" },
      { name: "Valid", ownerName: "Owner", description: "\udc00", editPassword: "123456789012" },
      { name: "Valid", ownerName: "Owner", description: "", editPassword: "12345678901\ud800" },
    ];

    for (const value of cases) {
      expect(parseCreateProjectInput(value).success).toBe(false);
    }
  });

  it("accepts only canonical lowercase UUID v4 identifiers", () => {
    expect(isCanonicalUuidV4("2fd0c93f-cd37-4b68-9f09-412239d99c79")).toBe(true);
    expect(isCanonicalUuidV4("2FD0C93F-CD37-4B68-9F09-412239D99C79")).toBe(false);
    expect(isCanonicalUuidV4("2fd0c93f-cd37-5b68-9f09-412239d99c79")).toBe(false);
    expect(isCanonicalUuidV4("not-a-uuid")).toBe(false);
  });
});

describe("request and origin boundaries", () => {
  it("accepts only canonical application origins", () => {
    const app = parseApplicationBaseUrl("https://gantt.example.com", "production");
    expect(app.origin).toBe("https://gantt.example.com");
    expect(isExactAllowedOrigin("https://gantt.example.com", app)).toBe(true);

    for (const origin of [
      null,
      "null",
      "https://gantt.example.com/",
      "https://gantt.example.com.evil.test",
      "http://gantt.example.com",
      "https://gantt.example.com, https://evil.example.com",
      " https://gantt.example.com",
    ]) {
      expect(isExactAllowedOrigin(origin, app)).toBe(false);
    }
  });

  it("rejects invalid or insecure production application URLs", () => {
    for (const value of [
      undefined,
      "http://gantt.example.com",
      "https://user@gantt.example.com",
      "https://gantt.example.com/",
      "https://gantt.example.com/path",
      "https://gantt.example.com?query=1",
    ]) {
      expect(() => parseApplicationBaseUrl(value, "production")).toThrow(
        ConfigurationError,
      );
    }
    expect(parseApplicationBaseUrl("http://127.0.0.1:3000", "development").origin)
      .toBe("http://127.0.0.1:3000");
  });

  it("parses UTF-8 JSON and rejects media type, encoding, declared, and actual size violations", async () => {
    await expect(
      readBoundedJson(
        new Request("http://local", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({ value: "한글" }),
        }),
      ),
    ).resolves.toEqual({ value: "한글" });

    await expect(
      readBoundedJson(
        new Request("http://local", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });

    await expect(
      readBoundedJson(
        new Request("http://local", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
          },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 415 });

    await expect(
      readBoundedJson(
        new Request("http://local", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": "32769",
          },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 413, code: "REQUEST_TOO_LARGE" });

    await expect(
      readBoundedJson(
        new Request("http://local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: new Uint8Array(32 * 1_024 + 1),
        }),
      ),
    ).rejects.toMatchObject({ status: 413, code: "REQUEST_TOO_LARGE" });

    await expect(
      readBoundedJson(
        new Request("http://local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: new Uint8Array([0xc3, 0x28]),
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_JSON" });
  });
});

describe("create abuse and credential material", () => {
  it("enforces a deterministic fixed-window rate limit", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);
    expect(limiter.consume("key", 1_000).allowed).toBe(true);
    expect(limiter.consume("key", 1_100).allowed).toBe(true);
    expect(limiter.consume("key", 1_200)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(limiter.consume("key", 2_000).allowed).toBe(true);
  });

  it("rejects work beyond the KDF concurrency bound", async () => {
    const limiter = new AsyncCapacityLimiter(1);
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = limiter.run(() => blocker);

    await expect(limiter.run(async () => undefined)).rejects.toBeInstanceOf(
      PasswordHashCapacityError,
    );
    release();
    await first;
    await expect(limiter.run(async () => "done")).resolves.toBe("done");
  });

  it("uses independent salts and the recorded scrypt profile", async () => {
    const [first, second] = await Promise.all([
      hashEditPassword("Same123456!"),
      hashEditPassword("Same123456!"),
    ]);
    expect(first).toMatchObject({ algorithm: "scrypt", n: SCRYPT_PARAMETERS.n, r: SCRYPT_PARAMETERS.r, p: SCRYPT_PARAMETERS.p, keyLength: 32 });
    expect(first.salt).toHaveLength(16);
    expect(first.hash).toHaveLength(32);
    expect(first.salt.equals(second.salt)).toBe(false);
    expect(first.hash.equals(second.hash)).toBe(false);
  });

  it("creates a 256-bit token, stores a digest, and expires it after eight hours", () => {
    const session = createSessionToken();
    expect(session.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.tokenHash).toHaveLength(32);
    expect(session.tokenHash.equals(Buffer.from(session.rawToken))).toBe(false);
    expect(session.tokenHash.equals(hashSessionToken(session.rawToken))).toBe(true);
    expect(EDIT_SESSION_TTL_SECONDS).toBe(28_800);
    expect(sessionExpiry(new Date("2026-09-11T00:00:00.000Z")).toISOString())
      .toBe("2026-09-11T08:00:00.000Z");
  });

  it("serializes production and development cookie policies", () => {
    const rawToken = "A".repeat(43);
    const production = serializeEditSessionCookie(rawToken, new URL("https://gantt.example.com"), "production");
    expect(production).toBe(`__Host-mastergantt_edit=${rawToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure`);
    expect(production).not.toContain("Domain=");
    expect(serializeEditSessionCookie(rawToken, new URL("http://127.0.0.1:3000"), "development")).not.toContain("Secure");
    expect(serializeEditSessionCookie(rawToken, new URL("https://dev.example.com"), "development")).toContain("; Secure");
    expect(() => serializeEditSessionCookie("invalid;token", new URL("https://gantt.example.com"), "production")).toThrow(/invalid format/);
  });
});
