import { expect, type Page, type Request } from "@playwright/test";
import type { ProjectDto, ProjectLinkDto, ProjectTaskDto, UpdateTaskRequest } from "../../../src/contracts/projects";
import { createWorkingCalendar } from "../../../src/domain/scheduling/calendar";
import { scheduleLeaf } from "../../../src/domain/scheduling/leaf";
import { normalizeTaskStatusProgress, taskStatusFromProgress } from "../../../src/domain/task-status";
import { chooseTaskInformation } from "../helpers/task-context-menu";

export const publicId = "a3405d3d-8cb4-4da4-9b0f-43a5de330004";
const apiPath = `/api/projects/${publicId}`;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (page: Page, name: string) => page.locator(".project-gantt-widget .wx-row", { hasText: name }).first();
const rowByTaskId = (page: Page, taskId: string) => page.locator(`.project-gantt-widget .wx-table-container .wx-row[data-id=":${taskId}"]`).first();
export const editor = (page: Page) => page.getByRole("dialog", { name: "작업 정보", exact: true });
export const relationEditor = (page: Page) => page.getByRole("dialog", { name: "작업 관계 관리 (Relation Editor)", exact: true });
const frame = (page: Page) => page.locator(".project-gantt-frame");

function task(n: number, name: string, extra: Partial<ProjectTaskDto> = {}): ProjectTaskDto {
  return { taskId: id(n), externalId: `EDITOR-${n}`, name, type: "task", scheduleMode: "auto", requestedStart: "2026-09-18", start: "2026-09-18", end: "2026-09-18", duration: 1, progress: 10, status: "in_progress", parentExternalId: null, siblingOrder: n, ...extra };
}

