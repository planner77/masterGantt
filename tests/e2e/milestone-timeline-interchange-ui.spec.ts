import { taskStatusFromProgress } from "../../src/domain/task-status";
import { resourceDashboardUiFixture, resourceDashboardDetailUiFixture } from "../fixtures/resource-dashboard-ui";
import { deferred } from "../fixtures/stateful-project";
import { normalizedDrillFilters } from "../../src/features/resources/resource-drill-transport";
import type { ResourceDrillQueryInput, ResourceDrillSourceContext } from "../../src/contracts/resource-drill";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";
import type { ProjectExcelExportRequest } from "../../src/contracts/project-excel-export";
import type { ProjectGanttImageExportRequest } from "../../src/contracts/project-gantt-image-export";
import { buildProjectJsonExport } from "../../src/server/exports/project-json-export-core";
import { buildProjectExcelWorkbook } from "../../src/server/exports/project-excel-export-core";
import { buildProjectGanttSvg } from "../../src/server/exports/project-svg-export-core";
import { installStatefulProjectFixture, publicId, projectPath, taskPath, rowNamed, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";
import { workbookEntries, workbookSheet } from "../fixtures/issue-553/canonical-interchange";
import { canonicalMilestoneDashboard, canonicalMilestoneTasks, installMilestoneDashboardFixture } from "./helpers/milestone-ui";

const notice = "화면의 Milestone 표시와 별개로 원본 일정 데이터를 출력하며, 현재 Gantt 레이아웃과 다를 수 있습니다.";
const toggle = (page: Page) => page.getByRole("button", { name: "◆ Milestone 표시", exact: true });
const exportTrigger = (page: Page) => page.getByRole("button", { name: "내보내기", exact: true }).first();
const snapshot = (page: Page) => page.evaluate(async path => (await (await fetch(path)).json()) as ProjectSnapshotResponse, projectPath);
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const sourcePaths = ["src/features/projects/project-excel-export-button.tsx", "src/features/projects/project-export.module.css", "src/features/projects/project-readonly-view.tsx", "src/features/gantt/project-gantt.tsx", "src/features/gantt/milestone-timeline-lane.tsx", "tests/e2e/helpers/milestone-ui.ts", "tests/e2e/milestone-timeline-interchange-ui.spec.ts"];
async function capture(page: Page, name: string, data: unknown) {
  if (!process.env.CAPTURE_ISSUE_553) return;
  const directory = `output/playwright/issue-553/frontend/${process.env.CAPTURE_ISSUE_553}`;
  await mkdir(directory, { recursive: true });
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, hash(await readFile(path))])));
  await writeFile(`${directory}/${name}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), environment: "Chromium/Next dev/Core2.7.3; synthetic canonical routes + real pure export builders; not actual HTTP/SQLite", sourceHashes, data }, null, 2));
  await page.screenshot({ path: `${directory}/${name}.png` });
}
async function setup(page: Page, editable = false, duplicate = false) {
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-04:00"));
  const state = await installStatefulProjectFixture(page); state.sessionEditable = editable;
  for (const task of state.tasks) { task.start = "2026-10-05"; task.end = "2026-10-05"; task.requestedStart = task.type === "summary" ? null : "2026-10-05"; task.duration = task.type === "milestone" ? 0 : 1; task.progress = 0; if (task.type !== "summary") task.status = taskStatusFromProgress(task.progress); }
  state.tasks[0].membership = { explicitMilestoneTaskId: state.tasks[3].taskId, effectiveMilestoneTaskId: state.tasks[3].taskId, inheritedFromTaskId: null };
  if (duplicate) state.tasks.push({ ...state.tasks[3], taskId: "00000000-0000-4000-8000-000000000005", externalId: "M-DUPLICATE", siblingOrder: 3 });
  await installMilestoneDashboardFixture(page, state);
  await page.goto(`/projects/${publicId}`); await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  return state;
}

for (const width of [390, 768, 1024, 1440, 1920]) test(`#553 export notice all formats ${width}px physical bounds and keyboard return`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const state = await setup(page), identity = await rememberGanttRoot(page), before = await snapshot(page);
  await toggle(page).click(); await exportTrigger(page).focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "내보내기", exact: true }), format = dialog.getByLabel("형식", { exact: true });
  await expect(format).toBeFocused();
  const observations = [];
  for (const value of ["excel", "json", "svg", "png"]) {
    await format.selectOption(value); await expect(dialog.getByText(notice, { exact: true })).toBeVisible();
    await format.focus(); await page.keyboard.press("Tab");
    const bounds = await dialog.evaluate((node, notice) => {
      const box = (element: Element) => { const b = element.getBoundingClientRect(); return { x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height }; };
      const active = document.activeElement as HTMLElement, css = getComputedStyle(active), ring = parseFloat(css.outlineWidth) + parseFloat(css.outlineOffset);
      const explanation = Array.from(node.querySelectorAll("p")).find(p => p.textContent === notice)!;
      const hit = document.elementFromPoint(active.getBoundingClientRect().x + active.offsetWidth/2, active.getBoundingClientRect().y + active.offsetHeight/2);
      return { dialog:box(node), form:box(node.querySelector(".project-form")!), footer:box(node.querySelector(".form-actions")!), notice:box(explanation), active:box(active), label:active.getAttribute("aria-label") ?? active.textContent, focusInside:node.contains(active), ring, outline:css.outlineStyle, centerHit:hit===active || active.contains(hit), documentWidth:document.documentElement.scrollWidth, documentHeight:document.documentElement.scrollHeight, viewport:{width:innerWidth,height:innerHeight}, page:{x:scrollX,y:scrollY} };
    }, notice);
    expect(bounds.focusInside).toBe(true); expect(bounds.centerHit).toBe(true); expect(bounds.outline).not.toBe("none");
    for (const rect of [bounds.dialog, bounds.form, bounds.footer, bounds.notice, bounds.active]) { expect(rect.width).toBeGreaterThan(0); expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.right).toBeLessThanOrEqual(width); expect(rect.y).toBeGreaterThanOrEqual(0); expect(rect.bottom).toBeLessThanOrEqual(1000); }
    expect(bounds.active.x-bounds.ring).toBeGreaterThanOrEqual(bounds.dialog.x); expect(bounds.active.right+bounds.ring).toBeLessThanOrEqual(bounds.dialog.right);
    expect(bounds.active.y-bounds.ring).toBeGreaterThanOrEqual(bounds.dialog.y); expect(bounds.active.bottom+bounds.ring).toBeLessThanOrEqual(bounds.dialog.bottom);
    expect(bounds.documentWidth).toBeLessThanOrEqual(width); expect(bounds.page).toEqual({x:0,y:0}); observations.push({format:value,...bounds});
  }
  await capture(page, `export-notice-${width}`, { observations, canonicalBefore:before, instance:identity });
  await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(exportTrigger(page)).toBeFocused();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false"); await expectSameGanttRoot(page, identity); expect(await snapshot(page)).toEqual(before);
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
});

