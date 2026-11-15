import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type { Locator } from "@playwright/test";

async function fillTaskMarkdown(dialog: Locator, text: string) {
  const field = dialog.locator("#task-description");
  const convert = field.getByRole("button", { name: "Markdown 편집으로 전환" });
  if (await convert.count()) await convert.click();
  const sourceMode = field.getByRole("radio", { name: /Source mode|원문 모드|Chế độ mã nguồn/ });
  await sourceMode.click();
  await expect(sourceMode).toBeChecked();
  await field.locator(".cm-content[contenteditable='true']").fill(text);
}

import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import { readBrowserCanonicalSnapshot } from "./helpers/browser-canonical-snapshot";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";

test.use(isolatedApplicationOptions);

test("persists explicit editor changes, task details and safe URL click without remount", async ({ page, browser, observeIsolatedApi }) => {
  // #730 F730-011: 30s CI trace completed editor persistence + UTC/Seoul and
  // reached the third fresh browser context before the test-level deadline.
  // Keep all three timezone checks on the same stored Task with a measured
  // finite per-test budget; do not extend other tests or global CI timeouts.
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Editor persistence ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("EditPwd1234!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const taskUrl = `${origin}/projects/new`;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const parentResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${initial.data.project.revision}"` },
    data: { name: "Editor parent", type: "task", start: "2026-09-18", duration: 1, progress: 0 },
  });
  expect(parentResponse.status()).toBe(201);
  const parentBody = await parentResponse.json() as TaskMutationResponse;
  const parent = parentBody.data.tasks.find((entry) => entry.name === "Editor parent")!;
  const childResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${parentBody.data.project.revision}"` },
    data: { parentTaskId: parent.taskId, convertParentToSummary: true, name: "Persistent child", type: "task", start: "2026-09-18", duration: 1, progress: 10 },
  });
  expect(childResponse.status()).toBe(201);
  const childBody = await childResponse.json() as TaskMutationResponse;
  const child = childBody.data.tasks.find((entry) => entry.name === "Persistent child")!;
  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const row = page.locator(".project-gantt-widget .wx-row", { hasText: "Persistent child" }).first();
  await expect(row).toBeVisible();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  let patches = 0;
  let navigations = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === `${api}/tasks/${child.taskId}`) patches += 1;
    if (request.resourceType() === "document") navigations += 1;
  });
  await row.getByText("Persistent child", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel("작업명", { exact: true }).fill("Saved via editor");
  await editor.getByLabel("기간 (근무일)", { exact: true }).fill("2");
  const progress = editor.getByLabel("진행률 (%)", { exact: true });
  await progress.fill("75");
  await expect(progress).toHaveValue("75");
  await expect(progress).toHaveAttribute("aria-valuetext", "75%");
  await fillTaskMarkdown(editor, "첫 줄\n둘째 줄");
  await editor.getByLabel("URL", { exact: true }).fill(taskUrl);
  await expect(progress).toHaveAttribute("aria-valuetext", "75%");
  expect(patches).toBe(0);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 저장했습니다");
  expect(patches).toBe(1);
  expect(navigations).toBe(0);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  const stored = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi);
  expect(stored.data.project.revision).toBe(childBody.data.project.revision + 1);
  expect(stored.data.tasks.find((entry) => entry.taskId === child.taskId)).toMatchObject({
    name: "Saved via editor", requestedStart: "2026-09-18", start: "2026-09-18", end: "2026-09-21", duration: 2, progress: 75,
    description: "첫 줄\n둘째 줄", url: taskUrl,
  });
  expect(stored.data.tasks.find((entry) => entry.taskId === parent.taskId)).toMatchObject({ type: "summary", start: "2026-09-18", end: "2026-09-21", progress: 75 });

  await page.reload();
  await expect(page.getByRole("grid").getByText("Saved via editor", { exact: true })).toBeVisible();
  const reloadedFrame = page.locator(".project-gantt-frame");
  const reloadedInstance = await reloadedFrame.getAttribute("data-project-gantt-instance");
  const decoratedRow = page.locator(".project-gantt-widget .wx-row", { hasText: "Saved via editor" }).first();
  await expect(decoratedRow).toHaveAttribute("data-task-url", taskUrl, { timeout: 5000 });
  const popupPromise = page.waitForEvent("popup");
  await page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${child.taskId}"]`).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  expect(new URL(popup.url()).pathname).toBe("/projects/new");
  await popup.close();
  await expect(reloadedFrame).toHaveAttribute("data-project-gantt-instance", reloadedInstance!);

  await decoratedRow.getByText("Saved via editor", { exact: true }).click({ button: "right" });
  await expect(page.getByRole("menu", { name: "작업 메뉴" })).toBeVisible();
  await page.keyboard.press("Escape");

  const storageState = await page.context().storageState();
  for (const timezoneId of ["UTC", "Asia/Seoul", "America/New_York"]) {
    const context = await browser.newContext({ timezoneId, storageState, viewport: { width: 1440, height: 1000 } });
    try {
      const check = await context.newPage();
      await check.goto(`${origin}${path}`);
      await expect(check.getByText("편집 중", { exact: true })).toBeVisible();
      await check.locator(`.wx-bar[data-task-id=":${child.taskId}"]`).click({ button: "right" });
      await chooseTaskInformation(check);
      const information = check.getByRole("dialog", { name: "작업 정보", exact: true });
      await expect(information.getByLabel("작업명", { exact: true })).toHaveValue("Saved via editor");
      await expect(information.getByLabel("요청 시작일", { exact: true })).toHaveValue("2026-09-18");
      await expect(information.getByLabel("기간 (근무일)", { exact: true })).toHaveValue("2");
    } finally { await context.close(); }
  }
});


