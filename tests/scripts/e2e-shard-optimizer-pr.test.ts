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
