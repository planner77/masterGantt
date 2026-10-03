import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type {
  ProjectSnapshotResponse,
  ProjectTaskDto,
  TaskMutationResponse,
} from "../../src/contracts/projects";

test.use(isolatedApplicationOptions);

const row = (page: import("@playwright/test").Page, name: string) =>
  page.locator(".project-gantt-widget .wx-row", { hasText: name }).first();
const rowByTaskId = (page: import("@playwright/test").Page, taskId: string) =>
  page.locator(`.project-gantt-widget .wx-row[data-id=":${taskId}"]`).first();
const menu = (page: import("@playwright/test").Page) =>
  page.getByRole("menu", { name: "작업 메뉴", exact: true });

async function openMenu(page: import("@playwright/test").Page, name: string) {
  await row(page, name).getByText(name, { exact: true }).click({ button: "right" });
  await expect(menu(page)).toBeVisible();
  return menu(page);
}

async function openMenuByTaskId(page: import("@playwright/test").Page, taskId: string) {
  await rowByTaskId(page, taskId).click({ button: "right" });
  await expect(menu(page)).toBeVisible();
  return menu(page);
}

async function chooseSubmenu(
  page: import("@playwright/test").Page,
  parent: string,
  item: string,
): Promise<TaskMutationResponse> {
  const root = menu(page);
  const trigger = root.getByRole("menuitem", { name: parent, exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.hover();
  const submenu = page.getByRole("menu", { name: parent, exact: true });
  const action = submenu.getByRole("menuitem", { name: item, exact: true });
  await expect(action).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse((candidate) =>
      candidate.request().method() === "POST" &&
      new URL(candidate.url()).pathname.endsWith("/task-commands"),
    ),
    action.click(),
  ]);
  expect(response.ok(), `task command ${parent} > ${item}: HTTP ${response.status()}`).toBe(true);
  await expect(root).toHaveCount(0);
  return await response.json() as TaskMutationResponse;
}

async function chooseCommand(
  page: import("@playwright/test").Page,
  item: string,
): Promise<TaskMutationResponse> {
  const root = menu(page);
  const action = root.getByRole("menuitem", { name: item, exact: true });
  await expect(action).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse((candidate) =>
      candidate.request().method() === "POST" &&
      new URL(candidate.url()).pathname.endsWith("/task-commands"),
    ),
    action.click(),
  ]);
  expect(response.ok(), `task command ${item}: HTTP ${response.status()}`).toBe(true);
  await expect(root).toHaveCount(0);
  return await response.json() as TaskMutationResponse;
}

async function createRootTask(
  page: import("@playwright/test").Page,
  api: string,
  origin: string,
  revision: number,
  name: string,
): Promise<TaskMutationResponse> {
  const response = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${revision}"` },
    data: { name, type: "task", start: "2026-09-21", duration: 1, progress: 0 },
  });
  expect(response.status()).toBe(201);
  return await response.json() as TaskMutationResponse;
}

function orderedRootNames(tasks: readonly ProjectTaskDto[]): string[] {
  return tasks
    .filter((task) => task.parentExternalId === null)
    .sort((left, right) => left.siblingOrder - right.siblingOrder)
    .map((task) => task.name);
}

