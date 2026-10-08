import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { installStatefulProjectFixture, publicId, projectPath } from "../fixtures/stateful-project";
import { dashboardFixture } from "../fixtures/milestone-dashboard";

test.use({ timezoneId: "America/New_York" });

interface Observation { gridWidth: number; instance: string; left: number; top: number; start: Date; end: Date; width: number; chartWidth: number; rows: { id: string; x: number; y: number }[]; links: { id: string; source: string; target: string; type: string }[]; canonicalIds: string[]; events: { action: string; left: number; top: number }[]; }
async function probe<T>(frame: Locator, method: string, argument?: unknown): Promise<T> {
  return frame.evaluate(async (node, input) => {
    const api = Reflect.get(node, "__masterganttMilestoneTimeline");
    return api[input.method](input.argument);
  }, { method, argument });
}
async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => { let n = 5; const tick = () => --n ? requestAnimationFrame(tick) : resolve(); requestAnimationFrame(tick); }));
}
async function fixture(page: Page, kind: "mixed" | "cluster" | "large" | "milestone-only" | "maximum" | "empty" = "mixed", editable = false) {
  const state = await installStatefulProjectFixture(page); state.sessionEditable = editable;
  const base = state.tasks[1];
  const task = (n: number, externalId: string, type: "task" | "summary" | "milestone", date: string | null, parentExternalId: string | null = null) => ({ ...base,
    taskId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, externalId, name: externalId, type, parentExternalId, siblingOrder: n,
    start: date, end: date, requestedStart: type === "summary" ? null : date, duration: date === null ? null : type === "milestone" ? 0 : 1, progress: date === null ? null : 0 });
  const tasks = kind === "empty" ? [] : kind === "milestone-only" || kind === "maximum" ? [task(1, "M-only", "milestone", kind === "maximum" ? "2199-12-31" : "2026-03-10")] : [
    task(1, "S1", "summary", "2024-02-29"), task(2, "T-leap", "task", "2024-02-29", "S1"),
    task(3, "M-leap", "milestone", "2024-02-29", "S1"), task(4, "LEAF-1", "task", "2026-01-31", "S1"),
    task(5, "S2", "summary", "2026-03-10"), task(6, "T-DST", "task", "2026-03-10", "S2"),
    task(7, "T-year", "task", "2027-01-01", "S2"), task(8, "M-DST", "milestone", "2026-03-10", "S2"),
    task(9, "M-year", "milestone", "2027-01-01"), task(10, "S-empty", "summary", null),
  ];
  state.tasks.splice(0, state.tasks.length, ...tasks);
  if (kind === "cluster" || kind === "large") {
    const milestones = kind === "large" ? 2000 : 61, ordinary = kind === "large" ? 1000 : 3;
    state.tasks.splice(0);
    for (let n = 1; n <= ordinary; n++) state.tasks.push(task(n, n === 1 ? "LEAF-1" : `TASK-${n}`, "task", "2026-10-05"));
    for (let n = 1; n <= milestones; n++) state.tasks.push({ ...task(ordinary + n, `M-${String(n).padStart(4, "0")}`, "milestone", n <= 51 ? "2026-10-05" : n <= 56 ? "2026-10-06" : "2026-10-19"), name: n < 3 ? "동일 이름 긴 Milestone 단계 · canonical ID로 구별" : `단계 ${n}` });
    state.tasks[ordinary + 2].status = "completed"; state.tasks[ordinary + 2].progress = 100;
  }
  if (kind !== "mixed") state.links.splice(0);
  if (kind === "mixed") state.links.push(
    { id: "TT", predecessorExternalId: "T-DST", successorExternalId: "T-year", type: "FS", lag: 0 },
    { id: "MM", predecessorExternalId: "M-leap", successorExternalId: "M-DST", type: "FS", lag: 0 },
    { id: "legacy", predecessorExternalId: "M-DST", successorExternalId: "T-year", type: "FS", lag: 0, legacyMixed: true });
  if (kind === "mixed") await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  // These unrelated report fixtures require a nonempty ordinary Task. Keep
  // their inactive requests bounded without inventing Tasks in zero-row cases.
  if (kind !== "mixed") await page.route(`**${projectPath}/resource-dashboard*`, route => route.fulfill({ status: 503, json: { error: { code: "SYNTHETIC_REPORT_UNAVAILABLE" } } }));
  if (kind !== "mixed") await page.route(`**${projectPath}/assigned-targets`, route => route.fulfill({ json: { data: { projectRevision: state.project.revision, catalogRevision: 1, assignments: [], targets: [] } } }));
  await page.route(`**${projectPath}/logistics/dashboard*`, route => route.fulfill({ status: 503, json: { error: { code: "SYNTHETIC_REPORT_UNAVAILABLE" } } }));
  await page.goto(`/projects/${publicId}`);
  const frame = page.locator(".project-gantt-frame");
  await expect.poll(() => frame.evaluate(node => Boolean(Reflect.get(node, "__masterganttMilestoneTimeline")))).toBe(true);
  await settle(page);
  return { state, frame };
}

