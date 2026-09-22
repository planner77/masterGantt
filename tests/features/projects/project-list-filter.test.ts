import { describe, expect, it } from "vitest";

import type { ProjectListItemDto } from "../../../src/contracts/projects";
import {
  EMPTY_PROJECT_FILTER,
  activeProjectFilterCount,
  filterProjectList,
  projectCalendarDate,
  projectMatchesFilter,
  validateProjectFilter,
} from "../../../src/features/projects/project-list-filter";

const projects: ProjectListItemDto[] = [
  {
    publicId: "alpha",
    name: "AMR Rollout",
    description: "Vietnam line",
    ownerName: "Automation Team",
    createdAt: "2026-08-31T15:30:00.000Z",
    updatedAt: "2026-09-15T12:00:00.000Z",
  },
  {
    publicId: "beta",
    name: "Stocker Upgrade",
    description: "MLCC stocker",
    ownerName: null,
    createdAt: "2026-09-30T15:30:00.000Z",
    updatedAt: "2026-10-01T00:30:00.000Z",
  },
];

describe("Issue #84 project list filters", () => {
  it("reuses trim/case-insensitive quick search without searching UI placeholders", () => {
    expect(filterProjectList(projects, { ...EMPTY_PROJECT_FILTER, query: " automation " }, "Asia/Seoul").map((project) => project.publicId)).toEqual(["alpha"]);
    expect(filterProjectList(projects, { ...EMPTY_PROJECT_FILTER, query: "VIETNAM" }, "Asia/Seoul").map((project) => project.publicId)).toEqual(["alpha"]);
    expect(filterProjectList(projects, { ...EMPTY_PROJECT_FILTER, query: "미지정" }, "Asia/Seoul")).toHaveLength(0);
  });

  it("supports project name, owner and description text operators", () => {
    expect(projectMatchesFilter(projects[0], { ...EMPTY_PROJECT_FILTER, nameQuery: "amr rollout", nameOperator: "equals" }, "Asia/Seoul")).toBe(true);
    expect(projectMatchesFilter(projects[0], { ...EMPTY_PROJECT_FILTER, ownerQuery: "team", ownerOperator: "contains" }, "Asia/Seoul")).toBe(true);
    expect(projectMatchesFilter(projects[0], { ...EMPTY_PROJECT_FILTER, descriptionQuery: "stocker", descriptionOperator: "not-contains" }, "Asia/Seoul")).toBe(true);
  });

  it("separates assigned and unassigned owners using canonical data", () => {
    expect(filterProjectList(projects, { ...EMPTY_PROJECT_FILTER, ownerState: "assigned" }, "Asia/Seoul").map((project) => project.publicId)).toEqual(["alpha"]);
    expect(filterProjectList(projects, { ...EMPTY_PROJECT_FILTER, ownerState: "unassigned" }, "Asia/Seoul").map((project) => project.publicId)).toEqual(["beta"]);
  });

  it("converts UTC timestamps to the browser timezone calendar date", () => {
    expect(projectCalendarDate("2026-08-31T15:30:00.000Z", "Asia/Seoul")).toBe("2026-09-01");
    expect(projectCalendarDate("2026-08-31T15:30:00.000Z", "UTC")).toBe("2026-08-31");
  });

  it("supports equals, before, after and inclusive range date operators", () => {
    expect(projectMatchesFilter(projects[0], { ...EMPTY_PROJECT_FILTER, createdOperator: "equals", createdFrom: "2026-09-01" }, "Asia/Seoul")).toBe(true);
    expect(projectMatchesFilter(projects[0], { ...EMPTY_PROJECT_FILTER, updatedOperator: "before", updatedFrom: "2026-09-16" }, "Asia/Seoul")).toBe(true);
    expect(projectMatchesFilter(projects[1], { ...EMPTY_PROJECT_FILTER, updatedOperator: "after", updatedFrom: "2026-09-30" }, "Asia/Seoul")).toBe(true);
    expect(projectMatchesFilter(projects[1], { ...EMPTY_PROJECT_FILTER, createdOperator: "range", createdFrom: "2026-10-01", createdTo: "2026-10-01" }, "Asia/Seoul")).toBe(true);
  });

  it("combines quick search and advanced clauses with AND while preserving source order", () => {
    const result = filterProjectList(projects, {
      ...EMPTY_PROJECT_FILTER,
      query: "line",
      nameQuery: "amr",
      nameOperator: "contains",
      ownerState: "assigned",
    }, "Asia/Seoul");
    expect(result.map((project) => project.publicId)).toEqual(["alpha"]);
  });

  it("applies deletedIds before search results", () => {
    const deleted = new Set(["alpha"]);
    expect(filterProjectList(projects, { ...EMPTY_PROJECT_FILTER, query: "amr" }, "Asia/Seoul", deleted)).toHaveLength(0);
  });

  it("reports invalid date conditions explicitly and counts active clauses", () => {
    const incomplete = { ...EMPTY_PROJECT_FILTER, createdOperator: "range" as const, createdFrom: "2026-09-30" };
    expect(validateProjectFilter(incomplete).created).toContain("종료 날짜");
    const reversed = { ...EMPTY_PROJECT_FILTER, updatedOperator: "range" as const, updatedFrom: "2026-10-02", updatedTo: "2026-10-01" };
    expect(validateProjectFilter(reversed).updated).toContain("늦을 수 없습니다");
    expect(activeProjectFilterCount({ ...EMPTY_PROJECT_FILTER, query: "x", ownerState: "assigned", createdOperator: "equals", createdFrom: "2026-09-01" })).toBe(3);
  });
});
