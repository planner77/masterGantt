import { expectDashboardMetricsReadable } from "./helpers/dashboard-metrics";
import { openWbsViewControls } from "./helpers/wbs-controls";
import { waitForWbsReport, type WbsReportCondition } from "./helpers/wbs-report";
import { readLegacyFixtureCounts } from "./fixtures/legacy-logistics-seed";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { seedWbsViewComposer, viewResourcePassword } from "./fixtures/wbs-view-composer";
import { targetMasterPassword } from "./fixtures/target-project";
import { observedReadOnlyGet } from "./fixtures/isolated-application-diagnostics";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import type { ProcessCatalogResponse } from "../../src/contracts/process-catalog";
import type { WbsViewReportDto, WbsViewSpec } from "../../src/contracts/wbs-dashboard-views";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: viewResourcePassword, viewport: { width: 1440, height: 1000 } });
async function timedSeed(page: Page, origin: string, observer: Parameters<typeof seedWbsViewComposer>[2]) {
  const started = Date.now(); const result = await seedWbsViewComposer(page, origin, observer);
  await test.info().attach("equipment-seed-timing", { contentType: "application/json", body: JSON.stringify({ phase: "real-http-seed-and-navigation", milliseconds: Date.now() - started }) });
  return result;
}
const root = (page: Page) => page.getByTestId("wbs-view-dashboard").filter({ visible: true });
const defaultSpec: WbsViewSpec = { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "equipment", levels: [], };
const nextReport = (page: Page, condition: Partial<WbsReportCondition> = {}) => waitForWbsReport(page, { spec: defaultSpec, filters: {}, ...condition });
async function openEquipment(page: Page) {
  await page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "대시보드", exact: true }).click();
  await page.getByRole("tablist", { name: "대시보드 보기", exact: true }).getByRole("tab", { name: "설비", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ready", "true");
}
async function composer(page: Page) {
  await openWbsViewControls(root(page));
  const panel = root(page).locator("details").filter({ has: page.locator("summary").filter({ hasText: /^조회 구성$/ }) });
  if (!await panel.evaluate(node => (node as HTMLDetailsElement).open)) await panel.locator(":scope > summary").click();
  return panel;
}
async function apply(page: Page, levels: NonNullable<WbsViewSpec["levels"]>, filters: WbsReportCondition["filters"] = {}) {
  const received = nextReport(page, { spec: { ...defaultSpec, levels }, filters });
  await (await composer(page)).getByRole("button", { name: "적용", exact: true }).click();
  const response = await received;
  expect(response.status(), await response.text()).toBe(200);
  expect(response.request().postDataJSON().spec.levels).toEqual(levels);
  await expect(root(page)).toHaveAttribute("data-ready", "true");
  return (await response.json()).data as WbsViewReportDto;
}
async function expand(row: Locator) {
  const toggle = row.getByRole("button", { name: /하위 펼치기$/ });
  await toggle.focus(); await toggle.press("Enter");
}
async function seed(page: Page, origin: string, observer: Parameters<typeof seedWbsViewComposer>[2]) {
  const f = await timedSeed(page, origin, observer);
  await f.mutate(`/tasks/${f.task.taskId}`, { duration: 5 }, "patch");
  const response = await page.request.post(`${origin}/api/process-catalog/admin/work-areas`, { headers: { Origin: origin, "If-Match": `"${f.catalog.data.processCatalogRevision}"` }, data: { occurrenceId: f.workArea.occurrenceId, code: "WA-A2", name: "두 번째 설비 구역" } });
  expect(response.status()).toBe(201);
  const catalog = (await response.json() as ProcessCatalogResponse).data;
  const area2 = catalog.workAreas.find(area => area.code === "WA-A2")!;
  await f.mutate(`/tasks/${f.task.taskId}/logistics-links`, { equipmentLinks: [], systemLinks: [{ systemId: f.system.id, scope: "self" }] }, "put");
  const equipmentName = "설비LongEquipmentNameWithoutWhitespace".repeat(5);
  await f.mutate(`/logistics/equipment/${f.equipment.id}`, { processCatalogRevision: catalog.processCatalogRevision, quantity: 10, name: equipmentName, workAreaLinks: [f.workArea, area2].map(area => ({ processId: f.processIds[0], workAreaId: area.id })) }, "patch");
  const idle = (await f.snapshot()).data.logistics!.equipment.find(equipment => equipment.code === "IDLE")!;
  await f.mutate(`/logistics/equipment/${idle.id}`, { quantity: 5, active: false }, "patch");
  await f.mutate(`/tasks/${f.task.taskId}/process-context`, { processCatalogRevision: catalog.processCatalogRevision, processLinks: f.processIds.map(processId => ({ processId, scope: "self" })), workAreaLinks: [f.workArea, area2].map(area => ({ processId: f.processIds[0], workAreaId: area.id, scope: "self" })) }, "put");
  await f.mutate(`/tasks/${f.task.taskId}/logistics-links`, { equipmentLinks: [{ equipmentId: f.equipment.id, scope: "self" }], systemLinks: [{ systemId: f.system.id, scope: "self" }] }, "put");
  // This seed renames the shared fixture's equipment; consumers need its current canonical DTO.
  const equipment = (await f.snapshot()).data.logistics?.equipment.find(row => row.id === f.equipment.id);
  if (!equipment) throw new Error("테스트 설비가 canonical snapshot에 없습니다.");
  expect(equipment.name).toBe(equipmentName);
  await page.reload();
  return { ...f, equipment, idle, area2 };
}
function observeWrites(page: Page, publicId: string) {
  const writes: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith(`/api/projects/${publicId}/`) && !["GET", "HEAD"].includes(request.method()) && !isWbsViewReadQuery(request)) writes.push(request.method()); });
  return writes;
}

