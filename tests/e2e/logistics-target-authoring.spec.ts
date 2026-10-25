import type { Page } from "@playwright/test";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { createTargetProject, targetMasterPassword } from "./fixtures/target-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import type { LogisticsTargetMutationResponse } from "../../src/contracts/logistics-targets";
import type { TaskLogisticsLinksResponse } from "../../src/contracts/logistics";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword });
const widths=[390,768,1024,1440,1920];
async function openEditor(page:Page,name:string) {
  await openWorkspaceView(page,"schedule");
  await page.locator(".project-gantt-widget .wx-row",{hasText:name}).first().getByText(name,{exact:true}).click({button:"right"});
  await chooseTaskInformation(page);
  const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});
  await editor.getByRole("tab",{name:/물류 연결/}).click();
  return editor;
}
async function seedArchive(f:Awaited<ReturnType<typeof createTargetProject>>, inherited=false) {
  const response=await f.seedLegacy("/logistics/targets",{code:"ARCHIVE",name:"비공개 원본 관계",scope:"process",projectProcessId:f.processIds[0],workAreaId:f.catalog.data.workAreas[0].id,members:[
    {kind:"equipment",create:{code:"AMR",name:"공유 반송 설비",equipmentType:"amr",managementUnit:"fleet",quantity:150}},
    {kind:"system",create:{code:"MCS",name:"공유 조율 시스템",systemType:"mcs",layer:"coordinator",scope:"project"}},
  ]}) as LogisticsTargetMutationResponse;
  const original=response.data.target!;
  await f.seedLegacy(`/tasks/${inherited?f.parentTask.taskId:f.task.taskId}/target-bindings`,{bindings:[{targetId:original.id,scope:inherited?"subtree":"self",selection:"subset",memberIds:[original.members[0].id],coverageByMember:[{memberId:original.members[0].id,coverage:125}]}]},"put");
  return original;
}
async function readLinks(page:Page,f:Awaited<ReturnType<typeof createTargetProject>>,taskId=f.task.taskId) {
  const response=await page.request.get(`${f.api}/tasks/${taskId}/logistics-links`);expect(response.status()).toBe(200);
  return (await response.json() as TaskLogisticsLinksResponse).data.links;
}

// #785 retires only the authoring UI. Canonical archived member identity,
// coverage, inheritance, security and browser geometry remain executable guards.
test("#785 기존 실물 subset·coverage는 실물 출처로 조회하고 직접 쓰기와 분리",async({page,isolatedApplication:origin,observeIsolatedApi})=>{
  const f=await createTargetProject(page,origin,observeIsolatedApi),original=await seedArchive(f);
  const before=await f.snapshot();await page.reload();
  const editor=await openEditor(page,f.task.name),sources=editor.getByRole("region",{name:"기존 연결 출처",exact:true});
  await expect(sources).toContainText("공유 반송 설비");await expect(sources).toContainText("coverage 125");await expect(sources).toContainText("출처 공정: A 공정");await expect(sources).toContainText("출처 WorkArea: A 작업구역");await expect(sources).not.toContainText("공유 조율 시스템");
  await expect(editor.getByRole("checkbox",{name:/공유 반송 설비/})).not.toBeChecked();
  await expect(editor.getByRole("region",{name:"직접 공정·작업 구역",exact:true}).getByRole("checkbox",{name:/A 공정/})).not.toBeChecked();
  expect((await readLinks(page,f)).effectiveEquipmentIds).toEqual([original.members[0].entityId]);
  expect((await f.snapshot()).data.tasks).toEqual(before.data.tasks);
  await expect(page.getByRole("button",{name:/Target/})).toHaveCount(0);
  await expect(editor).not.toContainText("비공개 원본 관계");
});

