import type { Locator, Page } from "@playwright/test";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { createTargetProject, targetMasterPassword } from "./fixtures/target-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import type { ProjectLogisticsDto } from "../../src/contracts/logistics";
import type { TaskProcessContextResponse } from "../../src/contracts/process-context";

// Successful reads/writes use real HTTP and disposable SQLite. Intercepts below
// only delay real requests or return explicit errors; they never invent a save.
test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, viewport: { width: 1440, height: 1000 } });

async function openEditor(page: Page, name: string) {
  await openWorkspaceView(page, "schedule");
  const row = page.locator(".project-gantt-widget .wx-row", { hasText: name }).first();
  await row.getByText(name, { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await editor.getByRole("tab", { name: /물류 연결/ }).click();
  return editor;
}

async function seedOriginals(f: Awaited<ReturnType<typeof createTargetProject>>) {
  for (const [index, code, quantity] of [[0, "AMR-A", 10], [1, "AMR-B", 5]] as const) {
    await f.mutate("/logistics/equipment", {
      processId: f.processIds[index], code,
      name: `공유 이름 AMR ${code} · 장거리 통합 물류 반송 설비 Long operational equipment`,
      equipmentType: "amr", managementUnit: "fleet", quantity,
    });
  }
  for (const [index, code] of [[0, "ACS-A"], [1, "ACS-B"]] as const) {
    await f.mutate("/logistics/systems", { code, name: `ACS ${code}`, systemType: "acs", layer: "controller", scope: "processes", processIds: [f.processIds[index]] });
  }
  await f.mutate("/logistics/systems", { code: "MCS", name: "공유 MCS 원본", systemType: "mcs", layer: "coordinator", scope: "project" });
  return (await f.snapshot()).data.logistics!;
}

async function readLinks(page: Page, api: string, taskId: string) {
  const response = await page.request.get(`${api}/tasks/${taskId}/logistics-links`);
  expect(response.status()).toBe(200);
  return (await response.json()).data.links;
}

function expectOriginals(current: ProjectLogisticsDto, initial: ProjectLogisticsDto) {
  expect(current.equipment.map(row => row.id).sort()).toEqual(initial.equipment.map(row => row.id).sort());
  expect(current.systems.map(row => row.id).sort()).toEqual(initial.systems.map(row => row.id).sort());
  expect(current.equipment.reduce((sum, row) => sum + row.quantity, 0)).toBe(15);
  expect(current.systems.filter(row => row.systemType === "mcs")).toHaveLength(1);
}

async function assertEditorGeometry(page: Page, editor: Locator, width: number) {
  const geometry = await editor.evaluate(dialog => {
    const bounds = dialog.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right, viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth, dialog: dialog.scrollWidth, client: dialog.clientWidth };
  });
  await test.info().attach(`issue-726-task-${width}px`, { body: Buffer.from(JSON.stringify(geometry)), contentType: "application/json" });
  expect(geometry.document, `${width}px document overflow`).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(width + 1);
  expect(geometry.dialog, `${width}px dialog content overflow`).toBeLessThanOrEqual(geometry.client + 1);
  await test.info().attach(`issue-726-task-${width}px.png`, { body: await editor.screenshot(), contentType: "image/png" });
  await expect(page.getByRole("dialog", { name: "작업 정보", exact: true })).toHaveCount(1);
}

test("#726 Target0에서 기존 Task에 원본 설비·System 직접 연결, 중복 제출 방지, reload·Summary 상속", async ({ page, isolatedApplication, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await createTargetProject(page, isolatedApplication, observeIsolatedApi);
  const originals = await seedOriginals(f);
  const initialTasks = (await f.snapshot()).data.tasks;
  await page.reload();
  let editor = await openEditor(page, f.task.name);
  const equipment = editor.getByRole("group", { name: /관련 설비/ });
  const systems = editor.getByRole("group", { name: /관련 물류 시스템/ });
  // #717 main integration: the full canonical code/ID is available on demand, not the default label.
  const equipmentIdentity = equipment.locator("details").first();
  await expect(equipment.getByRole("checkbox", { name: /AMR-A/ })).toBeEnabled();
  await equipmentIdentity.locator("summary").click();
  await expect(equipmentIdentity.getByRole("textbox", { name: "설비 코드", exact: true })).toHaveValue("AMR-A");
  await expect(equipmentIdentity.getByRole("textbox", { name: "설비 ID", exact: true })).toHaveValue(originals.equipment.find(item => item.code === "AMR-A")!.id);
  await equipmentIdentity.locator("summary").click();
  await equipment.getByRole("checkbox", { name: /AMR-A/ }).check();
  await equipment.getByRole("checkbox", { name: /AMR-B/ }).check();
  await systems.getByRole("checkbox", { name: /ACS-A/ }).check();
  await systems.getByRole("checkbox", { name: /공유 MCS 원본/ }).check();
  const pattern = `**/api/projects/${f.publicId}/tasks/${f.task.taskId}/logistics-links`;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  await page.route(pattern, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++;
    await gate;
    await route.continue();
  });
  await editor.getByRole("button", { name: "물류 연결 저장", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await expect(editor.getByRole("button", { name: /물류 연결 저장 중/ })).toBeDisabled();
  await expect(equipment.getByRole("checkbox", { name: /AMR-A/ })).toBeDisabled();
  release();
  await expect(editor.getByRole("button", { name: "물류 연결 저장", exact: true })).toBeEnabled();
  await page.unroute(pattern);
  expect(writes).toBe(1);
  const links = await readLinks(page, f.api, f.task.taskId);
  expect(links.directEquipmentLinks.map((row: { equipmentId: string }) => row.equipmentId).sort()).toEqual(originals.equipment.map(row => row.id).sort());
  expect(links.directSystemLinks.map((row: { systemId: string }) => row.systemId).sort()).toEqual(originals.systems.filter(row => row.code !== "ACS-B").map(row => row.id).sort());
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await page.reload();
  editor = await openEditor(page, f.task.name);
  await expect(editor.getByRole("group", { name: /관련 설비/ }).getByRole("checkbox", { name: /AMR-A/ })).toBeChecked();
  await expect(editor.getByRole("group", { name: /관련 물류 시스템/ }).getByRole("checkbox", { name: /공유 MCS 원본/ })).toBeChecked();
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  editor = await openEditor(page, f.parentTask.name);
  const summarySystems = editor.getByRole("group", { name: /관련 물류 시스템/ });
  await summarySystems.getByRole("checkbox", { name: /ACS-B/ }).check();
  await summarySystems.getByRole("checkbox", { name: "ACS ACS-B 시스템 하위 작업 포함", exact: true }).check();
  await editor.getByRole("button", { name: "물류 연결 저장", exact: true }).click();
  await expect.poll(async () => (await readLinks(page, f.api, f.task.taskId)).inheritedSystemLinks.length).toBe(1);
  const child = await readLinks(page, f.api, f.task.taskId);
  expect(child.inheritedSystemLinks[0].systemId).toBe(originals.systems.find(row => row.code === "ACS-B")!.id);
  expect(child.inheritedSystemLinks[0].sourceTaskId).toBe(f.parentTask.taskId);
  const snapshot = await f.snapshot();
  expectOriginals(snapshot.data.logistics!, originals);
  expect(snapshot.data.tasks).toEqual(initialTasks);
  const targets = await page.request.get(`${f.api}/logistics/targets`);
  expect(targets.status()).toBe(200);
  expect((await targets.json()).data.targets).toEqual([]);
  // These are actual server rejections over HTTP, separate from the injected
  // errors used to exercise UI draft handling in the next scenario.
  const beforeRejectedWrites = await f.snapshot();
  const beforeChildLinks = await readLinks(page, f.api, f.task.taskId);
  const headers = { Origin: isolatedApplication, "If-Match": `"${beforeRejectedWrites.data.project.revision}"` };
  const linkUrl = `${f.api}/tasks/${f.task.taskId}/logistics-links`;
  const replacement = { equipmentLinks: [], systemLinks: [] };
  const evidence: Array<{ boundary: string; status: number; code?: string }> = [];
  const unchanged = async () => {
    expect(await f.snapshot()).toEqual(beforeRejectedWrites);
    expect(await readLinks(page, f.api, f.task.taskId)).toEqual(beforeChildLinks);
  };
  const wrongOrigin = await page.request.put(linkUrl, { headers: { ...headers, Origin: "https://untrusted.invalid" }, data: replacement });
  expect(wrongOrigin.status()).toBe(403);
  evidence.push({ boundary: "wrong-origin", status: wrongOrigin.status() });
  await unchanged();
  const stale = await page.request.put(linkUrl, { headers: { ...headers, "If-Match": `"${beforeRejectedWrites.data.project.revision - 1}"` }, data: replacement });
  expect(stale.status()).toBe(412);
  evidence.push({ boundary: "stale-revision", status: stale.status() });
  await unchanged();
  const unauthenticated = await page.context().browser()!.newContext();
  try {
    const readonly = await unauthenticated.request.put(linkUrl, { headers, data: replacement });
    expect(readonly.status()).toBe(401);
    evidence.push({ boundary: "missing-edit-session", status: readonly.status() });
    await unchanged();
  } finally {
    await unauthenticated.close();
  }
  const linkedEquipment = originals.equipment.find(row => row.code === "AMR-A")!;
  const conflict = await page.request.patch(`${f.api}/logistics/equipment/${linkedEquipment.id}`, { headers, data: {
    processCatalogRevision: f.catalog.data.processCatalogRevision,
    workAreaLinks: [{ processId: f.processIds[0], workAreaId: f.catalog.data.workAreas.find(row => row.code === "WA-A")!.id }],
  } });
  expect(conflict.status()).toBe(409);
  const conflictBody = await conflict.json();
  expect(conflictBody.error.code).toBe("EQUIPMENT_WORK_AREA_IN_USE");
  evidence.push({ boundary: "linked-equipment-workarea-change", status: conflict.status(), code: conflictBody.error.code });
  await unchanged();
  await test.info().attach("issue-726-real-http-write-boundaries", { contentType: "application/json", body: Buffer.from(JSON.stringify(evidence, null, 2)) });
});

test("#726 직접 연결 5폭·긴 이름·키보드·초안 폐기와 HTTP 403/409/412 후 보존", async ({ page, isolatedApplication, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await createTargetProject(page, isolatedApplication, observeIsolatedApi);
  const originals = await seedOriginals(f);
  await page.reload();
  let editor = await openEditor(page, f.task.name);
  const equipment = () => editor.getByRole("group", { name: /관련 설비/ });
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(equipment().getByRole("checkbox", { name: /AMR-A/ })).toBeEnabled();
    await assertEditorGeometry(page, editor, width);
    const checkbox = equipment().getByRole("checkbox", { name: /AMR-A/ });
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(editor.getByText("저장하지 않은 변경사항을 버리고 닫을까요?", { exact: true })).toBeVisible();
    await expect(editor.getByRole("button", { name: "계속 편집", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(checkbox).toBeChecked();
    await editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
    await editor.getByRole("button", { name: "변경사항 버리고 다시 불러오기", exact: true }).click();
    await expect(equipment().getByRole("checkbox", { name: /AMR-A/ })).not.toBeChecked();
  }
  const revision = (await f.snapshot()).data.project.revision;
  const pattern = `**/api/projects/${f.publicId}/tasks/${f.task.taskId}/logistics-links`;
  for (const status of [403, 409, 412]) {
    await equipment().getByRole("checkbox", { name: /AMR-A/ }).check();
    await page.route(pattern, async route => route.request().method() === "PUT"
      ? route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ message: `검증 오류 ${status}` }) })
      : route.continue());
    await editor.getByRole("button", { name: "물류 연결 저장", exact: true }).click();
    await expect(editor.getByRole("alert").filter({ hasText: status === 412 ? /Revision/ : status === 403 ? "물류 연결 편집 권한이 없습니다." : `검증 오류 ${status}` })).toBeVisible();
    await expect(equipment().getByRole("checkbox", { name: /AMR-A/ })).toBeChecked();
    expect((await readLinks(page, f.api, f.task.taskId)).directEquipmentLinks).toEqual([]);
    expect((await f.snapshot()).data.project.revision).toBe(revision);
    await page.unroute(pattern);
    await editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
    await editor.getByRole("button", { name: "변경사항 버리고 다시 불러오기", exact: true }).click();
    await expect(equipment().getByRole("checkbox", { name: /AMR-A/ })).not.toBeChecked();
  }
  await equipment().getByRole("checkbox", { name: /AMR-A/ }).check();
  await page.route(pattern, route => route.request().method() === "PUT"
    ? route.fulfill({ status: 401, json: { error: { code: "EDIT_SESSION_REQUIRED" } } })
    : route.continue());
  await editor.getByRole("button", { name: "물류 연결 저장", exact: true }).click();
  await expect(editor.getByRole("alert").filter({ hasText: /편집 권한이 만료/ })).toBeVisible();
  await expect(equipment().getByRole("checkbox", { name: /AMR-A/ })).toBeChecked();
  await expect(equipment().getByRole("checkbox", { name: /AMR-A/ })).toBeDisabled();
  expect((await readLinks(page, f.api, f.task.taskId)).directEquipmentLinks).toEqual([]);
  await page.unroute(pattern);
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await editor.getByRole("button", { name: "변경사항 버리고 닫기", exact: true }).click();
  expectOriginals((await f.snapshot()).data.logistics!, originals);
  // A genuinely separate browser context exercises the server's readonly view.
  const readonlyContext = await page.context().browser()!.newContext();
  try {
    const readonly = await readonlyContext.newPage();
    await readonly.goto(`${isolatedApplication}/projects/${f.publicId}`);
    editor = await openEditor(readonly, f.task.name);
    await expect(editor.getByRole("group", { name: /관련 설비/ }).getByRole("checkbox", { name: /AMR-A/ })).toBeDisabled();
    await expect(editor.getByRole("button", { name: "물류 연결 저장", exact: true })).toHaveCount(0);
  } finally {
    await readonlyContext.close();
  }
});

test("#726 Task 공정 0..N·WorkArea self/subtree 원본 연결, 초안·오류 보존과 상위 출처 구별", async ({ page, isolatedApplication, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await createTargetProject(page, isolatedApplication, observeIsolatedApi);
  const originals = await seedOriginals(f);
  const initialTasks = (await f.snapshot()).data.tasks;
  const areaA = f.catalog.data.workAreas.find(row => row.code === "WA-A")!;
  const contextUrl = `${f.api}/tasks/${f.task.taskId}/process-context`;
  // Like the existing #667 post-Editor canonical checks, verify persisted
  // context over the same-origin browser transport, not a pooled APIRequestContext
  // socket. This is real HTTP/SQLite; no retry or mocked successful response.
  const readContext = async (taskId = f.task.taskId) => {
    const path = `/api/projects/${f.publicId}/tasks/${taskId}/process-context`;
    const response = await observeIsolatedApi(path, "GET", async () => {
      const read = await page.evaluate(async url => {
        const result = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        const raw = await result.text();
        let body: unknown = null, validJson = true;
        try { body = JSON.parse(raw); } catch { validJson = false; }
        return { status: result.status, requestId: result.headers.get("x-request-id"), body, validJson };
      }, path);
      return { status: () => read.status, headers: () => ({ "x-request-id": read.requestId ?? "" }),
        body: read.body, validJson: read.validJson };
    });
    expect(response.status(), "공정 문맥 원본 조회 HTTP status").toBe(200);
    expect(response.validJson, "공정 문맥 원본 JSON").toBe(true);
    const body = response.body as TaskProcessContextResponse;
    expect(body).toHaveProperty("data.context");
    return body.data.context;
  };
  expect((await readContext()).processLinks).toBeNull();
  await f.mutate("/logistics/processes", { name: "미매핑 활성 공정" });
  await page.reload();
  await page.route(contextUrl, route => route.abort("failed"));
  let editor = await openEditor(page, f.task.name);
  let context = editor.getByRole("region", { name: "직접 공정·작업 구역", exact: true });
  await expect(context.getByRole("alert")).toContainText("선택 0개로 처리하지 않습니다");
  await expect(context.getByRole("button", { name: "공정 0개로 명시 설정", exact: true })).toHaveCount(0);
  await page.unroute(contextUrl);
  await context.getByRole("button", { name: "공정 문맥 다시 시도", exact: true }).click();
  await expect(context).toContainText("직접 공정 미설정 (기존 데이터)");
  await context.getByRole("button", { name: "공정 0개로 명시 설정", exact: true }).click();
  const save = () => context.getByRole("button", { name: "직접 공정·작업 구역 저장", exact: true });
  await save().click();
  await expect.poll(async () => (await readContext()).processLinks).toEqual([]);
  await expect(save()).toBeDisabled();
  await expect(context).toContainText("직접 공정 0개 · 직접 작업 구역 0개");
  const unmapped = context.getByRole("checkbox", { name: /^미매핑 활성 공정 / });
  await expect(unmapped).toBeEnabled();
  await unmapped.check();
  await expect(unmapped).toBeChecked();
  await unmapped.uncheck();
  const processA = () => context.getByRole("checkbox", { name: /^A 공정 / });
  const processB = () => context.getByRole("checkbox", { name: /^B 공정 / });
  // Capture a genuine old canonical GET, then start a new reload generation.
  // Its late response must not clear a selection made against the newer read.
  let releaseOld!: () => void;
  let oldCaptured!: () => void;
  let oldFinished!: () => void;
  const oldGate = new Promise<void>(resolve => { releaseOld = resolve; });
  const captured = new Promise<void>(resolve => { oldCaptured = resolve; });
  const finished = new Promise<void>(resolve => { oldFinished = resolve; });
  let contextReads = 0;
  await page.route(contextUrl, async route => {
    if (route.request().method() !== "GET" || ++contextReads !== 1) return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    oldCaptured();
    await oldGate;
    // Aborting the old consumer is an allowed implementation. Regardless of
    // transport cancellation, assert the visible newer draft after completion.
    await route.fulfill({ response }).catch(() => undefined);
    oldFinished();
  });
  await editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
  await captured;
  await editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
  await expect(processA()).toBeEnabled();
  await processA().check();
  await expect(processA()).toBeChecked();
  await expect(save()).toBeEnabled();
  releaseOld();
  await finished;
  await expect(processA()).toBeChecked();
  await expect(save()).toBeEnabled();
  expect((await readContext()).processLinks).toEqual([]);
  await page.unroute(contextUrl);
  await processA().uncheck();
  await expect(save()).toBeDisabled();
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await processA().focus();
    await page.keyboard.press("Space");
    await expect(processA()).toBeChecked();
    await expect(context.getByRole("checkbox", { name: /A 작업구역 WA-A/ })).toBeEnabled();
    await assertEditorGeometry(page, editor, width);
    await page.keyboard.press("Escape");
    await expect(editor.getByRole("button", { name: "계속 편집", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(processA()).toBeChecked();
    await processA().uncheck();
    await expect(save()).toBeDisabled();
  }
  const revision = (await f.snapshot()).data.project.revision;
  for (const status of [403, 409, 412]) {
    await processA().check();
    await page.route(contextUrl, route => route.request().method() === "PUT"
      ? route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code: "TEST_REJECTED", message: "검증 오류" } }) })
      : route.continue());
    await save().click();
    await expect(context.getByRole("alert")).toContainText("초안");
    await expect(processA()).toBeChecked();
    expect((await readContext()).processLinks).toEqual([]);
    expect((await f.snapshot()).data.project.revision).toBe(revision);
    if (status === 412) await expect(save()).toBeDisabled();
    await page.unroute(contextUrl);
    await editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
    await editor.getByRole("button", { name: "변경사항 버리고 다시 불러오기", exact: true }).click();
    await expect(processA()).not.toBeChecked();
  }
  await processA().check();
  await processB().check();
  await expect(context).toContainText("등록된 작업 구역이 없습니다.");
  await context.getByRole("checkbox", { name: /A 작업구역 WA-A/ }).check();
  // Removing its owning process must not silently erase the area draft.
  await processA().click();
  await expect(context.getByRole("alert")).toBeVisible();
  await expect(processA()).toBeChecked();
  await expect(context.getByRole("checkbox", { name: /A 작업구역 WA-A/ })).toBeChecked();
  await save().click();
  await expect.poll(async () => (await readContext()).processLinks?.length).toBe(2);
  const childContext = await readContext();
  // Direct process links are a set; UUID order is not fixture creation (A/B) order.
  const byProcessId = (a: { processId: string }, b: { processId: string }) => a.processId.localeCompare(b.processId);
  expect([...childContext.processLinks].sort(byProcessId)).toEqual(f.processIds.map(processId => ({ processId, scope: "self" })).sort(byProcessId));
  expect(childContext.workAreaLinks).toEqual([{ processId: f.processIds[0], workAreaId: areaA.id, scope: "self" }]);
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  editor = await openEditor(page, f.parentTask.name);
  context = editor.getByRole("region", { name: "직접 공정·작업 구역", exact: true });
  await context.getByRole("checkbox", { name: /^A 공정 / }).check();
  await context.getByRole("checkbox", { name: /A 작업구역 WA-A/ }).check();
  const areaScope = context.getByRole("checkbox", { name: "A 공정 A 작업구역 작업 구역 하위 작업 포함", exact: true });
  await expect(areaScope).toBeDisabled();
  await context.getByRole("checkbox", { name: "A 공정 공정 하위 작업 포함", exact: true }).check();
  await areaScope.check();
  await context.getByRole("button", { name: "직접 공정·작업 구역 저장", exact: true }).click();
  await expect.poll(async () => (await readContext(f.parentTask.taskId)).workAreaLinks).toEqual([{ processId: f.processIds[0], workAreaId: areaA.id, scope: "subtree" }]);
  await expect(context.getByRole("button", { name: "직접 공정·작업 구역 저장", exact: true })).toBeDisabled();
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await page.reload();
  editor = await openEditor(page, f.task.name);
  context = editor.getByRole("region", { name: "직접 공정·작업 구역", exact: true });
  await expect(context).toContainText("상위 작업의 subtree 설정 (참고·읽기 전용)");
  await expect(context).toContainText(f.parentTask.name);
  await expect(context.getByRole("checkbox", { name: /^A 공정 / })).toBeChecked();
  // Explicit zero removes only direct context; the ancestor stays independent.
  await context.getByRole("checkbox", { name: /A 작업구역 WA-A/ }).uncheck();
  await context.getByRole("checkbox", { name: /^A 공정 / }).uncheck();
  await context.getByRole("checkbox", { name: /^B 공정 / }).uncheck();
  await context.getByRole("button", { name: "직접 공정·작업 구역 저장", exact: true }).click();
  await expect.poll(async () => (await readContext()).processLinks).toEqual([]);
  expect((await readContext()).workAreaLinks).toEqual([]);
  await expect(context).toContainText("상위 작업의 subtree 설정 (참고·읽기 전용)");
  expect((await readContext(f.parentTask.taskId)).processLinks).toEqual([{ processId: f.processIds[0], scope: "subtree" }]);
  const final = await f.snapshot();
  expectOriginals(final.data.logistics!, originals);
  expect(final.data.tasks).toEqual(initialTasks);
  expect((await (await page.request.get(`${f.api}/logistics/targets`)).json()).data.targets).toEqual([]);
  await context.getByRole("checkbox", { name: /^A 공정 / }).check();
  await page.route(contextUrl, route => route.request().method() === "PUT"
    ? route.fulfill({ status: 401, json: { error: { code: "EDIT_SESSION_REQUIRED" } } })
    : route.continue());
  await context.getByRole("button", { name: "직접 공정·작업 구역 저장", exact: true }).click();
  await expect(context.getByRole("alert")).toContainText("초안");
  await expect(context.getByRole("checkbox", { name: /^A 공정 / })).toBeChecked();
  await expect(context.getByRole("checkbox", { name: /^A 공정 / })).toBeDisabled();
  expect((await readContext()).processLinks).toEqual([]);
  await page.unroute(contextUrl);
});
