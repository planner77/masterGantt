import { type Page } from "@playwright/test";

type View = "schedule" | "milestones" | "resources" | "logistics" | "kpi" | "processes" | "equipment" | "systems" | "unified" | "targets" | "relations" | "resource-master";
const destinations: Record<View, readonly [string, string?]> = {
  schedule: ["일정"], milestones: ["대시보드", "Milestone"], resources: ["대시보드", "리소스"],
  logistics: ["기준정보", "공정&WorkArea"], processes: ["기준정보", "공정&WorkArea"],
  equipment: ["기준정보", "설비"], systems: ["기준정보", "물류 시스템"],
  kpi: ["대시보드", "KPI"], unified: ["대시보드", "공정&WorkArea"],
  targets: ["기준정보"], relations: ["기준정보"], "resource-master": ["기준정보", "리소스"],
};
/** Follow the same two-level navigation as a user; ordinary schedule return preserves scope. */
export async function openWorkspaceView(page: Page, view: View) {
  const [section, label] = destinations[view];
  await page.getByRole("tablist", { name: "프로젝트 작업공간" }).getByRole("tab", { name: section, exact: true }).click();
  if (label) await page.getByRole("tablist", { name: `${section} 보기` }).getByRole("tab", { name: label, exact: true }).click();
  if (view === "targets" || view === "relations") await page.getByRole("button", { name: view === "targets" ? "Target 관리" : "제어·조율 관계", exact: true }).click();
}
export function workspaceViewTab(page: Page, view: "milestones" | "resources" | "logistics") {
  const [section, label] = destinations[view];
  return page.getByRole("tablist", { name: `${section} 보기` }).getByRole("tab", { name: label!, exact: true });
}
