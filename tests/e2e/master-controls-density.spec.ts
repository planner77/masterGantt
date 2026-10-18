import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loginMaster455, master455Categories, mockMaster455 } from "../fixtures/project-master-455";

async function masterGeometry(page: Page) {
  return page.evaluate(() => {
    const box = (element: Element) => { const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
    const contains=(a:Element,b:Element)=>{const x=box(a),y=box(b);return y.x>=x.x-1&&y.right<=x.right+1&&y.y>=x.y-1&&y.bottom<=x.bottom+1;};
    const table=document.querySelector("table"),headers=table?Array.from(table.querySelectorAll("th")):[],rows=table?Array.from(table.querySelectorAll("tbody tr")):[];
    const dialog=document.querySelector("dialog[open]");
    const controls=Array.from((dialog??document.querySelector("main")??document).querySelectorAll("input,button")).filter(e=>e.checkVisibility({checkVisibilityCSS:true}));
    const style=(e:Element)=>{const s=getComputedStyle(e);return {borderWidth:s.borderWidth,borderStyle:s.borderStyle,borderColor:s.borderColor,borderSides:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],boxSizing:s.boxSizing,background:s.backgroundColor,padding:s.padding,minHeight:s.minHeight,font:s.font,fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,outline:s.outline,outlineOffset:s.outlineOffset,color:s.color,opacity:s.opacity};};
    return {
      viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,
      environment:{locale:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,userAgent:navigator.userAgent,zoom:"100% default;native125% NOT TESTED"},
      headings:Array.from(document.querySelectorAll("main h1,main h2,main h3")).map(e=>({label:e.textContent,rect:box(e)})),
      table:table?box(table):null,owner:table?{...box(table.parentElement!),scrollWidth:table.parentElement!.scrollWidth,clientWidth:table.parentElement!.clientWidth}:null,
      headerBodyAligned:rows.every(row=>Array.from(row.children).every((cell,i)=>Math.abs(box(cell).x-box(headers[i]).x)<=1&&Math.abs(box(cell).width-box(headers[i]).width)<=1)),
      firstRowHeaderGap:rows.length?box(rows[0]).y-box(table!.querySelector("thead")!).bottom:null,
      headers:headers.map(box),rows:rows.map(row=>({rect:box(row),controls:Array.from(row.querySelectorAll("input,button")).map(e=>({tag:e.tagName,label:e.getAttribute("aria-label")??e.textContent,rect:box(e),style:style(e),disabled:e.matches(":disabled"),marginTop:getComputedStyle(e).marginTop})),cells:Array.from(row.children).map(e=>({rect:box(e),paddingTop:getComputedStyle(e).paddingTop,paddingBottom:getComputedStyle(e).paddingBottom}))})),
      inputs:controls.filter(e=>e instanceof HTMLInputElement).map(e=>({label:e.getAttribute("aria-label")??e.closest("label")?.textContent??e.getAttribute("id"),rect:box(e),style:style(e),disabled:e.matches(":disabled"),focused:e===document.activeElement,invalid:e.getAttribute("aria-invalid"),describedBy:e.getAttribute("aria-describedby"),valueLength:(e as HTMLInputElement).type==="password"?null:Array.from((e as HTMLInputElement).value).length})),
      allControlsContained:controls.every(e=>contains(e.closest("td,label,form,[role=group],[role=tablist]")??e.parentElement!,e)),
      allControlsNonoverlapping:controls.every((a,i)=>controls.slice(i+1).every(b=>{const x=box(a),y=box(b);return !(x.x<y.right&&x.right>y.x&&x.y<y.bottom&&x.bottom>y.y);})),
      dialog:dialog?{rect:box(dialog),controls:controls.map(e=>({tag:e.tagName,label:e.getAttribute("aria-label")??e.textContent,rect:box(e),style:style(e)}))}:null,
    };
  });
}

