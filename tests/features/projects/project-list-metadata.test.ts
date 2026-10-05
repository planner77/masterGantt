import { describe, expect, it } from "vitest";

import type { ProjectMasterItemDto } from "../../../src/contracts/project-master";
import {
  PROJECT_MASTER_UNASSIGNED_LABEL,
  projectMasterListLabel,
} from "../../../src/features/projects/project-list-metadata";

function item(overrides: Partial<ProjectMasterItemDto> = {}): ProjectMasterItemDto {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    category: "BUSINESS_UNIT",
    code: "BU01",
    name: "물류자동화",
    active: true,
    sortOrder: 10,
    ...overrides,
  };
}

describe("Issue #343 Project List 기준정보 표시", () => {
  it("uses the catalog display name instead of an id or code", () => {
    expect(projectMasterListLabel(item())).toBe("물류자동화");
  });

  it("uses one consistent placeholder for null, undefined, and blank display names", () => {
    expect(projectMasterListLabel(null)).toBe(PROJECT_MASTER_UNASSIGNED_LABEL);
    expect(projectMasterListLabel(undefined)).toBe(PROJECT_MASTER_UNASSIGNED_LABEL);
    expect(projectMasterListLabel(item({ name: "   " }))).toBe(PROJECT_MASTER_UNASSIGNED_LABEL);
  });

  it("preserves inactive selections with an explicit non-color semantic", () => {
    expect(projectMasterListLabel(item({ name: "기존 사업부", active: false }))).toBe("기존 사업부 (비활성)");
  });

  it("does not shorten long catalog labels in domain mapping", () => {
    const longName = "글로벌 물류자동화 및 스마트팩토리 통합 사업부";
    expect(projectMasterListLabel(item({ name: longName }))).toBe(longName);
  });
});
