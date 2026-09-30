import { expect, test } from "@playwright/test";

const catalog = {
  data: {
    revision: 1,
    businessUnits: [],
    products: [],
    siteEntities: [],
    items: [],
  },
};

test("Issue #289: 관리자 category 탭은 roving focus와 Arrow/Home/End 계약을 따른다", async ({ page }) => {
  await page.route("**/api/project-master/admin-sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: { data: { permission: "project_master_admin", expiresAt: "2026-09-30T12:00:00.000Z" } } });
      return;
    }
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/project-master/admin/items", async (route) => {
    await route.fulfill({ status: 200, json: catalog, headers: { ETag: '"1"' } });
  });

  await page.goto("/project-master-admin");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  const tabs = page.getByRole("tablist", { name: "프로젝트 기준정보 범주" }).getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute("tabindex", "0");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");

  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Home");
  await expect(tabs.nth(0)).toBeFocused();
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

  const panel = page.getByRole("tabpanel");
  await expect(panel).toHaveAttribute("aria-labelledby", "project-master-tab-business_unit");
  await expect(panel.getByRole("heading", { name: "사업부", exact: true })).toBeVisible();
});
