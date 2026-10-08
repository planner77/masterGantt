import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { deferred, expectSameGanttRoot, installStatefulProjectFixture, publicId, projectPath, rememberGanttRoot } from "../fixtures/stateful-project";
import { dashboardFixture } from "../fixtures/milestone-dashboard";
import { resourceDashboardUiFixture, resourceDashboardDetailUiFixture, longResourceDashboardUiFixture, longResourceDashboardDetailUiFixture, LONG_DASHBOARD_COUNTS } from "../fixtures/resource-dashboard-ui";
const path = `**${projectPath}/resource-dashboard?*`;
const panel = (page: import("@playwright/test").Page) => page.locator('[data-resource-dashboard="true"]');
async function open(page: import("@playwright/test").Page) { await page.goto(`/projects/${publicId}`); await page.getByRole("tab", { name: "리소스", exact: true }).click(); await expect(panel(page).getByRole("heading", { name: "리소스 공수" })).toBeVisible(); }
async function ready(page: import("@playwright/test").Page) { await expect(panel(page)).toHaveAttribute("data-ready", "true"); }

test("#525 첫 실패·atomic catalog 오류는 입력을 보존하며 개별 상세 실패도 재시도한다", async ({ page }) => {
  await installStatefulProjectFixture(page); let fail = true, failDetail = true;
  await page.route(path, (route) => fail ? route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } }) : route.fallback());
  await page.route(`**${projectPath}/resource-dashboard/details?*`, (route) => failDetail ? route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } }) : route.fallback());
  await open(page); await expect(panel(page).getByRole("alert")).toContainText("불러오지 못했습니다");
  await expect(panel(page).getByText("검색 조건에 일치하는 리소스 할당이 없습니다.")).toHaveCount(0);
  const search = panel(page).getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" }); await search.fill("R-01"); fail = false;
  await panel(page).getByRole("button", { name: "공수 다시 시도" }).click(); await ready(page); await expect(search).toHaveValue("R-01");
  await panel(page).getByRole("button", { name: "개인", exact: true }).click(); await panel(page).getByRole("button", { name: /테스트 리소스 \(R-01\)/ }).click();
  await expect(panel(page).getByRole("alert")).toContainText("불러오지 못했습니다"); failDetail = false; await panel(page).getByRole("button", { name: "상세 다시 시도" }).click(); await expect(panel(page).getByText("Stable leaf", { exact: true })).toBeVisible();
});

test("#525 네트워크 실패·malformed200·조건 echo mismatch를 성공으로 표시하지 않는다", async ({ page }) => {
  const state = await installStatefulProjectFixture(page); let failure: "network" | "malformed" | "echo" | "pass" = "network";
  await page.route(path, (route) => { if (failure === "network") return route.abort("failed"); const data = resourceDashboardUiFixture(state, new URL(route.request().url()).searchParams); if (failure === "malformed") Reflect.deleteProperty(data.resources[0].summary, "taskCount"); if (failure === "echo") data.filters.search = "wrong"; return route.fulfill({ json: { data } }); });
  await open(page); await expect(panel(page).getByRole("alert")).toBeVisible(); failure = "pass"; await panel(page).getByRole("button", { name: "공수 다시 시도" }).click(); await ready(page);
  for (const mode of ["malformed", "echo"] as const) { failure = mode; await panel(page).getByRole("button", { name: "새로고침", exact: true }).click(); await expect(panel(page)).toHaveAttribute("data-ready", "false"); await expect(panel(page).getByRole("alert")).toContainText("이전 성공 결과"); await expect(panel(page).getByText("5.00 M/D", { exact: true }).first()).toBeVisible(); await expect(panel(page).getByRole("button", { name: "개발팀 (G-01)" })).toBeDisabled(); }
  failure = "pass"; await panel(page).getByRole("button", { name: "공수 다시 시도" }).click(); await ready(page);
});

