import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import type { WbsViewReportDto } from "../../src/contracts/wbs-dashboard-views";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { seedWbsViewComposer, viewResourcePassword } from "./fixtures/wbs-view-composer";
import { targetMasterPassword } from "./fixtures/target-project";

test.use({...isolatedApplicationOptions,isolatedProjectMasterAdminPassword:targetMasterPassword,isolatedResourceAdminPassword:viewResourcePassword,viewport:{width:1440,height:1000}});
const root=(page:Page)=>page.locator('[data-wbs-view="resource"]').filter({visible:true});
const reportResponse=(page:Page)=>page.waitForResponse(response=>response.url().endsWith("/resource-dashboard/views")&&response.request().postDataJSON().projection?.kind==="report"&&response.request().postDataJSON().spec.root==="resource");
async function openResource(page:Page){
 await page.getByRole("tablist",{name:"프로젝트 작업공간",exact:true}).getByRole("tab",{name:"대시보드",exact:true}).click();
 await page.getByRole("tablist",{name:"대시보드 보기",exact:true}).getByRole("tab",{name:"리소스",exact:true}).click();
 await expect(root(page)).toHaveAttribute("data-ready","true",{timeout:30_000});
}
async function preset(page:Page,label:string){
 const composer=root(page).locator("details").filter({has:page.locator("summary").filter({hasText:/^조회 구성$/})});
 if(!await composer.evaluate(element=>(element as HTMLDetailsElement).open))await composer.locator("summary").click();
 await composer.getByRole("button",{name:label,exact:true}).click();
 const response=reportResponse(page);await composer.getByRole("button",{name:"적용",exact:true}).click();
 const received=await response;expect(received.status(),await received.text()).toBe(200);
 await expect(root(page)).toHaveAttribute("data-ready","true",{timeout:30_000});return (await received.json()).data as WbsViewReportDto;
}

