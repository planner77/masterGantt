import { toResourcePublicV2 } from "../../src/contracts/resource-public-v2";
import { mkdir } from "node:fs/promises";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { expect, test, type Page, type Route } from "@playwright/test";
import { deferred, expectSameGanttRoot, installStatefulProjectFixture as installBaseFixture, projectPath, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

import { withIntegratedKpi } from "../fixtures/logistics-integrated-kpi";

import { resourceDashboardUiFixture } from "../fixtures/resource-dashboard-ui";
import { normalizedDrillFilters } from "../../src/features/resources/resource-drill-transport";
import type { ResourceDrillQueryInput, ResourceDrillSourceContext } from "../../src/contracts/resource-drill";

import { captureUi } from "./helpers/ui-geometry";

async function installStatefulProjectFixture(page: Page) {
  const state = await installBaseFixture(page);
  const identity = () => ({ projectPublicId: publicId, projectRevision: state.project.revision, catalogRevision: 1, calendarRevision: "c".repeat(64), dataSnapshotId: "d".repeat(64) });
  await page.route(`**${projectPath}/resource-dashboard/scope?*`, route => route.fulfill({ json: { data: identity() } }));
  await page.route(`**${projectPath}/resource-dashboard/query`, route => {
    const input = route.request().postDataJSON() as ResourceDrillQueryInput;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input.filters)) {
      if (Array.isArray(value)) for (const item of value) query.append(key, String(item));
      else query.set(key, String(value));
    }
    const report = resourceDashboardUiFixture(state, query);
    report.mdPerMm = report.filters.mdPerMmProvided ? report.filters.mdPerMm : 20;
    report.mdPerMmSource = report.filters.mdPerMmProvided ? "query" : "environment";
    report.resourceScopeContext = { ...identity(), range: report.range, asOfDate: report.asOfDate, mdPerMm: report.mdPerMm, mdPerMmSource: report.mdPerMmSource, mdPerMmProvided: report.filters.mdPerMmProvided, sourceProjection: { kind: "report" } } satisfies ResourceDrillSourceContext;
    return route.fulfill({ json: toResourcePublicV2({ data: report, drill: { ...input, targetFilters: normalizedDrillFilters(input.filters), assignmentScope: "exact-source-intersection", projectReferenceScope: "same-resource-population-and-period" } }) });
  });
  return state;
}

const dashboardPath = `**/api/projects/${publicId}/logistics/kpi?*`;
function dashboard(route: Route, revision = 40, longName = false) {
  const params = new URL(route.request().url()).searchParams;
  const row = { id: "proc-1", code: "PROC-01", name: longName ? "매우긴공정명LongUnbrokenName".repeat(20) : "입고 공정", active: true, taskCount: 1, progressPercent: 50, overdueTaskCount: 0, plannedMd: 1, taskIds: ["00000000-0000-4000-8000-000000000003"] };
  return withIntegratedKpi({ projectRevision: revision, catalogRevision: 1, asOfDate: params.get("asOfDate") || "2026-09-29", timezone: "Asia/Seoul", calculatedAt: "2026-09-29T00:00:00Z", horizonDays: Number(params.get("horizonDays") || 14), systemView: params.get("systemView") === "coordination" ? "coordination" : "direct", activeOnly: params.get("activeOnly") === "true", includedTaskIds: row.taskIds, includedMilestoneIds: [],
    kpi: { progressPercent: 50, totalDuration: 2, taskCount: 1, overdueTaskCount: 0, overdueTaskIds: [], milestoneTotalCount: 0, milestoneOverdueCount: 0, milestoneOverdueIds: [], milestoneUpcomingCount: 0, milestoneUpcomingIds: [] },
    effort: { plannedMd: 1, plannedMm: null, mdPerMm: null, unsetAllocationCount: 0, workloadRange: { from: null, to: null } },
    quality: { unlinkedLeafTaskCount: 0, totalLeafTaskCount: 1, unlinkedLeafTaskPercent: 0, equipmentWithoutPrimaryControllerCount: 0, equipmentWithoutOwnerCount: 0, systemsWithoutPrimaryPICount: 0, totalEquipmentMasterCount: 0, totalEquipmentQuantity: 0 },
    breakdowns: { processes: [row], equipment: [], systems: [] },
  });
}
async function openDashboard(page: Page) {
  await page.goto(`/projects/${publicId}`);
  await openWorkspaceView(page, "kpi");
  return page.getByTestId("logistics-dashboard-view");
}