test("#551 maximum canonical date Week metadata fails closed for Calendar working days", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Keep the existing today-inclusive axis bounded; this changes fixture time,
  // not the application's supported Calendar or timeline range policy.
  await page.clock.setFixedTime(new Date("2199-12-01T12:00:00-05:00"));
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const { state, frame } = await fixture(page, "maximum");
  await page.getByRole("button", { name: "주", exact: true }).click(); await settle(page);
  await probe(frame, "reveal", "2199-12-31"); await settle(page);
  const upper = frame.locator(".project-gantt-week-calendar-21991230");
  await expect(upper).toContainText("2199.12→2200.01");
  await expect(upper).toHaveAttribute("aria-label", /2199-12-30 이상, 2200-01-06 미만.*ISO 2200-W01/);
  const lower = frame.locator(".project-gantt-week-date-21991230"); await lower.focus();
  await expect(page.getByRole("tooltip")).toContainText("근무일: 미산정");
  await expect(page.getByRole("tooltip")).toContainText("주 전체가 지원 Calendar 날짜 범위를 벗어나");
  await expect(page.getByRole("tooltip")).toContainText("ISO 2200-W01");
  expect(errors).toEqual([]); expect(state.posts.length + state.patchRequests.length).toBe(0);
  await info.attach("maximum-date-metadata", { body: JSON.stringify({ date: "2199-12-31", exclusiveEndMetadata: "2200-01-06", calendarWorkingDays: null, errors, mutationCount: 0 }), contentType: "application/json" });
  await captureLane(page,info,"maximum-date-metadata",{date:"2199-12-31",exclusiveEndMetadata:"2200-01-06",calendarWorkingDays:null,errors,mutationCount:0});
});

async function focusObservation(control: Locator) {
  return control.evaluate(node => {
    const r=node.getBoundingClientRect(), style=getComputedStyle(node), owner=node.closest(".project-gantt-scroll")?.getBoundingClientRect();
    return { x:r.x,y:r.y,right:r.right,bottom:r.bottom, owner:owner?{x:owner.x,right:owner.right,y:owner.y,bottom:owner.bottom}:null,
      outline:style.outlineStyle,outset:parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset), active:document.activeElement===node,
      centerHit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===node || node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) };
  });
}
async function changedSnapshot(page:Page, state:Awaited<ReturnType<typeof installStatefulProjectFixture>>) {
  state.project.revision++;
  await page.evaluate(({publicId,revision})=>window.dispatchEvent(new StorageEvent("storage",{key:`mastergantt:project-revision:${publicId}`,newValue:String(revision)})),{publicId,revision:state.project.revision});
}
async function captureLane(page:Page, info:import("@playwright/test").TestInfo, name:string, data:object) {
  const paths=["src/features/gantt/project-gantt.tsx","src/features/projects/project-readonly-view.tsx","src/features/gantt/milestone-timeline-adapter.ts","src/features/gantt/milestone-timeline-lane.tsx","src/features/gantt/milestone-timeline-lane-model.ts","src/features/gantt/milestone-timeline-lane.css","src/features/gantt/gantt-scale-toolbar.css","src/features/gantt/week-calendar-interval.ts","src/features/gantt/week-timeline-tooltip.ts","tests/e2e/milestone-timeline-lane.spec.ts"];
  const evidence={capturedAt:new Date().toISOString(),environment:"Chromium/Next dev/Core2.7.3, synthetic API, America/New_York",...data,sourceHashes:Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash("sha256").update(await readFile(path)).digest("hex")])))};
  await info.attach(name,{body:JSON.stringify(evidence),contentType:"application/json"});
  if(process.env.CAPTURE_ISSUE_551){const dir=`output/playwright/issue-551/${process.env.CAPTURE_ISSUE_551}`;await mkdir(dir,{recursive:true});await writeFile(`${dir}/${name}.json`,JSON.stringify(evidence,null,2));await page.screenshot({path:`${dir}/${name}.png`});}
}