test("#553 OFF search collapse exports full canonical JSON/Excel/SVG and browser PNG without changing workspace", async ({ page }) => {
  await page.setViewportSize({ width:1440,height:1000 });
  await page.addInitScript(() => {
    const created: string[] = [], revoked: string[] = [], create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    Reflect.set(window,"__issue553BlobURLs",{created,revoked});
    URL.createObjectURL = blob => { const url=create(blob); created.push(url); return url; };
    URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
  });
  const state = await setup(page), before = await snapshot(page), identity = await rememberGanttRoot(page);
  await toggle(page).click(); await rowNamed(page,"Stable summary").locator('[data-action="open-task"]').click();
  await expect(rowNamed(page,"Existing summary child")).toHaveCount(0);
  const search=page.getByRole("searchbox",{name:"작업명, 설명, External ID 검색"}); await search.fill("Stable summary");
  await expect(rowNamed(page,"Stable leaf")).toHaveCount(0); await expect(rowNamed(page,"Stable milestone")).toHaveCount(0);
  const requests: {endpoint:string;body:unknown;ifMatch:string}[]=[];
  const artifacts: Record<string,Buffer>={};
  await page.route(`**${projectPath}/exports/*`, async route => {
    const request=route.request(), endpoint=new URL(request.url()).pathname.split("/").at(-1)!, body=request.postDataJSON();
    requests.push({endpoint,body,ifMatch:request.headers()["if-match"]});
    let bytes:Buffer, contentType:string;
    if(endpoint==="json") { bytes=Buffer.from(JSON.stringify(buildProjectJsonExport(before,"2026-10-01T16:00:00Z")));contentType="application/json"; }
    else if(endpoint==="excel") { bytes=Buffer.from(buildProjectExcelWorkbook(before,body as ProjectExcelExportRequest,undefined,canonicalMilestoneDashboard(state)));contentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; }
    else { bytes=Buffer.from(buildProjectGanttSvg(before,body as ProjectGanttImageExportRequest));contentType="image/svg+xml"; }
    artifacts[endpoint]=bytes; await route.fulfill({contentType,body:bytes});
  });
  const results=[];
  for(const format of ["json","excel","svg","png"] as const) {
    await exportTrigger(page).click();const dialog=page.getByRole("dialog",{name:"내보내기",exact:true});await dialog.getByLabel("형식",{exact:true}).selectOption(format);
    if(format==="excel") await dialog.getByLabel("일정 Dependency 제외",{exact:true}).check();
    const downloadPromise=page.waitForEvent("download"); await dialog.getByRole("button",{name:"내보내기",exact:true}).click();const download=await downloadPromise;
    const bytes=await readFile((await download.path())!);results.push({format,filename:download.suggestedFilename(),bytes:bytes.length,sha256:hash(bytes)});
    if(format==="json") { expect(bytes).toEqual(artifacts.json);const data=JSON.parse(bytes.toString());expect(data.tasks.map((task:{sourceTaskId:string})=>task.sourceTaskId).sort()).toEqual(before.data.tasks.map(task=>task.taskId).sort());expect(data.memberships).toEqual([{taskExternalId:state.tasks[0].externalId,milestoneExternalId:state.tasks[3].externalId}]); }
    else if(format==="excel") { expect(bytes).toEqual(artifacts.excel);const entries=workbookEntries(bytes),tasks=workbookSheet(entries,"Tasks");for(const task of before.data.tasks) expect(tasks).toContain(task.taskId);expect(workbookSheet(entries,"Gantt")).toContain("Stable milestone");expect(entries.get("xl/workbook.xml")).not.toContain('name="Dependencies"');expect(tasks).toContain(state.tasks[3].taskId); }
    else if(format==="svg") { expect(bytes).toEqual(artifacts['gantt-svg']);for(const task of before.data.tasks)expect(bytes.toString()).toContain(task.name); }
    else { expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");const dimensions=/<svg[^>]*width="(\d+)" height="(\d+)"/.exec(artifacts['gantt-svg'].toString())!;expect(bytes.readUInt32BE(16)).toBe(Number(dimensions[1]));expect(bytes.readUInt32BE(20)).toBe(Number(dimensions[2])); }
    await expect(dialog).toBeHidden();await expect(exportTrigger(page)).toBeFocused();await expectSameGanttRoot(page,identity);await expect(search).toHaveValue("Stable summary");await expect(toggle(page)).toHaveAttribute("aria-pressed","false");await expect(rowNamed(page,"Existing summary child")).toHaveCount(0);
  }
  for(const request of requests){expect(request.ifMatch).toBe(`"${before.data.project.revision}"`);expect(request.body).toMatchObject({scope:"project"});expect(JSON.stringify(request.body)).not.toMatch(/visibleTaskIds|showMilestones|rootTask|search|collapsed/);if(request.endpoint!=="json")expect(request.body).toMatchObject({hierarchyDisplay:"expanded"});}
  await expect.poll(()=>page.evaluate(()=>{const v=Reflect.get(window,"__issue553BlobURLs") as {created:string[];revoked:string[]};return [...v.created].sort().join() === [...v.revoked].sort().join();})).toBe(true);
  expect(await snapshot(page)).toEqual(before);expect(state.posts).toHaveLength(0);expect(state.patchRequests).toHaveLength(0);
  await capture(page,"off-search-collapse-export",{requests,results,fullCanonicalIds:before.data.tasks.map(task=>task.taskId),sameSnapshot:true,instance:identity,blobURLs:await page.evaluate(()=>Reflect.get(window,"__issue553BlobURLs")),meaning:"UI transport + existing real pure builders over synthetic snapshot; actual HTTP/nativeSQLite has separate backend evidence"});
});

test("#553 same-date cluster exact ID edits the same canonical snapshot and retains ordinary siblings", async ({page})=>{
  await page.setViewportSize({width:1440,height:1000});const state=await setup(page,true,true),identity=await rememberGanttRoot(page),before=await snapshot(page),target=state.tasks[3];
  const patches:unknown[]=[];
  await page.route(`**${taskPath}/${target.taskId}`,async route=>{
    const request=route.request();if(request.method()!=="PATCH"){await route.fallback();return;}
    expect(request.headers()["if-match"]).toBe(`"${state.project.revision}"`);const body=request.postDataJSON();patches.push(body);Object.assign(target,{name:body.name ?? target.name,requestedStart:body.start ?? target.requestedStart,start:body.start ?? target.start,end:body.start ?? target.end});state.project.revision++;
    const response:TaskMutationResponse={data:{project:{...state.project},tasks:canonicalMilestoneTasks(state),links:state.links,warnings:[],operation:{kind:"taskUpdate",changedTaskExternalIds:[target.externalId],deletedTaskExternalIds:[],deletedLinkIds:[]}}};await route.fulfill({json:response});
  });
  const frame=page.locator(".project-gantt-frame");await frame.evaluate(async node=>Reflect.get(node,"__masterganttMilestoneTimeline").reveal("2026-10-05"));
  const cluster=frame.getByRole("button",{name:/Milestone 2개/});await expect(cluster).toBeVisible();await cluster.focus();await page.keyboard.press("Enter");
  const list=page.getByRole("dialog",{name:"Milestone 날짜 목록",exact:true}),item=list.locator(`[data-milestone-lane-trigger="${target.taskId}"]`);await expect(item).toHaveCount(1);await item.focus();await page.keyboard.press("Enter");
  const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});await expect(editor.getByLabel("작업명",{exact:true})).toHaveValue("Stable milestone");await editor.getByLabel("작업명",{exact:true}).fill("Renamed exact milestone");await editor.getByLabel("요청 시작일",{exact:true}).fill("2026-10-06");await editor.getByRole("button",{name:"저장",exact:true}).click();
  await expect.poll(()=>patches.length).toBe(1);await expect(editor).toBeHidden();const after=await snapshot(page);expect(after.data.project.revision).toBe(before.data.project.revision+1);expect(after.data.tasks.find(task=>task.taskId===target.taskId)).toMatchObject({name:"Renamed exact milestone",start:"2026-10-06"});
  expect(after.data.tasks.filter(task=>task.taskId!==target.taskId)).toEqual(before.data.tasks.filter(task=>task.taskId!==target.taskId));expect(after.data.links).toEqual(before.data.links);await expectSameGanttRoot(page,identity);
  await capture(page,"cluster-canonical-edit",{targetId:target.taskId,patches,beforeRevision:before.data.project.revision,afterRevision:after.data.project.revision,otherCanonicalTasksUnchanged:true,instance:identity});
});

