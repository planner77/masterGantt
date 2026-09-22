import { expect, test, type Page, type Request } from "@playwright/test";
import type { ProjectDto, ProjectLinkDto, ProjectTaskDto, UpdateTaskRequest } from "../../src/contracts/projects";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";
import { scheduleLeaf } from "../../src/domain/scheduling/leaf";
import { chooseTaskInformation, taskContextMenu } from "./helpers/task-context-menu";

const publicId = "a3405d3d-8cb4-4da4-9b0f-43a5de330004";
const apiPath = `/api/projects/${publicId}`;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (page: Page, name: string) => page.locator(".project-gantt-widget .wx-row", { hasText: name }).first();
const bar = (page: Page, taskId: string) => page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${taskId}"]`);
const editor = (page: Page) => page.getByRole("dialog", { name: "작업 정보", exact: true });
const save = (page: Page) => editor(page).getByRole("button", { name: "저장", exact: true });
const frame = (page: Page) => page.locator(".project-gantt-frame");

function task(n: number, name: string, extra: Partial<ProjectTaskDto> = {}): ProjectTaskDto {
  return { taskId: id(n), externalId: `EDITOR-${n}`, name, type: "task", scheduleMode: "auto", requestedStart: "2026-09-18", start: "2026-09-18", end: "2026-09-18", duration: 1, progress: 10, parentExternalId: null, siblingOrder: n, ...extra };
}

interface Fixture {
  project: ProjectDto;
  tasks: ProjectTaskDto[];
  links: ProjectLinkDto[];
  editable: boolean;
  patches: Request[];
  nextFailure: number | "network" | null;
  gate: Promise<void> | null;
  failReads: boolean;
  projectReads: number;
}

async function setup(page: Page, options: { editable?: boolean; links?: boolean; assignmentTargets?: boolean } = {}): Promise<Fixture> {
  await page.clock.setFixedTime(new Date("2026-09-16T12:00:00Z"));
  const fixture: Fixture = {
    project: { publicId, name: "Task Editor fixture", description: "Issue #4", revision: 20, calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-09-21", name: "Fixture holiday" }] } },
    tasks: [
      task(1, "Summary", { type: "summary", requestedStart: null }),
      task(2, "Child", { parentExternalId: "EDITOR-1" }),
      task(3, "Alpha leaf", { requestedStart: "2026-09-16", start: "2026-09-16", end: "2026-09-16" }),
      task(4, "Beta leaf"),
      task(5, "Milestone", { type: "milestone", duration: 0, requestedStart: "2026-09-23", start: "2026-09-23", end: "2026-09-23" }),
    ],
    links: options.links ? [{ id: id(90), predecessorExternalId: "EDITOR-3", successorExternalId: "EDITOR-4", type: "FS", lag: 0 }] : [],
    editable: options.editable ?? true, patches: [], nextFailure: null, gate: null, failReads: false, projectReads: 0,
  };
  const assignmentTargets = options.assignmentTargets ? [{ kind: "resource" as const, id: id(70), name: "Resource A", code: "RES-A", active: true }] : [];
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
        const calculated = scheduleLeaf({ type: entry.type, requestedStart: patch.start ?? entry.requestedStart ?? entry.start, duration: patch.duration ?? entry.duration, scheduleMode: entry.scheduleMode }, createWorkingCalendar(fixture.project.calendar));
        Object.assign(entry, { name: patch.name ?? entry.name, progress: patch.progress ?? entry.progress, start: calculated.start, end: calculated.end, duration: calculated.duration, requestedStart: calculated.requestedStart });
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
    await route.continue();
  });
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText(fixture.editable ? "편집 중" : "읽기 전용", { exact: true })).toBeVisible();
  await expect(row(page, "Beta leaf")).toBeVisible();
  await expect(frame(page)).toHaveAttribute("data-project-gantt-api-instance", /svar-api-/);
  return fixture;
}

