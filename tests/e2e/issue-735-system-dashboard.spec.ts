import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { seedWbsViewComposer, viewResourcePassword } from "./fixtures/wbs-view-composer";
import { targetMasterPassword } from "./fixtures/target-project";
import type { WbsViewReportDto, WbsViewSpec } from "../../src/contracts/wbs-dashboard-views";
import type { ResourceDashboardFilterInput } from "../../src/contracts/resource-dashboard";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: viewResourcePassword, viewport: { width: 1440, height: 1000 } });
const root = (page: Page) => page.getByTestId("wbs-view-dashboard").filter({ visible: true });
const reportResponse = (page: Page) => page.waitForResponse(response => response.url().endsWith("/resource-dashboard/views") && response.request().postDataJSON().projection?.kind === "report" && response.request().postDataJSON().spec?.root === "system", { timeout: 30_000 });
async function openSystem(page: Page) {
  await page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "대시보드", exact: true }).click();
  await page.getByRole("tablist", { name: "대시보드 보기", exact: true }).getByRole("tab", { name: "물류 시스템", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ready", "true");
}
async function preset(page: Page, label: string) {
  const composer = root(page).locator("details").filter({ has: page.locator("summary").filter({ hasText: /^조회 구성$/ }) });
  if (!await composer.evaluate(node => (node as HTMLDetailsElement).open)) await composer.locator(":scope > summary").click();
  await composer.getByRole("button", { name: label, exact: true }).click();
  const received = reportResponse(page);
  await composer.getByRole("button", { name: "적용", exact: true }).click();
  const response = await received;
  expect(response.status(), await response.text()).toBe(200);
  await expect(root(page)).toHaveAttribute("data-ready", "true");
  return (await response.json()).data as WbsViewReportDto;
}
async function expand(row: Locator) {
  const toggle = row.getByRole("button", { name: /하위 펼치기$/ });
  await toggle.focus(); await toggle.press("Enter");
}
async function seedSystem(page: Page, origin: string, observeApi: Parameters<typeof seedWbsViewComposer>[2]) {
  const f = await seedWbsViewComposer(page, origin, observeApi);
  await f.mutate(`/logistics/systems/${f.system.id}`, { code: "ACS-A", name: "A 제어 시스템 " + "LongSystemNameWithoutWhitespace".repeat(4), processIds: [f.processIds[0]] }, "patch");
  await f.mutate("/logistics/systems", { code: "ACS-B", name: "B 제어 시스템", systemType: "acs", layer: "controller", scope: "processes", processIds: [f.processIds[1]] });
  await f.mutate("/logistics/systems", { code: "MCS", name: "프로젝트 공통 MCS", systemType: "mcs", layer: "coordinator", scope: "project" });
  const systems = (await f.snapshot()).data.logistics!.systems;
  const acsA = systems.find(row => row.code === "ACS-A")!, acsB = systems.find(row => row.code === "ACS-B")!, mcs = systems.find(row => row.code === "MCS")!;
  await f.mutate(`/logistics/systems/${acsA.id}/resource-roles`, { roles: [{ resourceId: f.resource.id, role: "pi", isPrimary: true }, { resourceId: f.resource.id, role: "developer" }] }, "put");
  await f.mutate(`/logistics/systems/${mcs.id}/children`, { childSystemIds: [acsA.id, acsB.id] }, "put");
  const targets = await page.request.get(`${f.api}/logistics/targets`);
  expect(targets.status()).toBe(200); expect((await targets.json()).data.targets).toHaveLength(0);
  await page.reload();
  const query = async (extra: Partial<WbsViewSpec> = {}, filters: ResourceDashboardFilterInput = {}) => {
    const response = await page.request.post(`${f.api}/resource-dashboard/views`, { headers: { Origin: origin }, data: { spec: { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "system", levels: [], systemView: "direct", ...extra }, filters, projection: { kind: "report" } } });
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()).data as WbsViewReportDto;
  };
  return { ...f, acsA, acsB, mcs, query };
}
const systemRow = (page: Page, id: string) => root(page).locator(`tr[data-dimension="system"][data-entity-id="${id}"]`);

