import { expect, test, type Page } from "@playwright/test";
import { deferred, expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

const linkId = "00000000-0000-4000-8000-000000000080";
const title = "작업 관계 관리 (Relation Editor)";
const dialog = (page: Page) => page.getByRole("dialog", { name: title, exact: true });
async function setup(page: Page, readonly = false, longNames = false) {
  const fixture = await installStatefulProjectFixture(page);
  fixture.sessionEditable = !readonly;
  for (const item of fixture.tasks) { item.start = "2026-09-16"; item.end = "2026-09-17"; item.requestedStart = item.type === "summary" ? null : item.start; }
  fixture.tasks.push({ ...fixture.tasks[2], taskId: "00000000-0000-4000-8000-000000000005", externalId: "CANDIDATE", name: longNames ? "후보 작업 " + "아주긴한국어와LongUnbrokenName".repeat(15) : "후보 작업", siblingOrder: 4 });
  fixture.links.push({ id: linkId, predecessorExternalId: "LEAF-1", successorExternalId: "MILESTONE-1", type: "FS", lag: 0 }, { id: "00000000-0000-4000-8000-000000000081", predecessorExternalId: "LEAF-1", successorExternalId: "SUMMARY-CHILD-1", type: "FS", lag: 0 });
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByRole("heading", { level: 1, name: fixture.project.name })).toBeVisible();
  const root = await rememberGanttRoot(page);
  await page.locator(`[data-link-id=":${linkId}"]`).first().dblclick({ force: true });
  await expect(dialog(page)).toBeVisible();
  return { fixture, root };
}