for (const failure of ["500", "network", "malformed", "invalid-date", "wrong-revision", "wrong-filter", "missing-integrated", "malformed-integrated"] as const) {
  test(`조회 ${failure}는 이전 결과를 숨기고 다시 시도로 복구한다`, async ({ page }) => {
    await installStatefulProjectFixture(page);
    let fail = false;
    await page.route(dashboardPath, (route) => {
      if (fail && failure === "network") return route.abort();
      if (fail && failure === "500") return route.fulfill({ status: 500, json: {} });
      const value = dashboard(route, fail && failure === "wrong-revision" ? 39 : 40);
      return route.fulfill({ json: toResourcePublicV2({ data: fail && failure === "missing-integrated" ? { ...value, integrated: undefined } : fail && failure === "malformed-integrated" ? { ...value, integrated: { ...value.integrated, diagnostics: { ...value.integrated.diagnostics, unsetAllocationAssignmentIds: [null] } } } : fail && failure === "malformed" ? { ...value, breakdowns: { processes: [null], equipment: [], systems: [] } } : fail && failure === "invalid-date" ? { ...value, asOfDate: "2026-02-30" } : fail && failure === "wrong-filter" ? { ...value, horizonDays: 90 } : value }) });
    });
    const view = await openDashboard(page);
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
    fail = true;
    await view.getByRole("button", { name: "새로고침", exact: true }).click();
    await expect(view.getByRole("alert")).toBeVisible();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/issue-267/error-${failure}.png` });
    fail = false;
    await view.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  });
}

test("기준일 기본 응답은 추가 조회를 만들지 않고 조건 변경 즉시 오래된 drilldown을 숨긴다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  let gate = deferred();
  let wait = false;
  let reads = 0;
  await page.route(dashboardPath, async (route) => { reads++; if (wait) await gate.promise; await route.fulfill({ json: toResourcePublicV2({ data: dashboard(route) }) }); });
  const view = await openDashboard(page);
  await expect(view.getByLabel("기준일 (As of)")).toHaveValue("2026-09-29");
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  expect(reads).toBe(1);
  await view.getByRole("tab", { name: /^설비별 현황/ }).click();
  expect(reads).toBe(1);
  wait = true;
  await view.getByLabel("기준일 (As of)").fill("2026-10-01");
  await expect(view.getByText("현재 조회 조건으로 물류 KPI 대시보드를 집계하는 중입니다…")).toBeVisible();
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toHaveCount(0);
  await expect(view.getByRole("button", { name: "새로고침 중…", exact: true })).toBeDisabled();
  gate.resolve();
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  expect(reads).toBe(2);
  for (const change of [
    () => view.getByLabel("시스템 집계 범위").selectOption("coordination"),
    () => view.getByLabel("활성 마스터만 보기").check(),
  ]) {
    gate = deferred();
    await change();
    await expect(view.getByText("현재 조회 조건으로 물류 KPI 대시보드를 집계하는 중입니다…")).toBeVisible();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toHaveCount(0);
    gate.resolve();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  }
  expect(reads).toBe(4);
});

test("빠른 기간 변경의 응답 역전은 최신 결과를 유지한다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  const gate = deferred();
  const started = deferred();
  await page.route(dashboardPath, async (route) => {
    if (new URL(route.request().url()).searchParams.get("horizonDays") === "10") { started.resolve(); await gate.promise; }
    await route.fulfill({ json: toResourcePublicV2({ data: dashboard(route) }) }).catch(() => {});
  });
  const view = await openDashboard(page);
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  await view.getByLabel("임박 기준 (일)").fill("10");
  await started.promise;
  await view.getByLabel("임박 기준 (일)").fill("20");
  await expect(view.getByText("20일 이내 임박", { exact: true })).toBeVisible();
  gate.resolve();
  await expect(view.getByText("20일 이내 임박", { exact: true })).toBeVisible();
  await expect(view.getByText("10일 이내 임박", { exact: true })).toHaveCount(0);
});

test("기간 빈 값·0·91·소수는 좁은 화면에서도 field 오류와 GET 차단 후 정상 범위로 복구한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await installStatefulProjectFixture(page);
  let reads = 0;
  await page.route(dashboardPath, (route) => { reads++; return route.fulfill({ json: toResourcePublicV2({ data: dashboard(route) }) }); });
  const view = await openDashboard(page);
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  const initialReads = reads;
  const horizon = view.getByLabel("임박 기준 (일)");
  for (const invalid of ["", "0", "91", "1.5"]) {
    await horizon.fill(invalid);
    await expect(horizon).toHaveAttribute("aria-invalid", "true");
    const error = view.getByRole("alert");
    await expect(error).toContainText("1~90 사이의 정수");
    expect(await error.evaluate(element => {
      const rect = element.getBoundingClientRect(), owner = element.parentElement!.getBoundingClientRect();
      return rect.left >= owner.left - 1 && rect.right <= owner.right + 1
        && element.scrollHeight <= element.clientHeight + 1;
    })).toBe(true);
    await expect(view.getByRole("button", { name: "새로고침", exact: true })).toBeDisabled();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toHaveCount(0);
    expect(reads).toBe(initialReads);
  }
  await horizon.fill("90");
  await expect(view.getByText("90일 이내 임박", { exact: true })).toBeVisible();
  await expect(horizon).toHaveAttribute("aria-invalid", "false");
  expect(reads).toBe(initialReads + 1);
});

for (const width of [390, 768, 1024, 1440, 1920]) {
  test(`세부 tab keyboard·빈 현황·긴 이름·정상 drilldown Gantt 보존 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installStatefulProjectFixture(page);
    await page.route(dashboardPath, (route) => route.fulfill({ json: toResourcePublicV2({ data: dashboard(route, 40, true) }) }));
    await page.goto(`/projects/${publicId}`);
    const root = await rememberGanttRoot(page);
    await openWorkspaceView(page, "kpi");
    const view = page.getByTestId("logistics-dashboard-view");
    await expect(view.getByRole("tablist", { name: "물류 세부 현황" })).toBeVisible();
    // #825: the workspace owns the width and context; the embedded KPI starts
    // with useful controls instead of another logistics heading.
    await expect(page.getByRole("heading", { name: "물류 구성", exact: true })).toHaveCount(0);
    const framing = await view.evaluate(element => {
      const host = element.closest("#project-panel-logistics")!;
      const bounds = (node: Element) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
      };
      const date = element.querySelector<HTMLInputElement>('input[type="date"]')!;
      const filter = date.parentElement!.parentElement!;
      const controls = Array.from(filter.querySelectorAll("input:not([type=checkbox]),select,button"));
      return {
        host: bounds(host), view: bounds(element), filter: bounds(filter),
        controls: controls.map(bounds),
        labels: Array.from(filter.querySelectorAll("label")).map(bounds),
        firstKpiTop: element.querySelector("h4")!.getBoundingClientRect().top,
      };
    });
    expect(Math.abs(framing.view.left - framing.host.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(framing.view.right - framing.host.right)).toBeLessThanOrEqual(1);
    for (const item of [...framing.controls, ...framing.labels]) {
      expect(item.left).toBeGreaterThanOrEqual(framing.filter.left - 1);
      expect(item.right).toBeLessThanOrEqual(framing.filter.right + 1);
      expect(item.top).toBeGreaterThanOrEqual(framing.filter.top - 1);
      expect(item.bottom).toBeLessThanOrEqual(framing.filter.bottom + 1);
    }
    if (width === 1920) {
      expect(framing.filter.height).toBeLessThan(65);
      expect(Math.max(...framing.controls.map(item => item.top)) - Math.min(...framing.controls.map(item => item.top))).toBeLessThanOrEqual(1);
    }
    await testInfo.attach(`kpi-workspace-framing-${width}`, { body: JSON.stringify(framing), contentType: "application/json" });
    const processes = view.getByRole("tab", { name: /^공정별 현황/ });
    const equipment = view.getByRole("tab", { name: /^설비별 현황/ });
    const systems = view.getByRole("tab", { name: /^물류 시스템별 현황/ });
    for (const tab of [processes, equipment, systems]) {
      const panelId = await tab.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      await expect(view.locator(`[id="${panelId}"]`)).toHaveCount(1);
    }
    await expect(processes).toHaveAttribute("tabindex", "0");
    await expect(equipment).toHaveAttribute("tabindex", "-1");
    await expect(systems).toHaveAttribute("tabindex", "-1");
    await processes.focus();
    await page.keyboard.press("ArrowRight");
    await expect(equipment).toBeFocused();
    await expect(equipment).toHaveAttribute("aria-selected", "true");
    await expect(processes).toHaveAttribute("tabindex", "-1");
    await expect(equipment).toHaveAttribute("tabindex", "0");
    await expect(view.getByRole("tabpanel", { name: /^설비별 현황/ })).toContainText("등록된 설비가 없습니다.");
    await page.keyboard.press("End");
    await expect(systems).toBeFocused();
    await expect(view.getByRole("tabpanel", { name: /^물류 시스템별 현황/ })).toContainText("등록된 시스템이 없습니다.");
    await page.keyboard.press("Home");
    await expect(processes).toBeFocused();
    await expect(view.getByRole("tabpanel", { name: /^공정별 현황/ })).toContainText("매우긴공정명");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: `output/playwright/issue-267/long-data-${width}.png` });
    await captureUi(page, testInfo, `logistics-long-${width}`);
    await view.getByRole("button", { name: "일정에서 전체 작업 보기" }).click();
    await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
    await expectSameGanttRoot(page, root);
  });
}

