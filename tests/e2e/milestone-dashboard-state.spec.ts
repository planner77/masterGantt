import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { dashboardFixture } from "../fixtures/milestone-dashboard";
import { deferred, installStatefulProjectFixture, projectPath, publicId } from "../fixtures/stateful-project";

async function fixture(page: Page) {
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = false;
  const original = state.tasks.find((task) => task.type === "milestone")!;
  original.name = "Milestone 긴 한글 English extraordinary identity";
  for (let i = 5; i < 23; i++) state.tasks.push({ ...original, taskId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, externalId: `M-${i}`, siblingOrder: i, name: `단계 ${i} 긴 한글 English extraordinary identity` });
  return state;
}
const tab = (page: Page) => page.getByRole("tab", { name: "Milestone 대시보드", exact: true });
const dashboard = (page: Page) => page.getByTestId("milestone-dashboard");

test("#463 readonly full-state/F separation, keyboard and five-width geometry", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await fixture(page); let writes = 0;
  page.on("request", (request) => { if (request.url().includes(projectPath) && !["GET", "HEAD"].includes(request.method())) writes++; });
  await page.route(`**${projectPath}/milestone-dashboard?*`, (route) => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.goto(`/projects/${publicId}`); await tab(page).click(); await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
  const region = page.getByRole("region", { name: "Milestone 전체 상태 표 가로 스크롤" });
  await expect(region.getByRole("row")).toHaveCount(20);
  await dashboard(page).getByLabel("Milestone 검색", { exact: true }).fill("no matching stage");
  await expect(dashboard(page)).toHaveAttribute("data-ready", "true"); await expect(dashboard(page).getByText("조건에 일치하는 Milestone이 없습니다.", { exact: false })).toBeVisible(); await expect(dashboard(page).getByText("5 M/D / 0.25 M/M", { exact: true })).toBeVisible();
  await dashboard(page).getByLabel("Milestone 검색", { exact: true }).fill(""); await expect(region).toBeVisible();
  const causes = dashboard(page).getByRole("button", { name: `${state.tasks[3].name} 전체 원인 확인`, exact: true });
  await causes.click(); await expect(dashboard(page).getByText("미완료 직접 선행 Milestone · 1개", { exact: true })).toBeVisible(); await page.keyboard.press("Escape"); await expect(causes).toBeFocused();
  await mkdir("output/playwright/issue-463", { recursive: true }); const metrics: unknown[] = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const trigger = dashboard(page).locator(".project-stage-filter-trigger"); await trigger.click();
    const input = page.getByRole("combobox", { name: "Milestone 이름·외부 ID·작업 ID 검색" });
    await page.setViewportSize({ width, height: 880 });
    const resizedPopup = await page.locator(".project-stage-filter-popup").boundingBox(); expect(resizedPopup!.y).toBeGreaterThanOrEqual(0); expect(resizedPopup!.y + resizedPopup!.height).toBeLessThanOrEqual(880);
    await page.setViewportSize({ width, height: 900 }); await input.press("End");
    const popup = await page.locator(".project-stage-filter-popup").evaluate((element) => {
      const b = element.getBoundingClientRect(), input = element.querySelector("input")!, i = input.getBoundingClientRect(), owner = element.querySelector("ul")!, o = owner.getBoundingClientRect(), active = document.getElementById(input.getAttribute("aria-activedescendant")!)!, a = active.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, inputFocused: document.activeElement === input, inputVisible: i.left >= b.left && i.right <= b.right, activeVisible: a.top >= o.top && a.bottom <= o.bottom, listScrollTop: owner.scrollTop };
    }); expect(popup.left).toBeGreaterThanOrEqual(0); expect(popup.right).toBeLessThanOrEqual(width); expect(popup.bottom).toBeLessThanOrEqual(900); expect(popup.inputFocused && popup.inputVisible && popup.activeVisible).toBe(true); expect(popup.listScrollTop).toBeGreaterThan(0);
    await input.press("Escape"); await expect(trigger).toBeFocused(); await dashboard(page).getByRole("heading", { name: "Milestone 대시보드", exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path:`output/playwright/issue-463/dashboard-${width}.png`,fullPage:false }); await region.locator("tbody button").first().focus();
    const geometry = await dashboard(page).evaluate((root) => {
      const bounds = (e: Element) => { const b = e.getBoundingClientRect(); return { left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height }; };
      const contains = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
      const nonoverlap = (boxes: ReturnType<typeof bounds>[]) => boxes.every((a,i) => boxes.slice(i+1).every((b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1));
      const tables = Array.from(root.querySelectorAll("table")).map((table) => {
        const headers = Array.from(table.querySelectorAll("thead th")).map(bounds), row = table.querySelector("tbody tr")!, cells = Array.from(row.children).map(bounds), controls = Array.from(table.querySelectorAll("tbody button")).map((button) => ({ control:bounds(button),cell:bounds(button.closest("td")!) })), owner = table.parentElement!;
        return { width:table.getBoundingClientRect().width, headerBodyAligned:headers.every((h,i) => Math.abs(h.left-cells[i].left)<=1 && Math.abs(h.width-cells[i].width)<=1), headerBounds:headers,bodyBounds:cells,allControlsContainedInCells:controls.every(({control,cell})=>contains(control,cell)), siblingCellsNonoverlapping:nonoverlap(cells), siblingControlsNonoverlapping:Array.from(table.querySelectorAll("tbody td")).every((cell)=>nonoverlap(Array.from(cell.querySelectorAll("button")).map(bounds))),buttonCount:controls.length,ownerClientWidth:owner.clientWidth,ownerScrollWidth:owner.scrollWidth,ownerOverflowX:getComputedStyle(owner).overflowX };
      });
      const filters = root.querySelector('[class*="filters"]')!, f = bounds(filters), inputs = Array.from(filters.querySelectorAll("input,button,select")).filter((e)=>e.getBoundingClientRect().width>0).map(bounds), focused = document.activeElement!, focus = bounds(focused), style = getComputedStyle(focused), outset = Math.max(0,parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset)), pane = root.closest(".project-milestone-panel")!, workspaceTabs = document.querySelector(".project-primary-tabs")!;
      const otherControls = Array.from(root.querySelectorAll("button,input,select,summary")).filter((e) => !e.closest("table") && e.checkVisibility() && e.getBoundingClientRect().width > 0).map((e) => { const owner = e.closest("label,article,[class*=sectionHeading],[class*=grandTotal],[class*=multiSummary],[class*=filters],[class*=advanced]") ?? e.parentElement!; return { tag:e.tagName,label:e.getAttribute("aria-label") ?? e.textContent?.trim().slice(0,100),ownerTag:owner.tagName,ownerClass:owner.className,control:bounds(e),owner:bounds(owner) }; });
      const focusOwner = bounds(focused.closest("[role=region]") ?? pane);
      return { failedOtherControls:otherControls.filter(({control,owner})=>!contains(control,owner)),documentHeight:document.documentElement.scrollHeight,otherControlCount:otherControls.length,allOtherControlsContained:otherControls.every(({control,owner})=>contains(control,owner)),focusInScrollOwner:focus.left-outset>=focusOwner.left&&focus.right+outset<=focusOwner.right, viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,tables,filterControlsContained:inputs.every((b)=>contains(b,f)),filterControlsNonoverlapping:nonoverlap(inputs),focusVisible:focus.left-outset>=0&&focus.right+outset<=innerWidth&&focus.top-outset>=0&&focus.bottom+outset<=innerHeight,focusOutline:style.outlineStyle,paneOverflowY:getComputedStyle(pane).overflowY,paneClientHeight:pane.clientHeight,paneScrollHeight:pane.scrollHeight,workspaceTabsClientHeight:workspaceTabs.clientHeight,workspaceTabsScrollHeight:workspaceTabs.scrollHeight,inactiveGanttInert:document.querySelector("#project-panel-schedule")!.hasAttribute("inert"),inactiveGanttHidden:getComputedStyle(document.querySelector("#project-panel-schedule")!).visibility,focusedOutsideInactiveGantt:!document.querySelector("#project-panel-schedule")!.contains(document.activeElement) };
    });
    await writeFile(`output/playwright/issue-463/geometry-partial-${width}.json`, JSON.stringify({ width, popup, ...geometry }, null, 2));
    expect(geometry.documentWidth).toBeLessThanOrEqual(width); expect(geometry.filterControlsContained && geometry.filterControlsNonoverlapping && geometry.focusVisible && geometry.focusInScrollOwner && geometry.allOtherControlsContained).toBe(true); expect(geometry.otherControlCount).toBeGreaterThan(0); expect(geometry.focusOutline).not.toBe("none"); expect(geometry.paneOverflowY).toBe("auto"); expect(geometry.workspaceTabsScrollHeight).toBe(geometry.workspaceTabsClientHeight); expect(geometry.inactiveGanttInert && geometry.focusedOutsideInactiveGantt).toBe(true); expect(geometry.inactiveGanttHidden).toBe("hidden");
    for (const table of geometry.tables) { expect(table.headerBodyAligned && table.allControlsContainedInCells && table.siblingCellsNonoverlapping && table.siblingControlsNonoverlapping).toBe(true); expect(table.buttonCount).toBeGreaterThan(0); expect(table.ownerOverflowX).toBe("auto"); } expect(geometry.tables[0].headerBounds[0].width).toBeGreaterThanOrEqual(260); expect(geometry.tables[0].width).toBeGreaterThanOrEqual(1052);
    metrics.push({ width,popup,...geometry }); await page.screenshot({ path:`output/playwright/issue-463/dashboard-stage-table-${width}.png`,fullPage:false });
  }
  await writeFile("output/playwright/issue-463/geometry.json",JSON.stringify(metrics,null,2));
  await page.setViewportSize({ width:1440,height:900 }); const first = region.getByRole("row").nth(1); await first.getByRole("button",{name:/Milestone 상세$/}).click(); const editor = page.getByRole("dialog",{name:"작업 정보",exact:true}); await expect(editor).toBeVisible(); await editor.getByRole("button",{name:"작업 편집기 닫기",exact:true}).click(); await expect(tab(page)).toHaveAttribute("aria-selected","true"); expect(writes).toBe(0);
});

