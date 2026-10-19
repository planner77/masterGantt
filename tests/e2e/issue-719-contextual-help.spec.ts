import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import { withIntegratedKpi } from "../fixtures/logistics-integrated-kpi";
import { mkdir, writeFile } from "node:fs/promises";
import { openWorkspaceView, workspaceViewTab } from "./helpers/workspace-navigation";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { dashboardFixture } from "../fixtures/milestone-dashboard";
import { deferred, installStatefulProjectFixture, projectPath, publicId } from "../fixtures/stateful-project";
import { resourceAdmin453, loginResourceAdmin453 } from "../fixtures/resource-admin-453";
import { mockMaster455, loginMaster455 } from "../fixtures/project-master-455";
import { mockLogistics454, loginLogistics454 } from "../fixtures/logistics-admin-454";

const before = process.env.ISSUE719_CAPTURE === "before";
const widths = [390, 768, 1024, 1440, 1920];
const surfaces = ["milestone", "resource", "resource-admin", "logistics", "logistics-admin", "master"] as const;
type Surface = typeof surfaces[number];

async function openSurface(page: Page, surface: Surface, wbsResponseGate?: Promise<void>): Promise<Locator> {
  if (surface === "resource-admin") { await resourceAdmin453(page); await loginResourceAdmin453(page); return page.locator("main"); }
  if (surface === "master") { await mockMaster455(page); await loginMaster455(page); return page.locator("main"); }
  if (surface === "logistics-admin") { await mockLogistics454(page); await loginLogistics454(page); return page.locator("main"); }
  const state = await installStatefulProjectFixture(page); state.sessionEditable = false;
  const milestone = state.tasks.find(task => task.type === "milestone")!;
  milestone.name = "긴 한글 Milestone English contextual help identity";
  for (let i = 5; i < 23; i++) state.tasks.push({ ...milestone, taskId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, externalId: `M-${i}`, siblingOrder: i, name: `단계 ${i} 긴 한글 English identity` });
  await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.route(`**${projectPath}/logistics/kpi?*`, route => {
    const params = new URL(route.request().url()).searchParams;
    const row = { id: "proc-1", code: "PROC-01", name: "긴 한글 입고 공정 Long English Process Name", active: true, taskCount: 1, progressPercent: 50, overdueTaskCount: 0, plannedMd: 1, taskIds: [state.tasks[2].taskId] };
    return route.fulfill({ json: { data: withIntegratedKpi({ projectRevision: state.project.revision, catalogRevision: 1, asOfDate: params.get("asOfDate") || "2026-09-29", timezone: "Asia/Seoul", calculatedAt: "2026-09-29T00:00:00Z", horizonDays: Number(params.get("horizonDays") || 14), systemView: params.get("systemView") === "coordination" ? "coordination" : "direct", activeOnly: params.get("activeOnly") === "true", includedTaskIds: row.taskIds, includedMilestoneIds: [], kpi: { progressPercent: 50, totalDuration: 2, taskCount: 1, overdueTaskCount: 0, overdueTaskIds: [], milestoneTotalCount: 0, milestoneOverdueCount: 0, milestoneOverdueIds: [], milestoneUpcomingCount: 0, milestoneUpcomingIds: [] }, effort: { plannedMd: 1, plannedMm: null, mdPerMm: null, unsetAllocationCount: 0, workloadRange: { from: null, to: null } }, quality: { unlinkedLeafTaskCount: 0, totalLeafTaskCount: 1, unlinkedLeafTaskPercent: 0, equipmentWithoutPrimaryControllerCount: 0, equipmentWithoutOwnerCount: 0, systemsWithoutPrimaryPICount: 0, totalEquipmentMasterCount: 0, totalEquipmentQuantity: 0 }, breakdowns: { processes: [row], equipment: [], systems: [] } }) } });
  });
  // This Project exists only in the legacy UI fixture, not in SQLite. Keep
  // the sibling WBS query's original 404 explicit instead of leaking it to
  // the real server, whose pending→error height change races help geometry.
  await page.route(`**${projectPath}/resource-dashboard/views`, async route => {
    if (route.request().method() !== "POST") return route.fallback();
    await wbsResponseGate;
    await route.fulfill({ status: 404, json: { error: { code: "PROJECT_NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." } } });
  });
  await page.goto(`/projects/${publicId}`);
  // #724 F03: follow the real 3/6/4 navigation; old top-level labels no longer exist.
  const destination = surface === "milestone" ? "milestones" : surface === "resource" ? "resources" : "kpi";
  await openWorkspaceView(page, destination);
  if (surface === "milestone" || surface === "resource") {
    await expect(workspaceViewTab(page, surface === "milestone" ? "milestones" : "resources")).toHaveAttribute("aria-selected", "true");
  } else {
    await expect(page.getByRole("tablist", { name: "대시보드 보기" })
      .getByRole("tab", { name: "KPI", exact: true })).toHaveAttribute("aria-selected", "true");
  }
  const root = surface === "milestone" ? page.getByTestId("milestone-dashboard") : surface === "resource" ? page.locator('[data-resource-dashboard="true"]') : page.getByTestId("logistics-dashboard-view");
  if (surface !== "logistics") await expect(root).toHaveAttribute("data-ready", "true");
  else await expect(root.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  if (surface === "milestone" || surface === "resource") {
    // Legacy data-ready alone does not settle the preceding WBS sibling.
    // This is terminal error readiness, not a successful WBS report fixture.
    const wbs = page.locator(`[data-wbs-view="${surface}"]`);
    await expect(wbs).toHaveAttribute("data-wbs-state", "error");
    await expect(wbs.getByRole("alert")).toContainText("프로젝트를 찾을 수 없습니다.");
    await expect(wbs.getByRole("status")).toHaveCount(0);
  }
  return surface === "logistics" ? page.locator(".project-logistics-panel") : root;
}

async function geometry(root: Locator) {
  return root.evaluate(element => {
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    const visible = (e: Element) => e.checkVisibility({ checkVisibilityCSS: true }) && e.getBoundingClientRect().height > 0;
    const notes = [...element.querySelectorAll('p[class*="note"],p[class*="hint"],p[class*="description"],[role="note"]')].filter(visible);
    const rows = [...element.querySelectorAll("tbody tr")].filter(visible);
    const primary = element.querySelector("table,[class*=kpis],[class*=cards]");
    return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth, noteOnlyHeight: notes.reduce((sum, e) => sum + box(e).height, 0), notes: notes.map(e => ({ text: e.textContent, ...box(e) })), primaryDataTop: primary ? box(primary).top : null, rowCount: rows.length, visibleRowCount: rows.filter(e => { const r = box(e); const scrollOwner = e.closest('[role="region"]') ?? element; const owner = box(scrollOwner); return r.top >= Math.max(0, owner.top) && r.bottom <= Math.min(innerHeight, owner.bottom); }).length, tables: [...element.querySelectorAll("table")].map(e => ({ ...box(e), ownerWidth: e.parentElement!.clientWidth, scrollWidth: e.parentElement!.scrollWidth })), helpTriggerCount: [...element.querySelectorAll('button[aria-label*="도움말"]')].filter(visible).length };
  });
}

