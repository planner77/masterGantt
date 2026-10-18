import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loginLogistics454, mockLogistics454 } from "../fixtures/logistics-admin-454";

async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const table = document.querySelector("table")!;
    const headers = Array.from(table.querySelectorAll("th"));
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const dialog = document.querySelector("dialog[open]");
    const visible = (e: Element) => e.checkVisibility({ checkVisibilityCSS: true });
    const controls = Array.from((dialog ?? document.querySelector("main") ?? document).querySelectorAll("button,input")).filter(visible);
    const contains = (parent: Element, child: Element) => { const a=box(parent),b=box(child);return b.x>=a.x-1&&b.right<=a.right+1&&b.y>=a.y-1&&b.bottom<=a.bottom+1; };
    const cellControls = Array.from(table.querySelectorAll("tbody button"));
    const cells = Array.from(table.querySelectorAll("tbody td"));
    const textRects = cells.filter(cell=>!cell.querySelector("button")).map(cell=>{
      const range=document.createRange();range.selectNodeContents(cell);const a=box(cell);const rects=Array.from(range.getClientRects()).map(r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom}));
      return {cell:a,rects,contained:rects.every(r=>r.x>=a.x-1&&r.right<=a.right+1&&r.y>=a.y-1&&r.bottom<=a.bottom+1)};
    });
    return {
      viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
      environment: { locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, userAgent: navigator.userAgent, zoom: "100% default; native 125% NOT TESTED" },
      table: box(table), owner: { ...box(table.parentElement!), clientWidth: table.parentElement!.clientWidth, scrollWidth: table.parentElement!.scrollWidth },
      allControlsNonoverlapping: controls.every((a,i)=>controls.slice(i+1).every(b=>{const x=box(a),y=box(b);return !(x.x<y.right&&x.right>y.x&&x.y<y.bottom&&x.bottom>y.y);})),
      allCellControlsContained: cellControls.every(button=>contains(button.closest("td")!,button)),
      allTextContained: textRects.every(x=>x.contained),textRects,
      allOtherControlsContained: controls.every(control=>contains(control.closest("td,label,form,[role=group]")??control.parentElement!,control)),
      numericHeaderAlignment: getComputedStyle(headers[3]).textAlign,
      numericCells: rows.map(row=>({alignment:getComputedStyle(row.children[3]).textAlign,variant:getComputedStyle(row.children[3]).fontVariantNumeric})),
      headerBodyAligned: rows.every(row=>Array.from(row.children).every((cell,i)=>Math.abs(box(cell).x-box(headers[i]).x)<=1&&Math.abs(box(cell).width-box(headers[i]).width)<=1)),
      headers: headers.map(box), rows: rows.map(row => ({ rect: box(row), cells: Array.from(row.children).map(cell => ({ rect: box(cell), paddingTop: getComputedStyle(cell).paddingTop, paddingBottom: getComputedStyle(cell).paddingBottom })), actions: Array.from(row.querySelectorAll("button")).map(button => ({ label: button.textContent, rect: box(button), marginTop: getComputedStyle(button).marginTop })) })),
      controls: controls.map(e => ({ tag: e.tagName, label: e.getAttribute("aria-label") ?? e.textContent ?? "", rect: box(e) })),
      dialog: dialog ? { rect: box(dialog), actions: Array.from(dialog.querySelectorAll("button")).map(e => ({ label: e.textContent, rect: box(e), marginTop: getComputedStyle(e).marginTop })) } : null,
      focused: document.activeElement ? { tag: document.activeElement.tagName, rect: box(document.activeElement) } : null,
    };
  });
}

