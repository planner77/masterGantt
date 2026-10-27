import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  deferred,
  rootAdd,
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
      const childBounds = await taskBar(page, 2).boundingBox();
      expect(childBounds).not.toBeNull();
      const childCenter = { x: childBounds!.x + childBounds!.width / 2, y: childBounds!.y + childBounds!.height / 2 };
      // Raw pointer transfer preserves the active predecessor marker geometry;
      // locator.click() may scroll and conceal this wrong-target regression.
      await page.mouse.move(childCenter.x, childCenter.y);
      await page.mouse.click(childCenter.x, childCenter.y, { button: "right" });
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

for (const coarse of [false, true]) for (const scale of ["일", "주"] as const) for (const fullscreen of [false, true]) {
  test(`Issue #818 keeps active handle targets on ${coarse ? 44 : 34}px ${scale} rows (${fullscreen ? "fullscreen" : "normal"})`, async ({ browser, baseURL }, testInfo) => {
    const context = await browser.newContext({ baseURL, hasTouch: coarse, isMobile: coarse, viewport: { width: 1440, height: 1000 } });
    try {
      const page = await context.newPage();
      const fixture = await installStatefulProjectFixture(page);
      fixture.tasks[1].type = "summary";
      fixture.tasks.push({ ...fixture.tasks[2], taskId: id(5), externalId: "NESTED-818", name: "Nested child 818", parentExternalId: fixture.tasks[1].externalId, siblingOrder: 0 });
      fixture.tasks.push({ ...fixture.tasks[0], taskId: id(6), externalId: "EMPTY-818", name: "Empty summary 818", parentExternalId: null, siblingOrder: 4, start: null, end: null, duration: null, progress: null });
      const receipts: unknown[] = [];
      for (const progress of [0, 50, 100, null]) {
        fixture.sessionEditable = progress !== null;
        for (const task of fixture.tasks.filter((entry) => [id(1), id(2), id(5)].includes(entry.taskId))) {
          task.start = "2026-01-05";
          task.end = "2026-01-05";
          task.duration = 1;
          task.progress = progress ?? 100;
        }
        await page.goto(`/projects/${publicId}`);
        await expect(page.getByText(progress === null ? "읽기 전용" : "편집 중", { exact: true })).toBeVisible();
        await expect(ganttRoot(page)).toHaveAttribute("data-gantt-cell-height", coarse ? "44" : "34");
        const identity = await rememberGanttRoot(page);
        await ganttRoot(page).getByRole("button", { name: scale, exact: true }).click();
        if (fullscreen) {
          await ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
          await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.querySelector(".project-gantt-frame"))).toBe(true);
        }
        await expectSameGanttRoot(page, identity);
        await expect(taskBar(page, 6)).toHaveCount(0);
        for (const [source, target, name] of [[1, 2, "Existing summary child"], [2, 5, "Nested child 818"]] as const) {
          const sourceBar = taskBar(page, source);
          const targetBar = taskBar(page, target);
          await sourceBar.hover();
          if (progress !== null) await expect(sourceBar.locator(".wx-progress-marker")).toHaveCSS("visibility", "visible");
          else await expect(sourceBar.locator(".wx-progress-marker")).toHaveCount(0);
          const bounds = (await targetBar.boundingBox())!;
          const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
          await page.mouse.move(center.x, center.y);
          const receipt = await targetBar.evaluate((element, point) => {
            const root = element.getBoundingClientRect();
            const row = document.querySelector(`.wx-table-container .wx-row[data-id="${element.getAttribute("data-task-id")}"]`)!.getBoundingClientRect();
            const hit = document.elementFromPoint(point.x, point.y);
            return { target: element.getAttribute("data-task-id"), hit: hit?.closest(".wx-bar")?.getAttribute("data-task-id"), root: { x: root.x, y: root.y, width: root.width, height: root.height }, centerError: Math.abs(root.y + root.height / 2 - row.y - row.height / 2) };
          }, center);
          receipts.push({ progress, source, ...receipt });
          expect(receipt.hit).toBe(`:${id(target)}`);
          expect(receipt.centerError).toBeLessThanOrEqual(1);
          await page.mouse.click(center.x, center.y, { button: "right" });
          await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
          const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
          await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(name);
          if (!coarse && scale === "주" && !fullscreen && progress === 0 && target === 2) {
            await page.screenshot({ path: "output/playwright/issue-818/correct-child-editor.png" });
          }
          await page.keyboard.press("Escape");
          await expect(editor).toHaveCount(0);
          await expectSameGanttRoot(page, identity);
        }
        if (fullscreen) {
          await ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click();
          await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
        }
      }
      expect(fixture.posts).toHaveLength(0);
      expect(fixture.patchRequests).toHaveLength(0);
      expect(fixture.project.revision).toBe(fixture.initialRevision);
      await testInfo.attach("issue-818-active-target-geometry", { body: JSON.stringify({ coarse, scale, fullscreen, receipts }), contentType: "application/json" });
    } finally {
      await context.close();
    }
  });
}