test("#553 export pending duplicate/Escape guard and stale error keep OFF/filter/canonical state",async({page})=>{
  await page.setViewportSize({width:1024,height:1000});const state=await setup(page),identity=await rememberGanttRoot(page),before=await snapshot(page);
  await toggle(page).click();const search=page.getByRole("searchbox",{name:"작업명, 설명, External ID 검색"});await search.fill("Existing");
  let requests=0, release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route(`**${projectPath}/exports/json`,async route=>{requests++;if(requests===1)await route.fulfill({status:412,json:{error:{code:"REVISION_MISMATCH"}}});else {await gate;await route.fulfill({contentType:"application/json",body:JSON.stringify(buildProjectJsonExport(before,"2026-10-01T16:00:00Z"))});}});
  await exportTrigger(page).click();const dialog=page.getByRole("dialog",{name:"내보내기",exact:true});await dialog.getByLabel("형식",{exact:true}).selectOption("json");await dialog.getByRole("button",{name:"내보내기",exact:true}).click();await expect(dialog.getByRole("alert")).toBeVisible();expect(requests).toBe(1);
  await expect(dialog.getByLabel("형식",{exact:true})).toHaveValue("json");expect(await snapshot(page)).toEqual(before);
  const downloaded=page.waitForEvent("download");await dialog.getByRole("button",{name:"내보내기",exact:true}).click();await expect(dialog.getByRole("button",{name:"생성 중…",exact:true})).toBeDisabled();await page.keyboard.press("Escape");await expect(dialog).toBeVisible();expect(requests).toBe(2);
  await dialog.getByRole("button",{name:"생성 중…",exact:true}).dispatchEvent("click");expect(requests).toBe(2);release();await downloaded;await expect(dialog).toBeHidden();await expect(exportTrigger(page)).toBeFocused();await expect(search).toHaveValue("Existing");await expect(toggle(page)).toHaveAttribute("aria-pressed","false");await expectSameGanttRoot(page,identity);expect(await snapshot(page)).toEqual(before);expect(state.posts).toHaveLength(0);expect(state.patchRequests).toHaveLength(0);
  await capture(page,"export-pending-stale-guards",{requests,staleAtomic:true,duplicateSuppressed:true,pendingEscapeSuppressed:true,originalRevision:before.data.project.revision,instance:identity});
});

