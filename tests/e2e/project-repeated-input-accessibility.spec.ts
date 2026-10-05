import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { installStatefulProjectFixture, publicId, rowNamed } from "../fixtures/stateful-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";

test.use(isolatedApplicationOptions);

for (const width of [390, 768, 1024, 1440]) {
  test(`#119 ${width}px 프로젝트 생성 오류는 필드별로 연결되고 입력을 보존한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const writes: string[] = [];
    page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/projects") writes.push(request.url()); });
    await page.goto("/projects/new");
    const submit = page.getByRole("button", { name: "프로젝트 만들기" });
    await submit.focus();
    await page.keyboard.press("Enter");
    const summary = page.locator(".form-error[role='alert']");
    await expect(summary).toBeFocused();
    await expect(summary).toContainText("프로젝트 입력 3곳");
    const name = page.getByLabel("프로젝트 이름");
    const owner = page.getByLabel("소유자");
    const password = page.getByLabel("편집 비밀번호");
    for (const field of [name, owner, password]) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
      const describedBy = await field.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      await expect(page.locator(`#${describedBy!.split(" ").at(-1)}`)).toBeVisible();
    }
    expect(writes).toHaveLength(0);
    await summary.getByRole("button", { name: "소유자를 입력해 주세요." }).focus();
    await page.keyboard.press("Enter");
    await expect(owner).toBeFocused();
    await name.fill("검증 초안");
    await owner.fill("담당자");
    await password.fill("safe-password");
    await expect(password).toHaveValue("safe-password");
    await expect(summary).toHaveCount(0);
    expect(writes).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });

  test(`#119 ${width}px 캘린더 반복 규칙의 오류는 Preview·Save 요청 전에 구분된다`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 844 });
    const created = await page.request.post("/api/projects", { headers: { Origin: baseURL! }, data: {
      name: `Calendar validation ${width}`, ownerName: "E2E 자동화", description: "#119", editPassword: "Calendar119!",
    } });
    expect(created.status()).toBe(201);
    const id = (await created.json()).data.project.publicId as string;
    await page.goto(`/projects/${id}`);
    await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
    await dialog.getByRole("tab", { name: "작업 캘린더" }).click();
    const writes: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if ((request.method() === "POST" && path.endsWith("/work-calendar/preview")) || (request.method() === "PUT" && path.endsWith("/work-calendar"))) writes.push(path);
    });
    await dialog.getByRole("button", { name: "국가 규칙 추가" }).click();
    const firstRule = dialog.getByRole("group", { name: "국가 규칙 1", exact: true });
    const secondRule = dialog.getByRole("group", { name: "국가 규칙 2", exact: true });
    await expect(firstRule).toBeVisible();
    await expect(secondRule).toBeVisible();
    await firstRule.getByLabel("적용 범위").selectOption("DATE_RANGE");
    await secondRule.getByLabel("적용 범위").selectOption("DATE_RANGE");
    await secondRule.getByLabel("시작일").fill("2026-12-31");
    await secondRule.getByLabel("종료일").fill("2026-01-01");
    await dialog.getByRole("button", { name: "날짜 예외 추가" }).click();
    await dialog.getByRole("button", { name: "날짜 예외 추가" }).click();
    const firstName = dialog.getByRole("group", { name: "날짜 예외 항목 1" }).getByLabel("날짜 예외 1 이름");
    await firstName.fill("보존할 초안");
    await dialog.getByRole("group", { name: "날짜 예외 항목 2" }).getByLabel("예외 대상 2").selectOption("RESOURCE");
    const preview = dialog.getByRole("button", { name: "미리보기 계산" });
    await expect(preview).toBeEnabled();
    await preview.focus();
    await page.keyboard.press("Enter");
    const summary = dialog.locator("[role='alert'][tabindex='-1']").filter({ hasText: "작업 캘린더 입력" });
    await expect(summary).toBeFocused();
    await expect(summary).toContainText("국가 규칙 1 시작일");
    await expect(summary).toContainText("국가 규칙 2 종료일");
    await expect(summary).toContainText("날짜 예외 2 이름");
    await expect(firstName).toHaveValue("보존할 초안");
    const secondDate = dialog.getByRole("group", { name: "날짜 예외 항목 2" }).getByLabel("예외 날짜 2");
    await expect(secondDate).toHaveAttribute("aria-invalid", "true");
    const errorId = await secondDate.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    await expect(dialog.locator(`#${errorId}`)).toBeVisible();
    const secondRuleEnd = secondRule.getByLabel("종료일");
    await expect(secondRuleEnd).toHaveAttribute("aria-invalid", "true");
    const rangeErrorId = await secondRuleEnd.getAttribute("aria-describedby");
    expect(rangeErrorId).toBeTruthy();
    await expect(dialog.locator(`#${rangeErrorId}`)).toContainText("시작일보다 빠를 수 없습니다");
    const secondTarget = dialog.getByRole("group", { name: "날짜 예외 항목 2" }).getByLabel("대상 선택 2");
    await expect(secondTarget).toHaveAttribute("aria-invalid", "true");
    const targetErrorId = await secondTarget.getAttribute("aria-describedby");
    expect(targetErrorId).toBeTruthy();
    await expect(dialog.locator(`#${targetErrorId}`)).toBeVisible();
    expect(writes).toHaveLength(0);
    await summary.getByRole("button", { name: /날짜 예외 2 날짜/ }).focus();
    await page.keyboard.press("Enter");
    await expect(secondDate).toBeFocused();
    const save = dialog.getByRole("button", { name: "작업 캘린더 저장" });
    await save.focus();
    await page.keyboard.press("Enter");
    await expect(summary).toBeFocused();
    expect(writes).toHaveLength(0);
    const deleteSecondRule = secondRule.getByRole("button", { name: "국가 규칙 삭제 2", exact: true });
    await deleteSecondRule.focus();
    await page.keyboard.press("Enter");
    await expect(secondRule).toHaveCount(0);
    await expect(firstRule).toBeVisible();
    const deleteSecondHoliday = dialog.getByRole("group", { name: "날짜 예외 항목 2" }).getByRole("button", { name: "날짜 예외 삭제 2", exact: true });
    await deleteSecondHoliday.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("group", { name: "날짜 예외 항목 2" })).toHaveCount(0);
    await expect(firstName).toHaveValue("보존할 초안");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });

  test(`#119 ${width}px 반복 리소스 투입 오류는 대상별로 이동하고 PUT 전에 멈춘다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installStatefulProjectFixture(page);
    const targets = [
      { kind: "resource", id: "00000000-0000-4000-8000-000000000071", name: "Resource A", code: "RES-A", active: true, roles: ["DEVELOPER"] },
      { kind: "resource", id: "00000000-0000-4000-8000-000000000072", name: "Resource B", code: "RES-B", active: true, roles: ["DEVELOPER"] },
    ];
    await page.route(`**/api/projects/${publicId}/assigned-targets`, (route) => route.fulfill({ json: { data: { projectRevision: 40, catalogRevision: 1, assignments: [], targets } } }));
    await page.route(`**/api/projects/${publicId}/assignment-targets`, (route) => route.fulfill({ json: { data: { catalogRevision: 1, targets } } }));
    const writes: string[] = [];
    page.on("request", (request) => { if (request.method() === "PUT" && new URL(request.url()).pathname.endsWith("/assignments")) writes.push(request.url()); });
    await page.goto(`/projects/${publicId}`);
    await rowNamed(page, "Stable leaf").getByText("Stable leaf", { exact: true }).click({ button: "right" });
    await chooseTaskInformation(page);
    const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
    await dialog.getByRole("tab", { name: /리소스/ }).click();
    const panel = dialog.getByRole("tabpanel", { name: /리소스/ });
    await panel.getByRole("checkbox", { name: /Resource A/ }).check();
    await panel.getByRole("checkbox", { name: /Resource B/ }).check();
    await panel.getByRole("combobox", { name: /Resource A.*수행 역할/ }).selectOption("DEVELOPER");
    await panel.getByRole("combobox", { name: /Resource B.*수행 역할/ }).selectOption("DEVELOPER");
    const firstPercent = panel.getByRole("spinbutton", { name: /Resource A.*투입률/ });
    const secondPercent = panel.getByRole("spinbutton", { name: /Resource B.*투입률/ });
    await expect(panel.getByRole("group", { name: /Resource A.*투입 정보/ })).toBeVisible();
    await expect(panel.getByRole("group", { name: /Resource B.*투입 정보/ })).toBeVisible();
    await firstPercent.fill("150");
    await secondPercent.fill("0");
    const firstStart = panel.getByLabel(/Resource A.*투입 시작/);
    const firstEnd = panel.getByLabel(/Resource A.*투입 종료/);
    await firstStart.fill("2026-10-10");
    await firstEnd.fill("2026-10-01");
    const save = panel.getByRole("button", { name: /할당 저장/ });
    await save.focus();
    await page.keyboard.press("Enter");
    const summary = panel.locator("[role='alert'][tabindex='-1']");
    await expect(summary).toBeFocused();
    await expect(summary).toContainText("할당 입력 3곳");
    await expect(firstPercent).toHaveAttribute("aria-invalid", "true");
    await expect(secondPercent).toHaveAttribute("aria-invalid", "true");
    await expect(firstEnd).toHaveAttribute("aria-invalid", "true");
    for (const field of [firstPercent, secondPercent, firstEnd]) {
      const errorId = await field.getAttribute("aria-describedby");
      expect(errorId).toBeTruthy();
      await expect(panel.locator(`[id="${errorId}"]`)).toBeVisible();
    }
    expect(writes).toHaveLength(0);
    await summary.getByRole("button", { name: /Resource B.*투입률/ }).focus();
    await page.keyboard.press("Enter");
    await expect(secondPercent).toBeFocused();
    await expect(firstStart).toHaveValue("2026-10-10");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}


for (const width of [390, 768, 1024, 1440]) {
  test(`#340 ${width}px 리소스와 그룹 목록은 compact pane과 필터 폭 계약을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installStatefulProjectFixture(page);
    const targets = [
      { kind: "resource", id: "00000000-0000-4000-8000-000000000081", name: "긴 이름의 제어 개발자 Alpha", code: "DEV-ALPHA-LONG", active: true },
      { kind: "resource", id: "00000000-0000-4000-8000-000000000082", name: "Resource Beta", code: "DEV-B", active: true },
      { kind: "resource", id: "00000000-0000-4000-8000-000000000083", name: "Inactive Resource", code: "DEV-X", active: false },
      { kind: "group", id: "00000000-0000-4000-8000-000000000091", name: "물류제어 개발 그룹", code: "TEAM-CTRL", active: true },
      { kind: "group", id: "00000000-0000-4000-8000-000000000092", name: "설비 인터페이스 그룹", code: "TEAM-EQ", active: true },
    ];
    await page.route(`**/api/projects/${publicId}/assigned-targets`, (route) => route.fulfill({ json: { data: { projectRevision: 40, catalogRevision: 1, assignments: [], targets } } }));
    await page.route(`**/api/projects/${publicId}/assignment-targets`, (route) => route.fulfill({ json: { data: { catalogRevision: 1, targets } } }));
    await page.goto(`/projects/${publicId}`);
    await rowNamed(page, "Stable leaf").getByText("Stable leaf", { exact: true }).click({ button: "right" });
    await chooseTaskInformation(page);
    const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
    await dialog.getByRole("tab", { name: /리소스/ }).click();
    const panel = dialog.getByRole("tabpanel", { name: /리소스/ });
    const resourceSection = panel.getByRole("region", { name: "담당 리소스", exact: true });
    const groupSection = panel.getByRole("region", { name: "리소스 그룹", exact: true });
    await expect(resourceSection).toContainText("3 / 3");
    await expect(groupSection).toContainText("2 / 2");
    await expect(resourceSection.getByRole("checkbox", { name: /긴 이름의 제어 개발자 Alpha/ })).toBeVisible();
    await expect(groupSection.getByRole("checkbox", { name: /물류제어 개발 그룹/ })).toBeVisible();

    const resourceBox = await resourceSection.boundingBox();
    const groupBox = await groupSection.boundingBox();
    expect(resourceBox).not.toBeNull();
    expect(groupBox).not.toBeNull();
    if (width >= 1024) {
      expect(Math.abs(resourceBox!.y - groupBox!.y)).toBeLessThanOrEqual(2);
      expect(resourceBox!.x + resourceBox!.width).toBeLessThanOrEqual(groupBox!.x + 2);
      expect(resourceBox!.width).toBeGreaterThan(groupBox!.width);
    } else {
      expect(groupBox!.y).toBeGreaterThan(resourceBox!.y + resourceBox!.height - 2);
    }

    await resourceSection.getByRole("checkbox", { name: /긴 이름의 제어 개발자 Alpha/ }).check();
    const allocation = resourceSection.getByRole("group", { name: /긴 이름의 제어 개발자 Alpha.*투입 정보/ });
    await expect(allocation).toBeVisible();
    await expect(groupSection.getByRole("group", { name: /투입 정보/ })).toHaveCount(0);

    await panel.getByLabel("유형").selectOption("resource");
    await expect(groupSection).toHaveCount(0);
    const resourceOnly = panel.getByRole("region", { name: "담당 리소스", exact: true });
    const panelBox = await panel.boundingBox();
    const resourceOnlyBox = await resourceOnly.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(resourceOnlyBox).not.toBeNull();
    expect(resourceOnlyBox!.width).toBeGreaterThan(panelBox!.width * 0.85);

    await panel.getByLabel("검색").fill("없는 대상");
    await expect(resourceOnly).toContainText("현재 필터와 일치하는 결과가 없습니다.");
    await panel.getByLabel("검색").fill("");
    await panel.getByLabel("유형").selectOption("group");
    await expect(panel.getByRole("region", { name: "담당 리소스", exact: true })).toHaveCount(0);
    await expect(panel.getByRole("region", { name: "리소스 그룹", exact: true })).toContainText("2 / 2");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });
}


test("#340 readonly pane 건수는 현재 Task에 표시 가능한 할당 대상만 집계한다", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 844 });
  const fixture = await installStatefulProjectFixture(page);
  fixture.sessionEditable = false;
  await page.goto(`/projects/${publicId}`);
  await rowNamed(page, "Stable leaf").getByText("Stable leaf", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await dialog.getByRole("tab", { name: /리소스/ }).click();
  const panel = dialog.getByRole("tabpanel", { name: /리소스/ });
  const resourceSection = panel.getByRole("region", { name: "담당 리소스", exact: true });
  const groupSection = panel.getByRole("region", { name: "리소스 그룹", exact: true });

  await expect(resourceSection).toContainText("1 / 1");
  await expect(resourceSection.getByRole("checkbox", { name: /테스트 리소스/ })).toBeChecked();
  await expect(groupSection).toContainText("0 / 0");
  await expect(groupSection).toContainText("등록된 그룹이 없습니다.");
  await expect(panel.getByText("개발팀", { exact: true })).toHaveCount(0);
});