test("#551 singleton focus/hover guide and canonical Editor return preserve native selection",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000}); const {state,frame}=await fixture(page,"milestone-only"),before=await probe<Observation>(frame,"read");
  await probe(frame,"preview",true); const marker=frame.locator(".project-milestone-lane-marker"); await expect(marker).toHaveCount(1);
  await marker.focus(); await expect(frame.locator(".project-milestone-lane-guide")).toHaveCount(1);
  await marker.hover(); await page.mouse.move(20,20); await expect(marker).toBeFocused(); await expect(frame.locator(".project-milestone-lane-guide")).toHaveCount(1);
  const focus=await focusObservation(marker); expect(focus.active).toBe(true); expect(focus.outset).toBe(6); expect(focus.centerHit).toBe(true);
  expect(focus.x-6).toBeGreaterThanOrEqual(focus.owner!.x);expect(focus.right+6).toBeLessThanOrEqual(focus.owner!.right);
  await page.keyboard.press("Enter");const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});await expect(editor).toBeVisible();await expect(editor).toContainText("M-only");
  await page.keyboard.press("Escape");await expect(editor).toBeHidden();await expect(marker).toBeFocused();
  expect((await probe<Observation>(frame,"read")).instance).toBe(before.instance);expect(state.posts.length+state.patchRequests.length).toBe(0);
  await captureLane(page,info,"singleton-focus-guide",{focus,instance:before.instance,mutationCount:0});
});

test("#551 same-date/near-date cluster pagination keyboard and exact-ID Editor return",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000}); const {state,frame}=await fixture(page,"cluster");await probe(frame,"preview",true);await probe(frame,"reveal","2026-10-05");await settle(page);
  const markers=frame.locator(".project-milestone-lane-marker");await expect(markers).toHaveCount(2);
  expect(await markers.evaluateAll(nodes=>nodes.filter(node=>(node as HTMLElement).tabIndex===0).length)).toBe(1);
  await markers.first().focus();await page.keyboard.press("End");await expect(markers.last()).toBeFocused();await page.keyboard.press("Home");await expect(markers.first()).toBeFocused();
  await page.keyboard.press("Enter");const list=page.getByRole("dialog",{name:"Milestone 날짜 목록",exact:true});await expect(list).toBeVisible();
  await expect(list.locator("[data-milestone-lane-trigger]")).toHaveCount(50);
  await list.getByRole("button",{name:"다음 50개",exact:true}).click();await expect(list.locator("[data-milestone-lane-trigger]")).toHaveCount(6);
  await list.getByRole("button",{name:"이전 50개",exact:true}).click();const items=list.locator("[data-milestone-lane-trigger]");await items.first().focus();await page.keyboard.press("End");await expect(items.last()).toBeFocused();await page.keyboard.press("Home");await expect(items.first()).toBeFocused();await page.keyboard.press("ArrowDown");await expect(items.nth(1)).toBeFocused();
  const id=await items.nth(1).getAttribute("data-milestone-lane-trigger");expect(id).toBe(state.tasks.find(task=>task.externalId==="M-0002")!.taskId);
  await page.keyboard.press("Enter");const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});await expect(editor).toContainText("M-0002");await page.keyboard.press("Escape");await expect(editor).toBeHidden();await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("Escape");await expect(list).toBeHidden();await expect(markers.first()).toBeFocused();
  expect(state.posts.length+state.patchRequests.length).toBe(0);await captureLane(page,info,"cluster-keyboard",{clusterCount:2,firstCluster:56,pageSize:50,secondPage:6,openedTaskId:id,mutationCount:0});
});

test("#551 enabled slot preserves peer Chart height/scroll and fullscreen Grid/resize alignment",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});const {state,frame}=await fixture(page,"large");await probe(frame,"preview",true);await probe(frame,"reveal","2026-10-05");await settle(page);
  await frame.locator(".wx-chart").hover();await page.mouse.wheel(0,570);await settle(page);
  const before=await probe<Observation>(frame,"read"),height=await frame.locator(".wx-chart").evaluate(node=>node.getBoundingClientRect().height);
  expect(before.top).toBeGreaterThan(0);
  await page.getByRole("tab",{name:"Milestone 대시보드",exact:true}).click();
  expect(await frame.locator(".project-milestone-lane").evaluate(node=>node.getBoundingClientRect().height)).toBe(64);
  expect(await frame.locator(".wx-chart").evaluate(node=>node.getBoundingClientRect().height)).toBe(height);
  await page.getByRole("tab",{name:"일정",exact:true}).click();await settle(page);const returned=await probe<Observation>(frame,"read");expect(returned.instance).toBe(before.instance);expect(returned.top).toBe(before.top);expect(returned.left).toBe(before.left);
  const splitter=frame.locator(".wx-resizer.wx-resizer-display-all").first(),box=(await splitter.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+60);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+60,{steps:5});await page.mouse.up();await settle(page);
  expect((await probe<Observation>(frame,"read")).gridWidth).not.toBe(before.gridWidth);
  await captureLane(page,info,"peer-resize-diagnostic",{core:await probe(frame,"read"),measurement:await probe(frame,"laneMeasurement"),dom:await frame.evaluate(node=>{const chart=node.querySelector<HTMLElement>(".wx-chart")!,widget=node.querySelector<HTMLElement>(".project-gantt-widget")!;return{chartWidth:chart.getBoundingClientRect().width,chartClientWidth:chart.clientWidth,widgetWidth:widget.getBoundingClientRect().width,hidden:Boolean(widget.closest("[hidden],[inert]")),laneReason:node.querySelector(".project-milestone-lane-state")?.textContent};})});
  await expect(frame.locator(".project-milestone-lane-plot")).toBeVisible();
  const bounds=await frame.evaluate(node=>{const plot=node.querySelector(".wx-chart")!.getBoundingClientRect(),lane=node.querySelector(".project-milestone-lane-plot")!.getBoundingClientRect();return{plotX:plot.x,laneX:lane.x,plotWidth:plot.width,laneWidth:lane.width};});expect(Math.abs(bounds.plotX-bounds.laneX)).toBeLessThanOrEqual(1);expect(Math.abs(bounds.plotWidth-bounds.laneWidth)).toBeLessThanOrEqual(1);
  await frame.getByRole("button",{name:"Gantt 전체 화면",exact:true}).click();await expect.poll(()=>page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(true);await settle(page);
  expect((await page.getByLabel("Milestone Timeline",{exact:true}).boundingBox())!.height).toBe(64);await frame.getByRole("button",{name:"Gantt 전체 화면 종료",exact:true}).click();await settle(page);
  await page.setViewportSize({width:1024,height:1000});await settle(page);expect((await probe<Observation>(frame,"read")).instance).toBe(before.instance);
  const metrics=await probe(frame,"laneMeasurement");expect(state.posts.length+state.patchRequests.length).toBe(0);await captureLane(page,info,"peer-fullscreen-large",{before,returned,height,bounds,metrics,taskCount:1000,milestoneCount:2000,domMarkers:await frame.locator(".project-milestone-lane-marker").count(),mutationCount:0});
});

