import { waitForWbsReport, type WbsReportCondition } from "./helpers/wbs-report";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { seedWbsViewComposer, viewResourcePassword } from "./fixtures/wbs-view-composer";
import { targetMasterPassword } from "./fixtures/target-project";
import type { ProcessCatalogResponse } from "../../src/contracts/process-catalog";
import type { WbsViewReportDto, WbsViewSpec } from "../../src/contracts/wbs-dashboard-views";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: viewResourcePassword, viewport: { width: 1440, height: 1000 } });
const root = (page: Page) => page.getByTestId("wbs-view-dashboard").filter({ visible: true });
const defaultSpec: WbsViewSpec = { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "process", levels: [], };
const reportResponse = (page: Page, condition: Partial<WbsReportCondition> = {}) => waitForWbsReport(page, { spec: defaultSpec, filters: {}, ...condition });
async function openProcess(page: Page) {
  await page.getByRole("tablist", {name:"프로젝트 작업공간",exact:true}).getByRole("tab",{name:"대시보드",exact:true}).click();
  await page.getByRole("tablist",{name:"대시보드 보기",exact:true}).getByRole("tab",{name:"공정&WorkArea",exact:true}).click();
  await expect(root(page)).toHaveAttribute("data-ready","true");
}
async function preset(page: Page, label: string) {
  const panel = root(page).locator("details").filter({has:page.locator("summary").filter({hasText:/^조회 구성$/})});
  if (!await panel.evaluate(node=>(node as HTMLDetailsElement).open)) await panel.locator("summary").click();
  await panel.getByRole("button",{name:label,exact:true}).click();
  const levels: Record<string, NonNullable<WbsViewSpec["levels"]>> = {"공정 단독": [], "공정 → WorkArea → 설비 / 물류 시스템 → 리소스": ["workArea", { kind: "siblings", dimensions: ["equipment", "system"] }, "resource"], "공정 → Milestone → 리소스": ["milestone", "resource"]};
  const response = reportResponse(page, { spec: { ...defaultSpec, levels: levels[label] } });
  await panel.getByRole("button",{name:"적용",exact:true}).click();
  const received = await response;
  expect(received.status(),await received.text()).toBe(200);
  await expect(root(page)).toHaveAttribute("data-ready","true");
  return (await received.json()).data as WbsViewReportDto;
}
async function expand(row: Locator) {
  const button = row.getByRole("button", {name:/하위 펼치기$/});
  await expect(button).toHaveCount(1);
  await button.focus(); await button.press("Enter");
}

async function seedProcess(page: Page, origin: string, observeIsolatedApi: Parameters<typeof seedWbsViewComposer>[2]) {
  const f = await seedWbsViewComposer(page,origin,observeIsolatedApi);
  const areaWrite = await page.request.post(`${origin}/api/process-catalog/admin/work-areas`,{headers:{Origin:origin,"If-Match":`"${f.catalog.data.processCatalogRevision}"`},data:{occurrenceId:f.workArea.occurrenceId,code:"WA-A2",name:"두 번째 긴 이름의 검증용 공정 WorkArea"}});
  expect(areaWrite.status()).toBe(201);
  const catalog = (await areaWrite.json() as ProcessCatalogResponse).data;
  const area2 = catalog.workAreas.find(row=>row.code==="WA-A2")!;
  await f.mutate(`/tasks/${f.task.taskId}/logistics-links`,{equipmentLinks:[],systemLinks:[{systemId:f.system.id,scope:"self"}]},"put");
  await f.mutate(`/logistics/equipment/${f.equipment.id}`,{processCatalogRevision:catalog.processCatalogRevision,name:"장거리설비"+"LongEquipmentNameWithoutWhitespace".repeat(5),quantity:10,workAreaLinks:[f.workArea,area2].map(area=>({processId:f.processIds[0],workAreaId:area.id}))},"patch");
  await f.mutate(`/tasks/${f.task.taskId}/process-context`,{processCatalogRevision:catalog.processCatalogRevision,processLinks:f.processIds.map(processId=>({processId,scope:"self"})),workAreaLinks:[f.workArea,area2].map(area=>({processId:f.processIds[0],workAreaId:area.id,scope:"self"}))},"put");
  await f.mutate(`/tasks/${f.task.taskId}/logistics-links`,{equipmentLinks:[{equipmentId:f.equipment.id,scope:"self"}],systemLinks:[{systemId:f.system.id,scope:"self"}]},"put");
  await page.reload();
  return { ...f, area2 };
}

