import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { deferred, expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

type Kind = "copy" | "template";
type GetFailure = "500" | "network" | "null-task" | "revision" | "wrong-source";
const copiedId = "b3405d3d-8cb4-4da4-9b0f-43a5de330003";
const labels = {
  copy: { trigger: "프로젝트 복사", dialog: "프로젝트 복사", name: "새 프로젝트명", description: "설명", submit: "복사본 생성", password: "원본 편집 비밀번호" },
  template: { trigger: "템플릿으로 저장", dialog: "프로젝트 템플릿으로 저장", name: "템플릿 이름", description: "설명 (선택)", submit: "템플릿 저장", password: "프로젝트 편집 비밀번호" },
};
async function fixture(page: Page) {
  const source = await installStatefulProjectFixture(page);
  source.project.ownerName = "테스트 소유자";
  source.project.calendar.holidays = [{ date: "2026-10-09", name: "한글날" }];
  const state = {
    source, getFailure: null as GetFailure | null, mutationFailure: null as "401" | "412" | null,
    getGate: null as ReturnType<typeof deferred> | null,
    authGate: null as ReturnType<typeof deferred> | null,
    getStarted: deferred(), getCompleted: deferred(), authStarted: deferred(), gets: 0, posts: 0, authPosts: 0, matches: [] as string[],
  };
  const snapshot = () => ({ data: { project: source.project, tasks: source.tasks, links: source.links, permission: "readonly", logistics: { processes: [], equipment: [], systems: [], systemLinks: [] } } });
  await page.route(`**/api/projects/${publicId}`, async (route) => {
    const completed = state.getCompleted;
    try {
      state.gets++;
      const body = structuredClone(snapshot());
      const gate = state.getGate;
      state.getStarted.resolve();
      if (gate) await gate.promise;
      if (state.getFailure === "network") return await route.abort();
      if (state.getFailure === "500") return await route.fulfill({ status: 500, json: {} });
      const value: unknown = state.getFailure === "null-task" ? { data: { ...body.data, tasks: [null] } }
        : state.getFailure === "revision" ? { data: { ...body.data, project: { ...body.data.project, revision: 1.5 } } }
        : state.getFailure === "wrong-source" ? { data: { ...body.data, project: { ...body.data.project, publicId: copiedId } } }
        : body;
      await route.fulfill({ json: value }).catch(() => {});
    } finally {
      completed.resolve();
    }
  });
  await page.route(`**/api/projects/${publicId}/edit-sessions`, async (route) => {
    state.authPosts++; state.authStarted.resolve();
    if (state.authGate) await state.authGate.promise;
    source.sessionEditable = true;
    await route.fulfill({ status: 204 });
  });
  const mutation = async (route: Route) => {
    state.posts++; state.matches.push(route.request().headers()["if-match"]);
    if (state.mutationFailure) {
      if (state.mutationFailure === "401") source.sessionEditable = false;
      if (state.mutationFailure === "412") source.project.revision++;
      return route.fulfill({ status: Number(state.mutationFailure), json: { error: { message: "fixture rejection" } } });
    }
    return route.fulfill({ status: 201, json: { data: { project: { ...source.project, publicId: copiedId }, operation: { kind: "projectCopy" }, warnings: [] } } });
  };
  await page.route(`**/api/projects/${publicId}/copy`, mutation);
  await page.route("**/api/project-templates", mutation);
  await page.route(`**/api/projects/${copiedId}`, (route) => route.fulfill({ json: { data: { ...snapshot().data, project: { ...source.project, publicId: copiedId, name: "복사 결과" } } } }));
  await page.route(`**/api/projects/${copiedId}/edit-sessions/current`, (route) => route.fulfill({ json: { data: { permission: "readonly" } } }));
  return state;
}
async function show(page: Page, kind: Kind) {
  const menu = page.locator(".project-action-menu");
  if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open))) await menu.locator("summary").click();
  const trigger = menu.getByRole("button", { name: labels[kind].trigger, exact: true });
  await trigger.click();
  return { dialog: page.getByRole("dialog", { name: labels[kind].dialog, exact: true }), trigger };
}
async function draft(dialog: Locator, kind: Kind) {
  await dialog.getByLabel(labels[kind].name, { exact: true }).fill("사용자 초안");
  await dialog.getByLabel(labels[kind].description, { exact: true }).fill("보존할 설명");
  if (kind === "copy") {
    await dialog.getByLabel("소유자", { exact: true }).fill("사용자 소유자");
    await copyPasswords(dialog);
  }
}
async function copyPasswords(dialog: Locator) {
  await dialog.getByLabel("새 편집 비밀번호", { exact: true }).fill("new-pass");
  await dialog.getByLabel("새 편집 비밀번호 확인", { exact: true }).fill("new-pass");
}
async function success(page: Page, kind: Kind, dialog: Locator) {
  if (kind === "copy") {
    await expect(page).toHaveURL(new RegExp(`/projects/${copiedId}$`));
    await expect(page.getByText("읽기 전용", { exact: true }).first()).toBeVisible();
  } else await expect(dialog).toHaveCount(0);
}

