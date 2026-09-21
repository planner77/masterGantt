import { E2E_PROJECT_OWNER, expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);
function uniqueSuffix(): string { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

test("생성·목록·직접 읽기·실제 링크 복사와 매번 비밀번호를 확인하는 삭제", async ({ browser, page }) => {
  const suffix = uniqueSuffix();
  const name = `E2E Project ${suffix}`;
  const password = `E2E-password-${suffix}`;
  const initialCollectionResponse = await page.request.get("/api/projects");
  expect(initialCollectionResponse.status()).toBe(200);
  const initialCollection = await initialCollectionResponse.json();
  const initialProjectCount = initialCollection.data.projects.length;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "프로젝트", exact: true })).toBeVisible();
  if (initialProjectCount === 0) await expect(page.getByRole("heading", { name: "아직 프로젝트가 없습니다." })).toBeVisible();
  else {
    await expect(page.getByRole("table", { name: "프로젝트 목록" })).toBeVisible();
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(initialProjectCount);
  }
  await page.getByRole("link", { name: "프로젝트 만들기" }).first().click();
  await page.waitForURL("/projects/new");
  const create = page.getByRole("button", { name: "프로젝트 만들기" });
  await create.click();
  await expect(page.locator(".form-error")).toHaveText("프로젝트 이름을 입력해 주세요.");
  await page.getByLabel("프로젝트 이름").fill(name);
  await create.click();
  await expect(page.locator(".form-error")).toHaveText("소유자를 입력해 주세요.");
  await page.getByLabel("소유자").fill(E2E_PROJECT_OWNER);
  await page.getByLabel("편집 비밀번호").fill("😀".repeat(11));
  await create.click();
  await expect(page.locator(".form-error")).toHaveText("편집 비밀번호는 12자 이상이어야 합니다.");
  await page.getByLabel("설명 (선택)").fill("브라우저 통합 검증 프로젝트");
  await page.getByLabel("편집 비밀번호").fill(password);
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const directUrl = page.url();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  await expect(page.locator(".project-facts, .edit-panels")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "프로젝트 일정 Grid와 Gantt 차트" })).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-table-container")).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-chart")).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: `${name} 프로젝트 링크 복사`, exact: true }).click();
  await expect(page.getByTestId("workspace-toast")).toContainText("프로젝트 링크를 복사했습니다");
  const detailCopiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(detailCopiedUrl).toBe(directUrl);
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  await expect(page.getByRole("button", { name: "프로젝트 정보 저장" })).toBeVisible();
  await page.getByRole("button", { name: "프로젝트 설정 닫기" }).click();
  expect(directUrl).not.toContain(password);
  expect(await page.locator("body").innerText()).not.toContain(password);
  const collectionResponse = await page.request.get("/api/projects");
  expect(collectionResponse.status()).toBe(200);
  const collection = await collectionResponse.json();
  expect(collection.data.projects).toEqual(expect.arrayContaining([expect.objectContaining({ name, description: "브라우저 통합 검증 프로젝트", ownerName: E2E_PROJECT_OWNER })]));
  await page.getByRole("link", { name: "프로젝트", exact: true }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("heading", { name: "프로젝트", exact: true })).toBeVisible();
  const projectLink = page.getByRole("link", { name: new RegExp(name) });
  await page.setViewportSize({ width: 1440, height: 900 });
  const mainWidth = await page.locator("main.main-content").evaluate((element) => element.getBoundingClientRect().width);
  expect(mainWidth).toBeGreaterThan(1200);
  await expect(projectLink.locator("xpath=ancestor::tr")).toContainText("브라우저 통합 검증 프로젝트");
  await expect(projectLink.locator("xpath=ancestor::tr")).toContainText(E2E_PROJECT_OWNER);
  const listActionTrigger = projectLink.locator("xpath=ancestor::tr").getByRole("button", { name: `${name} 프로젝트 작업`, exact: true });

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const documentOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(documentOverflow).toBe(false);
    await listActionTrigger.click();
    const responsiveMenu = page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true });
    await expect(responsiveMenu).toBeVisible();
    const menuBox = await responsiveMenu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
    expect(menuBox!.y).toBeGreaterThanOrEqual(0);
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(900);
    const menuItems = responsiveMenu.getByRole("menuitem");
    await expect(menuItems).toHaveCount(3);
    await expect(menuItems.nth(0)).toHaveText("프로젝트 복사");
    await expect(menuItems.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menuItems.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(menuItems.nth(2)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(responsiveMenu).toHaveCount(0);
    await expect(listActionTrigger).toBeFocused();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await listActionTrigger.click();
  let listMenu = page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true });
  await expect(listMenu).toBeVisible();
  await page.getByRole("heading", { name: "프로젝트", exact: true }).click();
  await expect(listMenu).toHaveCount(0);

  await listActionTrigger.click();
  listMenu = page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true });
  await listMenu.getByRole("button", { name: `${name} 프로젝트 링크 복사`, exact: true }).click();
  await expect(page.getByTestId("workspace-toast")).toContainText("프로젝트 링크를 복사했습니다");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(detailCopiedUrl);
  await expect(page).toHaveURL(new URL("/", directUrl).href);

  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); },
  } }));
  await listActionTrigger.click();
  listMenu = page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true });
  await listMenu.getByRole("button", { name: `${name} 프로젝트 링크 복사`, exact: true }).click();
  const fallbackDialog = page.getByRole("dialog", { name: "프로젝트 링크 수동 복사", exact: true });
  await expect(fallbackDialog).toBeVisible();
  await expect(fallbackDialog.getByLabel("프로젝트 바로 가기 URL")).toHaveValue(detailCopiedUrl);
  await expect(listMenu).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(fallbackDialog).toHaveCount(0);
  await expect(listMenu).toHaveCount(0);
  await expect(listActionTrigger).toBeFocused();

  await page.reload();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await projectLink.click(); await page.waitForURL(directUrl);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  const readonlyContext = await browser.newContext();
  try {
    const readonlyPage = await readonlyContext.newPage();
    await readonlyPage.goto("/");
    const readonlyRow = readonlyPage.locator(`tr[data-project-id="${directUrl.split("/").pop()}"]`);
    const readonlyActionTrigger = readonlyRow.getByRole("button", { name: `${name} 프로젝트 작업`, exact: true });
    await expect(readonlyActionTrigger).toBeVisible();
    await readonlyActionTrigger.click();
    const readonlyMenu = readonlyPage.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true });
    await expect(readonlyMenu.getByRole("link", { name: "프로젝트 복사", exact: true })).toBeVisible();
    await expect(readonlyMenu.getByRole("button", { name: `${name} 프로젝트 링크 복사`, exact: true })).toBeVisible();
    await expect(readonlyMenu.getByRole("button", { name: "삭제", exact: true })).toBeVisible();
    await readonlyPage.keyboard.press("Escape");
    await expect(readonlyActionTrigger).toBeFocused();
    await readonlyPage.goto(detailCopiedUrl);
    await expect(readonlyPage.getByRole("heading", { name })).toBeVisible();
    await expect(readonlyPage.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(readonlyPage.getByRole("button", { name: "편집 잠금 해제" })).toBeVisible();
    await readonlyPage.reload();
    await expect(readonlyPage.getByText("읽기 전용", { exact: true })).toBeVisible();
  } finally { await readonlyContext.close(); }

  await page.goto("/");
  const row = page.locator(`tr[data-project-id="${directUrl.split("/").pop()}"]`);
  await expect(row).toContainText(name);
  let deleteRequests = 0;
  page.on("request", (request) => { if (request.method() === "DELETE") deleteRequests++; });
  const deleteActionTrigger = row.getByRole("button", { name: `${name} 프로젝트 작업`, exact: true });
  await deleteActionTrigger.click();
  await page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true })
    .getByRole("button", { name: "삭제", exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "프로젝트 삭제", exact: true });
  await expect(deletion).toContainText(name);
  await expect(deletion).toContainText("모든 일정이 삭제됩니다");
  await expect(deletion).toContainText("복구할 수 없습니다");
  await deletion.getByLabel("삭제 확인 비밀번호").fill("wrong-password-123");
  await deletion.getByRole("button", { name: "비밀번호 확인 후 삭제" }).click();
  await expect(deletion.getByRole("alert")).toContainText("올바르지 않습니다");
  await expect(deletion.getByLabel("삭제 확인 비밀번호")).toHaveValue("");
  expect(deleteRequests).toBe(0);
  expect((await page.request.get(`/api/projects/${directUrl.split("/").pop()}`)).status()).toBe(200);

  // 실제 server code를 allowlist가 다른 이름으로 바꾸거나 버리지 않고 안전하게 복사해야 한다.
  await page.keyboard.press("Escape");
  await expect(deletion).toHaveCount(0);
  await page.getByRole("button", { name: "알림함, 미확인 1건" }).click();
  const notificationInbox = page.getByRole("dialog", { name: "오류 알림함" });
  const credentialNotice = notificationInbox.getByLabel("알림 1 내용");
  await expect(credentialNotice).toHaveValue(/오류 코드: INVALID_CREDENTIALS/);
  await expect(credentialNotice).not.toHaveValue(/INVALID_PASSWORD|wrong-password-123/);
  await notificationInbox.getByRole("button", { name: "내용 복사", exact: true }).click();
  await expect(notificationInbox.getByRole("status")).toContainText("알림 내용을 복사했습니다");
  const copiedCredentialError = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedCredentialError).toContain("오류 코드: INVALID_CREDENTIALS");
  expect(copiedCredentialError).not.toMatch(/INVALID_PASSWORD|wrong-password-123/);
  await page.keyboard.press("Escape");

  await deleteActionTrigger.click();
  await page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true })
    .getByRole("button", { name: "삭제", exact: true }).click();
  await deletion.getByLabel("삭제 확인 비밀번호").fill(password);
  await deletion.getByRole("button", { name: "비밀번호 확인 후 삭제" }).click();
  await expect(row).toHaveCount(0);
  expect(deleteRequests).toBe(1);
  const deletedSnapshot = await page.request.get(`/api/projects/${directUrl.split("/").pop()}`);
  expect(deletedSnapshot.status()).toBe(404);
  await page.goto(directUrl);
  await expect(page.getByRole("heading", { name: "프로젝트를 찾을 수 없습니다." })).toBeVisible();
});

test("clears a password after a safe server validation error and permits recovery", async ({ page }) => {
  const suffix = uniqueSuffix();
  const password = `E2E-password-${suffix}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill(`Validation ${suffix}`);
  await page.getByLabel("소유자").fill(E2E_PROJECT_OWNER);
  await page.getByLabel("설명 (선택)").fill("x".repeat(4_001));
  await page.getByLabel("편집 비밀번호").fill(password);
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await expect(page.locator(".form-error")).toHaveText("프로젝트 입력값을 확인해 주세요.");
  await expect(page.getByLabel("편집 비밀번호")).toHaveValue("");
  expect(await page.locator("body").innerText()).not.toContain(password);
  await page.getByLabel("설명 (선택)").fill("");
  await page.getByLabel("편집 비밀번호").fill(password);
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});