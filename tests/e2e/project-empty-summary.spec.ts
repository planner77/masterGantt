import { expect, test } from "@playwright/test";
import { installStatefulProjectFixture, publicId } from "../fixtures/stateful-project";

test("Core probe keeps an unscheduled Summary row without inventing a scheduled bar", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = await installStatefulProjectFixture(page);
  const summary = { ...fixture.tasks[0], taskId: "00000000-0000-4000-8000-000000000005", externalId: "EMPTY", name: "Empty summary", start: null, end: null, duration: null, progress: null };
  fixture.tasks.push(summary);
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByRole("grid").getByText("Empty summary", { exact: true })).toBeVisible();
  const bar = page.locator(`.wx-bar[data-task-id=":${summary.taskId}"]`);
  await expect(bar).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("renders a tree of only empty Summary containers without bars or fake Grid dates", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.tasks.forEach((task) => Object.assign(task, { type: "summary", requestedStart: null, start: null, end: null, duration: null, progress: null }));
  fixture.sessionEditable = false;
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByRole("grid").getByText("Existing summary child", { exact: true })).toBeVisible();
  await expect(page.locator(".wx-bar")).toHaveCount(0);
  await expect(page.locator('.wx-table-container .wx-row [data-col-id=":projectStart"]')).toHaveText(["—", "—", "—", "—"]);
  await expect(page.getByText("일정이 있는 하위 작업이 없습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "요약 작업 추가", exact: true })).toHaveCount(0);
});
