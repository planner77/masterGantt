import { openWorkspaceView } from "./helpers/workspace-navigation";
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
  const target = rowByTaskId(page, taskId);
  const nameTarget = target.locator('[role="gridcell"][data-col-id=":text"] .wx-content > .wx-text').first();
  // Keep the gesture on the canonical task-name hit area. Right-clicking the
  // row's geometric center can land on app-owned controls (for example the
  // child-add action), which are intentionally excluded from Task context
  // resolution and vary with viewport geometry.
  await nameTarget.scrollIntoViewIfNeeded();
  await expect(nameTarget).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.mouse.move(0, 0);
  await nameTarget.click({ button: "right" });
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
    (async () => {
      await action.click();
      if (parent === "Convert to" && item === "Milestone") {
        await page.getByRole("dialog", { name: "Milestone으로 변경", exact: true }).getByRole("button", { name: "Milestone으로 변경", exact: true }).click();
      }
    })(),
  ]);
  expect(response.ok(), `task command ${parent} > ${item}: HTTP ${response.status()}`).toBe(true);
  await expect(root).toHaveCount(0);
  return await response.json() as TaskMutationResponse;
}

async function expectMilestoneExcluded(page: import("@playwright/test").Page, taskId: string) {
  const frame = page.locator(".project-gantt-frame");
  await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${taskId}"]`)).toHaveCount(0);
  await expect(frame.locator(`.wx-chart .wx-bar[data-task-id=":${taskId}"]`)).toHaveCount(0);
  await expect.poll(() => frame.evaluate((node, id) => {
    const state = Reflect.get(node, "__masterganttMilestoneTimeline").read();
    return {
      visible: state.rows.some((task: { id: string | number }) => String(task.id) === id),
      selected: state.selected.includes(id),
      appSelected: state.appSelection.includes(id),
      clipboard: state.clipboardIds.includes(id),
    };
  }, taskId)).toEqual({ visible: false, selected: false, appSelected: false, clipboard: false });
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

function orderedFamily(tasks: readonly ProjectTaskDto[], parentExternalId: string | null): ProjectTaskDto[] {
  return tasks.filter((task) => task.parentExternalId === parentExternalId)
    .sort((a, b) => a.siblingOrder - b.siblingOrder);
}

async function expectRenderedSiblingOrder(
  page: import("@playwright/test").Page,
  tasks: readonly ProjectTaskDto[],
  parentExternalId: string | null,
) {
  const expected = orderedFamily(tasks, parentExternalId);
  expect(expected.map((task) => task.siblingOrder)).toEqual(expected.map((_, index) => index));
  await expect.poll(async () => {
    const ids = expected.map((task) => task.taskId);
    return page.locator(".project-gantt-widget .wx-table .wx-row[data-id]").evaluateAll(
      (rows, expectedIds) => rows.map((row) => row.getAttribute("data-id"))
        .filter((id) => expectedIds.some((taskId) => id === `:${taskId}`))
        .map((id) => id?.slice(1)),
      ids,
    );
  }).toEqual(expected.map((task) => task.taskId));
  const bars = expected.filter((task) => task.start !== null);
  await expect.poll(async () => {
    const ids = bars.map((task) => task.taskId);
    return page.locator(".project-gantt-widget .wx-chart .wx-bar[data-task-id]").evaluateAll(
      (elements, taskIds) => elements
        // SVAR 2.7.3 DOM prefixes data-task-id with ":"; the canonical DTO does not.
        // Normalize before filtering AND before returning IDs (review P1, #506).
        .map((el) => ({
          id: (el.getAttribute("data-task-id") ?? "").replace(/^:/, ""),
          top: el.getBoundingClientRect().top,
        }))
        .filter((item) => taskIds.includes(item.id))
        .sort((a, b) => a.top - b.top)
        .map((item) => item.id),
      ids,
    );
  }).toEqual(bars.map((task) => task.taskId));
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
  await expect(page.locator(".project-scope-navigation")).toHaveCount(0);
  await expect(page.locator("#schedule-heading")).toHaveText("일정");
  await expect(page.locator("#project-scope-panel")).toHaveAccessibleName("일정");
  const browserPageCount = page.context().pages().length;
  const alphaMenu = await openMenu(page, "Scope Alpha");
  await alphaMenu.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  expect(page.context().pages()).toHaveLength(browserPageCount);
  const tabs = page.getByRole("tablist", { name: "WBS 범위 탭" }), allTab = page.getByRole("button", { name: "전체 일정 보기", exact: true }).first(), alphaTab = tabs.getByRole("tab", { name: "Scope Alpha", exact: true });
  await expect(alphaTab).toHaveAttribute("aria-selected", "true"); expect(new URL(page.url()).searchParams.get("rootTask")).toBe(alpha!.taskId);
  await expect(page.getByRole("button", { name: "Summary 전체 담당자·공수", exact: true })).toBeEnabled();
  // Opening the context menu selects this Summary, whose ordinary descendants are valid.
  await expect(page.getByRole("button", { name: "담당자·공수 조회", exact: true })).toBeEnabled();
  await expect(row(page, "Scope Beta")).toHaveCount(0);

  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
  const search = page.getByLabel("작업명, 설명, External ID 검색"); await search.fill("Scope Alpha");
  await expect(allTab).toHaveAttribute("aria-pressed", "false");
  await expect(tabs.getByRole("tab", { name: "전체 프로젝트", exact: true })).toHaveCount(0);
  await openWorkspaceView(page, "milestones");
  await openWorkspaceView(page, "resources");
  await openWorkspaceView(page, "schedule");
  await expect(alphaTab).toHaveAttribute("aria-selected", "true");
  await expect(search).toHaveValue("Scope Alpha");
  expect(new URL(page.url()).searchParams.get("rootTask")).toBe(alpha!.taskId);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
  await allTab.click(); await expect(search).toHaveValue(""); await expect(row(page, "Scope Beta")).toBeVisible();
  await expect(page.locator(".project-scope-navigation")).toBeVisible();
  await expect(allTab).toHaveAttribute("aria-pressed", "true");
  const betaMenu = await openMenu(page, "Scope Beta"); await betaMenu.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  const betaTab = tabs.getByRole("tab", { name: "Scope Beta", exact: true }); await expect(tabs.getByRole("tab")).toHaveCount(2);
  await alphaTab.click(); await expect(search).toHaveValue("Scope Alpha"); await allTab.click();
  const reopen = await openMenu(page, "Scope Alpha"); await reopen.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  await expect(tabs.getByRole("tab", { name: "Scope Alpha", exact: true })).toHaveCount(1);
  for (const width of [390,768,1024,1440]) { await page.setViewportSize({ width, height:900 }); const layout=await page.evaluate(()=>{const el=document.querySelector<HTMLElement>(".project-scope-tabs");if(!el)throw new Error("scope tabs not found");return {overflowY:getComputedStyle(el).overflowY,doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};}); expect(layout.overflowY).toBe("hidden"); expect(layout.doc).toBe(false); }
  await alphaTab.focus(); await page.keyboard.press("End"); await expect(betaTab).toHaveAttribute("aria-selected","true"); await page.keyboard.press("ArrowLeft"); await expect(alphaTab).toHaveAttribute("aria-selected","true");
  await page.getByRole("button",{name:"Scope Alpha 범위 탭 닫기",exact:true}).click(); await expect(betaTab).toHaveAttribute("aria-selected","true"); expect(new URL(page.url()).searchParams.get("rootTask")).toBe(beta!.taskId);
  await page.reload(); const rtabs=page.getByRole("tablist",{name:"WBS 범위 탭"}); await expect(rtabs.getByRole("tab",{name:"Scope Beta",exact:true})).toHaveAttribute("aria-selected","true"); await expect(rtabs.getByRole("tab",{name:"Scope Alpha",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Scope Beta 범위 탭 닫기",exact:true}).click();
  await expect(page.locator(".project-scope-navigation")).toHaveCount(0);
  await expect(search).toBeFocused();
  await expect(page.locator("#project-scope-panel")).toHaveAccessibleName("일정");
  expect(new URL(page.url()).searchParams.get("rootTask")).toBeNull();
  // The last inactive Summary tab also removes the full-schedule button.
  const reopenBeta = await openMenu(page, "Scope Beta");
  await reopenBeta.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  await allTab.click();
  await page.getByRole("button", { name: "Scope Beta 범위 탭 닫기", exact: true }).click();
  await expect(page.locator(".project-scope-navigation")).toHaveCount(0);
  await expect(search).toBeFocused();
});

test("Issue #407/#418 keeps scoped Header and Row additions canonical and continuous", async ({ page }) => {
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
  const allTab = page.getByRole("button", { name: "전체 일정 보기", exact: true }).first();
  const scopeTab = scopeTabs.getByRole("tab", { name: "Scope Root", exact: true });
  await expect(scopeTab).toHaveAttribute("aria-selected", "true");

  const headerAdd = page.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first();
  await expect(headerAdd).toHaveAttribute("aria-disabled", "false");
  await expect(headerAdd).toHaveAttribute("aria-label", "범위 최상위 작업 추가");

  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".project-gantt-scroll");
    const gantt = root?.querySelector<HTMLElement>(".wx-gantt");
    if (!root || !gantt) throw new Error("Gantt continuity target missing");
    const maxLeft = Math.max(0, gantt.scrollWidth - gantt.clientWidth);
    gantt.scrollLeft = Math.min(32, maxLeft);
    const probe = {
      running: true,
      minRows: root.querySelectorAll(".wx-row[data-id]").length,
      frameDisconnected: false,
      frameHidden: false,
      ganttScrollLeft: gantt.scrollLeft,
    };
    (window as typeof window & { __issue418Probe?: typeof probe }).__issue418Probe = probe;
    const sample = () => {
      const current = (window as typeof window & { __issue418Probe?: typeof probe }).__issue418Probe;
      if (!current?.running) return;
      const frame = document.querySelector<HTMLElement>(".project-gantt-frame");
      const currentRoot = document.querySelector<HTMLElement>(".project-gantt-scroll");
      current.minRows = Math.min(current.minRows, currentRoot?.querySelectorAll(".wx-row[data-id]").length ?? 0);
      current.frameDisconnected ||= !frame?.isConnected;
      current.frameHidden ||= !frame || frame.getClientRects().length === 0 || getComputedStyle(frame).visibility === "hidden";
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  const beforeHeaderIds = new Set(initialChildSnapshot.data.tasks.map((task) => task.taskId));
  const [headerResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `${api}/tasks`,
    ),
    headerAdd.click(),
  ]);
  expect(headerResponse.status()).toBe(201);
  const headerSnapshot = await headerResponse.json() as TaskMutationResponse;
  const headerLeaf = headerSnapshot.data.tasks.find((task) =>
    !beforeHeaderIds.has(task.taskId) && task.parentExternalId === rootTask!.externalId,
  );
  expect(headerLeaf).toBeTruthy();
  await expect(rowByTaskId(page, headerLeaf!.taskId)).toBeVisible();
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");
  await expect(headerAdd).toBeFocused();

  const continuity = await page.evaluate(() => {
    const probe = (window as typeof window & {
      __issue418Probe?: { running: boolean; minRows: number; frameDisconnected: boolean; frameHidden: boolean; ganttScrollLeft: number };
    }).__issue418Probe;
    if (!probe) throw new Error("Issue #418 continuity probe missing");
    probe.running = false;
    const gantt = document.querySelector<HTMLElement>(".project-gantt-scroll .wx-gantt");
    return { ...probe, currentGanttScrollLeft: gantt?.scrollLeft ?? -1 };
  });
  expect(continuity.minRows).toBeGreaterThan(0);
  expect(continuity.frameDisconnected).toBe(false);
  expect(continuity.frameHidden).toBe(false);
  expect(continuity.currentGanttScrollLeft).toBe(continuity.ganttScrollLeft);
  await expect(scopeTab).toHaveAttribute("aria-selected", "true");

  const beforeKeyboardIds = new Set(headerSnapshot.data.tasks.map((task) => task.taskId));
  const [keyboardResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `${api}/tasks`,
    ),
    (async () => {
      await headerAdd.focus();
      await page.keyboard.press("Enter");
    })(),
  ]);
  expect(keyboardResponse.status()).toBe(201);
  const keyboardSnapshot = await keyboardResponse.json() as TaskMutationResponse;
  const keyboardLeaf = keyboardSnapshot.data.tasks.find((task) =>
    !beforeKeyboardIds.has(task.taskId) && task.parentExternalId === rootTask!.externalId,
  );
  expect(keyboardLeaf).toBeTruthy();
  await expect(rowByTaskId(page, keyboardLeaf!.taskId)).toBeVisible();
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");
  await expect(headerAdd).toBeFocused();

  const scopedRootAdd = rowByTaskId(page, rootTask!.taskId).locator('[data-action="add-task"]');
  await expect(scopedRootAdd).toHaveAttribute("aria-disabled", "false");
  const beforeRootIds = new Set(keyboardSnapshot.data.tasks.map((task) => task.taskId));
  const [rootResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `${api}/tasks`,
    ),
    scopedRootAdd.click(),
  ]);
  expect(rootResponse.status()).toBe(201);
  const rootSnapshot = await rootResponse.json() as TaskMutationResponse;
  const nativeLeaf = rootSnapshot.data.tasks.find((task) =>
    !beforeRootIds.has(task.taskId) && task.parentExternalId === rootTask!.externalId,
  );
  expect(nativeLeaf).toBeTruthy();
  await expect(rowByTaskId(page, nativeLeaf!.taskId)).toBeVisible();
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");

  await openMenuByTaskId(page, rootTask!.taskId);
  const emptySummarySnapshot = await chooseSubmenu(page, "Add", "요약 작업 추가");
  const rootIds = new Set(rootSnapshot.data.tasks.map((task) => task.taskId));
  const emptySummary = emptySummarySnapshot.data.tasks.find((task) =>
    !rootIds.has(task.taskId) &&
    task.parentExternalId === rootTask!.externalId &&
    task.type === "summary",
  );
  expect(emptySummary).toBeTruthy();
  await expect(rowByTaskId(page, emptySummary!.taskId)).toBeVisible();

  const emptySummaryAdd = rowByTaskId(page, emptySummary!.taskId).locator('[data-action="add-task"]');
  await expect(emptySummaryAdd).toHaveAttribute("aria-disabled", "false");
  const emptySummaryIds = new Set(emptySummarySnapshot.data.tasks.map((task) => task.taskId));
  const [summaryResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `${api}/tasks`,
    ),
    (async () => {
      await emptySummaryAdd.focus();
      await page.keyboard.press(" ");
    })(),
  ]);
  expect(summaryResponse.status()).toBe(201);
  const summaryChildSnapshot = await summaryResponse.json() as TaskMutationResponse;
  const summaryChild = summaryChildSnapshot.data.tasks.find((task) =>
    !emptySummaryIds.has(task.taskId) && task.parentExternalId === emptySummary!.externalId,
  );
  expect(summaryChild).toBeTruthy();
  await expect(rowByTaskId(page, summaryChild!.taskId)).toBeVisible();
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");

  const normalTaskAdd = rowByTaskId(page, nativeLeaf!.taskId).locator('[data-action="add-task"]');
  await expect(normalTaskAdd).toHaveAttribute("aria-disabled", "false");
  const beforeConvertIds = new Set(summaryChildSnapshot.data.tasks.map((task) => task.taskId));
  const [convertResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `${api}/tasks`,
    ),
    normalTaskAdd.click(),
  ]);
  expect(convertResponse.status()).toBe(201);
  const convertedSnapshot = await convertResponse.json() as TaskMutationResponse;
  const convertedChild = convertedSnapshot.data.tasks.find((task) =>
    !beforeConvertIds.has(task.taskId) && task.parentExternalId === nativeLeaf!.externalId,
  );
  expect(convertedSnapshot.data.tasks.find((task) => task.taskId === nativeLeaf!.taskId)?.type).toBe("summary");
  expect(convertedChild).toBeTruthy();
  await expect(rowByTaskId(page, convertedChild!.taskId)).toBeVisible();
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");

  await openMenuByTaskId(page, headerLeaf!.taskId);
  await expect(rowByTaskId(page, headerLeaf!.taskId)).toHaveAttribute("data-copy-selected", "true");
  const milestoneSnapshot = await chooseSubmenu(page, "Convert to", "Milestone");
  expect(milestoneSnapshot.data.tasks.find((task) => task.taskId === headerLeaf!.taskId)?.type).toBe("milestone");
  await expectMilestoneExcluded(page, headerLeaf!.taskId);
  const rejected = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${milestoneSnapshot.data.project.revision}"` },
    data: { name: "Forbidden milestone child", type: "task", parentTaskId: headerLeaf!.taskId, start: "2026-09-18", duration: 1, progress: 0 },
  });
  expect(rejected.status()).toBe(409);
  const afterGuard = (await (await page.request.get(api)).json()) as ProjectSnapshotResponse;
  expect(afterGuard.data.project.revision).toBe(milestoneSnapshot.data.project.revision);
  expect(afterGuard.data.tasks.some(task => task.name === "Forbidden milestone child")).toBe(false);

  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
  await expect(scopeTab).toHaveAttribute("aria-selected", "true");

  // The success notice reserves normal-flow viewport space. Dismiss it before
  // asserting unrelated low rows are rendered rather than virtualized below it.
  await page.getByTestId("milestone-conversion-notice").getByRole("button", { name: "변경 안내 닫기", exact: true }).click();
  await allTab.click();
  await expect(allTab).toHaveAttribute("aria-pressed", "true");
  await expectMilestoneExcluded(page, headerLeaf!.taskId);
  for (const taskId of [keyboardLeaf!.taskId, nativeLeaf!.taskId, emptySummary!.taskId, summaryChild!.taskId, convertedChild!.taskId]) {
    await expect(rowByTaskId(page, taskId)).toBeVisible();
  }
});

