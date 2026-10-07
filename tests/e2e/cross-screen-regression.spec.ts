import { expect, test } from "@playwright/test";
import { assertFocusVisible, assertPopulatedTable, captureUi } from "./helpers/ui-geometry";
import { loginMaster455, mockMaster455 } from "../fixtures/project-master-455";

test.use({ locale: "ko-KR", timezoneId: "Asia/Seoul", viewport: { width: 1440, height: 900 } });

test("#457 세 관리자 정상 shell을 동일 다섯 폭에서 직접 비교한다", async ({ page }, testInfo) => {
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const observations = [];
    for (const route of ["/resources", "/logistics-admin", "/project-master-admin"]) {
      await page.goto(route); await expect(page.getByLabel("관리자 비밀번호", { exact: true })).toBeVisible();
      observations.push(await captureUi(page, testInfo, `shell-${route.slice(1)}-${width}`));
    }
    const baseline = observations[0];
    for (const item of observations.slice(1)) {
      expect(item.shell.main.x).toBe(baseline.shell.main.x); expect(item.shell.main.width).toBe(baseline.shell.main.width);
      expect(item.shell.heading!.y - item.shell.headerBottom!).toBeCloseTo(baseline.shell.heading!.y - baseline.shell.headerBottom!, 0);
      expect(item.shell.auth!.width).toBe(baseline.shell.auth!.width);
      const input = item.controls.find(control => control.type === "password")!, submit = item.controls.find(control => control.type === "submit")!;
      expect(input.rect.height).toBe(40); expect(submit.rect.height).toBe(40);
      if (width > 540) expect(Math.abs(input.rect.y - submit.rect.y)).toBeLessThanOrEqual(1);
      else expect(submit.rect.y).toBeGreaterThanOrEqual(input.rect.bottom);
    }
  }
});

test("#457 기준정보 populated table은 공통 observer로 밀도와 열 경계를 확인한다", async ({ page }, testInfo) => {
  await mockMaster455(page); await loginMaster455(page);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("table").scrollIntoViewIfNeeded();
    const facts = await captureUi(page, testInfo, `master-populated-${width}`);
    expect(facts.tables).toHaveLength(1); assertPopulatedTable(facts.tables[0], 3);
    expect(facts.tables[0].visibleRows).toBeGreaterThan(0); expect(facts.tables[0].rowHeightMin).toBeGreaterThanOrEqual(40);
    expect(facts.tables[0].rowHeightMax).toBeLessThanOrEqual(48);
    // Observation scrolling above is preparation, not keyboard reachability proof.
    await page.getByLabel("사업부 A 이름", { exact: true }).focus();
    for (let step = 0; step < 3; step++) await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "비활성화", exact: true }).first()).toBeFocused();
    const keyboard = await captureUi(page, testInfo, `master-last-action-${width}`);
    assertFocusVisible(keyboard.controls.find(control => control.focused)!);
  }
});

test("#457 404 복구와 demo의 공유 controls는 좁은 폭에서도 keyboard로 접근한다", async ({ page }, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/issue-457-missing-route");
    const recovery = page.getByRole("link", { name: "프로젝트로 돌아가기", exact: true }); await expect(recovery).toBeVisible();
    for (let step = 0; step < 12 && !(await recovery.evaluate(node => node === document.activeElement)); step++) await page.keyboard.press("Tab");
    await expect(recovery).toBeFocused();
    const notFound = await captureUi(page, testInfo, `not-found-${width}`);
    expect(notFound.controls.some(control => control.focused && control.focusVisible && control.style.outlineStyle !== "none")).toBe(true);
    await page.keyboard.press("Enter"); await expect(page).toHaveURL(/\/$/);
    await page.goto("/gantt-demo");
    const preview = page.getByRole("checkbox", { name: "로컬 편집 미리보기" });
    const update = page.getByRole("button", { name: "fixture 변경 이벤트 실행" });
    await expect(update).toBeDisabled(); await captureUi(page, testInfo, `demo-readonly-${width}`);
    await preview.check(); await expect(update).toBeEnabled(); await update.click();
    await expect(page.getByText("build 변경을 감지했습니다. 이 데모는 저장하지 않습니다.")).toBeVisible();
    await captureUi(page, testInfo, `demo-preview-${width}`);
  }
});