test("#551 cluster canonical expiry cannot reopen when the same IDs return",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});const {state,frame}=await fixture(page,"cluster");await probe(frame,"preview",true);await probe(frame,"reveal","2026-10-05");await settle(page);
  await frame.locator(".project-milestone-lane-marker").first().click();const list=page.getByRole("dialog",{name:"Milestone 날짜 목록",exact:true});await expect(list).toBeVisible();
  const removed=state.tasks.filter(task=>task.type==="milestone");state.tasks.splice(0,state.tasks.length,...state.tasks.filter(task=>task.type!=="milestone"));await changedSnapshot(page,state);await expect(list).toBeHidden();
  const fallback=frame.locator("[data-milestone-lane-focus=list]");await expect(fallback).toBeFocused();const focus=await focusObservation(fallback);expect(focus.centerHit).toBe(true);
  state.tasks.push(...removed);await changedSnapshot(page,state);await expect(frame.locator(".project-milestone-lane-marker")).toHaveCount(2);await expect(list).toBeHidden();await frame.locator(".project-milestone-lane-marker").last().click();await expect(list).toBeVisible();
  await captureLane(page,info,"cluster-expiry",{focus,reopenedOnlyByUser:true,mutationCount:state.posts.length+state.patchRequests.length});
});

test("#551 OFF while Editor open preserves the dialog and returns to visible schedule without native M selection",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});const {state,frame}=await fixture(page,"milestone-only");await probe(frame,"preview",true);await expect(frame.locator(".project-milestone-lane-marker")).toHaveCount(1);await frame.locator(".project-milestone-lane-marker").click();
  const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});await expect(editor).toBeVisible();await probe(frame,"preview",false);await expect(editor).toBeVisible();await expect(frame.locator(".project-milestone-lane")).toHaveCount(0);
  await page.keyboard.press("Escape");await expect(editor).toBeHidden();await expect(frame.locator(".project-gantt-scroll")).toBeFocused();await expect(frame.getByRole("group",{name:"복사 대상 선택"})).toContainText("선택 0개");
  await captureLane(page,info,"off-editor",{editorPreserved:true,selectionCount:0,mutationCount:state.posts.length+state.patchRequests.length});
});

test("#551 full population empty vs date viewport and Task-only filter stay independent",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000}); const {state,frame}=await fixture(page,"cluster"); await probe(frame,"preview",true);await probe(frame,"reveal","2026-10-05");await settle(page);
  const lane=page.getByLabel("Milestone Timeline",{exact:true});await expect(lane.locator("[data-milestone-lane-focus=list]")).toContainText("61");
  await page.getByRole("button",{name:"Task",exact:true}).click();await settle(page);await expect(lane.locator("[data-milestone-lane-focus=list]")).toContainText("61");await expect(lane.locator(".project-milestone-lane-marker")).toHaveCount(2);
  const read=await probe<Observation>(frame,"read");await probe(frame,"scroll",read.width-read.chartWidth);await settle(page);await expect(lane.getByRole("status")).toContainText("현재 날짜 viewport");
  state.tasks.splice(0,state.tasks.length,...state.tasks.filter(task=>task.type!=="milestone"));await changedSnapshot(page,state);await expect(lane.getByRole("status")).toContainText("프로젝트 전체 Milestone 0개");
  await captureLane(page,info,"population-empty-viewport",{fullPopulationBefore:61,taskFilterDidNotReduce:true,fullPopulationAfter:0,mutationCount:state.posts.length+state.patchRequests.length});
});

