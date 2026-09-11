import { expect, test } from "@playwright/test";

test("renders the SVAR fixture readonly by default and exposes the local preview toggle", async ({ page }) => {
  await page.goto("/gantt-demo");

  await expect(page.getByRole("heading", { name: "Gantt 최소 통합" })).toBeVisible();
  const preview = page.getByRole("checkbox", { name: "로컬 편집 미리보기" });
  const update = page.getByRole("button", { name: "fixture 변경 이벤트 실행" });
  await expect(preview).not.toBeChecked();
  await expect(update).toBeDisabled();
  await expect(page.locator(".gantt-widget")).toBeVisible();
  const grid = page.getByRole("grid");
  await expect(grid.getByText("Release preparation", { exact: true })).toBeVisible();
  await expect(grid.getByText("Design review", { exact: true })).toBeVisible();
  await expect(grid.getByText("Build implementation", { exact: true })).toBeVisible();
  await expect(grid.getByText("Release gate", { exact: true })).toBeVisible();
  await expect(page.locator('[data-link-id=":design-to-build"]')).toBeVisible();
  await expect(page.getByText("이 데모는 저장하지 않습니다.")).toHaveCount(0);

  await preview.check();
  await expect(preview).toBeChecked();
  await expect(update).toBeEnabled();
  await update.click();
  await expect(page.getByText("build 변경을 감지했습니다. 이 데모는 저장하지 않습니다.")).toBeVisible();
  await expect(page.getByText("미리보기 변경은 서버나 SQLite에 저장되지 않습니다.")).toBeVisible();
});