test("#553 exact member filter OFF/reset and Dashboard date return preserve hierarchy/conditions",async({page})=>{
  await page.setViewportSize({width:1024,height:1000});const state=await setup(page),before=await snapshot(page),identity=await rememberGanttRoot(page);
  await page.locator(".project-schedule-filter-toolbar").getByRole("button",{name:"완료 단계: 전체",exact:true}).click();await page.getByRole("option",{name:/Stable milestone/}).click();
  await expect(rowNamed(page,"Existing summary child")).toBeVisible();await expect(rowNamed(page,"Stable leaf")).toHaveCount(0);await toggle(page).click();await expect(toggle(page)).toHaveAttribute("aria-pressed","false");
  await page.getByRole("button",{name:"초기화",exact:true}).click();await expect(rowNamed(page,"Stable leaf")).toBeVisible();await expect(toggle(page)).toHaveAttribute("aria-pressed","false");
  await page.getByRole("tab",{name:"Milestone 대시보드",exact:true}).click();const panel=page.locator("#project-panel-milestones");await panel.getByLabel("단계 검색",{exact:true}).fill("Stable milestone");const trigger=panel.locator(`[data-milestone-task-id="${state.tasks[3].taskId}"]`).getByRole("button",{name:/ 관리$/});await trigger.click();await page.getByRole("dialog",{name:/ 관리$/}).getByRole("button",{name:"해당 날짜에서 보기",exact:true}).focus();await page.keyboard.press("Enter");
  const marker=page.locator(`[data-milestone-lane-trigger="${state.tasks[3].taskId}"]`);await expect(marker).toBeFocused();
  const expectedGate=before.data.tasks.find(task=>task.taskId===state.tasks[3].taskId)!.stageGate!;
  const expectedStatus=expectedGate.manualEvent?"수동 단계":expectedGate.blocked?"Blocked":expectedGate.ready?"Ready":"진행 중";
  await expect(marker).toHaveAttribute("aria-label",new RegExp(`Stable milestone.*2026-10-05.*${state.tasks[3].externalId}.*읽기 전용.*미완료.*${expectedStatus}`));
  expect(await marker.getAttribute("title")).toBe(await marker.getAttribute("aria-label"));
  await marker.hover();await expect(page.locator(".project-milestone-lane-guide")).toHaveCount(1);await page.mouse.move(20,20);await expect(marker).toBeFocused();
  const markerFocus=await marker.evaluate(node=>{const r=node.getBoundingClientRect(),css=getComputedStyle(node),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {taskId:node.getAttribute("data-milestone-lane-trigger"),label:node.getAttribute("aria-label"),title:node.getAttribute("title"),rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},outline:css.outlineStyle,ring:parseFloat(css.outlineWidth)+parseFloat(css.outlineOffset),centerHit:hit===node||node.contains(hit)};});
  expect(markerFocus.taskId).toBe(state.tasks[3].taskId);expect(markerFocus.outline).not.toBe("none");expect(markerFocus.ring).toBe(6);expect(markerFocus.centerHit).toBe(true);expect(markerFocus.rect.x-6).toBeGreaterThanOrEqual(0);expect(markerFocus.rect.right+6).toBeLessThanOrEqual(1024);expect(markerFocus.rect.y-6).toBeGreaterThanOrEqual(0);expect(markerFocus.rect.bottom+6).toBeLessThanOrEqual(1000);await expect(toggle(page)).toHaveAttribute("aria-pressed","true");expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(`mastergantt:milestone-timeline:${id}`)!).showMilestones,publicId)).toBe(false);
  await capture(page,"single-marker-date-focus",{exactMilestoneId:state.tasks[3].taskId,markerFocus,canonicalSnapshotEqual:true,storedOff:true,instance:identity});
  await page.getByRole("button",{name:"원래 보기로 돌아가기",exact:true}).click();await expect(trigger).toBeFocused();await expect(panel.getByLabel("단계 검색",{exact:true})).toHaveValue("Stable milestone");await page.getByRole("tab",{name:"일정",exact:true}).click();await expect(toggle(page)).toHaveAttribute("aria-pressed","false");expect(await snapshot(page)).toEqual(before);await expectSameGanttRoot(page,identity);expect(state.posts).toHaveLength(0);expect(state.patchRequests).toHaveLength(0);
  await capture(page,"member-filter-date-return",{exactMilestoneId:state.tasks[3].taskId,inheritedMemberId:state.tasks[1].taskId,markerFocus,canonicalSnapshotEqual:true,storedOff:true,instance:identity});
});