test("#454 before 두 유형과 이름·비밀번호 dialog 5폭 실제 geometry", async ({ page, browser }) => {
  test.skip(process.env.LOGISTICS_CAPTURE !== "before", "before 전용 baseline 캡처");
  const mock = await mockLogistics454(page);
  await loginLogistics454(page);
  const dir = resolve("output/playwright/issue-454/before");
  await mkdir(dir, { recursive: true });
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [label, key] of [["설비 유형", "equipment"], ["시스템 유형", "system"]]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const facts = await geometry(page);
      await writeFile(resolve(dir, `${key}-${width}.json`), JSON.stringify({ ...facts, browserVersion: browser.version() }, null, 2) + "\n");
      await page.screenshot({ path: resolve(dir, `${key}-${width}.png`), fullPage: true });
    }
    await page.getByRole("button", { name: "이름 수정", exact: true }).first().click();
    for (const [key, close] of [["rename", "취소"], ["password", "취소"]]) {
      if (key === "password") await page.getByRole("button", { name: "관리자 비밀번호 변경", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await writeFile(resolve(dir, `${key}-${width}.json`), JSON.stringify({ ...await geometry(page), browserVersion: browser.version() }, null, 2) + "\n");
      await page.screenshot({ path: resolve(dir, `${key}-${width}.png`), fullPage: true });
      await dialog.getByRole("button", { name: close, exact: true }).click();
    }
  }
  expect(mock.requests.filter(r => !r.path.endsWith("admin-sessions") && r.method !== "GET")).toHaveLength(0);
});