test("#733 Target0 다중 구역·동급 설비/System·고유 KPI·단독 및 Milestone 경로·정확 원본 복귀", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedProcess(page,origin,observeIsolatedApi);
  const area2 = f.area2;
  const before = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const gantt = await frame.locator(".wx-gantt").elementHandle();
  let mutations = 0;
  page.on("request",request=>{if(new URL(request.url()).pathname.startsWith(`/api/projects/${f.publicId}/`) && !["GET","HEAD"].includes(request.method()) && !isWbsViewReadQuery(request))mutations++;});
  const first = reportResponse(page);
  await openProcess(page);
  const standalone = (await (await first).json()).data as WbsViewReportDto;
  expect(standalone.spec.levels).toEqual([]);
  const initial = await preset(page,"공정 → WorkArea → 설비 / 물류 시스템 → 리소스");
  expect(initial.spec.levels).toEqual(["workArea",{kind:"siblings",dimensions:["equipment","system"]},"resource"]);
  expect(initial.configurationCatalog.workAreas).toHaveLength(2);
  expect(initial.totals.configurationReference.equipmentQuantity).toBe(17);
  expect(initial.totals.relatedMembers.equipmentQuantity).toBe(10);
  const selected = root(page).locator(`tr[data-dimension="process"][data-entity-id="${f.processIds[0]}"]`);
  await expand(selected);
  for (const area of [f.workArea,area2]) {
    const areaRow = root(page).locator(`tr[data-dimension="workArea"][data-entity-id="${area.id}"]`);
    await expand(areaRow);
    const processNode = initial.children.find(row=>row.selector.id===f.processIds[0])!;
    const areaNode = processNode.children.find(row=>row.selector.id===area.id)!;
    expect(areaNode.totals.configurationReference.equipmentQuantity).toBe(10);
    expect(areaNode.children.find(row=>row.selector.dimension==="equipment"&&row.selector.id===f.equipment.id)!.path.length).toBe(3);
    expect(areaNode.children.find(row=>row.selector.dimension==="system"&&row.selector.id===f.system.id)!.path.length).toBe(3);
    expect(areaNode.taskIds).toEqual([f.task.taskId]);
  }
  const summary = root(page).getByTestId("process-workarea-summary");
  await expect(summary.getByRole("definition").filter({hasText:"17대"})).toHaveCount(1);
  const detailTrigger = selected.getByRole("button",{name:"상세",exact:true});
  await detailTrigger.focus();await detailTrigger.press("Space");
  const detail = root(page).getByRole("region",{name:"계층 원본 상세",exact:true});
  await expect(detail).toHaveAttribute("data-detail-state","ready");
  await expect(detail.getByRole("heading",{name:"A 공정",exact:true})).toBeFocused();
  await detail.press("Escape");await expect(detailTrigger).toBeFocused();
  const original = selected.getByRole("button",{name:"원본",exact:true});
  await original.click();
  const editor = page.getByRole("dialog",{name:"공정 수정",exact:true});
  await expect(editor).toBeVisible();
  await editor.getByRole("button",{name:"취소",exact:true}).click();
  await expect(editor).toHaveCount(0);await expect(original).toBeFocused();
  const single = await preset(page,"공정 단독");expect(single.spec.levels).toEqual([]);
  const coverage = root(page).getByTestId("process-workarea-summary").locator("details").filter({has:page.locator("summary").filter({hasText:/^구성·연결 진단과 Coverage$/})});
  await coverage.locator("summary").first().click();
  await expect(coverage.getByText(/장거리설비LongEquipmentNameWithoutWhitespace/)).toBeVisible();
  const gates = root(page).getByTestId("process-workarea-summary").locator("details").filter({has:page.locator("summary").filter({hasText:/^연관 Milestone 전체 Gate/})});
  await gates.locator(":scope > summary").click();await expect(gates).toContainText("인수 Milestone");
  expect(single.totals.assignments.effort.knownMd).toBe(initial.totals.assignments.effort.knownMd);
  const milestone = await preset(page,"공정 → Milestone → 리소스");
  expect(milestone.spec.levels).toEqual(["milestone","resource"]);
  const a = milestone.children.find(row=>row.selector.id===f.processIds[0])!;
  expect(a.children.find(row=>row.selector.id===f.milestone.taskId)!.taskIds).toEqual([f.task.taskId]);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  expect(await gantt!.evaluate(element=>element.isConnected)).toBe(true);
  await page.reload();await openProcess(page);
  await expect(root(page)).toContainText("현재 경로: 공정 → Milestone → 리소스");
  const after = await f.snapshot();
  expect(after.data.project.revision).toBe(before.data.project.revision);expect(after.data.tasks).toEqual(before.data.tasks);expect(after.data.assignments).toEqual(before.data.assignments);
  expect(mutations).toBe(0);
});

