import { openWorkspaceView, workspaceViewTab } from "./helpers/workspace-navigation";
import { expect, test } from "@playwright/test";
import { dashboardFixture } from "../fixtures/milestone-dashboard";
import { installStatefulProjectFixture, projectPath, publicId } from "../fixtures/stateful-project";

// #730's public POST is a read query. Keep every business mutation counted.
function isWbsReadQuery(request: { method(): string; url(): string }) {
  return request.method() === "POST" && /^\/api\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/resource-dashboard\/views$/.test(new URL(request.url()).pathname);
}

test("#518 일정·Milestone 상위 탭, dialog origin, Gantt 측정/상태와 5폭 tab geometry", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = false;
  let writes = 0;
  page.on("request", (request) => {
    if (request.url().includes(projectPath) && !["GET", "HEAD"].includes(request.method()) && !isWbsReadQuery(request)) writes++;
  });
  await page.route(`**${projectPath}/milestone-dashboard?*`, (route) =>
    route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));

  await page.goto(`/projects/${publicId}`);
  const tabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
  const schedule = tabs.getByRole("tab", { name: "일정", exact: true });
  const dashboardTab = tabs.getByRole("tab", { name: "대시보드", exact: true });
  const milestone = workspaceViewTab(page, "milestones");
  const allSchedule = page.getByRole("button", { name: "전체 일정 보기", exact: true });
  const gantt = page.locator(".project-gantt-frame");
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const instance = await gantt.getAttribute("data-project-gantt-api-instance");
  const chartHeight = await gantt.locator(".wx-chart").evaluate(element => element.getBoundingClientRect().height);
  expect(chartHeight).toBeGreaterThan(0);

  await expect(tabs.getByRole("tab")).toHaveText(["일정", "대시보드", "기준정보"]);

  await expect(schedule).toHaveAttribute("aria-controls", "project-panel-schedule");
  await expect(page.getByRole("tab", { name: "Gantt", exact: true })).toHaveCount(0);
  await expect(page.locator(".project-schedule-peer-tabs")).toHaveCount(0);
  await expect(allSchedule).toBeVisible();

  await openWorkspaceView(page, "milestones");
  await expect(milestone).toHaveAttribute("aria-controls", "project-panel-milestones");
  await expect(page.getByRole("tablist", { name: "대시보드 보기" }).getByRole("tab")).toHaveText(["KPI", "Milestone", "공정&WorkArea", "설비", "물류 시스템", "리소스"]);
  const dashboard = page.getByTestId("milestone-dashboard");
  await expect(dashboard).toHaveAttribute("data-ready", "true");
  const inactive = page.locator("#project-panel-schedule");
  await expect(inactive).toHaveAttribute("aria-hidden", "true");
  await expect(inactive).toHaveAttribute("inert", "");
  await expect(inactive).toHaveCSS("visibility", "hidden");
  expect(await gantt.locator(".wx-chart").evaluate(element => element.getBoundingClientRect().height)).toBe(chartHeight);
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
    await expect(allSchedule).toBeVisible();
    await openWorkspaceView(page, "milestones");
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    const subviews = page.getByRole("tablist", { name: "대시보드 보기" });
    await milestone.focus();
    await page.keyboard.press("End");
    await expect(subviews.getByRole("tab", { name: "리소스", exact: true })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(subviews.getByRole("tab", { name: "KPI", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(milestone).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(milestone).toBeFocused();
    await page.getByRole("tablist", { name: "프로젝트 작업공간" }).getByRole("tab", { name: "기준정보", exact: true }).click();
    await expect(page.getByRole("tablist", { name: "기준정보 보기" }).getByRole("tab")).toHaveText(["공정&WorkArea", "설비", "물류 시스템", "리소스"]);
    if (width === 1440) await page.screenshot({ path: "docs/evidence/issue-724/navigation-1440.png" });
    await openWorkspaceView(page, "milestones");
    await expect(milestone).toHaveAttribute("aria-selected", "true");
    // Keyboard focus must retain its 3px ring; re-entering the active
    // Dashboard section must not resurrect a previously visited subview.
    await schedule.focus();
    await expect(schedule).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(dashboardTab).toHaveAttribute("aria-selected", "true");
    // Preserve a screenshot-independent focus diagnostic on any future failure.
    const focusObservation = await tabs.evaluate(owner => ({
      activeId: (document.activeElement as HTMLElement | null)?.id ?? null,
      activeTag: document.activeElement?.tagName ?? null,
      sectionTabId: owner.querySelector('[role="tab"][aria-selected="true"]')?.id ?? null,
      screen: new URL(window.location.href).searchParams.get("screen"),
    }));
    await test.info().attach(`issue-518-primary-focus-${width}`, {
      body: JSON.stringify({ width, ...focusObservation }, null, 2),
      contentType: "application/json",
    });
    await expect(dashboardTab).toBeFocused();
    // Focus-only parent navigation must not replace the current Milestone view with a stale process view.
    await expect.poll(() => new URL(page.url()).searchParams.get("screen")).toBe("dashboard.milestones");
    await expect(milestone).toHaveAttribute("aria-selected", "true");
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    const focusRing = await dashboardTab.evaluate((button) => {
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
    if (width === 390) await page.screenshot({ path: "docs/evidence/issue-724/navigation-390.png" });
  }

  await schedule.click();
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", instance!);
  await expect(allSchedule).toBeVisible();
  expect(writes).toBe(0);
});

test("#724 exact screen·legacy URL·저장된 보기와 Resource 관리자 경계", async ({ page }) => {
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = true;
  let writes = 0;
  page.on("request", request => { if (!['GET', 'HEAD'].includes(request.method()) && !isWbsReadQuery(request)) writes++; });
  await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.route(`**${projectPath}/resource-memberships?*`, route => route.fulfill({ json: { data: { projectRevision: state.project.revision, catalogRevision: 1, total: 0, offset: 0, limit: 50, groups: [], counts: { registered: 0, assigned: 0, roleOnly: 0, inactive: 0 }, resources: [] } } }));
  await page.goto(`/projects/${publicId}?screen=master.resources&view=milestones`);
  const master = page.locator("#project-panel-resource-master");
  await expect(master.getByRole("heading", { name: "프로젝트 리소스", exact: true })).toBeVisible();
  const catalogLink = master.getByRole("link", { name: "공용 리소스 관리 (별도 관리자)", exact: true });
  await expect(catalogLink).toHaveAttribute("href", "/resources");
  await expect(master.getByLabel("관리자 비밀번호", { exact: true })).toHaveCount(0);
  await expect(master.getByRole("button", { name: "로그인", exact: true })).toHaveCount(0);
  await expect(master.getByRole("button", { name: "리소스 추가", exact: true })).toHaveCount(0);
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await catalogLink.focus();
    await expect(catalogLink).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `output/playwright/issue-724/resource-master-${width}.png` });
  }
  const frame = page.locator(".project-gantt-frame");
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const instance = await frame.getAttribute("data-project-gantt-api-instance");
  await master.getByRole("button", { name: "작업 일정에서 배정 관리", exact: true }).click();
  await expect(page.locator("#project-panel-schedule")).toBeVisible();
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
  await openWorkspaceView(page, "milestones");
  await expect.poll(() => new URL(page.url()).searchParams.get("screen")).toBe("dashboard.milestones");
  await page.goto(`/projects/${publicId}`);
  await expect(workspaceViewTab(page, "milestones")).toHaveAttribute("aria-selected", "true");
  await page.goto(`/projects/${publicId}?view=resources`);
  await expect(workspaceViewTab(page, "resources")).toHaveAttribute("aria-selected", "true");
  await openWorkspaceView(page, "schedule");
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  expect(instance).toBeTruthy();
  expect(writes).toBe(0);
});


test("#724 auxiliary screen selection has one accessible secondary tab", async ({ page }) => {
  await installStatefulProjectFixture(page);
  for (const [screen, section, fallback] of [
    ["dashboard.target", "대시보드", "공정&WorkArea"],
    ["master.targets", "기준정보", "공정&WorkArea"],
    ["master.relations", "기준정보", "공정&WorkArea"],
  ] as const) {
    await page.goto(`/projects/${publicId}?screen=${screen}`);
    const tabs = page.getByRole("tablist", { name: `${section} 보기` });
    const tab = tabs.getByRole("tab", { name: fallback, exact: true });
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(tab).toHaveAttribute("tabindex", "0");
    await expect(tabs.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
    await expect(tabs.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  }
});