export interface Fixture {
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

export async function setup(page: Page, options: { editable?: boolean; links?: boolean; assignmentTargets?: boolean; milestonePeer?: boolean; longList?: boolean } = {}): Promise<Fixture> {
  await page.clock.setFixedTime(new Date("2026-09-16T12:00:00Z"));
  const fixture: Fixture = {
    project: { publicId, name: "Task Editor fixture", description: "Issue #4", status: "planned", revision: 20, calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-09-21", name: "Fixture holiday" }] } },
    tasks: [
      task(1, "Summary", { type: "summary", requestedStart: null }),
      task(2, "Child", { parentExternalId: "EDITOR-1" }),
      task(3, "Alpha leaf", { requestedStart: "2026-09-16", start: "2026-09-16", end: "2026-09-16" }),
      task(4, "Beta leaf", { description: "긴 설명과 English description ".repeat(100), url: "https://example.com/" + "long-path-segment/".repeat(90), baselineStart: "2026-09-18", baselineDuration: 9999, baselineEnd: "2065-01-16" }),
      task(5, "Milestone", { type: "milestone", duration: 0, requestedStart: "2026-09-23", start: "2026-09-23", end: "2026-09-23" }),
      ...(options.milestonePeer ? [task(6, "Milestone peer", { type: "milestone", duration: 0, requestedStart: "2026-09-24", start: "2026-09-24", end: "2026-09-24" })] : []),
    ],
    links: options.links ? [{ id: id(90), predecessorExternalId: "EDITOR-3", successorExternalId: "EDITOR-4", type: "FS", lag: 0 }] : [],
    editable: options.editable ?? true, patches: [], linkMutations: [], assignmentMutations: [], nextFailure: null, gate: null, failReads: false, projectReads: 0,
  };
  fixture.tasks[3].baselineEnd = scheduleLeaf({ type: "task", requestedStart: "2026-09-18", duration: 9999, scheduleMode: "auto" }, createWorkingCalendar(fixture.project.calendar)).end;
  fixture.tasks[3].name = "긴 작업명 English ".repeat(12).slice(0, 200);
  if (options.longList) {
    fixture.tasks[3].parentExternalId = "EDITOR-1";
    for (let index = 50; index < 76; index++) fixture.tasks.push(task(index, `Geometry scroll task ${index}`, { parentExternalId: "EDITOR-1" }));
  }
  const assignmentTargets = options.assignmentTargets ? [
    { kind: "resource" as const, id: id(70), name: "Resource A", code: "RES-A", active: true, roles: ["PI", "DEVELOPER", "EQUIPMENT_OWNER"] as const },
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
      await route.fulfill({ json: { data: { projectRevision: fixture.project.revision, catalogRevision: 1, assignments: options.assignmentTargets ? [{ id: id(72), taskId: id(4), target: { kind: "resource", id: id(70) }, role: "PI", allocation: { start: "2026-09-18", end: "2026-09-25", percent: 99 } }] : [], targets: assignmentTargets } } });
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
    if (path === `${apiPath}/resource-workload` && request.method() === "GET") {
      await route.fulfill({ json: { data: { projectRevision: fixture.project.revision, catalogRevision: 1, range: { from: "2026-09-01", to: "2026-09-30" }, mdPerMm: 20, grandTotalMd: 0, grandTotalMm: 0, unsetCount: 0, asOfDate: "2026-09-18", timezone: "Asia/Seoul", unspecifiedRoleCount: 0, overAllocatedResourceCount: 0, roleTotals: ["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"].map((role) => ({ role, assignmentCount: 0, effortMd: 0, effortMm: 0, unsetCount: 0 })), groups: [] } } }); return;
    }
    if (path === `${apiPath}/logistics/dashboard` && request.method() === "GET") {
      await route.fulfill({ json: { data: { projectRevision: fixture.project.revision, catalogRevision: 1, asOfDate: "2026-09-18", timezone: "Asia/Seoul", calculatedAt: "2026-09-18T00:00:00Z", horizonDays: 30, systemView: "direct", activeOnly: true, kpi: { progressPercent: null, totalDuration: 0, taskCount: 0, overdueTaskCount: 0, overdueTaskIds: [], milestoneTotalCount: 0, milestoneOverdueCount: 0, milestoneOverdueIds: [], milestoneUpcomingCount: 0, milestoneUpcomingIds: [] }, effort: { plannedMd: 0, plannedMm: 0, mdPerMm: 20, unsetAllocationCount: 0, workloadRange: { from: null, to: null } }, quality: { unlinkedLeafTaskCount: 0, totalLeafTaskCount: 0, unlinkedLeafTaskPercent: null, equipmentWithoutPrimaryControllerCount: 0, equipmentWithoutOwnerCount: 0, systemsWithoutPrimaryPICount: 0, totalEquipmentMasterCount: 0, totalEquipmentQuantity: 0 }, breakdowns: { processes: [], equipment: [], systems: [] }, includedTaskIds: [], includedMilestoneIds: [] } } }); return;
    }
    if (path === `${apiPath}/logistics` && request.method() === "GET") {
      await route.fulfill({ json: { data: { project: fixture.project, logistics: { processes: [], equipment: [], systems: [], systemLinks: [] }, permission: fixture.editable ? "edit" : "readonly" } } }); return;
    }
    if (path.startsWith(`${apiPath}/tasks/`) && path.endsWith("/logistics-links") && request.method() === "GET") {
      await route.fulfill({ json: { data: { taskId: path.split("/").at(-2), links: { taskId: path.split("/").at(-2), directEquipmentLinks: [], directSystemLinks: [], inheritedEquipmentLinks: [], inheritedSystemLinks: [], effectiveEquipmentIds: [], effectiveSystemIds: [] } } } }); return;
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
  await expect(rowByTaskId(page, id(4))).toBeVisible();
  await expect(frame(page)).toHaveAttribute("data-project-gantt-api-instance", /svar-api-/);
  return fixture;
}

export async function openRow(page: Page, name = "Beta leaf") {
  const targetRow = name === "Beta leaf" ? rowByTaskId(page, id(4)) : name === "Summary" ? rowByTaskId(page, id(1)) : row(page, name);
  if (name === "Beta leaf" || name === "Summary") {
    await expect(targetRow).toBeVisible();
    await targetRow.click({ button: "right", position: { x: 12, y: 19 } });
  } else {
    await targetRow.getByText(name, { exact: true }).click({ button: "right" });
  }
  await chooseTaskInformation(page);
  await expect(editor(page).getByLabel("작업명", { exact: true })).toHaveValue(name === "Beta leaf" ? "긴 작업명 English ".repeat(12).slice(0, 200) : name);
  await expect(editor(page)).toHaveCount(1);
}

export async function cancel(page: Page) {
  await editor(page).getByRole("button", { name: "취소", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
}
