import { expect, test } from "@playwright/test";
import { expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

test("설정 모달의 검증 오류는 top layer 안에서도 보이고 닫은 뒤 알림함에 남는다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const identity = await rememberGanttRoot(page);
  const frame = page.locator(".project-gantt-frame");
  const box = await frame.boundingBox();
  // Use a DOM locator here: while the native dialog is topmost, background
  // controls are inert and Playwright's accessibility-role locators exclude them.
  const selectedLookup = page.locator(".project-schedule-resource-actions > button").first();
  const inlineHint = page.locator("#schedule-selected-resources-state");
  await expect(inlineHint).toHaveText("작업을 선택해 주세요.");
  await expect(selectedLookup).toHaveAccessibleDescription(/작업을 선택해 주세요/);
  const mutations: string[] = [];
  page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.url()); });
  const settings = page.getByRole("button", { name: "프로젝트 설정", exact: true });
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
  await expect(dialog).toBeVisible();
  // F-003: the background Gantt must not reflow when its lookup is disabled
  // by a top-layer editor. The disabled reason still reaches title/ARIA.
  await expect(inlineHint).toHaveText("작업을 선택해 주세요.");
  await expect(page.locator("#schedule-selected-resources-overlay-state")).toHaveText("열린 편집·확인 창을 닫은 뒤 조회할 수 있습니다.");
  await expect(selectedLookup).toBeDisabled();
  await expect(selectedLookup).toHaveAttribute("title", "열린 편집·확인 창을 닫은 뒤 조회할 수 있습니다.");
  await expect(selectedLookup).toHaveAttribute("aria-describedby", /schedule-selected-resources-overlay-state/);
  expect(await frame.boundingBox()).toEqual(box);
  await dialog.getByLabel("프로젝트 이름", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "프로젝트 정보 저장" }).click();
  const feedback = dialog.locator('div[role="status"][aria-atomic="true"]');
  await expect(feedback).toHaveAttribute("role", "status");
  await expect(feedback).toHaveText("프로젝트 이름을 입력해 주세요.");
  await expect(feedback).toBeVisible();
  expect(mutations).toEqual([]);
  expect(await frame.boundingBox()).toEqual(box);
  await expectSameGanttRoot(page, identity);
  await page.keyboard.press("Escape");
  await expect(settings).toBeFocused();
  await expect(page.locator("#schedule-selected-resources-overlay-state")).toHaveCount(0);
  await expect(inlineHint).toHaveText("작업을 선택해 주세요.");
  await expect(selectedLookup).toHaveAccessibleDescription(/작업을 선택해 주세요/);
  await page.getByRole("button", { name: "알림함, 미확인 1건" }).click();
  await expect(page.getByRole("dialog", { name: "오류 알림함" }).getByLabel("알림 1 내용")).toHaveValue(/프로젝트 이름을 입력해 주세요/);
  expect(await frame.boundingBox()).toEqual(box);
  await expectSameGanttRoot(page, identity);
});
