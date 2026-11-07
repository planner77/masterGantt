import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import { waitForGanttReadiness } from "./helpers/gantt-readiness";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { expect, test } from "@playwright/test";
import { installMilestoneDashboardFixture } from "./helpers/milestone-ui";
import {
  expectSameGanttRoot,
  installStatefulProjectFixture,
  publicId,
  rememberGanttRoot,
  rowNamed,
} from "../fixtures/stateful-project";

test.describe("Issue #83 Project Task / Resource 검색·필터", () => {
  test("Task 통합 검색과 초기화는 canonical Gantt 인스턴스를 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await installStatefulProjectFixture(page);
    await installMilestoneDashboardFixture(page, state);
    const documents: string[] = [];
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents.push(request.url());
      if (!["GET", "HEAD"].includes(request.method()) && !isWbsViewReadQuery(request)) mutations.push(request.method());
    });

    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
    const identity = await rememberGanttRoot(page);
    documents.length = 0;
    mutations.length = 0;

    const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
    await search.fill("Existing summary child");
    await expect(page.getByRole("status").filter({ hasText: "1개 일반 Task 일치 · 직접 Summary 0개 · context Summary 1개 / 전체 3개 WBS 작업" })).toBeVisible();
    await expect(rowNamed(page, "Stable milestone")).toHaveCount(0);
    await expect(page.getByLabel("Milestone Timeline", { exact: true })).toHaveCount(0);
    await openWorkspaceView(page, "milestones");
    await expect(page.locator(`#project-panel-milestones tr[data-milestone-task-id="${state.tasks.find(task => task.type === "milestone")!.taskId}"]`)).toBeVisible();
    await page.getByRole("tab", { name: "일정", exact: true }).click();
    await expect(search).toHaveValue("Existing summary child");
    await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
    await expectSameGanttRoot(page, identity);

    await page.getByRole("button", { name: "초기화", exact: true }).click();
    await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    await expect(rowNamed(page, "Stable milestone")).toHaveCount(0);
    await expect(rowNamed(page, "Existing summary child")).toBeVisible();
    await expectSameGanttRoot(page, identity);
    expect(documents).toEqual([]);
    expect(mutations).toEqual([]);
  });

  test("readonly에서도 Task 고급 필터를 사용할 수 있고 ancestor context는 match count에서 제외한다", async ({ page }, info) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = false;
    const mutations: string[] = [];
    page.on("request", request => {
      if (!["GET", "HEAD"].includes(request.method()) && !isWbsViewReadQuery(request)) mutations.push(request.method());
    });
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    const identity = await rememberGanttRoot(page);

    await page.getByRole("button", { name: "필터", exact: true }).click();
    await page.getByLabel("작업명", { exact: true }).fill("Existing summary child");
    await expect(page.getByRole("status").filter({ hasText: "1개 일반 Task 일치 · 직접 Summary 0개 · context Summary 1개 / 전체 3개 WBS 작업" })).toBeVisible();
    await expect(rowNamed(page, "Stable summary")).toBeVisible();
    await expect(rowNamed(page, "Existing summary child")).toBeVisible();
    await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
    await expectSameGanttRoot(page, identity);

    const frame = page.locator(".project-gantt-frame");
    const scope = page.locator("#project-scope-panel");
    const scopeOwner = await scope.elementHandle();
    const name = page.getByLabel("작업명", { exact: true });
    const child = rowNamed(page, "Existing summary child");
    const filteredIds = fixture.tasks.filter(task => ["Stable summary", "Existing summary child"].includes(task.name)).map(task => task.taskId);
    const measure = () => frame.evaluate(element => {
      const native = element.querySelector<HTMLElement>(".wx-gantt")!;
      const chart = element.querySelector<HTMLElement>(".wx-chart")!;
      const grid = element.querySelector<HTMLElement>(".wx-table-container")!;
      const scale = chart.querySelector<HTMLElement>(".wx-scale")!;
      const header = grid.querySelector<HTMLElement>(".wx-header")!;
      const owner = document.querySelector<HTMLElement>("#project-scope-panel")!;
      const core = Reflect.get(element, "__masterganttMilestoneTimeline")?.read?.();
      return {
        viewport: { width: innerWidth, height: innerHeight }, fullscreen: document.fullscreenElement === element,
        nativeHeight: native.clientHeight, chartHeight: chart.clientHeight, gridHeight: grid.clientHeight,
        scaleHeight: scale.clientHeight, gridHeaderHeight: header.clientHeight,
        // Reserve three maximum-density coarse-pointer rows, even on a fine pointer.
        bodyHeight: Math.min(native.clientHeight - scale.clientHeight, chart.clientHeight - scale.clientHeight, grid.clientHeight - header.clientHeight),
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        scope: { height: owner.clientHeight, scrollHeight: owner.scrollHeight, top: owner.scrollTop, overflow: getComputedStyle(owner).overflowY },
        nativeScroll: { left: chart.scrollLeft, top: native.scrollTop },
        core: core ? { instance: core.instance, top: core.top, left: core.left, rows: core.rows, canonicalIds: core.canonicalIds } : null,
      };
    });
    const receipts: Array<{ label: string; geometry: Awaited<ReturnType<typeof measure>>; readiness: Awaited<ReturnType<typeof waitForGanttReadiness>> }> = [];
    const checkGeometry = async (label: string, visibleIds = filteredIds) => {
      const readiness = await waitForGanttReadiness(frame, {
        operation: "observe", api: identity.apiId, revision: fixture.project.revision, scale: "day", scope: null, query: "",
        queryWitness: { kind: "unchanged" }, visibleIds, exactDom: true, requireRenderedRows: true, allowCancelledPriorWork: true,
      });
      await expect.poll(async () => (await measure()).bodyHeight, { message: `${label}: actual Grid/Chart body must fit three 44px rows` }).toBeGreaterThanOrEqual(132);
      const geometry = await measure();
      expect(geometry.nativeHeight).toBeGreaterThan(geometry.scaleHeight);
      expect(geometry.chartHeight).toBeGreaterThan(geometry.scaleHeight);
      expect(geometry.gridHeight).toBeGreaterThan(geometry.gridHeaderHeight);
      expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
      await expectSameGanttRoot(page, identity);
      expect(await scopeOwner!.evaluate(owner => owner.isConnected && owner === document.querySelector("#project-scope-panel"))).toBe(true);
      receipts.push({ label, geometry, readiness });
      return geometry;
    };
    const focusVisible = async (target: ReturnType<typeof page.locator>) => {
      await target.scrollIntoViewIfNeeded();
      await target.focus();
      await expect(target).toBeFocused();
      expect(await target.evaluate(element => {
        const box = element.getBoundingClientRect();
        const x = (Math.max(0, box.left) + Math.min(innerWidth, box.right)) / 2;
        const y = (Math.max(0, box.top) + Math.min(innerHeight, box.bottom)) / 2;
        const hit = document.elementFromPoint(x, y);
        return box.width > 0 && box.height > 0 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !!hit && (element === hit || element.contains(hit));
      })).toBe(true);
    };
    const screenshot = async (label: string) => info.attach(`${label}.png`, { body: await page.screenshot(), contentType: "image/png" });

    await checkGeometry("original-1024x900");
    await focusVisible(child.locator("input[data-copy-selection]"));
    await screenshot("readonly-filter-1024x900");
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1024, height: 900 }, { width: 1440, height: 900 }, { width: 1920, height: 900 }, { width: 1024, height: 480 }]) {
      await page.setViewportSize(viewport);
      await checkGeometry(`${viewport.width}x${viewport.height}`);
      await expect(name).toHaveValue("Existing summary child");
      await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
      await focusVisible(name);
      const filterScroll = await scope.evaluate(owner => owner.scrollTop);
      await name.press("Tab");
      await expect(page.getByRole("combobox", { name: "설명 조건", exact: true })).toBeFocused();
      await focusVisible(child.locator("input[data-copy-selection]"));
      if (viewport.height === 480) {
        const geometry = await measure();
        expect(geometry.scope.overflow).toBe("auto");
        expect(geometry.scope.scrollHeight).toBeGreaterThan(geometry.scope.height);
        expect(geometry.scope.top).toBeGreaterThan(filterScroll);
      }
      if (viewport.width === 390 || viewport.height === 480) await screenshot(`readonly-filter-${viewport.width}x${viewport.height}`);
    }

    const beforeFullscreen = await measure();
    await frame.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
    await expect.poll(() => frame.evaluate(element => document.fullscreenElement === element)).toBe(true);
    await checkGeometry("fullscreen-1024x480");
    await frame.getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    const afterFullscreen = await checkGeometry("fullscreen-return-1024x480");
    expect(afterFullscreen.nativeScroll).toEqual(beforeFullscreen.nativeScroll);
    await expect(name).toHaveValue("Existing summary child");
    await expect(frame.getByRole("button", { name: "Gantt 전체 화면", exact: true })).toBeFocused();

    await focusVisible(name);
    await name.press("Escape");
    const filterTrigger = page.locator('[aria-controls="project-task-filter-panel"]');
    await expect(name).toBeHidden();
    await expect(filterTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(filterTrigger).toBeFocused();
    await filterTrigger.click();
    await expect(name).toHaveValue("Existing summary child");
    await page.getByRole("button", { name: "초기화", exact: true }).click();
    await expect(name).toHaveValue("");
    await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    await checkGeometry("reset-1024x480", fixture.tasks.filter(task => task.type !== "milestone").map(task => task.taskId));
    expect(fixture.posts).toEqual([]);
    expect(fixture.patchRequests).toEqual([]);
    expect(fixture.project.revision).toBe(fixture.initialRevision);
    expect(mutations).toEqual([]);
    await info.attach("readonly-filter-geometry.json", { body: JSON.stringify({ identity, receipts, mutations, revision: fixture.project.revision }, null, 2), contentType: "application/json" });
  });

  test("Resource 검색·기간 필터는 서버 선택 범위 KPI와 행을 함께 갱신하고 초기화를 복원한다", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await installStatefulProjectFixture(page);
    await page.goto("/projects/" + publicId);
    await openWorkspaceView(page, "resources");
    const panel = page.getByRole("tabpanel", { name: "리소스" });
    const dashboard = panel.locator('[data-resource-dashboard="true"]');
    const kpis = dashboard.locator('dl[aria-label="선택 범위 KPI"]');
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await expect(panel.getByRole("heading", { name: "리소스 공수" })).toBeVisible();
    await expect(kpis).toContainText("5.00 M/D");
    const search = dashboard.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" });
    await search.fill("R-01");
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await expect(kpis).toContainText("5.00 M/D");
    await dashboard.getByRole("button", { name: "개인", exact: true }).click();
    await expect(dashboard.locator('[data-resource-row="resource"]').first()).toContainText("테스트 리소스");
    await expect(kpis).toContainText("5.00 M/D");
    const filter = dashboard.locator('button[aria-controls="resource-dashboard-advanced-filter"]');
    await filter.click();
    const advanced = dashboard.getByLabel("리소스 고급 필터");
    await expect(advanced).toBeVisible();
    await dashboard.getByLabel("기간 시작", { exact: true }).fill("2026-10-01");
    await dashboard.getByLabel("기간 종료", { exact: true }).fill("2026-10-31");
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await expect(dashboard.getByText("검색 조건에 일치하는 리소스 할당이 없습니다.")).toBeVisible();
    await expect(kpis).toContainText("할당 없음");
    await expect(kpis).not.toContainText("0.00 M/D");
    await dashboard.getByRole("button", { name: "초기화", exact: true }).click();
    await expect(search).toBeFocused();
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await expect(dashboard.locator('[data-resource-row="resource"]').first()).toContainText("테스트 리소스");
    await expect(kpis).toContainText("5.00 M/D");
  });
});
