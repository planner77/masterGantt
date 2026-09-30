import { expect, test } from "@playwright/test";

const catalog = {
  data: {
    revision: 1,
    businessUnits: [],
    products: [],
    siteEntities: [],
    items: [
      {
        id: "bu-active",
        category: "BUSINESS_UNIT",
        code: "BU-A",
        name: "활성 사업부",
        active: true,
        sortOrder: 10,
        usageCount: 2,
      },
      {
        id: "bu-inactive",
        category: "BUSINESS_UNIT",
        code: "BU-I",
        name: "비활성 사업부",
        active: false,
        sortOrder: 20,
        usageCount: 1,
      },
      {
        id: "product-active",
        category: "PRODUCT",
        code: "P-A",
        name: "활성 제품",
        active: true,
        sortOrder: 10,
        usageCount: 0,
      },
      {
        id: "site-inactive",
        category: "SITE_ENTITY",
        code: "S-I",
        name: "비활성 사업장",
        active: false,
        sortOrder: 10,
        usageCount: 0,
      },
    ],
  },
};

async function mockAdmin(page: import("@playwright/test").Page) {
  await page.route("**/api/project-master/admin-sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: { data: { permission: "project_master_admin", expiresAt: "2026-09-30T12:00:00.000Z" } } });
      return;
    }
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/project-master/admin/items", async (route) => {
    await route.fulfill({ status: 200, json: catalog, headers: { ETag: '"1"' } });
  });
}

async function login(page: import("@playwright/test").Page) {
  await page.goto("/project-master-admin");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "프로젝트 기준정보 관리자 인증됨", exact: true })).toBeVisible();
}

test("Issue #289: 관리자 category 탭은 roving focus와 Arrow/Home/End 계약을 따른다", async ({ page }) => {
  await mockAdmin(page);
  await login(page);

  const tabs = page.getByRole("tablist", { name: "프로젝트 기준정보 범주" }).getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute("tabindex", "0");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");

  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Home");
  await expect(tabs.nth(0)).toBeFocused();
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

  const panel = page.getByRole("tabpanel");
  await expect(panel).toHaveAttribute("aria-labelledby", "project-master-tab-business_unit");
  await expect(panel.getByRole("heading", { name: "사업부", exact: true })).toBeVisible();
});

test("Issue #332: 인증/관리/목록 영역과 목록 header가 의미 단위로 구분된다", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/project-master-admin");

  await expect(page.getByRole("heading", { name: "프로젝트 기준정보 관리자 로그인", exact: true })).toBeVisible();
  await expect(page.getByText("프로젝트 편집 비밀번호와 별도의 글로벌 기준정보 관리자 권한이 필요합니다.")).toBeVisible();

  await login(page);

  await expect(page.getByRole("heading", { name: "프로젝트 기준정보", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "항목 추가", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "사업부 목록", exact: true })).toBeVisible();

  const table = page.getByRole("table", { name: "사업부 기준정보 목록" });
  for (const label of ["이름", "코드", "정렬", "상태 / 사용", "작업"]) {
    await expect(table.getByRole("columnheader", { name: label, exact: true })).toBeVisible();
  }
});

test("Issue #332: 전체/활성/비활성 필터는 client-side로 동작하고 category 전환 뒤에도 유지된다", async ({ page }) => {
  await mockAdmin(page);
  await login(page);

  const businessFilters = page.getByRole("group", { name: "사업부 상태 필터" });
  const all = businessFilters.getByRole("button", { name: "전체", exact: true });
  const active = businessFilters.getByRole("button", { name: "활성", exact: true });
  const inactive = businessFilters.getByRole("button", { name: "비활성", exact: true });

  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("활성 사업부 이름", { exact: true })).toBeVisible();
  await expect(page.getByLabel("비활성 사업부 이름", { exact: true })).toBeVisible();

  let mutations = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/project-master/admin/items") && request.method() !== "GET") mutations += 1;
  });

  await active.click();
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("활성 사업부 이름", { exact: true })).toBeVisible();
  await expect(page.getByLabel("비활성 사업부 이름", { exact: true })).toHaveCount(0);

  await inactive.click();
  await expect(inactive).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("활성 사업부 이름", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("비활성 사업부 이름", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "제품", exact: true }).click();
  const productFilters = page.getByRole("group", { name: "제품 상태 필터" });
  await expect(productFilters.getByRole("button", { name: "비활성", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("비활성 상태의 항목이 없습니다.", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "사업장/법인", exact: true }).click();
  const siteFilters = page.getByRole("group", { name: "사업장/법인 상태 필터" });
  await expect(siteFilters.getByRole("button", { name: "비활성", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("비활성 사업장 이름", { exact: true })).toBeVisible();

  expect(mutations).toBe(0);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`Issue #332: ${viewport.width}px에서 control 겹침과 document overflow가 없다`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAdmin(page);
    await login(page);

    const hasDocumentOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(hasDocumentOverflow).toBe(false);

    const selectors = [
      page.getByRole("tablist", { name: "프로젝트 기준정보 범주" }),
      page.getByRole("group", { name: "사업부 상태 필터" }),
      page.getByRole("button", { name: "항목 추가", exact: true }),
    ];
    for (const locator of selectors) {
      await expect(locator).toBeVisible();
    }

    const tableScroll = page.getByTestId("project-master-table-scroll");
    await expect(tableScroll).toBeVisible();
    const geometry = await tableScroll.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        viewport: document.documentElement.clientWidth,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);
    if (viewport.width === 390) expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
  });
}