test("#785 폐기 API는 readonly·권한·revision 경계를 통과해도 새 원본을 쓰지 않음",async({page,browser,isolatedApplication:origin,observeIsolatedApi})=>{
  const f=await createTargetProject(page,origin,observeIsolatedApi);await seedArchive(f);
  const before=await f.snapshot();
  const retired=await page.request.post(`${f.api}/logistics/targets`,{headers:{Origin:origin,"If-Match":`"${before.data.project.revision}"`},data:{}});expect(retired.status()).toBe(410);
  const context=await browser.newContext();try {const readonly=await context.newPage();await readonly.goto(`${origin}/projects/${f.publicId}`);const editor=await openEditor(readonly,f.task.name);await expect(editor.getByRole("region",{name:"기존 연결 출처"})).toContainText("공유 반송 설비");await expect(editor.getByRole("checkbox",{name:/공유 반송 설비/})).toBeDisabled();expect((await readonly.request.put(`${f.api}/tasks/${f.task.taskId}/target-bindings`,{headers:{Origin:origin,"If-Match":`"${before.data.project.revision}"`},data:{bindings:[]}})).status()).toBe(401);}finally{await context.close();}
  expect((await f.snapshot()).data.project.revision).toBe(before.data.project.revision);
});

test("#785 기존 연결 출처 5폭·키보드·실물 긴 이름·내부 overflow",async({page,isolatedApplication:origin,observeIsolatedApi},info)=>{
  test.setTimeout(120_000);const f=await createTargetProject(page,origin,observeIsolatedApi);const original=await seedArchive(f);
  await f.mutate(`/logistics/equipment/${original.members[0].entityId}`,{name:"동명이름 물류 반송 설비 및 긴 구성 원본 이름 ".repeat(5)},"patch");
  const before=await f.snapshot();await page.reload();
  for(const width of widths){await page.setViewportSize({width,height:1000});const editor=await openEditor(page,f.task.name);await expect(editor.getByRole("region",{name:"기존 연결 출처"})).toBeVisible();
    const geometry=await editor.evaluate(node=>{const b=node.getBoundingClientRect();return {left:b.left,right:b.right,scroll:node.scrollWidth,client:node.clientWidth,document:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};});expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(width+1);expect(geometry.scroll).toBeLessThanOrEqual(geometry.client+1);expect(geometry.document).toBeLessThanOrEqual(geometry.viewport+1);
    await info.attach(`physical-archive-${width}.png`,{body:await editor.screenshot(),contentType:"image/png"});await editor.getByRole("button",{name:"취소",exact:true}).focus();await page.keyboard.press("Escape");await expect(editor).toHaveCount(0);
    expect(await page.evaluate(()=>document.activeElement instanceof HTMLElement&&!document.activeElement.closest("[hidden],[inert]")&&document.activeElement.checkVisibility())).toBe(true);
  }expect((await f.snapshot()).data.project.revision).toBe(before.data.project.revision);
});

test("#785 Summary subtree 출처를 자식의 직접 체크박스로 평탄화하지 않음",async({page,isolatedApplication:origin,observeIsolatedApi})=>{
  const f=await createTargetProject(page,origin,observeIsolatedApi),original=await seedArchive(f,true);await page.reload();
  const editor=await openEditor(page,f.task.name);await expect(editor.getByRole("region",{name:"기존 연결 출처"})).toContainText("상위 작업에서 상속");await expect(editor.getByRole("region",{name:"기존 연결 출처"})).toContainText("하위 작업 포함");
  const links=await readLinks(page,f);expect(links.directEquipmentLinks).toEqual([]);expect(links.effectiveEquipmentIds).toEqual([original.members[0].entityId]);expect(links.compatibilityLinks).toEqual([expect.objectContaining({sourceTaskId:f.parentTask.taskId,inherited:true,scope:"subtree",selection:"subset",coverage:125,readonly:true})]);
});

