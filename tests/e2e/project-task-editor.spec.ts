import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page, type Request } from "@playwright/test";
import type { ProjectDto, ProjectLinkDto, ProjectTaskDto, UpdateTaskRequest } from "../../src/contracts/projects";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";
import { scheduleLeaf } from "../../src/domain/scheduling/leaf";
import { normalizeTaskStatusProgress, taskStatusFromProgress } from "../../src/domain/task-status";
import { chooseTaskInformation, taskContextMenu } from "./helpers/task-context-menu";

const publicId = "a3405d3d-8cb4-4da4-9b0f-43a5de330004";
const apiPath = `/api/projects/${publicId}`;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (page: Page, name: string) => page.locator(".project-gantt-widget .wx-row", { hasText: name }).first();
const bar = (page: Page, taskId: string) => page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${taskId}"]`);
const rowByTaskId = (page: Page, taskId: string) => page.locator(`.project-gantt-widget .wx-table-container .wx-row[data-id=":${taskId}"]`).first();
const editor = (page: Page) => page.getByRole("dialog", { name: "작업 정보", exact: true });
const relationEditor = (page: Page) => page.getByRole("dialog", { name: "작업 관계 관리 (Relation Editor)", exact: true });
const save = (page: Page) => editor(page).getByRole("button", { name: "저장", exact: true });
const frame = (page: Page) => page.locator(".project-gantt-frame");

function task(n: number, name: string, extra: Partial<ProjectTaskDto> = {}): ProjectTaskDto {
  return { taskId: id(n), externalId: `EDITOR-${n}`, name, type: "task", scheduleMode: "auto", requestedStart: "2026-09-18", start: "2026-09-18", end: "2026-09-18", duration: 1, progress: 10, status: "in_progress", parentExternalId: null, siblingOrder: n, ...extra };
}

interface Fixture {
  project: ProjectDto;
  tasks: ProjectTaskDto[];
  links: ProjectLinkDto[];
  editable: boolean;
  patches: Request[];
  linkMutations: Request[];
  assignmentMutations: Request[];
  nextFailure: number | "network" | null;
  gate: Promise<void> | null;
  failReads: boolean;
  projectReads: number;
}

async function setup(page: Page, options: { editable?: boolean; links?: boolean; assignmentTargets?: boolean } = {}): Promise<Fixture> {
  await page.clock.setFixedTime(new Date("2026-09-16T12:00:00Z"));
  const fixture: Fixture = {
    project: { publicId, name: "Task Editor fixture", description: "Issue #4", status: "planned", revision: 20, calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-09-21", name: "Fixture holiday" }] } },
    tasks: [
      task(1, "Summary", { type: "summary", requestedStart: null }),
      task(2, "Child", { parentExternalId: "EDITOR-1" }),
      task(3, "Alpha leaf", { requestedStart: "2026-09-16", start: "2026-09-16", end: "2026-09-16" }),
      task(4, "Beta leaf"),
      task(5, "Milestone", { type: "milestone", duration: 0, requestedStart: "2026-09-23", start: "2026-09-23", end: "2026-09-23" }),
    ],
    links: options.links ? [{ id: id(90), predecessorExternalId: "EDITOR-3", successorExternalId: "EDITOR-4", type: "FS", lag: 0 }] : [],
    editable: options.editable ?? true, patches: [], linkMutations: [], assignmentMutations: [], nextFailure: null, gate: null, failReads: false, projectReads: 0,
  };
  const assignmentTargets = options.assignmentTargets ? [
    { kind: "resource" as const, id: id(70), name: "Resource A", code: "RES-A", active: true, roles: ["PI", "DEVELOPER"] as const },
    { kind: "resource" as const, id: id(71), name: "Resource B", code: "RES-B", active: true, roles: ["EQUIPMENT_OWNER"] as const },
  ] : [];
  const snapshot = () => ({ data: { project: fixture.project, tasks: fixture.tasks, links: fixture.links, permission: "readonly" } });
  await page.route("**/api/projects/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === `${apiPath}/edit-sessions/current` && request.method() === "GET") {
      await route.fulfill({ json: { data: fixture.editable ? { permission: "edit", expiresAt: "2099-01-01T00:00:00Z" } : { permission: "readonly" } } });
      return;
    }
    if (path === `${apiPath}/assigned-targets` && request.method() === "GET") {
      await route.fulfill({ json: { data: { projectRevision: fixture.project.revision, catalogRevision: 1, assignments: [], targets: assignmentTargets } } });
      return;
    }
    if (path === `${apiPath}/assignment-targets` && request.method() === "GET") {
      await route.fulfill({ json: { data: { catalogRevision: 1, targets: assignmentTargets } } });
      return;
    }
    if (path.startsWith(`${apiPath}/tasks/`) && path.endsWith("/assignments") && request.method() === "PUT") {
      fixture.assignmentMutations.push(request);
      if (request.headers()["if-match"] !== `"${fixture.project.revision}"`) {
        await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH" } } });
        return;
      }
      fixture.project.revision += 1;
      await route.fulfill({
        json: { data: { projectRevision: fixture.project.revision, catalogRevision: 1, assignments: [], operation: { kind: "taskAssignments", taskId: path.split("/").at(-2), changed: true } } },
      });
      return;
    }
    if (path === apiPath && request.method() === "GET") {
      fixture.projectReads += 1;
      await route.fulfill(fixture.failReads ? { status: 500, json: { error: { code: "READ_FAILED" } } } : { json: snapshot() });
      return;
    }
    if (path.startsWith(`${apiPath}/tasks/`) && request.method() === "PATCH") {
      fixture.patches.push(request);
      if (fixture.gate) await fixture.gate;
      const failure = fixture.nextFailure;
      fixture.nextFailure = null;
      if (failure === "network") { await route.abort("failed"); return; }
      if (failure) {
        if (failure === 401) fixture.editable = false;
        if (failure === 412) {
          fixture.project.revision += 1;
          fixture.tasks.find((entry) => entry.taskId === id(4))!.name = "Server changed";
        }
        await route.fulfill({ status: failure, json: { error: { code: failure === 412 ? "REVISION_MISMATCH" : "INVALID_FIELD", message: "Fixture rejection." } } });
        return;
      }
      if (request.headers()["if-match"] !== `"${fixture.project.revision}"`) {
        await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH" } } });
        return;
      }
      const entry = fixture.tasks.find((candidate) => candidate.taskId === path.split("/").at(-1));
      if (!entry || entry.type === "summary") { await route.fulfill({ status: 422, json: { error: { code: "INVALID_TASK" } } }); return; }
      const patch = request.postDataJSON() as UpdateTaskRequest;
      try {
        const calculated = scheduleLeaf({ type: entry.type, requestedStart: patch.start ?? entry.requestedStart ?? entry.start!, duration: patch.duration ?? entry.duration!, scheduleMode: patch.scheduleMode ?? entry.scheduleMode }, createWorkingCalendar(fixture.project.calendar));
        const normalizedStatus = normalizeTaskStatusProgress({
          currentStatus: entry.status ?? taskStatusFromProgress(entry.progress),
          currentProgress: entry.progress ?? 0,
          status: patch.status,
          progress: patch.progress,
        });
        Object.assign(entry, {
          name: patch.name ?? entry.name,
          progress: normalizedStatus.progress,
          status: normalizedStatus.status,
          start: calculated.start,
          end: calculated.end,
          duration: calculated.duration,
          requestedStart: calculated.requestedStart,
          ...(patch.baselineStart !== undefined ? { baselineStart: patch.baselineStart } : {}),
          ...(patch.baselineDuration !== undefined ? { baselineDuration: patch.baselineDuration } : {}),
          ...(patch.baselineEnd !== undefined ? { baselineEnd: patch.baselineEnd } : {}),
        });
        fixture.project.revision += 1;
        await route.fulfill({ json: { data: { ...snapshot().data,
          warnings: calculated.warnings.map((warning) => ({ code: warning.code, path: "start", requestedStart: warning.requestedStart, start: warning.start })),
          operation: { kind: "taskUpdate", changedTaskExternalIds: [entry.externalId], deletedTaskExternalIds: [], deletedLinkIds: [] },
        } } });
      } catch {
        await route.fulfill({ status: 422, json: { error: { code: "INVALID_FIELD" } } });
      }
      return;
    }
    if (path === `${apiPath}/links` && request.method() === "POST") {
      fixture.linkMutations.push(request);
      if (request.headers()["if-match"] !== `"${fixture.project.revision}"`) {
        await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH" } } });
        return;
      }
      const payload = request.postDataJSON() as {
        predecessorExternalId: string;
        successorExternalId: string;
        type: ProjectLinkDto["type"];
        lag: number;
      };
      fixture.links.push({
        id: id(100 + fixture.links.length),
        predecessorExternalId: payload.predecessorExternalId,
        successorExternalId: payload.successorExternalId,
        type: payload.type,
        lag: payload.lag,
      });
      fixture.project.revision += 1;
      await route.fulfill({ status: 201, json: { data: { ...snapshot().data, warnings: [], operation: { kind: "linkCreate" } } } });
      return;
    }
    if (path.startsWith(`${apiPath}/links/`) && (request.method() === "PATCH" || request.method() === "DELETE")) {
      fixture.linkMutations.push(request);
      if (request.headers()["if-match"] !== `"${fixture.project.revision}"`) {
        await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH" } } });
        return;
      }
      const linkId = path.split("/").at(-1);
      const index = fixture.links.findIndex((entry) => entry.id === linkId);
      if (index < 0) {
        await route.fulfill({ status: 404, json: { error: { code: "LINK_NOT_FOUND" } } });
        return;
      }
      if (request.method() === "PATCH") {
        const patch = request.postDataJSON() as Partial<Pick<ProjectLinkDto, "type" | "lag">>;
        fixture.links[index] = { ...fixture.links[index], ...patch };
      } else {
        fixture.links.splice(index, 1);
      }
      fixture.project.revision += 1;
      await route.fulfill({ json: { data: { ...snapshot().data, warnings: [], operation: { kind: request.method() === "PATCH" ? "linkUpdate" : "linkDelete" } } } });
      return;
    }
    await route.continue();
  });
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText(fixture.editable ? "편집 중" : "읽기 전용", { exact: true })).toBeVisible();
  await expect(row(page, "Beta leaf")).toBeVisible();
  await expect(frame(page)).toHaveAttribute("data-project-gantt-api-instance", /svar-api-/);
  return fixture;
}

