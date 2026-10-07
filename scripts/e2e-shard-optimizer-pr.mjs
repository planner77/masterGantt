#!/usr/bin/env node
import { spawnSync } from "node:child_process";

export const AUTO_PR_TITLE = "[Issue #437] ci: E2E 샤드 계획 갱신";

export function buildPrListArgs() {
  return [
    "pr",
    "list",
    "--state",
    "open",
    "--search",
    `"${AUTO_PR_TITLE}" in:title`,
    "--json",
    "number,title",
  ];
}

export function selectExistingPrNumber(items) {
  if (!Array.isArray(items)) return "";
  const match = items.find(
    (item) =>
      item &&
      typeof item === "object" &&
      item.title === AUTO_PR_TITLE &&
      Number.isInteger(item.number) &&
      item.number > 0,
  );
  return match ? String(match.number) : "";
}

export function findExistingOptimizerPrNumber() {
  const result = spawnSync("gh", buildPrListArgs(), { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`기존 E2E 샤드 최적화 PR 조회가 실패했습니다. gh pr list exit code: ${result.status}`);
  }

  let items;
  try {
    items = JSON.parse(result.stdout || "[]");
  } catch (error) {
    throw new Error("기존 E2E 샤드 최적화 PR 조회 결과가 유효한 JSON이 아닙니다.", { cause: error });
  }
  return selectExistingPrNumber(items);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${findExistingOptimizerPrNumber()}\n`);
}