test("Summary Description and URL persist while derived schedule stays readonly", async ({ page, observeIsolatedApi }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill("Summary details " + Date.now());
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("EditPwd1234!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const api = "/api" + new URL(page.url()).pathname;
  const origin = new URL(page.url()).origin;
  const summaryUrl = origin + "/projects/new";
  let snapshot = await (await page.request.get(api)).json() as ProjectSnapshotResponse;

  const summaryResponse = await page.request.post(api + "/tasks", {
    headers: { Origin: origin, "If-Match": "\"" + snapshot.data.project.revision + "\"" },
    data: { name: "Summary metadata", type: "summary" },
  });
  expect(summaryResponse.status()).toBe(201);
  snapshot = await summaryResponse.json() as ProjectSnapshotResponse;
  const summary = snapshot.data.tasks.find((entry) => entry.name === "Summary metadata")!;

  const childResponse = await page.request.post(api + "/tasks", {
    headers: { Origin: origin, "If-Match": "\"" + snapshot.data.project.revision + "\"" },
    data: { parentTaskId: summary.taskId, name: "Summary child", type: "task", start: "2026-10-06", duration: 2, progress: 25 },
  });
  expect(childResponse.status()).toBe(201);
  snapshot = await childResponse.json() as ProjectSnapshotResponse;
  const child = snapshot.data.tasks.find((entry) => entry.name === "Summary child")!;
  const derivedBefore = snapshot.data.tasks.find((entry) => entry.taskId === summary.taskId)!;

  const summaryPatches: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === api + "/tasks/" + summary.taskId) {
      summaryPatches.push(request.postDataJSON());
    }
  });

  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const summaryRow = page.locator('.project-gantt-widget .wx-row[data-id=":' + summary.taskId + '"]').first();
  await expect(summaryRow).toBeVisible();
  await summaryRow.getByText("Summary metadata", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor.getByLabel("요청 시작일", { exact: true })).toHaveAttribute("readonly", "");
  await expect(editor.locator("#task-description").getByRole("button", { name: "Markdown 편집으로 전환" })).toBeEnabled();
  await expect(editor.getByLabel("URL", { exact: true })).not.toHaveAttribute("readonly", "");
  await fillTaskMarkdown(editor, "요약 설명\n상세");
  await editor.getByLabel("URL", { exact: true }).fill(summaryUrl);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(summaryPatches).toEqual([{ description: "요약 설명\n상세", descriptionFormat: "markdown", url: summaryUrl }]);

  const stored = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi);
  expect(stored.data.project.revision).toBe(snapshot.data.project.revision + 1);
  expect(stored.data.tasks.find((entry) => entry.taskId === summary.taskId)).toMatchObject({
    description: "요약 설명\n상세",
    url: summaryUrl,
    requestedStart: null,
    start: derivedBefore.start,
    end: derivedBefore.end,
    duration: derivedBefore.duration,
    progress: derivedBefore.progress,
  });

  const childRow = page.locator('.project-gantt-widget .wx-row[data-id=":' + child.taskId + '"]').first();
  await expect(childRow).toBeVisible();
  await childRow.getByText("Summary child", { exact: true }).click({ button: "right" });
  await page.getByRole("menu", { name: "작업 메뉴", exact: true }).getByRole("menuitem", { name: "삭제", exact: true }).click();
  await expect(childRow).toHaveCount(0);
  const emptied = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi);
  expect(emptied.data.project.revision).toBe(snapshot.data.project.revision + 2);
  expect(emptied.data.tasks.find((entry) => entry.taskId === summary.taskId)).toMatchObject({
    description: "요약 설명\n상세",
    url: summaryUrl,
    requestedStart: null,
    start: null,
    end: null,
    duration: null,
    progress: null,
  });

  await page.reload();
  const emptySummaryRow = page.locator('.project-gantt-widget .wx-row[data-id=":' + summary.taskId + '"]').first();
  await expect(emptySummaryRow).toBeVisible();
  await emptySummaryRow.getByText("Summary metadata", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const reopened = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(reopened).toBeVisible();
  await expect(reopened.locator("#task-description")).toContainText("요약 설명");
  await expect(reopened.getByRole("textbox", { name: "URL", exact: true })).toHaveValue(summaryUrl);
  await reopened.getByRole("button", { name: "취소", exact: true }).click();
});