function assertDialogFacts(facts: Awaited<ReturnType<typeof geometry>>) {
  expect(facts.documentWidth).toBeLessThanOrEqual(facts.viewport.width);
  expect(facts.allOtherControlsContained).toBe(true);expect(facts.allControlsNonoverlapping).toBe(true);
  expect(facts.dialog!.rect.x).toBeGreaterThanOrEqual(0);
  expect(facts.dialog!.rect.right).toBeLessThanOrEqual(facts.viewport.width);
  const footer = facts.dialog!.actions.filter(a => ["취소", "저장", "변경"].includes(a.label!));
  expect(footer).toHaveLength(2);
  expect(Math.abs(footer[0].rect.y-footer[1].rect.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(footer[0].rect.height-footer[1].rect.height)).toBeLessThanOrEqual(1);
}

test("#454 after 두 유형·dialog 5폭 정렬과 마지막 action keyboard 접근", async ({ page, browser }) => {
  await mockLogistics454(page); await loginLogistics454(page);
  const dir=resolve("output/playwright/issue-454/after");await mkdir(dir,{recursive:true});
  for(const width of [390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:900});
    for(const [label,key] of [["설비 유형","equipment"],["시스템 유형","system"]]){
      await page.getByRole("button",{name:label,exact:true}).click();
      await page.locator("table").evaluate(table=>{table.parentElement!.scrollLeft=0;});
      const facts=await geometry(page);
      expect(facts.documentWidth).toBeLessThanOrEqual(width);
      expect(facts.table.width).toBeGreaterThanOrEqual(824);
      expect(facts.headers[0].width).toBeGreaterThanOrEqual(240);
      expect(facts.numericHeaderAlignment).toBe("right");expect(facts.numericCells.every(c=>c.alignment==="right"&&c.variant==="tabular-nums")).toBe(true);
      expect(facts.headerBodyAligned).toBe(true);expect(facts.allCellControlsContained).toBe(true);expect(facts.allTextContained).toBe(true);expect(facts.allOtherControlsContained).toBe(true);expect(facts.allControlsNonoverlapping).toBe(true);
      expect(facts.rows[0].rect.height).toBeGreaterThanOrEqual(40);expect(facts.rows[0].rect.height).toBeLessThanOrEqual(48);
      for(const row of facts.rows){expect(Math.abs(row.actions[0].rect.y-row.actions[1].rect.y)).toBeLessThanOrEqual(1);expect(Math.abs(row.actions[0].rect.height-row.actions[1].rect.height)).toBeLessThanOrEqual(1);expect(row.actions.every(a=>a.marginTop==="0px")).toBe(true);}
      await writeFile(resolve(dir,`${key}-${width}.json`),JSON.stringify({...facts,browserVersion:browser.version()},null,2)+"\n");
      await page.screenshot({path:resolve(dir,`${key}-${width}.png`),fullPage:true});
      await page.getByRole("button",{name:"이름 수정",exact:true}).last().press("Tab");
      const lastAction=page.getByRole("button",{name:"재활성화",exact:true});await expect(lastAction).toBeFocused();
      await expect.poll(async()=>lastAction.evaluate(button=>{const r=button.getBoundingClientRect(),b=button.closest("table")!.parentElement!.getBoundingClientRect();return r.right+6<=b.right;})).toBe(true);
      const focus=await lastAction.evaluate(button=>{const r=button.getBoundingClientRect(),owner=button.closest("table")!.parentElement!,b=owner.getBoundingClientRect();return {left:r.left,right:r.right,ownerLeft:b.left,ownerRight:b.right,top:r.top,bottom:r.bottom,ownerTop:b.top,ownerBottom:b.bottom,scrollLeft:owner.scrollLeft,outline:getComputedStyle(button).outlineStyle};});
      expect(focus.left-6).toBeGreaterThanOrEqual(focus.ownerLeft);expect(focus.right+6).toBeLessThanOrEqual(focus.ownerRight);expect(focus.top-6).toBeGreaterThanOrEqual(focus.ownerTop);expect(focus.bottom+6).toBeLessThanOrEqual(focus.ownerBottom);expect(focus.outline).not.toBe("none");if(width<1024)expect(focus.scrollLeft).toBeGreaterThan(0);
      await writeFile(resolve(dir,`${key}-${width}.json`),JSON.stringify({...facts,browserVersion:browser.version(),keyboardFocus:focus},null,2)+"\n");
      const scrollBeforePointer=await page.locator("table").evaluate(table=>table.parentElement!.scrollLeft);
      await page.getByRole("button",{name:"이름 수정",exact:true}).first().click();
      if(width>=1024)expect(await page.locator("table").evaluate(table=>table.parentElement!.scrollLeft)).toBe(scrollBeforePointer);
      const dialog=page.getByRole("dialog",{name:"유형 이름 수정",exact:true});await expect(dialog.getByLabel("표시명",{exact:true})).toBeFocused();await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button",{name:"이름 수정",exact:true}).first()).toBeFocused();
    }
    await page.getByRole("button",{name:"이름 수정",exact:true}).first().click();
    for(const key of ["rename","password"]){
      if(key==="password")await page.getByRole("button",{name:"관리자 비밀번호 변경",exact:true}).click();
      const dialog=page.getByRole("dialog");const input=dialog.getByLabel(key==="rename"?"표시명":"새 비밀번호",{exact:true});await expect(input).toBeFocused();
      const facts=await geometry(page);assertDialogFacts(facts);
      await writeFile(resolve(dir,`${key}-${width}.json`),JSON.stringify({...facts,browserVersion:browser.version()},null,2)+"\n");
      if(width===390||width===1440)await page.screenshot({path:resolve(dir,`${key}-${width}.png`),fullPage:true});
      await page.keyboard.press("Shift+Tab");await page.keyboard.press("Shift+Tab");await expect(dialog.getByRole("button",{name:key==="rename"?"저장":"취소",exact:true})).toBeFocused();
      await page.keyboard.press("Tab");await expect(dialog.getByRole("button",{name:key==="rename"?"유형 이름 수정 닫기":"관리자 비밀번호 변경 닫기",exact:true})).toBeFocused();
      await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);
    }
  }
  const environment=await page.evaluate(()=>({locale:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,userAgent:navigator.userAgent}));
  await writeFile(resolve(dir,"environment.json"),JSON.stringify({...environment,browserVersion:browser.version(),capturedAt:new Date().toISOString(),zoom:"100% default; native125% NOT TESTED"},null,2)+"\n");
});

