import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setup } from "./fixtures/task-editor-density";
import { expect, test, isolatedApplicationOptions, submitProjectUnlock } from "./fixtures/isolated-application";
import { capture490, create490, longDescription490, longName490 } from "./helpers/issue490-settings-fixture";

test.use({ ...isolatedApplicationOptions, locale:"ko-KR", timezoneId:"Asia/Seoul" });

test("Issue #490: 기본 정보·보안·읽기 전용 인증의 다섯 폭과 native 키보드·오류·잠금",async({page,baseURL},info)=>{
  test.setTimeout(180_000);
  const id=await create490(page,baseURL!);
  const settings=page.getByRole("button",{name:"프로젝트 설정",exact:true});
  await settings.click();
  const dialog=page.getByRole("dialog",{name:"프로젝트 설정",exact:true});
  await expect(dialog.getByLabel("설명",{exact:true})).toHaveValue(longDescription490);
  await capture490(page,info,"general-long");
  const firstTab=dialog.getByRole("tab",{name:"기본 정보",exact:true});await firstTab.focus();await page.keyboard.press("Home");
  await capture490(page,info,"tab-general-focus");await page.keyboard.press("ArrowRight");await expect(dialog.getByRole("tab",{name:"작업 캘린더",exact:true})).toBeFocused();
  await capture490(page,info,"tab-calendar-focus");await page.keyboard.press("End");await expect(dialog.getByRole("tab",{name:"편집·보안",exact:true})).toBeFocused();
  await capture490(page,info,"tab-security-focus");await page.keyboard.press("Home");await expect(firstTab).toBeFocused();
  await dialog.getByRole("tab",{name:"기본 정보",exact:true}).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("프로젝트 이름")).toBeFocused();
  await capture490(page,info,"general-native-focus");
  await dialog.getByLabel("프로젝트 이름").fill("");
  await dialog.getByRole("button",{name:"프로젝트 정보 저장",exact:true}).click();
  await expect(dialog.getByRole("status")).toContainText("프로젝트 이름을 입력");
  await capture490(page,info,"general-validation");
  await dialog.getByLabel("프로젝트 이름").fill(longName490+" 초안");
  await dialog.getByLabel("설명",{exact:true}).fill("탭 사이 보존할 일반 초안");
  await dialog.getByRole("tab",{name:"기본 정보",exact:true}).focus();
  await page.keyboard.press("End");
  await expect(dialog.getByRole("tab",{name:"편집·보안",exact:true})).toBeFocused();
  await capture490(page,info,"security-normal");
  await dialog.getByRole("button",{name:"편집 모드 종료",exact:true}).focus();await page.keyboard.press("Tab");await expect(dialog.getByRole("button",{name:"프로젝트 설정 닫기",exact:true})).toBeFocused();await page.keyboard.press("Shift+Tab");await expect(dialog.getByRole("button",{name:"편집 모드 종료",exact:true})).toBeFocused();
  await dialog.getByRole("button",{name:"편집 비밀번호 변경",exact:true}).click();
  await expect(dialog.getByRole("status")).toContainText("1~12자");
  await expect(dialog.getByLabel("새 편집 비밀번호",{exact:true})).toHaveValue("");
  await capture490(page,info,"security-validation");
  await page.keyboard.press("Home");
  await dialog.getByRole("tab",{name:"기본 정보",exact:true}).click();
  await expect(dialog.getByLabel("설명",{exact:true})).toHaveValue("탭 사이 보존할 일반 초안");
  let release:(()=>void)|undefined; let requests=0;
  await page.route(`**/api/projects/${id}`,async route=>{
    if(route.request().method()!=="PATCH"){await route.continue();return;}
    requests++; expect(route.request().headers()["origin"]).toBe(baseURL);expect(route.request().headers()["if-match"]).toMatch(/^"[1-9][0-9]*"$/);
    await new Promise<void>(resolve=>{release=resolve;});
    await route.fulfill({status:500,json:{error:{code:"CONTROLLED_UI_ERROR"}}});
  });
  await dialog.getByRole("button",{name:"프로젝트 정보 저장",exact:true}).click();
  await expect(dialog.getByLabel("프로젝트 이름")).toBeDisabled();
  await page.keyboard.press("Escape");await page.keyboard.press("Escape");await expect(dialog).toBeVisible();
  await capture490(page,info,"general-pending","dialog[open]","controlled deferred PATCH; actual application and draft");
  await expect.poll(()=>Boolean(release)).toBe(true);release!();
  await expect(dialog.getByRole("status")).toContainText("저장할 수 없습니다");
  await capture490(page,info,"general-error","dialog[open]","controlled PATCH500");
  expect(requests).toBe(1);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);await expect(settings).toBeFocused();
  await settings.click();await expect(dialog.getByLabel("설명",{exact:true})).toHaveValue("탭 사이 보존할 일반 초안");
  await dialog.getByRole("tab",{name:"편집·보안",exact:true}).click();
  await dialog.getByRole("button",{name:"편집 모드 종료",exact:true}).click();
  await expect(page.getByText("읽기 전용",{exact:true})).toBeVisible();
  const unlock=page.getByRole("button",{name:"편집 잠금 해제",exact:true});await unlock.click();
  const auth=page.getByRole("dialog",{name:"편집 활성화",exact:true});
  await capture490(page,info,"auth-readonly");
  await auth.getByRole("button",{name:"편집 활성화",exact:true}).click();
  await expect(auth.getByRole("status")).toContainText("비밀번호를 입력");
  await capture490(page,info,"auth-validation");
  let authRelease:(()=>void)|undefined;
  await page.route(`**/api/projects/${id}/edit-sessions`,async route=>{await new Promise<void>(resolve=>{authRelease=resolve;});await route.fulfill({status:401,json:{error:{code:"EDIT_SESSION_INVALID"}}});});
  await auth.getByLabel("편집 비밀번호",{exact:true}).fill("Wrong490!");await auth.getByRole("button",{name:"편집 활성화",exact:true}).click();
  await expect(auth.getByLabel("편집 비밀번호",{exact:true})).toBeDisabled();await expect(auth.getByLabel("편집 비밀번호",{exact:true})).toHaveValue("");
  await page.keyboard.press("Escape");await page.keyboard.press("Escape");await expect(auth).toBeVisible();
  await capture490(page,info,"auth-pending","dialog[open]","controlled deferred unlock POST");
  await expect.poll(()=>Boolean(authRelease)).toBe(true);authRelease!();
  await expect(auth.getByRole("status")).toContainText("올바르지 않습니다");
  await capture490(page,info,"auth-401","dialog[open]","controlled unlock401");
  await page.keyboard.press("Escape");await expect(auth).toHaveCount(0);await expect(unlock).toBeFocused();
});

