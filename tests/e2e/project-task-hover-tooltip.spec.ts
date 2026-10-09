import { installMilestoneDashboardFixture, openMilestoneEditor } from "./helpers/milestone-ui";
import { expect, test, type Locator, type Page } from "@playwright/test";

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
): Promise<string> {
  await target.scrollIntoViewIfNeeded();
  await target.hover();
  const current = tooltip(page);
  await expect(current).toBeVisible();
  await expect(current.locator(".project-task-hover-tooltip-name")).toHaveText(name);
  await expect(current.locator(".project-task-hover-tooltip-dates")).toHaveText(`시작일: ${start} · 종료일: ${end}`);
  return current.innerText();
}

test("Issue #492 shows the same canonical Task details from Grid and Chart", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await installMilestoneDashboardFixture(page, fixture);
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
  const gridText = await expectTooltip(page, rowNamed(page, "Existing summary child"), "Existing summary child", taskStart, taskEnd);
  const chartText = await expectTooltip(page, taskBar(page, 2), "Existing summary child", taskStart, taskEnd);
  expect(chartText).toBe(gridText);

  await expectTooltip(page, taskBar(page, 1), "Stable summary", taskStart, taskEnd);

  await expect(taskBar(page, 4)).toHaveCount(0);
  const milestoneEditor = await openMilestoneEditor(page, id(4));
  await expect(milestoneEditor.getByLabel("작업명", { exact: true })).toHaveValue("Stable milestone");
  await expect(milestoneEditor.getByLabel("요청 시작일", { exact: true })).toHaveValue("2026-12-18");
  await page.keyboard.press("Escape");
  await expect(milestoneEditor).toBeHidden();
  await page.getByRole("tab", { name: "일정", exact: true }).click();

  await expectTooltip(page, rowNamed(page, "Date-less summary 492"), "Date-less summary 492", "—", "—");
  await expect(taskBar(page, 5)).toHaveCount(0);
  expect(fixture.posts).toHaveLength(0);
  expect(fixture.patchRequests).toHaveLength(0);
});

test("Issue #492 keeps the hover tooltip across Week, fullscreen, WBS scope and readonly", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);

  const start = await displayDate(page, "2026-01-05");
  const end = await displayDate(page, "2026-01-06");
  await expectTooltip(page, taskBar(page, 2), "Existing summary child", start, end);

  await ganttRoot(page).getByRole("button", { name: "주", exact: true }).click();
  await expect(ganttRoot(page)).toHaveAttribute("data-gantt-scale-mode", "week");
  await expectTooltip(page, taskBar(page, 2), "Existing summary child", start, end);

  await ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.querySelector(".project-gantt-frame"))).toBe(true);
  await expectTooltip(page, taskBar(page, 2), "Existing summary child", start, end);
  await ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);

  await rowNamed(page, "Stable summary").click({ button: "right" });
  await page.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)" }).click();
  await expect(rowNamed(page, "Existing summary child")).toBeVisible();
  await expectTooltip(page, rowNamed(page, "Existing summary child"), "Existing summary child", start, end);

  fixture.sessionEditable = false;
  await page.reload();
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await expectTooltip(page, rowNamed(page, "Existing summary child"), "Existing summary child", start, end);

  expect(fixture.posts).toHaveLength(0);
  expect(fixture.patchRequests).toHaveLength(0);
});
