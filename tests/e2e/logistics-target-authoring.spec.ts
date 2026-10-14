import { mkdir } from "node:fs/promises";
import type { Locator } from "@playwright/test";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { createTargetProject, targetMasterPassword } from "./fixtures/target-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import type { LogisticsTargetListResponse } from "../../src/contracts/logistics-targets";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword });

async function addInstance(dialog: Locator, kind: "equipment" | "system", code: string, name: string, type: string, quantity = 1) {
  await dialog.getByRole("combobox", { name: "종류", exact: true }).selectOption(kind);
  await dialog.getByRole("combobox", { name: "유형", exact: true }).selectOption(type);
  await dialog.getByLabel("인스턴스 코드", { exact: true }).fill(code);
  await dialog.getByLabel("인스턴스 이름 (System은 생략 가능)", { exact: true }).fill(name);
  if (kind === "equipment") {
    await dialog.getByRole("combobox", { name: "관리 단위", exact: true }).selectOption("fleet");
    await dialog.getByLabel("원본 수량", { exact: true }).fill(String(quantity));
  } else await dialog.getByRole("combobox", { name: "System 계층", exact: true }).selectOption(type === "mcs" ? "coordinator" : "controller");
  await dialog.getByRole("button", { name: "새 인스턴스를 초안에 추가", exact: true }).click();
}