test("Issue #490: 국가·기간·날짜 예외의 다섯 폭 validation·pending·error·stale·401·412",async({page,baseURL},info)=>{
  test.setTimeout(180_000);
  const id=await create490(page,baseURL!);
  const open=async()=>{await page.getByRole("button",{name:"프로젝트 설정",exact:true}).click();await page.getByRole("dialog").getByRole("tab",{name:"작업 캘린더",exact:true}).click();await expect(page.getByLabel("국가 1",{exact:true})).toHaveValue("KR");};
  await open();const dialog=page.getByRole("dialog",{name:"프로젝트 설정",exact:true});
  await dialog.getByLabel("국가 규칙 1 적용 범위").selectOption("DATE_RANGE");
  await dialog.getByLabel("국가 규칙 1 시작일").fill("2026-01-01");await dialog.getByLabel("국가 규칙 1 종료일").fill("2026-12-31");
  await dialog.getByRole("button",{name:"날짜 예외 추가",exact:true}).click();
  await dialog.getByLabel("날짜 예외 1 이름",{exact:true}).fill("긴 휴무 예외명 InternationalEngineeringFreeze 한국어 설명");
  await dialog.getByLabel("예외 날짜 1",{exact:true}).fill("2026-08-15");
  await capture490(page,info,"calendar-long-dates");
  await dialog.getByRole("tab",{name:"작업 캘린더",exact:true}).focus();await page.keyboard.press("Tab");await expect(dialog.getByLabel("국가 1",{exact:true})).toBeFocused();
  await capture490(page,info,"calendar-native-focus");
  await page.setViewportSize({width:390,height:900});
  await dialog.getByLabel("국가 1",{exact:true}).focus();await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("국가 규칙 1 적용 범위")).toBeFocused();
  await capture490(page,info,"calendar-field-select-focus","dialog[open]","actual native Tab to new Calendar field select",[390]);
  await page.keyboard.press("Tab");await expect(dialog.getByLabel("국가 규칙 1 시작일")).toBeFocused();
  await capture490(page,info,"calendar-field-date-focus","dialog[open]","actual native Tab to new Calendar date input",[390]);
  await dialog.getByLabel("국가 규칙 1 종료일").fill("2025-12-31");
  await dialog.getByRole("button",{name:"미리보기 계산",exact:true}).click();
  await expect(dialog.getByRole("alert")).toContainText("종료일은 시작일보다");
  await expect(dialog.getByLabel("국가 규칙 1 종료일")).toHaveAttribute("aria-invalid","true");
  await capture490(page,info,"calendar-validation");
  await dialog.getByLabel("국가 규칙 1 종료일").fill("2026-12-31");
  const original=await (await page.request.get(`/api/projects/${id}/work-calendar`)).json();
  const body={data:{countryCatalogRevision:1,projectRevision:original.data.projectRevision,calendar:{projectRevision:original.data.projectRevision,rules:original.data.rules,customDates:[],projectDates:[]},changedTasks:[],manualConflicts:[],resourceExceptionEffects:[]}};
  let mode:"normal"|"hold"|"error"|"401"|"412"="normal";let release:(()=>void)|undefined;let requestCount=0;
  await page.route(`**/api/projects/${id}/work-calendar/preview`,async route=>{
    requestCount++;expect(route.request().headers()["origin"]).toBe(baseURL);expect(route.request().headers()["if-match"]).toMatch(/^"[1-9][0-9]*"$/);
    if(mode==="hold")await new Promise<void>(resolve=>{release=resolve;});
    if(mode==="401"||mode==="412"||mode==="error"){await route.fulfill({status:mode==="error"?500:Number(mode),json:{error:{code:mode==="412"?"REVISION_MISMATCH":"CONTROLLED_UI_ERROR"}}});return;}
    await route.fulfill({json:body});
  });
  const preview=dialog.getByRole("button",{name:"미리보기 계산",exact:true});const status=dialog.locator("p[role=status][aria-atomic=true]");
  mode="hold";await preview.click();await expect(status).toContainText("계산하는 중");await expect(dialog.getByLabel("국가 1",{exact:true})).toBeDisabled();
  await capture490(page,info,"calendar-pending","dialog[open]","controlled deferred preview POST");await expect.poll(()=>Boolean(release)).toBe(true);release!();await expect(status).toContainText("계산 완료");
  await capture490(page,info,"calendar-ready","dialog[open]","controlled valid preview response");
  await dialog.getByLabel("국가 1",{exact:true}).selectOption("US");await expect(status).toContainText("다시 계산");
  await capture490(page,info,"calendar-stale","dialog[open]","actual draft invalidation after controlled preview");
  mode="error";await preview.click();await expect(status).toContainText("계산하지 못했습니다");
  await capture490(page,info,"calendar-error","dialog[open]","controlled preview500");
  mode="401";await preview.click();await expect(dialog).toHaveCount(0);await expect(page.getByText("읽기 전용",{exact:true})).toBeVisible();
  await capture490(page,info,"calendar-401","main","controlled preview401; actual fail-closed UI");
  await submitProjectUnlock(page,"Settings490!");await expect(page.getByText("편집 중",{exact:true})).toBeVisible();await open();
  mode="412";await dialog.getByRole("button",{name:"미리보기 계산",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole("button",{name:"프로젝트 설정",exact:true})).toBeVisible();
  await capture490(page,info,"calendar-412","main","controlled preview412; actual canonical refresh");expect(requestCount).toBe(4);
});