test("#525 stale 결과·검색·기간·활성·단위·열린 행을 보존하고 역전 응답은 버린다", async ({ page }) => {
  const state = await installStatefulProjectFixture(page); const gate = deferred(), started = deferred(); let fail = false;
  await page.route(path, async (route) => { const query = new URL(route.request().url()).searchParams; if (query.get("search") === "older") { started.resolve(); await gate.promise; } if (fail) return route.fulfill({ status: 500, json: { error: { code: "FAIL" } } }); return route.fulfill({ json: { data: resourceDashboardUiFixture(state, query) } }); });
  await open(page); await ready(page); const root = panel(page), search = root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" });
  await root.getByRole("button", { name: "M/M", exact: true }).click(); await root.getByRole("button", { name: "개발팀 (G-01)" }).click();
  const filter = root.getByRole("button", { name: /^필터/ }); await filter.click(); await root.getByLabel("개인 활성 상태", { exact: true }).selectOption("active"); await ready(page); await root.getByLabel("기간 시작", { exact: true }).fill("2026-09-16"); await ready(page); await root.getByLabel("기간 종료", { exact: true }).fill("2026-09-18"); await ready(page);
  await search.fill("older"); await started.promise; await expect(root).toHaveAttribute("data-ready", "false"); await search.fill("R-01"); await ready(page); gate.resolve(); await expect(search).toHaveValue("R-01"); await expect(root.getByText("0.25 M/M", { exact: true }).first()).toBeVisible();
  fail = true; await search.fill("G-01"); await expect(root.getByRole("alert")).toContainText("이전 성공 결과"); await expect(root.getByLabel("개인 활성 상태")).toHaveValue("active"); await expect(root.getByLabel("기간 시작")).toHaveValue("2026-09-16"); await expect(search).toHaveValue("G-01"); fail = false; await root.getByRole("button", { name: "공수 다시 시도" }).click(); await ready(page);
  await root.getByRole("button", { name: "개발팀 (G-01)" }).click(); await root.getByRole("button", { name: /테스트 리소스 \(R-01\)/ }).click(); await expect(root.getByText("Stable leaf", { exact: true })).toBeVisible();
});

test("#525 중복 새로고침·hidden polling 방지와 focus catch-up 및 revision 복구", async ({ page }) => {
  const state = await installStatefulProjectFixture(page); const gate = deferred(), started = deferred(); let hold = false, calls = 0, ahead = false;
  await page.route(path, async (route) => { calls++; if (hold) { started.resolve(); await gate.promise; } const data = resourceDashboardUiFixture(state, new URL(route.request().url()).searchParams); if (ahead) data.projectRevision++; return route.fulfill({ json: { data } }); });
  await page.goto(`/projects/${publicId}`); expect(calls).toBe(0); await page.getByRole("tab", { name: "리소스", exact: true }).click(); await ready(page); hold = true; await panel(page).getByRole("button", { name: "새로고침", exact: true }).click(); await started.promise; await expect(panel(page).getByRole("button", { name: "조회 중…" })).toBeDisabled(); hold = false; gate.resolve(); await ready(page);
  await page.getByRole("tab", { name: "일정", exact: true }).click(); const hiddenCalls = calls; await page.evaluate(() => window.dispatchEvent(new Event("focus"))); expect(calls).toBe(hiddenCalls); await page.getByRole("tab", { name: "리소스", exact: true }).click(); await ready(page); const before = calls; await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect.poll(() => calls).toBe(before + 1); await ready(page);
  ahead = true; await panel(page).getByRole("button", { name: "새로고침", exact: true }).click(); await expect(panel(page)).toHaveAttribute("data-ready", "false"); await expect(panel(page).getByRole("alert")).toContainText("데이터가 변경"); state.project.revision++; ahead = false; await panel(page).getByRole("button", { name: "최신 일정 조회" }).click(); await ready(page);
});

