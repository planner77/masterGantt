import { expect, test } from "@playwright/test";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

test("creates a project, lists it after returning home, and keeps its direct page readonly", async ({
  browser,
  page,
}) => {
  const suffix = uniqueSuffix();
  const name = `E2E Project ${suffix}`;
  const password = `E2E-password-${suffix}`;
  const initialCollectionResponse = await page.request.get("/api/projects");
  expect(initialCollectionResponse.status()).toBe(200);
  const initialCollection = await initialCollectionResponse.json();
  const initialProjectCount = initialCollection.data.projects.length;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "프로젝트", exact: true })).toBeVisible();
  if (initialProjectCount === 0) {
    await expect(page.getByRole("heading", { name: "아직 프로젝트가 없습니다." })).toBeVisible();
  } else {
    await expect(page.locator(".project-list-card")).toHaveCount(initialProjectCount);
    await expect(page.locator(".project-list-card").first()).toBeVisible();
  }
  await page.getByRole("link", { name: "프로젝트 만들기" }).first().click();
  await page.waitForURL("/projects/new");
  const create = page.getByRole("button", { name: "프로젝트 만들기" });
  await create.click();
  await expect(page.locator(".form-error")).toHaveText("프로젝트 이름을 입력해 주세요.");

  await page.getByLabel("프로젝트 이름").fill(name);
  await page.getByLabel("편집 비밀번호").fill("😀".repeat(11));
  await create.click();
  await expect(page.locator(".form-error")).toHaveText(
    "편집 비밀번호는 12자 이상이어야 합니다.",
  );

  await page.getByLabel("설명 (선택)").fill("브라우저 통합 검증 프로젝트");
  await page.getByLabel("편집 비밀번호").fill(password);
  await create.click();

  await page.waitForURL(/\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const directUrl = page.url();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  await expect(page.locator(".project-facts").getByText("작업", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "프로젝트 일정 Grid와 Gantt 차트" })).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-table-container")).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-chart")).toBeVisible();
  await page.getByText("프로젝트 설정", { exact: true }).click();
  await expect(page.getByRole("button", { name: "프로젝트 정보 저장" })).toBeVisible();
  expect(directUrl).not.toContain(password);
  expect(await page.locator("body").innerText()).not.toContain(password);

  const collectionResponse = await page.request.get("/api/projects");
  expect(collectionResponse.status()).toBe(200);
  const collection = await collectionResponse.json();
  expect(collection.data.projects).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name, description: "브라우저 통합 검증 프로젝트" }),
    ]),
  );

  await page.getByRole("link", { name: "프로젝트" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("heading", { name: "프로젝트", exact: true })).toBeVisible();
  const projectCard = page.getByRole("link", { name: new RegExp(name) });
  await expect(projectCard).toContainText("브라우저 통합 검증 프로젝트");

  await page.reload();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await projectCard.click();
  await page.waitForURL(directUrl);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  const readonlyContext = await browser.newContext();
  try {
    const readonlyPage = await readonlyContext.newPage();
    await readonlyPage.goto("/");
    await expect(readonlyPage.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    await readonlyPage.getByRole("link", { name: new RegExp(name) }).click();
    await readonlyPage.waitForURL(directUrl);
    await expect(readonlyPage.getByRole("heading", { name })).toBeVisible();
    await expect(readonlyPage.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(readonlyPage.getByRole("button", { name: "편집 잠금 해제" })).toBeVisible();
  } finally {
    await readonlyContext.close();
  }
});

test("clears a password after a safe server validation error and permits recovery", async ({ page }) => {
  const suffix = uniqueSuffix();
  const password = `E2E-password-${suffix}`;
  await page.goto("/projects/new");

  await page.getByLabel("프로젝트 이름").fill(`Validation ${suffix}`);
  await page.getByLabel("설명 (선택)").fill("x".repeat(4_001));
  await page.getByLabel("편집 비밀번호").fill(password);
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();

  await expect(page.locator(".form-error")).toHaveText("프로젝트 입력값을 확인해 주세요.");
  await expect(page.getByLabel("편집 비밀번호")).toHaveValue("");
  expect(await page.locator("body").innerText()).not.toContain(password);

  await page.getByLabel("설명 (선택)").fill("");
  await page.getByLabel("편집 비밀번호").fill(password);
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
