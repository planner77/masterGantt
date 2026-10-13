import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { APIResponse } from "@playwright/test";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../src/contracts/projects";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

test("#550 관리 진입 실제 HTTP·SQLite 생성/편집·전체 Gate·보호 거절·프로세스 재시작", async ({ page, baseURL, restartIsolatedApplication }, testInfo) => {
  test.setTimeout(180_000);
  const origin = baseURL!;
  const created = await page.request.post("/api/projects", {
    headers: { Origin: origin },
    data: { name: "Milestone management persistence #550", ownerName: "E2E 자동화", description: "합성 관리 경로 검증", editPassword: "Mgmt550!" },
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
  const accept = async (response: APIResponse, status = 200) => {
    expect(response.status(), `HTTP ${response.status()}: ${await response.text()}`).toBe(status);
    const before = snapshot.data.project.revision;
    const body = await response.json();
    expect(body.data.project.revision).toBe(before + 1);
    expect(response.headers().etag).toBe(`"${before + 1}"`);
    snapshot = await get();
    expect(snapshot.data.project.revision).toBe(before + 1);
    expect(body.data.tasks).toEqual(snapshot.data.tasks);
    expect(body.data.links).toEqual(snapshot.data.links);
  };
  const add = async (name: string, type: ProjectTaskDto["type"], parentTaskId?: string) => {
    await accept(await page.request.post(`${api}/tasks`, {
      headers: headers(),
      data: { name, type, ...(parentTaskId ? { parentTaskId } : { parentExternalId: null }), ...(type === "summary" ? {} : { start: "2026-10-05", duration: type === "milestone" ? 0 : 2, progress: 0 }) },
    }), 201);
    return snapshot.data.tasks.find((task) => task.name === name)!;
  };
  const patch = async (taskId: string, data: unknown) => accept(await page.request.patch(`${api}/tasks/${taskId}`, { headers: headers(), data }));
  const refuse = async (response: APIResponse, status: number, code: string) => {
    expect(response.status()).toBe(status);
    expect((await response.json()).error.code).toBe(code);
    expect(await get()).toEqual(snapshot);
  };
  const task = (id: string) => snapshot.data.tasks.find((row) => row.taskId === id)!;
  const structure = () => snapshot.data.tasks.map((row) => ({ taskId: row.taskId, parentExternalId: row.parentExternalId, siblingOrder: row.siblingOrder }));

  const summary = await add("범위 Summary", "summary");
  const child = await add("상속 작업", "task", summary.taskId);
  const overridden = await add("Override 작업", "task", summary.taskId);
  const outside = await add("현재 WBS 범위 밖 작업", "task");
  const predecessor = await add("선행 단계", "milestone");
  const manual = await add("소속 없는 수동 이벤트", "milestone");
  const originalStructure = structure();
  const lastRootOrder = Math.max(...snapshot.data.tasks.filter((row) => row.parentExternalId === null).map((row) => row.siblingOrder));

  // The management entry must use a project-root command even inside a Summary scope.
  await page.goto(`/projects/${publicId}?rootTask=${summary.taskId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  const panel = page.locator("#project-panel-milestones");
  await panel.getByRole("button", { name: "Milestone 추가", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "Milestone 추가", exact: true });
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("Milestone 이름", { exact: true }).fill("관리 목록 생성 단계");
  await createDialog.getByLabel("요청 시작일", { exact: true }).fill("2026-10-09");
  const [createResponse] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/tasks`),
    createDialog.getByRole("button", { name: "Milestone 생성", exact: true }).click(),
  ]);
  expect(createResponse.status()).toBe(201);
  const submitted = createResponse.request().postDataJSON();
  expect(submitted).toMatchObject({ type: "milestone", duration: 0, progress: 0 });
  expect(submitted).not.toHaveProperty("parentTaskId");
  const beforeCreateRevision = snapshot.data.project.revision;
  snapshot = await get();
  expect(snapshot.data.project.revision).toBe(beforeCreateRevision + 1);
  const milestone = snapshot.data.tasks.find((row) => row.name === "관리 목록 생성 단계")!;
  expect(milestone).toMatchObject({ type: "milestone", duration: 0, parentExternalId: null, siblingOrder: lastRootOrder + 1 });
  expect(structure().filter((row) => row.taskId !== milestone.taskId)).toEqual(originalStructure);
  await expect(createDialog).toHaveCount(0);

  // Successful creation opens the existing Editor for the server's new canonical ID.
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  // The Editor displays External ID; the PATCH URL below verifies public taskId identity.
  await expect(editor).toContainText(milestone.externalId);
  await editor.getByLabel("작업명", { exact: true }).fill("관리 목록 편집 단계");
  await editor.getByLabel("요청 시작일", { exact: true }).fill("2026-10-12");
  await editor.getByLabel("Description", { exact: true }).fill("합성 설명: 관리 진입의 동일 canonical identity");
  await editor.getByLabel("URL", { exact: true }).fill("https://example.com/milestone-550");
  const [editResponse] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `${api}/tasks/${milestone.taskId}`),
    editor.getByRole("button", { name: "저장", exact: true }).click(),
  ]);
  expect(editResponse.status()).toBe(200);
  const beforeEditRevision = snapshot.data.project.revision;
  await expect(editor).toHaveCount(0);
  snapshot = await get();
  expect(snapshot.data.project.revision).toBe(beforeEditRevision + 1);
  expect(task(milestone.taskId)).toMatchObject({ name: "관리 목록 편집 단계", requestedStart: "2026-10-12", start: "2026-10-12", end: "2026-10-12", duration: 0, description: "합성 설명: 관리 진입의 동일 canonical identity", url: "https://example.com/milestone-550", parentExternalId: null, siblingOrder: lastRootOrder + 1 });

  await accept(await page.request.post(`${api}/milestone-memberships`, { headers: headers(), data: { changes: [
    { taskId: summary.taskId, milestoneTaskId: milestone.taskId },
    { taskId: overridden.taskId, milestoneTaskId: predecessor.taskId },
    { taskId: outside.taskId, milestoneTaskId: milestone.taskId },
  ] } }));
  expect(task(child.taskId).membership).toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: milestone.taskId, inheritedFromTaskId: summary.taskId });
  expect(task(overridden.taskId).membership?.effectiveMilestoneTaskId).toBe(predecessor.taskId);
  expect(new Set(task(milestone.taskId).stageGate?.memberTaskIds)).toEqual(new Set([child.taskId, outside.taskId]));
  expect(task(manual.taskId).stageGate).toMatchObject({ manualEvent: true, ready: null, memberProgressPercent: null, memberCount: 0 });
  await accept(await page.request.post(`${api}/links`, { headers: headers(), data: { predecessorExternalId: predecessor.externalId, successorExternalId: milestone.externalId, type: "SS", lag: 0 } }), 201);
  const stageLink = snapshot.data.links.find((link) => link.predecessorExternalId === predecessor.externalId)!;
  await accept(await page.request.post(`${api}/links`, { headers: headers(), data: { predecessorExternalId: child.externalId, successorExternalId: outside.externalId, type: "SS", lag: 0 } }), 201);
  expect(task(milestone.taskId).stageGate).toMatchObject({ predecessorMilestoneTaskIds: [predecessor.taskId], incompletePredecessorMilestoneTaskIds: [predecessor.taskId], blocked: true, ready: false });
  await refuse(await page.request.post(`${api}/links`, { headers: headers(), data: { predecessorExternalId: child.externalId, successorExternalId: milestone.externalId, type: "SS", lag: 0 } }), 409, "MIXED_DEPENDENCY_ENDPOINT");
  await refuse(await page.request.post(`${api}/links`, { headers: headers(), data: { predecessorExternalId: summary.externalId, successorExternalId: milestone.externalId, type: "SS", lag: 0 } }), 409, "SUMMARY_DEPENDENCY_ENDPOINT");
  await refuse(await page.request.patch(`${api}/tasks/${milestone.taskId}`, { headers: headers(), data: { status: "completed" } }), 409, "MILESTONE_NOT_READY");
  await patch(child.taskId, { status: "completed" });
  await patch(outside.taskId, { status: "completed" });
  expect(task(milestone.taskId).stageGate).toMatchObject({ memberProgressPercent: 100, membersCompleted: true, ready: false, blocked: true });
  expect(task(milestone.taskId).status).toBe("not_started");
  await patch(overridden.taskId, { status: "completed" });
  await patch(predecessor.taskId, { status: "completed" });
  expect(task(milestone.taskId).stageGate).toMatchObject({ ready: true, blocked: false });
  await patch(milestone.taskId, { status: "completed" });
  await refuse(await page.request.post(`${api}/milestone-memberships`, { headers: headers(), data: { changes: [{ taskId: outside.taskId, milestoneTaskId: null }] } }), 409, "COMPLETED_MILESTONE_STRUCTURE_LOCKED");
  await refuse(await page.request.patch(`${api}/links/${stageLink.id}`, { headers: headers(), data: { lag: 1 } }), 409, "COMPLETED_MILESTONE_STRUCTURE_LOCKED");
  await refuse(await page.request.post(`${api}/tasks`, { headers: headers(), data: { name: "완료 소속 추가 거절", type: "task", parentTaskId: summary.taskId, start: "2026-10-05", duration: 1, progress: 0 } }), 409, "COMPLETED_MILESTONE_STRUCTURE_LOCKED");
  await patch(child.taskId, { status: "in_progress" });
  expect(task(milestone.taskId)).toMatchObject({ status: "completed", progress: 100, stageGate: { completionInconsistent: true } });

  // Acknowledgement cannot make a partial completed stage copy preserve full E/explicit/link boundaries.
  await refuse(await page.request.post(`${api}/task-commands`, { headers: headers(), data: {
    kind: "copy", taskIds: [milestone.taskId], anchorTaskId: manual.taskId, placement: "after", acknowledgedMembershipExclusions: true,
  } }), 409, "COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED");
  // A completed manual event with no members, explicit sources or incident links is fully preserved by a single-M copy.
  await patch(manual.taskId, { status: "completed" });
  const manualBeforeCopy = structuredClone(task(manual.taskId));
  const beforeCopyIds = new Set(snapshot.data.tasks.map((row) => row.taskId));
  await accept(await page.request.post(`${api}/task-commands`, { headers: headers(), data: {
    kind: "copy", taskIds: [manual.taskId], anchorTaskId: milestone.taskId, placement: "after",
  } }));
  const copies = snapshot.data.tasks.filter((row) => !beforeCopyIds.has(row.taskId));
  expect(copies).toHaveLength(1);
  const manualCopy = copies[0];
  expect(manualCopy.taskId).not.toBe(manual.taskId);
  expect(manualCopy.externalId).not.toBe(manual.externalId);
  expect(manualCopy).toMatchObject({ name: manual.name, type: "milestone", parentExternalId: null, siblingOrder: lastRootOrder + 2, duration: 0, status: "completed", progress: 100, stageGate: { manualEvent: true, ready: null, memberProgressPercent: null, memberTaskIds: [], predecessorMilestoneTaskIds: [], completionInconsistent: false } });
  expect(task(manual.taskId)).toEqual(manualBeforeCopy);

  const validPatch = { name: "거절되므로 저장되지 않는 합성 이름" };
  const readonly = await page.context().browser()!.newContext({ baseURL: origin });
  try {
    await refuse(await readonly.request.patch(`${api}/tasks/${milestone.taskId}`, { headers: headers(), data: validPatch }), 401, "EDIT_SESSION_REQUIRED");
  } finally { await readonly.close(); }
  await refuse(await page.request.patch(`${api}/tasks/${milestone.taskId}`, { headers: { ...headers(), Origin: "https://wrong-origin.example" }, data: validPatch }), 403, "ORIGIN_NOT_ALLOWED");
  await refuse(await page.request.patch(`${api}/tasks/${milestone.taskId}`, { headers: { Origin: origin }, data: validPatch }), 428, "PRECONDITION_REQUIRED");
  await refuse(await page.request.patch(`${api}/tasks/${milestone.taskId}`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision - 1}"` }, data: validPatch }), 412, "REVISION_MISMATCH");
  await refuse(await page.request.post(`${api}/tasks`, { headers: headers(), data: { name: "명시 null 부모 거절", type: "milestone", parentTaskId: null, start: "2026-10-05", duration: 0, progress: 0 } }), 400, "INVALID_REQUEST");

  const durableSnapshot = snapshot;
  await restartIsolatedApplication();
  expect(await get()).toEqual(durableSnapshot);
  await page.reload();
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  const durableRow = panel.locator(`tr[data-milestone-task-id="${milestone.taskId}"]`);
  await durableRow.getByRole("button", { name: "관리 목록 편집 단계 Milestone 상세", exact: true }).click();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("관리 목록 편집 단계");
  await expect(editor).toContainText(milestone.externalId);
  await expect(editor).toContainText("완료 기록과 현재 소속/선행 상태가 일치하지 않습니다");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  expect(await get()).toEqual(durableSnapshot);

  const repositoryRoot = resolve(__dirname, "../..");
  const files = ["tests/e2e/milestone-management-persistence.spec.ts", "tests/e2e/fixtures/isolated-application.ts", "src/server/projects/project-service-core.ts", "src/domain/milestones/stage-gates.ts"];
  const sourceHashes = Object.fromEntries(await Promise.all(files.map(async (file) => [file, createHash("sha256").update(await readFile(resolve(repositoryRoot, file))).digest("hex")])));
  await testInfo.attach("issue-550-sqlite-http-restart", { body: JSON.stringify({ environment: "Next development isolatedApplication + real SQLite", restarted: true, publicId, revision: durableSnapshot.data.project.revision, taskIds: durableSnapshot.data.tasks.map((row) => row.taskId), milestoneTaskId: milestone.taskId, parentExternalId: null, siblingOrder: lastRootOrder + 1, fullMemberTaskIds: task(milestone.taskId).stageGate?.memberTaskIds, directPredecessorTaskIds: task(milestone.taskId).stageGate?.predecessorMilestoneTaskIds, completedManualCopy: { sourceTaskId: manual.taskId, copiedTaskId: manualCopy.taskId, manualEvent: true, ready: null }, rejectedPartialCompletedCopy: "COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED", rejectedHttpStatuses: [401, 403, 428, 412, 409, 400], legacyExistingMixed: "Separate real SQLite service regression; this browser fixture does not scan or write its database", sourceHashes }, null, 2), contentType: "application/json" });
});

