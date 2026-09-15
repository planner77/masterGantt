import { type Frame, type Page, type Request, type Route } from "@playwright/test";
import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);
function uniqueSuffix(): string { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
async function createProject(page: Page, name: string, password: string): Promise<string> {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill(name); await page.getByLabel("편집 비밀번호").fill(password);
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}
async function dragTaskBarByOneDay(page: Page, taskId: string, duration: number, mode: "start" | "move" | "end") {
  const bar = page.locator(`.wx-bar[data-task-id=":${taskId}"]`);
  await expect(bar).toBeVisible(); await bar.scrollIntoViewIfNeeded();
  const box = await bar.boundingBox(); if (!box) throw new Error("Expected visible SVAR task bar.");
  const dayWidth = box.width / duration;
  const sourceX = mode === "start" ? box.x + 2 : mode === "end" ? box.x + box.width - 2 : box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(sourceX, y); await page.mouse.down();
  await page.mouse.move(sourceX + dayWidth * 1.1, y, { steps: 8 }); await page.mouse.up(); return box;
}
async function rejectNextPatch(page: Page, endpoint: string, status: number, code: string): Promise<() => Promise<void>> {
  const pattern = `**${endpoint}`; let intercepted = 0;
  const handler = async (route: Route) => {
    if (route.request().method() !== "PATCH" || intercepted > 0) { await route.continue(); return; }
    intercepted += 1;
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code, message: "Rejected by E2E fixture." } }) });
  };
  await page.route(pattern, handler);
  return async () => { await page.unroute(pattern, handler); expect(intercepted).toBe(1); };
}

async function expectTaskBarGeometry(
  page: Page,
  taskId: string,
  expected: Readonly<{ x: number; width: number }>,
): Promise<void> {
  const target = page.locator(`.wx-bar[data-task-id=":${taskId}"]`);
  await expect.poll(async () => {
    const box = await target.boundingBox();
    if (!box) return Number.POSITIVE_INFINITY;
    return Math.max(Math.abs(box.x - expected.x), Math.abs(box.width - expected.width));
  }, { timeout: 5_000 }).toBeLessThan(0.5);
}

