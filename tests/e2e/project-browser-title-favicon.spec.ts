import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

async function createProject(page: import("@playwright/test").Page, name: string): Promise<string> {
  await page.goto("/projects/new");
  await expect(page).toHaveTitle("masterGantt");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(name);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("Title123!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${name}`);
  return new URL(page.url()).pathname;
}

test("#141 favicon과 canonical 프로젝트 이름으로 브라우저 제목을 갱신한다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page).toHaveTitle("masterGantt");
  const icon = page.locator('head link[rel="icon"][type="image/svg+xml"]');
  await expect(icon).toHaveCount(1);
  const iconHref = await icon.getAttribute("href");
  expect(iconHref).toBeTruthy();
  const iconResponse = await page.request.get(new URL(iconHref!, page.url()).toString());
  expect(iconResponse.status()).toBe(200);
  expect(iconResponse.headers()["content-type"]).toContain("image/svg+xml");
  expect(await iconResponse.text()).toContain('fill="#1f4f82"');

  for (const path of ["/resources", "/gantt-demo"]) {
    await page.goto(path);
    await expect(page).toHaveTitle("masterGantt");
  }

  const firstName = "첫 프로젝트 제목";
  const secondName = "두 번째 프로젝트 제목";
  const renamedName = "변경된 프로젝트 제목";
  const firstPath = await createProject(page, firstName);
  const secondPath = await createProject(page, secondName);

  const initialDocument = await page.request.get(secondPath);
  expect(initialDocument.status()).toBe(200);
  expect(await initialDocument.text()).toContain(`<title>masterGantt|${secondName}</title>`);

  await page.reload();
  await expect(page.getByRole("heading", { name: secondName, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${secondName}`);
  await page.goto(firstPath);
  await expect(page.getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${firstName}`);
  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await expect(page).toHaveTitle("masterGantt");
  await page.getByRole("link", { name: secondName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${secondPath}$`));
  await expect(page.getByRole("heading", { name: secondName, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${secondName}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();

  const projectEndpoint = `**/api${secondPath}`;
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
  await settings.getByLabel("프로젝트 이름", { exact: true }).fill(renamedName);
  await expect(page).toHaveTitle(`masterGantt|${secondName}`);

  const failSave = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "PATCH") await route.fulfill({ status: 500, json: { error: { code: "TEST_ERROR" } } });
    else await route.continue();
  };
  await page.route(projectEndpoint, failSave);
  await settings.getByRole("button", { name: "프로젝트 정보 저장", exact: true }).click();
  await expect(page).toHaveTitle(`masterGantt|${secondName}`);
  await expect(settings.getByLabel("프로젝트 이름", { exact: true })).toHaveValue(renamedName);
  await page.unroute(projectEndpoint, failSave);

  await settings.getByRole("button", { name: "프로젝트 정보 저장", exact: true }).click();
  await expect(page.getByRole("heading", { name: renamedName, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${renamedName}`);

  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  const conflictSave = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({ status: 412, json: { error: { code: "REVISION_CONFLICT" } } });
    } else if (route.request().method() === "GET") {
      await refreshGate;
      await route.continue();
    } else await route.continue();
  };
  await page.route(projectEndpoint, conflictSave);
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  await settings.getByLabel("프로젝트 이름", { exact: true }).fill("저장되지 않은 이름");
  await settings.getByRole("button", { name: "프로젝트 정보 저장", exact: true }).click();
  try {
    await expect(page.getByText("프로젝트 정보를 불러오는 중입니다.")).toBeVisible();
    await expect(page).toHaveTitle("masterGantt");
  } finally { releaseRefresh(); }
  await expect(page.getByRole("heading", { name: renamedName, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${renamedName}`);
  await page.unroute(projectEndpoint, conflictSave);

  const expiredSave = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "PATCH") await route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } });
    else await route.continue();
  };
  await page.route(projectEndpoint, expiredSave);
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  await settings.getByLabel("프로젝트 이름", { exact: true }).fill("권한이 만료된 초안");
  await settings.getByRole("button", { name: "프로젝트 정보 저장", exact: true }).click();
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${renamedName}`);
  await page.unroute(projectEndpoint, expiredSave);

  const failedLookup = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "GET") await route.fulfill({ status: 500, json: { error: { code: "TEST_ERROR" } } });
    else await route.continue();
  };
  await page.route(projectEndpoint, failedLookup);
  await page.goto(secondPath);
  await expect(page.getByRole("heading", { name: "프로젝트를 불러올 수 없습니다." })).toBeVisible();
  await expect(page).toHaveTitle("masterGantt");
  await page.unroute(projectEndpoint, failedLookup);

  const sameNamePath = await createProject(page, firstName);
  expect(sameNamePath).not.toBe(firstPath);
  await page.goto(firstPath);
  await expect(page.getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${firstName}`);
  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await expect(page).toHaveTitle("masterGantt");
  const sameNameId = sameNamePath.split("/").at(-1)!;
  await page.locator(`tr[data-project-id="${sameNameId}"]`).getByRole("link", { name: firstName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${sameNamePath}$`));
  await expect(page.getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`masterGantt|${firstName}`);
  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await expect(page).toHaveTitle("masterGantt");

  const renderFailure = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    const upstream = await route.fetch();
    const body = await upstream.json() as { data: { tasks: unknown[] } };
    body.data.tasks = [null];
    await route.fulfill({ response: upstream, json: body });
  };
  await page.route(projectEndpoint, renderFailure);
  await page.goto(secondPath);
  await expect(page.getByRole("heading", { name: "화면을 불러오지 못했습니다." })).toBeVisible();
  await expect(page).toHaveTitle("masterGantt");
  await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toBeVisible();
  await page.unroute(projectEndpoint, renderFailure);

  await page.goto("/projects/00000000-0000-4000-8000-000000000141");
  await expect(page.getByRole("heading", { name: "프로젝트를 찾을 수 없습니다." })).toBeVisible();
  await expect(page).toHaveTitle("masterGantt");
  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await expect(page).toHaveTitle("masterGantt");
});