// #733 F733-008: split #373's 31s E2E body into independent scope,
// cross-tab, and stale-response cases. Each receives its own isolated SQLite
// project and browser context; no mutable state leaks between tests.
async function prepareIssue373Subtree(page: import("@playwright/test").Page) {
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

  await openMenu(page, "Scope Alpha");
  const childAdded = await chooseSubmenu(page, "Add", "Child task");
  const alpha = childAdded.data.tasks.find((task) => task.name === "Scope Alpha");
  const child = alpha ? childAdded.data.tasks.find((task) => task.parentExternalId === alpha.externalId) : undefined;
  expect(alpha?.type).toBe("summary");
  expect(child).toBeTruthy();
  await expect(row(page, child!.name)).toBeVisible();

  return { path, api, origin, alpha: alpha!, child: child!, keepCreated };
}

async function openIssue373Subtree(page: import("@playwright/test").Page, origin: string, path: string, alpha: ProjectTaskDto) {
  const scopedPage = await page.context().newPage();
  try {
    await scopedPage.goto(`${origin}${path}?rootTask=${encodeURIComponent(alpha.taskId)}`);
    await scopedPage.waitForURL((url) => url.pathname === path && url.searchParams.get("rootTask") === alpha.taskId);
    const tabs = scopedPage.getByRole("tablist", { name: "WBS 범위 탭" });
    await expect(tabs.getByRole("tab", { name: "Scope Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(scopedPage.getByText("편집 중", { exact: true })).toBeVisible();
    await expect(row(scopedPage, "Scope Alpha")).toBeVisible();
    await expect(row(scopedPage, "Keep sibling")).toHaveCount(0);
    return scopedPage;
  } catch (error) {
    await scopedPage.close().catch(() => undefined);
    throw error;
  }
}

test("Issue #373 A direct subtree deep link preserves scope and edit permissions", async ({ page }) => {
  const { origin, path, alpha, child, keepCreated } = await prepareIssue373Subtree(page);
  const leafMenu = await openMenu(page, "Keep sibling");
  await expect(leafMenu.getByText("최상위로 열기", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const scopeMenu = await openMenu(page, "Scope Alpha");
  await expect(scopeMenu.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const scopedPage = await openIssue373Subtree(page, origin, path, alpha);
  try {
    const scopeTabs = scopedPage.getByRole("tablist", { name: "WBS 범위 탭" });
    await expect(scopedPage.getByRole("button", { name: "전체 일정 보기", exact: true }).first()).toBeVisible();
    await expect(scopeTabs.getByRole("tab", { name: "Scope Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(scopedPage.getByText("편집 중", { exact: true })).toBeVisible();
    await expect(row(scopedPage, "Scope Alpha")).toBeVisible();
    await expect(row(scopedPage, child!.name)).toBeVisible();
    await expect(row(scopedPage, "Keep sibling")).toHaveCount(0);
    await expect(scopedPage.getByRole("button", { name: "요약 작업 추가", exact: true })).toHaveCount(0);
    await expect(scopedPage.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first()).toHaveAttribute("aria-disabled", "false");
    await expect(rowByTaskId(scopedPage, alpha!.taskId).locator('[data-action="add-task"]')).toHaveAttribute("aria-disabled", "false");

    const rootScopedMenu = await openMenu(scopedPage, "Scope Alpha");
    await rootScopedMenu.getByRole("menuitem", { name: "Add", exact: true }).hover();
    const addSubmenu = scopedPage.getByRole("menu", { name: "Add", exact: true });
    await expect(addSubmenu.getByRole("menuitem", { name: "Child task", exact: true })).toBeEnabled();
    await expect(addSubmenu.getByRole("menuitem", { name: "Task above", exact: true })).toBeDisabled();
    await expect(addSubmenu.getByRole("menuitem", { name: "Task below", exact: true })).toBeDisabled();
    await scopedPage.keyboard.press("Escape");

  } finally {
    await scopedPage.close();
  }
  expect(keepCreated.data.tasks.some((task) => task.name === "Keep sibling")).toBe(true);
});

test("Issue #373 B scoped edits reconcile a delayed cross-tab revision", async ({ page }) => {
  const { api, origin, path, alpha, child } = await prepareIssue373Subtree(page);
  const scopedPage = await openIssue373Subtree(page, origin, path, alpha);
  // A failed assertion must release any pending cross-tab read before teardown.
  let releaseFirstRefresh: () => void = () => undefined;
  let markFirstMutationReady: () => void = () => undefined;
  try {
    let firstMutationSnapshot: unknown = null;
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
    const secondRevision = (await secondSaved.json() as TaskMutationResponse).data.project.revision;
    expect(secondRevision).toBeGreaterThan((firstMutationSnapshot as TaskMutationResponse).data.project.revision);
    await expect(row(scopedPage, "Scoped child renamed twice")).toBeVisible();

    releaseFirstRefresh();
    await page.bringToFront();
    await expect(row(page, "Scoped child renamed twice")).toBeVisible();
    await expect(row(page, "Keep sibling")).toBeVisible();

  } finally {
    markFirstMutationReady();
    releaseFirstRefresh();
    await scopedPage.close();
  }
});

test("Issue #373 C stale initial GET yields to the latest scoped edit", async ({ page }) => {
  const { api, origin, path, alpha, child } = await prepareIssue373Subtree(page);
  const scopedPage = await openIssue373Subtree(page, origin, path, alpha);
  const editor = scopedPage.getByRole("dialog", { name: "작업 정보", exact: true });
  let receiver: import("@playwright/test").Page | undefined;
  let releaseLoadingRead: () => void = () => undefined;
  try {
    // A second receiver can still be loading when a newer revision arrives.
    // Hold its initial canonical GET at revision N, save revision N+1 from the
    // scoped tab, then release the stale response. The queued revision must
    // trigger a follow-up GET after the receiver becomes ready.
    const staleBeforeLatest = await (await scopedPage.request.get(api)).json() as ProjectSnapshotResponse;
    receiver = await page.context().newPage();
    let markLoadingReadStarted!: () => void;
    const loadingReadGate = new Promise<void>((resolve) => { releaseLoadingRead = resolve; });
    const loadingReadStarted = new Promise<void>((resolve) => { markLoadingReadStarted = resolve; });
    let holdInitialLoadingRead = true;
    await receiver.route((url) => url.pathname === api, async (route) => {
      if (route.request().method() !== "GET" || !holdInitialLoadingRead) {
        await route.continue();
        return;
      }
      holdInitialLoadingRead = false;
      markLoadingReadStarted();
      await loadingReadGate;
      await route.fulfill({ json: staleBeforeLatest });
    });
    const loadingNavigation = receiver.goto(`${origin}${path}`);
    await loadingReadStarted;

    await scopedPage.bringToFront();
    await openMenu(scopedPage, child.name);
    await menu(scopedPage).getByRole("menuitem", { name: "Edit", exact: true }).click();
    await expect(editor).toBeVisible();
    await editor.getByLabel("작업명", { exact: true }).fill("Scoped child final");
    const [latestSaved] = await Promise.all([
      scopedPage.waitForResponse((response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === `${api}/tasks/${child!.taskId}`,
      ),
      editor.getByRole("button", { name: "저장", exact: true }).click(),
    ]);
    expect(latestSaved.ok(), `latest scoped task edit: HTTP ${latestSaved.status()}`).toBe(true);
    const latestRevision = (await latestSaved.json() as TaskMutationResponse).data.project.revision;
    expect(latestRevision).toBeGreaterThan(staleBeforeLatest.data.project.revision);
    releaseLoadingRead();
    await loadingNavigation;
    await expect(row(receiver, "Scoped child final")).toBeVisible();
    await receiver.close();

    await scopedPage.reload();
    await expect(scopedPage.getByRole("tablist", { name: "WBS 범위 탭" }).getByRole("tab", { name: "Scope Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(row(scopedPage, "Scoped child final")).toBeVisible();
    await expect(row(scopedPage, "Keep sibling")).toHaveCount(0);
    const finalSnapshot = await (await scopedPage.request.get(api)).json() as ProjectSnapshotResponse;
    expect(finalSnapshot.data.project.revision).toBe(latestRevision);
    expect(finalSnapshot.data.tasks.find(task => task.taskId === child.taskId)?.name).toBe("Scoped child final");
  } finally {
    releaseLoadingRead();
    if (receiver && !receiver.isClosed()) await receiver.close().catch(() => undefined);
    await scopedPage.close();
  }
});

test("Issue #506 places root and nested Add Above/Below immediately around the anchor, including scoped view", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill("Issue 506 sibling order");
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("Issue506Pwd!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const api = `/api${new URL(page.url()).pathname}`;
  const origin = new URL(page.url()).origin;
  // GET snapshots and task mutations are distinct DTOs with shared project/tasks.
  // Preserve the actual response type instead of assuming mutation has permission.
  let snapshot: ProjectSnapshotResponse | TaskMutationResponse =
    await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  for (const name of ["A", "B", "C", "Summary"]) {
    snapshot = await createRootTask(page, api, origin, snapshot.data.project.revision, name);
  }
  const summary = snapshot.data.tasks.find((task) => task.name === "Summary")!;
  for (const [index, name] of ["Child A", "Child B", "Child C"].entries()) {
    const response = await page.request.post(`${api}/tasks`, {
      headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` },
      data: { name, type: "task", start: "2026-09-21", duration: 1, progress: 0,
        parentTaskId: summary.taskId, ...(index === 0 ? { convertParentToSummary: true } : {}) },
    });
    expect(response.status()).toBe(201);
    snapshot = await response.json() as TaskMutationResponse;
  }
  await page.reload();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  await expectRenderedSiblingOrder(page, snapshot.data.tasks, null);

  const rootAnchor = snapshot.data.tasks.find(task => task.name === "B")!;
  const rootRequest = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/task-commands"));
  await openMenu(page, "B");
  const above = await chooseSubmenu(page, "Add", "Task above");
  expect((await rootRequest).postDataJSON()).toMatchObject({
    kind: "create", anchorTaskId: rootAnchor.taskId, placement: "before",
  });
  expect(orderedRootNames(above.data.tasks)).toEqual(["A", "새 작업", "B", "C", "Summary"]);
  const rootInserted = above.data.tasks.find((task) => task.name === "새 작업")!;
  expect(rootInserted.parentExternalId).toBeNull();
  await expectRenderedSiblingOrder(page, above.data.tasks, null);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);

  await openMenu(page, "B");
  const below = await chooseSubmenu(page, "Add", "Task below");
  const rootOrder = orderedFamily(below.data.tasks, null);
  expect(rootOrder.map((task) => task.taskId)).toEqual([
    ...orderedFamily(above.data.tasks, null).slice(0, 3).map((task) => task.taskId),
    ...below.data.tasks.filter((task) => task.name === "새 작업" && task.taskId !== rootInserted.taskId).map((task) => task.taskId),
    ...orderedFamily(above.data.tasks, null).slice(3).map((task) => task.taskId),
  ]);
  await expectRenderedSiblingOrder(page, below.data.tasks, null);

  await openMenu(page, "Summary");
  await menu(page).getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Summary", exact: true })).toHaveAttribute("aria-selected", "true");
  await openMenu(page, "Child B");
  const nested = await chooseSubmenu(page, "Add", "Task above");
  const childNames = orderedFamily(nested.data.tasks, summary.externalId).map((task) => task.name);
  expect(childNames).toEqual(["Child A", "새 작업", "Child B", "Child C"]);
  await expectRenderedSiblingOrder(page, nested.data.tasks, summary.externalId);
  const scopedRootMenu = await openMenu(page, "Summary");
  await scopedRootMenu.getByRole("menuitem", { name: "Add", exact: true }).hover();
  const scopedAdd = page.getByRole("menu", { name: "Add", exact: true });
  await expect(scopedAdd.getByRole("menuitem", { name: "Task above", exact: true })).toBeDisabled();
  await expect(scopedAdd.getByRole("menuitem", { name: "Task below", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");

  // #506: below the middle anchor must not append to this Summary.
  await openMenu(page, "Child B");
  const nestedBelow = await chooseSubmenu(page, "Add", "Task below");
  const insertedAbove = nested.data.tasks.find(task => task.parentExternalId === summary.externalId && task.name === "새 작업")!;
  const insertedBelow = nestedBelow.data.tasks.find(task =>
    task.parentExternalId === summary.externalId && task.name === "새 작업" && task.taskId !== insertedAbove.taskId)!;
  expect(orderedFamily(nestedBelow.data.tasks, summary.externalId).map(task => task.taskId)).toEqual([
    ...orderedFamily(snapshot.data.tasks, summary.externalId).slice(0, 1).map(task => task.taskId),
    insertedAbove.taskId,
    ...orderedFamily(snapshot.data.tasks, summary.externalId).slice(1, 2).map(task => task.taskId),
    insertedBelow.taskId,
    ...orderedFamily(snapshot.data.tasks, summary.externalId).slice(2).map(task => task.taskId),
  ]);
  await expectRenderedSiblingOrder(page, nestedBelow.data.tasks, summary.externalId);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
  await page.reload();
  const persisted = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(orderedFamily(persisted.data.tasks, summary.externalId).map((task) => task.taskId))
    .toEqual(orderedFamily(nestedBelow.data.tasks, summary.externalId).map((task) => task.taskId));
  await expectRenderedSiblingOrder(page, persisted.data.tasks, summary.externalId);
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
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
  await openMenu(page, "Gamma");
  const copied = await chooseSubmenu(page, "Paste", "Below");
  expect(copied.data.tasks.filter((task) => task.name === "Beta")).toHaveLength(2);

  await openMenu(page, "Gamma");
  const added = await chooseSubmenu(page, "Add", "Task above");
  expect(added.data.tasks.some((task) => task.name === "새 작업")).toBe(true);
  await openMenu(page, "Beta");
  const milestone = await chooseSubmenu(page, "Convert to", "Milestone");
  expect(milestone.data.tasks.find((task) => task.name === "Beta")!.type).toBe("milestone");
  await expect(row(page, "Beta")).toHaveCount(1); // Only the separately copied Task remains visible.

  const convertedMilestone = milestone.data.tasks.find(task => task.name === "Beta")!;
  await expectMilestoneExcluded(page, convertedMilestone.taskId);
  await test.info().attach("issue-860-baseline-display", { contentType: "application/json", body: JSON.stringify(await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read())) });
  await openWorkspaceView(page, "milestones");
  await page.locator("#project-panel-milestones").getByLabel("Milestone 검색", { exact: true }).fill(convertedMilestone.taskId);
  await page.locator(`[data-milestone-task-id="${convertedMilestone.taskId}"]`).getByRole("button", { name: / 관리$/ }).click();
  const [roundtripResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(`${api}/task-commands`) && response.request().method() === "POST"),
    page.getByRole("dialog", { name: / 관리$/ }).getByRole("button", { name: "일반 Task로 전환", exact: true }).click(),
  ]);
  expect(roundtripResponse.status()).toBe(200);
  expect(roundtripResponse.request().postDataJSON()).toEqual({ kind: "convert", taskId: convertedMilestone.taskId, targetType: "task" });
  const roundtrip = await roundtripResponse.json() as TaskMutationResponse;
  const ordinary = roundtrip.data.tasks.find(task => task.taskId === convertedMilestone.taskId)!;
  expect(ordinary).toMatchObject({ taskId: convertedMilestone.taskId, externalId: convertedMilestone.externalId, parentExternalId: convertedMilestone.parentExternalId, siblingOrder: convertedMilestone.siblingOrder, type: "task" });
  expect(ordinary.membership).toEqual(convertedMilestone.membership);
  expect(roundtrip.data.project.revision).toBe(milestone.data.project.revision + 1);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(page.locator(".wx-table-container .wx-row[data-id]", { hasText: "Beta" })).toHaveCount(2);
  await expect(rowByTaskId(page, ordinary.taskId)).toBeVisible();
  const finalRevision = roundtrip.data.project.revision;
  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const persisted = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(persisted.data.project.revision).toBe(finalRevision);
  expect(persisted.data.tasks.filter((task) => task.name === "Beta")).toHaveLength(2);
  expect(persisted.data.tasks.find((task) => task.name === "Gamma")!.parentExternalId).toBeNull();
  expect(persisted.data.tasks.some((task) => task.name === "새 작업")).toBe(true);
});

test("Issue #860 confirms before conversion and opens the same Milestone only on explicit request", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Milestone confirmation ${Date.now()}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("M860Pwd!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const path = new URL(page.url()).pathname, api = `/api${path}`, origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const created = await createRootTask(page, api, origin, initial.data.project.revision, "Convert exact ID " + "긴이름".repeat(24));
  const task = created.data.tasks.find(task => task.name.startsWith("Convert exact ID "))!;
  const withDuplicate = await createRootTask(page, api, origin, created.data.project.revision, task.name);
  const duplicate = withDuplicate.data.tasks.find(entry => entry.taskId !== task.taskId && entry.name === task.name)!;
  await page.reload();
  await expect(rowByTaskId(page, task.taskId)).toBeVisible();
  const frame = page.locator(".project-gantt-frame"), instance = await frame.getAttribute("data-project-gantt-api-instance");
  await openWorkspaceView(page, "milestones");
  const dashboard = page.locator("#project-panel-milestones"), dashboardSearch = dashboard.getByLabel("Milestone 검색", { exact: true });
  await dashboardSearch.fill("unmatched-dashboard-filter");
  await openWorkspaceView(page, "schedule");
  // #574 V6/V8: seed the real TaskClipboard before converting its source.
  // Empty clipboard assertions without this positive control would be vacuous.
  await openMenuByTaskId(page, task.taskId);
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().clipboardIds)).toEqual([task.taskId]);
  await openMenuByTaskId(page, duplicate.taskId);
  await expect(menu(page).getByRole("menuitem", { name: "Paste", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  const posts: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/task-commands")) posts.push(request.postData() ?? ""); });
  const openConfirmation = async (chart = false) => {
    if (chart) {
      const bar = frame.locator(`.wx-chart .wx-bar[data-task-id=":${task.taskId}"]`);
      await bar.scrollIntoViewIfNeeded(); await bar.click({ button: "right" });
      await expect(menu(page)).toBeVisible();
    } else await openMenuByTaskId(page, task.taskId);
    await menu(page).getByRole("menuitem", { name: "Convert to", exact: true }).hover();
    await page.getByRole("menu", { name: "Convert to", exact: true }).getByRole("menuitem", { name: "Milestone", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Milestone으로 변경", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(task.name);
    await expect(dialog).toContainText("Grid와 Chart에서 숨겨지며 대시보드 → Milestone");
    await expect(dialog).toContainText("기간은 0일");
    await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeFocused();
    return dialog;
  };
  let dialog = await openConfirmation();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/playwright/issue-860/confirmation-390.png" });
  expect(await dialog.evaluate(node => { const box = node.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight; })).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Milestone으로 변경", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press(" ");
  await expect(dialog).toHaveCount(0);
  expect(posts).toEqual([]);
  expect((await (await page.request.get(api)).json() as ProjectSnapshotResponse).data.project.revision).toBe(withDuplicate.data.project.revision);
  expect(await page.evaluate(id => document.activeElement?.closest(".wx-row")?.getAttribute("data-id") === `:${id}`, task.taskId)).toBe(true);
  dialog = await openConfirmation(true);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  expect(posts).toEqual([]);
  expect(await page.evaluate(id => document.activeElement?.closest(".wx-bar")?.getAttribute("data-task-id") === `:${id}`, task.taskId)).toBe(true);
  await openMenuByTaskId(page, duplicate.taskId);
  await expect(menu(page).getByRole("menuitem", { name: "Paste", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  const before = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(before.clipboardIds).toEqual([task.taskId]);
  let release!: () => void;
  const responseGate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${api}/task-commands`, async route => {
    const response = await route.fetch();
    await responseGate;
    await route.fulfill({ response });
  });
  dialog = await openConfirmation();
  await dialog.getByRole("button", { name: "Milestone으로 변경", exact: true }).press("Enter");
  await expect(dialog.getByRole("button", { name: "변경 중…", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
  await page.keyboard.press("Enter"); await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0])).toEqual({ kind: "convert", taskId: task.taskId, targetType: "milestone" });
  release(); await expect(dialog).toHaveCount(0);
  const notice = page.getByTestId("milestone-conversion-notice");
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active !== document.body && active.getClientRects().length > 0 && !active.closest("[inert],[hidden]");
  })).toBe(true);
  await expect(notice).toContainText("Milestone으로 변경했습니다");
  await expect(page.getByRole("tablist", { name: "프로젝트 작업공간" }).getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  await expectMilestoneExcluded(page, task.taskId);
  await expect(rowByTaskId(page, duplicate.taskId)).toBeVisible();
  const saved = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(saved.data.project.revision).toBe(withDuplicate.data.project.revision + 1);
  const converted = saved.data.tasks.find(entry => entry.taskId === task.taskId)!;
  expect(converted).toMatchObject({ taskId: task.taskId, externalId: task.externalId, parentExternalId: task.parentExternalId, siblingOrder: task.siblingOrder, type: "milestone", duration: 0 });
  expect(converted.membership).toEqual(task.membership);
  expect(saved.data.tasks.find(entry => entry.taskId === duplicate.taskId)).toEqual(duplicate);
  const after = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(after.instance).toBe(before.instance); expect(after.left).toBe(before.left); expect(after.top).toBe(before.top);
  expect(after.clipboardIds).toEqual([]);
  await openMenuByTaskId(page, duplicate.taskId);
  await expect(menu(page).getByRole("menuitem", { name: "Paste", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  expect(posts).toHaveLength(1);
  await test.info().attach("issue-574-conversion-clipboard", { contentType: "application/json", body: JSON.stringify({
    environment: "Chromium / real HTTP and SQLite", convertedTaskId: task.taskId,
    ordinaryTaskId: duplicate.taskId, revision: saved.data.project.revision,
    copiedSourceBeforeConversion: true, clipboardPreservedAfterCancel: true, pasteDisabledAfterConversion: true,
    commandCount: posts.length, before, after,
  }) });
  await page.screenshot({ path: "output/playwright/issue-860/conversion-success.png" });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const search = page.getByLabel("작업명, 설명, External ID 검색", { exact: true });
    await search.focus();
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("Tab");
      await expect.poll(() => page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || active === document.body) return false;
        const rect = active.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return rect.width > 0 && rect.height > 0 && Boolean(hit && active.contains(hit));
      })).toBe(true);
    }
    await notice.getByRole("button", { name: "Milestone 대시보드에서 보기", exact: true }).focus();
    expect(await notice.evaluate(node => {
      const action = node.querySelector("button")!, rect = action.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return Boolean(hit && action.contains(hit));
    })).toBe(true);
    if (width === 390) await page.screenshot({ path: "output/playwright/issue-860/conversion-success-390.png" });
  }
  await notice.getByRole("button", { name: "Milestone 대시보드에서 보기", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor.getByRole("textbox", { name: "작업명", exact: true })).toHaveValue(task.name);
  await editor.getByText(`${task.name} 식별 정보`, { exact: true }).click();
  await expect(editor).toContainText(task.taskId);
  await page.screenshot({ path: "output/playwright/issue-860/conversion-detail.png" });
  await page.keyboard.press("Escape");
  await expect(dashboardSearch).toHaveValue("unmatched-dashboard-filter");
  await openWorkspaceView(page, "resources"); await openWorkspaceView(page, "schedule");
  await expectMilestoneExcluded(page, task.taskId);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
  await page.reload(); await expect(rowByTaskId(page, duplicate.taskId)).toBeVisible(); await expectMilestoneExcluded(page, task.taskId);
  expect((await (await page.request.get(api)).json() as ProjectSnapshotResponse).data.tasks.find(entry => entry.taskId === task.taskId)?.type).toBe("milestone");
});


test("Issue #860 conversion failures never claim success or submit twice", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Milestone negatives ${Date.now()}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("M860Pwd!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const api = `/api${new URL(page.url()).pathname}`, origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const created = await createRootTask(page, api, origin, initial.data.project.revision, "Preserve on failure");
  const task = created.data.tasks.find(task => task.name === "Preserve on failure")!;
  await page.reload();
  const frame = page.locator(".project-gantt-frame"), instance = await frame.getAttribute("data-project-gantt-api-instance");
  let posts = 0;
  for (const failure of [409, 412, 422, 500, "network", 401] as const) {
    await page.route(`**${api}/task-commands`, async route => {
      posts++;
      if (failure === "network") await route.abort("connectionfailed");
      else await route.fulfill({ status: failure, json: { error: { code: failure === 412 ? "REVISION_CONFLICT" : failure === 401 ? "UNAUTHORIZED" : "INVALID_TASK_COMMAND", message: `Controlled ${failure}` } } });
    });
    await openMenuByTaskId(page, task.taskId);
    await menu(page).getByRole("menuitem", { name: "Convert to", exact: true }).hover();
    await page.getByRole("menu", { name: "Convert to", exact: true }).getByRole("menuitem", { name: "Milestone", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Milestone으로 변경", exact: true });
    await dialog.getByRole("button", { name: "Milestone으로 변경", exact: true }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "자동으로 다시 보내지 않습니다" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Milestone으로 변경", exact: true })).toBeDisabled();
    const submitted = posts;
    await page.keyboard.press("Enter");
    expect(posts).toBe(submitted);
    await expect(page.getByTestId("milestone-conversion-notice")).toHaveCount(0);
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(rowByTaskId(page, task.taskId)).toBeVisible();
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
    const current = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
    expect(current.data.project.revision).toBe(created.data.project.revision);
    expect(current.data.tasks.find(entry => entry.taskId === task.taskId)).toEqual(task);
    await page.unroute(`**${api}/task-commands`);
  }
  expect(posts).toBe(6);
});

test("Issue #860 converted Milestone stays excluded after fullscreen density and five-width Day/Week reentry", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Milestone geometry ${Date.now()}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("M860Pwd!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const api = `/api${new URL(page.url()).pathname}`, origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const created = await createRootTask(page, api, origin, initial.data.project.revision, "Geometry milestone");
  const task = created.data.tasks.find(task => task.name === "Geometry milestone")!;
  const ordinary = await createRootTask(page, api, origin, created.data.project.revision, "Geometry ordinary");
  const ordinaryTask = ordinary.data.tasks.find(task => task.name === "Geometry ordinary")!;
  await page.reload(); await expect(rowByTaskId(page, task.taskId)).toBeVisible();
  const frame = page.locator(".project-gantt-frame"), instance = await frame.getAttribute("data-project-gantt-api-instance");
  await frame.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
  await expect.poll(() => frame.evaluate(node => document.fullscreenElement === node)).toBe(true);
  await openMenuByTaskId(page, task.taskId);
  await menu(page).getByRole("menuitem", { name: "Convert to", exact: true }).hover();
  await page.getByRole("menu", { name: "Convert to", exact: true }).getByRole("menuitem", { name: "Milestone", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Milestone으로 변경", exact: true });
  await expect(confirm.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(confirm).toHaveCount(0);
  await expect.poll(() => frame.evaluate(node => document.fullscreenElement === node)).toBe(true);
  await openMenuByTaskId(page, task.taskId);
  const converted = await chooseSubmenu(page, "Convert to", "Milestone");
  await expectMilestoneExcluded(page, task.taskId);
  const notice = page.getByTestId("milestone-conversion-notice");
  await expect(notice).toBeVisible();
  expect(await notice.evaluate(node => document.fullscreenElement?.contains(node))).toBe(true);
  await notice.getByRole("button", { name: "변경 안내 닫기", exact: true }).click();
  await frame.getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  const geometry: unknown[] = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const scale of ["일", "주"]) {
      await frame.getByRole("button", { name: scale, exact: true }).click();
      await expectMilestoneExcluded(page, task.taskId);
      await expect.poll(() => frame.evaluate((node, id) => {
        const row = node.querySelector(`.wx-table-container .wx-row[data-id=":${id}"]`)?.getBoundingClientRect();
        const bar = node.querySelector(`.wx-chart .wx-bar[data-task-id=":${id}"]`)?.getBoundingClientRect();
        return row && bar ? Math.abs(row.y + row.height / 2 - bar.y - bar.height / 2) : null;
      }, ordinaryTask.taskId)).toBeLessThanOrEqual(1);
      geometry.push({ width, scale, state: await frame.evaluate(node => {
        const state = Reflect.get(node, "__masterganttMilestoneTimeline").read();
        return { instance: state.instance, rows: state.rows.map((row: { id: string }) => row.id), selected: state.selected };
      }) });
    }
  }
  await rowByTaskId(page, ordinaryTask.taskId).hover();
  const height = await frame.getAttribute("data-gantt-cell-height");
  await page.keyboard.down("Control"); await page.mouse.wheel(0, 120); await page.keyboard.up("Control");
  await expect(frame).not.toHaveAttribute("data-gantt-cell-height", height!);
  await expectMilestoneExcluded(page, task.taskId);
  const search = page.getByLabel("작업명, 설명, External ID 검색", { exact: true });
  await search.fill("no-such-row"); await expect(frame.locator(".wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await search.fill(""); await expect(rowByTaskId(page, ordinaryTask.taskId)).toBeVisible(); await expectMilestoneExcluded(page, task.taskId);
  await openWorkspaceView(page, "resources"); await openWorkspaceView(page, "schedule"); await expectMilestoneExcluded(page, task.taskId);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
  const persisted = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(persisted.data.project.revision).toBe(converted.data.project.revision);
  await test.info().attach("issue-860-conversion-reentry", { contentType: "application/json", body: JSON.stringify({ environment: "Chromium / Next dev / isolated real HTTP SQLite", revision: persisted.data.project.revision, taskId: task.taskId, ordinaryTaskId: ordinaryTask.taskId, geometry }) });
});