test("Issue #72 menu exposes Willow commands and readonly users cannot mutate", async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Context menu ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("CtxPwd12345!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const created = await createRootTask(page, api, origin, initial.data.project.revision, "Alpha");
  await page.reload();
  await expect(row(page, "Alpha")).toBeVisible();

  const taskMenu = await openMenu(page, "Alpha");
  for (const label of ["Add", "Convert to", "Edit", "Cut", "Copy", "Paste", "Move", "Indent", "Outdent", "Delete"]) {
    await expect(taskMenu.getByRole("menuitem", { name: label, exact: true })).toHaveCount(1);
  }
  await expect(taskMenu.getByText("Ctrl+X", { exact: true })).toBeVisible();
  await expect(taskMenu.getByText("Ctrl+C", { exact: true })).toBeVisible();
  await expect(taskMenu.getByText("Ctrl+D / Backspace", { exact: true })).toBeVisible();
  await expect(taskMenu.getByRole("menuitem", { name: "Paste", exact: true })).toBeDisabled();
  await expect(taskMenu.getByRole("menuitem", { name: "Indent", exact: true })).toBeDisabled();
  await expect(taskMenu.getByRole("menuitem", { name: "Outdent", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const readonly = await context.newPage();
    await readonly.goto(`${origin}${path}`);
    await expect(readonly.getByText("읽기 전용", { exact: true })).toBeVisible();
    const readonlyMenu = await openMenu(readonly, "Alpha");
    await expect(readonlyMenu.getByRole("menuitem", { name: "Edit", exact: true })).toBeEnabled();
    for (const label of ["Add", "Convert to", "Cut", "Copy", "Paste", "Move", "Indent", "Outdent", "Delete"]) {
      await expect(readonlyMenu.getByRole("menuitem", { name: label, exact: true })).toBeDisabled();
    }
  } finally {
    await context.close();
  }

  expect(created.data.tasks.some((task) => task.name === "Alpha")).toBe(true);
});

test("Issue #399 opens Summary scopes in Workspace tabs without creating a browser tab", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Workspace scope tabs ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("ScopeTab123!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const path = new URL(page.url()).pathname, api = `/api${path}`, origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const alphaCreated = await createRootTask(page, api, origin, initial.data.project.revision, "Scope Alpha");
  await createRootTask(page, api, origin, alphaCreated.data.project.revision, "Scope Beta");
  await page.reload();
  await openMenu(page, "Scope Alpha"); const alphaSnapshot = await chooseSubmenu(page, "Add", "Child task");
  const alpha = alphaSnapshot.data.tasks.find((task) => task.name === "Scope Alpha"); expect(alpha?.type).toBe("summary");
  await openMenu(page, "Scope Beta"); const betaSnapshot = await chooseSubmenu(page, "Add", "Child task");
  const beta = betaSnapshot.data.tasks.find((task) => task.name === "Scope Beta"); expect(beta?.type).toBe("summary");
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance"), apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const browserPageCount = page.context().pages().length;
  const alphaMenu = await openMenu(page, "Scope Alpha");
  await alphaMenu.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  expect(page.context().pages()).toHaveLength(browserPageCount);
  const tabs = page.getByRole("tablist", { name: "WBS 범위 탭" }), allTab = tabs.getByRole("tab", { name: "전체 프로젝트", exact: true }), alphaTab = tabs.getByRole("tab", { name: "Scope Alpha", exact: true });
  await expect(alphaTab).toHaveAttribute("aria-selected", "true"); expect(new URL(page.url()).searchParams.get("rootTask")).toBe(alpha!.taskId);
  await expect(row(page, "Scope Beta")).toHaveCount(0);

  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
  const search = page.getByLabel("작업명, 설명, External ID 검색"); await search.fill("Scope Alpha"); await allTab.click(); await expect(search).toHaveValue(""); await expect(row(page, "Scope Beta")).toBeVisible();
  const betaMenu = await openMenu(page, "Scope Beta"); await betaMenu.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  const betaTab = tabs.getByRole("tab", { name: "Scope Beta", exact: true }); await expect(tabs.getByRole("tab")).toHaveCount(3);
  await alphaTab.click(); await expect(search).toHaveValue("Scope Alpha"); await allTab.click();
  const reopen = await openMenu(page, "Scope Alpha"); await reopen.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  await expect(tabs.getByRole("tab", { name: "Scope Alpha", exact: true })).toHaveCount(1);
  for (const width of [390,768,1024,1440]) { await page.setViewportSize({ width, height:900 }); const layout=await page.evaluate(()=>{const el=document.querySelector<HTMLElement>(".project-scope-tabs");if(!el)throw new Error("scope tabs not found");return {overflowY:getComputedStyle(el).overflowY,doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};}); expect(layout.overflowY).toBe("hidden"); expect(layout.doc).toBe(false); }
  await allTab.focus(); await page.keyboard.press("End"); await expect(betaTab).toHaveAttribute("aria-selected","true"); await page.keyboard.press("ArrowLeft"); await expect(alphaTab).toHaveAttribute("aria-selected","true");
  await page.getByRole("button",{name:"Scope Alpha 범위 탭 닫기",exact:true}).click(); await expect(betaTab).toHaveAttribute("aria-selected","true"); expect(new URL(page.url()).searchParams.get("rootTask")).toBe(beta!.taskId);
  await page.reload(); const rtabs=page.getByRole("tablist",{name:"WBS 범위 탭"}); await expect(rtabs.getByRole("tab",{name:"Scope Beta",exact:true})).toHaveAttribute("aria-selected","true"); await expect(rtabs.getByRole("tab",{name:"Scope Alpha",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Scope Beta 범위 탭 닫기",exact:true}).click(); await expect(rtabs.getByRole("tab",{name:"전체 프로젝트",exact:true})).toHaveAttribute("aria-selected","true"); expect(new URL(page.url()).searchParams.get("rootTask")).toBeNull();
});

test("Issue #407 allows subtree-local task additions in a Workspace scope", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Scoped add ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("ScopeAdd123!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  await createRootTask(page, api, origin, initial.data.project.revision, "Scope Root");
  await page.reload();

  await openMenu(page, "Scope Root");
  const initialChildSnapshot = await chooseSubmenu(page, "Add", "Child task");
  const rootTask = initialChildSnapshot.data.tasks.find((task) => task.name === "Scope Root");
  const originalLeaf = rootTask
    ? initialChildSnapshot.data.tasks.find((task) => task.parentExternalId === rootTask.externalId)
    : undefined;
  expect(rootTask?.type).toBe("summary");
  expect(originalLeaf).toBeTruthy();
  await expect(rowByTaskId(page, originalLeaf!.taskId)).toBeVisible();

  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const rootMenu = await openMenu(page, "Scope Root");
  await rootMenu.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();

  const scopeTabs = page.getByRole("tablist", { name: "WBS 범위 탭" });
  const allTab = scopeTabs.getByRole("tab", { name: "전체 프로젝트", exact: true });
  const scopeTab = scopeTabs.getByRole("tab", { name: "Scope Root", exact: true });
  await expect(scopeTab).toHaveAttribute("aria-selected", "true");

  const headerAdd = page.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first();
  await expect(headerAdd).toHaveAttribute("aria-disabled", "true");
  const scopedRootAdd = rowByTaskId(page, rootTask!.taskId).locator('[data-action="add-task"]');
  await expect(scopedRootAdd).toHaveAttribute("aria-disabled", "false");

  const beforeNativeIds = new Set(initialChildSnapshot.data.tasks.map((task) => task.taskId));
  const [nativeResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `${api}/tasks`,
    ),
    scopedRootAdd.click(),
  ]);
  expect(nativeResponse.status()).toBe(201);
  const nativeSnapshot = await nativeResponse.json() as TaskMutationResponse;
  const nativeLeaf = nativeSnapshot.data.tasks.find((task) =>
    !beforeNativeIds.has(task.taskId) && task.parentExternalId === rootTask!.externalId,
  );
  expect(nativeLeaf).toBeTruthy();
  await expect(rowByTaskId(page, nativeLeaf!.taskId)).toBeVisible();
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");

  await openMenuByTaskId(page, rootTask!.taskId);
  const emptySummarySnapshot = await chooseSubmenu(page, "Add", "요약 작업 추가");
  const nativeIds = new Set(nativeSnapshot.data.tasks.map((task) => task.taskId));
  const emptySummary = emptySummarySnapshot.data.tasks.find((task) =>
    !nativeIds.has(task.taskId) &&
    task.parentExternalId === rootTask!.externalId &&
    task.type === "summary",
  );
  expect(emptySummary).toBeTruthy();
  await expect(rowByTaskId(page, emptySummary!.taskId)).toBeVisible();

  await openMenuByTaskId(page, emptySummary!.taskId);
  const summaryChildSnapshot = await chooseSubmenu(page, "Add", "Child task");
  const emptySummaryIds = new Set(emptySummarySnapshot.data.tasks.map((task) => task.taskId));
  const summaryChild = summaryChildSnapshot.data.tasks.find((task) =>
    !emptySummaryIds.has(task.taskId) && task.parentExternalId === emptySummary!.externalId,
  );
  expect(summaryChild).toBeTruthy();
  await expect(rowByTaskId(page, summaryChild!.taskId)).toBeVisible();

  await openMenuByTaskId(page, nativeLeaf!.taskId);
  const convertedSnapshot = await chooseSubmenu(page, "Add", "Child task");
  const beforeConvertIds = new Set(summaryChildSnapshot.data.tasks.map((task) => task.taskId));
  const convertedChild = convertedSnapshot.data.tasks.find((task) =>
    !beforeConvertIds.has(task.taskId) && task.parentExternalId === nativeLeaf!.externalId,
  );
  expect(convertedSnapshot.data.tasks.find((task) => task.taskId === nativeLeaf!.taskId)?.type).toBe("summary");
  expect(convertedChild).toBeTruthy();
  await expect(rowByTaskId(page, convertedChild!.taskId)).toBeVisible();
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");

  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);

  await allTab.click();
  await expect(allTab).toHaveAttribute("aria-selected", "true");
  await expect(rowByTaskId(page, nativeLeaf!.taskId)).toBeVisible();
  await expect(rowByTaskId(page, emptySummary!.taskId)).toBeVisible();
  await expect(rowByTaskId(page, convertedChild!.taskId)).toBeVisible();
});

test("Issue #373 direct subtree deep link keeps scoped editing and cross-tab freshness", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Subtree scope ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("ScopePwd123!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const alphaCreated = await createRootTask(page, api, origin, initial.data.project.revision, "Scope Alpha");
  const keepCreated = await createRootTask(page, api, origin, alphaCreated.data.project.revision, "Keep sibling");

  await page.reload();
  await expect(row(page, "Scope Alpha")).toBeVisible();
  await expect(row(page, "Keep sibling")).toBeVisible();

  const leafMenu = await openMenu(page, "Keep sibling");
  await expect(leafMenu.getByText("최상위로 열기", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await openMenu(page, "Scope Alpha");
  const childAdded = await chooseSubmenu(page, "Add", "Child task");
  const alpha = childAdded.data.tasks.find((task) => task.name === "Scope Alpha");
  const child = alpha ? childAdded.data.tasks.find((task) => task.parentExternalId === alpha.externalId) : undefined;
  expect(alpha?.type).toBe("summary");
  expect(child).toBeTruthy();
  await expect(row(page, child!.name)).toBeVisible();

  const scopeMenu = await openMenu(page, "Scope Alpha");
  await expect(scopeMenu.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const scopedPage = await page.context().newPage();
  await scopedPage.goto(`${origin}${path}?rootTask=${encodeURIComponent(alpha!.taskId)}`);
  try {
    await scopedPage.waitForURL((url) => url.pathname === path && url.searchParams.get("rootTask") === alpha!.taskId);
    const scopeTabs = scopedPage.getByRole("tablist", { name: "WBS 범위 탭" });
    await expect(scopeTabs.getByRole("tab", { name: "전체 프로젝트", exact: true })).toBeVisible();
    await expect(scopeTabs.getByRole("tab", { name: "Scope Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(scopedPage.getByText("편집 중", { exact: true })).toBeVisible();
    await expect(row(scopedPage, "Scope Alpha")).toBeVisible();
    await expect(row(scopedPage, child!.name)).toBeVisible();
    await expect(row(scopedPage, "Keep sibling")).toHaveCount(0);
    await expect(scopedPage.getByRole("button", { name: "요약 작업 추가", exact: true })).toHaveCount(0);
    await expect(scopedPage.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first()).toHaveAttribute("aria-disabled", "true");
    await expect(rowByTaskId(scopedPage, alpha!.taskId).locator('[data-action="add-task"]')).toHaveAttribute("aria-disabled", "false");

    const rootScopedMenu = await openMenu(scopedPage, "Scope Alpha");
    await rootScopedMenu.getByRole("menuitem", { name: "Add", exact: true }).hover();
    const addSubmenu = scopedPage.getByRole("menu", { name: "Add", exact: true });
    await expect(addSubmenu.getByRole("menuitem", { name: "Child task", exact: true })).toBeEnabled();
    await expect(addSubmenu.getByRole("menuitem", { name: "Task above", exact: true })).toBeDisabled();
    await expect(addSubmenu.getByRole("menuitem", { name: "Task below", exact: true })).toBeDisabled();
    await scopedPage.keyboard.press("Escape");

    let firstMutationSnapshot: unknown = null;
    let releaseFirstRefresh!: () => void;
    let markFirstMutationReady!: () => void;
    const firstRefreshGate = new Promise<void>((resolve) => { releaseFirstRefresh = resolve; });
    const firstMutationReady = new Promise<void>((resolve) => { markFirstMutationReady = resolve; });
    let holdFirstCrossTabRead = true;
    await page.route((url) => url.pathname === api, async (route) => {
      if (route.request().method() !== "GET" || !holdFirstCrossTabRead) {
        await route.continue();
        return;
      }
      holdFirstCrossTabRead = false;
      await firstMutationReady;
      await firstRefreshGate;
      await route.fulfill({ json: firstMutationSnapshot });
    });

    await openMenu(scopedPage, child!.name);
    await menu(scopedPage).getByRole("menuitem", { name: "Edit", exact: true }).click();
    const editor = scopedPage.getByRole("dialog", { name: "작업 정보", exact: true });
    await expect(editor).toBeVisible();
    await editor.getByLabel("작업명", { exact: true }).fill("Scoped child renamed");
    const [saved] = await Promise.all([
      scopedPage.waitForResponse((response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === `${api}/tasks/${child!.taskId}`,
      ),
      editor.getByRole("button", { name: "저장", exact: true }).click(),
    ]);
    expect(saved.ok(), `scoped task edit: HTTP ${saved.status()}`).toBe(true);
    firstMutationSnapshot = await saved.json();
    markFirstMutationReady();
    await expect(row(scopedPage, "Scoped child renamed")).toBeVisible();
    await expect(row(scopedPage, "Keep sibling")).toHaveCount(0);

    await openMenu(scopedPage, "Scoped child renamed");
    await menu(scopedPage).getByRole("menuitem", { name: "Edit", exact: true }).click();
    await expect(editor).toBeVisible();
    await editor.getByLabel("작업명", { exact: true }).fill("Scoped child renamed twice");
    const [secondSaved] = await Promise.all([
      scopedPage.waitForResponse((response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === `${api}/tasks/${child!.taskId}`,
      ),
      editor.getByRole("button", { name: "저장", exact: true }).click(),
    ]);
    expect(secondSaved.ok(), `second scoped task edit: HTTP ${secondSaved.status()}`).toBe(true);
    await expect(row(scopedPage, "Scoped child renamed twice")).toBeVisible();

    releaseFirstRefresh();
    await page.bringToFront();
    await expect(row(page, "Scoped child renamed twice")).toBeVisible();
    await expect(row(page, "Keep sibling")).toBeVisible();

    // A second receiver can still be loading when a newer revision arrives.
    // Hold its initial canonical GET at revision N, save revision N+1 from the
    // scoped tab, then release the stale response. The queued revision must
    // trigger a follow-up GET after the receiver becomes ready.
    const staleBeforeThird = await (await scopedPage.request.get(api)).json() as ProjectSnapshotResponse;
    const loadingPage = await page.context().newPage();
    let releaseLoadingRead!: () => void;
    let markLoadingReadStarted!: () => void;
    const loadingReadGate = new Promise<void>((resolve) => { releaseLoadingRead = resolve; });
    const loadingReadStarted = new Promise<void>((resolve) => { markLoadingReadStarted = resolve; });
    let holdInitialLoadingRead = true;
    await loadingPage.route((url) => url.pathname === api, async (route) => {
      if (route.request().method() !== "GET" || !holdInitialLoadingRead) {
        await route.continue();
        return;
      }
      holdInitialLoadingRead = false;
      markLoadingReadStarted();
      await loadingReadGate;
      await route.fulfill({ json: staleBeforeThird });
    });
    const loadingNavigation = loadingPage.goto(`${origin}${path}`);
    await loadingReadStarted;

    await scopedPage.bringToFront();
    await openMenu(scopedPage, "Scoped child renamed twice");
    await menu(scopedPage).getByRole("menuitem", { name: "Edit", exact: true }).click();
    await expect(editor).toBeVisible();
    await editor.getByLabel("작업명", { exact: true }).fill("Scoped child final");
    const [thirdSaved] = await Promise.all([
      scopedPage.waitForResponse((response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === `${api}/tasks/${child!.taskId}`,
      ),
      editor.getByRole("button", { name: "저장", exact: true }).click(),
    ]);
    expect(thirdSaved.ok(), `third scoped task edit: HTTP ${thirdSaved.status()}`).toBe(true);
    releaseLoadingRead();
    await loadingNavigation;
    await expect(row(loadingPage, "Scoped child final")).toBeVisible();
    await loadingPage.close();

    await scopedPage.reload();
    await expect(scopedPage.getByRole("tablist", { name: "WBS 범위 탭" }).getByRole("tab", { name: "Scope Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(row(scopedPage, "Scoped child final")).toBeVisible();
    await expect(row(scopedPage, "Keep sibling")).toHaveCount(0);
  } finally {
    await scopedPage.close();
  }

  expect(keepCreated.data.tasks.some((task) => task.name === "Keep sibling")).toBe(true);
});

test("Issue #72 hierarchy commands persist across reload without remounting the Gantt", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Hierarchy E2E ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("HierPwd1234!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const a = await createRootTask(page, api, origin, initial.data.project.revision, "Alpha");
  const b = await createRootTask(page, api, origin, a.data.project.revision, "Beta");
  await createRootTask(page, api, origin, b.data.project.revision, "Gamma");

  await page.reload();
  await expect(row(page, "Gamma")).toBeVisible();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");

  await openMenu(page, "Beta");
  const moved = await chooseSubmenu(page, "Move", "Move up");
  expect(orderedRootNames(moved.data.tasks)).toEqual(["Beta", "Alpha", "Gamma"]);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);

  await openMenu(page, "Gamma");
  const indented = await chooseCommand(page, "Indent");
  const gammaIndented = indented.data.tasks.find((task) => task.name === "Gamma")!;
  const alphaSummary = indented.data.tasks.find((task) => task.name === "Alpha")!;
  expect(gammaIndented.parentExternalId).toBe(alphaSummary.externalId);
  expect(alphaSummary.type).toBe("summary");

  // 기존 여러-child Outdent 경로를 유지한다. 마지막 child Outdent로 부모가
  // 비는 경우는 #345 empty-summary persistence 시나리오에서 검증한다.
  await openMenu(page, "Alpha");
  const childAdded = await chooseSubmenu(page, "Add", "Child task");
  expect(childAdded.data.tasks.filter((task) => task.parentExternalId === alphaSummary.externalId)).toHaveLength(2);

  await openMenu(page, "Gamma");
  await expect(menu(page).getByRole("menuitem", { name: "Outdent", exact: true })).toBeEnabled();
  const outdented = await chooseCommand(page, "Outdent");
  expect(outdented.data.tasks.find((task) => task.name === "Gamma")!.parentExternalId).toBeNull();

  await openMenu(page, "Beta");
  const milestone = await chooseSubmenu(page, "Convert to", "Milestone");
  expect(milestone.data.tasks.find((task) => task.name === "Beta")!.type).toBe("milestone");

  await openMenu(page, "Beta");
  const taskAgain = await chooseSubmenu(page, "Convert to", "Task");
  expect(taskAgain.data.tasks.find((task) => task.name === "Beta")!.type).toBe("task");

  await openMenu(page, "Beta");
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
  await openMenu(page, "Gamma");
  const copied = await chooseSubmenu(page, "Paste", "Below");
  expect(copied.data.tasks.filter((task) => task.name === "Beta")).toHaveLength(2);

  await openMenu(page, "Gamma");
  const added = await chooseSubmenu(page, "Add", "Task above");
  expect(added.data.tasks.some((task) => task.name === "새 작업")).toBe(true);

  const finalRevision = added.data.project.revision;
  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const persisted = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(persisted.data.project.revision).toBe(finalRevision);
  expect(persisted.data.tasks.filter((task) => task.name === "Beta")).toHaveLength(2);
  expect(persisted.data.tasks.find((task) => task.name === "Gamma")!.parentExternalId).toBeNull();
  expect(persisted.data.tasks.some((task) => task.name === "새 작업")).toBe(true);
});
