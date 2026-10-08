import { expect, test } from "@playwright/test";
import { dashboardFixture } from "../fixtures/milestone-dashboard";
import { installStatefulProjectFixture, projectPath, publicId } from "../fixtures/stateful-project";

test("#518 일정·Milestone 상위 탭, dialog origin, Gantt 측정/상태와 5폭 tab geometry", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = false;
  let writes = 0;
  page.on("request", (request) => {
    if (request.url().includes(projectPath) && !["GET", "HEAD"].includes(request.method())) writes++;
  });
  await page.route(`**${projectPath}/milestone-dashboard?*`, (route) =>
    route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));

  await page.goto(`/projects/${publicId}`);
  const tabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
  const schedule = tabs.getByRole("tab", { name: "일정", exact: true });
  const milestone = tabs.getByRole("tab", { name: "Milestone 대시보드", exact: true });
  const scopeTabs = page.getByRole("tablist", { name: "WBS 범위 탭" });
  const gantt = page.locator(".project-gantt-frame");
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const instance = await gantt.getAttribute("data-project-gantt-api-instance");

  await expect(tabs.getByRole("tab")).toHaveText(["일정", "Milestone 대시보드", "리소스", "물류 구성"]);
  await expect(milestone).toHaveAttribute("aria-controls", "project-panel-milestones");
  await expect(schedule).toHaveAttribute("aria-controls", "project-panel-schedule");
  await expect(page.getByRole("tab", { name: "Gantt", exact: true })).toHaveCount(0);
  await expect(page.locator(".project-schedule-peer-tabs")).toHaveCount(0);
  await expect(scopeTabs.getByRole("tab", { name: "전체 프로젝트", exact: true })).toBeVisible();

  await milestone.click();
  const dashboard = page.getByTestId("milestone-dashboard");
  await expect(dashboard).toHaveAttribute("data-ready", "true");
  const inactive = page.locator("#project-panel-schedule");
  await expect(inactive).toHaveAttribute("aria-hidden", "true");
  await expect(inactive).toHaveAttribute("inert", "");
  await expect(inactive).toHaveCSS("visibility", "hidden");
  expect(await gantt.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(0);
  const detail = dashboard.getByRole("region", { name: "Milestone 전체 상태 표 가로 스크롤" })
    .getByRole("row").nth(1).getByRole("button", { name: /Milestone 상세$/ });
  await detail.click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(milestone).toHaveAttribute("aria-selected", "true");

  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await schedule.click();
    await expect(scopeTabs.getByRole("tab", { name: "전체 프로젝트", exact: true })).toBeVisible();
    await milestone.click();
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    // Keyboard focus must retain its entire 3px ring inside the clipped tab scroller.
    await schedule.focus();
    await page.keyboard.press("ArrowRight");
    await expect(milestone).toBeFocused();
    const focusRing = await milestone.evaluate((button) => {
      const style = getComputedStyle(button);
      return { visible: button.matches(":focus-visible"), kind: style.outlineStyle,
        width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset) };
    });
    expect(focusRing.visible).toBe(true);
    expect(focusRing.kind).not.toBe("none");
    expect(focusRing.width).toBeGreaterThanOrEqual(3);
    expect(focusRing.width + focusRing.offset).toBeLessThanOrEqual(0);
    const geometry = await tabs.evaluate((owner) => {
      const selected = owner.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
      const outer = owner.getBoundingClientRect(), inner = selected.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        selectedVisible: inner.left >= outer.left - 1 && inner.right <= outer.right + 1,
        ownerHeight: owner.clientHeight,
        scrollHeight: owner.scrollHeight,
        selectedFocused: document.activeElement === selected,
      };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(width);
    expect(geometry.selectedVisible && geometry.selectedFocused).toBe(true);
    expect(geometry.scrollHeight).toBe(geometry.ownerHeight);
  }

  await schedule.click();
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", instance!);
  await expect(scopeTabs.getByRole("tab", { name: "전체 프로젝트", exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