for (const surface of surfaces) test(`#719 ${surface} 동일 fixture 5폭 설명 높이·작업면·overflow 및 도움말`, async ({ page, browser }) => {
  test.setTimeout(120_000);
  const writes: string[] = [];
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /hydration|cannot (be|contain)|descendant/i.test(message.text())) browserErrors.push(message.text()); });
  page.on("request", request => { if (request.url().includes("/api/") && !["GET", "HEAD"].includes(request.method()) && !request.url().includes("admin-sessions") && !isWbsViewReadQuery(request)) writes.push(`${request.method()} ${new URL(request.url()).pathname}`); });
  const root = await openSurface(page, surface);
  const dir = `output/playwright/issue-719/${before ? "before" : "after"}`;
  await mkdir(dir, { recursive: true });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await root.evaluate(e => { const owner = e.closest('.project-milestone-panel,.project-resource-panel,.project-logistics-panel'); if (owner) owner.scrollTop = 0; });
    const facts = await geometry(root);
    expect(facts.documentWidth).toBeLessThanOrEqual(width);
    await writeFile(`${dir}/${surface}-${width}.json`, JSON.stringify({ ...facts, browserVersion: browser.version(), fixture: "issue-719 shared synthetic fixtures", zoom: "100% browser default" }, null, 2));
    await page.screenshot({ path: `${dir}/${surface}-${width}.png`, fullPage: false });
    if (!before) {
      const triggers = root.getByRole("button", { name: /도움말/ });
      expect(await triggers.count()).toBeGreaterThan(0);
      const trigger = triggers.first();
      await trigger.scrollIntoViewIfNeeded(); await trigger.focus(); await trigger.press("Enter");
      const tooltip = page.getByRole("tooltip"); await expect(tooltip).toBeVisible();
      expect((await tooltip.innerText()).trim().length).toBeGreaterThan(5);
      await expect(trigger).toHaveAccessibleDescription((await tooltip.innerText()).replace(/\s+/g, " ").trim());
      expect(await tooltip.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      const bounds = (await tooltip.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(901);
      await page.screenshot({ path: `${dir}/${surface}-help-${width}.png`, fullPage: false });
      await page.keyboard.press("Escape"); await expect(tooltip).toBeHidden(); await expect(trigger).toBeFocused();
      const panelScroll = () => root.evaluate(e => e.closest('.project-milestone-panel,.project-resource-panel,.project-logistics-panel')?.scrollTop ?? 0);
      const closed = await geometry(root); const closedScroll = await panelScroll();
      await trigger.press("Space"); await expect(tooltip).toBeVisible();
      const opened = await geometry(root); expect(opened.primaryDataTop).toBe(closed.primaryDataTop); expect(opened.documentWidth).toBe(closed.documentWidth);
      expect(await panelScroll()).toBe(closedScroll);
      await page.keyboard.press("Escape");
      await page.mouse.move(0, 0); await trigger.blur(); await trigger.hover(); await expect(tooltip).toBeVisible();
      await page.keyboard.press("Escape"); await expect(tooltip).toBeHidden(); await expect(trigger).toBeFocused();
      await trigger.blur(); await page.mouse.move(0, 0); await trigger.hover(); await expect(tooltip).toBeVisible();
      await page.mouse.move(0, 0); await expect(tooltip).toBeHidden();
      await trigger.click(); await expect(tooltip).toBeVisible(); await trigger.click(); await expect(tooltip).toBeHidden();
    }
  }
  expect(writes).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("#719 touch 도움말 tap 열림·바깥 tap 닫힘 및 최소 hit area", async ({ browser, baseURL }) => {
  test.skip(before, "after interaction regression");
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(); const root = await openSurface(page, "master");
    const trigger = root.getByRole("button", { name: "기준정보 항목 관리 도움말", exact: true });
    const bounds = (await trigger.boundingBox())!; expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44);
    await trigger.tap(); await expect(page.getByRole("tooltip")).toBeVisible();
    await page.getByRole("heading", { name: "프로젝트 기준정보 관리", exact: true }).tap();
    await expect(page.getByRole("tooltip")).toBeHidden();
  } finally { await context.close(); }
});