test("#455 before 세 범주와 password dialog 5폭 computed geometry",async({page,browser})=>{
  test.skip(process.env.MASTER_CAPTURE!=="before","baseline before 전용");
  const mock=await mockMaster455(page);await loginMaster455(page);
  const dir=resolve("output/playwright/issue-455/before");await mkdir(dir,{recursive:true});
  for(const width of [390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:900});
    for(const category of master455Categories){
      const tab=page.getByRole("tab",{name:category.label,exact:true});await tab.click();const normal=await masterGeometry(page);await tab.press("Tab");const focused=await masterGeometry(page);
      await writeFile(resolve(dir,`${category.value}-${width}.json`),JSON.stringify({normal,focused,browserVersion:browser.version()},null,2)+"\n");
      if(category.value==="BUSINESS_UNIT")await page.screenshot({path:resolve(dir,`catalog-${width}.png`),fullPage:true});
    }
    await page.getByRole("button",{name:"관리자 비밀번호 변경",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();
    await writeFile(resolve(dir,`password-${width}.json`),JSON.stringify({...await masterGeometry(page),browserVersion:browser.version()},null,2)+"\n");
    if(width===390||width===1440)await page.screenshot({path:resolve(dir,`password-${width}.png`),fullPage:true});
    await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const environment=await page.evaluate(()=>({locale:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,userAgent:navigator.userAgent}));
  await writeFile(resolve(dir,"environment.json"),JSON.stringify({...environment,browserVersion:browser.version(),capturedAt:new Date().toISOString(),zoom:"100% default;native125% NOT TESTED"},null,2)+"\n");
  expect(mock.requests.filter(r=>r.method!=="GET"&&!r.path.endsWith("admin-sessions"))).toHaveLength(0);
});

const mutations = (requests: Array<{method: string;path: string}>) => requests.filter(r=>r.method!=="GET"&&!r.path.endsWith("admin-sessions"));

test("#455 after 세 범주 5폭 입력·행·표·focus 및 dialog geometry",async({page,browser})=>{
  const mock=await mockMaster455(page);await loginMaster455(page);
  const dir=resolve("output/playwright/issue-455/after");await mkdir(dir,{recursive:true});
  for(const width of [390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:900});
    for(const category of master455Categories){
      const tab=page.getByRole("tab",{name:category.label,exact:true});await tab.click();
      const normal=await masterGeometry(page);await tab.press("Tab");const focused=await masterGeometry(page);
      expect(normal.documentWidth).toBe(width);expect(normal.table!.width).toBeGreaterThanOrEqual(960);expect(normal.headers[0].width).toBeGreaterThanOrEqual(239);
      expect(normal.headerBodyAligned).toBe(true);expect(Math.abs(normal.firstRowHeaderGap!)).toBeLessThanOrEqual(1);
      expect(normal.allControlsContained).toBe(true);expect(normal.allControlsNonoverlapping).toBe(true);
      expect(normal.rows[0].rect.height).toBeGreaterThanOrEqual(40);expect(normal.rows[0].rect.height).toBeLessThanOrEqual(48);
      for(const row of normal.rows){for(const control of row.controls){expect(control.rect.height).toBe(40);expect(control.marginTop).toBe("0px");}expect(Math.max(...row.controls.map(c=>c.rect.y))-Math.min(...row.controls.map(c=>c.rect.y))).toBeLessThanOrEqual(1);expect(row.cells.every(c=>c.paddingTop==="3px"&&c.paddingBottom==="3px")).toBe(true);}
      for(const input of normal.inputs){expect(input.style.borderWidth).toBe("1px");expect(input.style.padding).toBe("8px");expect(input.style.minHeight).toBe("40px");expect(input.style.background).not.toBe("rgba(0, 0, 0, 0)");}
      expect(focused.inputs.some(i=>i.focused&&i.style.outline.includes("3px"))).toBe(true);
      await writeFile(resolve(dir,`${category.value}-${width}.json`),JSON.stringify({normal,focused,browserVersion:browser.version()},null,2)+"\n");
      if(category.value==="BUSINESS_UNIT")await page.screenshot({path:resolve(dir,`catalog-${width}.png`),fullPage:true});
      // Native Tab exposes the last action without test-driven horizontal scrolling.
      const first=page.getByLabel(`${category.label} A 이름`,{exact:true});await first.focus();
      for(let step=0;step<3;step++)await page.keyboard.press("Tab");
      await expect(page.getByRole("button",{name:"비활성화",exact:true}).first()).toBeFocused();
      await expect.poll(()=>page.evaluate(()=>{const e=document.activeElement!,owner=e.closest('[data-testid="project-master-table-scroll"]')!,r=e.getBoundingClientRect(),o=owner.getBoundingClientRect();return r.left>=o.left+5&&r.right<=o.right-5;})).toBe(true);
    }
    await page.getByRole("button",{name:"관리자 비밀번호 변경",exact:true}).click();await expect(page.getByLabel("새 비밀번호",{exact:true})).toBeFocused();
    const geometry=await masterGeometry(page);expect(geometry.documentWidth).toBe(width);expect(geometry.allControlsContained).toBe(true);expect(geometry.allControlsNonoverlapping).toBe(true);
    await writeFile(resolve(dir,`password-${width}.json`),JSON.stringify({...geometry,browserVersion:browser.version()},null,2)+"\n");
    if(width===390||width===1440)await page.screenshot({path:resolve(dir,`password-${width}.png`),fullPage:true});
    await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("button",{name:"관리자 비밀번호 변경",exact:true})).toBeFocused();
  }
  await writeFile(resolve(dir,"environment.json"),JSON.stringify({...await page.evaluate(()=>({locale:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,userAgent:navigator.userAgent})),browserVersion:browser.version(),capturedAt:new Date().toISOString(),zoom:"100% default;native125% NOT TESTED: headless Chromium native browser zoom UI unavailable;no emulation used"},null,2)+"\n");
  expect(mutations(mock.requests)).toHaveLength(0);
});

