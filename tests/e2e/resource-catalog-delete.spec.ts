import { expect, test } from "@playwright/test";

test("Issue #329: unused Resource/Group guarded delete UX", async ({ page }) => {
  let revision = 7;
  const usedResourceId = "22222222-2222-4222-8222-222222222222";
  let resources = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "미사용 리소스",
      code: "FREE",
      description: "",
      active: true,
      developerGrade: null,
      projectUsageCount: 0,
      deletable: true,
    },
    {
      id: usedResourceId,
      name: "사용 중 리소스",
      code: "USED",
      description: "",
      active: true,
      developerGrade: "ADVANCED",
      projectUsageCount: 2,
      deletable: false,
    },
  ];
  let groups = [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "미사용 그룹",
      code: "G-FREE",
      description: "",
      active: true,
      memberResourceIds: [usedResourceId],
      projectUsageCount: 0,
      deletable: true,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "사용 중 그룹",
      code: "G-USED",
      description: "",
      active: true,
      memberResourceIds: [],
      projectUsageCount: 1,
      deletable: false,
    },
  ];
  const catalog = () => ({ data: { revision, resources, groups } });

  await page.route("**/api/resource-catalog/admin-sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/resources", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, json: catalog() });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/resources/**", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.continue();
      return;
    }
    expect(route.request().headers()["if-match"]).toBe(`"${revision}"`);
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1)!);
    resources = resources.filter((resource) => resource.id !== id);
    groups = groups.map((group) => ({
      ...group,
      memberResourceIds: group.memberResourceIds.filter((resourceId) => resourceId !== id),
    }));
    revision += 1;
    await route.fulfill({ status: 200, json: catalog() });
  });
  await page.route("**/api/resource-groups/**", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.continue();
      return;
    }
    expect(route.request().headers()["if-match"]).toBe(`"${revision}"`);
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1)!);
    groups = groups.filter((group) => group.id !== id);
    revision += 1;
    await route.fulfill({ status: 200, json: catalog() });
  });

  await page.goto("/resources");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("resource-admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await expect(page.getByRole("button", { name: "사용 중 리소스 삭제 불가", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "사용 중 그룹 삭제 불가", exact: true })).toBeVisible();
  }

  await expect(page.getByText("2개 프로젝트에서 사용 중", { exact: true })).toBeVisible();
  await expect(page.getByText("1개 프로젝트에서 사용 중", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "사용 중 리소스 삭제 불가", exact: true }))
    .toHaveAttribute("aria-disabled", "true");

  const resourceSearch = page.getByLabel("리소스 검색", { exact: true });
  await resourceSearch.fill("리소스");
  const resourceDelete = page.getByRole("button", { name: "미사용 리소스 삭제", exact: true });
  await resourceDelete.click();

  const resourceDialog = page.getByRole("dialog", { name: "리소스 삭제", exact: true });
  await expect(resourceDialog).toBeVisible();
  await resourceDialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(resourceDialog).toHaveCount(0);
  await expect(resourceDelete).toBeFocused();

  await resourceDelete.click();
  await page.getByRole("dialog", { name: "리소스 삭제", exact: true })
    .getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(page.getByText("미사용 리소스", { exact: true })).toHaveCount(0);
  await expect(resourceSearch).toHaveValue("리소스");
  await expect(resourceSearch).toBeFocused();

  const groupSearch = page.getByLabel("리소스 그룹 검색", { exact: true });
  await groupSearch.fill("그룹");
  await page.getByRole("button", { name: "미사용 그룹 삭제", exact: true }).click();
  const groupDialog = page.getByRole("dialog", { name: "리소스 그룹 삭제", exact: true });
  await expect(groupDialog.getByText("그룹만 삭제되며 소속 리소스는 삭제되지 않습니다.", { exact: true })).toBeVisible();
  await groupDialog.getByRole("button", { name: "영구 삭제", exact: true }).click();

  await expect(page.getByText("미사용 그룹", { exact: true })).toHaveCount(0);
  await expect(page.getByText("사용 중 리소스", { exact: true })).toBeVisible();
  await expect(groupSearch).toHaveValue("그룹");
  await expect(groupSearch).toBeFocused();
});
