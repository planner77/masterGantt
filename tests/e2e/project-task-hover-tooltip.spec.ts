import { expect, test, type Locator, type Page } from "@playwright/test";

import { waitForGanttReadiness } from "./helpers/gantt-readiness";

import {
  ganttRoot,
  installStatefulProjectFixture,
  publicId,
  rowNamed,
} from "../fixtures/stateful-project";

const id = (ordinal: number) => `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;
const taskBar = (page: Page, ordinal: number) =>
  ganttRoot(page).locator(`.project-gantt-widget .wx-bar[data-task-id=":${id(ordinal)}"]`);
const tooltip = (page: Page) => page.locator(".project-task-hover-tooltip-content").last();

async function setTooltipDensity(page: Page, height: number) {
  const frame = ganttRoot(page);
  for (let current = Number(await frame.getAttribute("data-gantt-cell-height")); current > height; current -= 2) {
    const row = rowNamed(page, "Existing summary child");
    const box = await row.boundingBox();
    if (!box) throw new Error("Tooltip density setup requires a visible native Grid row");
    await page.mouse.move(box.x + Math.min(100, box.width / 2), box.y + box.height / 2);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, 120);
    await page.keyboard.up("Control");
    await expect(frame).toHaveAttribute("data-gantt-cell-height", String(current - 2));
  }
  await expect.poll(async () => {
    const raw = await frame.getAttribute("data-gantt-projection-receipt");
    return raw ? JSON.parse(raw).outcome : null;
  }).toBe("SETTLED");
}

async function displayDate(page: Page, value: string): Promise<string> {
  return page.evaluate((dateOnly) => {
    const [year, month, day] = dateOnly.split("-").map(Number);
    const locales = navigator.languages[0] || navigator.language || "en-CA";
    return new Intl.DateTimeFormat(locales, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }, value);
}

async function expectTooltip(
  page: Page,
  target: Locator,
  name: string,
  start: string,
  end: string,
  revision: number,
): Promise<string> {
  await target.scrollIntoViewIfNeeded();
  // #816 F816-003: retain one native reveal. The prior extra center scroll
  // did not repair the 19px Week bar. Readiness now records real hit probes,
  // and the real pointer hover uses its checked in-bar location.
  const frame = ganttRoot(page);
  // 이 시나리오는 검색을 편집하지 않는다. 현재 scope·U3·hit가 새 hover의 전제다.
  const readiness = await waitForGanttReadiness(target, { operation: "hover", allowCancelledPriorWork: true, api: await frame.getAttribute("data-project-gantt-api-instance"), revision,
    scale: (await frame.getAttribute("data-gantt-scale-mode")) as "day" | "week",
    scope: new URL(page.url()).searchParams.get("rootTask")?.trim() || null, query: "", queryWitness: { kind: "unchanged" } });
  const hitPoint = readiness.hover?.point, bounds = readiness.hover?.rect;
  if (!hitPoint || !bounds) throw new Error("Gantt hover requires an actual hittable Task/Grid target");
  // Playwright retains its pointer actionability checks at this exact DOM
  // verified point. Never force-hover, synthesize a tooltip, or retry on fail.
  await target.hover({ position: { x: hitPoint[0] - bounds[0], y: hitPoint[1] - bounds[1] } });
  const current = tooltip(page);
  await expect(current).toBeVisible();
  await expect(current.locator(".project-task-hover-tooltip-name")).toHaveText(name);
  await expect(current.locator(".project-task-hover-tooltip-dates")).toHaveText(`시작일: ${start} · 종료일: ${end}`);
  return current.innerText();
}

test("Issue #492 shows the same canonical Task details from Grid and Chart", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.tasks.push({
    ...fixture.tasks[0],
    taskId: id(5),
    externalId: "EMPTY-SUMMARY-492",
    name: "Date-less summary 492",
    requestedStart: null,
    start: null,
    end: null,
    duration: null,
    progress: null,
    parentExternalId: null,
    siblingOrder: 3,
  });

  await page.goto(`/projects/${publicId}`);

  const taskStart = await displayDate(page, "2026-01-05");
  const taskEnd = await displayDate(page, "2026-01-06");
  const gridText = await expectTooltip(page, rowNamed(page, "Existing summary child"), "Existing summary child", taskStart, taskEnd, fixture.project.revision);
  const instance = await ganttRoot(page).getAttribute("data-project-gantt-api-instance"); expect(instance).toBeTruthy();
  const chartText = await expectTooltip(page, taskBar(page, 2), "Existing summary child", taskStart, taskEnd, fixture.project.revision);
  expect(chartText).toBe(gridText);

  await expectTooltip(page, taskBar(page, 1), "Stable summary", taskStart, taskEnd, fixture.project.revision);

  await expect(taskBar(page, 4)).toHaveCount(0);
  await expect(rowNamed(page, "Stable milestone")).toHaveCount(0);

  await expectTooltip(page, rowNamed(page, "Date-less summary 492"), "Date-less summary 492", "—", "—", fixture.project.revision);
  await expect(taskBar(page, 5)).toHaveCount(0);
  await expect(ganttRoot(page)).toHaveAttribute("data-project-gantt-api-instance", instance!);
  expect(fixture.posts).toHaveLength(0);
  expect(fixture.patchRequests).toHaveLength(0);
});

for (const densityHeight of [34, 32, 28]) test(
  densityHeight === 34 ? "Issue #492 keeps the hover tooltip across Week, fullscreen, WBS scope and readonly"
    : `Issue #822 ${densityHeight}px preserves canonical hover tooltip across Week, fullscreen, WBS scope and readonly`, async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  await setTooltipDensity(page, densityHeight);

  const start = await displayDate(page, "2026-01-05");
  const end = await displayDate(page, "2026-01-06");
  await expectTooltip(page, taskBar(page, 2), "Existing summary child", start, end, fixture.project.revision);
  const instance = await ganttRoot(page).getAttribute("data-project-gantt-api-instance"); expect(instance).toBeTruthy();

  await ganttRoot(page).getByRole("button", { name: "주", exact: true }).click();
  await expect(ganttRoot(page)).toHaveAttribute("data-gantt-scale-mode", "week");
  await expectTooltip(page, taskBar(page, 2), "Existing summary child", start, end, fixture.project.revision);

  await ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.querySelector(".project-gantt-frame"))).toBe(true);
  await expectTooltip(page, taskBar(page, 2), "Existing summary child", start, end, fixture.project.revision);
  await ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);

  await rowNamed(page, "Stable summary").click({ button: "right" });
  await page.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)" }).click();
  await expect(rowNamed(page, "Existing summary child")).toBeVisible();
  await expectTooltip(page, rowNamed(page, "Existing summary child"), "Existing summary child", start, end, fixture.project.revision);
  await expect(ganttRoot(page)).toHaveAttribute("data-gantt-cell-height", String(densityHeight));
  await expect(ganttRoot(page)).toHaveAttribute("data-project-gantt-api-instance", instance!);

  fixture.sessionEditable = false;
  await page.reload();
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await setTooltipDensity(page, densityHeight);
  await expectTooltip(page, rowNamed(page, "Existing summary child"), "Existing summary child", start, end, fixture.project.revision);

  expect(fixture.posts).toHaveLength(0);
  expect(fixture.patchRequests).toHaveLength(0);
});

