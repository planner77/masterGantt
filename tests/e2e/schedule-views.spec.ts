import type { Locator, Page } from "@playwright/test";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { seedScheduleViews, scheduleViewResourcePassword, addScheduleViewPopulation } from "./fixtures/schedule-views";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { waitForGanttReadiness } from "./helpers/gantt-readiness";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword,
  isolatedResourceAdminPassword: scheduleViewResourcePassword, viewport: { width: 1440, height: 1000 } });

const selector = (page: Page) => page.getByLabel("View", { exact: true });
const view = (page: Page, name: "resource" | "equipment") => page.locator(`[data-schedule-view="${name}"]`);
const taskRows = (root: Locator, taskId: string) => root.locator(`[data-view-row-key][data-canonical-task-id="${taskId}"]`);

async function axisGeometry(frame: Locator, root: Locator, task: { taskId: string; start: string | null; end: string | null }, mode: "day" | "week") {
  const bar = taskRows(root, task.taskId).first().locator(".project-schedule-view-bar");
  const expectedLeft = await frame.evaluate((element, { date, mode }) => {
    const start = Reflect.get(element, "__masterganttMilestoneTimeline")?.read?.().start as Date;
    if (!(start instanceof Date)) throw new Error("Core axis must exist before projection geometry measurement");
    const axisOrdinal = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) / 86_400_000;
    return (Date.parse(`${date}T00:00:00Z`) / 86_400_000 - axisOrdinal) * (mode === "day" ? 36 : 68 / 7);
  }, { date: task.start!, mode });
  const expectedWidth = (Date.parse(task.end!) - Date.parse(task.start!) + 86_400_000) / 86_400_000 * (mode === "day" ? 36 : 68 / 7);
  await expect.poll(async () => Math.abs(await bar.evaluate(element => Number.parseFloat((element as HTMLElement).style.left)) - expectedLeft)).toBeLessThanOrEqual(1);
  const measured = await bar.evaluate(element => ({ left: Number.parseFloat((element as HTMLElement).style.left), width: element.getBoundingClientRect().width }));
  expect(Math.abs(measured.width - expectedWidth)).toBeLessThanOrEqual(1);
  return { mode, expectedLeft, expectedWidth, ...measured };
}

function observeProjectWrites(page: Page, publicId: string) {
  const writes: string[] = [];
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith(`/api/projects/${publicId}`) && !["GET", "HEAD"].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  return writes;
}

