import { expect, test } from "@playwright/test";

const bu = { id:"50000000-0000-4000-8000-000000000001",category:"BUSINESS_UNIT",code:"BU",name:"사업부 A",active:true,sortOrder:0 };
const other = { id:"50000000-0000-4000-8000-000000000002",category:"BUSINESS_UNIT",code:"B2",name:"사업부 B",active:true,sortOrder:0 };
const product = { id:"50000000-0000-4000-8000-000000000003",category:"PRODUCT",code:"MCS",name:"제품 X",active:true,sortOrder:0 };
const site = { id:"50000000-0000-4000-8000-000000000004",category:"SITE_ENTITY",code:"VN",name:"베트남 법인",active:true,sortOrder:0 };
const otherSite = { id:"50000000-0000-4000-8000-000000000005",category:"SITE_ENTITY",code:"CN",name:"중국 법인",active:true,sortOrder:0 };
const pair = {businessUnitId:bu.id,productId:product.id,siteEntityId:null};
const triple = {businessUnitId:bu.id,productId:product.id,siteEntityId:site.id};
const base = {businessUnits:[bu,other],products:[product],siteEntities:[site,otherSite]};

test("Issue #538: Project 생성의 종속 옵션과 상위 변경 시 초안 재선택", async ({page}) => {
  await page.route("**/api/project-master/catalog", async (route) => {
    await route.fulfill({status:200,json:{data:{revision:1,...base,relations:[pair,triple]}}});
  });
  await page.goto("/projects/new");
  const unit=page.locator("#project-business-unit");
  const productInput=page.locator("#project-product");
  const siteInput=page.locator("#project-site-entity");
  await expect(unit).toBeVisible();
  await expect(productInput).toBeDisabled();
  await expect(siteInput).toBeDisabled();
  await unit.selectOption(bu.id);
  await expect(productInput).toBeEnabled();
  await expect(productInput.locator("option")).toHaveCount(2);
  await productInput.selectOption(product.id);
  await expect(siteInput).toBeEnabled();
  await expect(siteInput.locator("option")).toHaveCount(2);
  await siteInput.selectOption(site.id);
  // Re-selecting the current parent must not erase the user's draft.
  await unit.selectOption(bu.id);
  await expect(productInput).toHaveValue(product.id);
  await expect(siteInput).toHaveValue(site.id);
  await unit.selectOption(other.id);
  await expect(productInput).toHaveValue("");
  await expect(siteInput).toHaveValue("");
  await expect(productInput.locator("option")).toHaveCount(1);
  await expect(page.getByRole("status").filter({hasText:"사업부가 변경되어"})).toBeVisible();
});

test("Issue #538: 관리자 관계 연결과 명시적 두 단계 해제", async ({page}) => {
  let revision=1;
  let relations: Array<{businessUnitId:string;productId:string;siteEntityId:string|null}> = [];
  const response=() => ({data:{revision,...base,relations,items:[...base.businessUnits,...base.products,...base.siteEntities].map((i)=>({...i,usageCount:0}))}});
  await page.route("**/api/project-master/admin-sessions",async (route)=>{
    await route.fulfill(route.request().method()==="POST" ? {status:201,json:{data:{permission:"project_master_admin",expiresAt:"2030-01-01T00:00:00Z"}}} : {status:204});
  });
  await page.route("**/api/project-master/admin/items",async (route)=>{await route.fulfill({status:200,json:response(),headers:{"ETag":`"${revision}"`}});});
  await page.route("**/api/project-master/admin/relations",async (route)=>{
    const input=route.request().postDataJSON() as {businessUnitId:string;productId:string;siteEntityId?:string|null};
    const link={businessUnitId:input.businessUnitId,productId:input.productId,siteEntityId:input.siteEntityId ?? null};
    const key=(x:typeof link)=>[x.businessUnitId,x.productId,x.siteEntityId ?? ""].join(":");
    if(route.request().method()==="POST") relations=[...relations,link];
    else relations=relations.filter((r)=>key(r)!==key(link));
    revision++;
    await route.fulfill({status:200,json:response(),headers:{"ETag":`"${revision}"`}});
  });
  await page.goto("/project-master-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();
  await expect(page.getByRole("heading",{name:"기준정보 연결 관계"})).toBeVisible();
  await page.locator('section[aria-labelledby="project-master-relations-heading"] select').nth(0).selectOption(bu.id);
  await page.locator('section[aria-labelledby="project-master-relations-heading"] select').nth(1).selectOption(product.id);
  await page.getByRole("button",{name:"제품 연결",exact:true}).click();
  const table=page.getByRole("table",{name:"사업부 제품 사업장 법인 연결 목록"});
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.locator('section[aria-labelledby="project-master-relations-heading"] select').nth(2).selectOption(site.id);
  await page.getByRole("button",{name:"사업장/법인 연결",exact:true}).click();
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const removeSite=table.getByRole("button",{name:/베트남 법인 관계 해제/});
  await removeSite.click();
  await expect(removeSite).toHaveText("해제 확인");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await removeSite.click();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.getByText("베트남 법인")).toHaveCount(0);
});