test("linked requested dates, metadata, baseline and successor schedules persist canonically", async ({ page, observeIsolatedApi }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Linked editor ${Date.now()}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("EditPwd1234!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const api = `/api${new URL(page.url()).pathname}`;
  const origin = new URL(page.url()).origin;
  let snapshot = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  for (const [name, duration] of [["Chain A", 3], ["Chain B", 2], ["Chain C", 1]] as const) {
    const response = await page.request.post(`${api}/tasks`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data: { name, type: "task", start: "2026-09-14", duration, progress: 0 } });
    expect(response.status()).toBe(201);
    snapshot = await response.json() as ProjectSnapshotResponse;
  }
  const [a, b, c] = ["Chain A", "Chain B", "Chain C"].map((name) => snapshot.data.tasks.find((task) => task.name === name)!);
  for (const [predecessor, successor] of [[a, b], [b, c]]) {
    const response = await page.request.post(`${api}/links`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data: { predecessorExternalId: predecessor.externalId, successorExternalId: successor.externalId, type: "FS", lag: 0 } });
    expect(response.ok()).toBeTruthy();
    snapshot = await response.json() as ProjectSnapshotResponse;
  }
  await page.reload();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const patches: Record<string, unknown>[] = [];
  page.on("request", (request) => { if (request.method() === "PATCH" && request.url().includes(`${api}/tasks/`)) patches.push(request.postDataJSON()); });
  const open = async (taskId: string) => {
    await page.locator(`.wx-row[data-id=":${taskId}"]`).getByText(/Chain/).first().click({ button: "right" });
    await chooseTaskInformation(page);
    return page.getByRole("dialog", { name: "작업 정보", exact: true });
  };
  let editor = await open(b.taskId);
  await expect(editor.getByLabel("요청 시작일", { exact: true })).toHaveValue("2026-09-14");
  await expect(editor.getByLabel("적용 시작일", { exact: true })).toHaveText("2026-09-17");
  await expect(editor.getByLabel("적용 종료일", { exact: true })).toHaveText("2026-09-18");
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    await expect(editor.getByRole("button", { name: "저장", exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`issue258-after-${width}.png`), fullPage: true });
  }
  await editor.getByLabel("작업명", { exact: true }).fill("Chain B edited");
  await fillTaskMarkdown(editor, "Linked metadata");
  await editor.getByLabel("URL", { exact: true }).fill("https://example.invalid/task");
  await editor.getByLabel("진행률 (%)", { exact: true }).fill("40");
  await editor.getByRole("button", { name: "현재 일정으로 설정", exact: true }).click();
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(patches).toHaveLength(1);
  expect(patches[0]).not.toHaveProperty("start");
  snapshot = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi);
  expect(snapshot.data.tasks.find((task) => task.taskId === b.taskId)).toMatchObject({ requestedStart: "2026-09-14", start: "2026-09-17", end: "2026-09-18", progress: 40, description: "Linked metadata", baselineStart: "2026-09-17", baselineEnd: "2026-09-18" });
  await page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" }).fill("Chain A");
  await expect(page.locator(`.wx-row[data-id=":${c.taskId}"]`)).toHaveCount(0);
  editor = await open(a.taskId);
  await editor.getByLabel("기간 (근무일)", { exact: true }).fill("5");
  await expect(editor.getByRole("button", { name: "현재 일정으로 설정", exact: true })).toBeDisabled();
  await expect(editor).toContainText("변경한 일정을 먼저 저장");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByTestId("workspace-toast")).toContainText("후행 작업 2건");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  snapshot = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi);
  expect(snapshot.data.tasks.find((task) => task.taskId === b.taskId)).toMatchObject({ requestedStart: "2026-09-14", start: "2026-09-21", end: "2026-09-22", baselineStart: "2026-09-17", baselineEnd: "2026-09-18" });
  expect(snapshot.data.tasks.find((task) => task.taskId === c.taskId)).toMatchObject({ start: "2026-09-23" });
  await page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" }).fill("");
  editor = await open(b.taskId);
  await editor.getByLabel("요청 시작일", { exact: true }).fill("2026-09-21");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(patches[2]).toEqual({ start: "2026-09-21" });
  await page.reload();
  snapshot = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi);
  expect(snapshot.data.tasks.find((task) => task.taskId === b.taskId)).toMatchObject({ requestedStart: "2026-09-21", start: "2026-09-21" });
  editor = await open(b.taskId);
  await editor.getByLabel("작업명", { exact: true }).fill("Discard me");
  await page.keyboard.press("Escape");
  await editor.getByRole("button", { name: "변경사항 버리고 닫기" }).click();
  expect(patches).toHaveLength(3);
  const gestureInstance = await frame.getAttribute("data-project-gantt-instance");
  await page.getByRole("button", { name: "일", exact: true }).click();
  for (const mode of ["end", "start", "move"] as const) {
    const bar = page.locator(`.wx-bar[data-task-id=":${a.taskId}"]`);
    await bar.scrollIntoViewIfNeeded();
    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    const x = mode === "start" ? box!.x + 2 : mode === "end" ? box!.x + box!.width - 2 : box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const count = patches.length;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 48, y, { steps: 8 });
    expect(patches).toHaveLength(count);
    await page.mouse.up();
    await expect.poll(() => patches.length).toBe(count + 1);
    await expect(page.getByTestId("workspace-toast")).toContainText("작업을 저장했습니다");
    expect(Object.keys(patches[count]).sort()).toEqual(mode === "end" ? ["duration"] : mode === "start" ? ["duration", "start"] : ["start"]);
    await expect(frame).toHaveAttribute("data-project-gantt-instance", gestureInstance!);
  }
});

