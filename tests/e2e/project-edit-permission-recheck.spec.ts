import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createProject(
  page: import("@playwright/test").Page,
  name: string,
  password: string,
): Promise<string> {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill(name);
  await page.getByLabel("편집 비밀번호").fill(password);
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

test("rechecks the current edit session on project re-entry and history restoration", async ({ page }) => {
  const suffix = uniqueSuffix();
  const password = `Issue-37-password-${suffix}`;
  const name = `Issue 37 ${suffix}`;
  const publicId = await createProject(page, name, password);
  const permissionPath = `/api/projects/${publicId}/edit-sessions/current`;

  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();

  let permissionRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname === permissionPath) {
      permissionRequests += 1;
    }
  });

  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await page.waitForURL("/");
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await page.waitForURL(`/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  expect(permissionRequests).toBeGreaterThanOrEqual(1);

  const beforeHistoryRestore = permissionRequests;
  await page.goBack();
  await page.waitForURL("/");
  await page.goForward();
  await page.waitForURL(`/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await expect.poll(() => permissionRequests).toBeGreaterThan(beforeHistoryRestore);
});

test("fails closed when a restored project cannot revalidate edit permission", async ({ page }) => {
  const suffix = uniqueSuffix();
  const password = `Issue-37-fail-${suffix}`;
  const name = `Issue 37 Fail ${suffix}`;
  const publicId = await createProject(page, name, password);
  const permissionPath = `/api/projects/${publicId}/edit-sessions/current`;

  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await page.waitForURL("/");

  await page.route(`**${permissionPath}`, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "TEST_PERMISSION_FAILURE" } }),
    });
  });

  await page.goBack();
  await page.waitForURL(`/projects/${publicId}`);
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "편집 잠금 해제", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "프로젝트 설정", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("workspace-toast")).toContainText("읽기 전용");
});
