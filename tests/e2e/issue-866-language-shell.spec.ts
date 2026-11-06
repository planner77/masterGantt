import { expect, test } from "@playwright/test";

const picker = (page: import("@playwright/test").Page) =>
  page.locator(".header-locale-selector select");

test.describe("Issue #866 Phase A global language selection", () => {
  test.use({ locale: "ko-KR" });

  test("switches navigation ko/en/vi without changing URL and preserves choice on reload", async ({ page }) => {
    await page.goto("/");
    await expect(picker(page)).toHaveValue("ko");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");

    await picker(page).selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Projects", exact: true })).toBeVisible();

    await picker(page).selectOption("vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByRole("link", { name: "Dự án", exact: true })).toBeVisible();
    await expect(picker(page)).toHaveValue("vi");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("mastergantt.ui.locale"))).toBe("vi");
    const previousURL = page.url();
    await page.reload();
    await expect(picker(page)).toHaveValue("vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    expect(page.url()).toBe(previousURL);
  });

  test("malformed saved locale falls back to supported browser language", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mastergantt.ui.locale", "not-a-locale"));
    await page.goto("/");
    await expect(picker(page)).toHaveValue("ko");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  });
});

test.describe("Issue #866 first-visit browser language", () => {
  test.use({ locale: "en-US" });

  test("uses browser English only when no explicit language is stored", async ({ page }) => {
    await page.goto("/");
    await expect(picker(page)).toHaveValue("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  });
});
