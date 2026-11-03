import { expect, test, type Page } from "@playwright/test";
import { expectSameGanttRoot, ganttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";
import { openRow, setup as setupTaskEditor } from "./fixtures/task-editor-density";

const localeSelector = (page: Page) => page.getByRole("combobox", { name: /^(표시 언어|Display language|Ngôn ngữ hiển thị)$/ }).first();
const storageKey = "mastergantt.ui.locale";

// ADD: preference/storage and live language switching are new #866 boundaries.
// REUSE: canonical Gantt fixture and editor draft fixture retain their existing business assertions.
test.describe("Issue #866 browser language preference", () => {
  test.use({ locale: "en-US" });

  test("first visit follows browser English, explicit Vietnamese survives reload and leaves canonical data unchanged", async ({ page, browser }, testInfo) => {
    const fixture = await installStatefulProjectFixture(page);
    const originalTasks = JSON.stringify(fixture.tasks);
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`/projects/${publicId}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(localeSelector(page)).toHaveValue("en");
    const identity = await rememberGanttRoot(page);
    await expect(ganttRoot(page).getByRole("button", { name: "Gantt fullscreen", exact: true })).toBeVisible();
    const chart = ganttRoot(page).locator('.wx-chart[tabindex="-1"]').first();
    await chart.hover();
    await page.mouse.wheel(280, 0);
    await expect.poll(() => chart.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    const originalScroll = await chart.evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }));

    await localeSelector(page).selectOption("vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(ganttRoot(page).getByRole("button", { name: "Gantt toàn màn hình", exact: true })).toBeVisible();
    await expectSameGanttRoot(page, identity);
    await expect.poll(() => chart.evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }))).toEqual(originalScroll);
    await expect(ganttRoot(page).locator('[role="columnheader"][data-header-id=":projectStart"]')).toHaveText("Bắt đầu");
    const localizedDate = new Intl.DateTimeFormat("vi-VN", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date("2026-09-16T00:00:00.000Z"));
    await expect(ganttRoot(page).locator('.wx-row[data-id=":00000000-0000-4000-8000-000000000003"] [data-col-id=":projectStart"]').first()).toHaveText(localizedDate);
    await expect(ganttRoot(page).getByText("Stable leaf", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("issue-866-vietnamese-gantt.png"), fullPage: true });
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe("vi");
    await page.reload();
    await expect(localeSelector(page)).toHaveValue("vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    expect(fixture.posts).toEqual([]);
    expect(fixture.patchRequests).toEqual([]);
    expect(fixture.project.revision).toBe(fixture.initialRevision);
    expect(JSON.stringify(fixture.tasks)).toBe(originalTasks);
    expect(pageErrors).toEqual([]);
    const independentContext = await browser.newContext({ locale: "en-US" });
    try {
      const independentPage = await independentContext.newPage();
      await installStatefulProjectFixture(independentPage);
      await independentPage.goto(page.url());
      await expect(localeSelector(independentPage)).toHaveValue("en");
      await expect(independentPage.locator("html")).toHaveAttribute("lang", "en");
    } finally { await independentContext.close(); }
  });

  test("invalid saved language uses the first supported browser preference", async ({ page }) => {
    await page.addInitScript(key => {
      localStorage.setItem(key, "unsupported");
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["fr-FR", "vi-VN", "en-US"] });
    }, storageKey);
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(localeSelector(page)).toHaveValue("vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });

  test("blocked localStorage still allows an explicit in-tab choice without throwing", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("Blocked storage", "SecurityError"); } });
    });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(localeSelector(page)).toHaveValue("en");
    await localeSelector(page).selectOption("ko");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test("Issue #866 language change in another tab preserves the open task draft, schedule instance and canonical writes", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await setupTaskEditor(page);
  const originalTasks = JSON.stringify(fixture.tasks);
  const originalRevision = fixture.project.revision;
  const identity = await rememberGanttRoot(page);
  await openRow(page, "Alpha leaf");
  const draft = page.locator('dialog[open] input[name="task-name"]');
  const draftName = "작성 중 <draft> · Bản nháp · unchanged";
  await draft.fill(draftName);
  const scrollPosition = await ganttRoot(page).locator('.wx-chart[tabindex="-1"]').first().evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }));
  const otherTab = await context.newPage();
  await installStatefulProjectFixture(otherTab);
  await otherTab.goto(`/projects/${publicId}`);

  for (const locale of ["en", "vi", "ko"] as const) {
    await localeSelector(otherTab).selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(draft).toHaveValue(draftName);
    await expect(page.locator("dialog[open] #task-editor-title")).toHaveText(locale === "en" ? "Task information" : locale === "vi" ? "Thông tin tác vụ" : "작업 정보");
    await expectSameGanttRoot(page, identity);
    await expect.poll(() => ganttRoot(page).locator('.wx-chart[tabindex="-1"]').first().evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }))).toEqual(scrollPosition);
  }
  expect(fixture.patches).toEqual([]);
  expect(fixture.linkMutations).toEqual([]);
  expect(fixture.assignmentMutations).toEqual([]);
  expect(fixture.project.revision).toBe(originalRevision);
  expect(JSON.stringify(fixture.tasks)).toBe(originalTasks);
  await otherTab.close();
});
