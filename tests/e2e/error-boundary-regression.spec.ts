import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { captureUi } from "./helpers/ui-geometry";

test.use({ locale: "ko-KR", timezoneId: "Asia/Seoul", viewport: { width: 1440, height: 900 } });

async function tabToRetry(page: Page) {
  const retry = page.getByRole("button", { name: "다시 시도", exact: true });
  for (let step = 0; step < 12 && !(await retry.evaluate((node) => node === document.activeElement)); step += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(retry).toBeFocused();
  return retry;
}

async function verifyBoundary(
  page: Page,
  testInfo: TestInfo,
  input: Readonly<{
    route: string;
    probeId: "root" | "gantt-demo";
    heading: string;
    width: number;
  }>,
) {
  await page.setViewportSize({ width: input.width, height: 900 });
  await page.goto(input.route);

  const trigger = page.getByTestId(`e2e-error-boundary-trigger-${input.probeId}`);
  await expect(trigger).toHaveText("오류 경계 테스트 시작");
  await trigger.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: input.heading, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "프로젝트를 불러올 수 없습니다.", exact: true })).toHaveCount(0);
  await tabToRetry(page);
  await captureUi(page, testInfo, `${input.probeId}-boundary-${input.width}`, "main", "502");

  await page.keyboard.press("Enter");
  await expect(trigger).toHaveText("오류 경계 테스트 복구 확인");
  await expect(trigger).toBeFocused();
  await captureUi(page, testInfo, `${input.probeId}-recovered-${input.width}`, "main", "502");
}

test("#502 root error boundary를 실제 오류·keyboard retry·focus restore로 검증한다", async ({ page }, testInfo) => {
  for (const width of [390, 1440]) {
    await verifyBoundary(page, testInfo, {
      route: "/e2e-error-boundary",
      probeId: "root",
      heading: "화면을 불러오지 못했습니다.",
      width,
    });
  }
});

test("#502 gantt-demo error boundary를 실제 오류·keyboard retry·focus restore로 검증한다", async ({ page }, testInfo) => {
  for (const width of [390, 1440]) {
    await verifyBoundary(page, testInfo, {
      route: "/gantt-demo?__e2eBoundary=1",
      probeId: "gantt-demo",
      heading: "Gantt를 표시할 수 없습니다",
      width,
    });
  }
});
