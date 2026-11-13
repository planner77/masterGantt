import { test, expect } from "./fixtures/isolated-application";
import type { Route } from "@playwright/test";

test.use({ isolatedProjectMasterAdminPassword: "I18n-test-only-866" });

test("Issue #866: 실제 마스터 표시명 저장·새로고침·해제·동명 ID 선택과 5폭 입력 geometry", async ({ page, browser, isolatedApplication }, testInfo) => {
  test.setTimeout(180_000);
  const origin = isolatedApplication;
  const denied = await page.request.get(`${origin}/api/project-master/admin/items`);
  expect(denied.status()).toBe(401);
  await page.goto(`${origin}/project-master-admin`);
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("I18n-test-only-866");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관리자 인증됨", exact: true })).toBeVisible();
  const ensureAdmin = async () => {
    const form = page.locator("form").filter({ has: page.locator('input[autocomplete="current-password"]') });
    await form.locator('input[type="password"]').fill("I18n-test-only-866");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('[data-testid="project-master-table-scroll"]')).toBeVisible();
  };
  const originalNames = ["조립팀 A", "다른 원문 B"];
  for (const [index, name] of originalNames.entries()) {
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "항목 추가", exact: true }) });
    await form.getByLabel("사업부 이름", { exact: true }).fill(name);
    await form.getByLabel("사업부 코드", { exact: true }).fill(`I18N-${index}`);
    const translations = form.getByRole("group", { name: "언어별 표시명 (선택)", exact: true });
    await translations.getByLabel("English", { exact: true }).fill("Assembly Team");
    await translations.getByLabel("Tiếng Việt", { exact: true }).fill(`Đội lắp ráp ${index} với tên dài để kiểm tra bố cục`);
    const saved = page.waitForResponse(response => response.url().endsWith("/api/project-master/admin/items") && response.request().method() === "POST");
    await form.getByRole("button", { name: "항목 추가", exact: true }).click();
    expect((await saved).ok()).toBe(true);
  }
  const read = async () => {
    const response = await page.request.get(`${origin}/api/project-master/admin/items`);
    expect(response.ok()).toBe(true);
    return (await response.json()).data as { revision: number; items: Array<{id:string; name:string; code:string; translations?:Record<string,string>}> };
  };
  let data = await read();
  const items = data.items.filter(item => originalNames.includes(item.name)).sort((a,b)=>a.code.localeCompare(b.code));
  expect(items).toHaveLength(2);
  expect(items.map(item => item.translations?.en)).toEqual(["Assembly Team", "Assembly Team"]);
  await page.reload();
  await ensureAdmin();
  await expect(page.getByLabel("조립팀 A 이름", { exact: true })).toHaveValue("조립팀 A");
  await page.getByRole("combobox", { name: "표시 언어", exact: true }).first().selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByLabel("Search name or code", { exact: true }).fill("Assembly Team");
  const table = page.locator('[data-testid="project-master-table-scroll"] table');
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const row = table.locator("tbody tr").filter({ has: page.locator('input[value="조립팀 A"]') });
  await row.getByRole("button", { name: "Translate display name", exact: true }).click();
  await row.getByLabel("English", { exact: true }).fill("Unsaved draft");
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await read()).items.find(item => item.id === items[0]!.id)?.translations?.en).toBe("Assembly Team");
  await row.getByRole("button", { name: "Translate display name", exact: true }).click();
  await row.getByLabel("English", { exact: true }).fill("Preserved after 401");
  const patchUrl=`${origin}/api/project-master/admin/items/${items[0]!.id}`;
  const unauthorized = async (route: Route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    await route.fulfill({ status:401, json:{ error:{ code:"UNAUTHORIZED", message:"unsafe-upstream-marker" } } });
  };
  await page.route(patchUrl, unauthorized);
  try {
    const rejected = page.waitForResponse(response => response.url() === patchUrl && response.request().method() === "PATCH");
    await row.getByRole("button", { name: "Save translations", exact: true }).click();
    const response = await rejected;
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error:{ code:"UNAUTHORIZED", message:"unsafe-upstream-marker" } });
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await expect(page.getByText("unsafe-upstream-marker")).toHaveCount(0);
  } finally { await page.unroute(patchUrl, unauthorized); }
  await ensureAdmin();
  await row.getByRole("button", { name: "Continue preserved draft", exact: true }).click();
  await expect(row.getByLabel("English", { exact: true })).toHaveValue("Preserved after 401");
  expect((await read()).items.find(item=>item.id===items[0]!.id)?.translations?.en).toBe("Assembly Team");
  // Advance the real catalog without changing either item's source or display names.
  // The preserved UI draft must now receive an actual revision-CAS rejection.
  const beforeConflict = await read();
  const concurrent = await page.request.patch(`${origin}/api/project-master/admin/items/${items[1]!.id}`, {
    headers:{ Origin:origin, "If-Match":`"${beforeConflict.revision}"` }, data:{ sortOrder:1 },
  });
  expect(concurrent.ok()).toBe(true);
  const latest = (await concurrent.json()).data as typeof beforeConflict;
  expect(latest.revision).toBeGreaterThan(beforeConflict.revision);
  expect(latest.items.find(item => item.id === items[0]!.id)?.translations?.en).toBe("Assembly Team");
  const catalogUrl = `${origin}/api/project-master/admin/items`;
  let releaseRefresh!: () => void;
  let observeRefresh!: () => void;
  const refreshHeld = new Promise<void>(resolve => { observeRefresh = resolve; });
  const refreshRelease = new Promise<void>(resolve => { releaseRefresh = resolve; });
  const holdRefresh = async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    observeRefresh();
    await refreshRelease;
    await route.continue();
  };
  await page.route(catalogUrl, holdRefresh);
  try {
    const rejected = page.waitForResponse(response => response.url() === patchUrl && response.request().method() === "PATCH");
    const refreshed = page.waitForResponse(response => response.url() === catalogUrl && response.request().method() === "GET");
    await row.getByRole("button", { name: "Save translations", exact: true }).click();
    const rejection = await rejected;
    expect(rejection.status()).toBe(412);
    const rejectionBody = await rejection.json();
    expect(rejectionBody).toMatchObject({ error:{ code:"PROJECT_MASTER_REVISION_MISMATCH", message:"Project master catalog changed. Reload and retry." } });
    await refreshHeld;
    await expect(row.getByLabel("English", { exact: true })).toHaveValue("Preserved after 401");
    await expect(row.getByRole("button", { name:"Cancel", exact:true })).toBeDisabled();
    await expect(row.getByRole("button", { name:"Save translations", exact:true })).toBeDisabled();
    releaseRefresh();
    const response = await refreshed;
    expect(response.status()).toBe(200);
    const freshCatalog = (await response.json()).data as typeof beforeConflict;
    expect(freshCatalog.revision).toBe(latest.revision);
    expect(freshCatalog.items.find(item => item.id === items[0]!.id)?.translations?.en).toBe("Assembly Team");
    await expect(row.getByRole("alert")).toBeVisible();
    await expect(row.getByLabel("English", { exact:true })).toHaveValue("Preserved after 401");
    await expect(row.getByRole("button", { name:"Save translations", exact:true })).toBeDisabled();
    await expect(row.getByRole("button", { name:"Cancel", exact:true })).toBeEnabled();
    await expect(page.getByText(rejectionBody.error.message, { exact:true })).toHaveCount(0);
    await expect(page.getByText("Another administrator change was saved first. Review the latest list before saving again.", { exact:true })).toBeVisible();
    await expect(page.getByText("unsafe-upstream-marker")).toHaveCount(0);
  } finally {
    releaseRefresh();
    await page.unroute(catalogUrl, holdRefresh);
  }
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  await row.getByRole("button", { name: "Translate display name", exact: true }).click();
  await row.getByLabel("English", { exact: true }).fill("");
  await row.getByRole("button", { name: "Save translations", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  data = await read();
  expect(data.items.find(item => item.id === items[0]!.id)?.name).toBe("조립팀 A");
  expect(data.items.find(item => item.id === items[0]!.id)?.translations?.en).toBeUndefined();
  await page.getByLabel("Search name or code", { exact: true }).fill("조립팀 A");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  // Same translated names retain distinguishable native choices and exact source IDs.
  const productResponse = await page.request.post(`${origin}/api/project-master/admin/items`, { headers:{Origin:origin,"If-Match":`"${data.revision}"`}, data:{category:"PRODUCT",code:"I18N-P",name:"제품 원문",sortOrder:0} });
  expect(productResponse.ok()).toBe(true);
  data = (await productResponse.json()).data;
  const product = data.items.find(item => item.code === "I18N-P")!;
  for (const item of items) {
    const patch = await page.request.patch(`${origin}/api/project-master/admin/items/${item.id}`,{headers:{Origin:origin,"If-Match":`"${data.revision}"`},data:{translations:{en:"Assembly Team",vi:"Nhóm chung"}}});
    expect(patch.ok()).toBe(true);data=(await patch.json()).data;
    const relation = await page.request.post(`${origin}/api/project-master/admin/relations`,{headers:{Origin:origin,"If-Match":`"${data.revision}"`},data:{businessUnitId:item.id,productId:product.id,siteEntityId:null}});
    expect(relation.ok()).toBe(true);data=(await relation.json()).data;
  }
  await page.goto(`${origin}/projects/new`);
  const units = page.locator("#project-business-unit");
  await expect(units.locator(`option[value="${items[0]!.id}"]`)).toHaveText("Assembly Team (I18N-0)");
  await expect(units.locator(`option[value="${items[1]!.id}"]`)).toHaveText("Assembly Team (I18N-1)");
  await units.selectOption(items[1]!.id);
  await expect(units).toHaveValue(items[1]!.id);
  // Original form values and identifiers remain unchanged by locale changes.
  await page.getByRole("combobox", { name: "Display language", exact: true }).first().selectOption("vi");
  await expect(units).toHaveValue(items[1]!.id);
  await expect(units.locator(`option[value="${items[1]!.id}"]`)).toHaveText("Nhóm chung (I18N-1)");
  await page.goto(`${origin}/project-master-admin`);
  await ensureAdmin();
  const density: Array<{locale:string;width:number;rowHeights:number[]}> = [];
  const addLabels = { ko:"항목 추가", en:"Add item", vi:"Thêm mục" } as const;
  for (const locale of ["ko", "en", "vi"] as const) {
    await page.locator(".site-header select").selectOption(locale);
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const form = page.locator("form").filter({ has: page.getByRole("button", { name: addLabels[locale], exact: true }) });
      const fields = form.locator("fieldset");
      const sizes = await fields.locator("input").evaluateAll(inputs => inputs.map(input => ({ height:input.getBoundingClientRect().height,width:input.getBoundingClientRect().width })));
      expect(sizes).toHaveLength(3);
      for (const size of sizes) { expect(size.height).toBeGreaterThanOrEqual(44);expect(size.width).toBeGreaterThan(0); }
      const rows = await table.locator("tbody tr").evaluateAll(rows=>rows.map(row=>({height:row.getBoundingClientRect().height,cells:[...row.children].map(cell=>({right:cell.getBoundingClientRect().right,left:cell.getBoundingClientRect().left,controls:[...cell.querySelectorAll("input,button")].map(control=>({right:control.getBoundingClientRect().right,left:control.getBoundingClientRect().left,height:control.getBoundingClientRect().height}))}))})));
      expect(rows).toHaveLength(2);
      density.push({locale,width,rowHeights:rows.map(row=>row.height)});
      for (const row of rows) {
        expect(row.height).toBeLessThanOrEqual(48);
        for (const cell of row.cells) for (const control of cell.controls) {
          expect(control.left).toBeGreaterThanOrEqual(cell.left);
          expect(control.right).toBeLessThanOrEqual(cell.right);
        }
      }
      const geometry=await page.evaluate(() => ({width:innerWidth,documentWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll("body *")].filter(element=>{if(element.getBoundingClientRect().right<=innerWidth+1)return false;let parent=element.parentElement;while(parent&&parent!==document.body){if(["auto","scroll","hidden"].includes(getComputedStyle(parent).overflowX))return false;parent=parent.parentElement;}return true;}).slice(0,16).map(element=>({tag:element.tagName,className:element.className,right:element.getBoundingClientRect().right,text:element.textContent?.slice(0,80)}))}));
      await page.screenshot({ path:testInfo.outputPath(`issue-866-master-${locale}-${width}.png`), fullPage:true });
      expect(geometry.documentWidth,JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width+1);
    }
  }
  const coarse = await browser.newContext({ storageState:await page.context().storageState(), viewport:{width:390,height:1000}, hasTouch:true, isMobile:true });
  try {
    const touch = await coarse.newPage();
    await touch.goto(`${origin}/project-master-admin`);
    const login = touch.locator("form").filter({ has:touch.locator('input[autocomplete="current-password"]') });
    await login.locator('input[type="password"]').fill("I18n-test-only-866");
    await login.locator('button[type="submit"]').click();
    const touchTable=touch.locator('[data-testid="project-master-table-scroll"] table');
    await expect(touchTable.locator("tbody tr")).toHaveCount(2);
    const controls=await touchTable.locator('input,button').evaluateAll(controls=>controls.map(control=>({height:control.getBoundingClientRect().height,width:control.getBoundingClientRect().width,compact:control.getAttribute("aria-haspopup")==="dialog"})));
    for (const control of controls) { expect(control.height).toBeGreaterThanOrEqual(44); if(control.compact)expect(control.width).toBeGreaterThanOrEqual(44); }
    const coarseRows=await touchTable.locator("tbody tr").evaluateAll(rows=>rows.map(row=>row.getBoundingClientRect().height));
    for(const height of coarseRows)expect(height).toBeLessThanOrEqual(52);
    density.push({locale:"vi-coarse",width:390,rowHeights:coarseRows});
    await touch.screenshot({path:testInfo.outputPath("issue-866-master-coarse-390.png"),fullPage:true});
    await touchTable.locator('button[aria-haspopup="dialog"]').first().click();
    const dialog=touch.getByRole("dialog");
    await expect(dialog.getByLabel("한국어",{exact:true})).toBeFocused();
    await touch.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(touchTable.locator('button[aria-haspopup="dialog"]').first()).toBeFocused();
  } finally { await coarse.close(); }
  await testInfo.attach("master-row-density",{body:JSON.stringify(density),contentType:"application/json"});
});
