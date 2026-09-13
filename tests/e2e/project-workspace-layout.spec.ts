import { expect, test } from "@playwright/test";

const publicId = "b57bb10c-9cd7-4d00-9c2a-4647e2240024";
const tasks = Array.from({ length: 60 }, (_, index) => ({
  taskId: `b57bb10c-9cd7-4d00-9c2a-${String(index + 1).padStart(12, "0")}`,
  externalId: `LAYOUT-${index + 1}`,
  name: `Layout task ${index + 1}`,
  type: "task",
  scheduleMode: "auto",
  requestedStart: "2026-09-10",
  start: "2026-09-10",
  end: "2026-09-16",
  duration: 5,
  progress: 20,
  parentExternalId: null,
  siblingOrder: index,
}));

for (const variant of [
  { locale: "ko-KR", timezoneId: "Asia/Seoul" },
  { locale: "en-US", timezoneId: "America/New_York" },
]) {
  test.describe(variant.locale, () => {
    test.use({
      locale: variant.locale,
      timezoneId: variant.timezoneId,
      viewport: { width: 1440, height: 900 },
    });

    test(`keeps workspace headers fixed and formats date-only values in ${variant.locale}`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route(`**/api/projects/${publicId}`, (route) => route.fulfill({ json: {
        data: {
          project: { publicId, name: "Workspace layout fixture", description: "Header and locale verification", revision: 1,
            calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] } },
          tasks, links: [], permission: "readonly",
        },
      } }));
      await page.route(`**/api/projects/${publicId}/edit-sessions/current`, (route) => route.fulfill({ json: {
        data: { permission: "edit", expiresAt: "2099-01-01T00:00:00.000Z" },
      } }));

      await page.goto(`/projects/${publicId}`);
      const projectHeader = page.locator(".project-readonly-heading");
      const gantt = page.locator(".project-gantt-widget .wx-gantt");
      const gridHeaders = page.locator(".project-gantt-widget .wx-table-container .wx-header");
      const gridHeader = gridHeaders.first();
      const chartHeader = page.locator(".project-gantt-widget .wx-scale").first();
      const externalIdHeader = gridHeaders.getByText("외부 ID", { exact: true });
      const columnMenu = page.locator(".project-column-menu");
      const externalIdOption = columnMenu.getByRole("checkbox", { name: "외부 ID", exact: true });

      await expect(gantt).toBeVisible();
      await expect(gridHeader).toBeVisible();
      await expect(chartHeader).toBeVisible();
      await expect(page.locator(".project-facts").getByText("60개", { exact: true })).toBeVisible();
      await expect(page.locator(".edit-panels > summary")).toBeVisible();
      expect(await page.locator(".edit-panels > summary").evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(30);
      await expect(page.locator(".edit-panels")).not.toHaveAttribute("open", "");
      const expectedDate = await page.evaluate(() => new Intl.DateTimeFormat(navigator.language, {
        year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
      }).format(new Date("2026-09-10T00:00:00Z")));
      await expect(page.locator(".project-gantt-widget .wx-table-container").getByText(expectedDate, { exact: true }).first()).toBeVisible();
      await expect(page.locator(".project-gantt-widget .wx-table-container").getByText("5 근무일", { exact: true }).first()).toBeVisible();
      await expect(page.locator(".project-gantt-widget .wx-weekend").first()).toBeVisible();

      // External ID is hidden by default and is controlled by the Grid header context menu.
      await expect(externalIdHeader).toHaveCount(0);
      await gridHeader.click({ button: "right" });
      await expect(columnMenu).toBeVisible();
      await expect(externalIdOption).not.toBeChecked();
      await externalIdOption.check();
      await expect(externalIdHeader).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(columnMenu).toBeHidden();

      await gridHeader.click({ button: "right" });
      await expect(columnMenu).toBeVisible();
      await expect(externalIdOption).toBeChecked();
      await externalIdOption.uncheck();
      await expect(externalIdHeader).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(columnMenu).toBeHidden();

      const before = await Promise.all([projectHeader, gridHeader, chartHeader].map((locator) => locator.boundingBox()));
      await gantt.evaluate((element) => { element.scrollTop = 500; });
      await expect.poll(() => gantt.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
      const after = await Promise.all([projectHeader, gridHeader, chartHeader].map((locator) => locator.boundingBox()));
      for (let i = 0; i < before.length; i += 1) {
        expect(before[i]).not.toBeNull();
        expect(after[i]).not.toBeNull();
        expect(Math.abs(after[i]!.y - before[i]!.y)).toBeLessThan(2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(902);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`workspace-${variant.locale}.png`) });
    });
  });
}
