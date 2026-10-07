import { expect, test, type Page, type Request } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installStatefulProjectFixture, publicId, projectPath, deferred, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";
import { exchangePreview, exchangeSnapshot, withExternalMembership } from "../fixtures/milestone-exchange";

const importDialog=(page:Page)=>page.getByRole("dialog",{name:"JSON 파일 가져오기",exact:true});
const copyDialog=(page:Page)=>page.getByRole("dialog",{name:"복사 시 단계 소속 변경",exact:true});
const file={name:"stage-source.json",mimeType:"application/json",buffer:Buffer.from('{"schemaVersion":"1.1","synthetic":true}')};
async function selectFile(page:Page){const more=page.locator('summary[aria-label="프로젝트 작업 더보기"]');if(!await more.evaluate(el=>(el.parentElement as HTMLDetailsElement).open))await more.click();const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"가져오기 (JSON)",exact:true}).click();await(await chooser).setFiles(file);}
async function start(page:Page){await page.goto(`/projects/${publicId}`);await expect(page.getByText("편집 중",{exact:true})).toBeVisible();}
async function pasteSummary(page:Page,sourceId:string,anchorId:string){
 const row=(id:string)=>page.locator(`.wx-table-container .wx-row[data-id=":${id}"]`).first();
 await row(sourceId).click({button:"right"});await page.getByRole("menu",{name:"작업 메뉴",exact:true}).getByRole("menuitem",{name:"Copy",exact:true}).click();
 if(await row(anchorId).count()===0){const toggle=row(sourceId).locator('[data-action="open-task"]');if(await toggle.count())await toggle.click();}
 await row(anchorId).click({button:"right"});await page.getByRole("menu",{name:"작업 메뉴",exact:true}).getByRole("menuitem",{name:"Paste",exact:true}).click();
 await page.getByRole("menu",{name:"Paste",exact:true}).getByRole("menuitem",{name:"Below",exact:true}).click();
}