test("#525 snapshot409·선택삭제400·한도422는 잠금과 명시 복구·focus를 제공한다", async ({ page }) => {
  await installStatefulProjectFixture(page); let detailStale = true, code = "";
  await page.route(`**${projectPath}/resource-dashboard/details?*`, (route) => detailStale ? route.fulfill({ status: 409, json: { error: { code: "REPORT_STALE" } } }) : route.fallback());
  await page.route(path, (route) => code ? route.fulfill({ status: code === "REPORT_LIMIT_EXCEEDED" ? 422 : 400, json: { error: { code } } }) : route.fallback());
  await open(page); await ready(page); const root = panel(page), kpi = root.getByLabel("선택 범위 KPI").getByRole("button", { name: "1건", exact: true }); await kpi.click(); await expect(root.getByRole("heading", { name: "선택 범위 할당 Task" })).toBeFocused(); await expect(root).toHaveAttribute("data-ready", "false"); await root.getByRole("heading", { name: "선택 범위 할당 Task" }).press("Escape"); await expect(root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" })).toBeFocused(); detailStale = false; await root.getByRole("button", { name: "새로고침", exact: true }).click(); await ready(page); await expect(root.getByRole("heading", { name: "선택 범위 할당 Task" })).toHaveCount(0); await kpi.click(); await expect(root.getByText("Stable leaf", { exact: true })).toBeVisible(); await root.getByRole("button", { name: "상세 닫기" }).click(); await expect(kpi).toBeFocused();
  for (const failure of ["INVALID_SELECTION", "REPORT_LIMIT_EXCEEDED"]) { code = failure; await root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" }).fill(failure); await expect(root.getByRole("alert")).toContainText(failure === "INVALID_SELECTION" ? "선택 항목" : "조회 한도"); await expect(root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" })).toHaveValue(failure); }
  code = ""; await root.getByRole("button", { name: "초기화" }).click(); await ready(page); const start = root.getByLabel("기간 시작", { exact: true }); await start.fill("2026-09-16"); await ready(page); await root.getByLabel("기간 종료", { exact: true }).fill("2026-09-01"); await expect(root.getByRole("alert")).toContainText("날짜를 수정"); await expect(root).toHaveAttribute("data-ready", "false");
});

