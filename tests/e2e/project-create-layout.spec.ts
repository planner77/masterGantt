import { expect, test, type Locator, type Page } from "@playwright/test";

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

async function installTemplates(page: Page) {
  await page.route("**/api/project-templates?activeOnly=true", (route) =>
    route.fulfill({ json: { data: templates } }),
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

for (const width of [320, 390, 768, 1024, 1440, 1600]) {
  test(`Issue #282: 프로젝트 생성 화면이 ${width}px에서 wide/reflow 계약을 지킨다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTemplates(page);
    await page.goto("/projects/new");

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

    const blankName = await box(page.locator("#project-name").locator(".."));
    const blankOwner = await box(page.locator("#project-owner").locator(".."));
    const blankDescription = await box(page.locator("#project-description").locator(".."));
    const blankStatus = await box(page.locator("#project-status").locator(".."));
    const blankPassword = await box(page.locator("#project-edit-password").locator(".."));

    if (width >= 768) {
      expect(sameRow(blankName, blankOwner)).toBe(true);
      if (width <= 1024) expect(sameRow(blankStatus, blankPassword)).toBe(true);
    } else {
      expect(blankOwner.y).toBeGreaterThan(blankName.y + blankName.height - 2);
      expect(blankDescription.y).toBeGreaterThan(blankOwner.y + blankOwner.height - 2);
      expect(blankStatus.y).toBeGreaterThan(blankDescription.y + blankDescription.height - 2);
      expect(blankPassword.y).toBeGreaterThan(blankStatus.y + blankStatus.height - 2);
    }

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
  });
}
