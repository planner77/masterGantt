import { expect, test, type Frame, type Request } from "@playwright/test";
import { deferred, expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

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
    await expect(page.getByText("Stateful canonical snapshot fixture", { exact: true })).not.toBeVisible();

    await page.getByRole("group").locator("summary[aria-label=\"프로젝트 정보 보기\"]").click().catch(async () => { await page.locator("summary[aria-label=\"프로젝트 정보 보기\"]").click(); });
    await expect(page.getByText("Stateful canonical snapshot fixture", { exact: true })).toBeVisible();
    await expect(page.getByText("Revision", { exact: true })).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
    const scheduleTab = tabs.getByRole("tab", { name: "일정", exact: true });
    const resourcesTab = tabs.getByRole("tab", { name: "리소스", exact: true });
    const logisticsTab = tabs.getByRole("tab", { name: "물류 구성", exact: true });
    await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
    await expect(resourcesTab).toHaveAttribute("aria-selected", "false");
    await expect(logisticsTab).toHaveAttribute("aria-selected", "false");

    const identity = await rememberGanttRoot(page);
    const chart = page.locator(".project-gantt-widget .wx-chart").first();
    await chart.evaluate((element) => { element.scrollLeft = 160; });
    const scrollLeft = await chart.evaluate((element) => element.scrollLeft);

    await scheduleTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(resourcesTab).toBeFocused();
    await expect(resourcesTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { level: 2, name: "리소스 공수" })).toBeVisible();
    const resourceDashboard = page.getByRole("tabpanel", { name: "리소스" }).locator('[data-resource-dashboard="true"]');
    await expect(resourceDashboard).toHaveAttribute("data-ready", "true");
    const group = resourceDashboard.getByRole("region", { name: "그룹 현황" }).getByRole("button", { name: /개발팀 \(G-01\)/ });
    await expect(group).toBeVisible();
    await group.click();
    await expect(resourceDashboard.getByRole("region", { name: "개발팀 개인 현황" }).getByRole("button", { name: /테스트 리소스 \(R-01\)/ })).toBeVisible();
    await expect(resourceDashboard.locator('dl[aria-label="선택 범위 KPI"]')).toContainText("5.00 M/D");

    await page.keyboard.press("Home");
    await expect(scheduleTab).toBeFocused();
    await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
    await expectSameGanttRoot(page, identity);
    expect(await chart.evaluate((element) => element.scrollLeft)).toBeCloseTo(scrollLeft, 0);

    await page.keyboard.press("End");
    await expect(logisticsTab).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(resourcesTab).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(scheduleTab).toBeFocused();
    await expectSameGanttRoot(page, identity);

    expect(documentRequests.filter((url) => url.includes(`/projects/${publicId}`))).toHaveLength(1);
    expect(new Set(navigations.filter((url) => url.includes(`/projects/${publicId}`))).size).toBe(1);
    expect(mutations).toEqual([]);

    page.off("request", recordRequest);
    page.off("framenavigated", recordNavigation);
  });

  test("Issue #231 정보/더보기 disclosure는 외부 상호작용·포커스 이탈에서 닫히고 상호 배타적으로 열린다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);

    const info = page.locator('.project-info-popover > summary[aria-label="프로젝트 정보 보기"]');
    const infoDetails = page.locator(".project-info-popover");
    const infoPanel = page.locator(".project-info-panel");
    const more = page.locator('.project-action-menu > summary[aria-label="프로젝트 작업 더보기"]');
    const moreDetails = page.locator(".project-action-menu");
    const morePanel = page.locator(".project-action-menu-panel");
    const heading = page.getByRole("heading", { level: 1, name: "Issue 3 stable Gantt fixture" });

    await info.click();
    await expect(infoPanel).toBeVisible();
    await heading.click();
    await expect(infoDetails).not.toHaveAttribute("open", "");

    await info.click();
    await expect(infoPanel).toBeVisible();
    await info.focus();
    await page.keyboard.press("Tab");
    await expect(infoDetails).not.toHaveAttribute("open", "");

    await info.click();
    await expect(infoDetails).toHaveAttribute("open", "");
    await more.click();
    await expect(moreDetails).toHaveAttribute("open", "");
    await expect(infoDetails).not.toHaveAttribute("open", "");

    await info.click();
    await expect(infoDetails).toHaveAttribute("open", "");
    await expect(moreDetails).not.toHaveAttribute("open", "");

    await more.click();
    await expect(morePanel).toBeVisible();
    await heading.click();
    await expect(moreDetails).not.toHaveAttribute("open", "");
  });

  test("Issue #231 더보기에서 연 Dialog 내부 상호작용은 disclosure를 닫지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);

    const more = page.locator('.project-action-menu > summary[aria-label="프로젝트 작업 더보기"]');
    const moreDetails = page.locator(".project-action-menu");

    await more.click();
    await expect(moreDetails).toHaveAttribute("open", "");
    await page.locator(".project-action-menu-panel").getByRole("button", { name: "프로젝트 복사" }).click();

    const copyDialog = page.getByRole("dialog", { name: "프로젝트 복사", exact: true });
    await expect(copyDialog).toBeVisible();
    await copyDialog.click({ position: { x: 10, y: 10 } });
    await expect(moreDetails).toHaveAttribute("open", "");
  });

  test("copy=1 진입은 overflow disclosure와 복사 Dialog를 함께 연다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}?copy=1`);

    await expect(page.getByRole("dialog", { name: "프로젝트 복사", exact: true })).toBeVisible();
    await expect(page.locator(".project-action-menu")).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "프로젝트 복사", exact: true })).toHaveCount(0);
  });

  test("unlock 성공 후 편집 종료 시 unlock Dialog가 자동 재개방되지 않는다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = false;
    await page.goto(`/projects/${publicId}`);

    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "편집 잠금 해제", exact: true }).click();
    const unlockDialog = page.getByRole("dialog", { name: "편집 활성화", exact: true });
    await expect(unlockDialog).toBeVisible();
    await unlockDialog.getByLabel("편집 비밀번호", { exact: true }).fill("issue-76-password");
    await unlockDialog.getByRole("button", { name: "편집 활성화", exact: true }).click();

    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
    await expect(unlockDialog).toHaveCount(0);
    const settingsButton = page.getByRole("button", { name: "프로젝트 설정", exact: true });
    await expect(settingsButton).toBeFocused();
    await settingsButton.click();
    await page.getByRole("tab", { name: "편집·보안" }).click();
    await page.getByRole("button", { name: "편집 모드 종료", exact: true }).click();

    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(unlockDialog).toHaveCount(0);
    const unlockButton = page.getByRole("button", { name: "편집 잠금 해제", exact: true });
    await expect(unlockButton).toBeVisible();
    await expect(unlockButton).toBeFocused();
  });

  for (const width of [390, 768, 1024, 1440, 1920]) {
    test(`${width}px에서 document horizontal overflow가 없다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const fixture = await installStatefulProjectFixture(page);
      fixture.project.name = "짧은 프로젝트";
      await page.goto(`/projects/${publicId}`);
      await expect(page.getByRole("heading", { level: 1, name: fixture.project.name })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await page.locator('summary[aria-label="프로젝트 정보 보기"]').click();
      await expect(page.getByText("Stateful canonical snapshot fixture", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      const infoBox = await page.locator(".project-info-panel").boundingBox();
      expect(infoBox).not.toBeNull();
      expect(infoBox!.x).toBeGreaterThanOrEqual(0);
      expect(infoBox!.x + infoBox!.width).toBeLessThanOrEqual(width);
    });
  }
});

test("Issue #130 Phase 2 Project Context와 tab은 다섯 폭·권한 상태에서 작업공간을 유지한다", async ({ page }, testInfo) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.project.name = "긴 한국어 프로젝트 제목과 English delivery workspace ".repeat(8);
  fixture.project.description = "상세 설명과 owner metadata ".repeat(80);

  for (const [width, height] of [[390, 844], [768, 900], [1024, 900], [1440, 900], [1600, 900]] as const) {
    await page.setViewportSize({ width, height });
    for (const editing of [false, true]) {
      fixture.sessionEditable = editing;
      await page.goto(`/projects/${publicId}`);
      const title = page.getByRole("heading", { level: 1, name: fixture.project.name });
      const badge = page.locator(editing ? ".edit-badge" : ".readonly-badge");
      const context = page.locator(".project-context-bar");
      const info = page.locator('.project-info-popover > summary[aria-label="프로젝트 정보 보기"]');
      const more = page.locator('.project-action-menu > summary[aria-label="프로젝트 작업 더보기"]');
      await expect(badge).toBeVisible();
      await expect(title).toHaveAttribute("title", fixture.project.name);
      expect(await title.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      for (const item of [badge, info, more, ...await context.locator(".project-context-actions > button").all()]) {
        const box = await item.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(await item.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
      }
      const gantt = page.locator(".project-gantt-frame");
      const ganttBox = await gantt.boundingBox();
      const contextBox = await context.boundingBox();
      expect(ganttBox).not.toBeNull();
      expect(contextBox).not.toBeNull();
      expect(ganttBox!.y).toBeGreaterThan(contextBox!.y + contextBox!.height);
      expect(ganttBox!.height).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      const identity = await rememberGanttRoot(page);
      let chartScrollLeft: number | null = null;
      if (width === 1440 && editing) {
        await gantt.getByRole("group", { name: "Gantt 표시 단위" }).getByRole("button", { name: "주", exact: true }).click();
        const chart = page.locator(".project-gantt-widget .wx-chart").first();
        await chart.evaluate((element) => { element.scrollLeft = 160; });
        chartScrollLeft = await chart.evaluate((element) => element.scrollLeft);
        expect(chartScrollLeft).toBeGreaterThan(0);
      }
      await page.screenshot({ path: testInfo.outputPath(`issue-130-phase2-current-${width}-${editing ? "edit" : "readonly"}.png`) });

      await info.click();
      const infoPanel = page.locator(".project-info-panel");
      await expect(infoPanel).toBeVisible();
      const infoBox = await infoPanel.boundingBox();
      expect(infoBox).not.toBeNull();
      expect(infoBox!.x).toBeGreaterThanOrEqual(0);
      expect(infoBox!.x + infoBox!.width).toBeLessThanOrEqual(width);
      expect(infoBox!.y + infoBox!.height).toBeLessThanOrEqual(height);
      await info.focus();
      await page.keyboard.press("Escape");
      await expect(infoPanel).toBeHidden();
      await expect(info).toBeFocused();

      await more.click();
      const morePanel = page.locator(".project-action-menu-panel");
      await expect(morePanel).toBeVisible();
      const moreBox = await morePanel.boundingBox();
      expect(moreBox).not.toBeNull();
      expect(moreBox!.x).toBeGreaterThanOrEqual(0);
      expect(moreBox!.x + moreBox!.width).toBeLessThanOrEqual(width);
      expect(moreBox!.y + moreBox!.height).toBeLessThanOrEqual(height);
      await morePanel.getByRole("button", { name: "프로젝트 복사" }).focus();
      await page.keyboard.press("Escape");
      await expect(morePanel).toBeHidden();
      await expect(more).toBeFocused();

      const tabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
      const schedule = tabs.getByRole("tab", { name: "일정" });
      const resources = tabs.getByRole("tab", { name: "리소스" });
      const logistics = tabs.getByRole("tab", { name: "물류 구성" });
      await expect(schedule).toHaveAttribute("aria-controls", "project-panel-schedule");
      await expect(resources).toHaveAttribute("aria-controls", "project-panel-resources");
      await expect(logistics).toHaveAttribute("aria-controls", "project-panel-logistics");
      await schedule.focus();
      await page.keyboard.press("End");
      await expect(logistics).toBeFocused();
      await expect(page.getByRole("tabpanel", { name: "물류 구성" })).toBeVisible();
      await page.keyboard.press("ArrowLeft");
      await expect(resources).toBeFocused();
      await expect(page.getByRole("tabpanel", { name: "리소스" })).toBeVisible();
      await page.keyboard.press("Home");
      await expect(schedule).toBeFocused();
      await expect(page.getByRole("tabpanel", { name: "일정" })).toBeVisible();
      await expectSameGanttRoot(page, identity);
      if (chartScrollLeft !== null) {
        await expect(gantt).toHaveAttribute("data-gantt-scale-mode", "week");
        expect(await page.locator(".project-gantt-widget .wx-chart").first().evaluate((element) => element.scrollLeft)).toBe(chartScrollLeft);
      }
    }
  }
});

test("Issue #130 Phase 2 조회 중·오류 상태의 본문과 재시도가 작업공간에 복귀한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installStatefulProjectFixture(page);
  const releaseLoad = deferred();
  let fail = true;
  await page.route(`**/api/projects/${publicId}`, async (route) => {
    if (!fail) { await route.fallback(); return; }
    await releaseLoad.promise;
    await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } });
  });
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("프로젝트 정보를 불러오는 중입니다.")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  releaseLoad.resolve();
  await expect(page.getByRole("heading", { name: "프로젝트를 불러올 수 없습니다." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  fail = false;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByRole("tablist", { name: "프로젝트 작업공간" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Issue 3 stable Gantt fixture" })).toBeVisible();
});


test("Issue #195 새 프로젝트 생성 탭은 키보드로 순환 이동한다", async ({ page }) => {
  await page.goto("/projects/new");

  const tabs = page.getByRole("tablist", { name: "프로젝트 생성 방식" });
  const blankTab = tabs.getByRole("tab", { name: "빈 프로젝트 만들기", exact: true });
  const templateTab = tabs.getByRole("tab", { name: "템플릿에서 만들기", exact: true });

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "본문으로 바로가기", exact: true });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("프로젝트 이름", { exact: true })).toBeFocused();
  await expect(blankTab).toHaveAttribute("tabindex", "0");

  await blankTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(templateTab).toBeFocused();
  await expect(templateTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowLeft");
  await expect(blankTab).toBeFocused();
  await expect(blankTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(templateTab).toBeFocused();
  await page.keyboard.press("Home");
  await expect(blankTab).toBeFocused();
});