test("#525 개발 견적·단위·필터 keyboard 및 5폭 geometry와 Gantt 실제 상태를 보존한다", async ({ page }, testInfo) => {
  const state = await installStatefulProjectFixture(page); for (let i = 10; i < 45; i++) state.tasks.push({ ...state.tasks[2], taskId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, externalId: `MORE-${i}`, name: `긴 한국어·English 작업명 ${i}`, siblingOrder: i });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(`/projects/${publicId}`); const identity = await rememberGanttRoot(page); await page.getByRole("button", { name: "주", exact: true }).click();
  const frame = page.locator(".project-gantt-frame"), viewport = () => frame.evaluate((element) => ({ public: Reflect.get(element, "__masterganttPublicViewport"), dom: { left: element.querySelector(".wx-chart")!.scrollLeft, top: element.querySelector(".wx-gantt")!.scrollTop }, columns: Array.from(element.querySelectorAll(".wx-header .wx-cell")).map((cell) => cell.getBoundingClientRect().width), selection: Array.from(element.querySelectorAll(".wx-row.wx-selected")).map((row) => row.getAttribute("data-id")) }));
  const summaryToggle = frame.locator('.wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000001"] [data-action="open-task"]');
  await summaryToggle.click(); await expect(frame.locator('.wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000002"]')).toHaveCount(0);
  await frame.locator('.wx-row[data-id=":00000000-0000-4000-8000-000000000003"]').first().click(); await frame.locator(".wx-gantt").evaluate((element) => { element.scrollTop = 96; }); await frame.locator(".wx-chart").evaluate((element) => { element.scrollLeft = 120; }); await expect.poll(async () => (await viewport()).dom).toEqual({ left: 120, top: 96 }); const before = await viewport(); expect(before.columns.length).toBeGreaterThan(0); expect(before.selection.length).toBeGreaterThan(0);
  await page.getByRole("tab", { name: "리소스", exact: true }).click(); await ready(page); const root = panel(page); await root.getByRole("button", { name: "개발 견적", exact: true }).click(); await ready(page); await expect(root.getByRole("button", { name: "개인", exact: true })).toHaveAttribute("aria-pressed", "true"); await root.getByRole("button", { name: /^필터/ }).click(); await expect(root.getByLabel("Global Role", { exact: true })).toHaveValue("DEVELOPER"); await root.getByLabel("개발자 등급").selectOption("ADVANCED"); await ready(page); await root.getByLabel("개발자 등급").press("Escape"); await expect(root.getByRole("button", { name: /^필터/ })).toBeFocused(); await root.getByRole("button", { name: /테스트 리소스 \(R-01\)/ }).click(); await expect(root.getByText("Stable leaf", { exact: true })).toBeVisible();
  const evidence = []; mkdirSync("output/playwright/issue-525", { recursive: true });
  for (const width of [390, 768, 1024, 1440, 1920]) { await page.setViewportSize({ width, height: 900 }); const result = await root.evaluate((element) => {
    const tables = Array.from(element.querySelectorAll("table")).filter((table) => table.getBoundingClientRect().height > 0).map((table) => { const owner = table.closest(".resource-dashboard-table-scroll")!; const head = table.querySelector("thead tr")!; const row = table.querySelector("tbody tr")!; const heads = Array.from(head.children).map((cell) => cell.getBoundingClientRect()); const cells = Array.from(row.children).map((cell) => cell.getBoundingClientRect()); return { widths: heads.map((head) => head.width), detailed: table.classList.contains("resource-dashboard-detail-table"), columns: heads.length, aligned: heads.every((cell, i) => Math.abs(cell.x - cells[i].x) < 1 && Math.abs(cell.width - cells[i].width) < 1), nonoverlap: cells.every((a, i) => cells.slice(i + 1).every((b) => a.right <= b.left + 1)), contained: Array.from(table.querySelectorAll("tbody button")).every((button) => { const b = button.getBoundingClientRect(), cell = button.closest("th,td")!.getBoundingClientRect(); return b.left >= cell.left && b.right <= cell.right && b.top >= cell.top && b.bottom <= cell.bottom; }), populatedRows: table.querySelectorAll("tbody strong").length, scrollWidth: owner.scrollWidth, clientWidth: owner.clientWidth }; });
    const controls = Array.from(element.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(".resource-dashboard-toolbar button, .resource-dashboard-filters button, .resource-dashboard-filters input, .resource-dashboard-filters select")).filter((control) => control.getBoundingClientRect().width > 0).map((control) => { const b = control.getBoundingClientRect(); return { x: b.x, right: b.right, y: b.y, bottom: b.bottom }; });
    return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, tables, controls, overlap: controls.some((a, i) => controls.slice(i + 1).some((b) => a.x < b.right - 1 && a.right > b.x + 1 && a.y < b.bottom - 1 && a.bottom > b.y + 1)) };
  }); expect(result.documentWidth).toBeLessThanOrEqual(width + 1); expect(result.tables.length).toBeGreaterThanOrEqual(2); for (const table of result.tables.filter((table) => table.detailed)) { expect(table.widths[3]).toBeGreaterThanOrEqual(207); expect(table.widths[4]).toBeGreaterThanOrEqual(207); } expect(result.tables.every((table) => table.aligned && table.nonoverlap && table.contained)).toBe(true); expect(result.overlap).toBe(false); expect(result.controls.every((control) => control.x >= 0 && control.right <= width + 1)).toBe(true); if (width === 390) expect(result.tables.some((table) => table.scrollWidth > table.clientWidth)).toBe(true); await root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" }).focus();
    const disclosure = root.getByRole("button", { name: /테스트 리소스 \(R-01\)/ });
    for (let i = 0; i < 15 && !(await disclosure.evaluate((element) => document.activeElement === element)); i++) await page.keyboard.press("Tab");
    await expect(disclosure).toBeFocused();
    const focus = await disclosure.evaluate((button) => { const b = button.getBoundingClientRect(), cell = button.closest("th")!.getBoundingClientRect(), owner = button.closest(".resource-dashboard-table-scroll")!.getBoundingClientRect(), style = getComputedStyle(button), ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset); return { nativeFocusVisible: button.matches(":focus-visible"), ring, contained: b.left - ring >= Math.max(cell.left, owner.left) - 1 && b.right + ring <= Math.min(cell.right, owner.right) + 1 && b.top - ring >= owner.top - 1 && b.bottom + ring <= owner.bottom + 1, viewport: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight }; });
    expect(focus.nativeFocusVisible && focus.contained && focus.viewport).toBe(true);
    evidence.push({ width, ...result, focus }); await page.locator("#project-panel-resources").evaluate((element) => { element.scrollTop = 0; }); await page.screenshot({ path: `output/playwright/issue-525/dashboard-${width}.png`, fullPage: false }); }
  writeFileSync("output/playwright/issue-525/geometry.json", JSON.stringify(evidence, null, 2)); await testInfo.attach("dashboard-geometry", { body: JSON.stringify(evidence), contentType: "application/json" });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.getByRole("tab", { name: "일정", exact: true }).click(); await expectSameGanttRoot(page, identity); await expect.poll(viewport).toEqual(before); await expect(page.getByRole("button", { name: "주", exact: true })).toHaveAttribute("aria-pressed", "true");
  await frame.locator(".wx-gantt").evaluate((element) => { element.scrollTop = 0; }); await expect(summaryToggle).toHaveClass(/wxi-menu-right/); await expect(frame.locator('.wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000002"]')).toHaveCount(0); await frame.locator(".wx-gantt").evaluate((element) => { element.scrollTop = 96; }); await expect.poll(viewport).toEqual(before);
});


