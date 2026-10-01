import { expect, test } from "@playwright/test";

const catalog = {
  data: {
    revision: 2,
    equipmentTypes: [
      { code: "stocker", name: "Stocker (보관설비)", active: true, sortOrder: 10, usageCount: 0 },
      { code: "legacy", name: "Legacy Stocker", active: false, sortOrder: 20, usageCount: 2 },
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
  await expect(page.getByRole("alert").first()).toContainText("서버 로그아웃을 확인하지 못했습니다. 관리 화면을 잠갔습니다.");
});


test("Issue #330: logistics admin filters status client-side and keeps controls non-overlapping", async ({ page }) => {
  let catalogReads = 0;
  let mutations = 0;
  await page.route("**/api/logistics-catalog/admin-sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: { data: { permission: "logistics_catalog_admin" } } });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/logistics-catalog/admin/**", async (route) => {
    if (route.request().method() === "GET") {
      catalogReads += 1;
      await route.fulfill({ status: 200, json: catalog });
      return;
    }
    mutations += 1;
    await route.fulfill({ status: 500, json: { error: { code: "UNEXPECTED_MUTATION" } } });
  });

  await page.goto("/logistics-admin");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  const filters = page.getByRole("group", { name: "유형 상태 필터" });
  await expect(filters.getByRole("button", { name: "전체", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Stocker (보관설비)", { exact: true })).toBeVisible();
  await expect(page.getByText("Legacy Stocker", { exact: true })).toBeVisible();

  await filters.getByRole("button", { name: "비활성", exact: true }).click();
  await expect(filters.getByRole("button", { name: "비활성", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Legacy Stocker", { exact: true })).toBeVisible();
  await expect(page.getByText("Stocker (보관설비)", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "시스템 유형", exact: true }).click();
  await expect(page.getByRole("button", { name: "시스템 유형", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("비활성 유형이 없습니다.", { exact: true })).toBeVisible();
  expect(catalogReads).toBe(1);
  expect(mutations).toBe(0);

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await filters.getByRole("button", { name: "전체", exact: true }).click();
    const controls = [
      page.getByLabel("유형명", { exact: true }),
      page.getByLabel("코드", { exact: true }),
      page.getByLabel("정렬", { exact: true }),
      page.getByRole("button", { name: "유형 추가", exact: true }),
    ];
    const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        expect(a && b ? !(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) : false).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});