for (const height of [34, 32, 28]) test(`Issue #818/#822 preserves native Summary progress grabs and canonical restore in ${height}px rows`, async ({ page }, testInfo) => {
  const fixture = await installStatefulProjectFixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const receipts: unknown[] = [];
  for (const progress of [0, 50, 100]) {
    for (const entry of fixture.tasks.slice(0, 2)) {
      entry.start = "2026-01-05";
      entry.end = "2026-01-05";
      entry.duration = 1;
      entry.progress = progress;
    }
    await page.goto(`/projects/${publicId}`);
    for (let current = 34; current > height; current -= 2) {
      await densityWheel(page, taskBar(page, 1), 120);
      await expect(ganttRoot(page)).toHaveAttribute('data-gantt-cell-height', String(current - 2));
    }
    await ganttRoot(page).getByRole("button", { name: "주", exact: true }).click();
    const identity = await rememberGanttRoot(page);
    const summary = taskBar(page, 1);
    await summary.click();
    await expect(summary).toHaveAttribute("data-copy-selected", "true");
    await summary.focus();
    await expect(summary).toBeFocused();
    await summary.hover();
    const endpoints = await summary.locator(".wx-link").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { width: rect.width, height: rect.height, hitLink: hit?.closest(".wx-link") === element, hitTask: hit?.closest(".wx-bar")?.getAttribute("data-task-id") };
    }));
    expect(endpoints).toHaveLength(2);
    for (const endpoint of endpoints) {
      expect(endpoint.width).toBeGreaterThan(0);
      expect(endpoint.height).toBeGreaterThan(0);
      expect(endpoint.hitTask).toBe(`:${id(1)}`);
      expect(endpoint.hitLink).toBe(true);
    }
    const marker = summary.locator(".wx-progress-marker");
    await expect(marker).toHaveCSS("visibility", "visible");
    const root = (await summary.boundingBox())!;
    const markerBox = (await marker.boundingBox())!;
    // Grab the native triangular tip inside the owning bar. The part painted
    // behind the next bar is deliberately not that Summary's hit target.
    const point = { x: Math.round(markerBox.x + markerBox.width / 2), y: root.y + root.height - 2 };
    const hit = await marker.evaluate((element, position) => document.elementFromPoint(position.x, position.y) === element, point);
    expect(hit).toBe(true);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await expect(marker).toHaveClass(/wx-progress-in-drag/);
    await page.mouse.move(point.x + (progress === 100 ? -8 : 8), point.y, { steps: 4 });
    const activeLabelHit = await marker.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element;
    });
    if (progress === 0 && height === 34) await page.screenshot({ path: "output/playwright/issue-818/active-progress-target.png" });
    expect(activeLabelHit).toBe(true);
    await page.mouse.up();
    await expect(marker).not.toHaveClass(/wx-progress-in-drag/);
    // Summary progress is derived; native preview must restore rather than
    // issue a forbidden direct Summary PATCH or change an adjacent task.
    await expect(marker).toHaveText(String(progress));
    await expectSameGanttRoot(page, identity);
    const canonicalBeforeNativePreviews = JSON.stringify(fixture.tasks);
    for (const operation of ["body", "right-edge"]) {
      if (operation === "right-edge") await ganttRoot(page).getByRole("button", { name: "일", exact: true }).click();
      const before = (await summary.boundingBox())!;
      const start = { x: operation === "body" ? before.x + before.width / 2 : before.x + before.width - 2, y: before.y + before.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await expect(marker).not.toHaveClass(/wx-progress-in-drag/);
      await page.mouse.move(start.x + 68, start.y, { steps: 4 });
      await page.mouse.up();
      // Core intentionally treats Summary edges as moves, not resize.
      // Baseline and corrected CSS preview this exact native-only movement.
      await expect.poll(async () => {
        const after = (await summary.boundingBox())!;
        return after.x - before.x;
      }).toBe(68);
      await expect(marker).toHaveText(String(progress));
      expect(JSON.stringify(fixture.tasks)).toBe(canonicalBeforeNativePreviews);
      await expectSameGanttRoot(page, identity);
    }
    receipts.push({ progress, point, markerHeight: markerBox.height, hit, activeLabelHit, endpoints });
  }
  expect(fixture.patchRequests).toHaveLength(0);
  expect(fixture.posts).toHaveLength(0);
  expect(fixture.project.revision).toBe(fixture.initialRevision);
  await testInfo.attach("issue-818-summary-progress-grabs", { body: JSON.stringify(receipts), contentType: "application/json" });
});