async function openRow(page: Page, name = "Beta leaf") {
  await row(page, name).getByText(name, { exact: true }).click({ button: "right" });
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
    await expect(save(page)).toHaveCount(0);
    await expect(editor(page)).toContainText("하위 작업으로 계산");
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
    await editor(page).getByLabel("기간 (근무일)", { exact: true }).fill("2");
    await expect(editor(page).locator("output")).toHaveText("2026-09-18");
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
    await editor(page).getByLabel("시작일", { exact: true }).fill("2026-09-19");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches[1].postDataJSON()).toEqual({ start: "2026-09-19" });
    expect(fixture.tasks.find((entry) => entry.taskId === id(4))).toMatchObject({ requestedStart: "2026-09-19", start: "2026-09-22", end: "2026-09-23", duration: 2 });
    await expect(page.getByTestId("workspace-toast")).toContainText("비근무일 시작");
    await openRow(page);
    await editor(page).getByLabel("작업명", { exact: true }).fill("Edited together");
    await editor(page).getByLabel("시작일", { exact: true }).fill("2026-09-18");
    await editor(page).getByLabel("기간 (근무일)", { exact: true }).fill("3");
    await editor(page).getByLabel("진행률 (%)", { exact: true }).fill("36");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches[2].postDataJSON()).toEqual({ name: "Edited together", start: "2026-09-18", duration: 3, progress: 36 });
    await expect(row(page, "Edited together")).toBeVisible();
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

  for (const mode of ["readonly", "linked"] as const) {
    test(`opens information without save access for ${mode} projects`, async ({ page }) => {
      const fixture = await setup(page, { editable: mode !== "readonly", links: mode === "linked" });
      await openRow(page);
      await expect(save(page)).toHaveCount(0);
      await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveAttribute("readonly", "");
      await expect(editor(page)).toContainText(mode === "readonly" ? "편집 권한이 없습니다" : "연결이 있는 일정");
      await cancel(page);
      await bar(page, id(5)).click({ button: "right" });
      await chooseTaskInformation(page);
      await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue("Milestone");
      await expect(save(page)).toHaveCount(0);
      expect(fixture.patches).toHaveLength(0);
    });
  }

  test("permits only supported milestone fields and does not change its zero duration", async ({ page }) => {
    const fixture = await setup(page);
    await bar(page, id(5)).click({ button: "right" });
    await chooseTaskInformation(page);
    await expect(editor(page).getByLabel("기간 (근무일)", { exact: true })).toHaveAttribute("readonly", "");
    await editor(page).getByLabel("작업명", { exact: true }).fill("Updated milestone");
    await editor(page).getByLabel("시작일", { exact: true }).fill("2026-09-22");
    await save(page).click();
    await expect(editor(page)).toHaveCount(0);
    expect(fixture.patches[0].postDataJSON()).toEqual({ name: "Updated milestone", start: "2026-09-22" });
    expect(fixture.tasks.find((entry) => entry.taskId === id(5))).toMatchObject({ start: "2026-09-22", end: "2026-09-22", duration: 0 });
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

    await row(page, "Alpha leaf").getByText("Alpha leaf", { exact: true }).dblclick();
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
    expect(fixture.patches).toHaveLength(0);

    await resourceTab.focus();
    await page.keyboard.press("End");
    await expect(relationTab).toBeFocused();
    await expect(relationTab).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Home");
    await expect(taskTab).toBeFocused();
    await expect(dialog.getByLabel("작업명", { exact: true })).toHaveValue("탭 전환 초안");
    expect(fixture.patches).toHaveLength(0);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 360, height: 800 }]) {
      await page.setViewportSize(viewport);
      const overflow = await dialog.evaluate((element) => ({
        own: element.scrollWidth - element.clientWidth,
        body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(overflow.own).toBeLessThanOrEqual(1);
      expect(overflow.body).toBeLessThanOrEqual(1);
      await expect(dialog.getByRole("button", { name: "최신 정보 다시 불러오기" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeVisible();
      await expect(save(page)).toBeVisible();
    }
  });

});