// #891 extends the same actual HTTP/SQLite editor fixture, persistence and readonly boundaries.
import { captureSyntheticUiEvidence } from "./helpers/ui-evidence";
import {
  seedMarkdownFixture891, openMarkdownTask891, openMarkdownIssue891, dialogGeometry891,
  checkToolbarTooltips891, resizeMarkdown891, checkLongMarkdownScroll891, longMarkdown891,
} from "./helpers/markdown-editor-891";

for (const surface of ["task", "issue"] as const) test(`Issue #891 ${surface} toolbar labels, actual shortcuts, locale history and vertical resize`, async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await seedMarkdownFixture891(page);
  if (surface === "task") await openMarkdownTask891(page, fixture.tasks[0]);
  else await openMarkdownIssue891(page, fixture.issues[0].name);
  const dialog = surface === "task" ? page.locator("dialog[open]", { has: page.locator("#task-description") })
    : page.getByTestId("project-issue-workspace").getByRole("dialog");
  const field = dialog.locator(surface === "task" ? "#task-description" : "#project-issue-description");
  const writes: string[] = [];
  page.on("request", request => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !isWbsViewReadQuery(request)) writes.push(request.method() + " " + new URL(request.url()).pathname); });
  const rich = field.locator('.mastergantt-markdown-contenteditable[contenteditable="true"]');
  const richIdentity = await rich.elementHandle();
  const untouched = await rich.innerText();
  const unavailableRedo = field.getByRole("button", { name: /^다시 실행 / });
  await expect(unavailableRedo).toHaveAttribute("aria-disabled", "true");
  await unavailableRedo.focus();
  await expect(unavailableRedo).toBeFocused();
  await expect(page.getByRole("tooltip")).toHaveText(/다시 실행/);
  await unavailableRedo.press("Enter");
  await unavailableRedo.press("Space");
  await unavailableRedo.click({ force: true });
  expect(await rich.innerText()).toBe(untouched);
  await rich.fill("Shortcut fixture");
  await rich.press("ControlOrMeta+a");
  await rich.press("ControlOrMeta+b");
  await expect(rich.locator("strong, b")).toHaveText("Shortcut fixture");
  await rich.press("ControlOrMeta+b");
  await rich.press("ControlOrMeta+i");
  await expect(rich.locator("em, i")).toHaveText("Shortcut fixture");
  await rich.press("ControlOrMeta+i");
  await rich.press("ControlOrMeta+u");
  await expect(rich.locator("u, [style*='underline'], [class*='underline']")).toHaveCount(1);
  await rich.press("ControlOrMeta+u");
  await rich.press("ControlOrMeta+k");
  await expect(page.locator(".mdxeditor-popup-container input").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  for (const name of ["글머리표 목록", "번호 목록", "체크 목록"]) {
    const list = field.getByRole("button", { name: `${name} (단축키 없음)`, exact: true });
    await list.click();
    await expect(list).toHaveAttribute("aria-pressed", "true");
    await expect(rich.locator("ul, ol")).toHaveCount(1);
    await list.click();
    await expect(list).toHaveAttribute("aria-pressed", "false");
    await expect(rich.locator("ul, ol")).toHaveCount(0);
    await expect(rich).toHaveText("Shortcut fixture");
  }
  await rich.fill("Undo original");
  await rich.press("End");
  await rich.press("Enter");
  await rich.pressSequentially(" undo marker");
  await rich.press("ControlOrMeta+z");
  await expect(rich).not.toContainText("undo marker");
  await rich.press("Control+Shift+z");
  await expect(rich).toContainText("undo marker");
  await rich.press("ControlOrMeta+z");
  await expect(rich).not.toContainText("undo marker");
  await rich.press("Control+y");
  await expect(rich).toContainText("undo marker");
  await field.getByRole("button", { name: "표 삽입 (단축키 없음)", exact: true }).click();
  await rich.locator("td").first().click();
  const tableText = await rich.innerText();
  for (const name of ["글머리표 목록", "번호 목록", "체크 목록", "표 삽입"]) {
    const unavailable = field.getByRole("button", { name: `${name} (단축키 없음)`, exact: true });
    await expect(unavailable).toHaveAttribute("aria-disabled", "true");
    await unavailable.focus();
    await expect(unavailable).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveText(`${name} (단축키 없음)`);
    await unavailable.press("Enter");
    await unavailable.press("Space");
    await unavailable.click({ force: true });
    expect(await rich.innerText()).toBe(tableText);
    await expect(rich.locator("table")).toHaveCount(1);
  }
  await rich.locator("td").first().click();
  await rich.press("ControlOrMeta+z");
  await expect(rich.locator("table")).toHaveCount(0);
  await expect(rich).toContainText("undo marker");
  const resize = await resizeMarkdown891(page, dialog, field, "rich");
  const selection = () => page.evaluate(() => {
    const selected = getSelection();
    return { text: selected?.toString(), anchor: selected?.anchorOffset, focus: selected?.focusOffset };
  });
  for (const { locale, noShortcut } of [
    { locale: "ko", noShortcut: "단축키 없음" }, { locale: "vi", noShortcut: "Không có phím tắt" },
    { locale: "en", noShortcut: "No keyboard shortcut" }, { locale: "ko", noShortcut: "단축키 없음" },
  ]) {
    await rich.focus();
    await rich.press("ControlOrMeta+a");
    const beforeSelection = await selection();
    // Native dialog makes the global selector inert; its public locale store still receives the same browser event.
    await page.evaluate(value => {
      const selector = document.querySelector<HTMLSelectElement>('.app-locale-select, select[aria-label="표시 언어"], select[aria-label="Display language"], select[aria-label="Ngôn ngữ hiển thị"]');
      if (!selector) throw new Error("global locale selector missing");
      selector.value = value;
      selector.dispatchEvent(new Event("change", { bubbles: true }));
    }, locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect(await selection()).toEqual(beforeSelection);
    await checkToolbarTooltips891(page, field, noShortcut);
    expect(await rich.evaluate((element, original) => element === original, richIdentity)).toBe(true);
    await expect(rich).toContainText("undo marker");
  }
  await rich.focus();
  await rich.press("ControlOrMeta+z");
  await expect(rich).not.toContainText("undo marker");
  await rich.press("Control+Shift+z");
  await expect(rich).toContainText("undo marker");
  await checkLongMarkdownScroll891(page, dialog, field, "rich");
  await field.getByRole("radio", { name: /원문 모드/ }).click();
  const source = field.locator('.cm-content[contenteditable="true"]');
  await source.fill("# Source draft\n\nLong source text");
  const sourceIdentity = await source.elementHandle();
  const sourceResize = await resizeMarkdown891(page, dialog, field, "source");
  await checkToolbarTooltips891(page, field, "단축키 없음");
  await source.focus();
  await source.press("ControlOrMeta+End");
  await source.pressSequentially(" source marker");
  for (const { locale, mode, noShortcut } of [
    { locale: "vi", mode: /Chế độ mã nguồn/, noShortcut: "Không có phím tắt" },
    { locale: "en", mode: /Source mode/, noShortcut: "No keyboard shortcut" },
    { locale: "ko", mode: /원문 모드/, noShortcut: "단축키 없음" },
  ]) {
    await source.focus();
    await source.press("ControlOrMeta+a");
    const beforeSelection = await selection();
    await page.evaluate(value => {
      const selector = document.querySelector<HTMLSelectElement>('select[aria-label="표시 언어"], select[aria-label="Display language"], select[aria-label="Ngôn ngữ hiển thị"]')!;
      selector.value = value; selector.dispatchEvent(new Event("change", { bubbles: true }));
    }, locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect(await selection()).toEqual(beforeSelection);
    await expect(field.getByRole("radio", { name: mode })).toBeChecked();
    expect(await source.evaluate((element, original) => element === original, sourceIdentity)).toBe(true);
    await expect(source).toContainText("# Source draft");
    await expect(source).toContainText("source marker");
    await checkToolbarTooltips891(page, field, noShortcut);
  }
  await source.focus();
  await source.press("ControlOrMeta+z");
  await expect(source).not.toContainText("source marker");
  expect(await source.evaluate((element, original) => element === original, sourceIdentity)).toBe(true);
  await source.press("Control+Shift+KeyZ");
  await expect(source).toContainText("source marker");
  await checkLongMarkdownScroll891(page, dialog, field, "source");
  expect(writes).toEqual([]);
  await captureSyntheticUiEvidence(page, info, {
    issue: 891, acceptanceCriteria: ["AC01", "AC02", "AC03", "AC05"], state: `${surface}-source-ko-resized`,
    fixture: "synthetic-mdx-editor-http", fixtureData: { surface, resize, sourceResize, writes }, locale: "ko",
    flow: { id: "toolbar-source-resize", steps: ["actual shortcuts", "KO-VI-EN-KO tooltips", "rich/source drag", "source locale identity"], outcome: "PASS" },
    elements: [{ name: "dialog", locator: dialog }, { name: "description", locator: field }],
  });
});

for (const height of [900, 1200, 1600]) test(`Issue #891 same-fixture dialog baseline ratio at 1440x${height}`, async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height });
  const fixture = await seedMarkdownFixture891(page);
  const measurements: unknown[] = [];
  for (const task of fixture.tasks) {
    const dialog = await openMarkdownTask891(page, task);
    const geometry = await dialogGeometry891(page, dialog);
    const baseline = height === 900 ? 810 : 896;
    expect(geometry.box.width).toBe(1120);
    expect(geometry.box.height).toBeCloseTo(height === 900 ? 810 : height === 1200 ? 1080 : 1344, 0);
    measurements.push({ kind: task.type, long: task.long, baseline, after: geometry.box.height, ratio: geometry.box.height / baseline, viewportLimited: height !== 1600 });
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
  }
  for (const issue of [null, ...fixture.issues]) {
    const dialog = await openMarkdownIssue891(page, issue?.name);
    for (const long of issue ? [issue.long] : [false, true]) {
      if (!issue && long) await dialog.locator('.mastergantt-markdown-contenteditable[contenteditable="true"]').fill(longMarkdown891);
      const geometry = await dialogGeometry891(page, dialog);
      const baseline = height === 900 ? 792 : 864;
      expect(geometry.box.width).toBe(736);
      expect(geometry.box.height).toBeCloseTo(height === 900 ? 792 : height === 1200 ? 1056 : 1296, 0);
      measurements.push({ kind: issue ? "issue-existing" : "issue-new", long, baseline, after: geometry.box.height, ratio: geometry.box.height / baseline, viewportLimited: height !== 1600 });
    }
    if (!issue) page.once("dialog", confirm => confirm.accept());
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
  }
  await info.attach("issue-891-before-after-geometry", { body: Buffer.from(JSON.stringify(measurements, null, 2)), contentType: "application/json" });
});