async function densityWheel(page: Page, surface: Locator, delta: number, tail = false) {
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + Math.min(box!.width / 2, 100), box!.y + box!.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, delta);
  if (tail) await surface.dispatchEvent('wheel', { ctrlKey: true, deltaY: Math.sign(delta), bubbles: true, cancelable: true });
  await page.keyboard.up("Control");
}

test("Issue #822 synchronizes native Grid/Chart density, preserves geometry and owns only body Ctrl wheel", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await installStatefulProjectFixture(page);
  for (let n = 5; n < 100; n++) fixture.tasks.push({ ...fixture.tasks[2], taskId: id(n), externalId: `DENSITY-${n}`, name: `긴 작업 이름과 English task density ${n}`, siblingOrder: n });
  await page.goto(`/projects/${publicId}`);
  const root = ganttRoot(page);
  const identity = await rememberGanttRoot(page);
  const row = root.locator(`.wx-table .wx-row[data-id=":${id(2)}"]`);
  const body = taskBar(page, 2);
  await expect(root).toHaveAttribute("data-gantt-cell-height", "34");
  const measure = async () => {
    const [summary, ordinary, grid] = await Promise.all([barMetrics(taskBar(page, 1)), barMetrics(taskBar(page, 2)), row.boundingBox()]);
    return { summary, ordinary, row: grid!, font: await row.locator('.wx-text').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize)),
      visible: await root.locator('.wx-table .wx-row[data-id]').evaluateAll(rows => rows.filter(row => { const box = row.getBoundingClientRect(), owner = row.closest('.wx-gantt')?.getBoundingClientRect(); return owner && box.top >= owner.top && box.bottom <= owner.bottom; }).length),
      left: await root.locator('.wx-chart').first().evaluate(element => element.scrollLeft) };
  };
  const baseline = await measure();
  const receipts = [baseline];
  await testInfo.attach('issue-822-before', { body: await page.screenshot(), contentType: 'image/png' });
  for (const [level, height] of [32, 30, 28].entries()) {
    await densityWheel(page, level % 2 === 0 ? row : body, 120);
    await expect(root).toHaveAttribute("data-gantt-cell-height", String(height));
    await expect.poll(async () => (await row.boundingBox())?.height).toBe(height);
    const current = await measure(); receipts.push(current);
    expect(current.font).toBeLessThan(receipts[receipts.length - 2].font);
    expect(current.font).toBeGreaterThanOrEqual(12);
    expect(current.ordinary.rootHeight).toBeLessThan(receipts[receipts.length - 2].ordinary.rootHeight);
    expect(current.summary.visualHeight / current.ordinary.rootHeight).toBeGreaterThanOrEqual(0.55);
    expect(current.summary.visualHeight / current.ordinary.rootHeight).toBeLessThanOrEqual(0.7);
    expect(Math.abs(current.row.y + current.row.height / 2 - current.ordinary.rootY - current.ordinary.rootHeight / 2)).toBeLessThanOrEqual(1);
    expect(current.ordinary.rootX).toBeCloseTo(baseline.ordinary.rootX, 0);
    expect(current.ordinary.rootWidth).toBeCloseTo(baseline.ordinary.rootWidth, 0);
    expect(current.left).toBe(baseline.left);
    await expectSameGanttRoot(page, identity);
  }
  expect(receipts.at(-1)!.visible).toBeGreaterThan(baseline.visible);
  await testInfo.attach('issue-822-minimum', { body: await page.screenshot(), contentType: 'image/png' });
  await densityWheel(page, row, 1200);
  await expect(root).toHaveAttribute("data-gantt-cell-height", "28");
  // Native marker hit-test and neighboring body context remain distinct at minimum density.
  await taskBar(page, 1).hover();
  const child = await taskBar(page, 2).boundingBox();
  await page.mouse.click(child!.x + child!.width / 2, child!.y + child!.height / 2, { button: 'right' });
  await expect(page.getByRole('menu', { name: '작업 메뉴' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '작업 정보', exact: true });
  await expect(editor.getByLabel('작업명', { exact: true })).toHaveValue('Existing summary child');
  await densityWheel(page, editor.getByLabel('작업명', { exact: true }), -120);
  await expect(root).toHaveAttribute('data-gantt-cell-height', '28');
  await page.keyboard.press('Escape');
  const checkbox = row.locator('input[type="checkbox"]');
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await densityWheel(page, checkbox, -120);
  await expect(root).toHaveAttribute("data-gantt-cell-height", "28");
  await root.getByRole('button', { name: '주', exact: true }).click();
  await expect(root).toHaveAttribute('data-gantt-scale-mode', 'week');
  await expect(root).toHaveAttribute("data-gantt-cell-height", "28");
  await root.getByRole('button', { name: '일', exact: true }).click();
  for (const height of [30, 32, 34]) {
    await densityWheel(page, row, -120);
    await expect(root).toHaveAttribute("data-gantt-cell-height", String(height));
  }
  await densityWheel(page, body, -1200);
  await expect(root).toHaveAttribute("data-gantt-cell-height", "34");
  const restored = await measure();
  expect(restored.row.height).toBe(baseline.row.height);
  expect(restored.font).toBe(baseline.font);
  expect(restored.ordinary.rootHeight).toBe(baseline.ordinary.rootHeight);
  await expectSameGanttRoot(page, identity);
  expect(fixture.posts).toHaveLength(0);
  expect(fixture.patchRequests).toHaveLength(0);
  await testInfo.attach('issue-822-restored', { body: await page.screenshot(), contentType: 'image/png' });
  await testInfo.attach('issue-822-density-dom', { body: JSON.stringify({ viewport: page.viewportSize(), environment: await page.evaluate(() => ({ dpr: devicePixelRatio, locale: navigator.language, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches })), receipts, restored }), contentType: 'application/json' });
});