test("#880 실제 원본 다중 Resource·설비 View, Editor 동일 ID, 5폭·일/주·Fullscreen·WBS 왕복 쓰기0", async ({ page, isolatedApplication, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedScheduleViews(page, isolatedApplication, observeIsolatedApi);
  await openWorkspaceView(page, "schedule");
  const baseline = await f.snapshot();
  const writes = observeProjectWrites(page, f.publicId);
  const frame = page.locator(".project-gantt-frame");
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const gantt = await frame.locator(".wx-gantt").elementHandle();
  await expect(selector(page)).toHaveValue("wbs");
  expect(await selector(page).locator("option").allTextContents()).toEqual(["WBS", "Resource", "설비"]);
  const toolbarOrder = await selector(page).evaluate(element => {
    const toolbar = element.closest(".project-gantt-scale-toolbar")!;
    const scale = toolbar.querySelector(".project-gantt-scale-controls")!;
    return Boolean(element.compareDocumentPosition(scale) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(toolbarOrder).toBe(true);
  await selector(page).focus();
  await selector(page).press("ArrowDown");
  await selector(page).press("Enter");
  await expect(selector(page)).toHaveValue("resource");
  const resource = view(page, "resource");
  await expect(resource).toBeVisible();
  await expect(taskRows(resource, f.task.taskId)).toHaveCount(3);
  await expect(taskRows(resource, f.groupOnly.taskId)).toHaveCount(1);
  await expect(taskRows(resource, f.unassigned.taskId)).toHaveCount(1);
  await expect(taskRows(resource, f.ungrouped.taskId)).toHaveCount(1);
  await expect(resource).toContainText("개인 미지정");
  await expect(resource).toContainText("완전 미할당");
  await expect(resource).toContainText("그룹 미소속");
  const sharedKeys = await taskRows(resource, f.task.taskId).evaluateAll(rows => rows.map(row => row.getAttribute("data-view-row-key")));
  expect(new Set(sharedKeys).size).toBe(3);
  const group2 = resource.locator(`[data-view-group-kind="resourceGroup"][data-view-entity-id="${f.g2.id}"]`);
  await group2.getByRole("button").click();
  await expect(taskRows(resource, f.task.taskId)).toHaveCount(2);
  await group2.click({ button: "right" });
  await expect(page.getByRole("dialog", { name: "작업 정보", exact: true })).toHaveCount(0);
  await group2.getByRole("button").click();
  await expect(taskRows(resource, f.task.taskId)).toHaveCount(3);
  await info.attach("schedule-view-resource-1440.png", { body: await page.screenshot(), contentType: "image/png" });
  const open = taskRows(resource, f.task.taskId).first().getByRole("button", { name: `작업 정보 열기: ${f.task.name}`, exact: true });
  await open.focus(); await open.press("Enter");
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
  await editor.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(open).toBeFocused();
  await selector(page).selectOption("equipment");
  const equipment = view(page, "equipment");
  await expect(equipment).toBeVisible();
  // Direct + inherited + archived references to A are one row; Fleet B is one original.
  await expect(taskRows(equipment, f.task.taskId)).toHaveCount(2);
  await expect(equipment).toContainText("모델 미지정");
  await expect(equipment).toContainText("설비 미연결");
  await expect(equipment).toContainText(f.idle.name);
  await expect(equipment).toContainText("하위 작업 없음");
  await expect(equipment.locator(`[data-view-group-kind="equipment"][data-view-entity-id="${f.fleet.id}"]`)).toHaveCount(1);
  await expect(equipment.locator(`[data-view-group-kind="equipment"][data-view-entity-id="${f.unit.id}"]`)).toHaveCount(1);
  await expect(equipment.getByRole("button", { name: /작업 정보 열기: View에서 제외하는 Milestone/ })).toHaveCount(0);
  const equipmentKeys = await taskRows(equipment, f.task.taskId).evaluateAll(rows => rows.map(row => row.getAttribute("data-view-row-key")));
  expect(new Set(equipmentKeys).size).toBe(2);
  const axisMeasurements = [await axisGeometry(frame, equipment, f.task, "day")];
  await expect(equipment.locator("input:not([type=hidden]), [contenteditable=true], .wx-link, .wx-progress-marker, .wx-resizer")).toHaveCount(0);
  const readonlyGrid = equipment.getByRole("treegrid");
  await readonlyGrid.focus();
  await readonlyGrid.press("Delete");
  await readonlyGrid.press("Control+x");
  await readonlyGrid.press("Control+v");
  await taskRows(equipment, f.task.taskId).first().click({ button: "right" });
  await expect(page.locator('[role="menu"]').filter({ visible: true })).toHaveCount(0);
  const rowAlignment = await equipment.locator("[data-view-row-key]").evaluateAll(rows => rows.map(row => {
    const grid = row.querySelector("[data-schedule-view-grid-cell]")!.getBoundingClientRect();
    const chart = row.querySelector("[data-schedule-view-chart-cell]")!.getBoundingClientRect();
    return { gridY: grid.y, chartY: chart.y, gridHeight: grid.height, chartHeight: chart.height };
  }));
  expect(rowAlignment.length).toBeGreaterThan(0);
  for (const row of rowAlignment) {
    expect(Math.abs(row.gridY - row.chartY)).toBeLessThanOrEqual(1);
    expect(Math.abs(row.gridHeight - row.chartHeight)).toBeLessThanOrEqual(1);
  }
  const geometries = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(selector(page)).toBeVisible();
    await expect(selector(page)).toBeEnabled();
    await selector(page).focus(); await expect(selector(page)).toBeFocused();
    const geometry = await equipment.evaluate(root => {
      const bounds = root.getBoundingClientRect();
      const control = document.querySelector<HTMLSelectElement>("[data-schedule-view-selector]")!.getBoundingClientRect();
      return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth,
        left: bounds.left, right: bounds.right, controlHeight: control.height };
    });
    expect(geometry.document, `${width}px document overflow`).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width + 1);
    expect(geometry.controlHeight).toBeGreaterThanOrEqual(36);
    if (width === 390) {
      const bar = taskRows(equipment, f.task.taskId).first().locator(".project-schedule-view-bar");
      await bar.evaluate(element => {
        const owner = element.closest<HTMLElement>("[data-schedule-view-scroll]")!;
        owner.scrollLeft = Math.max(0, Number.parseFloat((element as HTMLElement).style.left) - 16);
      });
      const hit = await bar.evaluate(element => {
        const bounds = element.getBoundingClientRect(), owner = element.closest("[data-schedule-view-scroll]")!.getBoundingClientRect();
        const x = Math.max(owner.left + 1, bounds.left) + Math.min(bounds.width, owner.right - Math.max(owner.left + 1, bounds.left)) / 2;
        const y = bounds.top + bounds.height / 2;
        return { width: bounds.width, x, y, ownerLeft: owner.left, ownerRight: owner.right,
          hit: element.contains(document.elementFromPoint(x, y)) };
      });
      expect(hit.width).toBeGreaterThan(0); expect(hit.x).toBeGreaterThan(hit.ownerLeft); expect(hit.x).toBeLessThan(hit.ownerRight); expect(hit.hit).toBe(true);
      geometries.push({ width, barHit: hit });
    }
    geometries.push({ width, ...geometry });
    await info.attach(`schedule-view-equipment-${width}.png`, { body: await page.screenshot(), contentType: "image/png" });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await frame.getByRole("button", { name: "주", exact: true }).click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  axisMeasurements.push(await axisGeometry(frame, equipment, f.task, "week"));
  await expect(selector(page)).toHaveValue("equipment");
  await frame.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("project-gantt-frame"))).toBe(true);
  await expect(selector(page)).toBeVisible();
  await frame.getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await selector(page).selectOption("wbs");
  await expect(frame.locator(".wx-gantt")).toBeVisible();
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
  expect(await gantt!.evaluate(element => element.isConnected)).toBe(true);
  expect(writes).toEqual([]);
  expect((await f.snapshot()).data).toEqual(baseline.data);
  await info.attach("schedule-view-readonly-receipt", { contentType: "application/json", body: JSON.stringify({
    projectRevision: baseline.data.project.revision, sharedResourceRows: sharedKeys, sharedEquipmentRows: equipmentKeys,
    canonicalTaskId: f.task.taskId, remounts: 0, projectWrites: writes, geometries, rowAlignment, axisMeasurements,
  }, null, 2) });
});