test("#551 dynamic axis/latest native horizontal scroll and Task pointer selection survive the guide",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});const {state,frame}=await fixture(page,"cluster");await probe(frame,"preview",true);await probe(frame,"reveal","2026-10-05");await settle(page);
  const marker=frame.locator(".project-milestone-lane-marker").first();await marker.focus();await expect(frame.locator(".project-milestone-lane-guide")).toHaveCount(1);
  const ordinary=frame.locator('.wx-bar[data-task-id=":00000000-0000-4000-8000-000000000001"]');await expect(ordinary).toBeVisible();const bar=(await ordinary.boundingBox())!;
  const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest(".wx-bar")?.getAttribute("data-task-id"),{x:bar.x+2,y:bar.y+bar.height/2});expect(hit).toBe(":00000000-0000-4000-8000-000000000001");
  await ordinary.click({button:"right"});await expect(page.getByRole("menu")).toBeVisible();await page.keyboard.press("Escape");
  const checkbox=frame.locator('.wx-row[data-id=":00000000-0000-4000-8000-000000000001"] input[data-copy-selection]');await checkbox.check();await expect(frame.getByRole("group",{name:"복사 대상 선택"})).toContainText("선택 1개");
  await marker.click();const dialog=page.getByRole("dialog",{name:"Milestone 날짜 목록",exact:true});await expect(dialog).toBeVisible();await page.keyboard.press("Escape");await expect(checkbox).toBeChecked();
  const before=await probe<Observation>(frame,"read");await probe(frame,"scroll",before.width-before.chartWidth);await settle(page);const expanded=await probe<Observation>(frame,"read");expect(expanded.width).toBeGreaterThan(before.width);
  await frame.locator(".wx-chart").hover();await page.mouse.wheel(120,0);await settle(page);const latest=await probe<Observation>(frame,"read");await settle(page);expect((await probe<Observation>(frame,"read")).left).toBe(latest.left);
  expect(latest.instance).toBe(before.instance);await captureLane(page,info,"dynamic-task-hit",{hit,before,expanded,latest,selectionCount:1,mutationCount:state.posts.length+state.patchRequests.length});
});

test("#551 OFF preserves a dirty existing Editor draft until explicit discard",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});const {state,frame}=await fixture(page,"milestone-only",true);await probe(frame,"preview",true);await expect(frame.locator(".project-milestone-lane-marker")).toHaveCount(1);await frame.locator(".project-milestone-lane-marker").click();
  const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});await editor.getByLabel("작업명",{exact:true}).fill("유지할 lane 초안");await probe(frame,"preview",false);await expect(editor.getByLabel("작업명",{exact:true})).toHaveValue("유지할 lane 초안");
  await page.keyboard.press("Escape");await expect(editor).toBeVisible();await expect(editor.getByLabel("작업명",{exact:true})).toHaveValue("유지할 lane 초안");
  await editor.getByRole("button",{name:"변경사항 버리고 닫기",exact:true}).click();await expect(editor).toBeHidden();expect(state.posts.length+state.patchRequests.length).toBe(0);await captureLane(page,info,"dirty-editor-off",{draftPreserved:true,explicitDiscard:true,mutationCount:0});
});

test.describe("#551 actual touch capability",()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:1000}});
  test("390px touch hit uses the marker's real 160×44 target",async({page},info)=>{
    const {state,frame}=await fixture(page,"milestone-only");await probe(frame,"preview",true);await frame.locator(".project-gantt-scroll").evaluate(node=>node.scrollTo({left:node.scrollWidth-node.clientWidth}));await settle(page);
    const marker=frame.locator(".project-milestone-lane-marker");await expect(marker).toHaveCount(1);const bounds=(await marker.boundingBox())!;expect(bounds.width).toBe(160);expect(bounds.height).toBe(44);
    await marker.tap();await expect(page.getByRole("dialog",{name:"작업 정보",exact:true})).toBeVisible();await captureLane(page,info,"touch-390",{bounds,hasTouch:true,mutationCount:state.posts.length+state.patchRequests.length});
  });
});

