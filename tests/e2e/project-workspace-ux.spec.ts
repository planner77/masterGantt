import { expect, test, type Frame, type Request } from "@playwright/test";
import { expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

test.describe("Issue #76 Project Workspace UX", () => {
  test("compact context와 일정/리소스 peer view가 Gantt 상태를 보존한다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installStatefulProjectFixture(page);

    const documentRequests: string[] = [];
    const navigations: string[] = [];
    const mutations: string[] = [];
    const recordRequest = (request: Request) => {
      if (request.resourceType() === "document") documentRequests.push(request.url());
      if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.url());
    };
    const recordNavigation = (frame: Frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    };
    page.on("request", recordRequest);
    page.on("framenavigated", recordNavigation);

    await page.goto(`/projects/${publicId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Issue 3 stable Gantt fixture" })).toBeVisible();
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
    const headerBox = await page.locator(".header-content").boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.width).toBeGreaterThan(1200);
    await expect(page.getByText("Stateful canonical snapshot fixture", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "프로젝트 정보 보기", exact: true }).click();
    await expect(page.getByText("Stateful canonical snapshot fixture", { exact: true })).toBeVisible();
    await expect(page.getByText("Revision", { exact: true })).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
    const scheduleTab = tabs.getByRole("tab", { name: "일정", exact: true });
    const resourcesTab = tabs.getByRole("tab", { name: "리소스", exact: true });
    await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
    await expect(resourcesTab).toHaveAttribute("aria-selected", "false");

    const identity = await rememberGanttRoot(page);
    const chart = page.locator(".project-gantt-widget .wx-chart").first();
    await chart.evaluate((element) => { element.scrollLeft = 160; });
    const scrollLeft = await chart.evaluate((element) => element.scrollLeft);

    await scheduleTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(resourcesTab).toBeFocused();
    await expect(resourcesTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { level: 2, name: "리소스 공수" })).toBeVisible();
    await expect(page.getByText("개발팀", { exact: true })).toBeVisible();
    await expect(page.getByText("테스트 리소스 (R-01)", { exact: true })).toBeVisible();
    await expect(page.getByText("5.00 M/D", { exact: true }).first()).toBeVisible();

    await page.keyboard.press("Home");
    await expect(scheduleTab).toBeFocused();
    await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
    await expectSameGanttRoot(page, identity);
    expect(await chart.evaluate((element) => element.scrollLeft)).toBeCloseTo(scrollLeft, 0);

    await page.keyboard.press("End");
    await expect(resourcesTab).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(scheduleTab).toBeFocused();
    await expectSameGanttRoot(page, identity);

    expect(documentRequests.filter((url) => url.includes(`/projects/${publicId}`))).toHaveLength(1);
    expect(navigations.filter((url) => url.includes(`/projects/${publicId}`))).toHaveLength(1);
    expect(mutations).toEqual([]);

    page.off("request", recordRequest);
    page.off("framenavigated", recordNavigation);
  });

  for (const width of [390, 768, 1024, 1440, 1920]) {
    test(`${width}px에서 document horizontal overflow가 없다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installStatefulProjectFixture(page);
      await page.goto(`/projects/${publicId}`);
      await expect(page.getByRole("heading", { level: 1, name: "Issue 3 stable Gantt fixture" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    });
  }
});