test("#455 category/filter 전환 초안과 current category 생성·명시 저장·상태 변경",async({page})=>{
  const mock=await mockMaster455(page);await loginMaster455(page);
  await page.getByLabel("사업부 이름",{exact:true}).fill("새 항목");await page.getByLabel("사업부 코드",{exact:true}).fill("new-item");
  await page.getByLabel("사업부 A 이름",{exact:true}).fill("행 초안");await page.getByLabel("미사용 사업부 코드",{exact:true}).fill("draft-code");await page.getByLabel("미사용 사업부 정렬 순서",{exact:true}).fill("42");
  await page.getByRole("tab",{name:"사업부",exact:true}).press("ArrowRight");await expect(page.getByLabel("제품 이름",{exact:true})).toHaveValue("새 항목");
  await page.getByRole("tab",{name:"제품",exact:true}).press("ArrowLeft");await expect(page.getByLabel("사업부 A 이름",{exact:true})).toHaveValue("행 초안");
  await page.getByRole("group",{name:"사업부 상태 필터"}).getByRole("button",{name:"비활성",exact:true}).click();await page.getByRole("group",{name:"사업부 상태 필터"}).getByRole("button",{name:"전체",exact:true}).click();
  await expect(page.getByLabel("사업부 A 이름",{exact:true})).toHaveValue("행 초안");await expect(page.getByLabel("미사용 사업부 코드",{exact:true})).toHaveValue("draft-code");await expect(page.getByLabel("미사용 사업부 정렬 순서",{exact:true})).toHaveValue("42");expect(mock.requests.filter(r=>r.method==="GET")).toHaveLength(1);expect(mutations(mock.requests)).toHaveLength(0);
  const used=page.getByLabel("사업부 A 코드",{exact:true});await expect(used).toBeDisabled();await expect(used).toHaveAttribute("aria-describedby","project-master-used-code-hint");await expect(used).not.toHaveAttribute("aria-invalid","true");await expect(page.locator("#project-master-used-code-hint")).toBeVisible();
  await page.getByRole("tab",{name:"제품",exact:true}).click();await page.getByLabel("제품 코드",{exact:true}).press("Enter");await expect(page.getByLabel("제품 이름",{exact:true})).toHaveValue("");
  expect(mutations(mock.requests)[0]).toMatchObject({method:"POST",ifMatch:'"7"',body:{category:"PRODUCT",name:"새 항목",code:"new-item",sortOrder:0}});
  const row=page.getByRole("row").filter({has:page.getByLabel("제품 A 이름",{exact:true})});await row.getByLabel("제품 A 이름",{exact:true}).fill("제품 변경");await row.getByRole("button",{name:"저장",exact:true}).click();await expect(page.getByLabel("제품 변경 이름",{exact:true})).toBeVisible();expect(mutations(mock.requests)[1]).toMatchObject({method:"PATCH",ifMatch:'"8"',body:{name:"제품 변경",code:"1-short",sortOrder:0}});
  await page.getByRole("row").filter({has:page.getByLabel("제품 변경 이름",{exact:true})}).getByRole("button",{name:"비활성화",exact:true}).click();await expect(page.getByRole("row").filter({has:page.getByLabel("제품 변경 이름",{exact:true})}).getByRole("button",{name:"재활성화",exact:true})).toBeVisible();expect(mutations(mock.requests)[2]).toMatchObject({body:{active:false},ifMatch:'"9"'});
});