test("Issue #490: 설정 탭·닫기·metadata 저장은 WBS·Gantt 상태를 유지한다",async({page},info)=>{
  const fixture=await setup(page,{longList:true});
  const nestedId="00000000-0000-4000-8000-000000000080";
  fixture.tasks.splice(4,0,{...fixture.tasks[0],taskId:nestedId,externalId:"EDITOR-80",name:"접을 중첩 Summary",parentExternalId:"EDITOR-1",siblingOrder:0},{...fixture.tasks[1],taskId:"00000000-0000-4000-8000-000000000081",externalId:"EDITOR-81",name:"접힌 내부 작업",parentExternalId:"EDITOR-80",siblingOrder:0});await page.reload();
  await page.setViewportSize({width:1440,height:900});
  const frame=page.locator(".project-gantt-frame");
  await page.locator('.project-gantt-widget .wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000001"]').click({button:"right",position:{x:12,y:19}});
  await page.getByRole("menuitem",{name:"최상위로 열기 (작업공간 탭)",exact:true}).click();
  await expect(page.getByRole("tablist",{name:"WBS 범위 탭"}).getByRole("tab",{name:"Summary",exact:true})).toHaveAttribute("aria-selected","true");
  const header=frame.locator(".wx-table-container .wx-header").first();await header.click({button:"right"});await page.locator(".project-column-menu").getByRole("checkbox",{name:"외부 ID",exact:true}).check();await page.keyboard.press("Escape");
  const taskHeader=header.getByText("작업",{exact:true}).locator("..");const widthBefore=(await taskHeader.boundingBox())!.width;const grip=(await taskHeader.locator(".wx-grip").boundingBox())!;await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2+48,grip.y+grip.height/2,{steps:6});await page.mouse.up();expect((await taskHeader.boundingBox())!.width).toBeGreaterThan(widthBefore+20);
  await frame.getByRole("button",{name:"주",exact:true}).click();
  const target=page.locator('.project-gantt-widget .wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000004"]');await target.click({button:"right",position:{x:12,y:19}});await page.keyboard.press("Escape");
  const chart=frame.locator(".wx-chart").first(),vertical=frame.locator(".wx-gantt").first();await chart.evaluate(n=>{n.scrollLeft=120;});await vertical.evaluate(n=>{n.scrollTop=38;});
  const state=async()=>({...(await frame.evaluate(element=>({api:element.getAttribute("data-project-gantt-api-instance"),instance:element.getAttribute("data-project-gantt-instance"),publicViewport:Reflect.get(element,"__masterganttPublicViewport"),fullscreen:document.fullscreenElement===element,scale:element.getAttribute("data-gantt-scale-mode"),chartScroll:element.querySelector(".wx-chart")!.scrollLeft,verticalScroll:element.querySelector(".wx-gantt")!.scrollTop,selected:Array.from(element.querySelectorAll('.wx-row[data-copy-selected="true"]')).map(n=>n.getAttribute("data-id")),tree:Array.from(element.querySelectorAll('[data-action="open-task"]')).map(n=>({id:n.closest("[data-id]")?.getAttribute("data-id"),closed:n.classList.contains("wxi-menu-right")})),scope:document.querySelector('.project-scope-tabs [aria-selected="true"]')?.textContent,rootTask:new URL(location.href).searchParams.get("rootTask")}))),columns:await header.locator('[role="columnheader"]').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute("data-header-id"),width:n.getBoundingClientRect().width})))});
  await expect.poll(async()=>(await state()).chartScroll).toBe(120);await expect.poll(async()=>(await state()).verticalScroll).toBe(38);
  const nestedRow=page.locator(`.wx-table-container .wx-row[data-id=":${nestedId}"]`);await nestedRow.locator('[data-action="open-task"]').click();await expect(page.locator('.wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000081"]')).toHaveCount(0);
  const before=await state();expect(before.selected).toHaveLength(1);expect(before.tree.some(n=>n.closed)).toBe(true);expect(before.columns.length).toBeGreaterThan(3);expect(before.columns.some(n=>n.id===":externalId"&&n.width>0)).toBe(true);
  const phases=[{phase:"before",state:before}];
  const directory=process.env.ISSUE_490_EVIDENCE_DIR?resolve(process.env.ISSUE_490_EVIDENCE_DIR):info.outputPath("issue-490-evidence");await mkdir(directory,{recursive:true});
  const persist=async()=>writeFile(resolve(directory,"gantt-state-1440.json"),JSON.stringify({responseKind:"mock-backed canonical fixture; actual installed SVAR Core",phases,fixtureSource:"tests/e2e/fixtures/task-editor-density.ts",nativeResizePixels:48,fullscreenSettingsEntry:"project header is outside fullscreen; modal entry tested with fullscreen=false"},null,2)+"\n");await persist();
  const settings=page.getByRole("button",{name:"프로젝트 설정",exact:true});await settings.click();const dialog=page.getByRole("dialog",{name:"프로젝트 설정",exact:true});
  for(const tab of ["작업 캘린더","편집·보안","기본 정보"]){await dialog.getByRole("tab",{name:tab,exact:true}).click();phases.push({phase:`tab ${tab}`,state:await state()});await persist();await expect.poll(state).toEqual(before);}
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(settings).toBeFocused();await expect.poll(state).toEqual(before);phases.push({phase:"closed",state:await state()});
  await page.route(`**/api/projects/${fixture.project.publicId}`,async route=>{if(route.request().method()!=="PATCH"){await route.fallback();return;}expect(route.request().headers()["if-match"]).toBe(`"${fixture.project.revision}"`);const body=route.request().postDataJSON();fixture.project.name=body.name;fixture.project.description=body.description;fixture.project.revision++;await route.fulfill({json:{data:{project:fixture.project,tasks:fixture.tasks,links:fixture.links,warnings:[],operation:{kind:"projectMetadata",changedFields:["name","description"]}}}});});
  await settings.click();await dialog.getByLabel("프로젝트 이름").fill("설정 상태 보존 metadata");await dialog.getByRole("button",{name:"프로젝트 정보 저장",exact:true}).click();await expect(dialog).toHaveCount(0);await page.waitForTimeout(250);phases.push({phase:"metadata saved",state:await state()});await persist();await expect.poll(state).toEqual(before);
  await frame.getByRole("button",{name:"Gantt 전체 화면",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===document.querySelector(".project-gantt-frame"))).toBe(true);
  await page.evaluate(()=>document.exitFullscreen());await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);await expect.poll(state).toEqual(before);phases.push({phase:"native fullscreen round trip",state:await state()});
  await persist();await page.screenshot({path:resolve(directory,"gantt-state-1440.png")});
});


