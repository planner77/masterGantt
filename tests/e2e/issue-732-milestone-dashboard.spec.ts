import { expectDashboardMetricsReadable } from "./helpers/dashboard-metrics";
import { openWbsViewControls } from "./helpers/wbs-controls";
import { waitForWbsReport, type WbsReportCondition } from "./helpers/wbs-report";
import type { Locator, Page } from "@playwright/test";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { seedWbsViewComposer, viewResourcePassword } from "./fixtures/wbs-view-composer";
import { targetMasterPassword } from "./fixtures/target-project";
import type { WbsViewReportDto, WbsViewSpec } from "../../src/contracts/wbs-dashboard-views";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: viewResourcePassword, viewport: { width: 1440, height: 1000 } });
const root = (page: Page) => page.getByTestId("wbs-view-dashboard").filter({ visible: true });
const defaultSpec: WbsViewSpec = { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "milestone", levels: [], };
const reportResponse = (page: Page, condition: Partial<WbsReportCondition> = {}) => waitForWbsReport(page, { spec: defaultSpec, filters: {}, ...condition });
async function openMilestone(page: Page) {
  await page.getByRole("tablist", {name:"프로젝트 작업공간",exact:true}).getByRole("tab",{name:"대시보드",exact:true}).click();
  await page.getByRole("tablist",{name:"대시보드 보기",exact:true}).getByRole("tab",{name:"Milestone",exact:true}).click();
  await expect(root(page)).toHaveAttribute("data-ready","true");
}
async function preset(page: Page, label: string) {
  await openWbsViewControls(root(page));
  const panel = root(page).locator("details").filter({has:page.locator("summary").filter({hasText:/^조회 구성$/})});
  if (!await panel.evaluate(node=>(node as HTMLDetailsElement).open)) await panel.locator("summary").click();
  await panel.getByRole("button",{name:label,exact:true}).click();
  const levels: Record<string, NonNullable<WbsViewSpec["levels"]>> = {"Milestone → 공정 → WorkArea → 설비 / 물류 시스템 → 리소스": ["process", "workArea", { kind: "siblings", dimensions: ["equipment", "system"] }, "resource"], "Milestone → 리소스 → 공정": ["resource", "process"]};
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

test("#732 Target0 Milestone 단독·두 계층·전체 Gate·5폭과 keyboard", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
  const before=await f.snapshot();
  const frame=page.locator(".project-gantt-frame");
  const instance=await frame.getAttribute("data-project-gantt-instance");
  let mutations=0;
  page.on("request",request=>{if(new URL(request.url()).pathname.startsWith(`/api/projects/${f.publicId}/`) && !["GET","HEAD"].includes(request.method()) && !isWbsViewReadQuery(request))mutations++;});
  const first=reportResponse(page);await openMilestone(page);
  const standalone=(await (await first).json()).data as WbsViewReportDto;expect(standalone.spec.levels).toEqual([]);
  const layered=await preset(page,"Milestone → 공정 → WorkArea → 설비 / 물류 시스템 → 리소스");
  expect(layered.spec.levels).toEqual(["process","workArea",{kind:"siblings",dimensions:["equipment","system"]},"resource"]);
  const milestone=layered.children.find(row=>row.selector.id===f.milestone.taskId)!;
  const process=milestone.children.find(row=>row.selector.id===f.processIds[0])!;
  const area=process.children.find(row=>row.selector.id===f.workArea.id)!;
  expect(area.children.filter(row=>row.selector.id===f.equipment.id||row.selector.id===f.system.id).map(row=>row.path.length)).toEqual([4,4]);
  expect(milestone.taskIds).toEqual([f.task.taskId]);
  const row=root(page).locator(`tr[data-dimension="milestone"][data-entity-id="${f.milestone.taskId}"]`);
  await expand(row);
  const summary=root(page).getByTestId("milestone-wbs-summary");
  await summary.getByText(/인수 Milestone · .*완료/).click();
  await expect(summary).toContainText("완료 0/1 Task");
  for(const width of [390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:1000});
    await expectDashboardMetricsReadable(root(page).getByTestId("milestone-wbs-summary"), width);
    const toggle=row.getByRole("button",{name:/하위 접기$/});
    await toggle.focus();await toggle.press("Tab");
    const action=row.getByRole("button",{name:"상세",exact:true});await expect(action).toBeFocused();
    const geometry=await action.evaluate(element=>{const box=element.getBoundingClientRect(),owner=element.closest("[data-wbs-scroll]")!;const clip=owner.getBoundingClientRect();return {left:box.left,right:box.right,clipLeft:clip.left,clipRight:clip.right,scroll:owner.scrollWidth,client:owner.clientWidth,document:document.documentElement.scrollWidth};});
    expect(geometry.document).toBeLessThanOrEqual(width+1);expect(geometry.left).toBeGreaterThanOrEqual(geometry.clipLeft);expect(geometry.right).toBeLessThanOrEqual(geometry.clipRight);if(width<=768)expect(geometry.scroll).toBeGreaterThan(geometry.client);
    if(width===390 || width===1440) await info.attach(`milestone-${width}.png`,{body:await page.locator("#project-panel-milestones").screenshot(),contentType:"image/png"});
    await action.press("Enter");
    const detail=root(page).getByRole("region",{name:"계층 원본 상세",exact:true});await expect(detail).toHaveAttribute("data-detail-state","ready");await detail.press("Escape");await expect(action).toBeFocused();
  }
  const alternate=await preset(page,"Milestone → 리소스 → 공정");expect(alternate.spec.levels).toEqual(["resource","process"]);
  expect(alternate.totals.assignments.effort.knownMd).toBe(standalone.totals.assignments.effort.knownMd);
  await root(page).getByLabel("작업 검색",{exact:true}).fill("no matching source task");
  await expect(root(page)).toHaveAttribute("data-ready","true");
  await expect(summary).toContainText("현재 조건의 관련 일반 Task가 0건");await expect(summary).toContainText("완료 0/1 Task");
  await expect(frame).toHaveAttribute("data-project-gantt-instance",instance!);
  await expect(frame.locator(`.wx-row[data-id=":${f.milestone.taskId}"],.wx-bar[data-task-id=":${f.milestone.taskId}"]`)).toHaveCount(0);
  await expect(page.locator(".project-milestone-lane,.project-milestone-lane-guide")).toHaveCount(0);
  const after=await f.snapshot();expect(after.data.project.revision).toBe(before.data.project.revision);expect(after.data.tasks).toEqual(before.data.tasks);expect(after.data.assignments).toEqual(before.data.assignments);expect(mutations).toBe(0);
});