test("#736 Target0 Resource 단독·동적계층·개인 Plan·같은 snapshot Excel·정확 Assignment 복귀",async({page,isolatedApplication:origin,observeIsolatedApi})=>{
 test.setTimeout(180_000);
 const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
 const first=reportResponse(page);await openResource(page);const initial=(await(await first).json()).data as WbsViewReportDto;
 expect(initial.spec.levels).toEqual([]);
 const before=await f.snapshot();const targets=await page.request.get(`${f.api}/logistics/targets`);expect(targets.status()).toBe(200);expect((await targets.json()).data.targets).toHaveLength(0);
 await expect(root(page).getByTestId("resource-wbs-summary")).toContainText("Project Task 개인 배정 인원");
 const p=await preset(page,"리소스 → 공정 → WorkArea → 설비 / 물류 시스템");
 expect(p.assignmentIds).toEqual(initial.assignmentIds);expect(p.totals.assignments.effort).toEqual(initial.totals.assignments.effort);
 expect(p.spec.levels).toEqual(["process","workArea",{kind:"siblings",dimensions:["equipment","system"]}]);
 const m=await preset(page,"리소스 → Milestone → 공정");expect(m.totals.tasks).toEqual(initial.totals.tasks);
 const filter=reportResponse(page);await root(page).getByRole("combobox",{name:"개인",exact:true}).selectOption(f.resource.id);await filter;await expect(root(page)).toHaveAttribute("data-ready","true",{timeout:30_000});
 const planResponse=reportResponse(page);await root(page).getByRole("combobox",{name:"Plan 기간",exact:true}).selectOption("week");const plan=(await(await planResponse).json()).data as WbsViewReportDto;
 await expect(root(page).getByRole("region",{name:"현재 개인 배정 Plan",exact:true})).toBeVisible();
 expect(plan.resourceAdapter?.report.plan).toEqual(plan.plan);
 const download=page.waitForEvent("download");const exportResponse=page.waitForResponse(response=>response.url().endsWith("/exports/excel")&&response.request().method()==="POST");
 await root(page).getByRole("button",{name:"계층 Excel 보고서",exact:true}).click();
 const exported=await exportResponse;expect(exported.status(),await exported.text().catch(()=>"")).toBe(200);
 expect(exported.request().postDataJSON().resourceDashboard.expectedReport.snapshotId).toBe(plan.snapshotId);await download;
 const row=root(page).locator(`tr[data-dimension="resource"][data-entity-id="${f.resource.id}"]`);
 const trigger=row.getByRole("button",{name:"상세",exact:true});await trigger.focus();await trigger.press("Enter");
 const detail=root(page).getByRole("region",{name:"계층 원본 상세",exact:true});await expect(detail).toHaveAttribute("data-detail-state","ready");
 await detail.getByRole("button",{name:"Assignment 보기",exact:true}).click();await expect(detail).toHaveAttribute("data-detail-state","ready");
 const exact=detail.locator(`[data-canonical-assignment-id="${f.assignment.id}"]`);const original=exact.getByRole("button",{name:`${f.resource.name} Assignment 원본`,exact:true});await original.click();
 const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});await expect(editor).toBeVisible();
 const allocation=editor.getByLabel(`리소스 1 ${f.resource.name} 투입률 (%)`,{exact:true});await allocation.fill("80");
 const assignmentRoute=`**/api/projects/${f.publicId}/tasks/${f.task.taskId}/assignments`;
 await page.route(assignmentRoute,route=>route.request().method()==="PUT"?route.fulfill({status:412,json:{error:{code:"REVISION_CONFLICT"}}}):route.continue());
 const save=editor.getByRole("button",{name:/^할당 저장 \(/});await save.click();await expect(editor).toContainText("최신 정보를 다시 불러와 주세요");await expect(allocation).toHaveValue("80");
 expect((await f.snapshot()).data.project.revision).toBe(before.data.project.revision);await page.unroute(assignmentRoute);
 const saved=page.waitForResponse(response=>response.url().endsWith(`/tasks/${f.task.taskId}/assignments`)&&response.request().method()==="PUT");await save.click();expect((await saved).status()).toBe(200);
 await editor.getByRole("button",{name:"작업 편집기 닫기",exact:true}).click();await expect(original).toBeFocused();
 await expect(root(page)).toHaveAttribute("data-ready","true",{timeout:30_000});await expect(root(page).getByRole("combobox",{name:"개인",exact:true})).toHaveValue(f.resource.id);await expect(root(page)).toContainText("현재 경로: 리소스 → Milestone → 공정");
 await detail.press("Escape");await expect(trigger).toBeFocused();
 await expect(page.locator("[data-resource-compatibility]")).toContainText("기존 분석·Plan·견적·Excel");
 const after=await f.snapshot();expect(after.data.assignments?.find(row=>row.id===f.assignment.id)).toMatchObject({id:f.assignment.id,allocation:{percent:80}});expect(after.data.assignments?.filter(row=>row.id!==f.assignment.id)).toEqual(before.data.assignments?.filter(row=>row.id!==f.assignment.id));expect(after.data.project.revision).toBe(before.data.project.revision+1);
});

test("#736 5폭 keyboard·focus·내부 overflow 및 stale/error 잠금",async({page,isolatedApplication:origin,observeIsolatedApi},info)=>{
 test.setTimeout(180_000);
 const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);await openResource(page);await preset(page,"리소스 → 공정 → WorkArea → 설비 / 물류 시스템");
 const row=root(page).locator(`tr[data-dimension="resource"][data-entity-id="${f.resource.id}"]`);
 const toggle=row.getByRole("button",{name:/하위 (펼치기|접기)$/});await toggle.click();
 const directory=resolve("output/playwright/issue-736");await mkdir(directory,{recursive:true});const geometry=[];
 for(const width of [390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});await toggle.focus();await toggle.press("Tab");const action=row.getByRole("button",{name:"상세",exact:true});await expect(action).toBeFocused();
  const measured=await action.evaluate(element=>{const button=element.getBoundingClientRect(),owner=element.closest("[data-wbs-scroll]")!,bounds=owner.getBoundingClientRect();return{document:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,left:button.left,right:button.right,ownerLeft:bounds.left,ownerRight:bounds.right,scroll:owner.scrollWidth,client:owner.clientWidth};});
  expect(measured.document).toBeLessThanOrEqual(width+1);expect(measured.left).toBeGreaterThanOrEqual(measured.ownerLeft);expect(measured.right).toBeLessThanOrEqual(measured.ownerRight);if(width<=768)expect(measured.scroll).toBeGreaterThan(measured.client);geometry.push({width,...measured});
  await info.attach(`resource-${width}.png`,{body:await root(page).screenshot({path:resolve(directory,`resource-${width}.png`)}),contentType:"image/png"});
 }
 await writeFile(resolve(directory,"geometry.json"),JSON.stringify(geometry,null,2));
 const pattern=`**/api/projects/${f.publicId}/resource-dashboard/views`;
 await page.route(pattern,route=>route.request().postDataJSON().projection?.kind==="scope"?route.fulfill({status:409,json:{error:{code:"REPORT_STALE",message:"stale 검증"}}}):route.continue());
 await row.getByRole("button",{name:"원본",exact:true}).click();await expect(root(page)).toHaveAttribute("data-wbs-state","stale");await expect(root(page).getByRole("button",{name:"계층 Excel 보고서",exact:true})).toBeDisabled();await page.unroute(pattern);
 await page.route(pattern,route=>route.request().postDataJSON().projection?.kind==="report"?route.fulfill({status:503,json:{error:{code:"UNAVAILABLE",message:"조회 오류 검증"}}}):route.continue());
 await root(page).getByRole("button",{name:"계층 새로고침",exact:true}).click();await expect(root(page)).toHaveAttribute("data-wbs-state","error");await expect(row.getByRole("button",{name:"상세",exact:true})).toBeDisabled();await page.unroute(pattern);
});


