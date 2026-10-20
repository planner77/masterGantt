import type { Locator, Page } from "@playwright/test";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { createTargetProject, targetMasterPassword } from "./fixtures/target-project";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import type { LogisticsMutationResponse, ProjectLogisticsResponse } from "../../src/contracts/logistics";
import type { ProcessCatalogResponse } from "../../src/contracts/process-catalog";

// #733 F733-004: this suite exercises actual PATCH/Task dynamic routes across
// isolated Next dev process restarts. Use the supported Webpack dev bundler
// only here to avoid the observed persistent Turbopack route-registration 404.
// Keep exact GET405 readiness and real PATCH200/JSON/Task GET200 assertions.
test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword,
  isolatedDevBundler: "webpack", viewport: { width: 1440, height: 1000 } });

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const state = await page.evaluate(() => ({
    active: { tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 160), id: document.activeElement?.id },
    mappingButtons: Array.from(document.querySelectorAll<HTMLButtonElement>('section[aria-labelledby="project-process-mapping-title"] button')).map(button => ({ name: button.textContent, disabled: button.disabled })),
  })).catch(() => null);
  await info.attach("issue-725-failure-focus", { contentType: "application/json", body: Buffer.from(JSON.stringify(state, null, 2)) });
});

async function assertViewport(page: Page, width: number) {
  const resizeFrames = await page.evaluate(async () => {
    const samples = [{ phase: "initial", width: document.documentElement.scrollWidth }];
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    samples.push({ phase: "two-animation-frames", width: document.documentElement.scrollWidth });
    return samples;
  });
  const geometry = await page.evaluate(() => {
    const dialogElement = document.querySelector<HTMLDialogElement>('dialog[open]');
    const dialog = dialogElement?.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const overflow = Array.from(document.querySelectorAll<HTMLElement>("body *")).map(element => {
      const box = element.getBoundingClientRect();
      let contained = false;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const box = parent.getBoundingClientRect();
        if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(parent).overflowX) && box.right <= viewport + 1) { contained = true; break; }
      }
      return { contained, visibility: getComputedStyle(element).visibility, tag: element.tagName, id: element.id, className: element.className, left: box.left, right: box.right, width: box.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: getComputedStyle(element).overflowX, parent: element.parentElement?.className };
    }).filter(element => !element.contained && (element.width > viewport + 1 || element.right > viewport + 1)).sort((a, b) => b.width - a.width).slice(0, 40);
    const dialogLayout = dialogElement ? Array.from(dialogElement.querySelectorAll<HTMLElement>("form, fieldset, label, select")).map(element => {
      const box = element.getBoundingClientRect();
      return { tag: element.tagName, className: element.className, left: box.left, right: box.right, width: box.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
    }) : [];
    return { dialogLayout, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, scrollX: window.scrollX, viewport, left: dialog?.left, right: dialog?.right, dialogScrollWidth: dialogElement?.scrollWidth, dialogClientWidth: dialogElement?.clientWidth, overflow };
  });
  await test.info().attach(`issue-725-viewport-${width}px`, { contentType: "application/json", body: Buffer.from(JSON.stringify({ ...geometry, resizeFrames }, null, 2)) });
  expect(geometry.document, `${width}px document overflow`).toBeLessThanOrEqual(geometry.viewport + 1);
  if (geometry.left !== undefined) expect(geometry.left, `${width}px dialog left`).toBeGreaterThanOrEqual(0);
  if (geometry.right !== undefined) expect(geometry.right, `${width}px dialog right`).toBeLessThanOrEqual(width + 1);
  if (geometry.dialogScrollWidth !== undefined) expect(geometry.dialogScrollWidth, `${width}px dialog content overflow`).toBeLessThanOrEqual(geometry.dialogClientWidth! + 1);
}