test("#551 public displayMode grid/chart keeps one Core instance and chart-only full plot",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});const {state,frame}=await fixture(page,"milestone-only");await probe(frame,"preview",true);await expect(frame.locator(".project-milestone-lane-marker")).toHaveCount(1);const before=await probe<Observation>(frame,"read");
  await probe(frame,"display","grid");await settle(page);await expect(frame.locator(".project-milestone-lane")).toHaveCount(0);await expect(frame.locator(".wx-chart")).toBeHidden();expect((await probe<Observation>(frame,"read")).instance).toBe(before.instance);
  await probe(frame,"display","chart");await settle(page);await expect(frame.locator(".project-milestone-lane-marker")).toHaveCount(1);
  const bounds=await frame.evaluate(node=>{const plot=node.querySelector(".wx-chart")!.getBoundingClientRect(),lane=node.querySelector(".project-milestone-lane-plot")!.getBoundingClientRect(),owner=node.querySelector(".project-gantt-native-owner")!.getBoundingClientRect();return{plotX:plot.x,laneX:lane.x,ownerX:owner.x,plotWidth:plot.width,laneWidth:lane.width,ownerWidth:owner.width,chrome:Array.from(node.querySelectorAll<HTMLElement>(".wx-table-container, .wx-resizer")).slice(0,12).map(element=>({classes:element.className,x:element.getBoundingClientRect().x,width:element.getBoundingClientRect().width,text:element.textContent?.slice(0,60)}))};});
  await captureLane(page,info,"display-mode-diagnostic",{bounds,instance:before.instance,mutationCount:0,developmentOnly:true});
  const rail=bounds.chrome.find(item=>item.classes.includes("wx-table-container"))!,splitter=bounds.chrome.find(item=>item.classes.includes("wx-resizer"))!;expect(rail).toBeDefined();expect(splitter).toBeDefined();
  expect(Math.abs(rail.x-bounds.ownerX)).toBeLessThanOrEqual(1);expect(Math.abs(splitter.x-rail.x-rail.width)).toBeLessThanOrEqual(1);expect(rail.width+splitter.width).toBe(42);
  expect(Math.abs(bounds.plotX-(splitter.x+splitter.width))).toBeLessThanOrEqual(1);expect(Math.abs(bounds.plotWidth+rail.width+splitter.width-bounds.ownerWidth)).toBeLessThanOrEqual(1);expect(Math.abs(bounds.laneX-bounds.plotX)).toBeLessThanOrEqual(1);expect(bounds.laneWidth).toBe(bounds.plotWidth);
  await probe(frame,"display","all");await settle(page);expect((await probe<Observation>(frame,"read")).instance).toBe(before.instance);expect(state.posts.length+state.patchRequests.length).toBe(0);await captureLane(page,info,"display-mode",{bounds,instance:before.instance,mutationCount:0,developmentOnly:true});
});

async function headerObservation(frame: Locator, taskId: string, date: string) {
  return frame.evaluate((node, input) => {
    const chart = node.querySelector<HTMLElement>(".wx-chart")!;
    const bar = node.querySelector<HTMLElement>(`.wx-bar[data-task-id=":${input.taskId}"]`)!;
    const b = bar.getBoundingClientRect(), plot = chart.getBoundingClientRect(), anchor = b.x + 1;
    const rows = Array.from(node.querySelectorAll<HTMLElement>(".wx-scale > .wx-row")).map(row => Array.from(row.querySelectorAll<HTMLElement>(".wx-cell")).map(cell => {
      const r = cell.getBoundingClientRect(); return { text: cell.textContent, className: cell.className, ariaLabel: cell.getAttribute("aria-label"), x: r.x, right: r.right, width: r.width, containsAnchor: r.x <= anchor && r.right > anchor };
    }));
    return { date: input.date, nativeContentX: b.x - plot.x + chart.scrollLeft, chart: { x: plot.x, width: plot.width, left: chart.scrollLeft }, rows, atAnchor: rows.map(row => row.filter(cell => cell.containsAnchor)) };
  }, { taskId, date });
}

