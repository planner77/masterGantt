import { openResourceDynamicView } from "./helpers/resource-workspace";
import { openWbsViewControls } from "./helpers/wbs-controls";
import { waitForWbsReport } from "./helpers/wbs-report";
import { readLegacyFixtureCounts } from "./fixtures/legacy-logistics-seed";
import type { Locator, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { seedWbsViewComposer, viewResourcePassword } from "./fixtures/wbs-view-composer";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import type { WbsViewSpec } from "../../src/contracts/wbs-dashboard-views";
import type { LogisticsDashboardResponse } from "../../src/contracts/logistics-dashboard";
import { issue623WorkbookEntries, issue623Table } from "../fixtures/issue-623-backend-fixture";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: viewResourcePassword });
const roots = ["process", "equipment", "system", "resource", "milestone"] as const;
const labels = { process: "공정&WorkArea", equipment: "설비", system: "물류 시스템", resource: "리소스", milestone: "Milestone" };
const dashboard = (page: Page) => page.getByTestId("wbs-view-dashboard").filter({ visible: true });
async function openRoot(page: Page, root: typeof roots[number]) {
  if (root === "resource") {
    await openResourceDynamicView(page);
  } else {
    await page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "대시보드", exact: true }).click();
    await page.getByRole("tablist", { name: "대시보드 보기", exact: true }).getByRole("tab", { name: labels[root], exact: true }).click();
  }
  await expect(dashboard(page)).toHaveAttribute("data-root", root);
  await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
}
function report(page: Page, root: typeof roots[number], levels: WbsViewSpec["levels"] = []) {
  return waitForWbsReport(page, { spec: { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root, levels, ...(root === "system" ? { systemView: "direct" as const } : {}) }, filters: {} }).then(async response => (await response.json()).data);
}

async function composer(page: Page) {
  await openWbsViewControls(dashboard(page));
  const disclosure = dashboard(page).locator("details").filter({ has: page.locator("summary").filter({ hasText: /^조회 구성$/ }) });
  if (!await disclosure.evaluate(element => (element as HTMLDetailsElement).open)) await disclosure.locator("summary").click();
  return disclosure;
}
async function apply(page: Page, config: Locator, levels: NonNullable<WbsViewSpec["levels"]>) {
  const received = report(page, "process", levels);
  await config.getByRole("button", { name: "적용", exact: true }).click();
  const result = await received;
  await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
  return result;
}