async function assertTableGeometry(table: Locator, width: number) {
  await expect(table).toBeVisible();
  const geometry = await table.evaluate(element => {
    const rect = (cell: Element) => { const r = cell.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
    const headers = Array.from(element.querySelectorAll("thead tr:first-child > *"), rect);
    const cells = Array.from(element.querySelectorAll("tbody tr:first-child > *"), rect);
    let owner: HTMLElement | null = element.parentElement;
    while (owner && !["auto", "scroll"].includes(getComputedStyle(owner).overflowX)) owner = owner.parentElement;
    return { headers, cells, tableWidth: element.getBoundingClientRect().width, owner: owner ? { className: owner.className, left: owner.getBoundingClientRect().left, right: owner.getBoundingClientRect().right, width: owner.clientWidth, scrollWidth: owner.scrollWidth, overflow: getComputedStyle(owner).overflowX } : null };
  });
  await test.info().attach(`issue-725-table-${width}px`, { contentType: "application/json", body: Buffer.from(JSON.stringify(geometry, null, 2)) });
  expect(geometry.cells.length, `${width}px table columns`).toBe(geometry.headers.length);
  geometry.headers.forEach((header, index) => {
    expect(Math.abs(header.left - geometry.cells[index].left), `${width}px column ${index} left`).toBeLessThanOrEqual(1);
    expect(Math.abs(header.width - geometry.cells[index].width), `${width}px column ${index} width`).toBeLessThanOrEqual(1);
    if (index) expect(geometry.cells[index - 1].right, `${width}px adjacent columns`).toBeLessThanOrEqual(geometry.cells[index].left + 1);
  });
  expect(geometry.owner, `${width}px table scroll owner`).not.toBeNull();
  if (geometry.owner && geometry.tableWidth > geometry.owner.width + 1) {
    expect(geometry.owner.scrollWidth).toBeGreaterThan(geometry.owner.width);
    expect(["auto", "scroll"]).toContain(geometry.owner.overflow);
  }
  return geometry;
}

async function submitEquipmentEdit(page: Page, dialog: Locator) {
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  const impact = page.getByRole("dialog", { name: "공유 인스턴스 변경 확인", exact: true });
  await expect(impact).toBeVisible();
  await expect(impact).toContainText("공유 Target 0개");
  await impact.getByRole("button", { name: "공유 사용처 확인 후 원본 저장", exact: true }).click();
  return impact;
}

// Real HTTP + disposable SQLite are used throughout. Only delay/failure scenarios
// intercept a request; no successful persistence response is fabricated.
test("#725 Target0 독립 공정·WorkArea 관리와 타 공정 E10 다중 연결·재조회·해제·재시작", async ({ page, browser, isolatedApplication: origin, observeIsolatedApi, restartIsolatedApplication }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(10_000);
  const f = await createTargetProject(page, origin, observeIsolatedApi);
  const measurements: unknown[] = [];
  const initial = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const gantt = await frame.locator(".wx-gantt").elementHandle();
  const targets = async () => {
    const response = await page.request.get(`${f.api}/logistics/targets`);
    expect(response.status()).toBe(200);
    expect((await response.json()).data.targets).toEqual([]);
  };
  const logistics = async () => {
    const response = await page.request.get(`${f.api}/logistics`);
    expect(response.status()).toBe(200);
    return (await response.json() as ProjectLogisticsResponse).data.logistics;
  };
  await targets();
  await openWorkspaceView(page, "processes");
  await expect(page.getByRole("heading", { name: "공정 & 작업 구역 관리", exact: true })).toBeVisible();
  await page.getByText("공용 공정 기준정보 관리 (관리자)", { exact: true }).click();
  const admin = page.locator("details").filter({ has: page.getByText("공용 공정 기준정보 관리 (관리자)", { exact: true }) });
  await expect(admin).toHaveAttribute("open", "");
  await expect(admin.getByRole("combobox", { name: "관리 범주", exact: true })).toBeVisible();
  await admin.getByRole("combobox", { name: "관리 범주", exact: true }).selectOption("workAreas");
  await expect(admin.getByRole("table")).toContainText("A 작업구역");
  // The initial fixture proves one WorkArea for A, zero for B, and no fake defaults.
  expect(f.catalog.data.workAreas.filter(area => area.occurrenceId === f.catalog.data.occurrences.find(row => row.code === "A")!.id)).toHaveLength(1);
  expect(f.catalog.data.workAreas.filter(area => area.occurrenceId === f.catalog.data.occurrences.find(row => row.code === "B")!.id)).toHaveLength(0);
  await page.getByLabel("공정 기준정보 검색", { exact: true }).fill("존재하지않는구역");
  await expect(admin.getByText("조건에 맞는 기준정보가 없습니다.", { exact: true })).toBeVisible();
  await page.getByLabel("공정 기준정보 검색", { exact: true }).fill("");
  for (const [owner, code] of [["A", "WA-A2"], ["B", "WA-B"]]) {
    const add = page.getByRole("button", { name: "작업 구역 추가", exact: true });
    await add.click();
    const dialog = page.getByRole("dialog", { name: "작업 구역 추가", exact: true });
    await expect(dialog.getByLabel("코드", { exact: true })).toBeFocused();
    await dialog.getByLabel("코드", { exact: true }).fill(code);
    await dialog.getByLabel("이름", { exact: true }).fill("공유 이름 구역 · Shared WorkArea integration verification extended operational boundary");
    await dialog.getByRole("combobox", { name: "소유 현장 공정", exact: true }).selectOption(f.catalog.data.occurrences.find(row => row.code === owner)!.id);
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();
  }
  await expect(page.locator('section[aria-labelledby="project-process-mapping-title"]').getByRole("status").filter({ hasText: "현재 프로젝트에는 아직 미적용입니다" })).toBeVisible();
  await page.getByRole("button", { name: "현장 공정 다시 불러오기", exact: true }).click();
  const catalogResponse = await page.request.get(`${origin}/api/process-catalog/admin`);
  const catalog = await catalogResponse.json() as ProcessCatalogResponse;
  expect(catalog.data.workAreas).toHaveLength(3);
  const areaA = catalog.data.workAreas.find(area => area.code === "WA-A")!;
  const areaB = catalog.data.workAreas.find(area => area.code === "WA-B")!;
  // Project mapping's optional compatibility area does not select equipment areas.
  const mappingTrigger = page.getByRole("button", { name: "연결 설정 A 공정", exact: true });
  await mappingTrigger.click();
  const mappingDialog = page.getByRole("dialog", { name: "프로젝트 공정 연결 설정", exact: true });
  await mappingDialog.getByRole("combobox", { name: "공정 매핑 기본 구역 (호환)", exact: true }).selectOption(areaA.id);
  await mappingDialog.getByRole("button", { name: "연결 저장", exact: true }).click();
  await expect(mappingDialog).toHaveCount(0);
  await expect(mappingTrigger).toBeFocused();
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    measurements.push({ view: "process-mapping", width, ...await assertTableGeometry(page.getByRole("table", { name: "프로젝트 공정별 현장 공정 연결", exact: true }), width) });
    measurements.push({ view: "catalog-workareas", width, ...await assertTableGeometry(admin.getByRole("table"), width) });
    await assertViewport(page, width);
    const information = page.locator("details.project-info-popover");
    const informationSummary = information.locator(":scope > summary");
    await informationSummary.focus();
    await page.keyboard.press("Enter");
    await expect(information).toHaveJSProperty("open", true);
    const informationPanel = information.locator(".project-info-panel");
    await expect(informationPanel).toBeVisible();
    const informationBounds = await informationPanel.boundingBox();
    expect(informationBounds!.x, `${width}px project information left`).toBeGreaterThanOrEqual(0);
    expect(informationBounds!.x + informationBounds!.width, `${width}px project information right`).toBeLessThanOrEqual(width + 1);
    measurements.push({ view: "project-information", width, bounds: informationBounds });
    await assertViewport(page, width);
    await page.keyboard.press("Escape");
    await expect(information).toHaveJSProperty("open", false);
    await expect(informationSummary).toBeFocused();
    await expect(informationPanel).not.toBeVisible();
    await assertViewport(page, width);
    await mappingTrigger.click();
    const responsive = page.getByRole("dialog", { name: "프로젝트 공정 연결 설정", exact: true });
    await expect(responsive).toBeVisible();
    await assertViewport(page, width);
    await responsive.getByRole("combobox", { name: "현장 공정", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(responsive.getByRole("combobox", { name: "공정 매핑 기본 구역 (호환)", exact: true })).toBeFocused();
    await info.attach(`issue-725-process-${width}px`, { body: await responsive.screenshot(), contentType: "image/png" });
    await page.keyboard.press("Escape");
    await expect(responsive).toHaveCount(0);
    await expect(mappingTrigger).toBeFocused();
  }
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  expect(await gantt!.evaluate(element => element.isConnected)).toBe(true);
  const created = await (await f.mutate("/logistics/equipment", { processId: f.processIds[0], code: "E10", name: "다공정 AMR Fleet · 광역 통합 반송 장비 Long operational equipment instance", equipmentType: "amr", managementUnit: "fleet", quantity: 10 })).json() as LogisticsMutationResponse;
  const equipmentId = created.data.logistics.equipment.find(row => row.code === "E10")!.id;
  await page.reload();
  await openWorkspaceView(page, "equipment");
  const equipmentRow = () => page.locator("#panel-equipment").getByRole("row").filter({ hasText: "E10" });
  const edit = () => equipmentRow().getByRole("button", { name: "수정", exact: true });
  const contextPattern = `**/api/projects/${f.publicId}/logistics/process-context`;
  await page.route(contextPattern, route => route.abort("failed"));
  await edit().click();
  const unavailable = page.getByRole("dialog", { name: "설비 수정", exact: true });
  await expect(unavailable.getByRole("alert")).toContainText("WorkArea 목록을 확인할 수 없어 저장할 수 없습니다");
  await expect(unavailable.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await unavailable.getByLabel("제조사", { exact: true }).fill("실패 중 보존 초안");
  await page.unroute(contextPattern);
  let releaseRead!: () => void;
  const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
  await page.route(contextPattern, async route => { await readGate; await route.continue(); });
  await unavailable.getByRole("button", { name: "WorkArea 목록 다시 조회", exact: true }).click();
  await expect(unavailable.getByRole("status").filter({ hasText: "WorkArea 목록을 불러오는 중…" })).toHaveText("WorkArea 목록을 불러오는 중…");
  await expect(unavailable.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  releaseRead();
  await expect(unavailable.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
  await expect(unavailable.getByLabel("제조사", { exact: true })).toHaveValue("실패 중 보존 초안");
  await page.unroute(contextPattern);
  await unavailable.getByRole("button", { name: "취소", exact: true }).click();
  await unavailable.getByRole("button", { name: "변경 폐기", exact: true }).click();
  await expect(unavailable).toHaveCount(0);
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    measurements.push({ view: "equipment", width, ...await assertTableGeometry(page.locator("#panel-equipment table"), width) });
    await assertViewport(page, width);
    await edit().click();
    const dialog = page.getByRole("dialog", { name: "설비 수정", exact: true });
    await expect(dialog.getByRole("group", { name: "연결 WorkArea (선택)", exact: true })).toContainText("선택 0개");
    await expect(dialog.getByLabel("설비 코드 *", { exact: true })).toBeFocused();
    await assertViewport(page, width);
    await info.attach(`issue-725-equipment-${width}px`, { body: await dialog.screenshot(), contentType: "image/png" });
    const checkbox = dialog.getByRole("checkbox", { name: /A 작업구역/ });
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(dialog.getByText("저장하지 않은 설비 변경을 폐기할까요?", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(checkbox).toBeChecked();
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await dialog.getByRole("button", { name: "변경 폐기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(edit()).toBeFocused();
  }
  await edit().click();
  let dialog = page.getByRole("dialog", { name: "설비 수정", exact: true });
  await dialog.getByRole("checkbox", { name: /A 작업구역/ }).check();
  await dialog.getByRole("checkbox", { name: /공유 이름 구역.*B 공정/ }).check();
  await expect(dialog.getByRole("group", { name: "연결 WorkArea (선택)", exact: true })).toContainText("선택 2개");
  await page.setViewportSize({ width: 390, height: 1000 });
  await assertViewport(page, 390);
  await info.attach("issue-725-equipment-multi-390px", { body: await dialog.screenshot(), contentType: "image/png" });
  // Delay the real PATCH to exercise pending/duplicate-submit protection.
  let releaseWrite!: () => void;
  const writeGate = new Promise<void>(resolve => { releaseWrite = resolve; });
  const writePattern = `**/api/projects/${f.publicId}/logistics/equipment/${equipmentId}`;
  let writeCount = 0;
  await page.route(writePattern, async route => { writeCount++; await writeGate; await route.continue(); });
  const impact = await submitEquipmentEdit(page, dialog);
  await expect.poll(() => writeCount).toBe(1);
  await expect(impact.getByRole("button", { name: "공유 사용처 확인 후 원본 저장", exact: true })).toBeDisabled();
  await expect(impact.getByRole("button", { name: "원본 변경 취소", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "저장 중…", exact: true, includeHidden: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("checkbox", { name: /A 작업구역/ })).toBeDisabled();
  releaseWrite();
  await expect(dialog).toHaveCount(0);
  await page.unroute(writePattern);
  expect(writeCount).toBe(1);
  let saved = await logistics();
  expect(saved.equipment).toHaveLength(1);
  expect(saved.equipment[0]).toMatchObject({ id: equipmentId, quantity: 10, workAreaIds: expect.arrayContaining([areaA.id, areaB.id]) });
  expect(saved.equipment[0].workAreaIds).toHaveLength(2);
  expect((await f.snapshot()).data.tasks).toEqual(initial.data.tasks);
  await targets();
  // Read-only GET must observe Next's 405 for this PATCH/DELETE-only dynamic
  // route after the isolated restart. This warms route registration before
  // real UI writes without retrying or faking any equipment PATCH response.
  const equipmentPatchPath = `/api/projects/${f.publicId}/logistics/equipment/${equipmentId}`;
  const taskContextPath = `/api/projects/${f.publicId}/tasks/${f.task.taskId}/process-context`;
  // #730 F730-014: warm both independent dynamic handlers using read-only
  // GET contracts before real post-restart UI PATCH and Task context GET/PUT.
  await restartIsolatedApplication(equipmentPatchPath, taskContextPath);
  const submitVerifiedPostRestartEdit = async (editDialog: Locator) => {
    const responsePromise = page.waitForResponse(response =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === equipmentPatchPath);
    await submitEquipmentEdit(page, editDialog);
    const response = await responsePromise;
    const contentType = response.headers()["content-type"] ?? "";
    await info.attach("issue-731-post-restart-equipment-patch", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({
        route: "/api/projects/[publicId]/logistics/equipment/[equipmentId]",
        method: "PATCH", status: response.status(),
        contentType, requestIdPresent: Boolean(response.headers()["x-request-id"]),
      })),
    });
    expect(response.status(), "재시작 이후 설비 PATCH는 실제 API 핸들러의 HTTP 200이어야 합니다").toBe(200);
    expect(contentType, "설비 PATCH는 Next.js HTML 404가 아닌 정상 JSON 응답이어야 합니다").toContain("application/json");
  };
  await page.reload();
  await openWorkspaceView(page, "equipment");
  await edit().click();
  dialog = page.getByRole("dialog", { name: "설비 수정", exact: true });
  await expect(dialog.getByRole("checkbox", { name: /A 작업구역/ })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: /공유 이름 구역.*B 공정/ })).toBeChecked();
  await dialog.getByRole("checkbox", { name: /A 작업구역/ }).uncheck();
  await submitVerifiedPostRestartEdit(dialog);
  await expect(dialog).toHaveCount(0);
  expect((await logistics()).equipment[0].workAreaIds).toEqual([areaB.id]);
  await edit().click();
  dialog = page.getByRole("dialog", { name: "설비 수정", exact: true });
  await dialog.getByRole("button", { name: "전체 연결 해제", exact: true }).click();
  await expect(dialog.getByRole("group", { name: "연결 WorkArea (선택)", exact: true })).toContainText("선택 0개");
  await submitVerifiedPostRestartEdit(dialog);
  await expect(dialog).toHaveCount(0);
  saved = await logistics();
  expect(saved.equipment).toHaveLength(1);
  expect(saved.equipment[0]).toMatchObject({ id: equipmentId, quantity: 10, workAreaIds: [] });
  await targets();
  // #726 owns the editor controls. #725 supplies this persisted direct API contract:
  // null (legacy not introduced) is distinct from an explicit empty collection.
  const taskContextUrl = `${origin}${taskContextPath}`;
  const readTaskContext = async () => {
    const response = await page.request.get(taskContextUrl);
    const contentType = response.headers()["content-type"] ?? "";
    expect(response.status(), `Task context GET 응답 MIME: ${contentType}`).toBe(200);
    expect(contentType).toContain("application/json");
    return (await response.json()).data.context;
  };
  expect((await readTaskContext()).processLinks).toBeNull();
  for (const selected of [[f.processIds[0], f.processIds[1]], [f.processIds[1]], []]) {
    const processLinks = selected.map(processId => ({ processId, scope: "self" }));
    await f.mutate(`/tasks/${f.task.taskId}/process-context`, { processCatalogRevision: catalog.data.processCatalogRevision, processLinks, workAreaLinks: [] }, "put");
    const persisted = (await readTaskContext()).processLinks;
    expect(persisted).toEqual(expect.arrayContaining(processLinks));
    expect(persisted).toHaveLength(processLinks.length);
  }
  expect((await readTaskContext()).processLinks).toEqual([]);
  expect((await f.snapshot()).data.tasks.map(task => task.taskId)).toEqual(initial.data.tasks.map(task => task.taskId));
  // A new browser session has no edit/admin authority; query-only access is retained.
  const readonlyContext = await browser.newContext();
  const readonly = await readonlyContext.newPage();
  try {
    await readonly.goto(`${origin}/projects/${f.publicId}`);
    await openWorkspaceView(readonly, "processes");
    await expect(readonly.getByRole("button", { name: "연결 설정 A 공정", exact: true })).toBeDisabled();
    await openWorkspaceView(readonly, "equipment");
    const readonlyEquipment = readonly.locator("#panel-equipment").getByRole("row").filter({ hasText: "다공정 AMR Fleet" });
    await expect(readonlyEquipment.getByText("다공정 AMR Fleet · 광역 통합 반송 장비 Long operational equipment instance", { exact: true })).toBeVisible();
    const readonlyIdentifiers = readonlyEquipment.locator("details").filter({ hasText: "설비 코드" });
    await expect(readonlyIdentifiers).not.toHaveAttribute("open", "");
    await readonlyIdentifiers.locator("summary").click();
    await expect(readonlyIdentifiers.getByText("E10", { exact: true })).toBeVisible();
    await expect(readonly.locator("#panel-equipment").getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
  } finally { await readonlyContext.close(); }
  await openWorkspaceView(page, "schedule");
  // Restart/reload intentionally replaces the page. In-page navigation remains stable.
  const stableInstance = await frame.getAttribute("data-project-gantt-instance");
  const stableGantt = await frame.locator(".wx-gantt").elementHandle();
  await openWorkspaceView(page, "processes");
  await openWorkspaceView(page, "equipment");
  await openWorkspaceView(page, "schedule");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", stableInstance!);
  expect(await stableGantt!.evaluate(element => element.isConnected)).toBe(true);
  await info.attach("issue-725-geometry", { contentType: "application/json", body: Buffer.from(JSON.stringify(measurements, null, 2)) });
  await info.attach("issue-725-acceptance", { contentType: "application/json", body: Buffer.from(JSON.stringify({ widths: [390, 768, 1024, 1440, 1920], targetCount: 0, equipmentCount: 1, quantity: 10, selectedWorkAreaCounts: [0, 2, 1, 0], workAreaOwners: [areaA.occurrenceId, areaB.occurrenceId], mutationCount: writeCount, restart: true })) });
});


test("#725 비활성 기본 구역과 중복 occurrence 매핑에서도 활성 구역 단일 owner 선택·저장", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  const f = await createTargetProject(page, origin, observeIsolatedApi);
  const occurrence = f.catalog.data.occurrences.find(row => row.code === "A")!;
  const defaultArea = f.catalog.data.workAreas.find(row => row.code === "WA-A")!;
  const areaResponse = await page.request.post(`${origin}/api/process-catalog/admin/work-areas`, {
    headers: { Origin: origin, "If-Match": `"${f.catalog.data.processCatalogRevision}"` },
    data: { occurrenceId: occurrence.id, code: "WA-SIBLING", name: "활성 공유 구역" },
  });
  // The catalog create handler intentionally returns 201; PATCH retains 200.
  // Keep a strict contract assertion instead of accepting arbitrary 2xx status.
  expect(areaResponse.status()).toBe(201);
  const updatedCatalog = await areaResponse.json() as ProcessCatalogResponse;
  const sibling = updatedCatalog.data.workAreas.find(area => area.code === "WA-SIBLING")!;
  // Two project process IDs deliberately share one physical occurrence.
  await f.mutate(`/logistics/process-mappings/${f.processIds[0]}`, {
    processCatalogRevision: updatedCatalog.data.processCatalogRevision, occurrenceId: occurrence.id, workAreaId: defaultArea.id,
  }, "put");
  await f.mutate(`/logistics/process-mappings/${f.processIds[1]}`, {
    processCatalogRevision: updatedCatalog.data.processCatalogRevision, occurrenceId: occurrence.id,
  }, "put");
  const disabledResponse = await page.request.patch(`${origin}/api/process-catalog/admin/work-areas/${defaultArea.id}`, {
    headers: { Origin: origin, "If-Match": `"${updatedCatalog.data.processCatalogRevision}"` }, data: { active: false },
  });
  expect(disabledResponse.status()).toBe(200);
  const contextResponse = await page.request.get(`${f.api}/logistics/process-context`);
  expect(contextResponse.status()).toBe(200);
  const context = (await contextResponse.json()).data;
  expect(context.mappings.find((row: { processId: string }) => row.processId === f.processIds[0]))
    .toMatchObject({ active: false, workAreaSelectionActive: true });
  const created = await (await f.mutate("/logistics/equipment", {
    processId: f.processIds[0], code: "E-DUP", name: "공유 WorkArea 설비",
    equipmentType: "amr", managementUnit: "fleet", quantity: 10,
  })).json() as LogisticsMutationResponse;
  const equipmentId = created.data.logistics.equipment.find(row => row.code === "E-DUP")!.id;
  await page.reload();
  await openWorkspaceView(page, "equipment");
  await page.locator("#panel-equipment").getByRole("row").filter({ hasText: "E-DUP" })
    .getByRole("button", { name: "수정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설비 수정", exact: true });
  // Project-local process codes use PROC-<UUID> and the picker sorts mappings by code.
  // DOM order is not the fixture's A/B creation order; select by the actual owner name.
  const ownerA = dialog.getByRole("checkbox", { name: /활성 공유 구역.*A 공정/ });
  const ownerB = dialog.getByRole("checkbox", { name: /활성 공유 구역.*B 공정/ });
  await expect(ownerA).toHaveCount(1);
  await expect(ownerB).toHaveCount(1);
  await expect(ownerA).toBeEnabled();
  await expect(ownerB).toBeEnabled();
  // One physical WorkArea must have exactly one selected Project-process owner.
  await ownerA.check();
  await ownerB.check();
  await expect(ownerA).not.toBeChecked();
  await expect(ownerB).toBeChecked();
  await expect(dialog.getByRole("group", { name: "연결 WorkArea (선택)", exact: true })).toContainText("선택 1개");
  // Prove that the owner selected in the UI reaches the real HTTP mutation unchanged.
  const updateRequestPromise = page.waitForRequest(request =>
    request.method() === "PATCH" &&
    new URL(request.url()).pathname === `/api/projects/${f.publicId}/logistics/equipment/${equipmentId}`);
  await submitEquipmentEdit(page, dialog);
  const updateRequest = await updateRequestPromise;
  expect((updateRequest.postDataJSON() as { workAreaLinks: Array<{ processId: string; workAreaId: string }> }).workAreaLinks)
    .toEqual([{ processId: f.processIds[1], workAreaId: sibling.id }]);
  await expect(dialog).toHaveCount(0);
  const savedResponse = await page.request.get(`${f.api}/logistics`);
  expect(savedResponse.status()).toBe(200);
  const saved = (await savedResponse.json() as ProjectLogisticsResponse).data.logistics;
  expect(saved.equipment).toHaveLength(1);
  expect(saved.equipment[0]).toMatchObject({
    id: equipmentId, quantity: 10, workAreaIds: [sibling.id],
    workAreaLinks: [{ processId: f.processIds[1], workAreaId: sibling.id }],
  });
  expect(saved.equipmentWorkAreas).toEqual([{
    equipmentId, processId: f.processIds[1], occurrenceId: occurrence.id, workAreaId: sibling.id,
  }]);
});