async function setupResourceDrill(page:Page) {
 const state=await installStatefulProjectFixture(page); state.sessionEditable=false;
 const template=state.tasks[2], parent=state.tasks[0];
 state.tasks.splice(1,2,...Array.from({length:60},(_,i)=>({...template,taskId:`00005280-0000-4000-8000-${String(i).padStart(12,'0')}`,externalId:i===0?"LEAF-1":`DRILL-${i}`,name:`Stable leaf ${i}`,parentExternalId:parent.externalId,siblingOrder:i,progress:50,status:'in_progress' as const})));
 const tasks=state.tasks.filter(t=>t.type==='task');
 let catalogRevision=1; let delayed=false; const gate=deferred();
 const identity=()=>({projectPublicId:publicId,projectRevision:state.project.revision,catalogRevision,calendarRevision:'c'.repeat(64),dataSnapshotId:'d'.repeat(64)});
 const context=(data:ReturnType<typeof resourceDashboardUiFixture>):ResourceDrillSourceContext=>({...identity(),range:data.range,asOfDate:data.asOfDate,mdPerMm:data.mdPerMm,mdPerMmSource:data.mdPerMmSource,mdPerMmProvided:data.filters.mdPerMmProvided,sourceProjection:{kind:'report'}});
 function report(q:URLSearchParams) {
  q = new URLSearchParams(q);
  for(const key of ["view","snapshotId","dimension","id","metric","offset","limit","assignmentScope","resourceId","milestoneTaskId"]) q.delete(key);
  const data=resourceDashboardUiFixture(state,q);
  const ids=q.getAll('taskIds'); const selected=ids.length?tasks.filter(t=>ids.includes(t.taskId)):tasks;
  const n=selected.length;
  data.mdPerMm=data.filters.mdPerMmProvided?data.filters.mdPerMm:20; data.mdPerMmSource=data.filters.mdPerMmProvided?'query':'environment';
  const summary=(s:typeof data.summary)=>({...s,taskCount:n,assignmentCount:n,inProgress:n,resourceCount:n?1:0,completion:{numerator:0,denominator:n,percent:n?0:null},assignedTaskProgress:{numerator:n*50,denominator:n,percent:n?50:null},effort:{knownMd:n*5,plannedMd:n*5,plannedMm:data.mdPerMm?n*5/data.mdPerMm:null,state:n?'configured' as const:'empty' as const,partial:false,unsetCount:0}});
  data.summary=summary(data.summary); data.resources=data.resources.map(r=>({...r,summary:summary(r.summary)}));data.groups=data.groups.map(r=>({...r,summary:summary(r.summary)}));data.roleTotals=data.roleTotals.map(r=>({...r,summary:summary(r.summary)}));data.catalogRevision=catalogRevision;data.resourceScopeContext=context(data);return data;
 }
 function detail(q:URLSearchParams) {
  const data=resourceDashboardDetailUiFixture(state,q), base=data.rows[0];
  data.totalCount=60;data.nextOffset=data.offset+50<60?data.offset+50:null;
  data.rows=tasks.slice(data.offset,data.offset+50).map(t=>({...base,taskId:t.taskId,taskName:t.name,externalId:t.externalId,wbsPath:[{taskId:parent.taskId,name:parent.name}]}));
  return data;
 }
 await page.route(`**${projectPath}/resource-dashboard?*`,route=>route.fulfill({json:{data:report(new URL(route.request().url()).searchParams)}}));
 await page.route(`**${projectPath}/resource-dashboard/details?*`,route=>route.fulfill({json:{data:detail(new URL(route.request().url()).searchParams)}}));
 await page.route(`**${projectPath}/resource-dashboard/scope?*`,async route=>{
  const q=new URL(route.request().url()).searchParams;
  if(q.get('view')==='context') return route.fulfill({json:{data:identity()}});
  if(delayed){await gate.promise;return route.fulfill({status:409,json:{error:{code:'REPORT_STALE'}}}).catch(()=>undefined);}
  const data=report(q),ctx=context(data);ctx.sourceProjection={kind:'details',selector:data.summary.selector,view:'assignments'};
  return route.fulfill({json:{data:{schema:'resource-dashboard/1',snapshotId:data.snapshotId,sourceContext:ctx,taskIds:tasks.map(t=>t.taskId),assignmentIds:tasks.map((_,i)=>`00005281-0000-4000-8000-${String(i).padStart(12,'0')}`),ancestorSummaryIds:[parent.taskId],taskCount:60,assignmentCount:60}}});
 });
 await page.route(`**${projectPath}/resource-dashboard/query`,route=>{
  const input=route.request().postDataJSON() as ResourceDrillQueryInput;
  const q=new URLSearchParams();for(const [key,value]of Object.entries(input.filters)){if(Array.isArray(value))for(const item of value)q.append(key,String(item));else q.set(key,String(value));}
  return route.fulfill({json:{data:report(q),drill:{...input,targetFilters:normalizedDrillFilters(input.filters),assignmentScope:'exact-source-intersection',projectReferenceScope:'same-resource-population-and-period'}}});
 });
 await page.goto(`/projects/${publicId}`);await page.getByRole('tab',{name:'리소스',exact:true}).click();
 const root=page.locator('[data-resource-dashboard="true"]:visible');await expect(root).toHaveAttribute('data-ready','true');
 return {state,root,tasks, report,identity,setCatalog:(value:number)=>catalogRevision=value,delay:()=>delayed=true,release:()=>gate.resolve()};
}