test("#734 Target0 AMR10+5·비활성·Task0·미배정·구역별10/고유15·M/D5·전체 Gate", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(120_000);
  const f = await seed(page, origin, observeIsolatedApi);
  const baseline = await f.snapshot();
  const targets = await observedReadOnlyGet(observeIsolatedApi, `/api/projects/${f.publicId}/logistics/targets`, () => page.request.get(`${f.api}/logistics/targets`));
  expect(targets.status()).toBe(410); expect((await targets.json()).error.code).toBe("LOGISTICS_API_RETIRED");
  expect(readLegacyFixtureCounts(origin,f.publicId)).toEqual({targets:0,members:0,bindings:0,selectedMembers:0});
  const writes = observeWrites(page, f.publicId);
  const received = nextReport(page); await openEquipment(page);
  const report = (await (await received).json()).data as WbsViewReportDto;
  expect(report.spec).toMatchObject({ root: "equipment", levels: [] });
  expect(report.totals.configurationReference.equipmentQuantity).toBe(15);
  expect(report.totals.assignments.effort.knownMd).toBe(5);
  const selected = report.children.find(row => row.selector.id === f.equipment.id)!;
  const idle = report.children.find(row => row.selector.id === f.idle.id)!;
  expect(selected.taskIds).toEqual([f.task.taskId]); expect(idle.taskIds).toEqual([]);
  expect(selected.assignmentIds).toEqual([f.assignment.id]); expect(idle.assignmentIds).toEqual([]);
  expect(idle.totals.configurationReference.equipmentQuantity).toBe(5);
  expect(report.diagnostics.inactiveInstanceIds).toContainEqual({ kind: "equipment", id: f.idle.id });
  const overview = root(page).getByTestId("equipment-summary");
  await expect(overview).toBeVisible(); await expect(overview).toContainText("15");
  const config = await composer(page);
  await config.getByRole("button", { name: "하위 축 추가", exact: true }).click();
  await config.getByRole("combobox", { name: "하위 축 1", exact: true }).selectOption("workArea");
  const areas = await apply(page, ["workArea"]);
  const equipment = areas.children.find(row => row.selector.id === f.equipment.id)!;
  for (const area of [f.workArea, f.area2]) {
    const branch = equipment.children.find(row => row.selector.id === area.id)!;
    expect(branch.totals.configurationReference.equipmentQuantity).toBe(10);
    expect(branch.taskIds).toEqual([f.task.taskId]); expect(branch.totals.assignments.effort.knownMd).toBe(5);
  }
  expect(areas.totals.configurationReference.equipmentQuantity).toBe(15);
  expect(areas.totals.assignments.effort.knownMd).toBe(5);
  await expand(root(page).locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`));
  for (const area of [f.workArea, f.area2]) await expect(root(page).locator(`tr[data-dimension="workArea"][data-entity-id="${area.id}"]`)).toBeVisible();
  const gates = root(page).locator("details").filter({ has: page.locator("summary").filter({ hasText: /^연관 Milestone 전체 Gate/ }) });
  await gates.locator(":scope > summary").click(); await expect(gates).toContainText("인수 Milestone");
  expect(areas.fullMilestones).toHaveLength(report.fullMilestones.length);
  expect(writes).toEqual([]); expect((await f.snapshot()).data).toEqual(baseline.data);
});

test("#734 실제 축 추가·순서변경·삭제·단독·Milestone 경로와 재진입 복원", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(120_000);
  const f = await timedSeed(page, origin, observeIsolatedApi);
  const writes = observeWrites(page, f.publicId);
  const frame = page.locator(".project-gantt-frame"), identity = await frame.getAttribute("data-project-gantt-instance"), gantt = await frame.locator(".wx-gantt").elementHandle();
  await openEquipment(page);
  const config = await composer(page);
  for (const [index, dimension] of ["system", "process", "resource"].entries()) {
    await config.getByRole("button", { name: "하위 축 추가", exact: true }).click();
    await config.getByRole("combobox", { name: `하위 축 ${index + 1}`, exact: true }).selectOption(dimension);
  }
  await config.getByRole("button", { name: "2번째 축 위로", exact: true }).click();
  await expect(config.getByRole("combobox", { name: "하위 축 1", exact: true })).toBeFocused();
  const nested = await apply(page, ["process", "system", "resource"]);
  const e = nested.children.find(row => row.selector.id === f.equipment.id)!;
  expect(e.children.find(row => row.selector.id === f.processIds[0])!.children.find(row => row.selector.id === f.system.id)!.taskIds).toEqual([f.task.taskId]);
  await config.getByRole("button", { name: "3번째 축 삭제", exact: true }).click();
  await config.getByRole("button", { name: "2번째 축 삭제", exact: true }).click();
  await config.getByRole("combobox", { name: "하위 축 1", exact: true }).selectOption("milestone");
  await config.getByRole("button", { name: "하위 축 추가", exact: true }).click();
  await config.getByRole("combobox", { name: "하위 축 2", exact: true }).selectOption("process");
  const milestone = await apply(page, ["milestone", "process"]);
  expect(milestone.children.find(row => row.selector.id === f.equipment.id)!.children.find(row => row.selector.id === f.milestone.taskId)!.taskIds).toEqual([f.task.taskId]);
  await page.getByRole("tablist", { name: "대시보드 보기", exact: true }).getByRole("tab", { name: "리소스", exact: true }).click(); await openEquipment(page);
  await expect(root(page)).toContainText("현재 경로: 설비 → Milestone → 공정");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", identity!); expect(await gantt!.evaluate(element => element.isConnected)).toBe(true);
  await expect(page.getByRole("button", { name: "◆ Milestone 표시", exact: true })).toHaveCount(0);
  await page.reload(); await openEquipment(page); await expect(root(page)).toContainText("현재 경로: 설비 → Milestone → 공정");
  await (await composer(page)).getByRole("button", { name: "하위 없음", exact: true }).click(); await apply(page, []);
  await expect(root(page)).toContainText("현재 경로: 설비"); expect(writes).toEqual([]);
});

test("#734 정확 Task·Assignment 원본 취소와 일정 복귀는 경로·focus를 보존한다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(120_000);
  const f = await timedSeed(page, origin, observeIsolatedApi); const writes = observeWrites(page, f.publicId);
  await openEquipment(page);
  const row = root(page).locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`);
  const trigger = row.getByRole("button", { name: "상세", exact: true }); await trigger.focus(); await trigger.press("Space");
  const detail = root(page).getByRole("region", { name: "계층 원본 상세", exact: true }); await expect(detail).toHaveAttribute("data-detail-state", "ready");
  const original = detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true }); await original.click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true }); await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
  await editor.press("Escape"); await expect(editor).toHaveCount(0); await expect(original).toBeFocused();
  await detail.getByRole("button", { name: "Assignment 보기", exact: true }).click();
  const assignment = detail.getByRole("button", { name: `${f.resource.name} Assignment 원본`, exact: true }); await assignment.click();
  await expect(editor.getByRole("status").filter({ hasText: "선택한 개인의 배정만 편집합니다." })).toContainText(`Assignment ID ${f.assignment.id} · Resource ID ${f.resource.id}`);
  await editor.getByRole("spinbutton", { name: new RegExp(`${f.resource.name}.*투입률`) }).fill("50");
  const beforeAssignment = await f.snapshot();
  const assignmentWrite = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/tasks/${f.task.taskId}/assignments`);
  await editor.getByRole("button", { name: "할당 저장 (1)", exact: true }).click();
  expect((await assignmentWrite).status(), "실제 Assignment PUT").toBe(200);
  // PUT response can precede canonical reload and reloading the resource selector.
  // Require the committed revision and newly loaded editor session before unlocking.
  const afterAssignment = await f.snapshot();
  expect(afterAssignment.data.project.revision).toBe(beforeAssignment.data.project.revision + 1);
  const savedAssignment = afterAssignment.data.assignments!.find(row => row.id === f.assignment.id)!;
  expect(savedAssignment.allocation?.percent).toBe(50);
  await expect(editor.getByText(`Revision ${afterAssignment.data.project.revision}`, { exact: true })).toBeVisible();
  await expect(editor.getByRole("spinbutton", { name: new RegExp(`${f.resource.name}.*투입률`) })).toHaveValue("50");
  await expect(editor.getByRole("button", { name: "할당 저장 (1)", exact: true })).toBeEnabled();
  await editor.press("Escape"); await expect(editor).toHaveCount(0); await expect(assignment).toBeFocused();
  const schedule = detail.getByRole("button", { name: "이 범위 일정 보기", exact: true }); await schedule.click();
  await expect(page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("region", { name: "임시 조회 범위", exact: true }).getByRole("button", { name: /원래 보기/ }).click();
  await expect(root(page)).toHaveAttribute("data-ready", "true"); await expect(schedule).toBeFocused();
  await detail.press("Escape"); await expect(trigger).toBeFocused(); expect(writes).toEqual(["PUT"]);
});

test("#734 5폭 긴 이름·내부 overflow·열 정렬·native Tab/Escape", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
    test.setTimeout(120_000);
    const f = await timedSeed(page, origin, observeIsolatedApi);
    const longName = "LongEquipmentNameWithoutWhitespace".repeat(5).padEnd(200, "X");
    expect(longName).toHaveLength(200); // API maximum while preserving unbroken-name overflow coverage.
    await f.mutate(`/logistics/equipment/${f.equipment.id}`, { name: longName }, "patch"); await page.reload();
    const writes = observeWrites(page, f.publicId);
    const frame = page.locator(".project-gantt-frame"), instance = await frame.getAttribute("data-project-gantt-instance"), gantt = await frame.locator(".wx-gantt").elementHandle();
    await openEquipment(page);
    await expect(root(page).getByTestId("equipment-summary")).toBeVisible();
    for (const label of [/^설비 원본 정보$/, /^연결·설정 진단$/, /^연관 Milestone 전체 Gate/]) {
      const disclosure = root(page).locator("details").filter({ has: page.locator("summary").filter({ hasText: label }) });
      await disclosure.locator(":scope > summary").click();
    }
    for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectDashboardMetricsReadable(root(page).getByTestId("equipment-summary"), width);
    const table = root(page).getByRole("table", { name: "공통 계층 결과", exact: true });
    const row = table.locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`);
    const detail = row.getByRole("button", { name: "상세", exact: true }); await expect(detail).toBeEnabled(); await detail.focus(); await expect(detail).toBeFocused(); await detail.press("Tab");
    await expect(row.getByRole("button", { name: "원본", exact: true })).toBeFocused();
    await row.getByRole("button", { name: "원본", exact: true }).press("Shift+Tab"); await expect(detail).toBeFocused();
    const focusBounds = await detail.evaluate(element => { const button=element.getBoundingClientRect(), owner=element.closest("[data-wbs-scroll]")!.getBoundingClientRect(); return { left:button.left,right:button.right,ownerLeft:owner.left,ownerRight:owner.right }; });
    expect(focusBounds.left).toBeGreaterThanOrEqual(focusBounds.ownerLeft); expect(focusBounds.right).toBeLessThanOrEqual(focusBounds.ownerRight);
    await detail.focus(); await detail.press("Enter");
    const region = root(page).getByRole("region", { name: "계층 원본 상세", exact: true }); await expect(region).toHaveAttribute("data-detail-state", "ready"); await region.press("Escape"); await expect(detail).toBeFocused();
    const geometry = await table.evaluate(element => {
      const cells = (selector: string) => Array.from(element.querySelectorAll(selector)).map(cell => { const box = cell.getBoundingClientRect(); return { left: box.left, width: box.width }; });
      const owner = element.parentElement!;
      return { document: document.documentElement.scrollWidth, header: cells("thead th"), body: cells("tbody tr:first-child > *"), owner: { client: owner.clientWidth, scroll: owner.scrollWidth, overflow: getComputedStyle(owner).overflowX } };
    });
    expect(geometry.document).toBeLessThanOrEqual(width + 1); expect(geometry.header).toHaveLength(6); expect(geometry.body).toHaveLength(6);
    geometry.body.forEach((cell, index) => { expect(Math.abs(cell.left - geometry.header[index].left)).toBeLessThanOrEqual(1); expect(Math.abs(cell.width - geometry.header[index].width)).toBeLessThanOrEqual(1); });
    expect(geometry.owner.overflow).toMatch(/auto|scroll/); if (width <= 768) expect(geometry.owner.scroll).toBeGreaterThan(geometry.owner.client);
    await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!); expect(await gantt!.evaluate(element => element.isConnected)).toBe(true);
    await expect(page.getByRole("button", { name: "◆ Milestone 표시", exact: true })).toHaveCount(0); expect(writes).toEqual([]);
    await info.attach(`equipment-${width}`, { contentType: "application/json", body: JSON.stringify(geometry) });
    const directory = resolve("output/playwright/issue-734"); await mkdir(directory, { recursive: true });
    await info.attach(`equipment-${width}.png`, { contentType: "image/png", body: await page.screenshot({ path: resolve(directory, `equipment-${width}.png`) }) });
    }
});