test("#525 기존 stage assignment drill은 legacy API와 기본 Dashboard 조회상태를 보존한다", async ({ page }) => {
  const state = await installStatefulProjectFixture(page); let calls = 0;
  await page.route(path, (route) => { calls++; return route.fallback(); });
  await page.route(`**${projectPath}/milestone-dashboard?*`, (route) => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  await open(page); await ready(page); const root = panel(page); await root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" }).fill("R-01"); await ready(page); await root.getByRole("button", { name: "개인", exact: true }).click(); await root.getByRole("button", { name: "M/M", exact: true }).click();
  await page.getByRole("tab", { name: "일정", exact: true }).click(); await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click(); await expect(page.getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  const response = page.waitForResponse((value) => value.url().includes("/resource-workload?")); await page.getByRole("button", { name: "해당 범위 리소스 보기", exact: true }).click(); expect((await response).status()).toBe(200);
  await expect(root).toBeHidden(); const resources = page.getByRole("tabpanel", { name: "리소스", exact: true }); await expect(resources).toContainText("완료 단계에서 전달한 개인 assignment 표시 범위"); const hiddenCalls = calls; await page.evaluate(() => window.dispatchEvent(new Event("focus"))); expect(calls).toBe(hiddenCalls);
  mkdirSync("output/playwright/issue-525", { recursive: true });
  for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 900 }); await page.screenshot({ path: `output/playwright/issue-525/legacy-preserved-${width}.png`, fullPage: false }); }
  await resources.getByRole("button", { name: "완료 단계 전달 범위 해제" }).click(); await ready(page); await expect(root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" })).toHaveValue("R-01"); await expect(root.getByRole("button", { name: "개인", exact: true })).toHaveAttribute("aria-pressed", "true"); await expect(root.getByRole("button", { name: "M/M", exact: true })).toHaveAttribute("aria-pressed", "true");
  const duplicates = await page.locator("[id]").evaluateAll((elements) => elements.map((element) => element.id).filter((id, i, list) => list.indexOf(id) !== i)); expect(duplicates).toEqual([]);
});


test("#525 외부 snapshot 교체는 사라지는 상세 focus만 복원하고 필터 focus를 보존한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page); let catalog = 1;
  const mutate = <T extends { catalogRevision: number; snapshotId: string }>(data: T) => ({ ...data, catalogRevision: catalog, snapshotId: (catalog === 1 ? "a" : "b").repeat(64) });
  await page.route(path, (route) => { const data = mutate(resourceDashboardUiFixture(fixture, new URL(route.request().url()).searchParams)); data.scope.identity = data.snapshotId; return route.fulfill({ json: { data } }); });
  await page.route(`**${projectPath}/resource-dashboard/details?*`, (route) => route.fulfill({ json: { data: mutate(resourceDashboardDetailUiFixture(fixture, new URL(route.request().url()).searchParams)) } }));
  await open(page); await ready(page); const root = panel(page), kpi = root.getByLabel("선택 범위 KPI").getByRole("button", { name: "1건", exact: true }); await kpi.click(); await expect(root.getByRole("heading", { name: "선택 범위 할당 Task" })).toBeFocused(); catalog = 2; await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await ready(page); await expect(root.getByRole("heading", { name: "선택 범위 할당 Task" })).toHaveCount(0); await expect(kpi).toBeFocused();
  const detailRequests: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname === `${projectPath}/resource-dashboard/details`) detailRequests.push(request.url()); });
  await kpi.click(); await expect(root.getByText("Stable leaf", { exact: true })).toBeVisible();
  const search = root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" });
  await search.fill("R-01"); await ready(page); await expect(search).toBeFocused();
  await expect(root.getByRole("heading", { name: "선택 범위 할당 Task" })).toHaveCount(0);
  const requestsBeforeRestore = detailRequests.length;
  await search.fill(""); await ready(page);
  await expect(root.getByRole("heading", { name: "선택 범위 할당 Task" })).toHaveCount(0);
  expect(detailRequests).toHaveLength(requestsBeforeRestore);
});


