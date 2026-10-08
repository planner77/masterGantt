import type { APIResponse, Page, TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { ProjectSnapshotResponse, ProjectTaskDto, TaskMutationResponse } from "../../src/contracts/projects";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";

const adminPassword = "Synthetic552Admin!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: adminPassword });

async function projectFixture(page: Page, origin: string, name: string) {
  const created = await page.request.post("/api/projects", {
    headers: { Origin: origin },
    data: { name, ownerName: "E2E 자동화", description: "#552 합성 HTTP 검증", editPassword: "View552!" },
  });
  expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string;
  const api = `/api/projects/${publicId}`;
  const get = async (): Promise<ProjectSnapshotResponse> => {
    const response = await page.request.get(api);
    expect(response.status()).toBe(200);
    return await response.json() as ProjectSnapshotResponse;
  };
  let snapshot = await get();
  const headers = () => ({ Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` });
  const accept = async (response: APIResponse, expected = 200) => {
    expect(response.status(), `HTTP ${response.status()}: ${await response.text()}`).toBe(expected);
    const body = await response.json() as TaskMutationResponse;
    expect(body.data.project.revision).toBe(snapshot.data.project.revision + 1);
    expect(response.headers().etag).toBe(`"${body.data.project.revision}"`);
    snapshot = await get();
    expect(body.data.tasks).toEqual(snapshot.data.tasks);
    expect(body.data.links).toEqual(snapshot.data.links);
    return body;
  };
  const add = async (name: string, type: ProjectTaskDto["type"], parent?: ProjectTaskDto) => {
    await accept(await page.request.post(`${api}/tasks`, {
      headers: headers(),
      data: { name, type, ...(parent ? { parentTaskId: parent.taskId } : {}),
        ...(type === "summary" ? {} : { start: "2026-10-09", duration: type === "milestone" ? 0 : 2, progress: 0 }) },
    }), 201);
    return snapshot.data.tasks.find((task) => task.name === name)!;
  };
  const patch = async (task: ProjectTaskDto, data: unknown) => accept(await page.request.patch(`${api}/tasks/${task.taskId}`, { headers: headers(), data }));
  const memberships = async (changes: { taskId: string; milestoneTaskId: string | null }[]) => accept(await page.request.post(`${api}/milestone-memberships`, { headers: headers(), data: { changes } }));
  const link = async (predecessor: ProjectTaskDto, successor: ProjectTaskDto) => accept(await page.request.post(`${api}/links`, {
    headers: headers(), data: { predecessorExternalId: predecessor.externalId, successorExternalId: successor.externalId, type: "SS", lag: 0 },
  }), 201);
  const refuse = async (response: APIResponse, status: number, code: string) => {
    expect(response.status()).toBe(status);
    expect((await response.json()).error.code).toBe(code);
    expect(await get()).toEqual(snapshot);
  };
  return { publicId, api, get, headers, accept, add, patch, memberships, link, refuse, current: () => snapshot };
}

const row = (page: Page, taskId: string) => page.locator(`.project-gantt-widget .wx-row[data-id=":${taskId}"]`);
const taskMenu = (page: Page) => page.getByRole("menu", { name: "작업 메뉴", exact: true });

async function openMenu(page: Page, taskId: string) {
  const name = row(page, taskId).locator('[role="gridcell"][data-col-id=":text"] .wx-content > .wx-text').first();
  await name.scrollIntoViewIfNeeded();
  await expect(name).toBeVisible();
  await page.mouse.move(0, 0);
  await name.click({ button: "right" });
  await expect(taskMenu(page)).toBeVisible();
}

async function copyRoot(page: Page, taskId: string) {
  await row(page, taskId).locator("input[data-copy-selection]").check();
  await openMenu(page, taskId);
  await taskMenu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(taskMenu(page)).toHaveCount(0);
}

async function pasteBelow(page: Page, anchorTaskId: string, api: string) {
  await openMenu(page, anchorTaskId);
  await taskMenu(page).getByRole("menuitem", { name: "Paste", exact: true }).click();
  const below = page.getByRole("menu", { name: "Paste", exact: true }).getByRole("menuitem", { name: "Below", exact: true });
  await expect(below).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.request().method() === "POST" && new URL(candidate.url()).pathname === `${api}/task-commands`),
    below.click(),
  ]);
  return response;
}

async function evidence(info: TestInfo, name: string, data: unknown, page?: Page) {
  const jsonPath = info.outputPath(`${name}.json`);
  await writeFile(jsonPath, JSON.stringify({ environment: "Next development isolatedApplication + real HTTP + native SQLite", ...data as object }, null, 2));
  await info.attach(name, { path: jsonPath, contentType: "application/json" });
  if (page) {
    const screenPath = info.outputPath(`${name}-screen.png`);
    await page.screenshot({ path: screenPath, fullPage: true });
    await info.attach(`${name}-screen`, { path: screenPath, contentType: "image/png" });
  }
}

test("#552 실제 UI Summary Copy는 숨은 Milestone·내부 관계·소속 전체를 보존하고 표시 전환은 저장하지 않는다", async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const f = await projectFixture(page, baseURL!, "Hidden Summary Copy #552");
  const summary = await f.add("복사 원본 Summary", "summary");
  const nested = await f.add("하위 Summary", "summary", summary);
  const inherited = await f.add("상속 작업", "task", nested);
  const overridden = await f.add("Override 작업", "task", nested);
  const m1 = await f.add("숨은 단계 1", "milestone", summary);
  const m2 = await f.add("숨은 단계 2", "milestone", summary);
  const anchor = await f.add("복사 위치 Summary", "summary");
  await f.memberships([{ taskId: summary.taskId, milestoneTaskId: m1.taskId }, { taskId: overridden.taskId, milestoneTaskId: m2.taskId }]);
  await f.link(m1, m2);
  await f.patch(inherited, { baseline: { start: "2026-10-12", duration: 2 } });
  const before = f.current();
  await page.goto(`/projects/${f.publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await expect(row(page, summary.taskId)).toBeVisible();
  await expect(row(page, inherited.taskId)).toBeVisible();
  await expect(row(page, overridden.taskId)).toBeVisible();
  await expect(row(page, m1.taskId)).toHaveCount(0);
  await expect(row(page, m2.taskId)).toHaveCount(0);
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  let toggleMutations = 0, toggleProjectGets = 0;
  const observe = (request: import("@playwright/test").Request) => {
    const path = new URL(request.url()).pathname;
    if (path === f.api && request.method() === "GET") toggleProjectGets++;
    if (path.startsWith(f.api) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) toggleMutations++;
  };
  page.on("request", observe);
  const toggle = page.getByRole("button", { name: "◆ Milestone 표시", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  page.off("request", observe);
  expect(toggleMutations).toBe(0);
  expect(toggleProjectGets).toBe(0);
  expect(await f.get()).toEqual(before);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);

  await copyRoot(page, summary.taskId);
  await expect(page.locator(".project-copy-selection-status")).toContainText("숨겨진 Milestone 2개");
  const response = await pasteBelow(page, anchor.taskId, f.api);
  expect(response.request().postDataJSON()).toEqual({ kind: "copy", taskIds: [summary.taskId], anchorTaskId: anchor.taskId, placement: "after" });
  expect(response.request().headers()["if-match"]).toBe(`"${before.data.project.revision}"`);
  expect(response.status()).toBe(200);
  const body = await response.json() as TaskMutationResponse;
  const after = await f.get();
  expect(body.data.tasks).toEqual(after.data.tasks);
  expect(body.data.links).toEqual(after.data.links);
  expect(after.data.project.revision).toBe(before.data.project.revision + 1);
  const sourceIds = new Set(before.data.tasks.map((task) => task.taskId));
  const copies = after.data.tasks.filter((task) => !sourceIds.has(task.taskId));
  expect(copies).toHaveLength(6);
  expect(after.data.tasks.filter((task) => sourceIds.has(task.taskId))).toEqual(before.data.tasks);
  expect(after.data.links.filter((link) => before.data.links.some((source) => source.id === link.id))).toEqual(before.data.links);
  const copied = (source: ProjectTaskDto) => copies.find((task) => task.name === source.name)!;
  for (const source of before.data.tasks.filter((task) => task.taskId !== anchor.taskId)) {
    expect(copied(source).taskId).toMatch(/^[0-9a-f-]{36}$/);
    expect(copied(source).taskId).not.toBe(source.taskId);
    expect(copied(source).externalId).not.toBe(source.externalId);
    expect(copied(source).type).toBe(source.type);
    expect(copied(source).start).toBe(source.start);
    expect(copied(source).end).toBe(source.end);
    if (source.parentExternalId) {
      const parent = before.data.tasks.find((task) => task.externalId === source.parentExternalId)!;
      expect(copied(source).parentExternalId).toBe(copied(parent).externalId);
      expect(copied(source).siblingOrder).toBe(source.siblingOrder);
    }
  }
  expect(copied(summary).membership?.explicitMilestoneTaskId).toBe(copied(m1).taskId);
  expect(copied(inherited).membership).toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: copied(m1).taskId, inheritedFromTaskId: copied(summary).taskId });
  expect(copied(overridden).membership?.explicitMilestoneTaskId).toBe(copied(m2).taskId);
  expect(copied(inherited).baselineStart).toBeNull();
  expect(copied(m1).stageGate?.memberTaskIds).toEqual([copied(inherited).taskId]);
  expect(copied(m2).stageGate?.memberTaskIds).toEqual([copied(overridden).taskId]);
  const clonedLink = after.data.links.find((link) => !before.data.links.some((source) => source.id === link.id))!;
  expect(after.data.links).toHaveLength(2);
  expect(clonedLink).toMatchObject({ predecessorExternalId: copied(m1).externalId, successorExternalId: copied(m2).externalId, type: "SS", lag: 0, legacyMixed: false });
  expect(clonedLink.id).not.toBe(before.data.links[0].id);
  await expect(row(page, copied(summary).taskId)).toBeVisible();
  await expect(row(page, copied(m1).taskId)).toHaveCount(0);
  await expect(row(page, copied(m2).taskId)).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await page.reload();
  await expect(row(page, copied(summary).taskId)).toBeVisible();
  expect(await f.get()).toEqual(after);
  await evidence(info, "summary-copy-full-canonical", { origin: baseURL, publicId: f.publicId, sourceRootTaskId: summary.taskId, commandBody: response.request().postDataJSON(), ifMatch: response.request().headers()["if-match"], copiedTaskCount: copies.length, canonicalTaskCountBefore: before.data.tasks.length, canonicalTaskCountAfter: after.data.tasks.length, copiedTaskIds: copies.map((task) => task.taskId), hiddenMilestoneTaskIds: [copied(m1).taskId, copied(m2).taskId], copiedLinkId: clonedLink.id, beforeRevision: before.data.project.revision, afterRevision: after.data.project.revision, toggleMutations, toggleProjectGets, sourcePreserved: true, reloaded: true }, page);
});

test("#552 숨은 Milestone 삭제 확인 취소는 무변경이며 completed 외부 구성원·incident 관계 Copy는 HTTP에서 원자 거부한다", async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const f = await projectFixture(page, baseURL!, "Hidden Summary guards #552");
  const summary = await f.add("삭제 확인 Summary", "summary");
  const member = await f.add("내부 구성원", "task", summary);
  const milestone = await f.add("숨은 완료 단계", "milestone", summary);
  const outside = await f.add("외부 구성원", "task");
  const anchor = await f.add("복사 대상 Summary", "summary");
  const beforeCancel = f.current();
  await page.goto(`/projects/${f.publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await expect(row(page, milestone.taskId)).toHaveCount(0);
  let mutations = 0;
  const observe = (request: import("@playwright/test").Request) => {
    if (new URL(request.url()).pathname.startsWith(f.api) && ["POST", "PATCH", "PUT", "DELETE"].includes(request.method())) mutations++;
  };
  page.on("request", observe);
  await openMenu(page, summary.taskId);
  await taskMenu(page).getByRole("menuitem", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "작업 삭제", exact: true });
  await expect(confirmation).toContainText("총 3개 작업");
  await expect(confirmation).toContainText("WBS에서 숨긴 Milestone 1개");
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  page.off("request", observe);
  expect(mutations).toBe(0);
  expect(await f.get()).toEqual(beforeCancel);

  await f.memberships([{ taskId: summary.taskId, milestoneTaskId: milestone.taskId }, { taskId: outside.taskId, milestoneTaskId: milestone.taskId }]);
  await f.patch(member, { status: "completed" });
  await f.patch(outside, { status: "completed" });
  await f.patch(milestone, { status: "completed" });
  const command = { kind: "copy", taskIds: [summary.taskId], anchorTaskId: anchor.taskId, placement: "after", acknowledgedMembershipExclusions: true };
  expect(new Set(f.current().data.tasks.find((task) => task.taskId === milestone.taskId)!.stageGate!.memberTaskIds)).toEqual(new Set([member.taskId, outside.taskId]));
  await f.refuse(await page.request.post(`${f.api}/task-commands`, { headers: f.headers(), data: command }), 409, "COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED");
  await f.patch(milestone, { status: "not_started" });
  await f.memberships([{ taskId: outside.taskId, milestoneTaskId: null }]);
  const predecessor = await f.add("외부 선행 단계", "milestone");
  await f.link(predecessor, milestone);
  await f.patch(predecessor, { status: "completed" });
  await f.patch(milestone, { status: "completed" });
  expect(f.current().data.tasks.find((task) => task.taskId === milestone.taskId)!.stageGate!.memberTaskIds).toEqual([member.taskId]);
  await f.refuse(await page.request.post(`${f.api}/task-commands`, { headers: f.headers(), data: command }), 409, "COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED");
  await evidence(info, "summary-cancel-and-completed-boundaries", { origin: baseURL, publicId: f.publicId, cancelMutations: mutations, hiddenMilestoneCount: 1, externalMemberRejected: true, externalIncidentLinkRejected: true, status: 409, code: "COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED", revision: f.current().data.project.revision, fullSnapshotUnchangedAfterEachRejection: true });
});

test("#552 실제 Assignment Copy 거부와 UI Summary root의 stale 412·cookie 없는 401은 전체 snapshot을 보존한다", async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const f = await projectFixture(page, baseURL!, "Hidden Summary authorization #552");
  const summary = await f.add("권한 검증 Summary", "summary");
  const member = await f.add("배정 구성원", "task", summary);
  const milestone = await f.add("숨은 미완료 단계", "milestone", summary);
  const anchor = await f.add("명령 대상 Summary", "summary");
  await f.memberships([{ taskId: summary.taskId, milestoneTaskId: milestone.taskId }]);
  expect((await page.request.post("/api/resource-catalog/admin-sessions", { headers: { Origin: baseURL! }, data: { password: adminPassword } })).status()).toBe(201);
  const catalog = (await (await page.request.get("/api/resources")).json()).data;
  const resourceResponse = await page.request.post("/api/resources", { headers: { Origin: baseURL!, "If-Match": `"${catalog.revision}"` }, data: { name: "합성 배정 Resource", code: "R552", roles: ["DEVELOPER"] } });
  expect(resourceResponse.status()).toBe(201);
  const nextCatalog = (await resourceResponse.json()).data;
  const resourceId = nextCatalog.resources.find((resource: { code: string }) => resource.code === "R552").id as string;
  const assigned = await page.request.put(`${f.api}/tasks/${member.taskId}/assignments`, { headers: f.headers(), data: { catalogRevision: nextCatalog.revision, targets: [{ kind: "resource", id: resourceId, allocation: { start: null, end: null, percent: 50 } }] } });
  expect(assigned.status()).toBe(200);
  // Assignment responses are not full Task snapshots; refresh through the existing getter.
  const assignedSnapshot = await f.get();
  const command = { kind: "copy", taskIds: [summary.taskId], anchorTaskId: anchor.taskId, placement: "after" };
  const assignmentRefused = await page.request.post(`${f.api}/task-commands`, { headers: { Origin: baseURL!, "If-Match": `"${assignedSnapshot.data.project.revision}"` }, data: command });
  expect(assignmentRefused.status()).toBe(409);
  expect((await assignmentRefused.json()).error.code).toBe("TASK_COPY_ASSIGNMENTS_UNSUPPORTED");
  expect(await f.get()).toEqual(assignedSnapshot);

  await page.goto(`/projects/${f.publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await expect(row(page, milestone.taskId)).toHaveCount(0);
  await copyRoot(page, summary.taskId);
  const outsideEdit = await page.request.patch(`${f.api}/tasks/${member.taskId}`, { headers: { Origin: baseURL!, "If-Match": `"${assignedSnapshot.data.project.revision}"` }, data: { description: "UI clipboard 이후 실제 외부 저장" } });
  expect(outsideEdit.status()).toBe(200);
  const afterExternalEdit = await f.get();
  expect(afterExternalEdit.data.project.revision).toBe(assignedSnapshot.data.project.revision + 1);
  const stale = await pasteBelow(page, anchor.taskId, f.api);
  expect(stale.request().postDataJSON()).toEqual(command);
  expect(stale.request().headers()["if-match"]).toBe(`"${assignedSnapshot.data.project.revision}"`);
  expect(stale.status()).toBe(412);
  expect((await stale.json()).error.code).toBe("REVISION_MISMATCH");
  expect(await f.get()).toEqual(afterExternalEdit);
  await expect(page.getByTestId("workspace-toast")).toContainText("다른 편집 내용이 먼저 저장되었습니다");

  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await copyRoot(page, summary.taskId);
  await page.context().clearCookies();
  const unauthorized = await pasteBelow(page, anchor.taskId, f.api);
  expect(unauthorized.request().postDataJSON()).toEqual(command);
  expect(unauthorized.status()).toBe(401);
  expect((await unauthorized.json()).error.code).toBe("EDIT_SESSION_REQUIRED");
  expect(await f.get()).toEqual(afterExternalEdit);
  await expect(page.getByTestId("workspace-toast")).toContainText("편집 권한이 만료되었습니다");
  await evidence(info, "assignment-and-ui-authorization", { origin: baseURL, publicId: f.publicId, sourceRootTaskId: summary.taskId, hiddenMilestoneTaskId: milestone.taskId, assignmentCopyStatus: 409, assignmentCopyCode: "TASK_COPY_ASSIGNMENTS_UNSUPPORTED", staleUiCommandStatus: stale.status(), staleCommandBody: stale.request().postDataJSON(), unauthorizedUiCommandStatus: unauthorized.status(), unauthorizedCommandBody: unauthorized.request().postDataJSON(), revision: afterExternalEdit.data.project.revision, fullSnapshotUnchangedAfterEachRejection: true }, page);
});
