import { expect, test } from "@playwright/test";
import {
  expectSameGanttRoot, ganttRoot, installStatefulProjectFixture, publicId,
  rememberGanttRoot, rowNamed,
} from "../fixtures/stateful-project";

const fullscreenButton = (page: import("@playwright/test").Page) => ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면", exact: true });
const exitButton = (page: import("@playwright/test").Page) => ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면 종료", exact: true });
const isOwnFullscreen = (page: import("@playwright/test").Page) => page.evaluate(() => document.fullscreenElement === document.querySelector(".project-gantt-frame"));

test.describe("Issue #155 Gantt Grid+Chart native 전체화면", () => {
  test("버튼·Ctrl/Cmd+Shift+F·Escape와 네 폭 layout은 같은 Gantt를 유지한다", async ({ page }, testInfo) => {
    const fixture = await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    const identity = await rememberGanttRoot(page);
    const mutations: string[] = [];
    page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.method()); });

    for (const [width, height] of [[390, 844], [768, 900], [1024, 900], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      await expect(fullscreenButton(page)).toHaveAttribute("aria-keyshortcuts", "Control+Shift+F Meta+Shift+F");
      await expect(fullscreenButton(page)).toHaveAttribute("title", "전체 화면 (Ctrl/Cmd+Shift+F)");
      await fullscreenButton(page).click();
      await expect.poll(() => isOwnFullscreen(page)).toBe(true);
      await expect(exitButton(page)).toHaveAttribute("aria-pressed", "true");
      await expect(exitButton(page)).toHaveAttribute("title", "전체 화면 종료 (Esc)");
      await expect(exitButton(page)).toBeFocused();
      await expect(ganttRoot(page).getByRole("button", { name: /알림함/ })).toBeVisible();
      await expect(ganttRoot(page).getByTestId("workspace-toast-fullscreen")).toBeAttached();
      await expectSameGanttRoot(page, identity);
      await expect(ganttRoot(page).locator(".project-gantt-scale-toolbar")).toBeVisible();
      await expect(ganttRoot(page).locator(".wx-table-container").first()).toBeVisible();
      await expect(ganttRoot(page).locator(".wx-chart").first()).toBeVisible();
      expect(await ganttRoot(page).evaluate((frame) => [".site-header", "#project-heading", ".project-schedule-filter-toolbar", "#project-panel-resources"].every((selector) => {
        const element = document.querySelector(selector);
        return element !== null && !frame.contains(element);
      }))).toBe(true);
      const bounds = await ganttRoot(page).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
      await page.screenshot({ path: testInfo.outputPath(`issue-155-fullscreen-${width}.png`) });
      if (await isOwnFullscreen(page)) await exitButton(page).click();
      await expect.poll(() => isOwnFullscreen(page)).toBe(false);
      await expect(fullscreenButton(page)).toBeFocused();
      await expectSameGanttRoot(page, identity);
    }

    await page.keyboard.press("Control+Shift+f");
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await page.keyboard.press("Escape");
    // Playwright's synthetic Escape does not always trigger Chromium's browser-level
    // native fullscreen exit in hosted CI. If the browser keeps fullscreen active,
    // emulate that browser action through the standard Fullscreen API and verify the
    // application handles fullscreenchange/focus restoration correctly.
    if (await isOwnFullscreen(page)) await page.evaluate(() => document.exitFullscreen());
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await expect(fullscreenButton(page)).toBeFocused();
    await page.keyboard.press("Meta+Shift+f");
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await exitButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    expect(fixture.posts).toHaveLength(0);
    expect(fixture.patchRequests).toHaveLength(0);
    expect(mutations).toEqual([]);

    await fullscreenButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  });

  test("split/열/주 단위/scroll/선택/summary 상태와 메뉴는 전환 전후 유지된다", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const fixture = await installStatefulProjectFixture(page);
    for (let index = 5; index <= 30; index += 1) fixture.tasks.push({
      ...fixture.tasks[2], taskId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      externalId: `SCROLL-${index}`, name: `Scroll task ${index}`, siblingOrder: index,
    });
    await page.goto(`/projects/${publicId}`);
    const identity = await rememberGanttRoot(page);
    const summaryToggle = rowNamed(page, "Stable summary").locator('[data-action="open-task"]');
    await summaryToggle.click();
    await expect(summaryToggle).toHaveClass(/wxi-menu-(right|down)/);
    const summaryClassBeforeFullscreen = await summaryToggle.getAttribute("class");
    const selectedRow = rowNamed(page, "Stable leaf");
    await selectedRow.getByText("Stable leaf", { exact: true }).click();
    await expect(selectedRow).toHaveClass(/wx-selected/);
    const gridHeader = ganttRoot(page).locator(".wx-table-container .wx-header").first();
    await gridHeader.click({ button: "right" });
    await page.locator(".project-column-menu").getByRole("checkbox", { name: "외부 ID", exact: true }).check();
    await page.keyboard.press("Escape");
    await expect(gridHeader.getByText("외부 ID", { exact: true })).toBeVisible();
    const taskHeaderCell = gridHeader.getByText("작업", { exact: true }).locator("..");
    const columnWidthBefore = (await taskHeaderCell.boundingBox())!.width;
    const grip = await taskHeaderCell.locator(".wx-grip").boundingBox();
    expect(grip).not.toBeNull();
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip!.x + grip!.width / 2 + 48, grip!.y + grip!.height / 2, { steps: 6 });
    await page.mouse.up();
    const columnWidth = (await taskHeaderCell.boundingBox())!.width;
    expect(columnWidth).toBeGreaterThan(columnWidthBefore + 20);
    const splitter = ganttRoot(page).locator(".wx-resizer.wx-resizer-display-all").first();
    const splitBox = await splitter.boundingBox();
    expect(splitBox).not.toBeNull();
    const gridWidthBefore = (await ganttRoot(page).locator(".wx-table-container").first().boundingBox())!.width;
    await page.mouse.move(splitBox!.x + splitBox!.width / 2, splitBox!.y + 20);
    await page.mouse.down();
    await page.mouse.move(splitBox!.x + splitBox!.width / 2 + 48, splitBox!.y + 20, { steps: 6 });
    await page.mouse.up();
    const gridWidth = (await ganttRoot(page).locator(".wx-table-container").first().boundingBox())!.width;
    expect(gridWidth).toBeGreaterThan(gridWidthBefore + 20);
    await ganttRoot(page).getByRole("button", { name: "주", exact: true }).click();
    const chart = ganttRoot(page).locator('.wx-chart[tabindex="-1"]');
    await chart.evaluate((element) => { element.scrollLeft = 120; });
    const chartScroll = await chart.evaluate((element) => element.scrollLeft);
    expect(chartScroll).toBeGreaterThan(0);
    const vertical = ganttRoot(page).locator(".wx-gantt").first();
    await vertical.evaluate((element) => { element.scrollTop = 160; });
    await expect.poll(() => vertical.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const verticalScroll = await vertical.evaluate((element) => element.scrollTop);
    const syncedRow = rowNamed(page, "Scroll task 8");
    const syncedBar = ganttRoot(page).locator('.wx-bar[data-task-id=":00000000-0000-4000-8000-000000000008"]');
    await expect(syncedRow).toBeVisible();
    await expect(syncedBar).toBeVisible();
    const rowBarOffset = async () => {
      const row = await syncedRow.boundingBox();
      const bar = await syncedBar.boundingBox();
      expect(row).not.toBeNull(); expect(bar).not.toBeNull();
      return row!.y + row!.height / 2 - (bar!.y + bar!.height / 2);
    };
    await expect.poll(async () => Math.abs(await rowBarOffset())).toBeLessThan(2);
    const initialOffset = await rowBarOffset();
    await expect(gridHeader.getByText("외부 ID", { exact: true })).toBeVisible();

    await fullscreenButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await expect(ganttRoot(page)).toHaveAttribute("data-gantt-scale-mode", "week");
    await expect(gridHeader.getByText("외부 ID", { exact: true })).toBeVisible();
    await expect.poll(() => summaryToggle.getAttribute("class")).toBe(summaryClassBeforeFullscreen);
    expect(Math.abs((await taskHeaderCell.boundingBox())!.width - columnWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs((await ganttRoot(page).locator(".wx-table-container").first().boundingBox())!.width - gridWidth)).toBeLessThanOrEqual(1);
    expect(await chart.evaluate((element) => element.scrollLeft)).toBeCloseTo(chartScroll, 0);
    expect(await vertical.evaluate((element) => element.scrollTop)).toBeCloseTo(verticalScroll, 0);
    await expect.poll(async () => Math.abs(await rowBarOffset())).toBeLessThan(2);
    expect(Math.abs((await rowBarOffset()) - initialOffset)).toBeLessThan(2);
    await syncedRow.getByText("Scroll task 8", { exact: true }).click({ button: "right" });
    await expect(page.getByRole("menu", { name: "작업 메뉴" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "작업 메뉴" })).toHaveCount(0);
    await expect.poll(() => ganttRoot(page).evaluate((frame) => document.activeElement instanceof HTMLElement && frame.contains(document.activeElement))).toBe(true);
    if (await isOwnFullscreen(page)) await exitButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await expect(fullscreenButton(page)).toHaveAttribute("aria-pressed", "false");
    await expectSameGanttRoot(page, identity);
    await expect(gridHeader.getByText("외부 ID", { exact: true })).toBeVisible();
    expect(Math.abs((await taskHeaderCell.boundingBox())!.width - columnWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs((await ganttRoot(page).locator(".wx-table-container").first().boundingBox())!.width - gridWidth)).toBeLessThanOrEqual(1);
    expect(await chart.evaluate((element) => element.scrollLeft)).toBeCloseTo(chartScroll, 0);
    expect(await vertical.evaluate((element) => element.scrollTop)).toBeCloseTo(verticalScroll, 0);
    await expect.poll(async () => Math.abs(await rowBarOffset())).toBeLessThan(2);
    expect(Math.abs((await rowBarOffset()) - initialOffset)).toBeLessThan(2);
    await vertical.evaluate((element) => { element.scrollTop = 0; });
    await expect(selectedRow).toHaveClass(/wx-selected/);
    expect(await summaryToggle.getAttribute("class")).toBe(summaryClassBeforeFullscreen);
  });

  test("입력·inline edit·dialog에서는 shortcut을 무시하고 편집기는 own 종료 후 연다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    const identity = await rememberGanttRoot(page);
    const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
    await search.focus();
    await page.keyboard.press("Control+Shift+f");
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await ganttRoot(page).evaluate((frame) => {
      const editable = document.createElement("span");
      editable.contentEditable = "true";
      editable.textContent = "inline edit fixture";
      editable.dataset.fullscreenInputGuard = "true";
      frame.append(editable);
      editable.focus();
    });
    await page.keyboard.press("Control+Shift+f");
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await ganttRoot(page).locator('[data-fullscreen-input-guard="true"]').evaluate((element) => element.remove());

    await fullscreenButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await rowNamed(page, "Stable leaf").getByText("Stable leaf", { exact: true }).click({ button: "right" });
    await page.getByRole("menu", { name: "작업 메뉴" }).getByRole("menuitem", { name: "Edit" }).click();
    const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
    await expect(editor).toBeVisible();
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await editor.getByLabel("작업명", { exact: true }).focus();
    await page.keyboard.press("Control+Shift+f");
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await editor.getByRole("button", { name: "취소", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expectSameGanttRoot(page, identity);
    expect(fixture.posts).toHaveLength(0);
    expect(fixture.patchRequests).toHaveLength(0);
  });

  test("readonly도 전체화면을 쓰고 종료 거부는 표시 상태를 바꾸지 않으며 editor를 숨겨 열지 않는다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = false;
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    await fullscreenButton(page).evaluate((button) => {
      Object.defineProperty(button.closest(".project-gantt-frame") as HTMLElement, "requestFullscreen", { configurable: true, value: undefined });
    });
    await fullscreenButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await expect(ganttRoot(page).locator(".project-gantt-fullscreen-status")).toHaveAttribute("role", "status");
    await expect(ganttRoot(page).locator(".project-gantt-fullscreen-status")).toContainText("전체화면으로 전환하거나 종료할 수 없습니다");
    await fullscreenButton(page).evaluate((button) => { Reflect.deleteProperty(button.closest(".project-gantt-frame") as HTMLElement, "requestFullscreen"); });
    await fullscreenButton(page).evaluate((button) => {
      const frame = button.closest(".project-gantt-frame") as HTMLElement;
      Object.defineProperty(frame, "requestFullscreen", { configurable: true, value: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) });
    });
    await fullscreenButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await expect(ganttRoot(page).locator(".project-gantt-fullscreen-status")).toContainText("전체화면으로 전환하거나 종료할 수 없습니다");
    await fullscreenButton(page).evaluate((button) => { Reflect.deleteProperty(button.closest(".project-gantt-frame") as HTMLElement, "requestFullscreen"); });
    await fullscreenButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await page.evaluate(() => { Object.defineProperty(document, "exitFullscreen", { configurable: true, value: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) }); });
    await rowNamed(page, "Stable leaf").getByText("Stable leaf", { exact: true }).dblclick();
    await expect(page.getByRole("dialog", { name: "작업 정보", exact: true })).toHaveCount(0);
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await expect(ganttRoot(page).locator(".project-gantt-fullscreen-status")).toContainText("작업 정보를 열 수 없습니다");
    await page.evaluate(() => { Reflect.deleteProperty(document, "exitFullscreen"); });
    await exitButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await fullscreenButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await rowNamed(page, "Stable leaf").getByText("Stable leaf", { exact: true }).dblclick();
    const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
    await expect(editor).toBeVisible();
    expect(await editor.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    expect(fixture.posts).toHaveLength(0);
    expect(fixture.patchRequests).toHaveLength(0);
  });

  test("메뉴 Edit에서 전체 화면 종료가 거부되면 연결된 Task 대상으로 focus를 복원한다", async ({ page }) => {
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await fullscreenButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await page.evaluate(() => { Object.defineProperty(document, "exitFullscreen", { configurable: true, value: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) }); });
    const row = rowNamed(page, "Stable leaf");
    await row.getByText("Stable leaf", { exact: true }).click({ button: "right" });
    await page.getByRole("menu", { name: "작업 메뉴" }).getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: "작업 정보", exact: true })).toHaveCount(0);
    await expect.poll(() => isOwnFullscreen(page)).toBe(true);
    await expect(ganttRoot(page).locator(".project-gantt-fullscreen-status")).toContainText("작업 정보를 열 수 없습니다");
    await expect.poll(() => row.evaluate((element) => element === document.activeElement || element.contains(document.activeElement))).toBe(true);
    await page.evaluate(() => { Reflect.deleteProperty(document, "exitFullscreen"); });
    await exitButton(page).click();
    await expect.poll(() => isOwnFullscreen(page)).toBe(false);
  });
});