test("#736 새 Resource Plan 선택80·Project140·선택밖 원인 저장 후 정확 일별 상세 복귀",async({page,isolatedApplication:origin,observeIsolatedApi})=>{
 test.setTimeout(180_000);
 const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
 const catalog=(await(await page.request.get(`${origin}/api/resources`)).json()).data;
 await f.mutate(`/tasks/${f.task.taskId}/assignments`,{catalogRevision:catalog.revision,targets:[{kind:"resource",id:f.resource.id,allocation:{start:"2026-10-14",end:"2026-10-14",percent:80}}]},"put");
 const added=await(await f.mutate("/tasks",{name:"선택밖 과투입 원인",type:"task",start:"2026-10-14",duration:1,progress:0})).json();
 const outside=added.data.tasks.find((task:{name:string})=>task.name==="선택밖 과투입 원인");
 await f.mutate(`/tasks/${outside.taskId}/assignments`,{catalogRevision:catalog.revision,targets:[{kind:"resource",id:f.resource.id,allocation:{start:"2026-10-14",end:"2026-10-14",percent:60}}]},"put");
 await page.reload();await openResource(page);
 await root(page).getByLabel("작업 검색",{exact:true}).fill(f.task.name);
 await root(page).getByLabel("조회 시작일",{exact:true}).fill("2026-10-14");await root(page).getByLabel("조회 종료일",{exact:true}).fill("2026-10-14");
 await root(page).getByRole("combobox",{name:"개인",exact:true}).selectOption(f.resource.id);
 const response=reportResponse(page);await root(page).getByRole("combobox",{name:"Plan 기간",exact:true}).selectOption("week");const report=(await(await response).json()).data as WbsViewReportDto;expect(report.assignmentIds).toHaveLength(1);
 const plan=root(page).getByRole("region",{name:"Resource Plan",exact:true});await expect(plan).toBeVisible();
 expect(report.mdPerMm).toBeNull();
 const unit=root(page).getByRole("combobox",{name:"Plan 단위",exact:true});
 const mmOption=unit.locator('option[value="mm"]');
 await expect(mmOption).toHaveAttribute("disabled");
 await expect(mmOption).toHaveJSProperty("disabled",true);
 await expect(unit).toHaveValue("md");
 await plan.getByLabel("기간 셀 지표",{exact:true}).selectOption("load");await expect(plan).toContainText("평균 80.00 %");
 await plan.getByLabel("부하 범위",{exact:true}).selectOption("project");await expect(plan).toContainText("평균 140.00 %");
 const table=plan.getByRole("region",{name:"개인 기간 계획표",exact:true});
 await table.locator("tbody tr").filter({hasText:f.resource.name}).getByRole("button",{name:/Project 전체 · 초과/}).first().click();
 const detail=plan.getByRole("region",{name:"기간 부하 상세",exact:true});await expect(detail).toHaveAttribute("data-detail-state","ready");
 await detail.locator("tbody th button").first().click();await expect(detail).toHaveAttribute("data-detail-state","ready");
 const cause=detail.locator(`[data-canonical-task-id="${outside.taskId}"]`);const edit=cause.getByRole("button",{name:`배정 편집: ${f.resource.name}`,exact:true});await edit.click();
 const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});const allocation=editor.getByLabel(`리소스 1 ${f.resource.name} 투입률 (%)`,{exact:true});await expect(allocation).toHaveValue("60");await allocation.fill("40");
 const saved=page.waitForResponse(response=>response.url().endsWith(`/tasks/${outside.taskId}/assignments`)&&response.request().method()==="PUT");await editor.getByRole("button",{name:/^할당 저장 \(/}).click();expect((await saved).status()).toBe(200);
 await editor.getByRole("button",{name:"작업 편집기 닫기",exact:true}).click();await expect(edit).toBeFocused();await expect(root(page).getByLabel("작업 검색",{exact:true})).toHaveValue(f.task.name);await expect(plan).toContainText("평균 120.00 %");
 expect((await f.snapshot()).data.assignments?.find(row=>row.taskId===outside.taskId)).toMatchObject({allocation:{percent:40}});
});