async function openRow(page: Page, name = "Beta leaf") {
  const targetRow = name === "Beta leaf" ? rowByTaskId(page, id(4)) : name === "Summary" ? rowByTaskId(page, id(1)) : row(page, name);
  if (name === "Beta leaf" || name === "Summary") {
    await expect(targetRow).toBeVisible();
    await targetRow.click({ button: "right", position: { x: 12, y: 19 } });
  } else {
    await targetRow.getByText(name, { exact: true }).click({ button: "right" });
  }
  await chooseTaskInformation(page);
  await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue(name);
  await expect(editor(page)).toHaveCount(1);
}

async function cancel(page: Page) {
  await editor(page).getByRole("button", { name: "취소", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
}

async function menuInvariantScrollState(page: Page) {
  return page.evaluate(() => {
    const position = (selector: string) => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
      if (elements.length !== 1) throw new Error(`Expected one stable scroll target for ${selector}, found ${elements.length}.`);
      return { left: elements[0].scrollLeft, top: elements[0].scrollTop };
    };
    return {
      window: { left: window.scrollX, top: window.scrollY },
      workspace: position(".project-gantt-scroll"),
      grid: position(".project-gantt-widget .wx-table-container"),
      chart: position(".project-gantt-widget .wx-chart"),
    };
  });
}

test.describe("Issue #4/#22 작업 메뉴와 보호된 편집기", () => {
  test.use({ viewport: { width: 1440, height: 1100 } });

  test("resolves Grid and Chart targets instead of selection and preserves header/empty-area behavior", async ({ page }) => {
    const fixture = await setup(page);
    const instance = await frame(page).getAttribute("data-project-gantt-instance");
    const documentRequests: Request[] = [];
    page.on("request", (request) => { if (request.resourceType() === "document") documentRequests.push(request); });
    await row(page, "Alpha leaf").getByText("Alpha leaf", { exact: true }).click();
    await openRow(page);
    await cancel(page);
    await expect(row(page, "Beta leaf")).toBeFocused();
    await bar(page, id(4)).click({ button: "right" });
    await chooseTaskInformation(page);
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Beta leaf");
    await cancel(page);
    const header = page.locator(".project-gantt-widget .wx-table-container .wx-header").first();
    await header.getByText("작업", { exact: true }).click();
    await openRow(page, "Alpha leaf");
    await cancel(page);
    await row(page, "Summary").locator('[data-action="open-task"]').click();
    await openRow(page, "Summary");
    await expect(save(page)).toHaveCount(1);
    await expect(editor(page).getByLabel("작업명", { exact: true })).not.toHaveAttribute("readonly", "");
    await expect(editor(page).getByLabel("요청 시작일", { exact: true })).toHaveAttribute("readonly", "");
    await expect(editor(page).getByText("하위 작업 기본 완료 단계", { exact: true })).toBeVisible();
    await cancel(page);
    await header.click({ button: "right" });
    await expect(page.locator(".project-column-menu")).toBeVisible();
    await expect(taskContextMenu(page)).toHaveCount(0);
    await expect(editor(page)).toHaveCount(0);
    await page.locator(".project-column-menu").getByRole("checkbox", { name: "외부 ID", exact: true }).check();
    await page.keyboard.press("Escape");
    await expect(header.getByText("외부 ID", { exact: true })).toBeVisible();
    await header.focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.locator(".project-column-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    const prevented = await page.locator(".project-gantt-widget .wx-chart").first().evaluate((element) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(taskContextMenu(page)).toHaveCount(0);
    await expect(editor(page)).toHaveCount(0);
    for (let i = 0; i < 3; i += 1) { await openRow(page); await cancel(page); }
    await expect(frame(page)).toHaveAttribute("data-project-gantt-instance", instance!);
    expect(fixture.patches).toHaveLength(0);
    expect(documentRequests).toHaveLength(0);
  });

  test("supports keyboard entry, dirty-close confirmation, single editor and input context menus", async ({ page }) => {
    const fixture = await setup(page);
    await row(page, "Beta leaf").focus();
    await page.keyboard.press("Shift+F10");
    await chooseTaskInformation(page, true);
    const name = editor(page).getByLabel("작업명", { exact: true });
    await name.fill("Unsaved draft");
    await name.click({ button: "right" });
    await expect(editor(page)).toHaveCount(1);
    await page.keyboard.press("Escape");
    // A browser context menu may consume Escape; cancel uses the same guarded close.
    if (!(await editor(page).getByRole("button", { name: "계속 편집" }).isVisible())) {
      await editor(page).getByRole("button", { name: "취소", exact: true }).click();
    }
    await expect(editor(page)).toContainText("변경사항을 버리고 닫을까요");
    await editor(page).getByRole("button", { name: "계속 편집" }).click();
    await row(page, "Alpha leaf").dispatchEvent("contextmenu");
    await expect(name).toHaveValue("Unsaved draft");
    await expect(editor(page)).toHaveCount(1);
    await editor(page).getByRole("button", { name: "취소", exact: true }).click();
    await editor(page).getByRole("button", { name: "변경사항 버리고 닫기" }).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches).toHaveLength(0);
    await openRow(page);
    await expect(name).toHaveValue("Beta leaf");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches).toHaveLength(0);
  });

  test("메뉴 열기·취소·대상 전환은 저장·이동·Gantt 재생성을 일으키지 않는다", async ({ page }) => {
    const fixture = await setup(page);
    const instance = await frame(page).getAttribute("data-project-gantt-instance");
    const apiInstance = await frame(page).getAttribute("data-project-gantt-api-instance");
    const mutations: Request[] = [];
    const navigations: Request[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") navigations.push(request);
      if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method()) && new URL(request.url()).pathname.startsWith(apiPath)) mutations.push(request);
    });
    const before = await menuInvariantScrollState(page);
    const geometry = await frame(page).boundingBox();
    await row(page, "Beta leaf").getByText("Beta leaf", { exact: true }).click({ button: "right" });
    await expect(taskContextMenu(page)).toBeVisible();
    await expect(editor(page)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(taskContextMenu(page)).toHaveCount(0);
    await expect(row(page, "Beta leaf")).toBeFocused();
    await bar(page, id(4)).focus();
    await page.keyboard.press("ContextMenu");
    await expect(taskContextMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(bar(page, id(4))).toBeFocused();
    await row(page, "Beta leaf").getByText("Beta leaf", { exact: true }).click({ button: "right" });
    await expect(taskContextMenu(page)).toBeVisible();
    await row(page, "Alpha leaf").getByText("Alpha leaf", { exact: true }).click({ button: "right" });
    await chooseTaskInformation(page);
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Alpha leaf");
    await cancel(page);
    await row(page, "Beta leaf").getByText("Beta leaf", { exact: true }).click({ button: "right" });
    await expect(taskContextMenu(page)).toBeVisible();
    const header = page.locator(".project-gantt-widget .wx-table-container .wx-header").first();
    await header.click({ button: "right" });
    await expect(page.locator(".project-column-menu")).toBeVisible();
    await expect(taskContextMenu(page)).toHaveCount(0);
    await row(page, "Beta leaf").getByText("Beta leaf", { exact: true }).click({ button: "right" });
    await expect(taskContextMenu(page)).toBeVisible();
    await expect(page.locator(".project-column-menu")).toHaveCount(0);
    await page.locator(".project-gantt-widget .wx-scale").first().click();
    await expect(taskContextMenu(page)).toHaveCount(0);
    await expect(editor(page)).toHaveCount(0);
    expect(await menuInvariantScrollState(page)).toEqual(before);
    expect(await frame(page).boundingBox()).toEqual(geometry);
    await expect(frame(page)).toHaveAttribute("data-project-gantt-instance", instance!);
    await expect(frame(page)).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
    expect(fixture.patches).toHaveLength(0);
    expect(mutations).toHaveLength(0);
    expect(navigations).toHaveLength(0);
  });

  for (const viewport of [{ width: 1440, height: 1100 }, { width: 360, height: 800 }]) {
    test(`${viewport.width}px 메뉴 위치는 네 모서리에서도 viewport 안에 머문다`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const fixture = await setup(page);
      for (const [clientX, clientY] of [[0, 0], [viewport.width - 1, 0], [0, viewport.height - 1], [viewport.width - 1, viewport.height - 1]]) {
        // 실제 우클릭과 분리한 경계 배치 테스트: 기존 task 대상에 가장자리 좌표를 전달한다.
        await row(page, "Beta leaf").dispatchEvent("contextmenu", { clientX, clientY });
        const menu = taskContextMenu(page);
        await expect(menu).toBeVisible();
        await expect(editor(page)).toHaveCount(0);
        const bounds = await menu.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(7);
        expect(bounds!.y).toBeGreaterThanOrEqual(7);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 7);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 7);
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
      }
      expect(fixture.patches).toHaveLength(0);
    });
  }

  test("sends one explicit PATCH and uses canonical working-day results across weekends and holidays", async ({ page }) => {
    const fixture = await setup(page);
    const instance = await frame(page).getAttribute("data-project-gantt-instance");
    await openRow(page);
    await expect(editor(page).getByLabel("요청 종료일", { exact: true })).toHaveValue("2026-09-18");
    await editor(page).getByLabel("기간 (근무일)", { exact: true }).fill("2");
    await expect(editor(page).getByLabel("요청 종료일", { exact: true })).toHaveValue("2026-09-22");
    await expect(editor(page).getByLabel("적용 시작일", { exact: true })).toHaveText("2026-09-18");
    expect(fixture.patches).toHaveLength(0);
    let release!: () => void;
    fixture.gate = new Promise<void>((resolve) => { release = resolve; });
    try {
      await save(page).click();
      await expect.poll(() => fixture.patches.length).toBe(1);
      await editor(page).locator("form").dispatchEvent("submit");
      await expect(editor(page).getByLabel("작업명", { exact: true })).toBeDisabled();
      await expect(frame(page)).toHaveAttribute("data-project-gantt-instance", instance!);
      expect(fixture.patches).toHaveLength(1);
    } finally { release(); fixture.gate = null; }
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches[0].postDataJSON()).toEqual({ duration: 2 });
    expect(fixture.patches[0].headers()["if-match"]).toBe('"20"');
    expect(fixture.tasks.find((entry) => entry.taskId === id(4))).toMatchObject({ start: "2026-09-18", end: "2026-09-22", duration: 2 });
    await openRow(page);
    await editor(page).getByLabel("요청 시작일", { exact: true }).fill("2026-09-19");
    await expect(editor(page).getByLabel("요청 종료일", { exact: true })).toHaveValue("2026-09-23");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches[1].postDataJSON()).toEqual({ start: "2026-09-19" });
    expect(fixture.tasks.find((entry) => entry.taskId === id(4))).toMatchObject({ requestedStart: "2026-09-19", start: "2026-09-22", end: "2026-09-23", duration: 2 });
    await expect(page.getByTestId("workspace-toast")).toContainText("비근무일 시작");
    await openRow(page);
    await editor(page).getByLabel("작업명", { exact: true }).fill("Edited together");
    await editor(page).getByLabel("요청 시작일", { exact: true }).fill("2026-09-18");
    await editor(page).getByLabel("기간 (근무일)", { exact: true }).fill("3");
    await editor(page).getByLabel("진행률 (%)", { exact: true }).fill("36");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches[2].postDataJSON()).toEqual({ name: "Edited together", start: "2026-09-18", duration: 3, progress: 36 });
    await expect(row(page, "Edited together")).toBeVisible();
    await expect(frame(page)).toHaveAttribute("data-project-gantt-instance", instance!);
  });

  test("Issue #368 requested end recalculates duration and stays out of the PATCH payload", async ({ page }) => {
    const fixture = await setup(page);
    await openRow(page);
    const requestedEnd = editor(page).getByLabel("요청 종료일", { exact: true });
    const duration = editor(page).getByLabel("기간 (근무일)", { exact: true });

    await expect(requestedEnd).toHaveValue("2026-09-18");
    await requestedEnd.fill("2026-09-24");
    await expect(duration).toHaveValue("4");

    await editor(page).getByLabel("요청 시작일", { exact: true }).fill("2026-09-17");
    await expect(requestedEnd).toHaveValue("2026-09-24");
    await expect(duration).toHaveValue("5");

    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches).toHaveLength(1);
    expect(fixture.patches[0].postDataJSON()).toEqual({ start: "2026-09-17", duration: 5 });
    expect(fixture.patches[0].postDataJSON()).not.toHaveProperty("end");
    expect(fixture.patches[0].postDataJSON()).not.toHaveProperty("requestedEnd");
    expect(fixture.tasks.find((entry) => entry.taskId === id(4))).toMatchObject({
      requestedStart: "2026-09-17",
      start: "2026-09-17",
      end: "2026-09-24",
      duration: 5,
    });
  });

  test("Issue #368 rejects a non-working requested end before mutation", async ({ page }) => {
    const fixture = await setup(page);
    await openRow(page);
    const requestedEnd = editor(page).getByLabel("요청 종료일", { exact: true });
    await requestedEnd.fill("2026-09-21");
    await expect(requestedEnd).toHaveAttribute("aria-invalid", "true");
    await expect(editor(page)).toContainText("요청 종료일은 현재 프로젝트 캘린더의 근무일이어야 합니다.");
    await expect(editor(page).getByLabel("기간 (근무일)", { exact: true })).toHaveValue("");
    await save(page).click();
    expect(fixture.patches).toHaveLength(0);
    await expect(editor(page)).toContainText("일정 입력을 확인해 주세요.");

    await requestedEnd.fill("2026-09-22");
    await expect(requestedEnd).not.toHaveAttribute("aria-invalid", "true");
    await expect(editor(page).getByLabel("기간 (근무일)", { exact: true })).toHaveValue("2");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches[0].postDataJSON()).toEqual({ duration: 2 });
  });

  test("synchronizes status with progress and toggles completed task-name strike-through", async ({ page }) => {
    const fixture = await setup(page);
    const instance = await frame(page).getAttribute("data-project-gantt-instance");

    await openRow(page);
    const status = editor(page).getByLabel("상태", { exact: true });
    const progress = editor(page).getByLabel("진행률 (%)", { exact: true });
    await expect(status).toHaveValue("in_progress");
    await progress.fill("100");
    await expect(status).toHaveValue("completed");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches.at(-1)?.postDataJSON()).toEqual({ progress: 100, status: "completed" });
    await expect(rowByTaskId(page, id(4))).toHaveAttribute("data-task-completed", "true");
    expect(await rowByTaskId(page, id(4)).getByText("Beta leaf", { exact: true }).evaluate((element) => getComputedStyle(element).textDecorationLine))
      .toContain("line-through");

    await openRow(page);
    await editor(page).getByLabel("상태", { exact: true }).selectOption("not_started");
    await expect(editor(page).getByLabel("진행률 (%)", { exact: true })).toHaveValue("0");
    await save(page).click();
    expect(fixture.patches.at(-1)?.postDataJSON()).toEqual({ progress: 0, status: "not_started" });
    await expect(rowByTaskId(page, id(4))).toHaveAttribute("data-task-completed", "false");

    await openRow(page);
    await editor(page).getByLabel("상태", { exact: true }).selectOption("completed");
    await expect(editor(page).getByLabel("진행률 (%)", { exact: true })).toHaveValue("100");
    await save(page).click();
    expect(fixture.patches.at(-1)?.postDataJSON()).toEqual({ progress: 100, status: "completed" });
    await expect(frame(page)).toHaveAttribute("data-project-gantt-instance", instance!);
  });

  for (const failure of [422, 500, "network"] as const) {
    test(`preserves the draft through ${failure} and permits an explicit retry`, async ({ page }) => {
      const fixture = await setup(page);
      await openRow(page);
      await editor(page).getByLabel("작업명", { exact: true }).fill("Retry draft");
      fixture.nextFailure = failure;
      await save(page).click();
      await expect(editor(page).getByRole("alert")).toBeVisible();
      await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Retry draft");
      await expect(save(page)).toBeEnabled();
      expect(fixture.patches).toHaveLength(1);
      expect(fixture.tasks.find((entry) => entry.taskId === id(4))?.name).toBe("Beta leaf");
      await save(page).click();
      await expect(editor(page)).toHaveCount(0);
      expect(fixture.patches).toHaveLength(2);
      await expect(row(page, "Retry draft")).toBeVisible();
    });
  }

  test("preserves an expired-session draft while removing save access", async ({ page }) => {
    const fixture = await setup(page);
    await openRow(page);
    await editor(page).getByLabel("작업명", { exact: true }).fill("Expired draft");
    fixture.nextFailure = 401;
    await save(page).click();
    await expect(editor(page)).toContainText("편집 권한이 만료");
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Expired draft");
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Expired draft");
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveAttribute("readonly", "");
    await expect(save(page)).toHaveCount(0);
    expect(fixture.patches).toHaveLength(1);
  });

  test("blocks stale writes after 412 until explicit reload and review, keeping drafts on failed reload", async ({ page }) => {
    const fixture = await setup(page);
    await openRow(page);
    await editor(page).getByLabel("작업명", { exact: true }).fill("Conflicting draft");
    fixture.nextFailure = 412;
    await save(page).click();
    await expect(editor(page)).toContainText("기준 Revision이 변경");
    await expect(save(page)).toBeDisabled();
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Conflicting draft");
    fixture.failReads = true;
    await editor(page).getByRole("button", { name: "최신 정보 다시 불러오기" }).click();
    await editor(page).getByRole("button", { name: "변경사항 버리고 다시 불러오기" }).click();
    await expect(editor(page)).toContainText("최신 정보를 불러올 수 없습니다");
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Conflicting draft");
    await expect(save(page)).toBeDisabled();
    fixture.failReads = false;
    await editor(page).getByRole("button", { name: "최신 정보 다시 불러오기" }).click();
    await editor(page).getByRole("button", { name: "변경사항 버리고 다시 불러오기" }).click();
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Server changed");
    await expect(save(page)).toBeEnabled();
    expect(fixture.patches).toHaveLength(1);
    await editor(page).getByLabel("작업명", { exact: true }).fill("Reviewed draft");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches).toHaveLength(2);
    expect(fixture.patches[1].headers()["if-match"]).toBe('"21"');
  });

  test("opens information without save access for readonly projects", async ({ page }) => {
    const fixture = await setup(page, { editable: false });
    await openRow(page);
    await expect(save(page)).toHaveCount(0);
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveAttribute("readonly", "");
    await expect(editor(page)).toContainText("편집 권한이 없습니다");
    await cancel(page);
    await bar(page, id(5)).click({ button: "right" });
    await chooseTaskInformation(page);
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Milestone");
    await expect(save(page)).toHaveCount(0);
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveAttribute("readonly", "");
    expect(fixture.patches).toHaveLength(0);
  });

  test("linked tasks allow editing and copy the stored applied baseline", async ({ page }) => {
    const fixture = await setup(page, { editable: true, links: true });
    await openRow(page);
    await expect(editor(page).getByLabel("작업명", { exact: true })).not.toHaveAttribute("readonly", "");
    await expect(editor(page).getByLabel("요청 시작일", { exact: true })).not.toHaveAttribute("readonly", "");
    await expect(editor(page).getByLabel("기준 시작일", { exact: true })).not.toHaveAttribute("readonly", "");
    await expect(editor(page)).toContainText("후행 작업 일정이 함께 조정됩니다.");
    await editor(page).getByRole("button", { name: "현재 일정으로 설정", exact: true }).click();
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches).toHaveLength(1);
    expect(fixture.patches[0].postDataJSON()).toEqual({
      baselineStart: "2026-09-18",
      baselineDuration: 1,
      baselineEnd: "2026-09-18",
    });
  });

  test("permits only supported milestone fields and does not change its zero duration", async ({ page }) => {
    const fixture = await setup(page);
    await bar(page, id(5)).click({ button: "right" });
    await chooseTaskInformation(page);
    await expect(editor(page).getByLabel("기간 (근무일)", { exact: true })).toHaveAttribute("readonly", "");
    await editor(page).getByLabel("작업명", { exact: true }).fill("Updated milestone");
    await editor(page).getByLabel("요청 시작일", { exact: true }).fill("2026-09-22");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches[0].postDataJSON()).toEqual({ name: "Updated milestone", start: "2026-09-22" });
    expect(fixture.tasks.find((entry) => entry.taskId === id(5))).toMatchObject({ start: "2026-09-22", end: "2026-09-22", duration: 0 });
  });

  test("Issue #377 관계 탭에서 기존 관계를 편집·삭제하고 canonical revision을 즉시 동기화한다", async ({ page }) => {
    const fixture = await setup(page, { editable: true, links: true });
    const ganttInstance = await frame(page).getAttribute("data-project-gantt-api-instance");
    await openRow(page, "Beta leaf");
    const taskDialog = editor(page);
    const relationTab = taskDialog.getByRole("tab", { name: /관계/ });
    await relationTab.click();
    const predecessor = taskDialog.getByRole("region", { name: "선행 작업" });
    const editButton = predecessor.getByRole("button", { name: "Alpha leaf 관계 편집", exact: true });
    await editButton.click();

    const modal = relationEditor(page);
    await expect(modal).toBeVisible();
    await modal.getByLabel("관계 유형 (Type)", { exact: true }).first().selectOption("SS");
    await modal.getByLabel("지연 시간 (Lag, 일 단위)", { exact: true }).first().fill("2");
    await modal.getByRole("button", { name: "수정 저장", exact: true }).click();
    await expect.poll(() => fixture.linkMutations.length).toBe(1);
    await modal.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(relationTab).toHaveAttribute("aria-selected", "true");
    await expect(predecessor).toContainText("SS (시작 → 시작)");
    await expect(predecessor).toContainText("Lag 2일");
    await expect(taskDialog).toContainText("Revision 21");

    const deleteButton = predecessor.getByRole("button", { name: "Alpha leaf 관계 삭제", exact: true });
    await deleteButton.focus();
    await page.keyboard.press("Enter");
    const confirmation = taskDialog.getByRole("alert").filter({ hasText: "Alpha leaf → Beta leaf" });
    await expect(confirmation.getByRole("button", { name: "삭제 취소", exact: true })).toBeFocused();
    await confirmation.getByRole("button", { name: "삭제 취소", exact: true }).click();
    await expect(deleteButton).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(confirmation).toContainText("(SS, Lag 2)");
    await confirmation.getByRole("button", { name: "관계 삭제", exact: true }).click();
    await expect.poll(() => fixture.linkMutations.length).toBe(2);
    await expect(predecessor).toContainText("없음");
    await expect(taskDialog).toContainText("Revision 22");
    await expect(taskDialog.getByRole("tab", { name: /관계 0건/ })).toBeVisible();
    expect(fixture.linkMutations.map((request) => request.method())).toEqual(["PATCH", "DELETE"]);
    expect(fixture.linkMutations[0].headers()["if-match"]).toBe('"20"');
    expect(fixture.linkMutations[0].postDataJSON()).toEqual({ type: "SS", lag: 2 });
    expect(fixture.linkMutations[1].headers()["if-match"]).toBe('"21"');
    await expect(frame(page)).toHaveAttribute("data-project-gantt-api-instance", ganttInstance!);
  });

  test("Issue #409 Copy ID의 taskId를 Relation Editor에서 검색해 externalId Link payload로 연결한다", async ({ page, context }) => {
    const fixture = await setup(page, { editable: true });
    const origin = new URL(page.url()).origin;
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });

    const alphaRow = row(page, "Alpha leaf");
    await alphaRow.getByText("Alpha leaf", { exact: true }).click({ button: "right" });
    const contextMenu = taskContextMenu(page);
    await expect(contextMenu).toBeVisible();
    await contextMenu.getByRole("menuitem", { name: "Copy ID", exact: true }).click();
    await expect(page.getByTestId("workspace-toast")).toContainText("작업 ID를 복사했습니다.");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(id(3));

    await openRow(page, "Beta leaf");
    const taskDialog = editor(page);
    await taskDialog.getByRole("tab", { name: /관계/ }).click();
    await taskDialog.getByRole("button", { name: "관계 추가", exact: true }).click();

    const modal = relationEditor(page);
    const search = modal.getByPlaceholder("작업명 / 외부 ID / 작업 ID 검색...");
    await search.focus();
    await page.keyboard.press("Control+V");
    await expect(search).toHaveValue(id(3));

    const candidate = modal.locator(".relation-editor-candidate-item", { hasText: "Alpha leaf" });
    await expect(candidate).toHaveCount(1);
    await expect(candidate).toContainText("외부 ID: EDITOR-3");
    await expect(candidate).toContainText(`작업 ID: ${id(3)}`);
    await candidate.click();

    await expect(modal.getByText("Alpha leaf", { exact: true })).toBeVisible();
    await expect(modal.getByText("외부 ID: EDITOR-3", { exact: true })).toBeVisible();
    await expect(modal.getByText(`작업 ID: ${id(3)}`, { exact: true })).toBeVisible();

    await modal.getByRole("button", { name: "관계 추가", exact: true }).click();
    await expect.poll(() => fixture.linkMutations.length).toBe(1);
    expect(fixture.linkMutations[0].postDataJSON()).toEqual({
      predecessorExternalId: "EDITOR-4",
      successorExternalId: "EDITOR-3",
      type: "FS",
      lag: 0,
    });
    expect(fixture.links).toContainEqual(expect.objectContaining({
      predecessorExternalId: "EDITOR-4",
      successorExternalId: "EDITOR-3",
    }));
  });

  test("Issue #377 관계가 없는 Milestone에서 anchor 기반 Relation Editor로 새 후행 관계를 추가한다", async ({ page }) => {
    const fixture = await setup(page, { editable: true });
    await openRow(page, "Milestone");
    const taskDialog = editor(page);
    const relationTab = taskDialog.getByRole("tab", { name: /관계/ });
    await relationTab.click();
    await taskDialog.getByRole("button", { name: "관계 추가", exact: true }).click();

    const modal = relationEditor(page);
    await expect(modal).toContainText("기준 작업 [Milestone]");
    await modal.getByPlaceholder("작업명 / 외부 ID / 작업 ID 검색...").fill("Beta");
    await modal.getByRole("button", { name: /Beta leaf.*외부 ID: EDITOR-4.*작업 ID:/ }).click();
    await modal.getByLabel("관계 유형 (Type)", { exact: true }).selectOption("FF");
    await modal.getByLabel("지연 시간 (Lag, 일 단위)", { exact: true }).fill("-1");
    await modal.getByRole("button", { name: "관계 추가", exact: true }).click();
    await expect.poll(() => fixture.linkMutations.length).toBe(1);
    await modal.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(modal).toHaveCount(0);

    const successor = taskDialog.getByRole("region", { name: "후행 작업" });
    await expect(relationTab).toHaveAttribute("aria-selected", "true");
    await expect(successor).toContainText("Beta leaf");
    await expect(successor).toContainText("FF (종료 → 종료)");
    await expect(successor).toContainText("Lag -1일");
    await expect(taskDialog).toContainText("Revision 21");
    expect(fixture.linkMutations[0].postDataJSON()).toEqual({
      predecessorExternalId: "EDITOR-5",
      successorExternalId: "EDITOR-4",
      type: "FF",
      lag: -1,
    });
  });

  test("Issue #377 저장하지 않은 Task 초안은 관계 mutation을 잠그고 사유를 표시한다", async ({ page }) => {
    const fixture = await setup(page, { editable: true, links: true });
    await openRow(page, "Beta leaf");
    const taskDialog = editor(page);
    await taskDialog.getByLabel("작업명", { exact: true }).fill("저장 전 초안");
    await taskDialog.getByRole("tab", { name: /관계/ }).click();
    await expect(taskDialog).toContainText("관계를 변경하려면 작업 변경사항을 먼저 저장하거나 취소해 주세요.");
    await expect(taskDialog.getByRole("button", { name: "관계 추가", exact: true })).toBeDisabled();
    await expect(taskDialog.getByRole("button", { name: "Alpha leaf 관계 편집", exact: true })).toBeDisabled();
    await expect(taskDialog.getByRole("button", { name: "Alpha leaf 관계 삭제", exact: true })).toBeDisabled();
    expect(fixture.linkMutations).toHaveLength(0);
  });

  test("Issue #80 canonical 관계 snapshot은 Grid/Chart/Context Menu Editor에서 동일하게 표시되고 mutation을 만들지 않는다", async ({ page }) => {
    const fixture = await setup(page, { links: true });
    const mutations: Request[] = [];
    page.on("request", (request) => {
      if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method()) && new URL(request.url()).pathname.startsWith(apiPath)) mutations.push(request);
    });

    const expectRelations = async (direction: "predecessor" | "successor") => {
      const dialog = editor(page);
      await dialog.getByRole("tab", { name: /관계/ }).click();
      const group = dialog.getByRole("region", { name: direction === "predecessor" ? /선행 작업/ : /후행 작업/ });
      await expect(group).toContainText(direction === "predecessor" ? "Alpha leaf" : "Beta leaf");
      await expect(group).toContainText(direction === "predecessor" ? "EDITOR-3" : "EDITOR-4");
      await expect(group).toContainText("FS (종료 → 시작)");
      await expect(group).toContainText("Lag 0일");
      await expect(dialog.getByRole("tab", { name: /관계 1건/ })).toBeVisible();
      expect(fixture.patches).toHaveLength(0);
      expect(mutations).toHaveLength(0);
    };

    await row(page, "Alpha leaf").locator('[role="gridcell"][data-col-id=":projectStart"]').dblclick();
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Alpha leaf");
    await expectRelations("successor");
    await cancel(page);

    await bar(page, id(4)).dblclick();
    await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Beta leaf");
    await expectRelations("predecessor");
    await cancel(page);

    await openRow(page, "Beta leaf");
    await expectRelations("predecessor");
    await cancel(page);

    expect(fixture.patches).toHaveLength(0);
    expect(mutations).toHaveLength(0);
  });

  test("Issue #80 관계 정보는 Readonly Editor에서도 canonical snapshot으로 조회된다", async ({ page }) => {
    const fixture = await setup(page, { editable: false, links: true });
    const mutations: Request[] = [];
    page.on("request", (request) => {
      if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method()) && new URL(request.url()).pathname.startsWith(apiPath)) mutations.push(request);
    });
    await openRow(page, "Beta leaf");
    await editor(page).getByRole("tab", { name: /관계/ }).click();
    await expect(editor(page).getByRole("region", { name: /선행 작업/ })).toContainText("Alpha leaf");
    await expect(editor(page).getByRole("button", { name: "관계 추가", exact: true })).toHaveCount(0);
    await expect(editor(page).getByRole("button", { name: /관계 편집$/ })).toHaveCount(0);
    await expect(editor(page).getByRole("button", { name: /관계 삭제$/ })).toHaveCount(0);
    await expect(save(page)).toHaveCount(0);
    expect(fixture.patches).toHaveLength(0);
    expect(mutations).toHaveLength(0);
  });

  test("Issue #74 탭 구조는 초안을 보존하고 키보드 탐색과 좁은 화면을 지원한다", async ({ page }) => {
    const fixture = await setup(page, { assignmentTargets: true });
    await openRow(page);

    const dialog = editor(page);
    const taskTab = dialog.getByRole("tab", { name: "작업 정보", exact: true });
    const resourceTab = dialog.getByRole("tab", { name: /리소스/ });
    const relationTab = dialog.getByRole("tab", { name: /관계/ });
    const logisticsTab = dialog.getByRole("tab", { name: /물류 연결/ });

    await expect(taskTab).toHaveAttribute("aria-selected", "true");
    await dialog.getByLabel("작업명", { exact: true }).fill("탭 전환 초안");

    await taskTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(resourceTab).toBeFocused();
    await expect(resourceTab).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("tabpanel", { name: /리소스/ })).toBeVisible();

    const resourceSearch = dialog.getByLabel("검색", { exact: true });
    await resourceSearch.fill("resource");
    await resourceSearch.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(resourceTab).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("checkbox", { name: /Resource A/ })).toBeDisabled();
    expect(fixture.patches).toHaveLength(0);

    await resourceTab.focus();
    await page.keyboard.press("End");
    await expect(logisticsTab).toBeFocused();
    await expect(logisticsTab).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("tabpanel", { name: /물류 연결/ })).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(relationTab).toBeFocused();
    await expect(relationTab).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Home");
    await expect(taskTab).toBeFocused();
    await expect(dialog.getByLabel("작업명", { exact: true })).toHaveValue("탭 전환 초안");
    expect(fixture.patches).toHaveLength(0);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await taskTab.click();
      const overflow = await dialog.evaluate((element) => ({
        own: element.scrollWidth - element.clientWidth,
        body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(overflow.own).toBeLessThanOrEqual(1);
      expect(overflow.body).toBeLessThanOrEqual(1);

      const nameBox = await dialog.getByLabel("작업명", { exact: true }).boundingBox();
      const startBox = await dialog.getByLabel("요청 시작일", { exact: true }).boundingBox();
      const durationBox = await dialog.getByLabel("기간 (근무일)", { exact: true }).boundingBox();
      const progressBox = await dialog.getByLabel("진행률 (%)", { exact: true }).boundingBox();
      expect(nameBox).not.toBeNull();
      expect(startBox).not.toBeNull();
      expect(durationBox).not.toBeNull();
      expect(progressBox).not.toBeNull();

      if (viewport.width >= 1024) {
        expect(nameBox!.width).toBeLessThanOrEqual(680);
        expect(durationBox!.width).toBeLessThan(startBox!.width);
        expect(progressBox!.width).toBeLessThanOrEqual(330);
      } else {
        expect(Math.abs(durationBox!.width - startBox!.width)).toBeLessThanOrEqual(2);
      }

      await resourceTab.click();
      await expect(dialog.getByRole("checkbox", { name: /Resource A/ })).toBeDisabled();

      await expect(dialog.getByRole("button", { name: "최신 정보 다시 불러오기" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeVisible();
      await expect(save(page)).toBeVisible();
    }
  });

  test("Issue #130 Phase 3 편집기 헤더·탭·본문 스크롤·푸터는 다섯 폭에서 유지된다", async ({ page }, testInfo) => {
    const fixture = await setup(page, { assignmentTargets: true });
    const ganttInstance = await frame(page).getAttribute("data-project-gantt-api-instance");
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1024, height: 900 }, { width: 1440, height: 900 }, { width: 1600, height: 900 }]) {
      await page.setViewportSize(viewport);
      await openRow(page);
      const dialog = editor(page);
      const header = dialog.locator("header").first();
      const tabs = dialog.getByRole("tablist", { name: "작업 편집 정보" });
      const body = dialog.locator("form > div").first();
      const footer = dialog.locator("form > footer");
      await expect(dialog).toContainText("일반 작업");
      await expect(dialog).toContainText("External ID");
      await expect(dialog).toContainText("Revision 20");
      const dialogBox = await dialog.boundingBox();
      const headerBox = await header.boundingBox();
      const tabsBox = await tabs.boundingBox();
      const bodyBox = await body.boundingBox();
      const footerBox = await footer.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(headerBox).not.toBeNull();
      expect(tabsBox).not.toBeNull();
      expect(bodyBox).not.toBeNull();
      expect(footerBox).not.toBeNull();
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height);
      expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(tabsBox!.y);
      expect(tabsBox!.y + tabsBox!.height).toBeLessThanOrEqual(bodyBox!.y);
      expect(bodyBox!.y + bodyBox!.height).toBeLessThanOrEqual(footerBox!.y);
      expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

      const taskTab = tabs.getByRole("tab", { name: "작업 정보", exact: true });
      const resourceTab = tabs.getByRole("tab", { name: /리소스/ });
      const relationTab = tabs.getByRole("tab", { name: /관계/ });
      const logisticsTab = tabs.getByRole("tab", { name: /물류 연결/ });
      await taskTab.focus();
      await page.keyboard.press("End");
      await expect(logisticsTab).toBeFocused();
      await expect(dialog.getByRole("tabpanel", { name: /물류 연결/ })).toBeVisible();
      await page.keyboard.press("ArrowLeft");
      await expect(relationTab).toBeFocused();
      await expect(dialog.getByRole("tabpanel", { name: /관계/ })).toBeVisible();
      const predecessor = await dialog.getByRole("region", { name: "선행 작업" }).boundingBox();
      const successor = await dialog.getByRole("region", { name: "후행 작업" }).boundingBox();
      expect(predecessor).not.toBeNull();
      expect(successor).not.toBeNull();
      if (viewport.width >= 1024) expect(successor!.x).toBeGreaterThan(predecessor!.x);
      else expect(successor!.y).toBeGreaterThan(predecessor!.y);
      await page.keyboard.press("Home");
      await expect(taskTab).toBeFocused();
      const nameBox = await dialog.getByLabel("작업명", { exact: true }).boundingBox();
      const progressBox = await dialog.getByLabel("진행률 (%)", { exact: true }).boundingBox();
      const startBox = await dialog.getByLabel("요청 시작일", { exact: true }).boundingBox();
      const durationBox = await dialog.getByLabel("기간 (근무일)", { exact: true }).boundingBox();
      expect(nameBox).not.toBeNull();
      expect(progressBox).not.toBeNull();
      expect(startBox).not.toBeNull();
      expect(durationBox).not.toBeNull();
      if (viewport.width >= 1024) {
        expect(progressBox!.x).toBeGreaterThan(nameBox!.x);
        expect(durationBox!.width).toBeLessThan(startBox!.width);
      } else {
        expect(progressBox!.y).toBeGreaterThan(nameBox!.y);
      }
      await resourceTab.click();
      await expect(dialog.getByRole("tabpanel", { name: /리소스/ })).toBeVisible();
      await taskTab.click();
      const footerReload = dialog.getByRole("button", { name: "최신 정보 다시 불러오기" });
      const footerCancel = dialog.getByRole("button", { name: "취소", exact: true });
      const footerSave = save(page);
      await expect(footerReload).toBeVisible();
      await expect(footerCancel).toBeVisible();
      await expect(footerSave).toBeVisible();
      const [reloadBox, cancelBox, saveBox] = await Promise.all([
        footerReload.boundingBox(),
        footerCancel.boundingBox(),
        footerSave.boundingBox(),
      ]);
      expect(reloadBox).not.toBeNull();
      expect(cancelBox).not.toBeNull();
      expect(saveBox).not.toBeNull();
      expect(Math.abs(reloadBox!.height - cancelBox!.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(cancelBox!.height - saveBox!.height)).toBeLessThanOrEqual(1);
      if (viewport.width > 480) {
        expect(Math.abs(reloadBox!.y - cancelBox!.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(cancelBox!.y - saveBox!.y)).toBeLessThanOrEqual(1);
      } else {
        expect(cancelBox!.y).toBeGreaterThan(reloadBox!.y);
        expect(Math.abs(cancelBox!.y - saveBox!.y)).toBeLessThanOrEqual(1);
      }
      expect(await Promise.all([
        footerReload.evaluate((element) => getComputedStyle(element).marginTop),
        footerCancel.evaluate((element) => getComputedStyle(element).marginTop),
        footerSave.evaluate((element) => getComputedStyle(element).marginTop),
      ])).toEqual(["0px", "0px", "0px"]);
      await page.screenshot({ path: testInfo.outputPath(`issue-130-phase3-current-${viewport.width}.png`) });

      if (viewport.width <= 768) {
        const beforeHeader = await header.boundingBox();
        const beforeFooter = await footer.boundingBox();
        const bodyOverflow = await body.evaluate((element) => element.scrollHeight - element.clientHeight);
        if (viewport.width === 390) expect(bodyOverflow).toBeGreaterThan(0);
        const scrollTop = await body.evaluate((element) => { element.scrollTop = element.scrollHeight; return element.scrollTop; });
        if (bodyOverflow > 0) expect(scrollTop).toBeGreaterThan(0);
        expect(await header.boundingBox()).toEqual(beforeHeader);
        expect(await footer.boundingBox()).toEqual(beforeFooter);
      }
      await cancel(page);
      await expect(row(page, "Beta leaf")).toBeFocused();
      await expect(frame(page)).toHaveAttribute("data-project-gantt-api-instance", ganttInstance!);
    }
    expect(fixture.patches).toHaveLength(0);
  });

});