test("#734 설비 원본 dirty 유지·정확 PATCH 저장·새 snapshot과 focus 복귀", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(120_000);
  const f = await seed(page, origin, observeIsolatedApi);
  const first = nextReport(page); await openEquipment(page); const before = (await (await first).json()).data as WbsViewReportDto;
  const row = root(page).locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`), trigger = row.getByRole("button", { name: "원본", exact: true });
  await trigger.click(); const editor = page.getByRole("dialog", { name: "설비 수정", exact: true });
  await expect(editor.getByLabel("설비명", { exact: false })).toHaveValue(f.equipment.name);
  await expect(editor.getByRole("checkbox", { name: /A 작업구역/ })).toBeChecked();
  await expect(editor.getByRole("checkbox", { name: /두 번째 설비 구역/ })).toBeChecked();
  const name = "설비 원본 저장 검증"; await editor.getByLabel("설비명", { exact: false }).fill(name);
  await editor.getByRole("button", { name: "취소", exact: true }).click(); await expect(editor).toContainText("저장하지 않은 설비 변경을 폐기할까요?");
  await editor.getByRole("button", { name: "계속 편집", exact: true }).click(); await expect(editor.getByLabel("설비명", { exact: false })).toHaveValue(name);
  const writes = observeWrites(page, f.publicId);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  // The existing shared-instance edit policy requires explicit impact confirmation before PATCH.
  const confirmation = page.getByRole("dialog", { name: "공유 인스턴스 변경 확인", exact: true });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(f.equipment.name);
  await expect(confirmation).toContainText("관련 작업 1개 · 직접 연결 작업 1개 · 기존 연결 작업 0개");
  await expect(confirmation).not.toContainText("공유 Target");
  const equipmentIdentity = confirmation.getByText("변경 대상 식별 정보", { exact: true });
  await equipmentIdentity.click();
  await expect(confirmation.getByRole("textbox", { name: "설비 원본 ID", exact: true })).toHaveValue(f.equipment.id);
  await equipmentIdentity.click();
  await expect(confirmation.getByRole("button", { name: "공유 사용처 확인 후 원본 저장", exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
  await confirmation.getByRole("button", { name: "원본 변경 취소", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(editor.getByLabel("설비명", { exact: false })).toHaveValue(name);
  expect(writes).toEqual([]);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "공유 사용처 확인 후 원본 저장", exact: true })).toBeEnabled();
  const confirmationBefore = Number(await root(page).getAttribute("data-report-confirmation-id"));
  const [saved, refreshed] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/logistics/equipment/${f.equipment.id}`, { timeout: 30_000 }),
    nextReport(page, { spec: before.spec, filters: before.filters, scope: before.sourceContext.scope }),
    confirmation.getByRole("button", { name: "공유 사용처 확인 후 원본 저장", exact: true }).click(),
  ]);
  // Browser Response bodies can be discarded by the canonical post-save navigation.
  // Keep the actual UI response/status and assert its committed render separately.
  expect(saved.status(), "실제 설비 PATCH").toBe(200);
  expect(refreshed.status(), "실제 WBS 조회 응답").toBe(200);
  await expect(root(page)).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => Number(await root(page).getAttribute("data-report-confirmation-id"))).toBeGreaterThan(confirmationBefore);
  // A request-context response retains its body across navigation; reuse the UI's exact query.
  const verified = await page.request.post(`${origin}/api/projects/${f.publicId}/resource-dashboard/views`, {
    headers: { Origin: origin },
    data: refreshed.request().postDataJSON(),
  });
  expect(verified.status(), await verified.text()).toBe(200);
  const after = (await verified.json()).data as WbsViewReportDto;
  expect(before.spec.root).toBe("equipment"); expect(after.spec.root).toBe("equipment"); expect(after.projectRevision).toBe(before.projectRevision + 1); expect(after.snapshotId).not.toBe(before.snapshotId); expect(after.spec).toEqual(before.spec);
  await expect(root(page)).toHaveAttribute("data-wbs-view", "equipment");
  await expect(root(page)).toHaveAttribute("data-ready", "true");
  await expect(editor).toHaveCount(0); await expect(row).toContainText(name); await expect(trigger).toBeFocused();
  const savedEquipment = (await f.snapshot()).data.logistics!.equipment.find(equipment => equipment.id === f.equipment.id)!;
  expect(savedEquipment.name).toBe(name); expect(savedEquipment.workAreaLinks).toHaveLength(2); expect(savedEquipment.workAreaLinks).toEqual(expect.arrayContaining([f.workArea, f.area2].map(area => ({ processId: f.processIds[0], workAreaId: area.id }))));
  await trigger.click(); await expect(editor.getByRole("checkbox", { name: /A 작업구역/ })).toBeChecked(); await expect(editor.getByRole("checkbox", { name: /두 번째 설비 구역/ })).toBeChecked(); await editor.getByRole("button", { name: "취소", exact: true }).click(); await expect(trigger).toBeFocused(); expect(writes).toEqual(["PATCH"]);
});