test("#737 Target0 동일 원본으로 기준정보·일정·6관점 왕복, 사용자 축 구성과 편집 1회", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(120_000);
  const f = await seedWbsViewComposer(page, origin, observeIsolatedApi);
  const before = await f.snapshot();
  const resourceIds = (await (await page.request.get(`${origin}/api/resources`)).json()).data.resources.map((resource: { id: string }) => resource.id).sort();
  const taskIds = before.data.tasks.filter(task => task.type === "task").map(task => task.taskId).sort();
  const assignmentIds = before.data.assignments!.filter(assignment => assignment.target.kind === "resource" && taskIds.includes(assignment.taskId)).map(assignment => assignment.id).sort();
  const ordinary = before.data.tasks.filter(task => task.type === "task");
  const duration = ordinary.reduce((sum, task) => sum + (task.duration ?? 0), 0);
  const progress = ordinary.reduce((sum, task) => sum + (task.duration ?? 0) * (task.progress ?? 0), 0) / duration;
  const frame = page.locator(".project-gantt-frame");
  await expect(frame.locator(".wx-gantt")).toBeVisible();
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const native = await frame.locator(".wx-gantt").elementHandle();
  const writes: Array<{ method: string; path: string }> = [];
  page.on("request", request => {
    // Excel POST produces a read-only file; verify that separate receipt below.
    if (request.url().includes(`/api/projects/${f.publicId}/`) && !["GET", "HEAD"].includes(request.method()) && !isWbsViewReadQuery(request) && new URL(request.url()).pathname !== `/api/projects/${f.publicId}/exports/excel`) writes.push({ method: request.method(), path: new URL(request.url()).pathname });
  });
  const assertTarget0 = async () => {
    const targets = await page.request.get(`${f.api}/logistics/targets`);
    expect(targets.status()).toBe(410);
    expect((await targets.json()).error.code).toBe("LOGISTICS_API_RETIRED");
    expect(readLegacyFixtureCounts(origin,f.publicId)).toEqual({targets:0,members:0,bindings:0,selectedMembers:0});
  };
  await assertTarget0();
  for (const view of ["processes", "equipment", "systems", "resource-master"] as const) {
    await openWorkspaceView(page, view);
    await expect(page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "기준정보", exact: true })).toHaveAttribute("aria-selected", "true");
    await openWorkspaceView(page, "schedule");
  }
  await openWorkspaceView(page, "kpi");
  await expect(page.getByTestId("logistics-dashboard-view")).toBeVisible();
  // KPI mounts eagerly and retains its response across tab visits. Request a new
  // receipt through its real refresh control instead of waiting for a past fetch.
  const kpiRefresh = page.getByTestId("logistics-dashboard-view").getByRole("button", { name: "새로고침", exact: true });
  await expect(kpiRefresh).toBeEnabled();
  const kpiResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/projects/${f.publicId}/logistics/kpi` && new URL(response.url()).searchParams.get("source") === "integrated");
  await kpiRefresh.click();
  const kpiHttp = await kpiResponse;
  expect(kpiHttp.status()).toBe(200);
  const kpi = (await kpiHttp.json() as LogisticsDashboardResponse).data;
  expect([...kpi.includedTaskIds].sort()).toEqual(taskIds);
  expect([...kpi.integrated!.assignmentIds].sort()).toEqual(assignmentIds);
  expect(kpi.kpi).toMatchObject({ taskCount: taskIds.length, totalDuration: duration, progressPercent: progress });
  await expect(page.getByTestId("logistics-dashboard-view")).toContainText(`대상 작업 ${taskIds.length}개`);
  const receipts = [];
  for (const root of roots) {
    const received = report(page, root, []);
    await openRoot(page, root);
    const current = await received;
    // The System consumer's direct default excludes unlinked Tasks. Compare its
    // raw link population and matching KPI breakdown, rather than Project totals.
    const scopedTaskIds = root === "system" ? before.data.logistics!.taskSystemLinks!.filter(link => link.systemId === f.system.id).map(link => link.taskId).sort() : taskIds;
    if (root === "system") {
      expect(current.spec).toMatchObject({ root: "system", systemView: "direct", levels: [] });
      expect(current.metadata.systemSelection).toEqual({ systemView: "direct", systemIds: [f.system.id] });
      expect(current.filters.taskIds ?? []).toEqual([]);
      expect(current.filters.taskSearch ?? "").toBe("");
      expect(before.data.logistics!.taskSystemLinks).toEqual([{ taskId: f.task.taskId, systemId: f.system.id, scope: "self" }]);
    }
    const scopedTasks = ordinary.filter(task => scopedTaskIds.includes(task.taskId));
    const scopedDuration = scopedTasks.reduce((sum, task) => sum + (task.duration ?? 0), 0);
    const scopedProgress = scopedTasks.reduce((sum, task) => sum + (task.duration ?? 0) * (task.progress ?? 0), 0) / scopedDuration;
    const scopedKpi = root === "system" ? kpi.breakdowns.systems.find(system => system.id === f.system.id)! : { taskIds: kpi.includedTaskIds, ...kpi.kpi, plannedMd: kpi.effort.plannedMd };
    expect([...scopedKpi.taskIds].sort()).toEqual(scopedTaskIds);
    expect([...current.taskIds].sort()).toEqual(scopedTaskIds);
    expect([...current.assignmentIds].sort()).toEqual(assignmentIds);
    expect(current.totals.tasks.taskCount).toBe(scopedTaskIds.length);
    expect(current.totals.tasks.taskCount).toBe(scopedKpi.taskCount);
    expect(current.totals.tasks.progress).toMatchObject({ denominator: scopedDuration, percent: scopedProgress });
    expect(current.totals.tasks.progress.percent).toBe(scopedKpi.progressPercent);
    expect(current.totals.assignments.effort.knownMd).toBe(scopedKpi.plannedMd);
    expect(current.asOfDate).toBe(kpi.asOfDate);
    expect(kpi.effort.workloadRange).toEqual(current.range);
    const summaryName = { process: "공정 작업 고유 총계", equipment: "설비 작업 고유 총계", system: "시스템 작업 고유 총계", resource: "리소스 작업 고유 총계", milestone: "Milestone 선택 작업 고유 총계" }[root];
    const summary = dashboard(page).getByLabel(summaryName, { exact: true });
    const metric = (name: string) => summary.locator("div").filter({ has: page.getByRole("term").filter({ hasText: new RegExp(`^${name}$`) }) }).getByRole("definition");
    await expect(metric("고유 Task")).toHaveText(`${scopedTaskIds.length}건`);
    await expect(metric("기간가중 진척")).toHaveText(`${scopedProgress.toFixed(1)}%`);
    await expect(metric(root === "milestone" ? "계획 M/D" : "관련 계획 M/D")).toHaveText(`${current.totals.assignments.effort.plannedMd!.toFixed(2)} M/D`);
    if (root === "resource") {
      const exported = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/exports/excel`);
      const downloaded = page.waitForEvent("download");
      await dashboard(page).getByRole("button", { name: "계층 Excel 보고서", exact: true }).click();
      const response = await exported;
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON().resourceDashboard.expectedReport.snapshotId).toBe(current.snapshotId);
      const path = await (await downloaded).path();
      const workbook = issue623WorkbookEntries(await readFile(path!));
      const assignments = issue623Table(workbook.sheet("Resource Assignments"));
      expect(assignments.map(row => row.assignmentId).sort()).toEqual(assignmentIds);
      expect([...new Set(assignments.map(row => row.taskId))]).toEqual([f.task.taskId]);
      expect(assignments.reduce((sum, row) => sum + Number(row.plannedMd), 0)).toBe(current.totals.assignments.effort.knownMd);
    }
    expect(current.instanceIds).toEqual(expect.arrayContaining([{ kind: "equipment", instanceId: f.equipment.id }, { kind: "system", instanceId: f.system.id }]));
    expect(current.projectRevision).toBe(before.data.project.revision);
    receipts.push({ root, spec: current.spec, filters: current.filters, systemSelection: current.metadata.systemSelection, taskIds: current.taskIds, assignmentIds: current.assignmentIds, instanceIds: current.instanceIds, taskCount: current.totals.tasks.taskCount, progress: current.totals.tasks.progress, effort: current.totals.assignments.effort });
    await openWorkspaceView(page, "schedule");
    await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
    expect(await native!.evaluate(element => element.isConnected)).toBe(true);
  }
  await openRoot(page, "process");
  const config = await composer(page);
  for (const [index, dimension] of ["resource", "milestone"].entries()) {
    await config.getByRole("button", { name: "하위 축 추가", exact: true }).click();
    await config.getByRole("combobox", { name: `하위 축 ${index + 1}`, exact: true }).selectOption(dimension);
  }
  await config.getByRole("button", { name: "2번째 축 위로", exact: true }).click();
  await expect(config.getByRole("combobox", { name: "하위 축 1", exact: true })).toBeFocused();
  const reordered = await apply(page, config, ["milestone", "resource"]);
  expect(reordered.assignmentIds).toContain(f.assignment.id);
  await config.getByRole("button", { name: "2번째 축 삭제", exact: true }).click();
  await config.getByRole("combobox", { name: "하위 축 1", exact: true }).selectOption("siblings");
  const typed = await apply(page, config, [{ kind: "siblings", dimensions: ["equipment", "system"] }]);
  const process = typed.children.find(node => node.selector.id === f.processIds[0])!;
  expect(process.children.map(node => node.selector)).toEqual(expect.arrayContaining([{ dimension: "equipment", id: f.equipment.id }, { dimension: "system", id: f.system.id }]));
  await config.getByRole("button", { name: "1번째 축 삭제", exact: true }).click();
  await apply(page, config, []);
  expect(writes).toEqual([]);
  expect((await f.snapshot()).data).toEqual(before.data);

  const row = dashboard(page).locator(`tr[data-dimension="process"][data-entity-id="${f.processIds[0]}"]`);
  await row.getByRole("button", { name: "상세", exact: true }).click();
  const detail = dashboard(page).getByRole("region", { name: "계층 원본 상세", exact: true });
  await detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
  const renamed = "통합 시운전 동일 원본 수정";
  await editor.getByLabel("작업명", { exact: true }).fill(renamed);
  const saved = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/tasks/${f.task.taskId}`);
  const refreshed = report(page, "process", []);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  expect((await saved).status()).toBe(200);
  expect((await refreshed).projectRevision).toBe(before.data.project.revision + 1);
  await expect(detail.getByRole("button", { name: `${renamed} Task 원본`, exact: true })).toBeFocused();
  const schedule = detail.getByRole("button", { name: "이 범위 일정 보기", exact: true });
  await schedule.click();
  await expect(page.getByRole("region", { name: "임시 조회 범위", exact: true })).toBeVisible();
  await page.getByRole("region", { name: "임시 조회 범위", exact: true }).getByRole("button", { name: /원래 보기/ }).click();
  await expect(schedule).toBeFocused();
  await expect(dashboard(page)).toHaveAttribute("data-root", "process");
  const after = await f.snapshot();
  expect(after.data.tasks.map(task => task.taskId)).toEqual(before.data.tasks.map(task => task.taskId));
  expect(after.data.tasks.find(task => task.taskId === f.task.taskId)).toMatchObject({ name: renamed });
  expect(after.data.assignments).toEqual(before.data.assignments);
  expect((await (await page.request.get(`${origin}/api/resources`)).json()).data.resources.map((resource: { id: string }) => resource.id).sort()).toEqual(resourceIds);
  expect(after.data.logistics).toEqual(before.data.logistics);
  expect(after.data.project.revision).toBe(before.data.project.revision + 1);
  expect(writes).toEqual([{ method: "PATCH", path: `/api/projects/${f.publicId}/tasks/${f.task.taskId}` }]);
  await assertTarget0();
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  expect(await native!.evaluate(element => element.isConnected)).toBe(true);
  await expect(frame.locator(".project-milestone-lane,.project-milestone-lane-marker,.project-milestone-lane-guide")).toHaveCount(0);
  await info.attach("target0-cross-feature-identity", { contentType: "application/json", body: JSON.stringify({ receipts, instance, mutationCount: writes.length, beforeRevision: before.data.project.revision, afterRevision: after.data.project.revision }) });
});

for (const width of [390, 768, 1024, 1440, 1920]) {
  test(`#737 Target0 cross-feature keyboard·focus·표 내부 overflow ${width}px`, async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    const f = await seedWbsViewComposer(page, origin, observeIsolatedApi);
    await openWorkspaceView(page, "equipment");
    await openWorkspaceView(page, "schedule");
    await openRoot(page, "equipment");
    const row = dashboard(page).locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`);
    const trigger = row.getByRole("button", { name: "상세", exact: true });
    await trigger.focus();
    await trigger.press("Enter");
    const detail = dashboard(page).getByRole("region", { name: "계층 원본 상세", exact: true });
    await expect(detail).toHaveAttribute("data-detail-state", "ready");
    await detail.getByRole("heading").focus();
    await detail.press("Escape");
    await expect(trigger).toBeFocused();
    const geometry = await trigger.evaluate(element => {
      const box = element.getBoundingClientRect();
      const owner = element.closest<HTMLElement>("[data-wbs-scroll]")!;
      const bounds = owner.getBoundingClientRect();
      const table = owner.querySelector("table")!;
      const cells = (selector: string) => Array.from(table.querySelectorAll(selector)).map(cell => ({ left: cell.getBoundingClientRect().left, width: cell.getBoundingClientRect().width }));
      return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, left: box.left, right: box.right, ownerLeft: bounds.left, ownerRight: bounds.right, client: owner.clientWidth, scroll: owner.scrollWidth, header: cells("thead th"), body: cells("tbody tr:first-child > *") };
    });
    expect(geometry.document).toBeLessThanOrEqual(width + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(geometry.ownerLeft);
    expect(geometry.right).toBeLessThanOrEqual(geometry.ownerRight);
    expect(geometry.header).toHaveLength(6);
    expect(geometry.body).toHaveLength(6);
    geometry.body.forEach((cell, index) => { expect(Math.abs(cell.left - geometry.header[index].left)).toBeLessThanOrEqual(1); expect(Math.abs(cell.width - geometry.header[index].width)).toBeLessThanOrEqual(1); });
    if (width <= 768) expect(geometry.scroll).toBeGreaterThan(geometry.client);
    await info.attach(`target0-${width}-geometry`, { contentType: "application/json", body: JSON.stringify(geometry) });
    await info.attach(`target0-${width}.png`, { contentType: "image/png", body: await page.screenshot() });
  });
}
