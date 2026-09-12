import { expect, test, type Page, type Route } from "@playwright/test";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createProject(
  page: Page,
  name: string,
  password: string,
): Promise<string> {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill(name);
  await page.getByLabel("편집 비밀번호").fill(password);
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function dragTaskBarByOneDay(
  page: Page,
  taskId: string,
  duration: number,
  mode: "start" | "move" | "end",
) {
  const bar = page.locator(`.wx-bar[data-task-id=":${taskId}"]`);
  await expect(bar).toBeVisible();
  await bar.scrollIntoViewIfNeeded();
  const box = await bar.boundingBox();
  if (!box) throw new Error("Expected visible SVAR task bar.");
  const dayWidth = box.width / duration;
  const sourceX = mode === "start"
    ? box.x + 2
    : mode === "end"
      ? box.x + box.width - 2
      : box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(sourceX, y);
  await page.mouse.down();
  await page.mouse.move(sourceX + dayWidth * 1.1, y, { steps: 8 });
  await page.mouse.up();
  return box;
}

async function rejectNextPatch(
  page: Page,
  endpoint: string,
  status: number,
  code: string,
): Promise<() => Promise<void>> {
  const pattern = `**${endpoint}`;
  let intercepted = 0;
  const handler = async (route: Route) => {
    if (route.request().method() !== "PATCH" || intercepted > 0) {
      await route.continue();
      return;
    }
    intercepted += 1;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ error: { code, message: "Rejected by E2E fixture." } }),
    });
  };
  await page.route(pattern, handler);
  return async () => {
    await page.unroute(pattern, handler);
    expect(intercepted).toBe(1);
  };
}