test("#553 Resource page10 whole60 exact-ID scope return preserves OFF/instance and full member hierarchy",async({page})=>{
  await page.setViewportSize({width:1440,height:1000});const f=await setupResourceDrill(page);
  await page.getByRole("tab",{name:"일정",exact:true}).click();const identity=await rememberGanttRoot(page),before=await snapshot(page);await toggle(page).click();await page.getByRole("tab",{name:"리소스",exact:true}).click();
  await f.root.locator(".resource-dashboard-kpis > div").filter({hasText:/^할당 Task/}).getByRole("button").click();const detail=f.root.locator(".resource-dashboard-detail");await expect(detail.locator("tbody tr")).toHaveCount(50);await detail.getByRole("button",{name:"다음",exact:true}).click();await expect(detail.locator("tbody tr")).toHaveCount(10);
  const trigger=detail.getByRole("button",{name:"전체 범위 일정 보기",exact:true});const originalTrigger=await trigger.elementHandle();await trigger.evaluate(node=>{const observations:unknown[]=[];Reflect.set(window,"__issue553ResourceFocus",observations);document.addEventListener("focusin",()=>{const active=document.activeElement as HTMLElement;observations.push({label:active.getAttribute("aria-label")??active.textContent,role:active.getAttribute("role"),originalConnected:node.isConnected,originalDisabled:(node as HTMLButtonElement).disabled,originalFocused:active===node,originalHiddenOrInert:!!node.closest("[hidden],[inert]"),originalRect:(()=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})(),activeRect:(()=>{const r=active.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})()});});});const scopeResponse=page.waitForResponse(response=>new URL(response.url()).pathname===`${projectPath}/resource-dashboard/scope`&&new URL(response.url()).searchParams.get("view")!=="context");await trigger.focus();await page.keyboard.press("Enter");const scope=(await (await scopeResponse).json()).data;expect([...scope.taskIds].sort()).toEqual(f.tasks.map(task=>task.taskId).sort());expect(scope.taskCount).toBe(60);expect(scope.assignmentCount).toBe(60);const strip=page.getByRole("region",{name:"임시 조회 범위",exact:true});await expect(strip).toContainText("고유 Task 60");await expect(strip).toContainText("Assignment 60");await expect(strip).toContainText("조상 문맥 1");
  const expectedProjectedIds=[f.state.tasks[0].taskId,...f.tasks.map(task=>task.taskId)].sort();
  const readProjectedIds=()=>page.locator(".project-gantt-frame").evaluate(node=>(Reflect.get(node,"__masterganttMilestoneTimeline").read().rows as {id:string}[]).map(row=>row.id.replace(/^:/,"" )).sort());
  await expect.poll(readProjectedIds).toEqual(expectedProjectedIds);const allProjectedIds=await readProjectedIds();expect(allProjectedIds).toHaveLength(61);
  const visibleIds=await page.locator(".wx-table-container .wx-row[data-id]").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("data-id")!.replace(/^:/,"")));expect(visibleIds.every(id=>f.tasks.some(task=>task.taskId===id)||id===f.state.tasks[0].taskId)).toBe(true);await expect(toggle(page)).toHaveAttribute("aria-pressed","false");await expectSameGanttRoot(page,identity);
  await strip.getByRole("button",{name:/원래 보기/}).focus();await page.keyboard.press("Enter");await expect(detail.locator("tbody tr")).toHaveCount(10);const originalTriggerConnected=await originalTrigger!.evaluate(node=>node.isConnected);await capture(page,"resource-focus-before-assert",{originalTriggerConnected,currentFocus:await page.evaluate(()=>{const node=document.activeElement as HTMLElement;return {label:node.getAttribute("aria-label")??node.textContent,role:node.getAttribute("role"),events:Reflect.get(window,"__issue553ResourceFocus")};}),originalDisabled:await originalTrigger!.evaluate(node=>(node as HTMLButtonElement).disabled)});const returnEvents=await page.evaluate(()=>Reflect.get(window,"__issue553ResourceFocus") as {label:string;role:string|null;originalConnected:boolean;originalDisabled:boolean;originalHiddenOrInert:boolean}[]);const fallbackEvent=returnEvents.filter(event=>event.label==="리소스"&&event.role==="tab").at(-1);const fallbackAllowed=!!fallbackEvent&&(!fallbackEvent.originalConnected||fallbackEvent.originalDisabled||fallbackEvent.originalHiddenOrInert);const restoredFocus=fallbackAllowed?page.getByRole("tab",{name:"리소스",exact:true}):trigger;await expect(restoredFocus).toBeFocused();const focus=await restoredFocus.evaluate(node=>{const r=node.getBoundingClientRect(),style=getComputedStyle(node);return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,viewport:{width:innerWidth,height:innerHeight},ring:parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset),outline:style.outlineStyle,active:document.activeElement===node};});expect(focus.active).toBe(true);expect(focus.outline).not.toBe("none");expect(focus.x-focus.ring).toBeGreaterThanOrEqual(0);expect(focus.right+focus.ring).toBeLessThanOrEqual(1440);expect(focus.y-focus.ring).toBeGreaterThanOrEqual(0);expect(focus.bottom+focus.ring).toBeLessThanOrEqual(1000);
  expect(await snapshot(page)).toEqual(before);await expectSameGanttRoot(page,identity);expect(f.state.posts).toHaveLength(0);expect(f.state.patchRequests).toHaveLength(0);await capture(page,"resource-full60-page10-return",{fullTaskIds:f.tasks.map(task=>task.taskId),fullTaskCount:60,detailPage:10,returnedScope:scope,allProjectedIds,projectionOracle:"기존 bounded development read-only probe의 installed Core tasks; cap500 안61개 전체집합. 실제virtualDOM 부분집합과구분",visibleNativeIds:visibleIds,originalTriggerConnected,focusReturn:fallbackAllowed?"existing unavailable trigger: resource tab fallback":"original detail trigger",returnEvents,focus,instance:identity,canonicalSnapshotEqual:true});
});