test("#464 Import commit is bound to original file/digest/revision; pending locks and 412 retains file",async({page})=>{
 const fixture=await installStatefulProjectFixture(page), commits:Request[]=[];const gate=deferred(),started=deferred();
 await page.route(`**${projectPath}/imports/preview`,route=>route.fulfill({json:{data:exchangePreview(fixture)}}));
 await page.route(`**${projectPath}/imports`,async route=>{commits.push(route.request());started.resolve();await gate.promise;await route.fulfill({status:412,json:{error:{code:"REVISION_MISMATCH",message:"changed",details:[]}}});});
 await start(page);const identity=await rememberGanttRoot(page);await selectFile(page);const dialog=importDialog(page);
 await expect(dialog.getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeEnabled();
 await dialog.getByRole("button",{name:"기존 일정에 추가",exact:true}).click();await started.promise;
 await expect(dialog.getByRole("button",{name:"JSON 파일 가져오기 닫기",exact:true})).toBeDisabled();await page.keyboard.press("Escape");await expect(dialog).toBeVisible();
 expect(commits).toHaveLength(1);expect(commits[0].headers()["if-match"]).toBe(`"${fixture.project.revision}"`);expect(commits[0].headers()["x-import-preview-digest"]).toBe("a".repeat(64));expect(commits[0].postData()).toContain('"synthetic":true');
 gate.resolve();await expect(dialog).toContainText("파일은 유지됩니다");await expect(dialog).toContainText(file.name);await expect(dialog.getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeDisabled();expect(commits).toHaveLength(1);
 await dialog.getByRole("button",{name:"다시 미리보기",exact:true}).click();await expect(dialog.getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeEnabled();expect(commits).toHaveLength(1);await expectSameGanttRoot(page,identity);
});

test("#464 Import cancellation and later file ignore reversed preview; 401 retains File for reauthorization",async({page})=>{
 const fixture=await installStatefulProjectFixture(page),gate=deferred(),started=deferred();let previews=0;
 await page.route(`**${projectPath}/imports/preview`,async route=>{previews++;if(previews===1){started.resolve();await gate.promise;await route.fulfill({json:{data:exchangePreview(fixture,"OLD")}}).catch(()=>{});}else if(previews===2)await route.fulfill({json:{data:exchangePreview(fixture,"NEW")}});else await route.fulfill({status:401,json:{error:{code:"UNAUTHORIZED",message:"expired"}}});});
 await start(page);await selectFile(page);await started.promise;await importDialog(page).getByRole("button",{name:"취소",exact:true}).click();await selectFile(page);
 await expect(importDialog(page)).toContainText("Synthetic sourceNEW");gate.resolve();await expect(importDialog(page)).not.toContainText("Synthetic sourceOLD");
 await importDialog(page).getByRole("button",{name:"다시 미리보기",exact:true}).click();await expect(importDialog(page)).toContainText("세션이 만료");await expect(importDialog(page)).toContainText(file.name);await expect(importDialog(page).getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeDisabled();await expect(importDialog(page).getByRole("button",{name:"편집 잠금 해제 후 검토",exact:true})).toBeVisible();
});

test("#464 common Copy warning cancels without POST and fullscreen keyboard confirms exact command once",async({page})=>{
 const fixture=await installStatefulProjectFixture(page);withExternalMembership(fixture);const commands:Request[]=[];const gate=deferred(),started=deferred();
 await page.route(`**${projectPath}/task-commands`,async route=>{commands.push(route.request());started.resolve();await gate.promise;await route.fulfill({status:500,json:{error:{code:"SYNTHETIC_REJECT",message:"preserve review",details:[]}}});});
 await start(page);const identity=await rememberGanttRoot(page);
 await pasteSummary(page,fixture.tasks[0].taskId,fixture.tasks[2].taskId);await expect(copyDialog(page)).toContainText("외부 명시 연결 제외 1개");await expect(copyDialog(page).getByRole("button",{name:"취소",exact:true})).toBeFocused();expect(commands).toHaveLength(0);await page.keyboard.press("Escape");await expect(copyDialog(page)).toHaveCount(0);await expect(page.locator(`.wx-table-container .wx-row[data-id=":${fixture.tasks[2].taskId}"]`).first()).toBeFocused();
 await page.getByRole("button",{name:"Gantt 전체 화면",exact:true}).click();await expect.poll(()=>page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(true);
 const anchor=page.locator(`.wx-table-container .wx-row[data-id=":${fixture.tasks[2].taskId}"]`).first();await anchor.focus();await page.keyboard.press("Control+v");
 await expect(copyDialog(page)).toBeVisible();expect(await copyDialog(page).evaluate(el=>document.fullscreenElement?.contains(el))).toBe(true);await expect(copyDialog(page).getByRole("button",{name:"취소",exact:true})).toBeFocused();
 await copyDialog(page).getByRole("button",{name:"변경 내용을 확인하고 복사",exact:true}).click();await started.promise;await expect(copyDialog(page).getByRole("button",{name:"취소",exact:true})).toBeDisabled();await page.keyboard.press("Escape");expect(commands).toHaveLength(1);
 expect(commands[0].headers()["if-match"]).toBe(`"${fixture.project.revision}"`);expect(commands[0].postDataJSON()).toEqual({kind:"copy",taskIds:[fixture.tasks[0].taskId],anchorTaskId:fixture.tasks[2].taskId,placement:"after",acknowledgedMembershipExclusions:true});
 gate.resolve();await expect(copyDialog(page)).toContainText("작업 구조를 변경할 수 없습니다");await expectSameGanttRoot(page,identity);await copyDialog(page).getByRole("button",{name:"취소",exact:true}).click();await expect(anchor).toBeFocused();await page.getByRole("button",{name:"Gantt 전체 화면 종료",exact:true}).click();
});

test("#464 JSON latest mixed-link review precedes download and image-only controls are hidden",async({page})=>{
 const fixture=await installStatefulProjectFixture(page);let latest=false;const posts:Request[]=[];
 await page.route(`**${projectPath}`,async route=>{const body=exchangeSnapshot(fixture);if(latest){body.data.project.revision++;body.data.links.push({id:"00000000-0000-4000-8000-000000000900",predecessorExternalId:fixture.tasks[2].externalId,successorExternalId:fixture.tasks[3].externalId,type:"FS",lag:0});}await route.fulfill({json:body});});
 await page.route(`**${projectPath}/exports/json`,async route=>{posts.push(route.request());await route.fulfill({status:412,json:{error:{code:"REVISION_MISMATCH",message:"Changed after review"}}});});
 await start(page);await page.getByRole("button",{name:"내보내기",exact:true}).first().click();const dialog=page.getByRole("dialog",{name:"내보내기",exact:true});await dialog.getByLabel("형식").selectOption("json");await expect(dialog.getByRole("group",{name:"범위",exact:true})).toHaveCount(0);await expect(dialog.getByLabel("시간 단위")).toHaveCount(0);latest=true;
 await dialog.getByRole("button",{name:"내보내기",exact:true}).click();await expect(dialog).toContainText(`검토 revision ${fixture.project.revision+1}`);expect(posts).toHaveLength(0);
 await dialog.getByRole("button",{name:"원본 관계를 포함하여 JSON 다운로드",exact:true}).click();await expect(dialog.getByRole("alert")).toContainText("프로젝트가 변경되었습니다");expect(posts).toHaveLength(1);expect(posts[0].headers()["if-match"]).toBe(`"${fixture.project.revision+1}"`);expect(posts[0].postDataJSON()).toEqual({scope:"project"});
 await dialog.getByLabel("형식").selectOption("excel");await expect(dialog).toContainText("현재 Dashboard");await dialog.getByLabel("일정 Dependency 제외",{exact:true}).check();await expect(dialog).toContainText("이 선택과 관계없이 출력");
});

function geometry(element:HTMLElement){
 const bounds=element.getBoundingClientRect(),visible=(el:HTMLElement)=>{if(!el.checkVisibility({checkVisibilityCSS:true})||el.closest('[inert]'))return false;const box=el.getBoundingClientRect();let parent=el.parentElement;while(parent&&parent!==element){const style=getComputedStyle(parent);if(["auto","scroll","hidden"].includes(style.overflowY)){const owner=parent.getBoundingClientRect();if(box.bottom<=owner.top||box.top>=owner.bottom)return false;}parent=parent.parentElement;}return true;};
 const controls=Array.from(element.querySelectorAll<HTMLElement>('button,input,select,summary,[tabindex]')).filter(visible);
 const failures=controls.flatMap(el=>{const box=el.getBoundingClientRect();const owner=el.closest('td,th')??element;const parent=owner.getBoundingClientRect();return box.left<parent.left-1||box.right>parent.right+1||box.top<parent.top-1||box.bottom>parent.bottom+1?[{label:el.textContent?.trim()||el.getAttribute('aria-label'),tag:el.tagName,box:box.toJSON(),owner:parent.toJSON()}]:[];});
 const tables=Array.from(element.querySelectorAll('table')).map(table=>{const header=Array.from(table.tHead!.rows[0].cells).map(cell=>cell.getBoundingClientRect());const rows=Array.from(table.tBodies[0].rows);return{width:table.getBoundingClientRect().width,ownerWidth:table.parentElement!.clientWidth,ownedScroll:table.parentElement!.scrollWidth>table.parentElement!.clientWidth,aligned:rows.every(row=>Array.from(row.cells).every((cell,i)=>Math.abs(cell.getBoundingClientRect().left-header[i].left)<=1&&Math.abs(cell.getBoundingClientRect().width-header[i].width)<=1))};});
 const visibleRect=(el:HTMLElement)=>{let {left,top,right,bottom}=el.getBoundingClientRect();let parent=el.parentElement;while(parent&&parent!==element){const style=getComputedStyle(parent),clip=parent.getBoundingClientRect();if(["auto","scroll","hidden","clip"].includes(style.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}if(["auto","scroll","hidden","clip"].includes(style.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}parent=parent.parentElement;}return{left,top,right,bottom};}; const overlaps=controls.flatMap((left,i)=>controls.slice(i+1).flatMap(right=>{if(left.contains(right)||right.contains(left))return [];const a=visibleRect(left),b=visibleRect(right);return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1?[{left:left.textContent?.trim()||left.getAttribute('aria-label'),right:right.textContent?.trim()||right.getAttribute('aria-label')}]:[];}));
 const active=document.activeElement as HTMLElement,focus=active?.getBoundingClientRect(),style=active?getComputedStyle(active):null,ring=style&&style.outlineStyle!=="none"?parseFloat(style.outlineWidth)+Math.max(0,parseFloat(style.outlineOffset)):0;return{viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,dialog:bounds.toJSON(),controls:controls.length,failures,overlaps,tables,focusVisible:!!focus&&focus.left-ring>=bounds.left&&focus.right+ring<=bounds.right&&focus.top-ring>=bounds.top&&focus.bottom+ring<=bounds.bottom,outline:active?getComputedStyle(active).outlineStyle:null,bodyHeight:element.clientHeight,bodyScrollHeight:element.scrollHeight,verticalOwners:Array.from(element.querySelectorAll<HTMLElement>("div")).filter(el=>getComputedStyle(el).overflowY==="auto").map(el=>({height:el.clientHeight,scrollHeight:el.scrollHeight,bounds:el.getBoundingClientRect().toJSON()}))};
}

test("#464 Import and Copy 5-width dialog owned-scroll/header-body/all-control/focus geometry",async({page})=>{
 test.setTimeout(120_000);const fixture=await installStatefulProjectFixture(page);withExternalMembership(fixture);fixture.tasks[0].name="긴 한국어 Summary 이름 Long English summary identity";for(let i=0;i<20;i++)fixture.tasks.push({...fixture.tasks[2],taskId:`00000000-0000-4000-8000-${String(400+i).padStart(12,"0")}`,externalId:`LONG-COPY-CHILD-EXTERNAL-IDENTITY-${i}`,name:`긴 한국어 복사 영향 이름 Long English copy identity ${i}`,parentExternalId:fixture.tasks[0].externalId,siblingOrder:i+1});await page.route(`**${projectPath}/imports/preview`,route=>route.fulfill({json:{data:exchangePreview(fixture)}}));await start(page);mkdirSync("output/playwright/issue-464",{recursive:true});
 await pasteSummary(page,fixture.tasks[0].taskId,fixture.tasks[2].taskId);
 const copyOwner=copyDialog(page).getByRole("region",{name:"복사 소속 영향 표 가로 스크롤",exact:true});await page.setViewportSize({width:390,height:844});await copyOwner.focus();await page.keyboard.press("End");await expect.poll(()=>copyOwner.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);await page.keyboard.press("ArrowRight");await expect.poll(()=>copyOwner.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);await page.keyboard.press("Home");
 for(const width of [390,768,1024,1440,1920]){await page.setViewportSize({width,height:844});await copyDialog(page).getByRole("button",{name:"취소",exact:true}).focus();await page.keyboard.press("Tab");const metrics=await copyDialog(page).evaluate(geometry);writeFileSync(`output/playwright/issue-464/copy-geometry-${width}.json`,JSON.stringify(metrics,null,2));expect(metrics.documentWidth).toBe(width);expect(metrics.failures).toEqual([]);expect(metrics.overlaps).toEqual([]);expect(metrics.outline).not.toBe("none");expect(metrics.focusVisible).toBe(true);expect(metrics.tables.every(t=>t.aligned&&t.width>=720&&(t.width<=t.ownerWidth+1||t.ownedScroll))).toBe(true);await page.screenshot({path:`output/playwright/issue-464/copy-${width}.png`});}
 await copyDialog(page).getByRole("button",{name:"취소",exact:true}).click();await selectFile(page);await expect(importDialog(page)).toContainText("Synthetic source");
 const importOwner=importDialog(page).getByRole("region",{name:"가져오기 작업 미리보기 가로 스크롤",exact:true});await page.setViewportSize({width:390,height:844});await importOwner.focus();await page.keyboard.press("End");await expect.poll(()=>importOwner.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);await page.keyboard.press("ArrowRight");await expect.poll(()=>importOwner.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);await page.keyboard.press("Home");
 for(const width of [390,768,1024,1440,1920]){await page.setViewportSize({width,height:844});await importDialog(page).getByRole("button",{name:"다시 미리보기",exact:true}).focus();await page.keyboard.press("Tab");const metrics=await importDialog(page).evaluate(geometry);writeFileSync(`output/playwright/issue-464/import-geometry-${width}.json`,JSON.stringify(metrics,null,2));expect(metrics.documentWidth).toBe(width);expect(metrics.failures).toEqual([]);expect(metrics.overlaps).toEqual([]);expect(metrics.outline).not.toBe("none");expect(metrics.focusVisible).toBe(true);expect(metrics.tables.every(t=>t.aligned&&t.width>=960&&(t.width<=t.ownerWidth+1||t.ownedScroll))).toBe(true);await page.screenshot({path:`output/playwright/issue-464/import-${width}.png`});}
 await importDialog(page).getByRole("button",{name:"취소",exact:true}).click();await page.getByRole("button",{name:"내보내기",exact:true}).first().click();const exportDialog=page.getByRole("dialog",{name:"내보내기",exact:true});
 for(const format of ["excel","json"]){await exportDialog.getByLabel("형식").selectOption(format);for(const width of [390,768,1024,1440,1920]){await page.setViewportSize({width,height:844});await exportDialog.getByLabel("형식").focus();await page.keyboard.press("Tab");const metrics=await exportDialog.evaluate(geometry);writeFileSync(`output/playwright/issue-464/export-${format}-geometry-${width}.json`,JSON.stringify(metrics,null,2));expect(metrics.documentWidth).toBe(width);expect(metrics.failures).toEqual([]);expect(metrics.overlaps).toEqual([]);expect(metrics.outline).not.toBe("none");expect(metrics.focusVisible).toBe(true);await page.screenshot({path:`output/playwright/issue-464/export-${format}-${width}.png`});}}
});

test("#464 external canonical revision invalidates Copy acknowledgement and Import preview without losing File",async({page})=>{
 const fixture=await installStatefulProjectFixture(page);withExternalMembership(fixture);let commands=0,commits=0;
 await page.route(`**${projectPath}/task-commands`,async route=>{commands++;await route.fulfill({status:500,json:{error:{code:"UNEXPECTED_COMMAND"}}});});
 await page.route(`**${projectPath}/imports`,async route=>{commits++;await route.fulfill({status:500,json:{error:{code:"UNEXPECTED_COMMIT"}}});});
 await page.route(`**${projectPath}/imports/preview`,route=>route.fulfill({json:{data:exchangePreview(fixture)}}));
 await start(page);await pasteSummary(page,fixture.tasks[0].taskId,fixture.tasks[2].taskId);await expect(copyDialog(page)).toBeVisible();
 fixture.project.revision++;await page.evaluate(({key,revision})=>window.dispatchEvent(new StorageEvent("storage",{key,newValue:String(revision)})),{key:`mastergantt:project-revision:${publicId}`,revision:fixture.project.revision});
 await expect(copyDialog(page)).toContainText("확인은 만료");await expect(copyDialog(page).getByRole("button",{name:"변경 내용을 확인하고 복사",exact:true})).toBeDisabled();expect(commands).toBe(0);await copyDialog(page).getByRole("button",{name:"취소",exact:true}).click();
 await selectFile(page);await expect(importDialog(page).getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeEnabled();fixture.project.revision++;
 await page.evaluate(({key,revision})=>window.dispatchEvent(new StorageEvent("storage",{key,newValue:String(revision)})),{key:`mastergantt:project-revision:${publicId}`,revision:fixture.project.revision});
 await expect(importDialog(page)).toContainText(`현재 revision ${fixture.project.revision}`);await expect(importDialog(page)).toContainText(file.name);await expect(importDialog(page).getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeDisabled();expect(commits).toBe(0);await importDialog(page).getByRole("button",{name:"다시 미리보기",exact:true}).click();await expect(importDialog(page).getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeEnabled();expect(commits).toBe(0);
});

test("#464 completed Milestone boundary cannot be bypassed by Copy acknowledgement",async({page})=>{
 const fixture=await installStatefulProjectFixture(page);withExternalMembership(fixture);fixture.tasks[3].status="completed";fixture.tasks[3].progress=100;let commands=0;
 await page.route(`**${projectPath}/task-commands`,async route=>{commands++;await route.fulfill({status:500,json:{error:{code:"UNEXPECTED_COPY"}}});});
 await start(page);await pasteSummary(page,fixture.tasks[3].taskId,fixture.tasks[2].taskId);await expect(page.getByRole("menu",{name:"작업 메뉴",exact:true})).toHaveCount(0);await expect(copyDialog(page)).toHaveCount(0);await expect(page.getByText("완료 단계의 구성원·소속·관계를 온전히 보존할 수 없어 복사할 수 없습니다.",{exact:true}).first()).toBeVisible();expect(commands).toBe(0);
});

test("#464 Import 412 explicitly refreshes canonical revision and re-previews retained File before manual commit",async({page})=>{
 const fixture=await installStatefulProjectFixture(page),posts:Request[]=[],previews:number[]=[];let projectGets=0;
 page.on("request",request=>{if(request.method()==="GET"&&new URL(request.url()).pathname===projectPath)projectGets++;});
 await page.route(`**${projectPath}/imports/preview`,route=>{const preview=exchangePreview(fixture);preview.previewDigest=(previews.length?"b":"a").repeat(64);previews.push(preview.baseRevision);return route.fulfill({json:{data:preview}});});
 await page.route(`**${projectPath}/imports`,async route=>{
  posts.push(route.request());if(posts.length===1){await route.fulfill({status:412,json:{error:{code:"REVISION_MISMATCH",message:"concurrent change"}}});return;}
  const preview=exchangePreview(fixture),milestoneId="00000000-0000-4000-8000-000000000500";
  fixture.tasks.push(...preview.normalizedTasks.map((task,i)=>({...task,status:task.status??undefined,taskId:`00000000-0000-4000-8000-${String(i+500).padStart(12,"0")}`,siblingOrder:i+3,membership:{explicitMilestoneTaskId:i?milestoneId:null,effectiveMilestoneTaskId:i?milestoneId:null,inheritedFromTaskId:null}})));fixture.project.revision++;
  await route.fulfill({status:201,json:exchangeSnapshot(fixture)});
 });
 await start(page);const identity=await rememberGanttRoot(page);await selectFile(page);const dialog=importDialog(page);await expect(dialog.getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeEnabled();const reviewed=fixture.project.revision;fixture.project.revision++;
 await dialog.getByRole("button",{name:"기존 일정에 추가",exact:true}).click();await expect(dialog).toContainText("새 미리보기가 필요");expect(posts).toHaveLength(1);expect(previews).toEqual([reviewed]);const beforeGets=projectGets;
 await dialog.getByRole("button",{name:"최신 일정 조회",exact:true}).click();await expect(dialog).toContainText(`현재 revision ${fixture.project.revision}`);expect(projectGets-beforeGets).toBe(1);await expect(dialog).toContainText(file.name);await expect(dialog.getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeDisabled();expect(posts).toHaveLength(1);expect(previews).toHaveLength(1);
 await dialog.getByRole("button",{name:"다시 미리보기",exact:true}).click();await expect(dialog.getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeEnabled();expect(previews).toEqual([reviewed,reviewed+1]);expect(posts).toHaveLength(1);
 await dialog.getByRole("button",{name:"기존 일정에 추가",exact:true}).click();await expect(dialog).toHaveCount(0);expect(posts).toHaveLength(2);expect(posts[1].headers()["if-match"]).toBe(`"${reviewed+1}"`);expect(posts[1].headers()["x-import-preview-digest"]).toBe("b".repeat(64));expect(posts[1].postData()).toContain('"synthetic":true');expect(fixture.project.revision).toBe(reviewed+2);await expectSameGanttRoot(page,identity);
});

test("#464 cancelled latest canonical query ignores its late response; network failure preserves File for explicit retry",async({page})=>{
 const fixture=await installStatefulProjectFixture(page),gate=deferred(),started=deferred();let refreshGets=0,armed=false;
 await page.route(`**${projectPath}/imports/preview`,route=>route.fulfill({json:{data:exchangePreview(fixture)}}));
 await page.route(`**${projectPath}`,async route=>{if(!armed){await route.fallback();return;}refreshGets++;if(refreshGets===1){const late=exchangeSnapshot(fixture);late.data.project.revision+=10;started.resolve();await gate.promise;await route.fulfill({json:late}).catch(()=>{});}else if(refreshGets===2)await route.abort("failed");else await route.fulfill({json:exchangeSnapshot(fixture)});});
 await start(page);await selectFile(page);await expect(importDialog(page)).toContainText("Synthetic source");armed=true;
 await importDialog(page).getByRole("button",{name:"최신 일정 조회",exact:true}).click();await started.promise;await importDialog(page).getByRole("button",{name:"취소",exact:true}).click();await expect(importDialog(page)).toHaveCount(0);gate.resolve();await selectFile(page);await expect(importDialog(page)).toContainText(`현재 revision ${fixture.project.revision}`);
 await importDialog(page).getByRole("button",{name:"최신 일정 조회",exact:true}).click();await expect(importDialog(page)).toContainText("최신 일정을 조회하지 못했습니다");await expect(importDialog(page)).toContainText(file.name);expect(refreshGets).toBe(2);await expect(importDialog(page).getByRole("button",{name:"기존 일정에 추가",exact:true})).toBeDisabled();
 await importDialog(page).getByRole("button",{name:"최신 일정 조회",exact:true}).click();await expect(importDialog(page).getByRole("button",{name:"다시 미리보기",exact:true})).toBeEnabled();expect(refreshGets).toBe(3);await expect(importDialog(page)).toContainText(`현재 revision ${fixture.project.revision}`);
});
