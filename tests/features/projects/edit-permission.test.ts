import { describe, expect, it } from "vitest";

import { parseCurrentEditPermission } from "../../../src/features/projects/edit-permission";

const now = Date.parse("2026-09-15T02:00:00.000Z");

describe("parseCurrentEditPermission", () => {
  it("accepts a well-formed unexpired edit grant", () => {
    expect(parseCurrentEditPermission({
      data: { permission: "edit", expiresAt: "2026-09-15T03:00:00.000Z" },
    }, now)).toEqual({ permission: "edit", valid: true });
  });

  it("accepts an explicit readonly response", () => {
    expect(parseCurrentEditPermission({ data: { permission: "readonly" } }, now))
      .toEqual({ permission: "readonly", valid: true });
  });

  it.each([
    null,
    {},
    { data: null },
    { data: {} },
    { data: { permission: "edit" } },
    { data: { permission: "edit", expiresAt: "not-a-date" } },
    { data: { permission: "admin", expiresAt: "2026-09-15T03:00:00.000Z" } },
  ])("fails closed for malformed payload %#", (payload) => {
    expect(parseCurrentEditPermission(payload, now))
      .toEqual({ permission: "readonly", valid: false });
  });

  it("fails closed at and after the exact expiry boundary", () => {
    const payload = { data: { permission: "edit", expiresAt: "2026-09-15T02:00:00.000Z" } };
    expect(parseCurrentEditPermission(payload, now))
      .toEqual({ permission: "readonly", valid: false });
    expect(parseCurrentEditPermission(payload, now + 1))
      .toEqual({ permission: "readonly", valid: false });
  });
});