test("#551 public ISO interval date/header semantics independent oracle", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { state, frame } = await fixture(page), observations = [];
  for (const scale of ["day", "week"] as const) {
    await page.getByRole("button", { name: scale === "day" ? "일" : "주", exact: true }).click(); await settle(page);
    for (const task of state.tasks.filter(task => task.type === "task")) {
      await probe(frame, "reveal", task.start); await settle(page);
      const coordinate = await probe<{ contentX: number }>(frame, "coordinate", task.start);
      const observation = await headerObservation(frame, task.taskId, task.start!);
      const expectedMonth = await page.evaluate(date => new Intl.DateTimeFormat(navigator.language, { month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00`)), task.start!);
      const publicObservation = await probe<Observation & { weekStart: number; scaleRows: { width: number }[] }>(frame, "read");
      const expected = ({ "2024-02-29": { start: "2024-02-26", end: "2024-03-04", label: "2024.02→03", week: "W09", isoYear: "2024" }, "2026-01-31": { start: "2026-01-26", end: "2026-02-02", label: "2026.01→02", week: "W05", isoYear: "2026" }, "2026-03-10": { start: "2026-03-09", end: "2026-03-16", label: "2026.03", week: "W11", isoYear: "2026" }, "2027-01-01": { start: "2026-12-28", end: "2027-01-04", label: "2026.12→2027.01", week: "W53", isoYear: "2026" } } as Record<string, { start: string; end: string; label: string; week: string; isoYear: string }>)[task.start!];
      observations.push({ scale, ...observation, coordinate, expectedMonth, expected, publicObservation });
      expect(publicObservation.weekStart).toBe(1);
      publicObservation.scaleRows.forEach(row => expect(row.width).toBe(publicObservation.width));
      if (scale === "day") {
        expect(observation.atAnchor[0]?.[0]?.text).toBe(expectedMonth);
        expect(observation.atAnchor[1]?.[0]?.className).toContain(`project-gantt-day-date-${task.start!.replaceAll("-", "")}`);
      } else {
        const upper = observation.atAnchor[0]?.[0], lower = observation.atAnchor[1]?.[0];
        expect(upper?.text).toBe(expected.label); expect(upper?.ariaLabel).toContain(`${expected.start} 이상, ${expected.end} 미만`);
        expect(upper?.ariaLabel).toContain(`ISO ${expected.isoYear}-${expected.week}`);
        expect(lower?.className).toContain(`project-gantt-week-date-${expected.start.replaceAll("-", "")}`);
        expect(lower?.text).toMatch(new RegExp(`^${expected.week}`));
        const accessibleWeek = frame.locator(`.project-gantt-week-date-${expected.start.replaceAll("-", "")}`);
        await accessibleWeek.focus(); await expect(page.getByRole("tooltip")).toContainText(`ISO ${expected.isoYear}-${expected.week}`);
        await expect(page.getByRole("tooltip")).toContainText(`포함 월 ${expected.label}`); await page.keyboard.press("Escape");
        expect(task.start! >= expected.start && task.start! < expected.end).toBe(true);
        expect(Math.abs(upper!.x - lower!.x)).toBeLessThanOrEqual(1); expect(Math.abs(upper!.right - lower!.right)).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(observation.nativeContentX - coordinate.contentX)).toBeLessThanOrEqual(1);
      if (scale === "week" && task.start !== "2024-02-29") {
        const first = `${task.start!.slice(0, 7)}-01`;
        const expectedStart = ({ "2026-01-01": "2025-12-29", "2026-03-01": "2026-02-23", "2027-01-01": "2026-12-28" } as Record<string,string>)[first];
        await probe(frame, "reveal", first); await settle(page);
        const boundary = await probe<{ contentX: number; viewportX: number }>(frame, "coordinate", first);
        const cell = frame.locator(`.project-gantt-week-date-${expectedStart.replaceAll("-", "")}`);
        const actual = await cell.evaluate((node, contentX) => { const chart = node.closest(".project-gantt-frame")!.querySelector<HTMLElement>(".wx-chart")!; const r = node.getBoundingClientRect(), plot = chart.getBoundingClientRect(); return { x: r.x - plot.x + chart.scrollLeft, right: r.right - plot.x + chart.scrollLeft, monthFirstX: contentX }; }, boundary.contentX);
        expect(actual.monthFirstX).toBeGreaterThan(actual.x); expect(actual.monthFirstX).toBeLessThan(actual.right);
        observations.push({ scale, monthFirst: first, actualWeekStart: expectedStart, boundary: actual, nativeMonthCellBoundary: false });
        await probe(frame, "reveal", task.start); await settle(page);
      }
      if (process.env.CAPTURE_ISSUE_551) {
        const directory = `output/playwright/issue-551/${process.env.CAPTURE_ISSUE_551}`; await mkdir(directory, { recursive: true }); await page.screenshot({ path: `${directory}/${scale}-${task.externalId}.png` });
      }
    }
  }
  const paths = ["src/features/gantt/project-gantt.tsx", "src/features/gantt/milestone-timeline-adapter.ts", "src/features/gantt/week-header-tooltip.ts", "src/features/gantt/week-calendar-interval.ts", "src/features/gantt/gantt-scale-toolbar.css", "tests/e2e/milestone-timeline-lane.spec.ts"];
  const evidence = { capturedAt: new Date().toISOString(), baseline: "31345da9346dfbdc1ac02e4e7ca567edafec775f", environment: "Chromium/Next dev actual Core2.7.3/store2.7.2, synthetic canonical API, America/New_York", observations, failures: [], mutationCount: state.posts.length + state.patchRequests.length, sourceHashes: Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")]))) };
  await info.attach("date-header-baseline", { body: JSON.stringify(evidence), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_551) await writeFile(`output/playwright/issue-551/${process.env.CAPTURE_ISSUE_551}/date-header-baseline.json`, JSON.stringify(evidence, null, 2));
});

for (const width of [390, 768, 1024, 1440, 1920]) test(`#551 opt-in sibling lane ${width}px actual geometry`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const { state, frame } = await fixture(page), before = await probe<Observation>(frame, "read");
  const beforeRows = await frame.locator('.wx-table-container .wx-row[data-id]').evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute("data-id"), height: node.getBoundingClientRect().height })));
  await page.getByRole("button", { name: "Milestone Timeline 기술 미리보기", exact: true }).click();
  const lane = page.getByLabel("Milestone Timeline", { exact: true }); await expect(lane).toBeVisible();
  expect((await lane.boundingBox())!.height).toBe(64);
  for(const scale of ["day","week"] as const) {
  await page.getByRole("button",{name:scale==="day"?"일":"주",exact:true}).click();
  await expect(lane.locator(".project-milestone-lane-plot")).toBeVisible();
  await probe(frame, "reveal", "2026-03-10"); await settle(page);
  const owner = frame.locator(".project-gantt-scroll");
  if (width === 390) { await owner.focus(); await page.keyboard.press("End"); await owner.evaluate(node => node.scrollTo({ left: node.scrollWidth - node.clientWidth })); await settle(page); }
  const observed = await frame.evaluate(node => {
    const lane = node.querySelector<HTMLElement>(".project-milestone-lane")!, plot = node.querySelector<HTMLElement>(".wx-chart")!, clip = node.querySelector<HTMLElement>(".project-gantt-scroll")!;
    const rect = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height }; };
    const alignment = Array.from(node.querySelectorAll<HTMLElement>('.wx-table-container .wx-row[data-id]')).flatMap(row => {
      const id = row.getAttribute("data-id"), bar = node.querySelector<HTMLElement>(`.wx-bar[data-task-id="${id}"]`);
      if (!bar) return []; const r = row.getBoundingClientRect(), b = bar.getBoundingClientRect(); return [{id,gridCenter:r.y+r.height/2,chartCenter:b.y+b.height/2}];
    });
    const tick=lane.querySelector<HTMLElement>('[data-milestone-tick="00000000-0000-4000-8000-000000000008"]'), native=node.querySelector<HTMLElement>('.wx-bar[data-task-id=":00000000-0000-4000-8000-000000000006"]');
    return { lane:rect(lane),plot:rect(plot),clip:rect(clip),list:rect(lane.querySelector<HTMLElement>(".project-milestone-lane-list")!),anchor:tick&&native?{tick:tick.getBoundingClientRect().x,native:native.getBoundingClientRect().x+1}:null,alignment,markers:Array.from(lane.querySelectorAll<HTMLButtonElement>(".project-milestone-lane-marker")).map(e=>({rect:rect(e), label:e.getAttribute("aria-label")})), rows:Array.from(node.querySelectorAll<HTMLElement>('.wx-table-container .wx-row[data-id]')).map(e=>({id:e.getAttribute("data-id"),height:e.getBoundingClientRect().height})) };
  });
  expect(observed.rows).toEqual(beforeRows); expect(observed.plot.y).toBeGreaterThanOrEqual(observed.lane.bottom);
  expect(observed.list.x).toBeGreaterThanOrEqual(Math.max(0, observed.clip.x));
  expect(observed.anchor).not.toBeNull(); expect(Math.abs(observed.anchor!.tick-observed.anchor!.native)).toBeLessThanOrEqual(1);
  expect(observed.alignment.length).toBeGreaterThan(0); for(const row of observed.alignment) expect(Math.abs(row.gridCenter-row.chartCenter)).toBeLessThanOrEqual(1);
  for (const marker of observed.markers) {
    expect(marker.rect.width).toBe(160); expect(marker.rect.height).toBe(44);
    expect(marker.rect.x-6).toBeGreaterThanOrEqual(Math.max(0,observed.clip.x)); expect(marker.rect.right+6).toBeLessThanOrEqual(Math.min(width,observed.clip.right));
    expect(marker.rect.y-6).toBeGreaterThanOrEqual(observed.lane.y); expect(marker.rect.bottom+6).toBeLessThanOrEqual(observed.lane.bottom);
  }
  expect((await probe<Observation>(frame,"read")).instance).toBe(before.instance); expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  const metrics=await probe(frame,"laneMeasurement");
  const data={capturedAt:new Date().toISOString(),width,scale,observed,metrics,mutationCount:0,instance:before.instance};
  await captureLane(page,info,`lane-${scale}-${width}`,data);
  }
  await page.getByRole("button", { name: "Milestone Timeline 기술 미리보기", exact: true }).click(); await expect(lane).toHaveCount(0); expect((await probe<Observation>(frame,"read")).instance).toBe(before.instance);
  const stopped=await probe<{count:number}>(frame,"laneMeasurement");await page.setViewportSize({width:width+1,height:1000});await settle(page);
  expect((await probe<{count:number}>(frame,"laneMeasurement")).count).toBe(stopped.count);
});
