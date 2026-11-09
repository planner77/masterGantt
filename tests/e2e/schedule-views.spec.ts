import type { Locator, Page } from "@playwright/test";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { seedScheduleViews, scheduleViewResourcePassword, addScheduleViewPopulation } from "./fixtures/schedule-views";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { captureSyntheticUiEvidence } from "./helpers/ui-evidence";
import { waitForGanttReadiness } from "./helpers/gantt-readiness";
import { seedReorderProject, taskRow } from "./helpers/grid-task-reorder";
import type { ProjectSnapshotResponse } from "../../src/contracts/projects";
import type { ResourceCatalogResponse } from "../../src/contracts/resources";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword,
  isolatedResourceAdminPassword: scheduleViewResourcePassword, viewport: { width: 1440, height: 1000 } });

const selector = (page: Page) => page.getByLabel("View", { exact: true });
const view = (page: Page, name: "resource" | "equipment") => page.locator(`[data-schedule-view="${name}"]`);
const taskRows = (root: Locator, taskId: string) => root.locator(`[data-view-row-key][data-canonical-task-id="${taskId}"]`);
const viewHeaderLabels = {
  ko: { copySelection: "선택", text: "작업", projectStart: "시작", projectDuration: "기간" },
  en: { copySelection: "Select", text: "Task", projectStart: "Start", projectDuration: "Duration" },
  vi: { copySelection: "Chọn", text: "Công việc", projectStart: "Bắt đầu", projectDuration: "Thời lượng" },
} as const;
async function expectViewHeaders(root: Locator, locale: keyof typeof viewHeaderLabels) {
  for (const [id, label] of Object.entries(viewHeaderLabels[locale]))
    await expect(root.locator(`[role="columnheader"][data-column-id="${id}"]`)).toHaveText(label);
}

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
  await captureSyntheticUiEvidence(page, info, {
    issue: 889, acceptanceCriteria: ["AC01", "AC03"], state: "resource-1440-ko",
    fixture: "schedule-views", locale: "ko",
    elements: [
      { name: "viewSelector", locator: selector(page) },
      { name: "resourceView", locator: resource },
    ],
  });
  await info.attach("schedule-view-resource-1440.png", { body: await page.screenshot({ path: "output/playwright/issue-889-890/resource-1440.png" }), contentType: "image/png" });
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
      const scrollOwnership = await bar.evaluate(element => {
        const owner = element.closest<HTMLElement>("[data-schedule-view-scroll]")!;
        const outer = element.closest<HTMLElement>(".project-schedule-view")!;
        const grid = element.closest("[data-view-row-key]")!.querySelector("[data-schedule-view-grid-cell]")!;
        const before = { outerLeft: outer.scrollLeft, innerLeft: owner.scrollLeft,
          outerWidth: outer.clientWidth, innerWidth: owner.clientWidth, barX: element.getBoundingClientRect().x };
        // WBS and projected Views share a minimum-width work surface. Its
        // outer horizontal owner reveals the chart on a narrow viewport.
        owner.scrollLeft = Math.max(0, Number.parseFloat((element as HTMLElement).style.left) - 16);
        outer.scrollLeft = Math.max(0, grid.getBoundingClientRect().width - 80);
        return { before, after: { outerLeft: outer.scrollLeft, innerLeft: owner.scrollLeft } };
      });
      const hit = await bar.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const owner = element.closest(".project-schedule-view")!.getBoundingClientRect();
        const left = Math.max(0, owner.left, bounds.left), right = Math.min(innerWidth, owner.right, bounds.right);
        const top = Math.max(0, owner.top, bounds.top), bottom = Math.min(innerHeight, owner.bottom, bounds.bottom);
        const x = (left + right) / 2, y = (top + bottom) / 2;
        return { width: bounds.width, visibleWidth: right - left, visibleHeight: bottom - top, x, y, ownerLeft: owner.left, ownerRight: owner.right,
          hit: element.contains(document.elementFromPoint(x, y)) };
      });
      await info.attach("schedule-view-390-scroll-owners", { contentType: "application/json", body: JSON.stringify({ scrollOwnership, hit }) });
      expect(hit.width).toBeGreaterThan(0); expect(hit.visibleWidth).toBeGreaterThan(0); expect(hit.visibleHeight).toBeGreaterThan(0);
      expect(hit.x).toBeGreaterThan(hit.ownerLeft); expect(hit.x).toBeLessThan(hit.ownerRight); expect(hit.hit).toBe(true);
      await page.mouse.click(hit.x, hit.y);
      await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
      await editor.press("Escape"); await expect(editor).toHaveCount(0);
      geometries.push({ width, barHit: hit });
    }
    geometries.push({ width, ...geometry });
    await expect(equipment.getByRole("treegrid")).toHaveAttribute("data-ready", "true");
    await info.attach(`schedule-view-equipment-${width}.png`, { body: await page.screenshot({ path: `output/playwright/issue-889-890/equipment-${width}.png` }), contentType: "image/png" });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await frame.getByRole("button", { name: "주", exact: true }).click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  axisMeasurements.push(await axisGeometry(frame, equipment, f.task, "week"));
  await expect(selector(page)).toHaveValue("equipment");
  await frame.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("project-gantt-frame"))).toBe(true);
  await expect(selector(page)).toBeVisible();
  const scaleCell = equipment.locator(".project-schedule-view-scale-row").last().locator("[data-scale-date]").first();
  await scaleCell.focus();
  const scaleTooltip = page.locator(".project-schedule-view-scale-tooltip");
  await expect(scaleTooltip).toBeVisible();
  expect(await scaleTooltip.evaluate(element => document.fullscreenElement?.contains(element))).toBe(true);
  for (const locale of ["vi", "en", "ko"] as const) {
    // Exercise the actual cross-tab preference event without moving header focus.
    await page.evaluate(locale => {
      const key = "mastergantt.ui.locale";
      localStorage.setItem(key, locale);
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: locale, storageArea: localStorage }));
    }, locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(scaleCell).toBeFocused();
    await expectViewHeaders(equipment, locale);
    await expect(scaleTooltip).toHaveText((await scaleCell.getAttribute("aria-label"))!);
    expect(await scaleTooltip.evaluate(element => {
      const box = element.getBoundingClientRect(); return { visible: box.width > 0 && box.height > 0, fullscreen: document.fullscreenElement?.contains(element) };
    })).toEqual({ visible: true, fullscreen: true });
  }
  await scaleCell.press("Escape");
  await expect(scaleTooltip).toHaveCount(0);
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
      await page.locator(".project-gantt-frame").getByRole("button", { name: "다시 조회", exact: true }).click();
      await completed;
    }
    await expect(page.locator(".project-gantt-frame").getByRole("alert")).toContainText("View 데이터를 확인할 수 없습니다");
    await expect(resource.locator("[data-canonical-task-id]")).toHaveCount(0);
    if (kind === 401) for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      const alert = page.locator(".project-gantt-frame").getByRole("alert");
      const geometry = await alert.evaluate(element => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
      });
      expect(geometry.width).toBeGreaterThan(60); expect(geometry.height).toBeGreaterThan(12);
      const refresh = page.locator(".project-gantt-frame").getByRole("button", { name: "다시 조회", exact: true });
      await refresh.focus(); await expect(refresh).toBeFocused();
      expect(await refresh.evaluate(element => {
        const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
      observations.push({ injected: kind, viewport: width, alert: geometry });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    observations.push({ injected: kind, rows: 0 });
  }
  responseKind = "late";
  await page.locator(".project-gantt-frame").getByRole("button", { name: "다시 조회", exact: true }).click();
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
  await expect(page.locator(".project-gantt-frame").getByRole("alert")).toHaveCount(0);
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

test("#880 P2 WBS 복수 선택·Copy·Shift anchor는 Task 조작 없는 View 왕복에서 유지된다", async ({ page, isolatedApplication }, info) => {
  test.setTimeout(180_000);
  const f = await seedReorderProject(page, isolatedApplication);
  const frame = page.locator(".project-gantt-frame");
  const before = (await (await page.request.get(f.api)).json()) as ProjectSnapshotResponse;
  await waitForGanttReadiness(frame, { operation: "observe", api: await frame.getAttribute("data-project-gantt-api-instance"),
    revision: before.data.project.revision, scale: "day", scope: null, query: "", queryWitness: { kind: "unchanged" },
    requireRenderedRows: true, allowCancelledPriorWork: true });
  const ids = ["Task A", "Task B", "Task C"].map(name => before.data.tasks.find(task => task.name === name)!.taskId);
  await taskRow(page, "Task A").locator("input[data-copy-selection]").check();
  await taskRow(page, "Task B").locator("input[data-copy-selection]").check();
  const selection = () => frame.evaluate(element => {
    const state = Reflect.get(element, "__masterganttMilestoneTimeline").read();
    return { instance: state.instance as string, app: [...state.appSelection].sort() as string[],
      primary: [...state.selected].sort() as string[], clipboard: [...state.clipboardIds].sort() as string[] };
  });
  await expect.poll(async () => (await selection()).app).toEqual(ids.slice(0, 2).sort());
  await frame.getByRole("button", { name: "선택 복사", exact: true }).click();
  await expect.poll(async () => (await selection()).clipboard).toEqual(ids.slice(0, 2).sort());
  const selectedBefore = await selection();
  const writes = observeProjectWrites(page, f.project.publicId);
  for (const mode of ["resource", "equipment"] as const) {
    await selector(page).selectOption(mode);
    await expect(view(page, mode).getByRole("treegrid")).toHaveAttribute("data-ready", "true");
    await expect(view(page, mode).locator('[data-view-row-kind="task"][aria-selected="true"]')).toHaveCount(2);
  }
  await selector(page).selectOption("wbs");
  await expect(frame.locator(".wx-gantt")).toBeVisible();
  await expect.soft.poll(selection, { message: "View 왕복은 전체 app selection·기존 Core primary·Copy roots를 변경하지 않는다" }).toEqual(selectedBefore);
  const afterRoundTrip = await selection();
  await frame.getByRole("button", { name: "선택 복사", exact: true }).click();
  await expect.soft.poll(async () => (await selection()).clipboard, { message: "왕복 후 선택 복사도 원래 두 Task를 복사한다" }).toEqual(ids.slice(0, 2).sort());
  await taskRow(page, "Task C").locator("input[data-copy-selection]").click({ modifiers: ["Shift"] });
  await expect.soft.poll(async () => (await selection()).app, { message: "마지막 checkbox B의 anchor를 유지하여 Shift+C는 B~C를 선택한다" }).toEqual(ids.slice(1).sort());
  const afterRangeGesture = await selection();
  await selector(page).selectOption("resource");
  const resource = view(page, "resource");
  await expect(resource.getByRole("treegrid")).toHaveAttribute("data-ready", "true");
  await taskRows(resource, ids[2]).getByRole("button", { name: "작업 정보 열기: Task C", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Task C");
  await editor.press("Escape"); await expect(editor).toHaveCount(0);
  await selector(page).selectOption("wbs");
  await expect.poll(async () => { const current = await selection(); return { app: current.app, primary: current.primary }; }).toEqual({ app: [ids[2]], primary: [ids[2]] });
  const afterExplicitSelection = await selection();
  await taskRow(page, "Task B").locator("input[data-copy-selection]").click({ modifiers: ["Shift"] });
  await expect.poll(async () => (await selection()).app, { message: "명시적 Task C는 새 anchor이며 Shift+B는 B~C를 선택한다" }).toEqual(ids.slice(1).sort());
  expect(writes).toEqual([]);
  expect(((await (await page.request.get(f.api)).json()) as ProjectSnapshotResponse).data).toEqual(before.data);
  await info.attach("schedule-view-selection-roundtrip", { contentType: "application/json", body: JSON.stringify({
    selectedBefore, afterRoundTrip, afterRangeGesture, afterExplicitSelection, afterExplicitRange: await selection(), projectWrites: writes,
  }, null, 2) });
});

test("#880 P2 비WBS nonzero viewport는 재조회·Editor 취소와 저장·workspace 복귀 및 새 사용자 wheel을 보존한다", async ({ page, isolatedApplication, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedScheduleViews(page, isolatedApplication, observeIsolatedApi);
  const populated = await addScheduleViewPopulation(page, isolatedApplication, f.api, 85);
  const scope = populated.data.tasks.find(task => task.externalId === "VIEW880-ROOT")!;
  const target = populated.data.tasks.find(task => task.externalId === "VIEW880-15")!;
  const membershipTask = populated.data.tasks.find(task => task.externalId === "VIEW880-0")!;
  let catalog = ((await (await page.request.get(`${isolatedApplication}/api/resources`)).json()) as ResourceCatalogResponse).data;
  await f.mutate(`/tasks/${membershipTask.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: f.alice.id }] }, "put");
  const baseline = await f.snapshot();
  const apiPath = new URL(f.api).pathname;
  await page.goto(`${isolatedApplication}/projects/${f.publicId}?rootTask=${scope.taskId}`);
  const frame = page.locator(".project-gantt-frame");
  await waitForGanttReadiness(frame, { operation: "scroll", api: await frame.getAttribute("data-project-gantt-api-instance"),
    revision: baseline.data.project.revision, scale: "day", scope: scope.taskId, query: "", queryWitness: { kind: "unchanged" },
    targetLeft: 120, requireRenderedRows: true, allowCancelledPriorWork: true });
  await selector(page).selectOption("resource");
  const root = view(page, "resource"), grid = root.getByRole("treegrid");
  const position = () => grid.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }));
  const prepare = async () => {
    await expect(grid).toHaveAttribute("data-ready", "true");
    await expect(grid).toHaveAttribute("data-logical-row-count", "91");
    const observed = await grid.evaluate(async element => {
      if (element.scrollWidth - element.clientWidth < 120 || element.scrollHeight - element.clientHeight < 512) throw new Error("현재 View의 nonzero viewport capacity가 부족합니다.");
      element.scrollLeft = 120; element.scrollTop = 512;
      for (let index = 0; index < 3; index++) await new Promise<void>(done => requestAnimationFrame(() => done()));
      return { x: element.scrollLeft, y: element.scrollTop };
    });
    expect(observed).toEqual({ x: 120, y: 512 });
    await expect.poll(position).toEqual(observed);
    return observed;
  };
  const phases: Array<{ name: string; before: { x: number; y: number }; after: { x: number; y: number } }> = [];
  const verify = async (name: string, before: { x: number; y: number }) => {
    await expect(grid).toHaveAttribute("data-ready", "true");
    await expect.soft.poll(position, { message: `${name}: 같은 의미의 source 갱신은 nonzero viewport를 보존한다` }).toEqual(before);
    phases.push({ name, before, after: await position() });
  };
  let prepared = await prepare();
  await page.locator(".project-gantt-frame").getByRole("button", { name: "다시 조회", exact: true }).click();
  await verify("다시 조회", prepared);
  prepared = await prepare();
  await taskRows(root, target.taskId).getByRole("button", { name: `작업 정보 열기: ${target.name}`, exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(target.name);
  await editor.press("Escape");
  await expect(editor).toHaveCount(0);
  await verify("Editor 취소", prepared);
  prepared = await prepare();
  await taskRows(root, target.taskId).getByRole("button", { name: `작업 정보 열기: ${target.name}`, exact: true }).click();
  await editor.getByLabel("작업명", { exact: true }).fill(`${target.name} 원본 저장`);
  const committed = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `${apiPath}/tasks/${target.taskId}`);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  expect((await committed).status()).toBe(200);
  await expect(editor).toHaveCount(0);
  await verify("Editor 저장", prepared);
  const afterTaskSave = await f.snapshot();
  prepared = await prepare();
  await openWorkspaceView(page, "resource-master");
  await openWorkspaceView(page, "schedule");
  await verify("workspace 복귀", prepared);

  prepared = await prepare();
  let release!: () => void, started = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const path = `**${apiPath}/schedule-view-source`;
  await page.route(path, async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200); started = true;
    await gate; await route.fulfill({ response });
  });
  try {
    await page.locator(".project-gantt-frame").getByRole("button", { name: "다시 조회", exact: true }).click();
    await expect.poll(() => started).toBe(true);
    await grid.hover(); await page.mouse.wheel(40, 64);
    const newerIntent = { x: prepared.x + 40, y: prepared.y + 64 };
    await expect.soft.poll(position, { message: "늦은 source 응답을 기다리는 동안 실제 wheel이 현재 viewport를 소유한다" }).toEqual(newerIntent);
    release();
    await expect(grid).toHaveAttribute("data-ready", "true");
    await expect.soft.poll(position, { message: "늦은 응답은 새 사용자 wheel을 덮지 않는다" }).toEqual(newerIntent);
    phases.push({ name: "새 wheel 우선", before: newerIntent, after: await position() });
  } finally { release(); await page.unroute(path); }

  await expect(grid).toHaveAttribute("data-ready", "true");
  await grid.evaluate(async element => {
    element.scrollLeft = 120; element.scrollTop = 0;
    for (let index = 0; index < 3; index++) await new Promise<void>(done => requestAnimationFrame(() => done()));
  });
  const originalPath = root.locator(`[data-canonical-task-id="${membershipTask.taskId}"][data-view-row-key*="${f.g1.id}"]`);
  await expect(originalPath).toBeVisible();
  const logicalIndex = Number(await originalPath.getAttribute("aria-rowindex")) - 2;
  const anchorTop = logicalIndex * Number(await frame.getAttribute("data-gantt-cell-height"));
  expect(logicalIndex).toBeGreaterThan(0); expect(anchorTop).toBeGreaterThan(0);
  await grid.evaluate(async (element, y) => {
    if (element.scrollHeight - element.clientHeight < y) throw new Error("실제 Task top-anchor를 배치할 현재 View의 capacity가 부족합니다.");
    element.scrollLeft = 120; element.scrollTop = y;
    for (let index = 0; index < 3; index++) await new Promise<void>(done => requestAnimationFrame(() => done()));
  }, anchorTop);
  await expect.poll(position).toEqual({ x: 120, y: anchorTop });
  await originalPath.getByRole("button", { name: `작업 정보 열기: ${membershipTask.name}`, exact: true }).click();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(membershipTask.name);
  await editor.press("Escape"); await expect(editor).toHaveCount(0);
  await expect(grid).toHaveAttribute("data-ready", "true");
  const anchor = (row: Locator) => row.evaluate(element => ({
    canonicalTaskId: element.getAttribute("data-canonical-task-id"), viewRowKey: element.getAttribute("data-view-row-key"),
    y: element.getBoundingClientRect().top - element.closest("[data-schedule-view-scroll]")!.getBoundingClientRect().top,
  }));
  const originalAnchor = await anchor(originalPath);
  const renamed = await page.request.patch(`${isolatedApplication}/api/resource-groups/${f.g1.id}`, {
    headers: { Origin: isolatedApplication, "If-Match": `"${catalog.revision}"` }, data: { name: "ZZ Group" },
  });
  expect(renamed.status()).toBe(200); catalog = ((await renamed.json()) as ResourceCatalogResponse).data;
  await page.locator(".project-gantt-frame").getByRole("button", { name: "다시 조회", exact: true }).click();
  await expect(grid).toHaveAttribute("data-ready", "true");
  await expect(root.locator(`[data-view-group-kind="resourceGroup"][data-view-entity-id="${f.g1.id}"]`)).toContainText("ZZ Group");
  await expect.soft.poll(async () => Math.abs((await anchor(originalPath)).y - originalAnchor.y), { message: "Group 정렬이 바뀌어도 같은 표시 경로의 canonical Task 앵커 offset을 유지한다" }).toBeLessThanOrEqual(1);
  const afterRename = await anchor(originalPath);
  expect(afterRename.viewRowKey).toBe(originalAnchor.viewRowKey);
  expect(afterRename.canonicalTaskId).toBe(membershipTask.taskId);
  const removed = await page.request.put(`${isolatedApplication}/api/resource-groups/${f.g1.id}/members`, {
    headers: { Origin: isolatedApplication, "If-Match": `"${catalog.revision}"` }, data: { resourceIds: [f.bob.id] },
  });
  expect(removed.status()).toBe(200);
  await page.locator(".project-gantt-frame").getByRole("button", { name: "다시 조회", exact: true }).click();
  await expect(grid).toHaveAttribute("data-ready", "true");
  await expect(grid).toHaveAttribute("data-logical-row-count", "88");
  await expect(originalPath).toHaveCount(0);
  const fallback = taskRows(root, membershipTask.taskId);
  await expect(fallback).toHaveCount(1);
  await expect.soft.poll(async () => Math.abs((await anchor(fallback)).y - originalAnchor.y), { message: "소속 경로가 없어지면 같은 canonical Task의 다른 유효 경로로 offset을 복원한다" }).toBeLessThanOrEqual(1);
  const afterMembership = await anchor(fallback);
  expect(afterMembership.canonicalTaskId).toBe(membershipTask.taskId);

  const localeSelector = page.locator("header select").filter({ has: page.locator('option[value="en"]') }).first();
  const localeBefore = await position();
  expect(localeBefore.x).toBeGreaterThan(0); expect(localeBefore.y).toBeGreaterThan(0);
  await localeSelector.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(grid).toHaveAttribute("data-ready", "true");
  await expectViewHeaders(root, "en");
  await expect.soft.poll(position, { message: "표시 언어 EN 전환은 같은 View identity와 nonzero viewport를 유지한다" }).toEqual(localeBefore);
  await localeSelector.selectOption("ko");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(grid).toHaveAttribute("data-ready", "true");
  await expectViewHeaders(root, "ko");
  await expect.soft.poll(position, { message: "표시 언어 KO 복귀도 같은 nonzero viewport를 유지한다" }).toEqual(localeBefore);
  expect((await f.snapshot()).data).toEqual(afterTaskSave.data);
  await info.attach("schedule-view-viewport-refresh", { contentType: "application/json", body: JSON.stringify({
    phases, logicalIndex, anchorTop, originalAnchor, afterRename, afterMembership, localeBefore, localeAfter: await position(),
  }, null, 2) });
});

test("#889 세 View 공통 작업면·날짜 헤더·Grid/Chart Ctrl 휠 밀도와 canonical 쓰기0", async ({ page, isolatedApplication, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date("2026-10-14T12:00:00Z"));
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const f = await seedScheduleViews(page, isolatedApplication, observeIsolatedApi);
  await openWorkspaceView(page, "schedule");
  const baseline = await f.snapshot();
  const writes = observeProjectWrites(page, f.publicId);
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const api = await frame.getAttribute("data-project-gantt-api-instance");
  const native = await frame.locator(".wx-gantt").elementHandle();
  const receipts: unknown[] = [];
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const geometry = () => frame.evaluate(element => {
    const mode = element.getAttribute("data-schedule-view-mode");
    const box = (target: Element | null) => {
      if (!target) throw new Error("현재 View geometry target이 없습니다.");
      const rect = target.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return {
      view: box(element.querySelector("[data-schedule-view-selector]")),
      scale: box(element.querySelector(".project-gantt-scale-controls")),
      fullscreen: box(element.querySelector('[aria-keyshortcuts="Control+Shift+F Meta+Shift+F"]')),
      surface: box(element.querySelector(mode === "wbs" ? ".project-gantt-scroll" : ".project-schedule-view")),
      header: box(element.querySelector(mode === "wbs" ? ".wx-scale" : ".project-schedule-view-header")),
      grid: box(element.querySelector(mode === "wbs" ? ".wx-table-container" : "[data-schedule-view-grid-cell]")),
    };
  });
  const waitView = async (mode: "wbs" | "resource" | "equipment") => {
    await selector(page).selectOption(mode);
    if (mode === "wbs") await expect(frame.locator(".wx-gantt")).toBeVisible();
    else await expect(view(page, mode).getByRole("treegrid")).toHaveAttribute("data-ready", "true");
  };
  const compareShell = async (expected: Awaited<ReturnType<typeof geometry>>) => {
    const actual = await geometry();
    for (const key of ["view", "scale", "fullscreen", "surface"] as const) for (const axis of ["x", "y", "width", "height"] as const)
      expect(Math.abs(actual[key][axis] - expected[key][axis]), `${key}.${axis}`).toBeLessThanOrEqual(1);
    expect(Math.abs(actual.header.height - expected.header.height), "동일 2단 날짜 헤더 높이").toBeLessThanOrEqual(1);
    expect(Math.abs(actual.grid.width - expected.grid.width), "동일 native Grid split").toBeLessThanOrEqual(1);
    receipts.push({ mode: await selector(page).inputValue(), ...actual });
  };
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
  for (const scale of ["day", "week"] as const) {
    await waitView("wbs");
    await frame.getByRole("button", { name: scale === "day" ? "일" : "주", exact: true }).click();
    await expect(frame).toHaveAttribute("data-gantt-scale-mode", scale);
    const wbs = await geometry();
    for (const mode of ["resource", "equipment", "wbs"] as const) {
      await waitView(mode); await compareShell(wbs);
      // 기존 조합 단언을 재사용하고 대표 상태만 PNG로 수집한다.
      if ((scale === "day" && (mode === "equipment" || width === 1440))
          || (scale === "week" && width === 1440 && mode === "wbs")) {
        const actual = await geometry();
        const shellError = Math.max(...(["view", "scale", "fullscreen", "surface"] as const)
          .flatMap(key => (["x", "y", "width", "height"] as const).map(axis => Math.abs(actual[key][axis] - wbs[key][axis]))));
        await captureSyntheticUiEvidence(page, info, {
          issue: 889, acceptanceCriteria: ["AC01", "AC02", "AC03"],
          state: `shell-${mode}-${scale}-${width}-ko`, fixture: "schedule-views", locale: "ko",
          fixtureData: { tasks: baseline.data.tasks.map(({ name, type, start, end, duration, progress }) => ({ name, type, start, end, duration, progress })), resources: [f.alice.name, f.bob.name, f.charlie.name], equipment: [f.unit, f.fleet, f.idle].map(({ code, name }) => ({ code, name })) },
          elements: [
            { name: "viewSelector", locator: selector(page) },
            { name: "scaleControls", locator: frame.locator(".project-gantt-scale-controls") },
            { name: "surface", locator: frame.locator(mode === "wbs" ? ".project-gantt-scroll" : ".project-schedule-view") },
            { name: "dateHeader", locator: frame.locator(mode === "wbs" ? ".wx-scale" : ".project-schedule-view-header").first() },
          ],
          flow: { id: `view-roundtrip-${mode}-${scale}-${width}`, steps: ["WBS 기준 측정", `View ${mode} 선택`, "현재 View 준비와 공통 shell 비교"], outcome: "PASS" },
          checks: [
            { ac: "AC01", designRef: "DESIGN.md:1-5", measurement: "shell-max-coordinate-error", expected: 0, actual: shellError, tolerance: 1, outcome: "PASS" },
            { ac: "AC02", designRef: "DESIGN.md:1-5", measurement: "date-header-height-error", expected: wbs.header.height, actual: actual.header.height, tolerance: 1, outcome: "PASS" },
            { ac: "AC02", designRef: "DESIGN.md:1-5", measurement: "grid-split-width", expected: wbs.grid.width, actual: actual.grid.width, tolerance: 1, outcome: "PASS" },
          ],
          exclusions: [{ scope: "native-browser-125-percent-zoom", reason: "현재 자동 시나리오는 100% CSS viewport; native browser 125% 확대는 별도 수동 검증" },
            { scope: "full-business-journey", reason: "이 증거는 현재 View 전환 단계까지; 최종 원본/쓰기0 검증은 별도 완료 상태 증거" }],
        });
      }
    }
    if (scale === "week") {
      await waitView("equipment");
      await expect(view(page, "equipment").locator(".project-schedule-view-axis")).toContainText(/W\d{2}/);
    }
  }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await waitView("wbs");
  await frame.getByRole("button", { name: "일", exact: true }).click();
  const nativeBarHeights = new Map<number, { task: number; summary: number }>();
  for (const mode of ["wbs", "resource", "equipment"] as const) {
    await waitView(mode);
    const target = (surface: "grid" | "chart") => frame.locator(mode === "wbs"
      ? surface === "grid" ? ".wx-table .wx-row[data-id]" : ".wx-chart .wx-bars"
      : surface === "grid" ? "[data-schedule-view-grid-cell]" : "[data-schedule-view-chart-cell]").first();
    for (const surface of ["grid", "chart"] as const) {
      for (const height of [32, 30, 28, 28, 30, 32, 34, 34]) {
        const current = Number(await frame.getAttribute("data-gantt-cell-height"));
        const delta = height < current || height === 28 ? 120 : -120;
        const consumed = await target(surface).evaluate((element, deltaY) => {
          const event = new WheelEvent("wheel", { ctrlKey: true, deltaY, bubbles: true, cancelable: true });
          element.dispatchEvent(event); return event.defaultPrevented;
        }, delta);
        expect(consumed, `${mode}/${surface}: 본문 Ctrl+휠 브라우저 확대 차단`).toBe(true);
        await expect(frame).toHaveAttribute("data-gantt-cell-height", String(height));
        await expect(frame).toHaveAttribute("data-project-gantt-api-instance", api!);
        if (mode === "wbs") {
          const task = await frame.locator(".wx-bar.wx-task").first().evaluate(element => element.getBoundingClientRect().height);
          const summary = await frame.locator(".wx-bar.wx-summary").first().evaluate(element => Number.parseFloat(getComputedStyle(element, "::before").height));
          nativeBarHeights.set(height, { task, summary });
        } else {
          const nativeHeight = nativeBarHeights.get(height)!;
          await expect.poll(() => view(page, mode).locator(".project-schedule-view-bar").first().evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(nativeHeight.task, 0);
          await expect.poll(() => view(page, mode).locator(".project-schedule-view-summary-bar").first().evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(nativeHeight.summary, 0);
          const offsets = await view(page, mode).locator("[data-view-row-key]").evaluateAll(rows => rows.map(row => {
            const grid = row.querySelector("[data-schedule-view-grid-cell]")!.getBoundingClientRect();
            const chart = row.querySelector("[data-schedule-view-chart-cell]")!.getBoundingClientRect();
            const bar = row.querySelector(".project-schedule-view-bar, .project-schedule-view-summary-bar")?.getBoundingClientRect();
            return { row: row.getBoundingClientRect().height, grid: grid.height, chart: chart.height, error: bar ? Math.abs(bar.y + bar.height / 2 - grid.y - grid.height / 2) : 0 };
          }));
          for (const row of offsets) {
            expect(row.row).toBe(height); expect(row.grid).toBe(row.chart);
            // Grid/Chart cells share the row content box, excluding its 1px divider.
            expect(row.grid).toBeGreaterThanOrEqual(height - 1); expect(row.grid).toBeLessThanOrEqual(height);
            expect(row.error).toBeLessThanOrEqual(1);
          }
        }
      }
    }
    if (mode !== "wbs") {
      // The last-row/empty-body canvas owns the same shortcut as row cells.
      const blank = view(page, mode).locator(".project-schedule-view-canvas");
      const consumed = await blank.evaluate(element => {
        const event = new WheelEvent("wheel", { ctrlKey: true, deltaY: 120, bubbles: true, cancelable: true });
        element.dispatchEvent(event); return event.defaultPrevented;
      });
      expect(consumed).toBe(true);
      await expect(frame).toHaveAttribute("data-gantt-cell-height", "32");
      await target("grid").dispatchEvent("wheel", { ctrlKey: true, deltaY: -120, bubbles: true, cancelable: true });
      await expect(frame).toHaveAttribute("data-gantt-cell-height", "34");
    }
    const header = frame.locator(mode === "wbs" ? ".wx-scale" : ".project-schedule-view-header").first();
    const excluded = await header.evaluate(element => {
      const event = new WheelEvent("wheel", { ctrlKey: true, deltaY: 120, bubbles: true, cancelable: true });
      element.dispatchEvent(event); return event.defaultPrevented;
    });
    expect(excluded).toBe(false);
    const ordinary = await target("grid").evaluate(element => {
      const event = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
      element.dispatchEvent(event); return event.defaultPrevented;
    });
    expect(ordinary).toBe(false);
    await expect(frame).toHaveAttribute("data-gantt-cell-height", "34");
  }
  await waitView("wbs");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  expect(await native!.evaluate(element => element.isConnected)).toBe(true);
  await page.screenshot({ path: "output/playwright/issue-889-890/wbs-1440.png" });
  expect(writes).toEqual([]); expect((await f.snapshot()).data).toEqual(baseline.data);
  // 실제 CSS 회귀를 통제 주입해 검출하고 캡처 실패 시에도 원래 화면을 복원한다.
  const controlBefore = (await selector(page).boundingBox())!;
  const originalControlStyle = await selector(page).getAttribute("style");
  try {
    await selector(page).evaluate(element => (element as HTMLElement).style.setProperty("transform", "translateY(4px)", "important"));
    const displaced = (await selector(page).boundingBox())!;
    const yError = Math.abs(displaced.y - controlBefore.y);
    expect(yError, "의도적 CSS 회귀는 기존 1px shell 허용오차를 초과해야 함").toBeGreaterThan(1);
    await captureSyntheticUiEvidence(page, info, {
      issue: 889, acceptanceCriteria: ["AC01"], state: "controlled-negative-selector-offset-1440-ko", fixture: "schedule-views", locale: "ko",
      fixtureData: { tasks: baseline.data.tasks.map(({ name, type, start, end, duration, progress }) => ({ name, type, start, end, duration, progress })), resources: [f.alice.name, f.bob.name, f.charlie.name], equipment: [f.unit, f.fleet, f.idle].map(({ code, name }) => ({ code, name })) },
      elements: [{ name: "viewSelector", locator: selector(page) }, { name: "wbsSurface", locator: frame.locator(".project-gantt-scroll") }],
      flow: { id: "controlled-css-regression-detected", steps: ["정상 WBS selector 좌표 측정", "테스트 전용 CSS translateY(4px) 주입", "기존 1px 허용오차 초과 검출"], outcome: "PASS" },
      checks: [{ ac: "AC01", designRef: "DESIGN.md:1-5", measurement: "controlled-selector-y-error", expected: 0, actual: yError, tolerance: 1, outcome: "FAIL" }],
      exclusions: [{ scope: "intentional-negative", reason: "CSS 회귀가 검출된 실패 대표 화면; 화면 적합성 PASS 또는 Owner 수용이 아님" }],
    });
  } finally {
    await selector(page).evaluate((element, original) => {
      if (original === null) element.removeAttribute("style"); else element.setAttribute("style", original);
    }, originalControlStyle);
  }
  await expect.poll(async () => Math.abs((await selector(page).boundingBox())!.y - controlBefore.y)).toBeLessThanOrEqual(1);
  await captureSyntheticUiEvidence(page, info, {
    issue: 889, acceptanceCriteria: ["AC01", "AC03"], state: "journey-wbs-density-34-1440-ko", fixture: "schedule-views", locale: "ko",
    fixtureData: { tasks: baseline.data.tasks.map(({ name, type, start, end, duration, progress }) => ({ name, type, start, end, duration, progress })), resources: [f.alice.name, f.bob.name, f.charlie.name], equipment: [f.unit, f.fleet, f.idle].map(({ code, name }) => ({ code, name })) },
    elements: [{ name: "viewSelector", locator: selector(page) }, { name: "wbsSurface", locator: frame.locator(".project-gantt-scroll") }],
    flow: { id: "views-density-canonical-readonly", steps: ["5폭 Day/Week WBS→Resource→설비→WBS", "각 View Grid/Chart 본문 Ctrl+휠 28~34px", "헤더/일반 휠 제외", "WBS 인스턴스 복원", "HTTP 원본 snapshot 동일·쓰기0"], outcome: "PASS" },
    checks: [{ ac: "AC03", designRef: "DESIGN.md:1-5", measurement: "restored-row-height", expected: 34, actual: Number(await frame.getAttribute("data-gantt-cell-height")), tolerance: 0, outcome: "PASS" },
      { ac: "AC03", designRef: "DESIGN.md:1-5", measurement: "project-write-count", expected: 0, actual: writes.length, tolerance: 0, outcome: "PASS" }],
    exclusions: [{ scope: "owner-design-acceptance", reason: "자동 측정/흐름은 Owner의 화면 의도 및 사용성 수용을 대신하지 않음" }],
  });
  await info.attach("issue-889-shared-shell-density", { contentType: "application/json", body: JSON.stringify({ receipts, writes, api, instance }, null, 2) });
});

test("#898/#899 projected Grid single-click reveal and real pointer Ctrl+wheel across three Views", async ({ page, isolatedApplication, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedScheduleViews(page, isolatedApplication, observeIsolatedApi);
  await openWorkspaceView(page, "schedule");
  const baseline = await f.snapshot();
  const writes = observeProjectWrites(page, f.publicId);
  const frame = page.locator(".project-gantt-frame");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });

  // Reuse the #880 HTTP/SQLite multi-assignment fixture, native #852 start
  // semantics and #889 projected row geometry. A click is not an Editor open.
  for (const mode of ["resource", "equipment"] as const) {
    await selector(page).selectOption(mode);
    const surface = view(page, mode);
    const scroller = surface.locator("[data-schedule-view-scroll]");
    await expect(scroller).toHaveAttribute("data-ready", "true");
    await expect(taskRows(surface, f.task.taskId)).toHaveCount(mode === "resource" ? 3 : 2);
    const row = taskRows(surface, f.task.taskId).first();
    const bar = row.locator(".project-schedule-view-bar");
    const select = row.locator(".project-schedule-view-name > button:not(.project-schedule-view-info)");
    const openInfoButton = row.getByRole("button", { name: `작업 정보 열기: ${f.task.name}`, exact: true });
    const capacity = await bar.evaluate(element => {
      const root = element.closest<HTMLElement>("[data-schedule-view-scroll]")!;
      const x = Number.parseFloat((element as HTMLElement).style.left);
      return { target: x, max: root.scrollWidth - root.clientWidth };
    });
    expect(capacity.max, "fixture must have enough horizontal room to prove exact start alignment").toBeGreaterThanOrEqual(capacity.target - 1);
    await scroller.evaluate((element, target) => { element.scrollLeft = Math.min(element.scrollWidth - element.clientWidth, target + 100); }, capacity.target);
    await select.click();
    await expect(editor).toHaveCount(0);
    await expect(scroller).toHaveAttribute("data-last-reveal-status", "ALIGNED");
    await expect(scroller).toHaveAttribute("data-last-reveal-row-key", await row.getAttribute("data-view-row-key") ?? "");
    for (const selected of await taskRows(surface, f.task.taskId).all())
      await expect(selected).toHaveAttribute("aria-selected", "true");
    await expect.poll(async () => bar.evaluate(element => {
      const grid = element.closest("[data-view-row-key]")!.querySelector("[data-schedule-view-grid-cell]")!.getBoundingClientRect();
      return Math.abs(element.getBoundingClientRect().left - grid.right);
    })).toBeLessThanOrEqual(1);
    await expect.poll(async () => scroller.evaluate(element => element.scrollLeft)).toBeCloseTo(capacity.target, 0);
    const splitError = await bar.evaluate(element => {
      const grid = element.closest("[data-view-row-key]")!.querySelector("[data-schedule-view-grid-cell]")!.getBoundingClientRect();
      return Math.abs(element.getBoundingClientRect().left - grid.right);
    });
    await captureSyntheticUiEvidence(page, info, {
      issue: 899, acceptanceCriteria: ["AC01", "AC02", "AC03"], state: `${mode}-single-click-start-reveal-1440-ko`,
      fixture: "schedule-views", locale: "ko",
      elements: [{ name: "selectedTaskRow", locator: row }, { name: "taskBar", locator: bar },
        { name: "projectedScroller", locator: scroller }],
      flow: { id: `issue-899-${mode}-select-reveal`,
        steps: ["동일 원본의 다중 표시행 확보", "Grid 작업명 단일 클릭", "현재 projected Chart 시작점과 sticky Grid 분리선 좌표 측정", "Task Editor 자동 열림 없음"],
        outcome: "PASS" },
      checks: [{ ac: "AC01", designRef: "DESIGN.md:1-5", measurement: "task-start-grid-split-x-error",
        expected: 0, actual: splitError, tolerance: 1, outcome: "PASS" }],
      exclusions: [{ scope: "real-device-uat", reason: "이 증거는 격리 Chromium fixture의 좌표/선택 흐름으로 운영 장치 사용성 수용과 별개" }],
    });

    // Explicit mouse, keyboard and chart affordances still open the one
    // canonical Task Editor, with its existing session/readonly protection.
    await select.dblclick();
    await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
    await editor.press("Escape");
    await expect(select, "Grid double-click returns to its original select button").toBeFocused();
    await openInfoButton.focus(); await openInfoButton.press("Enter");
    await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
    await editor.press("Escape");
    await expect(openInfoButton, "explicit information command retains its focus on close").toBeFocused();
    await bar.click();
    await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
    await editor.press("Escape");
    await expect(bar, "Chart bar Editor returns to the clicked bar").toBeFocused();
    await expect(editor).toHaveCount(0);
  }

  const browserZoom = () => page.evaluate(() => ({
    dpr: window.devicePixelRatio, width: window.innerWidth,
    visualScale: window.visualViewport?.scale ?? 1,
  }));
  const physicalWheel = async (point: { x: number; y: number }, delta: number) => {
    const target = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? null, point);
    expect(target, "physical pointer must hit an actual DOM body element").not.toBeNull();
    await page.mouse.move(point.x, point.y);
    await page.keyboard.down("Control");
    try { await page.mouse.wheel(0, delta); }
    finally { await page.keyboard.up("Control"); }
  };
  for (const mode of ["wbs", "resource", "equipment"] as const) {
    await selector(page).selectOption(mode);
    const points = mode === "wbs" ? await frame.evaluate(element => {
      const native = element.querySelector<HTMLElement>(".wx-gantt")!.getBoundingClientRect();
      const row = element.querySelector<HTMLElement>(".wx-table .wx-row[data-id]")!.getBoundingClientRect();
      const chart = element.querySelector<HTMLElement>(".wx-chart")!.getBoundingClientRect();
      const y = Math.max(native.top + 16, Math.min(native.bottom - 18, row.top + row.height / 2));
      return { grid: { x: row.left + Math.min(80, row.width / 2), y },
        chart: { x: chart.left + Math.min(56, chart.width / 2), y } };
    }) : await view(page, mode).evaluate(element => {
      const root = element.querySelector<HTMLElement>("[data-schedule-view-scroll]")!.getBoundingClientRect();
      const grid = element.querySelector<HTMLElement>(".project-schedule-view-header .project-schedule-view-grid")!.getBoundingClientRect();
      const header = element.querySelector<HTMLElement>(".project-schedule-view-header")!.getBoundingClientRect();
      const y = Math.min(root.bottom - 20, header.bottom + 18);
      return { grid: { x: root.left + Math.min(grid.width / 2, 80), y },
        chart: { x: root.left + grid.width + 56, y } };
    });
    const zoom = await browserZoom();
    for (const [surface, height, delta] of [["grid", "32", 120], ["chart", "30", 120],
      ["grid", "28", 120], ["chart", "30", -120], ["grid", "32", -120], ["chart", "34", -120]] as const) {
      await physicalWheel(points[surface], delta);
      await expect(frame, `real Ctrl+wheel in ${mode}/${surface}`).toHaveAttribute("data-gantt-cell-height", height);
      expect(await browserZoom(), `browser page zoom must not change in ${mode}/${surface}`).toEqual(zoom);
      await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
    }
  }
  await expect(selector(page)).toHaveValue("equipment");
  await selector(page).selectOption("wbs");
  expect(writes).toEqual([]);
  expect((await f.snapshot()).data).toEqual(baseline.data);
});