test("#735 실제 System 직접·조정 Task 집합과 고유 Assignment·선택·공정 필터", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedSystem(page, origin, observeIsolatedApi);
  const before = await f.snapshot();
  const direct = await f.query();
  expect(direct.children.filter(row => row.selector.id).map(row => row.selector.id).sort()).toEqual([f.acsA.id, f.acsB.id, f.mcs.id].sort());
  expect(direct.children.find(row => row.selector.id === f.acsA.id)!.taskIds).toEqual([f.task.taskId]);
  for (const id of [f.acsB.id, f.mcs.id]) expect(direct.children.find(row => row.selector.id === id)!.taskIds).toEqual([]);
  const coordination = await f.query({ systemView: "coordination", levels: ["process", "workArea", "equipment", "resource"] });
  for (const report of [direct, coordination]) {
    expect(new Set(report.taskIds).size).toBe(report.taskIds.length);
    expect(new Set(report.assignmentIds).size).toBe(report.assignmentIds.length);
    expect(report.assignmentIds).toEqual([f.assignment.id]);
    expect(report.totals.assignments.assignmentCount).toBe(1);
  }
  expect(coordination.children.find(row => row.selector.id === f.acsB.id)!.taskIds).toEqual([]);
  expect(coordination.children.find(row => row.selector.id === f.mcs.id)!.taskIds).toEqual([f.task.taskId]);
  const milestone = await f.query({ levels: ["milestone", "process"] });
  expect(milestone.children.find(row => row.selector.id === f.acsA.id)!.children.find(row => row.selector.id === f.milestone.taskId)!.taskIds).toEqual([f.task.taskId]);
  const none = await f.query({ systemIds: [] }); expect(none.children).toEqual([]); expect(none.taskIds).toEqual([]);
  const selected = await f.query({ systemIds: [f.acsA.id] }); expect(selected.children.map(row => row.selector.id)).toEqual([f.acsA.id]);
  const noRole = await f.query({}, { roles: ["PI"] }); expect(noRole.assignmentIds).toEqual([]);
  await openSystem(page);
  await expect(systemRow(page, f.acsA.id)).toBeVisible(); await expect(systemRow(page, f.acsB.id)).toBeVisible();
  const filteredReport = async (change: () => Promise<unknown>) => {
    const received = reportResponse(page); await change(); const response = await received;
    expect(response.status()).toBe(200); await expect(root(page)).toHaveAttribute("data-ready", "true");
    return (await response.json()).data as WbsViewReportDto;
  };
  const coordinatedUi = await filteredReport(() => root(page).getByRole("combobox", { name: "시스템 연결 범위", exact: true }).selectOption("coordination"));
  expect(coordinatedUi.children.find(row => row.selector.id === f.mcs.id)!.taskIds).toEqual([f.task.taskId]);
  await root(page).getByText("시스템 속성 필터", { exact: true }).click();
  await root(page).getByRole("combobox", { name: "시스템 공정 범위", exact: true }).selectOption("project");
  const common = await filteredReport(() => root(page).getByRole("button", { name: "시스템 속성 필터 적용", exact: true }).click());
  expect(common.children.map(row => row.selector.id)).toEqual([f.mcs.id]);
  await root(page).getByRole("combobox", { name: "시스템 공정 범위", exact: true }).selectOption("");
  await root(page).getByRole("combobox", { name: "시스템 PI", exact: true }).selectOption(f.resource.id);
  await root(page).getByRole("combobox", { name: "시스템 개발자", exact: true }).selectOption(f.resource.id);
  await root(page).getByRole("combobox", { name: "시스템 공정", exact: true }).selectOption(f.processIds[0]);
  const pi = await filteredReport(() => root(page).getByRole("button", { name: "시스템 속성 필터 적용", exact: true }).click());
  expect(pi.children.map(row => row.selector.id)).toEqual([f.acsA.id]);
  expect(pi.assignmentIds).toEqual([f.assignment.id]);
  const standalone = await preset(page, "시스템 단독"); expect(standalone.spec.levels).toEqual([]);
  const milestoneUi = await preset(page, "시스템 → Milestone → 공정"); expect(milestoneUi.spec.levels).toEqual(["milestone", "process"]);
  expect((await f.snapshot()).data).toEqual(before.data);
});