test("#550 실제 빈 프로젝트→Milestone-only 관리·상세/소속/관계 조회·readonly", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  const origin = baseURL!;
  const created = await page.request.post("/api/projects", { headers: { Origin: origin }, data: {
    name: "Milestone-only management #550", ownerName: "E2E 자동화", description: "합성 빈 프로젝트", editPassword: "Mgmt550!",
  } });
  expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string;
  const api = `/api/projects/${publicId}`;
  const get = async (): Promise<ProjectSnapshotResponse> => {
    const response = await page.request.get(api);
    expect(response.status()).toBe(200);
    return await response.json() as ProjectSnapshotResponse;
  };
  const empty = await get();
  expect(empty.data.tasks).toEqual([]);
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  const panel = page.locator("#project-panel-milestones");
  await expect(panel).toContainText("프로젝트에 Milestone이 없습니다.");
  await expect(panel.getByRole("button", { name: "Milestone 추가", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Milestone 추가", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "Milestone 추가", exact: true });
  await createDialog.getByLabel("Milestone 이름", { exact: true }).fill("일반 작업 없는 첫 Milestone");
  await createDialog.getByLabel("요청 시작일", { exact: true }).fill("2026-10-12");
  const [response] = await Promise.all([
    page.waitForResponse((result) => result.request().method() === "POST" && new URL(result.url()).pathname === `${api}/tasks`),
    createDialog.getByRole("button", { name: "Milestone 생성", exact: true }).click(),
  ]);
  expect(response.status()).toBe(201);
  const snapshot = await get();
  expect(snapshot.data.project.revision).toBe(empty.data.project.revision + 1);
  expect(snapshot.data.tasks).toHaveLength(1);
  const milestone = snapshot.data.tasks[0];
  expect(milestone).toMatchObject({ type: "milestone", parentExternalId: null, siblingOrder: 0, duration: 0, start: "2026-10-12", end: "2026-10-12", stageGate: { memberCount: 0, manualEvent: true, ready: null, memberProgressPercent: null } });
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(milestone.name);
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  const row = panel.locator(`tr[data-milestone-task-id="${milestone.taskId}"]`);
  await expect(row).toContainText("수동 이벤트 · Ready N/A");

  let protectedMutations = 0;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method()) &&
      (path === `${api}/tasks` || path.startsWith(`${api}/tasks/`) || path === `${api}/milestone-memberships` || path.startsWith(`${api}/links`))) protectedMutations++;
  });
  await row.getByRole("button", { name: `${milestone.name} Milestone 상세`, exact: true }).click();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(milestone.name);
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await row.getByRole("button", { name: `${milestone.name} 소속 작업 조회`, exact: true }).click();
  await expect(editor.getByRole("tab", { name: /소속 작업/ })).toHaveAttribute("aria-selected", "true");
  await expect(editor).toContainText("유효 일반 작업 0개");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await row.getByRole("button", { name: `${milestone.name} 관리`, exact: true }).click();
  await page.getByRole("dialog", { name: `${milestone.name} 관리`, exact: true }).getByRole("button", { name: "관계 조회·관리", exact: true }).click();
  await expect(editor.getByRole("tab", { name: /관계/ })).toHaveAttribute("aria-selected", "true");
  await expect(editor).toContainText("선행 작업 (0)");
  await expect(editor).toContainText("후행 작업 (0)");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  expect(protectedMutations).toBe(0);
  expect(await get()).toEqual(snapshot);

  const readonly = await page.context().browser()!.newContext({ baseURL: origin });
  try {
    const readonlyPage = await readonly.newPage();
    await readonlyPage.goto(`/projects/${publicId}`);
    await readonlyPage.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
    const readonlyPanel = readonlyPage.locator("#project-panel-milestones");
    await expect(readonlyPanel.getByRole("button", { name: "Milestone 추가", exact: true })).toBeDisabled();
    await readonlyPanel.locator(`tr[data-milestone-task-id="${milestone.taskId}"]`).getByRole("button", { name: `${milestone.name} Milestone 상세`, exact: true }).click();
    const readonlyEditor = readonlyPage.getByRole("dialog", { name: "작업 정보", exact: true });
    await expect(readonlyEditor.getByLabel("작업명", { exact: true })).toHaveValue(milestone.name);
    await expect(readonlyEditor.getByLabel("작업명", { exact: true })).toHaveAttribute("readonly", "");
    await readonlyEditor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
    const refused = await readonly.request.post(`${api}/tasks`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data: { name: "readonly 추가 거절", type: "milestone", start: "2026-10-12", duration: 0, progress: 0 } });
    expect(refused.status()).toBe(401);
    expect((await refused.json()).error.code).toBe("EDIT_SESSION_REQUIRED");
  } finally { await readonly.close(); }
  expect(await get()).toEqual(snapshot);
  await testInfo.attach("issue-550-empty-milestone-only", { body: JSON.stringify({ environment: "Next development isolatedApplication + real SQLite", emptyTaskCount: 0, milestoneOnlyTaskCount: 1, publicId, milestoneTaskId: milestone.taskId, projectRevision: snapshot.data.project.revision, manualEvent: true, ready: null, protectedNavigationMutations: protectedMutations, readonlyCreateStatus: 401 }, null, 2), contentType: "application/json" });
});
