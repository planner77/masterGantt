import { test, expect } from "./fixtures/isolated-application";

test.use({ isolatedProjectMasterAdminPassword: "I18n-test-only-866" });

test("Issue #866: 실제 마스터 표시명 저장·새로고침·해제·동명 ID 선택과 5폭 입력 geometry", async ({ page, isolatedApplication }) => {
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
  await page.route(patchUrl,route=>route.fulfill({status:401,json:{error:{code:"UNAUTHORIZED",message:"unsafe-upstream-marker"}}}),{times:1});
  await row.getByRole("button", { name: "Save translations", exact: true }).click();
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  await ensureAdmin();
  await row.getByRole("button", { name: "Continue preserved draft", exact: true }).click();
  await expect(row.getByLabel("English", { exact: true })).toHaveValue("Preserved after 401");
  expect((await read()).items.find(item=>item.id===items[0]!.id)?.translations?.en).toBe("Assembly Team");
  await page.route(patchUrl,route=>route.fulfill({status:412,json:{error:{code:"PRECONDITION_FAILED",message:"unsafe-upstream-marker"}}}),{times:1});
  await row.getByRole("button", { name: "Save translations", exact: true }).click();
  await expect(row.getByLabel("English", { exact: true })).toHaveValue("Preserved after 401");
  await expect(page.getByText("unsafe-upstream-marker")).toHaveCount(0);
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
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Thêm mục", exact: true }) });
    const fields = form.getByRole("group", { name: "Tên hiển thị theo ngôn ngữ (tùy chọn)", exact: true });
    const sizes = await fields.locator("input").evaluateAll(inputs => inputs.map(input => ({ height:input.getBoundingClientRect().height,width:input.getBoundingClientRect().width,client:input.clientWidth,scroll:input.scrollWidth })));
    expect(sizes).toHaveLength(3);
    for (const size of sizes) { expect(size.height).toBeGreaterThanOrEqual(44);expect(size.width).toBeGreaterThan(0); }
    const geometry=await page.evaluate(() => ({width:innerWidth,documentWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll("body *")].filter(element=>{if(element.getBoundingClientRect().right<=innerWidth+1)return false;let parent=element.parentElement;while(parent&&parent!==document.body){if(["auto","scroll","hidden"].includes(getComputedStyle(parent).overflowX))return false;parent=parent.parentElement;}return true;}).slice(0,16).map(element=>({tag:element.tagName,className:element.className,right:element.getBoundingClientRect().right,text:element.textContent?.slice(0,80)}))}));
    await page.screenshot({ path:`output/playwright/issue-866-master-${width}.png`, fullPage:true });
    expect(geometry.documentWidth,JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width+1);
  }
});