test("#719 공정 없는 설비 추가는 지속 경고를 표시하고 도움말로 숨기지 않는다", async ({ page }) => {
  test.skip(before, "after prerequisite regression");
  const state = await installStatefulProjectFixture(page); state.sessionEditable = true;
  await page.goto(`/projects/${publicId}`);
  await openWorkspaceView(page, "equipment");
  await expect(page.getByRole("tablist", { name: "기준정보 보기" })
    .getByRole("tab", { name: "설비", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "+ 설비 추가", exact: true }).click();
  const warning = page.getByRole("alert").filter({ hasText: "설비를 등록하려면 먼저 공정을 최소 1개 이상 생성해야 합니다." });
  await expect(warning).toBeVisible(); await expect(page.getByRole("dialog", { name: "설비 추가", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "물류 구성 도움말", exact: true }).click();
  await page.keyboard.press("Escape"); await expect(warning).toBeVisible();
});

test("#719 focus 유지 pointer leave와 profile modal 도움말 Escape는 초안을 보존한다", async ({ page }) => {
  test.skip(before, "after focus/modal regression");
  const state = await resourceAdmin453(page); await loginResourceAdmin453(page);
  const name = state.catalog.data.resources[0].name;
  await page.getByRole("button", { name: `${name} 프로필 편집`, exact: true }).click();
  const modal = page.getByRole("dialog", { name: "리소스 프로필 편집", exact: true });
  const grade = modal.getByRole("combobox"); await grade.selectOption("EXPERT");
  const trigger = modal.getByRole("button", { name: "리소스 저장 도움말", exact: true });
  await trigger.focus(); await trigger.hover(); await page.mouse.move(0, 0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.getByRole("tooltip").isVisible(), { timeout: 500 }).toBe(true);
  // A second event-loop window proves the hover leave delay cannot dismiss focused help.
  await page.waitForTimeout(250);
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.getByRole("tooltip")).toBeHidden();
  await expect(trigger).toBeFocused(); await expect(modal).toBeVisible(); await expect(grade).toHaveValue("EXPERT");
  await expect(page.getByRole("dialog", { name: "초안 폐기 확인", exact: true })).toHaveCount(0);
  expect(state.requests).toHaveLength(0);
});

test("#719 긴 도움말을 키보드로 스크롤하고 Escape 시 초점을 복원한다", async ({ page }) => {
  // F-002~F-005: retain the already validated 390x900 admin geometry,
  // where the first help trigger is visible; at 390x320 it is below
  // the fold (CI #2941: viewport ratio 0). Instead, force a short 56px
  // scrollport on the real tooltip BEFORE opening, without DOM mutation.
  await page.setViewportSize({ width: 390, height: 900 });
  const root = await openSurface(page, "master");
  await page.addStyleTag({ content: `
    div[role="tooltip"] {
      width: 112px !important;
      max-width: 112px !important;
      max-height: 56px !important;
    }
  ` });
  // This first heading control is already in view. It requires no pending
  // programmatic ancestor scroll, unlike the catalog heading below the fold.
  const trigger = root.getByRole("button", { name: "프로젝트 기준정보 관리 도움말", exact: true });
  await expect(trigger).toBeInViewport();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  const tooltip = page.getByRole("tooltip");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(tooltip).toBeVisible();
  await expect(trigger).toHaveAccessibleDescription(/사업부, 제품, 사업장\/법인/);
  const dimensions = await tooltip.evaluate(element => ({
    client: element.clientHeight, content: element.scrollHeight,
    viewport: window.innerHeight,
  }));
  expect(dimensions.content).toBeGreaterThan(dimensions.client);
  expect(dimensions.client).toBeLessThanOrEqual(56);
  expect(dimensions.client).toBeLessThan(dimensions.viewport);

  await trigger.press("ArrowDown");
  const arrowPosition = await tooltip.evaluate(element => element.scrollTop);
  expect(arrowPosition).toBeGreaterThan(0);
  await trigger.press("PageDown");
  expect(await tooltip.evaluate(element => element.scrollTop)).toBeGreaterThan(arrowPosition);
  await trigger.press("End");
  const bottom = await tooltip.evaluate(element => element.scrollTop);
  expect(bottom).toBeGreaterThan(0);
  await trigger.press("PageUp");
  const pageUpPosition = await tooltip.evaluate(element => element.scrollTop);
  expect(pageUpPosition).toBeLessThan(bottom);
  await trigger.press("ArrowUp");
  expect(await tooltip.evaluate(element => element.scrollTop)).toBeLessThan(pageUpPosition);
  await trigger.press("Home");
  expect(await tooltip.evaluate(element => element.scrollTop)).toBe(0);

  await expect(trigger).toBeFocused();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const surface of ["milestone", "resource"] as const) test(`#719 ${surface} 도움말 fixture는 지연 WBS 오류와 기존 데이터가 모두 준비될 때까지 기다린다`, async ({ page }) => {
  const gate = deferred();
  let opened = false;
  const writes: string[] = [];
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("request", request => {
    if (request.url().includes("/api/") && !["GET", "HEAD"].includes(request.method()) && !isWbsViewReadQuery(request)) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  const opening = openSurface(page, surface, gate.promise).then(root => { opened = true; return root; });
  try {
    const legacy = surface === "milestone" ? page.getByTestId("milestone-dashboard") : page.locator('[data-resource-dashboard="true"]');
    await expect(legacy).toHaveAttribute("data-ready", "true");
    await expect(page.locator(`[data-wbs-view="${surface}"]`)).toHaveAttribute("data-wbs-state", "pending");
    expect(opened).toBe(false);
  } finally { gate.resolve(); }
  const root = await opening;
  expect(opened).toBe(true);
  const trigger = root.getByRole("button", { name: /도움말/ }).first();
  await trigger.scrollIntoViewIfNeeded();
  const closed = await geometry(root);
  const scroll = () => root.evaluate(e => e.closest('.project-milestone-panel,.project-resource-panel')!.scrollTop);
  const closedScroll = await scroll();
  await trigger.press("Space");
  await expect(page.getByRole("tooltip")).toBeVisible();
  const shown = await geometry(root);
  expect(shown.primaryDataTop).toBe(closed.primaryDataTop);
  expect(shown.documentWidth).toBe(closed.documentWidth);
  expect(await scroll()).toBe(closedScroll);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();
  expect(writes).toEqual([]);
  expect(browserErrors).toEqual([]);
});