test("#736 readonly·응답 역전·낡은 Excel 파일 폐기",async({page,browser,isolatedApplication:origin,observeIsolatedApi})=>{
 test.setTimeout(180_000);
 const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
 const context=await browser.newContext();const readonly=await context.newPage();
 try{
  await readonly.goto(`${origin}/projects/${f.publicId}`);await openResource(readonly);
  await expect(readonly.getByText("편집 중",{exact:true})).toHaveCount(0);
  await expect(root(readonly).getByRole("button",{name:"계층 Excel 보고서",exact:true})).toBeEnabled();
  const pattern=`**/api/projects/${f.publicId}/resource-dashboard/views`;
  let captured!:()=>void,release!:()=>void;const capturedPromise=new Promise<void>(resolve=>{captured=resolve;});const gate=new Promise<void>(resolve=>{release=resolve;});
  await readonly.route(pattern,async route=>{
   const query=route.request().postDataJSON();
   if(query.projection?.kind!=="report"||query.filters?.taskSearch!=="없는 작업")return route.continue();
   const response=await route.fetch();captured();await gate;
   await route.fulfill({response}).catch(()=>{});
  });
  await root(readonly).getByLabel("작업 검색",{exact:true}).fill("없는 작업");await capturedPromise;
  const latest=reportResponse(readonly);await root(readonly).getByLabel("작업 검색",{exact:true}).fill(f.task.name);const actual=(await(await latest).json()).data as WbsViewReportDto;expect(actual.assignmentIds).toEqual([f.assignment.id]);
  await expect(root(readonly)).toHaveAttribute("data-ready","true");release();await readonly.unroute(pattern);
  await expect(root(readonly).getByLabel("작업 검색",{exact:true})).toHaveValue(f.task.name);await expect(root(readonly).getByTestId("resource-wbs-summary").getByRole("definition").filter({hasText:"1건"})).not.toHaveCount(0);
  let exportCaptured!:()=>void,exportRelease!:()=>void;const exportStarted=new Promise<void>(resolve=>{exportCaptured=resolve;});const exportGate=new Promise<void>(resolve=>{exportRelease=resolve;});let downloads=0;readonly.on("download",()=>downloads++);
  const exportPattern=`**/api/projects/${f.publicId}/exports/excel`;
  await readonly.route(exportPattern,async route=>{const response=await route.fetch();expect(response.status()).toBe(200);exportCaptured();await exportGate;await route.fulfill({response}).catch(()=>{});});
  await root(readonly).getByRole("button",{name:"계층 Excel 보고서",exact:true}).click();await exportStarted;
  const changed=reportResponse(readonly);await root(readonly).getByLabel("작업 검색",{exact:true}).fill("없는 작업");await changed;await expect(root(readonly)).toHaveAttribute("data-ready","true");
  exportRelease();await readonly.unroute(exportPattern);await expect(root(readonly)).toContainText("고유 Task");expect(downloads).toBe(0);
 }finally{await context.close();}
});
