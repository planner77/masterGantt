import { expect, test } from "@playwright/test";

test("Issue #412: 전역 Resource 역할 표시·편집·그룹 참조와 반응형 접근성을 유지한다", async ({ page }) => {
  let revision = 21;
  const r1 = "11111111-1111-4111-8111-111111111111";
  const r2 = "22222222-2222-4222-8222-222222222222";
  const r3 = "33333333-3333-4333-8333-333333333333";
  let resources = [
    {
      id: r1,
      name: "PI 개발자 리소스",
      code: "R1",
      description: "",
      active: true,
      developerGrade: "ADVANCED",
      roles: ["PI", "DEVELOPER"],
      projectUsageCount: 0,
      deletable: true,
    },
    {
      id: r2,
      name: "설비 담당 리소스",
      code: "R2",
      description: "",
      active: true,
      developerGrade: null,
      roles: ["EQUIPMENT_OWNER"],
      projectUsageCount: 0,
      deletable: true,
    },
    {
      id: r3,
      name: "역할 없는 매우 긴 한국어 리소스 이름 회귀 검증 대상",
      code: "R3-LONG-CODE",
      description: "",
      active: true,
      developerGrade: null,
      roles: [],
      projectUsageCount: 0,
      deletable: true,
    },
  ];
  const groups = [{
    id: "44444444-4444-4444-8444-444444444444",
    name: "혼합 역할 그룹",
    code: "MIXED",
    description: "",
    active: true,
    memberResourceIds: [r1, r2, r3],
    projectUsageCount: 0,
    deletable: true,
  }];
  const catalog = () => ({ data: { revision, resources, groups } });
  const rolePatches: Array<{ id: string; roles: string[] }> = [];

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
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    expect(route.request().headers()["if-match"]).toBe(`"${revision}"`);
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1)!);
    const body = route.request().postDataJSON() as { roles?: string[]; developerGrade?: string | null; active?: boolean };
    resources = resources.map((resource) => resource.id === id ? { ...resource, ...body } : resource);
    if (body.roles) rolePatches.push({ id, roles: body.roles });
    revision += 1;
    await route.fulfill({ status: 200, json: catalog() });
  });

  await page.goto("/resources");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("resource-admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page.getByLabel("PI 개발자 리소스 PI 역할", { exact: true })).toBeChecked();
  await expect(page.getByLabel("PI 개발자 리소스 개발자 역할", { exact: true })).toBeChecked();
  await expect(page.getByLabel("PI 개발자 리소스 설비 담당 역할", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("설비 담당 리소스 설비 담당 역할", { exact: true })).toBeChecked();
  await expect(page.getByText("전역 역할:", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("없음", { exact: true })).toBeVisible();

  const equipmentRole = page.getByLabel("PI 개발자 리소스 설비 담당 역할", { exact: true });
  await equipmentRole.check();
  await expect(page.getByText("변경사항을 저장했습니다.", { exact: true })).toBeVisible();
  expect(rolePatches.at(-1)).toEqual({
    id: r1,
    roles: ["PI", "DEVELOPER", "EQUIPMENT_OWNER"],
  });
  await expect(page.getByLabel("PI 개발자 리소스 개발자 등급", { exact: true })).toHaveValue("ADVANCED");

  const noRolePi = page.getByLabel("역할 없는 매우 긴 한국어 리소스 이름 회귀 검증 대상 PI 역할", { exact: true });
  await noRolePi.focus();
  await expect(noRolePi).toBeFocused();
  await noRolePi.press("Space");
  await expect(noRolePi).toBeChecked();
  expect(rolePatches.at(-1)).toEqual({ id: r3, roles: ["PI"] });

  await page.getByRole("button", { name: "구성원", exact: true }).click();
  await expect(page.getByText(/PI 개발자 리소스.*역할 PI, 개발자, 설비 담당/)).toBeVisible();
  await expect(page.getByText(/설비 담당 리소스.*역할 설비 담당/)).toBeVisible();
  await expect(page.getByText(/역할 없는 매우 긴 한국어 리소스 이름 회귀 검증 대상.*역할 PI/)).toBeVisible();

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await expect(page.getByLabel("PI 개발자 리소스 PI 역할", { exact: true })).toBeVisible();
  }
});