test("Issue #490 진단: 반복 Escape의 native cancel·close·body focus와 scoped keydown 차단",async({page,baseURL},info)=>{
  const id=await create490(page,baseURL!);await page.getByRole("button",{name:"프로젝트 설정",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"프로젝트 설정",exact:true});let release:(()=>void)|undefined;
  await page.route(`**/api/projects/${id}`,async route=>{if(route.request().method()!=="PATCH"){await route.continue();return;}await new Promise<void>(resolve=>{release=resolve;});await route.fulfill({status:500,json:{error:{code:"CONTROLLED_UI_ERROR"}}});});
  await page.evaluate(()=>{const records:unknown[]=[];Reflect.set(window,"__issue490NativeEvents",records);for(const type of ["keydown","cancel","close"])document.addEventListener(type,event=>{if(event instanceof KeyboardEvent&&event.key!=="Escape")return;const target=event.target as HTMLElement;setTimeout(()=>records.push({type,key:event instanceof KeyboardEvent?event.key:null,target:target.tagName,targetId:target.id,defaultPrevented:event.defaultPrevented,cancelable:event.cancelable,isTrusted:event.isTrusted,activeTag:document.activeElement?.tagName,dialogOpen:document.querySelector("dialog")?.hasAttribute("open")}),0);},true);});
  await dialog.getByRole("button",{name:"프로젝트 정보 저장",exact:true}).click();await expect(dialog.getByLabel("프로젝트 이름")).toBeDisabled();
  const observe=async(label:string)=>({label,state:await page.evaluate(()=>({events:Reflect.get(window,"__issue490NativeEvents"),dialogCount:document.querySelectorAll("dialog").length,open:document.querySelector("dialog")?.hasAttribute("open"),activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id,buttonDisabled:document.querySelector("dialog button")?.matches(":disabled"),topCornerOwn:document.elementFromPoint(0,0)===document.querySelector("dialog"),topCornerTag:document.elementFromPoint(0,0)?.tagName,modal:document.querySelector("dialog")?.matches(":modal")}))});
  const observations=[await observe("pending")];await page.keyboard.press("Escape");await page.keyboard.press("Escape");await page.waitForTimeout(50);observations.push(await observe("fast two Escape"));
  await page.evaluate(()=>{const dialog=document.querySelector("dialog")!;if(!dialog.open)dialog.showModal();const guard=(event:KeyboardEvent)=>{if(event.key!=="Escape"||!dialog.open)return;const target=event.target instanceof Element?event.target.closest("dialog"):null;if(target===dialog||(!target&&document.elementFromPoint(0,0)===dialog))event.preventDefault();};document.addEventListener("keydown",guard,true);Reflect.set(window,"__issue490Guard",guard);});
  await page.keyboard.press("Escape");await page.keyboard.press("Escape");await page.waitForTimeout(50);observations.push(await observe("test-only document capture prevention"));await expect(dialog).toBeVisible();
  await page.evaluate(()=>{const child=document.createElement("dialog");child.id="issue490-diagnostic-child";child.innerHTML="<button>진단 자식 닫기</button>";document.body.append(child);child.showModal();});
  observations.push(await observe("nested nonbusy top modal"));await page.keyboard.press("Escape");await page.waitForTimeout(50);expect(await page.locator("#issue490-diagnostic-child").getAttribute("open")).toBeNull();await expect(dialog).toBeVisible();await page.evaluate(()=>document.querySelector("#issue490-diagnostic-child")?.remove());
  await page.evaluate(()=>document.removeEventListener("keydown",Reflect.get(window,"__issue490Guard"),true));await expect.poll(()=>Boolean(release)).toBe(true);release!();await expect(dialog.getByRole("status")).toContainText("저장할 수 없습니다");
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"프로젝트 설정",exact:true}).click();await dialog.getByRole("tab",{name:"편집·보안",exact:true}).click();await dialog.getByRole("button",{name:"편집 모드 종료",exact:true}).click();await page.getByRole("button",{name:"편집 잠금 해제",exact:true}).click();const auth=page.getByRole("dialog",{name:"편집 활성화",exact:true});let authRelease:(()=>void)|undefined;
  await page.route(`**/api/projects/${id}/edit-sessions`,async route=>{await new Promise<void>(resolve=>{authRelease=resolve;});await route.fulfill({status:401,json:{error:{code:"EDIT_SESSION_INVALID"}}});});await auth.getByLabel("편집 비밀번호",{exact:true}).fill("Wrong490!");await auth.getByRole("button",{name:"편집 활성화",exact:true}).click();await expect(auth.getByLabel("편집 비밀번호",{exact:true})).toBeDisabled();observations.push(await observe("auth pending"));await page.keyboard.press("Escape");await page.keyboard.press("Escape");await page.waitForTimeout(50);observations.push(await observe("auth fast two Escape"));await expect.poll(()=>Boolean(authRelease)).toBe(true);authRelease!();
  await writeFile(info.outputPath("native-pending-diagnostic.json"),JSON.stringify(observations,null,2));await info.attach("native-pending-diagnostic",{body:JSON.stringify(observations),contentType:"application/json"});
});


