import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

test.use(isolatedApplicationOptions);

async function useSkipLink(page: import("@playwright/test").Page, width: number, hasBodyControl = true, focusedScreenshot?: string) {
  const skip = page.getByRole("link", { name: "본문으로 바로가기", exact: true });
  const main = page.getByRole("main");
  await expect(skip).toHaveAttribute("href", "#main-content");
  await expect(main).toHaveAttribute("id", "main-content");
  await expect(main).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  const bounds = await skip.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  if (focusedScreenshot) await page.screenshot({ path: focusedScreenshot });
  await page.keyboard.press("Enter");
  await expect(main).toBeFocused();
  if (hasBodyControl) {
    await page.keyboard.press("Tab");
    expect(await main.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

for (const width of [390, 1440]) {
  test(`#121 ${width}px 첫 Tab 본문 바로가기와 Project 상태별 main landmark`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "아직 프로젝트가 없습니다." })).toBeVisible();
    await useSkipLink(page, width, true, testInfo.outputPath(`skip-link-${width}-focused.png`));
    const main = page.getByRole("main");
    await main.evaluate((element) => { (window as typeof window & { __skipMain?: Element }).__skipMain = element; });
    await page.getByRole("link", { name: "리소스", exact: true }).click();
    await expect(page.getByRole("heading", { name: "리소스 관리" })).toBeVisible();
    expect(await main.evaluate((element) => (window as typeof window & { __skipMain?: Element }).__skipMain === element)).toBe(true);
    await expect(main).toHaveAttribute("id", "main-content");
    await page.reload();
    await useSkipLink(page, width);
    await main.evaluate((element) => { element.style.minHeight = "180vh"; });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(0);
    await page.getByRole("link", { name: "본문으로 바로가기" }).evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
    await page.keyboard.press("Enter");
    await expect(main).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(scrolled);

    await page.goto("/projects/new");
    await useSkipLink(page, width);
    await expect(page.getByLabel("프로젝트 이름", { exact: true })).toBeFocused();

    const errorId = "00000000-0000-4000-8000-000000000121";
    await page.route(`**/api/projects/${errorId}`, (route) => route.fulfill({ status: 500, json: { error: { code: "TEST_ERROR" } } }));
    await page.goto(`/projects/${errorId}`);
    await expect(page.getByRole("heading", { name: "프로젝트를 불러올 수 없습니다." })).toBeVisible();
    await useSkipLink(page, width);

    const loadingId = "00000000-0000-4000-8000-000000000122";
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`**/api/projects/${loadingId}`, async (route) => {
      await pending;
      await route.fulfill({ status: 404, json: { error: { code: "PROJECT_NOT_FOUND" } } });
    });
    await page.goto(`/projects/${loadingId}`);
    await expect(page.getByText("프로젝트 정보를 불러오는 중입니다.")).toBeVisible();
    await useSkipLink(page, width, false);
    release();
    await expect(page.getByRole("heading", { name: "프로젝트를 찾을 수 없습니다." })).toBeVisible();
    await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");

    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
    const identity = await rememberGanttRoot(page);
    const mutations: string[] = [];
    page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.url()); });
    await useSkipLink(page, width);
    await expectSameGanttRoot(page, identity);
    expect(mutations).toEqual([]);

    const settings = page.getByRole("button", { name: "프로젝트 설정", exact: true });
    await settings.click();
    const dialog = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await expect(page.getByRole("link", { name: "본문으로 바로가기" })).not.toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(settings).toBeFocused();
    await expectSameGanttRoot(page, identity);
    expect(mutations).toEqual([]);
  });
}