for (const kind of ["copy", "template"] as const) {
  test(`${kind} 401 재인증은 초안을 보존하고 auth POST부터 닫기·중복 제출을 잠근다`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto(`/projects/${publicId}`);
    const { dialog } = await show(page, kind);
    await draft(dialog, kind);
    state.mutationFailure = "401";
    await dialog.getByRole("button", { name: labels[kind].submit, exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("만료");
    const password = dialog.getByLabel(labels[kind].password, { exact: true });
    await expect(password).toBeFocused(); await expect(password).toHaveValue("");
    await expect(dialog.getByLabel(labels[kind].name, { exact: true })).toHaveValue("사용자 초안");
    await expect(dialog.getByLabel(labels[kind].description, { exact: true })).toHaveValue("보존할 설명");
    if (kind === "copy") {
      await expect(dialog.getByLabel("새 편집 비밀번호", { exact: true })).toHaveValue("");
      await expect(dialog.getByLabel("새 편집 비밀번호 확인", { exact: true })).toHaveValue("");
      await copyPasswords(dialog);
    }
    await password.fill("source-pass");
    state.mutationFailure = null; state.authGate = deferred();
    await dialog.getByRole("button", { name: labels[kind].submit, exact: true }).click();
    await state.authStarted.promise;
    await expect(dialog.getByRole("button", { name: `${labels[kind].dialog} 닫기`, exact: true })).toBeDisabled();
    await expect(dialog.locator('button[type="submit"]')).toBeDisabled();
    await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
    expect(state.authPosts).toBe(1); expect(state.posts).toBe(1);
    state.authGate.resolve();
    await success(page, kind, dialog);
    expect(state.posts).toBe(2);
  });

  test(`${kind} 412는 명시 원본 GET 후 새 If-Match로만 재제출한다`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto(`/projects/${publicId}`);
    const { dialog } = await show(page, kind);
    await draft(dialog, kind); state.mutationFailure = "412";
    await dialog.getByRole("button", { name: labels[kind].submit, exact: true }).click();
    await expect(dialog.getByRole("button", { name: "최신 원본 확인" })).toBeVisible();
    await expect(dialog.locator('button[type="submit"]')).toBeDisabled();
    await expect(dialog.getByText(/이전 조회 정보/)).toBeVisible();
    expect(state.posts).toBe(1);
    state.mutationFailure = null;
    await dialog.getByRole("button", { name: "최신 원본 확인" }).click();
    await expect(dialog.getByRole("status").filter({ hasText: "최신 원본 revision 41" })).toBeVisible();
    await expect(dialog.getByLabel(labels[kind].name, { exact: true })).toHaveValue("사용자 초안");
    await expect(dialog.getByLabel(labels[kind].description, { exact: true })).toHaveValue("보존할 설명");
    expect(state.posts).toBe(1);
    if (kind === "copy") await copyPasswords(dialog);
    await dialog.getByRole("button", { name: labels[kind].submit, exact: true }).click();
    await success(page, kind, dialog);
    expect(state.matches).toEqual(['"40"', '"41"']);
  });

  for (const failure of ["500", "network", "null-task", "revision", "wrong-source"] as const) {
    test(`${kind} 최초 GET ${failure}는 mutation을 막고 retry로 복구한다`, async ({ page }) => {
      const state = await fixture(page);
      await page.goto(`/projects/${publicId}`);
      await page.getByRole("tab", { name: "일정", exact: true }).waitFor();
      state.getFailure = failure;
      const { dialog } = await show(page, kind);
      await expect(dialog.getByRole("alert")).toBeVisible();
      if (kind === "copy") await expect(dialog.locator('button[type="submit"]')).toHaveCount(0);
      else await expect(dialog.locator('button[type="submit"]')).toBeDisabled();
      expect(state.posts).toBe(0);
      state.getFailure = null;
      await dialog.getByRole("button", { name: "다시 시도" }).click();
      await expect(dialog.getByLabel(labels[kind].name, { exact: true })).toBeEnabled();
      await expect(dialog.getByLabel(labels[kind].name, { exact: true })).not.toHaveValue("");
      if (kind === "copy") await expect(dialog.getByText(/휴일 1/)).toBeVisible();
    });
  }

  test(`${kind} 재진입 GET 실패는 이전 snapshot으로 제출하지 못한다`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto(`/projects/${publicId}`);
    const first = await show(page, kind);
    await expect(first.dialog.getByLabel(labels[kind].name, { exact: true })).not.toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(first.trigger).toBeFocused();
    state.getFailure = "500";
    const second = await show(page, kind);
    await expect(second.dialog.getByRole("alert")).toBeVisible();
    if (kind === "copy") await expect(second.dialog.locator('button[type="submit"]')).toHaveCount(0);
    else await expect(second.dialog.locator('button[type="submit"]')).toBeDisabled();
    expect(state.posts).toBe(0);
  });

  test(`${kind} 지연 GET 중 닫기·재열기는 이전 응답을 무시한다`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto(`/projects/${publicId}`);
    await page.getByRole("tab", { name: "일정", exact: true }).waitFor();
    state.getGate = deferred(); state.getStarted = deferred(); state.getCompleted = deferred();
    const first = await show(page, kind);
    await state.getStarted.promise;
    if (kind === "template") await expect(first.dialog.getByLabel("템플릿 이름")).toBeDisabled();
    await first.dialog.getByRole("button", { name: `${labels[kind].dialog} 닫기`, exact: true }).click();
    await expect(first.trigger).toBeFocused();
    const oldGate = state.getGate; const oldCompleted = state.getCompleted;
    state.getGate = null; state.getCompleted = deferred();
    state.source.project.name = "새 원본"; state.source.project.revision = 41;
    const second = await show(page, kind);
    await expect(second.dialog.getByLabel(labels[kind].name, { exact: true })).toHaveValue(kind === "copy" ? "새 원본 (복사본)" : "새 원본 템플릿");
    oldGate.resolve();
    await oldCompleted.promise;
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(second.dialog.getByLabel(labels[kind].name, { exact: true })).toHaveValue(kind === "copy" ? "새 원본 (복사본)" : "새 원본 템플릿");
    await expect(second.dialog.getByText(/원본 revision 41/)).toBeVisible();
    expect(state.posts).toBe(0);
  });

  for (const width of [390, 768, 1024, 1440]) {
    test(`${kind} 401 오류·입력·닫기 keyboard와 focus 복원 ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const state = await fixture(page);
      await page.goto(`/projects/${publicId}`);
      const root = await rememberGanttRoot(page);
      const { dialog, trigger } = await show(page, kind);
      await draft(dialog, kind); state.mutationFailure = "401";
      await dialog.getByRole("button", { name: labels[kind].submit, exact: true }).click();
      await expect(dialog.getByLabel(labels[kind].password, { exact: true })).toBeFocused();
      await expect(dialog.getByRole("alert")).toBeVisible();
      const close = dialog.getByRole("button", { name: `${labels[kind].dialog} 닫기`, exact: true });
      const heading = dialog.getByRole("heading", { name: labels[kind].dialog, exact: true });
      const titleGeometry = await heading.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { width: rect.width, height: rect.height, lineHeight: Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5 };
      });
      expect(titleGeometry.width).toBeGreaterThan(120);
      expect(titleGeometry.height).toBeLessThanOrEqual(titleGeometry.lineHeight * 2 + 1);
      expect(await close.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(100);
      await close.focus(); await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await dialog.evaluate((element) => { element.scrollTop = 0; });
      await expect(heading).toBeInViewport();
      await expect(close).toBeInViewport();
      await page.screenshot({ path: `output/playwright/issue-269/${kind}-401-${width}.png` });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      await expectSameGanttRoot(page, root);
    });
  }
}

test("Copy 제출 전 revision 변경은 POST0으로 최신 원본 확인으로 돌아간다", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(`/projects/${publicId}`);
  const { dialog } = await show(page, "copy");
  await draft(dialog, "copy"); state.source.project.revision = 41;
  await dialog.getByRole("button", { name: "복사본 생성" }).click();
  await expect(dialog.getByRole("button", { name: "최신 원본 확인" })).toBeVisible();
  expect(state.posts).toBe(0);
  await dialog.getByRole("button", { name: "최신 원본 확인" }).click();
  await expect(dialog.getByRole("status").filter({ hasText: "revision 41" })).toBeVisible();
  await copyPasswords(dialog);
  await dialog.getByRole("button", { name: "복사본 생성" }).click();
  await success(page, "copy", dialog);
  expect(state.matches).toEqual(['"41"']);
});

test("copy=1 자동 진입은 StrictMode에서도 최신 원본 ready로 복구한다", async ({ page }) => {
  await fixture(page);
  await page.goto(`/projects/${publicId}?copy=1`);
  const dialog = page.getByRole("dialog", { name: "프로젝트 복사", exact: true });
  await expect(dialog.getByLabel("새 프로젝트명", { exact: true })).not.toHaveValue("");
  await expect(dialog.getByRole("button", { name: "복사본 생성" })).toBeEnabled();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
});