test("#463 request reversal, stale error and explicit retry preserve filters", async ({ page }) => {
  const state = await fixture(page), gate = deferred(), started = deferred(); let fail = false;
  await page.route(`**${projectPath}/milestone-dashboard?*`,async(route)=>{const params=new URL(route.request().url()).searchParams;if(params.get("search")==="older"){started.resolve();await gate.promise;}if(fail){await route.fulfill({status:500,json:{error:{code:"FIXTURE_ERROR"}}});return;}await route.fulfill({json:{data:dashboardFixture(state,params)}});});
  await page.goto(`/projects/${publicId}`); await tab(page).click(); await expect(dashboard(page)).toHaveAttribute("data-ready","true"); const search=dashboard(page).getByLabel("Milestone 검색",{exact:true}); await search.fill("older"); await started.promise; await expect(dashboard(page).getByRole("button",{name:"해당 범위 리소스 보기"})).toBeDisabled(); await search.fill("단계 5"); await expect(dashboard(page)).toHaveAttribute("data-ready","true"); gate.resolve(); await expect(dashboard(page).getByRole("heading",{name:"Milestone 전체 상태 · 표시 1개"})).toBeVisible(); fail=true; await search.fill("failed"); await expect(dashboard(page).getByRole("alert")).toContainText("HTTP 500"); await expect(search).toHaveValue("failed"); await expect(dashboard(page).getByRole("button",{name:"해당 범위 리소스 보기"})).toBeDisabled(); fail=false; await dashboard(page).getByRole("button",{name:"다시 시도",exact:true}).click(); await expect(dashboard(page)).toHaveAttribute("data-ready","true"); await expect(search).toHaveValue("failed");
});

