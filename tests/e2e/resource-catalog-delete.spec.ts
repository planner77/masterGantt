import { expect, test } from "@playwright/test";

test("Issue #329: unused Resource/Group guarded delete UX", async ({ page }) => {
  let revision = 7;
  const freeResourceId = "11111111-1111-4111-8111-111111111111";
  const usedResourceId = "22222222-2222-4222-8222-222222222222";
  let resources = [
    {
      id: freeResourceId,
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
      memberResourceIds: [freeResourceId, usedResourceId],
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
    if (route.request().method() === "PUT") {
      expect(route.request().headers()["if-match"]).toBe(`"${revision}"`);
      const body = route.request().postDataJSON() as { resourceIds: string[] };
      expect(body.resourceIds).toEqual([usedResourceId]);
      groups = groups.map((group) => group.name === "미사용 그룹"
        ? { ...group, memberResourceIds: body.resourceIds }
        : group);
      revision += 1;
      await route.fulfill({ status: 200, json: catalog() });
      return;
    }
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

  await page.getByRole("button", { name: "구성원", exact: true }).first().click();
  await expect(page.getByText("일치 2 / 전체 2 · 선택 2", { exact: true })).toBeVisible();

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
  await expect(page.getByText("일치 1 / 전체 1 · 선택 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "구성원 저장", exact: true }).click();
  await expect(page.getByText("변경사항을 저장했습니다.", { exact: true })).toBeVisible();

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


test("Issue #329: DELETE revalidation closes stale confirmation dialogs", async ({ page }) => {
  let revision = 11;
  let resources = [
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "경합 리소스",
      code: "RACE",
      description: "",
      active: true,
      developerGrade: null,
      projectUsageCount: 0,
      deletable: true,
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      name: "다른 관리자 삭제 리소스",
      code: "STALE",
      description: "",
      active: true,
      developerGrade: null,
      projectUsageCount: 0,
      deletable: true,
    },
  ];
  const catalog = () => ({ data: { revision, resources, groups: [] } });

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
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1)!);
    if (id.startsWith("55555555")) {
      resources = resources.map((resource) => resource.id === id
        ? { ...resource, projectUsageCount: 1, deletable: false }
        : resource);
      await route.fulfill({
        status: 409,
        json: { error: { code: "RESOURCE_IN_USE", message: "in use", details: [], requestId: "race" } },
      });
      return;
    }
    resources = resources.filter((resource) => resource.id !== id);
    revision += 1;
    await route.fulfill({
      status: 412,
      json: { error: { code: "CATALOG_REVISION_MISMATCH", message: "stale", details: [], requestId: "stale" } },
    });
  });

  await page.goto("/resources");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("resource-admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await page.getByRole("button", { name: "경합 리소스 삭제", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "리소스 삭제", exact: true });
  await dialog.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "경합 리소스 삭제 불가", exact: true })).toBeVisible();
  await expect(page.getByText("프로젝트에서 사용 중인 항목은 삭제할 수 없습니다. 최신 사용 상태를 불러왔습니다.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "다른 관리자 삭제 리소스 삭제", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "리소스 삭제", exact: true });
  await dialog.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("다른 관리자 삭제 리소스", { exact: true })).toHaveCount(0);
  await expect(page.getByText("다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 불러왔습니다. 초안을 확인한 후 다시 저장해 주세요.", { exact: true })).toBeVisible();
});