test("Issue #413 수행 역할 필터와 Resource별 역할 선택을 assignment 저장 payload에 반영한다", async ({ page }) => {
  const fixture = await setup(page, { assignmentTargets: true });
  await openRow(page);
  const dialog = editor(page);
  await dialog.getByRole("tab", { name: /리소스/ }).click();

  const roleFilter = dialog.getByRole("combobox", { name: "수행 역할", exact: true });
  const roleRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === `${apiPath}/assignment-targets` &&
      url.searchParams.get("kind") === "resource" &&
      url.searchParams.get("role") === "DEVELOPER";
  });
  await roleFilter.selectOption("DEVELOPER");
  await roleRequest;
  await expect(dialog.getByRole("checkbox", { name: /Resource A/ })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: /Resource B/ })).toHaveCount(0);

  await dialog.getByRole("checkbox", { name: /Resource A/ }).check();
  const roleSelect = dialog.getByLabel(/Resource A.*수행 역할/);
  await expect(roleSelect).toHaveValue("DEVELOPER");
  await dialog.getByLabel(/Resource A.*투입률/).fill("60");
  await dialog.getByRole("button", { name: /할당 저장/ }).click();

  await expect.poll(() => fixture.assignmentMutations.length).toBe(1);
  expect(fixture.assignmentMutations[0].postDataJSON()).toEqual({
    catalogRevision: 1,
    targets: [{
      kind: "resource",
      id: id(70),
      role: "DEVELOPER",
      allocation: { start: null, end: null, percent: 60 },
    }],
  });
});

