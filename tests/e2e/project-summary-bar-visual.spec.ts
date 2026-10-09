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

test("Issue #375 keeps the Summary hit box while drawing a centered 60% visual bar", async ({ page }) => {
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
  await expect(taskBar(page, 4)).toHaveCount(0); // Milestone is outside the ordinary Summary/Task WBS.

  for (const width of [390, 768, 1024, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await expectSummaryGeometry(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expectSameGanttRoot(page, identity);
  }

  const { summary, summaryMetrics } = await expectSummaryGeometry(page);
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
