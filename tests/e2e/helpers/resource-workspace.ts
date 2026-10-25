import { expect, type Locator, type Page } from "@playwright/test";

/** The same report and assertions remain; navigation follows the resource peer host. */
export async function selectResourceReportView(root: Locator, view: "summary" | "tree" | "matrix" | "plan" | "estimate") {
  const group = root.page().getByRole("group", { name: "리소스 분석 보기", exact: true });
  const label = view === "tree" || view === "matrix" ? "Milestone 교차" : view === "plan" ? "Resource Plan" : view === "estimate" ? "견적·Excel" : "기본 현황";
  await group.getByRole("button", { name: label, exact: true }).click();
  if (view === "tree" || view === "matrix") await root.getByLabel("리소스 보기", { exact: true }).selectOption(view);
}

/** Observe activation before navigation; an already active peer keeps its receipt. */
export async function openResourceDynamicView(page: Page, options: {
  navigate?: boolean;
  waitForReady?: boolean;
  readyTimeout?: number;
} = {}) {
  const peer = page.getByRole("group", { name: "리소스 분석 보기", exact: true })
    .getByRole("button", { name: "동적 계층 탐색", exact: true });
  const alreadyActive = await peer.isVisible() && await peer.getAttribute("aria-pressed") === "true";
  const pathname = `/api${new URL(page.url()).pathname}/resource-dashboard/views`;
  const request = alreadyActive ? Promise.resolve(null) : page.waitForRequest(candidate => {
    if (candidate.method() !== "POST" || new URL(candidate.url()).pathname !== pathname) return false;
    const input = candidate.postDataJSON();
    return input.spec?.root === "resource" && input.projection?.kind === "report";
  });
  const activate = async () => {
    if (options.navigate !== false) {
      await page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true })
        .getByRole("tab", { name: "대시보드", exact: true }).click();
      await page.getByRole("tablist", { name: "대시보드 보기", exact: true })
        .getByRole("tab", { name: "리소스", exact: true }).click();
    }
    if (await peer.getAttribute("aria-pressed") !== "true") await peer.click();
  };
  const [, observedRequest] = await Promise.all([activate(), request]);
  const root = page.locator('[data-wbs-view="resource"]').filter({ visible: true });
  await expect(root).toHaveAttribute("data-root", "resource");
  if (options.waitForReady !== false) {
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: options.readyTimeout });
    await expect(root).not.toHaveAttribute("data-report-confirmation-id", "0");
  }
  return { root, request: observedRequest };
}
