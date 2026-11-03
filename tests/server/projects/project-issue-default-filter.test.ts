import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveProjectIssueDefaultStatusFilter } from "../../../src/server/projects/project-issue-default-filter-core";

describe("Issue #867 운영환경의 UI 기본 상태 필터", () => {
  it("defaults to all when missing, empty or whitespace", () => {
    for (const input of [undefined, "", " ", "\t \n"]) {
      expect(resolveProjectIssueDefaultStatusFilter(input)).toEqual({ status: "all", invalid: false });
    }
  });

  it("accepts all five existing status filter codes and outer whitespace", () => {
    for (const code of ["all", "open", "registered", "in_progress", "completed"] as const) {
      expect(resolveProjectIssueDefaultStatusFilter(code)).toEqual({ status: code, invalid: false });
      expect(resolveProjectIssueDefaultStatusFilter(" " + code + " ")).toEqual({ status: code, invalid: false });
    }
  });

  it("falls back to all and never exposes an invalid value", () => {
    for (const input of ["OPEN", "deleted", "completed,open", "all<script>", "token=private-value"]) {
      const result = resolveProjectIssueDefaultStatusFilter(input);
      expect(result).toEqual({ status: "all", invalid: true });
      expect(JSON.stringify(result)).not.toContain(input);
    }
  });

  it("passes the optional Compose variable through to the running app", () => {
    const compose = readFileSync(new URL("../../../deploy/compose.yml", import.meta.url), "utf8");
    const example = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
    expect(compose).toContain('PROJECT_ISSUE_DEFAULT_STATUS_FILTER: "${PROJECT_ISSUE_DEFAULT_STATUS_FILTER:-}"');
    expect(example).toContain("# PROJECT_ISSUE_DEFAULT_STATUS_FILTER=open");
    expect(compose).not.toContain("NEXT_PUBLIC_PROJECT_ISSUE_DEFAULT_STATUS_FILTER");
  });
}