test("#785 이전 screen·저장 구성 복원은 현재 공정 화면으로 전환하고 요청을 되살리지 않음",async({page,isolatedApplication:origin,observeIsolatedApi})=>{
  const f=await createTargetProject(page,origin,observeIsolatedApi);await seedArchive(f);const requests:string[]=[];page.on("request",request=>{if(/\/logistics\/targets|\/target-bindings/.test(new URL(request.url()).pathname))requests.push(request.url());});
  await page.evaluate(id=>localStorage.setItem(`mastergantt:project:${id}:workspace`,JSON.stringify({activeScreen:"master.targets",master:"master.targets",dashboard:"dashboard.target"})),f.publicId);
  await page.goto(`${origin}/projects/${f.publicId}?screen=master.targets`);await expect(page.getByRole("status").filter({hasText:"이전 조회 구성을 현재 보기로 전환했습니다"})).toBeVisible();await expect(page.getByRole("tab",{name:"공정&WorkArea",exact:true})).toBeVisible();await expect(page).toHaveURL(/screen=master.processes/);
  await expect(page.getByRole("button",{name:"Target 관리",exact:true})).toHaveCount(0);expect(requests).toEqual([]);
  const stored=await page.evaluate(id=>JSON.parse(localStorage.getItem(`mastergantt:project:${id}:workspace`)!),f.publicId);expect(JSON.stringify(stored)).not.toContain('"master.targets"');expect(JSON.stringify(stored)).not.toContain('"dashboard.target"');
});

test("#785 공유 실물 수정은 중립 영향 조회 후 1회 저장하고 기존 출처에 반영",async({page,isolatedApplication:origin,observeIsolatedApi})=>{
  const f=await createTargetProject(page,origin,observeIsolatedApi),original=await seedArchive(f);await page.reload();await openWorkspaceView(page,"equipment");
  const row=page.locator("#panel-equipment tbody tr").filter({hasText:"공유 반송 설비"});await row.getByRole("button",{name:"수정",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"설비 수정",exact:true});await dialog.getByLabel("설비명 *",{exact:true}).fill("수정한 공유 반송 설비");const revision=(await f.snapshot()).data.project.revision;await dialog.getByRole("button",{name:"저장",exact:true}).click();
  const review=page.getByRole("dialog",{name:"공유 인스턴스 변경 확인",exact:true});await expect(review).toContainText("기존 연결 작업 1개");await expect(review).not.toContainText("Target");expect((await f.snapshot()).data.project.revision).toBe(revision);await review.getByRole("button",{name:"공유 사용처 확인 후 원본 저장",exact:true}).click();await expect(review).toHaveCount(0);await expect(dialog).toHaveCount(0);
  expect((await f.snapshot()).data.project.revision).toBe(revision+1);expect((await readLinks(page,f)).compatibilityLinks?.find(row=>row.entityId===original.members[0].entityId)?.name).toBe("수정한 공유 반송 설비");
});

test("#785 5폭 탭 왕복은 Target 네트워크·DOM·접근성 제어 0이며 canonical 불변",async({page,isolatedApplication:origin,observeIsolatedApi},info)=>{
  test.setTimeout(120_000);const f=await createTargetProject(page,origin,observeIsolatedApi);await seedArchive(f);await page.reload();const before=await f.snapshot(),instance=await page.locator(".project-gantt-frame").getAttribute("data-project-gantt-instance");const requests:string[]=[];page.on("request",request=>{if(/\/logistics\/targets|\/target-bindings/.test(new URL(request.url()).pathname))requests.push(request.url());});
  for(const width of widths){await page.setViewportSize({width,height:1000});for(const view of ["processes","equipment","systems","kpi","unified","resources","schedule"] as const){await openWorkspaceView(page,view);await expect(page.getByRole("button",{name:/Target/})).toHaveCount(0);await expect(page.getByRole("combobox",{name:/Target/})).toHaveCount(0);expect(await page.locator("body").innerText()).not.toMatch(/\bTarget\b/);}await info.attach(`physical-workspace-${width}.png`,{body:await page.screenshot(),contentType:"image/png"});}
  expect(requests).toEqual([]);expect((await f.snapshot()).data.tasks).toEqual(before.data.tasks);expect((await f.snapshot()).data.project.revision).toBe(before.data.project.revision);await expect(page.locator(".project-gantt-frame")).toHaveAttribute("data-project-gantt-instance",instance!);
});
