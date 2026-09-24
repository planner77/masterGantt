import { expect, test, type Locator, type Page } from "@playwright/test";

const publicId = "42000000-0000-4000-8000-000000000142";
const taskId = (ordinal: number) => `42000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;

type Box = { x: number; width: number };

function task(ordinal: number, name: string, start: string, end = start, type = "task", parentExternalId: string | null = null, duration = 1) {
  return {
    taskId: taskId(ordinal), externalId: `GEOMETRY-${ordinal}`, name, type,
    scheduleMode: "auto", requestedStart: type === "summary" ? null : start,
    start, end, duration: type === "milestone" ? 0 : duration, progress: ordinal === 20 ? 25 : 0,
    parentExternalId, siblingOrder: ordinal,
  };
}

const tasks = [
  task(1, "Geometry summary", "2026-09-14", "2026-09-18", "summary", null, 5),
  task(2, "Summary child Monday", "2026-09-14", "2026-09-16", "task", "GEOMETRY-1", 3),
  task(3, "Summary child Thursday", "2026-09-17", "2026-09-18", "task", "GEOMETRY-1", 2),
  task(10, "Monday ruler", "2026-09-14"),
  task(11, "Tuesday ruler", "2026-09-15"),
  task(12, "Wednesday ruler", "2026-09-16"),
  task(13, "Thursday ruler", "2026-09-17"),
  task(14, "Friday ruler", "2026-09-18"),
  task(17, "Next Monday ruler", "2026-09-21"),
  task(18, "Next Tuesday ruler", "2026-09-22"),
  task(20, "Spanning task", "2026-09-18", "2026-09-22", "task", null, 3),
  task(30, "Monday milestone", "2026-09-14", "2026-09-14", "milestone"),
  task(31, "Thursday milestone", "2026-09-17", "2026-09-17", "milestone"),
  task(40, "Scroll range anchor", "2026-12-01"),
];

const bar = (page: Page, ordinal: number) => page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${taskId(ordinal)}"]`);

async function box(locator: Locator): Promise<Box> {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return { x: bounds!.x, width: bounds!.width };
}

function closeTo(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

async function scaleCells(page: Page): Promise<Box[]> {
  return page.locator(".project-gantt-widget .wx-scale .wx-row").last().locator(".wx-cell").evaluateAll((cells) =>
    cells.map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.x, width: rect.width };
    }),
  );
}

function containingCell(cells: Box[], center: number): Box {
  const cell = cells.find(({ x, width }) => x <= center && center < x + width);
  expect(cell).toBeDefined();
  return cell!;
}

