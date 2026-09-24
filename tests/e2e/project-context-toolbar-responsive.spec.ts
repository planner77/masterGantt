import { expect, test } from "@playwright/test";
import { expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

const longTitle = "아주 긴 프로젝트 이름 ".repeat(18);

for (const width of [390, 768, 1024, 1440]) {
  test(`Issue #118 ${width}px 긴 제목과 일정 도구줄이 readonly/editing에서 Gantt 공간을 보존한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const fixture = await installStatefulProjectFixture(page);
    fixture.project.name = longTitle;
    fixture.project.description = "긴 설명 ".repeat(300);

    for (const editing of [true, false]) {
      fixture.sessionEditable = editing;
      await page.goto(`/projects/${publicId}`);
      await expect(page.getByText(editing ? "편집 중" : "읽기 전용", { exact: true })).toBeVisible();
      const identity = await rememberGanttRoot(page);
      const title = page.getByRole("heading", { level: 1, name: longTitle });
      const badge = page.locator(editing ? ".edit-badge" : ".readonly-badge");
      const info = page.locator(".project-info-popover > summary");
      const actions = page.locator(".project-context-actions");
      await expect(title).toHaveAttribute("title", longTitle);
      expect(await title.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      for (const element of [badge, info, actions]) {
        await expect(element).toBeVisible();
        const bounds = await element.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      }
      for (const control of [badge, info, ...await actions.locator(":scope > button").all(), actions.locator(".project-action-menu > summary")]) {
        expect(await control.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        })).toBe(1);
      }
      await info.click();
      const infoPanel = page.locator(".project-info-panel");
      await expect(infoPanel).toBeVisible();
      const infoBounds = await infoPanel.boundingBox();
      expect(infoBounds).not.toBeNull();
      expect(infoBounds!.x).toBeGreaterThanOrEqual(0);
      expect(infoBounds!.x + infoBounds!.width).toBeLessThanOrEqual(width);
      expect(infoBounds!.y + infoBounds!.height).toBeLessThanOrEqual(844);
      expect(await infoPanel.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      await infoPanel.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      expect(await infoPanel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await info.click();

      const toolbar = page.getByRole("toolbar", { name: "작업 검색과 필터" });
      const search = toolbar.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
      const filter = toolbar.getByRole("button", { name: "필터", exact: true });
      const result = toolbar.getByRole("status");
      const panel = page.locator("#project-task-filter-panel");
      await toolbar.scrollIntoViewIfNeeded();
      await expect(filter).toHaveAttribute("aria-controls", "project-task-filter-panel");
      await expect(filter).toHaveAttribute("aria-expanded", "false");
      await expect(panel).toBeHidden();
      const searchBox = await search.boundingBox();
      const filterBox = await filter.boundingBox();
      const resultBox = await result.boundingBox();
      expect(searchBox).not.toBeNull();
      expect(filterBox).not.toBeNull();
      expect(resultBox).not.toBeNull();
      if (width <= 768) {
        expect(searchBox!.y).toBe(filterBox!.y);
        expect(resultBox!.y).toBeGreaterThan(searchBox!.y);
      }
      const gantt = page.locator(".project-gantt-frame");
      const scale = gantt.getByRole("group", { name: "Gantt 표시 단위" });
      await scale.getByRole("button", { name: "주", exact: true }).click();
      await expect(scale.getByRole("button", { name: "주", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(gantt).toHaveAttribute("data-gantt-scale-mode", "week");
      const chart = page.locator(".project-gantt-widget .wx-chart").first();
      expect(await chart.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await chart.evaluate((element) => element.clientWidth));
      await chart.evaluate((element) => { element.scrollLeft = 160; });
      const chartScrollLeft = await chart.evaluate((element) => element.scrollLeft);
      expect(chartScrollLeft).toBeGreaterThan(0);
      const before = await gantt.boundingBox();
      expect(before).not.toBeNull();
      expect(before!.height).toBeGreaterThan(0);
      await page.screenshot({ path: testInfo.outputPath(`issue-118-${width}-${editing ? "edit" : "readonly"}-search-idle.png`) });

      await search.fill("Stable leaf");
      const reset = toolbar.getByRole("button", { name: "초기화", exact: true });
      await expect(reset).toBeVisible();
      await expect(result).toContainText("1개 일치");
      if (width <= 768) {
        const resetBox = await reset.boundingBox();
        const filteredResultBox = await result.boundingBox();
        expect(resetBox).not.toBeNull();
        expect(filteredResultBox).not.toBeNull();
        expect(resetBox!.y).toBe(filteredResultBox!.y);
      }
      await filter.click();
      await expect(filter).toHaveAttribute("aria-expanded", "true");
      await panel.getByLabel("작업명", { exact: true }).focus();
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(filter).toHaveAttribute("aria-expanded", "false");
      await expect(filter).toBeFocused();
      await reset.click();
      await expect(search).toBeFocused();
      await expect(reset).toHaveCount(0);
      await expect(result).toContainText("4개 일치");
      await expectSameGanttRoot(page, identity);
      await expect(gantt).toHaveAttribute("data-gantt-scale-mode", "week");
      expect(await chart.evaluate((element) => element.scrollLeft)).toBe(chartScrollLeft);
      const after = await gantt.boundingBox();
      expect(after).not.toBeNull();
      expect(after!.y).toBe(before!.y);
      expect(after!.height).toBe(before!.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`issue-118-${width}-${editing ? "edit" : "readonly"}-search-reset.png`) });

      await page.getByRole("tab", { name: "리소스", exact: true }).click();
      await page.getByRole("tab", { name: "일정", exact: true }).click();
      await expectSameGanttRoot(page, identity);
      await expect(gantt).toHaveAttribute("data-gantt-scale-mode", "week");
      expect(await chart.evaluate((element) => element.scrollLeft)).toBe(chartScrollLeft);
    }
  });
}