test("Issue #822 keeps a virtual middle-row anchor through bursts and state transitions", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await installStatefulProjectFixture(page);
  for (let n = 5; n < 130; n++) fixture.tasks.push({ ...fixture.tasks[2], taskId: id(n), externalId: `ANCHOR-${n}`, name: `한국어 Long English anchor task ${n}`, siblingOrder: n });
  await page.goto(`/projects/${publicId}`);
  const root = ganttRoot(page), identity = await rememberGanttRoot(page);
  const vertical = root.locator('.wx-gantt').first();
  const row = root.locator(`.wx-table .wx-row[data-id=":${id(2)}"]`);
  await row.hover();
  await page.mouse.wheel(0, 1600);
  await expect.poll(() => vertical.evaluate(element => element.scrollTop)).toBeGreaterThan(1200);
  const readAnchor = () => root.locator('.wx-table .wx-row[data-id]').evaluateAll(rows => {
    const viewport = document.querySelector('.project-gantt-widget .wx-gantt')!.getBoundingClientRect();
    const candidate = rows.map(row => ({ id: row.getAttribute('data-id')!, box: row.getBoundingClientRect() }))
      .filter(({ box }) => box.top > viewport.top + 100 && box.bottom < viewport.bottom - 100)
      .sort((a, b) => Math.abs(a.box.y + a.box.height / 2 - viewport.y - viewport.height / 2) - Math.abs(b.box.y + b.box.height / 2 - viewport.y - viewport.height / 2))[0];
    return candidate ? { id: candidate.id, offset: candidate.box.top + candidate.box.height / 2 - viewport.top } : null;
  });
  await expect.poll(readAnchor).not.toBeNull();
  const anchor = (await readAnchor())!;
  const anchorRow = root.locator(`.wx-table .wx-row[data-id="${anchor.id}"]`);
  const anchorOffset = () => anchorRow.evaluate(element => {
    const box = element.getBoundingClientRect(), viewport = document.querySelector('.project-gantt-widget .wx-gantt')!.getBoundingClientRect();
    return box.top + box.height / 2 - viewport.top;
  });
  const receipts: unknown[] = [];
  for (const height of [32, 30, 28, 30, 32, 34]) {
    await densityWheel(page, anchorRow, height < Number(await root.getAttribute('data-gantt-cell-height')) ? 120 : -120, true);
    await expect(root).toHaveAttribute('data-gantt-cell-height', String(height));
    // Residual high-resolution tail events belong to the same density lease.
    await expect.poll(async () => Math.abs(await anchorOffset() - anchor.offset)).toBeLessThanOrEqual(1);
    receipts.push({ height, offset: await anchorOffset(), scrollTop: await vertical.evaluate(element => element.scrollTop) });
    await expectSameGanttRoot(page, identity);
  }
  await densityWheel(page, anchorRow, 120);
  await expect(root).toHaveAttribute('data-gantt-cell-height', '32');
  await expect.poll(async () => Math.abs(await anchorOffset() - anchor.offset)).toBeLessThanOrEqual(1);
  // Fullscreen, peer dashboard and scale retain the same local density/instance.
  await root.getByRole('button', { name: '주', exact: true }).click();
  await expect(root).toHaveAttribute('data-gantt-cell-height', '32');
  await root.getByRole('button', { name: 'Gantt 전체 화면', exact: true }).click();
  await expect(root.getByRole('button', { name: 'Gantt 전체 화면 종료', exact: true })).toBeVisible();
  await expect(root).toHaveAttribute('data-gantt-cell-height', '32');
  await root.getByRole('button', { name: 'Gantt 전체 화면 종료', exact: true }).click();
  await page.getByRole('tab', { name: '대시보드', exact: true }).click();
  await page.getByRole('tab', { name: '일정', exact: true }).click();
  await expect(root).toHaveAttribute('data-gantt-cell-height', '32');
  await expectSameGanttRoot(page, identity);
  expect(fixture.posts).toHaveLength(0);
  expect(fixture.patchRequests).toHaveLength(0);
  await testInfo.attach('issue-822-anchor-dom', { body: JSON.stringify({ anchor, receipts }), contentType: 'application/json' });
});