test("#735 System 정확 원본 dirty·취소·저장 후 새 snapshot과 같은 조회 복귀", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedSystem(page, origin, observeIsolatedApi);
  const received = reportResponse(page); await openSystem(page); const initial = (await (await received).json()).data as WbsViewReportDto;
  const original = systemRow(page, f.acsA.id).getByRole("button", { name: "원본", exact: true });
  await original.click(); const editor = page.getByRole("dialog", { name: "시스템 수정", exact: true });
  const name = editor.getByLabel("시스템명 *", { exact: true }); await expect(name).toHaveValue(f.acsA.name);
  await name.fill("시스템 원본 저장 복귀"); await editor.getByRole("button", { name: "취소", exact: true }).click();
  const discard = editor.getByRole("alert").filter({ hasText: "저장하지 않은 시스템 변경을 폐기할까요?" });
  await expect(discard).toBeVisible(); await discard.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(name).toHaveValue("시스템 원본 저장 복귀");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "공유 인스턴스 변경 확인", exact: true });
  await expect(confirmation).toBeVisible(); await expect(confirmation).toContainText("공유 Target 0개"); await expect(confirmation).toContainText(f.acsA.id);
  const [saved, refreshed] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/logistics/systems/${f.acsA.id}`, { timeout: 30_000 }),
    reportResponse(page), confirmation.getByRole("button", { name: "공유 사용처 확인 후 원본 저장", exact: true }).click(),
  ]);
  expect(saved.status()).toBe(200);
  const updated = (await refreshed.json()).data as WbsViewReportDto;
  expect(updated.spec).toEqual(initial.spec); expect(updated.snapshotId).not.toBe(initial.snapshotId); expect(updated.projectRevision).toBe(initial.projectRevision + 1);
  await expect(systemRow(page, f.acsA.id)).toContainText("시스템 원본 저장 복귀");
  await expect(original).toBeFocused();
  await original.click(); await editor.getByRole("button", { name: "취소", exact: true }).click(); await expect(original).toBeFocused();
  // Delay a real response: a newer user focus must supersede the saved original's return intent.
  await original.click(); await name.fill("새 사용자 focus 보존 검증");
  await editor.getByRole("button", { name: "저장", exact: true }).click(); await expect(confirmation).toBeVisible();
  let held = false;
  let release!: () => void;
  const gate = new Promise<void>(resolveGate => { release = resolveGate; });
  const pattern = `**/api/projects/${f.publicId}/resource-dashboard/views`;
  await page.route(pattern, async route => {
    const input = route.request().postDataJSON();
    if (input.projection?.kind !== "report" || input.spec?.root !== "system") return route.continue();
    const response = await route.fetch(); held = true; await gate; await route.fulfill({ response });
  });
  try {
    const refreshed = reportResponse(page);
    const [saved] = await Promise.all([
      page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/logistics/systems/${f.acsA.id}`),
      confirmation.getByRole("button", { name: "공유 사용처 확인 후 원본 저장", exact: true }).click(),
    ]);
    expect(saved.status()).toBe(200); await expect.poll(() => held).toBe(true);
    const outside = page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "대시보드", exact: true });
    await outside.click(); await expect(outside).toBeFocused(); release(); await refreshed;
    await expect(root(page)).toHaveAttribute("data-ready", "true"); await expect(outside).toBeFocused();
  } finally { release(); await page.unroute(pattern); }
});

