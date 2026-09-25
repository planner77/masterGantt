import { randomUUID } from "node:crypto";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

type Status = "planned" | "in_progress" | "completed";

async function createProject(page: import("@playwright/test").Page, baseURL: string, name: string, status: Status) {
  const response = await page.request.post("/api/projects", {
    headers: { Origin: baseURL },
    data: { name, ownerName: "Status Team", description: `${name} description`, editPassword: "StatusPwd12!", status },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data.project.publicId as string;
}

test("상태 다중 선택은 검색과 AND이고 기본·초기화·페이지 재진입은 예정+진행 중이다", async ({ page, baseURL }) => {
  const suffix = randomUUID().slice(0, 8);
  const planned = `Alpha ${suffix}`;
  const progressing = `Beta ${suffix}`;
  const completed = `Gamma ${suffix}`;
  await createProject(page, baseURL!, planned, "planned");
  await createProject(page, baseURL!, progressing, "in_progress");
  const completedId = await createProject(page, baseURL!, completed, "completed");
  const collection = await (await page.request.get("/api/projects")).json();
  const createdAt = collection.data.projects.find((project: { publicId: string }) => project.publicId === completedId)?.createdAt as string;
  expect(createdAt).toBeTruthy();
  const beforeCreated = new Date(createdAt);
  expect(Number.isNaN(beforeCreated.getTime())).toBe(false);
  beforeCreated.setUTCFullYear(beforeCreated.getUTCFullYear() - 1);
  const cutoffDate = beforeCreated.toISOString().slice(0, 10);
  await page.goto("/");

  const table = page.getByRole("table", { name: "프로젝트 목록" });
  const rows = table.locator("tbody tr");
  const result = page.locator(".project-filter-result");
  const filterButton = page.locator('button[aria-controls="project-list-advanced-filter"]');
  await expect(rows).toHaveCount(2);
  await expect(table).toContainText(planned);
  await expect(table).toContainText(progressing);
  await expect(table).not.toContainText(completed);
  await expect(rows.filter({ hasText: planned }).getByRole("cell", { name: "예정" })).toBeVisible();
  await expect(rows.filter({ hasText: progressing }).getByRole("cell", { name: "진행 중" })).toBeVisible();
  await expect(rows.filter({ hasText: progressing }).locator('[data-status="in_progress"]')).toBeVisible();
  const plannedColor = await rows.filter({ hasText: planned }).locator('[data-status="planned"]').evaluate((element) => getComputedStyle(element).backgroundColor);
  const progressingColor = await rows.filter({ hasText: progressing }).locator('[data-status="in_progress"]').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(progressingColor).not.toBe(plannedColor);
  await expect(result).toContainText("2 / 3개 프로젝트");
  await expect(filterButton).toHaveText("필터");

  let listGets = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname === "/api/projects") listGets += 1;
  });
  const initialGets = listGets;
  await filterButton.click();
  const panel = page.getByLabel("프로젝트 고급 필터");
  const statuses = panel.getByRole("group", { name: "프로젝트 상태" });
  await expect(statuses.getByRole("checkbox", { name: "예정" })).toBeChecked();
  await expect(statuses.getByRole("checkbox", { name: "진행 중" })).toBeChecked();
  await expect(statuses.getByRole("checkbox", { name: "완료" })).not.toBeChecked();
  await expect(statuses).toContainText("완료 프로젝트는 선택하면 목록에 표시됩니다.");

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(statuses.getByRole("checkbox", { name: "완료" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if (width <= 768) {
      expect(await table.evaluate((element) => element.parentElement!.scrollWidth > element.parentElement!.clientWidth)).toBe(true);
    }
  }

  await statuses.getByRole("checkbox", { name: "완료" }).focus();
  await page.keyboard.press("Space");
  await expect(statuses.getByRole("checkbox", { name: "완료" })).toBeChecked();
  await expect(rows).toHaveCount(3);
  await expect(filterButton).toHaveText("필터 1");
  await expect(rows.filter({ hasText: completed }).getByRole("cell", { name: "완료" })).toBeVisible();
  const completedColor = await rows.filter({ hasText: completed }).locator('[data-status="completed"]').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(completedColor).not.toBe(progressingColor);
  await statuses.getByRole("checkbox", { name: "예정" }).uncheck();
  await statuses.getByRole("checkbox", { name: "진행 중" }).uncheck();
  await expect(rows).toHaveCount(1);
  await expect(table).toContainText(completed);
  await expect(filterButton).toHaveText("필터 1");
  const search = page.getByLabel("프로젝트명, 소유자 또는 설명 검색");
  await search.fill("Gamma");
  await expect(rows).toHaveCount(1);
  await expect(table).toContainText(completed);
  await expect(filterButton).toHaveText("필터 2");
  const created = panel.getByRole("group", { name: "생성일" });
  await created.getByLabel("생성일 조건").selectOption("before");
  await created.locator('input[type="date"]').fill(cutoffDate);
  await expect(page.getByRole("heading", { name: "조건에 맞는 프로젝트가 없습니다." })).toBeVisible();
  await created.getByLabel("생성일 조건").selectOption("after");
  await expect(rows).toHaveCount(1);
  await expect(table).toContainText(completed);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(filterButton).toBeFocused();
  expect(await filterButton.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await filterButton.click();
  await statuses.getByRole("checkbox", { name: "완료" }).uncheck();
  await expect(page.getByRole("heading", { name: "조건에 맞는 프로젝트가 없습니다." })).toBeVisible();
  await expect(result).toContainText("0 / 3개 프로젝트");
  await search.fill("");
  await expect(page.getByRole("heading", { name: "조건에 맞는 프로젝트가 없습니다." })).toBeVisible();
  await expect(page.getByText("선택한 상태가 없습니다. 프로젝트 상태를 선택하거나 초기화해 주세요.")).toBeVisible();
  await expect(filterButton).toHaveText("필터 1");
  expect(listGets).toBe(initialGets);

  await page.getByRole("button", { name: "검색/필터 초기화" }).click();
  await expect(rows).toHaveCount(2);
  await expect(filterButton).toHaveText("필터");
  await expect(statuses.getByRole("checkbox", { name: "예정" })).toBeChecked();
  await expect(statuses.getByRole("checkbox", { name: "진행 중" })).toBeChecked();
  await expect(statuses.getByRole("checkbox", { name: "완료" })).not.toBeChecked();
  await expect(search).toBeFocused();
  await statuses.getByRole("checkbox", { name: "완료" }).check();
  await page.getByRole("link", { name: planned, exact: true }).click();
  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await expect(rows).toHaveCount(2);
  await expect(filterButton).toHaveText("필터");
  expect(new URL(page.url()).search).toBe("");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("project") && key.includes("filter")))).toEqual([]);
  await filterButton.click();
  await page.getByRole("group", { name: "프로젝트 상태" }).getByRole("checkbox", { name: "완료" }).check();
  await expect(rows).toHaveCount(3);
  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(filterButton).toHaveText("필터");
});