test("Issue #492 좁은 화면에서도 Grid/Chart canonical Tooltip과 실제 hit 영역을 보존한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  const start = await displayDate(page, "2026-01-05"), end = await displayDate(page, "2026-01-06");
  const grid = await expectTooltip(page, rowNamed(page, "Existing summary child"), "Existing summary child", start, end, fixture.project.revision);
  const instance = await ganttRoot(page).getAttribute("data-project-gantt-api-instance"); expect(instance).toBeTruthy();
  const chart = await expectTooltip(page, taskBar(page, 2), "Existing summary child", start, end, fixture.project.revision);
  expect(chart).toBe(grid);
  const bounds = (await tooltip(page).boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(8); expect(bounds.x + bounds.width).toBeLessThanOrEqual(382);
  await expect(ganttRoot(page)).toHaveAttribute("data-project-gantt-api-instance", instance!);
  expect(fixture.posts).toHaveLength(0); expect(fixture.patchRequests).toHaveLength(0);
});

for (const input of ["scroll", "focus", "leave"] as const) test(`Issue #492 실제 ${input} 입력은 Task Hover Tooltip을 닫는다`, async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  const start = await displayDate(page, "2026-01-05"), end = await displayDate(page, "2026-01-06");
  await expectTooltip(page, taskBar(page, 2), "Existing summary child", start, end, fixture.project.revision);
  const frame = ganttRoot(page), chart = frame.locator(".wx-chart"), instance = await frame.getAttribute("data-project-gantt-api-instance");
  if (input === "scroll") {
    const before = await chart.evaluate(node => node.scrollLeft);
    await page.mouse.wheel(200, 0);
    await expect.poll(() => chart.evaluate(node => node.scrollLeft)).toBeGreaterThan(before);
  } else if (input === "focus") {
    await chart.focus(); await expect(chart).toBeFocused();
  } else {
    await page.mouse.move(1, 1);
    expect(await frame.evaluate(node => node.contains(document.elementFromPoint(1, 1)))).toBe(false);
  }
  await expect(tooltip(page)).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
  expect(fixture.posts).toHaveLength(0); expect(fixture.patchRequests).toHaveLength(0);
});