test("persists pointer edits, restores rejected writes, and serializes a same-revision race", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const suffix = uniqueSuffix();
  const password = `W07-password-${suffix}`;
  const projectId = await createProject(page, `W07 Project ${suffix}`, password);
  const apiPath = `/api/projects/${projectId}`;

  const workspace = page.getByRole("region", { name: "프로젝트 일정 Grid와 Gantt 차트" });
  await expect(workspace).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-table-container")).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-chart")).toBeVisible();
  await workspace.focus();
  await expect(workspace).toBeFocused();
  expect(await workspace.evaluate((element) => element.scrollWidth)).toBeGreaterThan(
    await workspace.evaluate((element) => element.clientWidth),
  );
  await workspace.evaluate((element) => { element.scrollLeft = 240; });
  expect(await workspace.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".project-gantt-widget .wx-chart")).toBeVisible();
  await page.getByText("작업 추가 또는 삭제", { exact: true }).click();
  await page.getByLabel("작업 이름").fill(`W07 Build ${suffix}`);
  await page.getByLabel("외부 ID 선택").fill(`W07-${suffix}`);
  await page.getByLabel("시작일").fill("2026-09-12");
  await page.getByLabel("기간 근무일").fill("3");
  await page.getByLabel("진척도").fill("20");
  await page.getByRole("button", { name: "작업 추가" }).click();
  await expect(page.getByRole("status")).toContainText("작업을 추가했습니다");
  await expect(page.getByRole("status")).toContainText("비근무일 시작은 다음 근무일로 조정되었습니다");
  await expect(page.getByRole("grid").getByText(`W07 Build ${suffix}`, { exact: true })).toBeVisible();

  let snapshot = await (await page.request.get(apiPath)).json();
  const task = snapshot.data.tasks.find((entry: { externalId: string }) => entry.externalId === `W07-${suffix}`);
  expect(task).toBeTruthy();
  expect(task).toMatchObject({ requestedStart: "2026-09-12", start: "2026-09-14", end: "2026-09-16", duration: 3 });
  await page.getByText("작업 추가 또는 삭제", { exact: true }).click();
  await expect(page.locator(".project-gantt-widget .wx-table-container")).toBeVisible();
  await expect(page.locator(".project-gantt-widget .wx-chart")).toBeVisible();
  await expect(page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${task.taskId}"]`)).toBeVisible();
  await expect(page.locator('.project-gantt-widget [data-action="add-task"]').first()).toBeVisible();
  const ganttBox = await page.locator(".project-gantt-scroll").boundingBox();
  expect(ganttBox).not.toBeNull();
  expect(ganttBox!.width).toBeGreaterThan(1_000);
  // The Gantt owns the remaining desktop viewport rather than a fixed pixel
  // height, leaving its own Grid/Chart scroller available for long schedules.
  expect(ganttBox!.height).toBeGreaterThan(240);
  const projectBox = await page.locator(".project-readonly").boundingBox();
  expect(projectBox).not.toBeNull();
  // Notices and settings consume real space; the chart fills what remains.
  expect(ganttBox!.y + ganttBox!.height).toBeCloseTo(projectBox!.y + projectBox!.height, 0);
  expect(ganttBox!.y).toBeLessThan(650);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  const revisionAfterCreate = snapshot.data.project.revision as number;

  await page.reload();
  await expect(page.getByRole("grid").getByText(`W07 Build ${suffix}`, { exact: true })).toBeVisible();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();

  await dragTaskBarByOneDay(page, task.taskId, task.duration, "end");
  await expect(page.getByRole("status")).toContainText("작업을 저장했습니다");

  snapshot = await (await page.request.get(apiPath)).json();
  const rightResizedTask = snapshot.data.tasks.find((entry: { taskId: string }) => entry.taskId === task.taskId);
  expect(snapshot.data.project.revision).toBe(revisionAfterCreate + 1);
  expect(rightResizedTask).toMatchObject({ start: "2026-09-14", end: "2026-09-17", duration: 4 });

  await dragTaskBarByOneDay(page, task.taskId, rightResizedTask.duration, "start");
  await expect(page.getByRole("status")).toContainText("작업을 저장했습니다");

  snapshot = await (await page.request.get(apiPath)).json();
  const leftResizedTask = snapshot.data.tasks.find((entry: { taskId: string }) => entry.taskId === task.taskId);
  expect(snapshot.data.project.revision).toBe(revisionAfterCreate + 2);
  expect(leftResizedTask).toMatchObject({ start: "2026-09-15", end: "2026-09-17", duration: 3 });

  await dragTaskBarByOneDay(page, task.taskId, leftResizedTask.duration, "move");
  await expect(page.getByRole("status")).toContainText("작업을 저장했습니다");

  snapshot = await (await page.request.get(apiPath)).json();
  const movedTask = snapshot.data.tasks.find((entry: { taskId: string }) => entry.taskId === task.taskId);
  expect(snapshot.data.project.revision).toBe(revisionAfterCreate + 3);
  expect(movedTask).toMatchObject({ requestedStart: "2026-09-16", start: "2026-09-16", end: "2026-09-18", duration: 3 });

  const canonicalBar = page.locator(`.wx-bar[data-task-id=":${task.taskId}"]`);
  const canonicalBox = await canonicalBar.boundingBox();
  if (!canonicalBox) throw new Error("Expected canonical SVAR task bar after move.");
  const rejectedCases = [
    { status: 422, code: "INVALID_DURATION", notice: "작업 정보를 저장할 수 없습니다. 입력과 일정 제약을 확인해 주세요." },
    { status: 412, code: "PRECONDITION_FAILED", notice: "다른 편집 내용이 먼저 저장되었습니다. 최신 정보를 불러왔습니다." },
    { status: 500, code: "INTERNAL_ERROR", notice: "작업을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요." },
  ];
  for (const rejected of rejectedCases) {
    const removeRoute = await rejectNextPatch(
      page,
      `${apiPath}/tasks/${task.taskId}`,
      rejected.status,
      rejected.code,
    );
    await dragTaskBarByOneDay(page, task.taskId, movedTask.duration, "move");
    await expect(page.getByRole("status")).toContainText(rejected.notice);
    await removeRoute();

    const restoredBox = await page.locator(`.wx-bar[data-task-id=":${task.taskId}"]`).boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(restoredBox!.x).toBeCloseTo(canonicalBox.x, 0);
    expect(restoredBox!.width).toBeCloseTo(canonicalBox.width, 0);
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
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Unavailable." } }),
      });
      return;
    }
    await route.continue();
  };
  await page.route(canonicalPattern, failCanonicalRead);
  const removeNetworkFailure = await rejectNextPatch(
    page,
    `${apiPath}/tasks/${task.taskId}`,
    500,
    "INTERNAL_ERROR",
  );
  await dragTaskBarByOneDay(page, task.taskId, movedTask.duration, "move");
  await expect(page.getByRole("status")).toContainText("작업을 저장할 수 없습니다");
  await removeNetworkFailure();
  await page.unroute(canonicalPattern, failCanonicalRead);
  expect(failedCanonicalReads).toBe(1);
  const restoredWithoutRead = await page.locator(`.wx-bar[data-task-id=":${task.taskId}"]`).boundingBox();
  expect(restoredWithoutRead).not.toBeNull();
  expect(restoredWithoutRead!.x).toBeCloseTo(canonicalBox.x, 0);
  expect(restoredWithoutRead!.width).toBeCloseTo(canonicalBox.width, 0);

  await page.getByText("작업 추가 또는 삭제", { exact: true }).click();
  await page.getByLabel("작업 삭제").selectOption(task.taskId);
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByRole("group", { name: "작업 삭제 확인" })).toBeVisible();
  await page.getByRole("button", { name: "삭제 확인" }).click();
  await expect(page.getByRole("status")).toContainText("작업을 삭제했습니다");
  await expect(page.getByText(`W07 Build ${suffix}`, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(`W07 Build ${suffix}`, { exact: true })).toHaveCount(0);

  snapshot = await (await page.request.get(apiPath)).json();
  const revisionBeforeRace = snapshot.data.project.revision as number;
  const raceExternalIds = [`W07-RACE-A-${suffix}`, `W07-RACE-B-${suffix}`];
  const headers = {
    "Content-Type": "application/json",
    "If-Match": `"${revisionBeforeRace}"`,
    Origin: new URL(page.url()).origin,
  };
  const raceResponses = await Promise.all(raceExternalIds.map((externalId, index) =>
    page.request.post(`${apiPath}/tasks`, {
      headers,
      data: {
        externalId,
        name: `Race contender ${index + 1} ${suffix}`,
        type: "task",
        start: "2026-09-22",
        duration: 2,
        progress: 0,
      },
    }),
  ));
  expect(raceResponses.map((response) => response.status()).sort()).toEqual([201, 412]);

  const winnerIndex = raceResponses.findIndex((response) => response.status() === 201);
  const winnerExternalId = raceExternalIds[winnerIndex];
  snapshot = await (await page.request.get(apiPath)).json();
  expect(snapshot.data.project.revision).toBe(revisionBeforeRace + 1);
  expect(snapshot.data.tasks).toHaveLength(1);
  expect(snapshot.data.tasks[0].externalId).toBe(winnerExternalId);

  await page.reload();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const winnerTask = snapshot.data.tasks[0];
  await expect(page.getByRole("grid").getByText(winnerTask.name, { exact: true })).toBeVisible();

  const beforeUnauthorized = await page.locator(`.wx-bar[data-task-id=":${winnerTask.taskId}"]`).boundingBox();
  if (!beforeUnauthorized) throw new Error("Expected race winner SVAR task bar.");
  const removeUnauthorizedRoute = await rejectNextPatch(
    page,
    `${apiPath}/tasks/${winnerTask.taskId}`,
    401,
    "EDIT_SESSION_INVALID",
  );
  await dragTaskBarByOneDay(page, winnerTask.taskId, winnerTask.duration, "move");
  await expect(page.getByRole("status")).toContainText("편집 권한이 만료되었습니다");
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await removeUnauthorizedRoute();

  const afterUnauthorized = await (await page.request.get(apiPath)).json();
  expect(afterUnauthorized.data.project.revision).toBe(revisionBeforeRace + 1);
  expect(afterUnauthorized.data.tasks[0]).toMatchObject({
    taskId: winnerTask.taskId,
    requestedStart: "2026-09-22",
    start: "2026-09-22",
    end: "2026-09-23",
    duration: 2,
  });
  const restoredUnauthorizedBox = await page.locator(`.wx-bar[data-task-id=":${winnerTask.taskId}"]`).boundingBox();
  expect(restoredUnauthorizedBox).not.toBeNull();
  expect(restoredUnauthorizedBox!.x).toBeCloseTo(beforeUnauthorized.x, 0);
  expect(restoredUnauthorizedBox!.width).toBeCloseTo(beforeUnauthorized.width, 0);

  await page.getByLabel("편집 비밀번호").fill(password);
  await page.getByRole("button", { name: "편집 잠금 해제" }).click();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();

  // The first native add control is the Grid header. It opens the protected
  // creation dialog rather than allowing a temporary SVAR-only task.
  const browserToday = await page.evaluate(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
  });
  await page.locator('.project-gantt-widget [data-action="add-task"]').first().click();
  const rootTaskDialog = page.getByRole("dialog", { name: "새 작업을 추가할까요?" });
  await expect(rootTaskDialog).toBeVisible();
  await expect(rootTaskDialog.getByLabel("시작일")).toHaveValue(browserToday);
  await expect(rootTaskDialog.getByLabel("기간 근무일")).toHaveValue("1");
  await rootTaskDialog.getByLabel("작업 이름").fill(`Native root ${suffix}`);
  await rootTaskDialog.getByLabel("시작일").fill("2026-09-24");
  await rootTaskDialog.getByLabel("기간 근무일").fill("1");
  await rootTaskDialog.getByRole("button", { name: "작업 추가" }).click();
  await expect(page.getByRole("status")).toContainText("작업을 추가했습니다");

  // A row '+' creates a child. The first child explicitly confirms that the
  // former leaf will become a calculated summary before the protected POST.
  const winnerRow = page.locator(".project-gantt-widget .wx-row", {
    hasText: winnerTask.name,
  }).first();
  await winnerRow.locator('[data-action="add-task"]').click();
  const childTaskDialog = page.getByRole("dialog", { name: "부모 작업을 요약 작업으로 전환할까요?" });
  await expect(childTaskDialog).toBeVisible();
  await expect(childTaskDialog.getByLabel("시작일")).toHaveValue(browserToday);
  await expect(childTaskDialog.getByLabel("기간 근무일")).toHaveValue("1");
  await childTaskDialog.getByLabel("작업 이름").fill(`Native child ${suffix}`);
  await childTaskDialog.getByLabel("시작일").fill("2026-09-24");
  await childTaskDialog.getByLabel("기간 근무일").fill("1");
  await childTaskDialog.getByLabel("부모 작업을 요약 작업으로 전환하는 데 동의합니다.").check();
  await childTaskDialog.getByRole("button", { name: "전환하고 하위 작업 추가" }).click();
  await expect(page.getByRole("status")).toContainText("작업을 추가했습니다");

  snapshot = await (await page.request.get(apiPath)).json();
  const summary = snapshot.data.tasks.find((entry: { taskId: string }) => entry.taskId === winnerTask.taskId);
  const child = snapshot.data.tasks.find((entry: { name: string }) => entry.name === `Native child ${suffix}`);
  expect(summary).toMatchObject({ type: "summary" });
  expect(child).toMatchObject({ parentExternalId: winnerTask.externalId });

  await page.reload();
  await expect(page.getByRole("grid").getByText(`Native child ${suffix}`, { exact: true })).toBeVisible();
  await expect(page.locator(`.wx-bar[data-task-id=":${child.taskId}"]`)).toBeVisible();
});
