import { expect, test } from "@playwright/test";

const publicId = "35000000-0000-4000-8000-000000000035";

test("switches the Gantt timeline between day and ISO week headers without remounting", async ({ page }) => {
  await page.route(`**/api/projects/${publicId}`, (route) => route.fulfill({ json: {
    data: {
      project: {
        publicId,
        name: "Issue 51 ISO week scale fixture",
        description: "Day/ISO-week timeline scale verification",
        revision: 1,
        calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
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
  await expect(gantt.getByText("W38", { exact: true })).toBeVisible();
  await expect(gantt.getByText("W39", { exact: true })).toBeVisible();
  await expect(gantt.getByText(/9\/14.*9\/20/)).toHaveCount(0);

  await day.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "day");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
  await expect(page.locator(".project-gantt-widget .wx-weekend").first()).toBeVisible();
  await expect(gantt.getByText("W38", { exact: true })).toHaveCount(0);

  await week.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
  await expect(gantt.getByText("W38", { exact: true })).toBeVisible();
});