for (const width of [390, 768, 1024, 1440, 1920]) test(`Issue #891 responsive headers and actions at ${width}px including low height`, async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width, height: 900 });
  const fixture = await seedMarkdownFixture891(page);
  for (const task of fixture.tasks.filter(task => !task.long)) {
    const dialog = await openMarkdownTask891(page, task);
    for (const height of [900, 480]) {
      await page.setViewportSize({ width, height });
      await dialogGeometry891(page, dialog);
      await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeVisible();
    }
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await page.setViewportSize({ width, height: 900 });
  }
  const dialog = await openMarkdownIssue891(page, fixture.issues[1].name);
  for (const height of [900, 480]) {
    await page.setViewportSize({ width, height });
    await dialogGeometry891(page, dialog);
    await expect(dialog.getByRole("button", { name: "수정 저장", exact: true })).toBeVisible();
    const body = dialog.locator("[class*='editorBody']");
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(dialog.locator("#project-issue-title")).toBeVisible();
    await expect(dialog.locator("#project-issue-password")).toBeVisible();
    await dialogGeometry891(page, dialog);
  }
  await captureSyntheticUiEvidence(page, info, {
    issue: 891, acceptanceCriteria: ["AC04", "AC05"], state: `issue-low-height-${width}`, fixture: "synthetic-mdx-editor-http", locale: "ko",
    fixtureData: { width, height: 480, longDescription: true },
    flow: { id: "responsive-dialog", steps: ["Task/Summary/Milestone at normal and low height", "Issue password/title/footer after body scroll"], outcome: "PASS" },
    elements: [{ name: "dialog", locator: dialog }, { name: "title", locator: dialog.locator("#project-issue-title") }],
  });
});

