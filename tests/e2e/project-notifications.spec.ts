import { expect, test, type Page } from "@playwright/test";
import { expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot, rootAdd, rowNamed } from "../fixtures/stateful-project";

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector); if (!element) throw new Error(`Missing ${selector}`);
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, left: element.scrollLeft, top: element.scrollTop };
    };
    return { pageX: window.scrollX, pageY: window.scrollY, project: rect(".project-readonly"), grid: rect(".wx-table-container"), chart: rect(".wx-chart") };
  });
}

function rectanglesOverlap(
  first: Readonly<{ x: number; y: number; width: number; height: number }>,
  second: Readonly<{ x: number; y: number; width: number; height: number }>,
): boolean {
  return first.x < second.x + second.width && first.x + first.width > second.x &&
    first.y < second.y + second.height && first.y + first.height > second.y;
}

test("토스트 타이머·오류 보관·읽음·복사가 Gantt 위치와 인스턴스를 바꾸지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install({ time: new Date("2026-09-16T12:00:00Z") });
  const fixture = await installStatefulProjectFixture(page);
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); },
  } }));
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const identity = await rememberGanttRoot(page);
  const chart = page.locator(".wx-chart");
  await chart.evaluate((element) => { element.scrollLeft = 200; });
  const before = await geometry(page);
  await rowNamed(page, "Stable milestone").locator('[data-action="add-task"]').click();
  await expect(page.getByTestId("workspace-toast")).toContainText("마일스톤에는 하위 작업");
  await expect(page.getByRole("button", { name: "알림함, 미확인 1건" })).toBeVisible();
  expect(await geometry(page)).toEqual(before);
  await expectSameGanttRoot(page, identity);
  await rootAdd(page).click();
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 추가했습니다");
  await expect(page.getByRole("button", { name: "알림함, 미확인 1건" })).toBeVisible();
  expect(fixture.posts).toHaveLength(1);
  expect(await geometry(page)).toEqual(before);
  await expectSameGanttRoot(page, identity);
  await page.clock.fastForward(5_100);
  await expect(page.getByTestId("workspace-toast")).toBeEmpty();
  expect(await geometry(page)).toEqual(before);
  const bell = page.getByRole("button", { name: "알림함, 미확인 1건" });
  await bell.focus(); await page.keyboard.press("Enter");
  const inbox = page.getByRole("dialog", { name: "오류 알림함" });
  await expect(inbox).toBeVisible();
  await expect(inbox.getByLabel("알림 1 내용")).toHaveValue(/마일스톤에는 하위 작업/);
  expect(await geometry(page)).toEqual(before);
  await expectSameGanttRoot(page, identity);
  await inbox.getByRole("button", { name: "내용 복사", exact: true }).click();
  await expect(inbox.getByRole("status")).toContainText("수동으로 복사");
  await expect(inbox.getByLabel("알림 1 내용")).toHaveAttribute("readonly", "");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async (text: string) => { (window as typeof window & { copiedNotice?: string }).copiedNotice = text; },
  } }));
  await inbox.getByRole("button", { name: "내용 복사", exact: true }).click();
  await expect(inbox.getByRole("status")).toContainText("알림 내용을 복사했습니다");
  const copied = await page.evaluate(() => (window as typeof window & { copiedNotice?: string }).copiedNotice);
  expect(copied).toContain(publicId); expect(copied).toContain("발생 시각:"); expect(copied).not.toContain("요청 ID:");
  expect(await geometry(page)).toEqual(before);
  await page.keyboard.press("Escape");
  await expect(inbox).toHaveCount(0);
  await expect(page.getByRole("button", { name: "알림함", exact: true })).toBeFocused();
  await expectSameGanttRoot(page, identity);
  expect(await geometry(page)).toEqual(before);
  await page.goto("/projects/00000000-0000-4000-8000-000000000099");
  await expect(page.getByRole("heading", { name: "프로젝트를 찾을 수 없습니다." })).toBeVisible();
  await page.getByRole("button", { name: "알림함", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("확인할 오류가 없습니다");
});

for (const mode of ["missing", "denied"] as const) {
  test(`읽기 전용 프로젝트 링크 ${mode} fallback과 키보드 재시도는 navigation·mutation 없이 동작한다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installStatefulProjectFixture(page); fixture.sessionEditable = false;
    await page.addInitScript((clipboardMode) => Object.defineProperty(navigator, "clipboard", { configurable: true,
      value: clipboardMode === "missing" ? undefined : { writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
    }), mode);
    await page.goto(`/projects/${publicId}?temporary=discard#view`);
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    const identity = await rememberGanttRoot(page); const before = await geometry(page);
    const urlBefore = page.url(); const mutations: string[] = []; const documents: string[] = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.method());
      if (request.resourceType() === "document") documents.push(request.url());
    });
    const button = page.getByRole("button", { name: `${fixture.project.name} 프로젝트 링크 복사`, exact: true });
    await button.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "프로젝트 링크 수동 복사" });
    await expect(dialog).toBeVisible();
    const expected = `${new URL(urlBefore).origin}/projects/${publicId}`;
    await expect(dialog.getByLabel("프로젝트 바로 가기 URL")).toHaveValue(expected);
    await expect(page.getByTestId("workspace-toast")).not.toContainText("복사했습니다");
    const box = await dialog.boundingBox(); expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    expect(await geometry(page)).toEqual(before); await expectSameGanttRoot(page, identity);
    await page.keyboard.press("Escape"); await expect(button).toBeFocused();
    await button.click(); await expect(dialog).toBeVisible();
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text: string) => { (window as typeof window & { copiedUrl?: string }).copiedUrl = text; },
    } }));
    await dialog.getByRole("button", { name: "복사 다시 시도" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("workspace-toast")).toContainText("프로젝트 링크를 복사했습니다");
    expect(await page.evaluate(() => (window as typeof window & { copiedUrl?: string }).copiedUrl)).toBe(expected);
    expect(page.url()).toBe(urlBefore); expect(mutations).toEqual([]); expect(documents).toEqual([]);
    expect(await geometry(page)).toEqual(before); await expectSameGanttRoot(page, identity);
    await expect(button).toBeFocused();
  });
}

