import type { Page } from "@playwright/test";
import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

async function createProject(page: Page, name: string, password: string) {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill(name);
  await page.getByLabel("편집 비밀번호").fill(password);
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const url = page.url();
  return { name, url, publicId: new URL(url).pathname.split("/").at(-1)! };
}

async function copyLink(page: Page, name: string, expected: string) {
  const currentUrl = page.url();
  const copyButton = page.getByRole("button", { name: `${name} 프로젝트 링크 복사`, exact: true });
  if (!(await copyButton.isVisible().catch(() => false))) {
    const actionTrigger = page.getByRole("button", { name: `${name} 프로젝트 작업`, exact: true });
    await actionTrigger.click();
    await expect(page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: `${name} 프로젝트 링크 복사`, exact: true }).click();
  await expect(page.getByTestId("workspace-toast")).toContainText("프로젝트 링크를 복사했습니다");
  // 실제 Chromium clipboard를 읽는 것은 테스트에서만 수행한다. 앱은 읽기 권한을 요청하지 않는다.
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await expect(page).toHaveURL(currentUrl);
}

test("두 프로젝트의 링크를 구분하고 이름 변경·새 탭·새 세션에서도 publicId와 권한을 보존한다", async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Link-test-${suffix}`;
  const first = await createProject(page, `링크 A ${suffix}`, password);
  const second = await createProject(page, `링크 B ${suffix}`, password);
  expect(first.publicId).not.toBe(second.publicId);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.method());
  });
  await copyLink(page, first.name, first.url);
  await copyLink(page, second.name, second.url);
  expect(mutations).toEqual([]);

  const row = page.locator(`tr[data-project-id="${first.publicId}"]`);
  const actionTrigger = row.getByRole("button", { name: `${first.name} 프로젝트 작업`, exact: true });
  await actionTrigger.click();
  let rowMenu = page.getByRole("menu", { name: `${first.name} 프로젝트 작업`, exact: true });
  await expect(rowMenu).toBeVisible();
  await rowMenu.getByRole("button", { name: "삭제", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 삭제", exact: true });
  await expect(dialog).toContainText(first.name);
  await dialog.getByLabel("삭제 확인 비밀번호").fill(password);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(actionTrigger).toBeFocused();
  expect(mutations).toEqual([]);
  await actionTrigger.click();
  rowMenu = page.getByRole("menu", { name: `${first.name} 프로젝트 작업`, exact: true });
  await rowMenu.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(dialog.getByLabel("삭제 확인 비밀번호")).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(actionTrigger).toBeFocused();
  expect(mutations).toEqual([]);

  // 기존 Path=/ 단일 편집 쿠키는 두 번째 프로젝트 생성으로 교체된다.
  // 첫 프로젝트의 유효한 세션은 정상 UI 인증으로 다시 만든 뒤 검증한다.
  await page.goto(first.url);
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await page.getByLabel("편집 비밀번호").fill(password);
  const unlockResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === `/api/projects/${first.publicId}/edit-sessions`);
  await page.getByRole("button", { name: "편집 잠금 해제", exact: true }).click();
  expect((await unlockResponse).status()).toBe(204);
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  expect(mutations).toEqual(["POST"]);

  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  const renamed = `변경된 링크 A ${suffix}`;
  await page.getByLabel("프로젝트 이름").fill(renamed);
  await page.getByRole("button", { name: "프로젝트 정보 저장" }).click();
  await expect(page.getByRole("heading", { name: renamed, exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "프로젝트 설정", exact: true })).toHaveCount(0);
  const mutationCount = mutations.length;
  expect(mutations).toEqual(["POST", "PATCH"]);
  const beforeCopy = await page.request.get(`/api/projects/${first.publicId}`);
  const revision = (await beforeCopy.json()).data.project.revision;
  await copyLink(page, renamed, first.url);
  await page.goto("/");
  await copyLink(page, renamed, first.url);
  await copyLink(page, second.name, second.url);
  expect(mutations).toHaveLength(mutationCount);
  const afterCopy = await page.request.get(`/api/projects/${first.publicId}`);
  expect((await afterCopy.json()).data.project.revision).toBe(revision);

  // 같은 브라우저의 유효한 편집 세션은 링크를 열어도 유지한다.
  const sameSessionTab = await page.context().newPage();
  try {
    await sameSessionTab.goto(first.url);
    await expect(sameSessionTab.getByRole("heading", { name: renamed, exact: true })).toBeVisible();
    await expect(sameSessionTab.getByText("편집 가능", { exact: true })).toBeVisible();
  } finally {
    await sameSessionTab.close();
  }
  // 링크 자체에는 권한이 없다. 별도 세션에서 직접 접근하고 새로고침해도 읽기 전용이다。
  const readonlyContext = await browser.newContext();
  try {
    const readonlyPage = await readonlyContext.newPage();
    await readonlyPage.goto(first.url);
    await expect(readonlyPage.getByRole("heading", { name: renamed, exact: true })).toBeVisible();
    await expect(readonlyPage.getByText("읽기 전용", { exact: true })).toBeVisible();
    await readonlyPage.reload();
    await expect(readonlyPage.getByText("읽기 전용", { exact: true })).toBeVisible();
    expect(new URL(readonlyPage.url()).search).toBe("");
    expect(new URL(readonlyPage.url()).hash).toBe("");
    expect(readonlyPage.url()).not.toContain(password);
  } finally {
    await readonlyContext.close();
  }
});