test("#880 source 조회 실패·잘못된 Project/revision·늦은 Resource 응답은 현재 설비 View를 오염하지 않는다", async ({ page, isolatedApplication, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedScheduleViews(page, isolatedApplication, observeIsolatedApi);
  await openWorkspaceView(page, "schedule");
  const baseline = await f.snapshot();
  const writes = observeProjectWrites(page, f.publicId);
  const sourcePath = `**/api/projects/${f.publicId}/schedule-view-source`;
  let responseKind: number | "wrong-project" | "stale" | "late" | "real" = 401;
  let release!: () => void;
  let lateReady = false;
  let lateFinished = false;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(sourcePath, async route => {
    const currentKind = responseKind;
    if (typeof currentKind === "number") {
      await route.fulfill({ status: currentKind, json: { error: { code: "INJECTED_READ_FAILURE" } } });
      return;
    }
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    if (currentKind === "late") {
      lateReady = true; await held;
      await route.fulfill({ response }); lateFinished = true; return;
    }
    if (currentKind === "real") { await route.fulfill({ response }); return; }
    const payload = await response.json();
    if (currentKind === "wrong-project") payload.data.projectPublicId = "00000000-0000-4000-8000-000000000001";
    else payload.data.projectRevision += 1;
    await route.fulfill({ status: 200, json: payload });
  });
  await selector(page).selectOption("resource");
  const resource = view(page, "resource");
  const observations = [];
  for (const kind of [401, 403, 409, 412, 429, 500, "wrong-project", "stale"] as const) {
    responseKind = kind;
    if (kind !== 401) {
      const completed = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/schedule-view-source"));
      await resource.getByRole("button", { name: "다시 조회", exact: true }).click();
      await completed;
    }
    await expect(resource.getByRole("alert")).toContainText("View 데이터를 확인할 수 없습니다");
    await expect(resource.locator("[data-canonical-task-id]")).toHaveCount(0);
    observations.push({ injected: kind, rows: 0 });
  }
  responseKind = "late";
  await resource.getByRole("button", { name: "다시 조회", exact: true }).click();
  await expect.poll(() => lateReady).toBe(true);
  responseKind = "real";
  await selector(page).selectOption("equipment");
  const equipment = view(page, "equipment");
  await expect(taskRows(equipment, f.task.taskId)).toHaveCount(2);
  release();
  await expect.poll(() => lateFinished).toBe(true);
  await expect(selector(page)).toHaveValue("equipment");
  await expect(resource).toHaveCount(0);
  await expect(taskRows(equipment, f.task.taskId)).toHaveCount(2);
  await expect(equipment.getByRole("alert")).toHaveCount(0);
  expect(writes).toEqual([]);
  expect((await f.snapshot()).data).toEqual(baseline.data);
  await info.attach("schedule-view-read-errors", { contentType: "application/json", body: JSON.stringify({
    scope: "UI transport failures injected over real source GET; HTTP status origin contracts are verified separately in server integration tests",
    observations, lateResponseView: "equipment", projectWrites: writes,
  }, null, 2) });
});

test("#880 85개 일반 Task의 가상행 window와 검색·계층 필터의 동일 원본 조회", async ({ page, isolatedApplication, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedScheduleViews(page, isolatedApplication, observeIsolatedApi);
  const populated = await addScheduleViewPopulation(page, isolatedApplication, f.api, 85);
  const baseline = await f.snapshot();
  const scopeTask = populated.data.tasks.find(task => task.externalId === "VIEW880-ROOT")!;
  await page.goto(`${isolatedApplication}/projects/${f.publicId}?rootTask=${scopeTask.taskId}`);
  await openWorkspaceView(page, "schedule");
  const frame = page.locator(".project-gantt-frame");
  const nativeRow = frame.locator('.wx-row[role="row"]').first();
  await expect(nativeRow).toBeVisible();
  const beforeCellHeight = Number(await frame.getAttribute("data-gantt-cell-height"));
  await nativeRow.hover(); await page.keyboard.down("Control"); await page.mouse.wheel(0, 120); await page.keyboard.up("Control");
  await expect(frame).toHaveAttribute("data-gantt-cell-height", String(beforeCellHeight - 2));
  const expectedViewport = { operation: "observe" as const, api: await frame.getAttribute("data-project-gantt-api-instance"),
    revision: baseline.data.project.revision, scale: "day" as const, scope: scopeTask.taskId, query: "",
    queryWitness: { kind: "unchanged" as const }, allowCancelledPriorWork: true, requireRenderedRows: true };
  await waitForGanttReadiness(frame, { ...expectedViewport, operation: "scroll", targetLeft: 120 });
  await frame.locator(".wx-chart").first().evaluate(element => { element.scrollLeft = 120; });
  await frame.locator(".wx-gantt").first().evaluate(element => { element.scrollTop = 38; });
  await waitForGanttReadiness(frame, { ...expectedViewport, operation: "scroll", targetLeft: 120 });
  const wbsState = () => frame.evaluate(element => ({
    instance: element.getAttribute("data-project-gantt-api-instance"), density: element.getAttribute("data-gantt-cell-height"),
    chartLeft: element.querySelector(".wx-chart")!.scrollLeft, top: element.querySelector(".wx-gantt")!.scrollTop,
    scope: new URL(location.href).searchParams.get("rootTask"),
    columns: Array.from(element.querySelectorAll('[role="columnheader"]')).map(node => ({ id: node.getAttribute("data-header-id"), width: node.getBoundingClientRect().width })),
  }));
  await expect.poll(async () => (await wbsState()).chartLeft).toBe(120);
  await expect.poll(async () => (await wbsState()).top).toBe(38);
  const before = await wbsState();
  const writes = observeProjectWrites(page, f.publicId);
  await selector(page).selectOption("resource");
  const resource = view(page, "resource");
  await expect(resource).toBeVisible();
  await expect(resource.getByRole("treegrid")).toHaveAttribute("data-ready", "true");
  await expect(resource.getByRole("treegrid")).toHaveAttribute("data-logical-row-count", "86");
  const rendered = await resource.locator("[data-view-row-key]").count();
  expect(rendered).toBeLessThan(85);
  const metrics = await resource.evaluate(root => {
    const owner = root.querySelector<HTMLElement>("[data-schedule-view-scroll]") ?? root as HTMLElement;
    return { height: owner.clientHeight, scrollHeight: owner.scrollHeight, rows: root.querySelectorAll("[data-view-row-key]").length };
  });
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
  const scrollStart = await page.evaluate(() => performance.now());
  const virtualGrid = resource.getByRole("treegrid");
  await virtualGrid.focus(); await virtualGrid.press("End");
  const lastTask = resource.getByRole("button", { name: "작업 정보 열기: 가상화 작업 084", exact: true });
  await expect(lastTask).toBeVisible(); await expect(lastTask).toBeFocused();
  const settledMs = await page.evaluate(started => performance.now() - started, scrollStart);
  expect(settledMs).toBeLessThan(2_000);
  await virtualGrid.press("Home");
  await expect(resource.locator('[data-view-row-kind="group"]').first().getByRole("button")).toBeFocused();
  await selector(page).selectOption("equipment");
  await expect(view(page, "equipment").getByRole("treegrid")).toHaveAttribute("data-ready", "true");
  await selector(page).selectOption("wbs");
  await expect.poll(wbsState).toEqual(before);
  await selector(page).selectOption("resource");
  await page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true }).fill("가상화 작업 084");
  await expect(resource.getByRole("button", { name: "작업 정보 열기: 가상화 작업 084", exact: true })).toBeVisible();
  await expect(resource.locator("[data-canonical-task-id]")).toHaveCount(1);
  await selector(page).selectOption("equipment");
  const equipment = view(page, "equipment");
  await expect(equipment.getByRole("button", { name: "작업 정보 열기: 가상화 작업 084", exact: true })).toBeVisible();
  await expect(equipment.locator("[data-canonical-task-id]")).toHaveCount(1);
  await selector(page).selectOption("wbs");
  await expect(page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true })).toHaveValue("가상화 작업 084");
  expect(writes).toEqual([]);
  expect((await f.snapshot()).data).toEqual(baseline.data);
  await info.attach("schedule-view-virtualization", { contentType: "application/json", body: JSON.stringify({
    canonicalTaskCount: populated.data.tasks.length, rendered, metrics, settledMs, wbsState: before, projectWrites: writes,
  }, null, 2) });
});