test("후보 native Enter/Space와 popup Escape, dirty 닫기·관계 선택 보호 및 Gantt 유지", async ({ page }) => {
  const { root } = await setup(page);
  const modal = dialog(page);
  const search = modal.getByPlaceholder("작업명 / 외부 ID / 작업 ID 검색...");
  await search.fill("후보");
  const candidate = modal.getByRole("button", { name: /후보 작업.*외부 ID: CANDIDATE.*작업 ID:/ });
  await candidate.focus();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  await expect(candidate).toHaveCount(0);
  await expect(modal).toBeVisible();
  await search.fill("후보 작업");
  await modal.getByRole("button", { name: `${title} 닫기`, exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  await expect(candidate).toHaveCount(0);
  await search.fill("후보 작업 ");
  await candidate.focus();
  await page.keyboard.press("Enter");
  await expect(modal.getByText("후보 작업", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(modal.getByRole("button", { name: "계속 편집" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  await expect(modal.getByText("후보 작업", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "선택", exact: true }).click();
  await expect(modal.getByText("저장하지 않은 변경이 있습니다. 변경을 버리시겠습니까?")).toBeVisible();
  await modal.getByRole("button", { name: "계속 편집" }).click();
  await expect(modal.getByText("후보 작업", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "선택", exact: true }).click();
  await modal.getByRole("button", { name: "변경 버리기" }).click();
  await search.fill("후보");
  await candidate.focus();
  await page.keyboard.press("Space");
  await expect(modal.getByText("후보 작업", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "닫기", exact: true }).click();
  await modal.getByRole("button", { name: "변경 버리기" }).click();
  await expect(modal).toHaveCount(0);
  await expectSameGanttRoot(page, root);
  expect(await page.evaluate(() => document.activeElement?.closest(".project-gantt-frame") !== null)).toBe(true);
});

test("명시적 닫기는 후보 popup보다 우선해 dirty 닫기 확인으로 진입한다", async ({ page }) => {
  await setup(page);
  const modal = dialog(page);
  const search = modal.getByPlaceholder("작업명 / 외부 ID / 작업 ID 검색...");
  await search.fill("후보");
  await expect(modal.getByRole("button", { name: /후보 작업.*외부 ID: CANDIDATE.*작업 ID:/ })).toBeVisible();

  await modal.getByRole("button", { name: `${title} 닫기`, exact: true }).click();

  await expect(modal.getByText("저장하지 않은 변경이 있습니다. 변경을 버리시겠습니까?")).toBeVisible();
  await expect(modal.getByRole("button", { name: "계속 편집" })).toBeFocused();
});

test("선행 방향 관계 생성 성공 후 새 관계 초안이 초기화되어 바로 닫힌다", async ({ page }) => {
  const { fixture, root } = await setup(page);
  let createRequests = 0;
  await page.route(`**/api/projects/${publicId}/links`, async (route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    createRequests++;
    const payload = route.request().postDataJSON() as {
      predecessorExternalId: string;
      successorExternalId: string;
      type: "FS" | "SS" | "FF" | "SF";
      lag: number;
    };
    const createdLink = {
      id: "00000000-0000-4000-8000-000000000099",
      predecessorExternalId: payload.predecessorExternalId,
      successorExternalId: payload.successorExternalId,
      type: payload.type,
      lag: payload.lag,
    };
    fixture.links.push(createdLink);
    fixture.project.revision += 1;
    await route.fulfill({
      status: 201,
      json: {
        data: {
          project: { ...fixture.project },
          tasks: fixture.tasks.map((entry) => ({ ...entry })),
          links: fixture.links.map((entry) => ({ ...entry })),
          warnings: [],
          operation: { kind: "linkCreate" },
        },
      },
    });
  });
  const modal = dialog(page);

  await modal.getByLabel("연결 방향").selectOption("predecessor");
  await modal.getByPlaceholder("작업명 / 외부 ID / 작업 ID 검색...").fill("후보");
  await modal.getByRole("button", { name: /후보 작업.*외부 ID: CANDIDATE.*작업 ID:/ }).click();
  await modal.getByRole("button", { name: "관계 추가", exact: true }).click();

  await expect.poll(() => createRequests).toBe(1);
  await expect(modal.getByLabel("연결 방향")).toHaveValue("successor");
  await expect(modal.getByPlaceholder("작업명 / 외부 ID / 작업 ID 검색...")).toHaveValue("");
  await modal.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expectSameGanttRoot(page, root);
});

test("삭제 확인은 대상 이름을 표시하고 취소는 DELETE를 보내지 않는다", async ({ page }) => {
  await setup(page);
  let deletes = 0;
  page.on("request", (request) => { if (request.method() === "DELETE" && request.url().includes("/links/")) deletes++; });
  await dialog(page).getByRole("button", { name: "관계 삭제", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("Stable leaf → Stable milestone");
  await dialog(page).getByRole("button", { name: "삭제 취소" }).click();
  expect(deletes).toBe(0);
  await expect(dialog(page)).toBeVisible();
});

for (const method of ["POST", "PATCH", "DELETE"] as const) {
  test(`${method} 요청 중 Escape·닫기·중복 요청 차단과 실패 초안 유지`, async ({ page }) => {
    const { root } = await setup(page);
    const gate = deferred();
    let requests = 0;
    let payload: unknown;
    let match: string | undefined;
    await page.route(`**/api/projects/${publicId}/links**`, async (route) => {
      if (route.request().method() !== method) { await route.fallback(); return; }
      requests++; payload = route.request().postDataJSON(); match = route.request().headers()["if-match"];
      await gate.promise;
      await route.fulfill({ status: 500, json: { error: { code: "FAILED", message: "관계 변경 실패" } } });
    });
    const modal = dialog(page);
    if (method === "PATCH") { await modal.getByLabel("관계 유형 (Type)", { exact: true }).first().selectOption("SS"); await modal.getByRole("button", { name: "수정 저장" }).click(); }
    if (method === "POST") { await modal.getByPlaceholder("작업명 / 외부 ID / 작업 ID 검색...").fill("후보"); await modal.getByRole("button", { name: /후보 작업.*외부 ID: CANDIDATE.*작업 ID:/ }).click(); await modal.getByRole("button", { name: "관계 추가", exact: true }).click(); }
    if (method === "DELETE") { await modal.getByRole("button", { name: "관계 삭제", exact: true }).click(); await modal.getByRole("button", { name: "삭제 확인" }).click(); }
    await expect.poll(() => requests).toBe(1);
    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: `${title} 닫기`, exact: true })).toBeDisabled();
    await modal.getByRole("button", { name: "닫기", exact: true }).evaluate((button: HTMLButtonElement) => { button.disabled = false; button.click(); });
    await expect(modal).toBeVisible();
    if (method !== "DELETE") await modal.locator("form").nth(method === "PATCH" ? 0 : 1).evaluate((form: HTMLFormElement) => form.requestSubmit());
    expect(requests).toBe(1);
    gate.resolve();
    await expect(modal.getByRole("alert")).toContainText(method === "POST" ? "새 관계 추가에 실패" : method === "PATCH" ? "관계 수정에 실패" : "관계 삭제에 실패");
    if (method === "PATCH") await expect(modal.getByLabel("관계 유형 (Type)", { exact: true }).first()).toHaveValue("SS");
    if (method === "POST") await expect(modal.getByText("후보 작업", { exact: true })).toBeVisible();
    expect(match).toBe('"40"');
    if (method === "PATCH") expect(payload).toEqual({ type: "SS", lag: 0 });
    await expectSameGanttRoot(page, root);
  });
}

for (const width of [390, 768, 1024, 1440]) {
  test(`Readonly native modal focus containment·명령 접근 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, true);
    const modal = dialog(page);
    await expect(modal.getByRole("button", { name: "수정 저장" })).toHaveCount(0);
    await expect(modal.getByRole("button", { name: "관계 추가", exact: true })).toHaveCount(0);
    const close = modal.getByRole("button", { name: `${title} 닫기`, exact: true });
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Tab");
    expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: `output/playwright/issue-266/readonly-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
  });
}

for (const width of [390, 768, 1024, 1440]) {
  test(`편집 모드 긴 후보·명령 scroll·focus containment ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, false, true);
    const modal = dialog(page);
    const close = modal.getByRole("button", { name: `${title} 닫기`, exact: true });
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await modal.getByPlaceholder("작업명 / 외부 ID / 작업 ID 검색...").fill("후보 작업");
    const candidate = modal.getByRole("button", { name: /^후보 작업 / });
    await candidate.scrollIntoViewIfNeeded();
    await candidate.focus();
    await page.keyboard.press("Enter");
    const create = modal.getByRole("button", { name: "관계 추가", exact: true });
    await create.scrollIntoViewIfNeeded();
    await expect(create).toBeVisible();
    await expect(create).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `output/playwright/issue-266/editable-long-${width}.png` });
    await modal.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(modal.getByRole("button", { name: "계속 편집" })).toBeFocused();
    await modal.getByRole("button", { name: "계속 편집" }).click();
    await expect(modal).toBeVisible();
  });
}