test("#461 picker UUID·동명이인·긴 후보 keyboard·Summary 필드·리소스 초안 보호", async ({ page }) => {
  const fixture = await setup(page, { assignmentTargets: true });
  for (let index = 10; index < 32; index++) fixture.tasks.push(task(index, `완료 단계 긴 한글 English duplicate ${index === 10 || index === 11 ? "same" : index}`, { type: "milestone", duration: 0, status: "not_started", progress: 0 }));
  fixture.tasks[0].membership = { explicitMilestoneTaskId: id(10), effectiveMilestoneTaskId: id(10), inheritedFromTaskId: null };
  fixture.tasks[1].membership = { explicitMilestoneTaskId: id(11), effectiveMilestoneTaskId: id(11), inheritedFromTaskId: null };
  await page.reload();
  await openRow(page, "Child");
  const dialog = editor(page), picker = dialog.getByRole("combobox", { name: "완료 단계", exact: true });
  await picker.fill(` ${id(11).toUpperCase()} `); await expect(dialog.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await picker.press("Escape"); await expect(dialog).toBeVisible(); await expect(dialog.getByRole("listbox")).toHaveCount(0);
  await picker.fill("same"); await expect(dialog.getByRole("listbox").getByRole("option")).toHaveCount(2); await expect(dialog.getByRole("listbox")).toContainText(`작업 ID: ${id(10)}`);
  await picker.fill("완료 단계");
  for (let index = 0; index < 18; index++) await picker.press("ArrowDown");
  const visible = await picker.evaluate((element) => { const active = document.getElementById(element.getAttribute("aria-activedescendant")!)!, list = document.getElementById(element.getAttribute("aria-controls")!)!, body = element.closest("dialog")!.querySelector('[class*="body"]')!; const a = active.getBoundingClientRect(), b = list.getBoundingClientRect(), input = element.getBoundingClientRect(), owner = body.getBoundingClientRect(); return { activeOptionTop: a.top, activeOptionBottom: a.bottom, listOwnerTop: b.top, listOwnerBottom: b.bottom, activeOptionVisible: a.top >= b.top && a.bottom <= b.bottom, inputTop: input.top, inputBottom: input.bottom, bodyTop: owner.top, bodyBottom: owner.bottom, focusedInputVisible: input.top >= owner.top && input.bottom <= owner.bottom, focusedInputRetained: element === document.activeElement, listScrollTop: list.scrollTop }; });
  expect(visible.activeOptionVisible).toBe(true); expect(visible.focusedInputVisible).toBe(true); expect(visible.focusedInputRetained).toBe(true);
  await mkdir("output/playwright/issue-461", { recursive: true }); await writeFile("output/playwright/issue-461/picker-geometry.json", JSON.stringify(visible, null, 2));
  await picker.press("Escape");
  await dialog.getByRole("button", { name: "직접 지정 해제 · 상속으로 복귀", exact: true }).click();
  await expect(dialog).toContainText("Summary에서 상속");
  await dialog.getByRole("button", { name: "상속 출처 열기", exact: true }).click();
  await expect(dialog).toContainText("저장하지 않은 변경사항을 버리고 다른 작업");
  await dialog.getByRole("button", { name: "계속 편집", exact: true }).click();
  await dialog.getByRole("tab", { name: /리소스/ }).click(); await expect(dialog.getByRole("checkbox", { name: /Resource A/ })).toBeDisabled();
  await dialog.getByRole("button", { name: "최신 정보 다시 불러오기" }).click(); await dialog.getByRole("button", { name: "변경사항 버리고 다시 불러오기" }).click();
  const resource = dialog.getByRole("checkbox", { name: /Resource A/ }); await expect(resource).toBeEnabled(); await resource.check();
  await dialog.getByRole("tab", { name: "작업 정보", exact: true }).click(); await expect(save(page)).toBeDisabled(); await expect(picker).not.toHaveAttribute("aria-readonly"); await expect(picker).toHaveAccessibleDescription("검색·조회는 가능합니다. 완료 단계 소속 변경은 잠겨 있습니다.");
  await picker.fill("Milestone"); await expect(dialog.getByRole("listbox").getByRole("option")).toHaveCount(1); await picker.press("Enter"); await expect(dialog).toContainText("직접 지정"); expect(fixture.patches).toHaveLength(0); await picker.press("Escape");
  await expect(dialog.getByLabel("기준 시작일", { exact: true })).toHaveAttribute("readonly", ""); await expect(dialog.getByRole("button", { name: "현재 일정으로 설정", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "작업 편집기 닫기" }).click(); await expect(dialog).toContainText("저장하지 않은");
  await dialog.getByRole("button", { name: "계속 편집" }).click(); await dialog.getByRole("tab", { name: /리소스/ }).click(); await expect(resource).toBeChecked();
  await dialog.getByRole("button", { name: "작업 편집기 닫기" }).click(); await dialog.getByRole("button", { name: "변경사항 버리고 닫기" }).click();
  await openRow(page, "Summary"); await expect(dialog.getByLabel("작업명", { exact: true })).not.toHaveAttribute("readonly", ""); await expect(dialog.getByLabel("요청 시작일", { exact: true })).toHaveAttribute("readonly", ""); await expect(dialog.getByLabel("상태", { exact: true })).toBeDisabled();
});

test("#461 batch 412·network 실패 검색/선택/초안 보존과 pending 중 닫기 보호", async ({ page }) => {
  const fixture = await setup(page);
  const m = fixture.tasks[4]; m.stageGate = { memberTaskIds: [], memberCount: 0, completedMemberCount: 0, incompleteMemberTaskIds: [], memberProgressPercent: null, predecessorMilestoneTaskIds: [], incompletePredecessorMilestoneTaskIds: [], membersCompleted: true, predecessorsCompleted: true, ready: null, blocked: false, manualEvent: true, completionInconsistent: false };
  await page.reload();
  let calls = 0, failure: number | "network" = 412, release: (() => void) | undefined;
  await page.route(`**${apiPath}/milestone-memberships`, async (route) => { calls++; await new Promise<void>((resolve) => { release = resolve; }); if (failure === "network") await route.abort(); else await route.fulfill({ status: failure, json: { error: { code: "REVISION_MISMATCH" } } }); });
  await bar(page, m.taskId).click({ button: "right" }); await chooseTaskInformation(page);
  const dialog = editor(page); await dialog.getByRole("tab", { name: /소속 작업/ }).click(); await dialog.getByRole("combobox", { name: "소속 상태", exact: true }).selectOption("all");
  const query = dialog.getByLabel("작업명 / 외부 ID / 작업 ID 검색", { exact: true }); await query.fill("Beta"); await query.press("Enter"); await expect(dialog).toBeVisible(); expect(calls).toBe(0); expect(fixture.patches).toHaveLength(0);
  await dialog.getByRole("row", { name: /Beta leaf/ }).getByRole("button", { name: "직접 지정", exact: true }).click();
  await dialog.getByRole("button", { name: "소속 변경 적용", exact: true }).click(); await expect.poll(() => calls).toBe(1);
  await expect(query).toBeDisabled(); await expect(dialog.getByRole("combobox", { name: "유형", exact: true })).toBeDisabled(); await expect(dialog.getByRole("combobox", { name: "소속 상태", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "작업 편집기 닫기" })).toBeDisabled(); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); release?.();
  await expect(dialog).toContainText("기준 Revision이 변경"); await expect(query).toHaveValue("Beta"); await expect(dialog).toContainText("변경 예정: 직접 지정 1"); await expect(dialog.getByRole("button", { name: "소속 변경 적용", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "최신 정보 다시 불러오기" }).click(); await dialog.getByRole("button", { name: "변경사항 버리고 다시 불러오기" }).click();
  await expect(query).toHaveValue("Beta"); await dialog.getByRole("row", { name: /Beta leaf/ }).getByRole("button", { name: "직접 지정", exact: true }).click(); failure = "network";
  await dialog.getByRole("button", { name: "소속 변경 적용", exact: true }).click(); await expect.poll(() => calls).toBe(2); release?.();
  await expect(dialog).toContainText("네트워크 연결"); await expect(query).toHaveValue("Beta"); await expect(dialog).toContainText("변경 예정: 직접 지정 1"); expect(calls).toBe(2);
});

test("#461 Resource 신규 선택 해제는 잔여 draft로 dirty를 유지하지 않는다", async ({ page }) => {
  const fixture = await setup(page, { assignmentTargets: true }); await openRow(page);
  const dialog = editor(page); await dialog.getByRole("tab", { name: /리소스/ }).click();
  const resource = dialog.getByRole("checkbox", { name: /Resource A/ }); await resource.check();
  await dialog.getByLabel(/Resource A.*수행 역할/).selectOption("DEVELOPER"); await dialog.getByLabel(/Resource A.*투입률/).fill("60");
  await resource.uncheck(); await expect(resource).not.toBeChecked();
  await dialog.getByRole("button", { name: "작업 편집기 닫기" }).click();
  await expect(dialog).toHaveCount(0); expect(fixture.assignmentMutations).toHaveLength(0);
});

test("#461 reload 후 작업 유형이 바뀌면 유효하지 않은 소속 작업 탭을 정규화한다", async ({ page }) => {
  const fixture = await setup(page); await openRow(page, "Milestone");
  const dialog = editor(page); await dialog.getByRole("tab", { name: /소속 작업/ }).click();
  const milestone = fixture.tasks.find((task) => task.taskId === id(5))!;
  milestone.type = "task"; milestone.duration = 1; milestone.stageGate = undefined; fixture.project.revision += 1;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: fixture.project.revision });
  await expect(dialog).toContainText("작업 유형이 변경되었습니다");
  await dialog.getByRole("button", { name: "최신 정보 다시 불러오기" }).click();
  await expect(dialog.getByRole("tab", { name: /소속 작업/ })).toHaveCount(0);
  await expect(dialog.getByRole("tab", { name: "작업 정보", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByLabel("작업명", { exact: true })).toHaveValue("Milestone");
});

test("#461 Resource 외부 revision·401에서도 초안 유지, 확인 focus와 저장 잠금", async ({ page }) => {
  const fixture = await setup(page, { assignmentTargets: true }); await openRow(page);
  const dialog = editor(page); await dialog.getByRole("tab", { name: /리소스/ }).click();
  const resource = dialog.getByRole("checkbox", { name: /Resource A/ }); await resource.check();
  await dialog.getByLabel(/Resource A.*수행 역할/).selectOption("DEVELOPER"); await dialog.getByLabel(/Resource A.*투입률/).fill("60");
  fixture.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: fixture.project.revision });
  await expect(dialog).toContainText("기준 Revision이 변경"); await expect(resource).toBeChecked(); await expect(resource).toBeDisabled(); await expect(dialog.getByLabel(/Resource A.*투입률/)).toHaveValue("60");
  const reload = dialog.getByRole("button", { name: "최신 정보 다시 불러오기" }); await reload.click();
  const cancelConfirm = dialog.getByRole("button", { name: "계속 편집", exact: true }); await expect(cancelConfirm).toBeFocused();
  await expect(save(page)).toBeDisabled(); await expect(dialog.locator('[class*="body"]')).toHaveAttribute("inert", "");
  await cancelConfirm.click(); await expect(reload).toBeFocused(); await expect(resource).toBeChecked();
  await reload.click(); await dialog.getByRole("button", { name: "변경사항 버리고 다시 불러오기" }).click();
  await expect(resource).not.toBeChecked(); await resource.check(); await dialog.getByLabel(/Resource A.*수행 역할/).selectOption("DEVELOPER"); await dialog.getByLabel(/Resource A.*투입률/).fill("60");
  await page.route(`**${apiPath}/tasks/${id(4)}/assignments`, async (route) => { await route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } }); });
  await dialog.getByRole("button", { name: /할당 저장/ }).click(); await expect(dialog).toContainText("편집 권한이 없습니다"); await expect(resource).toBeChecked(); await expect(resource).toBeDisabled(); await expect(dialog.getByLabel(/Resource A.*투입률/)).toHaveValue("60");
});

