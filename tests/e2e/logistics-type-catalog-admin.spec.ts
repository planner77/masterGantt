import { expect, test } from "@playwright/test";

const catalog = {
  data: {
    revision: 2,
    equipmentTypes: [
      { code: "stocker", name: "Stocker (보관설비)", active: true, sortOrder: 10, usageCount: 0 },
    ],
    systemTypes: [
      { code: "mcs", name: "MCS (통합 조율 시스템)", active: true, sortOrder: 10, usageCount: 0 },
    ],
  },
};

test("Issue #280: logistics admin clears password drafts and reports unconfirmed server logout", async ({ page }) => {
  await page.route("**/api/logistics-catalog/admin-sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: { data: { permission: "logistics_catalog_admin" } } });
      return;
    }
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 503, json: { error: { code: "TEMPORARY_FAILURE" } } });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/logistics-catalog/admin/equipment-types", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, json: catalog });
      return;
    }
    await route.continue();
  });

  await page.goto("/logistics-admin");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  const changePassword = page.getByRole("button", { name: "관리자 비밀번호 변경", exact: true });
  await expect(changePassword).toBeVisible();
  await changePassword.click();

  let dialog = page.getByRole("dialog", { name: "관리자 비밀번호 변경", exact: true });
  await dialog.getByLabel("새 비밀번호", { exact: true }).fill("Draft1!");
  await dialog.getByLabel("새 비밀번호 확인", { exact: true }).fill("Draft1!");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(changePassword).toBeFocused();

  await changePassword.click();
  dialog = page.getByRole("dialog", { name: "관리자 비밀번호 변경", exact: true });
  await expect(dialog.getByLabel("새 비밀번호", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("새 비밀번호 확인", { exact: true })).toHaveValue("");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();

  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관리자 로그인", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("서버 로그아웃을 확인하지 못했습니다. 관리 화면을 잠갔습니다.");
});