test("#732 Milestone readonly 조회는 추가를 차단하고 mutation을 만들지 않는다", async ({page,browser,isolatedApplication:origin,observeIsolatedApi}) => {
  test.setTimeout(120_000);
  const f = await seedWbsViewComposer(page,origin,observeIsolatedApi);
  const context=await browser.newContext();const readonly=await context.newPage();
  let mutations=0;
  readonly.on("request",request=>{if(new URL(request.url()).pathname.startsWith(`/api/projects/${f.publicId}/`) && !["GET","HEAD"].includes(request.method()) && !isWbsViewReadQuery(request))mutations++;});
  try {await readonly.goto(`${origin}/projects/${f.publicId}`);await openMilestone(readonly);await expect(readonly.getByRole("button",{name:"Milestone 추가",exact:true})).toBeDisabled();await expect(root(readonly).getByTestId("milestone-wbs-summary")).toBeVisible();expect(mutations).toBe(0);}
  finally {await context.close();}
});

test("#732 Milestone 소속 Task 원본 저장은 같은 경로·새 snapshot으로 복귀하고 stale/error 명령을 잠근다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedWbsViewComposer(page,origin,observeIsolatedApi);
  const first = reportResponse(page);await openMilestone(page);
  const initial = (await (await first).json()).data as WbsViewReportDto;
  const row = root(page).locator(`tr[data-dimension="milestone"][data-entity-id="${f.milestone.taskId}"]`);
  await row.getByRole("button",{name:"상세",exact:true}).click();
  const detail = root(page).getByRole("region",{name:"계층 원본 상세",exact:true});
  const taskOriginal = detail.getByRole("button",{name:`${f.task.name} Task 원본`,exact:true});
  await taskOriginal.click();
  const editor = page.getByRole("dialog",{name:"작업 정보",exact:true});
  const renamed = "Milestone 소속 Task 저장 복귀 검증";
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


test("#732 조건 밖 생성 성공은 필터를 유지하고 정확한 원본 접근을 안내한다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
  await openMilestone(page);
  const management=page.getByTestId("milestone-dashboard");
  await management.getByLabel("Milestone 검색",{exact:true}).fill("필터에 일치하지 않는 기존 조건");
  await expect(management).toHaveAttribute("data-ready","true");
  await management.getByRole("button",{name:"Milestone 추가",exact:true}).click();
  const create=page.getByRole("dialog",{name:"Milestone 추가",exact:true});
  await create.getByLabel("Milestone 이름",{exact:true}).fill("조건 밖 새 Milestone");
  await create.getByLabel("요청 시작일",{exact:true}).fill("2026-10-14");
  const response=page.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname===`/api/projects/${f.publicId}/tasks`);
  await create.getByRole("button",{name:"Milestone 생성",exact:true}).click();
  expect((await response).status()).toBe(201);
  const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});
  await expect(editor).toBeVisible();await expect(editor.getByLabel("작업명",{exact:true})).toHaveValue("조건 밖 새 Milestone");
  await editor.press("Escape");await expect(editor).toHaveCount(0);
  await expect(management.getByLabel("Milestone 검색",{exact:true})).toHaveValue("필터에 일치하지 않는 기존 조건");
  await expect(page.getByText(/조건 밖 새 Milestone Milestone을 추가했습니다/)).toBeVisible();
  const reopen=page.getByRole("button",{name:"추가한 Milestone 상세",exact:true});await reopen.focus();await reopen.press("Enter");
  await expect(editor.getByLabel("작업명",{exact:true})).toHaveValue("조건 밖 새 Milestone");
  await editor.press("Escape");await expect(reopen).toBeFocused();
  await page.getByRole("button",{name:"추가 안내 닫기",exact:true}).click();
  await expect(management.getByLabel("Milestone 검색",{exact:true})).toBeFocused();
  const after=await f.snapshot();expect(after.data.tasks.filter(row=>row.name==="조건 밖 새 Milestone")).toHaveLength(1);
});
