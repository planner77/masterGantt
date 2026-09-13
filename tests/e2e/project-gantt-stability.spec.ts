import {
  expect,
  test,
  type Frame,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";

import type {
  CreateTaskRequest,
  ProjectDto,
  ProjectTaskDto,
  TaskMutationResponse,
} from "../../src/contracts/projects";

const publicId = "a3405d3d-8cb4-4da4-9b0f-43a5de330003";
const projectPath = `/api/projects/${publicId}`;
const taskPath = `${projectPath}/tasks`;

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

type PostOutcome =
  | { readonly kind: "success"; readonly gate?: Deferred; readonly started?: Deferred }
  | { readonly kind: "error"; readonly status: 401 | 412 | 422 | 500; readonly code: string }
  | { readonly kind: "network" };

interface StatefulProjectFixture {
  readonly initialRevision: number;
  readonly posts: CreateTaskRequest[];
  readonly patchRequests: Request[];
  readonly createdTaskIds: string[];
  readonly project: ProjectDto;
  readonly tasks: ProjectTaskDto[];
  sessionEditable: boolean;
  nextPost: PostOutcome;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function task(
  ordinal: number,
  externalId: string,
  name: string,
  overrides: Partial<ProjectTaskDto> = {},
): ProjectTaskDto {
  return {
    taskId: `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
    externalId,
    name,
    type: "task",
    scheduleMode: "auto",
    requestedStart: "2026-09-16",
    start: "2026-09-16",
    end: "2026-09-16",
    duration: 1,
    progress: 0,
    parentExternalId: null,
    siblingOrder: ordinal,
    ...overrides,
  };
}

function initialTasks(): ProjectTaskDto[] {
  return [
    task(1, "SUMMARY-1", "Stable summary", {
      type: "summary",
      requestedStart: null,
      start: "2026-01-05",
      end: "2026-01-06",
      duration: 2,
      progress: 25,
      siblingOrder: 0,
    }),
    task(2, "SUMMARY-CHILD-1", "Existing summary child", {
      requestedStart: "2026-01-05",
      start: "2026-01-05",
      end: "2026-01-06",
      duration: 2,
      progress: 25,
      parentExternalId: "SUMMARY-1",
      siblingOrder: 0,
    }),
    task(3, "LEAF-1", "Stable leaf", { siblingOrder: 1 }),
    task(4, "MILESTONE-1", "Stable milestone", {
      type: "milestone",
      requestedStart: "2026-12-18",
      start: "2026-12-18",
      end: "2026-12-18",
      duration: 0,
      siblingOrder: 2,
    }),
  ];
}

function snapshot(fixture: StatefulProjectFixture) {
  return {
    data: {
      project: { ...fixture.project },
      tasks: fixture.tasks.map((entry) => ({ ...entry })),
      links: [],
      permission: "readonly" as const,
    },
  };
}

function taskMutation(
  fixture: StatefulProjectFixture,
  changedTaskExternalIds: string[],
): TaskMutationResponse {
  return {
    data: {
      project: { ...fixture.project },
      tasks: fixture.tasks.map((entry) => ({ ...entry })),
      links: [],
      warnings: [],
      operation: {
        kind: "taskCreate",
        changedTaskExternalIds,
        deletedTaskExternalIds: [],
        deletedLinkIds: [],
      },
    },
  };
}

function errorBody(code: string) {
  return {
    error: {
      code,
      message: "Rejected by the Issue #3 E2E fixture.",
      details: [],
      requestId: "issue-3-e2e",
    },
  };
}

function applySuccessfulCreate(
  fixture: StatefulProjectFixture,
  payload: CreateTaskRequest,
): TaskMutationResponse {
  const sequence = fixture.createdTaskIds.length + 100;
  const externalId = `ISSUE-3-${sequence}`;
  const parent = payload.parentTaskId
    ? fixture.tasks.find((entry) => entry.taskId === payload.parentTaskId)
    : undefined;
  const changedTaskExternalIds = [externalId];
  if (parent?.type === "task" && payload.convertParentToSummary) {
    parent.type = "summary";
    parent.requestedStart = null;
    parent.start = payload.start;
    parent.end = payload.start;
    parent.duration = payload.duration;
    parent.progress = payload.progress;
    changedTaskExternalIds.unshift(parent.externalId);
  }
  const created = task(sequence, externalId, payload.name, {
    type: payload.type,
    requestedStart: payload.start,
    start: payload.start,
    end: payload.start,
    duration: payload.duration,
    progress: payload.progress,
    parentExternalId: parent?.externalId ?? null,
    siblingOrder: fixture.tasks.filter((entry) => entry.parentExternalId === (parent?.externalId ?? null)).length,
  });
  fixture.tasks.push(created);
  fixture.createdTaskIds.push(created.taskId);
  fixture.project.revision += 1;
  return taskMutation(fixture, changedTaskExternalIds);
}

async function installStatefulProjectFixture(page: Page): Promise<StatefulProjectFixture> {
  const project: ProjectDto = {
    publicId,
    name: "Issue 3 stable Gantt fixture",
    description: "Stateful canonical snapshot fixture",
    revision: 40,
    calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
  };
  const fixture: StatefulProjectFixture = {
    initialRevision: project.revision,
    posts: [],
    patchRequests: [],
    createdTaskIds: [],
    project,
    tasks: initialTasks(),
    sessionEditable: true,
    nextPost: { kind: "success" },
  };

  await page.route("**/api/projects/**", async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === `${projectPath}/edit-sessions/current` && request.method() === "GET") {
      await route.fulfill({
        json: fixture.sessionEditable
          ? { data: { permission: "edit", expiresAt: "2099-01-01T00:00:00.000Z" } }
          : { data: { permission: "readonly" } },
      });
      return;
    }
    if (pathname === `${projectPath}/edit-sessions/current` && request.method() === "DELETE") {
      fixture.sessionEditable = false;
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (pathname === `${projectPath}/edit-sessions` && request.method() === "POST") {
      fixture.sessionEditable = true;
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (pathname === projectPath && request.method() === "GET") {
      await route.fulfill({ json: snapshot(fixture) });
      return;
    }
    if (pathname === taskPath && request.method() === "POST") {
      const payload = request.postDataJSON() as CreateTaskRequest;
      fixture.posts.push(payload);
      const outcome = fixture.nextPost;
      fixture.nextPost = { kind: "success" };
      if (outcome.kind === "network") {
        await route.abort("failed");
        return;
      }
      if (outcome.kind === "error") {
        await route.fulfill({ status: outcome.status, json: errorBody(outcome.code) });
        return;
      }
      outcome.started?.resolve();
      await outcome.gate?.promise;
      const expectedRevision = `"${fixture.project.revision}"`;
      if (request.headers()["if-match"] !== expectedRevision) {
        await route.fulfill({ status: 412, json: errorBody("REVISION_MISMATCH") });
        return;
      }
      await route.fulfill({ status: 201, json: applySuccessfulCreate(fixture, payload) });
      return;
    }
    if (pathname.startsWith(`${taskPath}/`) && request.method() === "PATCH") {
      fixture.patchRequests.push(request);
      await route.fulfill({ status: 500, json: errorBody("UNEXPECTED_PATCH") });
      return;
    }
    await route.continue();
  });
  return fixture;
}

function ganttRoot(page: Page) {
  return page.locator(".project-gantt-frame[data-project-gantt-instance]");
}

function rootAdd(page: Page) {
  return page.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first();
}

function rowNamed(page: Page, name: string) {
  return page.locator(".project-gantt-widget .wx-row", { hasText: name }).first();
}

async function rememberGanttRoot(page: Page): Promise<{ apiId: string; instanceId: string }> {
  const root = ganttRoot(page);
  await expect(root).toBeVisible();
  const instanceId = await root.getAttribute("data-project-gantt-instance");
  const apiId = await root.getAttribute("data-project-gantt-api-instance");
  expect(instanceId).toBeTruthy();
  expect(apiId).toBeTruthy();
  await root.evaluate((element) => {
    (window as typeof window & { __issue3GanttRoot?: Element }).__issue3GanttRoot = element;
  });
  return { apiId: apiId!, instanceId: instanceId! };
}

async function expectSameGanttRoot(
  page: Page,
  identity: { apiId: string; instanceId: string },
): Promise<void> {
  const root = ganttRoot(page);
  await expect(root).toHaveAttribute("data-project-gantt-instance", identity.instanceId);
  await expect(root).toHaveAttribute("data-project-gantt-api-instance", identity.apiId);
  expect(await root.evaluate((element) => (
    (window as typeof window & { __issue3GanttRoot?: Element }).__issue3GanttRoot === element
  ))).toBe(true);
}

async function waitForAnimationFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

test.describe("Issue #3 stable Gantt instance", () => {
  test.use({ viewport: { width: 1440, height: 1200 } });

  test("keeps the instance and supported UI state through a delayed add and ten sequential adds", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-16T12:00:00.000Z"));
    const fixture = await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
    await expect(rootAdd(page)).toBeVisible();

    const documentRequests: string[] = [];
    const navigations: string[] = [];
    const recordDocument = (request: Request) => {
      if (request.resourceType() === "document") documentRequests.push(request.url());
    };
    const recordNavigation = (frame: Frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    };
    page.on("request", recordDocument);
    page.on("framenavigated", recordNavigation);

    const identity = await rememberGanttRoot(page);
    const summaryRow = rowNamed(page, "Stable summary");
    const summaryToggle = summaryRow.locator('[data-action="open-task"]');
    await expect(summaryToggle).toHaveClass(/wxi-menu-down/);
    await summaryToggle.click();
    await expect(summaryToggle).toHaveClass(/wxi-menu-right/);
    await expect(page.getByRole("grid").getByText("Existing summary child", { exact: true })).toHaveCount(0);

    const selectedRow = rowNamed(page, "Stable leaf");
    await selectedRow.getByText("Stable leaf", { exact: true }).click();
    await expect(selectedRow).toHaveClass(/wx-selected/);

    const gridHeader = page.locator(".project-gantt-widget .wx-table-container .wx-header").first();
    await gridHeader.click({ button: "right" });
    const columnMenu = page.locator(".project-column-menu");
    await expect(columnMenu).toBeVisible();
    await columnMenu.getByRole("checkbox", { name: "외부 ID", exact: true }).check();
    await columnMenu.getByRole("checkbox", { name: "기간", exact: true }).uncheck();
    await page.keyboard.press("Escape");
    await expect(gridHeader.getByText("외부 ID", { exact: true })).toBeVisible();
    await expect(gridHeader.getByText("기간", { exact: true })).toHaveCount(0);

    const taskHeaderCell = gridHeader.getByText("작업", { exact: true }).locator("..");
    const widthBeforeResize = (await taskHeaderCell.boundingBox())!.width;
    const gripBox = await taskHeaderCell.locator(".wx-grip").boundingBox();
    if (!gripBox) throw new Error("Expected the task column resize grip.");
    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(gripBox.x + gripBox.width / 2 + 48, gripBox.y + gripBox.height / 2, { steps: 6 });
    await page.mouse.up();
    const resizedTaskWidth = (await taskHeaderCell.boundingBox())!.width;
    expect(resizedTaskWidth).toBeGreaterThan(widthBeforeResize + 20);

    const chart = page.locator(".project-gantt-widget .wx-chart").first();
    expect(await chart.evaluate((element) => element.scrollWidth)).toBeGreaterThan(
      await chart.evaluate((element) => element.clientWidth),
    );
    await chart.evaluate((element) => { element.scrollLeft = 240; });
    await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const chartScrollLeft = await chart.evaluate((element) => element.scrollLeft);
    const pageScrollTop = await page.evaluate(() => window.scrollY);
    const gridBoxBeforePending = await page.locator(".project-gantt-widget .wx-table-container").boundingBox();
    expect(gridBoxBeforePending).not.toBeNull();

    const gate = deferred();
    const started = deferred();
    fixture.nextPost = { kind: "success", gate, started };
    await rootAdd(page).click();
    await started.promise;

    await expect(page.locator(".project-schedule .schedule-saving[role=status]")).toContainText("일정 저장 중");
    await expect(page.locator('.project-schedule[aria-busy="true"]')).toBeVisible();
    await expect(ganttRoot(page)).toHaveAttribute("data-task-mutation-locked", "true");
    await expect(rootAdd(page)).toBeVisible();
    await expect(rootAdd(page)).toHaveAttribute("aria-disabled", "true");
    expect(await rootAdd(page).evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
    await expect(page.locator(".loading-state")).toHaveCount(0);
    await expect(page.locator(".project-gantt-widget .wx-chart")).toBeVisible();
    await expectSameGanttRoot(page, identity);
    const gridBoxWhilePending = await page.locator(".project-gantt-widget .wx-table-container").boundingBox();
    expect(gridBoxWhilePending).not.toBeNull();
    expect(gridBoxWhilePending!.width).toBeCloseTo(gridBoxBeforePending!.width, 0);

    // Programmatic dispatch bypasses pointer styling and verifies the synchronous
    // mutation lock at the same gateway used by the native Grid action.
    await rootAdd(page).dispatchEvent("click");
    await waitForAnimationFrame(page);
    expect(fixture.posts).toHaveLength(1);
    await expect(page.locator(".project-schedule .schedule-saving[role=status]")).toContainText("일정 저장 중");
    await expect(page.locator(".form-status")).toHaveCount(0);
    gate.resolve();

    await expect(page.getByRole("status")).toContainText("작업을 추가했습니다");
    await expect(ganttRoot(page)).not.toHaveAttribute("data-task-mutation-locked", "true");
    await expect(rootAdd(page)).toHaveAttribute("aria-disabled", "false");
    expect(fixture.createdTaskIds).toHaveLength(1);
    const firstCreatedTaskId = fixture.createdTaskIds[0];
    await expect(page.getByRole("grid").getByText("새 작업", { exact: true })).toHaveCount(1);
    await expect(page.locator(`.wx-bar[data-task-id=":${firstCreatedTaskId}"]`)).toHaveCount(1);
    await expectSameGanttRoot(page, identity);

    await expect(selectedRow).toHaveClass(/wx-selected/);
    await expect(summaryToggle).toHaveClass(/wxi-menu-right/);
    await expect(page.getByRole("grid").getByText("Existing summary child", { exact: true })).toHaveCount(0);
    await expect(gridHeader.getByText("외부 ID", { exact: true })).toBeVisible();
    await expect(gridHeader.getByText("기간", { exact: true })).toHaveCount(0);
    expect((await taskHeaderCell.boundingBox())!.width).toBeCloseTo(resizedTaskWidth, 0);
    expect(await chart.evaluate((element) => element.scrollLeft)).toBeCloseTo(chartScrollLeft, 0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollTop);

    for (let index = 1; index < 10; index += 1) {
      const responsePromise = page.waitForResponse((response) => (
        response.request().method() === "POST" && new URL(response.url()).pathname === taskPath
      ));
      await rootAdd(page).click();
      expect((await responsePromise).status()).toBe(201);
      await expect.poll(() => fixture.createdTaskIds.length).toBe(index + 1);
      const createdTaskId = fixture.createdTaskIds[index];
      await expect(page.locator(`.wx-bar[data-task-id=":${createdTaskId}"]`)).toHaveCount(1);
      await expectSameGanttRoot(page, identity);
    }

    expect(fixture.posts).toHaveLength(10);
    expect(fixture.patchRequests).toHaveLength(0);
    expect(fixture.project.revision).toBe(fixture.initialRevision + 10);
    await expect(page.getByRole("grid").getByText("새 작업", { exact: true })).toHaveCount(10);
    await expect(selectedRow).toHaveClass(/wx-selected/);
    await expect(summaryToggle).toHaveClass(/wxi-menu-right/);
    await expect(gridHeader.getByText("외부 ID", { exact: true })).toBeVisible();
    await expect(gridHeader.getByText("기간", { exact: true })).toHaveCount(0);
    expect((await taskHeaderCell.boundingBox())!.width).toBeCloseTo(resizedTaskWidth, 0);
    expect(await chart.evaluate((element) => element.scrollLeft)).toBeCloseTo(chartScrollLeft, 0);

    await waitForAnimationFrame(page);
    expect(documentRequests).toEqual([]);
    expect(navigations).toEqual([]);
    page.off("request", recordDocument);
    page.off("framenavigated", recordNavigation);

    // An explicit user reload is outside the stable-instance interval and
    // independently proves that the fixture's canonical server state is used.
    const persistedTaskIds = [...fixture.createdTaskIds];
    await page.reload();
    await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
    await expect(page.getByRole("grid").getByText("새 작업", { exact: true })).toHaveCount(10);
    for (const taskId of persistedTaskIds) {
      await expect(page.locator(`.wx-bar[data-task-id=":${taskId}"]`)).toHaveCount(1);
    }
  });

  test("keeps child confirmation and all protected rejection paths free of ghost tasks", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-16T12:00:00.000Z"));
    const fixture = await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
    const initialIdentity = await rememberGanttRoot(page);
    const documentRequests: string[] = [];
    const navigations: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") documentRequests.push(request.url());
    });
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });

    const leafRow = rowNamed(page, "Stable leaf");
    await leafRow.locator('[data-action="add-task"]').click();
    const conversionDialog = page.getByRole("dialog", { name: "부모 작업을 요약 작업으로 전환할까요?" });
    await expect(conversionDialog).toBeVisible();
    await conversionDialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(conversionDialog).toBeHidden();
    expect(fixture.posts).toHaveLength(0);
    await expectSameGanttRoot(page, initialIdentity);

    await leafRow.locator('[data-action="add-task"]').click();
    await conversionDialog.getByLabel("부모 작업을 요약 작업으로 전환하는 데 동의합니다.").check();
    const firstChildResponse = page.waitForResponse((response) => (
      response.request().method() === "POST" && new URL(response.url()).pathname === taskPath
    ));
    await conversionDialog.getByRole("button", { name: "전환하고 하위 작업 추가" }).click();
    expect((await firstChildResponse).status()).toBe(201);
    await expect(conversionDialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText("작업을 추가했습니다");
    expect(fixture.posts).toHaveLength(1);
    expect(fixture.posts[0]).toMatchObject({
      parentTaskId: "00000000-0000-4000-8000-000000000003",
      convertParentToSummary: true,
    });
    expect(fixture.tasks.find((entry) => entry.externalId === "LEAF-1")?.type).toBe("summary");
    const firstChildId = fixture.createdTaskIds[0];
    await expect(page.locator(`.wx-bar[data-task-id=":${firstChildId}"]`)).toHaveCount(1);
    await expectSameGanttRoot(page, initialIdentity);

    const convertedSummaryRow = rowNamed(page, "Stable leaf");
    const secondChildResponse = page.waitForResponse((response) => (
      response.request().method() === "POST" && new URL(response.url()).pathname === taskPath
    ));
    await convertedSummaryRow.locator('[data-action="add-task"]').click();
    expect((await secondChildResponse).status()).toBe(201);
    await expect(conversionDialog).toBeHidden();
    expect(fixture.posts).toHaveLength(2);
    expect(fixture.posts[1]).toMatchObject({
      parentTaskId: "00000000-0000-4000-8000-000000000003",
    });
    expect(fixture.posts[1]).not.toHaveProperty("convertParentToSummary");
    await expectSameGanttRoot(page, initialIdentity);

    // Readonly/edit transitions must keep the latest canonical task state;
    // toggling the Gantt readonly prop must not resurrect initial mount data.
    await page.locator(".edit-panels > summary").click();
    await page.getByRole("button", { name: "편집 모드 종료" }).click();
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(rootAdd(page)).toHaveCount(0);
    await expect(page.getByRole("grid").getByText("새 작업", { exact: true })).toHaveCount(2);
    for (const taskId of fixture.createdTaskIds) {
      await expect(page.locator(`.wx-bar[data-task-id=":${taskId}"]`)).toHaveCount(1);
    }
    await expectSameGanttRoot(page, initialIdentity);

    await page.getByLabel("편집 비밀번호").fill("issue-3-password");
    await page.getByRole("button", { name: "편집 잠금 해제" }).click();
    await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
    await expect(rootAdd(page)).toBeVisible();
    await expect(page.getByRole("grid").getByText("새 작업", { exact: true })).toHaveCount(2);
    await expectSameGanttRoot(page, initialIdentity);

    const milestoneRow = rowNamed(page, "Stable milestone");
    await milestoneRow.locator('[data-action="add-task"]').click();
    await expect(page.getByRole("status")).toContainText("마일스톤에는 하위 작업을 추가할 수 없습니다");
    expect(fixture.posts).toHaveLength(2);

    async function rejectNextAdd(
      outcome: PostOutcome,
      expectedNotice: string,
      trigger = rootAdd(page),
    ): Promise<void> {
      const taskCount = fixture.tasks.length;
      const postCount = fixture.posts.length;
      fixture.nextPost = outcome;
      await trigger.click();
      await expect(page.getByRole("status")).toContainText(expectedNotice);
      expect(fixture.posts).toHaveLength(postCount + 1);
      expect(fixture.tasks).toHaveLength(taskCount);
      expect(fixture.createdTaskIds).toHaveLength(2);
      await expect(page.getByRole("grid").getByText("새 작업", { exact: true })).toHaveCount(2);
      expect(fixture.patchRequests).toHaveLength(0);
    }

    // A server-side parent race is distinct from the client milestone guard.
    await rejectNextAdd(
      { kind: "error", status: 422, code: "INVALID_PARENT_TASK" },
      "마일스톤에는 하위 작업을 추가할 수 없습니다",
      rowNamed(page, "Stable summary").locator('[data-action="add-task"]'),
    );
    await rejectNextAdd(
      { kind: "error", status: 412, code: "REVISION_MISMATCH" },
      "다른 편집 내용이 먼저 저장되었습니다",
    );
    await rejectNextAdd(
      { kind: "error", status: 500, code: "INTERNAL_ERROR" },
      "작업을 저장할 수 없습니다",
    );
    await rejectNextAdd(
      { kind: "network" },
      "네트워크 연결을 확인한 뒤 다시 시도해 주세요",
    );

    await rejectNextAdd(
      { kind: "error", status: 401, code: "EDIT_SESSION_INVALID" },
      "편집 권한이 만료되었습니다",
    );
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(rootAdd(page)).toHaveCount(0);
    expect(documentRequests).toEqual([]);
    expect(navigations).toEqual([]);
  });
});