test("#461 Logistics 별도 초안·외부 revision·401 유지와 교차 저장 잠금", async ({ page }) => {
  const fixture = await setup(page);
  await page.route(`**${apiPath}/logistics`, async (route) => route.fulfill({ json: { data: { project: fixture.project, logistics: { equipment: [{ id: id(80), name: "설비 초안", code: "EQ-80", equipmentType: "other", resourceRoles: [] }], systems: [] } } } }));
  await page.route(`**${apiPath}/tasks/${id(4)}/logistics-links`, async (route) => {
    if (route.request().method() === "PUT") { await route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } }); return; }
    await route.fulfill({ json: { data: { taskId: id(4), links: { taskId: id(4), directEquipmentLinks: [], directSystemLinks: [], inheritedEquipmentLinks: [], inheritedSystemLinks: [], effectiveEquipmentIds: [], effectiveSystemIds: [] } } } });
  });
  await openRow(page); const dialog = editor(page); await dialog.getByRole("tab", { name: /물류 연결/ }).click();
  const equipment = dialog.getByRole("checkbox", { name: /설비 초안/ }); await equipment.check();
  await dialog.getByRole("tab", { name: "작업 정보", exact: true }).click(); await expect(save(page)).toBeDisabled(); await expect(dialog.getByRole("combobox", { name: "완료 단계", exact: true })).not.toHaveAttribute("aria-readonly"); await expect(dialog.getByRole("combobox", { name: "완료 단계", exact: true })).toHaveAccessibleDescription("검색·조회는 가능합니다. 완료 단계 소속 변경은 잠겨 있습니다.");
  fixture.project.revision++; await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: fixture.project.revision });
  await expect(dialog).toContainText("기준 Revision이 변경"); await dialog.getByRole("tab", { name: /물류 연결/ }).click(); await expect(equipment).toBeChecked(); await expect(equipment).toBeDisabled();
  await dialog.getByRole("button", { name: "최신 정보 다시 불러오기" }).click(); await dialog.getByRole("button", { name: "변경사항 버리고 다시 불러오기" }).click(); await expect(equipment).not.toBeChecked(); await equipment.check();
  await dialog.getByRole("button", { name: /물류 연결 저장/ }).click(); await expect(dialog).toContainText("편집 권한이 없습니다"); await expect(equipment).toBeChecked(); await expect(equipment).toBeDisabled();
});