test("#463 server date authority, bounded day refresh and same-day catalog catch-up",async({page})=>{
  const state=await fixture(page);let calls=0,serverDay="2026-10-06",catalog=1;
  await page.clock.install({time:new Date("2026-10-06T14:59:00Z")});
  await page.route(`**${projectPath}/milestone-dashboard?*`,(route)=>{calls++;return route.fulfill({json:{data:dashboardFixture(state,new URL(route.request().url()).searchParams,serverDay,catalog)}});});
  await page.goto(`/projects/${publicId}`);await tab(page).click();await expect(dashboard(page)).toHaveAttribute("data-ready","true");await expect(dashboard(page).getByLabel("기준일",{exact:true})).toHaveValue("2026-10-06");const initial=calls;
  await page.clock.runFor(65_000);await expect.poll(()=>calls).toBe(initial+1);await expect(dashboard(page)).toHaveAttribute("data-ready","true");await page.clock.runFor(180_000);expect(calls).toBe(initial+1);
  serverDay="2026-10-07";catalog=2;await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect.poll(()=>calls).toBe(initial+2);await expect(dashboard(page).getByLabel("기준일",{exact:true})).toHaveValue(serverDay);await expect(dashboard(page).getByText(/Project 40 \/ Catalog 2/)).toBeVisible();
  await dashboard(page).getByLabel("수동 기준일",{exact:true}).check();await expect(dashboard(page)).toHaveAttribute("data-ready","true");await dashboard(page).getByLabel("기준일",{exact:true}).fill("2026-01-02");await expect(dashboard(page)).toHaveAttribute("data-ready","true");const manual=calls;await page.clock.runFor(120_000);expect(calls).toBe(manual);catalog=3;await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect.poll(()=>calls).toBe(manual+1);await expect(dashboard(page).getByLabel("기준일",{exact:true})).toHaveValue("2026-01-02");await expect(dashboard(page).getByText(/Project 40 \/ Catalog 3/)).toBeVisible();await page.getByRole("tab",{name:"일정",exact:true}).click();const hidden=calls;await page.clock.setSystemTime(new Date("2026-10-08T00:00:00Z"));await page.clock.runFor(120_000);expect(calls).toBe(hidden);
});