test("#735 System Task·Assignment·일정 왕복과 stale·error 원본 잠금", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedSystem(page, origin, observeIsolatedApi); await openSystem(page);
  const frame = page.locator(".project-gantt-frame"), instance = await frame.getAttribute("data-project-gantt-instance"), gantt = await frame.locator(".wx-gantt").elementHandle();
  const row = systemRow(page, f.acsA.id); await row.getByRole("button", { name: "상세", exact: true }).click();
  const detail = root(page).getByRole("region", { name: "계층 원본 상세", exact: true });
  const taskOriginal = detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true }); await taskOriginal.click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true }); await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
  await page.keyboard.press("Escape"); await expect(taskOriginal).toBeFocused();
  await detail.getByRole("button", { name: "Assignment 보기", exact: true }).click();
  const assignment = detail.getByRole("button", { name: `${f.resource.name} Assignment 원본`, exact: true }); await assignment.click();
  await expect(editor.getByRole("status").filter({ hasText: "선택한 개인의 배정만 편집합니다." })).toContainText(`Assignment ID ${f.assignment.id} · Resource ID ${f.resource.id}`);
  await page.keyboard.press("Escape"); await expect(assignment).toBeFocused();
  const schedule = detail.getByRole("button", { name: "이 범위 일정 보기", exact: true }); await schedule.click();
  await page.getByRole("region", { name: "임시 조회 범위", exact: true }).getByRole("button", { name: /원래 보기/ }).click(); await expect(schedule).toBeFocused();
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!); expect(await gantt!.evaluate(element => element.isConnected)).toBe(true);
  await detail.getByRole("heading").focus(); await page.keyboard.press("Escape");
  const pattern = `**/api/projects/${f.publicId}/resource-dashboard/views`;
  await page.route(pattern, route => route.request().postDataJSON().projection?.kind === "scope" ? route.fulfill({ status: 409, json: { error: { code: "REPORT_STALE", message: "의도한 stale 음성 검증" } } }) : route.continue());
  await row.getByRole("button", { name: "원본", exact: true }).click(); await expect(root(page)).toHaveAttribute("data-wbs-state", "stale"); await expect(row.getByRole("button", { name: "원본", exact: true })).toBeDisabled();
  await page.unroute(pattern); const refreshed = reportResponse(page); await root(page).getByRole("button", { name: "계층 새로고침", exact: true }).click(); await refreshed; await expect(root(page)).toHaveAttribute("data-ready", "true");
  await page.route(pattern, route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "의도한 조회 오류 검증" } } }));
  await root(page).getByRole("button", { name: "계층 새로고침", exact: true }).click(); await expect(root(page)).toHaveAttribute("data-wbs-state", "error"); await expect(row.getByRole("button", { name: "원본", exact: true })).toBeDisabled(); await page.unroute(pattern);
});

test("#735 긴 System 이름 5폭 내부 스크롤·표 정렬·키보드 focus", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedSystem(page, origin, observeIsolatedApi); await openSystem(page);
  await preset(page, "시스템 → 공정 → WorkArea → 설비 → 리소스"); await expand(systemRow(page, f.acsA.id));
  const directory = resolve("output/playwright/issue-735"); await mkdir(directory, { recursive: true }); const geometry = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const row = systemRow(page, f.acsA.id), toggle = row.getByRole("button", { name: /하위 접기$/ }); await toggle.focus(); await toggle.press("Tab");
    const action = row.getByRole("button", { name: "상세", exact: true }); await expect(action).toBeFocused();
    const table = root(page).getByRole("table", { name: "공통 계층 결과", exact: true });
    const measured = await table.evaluate(element => {
      const cells = (selector: string) => Array.from(element.querySelectorAll(selector)).map(cell => { const box = cell.getBoundingClientRect(); return { left: box.left, width: box.width }; });
      const owner = element.parentElement!, bounds = owner.getBoundingClientRect(), focus = document.activeElement!.getBoundingClientRect();
      return { document: document.documentElement.scrollWidth, header: cells("thead th"), body: cells("tbody tr:first-child > *"), owner: { left: bounds.left, right: bounds.right, client: owner.clientWidth, scroll: owner.scrollWidth, overflow: getComputedStyle(owner).overflowX }, focus: { left: focus.left, right: focus.right } };
    });
    expect(measured.document).toBeLessThanOrEqual(width + 1); expect(measured.focus.left).toBeGreaterThanOrEqual(measured.owner.left); expect(measured.focus.right).toBeLessThanOrEqual(measured.owner.right);
    expect(measured.header).toHaveLength(6); expect(measured.body).toHaveLength(6);
    measured.body.forEach((cell, index) => { expect(Math.abs(cell.left - measured.header[index].left)).toBeLessThanOrEqual(1); expect(Math.abs(cell.width - measured.header[index].width)).toBeLessThanOrEqual(1); });
    expect(measured.owner.overflow).toMatch(/auto|scroll/); if (width <= 768) expect(measured.owner.scroll).toBeGreaterThan(measured.owner.client);
    await action.press("Shift+Tab"); await expect(toggle).toBeFocused(); geometry.push({ width, ...measured });
    await root(page).evaluate(element => { for (let node = element.parentElement; node; node = node.parentElement) node.scrollTop = 0; window.scrollTo(0, 0); });
    await info.attach(`system-${width}.png`, { contentType: "image/png", body: await page.screenshot({ path: resolve(directory, `system-${width}.png`) }) });
    if (width === 1440) {
      const disclosures = root(page).locator("details").filter({ has: page.locator("summary").filter({ hasText: /^(조회 구성|시스템 속성 필터)$/ }) });
      const opened = [];
      for (const disclosure of await disclosures.all()) {
        if (await disclosure.evaluate(node => (node as HTMLDetailsElement).open)) { await disclosure.locator(":scope > summary").click(); opened.push(disclosure); }
      }
      await root(page).evaluate(element => { for (let node = element.parentElement; node; node = node.parentElement) node.scrollTop = 0; });
      await info.attach("system-overview-1440.png", { contentType: "image/png", body: await root(page).screenshot({ path: resolve(directory, "system-overview-1440.png") }) });
      for (const disclosure of opened) await disclosure.locator(":scope > summary").click();
    }
  }
  await writeFile(resolve(directory, "geometry.json"), JSON.stringify(geometry, null, 2)); await info.attach("system-five-widths", { contentType: "application/json", body: JSON.stringify(geometry) });
});

