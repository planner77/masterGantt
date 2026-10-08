import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installStatefulProjectFixture, publicId, projectPath, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";
import { milestoneUiFixture, childrenUiFixture } from "../fixtures/resource-milestone-ui";
import { longResourceDashboardDetailUiFixture } from "../fixtures/resource-dashboard-ui";
const root = (page: import("@playwright/test").Page) => page.locator('[data-resource-dashboard="true"]');
const ganttState = (page: import("@playwright/test").Page) => page.locator(".project-gantt-frame").evaluate(element => ({ public: Reflect.get(element, "__masterganttPublicViewport"), dom: { left: element.querySelector(".wx-chart")!.scrollLeft, top: element.querySelector(".wx-gantt")!.scrollTop }, columns: Array.from(element.querySelectorAll(".wx-header .wx-cell")).map(c => c.getBoundingClientRect().width), selection: Array.from(element.querySelectorAll(".wx-row.wx-selected")).map(row => row.getAttribute("data-id")), tree: Array.from(element.querySelectorAll(".wx-row")).map(row => row.getAttribute("data-id")) }));
async function setup(page: import("@playwright/test").Page, manyGroups = false) {
  const reportFixture = (state: Parameters<typeof milestoneUiFixture>[0], query: URLSearchParams) => { const data = milestoneUiFixture(state, query); if (manyGroups) for (let i = 12; i < 62; i++) { const original = data.groups[0], id = `00005262-0000-4000-8000-${String(i).padStart(12, "0")}`; data.groups.push({ ...original, id, name: `페이징 그룹 ${i}`, summary: { ...original.summary, selector: { ...original.summary.selector, id } } }); data.catalog.groups.push({ ...data.catalog.groups[0], id, name: `페이징 그룹 ${i}` }); } return data; };
  const state = await installStatefulProjectFixture(page); for (let i = 10; i < 45; i++) state.tasks.push({ ...state.tasks[2], taskId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, externalId: `MORE-${i}`, name: `작업면 보존 ${i}`, siblingOrder: i });
  await page.route(`**${projectPath}/resource-dashboard?*`, route => route.fulfill({ json: { data: reportFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.route(`**${projectPath}/resource-dashboard/group-children?*`, route => { const q = new URL(route.request().url()).searchParams, filters = new URLSearchParams(q); for (const k of ["groupId", "milestoneTaskId", "snapshotId", "offset", "limit"]) filters.delete(k); return route.fulfill({ json: { data: childrenUiFixture(reportFixture(state, filters), q) } }); });
  await page.route(`**${projectPath}/resource-dashboard/details?*`, route => route.fulfill({ json: { data: longResourceDashboardDetailUiFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  await page.getByRole("button", { name: "주", exact: true }).click();
  const frame = page.locator(".project-gantt-frame");
  await frame.locator('.wx-row[data-id=":00000000-0000-4000-8000-000000000003"]').first().click();
  const chart = frame.locator(".wx-chart");
  const gantt = frame.locator(".wx-gantt");
  // Selecting a task can schedule a native scroll-to-task after the click.
  // Establish the intended fixture viewport only when both DOM and the Core
  // public viewport agree after animation frames; do not weaken the subsequent
  // Schedule -> Resource -> Schedule state-preservation assertion.
  await expect(async () => {
    await gantt.evaluate(el => { el.scrollTop = 96; });
    await chart.evaluate(el => { el.scrollLeft = 120; });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const current = await ganttState(page);
    expect(current.dom).toEqual({ left: 120, top: 96 });
    expect(current.public).toEqual({ left: 120, top: 96 });
  }).toPass({ timeout: 10_000, intervals: [100, 250, 500] });
  const before = await ganttState(page);
  expect(before.columns.length).toBeGreaterThan(0);
  expect(before.selection.length).toBeGreaterThan(0);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ready", "true");
  return { state, identity, before };
}
test("#526 populated Group/Resource matrix 5폭·bounded cells·순서·단위·focus·Gantt", async ({ page }) => {
  test.setTimeout(120_000); const { identity, before } = await setup(page); const r = root(page); await r.getByLabel("리소스 보기", { exact: true }).selectOption("matrix"); const evidence = []; mkdirSync("output/playwright/issue-526", { recursive: true });
  for (const mode of ["group", "resource"] as const) {
    await r.getByRole("button", { name: mode === "group" ? "그룹" : "개인", exact: true }).click();
    const region = r.getByRole("region", { name: `${mode === "group" ? "그룹" : "개인"} Milestone 비교표`, exact: true }), table = region.locator("table");
    await expect(table.locator("tbody tr")).toHaveCount(mode === "group" ? 12 : 40);
    await expect(table.locator("thead th")).toHaveCount(8); expect(await table.locator("tbody button").count()).toBeLessThanOrEqual(350);
    const first = table.locator("tbody button").first(); await first.focus(); await first.press("Enter"); await expect(r.locator(".resource-dashboard-selected h3")).toBeFocused(); await expect(r.locator(".resource-dashboard-selected h3")).toContainText("계획 공수"); await expect(r.locator(".resource-dashboard-selected .resource-dashboard-detail-table tbody tr")).toHaveCount(50); await r.locator(".resource-dashboard-selected h3").press("Escape"); await expect(first).toBeFocused();
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await table.evaluate(el => {
        const headers = Array.from(el.querySelectorAll(":scope > thead > tr > th")).map(c => c.getBoundingClientRect()); const rows = Array.from(el.querySelectorAll(":scope > tbody > tr")); const owner = el.closest(".resource-dashboard-table-scroll")!;
        const usableRows = rows.filter(row => { const b = row.getBoundingClientRect(), o = owner.getBoundingClientRect(); return b.top >= headers[0].bottom && b.bottom <= o.bottom; }).length;
        const controls = Array.from(document.querySelectorAll('[data-resource-dashboard="true"] .resource-dashboard-toolbar button,[data-resource-dashboard="true"] .resource-dashboard-view-controls select,[data-resource-dashboard="true"] .resource-dashboard-filters select,[data-resource-dashboard="true"] .resource-dashboard-filters input')).filter(c => !c.closest('[hidden]') && c.getBoundingClientRect().width).map(c => c.getBoundingClientRect());
        return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, populatedRows: rows.length, columns: headers.length, usableRows, headerHeight: headers[0].height, maxRowHeight: Math.max(...rows.map(row => row.getBoundingClientRect().height)), metricButtons: el.querySelectorAll("tbody button").length, headerWidths: headers.map(h => h.width), aligned: rows.every(row => Array.from(row.children).every((c, i) => Math.abs(c.getBoundingClientRect().left - headers[i].left) < 1 && Math.abs(c.getBoundingClientRect().width - headers[i].width) < 1)), nonoverlap: rows.every(row => Array.from(row.children).every((c, i, a) => i === 0 || a[i - 1].getBoundingClientRect().right <= c.getBoundingClientRect().left + 1)), contained: Array.from(el.querySelectorAll("button")).every(c => { const b = c.getBoundingClientRect(), cell = c.closest("td,th")!.getBoundingClientRect(); return b.left >= cell.left && b.right <= cell.right && b.top >= cell.top && b.bottom <= cell.bottom; }), controlsInViewport: controls.filter(c => c.top < 500).every(c => c.left >= 0 && c.right <= innerWidth), ownerClientWidth: owner.clientWidth, ownerScrollWidth: owner.scrollWidth, maxIdentityChars: Math.max(...rows.map(row => row.children[0].textContent!.length)) };
      }); expect(result.documentWidth).toBe(width); expect(result.headerHeight).toBeLessThanOrEqual(88); expect(result.maxRowHeight).toBeLessThanOrEqual(104); expect(result.usableRows).toBeGreaterThanOrEqual(3); expect(result.aligned && result.nonoverlap && result.contained && result.controlsInViewport).toBe(true); expect(result.headerWidths[0]).toBeGreaterThanOrEqual(264); expect(result.headerWidths.slice(1).every(w => w >= 144)).toBe(true); expect(result.maxIdentityChars).toBeGreaterThan(150); if (width === 390) expect(result.ownerScrollWidth).toBeGreaterThan(result.ownerClientWidth); evidence.push({ mode, ...result }); await page.screenshot({ path: `output/playwright/issue-526/matrix-${mode}-${width}.png` });
    }
    const matrix = r.getByRole("region", { name: "Milestone 비교표", exact: true }); await matrix.getByRole("button", { name: "단계 다음", exact: true }).click(); await expect(table.locator("thead th").nth(1)).toContainText("단계 6"); await matrix.getByRole("button", { name: "단계 다음", exact: true }).click(); await expect(table.locator("thead th")).toHaveCount(4); await expect(table.locator("thead th").nth(2)).toContainText("Milestone 미지정"); await matrix.getByRole("button", { name: "단계 이전", exact: true }).click(); await matrix.getByRole("button", { name: "단계 이전", exact: true }).click();
  }
  writeFileSync("output/playwright/issue-526/matrix-geometry.json", JSON.stringify(evidence, null, 2)); await page.setViewportSize({ width: 1440, height: 900 }); await page.getByRole("tab", { name: "일정", exact: true }).click(); await expectSameGanttRoot(page, identity); await expect.poll(() => ganttState(page)).toEqual(before);
});
async function observeTree(page: import("@playwright/test").Page, tree: import("@playwright/test").Locator, path: string) {
  const observations = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const value = await tree.evaluate(el => { const expanded = el.querySelectorAll('[aria-expanded="true"]').length, summaries = Array.from(el.querySelectorAll(".resource-milestone-summary")); const buttons = summaries.flatMap(s => Array.from(s.querySelectorAll("button"))); return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, expanded, summaries: summaries.length, buttons: buttons.length, contained: buttons.every(b => { const r = b.getBoundingClientRect(), p = b.parentElement!.getBoundingClientRect(); return r.left >= p.left && r.right <= p.right + 1; }), identityHeights: Array.from(el.querySelectorAll(".resource-milestone-identity")).map(n => n.getBoundingClientRect().height) }; });
    expect(value.documentWidth).toBe(width); expect(value.expanded).toBeLessThanOrEqual(12); expect(value.summaries).toBeGreaterThanOrEqual(path === "resource-milestone-task" ? 2 : 3); expect(value.contained).toBe(true); expect(value.identityHeights.every(h => h <= 40)).toBe(true); observations.push({ path, ...value });
  }
  return observations;
}
test("#526 three tree paths use server group intersection and retain stage page across collapse", async ({ page }) => {
  await setup(page); const evidence = []; const r = root(page); await r.getByLabel("리소스 보기", { exact: true }).selectOption("tree");
  const tree = r.getByRole("region", { name: "Milestone 계층 현황", exact: true });
  await tree.getByRole("button", { name: /^그룹 0/ }).click(); await tree.getByRole("button", { name: /^단계 0/ }).click(); await expect(tree.getByLabel("그룹 교차 개인 현황").getByRole("button", { name: /^개인/ })).toHaveCount(40); await tree.getByRole("button", { name: /^개인 0/ }).click(); await expect(tree.getByText(/선택 할당 작업 진척/).first()).toBeVisible(); await expect(tree.getByText(/선행 차단 있음/)).toBeVisible(); evidence.push(...await observeTree(page, tree, "group-milestone-resource"));
  await r.getByLabel("집계 순서", { exact: true }).selectOption("resource"); const tree2 = r.getByRole("region", { name: "Milestone 계층 현황", exact: true }); await tree2.getByRole("button", { name: /^그룹 0/ }).click(); await expect(tree2.getByRole("button", { name: /^개인/ })).toHaveCount(40); await tree2.getByRole("button", { name: /^개인 0/ }).click(); await tree2.getByRole("button", { name: "계층 단계 다음", exact: true }).click(); await expect(tree2.getByRole("button", { name: /^단계 6/ })).toBeVisible(); await tree2.getByRole("button", { name: /^개인 0/ }).click(); await tree2.getByRole("button", { name: /^개인 0/ }).click(); await expect(tree2.getByRole("button", { name: /^단계 6/ })).toBeVisible(); await tree2.getByRole("button", { name: /^단계 6/ }).click(); evidence.push(...await observeTree(page, tree2, "group-resource-milestone"));
  await r.getByRole("button", { name: "개인", exact: true }).click(); const tree3 = r.getByRole("region", { name: "Milestone 계층 현황", exact: true }); await tree3.getByRole("button", { name: /^개인 0/ }).click(); await tree3.getByRole("button", { name: /^단계 0/ }).click(); const s = tree3.locator(".resource-milestone-summary").last(); await s.getByRole("button", { name: "9 Task", exact: true }).click(); await expect(r.locator(".resource-dashboard-selected h3")).toBeFocused(); await r.locator(".resource-dashboard-selected h3").press("Escape"); evidence.push(...await observeTree(page, tree3, "resource-milestone-task")); writeFileSync("output/playwright/issue-526/tree-geometry.json", JSON.stringify(evidence, null, 2));
});

test("#526 retained expansions remain bounded after ancestor reopen and mode return", async ({ page }) => {
  await setup(page, true); const r = root(page); await r.getByLabel("리소스 보기", { exact: true }).selectOption("tree"); const tree = r.getByRole("region", { name: "Milestone 계층 현황", exact: true });
  await tree.getByRole("button", { name: /^그룹 0/ }).click(); await tree.getByRole("button", { name: /^단계 0/ }).click(); await expect(tree.getByLabel("그룹 교차 개인 현황").getByRole("button", { name: /^개인/ })).toHaveCount(40);
  for (let i = 0; i < 10; i++) await tree.getByRole("button", { name: new RegExp(`^개인 ${i} `) }).click();
  await expect(tree.locator('[aria-expanded="true"]')).toHaveCount(12); await expect(tree.getByRole("button", { name: /^개인 10 / })).toBeDisabled();
  await tree.getByRole("button", { name: /^그룹 0/ }).click(); await expect(tree.locator('[aria-expanded="true"]')).toHaveCount(0); await tree.getByRole("button", { name: /^그룹 0/ }).click(); await expect(tree.locator('[aria-expanded="true"]')).toHaveCount(12);
  await tree.getByRole("button", { name: "상위 행 다음", exact: true }).click(); await expect(tree.locator('[aria-expanded="true"]')).toHaveCount(0); await tree.getByRole("button", { name: "상위 행 이전", exact: true }).click(); await expect(tree.locator('[aria-expanded="true"]')).toHaveCount(12); await r.getByRole("button", { name: "개인", exact: true }).click(); await r.getByRole("button", { name: "그룹", exact: true }).click(); await expect(tree.locator('[aria-expanded="true"]')).toHaveCount(12);
  await tree.getByRole("button", { name: "계층 모두 접기", exact: true }).click(); await expect(tree.locator('[aria-expanded="true"]')).toHaveCount(0);
});

test("#526 canceled child409 does not stale the current report and hidden detail trigger falls back", async ({ page }) => {
  await setup(page); const r = root(page); await r.getByLabel("리소스 보기", { exact: true }).selectOption("tree");
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; }); let entered!: () => void; const requested = new Promise<void>(resolve => { entered = resolve; });
  await page.route(`**${projectPath}/resource-dashboard/group-children?*`, async route => { entered(); await held; await route.fulfill({ status: 409, json: { error: { code: "RESOURCE_DASHBOARD_SNAPSHOT_STALE" } } }).catch(() => undefined); });
  const tree = r.getByRole("region", { name: "Milestone 계층 현황", exact: true }); await tree.getByRole("button", { name: /^그룹 0/ }).click(); await tree.getByRole("button", { name: /^단계 0/ }).click(); await requested;
  await r.getByRole("button", { name: "개인", exact: true }).click(); release(); await page.waitForTimeout(100); await expect(r).toHaveAttribute("data-ready", "true");
  await r.getByLabel("리소스 보기", { exact: true }).selectOption("matrix"); const table = r.getByRole("region", { name: "개인 Milestone 비교표", exact: true }); await table.locator("tbody button").first().click(); await expect(r.locator(".resource-dashboard-selected h3")).toBeFocused(); await r.getByLabel("리소스 보기", { exact: true }).selectOption("summary"); await r.getByRole("button", { name: "상세 닫기" }).click(); await expect(r.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" })).toBeFocused();
});

test("#526 matrix metric grain, missing versus configured zero and unknown completion remain explicit", async ({ page }) => {
  const { state } = await setup(page);
  await page.route(`**${projectPath}/resource-dashboard?*`, route => { const data = milestoneUiFixture(state, new URL(route.request().url()).searchParams); data.resources[0].milestones[0].summary.completion.percent = null; return route.fulfill({ json: { data } }); });
  const r = root(page); await r.getByRole("button", { name: "새로고침", exact: true }).click(); await expect(r).toHaveAttribute("data-ready", "true"); await r.getByLabel("리소스 보기", { exact: true }).selectOption("matrix"); await r.getByRole("button", { name: "개인", exact: true }).click(); const table = r.getByRole("region", { name: "개인 Milestone 비교표", exact: true }).locator("table");
  await expect(table.locator("tbody tr").nth(1).locator("td").first()).toHaveText("대상 없음"); await expect(table.locator("tbody tr").nth(1).locator("td").first().locator("button")).toHaveCount(0); await expect(table.locator("tbody tr").nth(2).locator("td").first().locator("button")).toHaveText("0.00 M/D");
  const matrix = r.getByRole("region", { name: "Milestone 비교표", exact: true }); await matrix.getByLabel("셀 지표").selectOption("completion"); const first = table.locator("tbody tr").first().locator("td").first().locator("button"); await expect(first).toHaveText("완료율 미산정"); const taskResponse = page.waitForRequest(request => request.url().includes("/resource-dashboard/details?")); await first.press("Enter"); expect(new URL((await taskResponse).url()).searchParams.get("view")).toBe("tasks"); await r.locator(".resource-dashboard-selected h3").press("Escape"); await expect(first).toBeFocused();
  await matrix.getByLabel("셀 지표").selectOption("delayed"); const delayed = page.waitForRequest(request => request.url().includes("/resource-dashboard/details?")); await first.click(); const query = new URL((await delayed).url()).searchParams; expect(query.get("view")).toBe("tasks"); expect(query.get("metric")).toBe("delayed");
});
