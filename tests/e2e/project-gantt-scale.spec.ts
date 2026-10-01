import { expect, test } from "@playwright/test";

const publicId = "35000000-0000-4000-8000-000000000035";

test("switches the Gantt timeline between day and ISO week headers without remounting", async ({ page }) => {
  await page.route(`**/api/projects/${publicId}`, (route) => route.fulfill({ json: {
    data: {
      project: {
        publicId,
        name: "Issue 51 ISO week scale fixture",
        description: "Day/ISO-week timeline scale verification",
        status: "planned",
        revision: 1,
        calendar: {
          timezone: "Asia/Seoul",
          weekendDays: [6, 0],
          holidays: [
            { date: "2026-09-22", name: "Fixture holiday" },
            { date: "2026-09-26", name: "Weekend named holiday" },
          ],
          exceptions: [
            {
              date: "2026-09-22",
              dayType: "NON_WORKING",
              name: "Fixture holiday",
              names: ["Fixture holiday", "Company anniversary"],
            },
            {
              date: "2026-09-26",
              dayType: "NON_WORKING",
              name: "Weekend named holiday",
              names: ["Weekend named holiday"],
            },
            {
              date: "2026-09-27",
              dayType: "WORKING",
              name: "Sunday working override",
              names: ["Sunday working override"],
            },
          ],
        },
      },
      tasks: [{
        taskId: "35000000-0000-4000-8000-000000000001",
        externalId: "ISSUE-51-1",
        name: "Scale verification task",
        type: "task",
        scheduleMode: "auto",
        requestedStart: "2026-09-14",
        start: "2026-09-14",
        end: "2026-09-30",
        duration: 13,
        progress: 25,
        parentExternalId: null,
        siblingOrder: 0,
      }],
      links: [],
      permission: "readonly",
    },
  } }));
  await page.route(`**/api/projects/${publicId}/edit-sessions/current`, (route) => route.fulfill({ json: {
    data: { permission: "readonly" },
  } }));

  await page.goto(`/projects/${publicId}`);
  const frame = page.locator(".project-gantt-frame");
  const gantt = page.locator(".project-gantt-widget");
  const controls = page.getByRole("group", { name: "Gantt 표시 단위" });
  const day = controls.getByRole("button", { name: "일", exact: true });
  const week = controls.getByRole("button", { name: "주", exact: true });

  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "day");
  await expect(day).toHaveAttribute("aria-pressed", "true");
  await expect(week).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".project-gantt-widget .wx-weekend").first()).toBeVisible();
  const dayScale = page.locator(".project-gantt-widget .wx-scale > .wx-row").nth(1);
  await expect(dayScale.getByText("14", { exact: true })).toBeVisible();
  await expect(dayScale.getByText("22", { exact: true })).toBeVisible();
  await expect(dayScale.getByText(/일|[()]/)).toHaveCount(0);

  const ordinaryDay = page.locator(".project-gantt-day-date-20260921");
  const namedHoliday = page.locator(".project-gantt-day-date-20260922");
  const namedWeekend = page.locator(".project-gantt-day-date-20260926");
  const workingOverride = page.locator(".project-gantt-day-date-20260927");
  const tooltip = page.getByRole("tooltip");

  await ordinaryDay.hover();
  await expect(tooltip).toBeVisible();
  await expect(ordinaryDay).toHaveAttribute("aria-label", /2026-09-21/);
  await expect(tooltip).not.toContainText("Fixture holiday");
  await expect(tooltip).not.toContainText("Sunday working override");

  await namedHoliday.hover();
  await expect(tooltip).toContainText("Fixture holiday");
  await expect(tooltip).toContainText("Company anniversary");
  await expect(namedHoliday).toHaveAttribute("aria-describedby", /day-header-tooltip/);

  await page.mouse.move(1, 1);
  await namedWeekend.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Weekend named holiday");

  await namedHoliday.hover();
  await expect(tooltip).toContainText("Company anniversary");
  await page.mouse.move(1, 1);
  await expect(tooltip).toContainText("Weekend named holiday");
  await expect(namedWeekend).toHaveAttribute("aria-describedby", /day-header-tooltip/);

  await page.setViewportSize({ width: 1024, height: 900 });
  // SVAR virtualizes the scale after a viewport resize, so a previously
  // referenced calendar date may leave the DOM. Validate edge clamping against
  // the live right-most Day cell instead of assuming that date stays mounted.
  const edgeDay = page.locator(".project-gantt-day-scale").last();
  await expect(edgeDay).toBeVisible();
  // Focus accessibility is verified above on namedWeekend. After a viewport
  // resize SVAR may replace virtualized scale cells during focus dispatch, so
  // use the pointer path here to isolate viewport-edge positioning from the
  // already-covered keyboard/focus contract.
  await edgeDay.hover();
  await expect(tooltip).toBeVisible();
  // Accessibility linkage is asserted above on stable date cells. The right-most
  // virtualized cell can be replaced while SVAR settles after resize, so this
  // block intentionally verifies viewport clamping only.
  await expect.poll(async () => {
    const box = await tooltip.boundingBox();
    return Boolean(box && box.x + box.width <= 1016);
  }).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });

  await workingOverride.hover();
  await expect(tooltip).toBeVisible();
  await expect(workingOverride).toHaveAttribute("aria-label", /2026-09-27/);
  await expect(tooltip).not.toContainText("Sunday working override");

  await expect(gantt.getByText("W38", { exact: true })).toHaveCount(0);
  const instanceId = await frame.getAttribute("data-project-gantt-instance");
  const apiInstanceId = await frame.getAttribute("data-project-gantt-api-instance");
  expect(instanceId).toBeTruthy();
  expect(apiInstanceId).toBeTruthy();

  await week.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  await expect(day).toHaveAttribute("aria-pressed", "false");
  await expect(week).toHaveAttribute("aria-pressed", "true");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
  await expect(page.locator(".project-gantt-widget .wx-weekend")).toHaveCount(0);
  await expect(page.locator(".project-gantt-day-scale")).toHaveCount(0);
  await expect(tooltip).toHaveCount(0);
  await expect(gantt.getByText("W38", { exact: true })).toBeVisible();
  await expect(gantt.getByText("W39", { exact: true })).toBeVisible();
  await expect(gantt.getByText(/9\/14.*9\/20/)).toHaveCount(0);

  await day.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "day");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
  await expect(page.locator(".project-gantt-widget .wx-weekend").first()).toBeVisible();
  await expect(dayScale.getByText("14", { exact: true })).toBeVisible();
  await expect(dayScale.getByText("22", { exact: true })).toBeVisible();
  await expect(dayScale.getByText(/일|[()]/)).toHaveCount(0);
  await expect(gantt.getByText("W38", { exact: true })).toHaveCount(0);

  await week.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
  await expect(gantt.getByText("W38", { exact: true })).toBeVisible();
});