import { chromium } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Issue #891 native Chromium 125 percent zoom preserves dialog actions and drafts", async ({ page }, info) => {
  test.setTimeout(90_000);
  const fixture = await seedMarkdownFixture891(page);
  const canonicalBefore = await page.request.get(fixture.api);
  const issuesBefore = await page.request.get(fixture.api + "/issues");
  expect(canonicalBefore.status()).toBe(200);
  expect(issuesBefore.status()).toBe(200);
  const snapshotBefore = await canonicalBefore.json();
  const issueDataBefore = await issuesBefore.json();
  const temporary = await mkdtemp(join(tmpdir(), "mastergantt-mdx891-zoom-"));
  const extension = join(temporary, "extension");
  await mkdir(extension);
  await writeFile(join(extension, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Synthetic tab zoom validation", version: "1.0", permissions: ["tabs"], background: { service_worker: "background.js" } }));
  await writeFile(join(extension, "background.js"), "chrome.runtime.onInstalled.addListener(() => {});\n");
  try {
    const context = await chromium.launchPersistentContext(join(temporary, "profile"), {
      channel: "chromium", headless: true, viewport: { width: 1440, height: 900 }, locale: "ko-KR",
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    try {
      await context.addCookies(await page.context().cookies());
      let worker = context.serviceWorkers()[0];
      if (!worker) worker = await context.waitForEvent("serviceworker");
      const check = context.pages()[0] ?? await context.newPage();
      await check.goto(fixture.origin + fixture.path);
      const before = await check.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
      const zoom = await worker.evaluate(async url => {
        const tabs = (globalThis as unknown as { chrome: { tabs: {
          query: (query: object) => Promise<Array<{ id: number; url: string }>>;
          setZoomSettings: (id: number, settings: object) => Promise<void>;
          setZoom: (id: number, factor: number) => Promise<void>;
          getZoom: (id: number) => Promise<number>;
        } } }).chrome.tabs;
        const tab = (await tabs.query({})).find(tab => tab.url === url);
        if (!tab) throw new Error("synthetic tab missing");
        await tabs.setZoomSettings(tab.id, { mode: "automatic", scope: "per-tab" });
        await tabs.setZoom(tab.id, 1.25);
        return tabs.getZoom(tab.id);
      }, check.url());
      expect(zoom).toBe(1.25);
      await expect.poll(() => check.evaluate(() => devicePixelRatio)).toBe(before.dpr * 1.25);
      const actual = await check.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
        htmlZoom: getComputedStyle(document.documentElement).zoom, bodyZoom: getComputedStyle(document.body).zoom,
        visualScale: visualViewport!.scale }));
      expect(actual.width).toBeCloseTo(before.width / 1.25, 0);
      expect(actual.height).toBeCloseTo(before.height / 1.25, 0);
      expect(actual.htmlZoom).toBe("1"); expect(actual.bodyZoom).toBe("1"); expect(actual.visualScale).toBe(1);
      let writes = 0;
      check.on("request", request => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !isWbsViewReadQuery(request)) writes++; });
      for (const task of fixture.tasks.filter(task => !task.long)) {
        const dialog = await openMarkdownTask891(check, task);
        await dialogGeometry891(check, dialog);
        await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "취소", exact: true }).click();
      }
      const issue = await openMarkdownIssue891(check, fixture.issues[1].name);
      await dialogGeometry891(check, issue);
      await issue.locator("#project-issue-title").fill("Native zoom draft preserved");
      await expect(issue.locator("#project-issue-title")).toHaveValue("Native zoom draft preserved");
      await expect(issue.getByRole("button", { name: "수정 저장", exact: true })).toBeVisible();
      expect(writes).toBe(0);
      const canonicalAfter = await page.request.get(fixture.api);
      const issuesAfter = await page.request.get(fixture.api + "/issues");
      expect(canonicalAfter.status()).toBe(200);
      expect(issuesAfter.status()).toBe(200);
      expect(await canonicalAfter.json()).toEqual(snapshotBefore);
      expect(await issuesAfter.json()).toEqual(issueDataBefore);
      await info.attach("native-browser-zoom-125", { body: Buffer.from(JSON.stringify({ before, zoom, actual, writes })), contentType: "application/json" });
      await check.screenshot({ path: info.outputPath("native-browser-zoom-125.png") });
    } finally { await context.close(); }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