test("Issue #490 실제 metadata 진단: 실제 API 저장의 Gantt public·native scroll",async({page,baseURL},info)=>{
  test.setTimeout(120_000);const id=await create490(page,baseURL!);let revision=1;let firstLeaf="";
  const sr=await page.request.post(`/api/projects/${id}/tasks`,{headers:{Origin:baseURL!,"If-Match":`"${revision}"`},data:{name:"실제 설정 Summary",type:"summary",externalId:"REAL-490-S"}});expect(sr.status()).toBe(201);const sb=await sr.json();revision=sb.data.project.revision;const summaryId=sb.data.tasks.find((t:{externalId:string})=>t.externalId==="REAL-490-S").taskId;
  for(let i=0;i<32;i++){
    const response=await page.request.post(`/api/projects/${id}/tasks`,{headers:{Origin:baseURL!,"If-Match":`"${revision}"`},data:{name:`실제 설정 보존 작업 ${i+1}`,type:"task",externalId:`REAL-490-${i+1}`,parentTaskId:summaryId,start:"2026-10-05",duration:90,progress:0}});expect(response.status()).toBe(201);const body=await response.json();revision=body.data.project.revision;if(i===0)firstLeaf=body.data.tasks.find((t:{externalId:string})=>t.externalId==="REAL-490-1").taskId;
  }
  const baseline=await page.request.patch(`/api/projects/${id}/tasks/${firstLeaf}`,{headers:{Origin:baseURL!,"If-Match":`"${revision}"`},data:{baseline:{start:"2026-10-06",duration:9999}}});expect(baseline.status()).toBe(200);revision=(await baseline.json()).data.project.revision;
  await page.reload();const frame=page.locator(".project-gantt-frame");await expect(frame.locator(".wx-gantt").first()).toBeVisible();await page.locator(`.wx-table-container .wx-row[data-id=":${summaryId}"]`).click({button:"right",position:{x:12,y:19}});await page.getByRole("menuitem",{name:"최상위로 열기 (작업공간 탭)",exact:true}).click();
  const header=frame.locator(".wx-table-container .wx-header").first();await header.click({button:"right"});await page.locator(".project-column-menu").getByRole("checkbox",{name:"외부 ID",exact:true}).check();await page.keyboard.press("Escape");
  const taskHeader=header.getByText("작업",{exact:true}).locator("..");const grip=(await taskHeader.locator(".wx-grip").boundingBox())!;await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2+48,grip.y+grip.height/2,{steps:6});await page.mouse.up();
  await frame.getByRole("button",{name:"주",exact:true}).click();
  const chart=frame.locator(".wx-chart").first(),vertical=frame.locator(".wx-gantt").first();await chart.evaluate(n=>{n.scrollLeft=120;});await vertical.evaluate(n=>{n.scrollTop=38;});
  const state=()=>frame.evaluate(element=>({api:element.getAttribute("data-project-gantt-api-instance"),instance:element.getAttribute("data-project-gantt-instance"),publicViewport:Reflect.get(element,"__masterganttPublicViewport"),chartScroll:element.querySelector(".wx-chart")!.scrollLeft,verticalScroll:element.querySelector(".wx-gantt")!.scrollTop,scale:element.getAttribute("data-gantt-scale-mode")}));await expect.poll(async()=>(await state()).chartScroll).toBe(120);await expect.poll(async()=>(await state()).verticalScroll).toBe(38);const before=await state();const beforeSnapshot=await(await page.request.get(`/api/projects/${id}`)).json();
  await page.getByRole("button",{name:"프로젝트 설정",exact:true}).click();const dialog=page.getByRole("dialog",{name:"프로젝트 설정",exact:true});await dialog.getByLabel("프로젝트 이름").fill("설정 상태 보존 metadata");await dialog.getByLabel("설명",{exact:true}).fill("실제 프로젝트 metadata-only 저장 진단");
  const responsePromise=page.waitForResponse(r=>r.request().method()==="PATCH"&&new URL(r.url()).pathname===`/api/projects/${id}`);await dialog.getByRole("button",{name:"프로젝트 정보 저장",exact:true}).click();const response=await responsePromise;expect(response.status()).toBe(200);await expect(dialog).toHaveCount(0);await page.waitForTimeout(250);const after=await state();const afterSnapshot=await(await page.request.get(`/api/projects/${id}`)).json();expect(afterSnapshot.data.tasks).toEqual(beforeSnapshot.data.tasks);expect(afterSnapshot.data.links).toEqual(beforeSnapshot.data.links);expect(afterSnapshot.data.project.calendar).toEqual(beforeSnapshot.data.project.calendar);expect(afterSnapshot.data.project.revision).toBe(beforeSnapshot.data.project.revision+1);if(process.env.ISSUE_490_PHASE!=="before")expect(after).toEqual(before);
  const observations={scheduleFingerprintUnchanged:true,revisionIncreasedBy:1,responseKind:"actual API Route→Service→SQLite, no route mocks",method:"PATCH",status:response.status(),origin:(await response.request().allHeaders())["origin"],ifMatch:response.request().headers()["if-match"],before,after};await writeFile(info.outputPath("actual-metadata-diagnostic.json"),JSON.stringify(observations,null,2));await info.attach("actual-metadata-diagnostic",{body:JSON.stringify(observations),contentType:"application/json"});
});