test("생성 기본값과 설정 변경은 canonical 상태를 목록·읽기 화면에 반영하고 revision 충돌을 보존한다", async ({ browser, page, baseURL }) => {
  const suffix = randomUUID().slice(0, 8);
  const name = `Status editable ${suffix}`;
  await page.goto("/projects/new");
  await expect(page.getByLabel("프로젝트 상태")).toHaveValue("planned");
  await page.getByLabel("프로젝트 이름").fill(name);
  await page.getByLabel("소유자").fill("Status Team");
  await page.getByLabel("편집 비밀번호").fill("StatusPwd12!");
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
  const publicId = page.url().split("/").pop()!;
  const badge = page.locator(".project-lifecycle-badge");
  await expect(badge).toHaveText("예정");

  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 설정" });
  await dialog.getByLabel("프로젝트 상태").selectOption("completed");
  await dialog.getByRole("button", { name: "프로젝트 정보 저장" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(badge).toHaveText("완료");
  await expect(badge).toHaveAttribute("data-status", "completed");
  const completedSnapshot = await (await page.request.get(`/api/projects/${publicId}`)).json();
  expect(completedSnapshot.data.project.status).toBe("completed");

  await page.setViewportSize({ width: 390, height: 844 });
  for (const locator of [page.getByRole("heading", { name }), badge, page.getByText("편집 중", { exact: true }), page.getByLabel("프로젝트 정보 보기"), page.getByLabel("프로젝트 작업 더보기")]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const readonlyContext = await browser.newContext({ baseURL });
  const readonlyPage = await readonlyContext.newPage();
  await readonlyPage.goto(`/projects/${publicId}`);
  await expect(readonlyPage.locator(".project-lifecycle-badge")).toHaveText("완료");
  await expect(readonlyPage.getByText("읽기 전용", { exact: true })).toBeVisible();
  await expect(readonlyPage.getByRole("button", { name: "프로젝트 설정", exact: true })).toHaveCount(0);
  await expect(readonlyPage.getByRole("combobox", { name: "프로젝트 상태", exact: true })).toHaveCount(0);
  await readonlyContext.close();

  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await expect(page.getByRole("table", { name: "프로젝트 목록" }).getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
  const filterButton = page.locator('button[aria-controls="project-list-advanced-filter"]');
  await filterButton.click();
  await page.getByRole("group", { name: "프로젝트 상태" }).getByRole("checkbox", { name: "완료" }).check();
  await expect(page.getByRole("row", { name: new RegExp(name) }).getByRole("cell", { name: "완료" })).toBeVisible();
  await page.getByRole("link", { name, exact: true }).click();
  await expect(badge).toHaveText("완료");

  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  await dialog.getByLabel("프로젝트 상태").selectOption("in_progress");
  await dialog.getByRole("button", { name: "프로젝트 정보 저장" }).click();
  await expect(badge).toHaveText("진행 중");
  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) }).getByRole("cell", { name: "진행 중" })).toBeVisible();
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  await dialog.getByLabel("프로젝트 상태").selectOption("planned");
  const current = await (await page.request.get(`/api/projects/${publicId}`)).json();
  const conflicting = await page.request.patch(`/api/projects/${publicId}`, {
    headers: { Origin: baseURL!, "If-Match": `"${current.data.project.revision}"` },
    data: { status: "completed" },
  });
  expect(conflicting.status()).toBe(200);
  await dialog.getByRole("button", { name: "프로젝트 정보 저장" }).click();
  await expect(page.getByTestId("workspace-toast")).toContainText("다른 편집 내용이 먼저 저장되었습니다.");
  await expect(badge).toHaveText("완료");
});

test("권한 만료 401은 상태 초안을 canonical 표시로 승격하지 않는다", async ({ page, baseURL }) => {
  const name = `Status unauthorized ${randomUUID().slice(0, 8)}`;
  const publicId = await createProject(page, baseURL!, name, "planned");
  await page.goto(`/projects/${publicId}`);
  const badge = page.locator(".project-lifecycle-badge");
  await expect(badge).toHaveText("예정");
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 설정" });
  await dialog.getByLabel("프로젝트 상태").selectOption("completed");
  let patchRequests = 0;
  await page.route(`**/api/projects/${publicId}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    patchRequests += 1;
    expect(route.request().headers()["if-match"]).toMatch(/^"\d+"$/);
    expect(route.request().postDataJSON().status).toBe("completed");
    await route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } });
  });
  await dialog.getByRole("button", { name: "프로젝트 정보 저장" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(badge).toHaveText("예정");
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  expect(patchRequests).toBe(1);
});