function diagnosticDashboard(route: Route) {
  const value = dashboard(route);
  const leaf = "00000000-0000-4000-8000-000000000003";
  const child = "00000000-0000-4000-8000-000000000002";
  value.integrated.effortState = "partial";
  value.effort.unsetAllocationCount = 1;
  value.integrated.assignmentIds = ["assignment-1"];
  value.integrated.assignmentRows = [{ id: "assignment-1", taskId: leaf, targetKind: "resource", targetId: "resource-1", targetName: "테스트 리소스", allocationPercent: null }];
  value.integrated.resourceRows = [{ id: "resource-1", name: "테스트 리소스", code: "R-01" }];
  Object.assign(value.integrated.configuration, { registeredResourceIds: ["resource-1"], participatingResourceIds: ["resource-1"], assignedResourceIds: ["resource-1"],
    targets: [{ id: "target-empty", name: "연결 없는 Target", active: true, taskIds: [] }],
    workAreaIds: ["work-area-1"], workAreas: [{ id: "work-area-1", name: "긴 작업 구역 Long WorkArea Name", active: true, processIds: ["proc-1"], taskIds: [leaf], assignmentIds: ["assignment-1"], equipmentIds: [], equipmentQuantity: 0 }],
  });
  Object.assign(value.integrated.diagnostics, { unlinkedTaskIds: [child], unlinkedLeafTaskIds: [child], completelyUnassignedTaskIds: [child], personallyUnassignedTaskIds: [child], unsetAllocationTaskIds: [leaf], unsetAllocationAssignmentIds: ["assignment-1"], targetWithoutTaskIds: ["target-empty"] });
  return value;
}

