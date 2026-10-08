import {test, expect, type Page} from '@playwright/test';
import {installStatefulProjectFixture, projectPath, publicId, deferred} from '../fixtures/stateful-project';
import {resourceDashboardUiFixture,resourceDashboardDetailUiFixture} from '../fixtures/resource-dashboard-ui';
import {dashboardFixture} from '../fixtures/milestone-dashboard';
import {normalizedDrillFilters} from '../../src/features/resources/resource-drill-transport';
import type {ResourceDrillQueryInput, ResourceDrillSourceContext} from '../../src/contracts/resource-drill';
async function setup(page:Page) {
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
test('#528 전체60 Task는 page50과 구분하고 조상·조건 확인·Escape focus를 보존',async({page},info)=>{
 const f=await setup(page);await f.root.locator('.resource-dashboard-kpis > div').filter({hasText:/^할당 Task/}).getByRole('button').click();
 const detail=f.root.locator('.resource-dashboard-detail');await expect(detail.locator('tbody tr')).toHaveCount(50);
 const next=detail.getByRole('button',{name:'다음',exact:true});await next.click();await expect(detail.locator('tbody tr')).toHaveCount(10);
 const trigger=detail.getByRole('button',{name:'전체 범위 일정 보기',exact:true});await trigger.click();
 const strip=page.getByRole('region',{name:'임시 조회 범위',exact:true});await expect(strip).toContainText('고유 Task 60');await expect(strip).toContainText('Assignment 60');await expect(strip).toContainText('조상 문맥 1');
 await strip.getByRole('button',{name:/원래 보기/}).click();await expect(detail.locator('tbody tr')).toHaveCount(10);
 await page.getByRole('tab',{name:'일정',exact:true}).click();await page.getByLabel('작업명, 설명, External ID 검색',{exact:true}).fill('Stable leaf 59');await page.getByRole('tab',{name:'리소스',exact:true}).click();await trigger.click();
 const dialog=page.getByRole('dialog',{name:'조회 범위 충돌 확인',exact:true});await expect(dialog).toContainText('59개를 숨깁니다');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 f.delay();await trigger.click();await strip.getByRole('button',{name:'이동 취소',exact:true}).click();f.release();await expect(page.getByRole('tab',{name:'리소스',exact:true})).toHaveAttribute('aria-selected','true');await expect(f.root).toHaveAttribute('data-ready','true');
 const bytes=Buffer.byteLength(JSON.stringify({data:f.report(new URLSearchParams())}));expect(bytes).toBeLessThan(2*1024*1024);await info.attach('bounded-whole-scope-fixture',{body:JSON.stringify({taskCount:60,visibleDetailPage:10,assignmentCount:60,bytes}),contentType:'application/json'});
});
test('#528 legacy M context null은 cross 명령만 잠그고 기존 원인과 Editor 조회를 유지',async({page})=>{
 const f=await setup(page);await page.route(`**${projectPath}/milestone-dashboard?*`,route=>{const data=dashboardFixture(f.state,new URL(route.request().url()).searchParams);data.resourceScopeContext=null;data.resourceScopeUnavailableReason='limit-exceeded';return route.fulfill({json:{data}});});
 await page.getByRole('tab',{name:'일정',exact:true}).click();await page.getByRole('tab',{name:'완료 단계 대시보드',exact:true}).click();const root=page.getByTestId('milestone-dashboard');await expect(root).toHaveAttribute('data-ready','true');await expect(root.getByText(/원본 문맥 조회 한도 초과/)).toBeVisible();await expect(root.getByRole('button',{name:'전체 일정에서 보고 범위 보기',exact:true})).toBeDisabled();await expect(root.getByRole('button',{name:/전체 원인 확인/}).first()).toBeEnabled();
});
