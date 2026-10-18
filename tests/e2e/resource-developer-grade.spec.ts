import { expect, test } from "@playwright/test";

test("Issue #288: resource developer grade is created, displayed, and editable", async ({ page }) => {
  let revision = 7;
  let developerGrade: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | null = null;
  const resource = () => ({
    id: "11111111-2222-4333-8444-555555555555",
    name: "김개발",
    code: "DEV-01",
    description: "",
    active: true,
    developerGrade,
  });

  await page.route("**/api/resource-catalog/admin-sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/resources", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, json: { data: { revision, resources: [resource()], groups: [] } } });
      return;
    }
    if (method === "POST") {
      const body = route.request().postDataJSON() as { developerGrade?: string | null };
      expect(body.developerGrade).toBe("ADVANCED");
      developerGrade = "ADVANCED";
      revision += 1;
      await route.fulfill({ status: 201, json: { data: { revision, resources: [resource()], groups: [] } } });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/resources/*", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as { developerGrade?: string | null };
      developerGrade = body.developerGrade as typeof developerGrade;
      revision += 1;
      await route.fulfill({ status: 200, json: { data: { revision, resources: [resource()], groups: [] } } });
      return;
    }
    await route.continue();
  });

  await page.goto("/resources");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("resource-admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page.getByRole("cell", { name: "미지정", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "김개발 프로필 편집", exact: true }).click();
  const existingGrade = page.getByLabel("김개발 개발자 등급", { exact: true });
  await existingGrade.selectOption("EXPERT");
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(page.getByRole("cell", { name: "특급", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "리소스 추가", exact: true }).click();

  await page.getByLabel("이름", { exact: true }).first().fill("신규개발자");
  await page.getByLabel("코드", { exact: true }).first().fill("DEV-02");
  await page.getByLabel("신규 리소스 개발자 등급", { exact: true }).selectOption("ADVANCED");
  await page.getByRole("button", { name: "추가", exact: true }).first().click();

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
});