for (const width of [390, 768, 1024, 1440, 1920]) {
  test(`#731 통합 KPI 읽기 전용 진단·정확 Assignment·키보드 복귀·열 예산 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installStatefulProjectFixture(page);
    state.sessionEditable = false;
    const requests: string[] = [];
    const snapshotReads: string[] = [];
    page.on("request", request => { if (request.url().includes("/api/") && !["GET", "HEAD"].includes(request.method()) && !request.url().endsWith("/resource-dashboard/query")) requests.push(`${request.method()} ${new URL(request.url()).pathname}`); });
    await page.route(dashboardPath, route => {
      const query = new URL(route.request().url()).searchParams;
      expect(query.get("source")).toBe("integrated");
      if (query.has("snapshotId")) snapshotReads.push(query.get("snapshotId")!);
      return route.fulfill({ json: toResourcePublicV2({ data: diagnosticDashboard(route) }) });
    });
    await page.goto(`/projects/${publicId}`);
    const gantt = await rememberGanttRoot(page);
    await openWorkspaceView(page, "kpi");
    const view = page.getByTestId("logistics-dashboard-view");
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
    const configuration = view.getByTestId("logistics-kpi-configuration");
    await expect(configuration).not.toHaveAttribute("open", "");
    const summary = configuration.locator("summary");
    await expect(summary).toHaveText(/구성·연결 진단/);
    await summary.focus(); await page.keyboard.press("Enter");
    await expect(configuration).toHaveAttribute("open", "");
    await expect(configuration).toContainText("등록 WorkArea");
    await expect(configuration).toContainText("등록 리소스");
    const allocation = configuration.getByRole("button", { name: /개인 투입률 미설정/ });
    await allocation.focus(); await page.keyboard.press("Enter");
    await expect(configuration.getByRole("heading", { name: /개인 투입률 미설정/ })).toBeFocused();
    await expect(configuration).toContainText("Stable leaf");
    await expect(configuration).toContainText("테스트 리소스");
    await expect(configuration).not.toContainText("Existing summary child");
    const diagnostic = configuration.getByRole("region", { name: "개인 투입률 미설정 상세", exact: true });
    await diagnostic.locator("summary").click();
    await expect(diagnostic.getByRole("textbox", { name: "원본 ID", exact: true })).toHaveValue("assignment-1");
    await expect(diagnostic.getByRole("button", { name: "Task 원본", exact: true })).toBeEnabled();
    await expect(diagnostic.getByRole("button", { name: "Assignment 원본", exact: true })).toBeDisabled();
    await diagnostic.locator("summary").click();
    if (width === 1440) {
      const taskSource = diagnostic.getByRole("button", { name: "Task 원본", exact: true });
      await taskSource.click();
      const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
      await expect(editor).toBeVisible();
      await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Stable leaf");
      await expect(editor.getByLabel("작업명", { exact: true })).not.toBeEditable();
      await page.keyboard.press("Escape");
      await expect(editor).toBeHidden();
      await expect(taskSource).toBeFocused();

    }
    const tables = view.getByRole("tabpanel", { name: /^공정별 현황/ }).locator("table");
    expect(await tables.count()).toBeGreaterThan(0);
    const geometry = await tables.evaluateAll(nodes => nodes.map(table => ({
      columns: table.querySelectorAll("thead th").length,
      rowColumns: Array.from(table.querySelectorAll("tbody tr")).map(row => row.children.length),
      tableWidth: table.getBoundingClientRect().width,
      scrollWidth: table.parentElement!.scrollWidth,
      scrollOwnerWidth: table.parentElement!.clientWidth,
    })));
    for (const table of geometry) {
      expect(table.columns).toBeGreaterThan(0);
      expect(table.columns).toBeLessThanOrEqual(7);
      expect(table.rowColumns.every(columns => columns === table.columns)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await mkdir("output/playwright/issue-731", { recursive: true });
    await page.screenshot({ path: `output/playwright/issue-731/diagnostic-${width}.png` });
    await testInfo.attach(`integrated-kpi-column-budget-${width}`, { body: JSON.stringify(geometry), contentType: "application/json" });
    await page.keyboard.press("Escape");
    await expect(allocation).toBeFocused();
    await expect(configuration.getByRole("heading", { name: /개인 투입률 미설정/ })).toHaveCount(0);
    await allocation.press("Enter");
    const beforeOutbound = snapshotReads.length;
    await configuration.getByRole("button", { name: /일정.*보기/ }).click();
    await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
    const frame = page.locator(".project-gantt-frame");
    await expect(frame.locator('.wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000003"]')).toBeVisible();
    await expect(frame.locator('.wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000002"]')).toHaveCount(0);
    const strip = page.getByRole("region", { name: "임시 조회 범위", exact: true });
    await expect(strip).toContainText("통합 KPI 출발");
    await strip.locator("summary").click();
    await expect(strip.getByRole("textbox", { name: "출발 KPI snapshot", exact: true })).toHaveValue("integrated-ui-snapshot");
    expect(snapshotReads.length).toBeGreaterThan(beforeOutbound);
    const beforeReturn = snapshotReads.length;
    await strip.getByRole("button", { name: /원래 보기/ }).click();
    await expect.poll(() => snapshotReads.length).toBeGreaterThan(beforeReturn);
    expect(snapshotReads.every(snapshot => snapshot === "integrated-ui-snapshot")).toBe(true);
    await expect(configuration.getByRole("heading", { name: /개인 투입률 미설정/ })).toBeVisible();
    await expect(configuration.getByRole("button", { name: /일정.*보기/ })).toBeFocused();
    await expectSameGanttRoot(page, gantt);
    expect(requests).toEqual([]);
    expect(state.project.revision).toBe(40);
  });
}

test("#731 등록 구성과 연결 작업이 모두 없는 KPI는 0과 빈 진단을 유지한다", async ({ page }) => {
  const state = await installStatefulProjectFixture(page); state.sessionEditable = false;
  await page.route(dashboardPath, route => {
    const value = dashboard(route);
    Object.assign(value, { includedTaskIds: [], includedMilestoneIds: [], breakdowns: { processes: [], equipment: [], systems: [] } });
    Object.assign(value.kpi, { taskCount: 0, totalDuration: 0, progressPercent: null });
    Object.assign(value.effort, { plannedMd: 0 });
    value.integrated.effortState = "empty";
    return route.fulfill({ json: toResourcePublicV2({ data: withIntegratedKpi(value) }) });
  });
  const view = await openDashboard(page);
  await expect(view.getByRole("tablist", { name: "물류 세부 현황" })).toBeVisible();
  const configuration = view.getByTestId("logistics-kpi-configuration");
  await configuration.locator("summary").click();
  await expect(configuration).toContainText("등록 공정");
  await expect(configuration).toContainText("등록 WorkArea");
  await expect(configuration).toContainText("등록 리소스");
  await expect(view.getByRole("tabpanel", { name: /^공정별 현황/ })).toContainText("등록된 공정이 없습니다.");
  await configuration.getByRole("button", { name: /개인 투입률 미설정/ }).click();
  await expect(configuration).toContainText("해당 항목이 없습니다.");
  await expect(configuration.getByRole("button", { name: /일정.*보기/ })).toBeDisabled();
});

test("#731 원본 이동 직전 snapshot 변경은 진단과 Task·Assignment 이동을 차단한다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  let stale = false;
  await page.route(dashboardPath, route => {
    const value = diagnosticDashboard(route);
    if (stale) value.integrated.snapshotId = "changed-integrated-snapshot";
    return route.fulfill({ json: toResourcePublicV2({ data: value }) });
  });
  const view = await openDashboard(page);
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  const configuration = view.getByTestId("logistics-kpi-configuration");
  await configuration.locator("summary").click();
  await configuration.getByRole("button", { name: /개인 투입률 미설정/ }).click();
  stale = true;
  await configuration.getByRole("button", { name: "Assignment 원본", exact: true }).click();
  await expect(view.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "작업 정보", exact: true })).toHaveCount(0);
  await expect(view.getByTestId("logistics-kpi-configuration")).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "대시보드 보기" }).getByRole("tab", { name: "KPI", exact: true })).toHaveAttribute("aria-selected", "true");
  stale = false;
  await view.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
});

test("#731 편집 가능 Task·Assignment 원본 열기와 취소는 정확 ID·조건·진단·초점을 보존한다", async ({ page }) => {
  const state = await installStatefulProjectFixture(page);
  const writes: string[] = [];
  page.on("request", request => { if (["PATCH", "PUT", "DELETE"].includes(request.method())) writes.push(request.url()); });
  const targets = [{ kind: "resource", id: "resource-1", name: "테스트 리소스", code: "R-01", active: true, roles: ["DEVELOPER"] }];
  await page.route(`**${projectPath}/assignment-targets`, route => route.fulfill({ json: { data: { catalogRevision: 1, targets } } }));
  await page.route(`**${projectPath}/assigned-targets`, route => route.fulfill({ json: { data: { projectRevision: 40, catalogRevision: 1, targets,
    assignments: [{ id: "assignment-1", taskId: state.tasks[2].taskId, target: { kind: "resource", id: "resource-1" }, allocation: null }],
  } } }));
  await page.route(dashboardPath, route => route.fulfill({ json: toResourcePublicV2({ data: diagnosticDashboard(route) }) }));
  const view = await openDashboard(page);
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  await view.getByLabel("기준일 (As of)").fill("2026-10-01");
  const configuration = view.getByTestId("logistics-kpi-configuration");
  await configuration.locator("summary").click();
  await configuration.getByRole("button", { name: /개인 투입률 미설정/ }).click();
  const taskSource = configuration.getByRole("button", { name: "Task 원본", exact: true });
  await taskSource.click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Stable leaf");
  await expect(editor.getByLabel("작업명", { exact: true })).toBeEditable();
  await page.keyboard.press("Escape"); await expect(editor).toBeHidden(); await expect(taskSource).toBeFocused();
  const assignmentSource = configuration.getByRole("button", { name: "Assignment 원본", exact: true });
  await assignmentSource.click();
  await expect(editor.getByRole("tab", { name: /리소스/ })).toHaveAttribute("aria-selected", "true");
  await expect(editor).toContainText("테스트 리소스");
  await expect(editor.getByRole("checkbox", { name: /테스트 리소스/ })).toBeChecked();
  await page.keyboard.press("Escape"); await expect(editor).toBeHidden(); await expect(assignmentSource).toBeFocused();
  await expect(view.getByLabel("기준일 (As of)")).toHaveValue("2026-10-01");
  await expect(configuration.getByRole("heading", { name: /개인 투입률 미설정/ })).toBeVisible();
  expect(state.project.revision).toBe(40); expect(writes).toEqual([]);
});

test("#731 등록 리소스 원본은 정확한 이름·ID를 유지하고 KPI 진단으로 복귀한다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  await page.route(`**${projectPath}/resource-memberships?*`, route => route.fulfill({ json: { data: {
    projectRevision: 40, catalogRevision: 1, total: 1, offset: 0, limit: 50,
    counts: { registered: 1, assigned: 1, roleOnly: 0, inactive: 0 }, groups: [],
    resources: [{ id: "resource-1", name: "테스트 리소스", code: "R-01", description: "", active: true, roles: ["DEVELOPER"], developerGrade: "ADVANCED", groups: [], registered: true,
      sources: { membership: true, taskAssignments: true, responsibilityAssignments: false, equipmentRoles: false, systemRoles: false },
      usage: { taskAssignments: 1, responsibilityAssignments: 0, equipmentRoles: 0, systemRoles: 0 } }],
  } } }));
  await page.route(dashboardPath, route => route.fulfill({ json: toResourcePublicV2({ data: diagnosticDashboard(route) }) }));
  const view = await openDashboard(page);
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  const configuration = view.getByTestId("logistics-kpi-configuration");
  await configuration.locator("summary").click();
  await configuration.getByRole("button", { name: /등록 리소스/ }).click();
  const original = configuration.getByRole("button", { name: "원본 구성 보기", exact: true });
  await original.click();
  const source = page.getByRole("complementary", { name: "KPI에서 선택한 리소스", exact: true });
  await expect(source).toContainText("테스트 리소스");
  await source.locator("summary").click();
  await expect(source.getByRole("textbox", { name: "리소스 ID", exact: true })).toHaveValue("resource-1");
  await source.getByRole("button", { name: "KPI로 돌아가기", exact: true }).click();
  await expect(configuration.getByRole("heading", { name: /등록 리소스/ })).toBeVisible();
  await expect(original).toBeFocused();
});

test("#731 공정·WorkArea 원본 이동은 정확한 공정 행과 KPI 출발 초점을 복원한다", async ({ page }) => {
  const state = await installStatefulProjectFixture(page);
  state.logistics = { processes: [{ id: "proc-1", code: "PROC-01", name: "입고 공정", parentProcessId: null, sortOrder: 0, active: true, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" }], equipment: [], systems: [], systemLinks: [] };
  await page.route(dashboardPath, route => route.fulfill({ json: toResourcePublicV2({ data: diagnosticDashboard(route) }) }));
  const view = await openDashboard(page);
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  const configuration = view.getByTestId("logistics-kpi-configuration");
  await configuration.locator("summary").click();
  for (const label of ["등록 공정", "등록 WorkArea"]) {
    await configuration.getByRole("button", { name: new RegExp(label) }).click();
    const original = configuration.getByRole("button", { name: /원본 구성 보기/ });
    await original.click();
    const process = page.locator('[id="logistics-master-process-proc-1"]');
    await expect(process).toBeVisible();
    await expect(process).toHaveAttribute("tabindex", "-1");
    await expect(process).toBeFocused();
    // The parent WorkspaceScreen commits asynchronously. A late rAF must not
    // drop the exact row focus after navigation settles or steal later input.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(process).toBeFocused();
    await expect(process).toContainText("입고 공정");
    const back = page.getByRole("button", { name: "KPI로 돌아가기", exact: true });
    await back.focus();
    await expect(back).toBeFocused();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(back).toBeFocused();
    await back.click();
    await expect(configuration.getByRole("heading", { name: new RegExp(label) })).toBeVisible();
    await expect(original).toBeFocused();
  }
});


for (const destination of ["KPI로 돌아가기", "물류 항목 검색"] as const) {
  test(`#731 패널 외부에 새 초점이 생기면 원본 포커스 재시도를 취소한다 — ${destination}`, async ({ page }) => {
    const state = await installStatefulProjectFixture(page);
    state.logistics = { processes: [{ id: "proc-1", code: "PROC-01", name: "입고 공정", parentProcessId: null, sortOrder: 0, active: true, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" }], equipment: [], systems: [], systemLinks: [] };
    await page.route(dashboardPath, route => route.fulfill({ json: toResourcePublicV2({ data: diagnosticDashboard(route) }) }));
    const view = await openDashboard(page);
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
    const configuration = view.getByTestId("logistics-kpi-configuration");
    await configuration.locator("summary").click();
    await configuration.getByRole("button", { name: /등록 공정/ }).click();
    const original = configuration.getByRole("button", { name: "원본 구성 보기", exact: true });

    // Keep the precise row temporarily un-focusable. During React's commit,
    // immediately focus the user's newly chosen sibling control before the
    // queued row-focus rAF. No network/DB response is mocked as success here.
    await page.evaluate((chosen) => {
      const blocker = document.createElement("style");
      blocker.textContent = '[id="logistics-master-process-proc-1"] { display: none !important; }';
      document.head.append(blocker);
      const observer = new MutationObserver(() => {
        const host = document.querySelector(".project-logistics-panel");
        const candidate = chosen === "KPI로 돌아가기"
          ? Array.from(host?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(button => button.textContent?.trim() === chosen)
          : host?.querySelector<HTMLInputElement>('input[aria-label="물류 항목 검색"]');
        if (!candidate?.isConnected || !candidate.getClientRects().length || candidate.closest("[hidden], [inert]")) return;
        candidate.focus({ preventScroll: true });
        if (document.activeElement !== candidate) return;
        blocker.remove();
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    }, destination);
    await original.click();

    const chosen = destination === "KPI로 돌아가기"
      ? page.getByRole("button", { name: "KPI로 돌아가기", exact: true })
      : page.getByRole("searchbox", { name: "물류 항목 검색", exact: true });
    const row = page.locator('[id="logistics-master-process-proc-1"]');
    await expect(row).toBeVisible();
    await expect(chosen).toBeFocused();
    // Previously only focus within #panel-processes cancelled the retry.
    // Both controls are siblings of that panel, not descendants.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(chosen).toBeFocused();
    await expect(row).not.toBeFocused();
    await expect(row).toContainText("입고 공정");
    await page.getByRole("button", { name: "KPI로 돌아가기", exact: true }).click();
    await expect(original).toBeFocused();
    expect(state.project.revision).toBe(40);
  });
}