test("#733 공정 조회 긴 이름·5폭 내부 스크롤·키보드", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedProcess(page,origin,observeIsolatedApi);
  await openProcess(page);
  await preset(page,"공정 → WorkArea → 설비 / 물류 시스템 → 리소스");
  await expand(root(page).locator(`tr[data-dimension="process"][data-entity-id="${f.processIds[0]}"]`));
  await expand(root(page).locator(`tr[data-dimension="workArea"][data-entity-id="${f.workArea.id}"]`));
  await expand(root(page).locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`));
  const overview = root(page).getByTestId("process-workarea-summary");
  await overview.getByText("구성·연결 진단과 Coverage",{exact:true}).click();
  await overview.getByText(/^연관 Milestone 전체 Gate/).click();
  const composer = root(page).locator("details").filter({has:page.locator("summary").filter({hasText:/^조회 구성$/})});
  await composer.locator(":scope > summary").click();
  const artifactDirectory=resolve("output/playwright/issue-733");
  await mkdir(artifactDirectory,{recursive:true});
  const geometry = [];
  for(const width of [390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:1000});
    const table = root(page).getByRole("table",{name:"공통 계층 결과",exact:true});
    const firstRow = table.locator(`tr[data-dimension="process"][data-entity-id="${f.processIds[0]}"]`);
    const toggle=firstRow.getByRole("button",{name:/하위 접기$/});
    await toggle.focus();await toggle.press("Tab");
    const action = firstRow.getByRole("button",{name:"상세",exact:true});
    await expect(action).toBeFocused();
    const focusBox=await action.evaluate(element=>{const button=element.getBoundingClientRect(),owner=element.closest("[data-wbs-scroll]")!.getBoundingClientRect();return {left:button.left,right:button.right,ownerLeft:owner.left,ownerRight:owner.right};});
    expect(focusBox.left).toBeGreaterThanOrEqual(focusBox.ownerLeft);expect(focusBox.right).toBeLessThanOrEqual(focusBox.ownerRight);
    await action.press("Shift+Tab");await expect(toggle).toBeFocused();
    const boxes=await overview.evaluate(element=>Array.from(element.querySelectorAll("dt,dd,summary")).filter(node=>node.getClientRects().length).map(node=>{const box=node.getBoundingClientRect();return {text:node.textContent,left:box.left,right:box.right};}));
    boxes.forEach(box=>{expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width+1);});
    const measured = await table.evaluate(element=>{
      const cells=(selector:string)=>Array.from(element.querySelectorAll(selector)).map(cell=>{const box=cell.getBoundingClientRect();return {left:box.left,width:box.width};});
      return {viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,header:cells("thead th"),body:cells("tbody tr:first-child > *"),owner:{client:element.parentElement!.clientWidth,scroll:element.parentElement!.scrollWidth,overflow:getComputedStyle(element.parentElement!).overflowX}};
    });
    expect(measured.document).toBeLessThanOrEqual(width+1);expect(measured.header).toHaveLength(6);expect(measured.body).toHaveLength(6);
    measured.body.forEach((cell,index)=>{expect(Math.abs(cell.left-measured.header[index].left)).toBeLessThanOrEqual(1);expect(Math.abs(cell.width-measured.header[index].width)).toBeLessThanOrEqual(1);});
    expect(measured.owner.overflow).toMatch(/auto|scroll/);if(width<=768)expect(measured.owner.scroll).toBeGreaterThan(measured.owner.client);
    geometry.push({width,...measured,focusBox,boxes});
    await info.attach(`process-${width}.png`,{contentType:"image/png",body:await root(page).screenshot({path:resolve(artifactDirectory,`process-${width}.png`)})});
  }
  await writeFile(resolve(artifactDirectory,"geometry.json"),JSON.stringify(geometry,null,2));
  await info.attach("process-five-widths",{contentType:"application/json",body:JSON.stringify(geometry)});
});

test("#733 공정 단독 readonly 조회는 원본 편집과 mutation을 제공하지 않는다", async ({page,browser,isolatedApplication:origin,observeIsolatedApi}) => {
  test.setTimeout(120_000);
  const f = await seedWbsViewComposer(page,origin,observeIsolatedApi);
  const context=await browser.newContext();const readonly=await context.newPage();
  let mutations=0;
  readonly.on("request",request=>{if(new URL(request.url()).pathname.startsWith(`/api/projects/${f.publicId}/`) && !["GET","HEAD"].includes(request.method()) && !isWbsViewReadQuery(request))mutations++;});
  try {await readonly.goto(`${origin}/projects/${f.publicId}`);await openProcess(readonly);await preset(readonly,"공정 단독");await expect(root(readonly).getByRole("button",{name:"원본",exact:true})).toHaveCount(0);await expect(root(readonly).getByTestId("process-workarea-summary")).toBeVisible();expect(mutations).toBe(0);}
  finally {await context.close();}
});

test("#733 공정 작업 원본 저장은 같은 경로·새 snapshot으로 복귀하고 stale/error 명령을 잠근다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedWbsViewComposer(page,origin,observeIsolatedApi);
  const first = reportResponse(page);await openProcess(page);
  const initial = (await (await first).json()).data as WbsViewReportDto;
  const row = root(page).locator(`tr[data-dimension="process"][data-entity-id="${f.processIds[0]}"]`);
  await row.getByRole("button",{name:"상세",exact:true}).click();
  const detail = root(page).getByRole("region",{name:"계층 원본 상세",exact:true});
  const taskOriginal = detail.getByRole("button",{name:`${f.task.name} Task 원본`,exact:true});
  await taskOriginal.click();
  const editor = page.getByRole("dialog",{name:"작업 정보",exact:true});
  const renamed = "공정 원본 저장 복귀 검증";
  await editor.getByLabel("작업명",{exact:true}).fill(renamed);
  const mutation = page.waitForResponse(response=>response.request().method()==="PATCH"&&new URL(response.url()).pathname===`/api/projects/${f.publicId}/tasks/${f.task.taskId}`);
  const refreshed = reportResponse(page, { spec: initial.spec, filters: initial.filters, scope: initial.sourceContext.scope });
  await editor.getByRole("button",{name:"저장",exact:true}).click();
  expect((await mutation).status()).toBe(200);
  const updated = (await (await refreshed).json()).data as WbsViewReportDto;
  expect(updated.projectRevision).toBe(initial.projectRevision+1);expect(updated.snapshotId).not.toBe(initial.snapshotId);expect(updated.spec).toEqual(initial.spec);
  await expect(root(page)).toHaveAttribute("data-ready","true");
  const restored = detail.getByRole("button",{name:`${renamed} Task 원본`,exact:true});
  await expect(restored).toBeFocused();
  await detail.press("Escape");
  const pattern=`**/api/projects/${f.publicId}/resource-dashboard/views`;
  await page.route(pattern,route=>route.request().postDataJSON().projection?.kind==="scope" ? route.fulfill({status:409,json:{error:{code:"REPORT_STALE",message:"의도한 stale 음성 검증"}}}) : route.continue());
  await row.getByRole("button",{name:"원본",exact:true}).click();
  await expect(root(page)).toHaveAttribute("data-wbs-state","stale");
  await expect(row.getByRole("button",{name:"원본",exact:true})).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.unroute(pattern);
  const refresh = reportResponse(page);await root(page).getByRole("button",{name:"계층 새로고침",exact:true}).click();await refresh;
  await expect(root(page)).toHaveAttribute("data-ready","true");
  await page.route(pattern,route=>route.request().postDataJSON().projection?.kind==="report" ? route.fulfill({status:503,json:{error:{code:"UNAVAILABLE",message:"의도한 조회 오류 검증"}}}) : route.continue());
  await root(page).getByRole("button",{name:"계층 새로고침",exact:true}).click();
  await expect(root(page)).toHaveAttribute("data-wbs-state","error");await expect(row.getByRole("button",{name:"원본",exact:true})).toBeDisabled();
  await page.unroute(pattern);
});

test("#733 WorkArea 원본 dirty 유지·이름 저장은 같은 구역 경로와 새 snapshot으로 복귀한다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
  const first=reportResponse(page);await openProcess(page);
  await first;
  const initial=await preset(page,"공정 → WorkArea → 설비 / 물류 시스템 → 리소스");
  await expand(root(page).locator(`tr[data-dimension="process"][data-entity-id="${f.processIds[0]}"]`));
  const row=root(page).locator(`tr[data-dimension="workArea"][data-entity-id="${f.workArea.id}"]`);
  const original=row.getByRole("button",{name:"원본",exact:true});
  await original.click();
  const editor=page.getByRole("dialog",{name:"작업 구역 수정",exact:true});
  await expect(editor.locator("form")).toHaveAttribute("data-canonical-catalog-id",f.workArea.id);
  const name="같은 원본 구역 이름 저장 확인";
  await editor.getByLabel("이름",{exact:true}).fill(name);
  await editor.getByRole("button",{name:"취소",exact:true}).click();
  const discard=page.getByRole("dialog",{name:"기준정보 변경 내용 버리기",exact:true});
  await expect(discard).toBeVisible();await discard.getByRole("button",{name:"계속 편집",exact:true}).click();
  await expect(editor.getByLabel("이름",{exact:true})).toHaveValue(name);
  const saved=page.waitForResponse(response=>response.request().method()==="PATCH"&&new URL(response.url()).pathname===`/api/process-catalog/admin/work-areas/${f.workArea.id}`);
  const refreshed=reportResponse(page, { spec: initial.spec, filters: initial.filters, scope: initial.sourceContext.scope });
  await editor.getByRole("button",{name:"저장",exact:true}).click();
  expect((await saved).status()).toBe(200);
  const updated=(await (await refreshed).json()).data as WbsViewReportDto;
  expect(updated.snapshotId).not.toBe(initial.snapshotId);expect(updated.spec).toEqual(initial.spec);
  expect(updated.configurationCatalog.workAreas.find(area=>area.id===f.workArea.id)?.name).toBe(name);
  await expect(root(page)).toHaveAttribute("data-ready","true");
  await expect(row).toContainText(name);await expect(original).toBeFocused();
});
