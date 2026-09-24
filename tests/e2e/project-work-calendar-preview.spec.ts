import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

async function openCalendar(page: import("@playwright/test").Page, baseURL: string) {
  const response = await page.request.post("/api/projects", {
    headers: { Origin: baseURL },
    data: { name: "Calendar preview #115", ownerName: "E2E 자동화", description: "캘린더 미리보기", editPassword: "Calendar115!" },
  });
  expect(response.status()).toBe(201);
  const publicId = (await response.json()).data.project.publicId as string;
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
  await expect(dialog.getByRole("button", { name: "미리보기 계산" })).toBeVisible();
  return { publicId, dialog };
}

function calendarStatus(dialog: import("@playwright/test").Locator) {
  return dialog.locator("p[role='status'][aria-atomic='true']");
}

test("KR→US 재계산과 저장이 현재 초안을 사용하고 저장 결과를 preview로 재사용하지 않는다", async ({ page, baseURL }, testInfo) => {
  const { publicId, dialog } = await openCalendar(page, baseURL!);
  const country = dialog.getByLabel("국가 1");
  const preview = dialog.getByRole("button", { name: "미리보기 계산" });
  await expect(country).toHaveValue("KR");
  await preview.focus();
  await page.keyboard.press("Enter");
  await expect(calendarStatus(dialog)).toContainText("미리보기 계산 완료");
  await expect(preview).toBeFocused();
  await country.selectOption("US");
  await expect(calendarStatus(dialog)).toHaveText("입력이 변경되었습니다. 미리보기를 다시 계산하세요.");
  await expect(dialog.getByText("적용 날짜 미리보기")).toHaveCount(0);
  const previewResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/projects/${publicId}/work-calendar/preview`);
  await preview.click();
  const response = await previewResponse;
  expect((await response.request().postDataJSON()).countryRules[0].countryCode).toBe("US");
  await expect(calendarStatus(dialog)).toContainText("미리보기 계산 완료");
  await page.screenshot({ path: testInfo.outputPath("calendar-preview-after.png"), fullPage: true });

  const saveResponse = page.waitForResponse((candidate) => candidate.request().method() === "PUT" && new URL(candidate.url()).pathname === `/api/projects/${publicId}/work-calendar`);
  await dialog.getByRole("button", { name: "작업 캘린더 저장" }).click();
  const saved = await saveResponse;
  expect(saved.status()).toBe(200);
  expect((await saved.request().postDataJSON()).countryRules[0].countryCode).toBe("US");
  await expect(calendarStatus(dialog)).toHaveText("입력이 변경되었습니다. 미리보기를 다시 계산하세요.");
  await expect(dialog.getByText("적용 날짜 미리보기")).toHaveCount(0);
  await country.selectOption("KR");
  const directSaveResponse = page.waitForResponse((candidate) => candidate.request().method() === "PUT" && new URL(candidate.url()).pathname === `/api/projects/${publicId}/work-calendar`);
  await dialog.getByRole("button", { name: "작업 캘린더 저장" }).click();
  const directSaved = await directSaveResponse;
  expect(directSaved.status()).toBe(200);
  expect((await directSaved.request().postDataJSON()).countryRules[0].countryCode).toBe("KR");
});

test("모든 초안 변경은 결과를 무효화하고 실패·재시도·늦은 응답을 구분한다", async ({ page, baseURL }, testInfo) => {
  await page.route((url)=>url.pathname.endsWith("/assignment-targets") && url.searchParams.has("kind"), async (route) => {
    const kind = new URL(route.request().url()).searchParams.get("kind");
    await route.fulfill({json:{data:{catalogRevision:1,targets:[{
      kind,id:kind==="group"?"11111111-1111-4111-8111-111111111111":"22222222-2222-4222-8222-222222222222",
      name:kind==="group"?"테스트 그룹":"테스트 리소스",code:null,active:true,
    }]}}});
  });
  const { publicId, dialog } = await openCalendar(page, baseURL!);
  const path = `/api/projects/${publicId}/work-calendar/preview`;
  const preview = dialog.getByRole("button", { name: "미리보기 계산" });
  const status = calendarStatus(dialog);
  const original = await (await page.request.get(`/api/projects/${publicId}/work-calendar`)).json();
  const previewBody = {
    data: { projectRevision: original.data.projectRevision,
      calendar: { projectRevision: original.data.projectRevision, rules: original.data.rules, projectDates: [] },
      changedTasks: [], manualConflicts: [] },
  };
  let mode: "normal"|"fail"|"malformed"|"hold"|"conflict"|"unauthorized" = "normal";
  let releaseHeld: (()=>void)|undefined;
  await page.route(`**${path}`, async (route) => {
    if(mode==="fail") { await route.fulfill({ status: 500, json: { error: { code: "PREVIEW_ERROR" } } }); return; }
    if(mode==="malformed") { await route.fulfill({ json: { data: null } }); return; }
    if(mode==="conflict") { await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH" } } }); return; }
    if(mode==="unauthorized") { await route.fulfill({ status: 401, json: { error: { code: "EDIT_SESSION_INVALID" } } }); return; }
    if(mode==="hold") await new Promise<void>((resolve)=>{ releaseHeld=resolve; });
    await route.fulfill({ json: previewBody });
  });
  const calculate = async () => {
    await preview.click();
    await expect(status).toContainText("미리보기 계산 완료");
  };
  const stale = async () => {
    await expect(status).toHaveText("입력이 변경되었습니다. 미리보기를 다시 계산하세요.");
    await expect(dialog.getByText("적용 날짜 미리보기")).toHaveCount(0);
  };

  await calculate();
  const country = dialog.getByLabel("국가 1");
  await country.selectOption("US"); await stale(); await calculate();
  await dialog.getByLabel("적용 범위").selectOption("DATE_RANGE"); await stale();
  await dialog.getByLabel("시작일").fill("2026-01-01"); await stale();
  await dialog.getByLabel("종료일").fill("2026-12-31"); await stale(); await calculate();
  await dialog.getByRole("button", { name: "국가 규칙 추가" }).click(); await stale();
  await dialog.getByRole("button", { name: "국가 규칙 삭제" }).last().click(); await stale(); await calculate();
  await dialog.getByRole("button", { name: "휴무일 추가" }).click(); await stale();
  await dialog.getByLabel("휴무일 1").fill("팀 휴무"); await stale();
  await dialog.getByLabel("휴무일 날짜").fill("2026-10-01"); await stale(); await calculate();
  await dialog.getByLabel("휴무 대상").selectOption("RESOURCE_GROUP"); await stale();
  await dialog.getByLabel("대상 선택").selectOption("11111111-1111-4111-8111-111111111111"); await stale(); await calculate();
  await dialog.getByLabel("휴무 대상").selectOption("RESOURCE"); await stale();
  await dialog.getByLabel("대상 선택").selectOption("22222222-2222-4222-8222-222222222222"); await stale(); await calculate();
  await dialog.getByLabel("휴무 대상").selectOption("PROJECT"); await stale(); await calculate();
  await dialog.getByRole("button", { name: "휴무일 삭제" }).click(); await stale(); await calculate();

  mode="fail";
  await preview.click();
  await expect(status).toContainText("계산하지 못했습니다");
  await expect(dialog.getByText("적용 날짜 미리보기")).toHaveCount(0);
  mode="normal";
  await calculate();
  mode="malformed";
  await preview.click();
  await expect(status).toContainText("계산하지 못했습니다");
  mode="normal";
  await calculate();

  mode="hold";
  await preview.click();
  await expect(status).toHaveText("미리보기를 계산하는 중…");
  await expect(country).toBeDisabled();
  await expect(dialog.getByText("적용 날짜 미리보기")).toHaveCount(0);
  await expect.poll(()=>Boolean(releaseHeld)).toBe(true);
  const name = dialog.getByLabel("프로젝트 이름");
  await name.fill("Calendar preview revision changed");
  const metadataResponse = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/projects/${publicId}`);
  await dialog.getByRole("button", { name: "프로젝트 정보 저장" }).click();
  const updated = await metadataResponse;
  expect(updated.status()).toBe(200);
  const updatedRevision = (await updated.json()).data.project.revision as number;
  previewBody.data.projectRevision=updatedRevision;
  previewBody.data.calendar.projectRevision=updatedRevision;
  await expect(dialog).toHaveCount(0);
  releaseHeld?.();
  await expect(page.getByText("Calendar preview revision changed", {exact:true}).first()).toBeVisible();
  await page.getByRole("button", {name:"프로젝트 설정",exact:true}).click();
  await expect(dialog.getByRole("button", {name:"미리보기 계산"})).toBeVisible();
  mode="normal";
  await calculate();

  for(const width of [390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    await expect(status).toContainText("미리보기 계산 완료");
    for(const button of [preview,dialog.getByRole("button", {name:"작업 캘린더 저장"})]) {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      const box=await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
    if(width===390) await page.screenshot({path:testInfo.outputPath("calendar-preview-390.png"),fullPage:true});
  }
  mode="conflict";
  await preview.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("workspace-toast")).toContainText("다른 편집 내용이 먼저 저장되었습니다");
  await page.getByRole("button", {name:"프로젝트 설정",exact:true}).click();
  await expect(dialog.getByRole("button", {name:"미리보기 계산"})).toBeVisible();
  mode="unauthorized";
  await preview.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("읽기 전용",{exact:true})).toBeVisible();
});
