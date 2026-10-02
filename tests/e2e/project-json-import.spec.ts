import { test, expect } from "@playwright/test";
import { installStatefulProjectFixture, publicId } from "../fixtures/stateful-project";

test.describe("Project JSON Import", () => {
  test("exposes JSON import from the compact project action menu", async ({ page }) => {
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();

    const more = page.locator('summary[aria-label="프로젝트 작업 더보기"]');
    await expect(more).toBeVisible();
    await more.click();

    const button = page.getByRole("button", { name: "가져오기 (JSON)" });
    await expect(button).toBeVisible();
  });
});
