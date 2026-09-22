import { expect, type Page, type Request, type Route } from "@playwright/test";
import type { CreateTaskRequest, ProjectDto, ProjectTaskDto, TaskMutationResponse } from "../../src/contracts/projects";

export const publicId = "a3405d3d-8cb4-4da4-9b0f-43a5de330003";
export const projectPath = `/api/projects/${publicId}`;
export const taskPath = `${projectPath}/tasks`;
export interface Deferred { readonly promise: Promise<void>; resolve(): void; }
export type PostOutcome =
  | { readonly kind: "success"; readonly gate?: Deferred; readonly started?: Deferred }
  | { readonly kind: "error"; readonly status: 401 | 412 | 422 | 500; readonly code: string }
  | { readonly kind: "network" };
export interface StatefulProjectFixture {
  readonly initialRevision: number;
  readonly posts: CreateTaskRequest[];
  readonly patchRequests: Request[];
  readonly createdTaskIds: string[];
  readonly project: ProjectDto;
  readonly tasks: ProjectTaskDto[];
  sessionEditable: boolean;
  nextPost: PostOutcome;
}
export function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}
function task(ordinal: number, externalId: string, name: string, overrides: Partial<ProjectTaskDto> = {}): ProjectTaskDto {
  return {
    taskId: `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
    externalId, name, type: "task", scheduleMode: "auto", requestedStart: "2026-09-16",
    start: "2026-09-16", end: "2026-09-16", duration: 1, progress: 0,
    parentExternalId: null, siblingOrder: ordinal, ...overrides,
  };
}
function initialTasks(): ProjectTaskDto[] {
  return [
    task(1, "SUMMARY-1", "Stable summary", { type: "summary", requestedStart: null, start: "2026-01-05", end: "2026-01-06", duration: 2, progress: 25, siblingOrder: 0 }),
    task(2, "SUMMARY-CHILD-1", "Existing summary child", { requestedStart: "2026-01-05", start: "2026-01-05", end: "2026-01-06", duration: 2, progress: 25, parentExternalId: "SUMMARY-1", siblingOrder: 0 }),
    task(3, "LEAF-1", "Stable leaf", { siblingOrder: 1 }),
    task(4, "MILESTONE-1", "Stable milestone", { type: "milestone", requestedStart: "2026-12-18", start: "2026-12-18", end: "2026-12-18", duration: 0, siblingOrder: 2 }),
  ];
}
function snapshot(fixture: StatefulProjectFixture) {
  return { data: { project: { ...fixture.project }, tasks: fixture.tasks.map((entry) => ({ ...entry })), links: [], permission: "readonly" as const } };
}
function taskMutation(fixture: StatefulProjectFixture, changedTaskExternalIds: string[]): TaskMutationResponse {
  return { data: {
    project: { ...fixture.project }, tasks: fixture.tasks.map((entry) => ({ ...entry })), links: [], warnings: [],
    operation: { kind: "taskCreate", changedTaskExternalIds, deletedTaskExternalIds: [], deletedLinkIds: [] },
  } };
}
function errorBody(code: string) {
  return { error: { code, message: "Rejected by the Issue #3 E2E fixture.", details: [], requestId: "issue-3-e2e" } };
}
function applySuccessfulCreate(fixture: StatefulProjectFixture, payload: CreateTaskRequest): TaskMutationResponse {
  const sequence = fixture.createdTaskIds.length + 100;
  const externalId = `ISSUE-3-${sequence}`;
  const parent = payload.parentTaskId ? fixture.tasks.find((entry) => entry.taskId === payload.parentTaskId) : undefined;
  const changedTaskExternalIds = [externalId];
  if (parent?.type === "task" && payload.convertParentToSummary) {
    parent.type = "summary"; parent.requestedStart = null;
    parent.start = payload.start; parent.end = payload.start; parent.duration = payload.duration; parent.progress = payload.progress;
    changedTaskExternalIds.unshift(parent.externalId);
  }
  const created = task(sequence, externalId, payload.name, {
    type: payload.type, requestedStart: payload.start, start: payload.start, end: payload.start,
    duration: payload.duration, progress: payload.progress, parentExternalId: parent?.externalId ?? null,
    siblingOrder: fixture.tasks.filter((entry) => entry.parentExternalId === (parent?.externalId ?? null)).length,
  });
  fixture.tasks.push(created); fixture.createdTaskIds.push(created.taskId); fixture.project.revision += 1;
  return taskMutation(fixture, changedTaskExternalIds);
}
export async function installStatefulProjectFixture(page: Page): Promise<StatefulProjectFixture> {
  const project: ProjectDto = {
    publicId, name: "Issue 3 stable Gantt fixture", description: "Stateful canonical snapshot fixture", revision: 40,
    calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
  };
  const fixture: StatefulProjectFixture = {
    initialRevision: project.revision, posts: [], patchRequests: [], createdTaskIds: [],
    project, tasks: initialTasks(), sessionEditable: true, nextPost: { kind: "success" },
  };
  await page.route("**/api/projects/**", async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === `${projectPath}/edit-sessions/current` && request.method() === "GET") {
      await route.fulfill({ json: fixture.sessionEditable ? { data: { permission: "edit", expiresAt: "2099-01-01T00:00:00.000Z" } } : { data: { permission: "readonly" } } }); return;
    }
    if (pathname === `${projectPath}/edit-sessions/current` && request.method() === "DELETE") {
      fixture.sessionEditable = false; await route.fulfill({ status: 204, body: "" }); return;
    }
    if (pathname === `${projectPath}/edit-sessions` && request.method() === "POST") {
      fixture.sessionEditable = true; await route.fulfill({ status: 204, body: "" }); return;
    }
    if (pathname === projectPath && request.method() === "GET") { await route.fulfill({ json: snapshot(fixture) }); return; }
    if (pathname === `${projectPath}/work-calendar` && request.method() === "GET") {
      await route.fulfill({ json: { data: { projectRevision: fixture.project.revision, rules: [], projectDates: [] } } }); return;
    }
    if (pathname === `${projectPath}/assignment-targets` && request.method() === "GET") {
      await route.fulfill({ json: { data: { catalogRevision: 1, targets: [] } } }); return;
    }
    if (pathname === `${projectPath}/assigned-targets` && request.method() === "GET") {
      await route.fulfill({ json: { data: {
        projectRevision: fixture.project.revision,
        catalogRevision: 1,
        assignments: [
          { id: "assignment-1", taskId: fixture.tasks[2].taskId, target: { kind: "resource", id: "resource-1" }, allocation: { start: "2026-09-16", end: "2026-09-18", percent: 100 } },
        ],
        targets: [
          { kind: "resource", id: "resource-1", name: "테스트 리소스", code: "R-01", description: "테스트 리소스 설명", active: true },
          { kind: "group", id: "group-1", name: "개발팀", code: "G-01", description: "개발 그룹 설명", active: true },
        ],
      } } }); return;
    }
    if (pathname === `${projectPath}/resource-workload` && request.method() === "GET") {
      await route.fulfill({ json: { data: { projectRevision: fixture.project.revision, catalogRevision: 1, range: { from: "2026-09-01", to: "2026-09-30" }, mdPerMm: 20, grandTotalMd: 5, grandTotalMm: 0.25, unsetCount: 0, groups: [{ id: "group-1", name: "개발팀", active: true, start: "2026-09-16", end: "2026-09-18", effortMd: 5, effortMm: 0.25, unsetCount: 0, resources: [{ id: "resource-1", name: "테스트 리소스", code: "R-01", active: true, start: "2026-09-16", end: "2026-09-18", effortMd: 5, effortMm: 0.25, unsetCount: 0, overAllocated: false, tasks: [{ assignmentId: "assignment-1", taskId: fixture.tasks[2].taskId, taskName: fixture.tasks[2].name, start: "2026-09-16", end: "2026-09-18", allocationPercent: 100, effortMd: 5, effortMm: 0.25, effortConfigured: true }] }] }] } } }); return;
    }
    if (pathname === taskPath && request.method() === "POST") {
      const payload = request.postDataJSON() as CreateTaskRequest;
      fixture.posts.push(payload);
      const outcome = fixture.nextPost; fixture.nextPost = { kind: "success" };
      if (outcome.kind === "network") { await route.abort("failed"); return; }
      if (outcome.kind === "error") { await route.fulfill({ status: outcome.status, json: errorBody(outcome.code) }); return; }
      outcome.started?.resolve(); await outcome.gate?.promise;
      if (request.headers()["if-match"] !== `"${fixture.project.revision}"`) {
        await route.fulfill({ status: 412, json: errorBody("REVISION_MISMATCH") }); return;
      }
      await route.fulfill({ status: 201, json: applySuccessfulCreate(fixture, payload) }); return;
    }
    if (pathname.startsWith(`${taskPath}/`) && request.method() === "PATCH") {
      fixture.patchRequests.push(request); await route.fulfill({ status: 500, json: errorBody("UNEXPECTED_PATCH") }); return;
    }
    await route.continue();
  });
  return fixture;
}
export function ganttRoot(page: Page) { return page.locator(".project-gantt-frame[data-project-gantt-instance]"); }
export function rootAdd(page: Page) { return page.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first(); }
export function rowNamed(page: Page, name: string) { return page.locator(".project-gantt-widget .wx-row", { hasText: name }).first(); }
export async function rememberGanttRoot(page: Page): Promise<{ apiId: string; instanceId: string }> {
  const root = ganttRoot(page); await expect(root).toBeVisible();
  const instanceId = await root.getAttribute("data-project-gantt-instance");
  const apiId = await root.getAttribute("data-project-gantt-api-instance");
  expect(instanceId).toBeTruthy(); expect(apiId).toBeTruthy();
  await root.evaluate((element) => { (window as typeof window & { __issue3GanttRoot?: Element }).__issue3GanttRoot = element; });
  return { apiId: apiId!, instanceId: instanceId! };
}
export async function expectSameGanttRoot(page: Page, identity: { apiId: string; instanceId: string }): Promise<void> {
  const root = ganttRoot(page);
  await expect(root).toHaveAttribute("data-project-gantt-instance", identity.instanceId);
  await expect(root).toHaveAttribute("data-project-gantt-api-instance", identity.apiId);
  expect(await root.evaluate((element) => (window as typeof window & { __issue3GanttRoot?: Element }).__issue3GanttRoot === element)).toBe(true);
}
export async function waitForAnimationFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}