test("#734 readonly 조회0 mutation·원본401 및 오래된 revision412 fail-closed", async ({ page, browser, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(120_000);
  const f = await timedSeed(page, origin, observeIsolatedApi); const before = await f.snapshot();
  const context = await browser.newContext(); const readonly = await context.newPage();
  try {
    const writes = observeWrites(readonly, f.publicId);
    await readonly.goto(`${origin}/projects/${f.publicId}`); await openEquipment(readonly);
    await expect(root(readonly).getByTestId("equipment-summary")).toBeVisible(); await expect(root(readonly).getByRole("button", { name: "원본", exact: true })).toHaveCount(0); expect(writes).toEqual([]);
    const denied = await readonly.request.patch(`${f.api}/logistics/equipment/${f.equipment.id}`, { headers: { Origin: origin, "If-Match": `"${before.data.project.revision}"` }, data: { name: "권한없는 변경" } }); expect(denied.status()).toBe(401);
  } finally { await context.close(); }
  const stale = await page.request.patch(`${f.api}/logistics/equipment/${f.equipment.id}`, { headers: { Origin: origin, "If-Match": `"${before.data.project.revision - 1}"` }, data: { name: "낡은 변경" } }); expect(stale.status()).toBe(412);
  expect((await f.snapshot()).data).toEqual(before.data);
});

test("#734 stale와 pending 보고서에서 원본 명령 차단·새 Task 저장 후 선택 복귀", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(120_000);
  const f = await timedSeed(page, origin, observeIsolatedApi);
  const first = nextReport(page); await openEquipment(page); const before = (await (await first).json()).data as WbsViewReportDto;
  const row = root(page).locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`); await row.getByRole("button", { name: "상세", exact: true }).click();
  const detail = root(page).getByRole("region", { name: "계층 원본 상세", exact: true }); await detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true }), name = "설비 경로 작업 저장"; await editor.getByLabel("작업명", { exact: true }).fill(name);
  const pattern = `**/api/projects/${f.publicId}/resource-dashboard/views`; let release!: () => void, held = false; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(pattern, async route => { if (route.request().postDataJSON().projection?.kind !== "report") return route.continue(); const response = await route.fetch(); held = true; await gate; await route.fulfill({ response }); });
  const write = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/tasks/${f.task.taskId}`), refreshed = nextReport(page);
  try {
    await editor.getByRole("button", { name: "저장", exact: true }).click(); expect((await write).status()).toBe(200); await expect.poll(() => held).toBe(true); await expect(root(page)).toHaveAttribute("data-ready", "false"); await expect(row.getByRole("button", { name: "원본", exact: true })).toBeDisabled();
  } finally { release(); }
  const after = (await (await refreshed).json()).data as WbsViewReportDto; await page.unroute(pattern);
  expect(after.snapshotId).not.toBe(before.snapshotId); expect(after.spec).toEqual(before.spec); await expect(root(page)).toHaveAttribute("data-ready", "true"); await expect(detail.getByRole("button", { name: `${name} Task 원본`, exact: true })).toBeFocused();
  await detail.press("Escape");
  await page.route(pattern, route => route.request().postDataJSON().projection?.kind === "scope" ? route.fulfill({ status: 409, json: { error: { code: "REPORT_STALE", message: "의도한 stale 음성 검증" } } }) : route.continue());
  await row.getByRole("button", { name: "원본", exact: true }).click(); await expect(root(page)).toHaveAttribute("data-wbs-state", "stale"); await expect(row.getByRole("button", { name: "원본", exact: true })).toBeDisabled(); await expect(page.getByRole("dialog")).toHaveCount(0); await page.unroute(pattern);
});

