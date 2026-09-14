import { describe, expect, it } from "vitest";

import {
  MAX_COOKIE_HEADER_BYTES,
  parseEditSessionCookie,
  serializeExpiredEditSessionCookie,
} from "../../../src/server/security/cookie-core";
import {
  hashEditPassword,
  PasswordHashCapacityError,
  verifyEditPassword,
} from "../../../src/server/security/password-core";
import { FixedWindowRateLimiter } from "../../../src/server/security/rate-limit-core";
import { parseRequiredIfMatch } from "../../../src/server/http/request-core";
import {
  parseChangeEditPasswordInput,
  parseUnlockProjectInput,
  parseUpdateProjectInput,
} from "../../../src/server/projects/project-contract";

describe("W05 strict inputs and If-Match", () => {
  it("allows short login candidates but rejects malformed/oversized credentials", () => {
    expect(parseUnlockProjectInput({ editPassword: "" }).success).toBe(true);
    expect(parseUnlockProjectInput({ editPassword: "short" }).success).toBe(true);
    expect(parseUnlockProjectInput({ editPassword: "😀".repeat(257) }).success).toBe(false);
    expect(parseUnlockProjectInput({ editPassword: "\ud800" }).success).toBe(false);
    expect(parseUnlockProjectInput({ editPassword: "valid", extra: true }).success).toBe(false);
  });

  it("accepts only a non-empty strict metadata patch and preserves description", () => {
    expect(parseUpdateProjectInput({ name: "  Renamed  " })).toEqual({
      success: true,
      data: { name: "Renamed" },
    });
    expect(parseUpdateProjectInput({ description: "  preserved\n" })).toEqual({
      success: true,
      data: { description: "  preserved\n" },
    });
    for (const value of [{}, { name: null }, { description: null }, { name: "ok", x: 1 }]) {
      expect(parseUpdateProjectInput(value).success).toBe(false);
    }
  });

  it("applies the creation password policy to rotation", () => {
    expect(parseChangeEditPasswordInput({ newEditPassword: "123456789012" }).success).toBe(true);
    expect(parseChangeEditPasswordInput({ newEditPassword: "short" }).success).toBe(false);
    expect(parseChangeEditPasswordInput({ newEditPassword: "123456789012", editPassword: "x" }).success).toBe(false);
  });

  it("accepts exactly one strong positive safe revision ETag", () => {
    expect(parseRequiredIfMatch(new Request("http://local", { headers: { "If-Match": '"12"' } }))).toBe(12);
    expect(() => parseRequiredIfMatch(new Request("http://local"))).toThrowError(expect.objectContaining({ status: 428 }));
    for (const value of ["12", 'W/"12"', '"0"', "*", '"1", "2"', '"9007199254740992"']) {
      expect(() => parseRequiredIfMatch(new Request("http://local", { headers: { "If-Match": value } })))
        .toThrowError(expect.objectContaining({ status: 400 }));
    }
  });
});

describe("W05 cookie boundary", () => {
  const token = "A".repeat(43);

  it("selects the environment-specific cookie without accepting duplicates", () => {
    expect(parseEditSessionCookie(`other=1; __Host-mastergantt_edit=${token}`, "production", new URL("https://gantt.example.com")))
      .toEqual({ state: "present", rawToken: token });
    expect(parseEditSessionCookie(`mastergantt_edit=${token}`, "production", new URL("https://gantt.example.com")))
      .toEqual({ state: "absent" });
    expect(parseEditSessionCookie(
      `__Host-mastergantt_edit=${token}; __Host-mastergantt_edit=${token}`,
      "production", new URL("https://gantt.example.com"),
    )).toEqual({ state: "malformed" });
  });

  it("fails closed for malformed tokens, syntax, pair count, and byte size", () => {
    expect(parseEditSessionCookie("__Host-mastergantt_edit=short", "production", new URL("https://gantt.example.com")))
      .toEqual({ state: "malformed" });
    expect(parseEditSessionCookie("broken", "production", new URL("https://gantt.example.com")))
      .toEqual({ state: "malformed" });
    expect(parseEditSessionCookie(
      Array.from({ length: 101 }, (_, index) => `c${index}=x`).join(";"),
      "production", new URL("https://gantt.example.com"),
    )).toEqual({ state: "malformed" });
    expect(parseEditSessionCookie(`x=${"a".repeat(MAX_COOKIE_HEADER_BYTES)}`, "production", new URL("https://gantt.example.com")))
      .toEqual({ state: "malformed" });
  });

  it("uses matching hardened attributes when expiring the cookie", () => {
    const expired = serializeExpiredEditSessionCookie(
      new URL("https://gantt.example.com"),
      "production",
    );
    expect(expired).toContain("__Host-mastergantt_edit=");
    expect(expired).toContain("Path=/");
    expect(expired).toContain("HttpOnly");
    expect(expired).toContain("SameSite=Strict");
    expect(expired).toContain("Secure");
    expect(expired).toContain("Max-Age=0");
    expect(expired).not.toContain("Domain=");
  });
});

describe("W05 password verification and bounded rate limiting", () => {
  it("derives and compares correct/wrong passwords and fails closed on corrupt records", async () => {
    const record = await hashEditPassword("correct password phrase");
    await expect(verifyEditPassword("correct password phrase", record)).resolves.toBe(true);
    await expect(verifyEditPassword("wrong password phrase", record)).resolves.toBe(false);
    await expect(verifyEditPassword("anything", { ...record, n: 2 })).resolves.toBe(false);
    await expect(verifyEditPassword("anything", undefined)).resolves.toBe(false);
  });

  it("shares the two-operation KDF capacity across password verification", async () => {
    const record = await hashEditPassword("correct password phrase");
    const first = verifyEditPassword("wrong one", record);
    const second = verifyEditPassword("wrong two", record);
    await expect(verifyEditPassword("wrong three", record)).rejects
      .toBeInstanceOf(PasswordHashCapacityError);
    await expect(Promise.all([first, second])).resolves.toEqual([false, false]);
  });

  it("fails closed instead of growing past the tracked-key bound", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000, 2);
    expect(limiter.consume("a", 0).allowed).toBe(true);
    expect(limiter.consume("b", 0).allowed).toBe(true);
    expect(limiter.consume("c", 1)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume("c", 1_000).allowed).toBe(true);
  });
});