test("Issue #822 scopes cancellation and clamps hybrid/coarse changes without resetting the instance", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    const lists: MediaQueryList[] = [];
    let override: { coarse: boolean; hybrid: boolean } | null = null;
    const apply = (list: MediaQueryList) => {
      if (!override) return;
      const matches = override.coarse && (!override.hybrid || list.media === '(any-pointer: coarse)');
      Object.defineProperty(list, 'matches', { configurable: true, value: matches });
    };
    window.matchMedia = (query: string) => {
      const list = original(query);
      if (query === '(pointer: coarse)' || query === '(any-pointer: coarse)') {
        lists.push(list);
        apply(list);
      }
      return list;
    };
    Object.assign(window, { setDensityTouch: (coarse: boolean, hybrid = false) => {
      override = { coarse, hybrid };
      for (const list of lists) {
        apply(list);
        list.dispatchEvent(new MediaQueryListEvent('change', { matches: list.matches, media: list.media }));
      }
    } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  const root = ganttRoot(page), identity = await rememberGanttRoot(page);
  const row = root.locator(`.wx-row[data-id=":${id(2)}"]`);
  for (const height of [32, 30, 28]) { await densityWheel(page, row, 120); await expect(root).toHaveAttribute('data-gantt-cell-height', String(height)); }
  const cancellation = await page.evaluate(() => {
    const result: Record<string, boolean> = {};
    for (const [key, selector, ctrlKey] of [['body', '.wx-table .wx-row[data-id]', true], ['ordinary', '.wx-table .wx-row[data-id]', false], ['header', '.wx-scale', true], ['outside', 'main h1', true], ['input', '.wx-row input', true]] as const) {
      const target = document.querySelector(selector);
      if (!target) throw new Error(`Missing cancellation target ${key}`);
      const event = new WheelEvent('wheel', { ctrlKey, deltaY: 1, bubbles: true, cancelable: true });
      target.dispatchEvent(event); result[key] = event.defaultPrevented;
    }
    return result;
  });
  expect(cancellation).toEqual({ body: true, ordinary: false, header: false, outside: false, input: false });
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(row).toHaveCSS('height', '28px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.focus(); await expect(checkbox).toBeFocused();
  }
  // Hybrid: the primary mouse stays fine while a secondary touch pointer is coarse.
  await page.evaluate(() => (window as unknown as { setDensityTouch(value: boolean, hybrid?: boolean): void }).setDensityTouch(true, true));
  await expect(root).toHaveAttribute('data-gantt-cell-height', '44');
  expect(await page.evaluate(() => [matchMedia('(pointer: coarse)').matches, matchMedia('(any-pointer: coarse)').matches])).toEqual([false, true]);
  const currentTarget = await row.locator('.project-copy-selection-hitarea').boundingBox();
  const nextTarget = await root.locator(`.wx-row[data-id=":${id(3)}"] .project-copy-selection-hitarea`).boundingBox();
  expect(currentTarget!.height).toBeGreaterThanOrEqual(44);
  expect(currentTarget!.y + currentTarget!.height).toBeLessThanOrEqual(nextTarget!.y + 0.01);
  await page.evaluate(() => (window as unknown as { setDensityTouch(value: boolean): void }).setDensityTouch(true));
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  await densityWheel(page, row, 1200);
  await expect(root).toHaveAttribute('data-gantt-cell-height', '44');
  expect((await row.locator('.project-copy-selection-hitarea').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.evaluate(() => (window as unknown as { setDensityTouch(value: boolean): void }).setDensityTouch(false));
  await expect(root).toHaveAttribute('data-gantt-cell-height', '34');
  await expectSameGanttRoot(page, identity);
  expect(fixture.patchRequests).toHaveLength(0);
});

test("Issue #822 preserves collapsed tree, selection, custom columns and cancellable inline editing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  const root = ganttRoot(page), identity = await rememberGanttRoot(page);
  const summary = root.locator(`.wx-row[data-id=":${id(1)}"]`);
  const toggle = summary.locator('[data-action="open-task"]');
  await toggle.click();
  await expect(toggle).toHaveClass(/wxi-menu-right/);
  const leaf = root.locator(`.wx-row[data-id=":${id(3)}"]`);
  await leaf.locator('[data-col-id=":projectStart"]').click();
  await expect(leaf).toHaveClass(/wx-selected/);
  const header = root.locator('.wx-table-container .wx-header').first();
  await header.click({ button: 'right' });
  const columns = page.locator('.project-column-menu');
  await columns.getByRole('checkbox', { name: '외부 ID', exact: true }).check();
  await columns.getByRole('checkbox', { name: '기간', exact: true }).uncheck();
  await page.keyboard.press('Escape');
  for (const height of [32, 30, 28]) {
    await densityWheel(page, leaf, 120);
    await expect(root).toHaveAttribute('data-gantt-cell-height', String(height));
    await expect(toggle).toHaveClass(/wxi-menu-right/);
    await expect(root.locator(`.wx-row[data-id=":${id(2)}"]`)).toHaveCount(0);
    await expect(root.locator(`.wx-row[data-id=":${id(4)}"]`)).toHaveCount(0);
    await expect(leaf).toHaveClass(/wx-selected/);
    await expect(header.getByText('외부 ID', { exact: true })).toBeVisible();
    await expect(header.getByText('기간', { exact: true })).toHaveCount(0);
  }
  await leaf.locator('[data-col-id=":text"] .wx-content > .wx-text').click();
  const input = leaf.locator('.wx-cell.wx-editor input.wx-text');
  await expect(input).toBeFocused();
  await input.fill('미저장 초안');
  await densityWheel(page, input, -120);
  await expect(root).toHaveAttribute('data-gantt-cell-height', '28');
  await expect(input).toHaveValue('미저장 초안');
  await input.press('Escape');
  await expect(leaf.locator('[data-col-id=":text"]')).toBeFocused();
  await expect(leaf).toContainText('Stable leaf');
  await expectSameGanttRoot(page, identity);
  expect(fixture.patchRequests).toHaveLength(0);
  expect(fixture.posts).toHaveLength(0);
});

test("Issue #822 pauses density while a canonical mutation owns row geometry", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  const root = ganttRoot(page), identity = await rememberGanttRoot(page);
  const row = root.locator(`.wx-row[data-id=":${id(2)}"]`);
  await densityWheel(page, row, 120);
  await expect(root).toHaveAttribute('data-gantt-cell-height', '32');
  const gate = deferred(), started = deferred();
  fixture.nextPost = { kind: 'success', gate, started };
  await rootAdd(page).click(); await started.promise;
  await expect(root).toHaveAttribute('data-task-mutation-locked', 'true');
  await densityWheel(page, row, 120);
  await expect(root).toHaveAttribute('data-gantt-cell-height', '32');
  expect(fixture.posts).toHaveLength(1);
  gate.resolve();
  await expect(root).not.toHaveAttribute('data-task-mutation-locked', 'true');
  await densityWheel(page, row, 120);
  await expect(root).toHaveAttribute('data-gantt-cell-height', '30');
  await expectSameGanttRoot(page, identity);
  expect(fixture.posts).toHaveLength(1);
  expect(fixture.patchRequests).toHaveLength(0);
});
