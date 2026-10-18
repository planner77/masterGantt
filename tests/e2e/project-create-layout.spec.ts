import { expect, test, type Locator, type Page } from "@playwright/test";

import { captureUi } from "./helpers/ui-geometry";

const templates = [
  {
    id: "template-alpha",
    name: "Alpha",
    description: "반응형 생성 폼 검증용 템플릿",
    sourceProjectId: null,
    sourceProjectName: null,
    active: true,
    taskCount: 2,
    milestoneCount: 1,
    processCount: 0,
    equipmentCount: 0,
    systemCount: 0,
    createdAt: "",
    updatedAt: "",
  },
];

const projectMasterCatalog = {
  data: {
    revision: 1,
    businessUnits: [
      { id: "bu-1", category: "BUSINESS_UNIT", code: "SMART-FACTORY-BUSINESS", name: "스마트팩토리 자동화 사업부", active: true, sortOrder: 10 },
    ],
    products: [
      { id: "product-1", category: "PRODUCT", code: "MASTER-GANTT-LOGISTICS", name: "물류자동화 통합 제어 제품군", active: true, sortOrder: 10 },
    ],
    siteEntities: [
      { id: "site-1", category: "SITE_ENTITY", code: "VIETNAM-MANUFACTURING-CORP", name: "베트남 생산 법인 및 장기 명칭 사업장", active: true, sortOrder: 10 },
    ],
    relations: [
      { businessUnitId: "bu-1", productId: "product-1", siteEntityId: null },
      { businessUnitId: "bu-1", productId: "product-1", siteEntityId: "site-1" },
    ],
  },
};

async function installTemplates(page: Page) {
  await page.route("**/api/project-templates?activeOnly=true", (route) =>
    route.fulfill({ json: { data: templates } }),
  );
}

async function installProjectMasterCatalog(page: Page) {
  await page.route("**/api/project-master/catalog", (route) =>
    route.fulfill({ json: projectMasterCatalog }),
  );
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

function sameRow(a: { y: number }, b: { y: number }, tolerance = 3) {
  return Math.abs(a.y - b.y) <= tolerance;
}

for (const width of [320, 390, 768, 1024, 1440, 1600, 1920]) {
  test(`Issue #282: 프로젝트 생성 화면이 ${width}px에서 wide/reflow 계약을 지킨다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installTemplates(page);
    await installProjectMasterCatalog(page);
    await page.goto("/projects/new");
    await expect(page.locator("#project-business-unit")).toBeVisible();

    const header = await box(page.locator("header.site-header"));
    const eyebrow = await box(page.locator(".new-project-page .eyebrow"));
    const main = await box(page.locator("main.main-content"));
    const blankForm = await box(page.locator("#panel-blank > form.project-form"));

    expect(eyebrow.y - (header.y + header.height)).toBeLessThanOrEqual(32);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    if (width >= 1440) {
      expect(main.width).toBeGreaterThan(1200);
      expect(blankForm.width).toBeGreaterThan(1000);
    }

    const basicSection = await box(page.locator(".project-create-basic-section"));
    const classificationSection = await box(page.locator(".project-create-classification-section"));
    const descriptionSection = await box(page.locator(".project-create-description-section"));
    const permissionSection = await box(page.locator(".project-create-permission-section"));

    expect(classificationSection.y).toBeGreaterThan(basicSection.y + basicSection.height - 2);
    expect(descriptionSection.y).toBeGreaterThan(classificationSection.y + classificationSection.height - 2);
    expect(permissionSection.y).toBeGreaterThan(descriptionSection.y + descriptionSection.height - 2);

    const blankName = await box(page.locator("#project-name").locator(".."));
    const blankOwner = await box(page.locator("#project-owner").locator(".."));
    const blankStatus = await box(page.locator("#project-status").locator(".."));
    const businessUnit = await box(page.locator("#project-business-unit").locator(".."));
    const product = await box(page.locator("#project-product").locator(".."));
    const siteEntity = await box(page.locator("#project-site-entity").locator(".."));
    const blankDescription = await box(page.locator("#project-description").locator(".."));
    const blankPassword = await box(page.locator("#project-edit-password").locator(".."));

    if (width > 1024) {
      expect(sameRow(blankName, blankOwner)).toBe(true);
      expect(sameRow(blankName, blankStatus)).toBe(true);
      expect(blankName.width).toBeGreaterThan(blankOwner.width);
      expect(blankOwner.width).toBeGreaterThan(blankStatus.width);
    } else if (width >= 768) {
      expect(sameRow(blankName, blankOwner)).toBe(true);
      expect(blankStatus.y).toBeGreaterThan(blankName.y + blankName.height - 2);
    } else {
      expect(blankOwner.y).toBeGreaterThan(blankName.y + blankName.height - 2);
      expect(blankStatus.y).toBeGreaterThan(blankOwner.y + blankOwner.height - 2);
    }

    if (width >= 1024) {
      expect(sameRow(businessUnit, product)).toBe(true);
      expect(sameRow(product, siteEntity)).toBe(true);
    } else if (width >= 768) {
      expect(sameRow(businessUnit, product)).toBe(true);
      expect(siteEntity.y).toBeGreaterThan(businessUnit.y + businessUnit.height - 2);
    } else {
      expect(product.y).toBeGreaterThan(businessUnit.y + businessUnit.height - 2);
      expect(siteEntity.y).toBeGreaterThan(product.y + product.height - 2);
    }

    if (width >= 1440) {
      expect(classificationSection.width).toBeGreaterThan(blankForm.width - 100);
      expect(blankDescription.width).toBeGreaterThan(blankPassword.width * 2);
    }

    await captureUi(page, testInfo, `create-blank-${width}`);
    await page.getByRole("tab", { name: "템플릿에서 만들기", exact: true }).click();
    const templateForm = page.locator("#panel-template .template-instantiate-container > form.project-form");
    await expect(templateForm).toBeVisible();

    const templateName = await box(page.locator("#inst-project-name").locator(".."));
    const templateOwner = await box(page.locator("#inst-owner-name").locator(".."));
    const templateDate = await box(page.locator("#inst-start-date").locator(".."));
    const templatePassword = await box(page.locator("#inst-password").locator(".."));
    const templateDescription = await box(page.locator("#inst-desc").locator(".."));

    if (width >= 768) {
      expect(sameRow(templateName, templateOwner)).toBe(true);
      if (width <= 1024) expect(sameRow(templateDate, templatePassword)).toBe(true);
    } else {
      expect(templateOwner.y).toBeGreaterThan(templateName.y + templateName.height - 2);
      expect(templateDate.y).toBeGreaterThan(templateOwner.y + templateOwner.height - 2);
      expect(templatePassword.y).toBeGreaterThan(templateDate.y + templateDate.height - 2);
      expect(templateDescription.y).toBeGreaterThan(templatePassword.y + templatePassword.height - 2);
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await captureUi(page, testInfo, `create-template-${width}`);
  });
}
