import { expect, test } from "@playwright/test";

test("Issue #235: resource admin header actions, compact spacing, and password dialog", async ({ page }) => {
  await page.route("**/api/resource-catalog/admin-sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/resources", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        json: { data: { revision: 7, resources: [], groups: [] } },
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/resources");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("resource-admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page.getByText("Catalog Revision", { exact: false })).toHaveCount(0);

  const changePassword = page.getByRole("button", { name: "관리자 비밀번호 변경", exact: true });
  const refresh = page.getByRole("button", { name: "새로고침", exact: true });
  const logout = page.getByRole("button", { name: "로그아웃", exact: true });
  await expect(changePassword).toBeVisible();
  await expect(refresh).toBeVisible();
  await expect(logout).toBeVisible();

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const [changeBox, refreshBox, logoutBox] = await Promise.all([
      changePassword.boundingBox(),
      refresh.boundingBox(),
      logout.boundingBox(),
    ]);
    expect(changeBox).not.toBeNull();
    expect(refreshBox).not.toBeNull();
    expect(logoutBox).not.toBeNull();
    expect(Math.abs(changeBox!.y - refreshBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(refreshBox!.y - logoutBox!.y)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    const header = await page.locator(".site-header").boundingBox();
    const eyebrow = await page.getByText("Global catalog", { exact: true }).boundingBox();
    expect(header).not.toBeNull();
    expect(eyebrow).not.toBeNull();
    expect(eyebrow!.y - (header!.y + header!.height)).toBeLessThanOrEqual(40);
  }

  await changePassword.click();
  const dialog = page.getByRole("dialog", { name: "관리자 비밀번호 변경", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("새 비밀번호", { exact: true })).not.toHaveAttribute("maxlength");
  await expect(dialog.getByLabel("새 비밀번호 확인", { exact: true })).not.toHaveAttribute("maxlength");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(changePassword).toBeFocused();
});
