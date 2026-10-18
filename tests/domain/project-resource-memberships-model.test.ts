import { describe, expect, it } from "vitest";
import { emptyMembershipFilters, membershipError, membershipQuery } from "../../src/features/resources/project-resource-memberships-model";

describe("project resource membership UI transport", () => {
  it("keeps catalog discovery separate and limits each request to 50 people", () => {
    const query = new URLSearchParams(membershipQuery("catalog", { ...emptyMembershipFilters, q: "  김 이름  ", usage: "roleOnly", active: "false", groupId: "group-id" }, 50));
    expect(Object.fromEntries(query)).toEqual({ scope: "catalog", offset: "50", limit: "50", q: "김 이름", usage: "roleOnly", active: "false", groupId: "group-id" });
    expect(new URLSearchParams(membershipQuery("project", emptyMembershipFilters, 0)).has("usage")).toBe(false);
  });
  it("explains stale data, session expiration and server usage protection separately", () => {
    expect(membershipError(412)).toContain("최신 목록");
    expect(membershipError(401)).toContain("편집 세션");
    expect(membershipError(403)).toContain("권한");
    expect(membershipError(409, "PROJECT_RESOURCE_IN_USE")).toContain("먼저 정리");
    expect(membershipError(409, "RESOURCE_INACTIVE")).toContain("비활성");
    expect(membershipError(500)).toContain("다시 불러온");
  });
});