test("#463 shared multi-selection, null conversion and canonical/catalog invalidation", async ({ page }) => {
  const state = await fixture(page); let catalog = 2, staleRevision = false;
  await page.route(`**${projectPath}/milestone-dashboard?*`, (route) => { const data = dashboardFixture(state, new URL(route.request().url()).searchParams, "2026-10-06", catalog); if (staleRevision) data.projectRevision--; return route.fulfill({ json: { data } }); });
  await page.goto(`/projects/${publicId}`); await tab(page).click(); await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
  await dashboard(page).getByText("Milestone 표시·공수 범위 조건", { exact: true }).click(); const choices = dashboard(page).getByRole("group", { name: "표시 Milestone", exact: true }); await choices.getByRole("checkbox").nth(0).check(); await choices.getByRole("checkbox").nth(1).check(); await expect(dashboard(page).getByText("여러 Milestone 2개 선택", { exact: true })).toBeVisible(); await expect(dashboard(page).locator(".project-stage-filter-trigger")).toHaveCount(0); await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
  await dashboard(page).getByRole("combobox", { name: "M/M 환산 기준", exact: true }).selectOption("unset"); await expect(dashboard(page)).toHaveAttribute("data-ready", "true"); await expect(dashboard(page).getByText("5 M/D / — M/M", { exact: true })).toBeVisible(); await dashboard(page).getByRole("button", { name: "모든 Milestone 선택 해제", exact: true }).click(); await expect(dashboard(page).locator(".project-stage-filter-trigger")).toBeVisible();
  catalog = 1; await dashboard(page).getByRole("button", { name: "새로고침", exact: true }).click(); await expect(dashboard(page).getByRole("alert")).toContainText("Revision·조회 조건"); await expect(dashboard(page).getByRole("button", { name: "해당 범위 리소스 보기" })).toBeDisabled();
  catalog = 3; await dashboard(page).getByRole("button", { name: "다시 시도", exact: true }).click(); await expect(dashboard(page)).toHaveAttribute("data-ready", "true"); staleRevision = true; await dashboard(page).getByRole("button", { name: "새로고침", exact: true }).click(); await expect(dashboard(page).getByRole("alert")).toContainText("Revision·조회 조건"); state.project.revision++; const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === `${projectPath}/milestone-dashboard`); await dashboard(page).getByRole("button", { name: "프로젝트 최신 정보 조회", exact: true }).click(); await refreshed; await expect(dashboard(page).getByRole("button", { name: "다시 시도", exact: true })).toBeVisible(); staleRevision = false; await dashboard(page).getByRole("button", { name: "다시 시도", exact: true }).click(); await expect(dashboard(page)).toHaveAttribute("data-ready", "true"); await expect(dashboard(page).getByText(/Project 41 \/ Catalog 3/)).toBeVisible();
});