test("#734 유형 OR 필터와 controls·Task association 출처는 서로 추론하지 않는다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(120_000);
  const f = await timedSeed(page, origin, observeIsolatedApi);
  await f.mutate("/logistics/equipment", { processId: f.processIds[1], code: "AGV", name: "다른 유형 작업없는 설비", equipmentType: "agv", managementUnit: "fleet", quantity: 3 });
  await f.mutate("/logistics/systems", { code: "CTRL", name: "업무무관 제어 전용 시스템", systemType: "acs", layer: "controller", scope: "processes", processIds: [f.processIds[0]] });
  const logistics = (await f.snapshot()).data.logistics!;
  const control = logistics.systems.find(system => system.code === "CTRL")!;
  await f.mutate(`/logistics/equipment/${f.equipment.id}/systems`, { systems: [{ systemId: control.id, controlRole: "primary" }] }, "put");
  const first = nextReport(page); await page.reload(); await openEquipment(page); const all = (await (await first).json()).data as WbsViewReportDto;
  await openWbsViewControls(root(page));
  const types = root(page).getByRole("group", { name: "설비 유형", exact: true });
  const filtered = nextReport(page, { filters: { equipmentTypeCodes: ["agv"] } }); await types.getByRole("checkbox", { name: "AGV (무인운반차)", exact: true }).check();
  const agv = (await (await filtered).json()).data as WbsViewReportDto; await expect(root(page)).toHaveAttribute("data-ready", "true");
  expect(agv.filters.equipmentTypeCodes).toEqual(["agv"]); expect(agv.totals.configurationReference.equipmentQuantity).toBe(3); expect(agv.taskIds).toEqual([]);
  await page.reload(); await openEquipment(page);
  await expect(root(page).locator('[aria-label="적용된 고급 조건"]')).toContainText("AGV (무인운반차)");
  await openWbsViewControls(root(page));
  await expect(types.getByRole("checkbox", { name: "AGV (무인운반차)", exact: true })).toBeChecked(); await expect(types.getByRole("checkbox", { name: "AMR (자율이동로봇)", exact: true })).not.toBeChecked();
  const union = nextReport(page, { filters: { equipmentTypeCodes: ["agv", "amr"] } }); await types.getByRole("checkbox", { name: "AMR (자율이동로봇)", exact: true }).check();
  const both = (await (await union).json()).data as WbsViewReportDto; await expect(root(page)).toHaveAttribute("data-ready", "true"); expect(both.totals.configurationReference.equipmentQuantity).toBe(all.totals.configurationReference.equipmentQuantity); expect(both.taskIds).toEqual([f.task.taskId]); expect(all.taskIds).toContain(f.task.taskId);
  const reset = nextReport(page, { filters: { equipmentTypeCodes: [] } }); await types.getByRole("button", { name: "전체 유형", exact: true }).click(); await reset; await expect(root(page)).toHaveAttribute("data-ready", "true");
  const config = await composer(page); await config.getByRole("button", { name: "하위 축 추가", exact: true }).click(); await config.getByRole("combobox", { name: "하위 축 1", exact: true }).selectOption("system");
  const report = await apply(page, ["system"], { equipmentTypeCodes: [] }), equipment = report.children.find(row => row.selector.id === f.equipment.id)!;
  expect(equipment.children.find(row => row.selector.id === control.id)?.taskIds ?? []).toEqual([]);
  expect(equipment.children.find(row => row.selector.id === f.system.id)!.taskIds).toEqual([f.task.taskId]);
  const metadata = report.configurationCatalog.equipment.find(row => row.id === f.equipment.id)!; expect(metadata.controlSystems).toContainEqual(expect.objectContaining({ systemId: control.id, controlRole: "primary" }));
  await root(page).getByText("설비 원본 정보", { exact: true }).click(); const disclosure = root(page).locator("details").filter({ has: page.locator("summary").filter({ hasText: /^설비 원본 정보$/ }) });
  await disclosure.locator("details").filter({ has: page.locator("summary").filter({ hasText: f.equipment.name }) }).locator(":scope > summary").click(); await expect(disclosure).toContainText(control.name);
});