for(const [label,code] of [["설비 유형","agv"],["시스템 유형","mcs"]])test(`#454 ${label} 추가·이름·활성 변경은 explicit payload와 If-Match 보존`,async({page})=>{
  const mock=await mockLogistics454(page);await loginLogistics454(page);await page.getByRole("button",{name:label,exact:true}).click();
  await page.getByLabel("유형명",{exact:true}).fill("New synthetic type");await page.getByLabel("코드",{exact:true}).fill("new-type");await page.getByLabel("정렬",{exact:true}).fill("9");await page.getByRole("button",{name:"유형 추가",exact:true}).click();await expect(page.getByText("New synthetic type",{exact:true})).toBeVisible();
  const table=page.getByRole("table"),row=table.getByRole("row").filter({has:page.getByRole("cell",{name:code,exact:true})});await row.getByRole("button",{name:"이름 수정",exact:true}).click();
  const dialog=page.getByRole("dialog");await dialog.getByLabel("표시명",{exact:true}).fill("Updated synthetic name");await dialog.getByRole("button",{name:"저장",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(row.getByRole("cell",{name:code,exact:true})).toBeVisible();await expect(row.getByRole("cell",{name:"0",exact:true})).toBeVisible();
  await row.getByRole("button",{name:"비활성화",exact:true}).click();await expect(row.getByRole("button",{name:"재활성화",exact:true})).toBeVisible();await row.getByRole("button",{name:"재활성화",exact:true}).click();await expect(row.getByRole("button",{name:"비활성화",exact:true})).toBeVisible();
  const mutations=mock.requests.filter(r=>r.method!=="GET"&&!r.path.endsWith("admin-sessions"));expect(mutations.map(r=>r.ifMatch)).toEqual(['"7"','"8"','"9"','"10"']);expect(mutations.map(r=>r.body)).toEqual([{code:"new-type",name:"New synthetic type",sortOrder:9},{name:"Updated synthetic name"},{active:false},{active:true}]);
});

for(const unit of ["rename","password"])test(`#454 ${unit} pending 동기 제출1·반복 Escape와 focus`,async({page})=>{
  const mock=await mockLogistics454(page);await loginLogistics454(page);mock.control.holdMutation=true;
  const trigger=page.getByRole("button",{name:unit==="rename"?"이름 수정":"관리자 비밀번호 변경",exact:true}).first();await trigger.click();const dialog=page.getByRole("dialog");
  if(unit==="rename")await dialog.getByLabel("표시명",{exact:true}).fill("Pending name");else{await dialog.getByLabel("새 비밀번호",{exact:true}).fill("Synthetic1!");await dialog.getByLabel("새 비밀번호 확인",{exact:true}).fill("Synthetic1!");}
  await dialog.locator("form").evaluate(form=>{(form as HTMLFormElement).requestSubmit();(form as HTMLFormElement).requestSubmit();});await expect.poll(()=>mock.requests.filter(r=>r.method!=="GET"&&!r.path.endsWith("admin-sessions")).length).toBe(1);
  await expect(dialog.locator("input").first()).toBeDisabled();await expect(dialog.getByRole("button",{name:"취소",exact:true})).toBeDisabled();
  for(let i=0;i<5;i++){await page.keyboard.press("Escape");await expect(dialog).toBeVisible();}await page.keyboard.press("Tab");await page.keyboard.press("Shift+Tab");expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  const close=await dialog.getByRole("button",{name:"취소",exact:true}).boundingBox();await page.mouse.click(close!.x+close!.width/2,close!.y+close!.height/2);await expect(dialog).toBeVisible();
  for(const width of [390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});const pendingFacts=await geometry(page);assertDialogFacts(pendingFacts);expect(pendingFacts.rows[0].rect.height).toBe(47);for(const row of pendingFacts.rows)expect(Math.abs(row.actions[0].rect.y-row.actions[1].rect.y)).toBeLessThanOrEqual(1);for(let i=0;i<5;i++){await page.keyboard.press("Escape");await expect(dialog).toBeVisible();}}
  
  mock.releaseMutation();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();if(unit==="password"){await trigger.click();await expect(page.getByLabel("새 비밀번호",{exact:true})).toHaveValue("");}
});

for(const afterGet of [200,500,401])test(`#454 이름 412 뒤 GET${afterGet}는 원인·초안·수동 retry 보존`,async({page})=>{
  const mock=await mockLogistics454(page);await loginLogistics454(page);await page.getByRole("button",{name:"이름 수정",exact:true}).first().click();const dialog=page.getByRole("dialog");await dialog.getByLabel("표시명",{exact:true}).fill("412 draft");mock.control.nextMutationStatus=412;mock.control.nextReadStatus=afterGet;await dialog.getByRole("button",{name:"저장",exact:true}).click();
  await expect.poll(()=>mock.requests.filter(r=>r.method==="PATCH").length).toBe(1);
  if(afterGet===401){await expect(page.getByRole("heading",{name:"관리자 로그인",exact:true})).toBeVisible();await expect(page.getByLabel("관리자 비밀번호",{exact:true})).toBeFocused();await expect(page.getByRole("alert").first()).toContainText("세션이 만료");return;}
  await expect(dialog.getByLabel("표시명",{exact:true})).toHaveValue("412 draft");
  if(afterGet===500){await page.setViewportSize({width:390,height:900});assertDialogFacts(await geometry(page));await expect(dialog.getByRole("alert")).toContainText("목록을 불러오지 못했습니다");await expect(dialog.getByRole("button",{name:"저장",exact:true})).toBeDisabled();await dialog.getByRole("button",{name:"최신 목록 조회",exact:true}).click();await expect(dialog.getByRole("button",{name:"저장",exact:true})).toBeEnabled();}
  else await expect(dialog.getByRole("alert")).toContainText("다른 관리 변경");
  expect(mock.requests.filter(r=>r.method==="PATCH")).toHaveLength(1);await dialog.getByRole("button",{name:"저장",exact:true}).click();await expect(dialog).toHaveCount(0);expect(mock.requests.filter(r=>r.method==="PATCH").map(r=>r.ifMatch)).toEqual(['"7"','"8"']);
});

for(const failure of ["network","malformed","401"])test(`#454 이름 ${failure} 실패는 성공·자동 retry 없이 명시 복구`,async({page})=>{
  const mock=await mockLogistics454(page);await loginLogistics454(page);await page.getByRole("button",{name:"이름 수정",exact:true}).first().click();const dialog=page.getByRole("dialog");await dialog.getByLabel("표시명",{exact:true}).fill("Failure draft");
  if(failure==="network")mock.control.networkMutation=true;else if(failure==="malformed")mock.control.malformedMutation=true;else mock.control.nextMutationStatus=401;
  await dialog.getByRole("button",{name:"저장",exact:true}).click();await expect.poll(()=>mock.requests.filter(r=>r.method==="PATCH").length).toBe(1);
  if(failure==="401"){await expect(page.getByRole("heading",{name:"관리자 로그인",exact:true})).toBeVisible();await expect(page.getByLabel("관리자 비밀번호",{exact:true})).toHaveValue("");await expect(page.getByLabel("관리자 비밀번호",{exact:true})).toBeFocused();return;}
  await expect(dialog.getByLabel("표시명",{exact:true})).toHaveValue("Failure draft");await expect(dialog.getByRole("button",{name:"저장",exact:true})).toBeDisabled();await dialog.getByRole("button",{name:"최신 목록 조회",exact:true}).click();await expect(dialog.getByRole("button",{name:"저장",exact:true})).toBeEnabled();expect(mock.requests.filter(r=>r.method==="PATCH")).toHaveLength(1);
});

test("#454 loading·GET 오류·catalog0·filter0와 종류 전환은 mutation0",async({page})=>{
  const mock=await mockLogistics454(page);mock.control.holdRead=true;await page.goto("/logistics-admin");await page.getByLabel("관리자 비밀번호",{exact:true}).fill("synthetic");await page.getByRole("button",{name:"로그인",exact:true}).click();await expect(page.getByText("최신 물류 유형 목록을 불러오는 중입니다.",{exact:true})).toBeVisible();mock.control.nextReadStatus=500;mock.releaseRead();await expect(page.getByRole("button",{name:"다시 시도",exact:true})).toBeEnabled();mock.catalog.data.equipmentTypes=[];mock.catalog.data.systemTypes=mock.catalog.data.systemTypes.filter(t=>t.active);mock.catalog.data.systemTypes[0].usageCount=1;await page.getByRole("button",{name:"다시 시도",exact:true}).click();await expect(page.getByText("등록된 유형이 없습니다.",{exact:true})).toBeVisible();await page.getByRole("button",{name:"시스템 유형",exact:true}).click();await expect(page.getByRole("cell",{name:"1",exact:true})).toBeVisible();await page.getByRole("button",{name:"비활성",exact:true}).click();await expect(page.getByText("비활성 유형이 없습니다.",{exact:true})).toBeVisible();expect(mock.requests.filter(r=>r.method==="GET")).toHaveLength(2);expect(mock.requests.filter(r=>r.method!=="GET"&&!r.path.endsWith("admin-sessions"))).toHaveLength(0);
});