test("#463 aborted request to cached query still permits focus catch-up", async ({ page }) => {
  const state = await fixture(page), gate = deferred(), started = deferred(); let calls = 0;
  await page.clock.install({ time: new Date("2026-10-06T00:00:00Z") });
  await page.route(`**${projectPath}/milestone-dashboard?*`, async (route) => { calls++; const params = new URL(route.request().url()).searchParams; if (params.get("search") === "slow") { started.resolve(); await gate.promise; } await route.fulfill({ json: { data: dashboardFixture(state, params) } }); });
  await page.goto(`/projects/${publicId}`); await tab(page).click(); await expect(dashboard(page)).toHaveAttribute("data-ready", "true"); const search = dashboard(page).getByLabel("Milestone 검색", { exact: true }); await search.fill("slow"); await started.promise; await search.fill(""); await expect(dashboard(page)).toHaveAttribute("data-ready", "true"); expect(calls).toBe(2); gate.resolve();
  await page.getByRole("tab", { name: "일정", exact: true }).click(); await tab(page).click(); await expect(dashboard(page)).toHaveAttribute("data-ready", "true"); expect(calls).toBe(2); await page.clock.runFor(31_000); await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect.poll(() => calls).toBe(3); await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
});

test("#463 public viewport and native scroll survive peer/layout, stale restore is consumed", async ({ page }, testInfo) => {
  const state = await fixture(page); await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(`**${projectPath}/milestone-dashboard?*`, (route) => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.goto(`/projects/${publicId}`); await page.getByRole("button", { name: "주", exact: true }).click();
  const frame = page.locator(".project-gantt-frame"), chart = frame.locator(".wx-chart"), identity = await frame.getAttribute("data-project-gantt-api-instance");
  const viewport = () => frame.evaluate((element) => ({ public: Reflect.get(element, "__masterganttPublicViewport") as { left: number; top: number }, dom: { left:element.querySelector(".wx-chart")!.scrollLeft,top:element.querySelector(".wx-gantt")!.scrollTop } }));
  const observations: unknown[] = [];
  const observe = async (phase: string) => {
    observations.push({ phase, ...await frame.evaluate((element) => {
      const owner = element.querySelector(".wx-gantt")!, chart = element.querySelector(".wx-chart")!;
      return { public: Reflect.get(element, "__masterganttPublicViewport"), native: { left: chart.scrollLeft, top: owner.scrollTop },
        rows: element.querySelectorAll(".wx-row").length, renderedGridRows: element.querySelectorAll('[role="row"]').length,
        vertical: { scrollHeight: owner.scrollHeight, clientHeight: owner.clientHeight, capacity: owner.scrollHeight - owner.clientHeight },
        identity: element.getAttribute("data-project-gantt-api-instance"), restore: element.getAttribute("data-gantt-peer-restore"),
        filterResult: document.querySelector(".project-filter-result")?.textContent, events: element.getAttribute("data-gantt-public-scroll-events") };
    }) });
  };
  try {
    // 실제 Week 스크롤 범위가 생긴 뒤 기존 peer/layout 보존 계약을 검증한다.
    await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
    await expect.poll(() => chart.evaluate((element) => element.scrollWidth - element.clientWidth), {
      message: "Week timeline needs at least 120px of horizontal scroll",
      timeout: 10_000,
    }).toBeGreaterThanOrEqual(120);
    const vertical = frame.locator(".wx-gantt"); expect(await vertical.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThanOrEqual(96);
    await vertical.evaluate((element) => { element.scrollTop = 96; }); await chart.evaluate((element) => { element.scrollLeft = 120; }); await expect.poll(viewport).toEqual({ public: { left: 120, top: 96 }, dom: { left:120,top:96 } });
    await tab(page).click(); await expect(dashboard(page)).toHaveAttribute("data-ready", "true"); await page.getByRole("tab", { name: "일정", exact: true }).click(); await expect.poll(viewport).toEqual({ public: { left: 120, top: 96 }, dom: { left:120,top:96 } });
    // 좌표 도달과 3-frame 완료 영수증은 별개다. 정상 복귀가 완료된 뒤 검색 기준을 캡처한다.
    await expect.poll(() => frame.getAttribute("data-gantt-peer-restore")).not.toBeNull();
    const completed = JSON.parse((await frame.getAttribute("data-gantt-peer-restore"))!);
    expect(completed).toMatchObject({ count: 1, requestedLeft: 120, publicLeft: 120, publicTop: 96, domLeft: 120 });
    expect(completed.capacityStableFrames).toBeGreaterThanOrEqual(3);
    expect(completed.settleStableFrames).toBeGreaterThanOrEqual(3);
    expect(completed.nativeCapacity).toBeGreaterThanOrEqual(119);
    expect(completed.admissionCapacity).toBeGreaterThanOrEqual(119);
    await expect.poll(viewport).toEqual({ public: { left: 120, top: 96 }, dom: { left: 120, top: 96 } });
    await page.setViewportSize({ width: 1456, height: 900 }); await page.setViewportSize({ width: 1440, height: 900 }); await expect.poll(viewport).toEqual({ public: { left: 120, top: 96 }, dom: { left:120,top:96 } }); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", identity!);
    // 같은 인스턴스가 native 좌표를 보존하면 restore marker가 없을 수 있다.
    // 검색 때문에 이전 peer 요청이 다시 실행되어 marker가 바뀌면 실패한다.
    const restored = await frame.getAttribute("data-gantt-peer-restore");
    const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true });
    await observe("before-filter");
    await search.fill("Stable leaf");
    await expect(page.locator(".project-filter-result")).toHaveText(`1개 일치 / 전체 ${state.tasks.length}개 작업`);
    await expect.poll(() => frame.locator(".wx-gantt").evaluate(element => element.scrollHeight - element.clientHeight)).toBe(0);
    await expect.poll(viewport).toEqual({ public: { left: 120, top: 0 }, dom: { left: 120, top: 0 } });
    await expect(frame.getByRole("row")).toHaveCount(2);
    await expect(frame.getByRole("gridcell", { name: "Stable leaf", exact: true })).toBeVisible();
    await observe("filter-applied");
    // 완료된 복귀의 영수증은 검색 적용/해제 뒤에도 그대로여야 한다.
    // 진행 중 복원의 입력 취소는 별도 RAF barrier 회귀에서 검증한다.
    await expect.poll(() => frame.getAttribute("data-gantt-peer-restore")).toBe(restored);
    await search.fill("");
    await expect(page.locator(".project-filter-result")).toHaveText(`${state.tasks.length}개 일치 / 전체 ${state.tasks.length}개 작업`);
    await expect.poll(() => frame.locator(".wx-gantt").evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThanOrEqual(96);
    await observe("filter-cleared");
    await expect.poll(() => frame.getAttribute("data-gantt-peer-restore")).toBe(restored);
    // 필터가 한 행으로 줄면서 발생한 합법적 clamp를 과거 peer 좌표로 복원하지 않는다.
    await expect.poll(viewport).toEqual({ public: { left: 120, top: 0 }, dom: { left: 120, top: 0 } });
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", identity!);
    const userViewport = { public: { left: 180, top: 128 }, dom: { left: 180, top: 128 } };
    await expect.poll(() => chart.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThanOrEqual(180);
    await vertical.evaluate(element => { element.scrollTop = 128; });
    await chart.evaluate(element => { element.scrollLeft = 180; });
    await expect.poll(viewport).toEqual(userViewport);
    await observe("new-user-viewport");
    // 18행이 남아 128px capacity를 유지하는 필터로 오래된 120/96 재실행을 구분한다.
    await search.fill("단계");
    await expect(page.locator(".project-filter-result")).toHaveText(`18개 일치 / 전체 ${state.tasks.length}개 작업`);
    await expect.poll(() => vertical.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThanOrEqual(128);
    await expect.poll(viewport).toEqual(userViewport);
    await expect.poll(() => frame.getAttribute("data-gantt-peer-restore")).toBe(restored);
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", identity!);
    await observe("capacity-preserving-filter");
    await search.fill("");
    await expect(page.locator(".project-filter-result")).toHaveText(`${state.tasks.length}개 일치 / 전체 ${state.tasks.length}개 작업`);
    await expect.poll(() => vertical.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThanOrEqual(128);
    await expect.poll(viewport).toEqual(userViewport);
    await expect.poll(() => frame.getAttribute("data-gantt-peer-restore")).toBe(restored);
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", identity!);
    await observe("capacity-preserving-filter-cleared");
    const layoutWidth = await frame.evaluate(element => element.clientWidth);
    await page.setViewportSize({ width: 1456, height: 900 });
    await expect.poll(() => frame.evaluate(element => element.clientWidth)).toBeGreaterThan(layoutWidth);
    await expect.poll(viewport).toEqual(userViewport);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => frame.evaluate(element => element.clientWidth)).toBe(layoutWidth);
    await expect.poll(viewport).toEqual(userViewport);
    await expect.poll(() => frame.getAttribute("data-gantt-peer-restore")).toBe(restored);
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", identity!);
    // 마지막 layout 뒤 3개의 실제 frame에서 늦은 stale 복원이 없는지도 확인한다.
    for (let index = 0; index < 3; index++) {
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      expect(await viewport()).toEqual(userViewport);
      expect(await frame.getAttribute("data-gantt-peer-restore")).toBe(restored);
      expect(await frame.getAttribute("data-project-gantt-api-instance")).toBe(identity);
    }
    await observe("new-user-layout-cycle");
  } finally {
    if (process.env.ISSUE569_REWORK_EVIDENCE_DIR) {
      await mkdir(process.env.ISSUE569_REWORK_EVIDENCE_DIR, { recursive: true });
      await writeFile(`${process.env.ISSUE569_REWORK_EVIDENCE_DIR}/filter-viewport-phases.json`, JSON.stringify({ observations, status: testInfo.status }, null, 2));
    }
    await testInfo.attach("filter-viewport-phases", { body: JSON.stringify(observations), contentType: "application/json" }); await testInfo.attach("public-viewport-events", { body: JSON.stringify({ viewport: await viewport(), events: await frame.getAttribute("data-gantt-public-scroll-events"), restored: await frame.getAttribute("data-gantt-peer-restore") }), contentType: "application/json" }); }
});

test("#463 실제 검색 input은 pending peer 복원 완료 영수증을 취소한다", async ({ page }, testInfo) => {
  const state = await fixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.goto(`/projects/${publicId}?__coreTrace=1`);
  await page.getByRole("button", { name: "주", exact: true }).click();
  const frame = page.locator(".project-gantt-frame"), chart = frame.locator(".wx-chart"), vertical = frame.locator(".wx-gantt");
  const viewport = () => frame.evaluate(element => ({ public: Reflect.get(element, "__masterganttPublicViewport"), native: { left: element.querySelector(".wx-chart")!.scrollLeft, top: element.querySelector(".wx-gantt")!.scrollTop } }));
  await expect.poll(() => chart.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThanOrEqual(120);
  await expect.poll(() => vertical.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThanOrEqual(96);
  const identity = await frame.getAttribute("data-project-gantt-api-instance");
  await vertical.evaluate(element => { element.scrollTop = 96; });
  await chart.evaluate(element => { element.scrollLeft = 120; });
  await expect.poll(viewport).toEqual({ public: { left: 120, top: 96 }, native: { left: 120, top: 96 } });
  await tab(page).click();
  await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
  await expect.poll(() => frame.evaluate(element => !!Reflect.get(element, "__issue568Trace"))).toBe(true);
  // 실제 RAF callback만 유한하게 보류한다. 해제 후에도 원래 RAF에서 실행하며 Core는 그대로 사용한다.
  await frame.evaluate(element => {
    const originalRaf = window.requestAnimationFrame, originalCancel = window.cancelAnimationFrame;
    const held = new Map<number, FrameRequestCallback>(), cancelled = new Set<number>();
    const inputEvents: unknown[] = [];
    let holding = true, autoReleased = false, disposed = false;
    const trace = Reflect.get(element, "__issue568Trace");
    const afterSequence = trace.snapshot().entries.at(-1)?.sequence ?? 0;
    const release = (automatic = false) => {
      if (!holding) return;
      holding = false; autoReleased = automatic; clearTimeout(safety);
      for (const [id, callback] of held) originalRaf.call(window, time => { if (!cancelled.has(id)) callback(time); });
      held.clear();
    };
    window.requestAnimationFrame = callback => {
      const id = originalRaf.call(window, time => { if (holding) held.set(id, callback); else callback(time); });
      return id;
    };
    window.cancelAnimationFrame = id => { cancelled.add(id); held.delete(id); originalCancel.call(window, id); };
    const peerState = () => {
      const entries = trace.snapshot().entries as { sequence: number; event: string; action: string }[];
      const request = entries.find(entry => entry.sequence > afterSequence && entry.event === "effect-request" && entry.action === "peer-restore");
      const cleanup = request && entries.some(entry => entry.sequence > request.sequence && entry.event === "effect-cleanup" && entry.action === "peer-restore");
      return { peerRequested: !!request, peerRequestSequence: request?.sequence ?? null, peerCleanupObserved: !!cleanup, peerPending: !!request && !cleanup };
    };
    const input = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement) || !event.target.closest(".project-schedule-filter-toolbar")) return;
      inputEvents.push({ at: performance.now(), trusted: event.isTrusted, targetIsSearch: event.target.type === "search", expectedValue: event.target.value === "Stable leaf",
        holding, autoReleased, heldFrames: held.size, ...peerState(), marker: element.getAttribute("data-gantt-peer-restore") });
    };
    document.addEventListener("input", input, true);
    const safety = setTimeout(() => release(true), 1500);
    Object.defineProperty(element, "__issue530PendingBarrier", { configurable: true, value: {
      release: () => release(),
      sample: () => ({ holding, autoReleased, rafRestored: window.requestAnimationFrame === originalRaf && window.cancelAnimationFrame === originalCancel, heldFrames: held.size, marker: element.getAttribute("data-gantt-peer-restore"), inputEvents,
        ...peerState() }),
      dispose() { if (disposed) return; disposed = true; release(); clearTimeout(safety); window.requestAnimationFrame = originalRaf; window.cancelAnimationFrame = originalCancel; document.removeEventListener("input", input, true); },
    } });
  });
  const barrier = () => frame.evaluate(element => Reflect.get(element, "__issue530PendingBarrier").sample());
  try {
    // 탭 명령은 직접 발행하고, 복귀 뒤 제품의 실제 RAF callback을 보류한다.
    await page.getByRole("tab", { name: "일정", exact: true }).evaluate(element => (element as HTMLElement).click());
    await expect.poll(barrier).toMatchObject({ holding: true, autoReleased: false, marker: null, peerRequested: true, peerPending: true, peerCleanupObserved: false });
    await expect.poll(async () => (await barrier()).heldFrames).toBeGreaterThan(0);
    const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true });
    await search.focus();
    await page.keyboard.insertText("Stable leaf");
    const atInput = await barrier();
    expect(atInput).toMatchObject({ holding: true, autoReleased: false, marker: null, peerRequested: true });
    expect(atInput.inputEvents).toHaveLength(1);
    expect(atInput.inputEvents[0]).toMatchObject({ trusted: true, targetIsSearch: true, expectedValue: true, holding: true, autoReleased: false, marker: null, peerPending: true, peerCleanupObserved: false });
    expect(atInput.heldFrames).toBeGreaterThan(0);
    expect(atInput.inputEvents[0].heldFrames).toBeGreaterThan(0);
    await frame.evaluate(element => Reflect.get(element, "__issue530PendingBarrier").release());
    await expect(page.locator(".project-filter-result")).toHaveText(`1개 일치 / 전체 ${state.tasks.length}개 작업`);
    await expect(frame.getByRole("row")).toHaveCount(2);
    await expect.poll(() => vertical.evaluate(element => element.scrollHeight - element.clientHeight)).toBe(0);
    await expect.poll(viewport).toEqual({ public: { left: 120, top: 0 }, native: { left: 120, top: 0 } });
    expect(await frame.getAttribute("data-gantt-peer-restore")).toBeNull();
    await search.fill("");
    await expect(page.locator(".project-filter-result")).toHaveText(`${state.tasks.length}개 일치 / 전체 ${state.tasks.length}개 작업`);
    await expect.poll(() => vertical.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThanOrEqual(96);
    for (let index = 0; index < 3; index++) {
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      expect(await viewport()).toEqual({ public: { left: 120, top: 0 }, native: { left: 120, top: 0 } });
      expect(await frame.getAttribute("data-gantt-peer-restore")).toBeNull();
      expect(await frame.getAttribute("data-project-gantt-api-instance")).toBe(identity);
    }
    await expect.poll(barrier).toMatchObject({ autoReleased: false, peerRequested: true, peerPending: false, peerCleanupObserved: true });
  } finally {
    await frame.evaluate(element => Reflect.get(element, "__issue530PendingBarrier").dispose());
    expect((await barrier()).rafRestored).toBe(true);
    await testInfo.attach("pending-peer-input-order", { body: JSON.stringify({ barrier: await barrier(), viewport: await viewport(), trace: await frame.evaluate(element => Reflect.get(element, "__issue568Trace").snapshot()) }), contentType: "application/json" });
  }
});
