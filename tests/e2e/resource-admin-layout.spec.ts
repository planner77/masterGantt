import { expect, test, type Locator } from "@playwright/test";

async function expectDirectChildrenDoNotOverlap(container: Locator) {
  const boxes = await container.locator(":scope > *").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left];
      const b = boxes[right];
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1;
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      expect(overlapX && overlapY).toBe(false);
    }
  }
  const containerBox = await container.boundingBox();
  expect(containerBox).not.toBeNull();
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(containerBox!.x - 1);
    expect(box.right).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 1);
  }
}

async function expectControlsDoNotOverlap(container: Locator, controls: Locator[]) {
  const containerBox = await container.boundingBox();
  expect(containerBox).not.toBeNull();
  const boxes = (await Promise.all(controls.map((control) => control.boundingBox()))).map((box) => {
    expect(box).not.toBeNull();
    return box!;
  });

  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left];
      const b = boxes[right];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1;
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
      expect(overlapX && overlapY).toBe(false);
    }
  }

  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 1);
  }
}

test("Issue #235/#331/#366: resource admin layout, create forms, and password dialog", async ({ page }, testInfo) => {
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
  const resourceSection = page.getByRole("region", { name: "리소스", exact: true });
  const groupSection = page.getByRole("region", { name: "리소스 그룹", exact: true });
  const resourceCreateForm = resourceSection.locator("form");
  const groupCreateForm = groupSection.locator("form");
  const resourceName = resourceSection.getByLabel("이름", { exact: true });
  const resourceCode = resourceSection.getByLabel("코드", { exact: true });
  const resourceGrade = resourceSection.getByLabel("신규 리소스 개발자 등급", { exact: true });
  const resourceAdd = resourceSection.getByRole("button", { name: "추가", exact: true });
  await expect(changePassword).toBeVisible();
  await expect(refresh).toBeVisible();
  await expect(logout).toBeVisible();

  const maxLengthCode = `DEV-${"X".repeat(60)}`;
  await resourceCode.fill(maxLengthCode);
  await resourceGrade.selectOption("EXPERT");

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
    await expectDirectChildrenDoNotOverlap(resourceCreateForm);
    await expectDirectChildrenDoNotOverlap(groupCreateForm);
    await expectControlsDoNotOverlap(resourceCreateForm, [resourceCode, resourceGrade]);
    if (width === 390 || width === 1024) {
      await page.screenshot({ path: testInfo.outputPath(`issue-331-resource-create-layout-${width}.png`), fullPage: true });
      await page.screenshot({ path: testInfo.outputPath(`issue-366-resource-code-grade-layout-${width}.png`), fullPage: true });
    }

    const header = await page.locator(".site-header").boundingBox();
    const eyebrow = await page.getByText("Global catalog", { exact: true }).boundingBox();
    expect(header).not.toBeNull();
    expect(eyebrow).not.toBeNull();
    expect(eyebrow!.y - (header!.y + header!.height)).toBeLessThanOrEqual(40);
  }

  expect(await resourceGrade.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))).toEqual([
    "", "BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT",
  ]);
  await resourceName.fill("키보드 검증");
  await resourceName.focus();
  await page.keyboard.press("Tab");
  await expect(resourceCode).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(resourceGrade).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(resourceAdd).toBeFocused();

  await changePassword.click();
  const dialog = page.getByRole("dialog", { name: "관리자 비밀번호 변경", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("새 비밀번호", { exact: true })).not.toHaveAttribute("maxlength");
  await expect(dialog.getByLabel("새 비밀번호 확인", { exact: true })).not.toHaveAttribute("maxlength");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(changePassword).toBeFocused();
});