// Password/Set-Cookie/session values stay in browser/request memory and private Playwright traces.
// Published observations contain only request contract fields and boolean UI/session outcomes.
test("Issue #490: 실제 비밀번호 변경 pending·성공·세션 정책과 1440px 초점", async ({ page, baseURL, browser }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = await create490(page, baseURL!);
  const path = `/api/projects/${id}`;
  const original = (await (await page.request.get(path)).json()).data;
  const peer = await browser.newContext();
  try {
    const peerUnlock = await peer.request.post(`${baseURL}${path}/edit-sessions`, {
      headers: { Origin: baseURL! }, data: { editPassword: "Settings490!" },
    });
    expect(peerUnlock.status()).toBe(204);
    expect((await (await peer.request.get(`${baseURL}${path}/edit-sessions/current`)).json()).data.permission).toBe("edit");
    const settings = page.getByRole("button", { name: "프로젝트 설정", exact: true });
    await settings.click();
    const dialog = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
    await dialog.getByLabel("설명", { exact: true }).fill("password rotation canonical refresh가 다시 쓰는 일반 초안");
    const securityTab = dialog.getByRole("tab", { name: "편집·보안", exact: true });
    await dialog.getByRole("tab", { name: "기본 정보", exact: true }).focus();
    await page.keyboard.press("End");
    await expect(securityTab).toBeFocused();
    const password = dialog.getByLabel("새 편집 비밀번호", { exact: true });
    const safeRequests: Array<{ method: string; path: string; Origin?: string; ifMatch?: string; status?: number }> = [];
    let release: (() => void) | undefined;
    await page.route(`**${path}/edit-password`, async route => {
      const request = route.request();
      expect(request.method()).toBe("PUT");
      const headers = await request.allHeaders();
      safeRequests.push({ method: request.method(), path: new URL(request.url()).pathname, Origin: headers.origin, ifMatch: headers["if-match"] });
      expect(headers.origin).toBe(baseURL);
      expect(headers["if-match"]).toBe(`"${original.project.revision}"`);
      await new Promise<void>(resolve => { release = resolve; });
      await route.continue(); // The actual Route→Service→SQLite response and browser Set-Cookie are preserved.
    });
    await password.fill("Rotated490!");
    const rotationResponsePromise = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).pathname === `${path}/edit-password`);
    await dialog.getByRole("button", { name: "편집 비밀번호 변경", exact: true }).click();
    await expect(password).toBeDisabled();
    await expect(password).toHaveValue("");
    const pendingBodyFocus = await page.evaluate(() => document.activeElement === document.body);
    expect(pendingBodyFocus).toBe(true);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    const pendingOpen = await dialog.evaluate(node => node instanceof HTMLDialogElement && node.open && node.matches(":modal"));
    expect(pendingOpen).toBe(true);
    // A repeated form submit reaches the existing isChangingPassword guard; no second PUT is sent.
    await password.evaluate(node => (node as HTMLInputElement).form!.requestSubmit());
    expect(safeRequests).toHaveLength(1);
    await capture490(page, info, "security-rotation-pending", "dialog[open]", "actual PUT held before network forwarding", [1440]);
    await securityTab.focus();
    await page.keyboard.press("End");
    await expect(securityTab).toBeFocused();
    await capture490(page, info, "tab-rotation-security-focus", "dialog[open]", "native End during actual password PUT pending", [1440]);
    const canonicalResponsePromise = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === path);
    const currentResponsePromise = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === `${path}/edit-sessions/current`);
    expect(release).toBeDefined();
    release!();
    const rotationResponse = await rotationResponsePromise;
    expect(rotationResponse.status()).toBe(204);
    safeRequests[0].status = rotationResponse.status();
    expect(rotationResponse.headers().etag).toBe(`"${original.project.revision + 1}"`);
    expect((await canonicalResponsePromise).status()).toBe(200);
    const currentResponse = await currentResponsePromise;
    expect(currentResponse.status()).toBe(200);
    expect((await currentResponse.json()).data.permission).toBe("edit");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
    const successFocus = await page.evaluate(() => ({ body: document.activeElement === document.body, settingsTrigger: document.activeElement?.getAttribute("aria-label") === "프로젝트 설정" || document.activeElement?.textContent === "프로젝트 설정" }));
    const canonical = (await (await page.request.get(path)).json()).data;
    expect(canonical.project.revision).toBe(original.project.revision + 1);
    expect(canonical.project.description).toBe(original.project.description);
    expect(canonical.tasks).toEqual(original.tasks);
    expect(canonical.links).toEqual(original.links);
    expect(canonical.project.calendar).toEqual(original.project.calendar);
    expect(safeRequests).toHaveLength(1);
    const peerCurrent = await peer.request.get(`${baseURL}${path}/edit-sessions/current`);
    expect(peerCurrent.status()).toBe(200);
    expect((await peerCurrent.json()).data.permission).toBe("readonly");
    await capture490(page, info, "security-rotation-success", "main", "actual PUT204; canonical and caller edit session refreshed", [1440]);
    await settings.click();
    await expect(dialog.getByLabel("설명", { exact: true })).toHaveValue(original.project.description);
    await dialog.getByRole("tab", { name: "편집·보안", exact: true }).click();
    await expect(password).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(settings).toBeFocused();
    await settings.click();
    await dialog.getByRole("tab", { name: "편집·보안", exact: true }).click();
    await dialog.getByRole("button", { name: "편집 모드 종료", exact: true }).click();
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    const unlock = page.getByRole("button", { name: "편집 잠금 해제", exact: true });
    await expect(unlock).toBeFocused();
    await unlock.click();
    const auth = page.getByRole("dialog", { name: "편집 활성화", exact: true });
    const oldAttemptPromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `${path}/edit-sessions`);
    await auth.getByLabel("편집 비밀번호", { exact: true }).fill("Settings490!");
    await auth.getByRole("button", { name: "편집 활성화", exact: true }).click();
    expect((await oldAttemptPromise).status()).toBe(401);
    await expect(auth.getByRole("status")).toContainText("올바르지 않습니다");
    await expect(auth.getByLabel("편집 비밀번호", { exact: true })).toHaveValue("");
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    const newAttemptPromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `${path}/edit-sessions`);
    await auth.getByLabel("편집 비밀번호", { exact: true }).fill("Rotated490!");
    await auth.getByRole("button", { name: "편집 활성화", exact: true }).click();
    expect((await newAttemptPromise).status()).toBe(204);
    await expect(auth).toHaveCount(0);
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
    await expect(settings).toBeFocused();
    const observations = {
      responseKind: "actual password API held then continued; no fabricated responses",
      requests: safeRequests, revisionBefore: original.project.revision, revisionAfter: canonical.project.revision,
      pendingBodyFocus, pendingOpen, passwordClearedDuringPending: true, duplicatePutCount: safeRequests.length,
      securityTabNativeFocusDuringPending: true, successFocus,
      successDialogClosed: true, callerNewSessionEdit: true, previousPeerSessionReadonly: true,
      canonicalScheduleUnchanged: true, canonicalMetadataDraftReplaced: true,
      reopenedPasswordEmpty: true, normalEscapeTriggerRestored: true,
      logoutReadonlyAndUnlockFocus: true, previousPasswordRejected401: true, newPasswordAccepted204: true, unlockSettingsFocusRestored: true,
    };
    const directory = process.env.ISSUE_490_EVIDENCE_DIR ? resolve(process.env.ISSUE_490_EVIDENCE_DIR) : info.outputPath("issue-490-evidence");
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "security-rotation-contract-1440.json"), JSON.stringify(observations, null, 2) + "\n");
    await info.attach("security-rotation-contract", { body: JSON.stringify(observations), contentType: "application/json" });
  } finally { await peer.close(); }
});
