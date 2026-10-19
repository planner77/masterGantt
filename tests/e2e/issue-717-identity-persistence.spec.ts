import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import type { ProjectLogisticsDto } from "../../src/contracts/logistics";
import type { ProjectSnapshotResponse } from "../../src/contracts/projects";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { expectRawIdentifier } from "./helpers/identifier-details";
import { openWorkspaceView } from "./helpers/workspace-navigation";

test.use(isolatedApplicationOptions);

test("#717 실제 HTTP·SQLite에서 동명 Milestone·공정의 정확한 식별자 편집·삭제·readonly 복사", async ({ page, browser, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  const origin = baseURL!;
  const created = await page.request.post("/api/projects", {
    headers: { Origin: origin },
    data: { name: "이름 우선 실제 원본 식별 검증 #717", ownerName: "E2E 자동화", description: "실제 HTTP·SQLite canonical identity 검증", editPassword: "Identity717!" },
  });
  expect(created.status(), await created.text()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string;
  const api = `/api/projects/${publicId}`;
  const getSnapshot = async () => {
    const response = await page.request.get(api);
    expect(response.status()).toBe(200);
    return await response.json() as ProjectSnapshotResponse;
  };
  const getLogistics = async () => {
    const response = await page.request.get(`${api}/logistics`);
    expect(response.status()).toBe(200);
    return (await response.json()).data.logistics as ProjectLogisticsDto;
  };
  let snapshot = await getSnapshot();
  const mutate = async (suffix: string, data: unknown) => {
    const revision = snapshot.data.project.revision;
    const response = await page.request.post(`${api}${suffix}`, {
      headers: { Origin: origin, "If-Match": `"${revision}"` }, data,
    });
    expect(response.status(), await response.text()).toBe(201);
    snapshot = await getSnapshot();
    expect(snapshot.data.project.revision).toBe(revision + 1);
  };
  const milestoneName = "동명 고객 인수 승인 Milestone";
  const externalIds = [1, 2].map(n => `MILESTONE-VERY-LONG-EXTERNAL-IDENTITY-WITH-CANONICAL-SUFFIX-${n}`);
  for (const externalId of externalIds) await mutate("/tasks", { name: milestoneName, externalId, type: "milestone", start: "2026-10-19", duration: 0, progress: 0 });
  const milestones = externalIds.map(externalId => snapshot.data.tasks.find(task => task.externalId === externalId)!);
  expect(milestones[0].taskId).not.toBe(milestones[1].taskId);
  const processName = "동명 입고 공정";
  const codes = [1, 2].map(n => `PROCESS-VERY-LONG-CANONICAL-CODE-WITH-DISTINCT-SUFFIX-${n}`);
  for (const code of codes) await mutate("/logistics/processes", { name: processName, code, parentProcessId: null, sortOrder: 0, active: true });
  const originalLogistics = await getLogistics();
  const processes = codes.map(code => originalLogistics.processes.find(process => process.code === code)!);
  expect(processes[0].id).not.toBe(processes[1].id);
  const initial = structuredClone(snapshot);

  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await openWorkspaceView(page, "milestones");
  const dashboard = page.getByTestId("milestone-dashboard");
  await expect(dashboard).toHaveAttribute("data-ready", "true");
  await expect(dashboard.locator("tr[data-milestone-task-id]")).toHaveCount(2);
  await dashboard.getByLabel("Milestone 검색", { exact: true }).fill(milestones[1].taskId);
  await expect(dashboard.locator("tr[data-milestone-task-id]")).toHaveCount(1);
  const stage = dashboard.locator(`tr[data-milestone-task-id="${milestones[1].taskId}"]`);
  await expectRawIdentifier(stage, "작업 ID", milestones[1].taskId);
  await expectRawIdentifier(stage, "외부 ID", externalIds[1]);
  await stage.getByRole("button", { name: `${milestoneName} Milestone 상세`, exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expectRawIdentifier(editor, "작업 ID", milestones[1].taskId);
  await expectRawIdentifier(editor, "외부 ID", externalIds[1]);
  await editor.getByLabel("작업명", { exact: true }).fill("두 번째 Milestone만 변경");
  const revisionBeforeTaskEdit = snapshot.data.project.revision;
  const [taskEdit] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `${api}/tasks/${milestones[1].taskId}`),
    editor.getByRole("button", { name: "저장", exact: true }).click(),
  ]);
  expect(taskEdit.status()).toBe(200);
  await expect(editor).toHaveCount(0);
  snapshot = await getSnapshot();
  expect(snapshot.data.project.revision).toBe(revisionBeforeTaskEdit + 1);
  expect(snapshot.data.tasks.find(task => task.taskId === milestones[0].taskId)).toEqual(initial.data.tasks.find(task => task.taskId === milestones[0].taskId));
  expect(snapshot.data.tasks.find(task => task.taskId === milestones[1].taskId)).toMatchObject({ name: "두 번째 Milestone만 변경", externalId: externalIds[1] });

  await openWorkspaceView(page, "processes");
  await page.getByLabel("물류 항목 검색", { exact: true }).fill(codes[1]);
  const processPanel = page.locator("#panel-processes");
  await expect(processPanel.locator("tbody tr")).toHaveCount(1);
  const processRow = processPanel.locator("tbody tr").first();
  await expectRawIdentifier(processRow, "공정 코드", codes[1]);
  await expectRawIdentifier(processRow, "공정 ID", processes[1].id);
  await processRow.getByRole("button", { name: "수정", exact: true }).click();
  const processEditor = page.getByRole("dialog", { name: "공정 수정", exact: true });
  await expect(processEditor.getByPlaceholder("예: PROC-01")).toHaveValue(codes[1]);
  await processEditor.getByLabel("공정명 *", { exact: true }).fill("두 번째 공정만 변경");
  const revisionBeforeProcessEdit = snapshot.data.project.revision;
  const [processEdit] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `${api}/logistics/processes/${processes[1].id}`),
    processEditor.getByRole("button", { name: "저장", exact: true }).click(),
  ]);
  expect(processEdit.status()).toBe(200);
  await expect(processEditor).toHaveCount(0);
  snapshot = await getSnapshot();
  expect(snapshot.data.project.revision).toBe(revisionBeforeProcessEdit + 1);
  const afterEditLogistics = await getLogistics();
  expect(afterEditLogistics.processes.find(process => process.id === processes[0].id)).toEqual(processes[0]);
  expect(afterEditLogistics.processes.find(process => process.id === processes[1].id)).toMatchObject({ name: "두 번째 공정만 변경", code: codes[1] });

  const readonly = await browser.newContext({ baseURL: origin, permissions: ["clipboard-read", "clipboard-write"] });
  let readonlyMutations = 0;
  try {
    const peer = await readonly.newPage();
    peer.on("request", request => { if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method()) && new URL(request.url()).pathname.startsWith(api) && !isWbsViewReadQuery(request)) readonlyMutations++; });
    await peer.goto(`/projects/${publicId}`);
    await expect(peer.getByText("읽기 전용", { exact: true }).first()).toBeVisible();
    await openWorkspaceView(peer, "milestones");
    const readonlyDashboard = peer.getByTestId("milestone-dashboard");
    await readonlyDashboard.getByLabel("Milestone 검색", { exact: true }).fill(milestones[1].taskId);
    const readonlyStage = readonlyDashboard.locator(`tr[data-milestone-task-id="${milestones[1].taskId}"]`);
    const disclosure = readonlyStage.locator("details").first();
    await disclosure.locator("summary").click();
    await expect(disclosure.getByLabel("외부 ID", { exact: true })).toHaveValue(externalIds[1]);
    await disclosure.getByRole("button", { name: "작업 ID 복사", exact: true }).click();
    await expect.poll(() => peer.evaluate(() => navigator.clipboard.readText())).toBe(milestones[1].taskId);
    await expect(disclosure.getByRole("status")).toContainText("작업 ID 복사 완료");
    expect(readonlyMutations).toBe(0);
    expect(await getSnapshot()).toEqual(snapshot);
    expect(await getLogistics()).toEqual(afterEditLogistics);
  } finally { await readonly.close(); }

  await page.getByLabel("물류 항목 검색", { exact: true }).fill(processes[1].id);
  await expect(processPanel.locator("tbody tr")).toHaveCount(1);
  await processRow.getByRole("button", { name: "삭제", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "삭제 확인", exact: true });
  await expect(confirm).toContainText("두 번째 공정만 변경");
  const [deleted] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "DELETE" && new URL(response.url()).pathname === `${api}/logistics/processes/${processes[1].id}`),
    confirm.getByRole("button", { name: "삭제", exact: true }).click(),
  ]);
  expect(deleted.status()).toBe(204);
  await expect(confirm).toHaveCount(0);
  const finalLogistics = await getLogistics();
  expect(finalLogistics.processes).toEqual([processes[0]]);
  const finalSnapshot = await getSnapshot();
  expect(finalSnapshot.data.project.revision).toBe(snapshot.data.project.revision + 1);
  expect(finalSnapshot.data.tasks).toEqual(snapshot.data.tasks);
  await testInfo.attach("실제 HTTP 원본 식별 검증", { body: JSON.stringify({ publicId, milestoneTaskIds: milestones.map(task => task.taskId), externalIds, processIds: processes.map(process => process.id), codes, initialRevision: initial.data.project.revision, finalRevision: finalSnapshot.data.project.revision, readonlyMutations }, null, 2), contentType: "application/json" });
});