test("#455 실제 필드 오류 식별·0/1행 및 명시 GET 실패 복구",async({page})=>{
  const mock=await mockMaster455(page);await loginMaster455(page);
  const row=page.getByRole("row").filter({has:page.getByLabel("미사용 사업부 이름",{exact:true})});await row.getByLabel("미사용 사업부 이름",{exact:true}).fill("");await row.getByRole("button",{name:"저장",exact:true}).click();await expect(row.getByLabel("미사용 사업부 이름",{exact:true})).toHaveAttribute("aria-invalid","true");expect(mutations(mock.requests)).toHaveLength(0);
  expect(await row.getByLabel("미사용 사업부 이름",{exact:true}).evaluate(input=>{const id=input.getAttribute("aria-describedby")!;return getComputedStyle(input).borderColor===getComputedStyle(document.getElementById(id)!).color;})).toBe(true);
  const dir=resolve("output/playwright/issue-455/after");await mkdir(dir,{recursive:true});await page.screenshot({path:resolve(dir,"field-error.png"),fullPage:true});await writeFile(resolve(dir,"field-error.json"),JSON.stringify(await masterGeometry(page),null,2)+"\n");
  mock.catalog.data.items=mock.catalog.data.items.filter(i=>i.category==="PRODUCT").slice(0,1);await page.getByRole("button",{name:"새로고침",exact:true}).click();await expect(page.getByText("등록된 항목이 없습니다.",{exact:true})).toBeVisible();await page.getByRole("tab",{name:"제품",exact:true}).click();await expect(page.locator("tbody tr")).toHaveCount(1);await page.getByRole("group",{name:"제품 상태 필터"}).getByRole("button",{name:"비활성",exact:true}).click();await expect(page.getByText("비활성 상태의 항목이 없습니다.",{exact:true})).toBeVisible();
  let finishLoad!:()=>void;mock.replies.push({wait:new Promise<void>(resolve=>{finishLoad=resolve;})});await page.getByRole("button",{name:"새로고침",exact:true}).click();await expect(page.getByText("최신 기준정보를 불러오는 중…",{exact:true})).toBeVisible();await expect(page.getByLabel("제품 이름",{exact:true})).toBeDisabled();finishLoad();await expect(page.getByLabel("제품 이름",{exact:true})).toBeEnabled();
  mock.replies.push({status:500});await page.getByRole("button",{name:"새로고침",exact:true}).click();await expect(page.locator("main").getByRole("alert")).toContainText("최신 기준정보를 불러오지 못했습니다");await expect(page.getByLabel("제품 이름",{exact:true})).toBeDisabled();await page.getByRole("button",{name:"새로고침",exact:true}).click();await expect(page.getByLabel("제품 이름",{exact:true})).toBeEnabled();
});