test("#880 비WBS 원본 Editor 실제 If-Match 저장과 동일 표시행 복귀·같은 탭 Group 원본 변경 재조회", async ({ page, isolatedApplication, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedScheduleViews(page, isolatedApplication, observeIsolatedApi);
  await openWorkspaceView(page, "schedule");
  const before = await f.snapshot();
  const writes = observeProjectWrites(page, f.publicId);
  await selector(page).selectOption("resource");
  const resource = view(page, "resource");
  await expect(taskRows(resource, f.task.taskId)).toHaveCount(3);
  const originalRow = taskRows(resource, f.task.taskId).first();
  const originalKey = await originalRow.getAttribute("data-view-row-key");
  await originalRow.getByRole("button", { name: `작업 정보 열기: ${f.task.name}`, exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  const renamed = "Resource View에서 원본 저장";
  await editor.getByLabel("작업명", { exact: true }).fill(renamed);
  const committed = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/tasks/${f.task.taskId}`);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  const response = await committed;
  expect(response.status()).toBe(200);
  expect(response.request().headers()["if-match"]).toBe(`"${before.data.project.revision}"`);
  await expect(editor).toHaveCount(0);
  await expect(taskRows(resource, f.task.taskId)).toHaveCount(3);
  const restoredRow = taskRows(resource, f.task.taskId).first();
  await expect(restoredRow).toHaveAttribute("data-view-row-key", originalKey!);
  await expect(restoredRow.getByRole("button", { name: `작업 정보 열기: ${renamed}`, exact: true })).toBeFocused();
  const after = await f.snapshot();
  expect(after.data.project.revision).toBe(before.data.project.revision + 1);
  expect(after.data.tasks.find(task => task.taskId === f.task.taskId)!.name).toBe(renamed);
  expect(writes).toEqual([`PATCH /api/projects/${f.publicId}/tasks/${f.task.taskId}`]);
  await openWorkspaceView(page, "resource-master");
  let catalog = (await (await page.request.get(`${isolatedApplication}/api/resources`)).json()).data;
  const groupName = "같은 탭에서 갱신한 Group";
  const rename = await page.request.patch(`${isolatedApplication}/api/resource-groups/${f.g1.id}`, {
    headers: { Origin: isolatedApplication, "If-Match": `"${catalog.revision}"` }, data: { name: groupName },
  });
  expect(rename.status()).toBe(200); catalog = (await rename.json()).data;
  const membership = await page.request.put(`${isolatedApplication}/api/resource-groups/${f.g2.id}/members`, {
    headers: { Origin: isolatedApplication, "If-Match": `"${catalog.revision}"` }, data: { resourceIds: [] },
  });
  expect(membership.status()).toBe(200);
  await openWorkspaceView(page, "schedule");
  await expect(selector(page)).toHaveValue("resource");
  await expect(resource.getByRole("treegrid")).toHaveAttribute("data-ready", "true");
  await expect(taskRows(resource, f.task.taskId)).toHaveCount(2);
  const updatedGroup = resource.locator(`[data-view-group-kind="resourceGroup"][data-view-entity-id="${f.g1.id}"]`);
  await expect(updatedGroup).toContainText(groupName);
  await expect(updatedGroup).not.toContainText("Group 1");
  await expect(resource.locator(`[data-view-group-kind="resourceGroup"][data-view-entity-id="${f.g2.id}"]`)).toHaveCount(0);
  expect((await f.snapshot()).data).toEqual(after.data);
  expect(writes).toEqual([`PATCH /api/projects/${f.publicId}/tasks/${f.task.taskId}`]);
  await info.attach("schedule-view-editor-catalog-receipt", { contentType: "application/json", body: JSON.stringify({
    canonicalTaskId: f.task.taskId, originalKey, beforeRevision: before.data.project.revision, afterRevision: after.data.project.revision,
    projectWrites: writes, sourceAfterMembershipRows: 2, groupName,
  }, null, 2) });
});
