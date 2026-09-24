import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { version } from "../../package.json";

test.use(isolatedApplicationOptions);

test("#136 공통 헤더에 빌드 버전을 표시하고 홈 링크와 탐색을 유지한다", async ({ page }, testInfo) => {
  await page.goto("/");

  const header = page.locator(".site-header");
  const brand = header.getByRole("link", { name: "masterGantt 홈", exact: true });
  const versionText = header.locator(".brand-version");
  const projects = header.getByRole("link", { name: "프로젝트", exact: true });
  const resources = header.getByRole("link", { name: "리소스", exact: true });

  await expect(versionText).toHaveText(`v${version}`);
  await expect(brand).toHaveAttribute("href", "/");
  await expect(projects).toHaveAttribute("aria-current", "page");

  for (const width of [390, 480, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    if (width <= 544) await expect(versionText).toBeHidden();
    else await expect(versionText).toBeVisible();
    await expect(brand).toBeVisible();
    await expect(projects).toBeVisible();
    await expect(resources).toBeVisible();

    const geometry = await header.evaluate((element) => {
      const bounds = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
      const headerBounds = element.getBoundingClientRect();
      const brandBounds = bounds(".brand");
      const versionBounds = bounds(".brand-version");
      const navBounds = bounds("nav");
      const actionsBounds = bounds(".header-actions");
      const name = element.querySelector(".brand-name")!;
      return {
        headerHeight: headerBounds.height,
        brandRight: brandBounds.right,
        versionLeft: versionBounds.left,
        versionRight: versionBounds.right,
        navLeft: navBounds.left,
        navRight: navBounds.right,
        actionsLeft: actionsBounds.left,
        actionsRight: actionsBounds.right,
        nameVisible: getComputedStyle(name).display !== "none",
        versionVisible: getComputedStyle(element.querySelector(".brand-version")!).display !== "none",
        versionFontSize: Number.parseFloat(getComputedStyle(element.querySelector(".brand-version")!).fontSize),
        nameFontSize: Number.parseFloat(getComputedStyle(name).fontSize),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(geometry.headerHeight).toBeLessThanOrEqual(57);
    if (geometry.versionVisible) {
      expect(geometry.versionLeft).toBeGreaterThanOrEqual(geometry.brandRight);
      expect(geometry.versionLeft - geometry.brandRight).toBeLessThanOrEqual(16);
      expect(geometry.versionRight).toBeLessThanOrEqual(geometry.navLeft);
    } else {
      expect(geometry.brandRight).toBeLessThanOrEqual(geometry.navLeft);
    }
    expect(geometry.navRight).toBeLessThanOrEqual(geometry.actionsLeft);
    expect(geometry.actionsRight).toBeLessThanOrEqual(width);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    if (geometry.versionVisible) expect(geometry.versionFontSize).toBeLessThan(geometry.nameFontSize);
    expect(geometry.nameVisible).toBe(width > 400);
    await page.screenshot({ path: testInfo.outputPath(`workspace-header-version-${width}.png`) });
  }

  await resources.click();
  await expect(page.getByRole("heading", { name: "리소스 관리" })).toBeVisible();
  await expect(versionText).toHaveText(`v${version}`);
  await expect(resources).toHaveAttribute("aria-current", "page");
  await brand.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(projects).toHaveAttribute("aria-current", "page");
  await expect(versionText).toHaveText(`v${version}`);
});
