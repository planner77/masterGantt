import { describe, expect, it } from "vitest";
import { filterGroups, filterResources } from "../../../src/features/resources/resource-search-filter";
import type { ResourceDto, ResourceGroupDto } from "../../../src/contracts/resources";

describe("resource-search-filter", () => {
  const sampleResources: ResourceDto[] = [
    { id: "r1", name: "홍길동", code: "ENG-01", description: "", active: true },
    { id: "r2", name: "이순신", code: "ENG-02", description: "", active: false },
    { id: "r3", name: "강감찬", code: null, description: "", active: true },
  ];

  const sampleGroups: ResourceGroupDto[] = [
    { id: "g1", name: "개발팀", code: "DEV", description: "", active: true, memberResourceIds: ["r1", "r2"] },
    { id: "g2", name: "디자인팀", code: "DSGN", description: "", active: false, memberResourceIds: [] },
    { id: "g3", name: "기획팀", code: null, description: "", active: true, memberResourceIds: ["r3"] },
  ];

  describe("filterResources", () => {
    it("빈 검색어는 전체 리소스를 반환한다", () => {
      expect(filterResources(sampleResources, "")).toHaveLength(3);
      expect(filterResources(sampleResources, "   ")).toHaveLength(3);
    });

    it("이름으로 검색된다 (대소문자 무시)", () => {
      const result = filterResources(sampleResources, "길동");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("r1");
    });

    it("코드로 검색된다 (대소문자 무시)", () => {
      const result = filterResources(sampleResources, "eng-02");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("r2");
    });

    it("코드 null인 항목도 안전하게 검색된다", () => {
      const result = filterResources(sampleResources, "감찬");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("r3");
    });

    it("일치하는 항목이 없을 때 빈 배열을 반환한다", () => {
      expect(filterResources(sampleResources, "없는이름")).toHaveLength(0);
    });
  });

  describe("filterGroups", () => {
    it("빈 검색어는 전체 그룹을 반환한다", () => {
      expect(filterGroups(sampleGroups, "")).toHaveLength(3);
    });

    it("이름으로 검색된다", () => {
      const result = filterGroups(sampleGroups, "개발");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("g1");
    });

    it("코드로 검색된다", () => {
      const result = filterGroups(sampleGroups, "dsgn");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("g2");
    });

    it("코드 null인 항목도 안전하게 검색된다", () => {
      const result = filterGroups(sampleGroups, "기획");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("g3");
    });
  });
});
