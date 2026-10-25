import { type Locator } from "@playwright/test";

/** The same report and assertions remain; navigation follows the resource peer host. */
export async function selectResourceReportView(root: Locator, view: "summary" | "tree" | "matrix" | "plan" | "estimate") {
  const group = root.page().getByRole("group", { name: "리소스 분석 보기", exact: true });
  const label = view === "tree" || view === "matrix" ? "Milestone 교차" : view === "plan" ? "Resource Plan" : view === "estimate" ? "견적·Excel" : "기본 현황";
  await group.getByRole("button", { name: label, exact: true }).click();
  if (view === "tree" || view === "matrix") await root.getByLabel("리소스 보기", { exact: true }).selectOption(view);
}