test("#525 긴 한국어·영문·ID와 많은 Dashboard 그룹·개인·Task의 5폭 geometry", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const fixture = await installStatefulProjectFixture(page);
  await page.route(path, (route) => route.fulfill({ json: { data: longResourceDashboardUiFixture(fixture, new URL(route.request().url()).searchParams) } }));
  await page.route(`**${projectPath}/resource-dashboard/details?*`, (route) => route.fulfill({ json: { data: longResourceDashboardDetailUiFixture(fixture, new URL(route.request().url()).searchParams) } }));
  await open(page); await ready(page);
  const root = panel(page), evidence = [];
  mkdirSync("output/playwright/issue-525/long-many", { recursive: true });
  for (const mode of ["group", "resource"] as const) {
    await root.getByRole("button", { name: mode === "group" ? "그룹" : "개인", exact: true }).click();
    if (mode === "group") await root.locator('[data-resource-row="group"]').first().getByRole("button").click();
    const disclosure = root.locator('[data-resource-row="resource"]').first().getByRole("button");
    await disclosure.click();
    await expect(root.locator('.resource-dashboard-detail-table > tbody > tr')).toHaveCount(LONG_DASHBOARD_COUNTS.detailPage);
    await expect(root.getByText("비활성 · 기존 할당").first()).toBeVisible();
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await root.evaluate((element) => {
        const box = (node: Element) => { const b = node.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; };
        const tables = Array.from(element.querySelectorAll("table")).filter((table) => table.getBoundingClientRect().height > 0).map((table) => {
          const owner = table.closest(".resource-dashboard-table-scroll")!, heads = Array.from(table.querySelectorAll(":scope > thead > tr > th")).map(box);
          const rows = Array.from(table.querySelectorAll(":scope > tbody > tr")).filter((row) => row.children.length === heads.length);
          const cells = rows.map((row) => Array.from(row.children).map(box));
          const controls = Array.from(table.querySelectorAll("button")).filter((button) => button.closest("table") === table).map((button) => ({ control: box(button), cell: box(button.closest("td,th")!) }));
          const detail = table.classList.contains("resource-dashboard-detail-table");
          return { kind: detail ? "assignment-details" : table.querySelector(':scope > tbody > tr[data-resource-row="group"]') ? "groups" : "resources", populatedRows: rows.length, widths: heads.map((head) => head.width), allRowsAligned: cells.every((row) => heads.every((head, i) => Math.abs(head.left - row[i].left) <= 1 && Math.abs(head.width - row[i].width) <= 1)), allCellsNonoverlapping: cells.every((row) => row.every((a, i) => row.slice(i + 1).every((b) => a.right <= b.left + 1))), controlsContained: controls.every(({ control: b, cell: c }) => b.left >= c.left && b.right <= c.right && b.top >= c.top && b.bottom <= c.bottom), ownerClientWidth: owner.clientWidth, ownerScrollWidth: owner.scrollWidth, ownerClientHeight: owner.clientHeight, ownerScrollHeight: owner.scrollHeight, dateTokensUnbroken: Array.from(table.querySelectorAll(".resource-dashboard-date")).every((token) => getComputedStyle(token).whiteSpace === "nowrap") };
        });
        const controls = Array.from(element.querySelectorAll(".resource-dashboard-toolbar button,.resource-dashboard-filters button,.resource-dashboard-filters input,.resource-dashboard-filters select")).filter((node) => node.getBoundingClientRect().width > 0).map(box);
        const texts = Array.from(element.querySelectorAll('[data-resource-row] th button,.resource-dashboard-detail-table tbody strong')).map((node) => node.textContent?.length ?? 0);
        return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, tables, controlsInViewport: controls.every((b) => b.left >= 0 && b.right <= innerWidth + 1), controlsNonoverlapping: controls.every((a, i) => controls.slice(i + 1).every((b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1)), maxRenderedIdentityCharacters: Math.max(...texts), inactiveRows: Array.from(element.querySelectorAll('[data-resource-row] small')).filter((node) => node.textContent?.includes("비활성")).length, multipleRoleRows: Array.from(element.querySelectorAll('[data-resource-row="resource"] small')).filter((node) => node.textContent?.includes("PI") && node.textContent?.includes("개발자")).length, maxRoleRows: Array.from(element.querySelectorAll('[data-resource-row="resource"] small')).filter((node) => node.textContent?.includes("PI") && node.textContent?.includes("개발자") && node.textContent?.includes("설비 담당")).length, unspecifiedRoleRows: Array.from(element.querySelectorAll('[data-resource-row="resource"] small')).filter((node) => node.textContent?.includes("Global Role 미지정")).length, maxDetailWbsCharacters: Math.max(...Array.from(element.querySelectorAll(".resource-dashboard-detail-table tbody td:first-child small:last-child")).map((node) => node.textContent?.length ?? 0)), stableTaskIds: Array.from(element.querySelectorAll(".resource-dashboard-detail-table tbody td:first-child small:first-of-type")).filter((node) => /[0-9a-f]{8}-[0-9a-f]{4}-4000-8000-[0-9a-f]{12}/.test(node.textContent ?? "")).length };
      });
      expect(result.documentWidth).toBeLessThanOrEqual(width + 1);
      expect(result.tables.find((table) => table.kind === "resources")?.populatedRows).toBe(40);
      expect(result.tables.find((table) => table.kind === "assignment-details")?.populatedRows).toBe(50);
      if (mode === "group") expect(result.tables.find((table) => table.kind === "groups")?.populatedRows).toBe(12);
      expect(result.tables.every((table) => table.allRowsAligned && table.allCellsNonoverlapping && table.controlsContained && table.dateTokensUnbroken)).toBe(true);
      expect(result.controlsInViewport && result.controlsNonoverlapping).toBe(true);
      expect(result.maxRenderedIdentityCharacters).toBeGreaterThan(150); expect(result.maxDetailWbsCharacters).toBeGreaterThan(300); expect(result.stableTaskIds).toBe(50); expect(result.inactiveRows).toBeGreaterThan(0); expect(result.multipleRoleRows).toBe(39); expect(result.maxRoleRows).toBe(1); expect(result.unspecifiedRoleRows).toBe(1);
      const detailTable = result.tables.find((table) => table.kind === "assignment-details")!;
      expect(detailTable.widths[3]).toBeGreaterThanOrEqual(207); expect(detailTable.widths[4]).toBeGreaterThanOrEqual(207);
      expect(detailTable.ownerScrollHeight).toBeGreaterThan(detailTable.ownerClientHeight);
      if (width === 390) expect(result.tables.some((table) => table.ownerScrollWidth > table.ownerClientWidth)).toBe(true);
      await root.getByRole("searchbox", { name: "리소스·그룹·Task 이름과 코드 검색" }).focus();
      for (let i = 0; i < 20 && !(await disclosure.evaluate((node) => document.activeElement === node)); i++) await page.keyboard.press("Tab");
      await expect(disclosure).toBeFocused();
      const focus = await disclosure.evaluate((node) => { const b = node.getBoundingClientRect(), cell = node.closest("th")!.getBoundingClientRect(), style = getComputedStyle(node), ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset), owners = []; for (let parent = node.parentElement; parent; parent = parent.parentElement) { const css = getComputedStyle(parent); if ([css.overflowX, css.overflowY].some((value) => ["auto", "hidden", "scroll"].includes(value))) { const r = parent.getBoundingClientRect(); owners.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }); } } return { nativeFocusVisible: node.matches(":focus-visible"), ring, containedInCell: b.left - ring >= cell.left - 1 && b.right + ring <= cell.right + 1 && b.top - ring >= cell.top - 1 && b.bottom + ring <= cell.bottom + 1, containedInOwners: owners.every((owner) => b.left - ring >= owner.left - 1 && b.right + ring <= owner.right + 1 && b.top - ring >= owner.top - 1 && b.bottom + ring <= owner.bottom + 1), containedInViewport: b.left - ring >= 0 && b.right + ring <= innerWidth && b.top - ring >= 0 && b.bottom + ring <= innerHeight }; });
      expect(focus.nativeFocusVisible && focus.containedInCell && focus.containedInOwners && focus.containedInViewport).toBe(true);
      evidence.push({ width, mode, filters: longResourceDashboardUiFixture(fixture, new URLSearchParams("mode=group&resourceActivity=all&groupActivity=all")).filters, fixture: LONG_DASHBOARD_COUNTS, ...result, focus });
      await page.locator("#project-panel-resources").evaluate((node) => { node.scrollTop = 0; });
      await root.locator(".resource-dashboard-table-scroll").evaluateAll((nodes) => { for (const node of nodes) { node.scrollTop = 0; node.scrollLeft = 0; } });
      await page.screenshot({ path: `output/playwright/issue-525/long-many/${mode}-${width}.png`, fullPage: false });
    }
  }
  writeFileSync("output/playwright/issue-525/long-many/geometry.json", JSON.stringify(evidence, null, 2));
  await testInfo.attach("long-many-dashboard-geometry", { body: JSON.stringify(evidence), contentType: "application/json" });
});