test("좁은 화면의 여러 오류 알림은 내부 스크롤로 확인하고 원문 서버 응답을 노출하지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const identity = await rememberGanttRoot(page);
  for (let index = 0; index < 8; index++) await rowNamed(page, "Stable milestone").locator('[data-action="add-task"]').click();
  await expect(page.getByRole("button", { name: "알림함, 미확인 8건" })).toBeVisible();
  const before = await geometry(page);
  await page.getByRole("button", { name: "알림함, 미확인 8건" }).click();
  const dialog = page.getByRole("dialog", { name: "오류 알림함" });
  await expect(dialog.locator("textarea")).toHaveCount(8);
  expect(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const box = await dialog.boundingBox(); expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(await geometry(page)).toEqual(before); await expectSameGanttRoot(page, identity);
  await dialog.getByRole("button", { name: "읽은 알림 지우기" }).click();
  await expect(dialog).toContainText("확인할 오류가 없습니다");
  await page.keyboard.press("Escape");
});

for (const width of [320, 360, 361, 375, 390, 400, 401, 414, 768, 1440]) {
  test(`${width}px에서 브랜드·메뉴·알림 버튼의 hit area가 분리된다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
    const navigationLinks = navigation.getByRole("link");
    const projectLink = navigation.getByRole("link", { name: "프로젝트", exact: true });
    const demoLink = navigation.getByRole("link", { name: "Gantt 데모", exact: true });
    const brand = page.getByRole("link", { name: "masterGantt 홈", exact: true });
    const bell = page.getByRole("button", { name: "알림함", exact: true });
    const notificationSlot = page.locator("#workspace-notification-slot");
    await expect(navigationLinks).toHaveCount(1);
    await expect(projectLink).toBeVisible();
    await expect(demoLink).toHaveCount(0);
    await expect(bell).toBeVisible();
    const slotBox = await notificationSlot.boundingBox();
    const bellBox = await bell.boundingBox();
    expect(slotBox).not.toBeNull();
    expect(bellBox).not.toBeNull();
    expect(bellBox!.x).toBeGreaterThanOrEqual(slotBox!.x);
    expect(bellBox!.y).toBeGreaterThanOrEqual(slotBox!.y);
    expect(bellBox!.x + bellBox!.width).toBeLessThanOrEqual(slotBox!.x + slotBox!.width);
    expect(bellBox!.y + bellBox!.height).toBeLessThanOrEqual(slotBox!.y + slotBox!.height);
    const brandBox = await brand.boundingBox();
    expect(brandBox).not.toBeNull();
    expect(rectanglesOverlap(brandBox!, bellBox!)).toBe(false);
    for (const link of await navigationLinks.all()) {
      const linkBox = await link.boundingBox();
      expect(linkBox).not.toBeNull();
      expect(rectanglesOverlap(linkBox!, bellBox!)).toBe(false);
      expect(rectanglesOverlap(brandBox!, linkBox!)).toBe(false);
    }

    // Native dispatch avoids scrolling the workspace away from the header while creating unread state.
    await rowNamed(page, "Stable milestone").locator('[data-action="add-task"]').dispatchEvent("click");
    await expect(page.getByTestId("workspace-toast")).toContainText("마일스톤에는 하위 작업");
    const unreadBell = page.getByRole("button", { name: "알림함, 미확인 1건", exact: true });
    await expect(unreadBell).toBeVisible();
    const unreadBellBox = await unreadBell.boundingBox();
    const badgeBox = await unreadBell.locator("span").boundingBox();
    expect(unreadBellBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    expect(unreadBellBox!.x).toBeCloseTo(bellBox!.x, 0);
    expect(unreadBellBox!.y).toBeCloseTo(bellBox!.y, 0);
    expect(rectanglesOverlap(unreadBellBox!, badgeBox!)).toBe(true);
    expect(badgeBox!.x).toBeGreaterThan(unreadBellBox!.x + unreadBellBox!.width / 2);
    expect(badgeBox!.y).toBeLessThan(unreadBellBox!.y + unreadBellBox!.height / 2);
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(width);
    expect(badgeBox!.y).toBeGreaterThanOrEqual(0);
    for (const link of await navigationLinks.all()) {
      const linkBox = await link.boundingBox();
      expect(linkBox).not.toBeNull();
      expect(rectanglesOverlap(linkBox!, unreadBellBox!)).toBe(false);
      expect(rectanglesOverlap(linkBox!, badgeBox!)).toBe(false);
    }

    const centerIsLink = await projectLink.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit === element || element.contains(hit);
    });
    expect(centerIsLink).toBe(true);
    const centerIsBrand = await brand.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit === element || element.contains(hit);
    });
    expect(centerIsBrand).toBe(true);
    await projectLink.click();
    await expect(page).toHaveURL(/\/$/);
  });
}
