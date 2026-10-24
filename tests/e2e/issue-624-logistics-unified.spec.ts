import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { seedIssue623 } from "./fixtures/issue-623-target-resource";
import { issue621ResourcePassword } from "./fixtures/issue-621-target-project";
import { targetMasterPassword } from "./fixtures/target-project";
import { defaultWbsViewSpec } from "../../src/features/resources/wbs-view-model";
import { readWbsViewResponse } from "../../src/features/resources/wbs-view-transport";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";

test.use({...isolatedApplicationOptions,isolatedProjectMasterAdminPassword:targetMasterPassword,isolatedResourceAdminPassword:issue621ResourcePassword,viewport:{width:1440,height:1000}});

test("#624/#785 같은 canonical 원본을 실물 3관점·정확 drill·full Gate·5폭으로 조회",async({page,isolatedApplication:origin,observeIsolatedApi},info)=>{
  test.setTimeout(150_000);const f=await seedIssue623(page,origin,observeIsolatedApi);
  const added=await f.mutate("/tasks",{name:"교차 조회 Gate",type:"milestone",start:"2026-10-09",duration:0,progress:0});const milestone=(await added.json()).data.tasks.find((row:{name:string})=>row.name==="교차 조회 Gate");expect(milestone).toBeTruthy();await f.mutate(`/tasks/${f.task.taskId}`,{explicitMilestoneTaskId:milestone.taskId},"patch");await page.reload();
  const before=await f.snapshot(),instance=await page.locator(".project-gantt-frame").getAttribute("data-project-gantt-instance");
  const requests:string[]=[],writes:string[]=[];page.on("request",request=>{const path=new URL(request.url()).pathname;if(/\/logistics\/targets|\/target-bindings/.test(path))requests.push(path);if(path.startsWith(`/api/projects/${f.publicId}`)&&["POST","PUT","PATCH","DELETE"].includes(request.method())&&!isWbsViewReadQuery(request)&&!path.endsWith("/resource-dashboard/query"))writes.push(path);});
  const roots=["process","equipment","system"] as const;
  let taskIds:string[]|undefined,assignmentIds:string[]|undefined,knownMd:number|undefined,fullGate:unknown;
  for(const root of roots){
    const input={spec:defaultWbsViewSpec(root),filters:{from:"2026-10-05",to:"2026-10-09",asOfDate:"2026-10-09",mdPerMm:20},projection:{kind:"report" as const}};
    const response=await page.request.post(`${f.api}/resource-dashboard/views`,{headers:{Origin:origin},data:input});expect(response.status(),await response.text()).toBe(200);
    const report=readWbsViewResponse(await response.json(),{projectPublicId:f.publicId,projectRevision:before.data.project.revision,input});expect(report.projection).toBe("report");if(report.projection!=="report")throw new Error("report required");
    taskIds??=[...report.taskIds].sort();assignmentIds??=[...report.assignmentIds].sort();knownMd??=report.totals.assignments.effort.knownMd;fullGate??=report.fullMilestones.find(row=>row.milestoneTaskId===milestone.taskId)?.stageGate;
    expect([...report.taskIds].sort()).toEqual(taskIds);expect([...report.assignmentIds].sort()).toEqual(assignmentIds);expect(report.totals.assignments.effort.knownMd).toBe(knownMd);expect(report.totals.assignments.effort.knownMd).toBe(5);expect(fullGate).toBeDefined();expect(report.fullMilestones.find(row=>row.milestoneTaskId===milestone.taskId)?.stageGate).toEqual(fullGate);expect(report.totals.relatedMembers.equipmentQuantity).toBe(15);expect(report.totals.relatedMembers.systemCount).toBe(3);
    const selected=report.children.find(row=>row.assignmentIds.length);expect(selected).toBeTruthy();
    const detailInput={...input,projection:{kind:"details" as const,snapshotId:report.snapshotId,path:selected!.path,view:"assignments" as const,offset:0,limit:50}};
    const details=await page.request.post(`${f.api}/resource-dashboard/views`,{headers:{Origin:origin},data:detailInput});expect(details.status()).toBe(200);const detail=readWbsViewResponse(await details.json(),{projectPublicId:f.publicId,projectRevision:before.data.project.revision,input:detailInput});expect(detail.projection).toBe("details");if(detail.projection==="details")expect([...new Set(detail.rows.map(row=>row.assignment!.assignmentId))].sort()).toEqual([...selected!.assignmentIds].sort());
    await openWorkspaceView(page,"unified");await page.getByRole("tablist",{name:"대시보드 보기"}).getByRole("tab",{name:root==="process"?"공정&WorkArea":root==="equipment"?"설비":"물류 시스템",exact:true}).click();
    const visible=page.locator(`[data-wbs-view="${root}"]:visible`);await expect(visible).toHaveAttribute("data-wbs-ready","true");
    for(const width of [390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});const g=await visible.evaluate(node=>{const b=node.getBoundingClientRect();const owner=node.querySelector<HTMLElement>("[data-wbs-scroll]")!;return {left:b.left,right:b.right,document:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,scrollWidth:owner.scrollWidth,clientWidth:owner.clientWidth,overflow:getComputedStyle(owner).overflowX};});expect(g.left).toBeGreaterThanOrEqual(0);expect(g.right).toBeLessThanOrEqual(width+1);expect(g.document).toBeLessThanOrEqual(g.viewport+1);if(g.scrollWidth>g.clientWidth+1)expect(["auto","scroll"]).toContain(g.overflow);await info.attach(`physical-${root}-${width}.png`,{body:await visible.screenshot(),contentType:"image/png"});}
    // Exact detail close restores a visible owner control; query-only round trip.
    const detailButton=visible.getByRole("button",{name:"상세",exact:true}).first();await detailButton.click();const panel=visible.getByRole("region",{name:"계층 원본 상세",exact:true});await expect(panel).toBeVisible();await expect(panel.getByRole("button",{name:"상세 닫기",exact:true})).toBeVisible();await panel.getByRole("button",{name:"상세 닫기",exact:true}).focus();await page.keyboard.press("Escape");await expect(panel).toHaveCount(0);await expect(detailButton).toBeFocused();
  }
  expect(requests).toEqual([]);expect(writes).toEqual([]);expect((await f.snapshot()).data.tasks).toEqual(before.data.tasks);expect((await f.snapshot()).data.project.revision).toBe(before.data.project.revision);await expect(page.locator(".project-gantt-frame")).toHaveAttribute("data-project-gantt-instance",instance!);
});
