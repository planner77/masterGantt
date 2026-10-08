import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTO_PR_TITLE,
  buildPrListArgs,
  selectExistingPrNumber,
} from "../../scripts/e2e-shard-optimizer-pr.mjs";

describe("E2E shard optimizer PR lookup", () => {
  it("passes the quoted title search as one GitHub CLI argument", () => {
    expect(buildPrListArgs()).toEqual([
      "pr",
      "list",
      "--state",
      "open",
      "--search",
      `"${AUTO_PR_TITLE}" in:title`,
      "--json",
      "number,title",
    ]);
  });

  it("accepts only the exact automatic PR title", () => {
    expect(
      selectExistingPrNumber([
        { number: 101, title: `${AUTO_PR_TITLE} 후속` },
        { number: 102, title: AUTO_PR_TITLE },
        { number: 103, title: `prefix ${AUTO_PR_TITLE}` },
      ]),
    ).toBe("102");
  });

  it("returns empty when no exact automatic PR is open", () => {
    expect(
      selectExistingPrNumber([
        { number: 101, title: `${AUTO_PR_TITLE} 후속` },
        { number: 103, title: "[Issue #437] ci: 다른 제목" },
      ]),
    ).toBe("");
  });
});

describe("E2E optimizer PR creation failure recovery", () => {
  const workflow = readFileSync(".github/workflows/e2e-shard-optimizer.yml", "utf8");
  const createStep = workflow.split("      - name: 샤드 계획 자동 PR 생성")[1];

  it("records permission denial with the preserved branch and manual PR link", () => {
    expect(createStep).toContain('pr_error_file="$RUNNER_TEMP/e2e-shard-create-pr.stderr"');
    expect(createStep).toContain("GitHub Actions is not permitted to create or approve pull requests");
    expect(createStep).toContain("compare/main...$branch_name?expand=1");
    expect(createStep).toContain('echo "### E2E 샤드 자동 PR 생성 실패 (BLOCKED)"');
    expect(createStep).toContain('>> "$GITHUB_STEP_SUMMARY"');
  });

  it("fails closed and dispatches CI only after a PR was created", () => {
    expect(createStep).toMatch(/if ! pr_url="\$\(gh pr create/);
    expect(createStep).toMatch(/cat "\$pr_error_file" >&2\s+exit 1\s+fi/);
    expect(createStep?.indexOf("exit 1")).toBeLessThan(createStep?.indexOf("ci.yml/dispatches"));
  });
});
