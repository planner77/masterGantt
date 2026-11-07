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

  // 2. #881: 기존 세 탭과 신규 화면 표시 탭 모두 확인
  const tablist = dialog.getByRole("tablist", { name: "프로젝트 설정 범주" });
  await expect(tablist).toBeVisible();
  const generalTab = dialog.getByRole("tab", { name: "기본 정보" });
  const calendarTab = dialog.getByRole("tab", { name: "작업 캘린더" });
  const securityTab = dialog.getByRole("tab", { name: "편집·보안" });
  const displayTab = dialog.getByRole("tab", { name: "화면 표시" });

  await expect(generalTab).toBeVisible();
  await expect(calendarTab).toBeVisible();
  await expect(securityTab).toBeVisible();
  await expect(displayTab).toBeVisible();
  await expect(tablist.getByRole("tab")).toHaveCount(4);

  // 기본적으로 기본 정보 탭이 선택되어 있음
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
  await expect(calendarTab).toHaveAttribute("aria-selected", "false");
  await expect(securityTab).toHaveAttribute("aria-selected", "false");
  await expect(displayTab).toHaveAttribute("aria-selected", "false");

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

  // Home/End refer to the first and fourth tabs; ArrowLeft reaches security.
  await page.keyboard.press("End");
  await expect(displayTab).toHaveAttribute("aria-selected", "true");
  await expect(displayTab).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(securityTab).toHaveAttribute("aria-selected", "true");
  await expect(securityTab).toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await expect(calendarTab).toHaveAttribute("aria-selected", "true");
  await expect(calendarTab).toBeFocused();

  // 5. #881/#490: wide viewport에서 선택·포커스된 네 번째 탭을
  // 다시 focus()하지 않은 채 390px로 줄여도 outline까지 클립되지 않아야 한다.
  // 화면 너비 변경 자체는 focus 이벤트가 아니므로 브라우저의 자동 scroll에 의존하지 않는다.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press("End");
  await expect(displayTab).toBeFocused();
  await expect(displayTab).toHaveAttribute("aria-selected", "true");
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);
    const focusRing = await displayTab.evaluate((node) => {
      const control = node.getBoundingClientRect();
      const owner = node.closest('[role="tablist"]')!.getBoundingClientRect();
      const style = getComputedStyle(node);
      const outset = Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
      return {
        left: control.left - outset, right: control.right + outset,
        ownerLeft: owner.left, ownerRight: owner.right,
      };
    });
    await expect(displayTab).toBeFocused();
    expect(focusRing.left, `width ${width}: focus ring must remain inside the tab list`).toBeGreaterThanOrEqual(focusRing.ownerLeft - 1);
    expect(focusRing.right, `width ${width}: focus ring must not be clipped at the right edge`).toBeLessThanOrEqual(focusRing.ownerRight + 1);
  }

  // #881/#490: three native checkboxes have their own form-control geometry,
  // an accessible label, and real keyboard operation (not a text-field border).
  await expect(dialog.getByRole("checkbox")).toHaveCount(3);
  for (const label of ["Issue", "대시보드", "기준정보"]) {
    await expect(dialog.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
  }
  const nativeOptions = await dialog.locator('input[type="checkbox"]').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return {
      appearance: getComputedStyle(node).appearance,
      width: rect.width,
      height: rect.height,
      labelHeight: node.closest("label")?.getBoundingClientRect().height ?? 0,
    };
  }));
  for (const choice of nativeOptions) {
    expect(choice.appearance, "preserve browser-native checkbox").not.toBe("none");
    expect(choice.width).toBeGreaterThanOrEqual(18);
    expect(choice.width).toBeLessThanOrEqual(28);
    expect(choice.height).toBeGreaterThanOrEqual(18);
    expect(choice.height).toBeLessThanOrEqual(28);
    expect(choice.labelHeight, "checkbox label keyboard/touch target").toBeGreaterThanOrEqual(44);
  }
  const issueCheckbox = dialog.getByRole("checkbox", { name: "Issue", exact: true });
  await displayTab.focus();
  await page.keyboard.press("Tab");
  await expect(issueCheckbox).toBeFocused();
  const focus = await issueCheckbox.evaluate(node => {
    const style = getComputedStyle(node);
    return { visible: node.matches(":focus-visible"), outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
  });
  expect(focus.visible).toBe(true);
  expect(focus.outlineStyle).not.toBe("none");
  expect(focus.outlineWidth).toBeGreaterThan(0);
  await page.keyboard.press("Space");
  await expect(issueCheckbox).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(issueCheckbox).toBeChecked();

  await captureUi(page, testInfo, "settings-draft-1440", "dialog[open]");

  // 6. Escape 닫기 및 포커스 복원 검증
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(settingsButton).toBeFocused();
});

test("Issue #881: 프로젝트 편집 세션에서 표시 저장, 복원 및 숨김 링크 차단", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("격리 E2E origin 누락");
  const create = await page.request.post("/api/projects", {
    headers: { Origin: baseURL },
    data: { name: "Workspace visibility", ownerName: E2E_PROJECT_OWNER, description: "", editPassword: "password123" },
  });
  expect(create.status()).toBe(201);
  const publicId = (await create.json()).data.project.publicId as string;
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByRole("tab", { name: "Issue", exact: true })).toBeVisible();
  const settings = page.getByRole("button", { name: "프로젝트 설정", exact: true });
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
  await dialog.getByRole("tab", { name: "화면 표시" }).click();
  await dialog.getByRole("checkbox", { name: "Issue" }).uncheck();
  await dialog.getByRole("checkbox", { name: "대시보드" }).uncheck();
  await dialog.getByRole("checkbox", { name: "기준정보" }).uncheck();
  await dialog.getByRole("button", { name: "화면 표시 저장" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Issue", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "대시보드", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "기준정보", exact: true })).toHaveCount(0);
  const persisted = await page.request.get(`/api/projects/${publicId}`);
  expect(persisted.ok()).toBe(true);
  expect((await persisted.json()).data.project.workspaceTabs).toEqual({ issue: false, dashboard: false, master: false });
  await page.goto(`/projects/${publicId}?screen=issue`);
  await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  await settings.click();
  const reopened = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
  await reopened.getByRole("tab", { name: "화면 표시" }).click();
  await reopened.getByRole("checkbox", { name: "Issue" }).check();
  await reopened.getByRole("button", { name: "화면 표시 저장" }).click();
  await expect(page.getByRole("tab", { name: "Issue", exact: true })).toBeVisible();
});