test("Target A/B 실제 생성·공유 재사용·ACS subset·동일 Task 편집·영향 및 reload 보존", async ({ page, isolatedApplication }) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const f = await createTargetProject(page, isolatedApplication);
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const before = await f.snapshot();
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: "물류 대상(Target)", exact: true }).click();
  for (const [index, letter, quantity] of [[0, "A", 10], [1, "B", 5]] as const) {
    await page.getByRole("button", { name: "Target 추가", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Target 추가", exact: true });
    await dialog.getByRole("combobox", { name: "프로젝트 공정", exact: true }).selectOption(f.processIds[index]);
    await dialog.getByLabel("Target 이름", { exact: true }).fill(`Target ${letter}`);
    await dialog.getByLabel("Target 코드", { exact: true }).fill(`TARGET-${letter}`);
    // WorkArea is deliberately omitted in B and is never required.
    if (letter === "A") await dialog.getByRole("combobox", { name: "작업 구역 (선택)", exact: true }).selectOption(f.catalog.data.workAreas[0].id);
    else expect(await dialog.getByRole("combobox", { name: "작업 구역 (선택)", exact: true }).locator("option").count()).toBe(1);
    await addInstance(dialog, "equipment", `AMR-${letter}`, `AMR ${letter}`, "amr", quantity);
    await addInstance(dialog, "system", `ACS-${letter}`, `ACS ${letter}`, "acs");
    if (letter === "A") await addInstance(dialog, "system", "MCS-1", "공유 MCS", "mcs");
    else await dialog.getByLabel(/System · 공유 MCS \(MCS-1\)/).check();
    await dialog.getByRole("button", { name: "Target 저장", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Target 상세: Target ${letter}`, exact: true })).toBeVisible();
  }
  const list = await (await page.request.get(`${f.api}/logistics/targets`)).json() as LogisticsTargetListResponse;
  const a = list.data.targets.find(target => target.code === "TARGET-A")!;
  const b = list.data.targets.find(target => target.code === "TARGET-B")!;
  expect(a.members).toHaveLength(3); expect(b.members).toHaveLength(3);
  expect(a.members.find(member => member.code === "MCS-1")!.entityId).toBe(b.members.find(member => member.code === "MCS-1")!.entityId);
  const physical = await f.snapshot();
  expect(physical.data.logistics!.equipment.reduce((sum, equipment) => sum + equipment.quantity, 0)).toBe(15);
  expect(physical.data.logistics!.systems).toHaveLength(3);
  expect(physical.data.tasks).toEqual(before.data.tasks);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);

  await page.getByRole("tab", { name: "일정", exact: true }).click();
  const row = page.locator(".project-gantt-widget .wx-row", { hasText: "통합 시운전" }).first();
  await row.getByText("통합 시운전", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await editor.getByRole("tab", { name: /물류 연결/ }).click();
  const bindings = editor.getByRole("region", { name: "작업 Target 연결", exact: true });
  await bindings.getByLabel("Target A (TARGET-A)", { exact: true }).check();
  await bindings.getByLabel("Target B (TARGET-B)", { exact: true }).check();
  await bindings.getByRole("combobox", { name: "Target A 구성원 선택", exact: true }).selectOption("subset");
  await bindings.getByLabel(/ACS A \(ACS-A\)/).check();
  const bindingSave = bindings.getByRole("button", { name: "Target 연결 저장", exact: true });
  await bindingSave.click();
  await expect(bindingSave).toBeDisabled();
  const saved = await (await page.request.get(`${f.api}/tasks/${f.task.taskId}/target-bindings`)).json();
  expect(saved.data.bindings).toHaveLength(2);
  expect(saved.data.bindings.find((binding: { targetId: string }) => binding.targetId === a.id).memberIds).toEqual([a.members.find(member => member.code === "ACS-A")!.id]);
  expect(saved.data.effective.effectiveEquipmentIds).toEqual([b.members.find(member => member.kind === "equipment")!.entityId]);
  // Re-edit persisted DTOs: read-only taskId must never leak into a PUT body.
  const originalBindingId = saved.data.bindings.find((binding: { targetId: string }) => binding.targetId === a.id).id;
  await bindings.getByRole("combobox", { name: "Target A 구성원 선택", exact: true }).selectOption("whole");
  await bindingSave.click();
  await expect.poll(async () => (await (await page.request.get(`${f.api}/tasks/${f.task.taskId}/target-bindings`)).json()).data.bindings.find((binding: { targetId: string }) => binding.targetId === a.id)?.selection).toBe("whole");
  await bindings.getByRole("combobox", { name: "Target A 구성원 선택", exact: true }).selectOption("subset");
  await bindings.getByLabel(/ACS A \(ACS-A\)/).check();
  await bindingSave.click();
  await expect.poll(async () => (await (await page.request.get(`${f.api}/tasks/${f.task.taskId}/target-bindings`)).json()).data.bindings.find((binding: { targetId: string }) => binding.targetId === a.id)?.selection).toBe("subset");
  const resaved = (await (await page.request.get(`${f.api}/tasks/${f.task.taskId}/target-bindings`)).json()).data.bindings.find((binding: { targetId: string }) => binding.targetId === a.id);
  expect(resaved.id).toBe(originalBindingId);
  // WBS -> Target details opens the same original Target without a write.
  const queryRevision = (await f.snapshot()).data.project.revision;
  await bindings.getByRole("button", { name: "Target 상세: Target A", exact: true }).click();
  const nested = page.getByRole("dialog", { name: "Target 상세 · Target A", exact: true });
  await expect(nested).toContainText("공유 MCS");
  await page.keyboard.press("Escape");
  await expect(nested).toHaveCount(0);
  expect((await f.snapshot()).data.project.revision).toBe(queryRevision);
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("button", { name: "Target 상세: Target A", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Target 상세 · Target A", exact: true });
  await expect(detail).toContainText(f.task.taskId);
  await expect(detail).toContainText("Target 2개에서 공유");
  let taskPatches = 0;
  page.on("request", request => { if (request.method() === "PATCH" && new URL(request.url()).pathname === `/api/projects/${f.publicId}/tasks/${f.task.taskId}`) taskPatches += 1; });
  await detail.getByRole("button", { name: /원본 작업 편집:.*통합 시운전/ }).click();
  await expect(editor).toBeVisible();
  await editor.getByLabel("작업명", { exact: true }).fill("같은 작업에서 수정한 시운전");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(taskPatches).toBe(1);
  const edited = await f.snapshot();
  expect(edited.data.tasks).toHaveLength(before.data.tasks.length);
  expect(edited.data.tasks.find(task => task.taskId === f.task.taskId)?.name).toBe("같은 작업에서 수정한 시운전");
  await expect(page.getByRole("tab", { name: "물류 구성", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(detail).toContainText("같은 작업에서 수정한 시운전");
  expect(await detail.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Target 수정: Target A", exact: true }).click();
  const modify = page.getByRole("dialog", { name: "Target 수정", exact: true });
  await modify.getByLabel(/System · ACS A \(ACS-A\)/).uncheck();
  await modify.getByRole("button", { name: "변경 영향 확인", exact: true }).click();
  await expect(modify).toContainText("subset이 참조하는 구성원은 제거할 수 없습니다");
  await expect(modify.getByRole("button", { name: "Target 저장", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await modify.getByRole("button", { name: "초안 폐기", exact: true }).click();
  await page.reload();
  const persisted = await (await page.request.get(`${f.api}/logistics/targets`)).json() as LogisticsTargetListResponse;
  expect(persisted.data.targets).toEqual(list.data.targets);
  expect((await f.snapshot()).data.tasks).toHaveLength(before.data.tasks.length);
});

test("Target 초안·412·readonly·응답역전과 관리자 경계", async ({ page, browser, isolatedApplication }) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(10_000);
  const f = await createTargetProject(page, isolatedApplication);
  await f.mutate("/logistics/targets", { code: "COMMON", name: "공통 대상", scope: "project_common", members: [{ kind: "system", create: { code: "MCS", name: "MCS", systemType: "mcs", layer: "coordinator", scope: "project" } }] });
  await page.reload();
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: "물류 대상(Target)", exact: true }).click();
  await page.getByRole("button", { name: "Target 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Target 추가", exact: true });
  await dialog.getByLabel("Target 이름", { exact: true }).fill("보존할 초안");
  await dialog.getByLabel("Target 코드", { exact: true }).fill("DRAFT");
  await dialog.getByRole("combobox", { name: "대상 범위", exact: true }).selectOption("project_common");
  await dialog.getByLabel(/System · MCS \(MCS\)/).check();
  // Out-of-band canonical mutation causes a genuine server 412 on the draft.
  const oldRevision = (await f.snapshot()).data.project.revision;
  await f.mutate("", { description: "다른 편집기의 저장" }, "patch");
  await dialog.getByRole("button", { name: "Target 저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/초안은 유지/);
  await expect(dialog.getByLabel("Target 이름", { exact: true })).toHaveValue("보존할 초안");
  expect((await f.snapshot()).data.project.revision).toBe(oldRevision + 1);
  await page.keyboard.press("Escape");
  await expect(dialog).toContainText("초안을 폐기");
  await dialog.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(dialog.getByLabel("Target 이름", { exact: true })).toHaveValue("보존할 초안");
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "초안 폐기", exact: true }).click();
  await page.getByRole("button", { name: "Target 다시 조회", exact: true }).click();
  await expect(page.getByRole("button", { name: "Target 추가", exact: true })).toBeEnabled();

  // A late previous search response cannot replace the current result set.
  const original = await (await page.request.get(`${f.api}/logistics/targets?limit=50&offset=0`)).json();
  let releaseOld: (() => void) | undefined;
  const oldReply = new Promise<void>(resolve => { releaseOld = resolve; });
  await page.route("**/logistics/targets?*", async route => {
    const search = new URL(route.request().url()).searchParams.get("search");
    if (search === "느린 조회") { await oldReply; await route.fulfill({ json: original }); }
    else await route.continue();
  });
  await page.getByLabel("Target 검색", { exact: true }).fill("느린 조회");
  await page.getByLabel("Target 검색", { exact: true }).fill("없는 대상");
  await expect(page.getByRole("button", { name: "Target 상세: 공통 대상", exact: true })).toHaveCount(0);
  releaseOld!();
  await expect(page.getByLabel("Target 검색", { exact: true })).toHaveValue("없는 대상");
  await expect(page.getByRole("button", { name: "Target 상세: 공통 대상", exact: true })).toHaveCount(0);
  await page.unroute("**/logistics/targets?*");

  const readonlyContext = await browser.newContext();
  try {
    const readonly = await readonlyContext.newPage();
    await readonly.goto(`${isolatedApplication}/projects/${f.publicId}`);
    await readonly.getByRole("tab", { name: "물류 구성", exact: true }).click();
    await readonly.getByRole("tab", { name: "물류 대상(Target)", exact: true }).click();
    await expect(readonly.getByRole("button", { name: "Target 추가", exact: true })).toBeDisabled();
    await expect(readonly.getByRole("button", { name: "Target 수정: 공통 대상", exact: true })).toHaveCount(0);
    await readonly.getByRole("button", { name: "Target 상세: 공통 대상", exact: true }).click();
    await expect(readonly.getByRole("dialog", { name: "Target 상세 · 공통 대상", exact: true })).toContainText("MCS");
    const denied = await readonly.request.post(`${isolatedApplication}/api/process-catalog/admin/types`, { headers: { Origin: isolatedApplication, "If-Match": '"1"' }, data: { code: "DENIED", name: "권한 없음" } });
    expect(denied.status()).toBe(401);
    const deniedProject = await readonly.request.post(`${f.api}/logistics/targets`, { headers: { Origin: isolatedApplication, "If-Match": `"${(await f.snapshot()).data.project.revision}"` }, data: { code: "NO", name: "NO", scope: "project_common", members: [] } });
    expect(deniedProject.status()).toBe(401);
  } finally { await readonlyContext.close(); }
});

test("Target 390/768/1024/1440/1920px 긴 한글·키보드·focus·내부 overflow", async ({ page, isolatedApplication }, testInfo) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(10_000);
  const f = await createTargetProject(page, isolatedApplication);
  const revision = (await f.snapshot()).data.project.revision;
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: "물류 대상(Target)", exact: true }).click();
  const add = page.getByRole("button", { name: "Target 추가", exact: true });
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(add).toBeEnabled();
    await add.focus();
    await expect(add).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Target 추가", exact: true });
    await dialog.getByLabel("Target 이름", { exact: true }).fill("동명이름 한글 물류 설비 시스템과 공정이 긴 이름으로 구성되는 대상 ".repeat(3));
    await dialog.getByRole("combobox", { name: "프로젝트 공정", exact: true }).selectOption(f.processIds[0]);
    await dialog.getByLabel("인스턴스 코드", { exact: true }).fill("UNSAVED");
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await dialog.evaluate(node => { node.scrollTop = 0; });
    await testInfo.attach(`Target-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    if (!process.env.CI && [390, 1440].includes(width)) {
      await mkdir("output/playwright/issue-618", { recursive: true });
      await page.screenshot({ path: `output/playwright/issue-618/target-${width}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toContainText("초안을 폐기");
    await dialog.getByRole("button", { name: "초안 폐기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();
  }
  expect((await f.snapshot()).data.project.revision).toBe(revision);
});

test("Summary subtree 영향·상속/legacy 출처·pending·401 초안 보호", async ({ page, isolatedApplication }) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(10_000);
  const f = await createTargetProject(page, isolatedApplication);
  const response = await f.mutate("/logistics/targets", { code: "INHERITED", name: "상속 대상", scope: "project_common", members: [{ kind: "system", create: { code: "MCS", name: "MCS", systemType: "mcs", layer: "coordinator", scope: "project" } }] });
  const target = (await response.json()).data.target;
  await f.mutate(`/tasks/${f.task.taskId}/logistics-links`, { equipmentLinks: [], systemLinks: [{ systemId: target.members[0].entityId, scope: "self" }] }, "put");
  await page.reload();
  await page.locator(".project-gantt-widget .wx-row", { hasText: "관리 Summary" }).first().getByText("관리 Summary", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await editor.getByRole("tab", { name: /물류 연결/ }).click();
  const bindings = editor.getByRole("region", { name: "작업 Target 연결", exact: true });
  const saved = await (await page.request.get(`${f.api}/tasks/${f.parentTask.taskId}/target-bindings`)).json();
  expect(saved.data.bindings).toEqual([]); // An untargeted management Summary is valid.
  await bindings.getByLabel("상속 대상 (INHERITED)", { exact: true }).check();
  await bindings.getByRole("combobox", { name: "상속 대상 적용 범위", exact: true }).selectOption("subtree");
  await expect(bindings).toContainText("검토할 하위 작업 1개");
  await expect(bindings).toContainText(f.task.taskId);
  await expect(bindings.getByRole("button", { name: "Target 연결 저장", exact: true })).toBeDisabled();
  await bindings.getByRole("button", { name: "하위 작업 영향 확인 후 적용", exact: true }).click();
  await bindings.getByRole("button", { name: "Target 연결 저장", exact: true }).click();
  await expect(bindings.getByRole("button", { name: "Target 연결 저장", exact: true })).toBeDisabled();
  // Removing an already saved subtree binding also requires the descendant review.
  await bindings.getByLabel("상속 대상 (INHERITED)", { exact: true }).click();
  await expect(bindings).toContainText("검토할 하위 작업 1개");
  await bindings.getByRole("button", { name: "하위 작업 영향 확인 후 적용", exact: true }).click();
  await bindings.getByRole("button", { name: "Target 연결 저장", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`${f.api}/tasks/${f.parentTask.taskId}/target-bindings`)).json()).data.bindings.length).toBe(0);
  await bindings.getByLabel("상속 대상 (INHERITED)", { exact: true }).check();
  await bindings.getByRole("combobox", { name: "상속 대상 적용 범위", exact: true }).selectOption("subtree");
  await bindings.getByRole("button", { name: "하위 작업 영향 확인 후 적용", exact: true }).click();
  await bindings.getByRole("button", { name: "Target 연결 저장", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`${f.api}/tasks/${f.parentTask.taskId}/target-bindings`)).json()).data.bindings[0]?.scope).toBe("subtree");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await page.locator(".project-gantt-widget .wx-row", { hasText: "통합 시운전" }).first().getByText("통합 시운전", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  await editor.getByRole("tab", { name: /물류 연결/ }).click();
  await expect(bindings).toContainText("조상 상속");
  await expect(bindings).toContainText("기존 직접 설비·System 출처 1개");
  await expect(bindings).toContainText(f.parentTask.taskId);
  const inherited = await (await page.request.get(`${f.api}/tasks/${f.task.taskId}/target-bindings`)).json();
  expect(inherited.data.bindings).toEqual([]);
  expect(inherited.data.effective.effectiveSystemIds).toEqual([target.members[0].entityId]);
  expect(inherited.data.effective.legacySources).toHaveLength(1);
  await bindings.getByLabel("상속 대상 (INHERITED)", { exact: true }).check();
  let releaseSave: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { releaseSave = resolve; });
  let writes = 0;
  await page.route(`**/tasks/${f.task.taskId}/target-bindings`, async route => {
    if (route.request().method() !== "PUT") { await route.continue(); return; }
    writes += 1; await gate;
    await route.fulfill({ status: 401, json: { error: { code: "EDIT_SESSION_REQUIRED" } } });
  });
  await bindings.getByRole("button", { name: "Target 연결 저장", exact: true }).click();
  await expect(editor).toHaveAttribute("aria-busy", "true");
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  releaseSave!();
  await expect(bindings).toContainText("편집 권한이 만료되었습니다. Target 초안은 유지됩니다");
  await expect(bindings.getByLabel("상속 대상 (INHERITED)", { exact: true })).toBeChecked();
  expect(writes).toBe(1);
  const unchanged = await (await page.request.get(`${f.api}/tasks/${f.task.taskId}/target-bindings`)).json();
  expect(unchanged.data.bindings).toEqual([]);
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(editor).toContainText("저장하지 않은 변경사항");
});

test("인증된 관리자 inline WorkArea·새 공정 매핑의 별도 저장과 Target 초안 보존", async ({ page, isolatedApplication }) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(10_000);
  const f = await createTargetProject(page, isolatedApplication);
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: "물류 대상(Target)", exact: true }).click();
  await page.getByRole("button", { name: "Target 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Target 추가", exact: true });
  await dialog.getByLabel("Target 이름", { exact: true }).fill("관리자 등록 중에도 보존되는 초안");
  await dialog.getByRole("combobox", { name: "프로젝트 공정", exact: true }).first().selectOption(f.processIds[0]);
  const registration = dialog.getByRole("region", { name: "기준정보 inline 등록", exact: true });
  await registration.getByRole("button", { name: "관리자 권한 확인", exact: true }).click();
  await registration.getByRole("combobox", { name: "등록할 기준정보", exact: true }).selectOption("work-area");
  await registration.getByLabel("기준정보 코드", { exact: true }).fill("WA-NEW");
  await registration.getByLabel("기준정보 이름", { exact: true }).fill("같은 흐름에서 등록한 작업구역");
  const revision = (await f.snapshot()).data.project.revision;
  await registration.getByRole("button", { name: "기준정보 등록", exact: true }).click();
  await expect(registration).toContainText("이 저장은 Target 취소로 되돌아가지 않습니다");
  expect((await f.snapshot()).data.project.revision).toBe(revision);
  await expect(dialog.getByLabel("Target 이름", { exact: true })).toHaveValue("관리자 등록 중에도 보존되는 초안");
  await expect(dialog.getByRole("combobox", { name: "작업 구역 (선택)", exact: true }).locator("option", { hasText: "같은 흐름에서 등록한 작업구역" })).toHaveCount(1);
  await registration.getByRole("combobox", { name: "등록할 기준정보", exact: true }).selectOption("project-process");
  await registration.getByRole("combobox", { name: "프로젝트 공정", exact: true }).selectOption("");
  await registration.getByRole("combobox", { name: "매핑할 현장 공정", exact: true }).selectOption(f.catalog.data.occurrences.find(row => row.code === "B")!.id);
  await registration.getByLabel("기준정보 코드", { exact: true }).fill("LOCAL-C");
  await registration.getByLabel("기준정보 이름", { exact: true }).fill("새 유효 공정");
  await registration.getByRole("button", { name: "기준정보 등록", exact: true }).click();
  await expect(registration).toContainText("유효한 프로젝트 공정을 저장했습니다");
  await dialog.getByRole("button", { name: "변경된 기준정보 적용", exact: true }).click();
  await expect(dialog.getByLabel("Target 이름", { exact: true })).toHaveValue("관리자 등록 중에도 보존되는 초안");
  const after = await f.snapshot();
  expect(after.data.project.revision).toBe(revision + 2);
  expect(after.data.logistics!.processes.find(row => row.code === "LOCAL-C")).toBeTruthy();
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "초안 폐기", exact: true }).click();
  const global = await (await page.request.get(`${isolatedApplication}/api/process-catalog/admin`)).json();
  expect(global.data.workAreas.find((row: { code: string }) => row.code === "WA-NEW")).toBeTruthy();
  const targets = await (await page.request.get(`${f.api}/logistics/targets`)).json();
  expect(targets.data.targets).toEqual([]);
});

test("공유 원본 인스턴스 이름 수정은 사용처 확인 후 한 번 저장하고 모든 Target에 반영", async ({ page, isolatedApplication }) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(10_000);
  const f = await createTargetProject(page, isolatedApplication);
  const a = (await (await f.mutate("/logistics/targets", { code: "A", name: "공유 대상 A", scope: "project_common", members: [{ kind: "system", create: { code: "MCS", name: "공유 원본", systemType: "mcs", layer: "coordinator", scope: "project" } }] })).json()).data.target;
  await f.mutate("/logistics/targets", { code: "B", name: "공유 대상 B", scope: "project_common", members: [{ kind: "system", entityId: a.members[0].entityId }] });
  await f.mutate(`/tasks/${f.task.taskId}/target-bindings`, { bindings: [{ targetId: a.id, selection: "whole", scope: "self", memberIds: [] }] }, "put");
  await page.reload();
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: "물류 대상(Target)", exact: true }).click();
  await page.getByRole("button", { name: "Target 상세: 공유 대상 A", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Target 상세 · 공유 대상 A", exact: true });
  await detail.getByRole("button", { name: "원본 인스턴스 수정: 공유 원본", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "시스템 수정", exact: true });
  await editor.getByLabel("시스템명 *", { exact: true }).fill("모든 Target의 같은 원본 이름");
  const revision = (await f.snapshot()).data.project.revision;
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  const review = page.getByRole("dialog", { name: "공유 인스턴스 변경 확인", exact: true });
  await expect(review).toContainText("공유 Target 2개");
  await expect(review).toContainText("Target 경로의 관련 작업 1개");
  await expect(review).toContainText(f.task.taskId);
  expect((await f.snapshot()).data.project.revision).toBe(revision);
  await review.getByRole("button", { name: "공유 사용처 확인 후 원본 저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(review).toHaveCount(0);
  const targets = (await (await page.request.get(`${f.api}/logistics/targets`)).json()).data.targets;
  expect(targets).toHaveLength(2);
  for (const target of targets) expect(target.members[0]).toMatchObject({ entityId: a.members[0].entityId, label: "모든 Target의 같은 원본 이름" });
  expect((await f.snapshot()).data.project.revision).toBe(revision + 1);
});

test("Target 목록·상세·WBS 연결·관리자 입력의 5폭 왕복은 조회만 수행", async ({ page, isolatedApplication }, testInfo) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(10_000);
  const f = await createTargetProject(page, isolatedApplication);
  const longName = "동명이름과 긴 한글을 갖는 물류 대상 및 통합 시스템 검증";
  const target = (await (await f.mutate("/logistics/targets", { code: "LONG-TARGET", name: longName, scope: "project_common", members: [{ kind: "system", create: { code: "MCS", name: "길고 긴 한글 시스템 이름과 동일 원본 MCS", systemType: "mcs", layer: "coordinator", scope: "project" } }] })).json()).data.target;
  await f.mutate(`/tasks/${f.task.taskId}/target-bindings`, { bindings: [{ targetId: target.id, selection: "whole", scope: "self", memberIds: [] }] }, "put");
  await page.reload();
  const revision = (await f.snapshot()).data.project.revision;
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: "물류 대상(Target)", exact: true }).click();
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("Target 검색", { exact: true }).fill("긴 한글");
    await page.getByRole("button", { name: `Target 상세: ${longName}`, exact: true }).click();
    const detail = page.getByRole("dialog", { name: `Target 상세 · ${longName}`, exact: true });
    const original = detail.getByRole("button", { name: /원본 작업 편집:.*통합 시운전/ });
    await expect(original).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach(`detail-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await original.click();
    const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
    await editor.getByRole("tab", { name: /물류 연결/ }).click();
    const bindings = editor.getByRole("region", { name: "작업 Target 연결", exact: true });
    await expect(bindings.getByLabel(`${longName} (LONG-TARGET)`, { exact: true })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach(`binding-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
    await expect(original).toBeFocused();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Target 추가", exact: true }).click();
    const composer = page.getByRole("dialog", { name: "Target 추가", exact: true });
    const registration = composer.getByRole("region", { name: "기준정보 inline 등록", exact: true });
    await registration.getByRole("button", { name: "관리자 권한 확인", exact: true }).click();
    await registration.getByRole("combobox", { name: "등록할 기준정보", exact: true }).selectOption("process-type");
    await registration.getByLabel("기준정보 이름", { exact: true }).fill("등록하지 않고 보존한 한글 공정 초안");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach(`admin-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await page.keyboard.press("Escape");
    await composer.getByRole("button", { name: "초안 폐기", exact: true }).click();
  }
  expect((await f.snapshot()).data.project.revision).toBe(revision);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
});