test("Task and Summary span included dates at four widths in day and week views", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) mutations.push(request.url());
  });
  await page.route(`**/api/projects/${publicId}`, (route) => route.fulfill({ json: { data: {
    project: {
      publicId, name: "Issue 142 geometry fixture", description: "Date-only geometry",
      status: "planned", revision: 1,
      calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
    },
    tasks, links: [], permission: "readonly",
  } } }));
  await page.route(`**/api/projects/${publicId}/edit-sessions/current`, (route) => route.fulfill({ json: { data: { permission: "readonly" } } }));

  await page.goto(`/projects/${publicId}`);
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  expect(instance).toBeTruthy();
  expect(apiInstance).toBeTruthy();
  const markerOffsets: Array<{ width: number; mode: "day" | "week"; monday: number; thursday: number }> = [];

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ["day", "week"] as const) {
      await page.getByRole("group", { name: "Gantt 표시 단위" }).getByRole("button", { name: mode === "day" ? "일" : "주", exact: true }).click();
      await expect(frame).toHaveAttribute("data-gantt-scale-mode", mode);
      const weekCells = page.locator(".project-gantt-widget .wx-scale .wx-row").last().locator(".wx-cell").filter({ hasText: /W\d{1,2}/ });
      if (mode === "week") await expect(weekCells.first()).toBeVisible();
      else await expect(weekCells).toHaveCount(0);
      await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
      await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
      const cells = await scaleCells(page);
      expect(cells.length).toBeGreaterThan(0);
      const monday = await box(bar(page, 10));
      const thursday = await box(bar(page, 13));
      const friday = await box(bar(page, 14));
      const nextMonday = await box(bar(page, 17));
      const nextTuesday = await box(bar(page, 18));
      const summary = await box(bar(page, 1));
      const spanning = await box(bar(page, 20));
      const mondayMilestone = await box(bar(page, 30));
      const thursdayMilestone = await box(bar(page, 31));

      closeTo(summary.x, monday.x);
      closeTo(summary.x + summary.width, friday.x + friday.width);
      closeTo(spanning.x, friday.x);
      closeTo(spanning.x + spanning.width, nextTuesday.x + nextTuesday.width);
      // Record the known Core limitation without treating a displaced marker as PASS.
      markerOffsets.push({
        width, mode,
        monday: mondayMilestone.x + mondayMilestone.width / 2 - (monday.x + monday.width / 2),
        thursday: thursdayMilestone.x + thursdayMilestone.width / 2 - (thursday.x + thursday.width / 2),
      });

      if (mode === "day") {
        const dayCell = containingCell(cells, monday.x + monday.width / 2);
        closeTo(monday.x, dayCell.x);
        closeTo(monday.width, dayCell.width);
      } else {
        // Installed Willow/Core en locale starts the scale week on Sunday.
        const weekCell = containingCell(cells, monday.x + monday.width / 2);
        const nextWeekCell = containingCell(cells, nextMonday.x + nextMonday.width / 2);
        closeTo(monday.x - weekCell.x, weekCell.width / 7);
        closeTo(nextMonday.x - nextWeekCell.x, nextWeekCell.width / 7);
        expect(thursday.x + thursday.width / 2).toBeLessThan(weekCell.x + weekCell.width);
        closeTo(monday.width, weekCell.width / 7);
        closeTo(thursday.x - weekCell.x, weekCell.width * 4 / 7);
      }

      const chart = page.locator('.project-gantt-widget .wx-chart[tabindex="-1"]');
      const beforeScroll = await chart.evaluate((element) => element.scrollLeft);
      await chart.evaluate((element) => { element.scrollLeft += 120; });
      await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBeGreaterThan(beforeScroll);
      const afterScroll = await chart.evaluate((element) => element.scrollLeft);
      const mondayScrolled = await box(bar(page, 10));
      closeTo(mondayScrolled.x - monday.x, beforeScroll - afterScroll);
      const chartBounds = await chart.boundingBox();
      expect(chartBounds).not.toBeNull();
      const renderedCells = await scaleCells(page);
      let alignedRenderedAnchor = false;
      for (const [ordinal, dayFromSunday] of [[10, 1], [11, 2], [12, 3], [13, 4], [14, 5], [17, 1], [18, 2]]) {
        const ruler = await box(bar(page, ordinal));
        const center = ruler.x + ruler.width / 2;
        if (center < chartBounds!.x || center >= chartBounds!.x + chartBounds!.width) continue;
        const cell = renderedCells.find(({ x, width: cellWidth }) => x <= center && center < x + cellWidth);
        if (!cell) continue;
        closeTo(ruler.x - cell.x, mode === "day" ? 0 : cell.width * dayFromSunday / 7);
        alignedRenderedAnchor = true;
        break;
      }
      expect(alignedRenderedAnchor).toBe(true);
      await chart.evaluate((element) => { element.scrollLeft = 0; });
    }
  }
  await test.info().attach("native-milestone-date-center-offsets.json", {
    body: JSON.stringify(markerOffsets, null, 2), contentType: "application/json",
  });
  expect(mutations).toEqual([]);
});

test.fixme("Milestone centers must match the included date's day-cell center", () => {
  // Installed SVAR Core 2.7.3 centers the diamond at its start-date boundary.
  // Reuse the ruler bars above when a supported per-Milestone geometry hook exists.
});