test("#455 생성 pending 동기 중복 제출과 disabled 입력 식별",async({page})=>{
  const mock=await mockMaster455(page);await loginMaster455(page);let release!:()=>void;mock.replies.push({wait:new Promise<void>(r=>{release=r;})});
  await page.getByLabel("사업부 이름",{exact:true}).fill("대기 항목");await page.getByLabel("사업부 코드",{exact:true}).fill("pending");await page.getByLabel("사업부 코드",{exact:true}).press("Enter");
  await expect.poll(()=>mutations(mock.requests).length).toBe(1);await expect(page.getByLabel("사업부 이름",{exact:true})).toBeDisabled();await expect(page.getByRole("tab",{name:"제품",exact:true})).toBeDisabled();
  await page.getByLabel("사업부 코드",{exact:true}).evaluate(e=>{const f=(e as HTMLInputElement).form!;f.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});expect(mutations(mock.requests)).toHaveLength(1);
  const dir=resolve("output/playwright/issue-455/after");await mkdir(dir,{recursive:true});await page.screenshot({path:resolve(dir,"saving.png"),fullPage:true});await writeFile(resolve(dir,"saving.json"),JSON.stringify(await masterGeometry(page),null,2)+"\n");release();await expect(page.getByLabel("사업부 이름",{exact:true})).toHaveValue("");expect(mutations(mock.requests)).toHaveLength(1);
});

test("#455 password pending 반복 Escape·Tab·닫기·중복 제출 및 복원",async({page})=>{
  const mock=await mockMaster455(page);await loginMaster455(page);await page.getByRole("button",{name:"관리자 비밀번호 변경",exact:true}).click();await page.getByLabel("새 비밀번호",{exact:true}).fill("synthetic");await page.getByLabel("새 비밀번호 확인",{exact:true}).fill("synthetic");let release!:()=>void;mock.replies.push({wait:new Promise<void>(r=>{release=r;})});await page.getByLabel("새 비밀번호 확인",{exact:true}).press("Enter");await expect.poll(()=>mutations(mock.requests).length).toBe(1);
  await page.getByRole("dialog").locator("form").evaluate(e=>e.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));for(let i=0;i<3;i++)await page.keyboard.press("Escape");await page.keyboard.press("Tab");await page.keyboard.press("Shift+Tab");await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("dialog").getByRole("button",{name:"취소",exact:true})).toBeDisabled();expect(mutations(mock.requests)).toHaveLength(1);release();await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("button",{name:"관리자 비밀번호 변경",exact:true})).toBeFocused();
  await page.getByRole("button",{name:"관리자 비밀번호 변경",exact:true}).click();await expect(page.getByLabel("새 비밀번호",{exact:true})).toHaveValue("");await page.getByLabel("새 비밀번호",{exact:true}).fill("cancel");await page.getByRole("button",{name:"취소",exact:true}).click();await page.getByRole("button",{name:"관리자 비밀번호 변경",exact:true}).click();await expect(page.getByLabel("새 비밀번호",{exact:true})).toHaveValue("");await page.keyboard.press("Escape");
});

for(const failure of ["401","403","412","412-get500","412-get401","network","malformed"]){
  test(`#455 저장 오류 ${failure} 원인·자동 재시도 없음`,async({page})=>{
    const mock=await mockMaster455(page);await loginMaster455(page);await page.getByLabel("사업부 이름",{exact:true}).fill("실패 초안");await page.getByLabel("사업부 코드",{exact:true}).fill("failure");
    if(failure==="network")mock.replies.push({network:true});else if(failure==="malformed")mock.replies.push({malformed:true});else {mock.replies.push({status:Number(failure.split("-")[0])});if(failure.includes("get"))mock.replies.push({status:Number(failure.split("get")[1])});}
    await page.getByRole("button",{name:"항목 추가",exact:true}).click();await expect(page.locator("main").getByRole("alert")).toBeVisible();expect(mutations(mock.requests)).toHaveLength(1);
    const expired=failure==="401"||failure==="412-get401";
    if(expired){await expect(page.locator("main").getByRole("alert")).toContainText("세션이 만료");await expect(page.getByLabel("관리자 비밀번호",{exact:true})).toBeFocused();await expect(page.getByLabel("관리자 비밀번호",{exact:true})).toHaveValue("");}
    else {await expect(page.getByLabel("사업부 이름",{exact:true})).toHaveValue("실패 초안");if(failure==="412-get500")await expect(page.locator("main").getByRole("alert")).toContainText("최신 기준정보를 불러오지 못했습니다");else if(failure==="412")await expect(page.locator("main").getByRole("alert")).toContainText("다른 관리 변경");}
    expect(mock.requests.filter(r=>r.method==="GET")).toHaveLength(failure.startsWith("412")?2:1);
  });
}
