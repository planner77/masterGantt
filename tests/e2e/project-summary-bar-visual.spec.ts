import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectSameGanttRoot,
  ganttRoot,
  installStatefulProjectFixture,
  publicId,
  rememberGanttRoot,
} from "../fixtures/stateful-project";

const id = (ordinal: number) => `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;
const taskBar = (page: Page, ordinal: number) =>
  ganttRoot(page).locator(`.project-gantt-widget .wx-bar[data-task-id=":${id(ordinal)}"]`);

type BarMetrics = Readonly<{
  rootX: number;
  rootY: number;
  rootWidth: number;
  rootHeight: number;
  visualTop: number;
  visualWidth: number;
  visualHeight: number;
  progressTop: number | null;
  progressHeight: number | null;
}>;

async function barMetrics(bar: Locator): Promise<BarMetrics> {
  return bar.evaluate((element) => {
    const root = element.getBoundingClientRect();
    const visual = getComputedStyle(element, "::before");
    const progress = element.querySelector<HTMLElement>(".wx-progress-wrapper");
    const progressRect = progress?.getBoundingClientRect() ?? null;
    return {
      rootX: root.x,
      rootY: root.y,
      rootWidth: root.width,
      rootHeight: root.height,
      visualTop: Number.parseFloat(visual.top),
      visualWidth: Number.parseFloat(visual.width),
      visualHeight: Number.parseFloat(visual.height),
      progressTop: progressRect ? progressRect.top - root.top : null,
      progressHeight: progressRect?.height ?? null,
    };
  });
}

async function expectSummaryGeometry(page: Page) {
  const summary = taskBar(page, 1);
  const task = taskBar(page, 2);
  await expect(summary).toHaveClass(/wx-summary/);
  await expect(task).toHaveClass(/wx-task/);

  const summaryMetrics = await barMetrics(summary);
  const taskMetrics = await barMetrics(task);
  const ratio = summaryMetrics.visualHeight / taskMetrics.rootHeight;
  const summaryRow = ganttRoot(page).locator(`.project-gantt-widget .wx-table-container .wx-row[data-id=":${id(1)}"]`);
  const taskRow = ganttRoot(page).locator(`.project-gantt-widget .wx-table-container .wx-row[data-id=":${id(2)}"]`);
  const [summaryRowBounds, taskRowBounds] = await Promise.all([summaryRow.boundingBox(), taskRow.boundingBox()]);
  expect(summaryRowBounds).not.toBeNull();
  expect(taskRowBounds).not.toBeNull();
  // #816: desktop 34px row, shorter ordinary Task; #375 Summary remains 60%.
  expect(summaryRowBounds!.height).toBeCloseTo(34, 0);
  expect(taskRowBounds!.height).toBeCloseTo(34, 0);
  expect(taskMetrics.rootHeight).toBeGreaterThanOrEqual(25);
  expect(taskMetrics.rootHeight).toBeLessThanOrEqual(29);
  expect(summaryMetrics.visualHeight).toBeLessThan(taskMetrics.rootHeight);
  expect(Math.abs(summaryMetrics.rootY + summaryMetrics.rootHeight / 2 - summaryRowBounds!.y - summaryRowBounds!.height / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(taskMetrics.rootY + taskMetrics.rootHeight / 2 - taskRowBounds!.y - taskRowBounds!.height / 2)).toBeLessThanOrEqual(1);
  expect(summaryMetrics.rootHeight).toBeCloseTo(taskMetrics.rootHeight, 0);
  expect(ratio).toBeGreaterThanOrEqual(0.55);
  expect(ratio).toBeLessThanOrEqual(0.70);
  expect(summaryMetrics.visualTop + summaryMetrics.visualHeight / 2).toBeCloseTo(summaryMetrics.rootHeight / 2, 0);
  expect(summaryMetrics.visualWidth).toBeCloseTo(summaryMetrics.rootWidth, 0);
  expect(summaryMetrics.rootX).toBeCloseTo(taskMetrics.rootX, 0);
  expect(summaryMetrics.rootWidth).toBeCloseTo(taskMetrics.rootWidth, 0);
  expect(summaryMetrics.progressTop).not.toBeNull();
  expect(summaryMetrics.progressHeight).not.toBeNull();
  expect(summaryMetrics.progressTop!).toBeCloseTo(summaryMetrics.visualTop, 0);
  expect(summaryMetrics.progressHeight!).toBeCloseTo(summaryMetrics.visualHeight, 0);

  return { summary, summaryMetrics };
}

test("Issue #375 keeps the Summary hit box while drawing a centered 60% visual bar", async ({ page }, testInfo) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.tasks.push({
    ...fixture.tasks[0],
    taskId: id(5),
    externalId: "EMPTY-SUMMARY-375",
    name: "Empty summary 375",
    requestedStart: null,
    start: null,
    end: null,
    duration: null,
    progress: null,
    parentExternalId: null,
    siblingOrder: 3,
  });

  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  await expect(page.getByRole("grid").getByText("Empty summary 375", { exact: true })).toBeVisible();
  await expect(taskBar(page, 5)).toHaveCount(0);
  await expect(taskBar(page, 4)).toHaveCount(0); // #552: canonical Milestone is not a native WBS bar.

  for (const width of [390, 768, 1024, 1440, 1600, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expectSummaryGeometry(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expectSameGanttRoot(page, identity);
  }

  const { summary, summaryMetrics } = await expectSummaryGeometry(page);
  await testInfo.attach("issue-816-summary-task-geometry", {
    body: JSON.stringify({
      cellHeight: await ganttRoot(page).getAttribute("data-gantt-cell-height"),
      summary: summaryMetrics,
      task: await barMetrics(taskBar(page, 2)),
      viewport: page.viewportSize(),
    }),
    contentType: "application/json",
  });
  const transparentStripY = Math.max(1, Math.floor(summaryMetrics.visualTop / 2));
  await summary.click({
    button: "right",
    position: { x: Math.max(2, Math.floor(summaryMetrics.rootWidth / 2)), y: transparentStripY },
  });
  await expect(page.getByRole("menu", { name: "작업 메뉴" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "작업 메뉴" })).toHaveCount(0);

  await ganttRoot(page).getByRole("button", { name: "주", exact: true }).click();
  await expect(ganttRoot(page)).toHaveAttribute("data-gantt-scale-mode", "week");
  await expectSummaryGeometry(page);
  await expectSameGanttRoot(page, identity);

  await page.setViewportSize({ width: 1024, height: 900 });
  await ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.querySelector(".project-gantt-frame"))).toBe(true);
  await expectSummaryGeometry(page);
  await expectSameGanttRoot(page, identity);
  await ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);

  fixture.sessionEditable = false;
  await page.reload();
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await expectSummaryGeometry(page);
  await expect(taskBar(page, 5)).toHaveCount(0);
  expect(fixture.posts).toHaveLength(0);
  expect(fixture.patchRequests).toHaveLength(0);
});

test("Issue #816 keeps the 44px coarse-pointer checkbox target within its own row", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 900 },
  });
  try {
    const page = await context.newPage();
    const fixture = await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect.poll(() => page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(true);
    await expect(ganttRoot(page)).toHaveAttribute("data-gantt-cell-height", "44");
    const row = ganttRoot(page).locator(`.wx-table-container .wx-row[data-id=":${id(2)}"]`);
    const label = row.locator(".project-copy-selection-hitarea");
    await expect(label).toBeVisible();
    const [rowBounds, targetBounds] = await Promise.all([row.boundingBox(), label.boundingBox()]);
    expect(rowBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();
    expect(rowBounds!.height).toBeGreaterThanOrEqual(44);
    expect(targetBounds!.height).toBeGreaterThanOrEqual(44);
    await label.tap();
    await expect(label.locator("input[data-copy-selection]")).toBeChecked();
    const checkbox = label.locator("input[data-copy-selection]");
    const selection = page.getByRole("group", { name: "복사 대상 선택" });
    await expect(selection).toContainText("선택 1개");
    // Label padding must forward exactly one native activation, just like the input.
    await label.tap({ position: { x: 3, y: 3 } });
    await expect(checkbox).not.toBeChecked();
    await expect(selection).toContainText("선택 0개");
    await checkbox.tap();
    await expect(checkbox).toBeChecked();
    await expect(selection).toContainText("선택 1개");
    await label.tap({ position: { x: 3, y: 3 } });
    await expect(checkbox).not.toBeChecked();
    await expect(row).toHaveAttribute("aria-selected", "false");
    await expect(ganttRoot(page).locator("input[data-copy-selection]:checked")).toHaveCount(0);
    fixture.sessionEditable = false;
    await page.reload();
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    await label.tap({ position: { x: 3, y: 3 } });
    await expect(checkbox).toBeChecked();
    await expect(selection).toContainText("선택 1개");
    expect(fixture.posts).toHaveLength(0);
    expect(fixture.patchRequests).toHaveLength(0);
  } finally {
    await context.close();
  }
});

for (const coarse of [false, true]) test(`Issue #816 keeps inactive progress handles out of neighboring ${coarse ? "44px touch" : "34px pointer"} row hits`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: coarse, isMobile: coarse, viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    const fixture = await installStatefulProjectFixture(page);
    fixture.tasks[0].progress = 50;
    fixture.tasks[1].progress = 50;
    await page.goto(`/projects/${publicId}`);
    await expect(ganttRoot(page)).toHaveAttribute("data-gantt-cell-height", coarse ? "44" : "34");
    for (const scale of ["일", "주"]) {
      await ganttRoot(page).getByRole("button", { name: scale, exact: true }).click();
      for (const ordinal of [1, 2]) {
        const bar = taskBar(page, ordinal);
        await expect(bar).toBeVisible();
        await page.mouse.move(10, 10);
        const geometry = await bar.evaluate((element) => {
          const root = element.getBoundingClientRect();
          const marker = element.querySelector<HTMLElement>(".wx-progress-marker")!;
          const handle = marker.getBoundingClientRect();
          const hit = document.elementFromPoint(root.x + root.width / 2, root.y + root.height / 2);
          return { handleHeight: handle.height, hitTask: hit?.closest(".wx-bar")?.getAttribute("data-task-id") };
        });
        expect(geometry.handleHeight).toBe(26);
        expect(geometry.hitTask).toBe(`:${id(ordinal)}`);
        if (!coarse) {
          await bar.hover();
          await expect(bar.locator(".wx-progress-marker")).toHaveCSS("opacity", "1");
          await expect(bar.locator(".wx-progress-marker")).toHaveCSS("visibility", "visible");
        }
      }
    }
    expect(fixture.patchRequests).toHaveLength(0);
    expect(fixture.posts).toHaveLength(0);
    if (!coarse) {
      // An active predecessor handle can overlap this narrow Week bar. A real
      // pointer transfer must still open the following Task, not its Summary.
      for (const entry of fixture.tasks.slice(0, 2)) {
        entry.start = "2026-01-05";
        entry.end = "2026-01-05";
        entry.duration = 1;
        entry.progress = 0;
      }
      await page.reload();
      await ganttRoot(page).getByRole("button", { name: "주", exact: true }).click();
      await taskBar(page, 1).hover();
      await expect(taskBar(page, 1).locator(".wx-progress-marker")).toHaveCSS("visibility", "visible");
      await taskBar(page, 2).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
      await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Existing summary child");
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);
    }
    fixture.sessionEditable = false;
    await page.reload();
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(ganttRoot(page).locator(".wx-progress-marker")).toHaveCount(0);
    expect(fixture.patchRequests).toHaveLength(0);
  } finally {
    await context.close();
  }
});