test("persists pointer edits, restores rejected writes, and serializes a same-revision race", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const suffix = uniqueSuffix(); const password = `W07-password-${suffix}`;
  const projectId = await createProject(page, `W07 Project ${suffix}`, password);
  const apiPath = `/api/projects/${projectId}`;
  const workspace = page.getByRole("region", { name: "프로젝트 일정 Grid와 Gantt 차트" });
  await expect(workspace).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-table-container")).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-chart")).toBeVisible();
  await workspace.focus(); await expect(workspace).toBeFocused();
  expect(await workspace.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await workspace.evaluate((element) => element.clientWidth));
  await workspace.evaluate((element) => { element.scrollLeft = 240; });
  expect(await workspace.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".project-gantt-widget .wx-chart")).toBeVisible();
  // Pointer 회귀는 보호 API로 3일 작업을 준비한다. 실제 native +는 아래에서 따로 검증한다.
  let snapshot = await (await page.request.get(apiPath)).json();
  const seedRevision = snapshot.data.project.revision as number;
  const seedExternalId = `W07-${suffix}`;
  const seedResponse = await page.request.post(`${apiPath}/tasks`, {
    headers: { "Content-Type": "application/json", "If-Match": `"${seedRevision}"`, Origin: new URL(page.url()).origin },
    data: { externalId: seedExternalId, name: `W07 Build ${suffix}`, type: "task", start: "2026-09-12", duration: 3, progress: 20 },
  });
  expect(seedResponse.status()).toBe(201); snapshot = await seedResponse.json();
  const task = snapshot.data.tasks.find((entry: { externalId: string }) => entry.externalId === seedExternalId);
  expect(task).toBeTruthy();
  expect(task).toMatchObject({ requestedStart: "2026-09-12", start: "2026-09-14", end: "2026-09-16", duration: 3 });
  await page.reload();
  await expect(page.getByRole("grid").getByText(`W07 Build ${suffix}`, { exact: true })).toBeVisible();
  await expect(page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${task.taskId}"]`)).toBeVisible();
  await expect(page.locator('.project-gantt-widget [data-action="add-task"]').first()).toBeVisible();
  const ganttBox = await page.locator(".project-gantt-scroll").boundingBox();
  expect(ganttBox).not.toBeNull(); expect(ganttBox!.width).toBeGreaterThan(1_000); expect(ganttBox!.height).toBeGreaterThan(240);
  const projectBox = await page.locator(".project-readonly").boundingBox();
  expect(projectBox).not.toBeNull();
  expect(ganttBox!.y + ganttBox!.height).toBeCloseTo(projectBox!.y + projectBox!.height, 0);
  expect(ganttBox!.y).toBeLessThan(650);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  const revisionAfterCreate = snapshot.data.project.revision as number;
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  await dragTaskBarByOneDay(page, task.taskId, task.duration, "end");
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 저장했습니다");
  snapshot = await (await page.request.get(apiPath)).json();
  const rightResizedTask = snapshot.data.tasks.find((entry: { taskId: string }) => entry.taskId === task.taskId);
  expect(snapshot.data.project.revision).toBe(revisionAfterCreate + 1);
  expect(rightResizedTask).toMatchObject({ start: "2026-09-14", end: "2026-09-17", duration: 4 });
  await dragTaskBarByOneDay(page, task.taskId, rightResizedTask.duration, "start");
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 저장했습니다");
  snapshot = await (await page.request.get(apiPath)).json();
  const leftResizedTask = snapshot.data.tasks.find((entry: { taskId: string }) => entry.taskId === task.taskId);
  expect(snapshot.data.project.revision).toBe(revisionAfterCreate + 2);
  expect(leftResizedTask).toMatchObject({ start: "2026-09-15", end: "2026-09-17", duration: 3 });
  await dragTaskBarByOneDay(page, task.taskId, leftResizedTask.duration, "move");
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 저장했습니다");
  snapshot = await (await page.request.get(apiPath)).json();
  const movedTask = snapshot.data.tasks.find((entry: { taskId: string }) => entry.taskId === task.taskId);
  expect(snapshot.data.project.revision).toBe(revisionAfterCreate + 3);
  expect(movedTask).toMatchObject({ requestedStart: "2026-09-16", start: "2026-09-16", end: "2026-09-18", duration: 3 });
  const canonicalBox = await page.locator(`.wx-bar[data-task-id=":${task.taskId}"]`).boundingBox();
  if (!canonicalBox) throw new Error("Expected canonical SVAR task bar after move.");
  const rejectedCases = [
    { status: 422, code: "INVALID_DURATION", notice: "작업 정보를 저장할 수 없습니다. 입력과 일정 제약을 확인해 주세요." },
    { status: 412, code: "PRECONDITION_FAILED", notice: "다른 편집 내용이 먼저 저장되었습니다. 최신 정보를 불러왔습니다." },
    { status: 500, code: "INTERNAL_ERROR", notice: "작업을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요." },
  ];
  for (const rejected of rejectedCases) {
    const removeRoute = await rejectNextPatch(page, `${apiPath}/tasks/${task.taskId}`, rejected.status, rejected.code);
    await dragTaskBarByOneDay(page, task.taskId, movedTask.duration, "move");
    await expect(page.getByTestId("workspace-toast")).toContainText(rejected.notice); await removeRoute();
    await expectTaskBarGeometry(page, task.taskId, canonicalBox);
    const afterRejected = await (await page.request.get(apiPath)).json();
    expect(afterRejected.data.project.revision).toBe(revisionAfterCreate + 3);
    expect(afterRejected.data.tasks.find((entry: { taskId: string }) => entry.taskId === task.taskId))
      .toMatchObject({ requestedStart: "2026-09-16", start: "2026-09-16", end: "2026-09-18", duration: 3 });
  }
  let failedCanonicalReads = 0;
  const canonicalPattern = `**${apiPath}`;
  const failCanonicalRead = async (route: Route) => {
    if (route.request().method() === "GET" && failedCanonicalReads === 0) {
      failedCanonicalReads += 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Unavailable." } }) }); return;
    }
    await route.continue();
  };
  await page.route(canonicalPattern, failCanonicalRead);
  const removeNetworkFailure = await rejectNextPatch(page, `${apiPath}/tasks/${task.taskId}`, 500, "INTERNAL_ERROR");
  await dragTaskBarByOneDay(page, task.taskId, movedTask.duration, "move");
  await expect(page.getByTestId("workspace-toast")).toContainText("최신 일정 조회에 실패");
  await removeNetworkFailure(); await page.unroute(canonicalPattern, failCanonicalRead); expect(failedCanonicalReads).toBe(1);
  // 저장 오류와 복구 오류가 둘 다 보관되어야 한다. 복구 안내가 원래 오류를 삭제하면 안 된다.
  await page.getByRole("button", { name: /알림함/ }).click();
  const inbox = page.getByRole("dialog", { name: "오류 알림함" });
  expect((await inbox.locator("textarea").evaluateAll((elements) => elements.map((element) => (element as HTMLTextAreaElement).value))).join("\n")).toContain("작업을 저장할 수 없습니다");
  await page.keyboard.press("Escape");
  await expectTaskBarGeometry(page, task.taskId, canonicalBox);
  snapshot = await (await page.request.get(apiPath)).json();
  const deleteResponse = await page.request.delete(`${apiPath}/tasks/${task.taskId}`, { headers: { "If-Match": `"${snapshot.data.project.revision}"`, Origin: new URL(page.url()).origin } });
  expect(deleteResponse.status()).toBe(200);
  const afterDelete = await deleteResponse.json();
  expect(afterDelete.data.tasks.some((entry: { taskId: string }) => entry.taskId === task.taskId)).toBe(false);
  await page.reload(); await expect(page.getByText(`W07 Build ${suffix}`, { exact: true })).toHaveCount(0);
  snapshot = await (await page.request.get(apiPath)).json();
  const revisionBeforeRace = snapshot.data.project.revision as number;
  const raceExternalIds = [`W07-RACE-A-${suffix}`, `W07-RACE-B-${suffix}`];
  const headers = { "Content-Type": "application/json", "If-Match": `"${revisionBeforeRace}"`, Origin: new URL(page.url()).origin };
  const raceResponses = await Promise.all(raceExternalIds.map((externalId, index) => page.request.post(`${apiPath}/tasks`, {
    headers, data: { externalId, name: `Race contender ${index + 1} ${suffix}`, type: "task", start: "2026-09-22", duration: 2, progress: 0 },
  })));
  expect(raceResponses.map((response) => response.status()).sort()).toEqual([201, 412]);
  const winnerIndex = raceResponses.findIndex((response) => response.status() === 201);
  const winnerExternalId = raceExternalIds[winnerIndex];
  snapshot = await (await page.request.get(apiPath)).json();
  expect(snapshot.data.project.revision).toBe(revisionBeforeRace + 1); expect(snapshot.data.tasks).toHaveLength(1); expect(snapshot.data.tasks[0].externalId).toBe(winnerExternalId);
  await page.reload(); await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const winnerTask = snapshot.data.tasks[0];
  await expect(page.getByRole("grid").getByText(winnerTask.name, { exact: true })).toBeVisible();
  const beforeUnauthorized = await page.locator(`.wx-bar[data-task-id=":${winnerTask.taskId}"]`).boundingBox();
  if (!beforeUnauthorized) throw new Error("Expected race winner SVAR task bar.");
  const removeUnauthorizedRoute = await rejectNextPatch(page, `${apiPath}/tasks/${winnerTask.taskId}`, 401, "EDIT_SESSION_INVALID");
  await dragTaskBarByOneDay(page, winnerTask.taskId, winnerTask.duration, "move");
  await expect(page.getByTestId("workspace-toast")).toContainText("편집 권한이 만료되었습니다");
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible(); await removeUnauthorizedRoute();
  const afterUnauthorized = await (await page.request.get(apiPath)).json();
  expect(afterUnauthorized.data.project.revision).toBe(revisionBeforeRace + 1);
  expect(afterUnauthorized.data.tasks[0]).toMatchObject({ taskId: winnerTask.taskId, requestedStart: "2026-09-22", start: "2026-09-22", end: "2026-09-23", duration: 2 });
  const restoredUnauthorizedBox = await page.locator(`.wx-bar[data-task-id=":${winnerTask.taskId}"]`).boundingBox();
  expect(restoredUnauthorizedBox).not.toBeNull(); expect(restoredUnauthorizedBox!.x).toBeCloseTo(beforeUnauthorized.x, 0); expect(restoredUnauthorizedBox!.width).toBeCloseTo(beforeUnauthorized.width, 0);
  await page.getByLabel("편집 비밀번호").fill(password); await page.getByRole("button", { name: "편집 잠금 해제" }).click();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-09-24T12:00:00Z"));
  const browserToday = await page.evaluate(() => { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`; });
  expect(browserToday).toBe("2026-09-24");
  const grid = page.getByRole("grid"); const taskEndpoint = `${apiPath}/tasks`;
  let nativePosts = 0; let mainFrameNavigations = 0;
  const recordNativePost = (request: Request) => { if (request.method() === "POST" && new URL(request.url()).pathname === taskEndpoint) nativePosts += 1; };
  const recordNavigation = (frame: Frame) => { if (frame === page.mainFrame()) mainFrameNavigations += 1; };
  page.on("request", recordNativePost); page.on("framenavigated", recordNavigation);
  const beforeRootIds = new Set<string>(afterUnauthorized.data.tasks.map((entry: { taskId: string }) => entry.taskId));
  const rootResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === taskEndpoint);
  await page.locator('.project-gantt-widget [data-action="add-task"]').first().click();
  const rootResponse = await rootResponsePromise; expect(rootResponse.status()).toBe(201);
  const afterRoot = await rootResponse.json();
  const roots = afterRoot.data.tasks.filter((entry: { taskId: string }) => !beforeRootIds.has(entry.taskId));
  expect(roots).toHaveLength(1); const nativeRoot = roots[0];
  expect(nativeRoot).toMatchObject({ name: "새 작업", requestedStart: browserToday, start: browserToday, end: browserToday, duration: 1, parentExternalId: null });
  expect(afterRoot.data.project.revision).toBe(afterUnauthorized.data.project.revision + 1);
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 추가했습니다");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(grid.getByText("새 작업", { exact: true })).toHaveCount(1); await expect(grid.getByText("새 작업", { exact: true })).toBeVisible();
  await expect(page.locator(`.wx-bar[data-task-id=":${nativeRoot.taskId}"]`)).toBeVisible();
  expect(nativePosts).toBe(1); expect(mainFrameNavigations).toBe(0);
  // #11: 첫 행 + 클릭 한 번으로 서버 요약 전환과 child 저장이 원자적으로 완료되어야 한다.
  const winnerRow = page.locator(".project-gantt-widget .wx-row", { hasText: winnerTask.name }).first();
  const childResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === taskEndpoint);
  await winnerRow.locator('[data-action="add-task"]').click();
  const childResponse = await childResponsePromise; expect(childResponse.status()).toBe(201);
  expect(childResponse.request().postDataJSON()).toMatchObject({ parentTaskId: winnerTask.taskId, convertParentToSummary: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const afterChild = await childResponse.json();
  const beforeChildIds = new Set<string>(afterRoot.data.tasks.map((entry: { taskId: string }) => entry.taskId));
  const children = afterChild.data.tasks.filter((entry: { taskId: string }) => !beforeChildIds.has(entry.taskId));
  expect(children).toHaveLength(1); const child = children[0];
  expect(child).toMatchObject({ name: "새 작업", requestedStart: browserToday, start: browserToday, end: browserToday, duration: 1, parentExternalId: winnerTask.externalId });
  const summary = afterChild.data.tasks.find((entry: { taskId: string }) => entry.taskId === winnerTask.taskId);
  expect(summary).toMatchObject({ type: "summary", start: child.start, end: child.end });
  expect(afterChild.data.project.revision).toBe(afterRoot.data.project.revision + 1);
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 추가했습니다");
  await expect(grid.getByText("새 작업", { exact: true })).toHaveCount(2);
  for (const name of await grid.getByText("새 작업", { exact: true }).all()) await expect(name).toBeVisible();
  await expect(page.locator(`.wx-bar[data-task-id=":${nativeRoot.taskId}"]`)).toBeVisible();
  await expect(page.locator(`.wx-bar[data-task-id=":${child.taskId}"]`)).toBeVisible();
  expect(nativePosts).toBe(2); expect(mainFrameNavigations).toBe(0);
  page.off("request", recordNativePost); page.off("framenavigated", recordNavigation);
  await page.reload(); await expect(grid.getByText("새 작업", { exact: true })).toHaveCount(2);
  await expect(page.locator(`.wx-bar[data-task-id=":${nativeRoot.taskId}"]`)).toBeVisible();
  await expect(page.locator(`.wx-bar[data-task-id=":${child.taskId}"]`)).toBeVisible();
  const persisted = await (await page.request.get(apiPath)).json();
  expect(persisted.data.project.revision).toBe(afterChild.data.project.revision);
  expect(persisted.data.tasks).toHaveLength(afterChild.data.tasks.length);
  expect(persisted.data.tasks.find((entry: { taskId: string }) => entry.taskId === child.taskId)).toMatchObject({ parentExternalId: winnerTask.externalId, name: "새 작업", start: browserToday, duration: 1 });
});