test("#735 readonly System 조회는 원본 편집·mutation을 제공하지 않는다", async ({ page, browser, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedSystem(page, origin, observeIsolatedApi), before = await f.snapshot(); const context = await browser.newContext(); const readonly = await context.newPage(); let mutations = 0;
  readonly.on("request", request => { if (new URL(request.url()).pathname.startsWith(`/api/projects/${f.publicId}/`) && !["GET", "HEAD"].includes(request.method()) && !isWbsViewReadQuery(request)) mutations++; });
  try {
    await readonly.goto(`${origin}/projects/${f.publicId}`); await openSystem(readonly); await expect(root(readonly).getByRole("button", { name: "원본", exact: true })).toHaveCount(0);
    await systemRow(readonly, f.acsA.id).getByRole("button", { name: "상세", exact: true }).click();
    await expect(root(readonly).getByRole("region", { name: "계층 원본 상세", exact: true })).toBeVisible(); expect(mutations).toBe(0); expect((await f.snapshot()).data).toEqual(before.data);
  } finally { await context.close(); }
});

test("#735 구버전 System 저장 spec·펼침·상세 선택은 직접 범위로 변환하지 않는다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedSystem(page, origin, observeIsolatedApi), before = await f.snapshot();
  const legacy = await f.query({ systemView: undefined, levels: ["process"] });
  expect(legacy.spec.systemView).toBeUndefined();
  expect(legacy.taskIds.sort()).toEqual(before.data.tasks.filter(task => task.type === "task").map(task => task.taskId).sort());
  const row = legacy.children.find(node => node.selector.id === f.acsA.id)!;
  const state = { spec: legacy.spec, filters: {}, expanded: [row.viewRowKey], selected: { viewRowKey: row.viewRowKey, path: row.path }, scroll: { top: 0, left: 0 }, focus: row.viewRowKey, sort: "name-asc" };
  await page.evaluate(({ publicId, state }) => localStorage.setItem(`mastergantt:wbs-view:1:${publicId}:system`, JSON.stringify({ schema: "wbs-view-state/1", projectPublicId: publicId, state })), { publicId: f.publicId, state });
  await page.reload(); const received = reportResponse(page); await openSystem(page);
  const restored = (await (await received).json()).data as WbsViewReportDto;
  expect(restored.spec).toEqual(legacy.spec); expect(restored.taskIds.sort()).toEqual(legacy.taskIds.sort());
  await expect(root(page).getByRole("combobox", { name: "시스템 연결 범위", exact: true })).toHaveValue("legacy");
  await expect(systemRow(page, f.acsA.id).getByRole("button", { name: /하위 접기$/ })).toBeVisible();
  const detail = root(page).getByRole("region", { name: "계층 원본 상세", exact: true }); await expect(detail).toHaveAttribute("data-detail-state", "ready");
  await expect(detail.getByRole("heading", { name: f.acsA.name, exact: true })).toBeVisible();
  const stored = await page.evaluate(publicId => JSON.parse(localStorage.getItem(`mastergantt:wbs-view:1:${publicId}:system`)!).state, f.publicId);
  expect(stored.spec).toEqual(legacy.spec); expect(stored.selected).toEqual(state.selected); expect(stored.expanded).toEqual(state.expanded); expect(stored.focus).toBe(state.focus);
  expect((await f.snapshot()).data).toEqual(before.data);
});