test("#461 readonly 검색 조회와 completed 후보 지정 거부", async ({ page }) => {
  const fixture = await setup(page, { editable: false });
  fixture.tasks[4].status = "completed"; fixture.tasks[4].progress = 100;
  await page.reload(); await openRow(page); const dialog = editor(page);
  const picker = dialog.getByRole("combobox", { name: "완료 단계", exact: true });
  await expect(picker).toBeEnabled(); await expect(picker).not.toHaveAttribute("aria-readonly"); await expect(picker).toHaveAccessibleDescription("검색·조회는 가능합니다. 완료 단계 소속 변경은 잠겨 있습니다.");
  await picker.fill("Milestone"); const option = dialog.getByRole("listbox").getByRole("option"); await expect(option).toHaveCount(1); await expect(option).toHaveAttribute("aria-disabled", "true");
  await expect(picker).toHaveValue("Milestone");
  await picker.press("Enter"); await expect(picker).toHaveValue("Milestone"); await expect(dialog).toContainText("미지정"); expect(fixture.tasks.find((task) => task.taskId === id(4))?.membership?.explicitMilestoneTaskId ?? null).toBeNull(); expect(fixture.patches).toHaveLength(0);
  const optionBounds = (await option.boundingBox())!; await page.mouse.click(optionBounds.x + optionBounds.width / 2, optionBounds.y + optionBounds.height / 2); await expect(dialog).toContainText("미지정"); expect(fixture.patches).toHaveLength(0);
  await picker.press("Escape"); await expect(dialog.getByRole("listbox")).toHaveCount(0); await expect(picker).toBeFocused(); await expect(dialog).toBeVisible();
});
