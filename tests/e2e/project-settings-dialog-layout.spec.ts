import { E2E_PROJECT_OWNER, expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";

import { captureUi } from "./helpers/ui-geometry";

test.use(isolatedApplicationOptions);

test("Issue #232: 프로젝트 설정 다이얼로그 정보 구조, 탭 전환 시 초안 보존 및 반응형 검증", async ({ page, baseURL }, testInfo) => {
  if (!baseURL) throw new Error("격리 E2E origin 누락");
  // 프로젝트 생성: 실제 서버 계약(Origin + 필수 payload)을 그대로 사용한다.
  const createResponse = await page.request.post("/api/projects", {
    headers: { Origin: baseURL },
    data: {
      name: "Settings Dialog Test",
      ownerName: E2E_PROJECT_OWNER,
      description: "Issue #232 settings dialog",
      editPassword: "password123",
    },
  });
  expect(createResponse.status()).toBe(201);
  const publicId = (await createResponse.json()).data.project.publicId as string;

  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();

  // 1. 설정 다이얼로그 열기
  const settingsButton = page.getByRole("button", { name: "프로젝트 설정", exact: true });
  await settingsButton.click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
  await expect(dialog).toBeVisible();

  // 2. 3개 탭 확인
  const tablist = dialog.getByRole("tablist", { name: "프로젝트 설정 범주" });
  await expect(tablist).toBeVisible();
  const generalTab = dialog.getByRole("tab", { name: "기본 정보" });
  const calendarTab = dialog.getByRole("tab", { name: "작업 캘린더" });
  const securityTab = dialog.getByRole("tab", { name: "편집·보안" });

  await expect(generalTab).toBeVisible();
  await expect(calendarTab).toBeVisible();
  await expect(securityTab).toBeVisible();

  // 기본적으로 기본 정보 탭이 선택되어 있음
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
  await expect(calendarTab).toHaveAttribute("aria-selected", "false");
  await expect(securityTab).toHaveAttribute("aria-selected", "false");

  // 기본 정보 폼 필드 확인
  const nameInput = dialog.getByLabel("프로젝트 이름");
  const descTextarea = dialog.getByLabel("설명");
  const statusSelect = dialog.getByLabel("프로젝트 상태");

  await expect(nameInput).toHaveValue("Settings Dialog Test");
  await expect(statusSelect).toHaveValue("planned");

  // 3. Draft 상태 보존 검증: 설명 수정 후 다른 탭 방문 후 복귀
  await descTextarea.fill("임시 설명 입력값 - 탭 이동 테스트");
  await calendarTab.click();
  await expect(calendarTab).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("button", { name: "미리보기 계산" })).toBeVisible();

  // 다시 기본 정보 탭으로 복귀
  await generalTab.click();
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
  await expect(descTextarea).toHaveValue("임시 설명 입력값 - 탭 이동 테스트");

  // 4. 키보드 Arrow 탐색
  await generalTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(calendarTab).toHaveAttribute("aria-selected", "true");
  await expect(calendarTab).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(securityTab).toHaveAttribute("aria-selected", "true");
  await expect(securityTab).toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await expect(calendarTab).toHaveAttribute("aria-selected", "true");
  await expect(calendarTab).toBeFocused();

  // 5. 반응형 뷰포트(390, 768, 1024, 1440)에서 수평 오버플로우 없음 검증
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);
  }

  await captureUi(page, testInfo, "settings-draft-1440", "dialog[open]");

  // 6. Escape 닫기 및 포커스 복원 검증
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(settingsButton).toBeFocused();
});
