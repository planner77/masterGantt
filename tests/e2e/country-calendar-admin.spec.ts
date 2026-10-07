import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { observeUi, assertUi, assertIdentifiableInput, assertFocusVisible, assertPopulatedTable, assertSiblingControls } from "./helpers/ui-geometry";
import type { Page, TestInfo } from "@playwright/test";
import type { CountryCalendarAdminResponse } from "../../src/contracts/country-calendar-admin";

const adminPassword = "Calendar342Admin!";
test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: adminPassword, locale: "ko-KR", timezoneId: "Asia/Seoul" });
const root = "/api/admin/work-calendars";
// Test-only allowed-limit values exercise layout, not official source authority.
const longCsvFixture = {
  name: "CSV 날짜, 원문 " + "긴".repeat(189),
  sourceKey: "csv-test-only-" + "k".repeat(106),
  sourceVersion: "US-2031-E2E-v3-" + "V".repeat(185),
  sourceUrl: "https://example.com/test-only/" + "u".repeat(2018),
};
async function authenticate(page: Page, baseURL: string) {
  const response = await page.request.post("/api/project-master/admin-sessions", { headers: { Origin: baseURL }, data: { password: adminPassword } });
  expect(response.status()).toBe(201);
}
async function openAdmin(page: Page) {
  await page.goto("/country-calendar-admin");
  await expect(page.getByRole("combobox", { name: "국가", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "출처 정보 저장", exact: true })).toBeEnabled();
}
async function captureGeometry(page: Page, info: TestInfo, surface: string) {
  const geometry = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const facts = await observeUi(page, 'section[aria-label="국가 캘린더 관리"]');
    assertUi(facts, 10); expect(facts.document.scrollWidth).toBeLessThanOrEqual(width);
    expect(facts.tables.length).toBe(1); assertPopulatedTable(facts.tables[0]);
    const table = facts.tables[0];
    expect(table.owner.x).toBeGreaterThanOrEqual(0); expect(table.owner.right).toBeLessThanOrEqual(width + 1);
    expect(table.owner.scrollWidth).toBeGreaterThanOrEqual(table.owner.clientWidth);
    expect(table.rect.width).toBeLessThanOrEqual(table.owner.scrollWidth + 1);
    expect(table.headers.length).toBe(5); expect(table.rows[0].cells.length).toBe(5);
    for (const control of facts.controls.filter(control => control.tag === "INPUT" || control.tag === "SELECT")) assertIdentifiableInput(control);
    assertSiblingControls(facts.controls.filter(control => ["국가", "연도", "새로고침", "로그아웃"].includes(control.label ?? "")));
    assertSiblingControls(facts.controls.filter(control => ["자료 상태", "출처 버전", "출처 URL", "출처 정보 저장"].includes(control.label ?? "")));
    const toolbar = facts.controls.find(control => control.id === "country-calendar-country"); expect(toolbar).toBeDefined(); expect(toolbar!.rect.x).toBeGreaterThanOrEqual(0); expect(toolbar!.rect.right).toBeLessThanOrEqual(width); expect(toolbar!.rect.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: info.outputPath(`${surface}-${width}.png`), fullPage: true }); geometry.push(facts);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("combobox", { name: "국가", exact: true }).focus(); await page.keyboard.press("Tab");
  await expect(page.getByRole("combobox", { name: "연도", exact: true })).toBeFocused();
  const keyboard = await observeUi(page, 'section[aria-label="국가 캘린더 관리"]'); const focus = keyboard.controls.find(control => control.id === "country-calendar-year"); expect(focus).toBeDefined(); assertFocusVisible(focus!);
  await page.screenshot({ path: info.outputPath(`${surface}-keyboard-390.png`), fullPage: true });
  await info.attach(`${surface}-geometry`, { body: JSON.stringify({ fixture: "TEST ONLY US2031 OVERRIDE E2E-v3; not builtin official dataset evidence", catalogScope: "administrator-entered test metadata; URL syntax is not source-content verification", longFixture: { name: Array.from(longCsvFixture.name).length, sourceKey: longCsvFixture.sourceKey.length, sourceVersion: longCsvFixture.sourceVersion.length, sourceUrl: longCsvFixture.sourceUrl.length }, native125: "NOT TESTED", browserVersion: page.context().browser()?.version(), geometry, keyboard }, null, 2), contentType: "application/json" });
}

test("실제 SQLite 관리자 JSON/CSV 전체 교체·metadata·날짜 rename/delete와 Project Preview Save를 검증한다", async ({ page, baseURL }, info) => {
  test.setTimeout(90_000);
  await authenticate(page, baseURL!);
  const created = await page.request.post("/api/projects", { headers: { Origin: baseURL! }, data: { name: "국가 캘린더 원본 보호342", ownerName: "E2E 자동화", description: "원본 변경 전 snapshot", editPassword: "Calendar342!" } });
  expect(created.status()).toBe(201); const publicId = (await created.json()).data.project.publicId;
  const beforeProject = await (await page.request.get(`/api/projects/${publicId}`)).json();
  const beforeCalendar = await (await page.request.get(`/api/projects/${publicId}/work-calendar`)).json();
  await openAdmin(page);
  await page.getByRole("combobox", { name: "국가", exact: true }).selectOption("US");
  await expect(page.getByRole("status").filter({ hasText: "미국 2026년" }).first()).toContainText("공식 자료 확보");
  await page.getByRole("combobox", { name: "연도", exact: true }).selectOption("2031");
  await expect(page.getByRole("status").filter({ hasText: "미국 2031년" }).first()).toContainText("미확보");
  const dataset = { countryCode: "US", year: 2031, status: "OFFICIAL", sourceVersion: "US-2031-E2E-v1", sourceUrl: "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/", dates: [{ date: "2031-01-01", name: "테스트 공식 날짜", dayType: "NON_WORKING", sourceKey: "new-year" }] };
  await page.getByRole("button", { name: "JSON/CSV 가져오기", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "국가 캘린더 JSON/CSV 가져오기", exact: true });
  await dialog.getByLabel("UTF-8 파일").setInputFiles({ name: "US-2031.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(dataset)) });
  await dialog.getByRole("button", { name: "가져오기 미리보기", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "전체 교체 미리보기" })).toBeVisible();
  await dialog.getByRole("checkbox").check();
  const apply = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `${root}/import/apply`);
  await dialog.getByRole("button", { name: "확인한 자료 적용", exact: true }).click(); expect((await apply).status()).toBe(200);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "JSON/CSV 가져오기", exact: true })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "미국 2031년" }).first()).toContainText("공식 자료 확보");
  await page.getByRole("button", { name: "2031-01-01 수정", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "국가 캘린더 날짜 수정" });
  await dialog.getByLabel("날짜", { exact: true }).fill("2031-01-02");
  await dialog.getByLabel("날짜 이름").fill("직접 변경된 근무 예외");
  await dialog.getByRole("combobox", { name: "날짜 유형", exact: true }).selectOption("WORKING");
  await dialog.getByRole("button", { name: "날짜 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("button", { name: "2031-01-02 수정", exact: true })).toBeFocused();
  await expect(page.getByRole("combobox", { name: "자료 상태", exact: true })).toHaveValue("UNAVAILABLE"); await expect(page.getByLabel("출처 버전")).toHaveValue("");
  await page.getByLabel("출처 버전").fill("US-2031-E2E-v2"); await page.getByLabel("출처 URL").fill(dataset.sourceUrl); await page.getByRole("combobox", { name: "자료 상태", exact: true }).selectOption("OFFICIAL");
  await page.getByRole("button", { name: "출처 정보 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "미국 2031년" }).first()).toContainText("공식 자료 확보");
  await page.getByRole("button", { name: "2031-01-02 삭제", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "날짜 삭제 확인" }); await dialog.getByRole("button", { name: "날짜 삭제", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("button", { name: "날짜 추가", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "2031-01-02 수정", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "날짜 추가", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "국가 캘린더 날짜 추가" }); await dialog.getByLabel("날짜 이름").fill("추가 날짜"); await dialog.getByRole("button", { name: "날짜 저장", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "JSON/CSV 가져오기", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "국가 캘린더 JSON/CSV 가져오기", exact: true }); await dialog.getByRole("combobox", { name: "파일 형식", exact: true }).selectOption("csv");
  const csv = `countryCode,year,date,name,dayType,sourceKey,sourceVersion,sourceUrl\r\nUS,2031,2031-01-03,"${longCsvFixture.name}",WORKING,${longCsvFixture.sourceKey},${longCsvFixture.sourceVersion},${longCsvFixture.sourceUrl}\r\n`;
  await dialog.getByLabel("UTF-8 파일").setInputFiles({ name: "US-2031.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await dialog.getByRole("button", { name: "가져오기 미리보기", exact: true }).click(); await expect(dialog.getByRole("heading", { name: "전체 교체 미리보기" })).toBeVisible(); await dialog.getByRole("checkbox").check(); await dialog.getByRole("button", { name: "확인한 자료 적용", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByText(longCsvFixture.name, { exact: true })).toBeVisible();
  await expect(page.getByText(longCsvFixture.sourceKey, { exact: true })).toBeVisible();
  await expect(page.getByLabel("출처 버전")).toHaveValue(longCsvFixture.sourceVersion);
  await expect(page.getByLabel("출처 URL")).toHaveValue(longCsvFixture.sourceUrl);
  const noOpBefore = await (await page.request.get(`${root}/countries/US/years/2031`)).json();
  expect(noOpBefore.data.dataset.sourceVersion).toBe(longCsvFixture.sourceVersion);
  expect(noOpBefore.data.dataset.sourceUrl).toBe(longCsvFixture.sourceUrl);
  expect(noOpBefore.data.dates[0]).toMatchObject({ name: longCsvFixture.name, sourceKey: longCsvFixture.sourceKey });
  await page.getByRole("button", { name: "출처 정보 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "출처 정보 저장", exact: true })).toBeEnabled();
  const noOpAfter = await (await page.request.get(`${root}/countries/US/years/2031`)).json(); expect(noOpAfter).toEqual(noOpBefore);

  expect(await (await page.request.get(`/api/projects/${publicId}`)).json()).toEqual(beforeProject);
  expect(await (await page.request.get(`/api/projects/${publicId}/work-calendar`)).json()).toEqual(beforeCalendar);
  await captureGeometry(page, info, "country-calendar-admin");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${publicId}`); await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "프로젝트 설정", exact: true }); await dialog.getByRole("tab", { name: "작업 캘린더" }).click();
  await expect(dialog.getByRole("button", { name: "작업 캘린더 저장", exact: true })).toBeDisabled();
  await dialog.getByLabel("국가 1", { exact: true }).selectOption("US"); await dialog.getByLabel("국가 규칙 1 적용 범위").selectOption("DATE_RANGE"); await dialog.getByLabel("국가 규칙 1 시작일").fill("2031-01-01"); await dialog.getByLabel("국가 규칙 1 종료일").fill("2031-12-31");
  const previewResponse = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/projects/${publicId}/work-calendar/preview`));
  await dialog.getByRole("button", { name: "미리보기 계산", exact: true }).click(); const preview = await previewResponse; expect(preview.status()).toBe(200); const catalogRevision = (await preview.json()).data.countryCatalogRevision;
  const saveResponse = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().endsWith(`/projects/${publicId}/work-calendar`)); await dialog.getByRole("button", { name: "작업 캘린더 저장", exact: true }).click(); const saved = await saveResponse; expect(saved.status()).toBe(200); expect(saved.request().postDataJSON().countryCatalogRevision).toBe(catalogRevision);
  const canonical = await (await page.request.get(`/api/projects/${publicId}/work-calendar`)).json(); expect(canonical.data.projectDates.some((entry: { date: string }) => entry.date === "2031-01-03")).toBe(true);
  await dialog.getByRole("button", { name: "미리보기 계산", exact: true }).click(); await expect(dialog.getByRole("button", { name: "작업 캘린더 저장", exact: true })).toBeEnabled();
  const changedCatalog = await page.request.patch(`${root}/countries/US/years/2031`, { headers: { Origin: baseURL!, "If-Match": `"${catalogRevision}"` }, data: { sourceVersion: "US-2031-E2E-v4" } }); expect(changedCatalog.status()).toBe(200);
  const staleSave = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().endsWith(`/projects/${publicId}/work-calendar`)); await dialog.getByRole("button", { name: "작업 캘린더 저장", exact: true }).click(); expect((await staleSave).status()).toBe(412); await expect(dialog).toHaveCount(0);
  expect(await (await page.request.get(`/api/projects/${publicId}/work-calendar`)).json()).toEqual(canonical);
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click(); await dialog.getByRole("tab", { name: "작업 캘린더" }).click(); await dialog.getByLabel("국가 규칙 1 시작일").fill("2032-01-01"); await dialog.getByLabel("국가 규칙 1 종료일").fill("2032-12-31");
  const unavailable = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/projects/${publicId}/work-calendar/preview`)); await dialog.getByRole("button", { name: "미리보기 계산", exact: true }).click(); expect((await unavailable).status()).toBe(422); await expect(dialog.getByRole("alert")).toContainText("US 2032"); await expect(dialog.getByRole("button", { name: "작업 캘린더 저장", exact: true })).toBeDisabled();

});

function snapshot(countryCode = "KR", year = 2026, revision = 1): CountryCalendarAdminResponse {
  return { data: { revision, dataset: { countryCode: countryCode as "KR", countryName: countryCode, year, status: "OFFICIAL", origin: "BUILT_IN", sourceVersion: "E2E-1", sourceUrl: "https://example.com/calendar", dateCount: 1, updatedAt: null }, dates: [{ date: `${year}-01-01`, name: `${countryCode} 원본`, dayType: "NON_WORKING", sourceKey: "new-year" }] } };
}

test("첫 조회 오류에도 metadata/toolbar DOM을 유지하며 native 국가 변경과 역순 응답을 처리한다", async ({ page }) => {
  let authorized = false, fail = true; let releaseKR: (() => void) | undefined;
  await page.route("**/api/project-master/admin-sessions", async (route) => { authorized = true; await route.fulfill({ status: 201, json: { data: {} } }); });
  await page.route(`**${root}/countries/*/years/*`, async (route) => {
    if (!authorized) { await route.fulfill({ status: 401, json: { error: {} } }); return; }
    if (fail) { await route.fulfill({ status: 500, json: { error: { message: "제어된 최초 조회 오류" } } }); return; }
    const parts = new URL(route.request().url()).pathname.split("/"); const country = parts[5], year = Number(parts[7]);
    if (country === "KR") await new Promise<void>((resolve) => { releaseKR = resolve; });
    await route.fulfill({ json: snapshot(country, year) });
  });
  await page.goto("/country-calendar-admin"); await page.getByLabel("관리자 비밀번호").fill("mock-admin"); await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("region", { name: "국가 캘린더 관리", exact: true }).getByRole("alert")).toContainText("제어된 최초 조회 오류");
  await expect(page.getByRole("combobox", { name: "국가", exact: true })).toBeEnabled(); await expect(page.getByLabel("출처 버전")).toBeVisible(); await expect(page.getByRole("button", { name: "출처 정보 저장", exact: true })).toBeDisabled();
  const select = page.getByRole("combobox", { name: "국가", exact: true });
  expect(await select.evaluate((element) => ({ id: element.id, label: (element as HTMLSelectElement).labels?.[0]?.textContent }))).toEqual({ id: "country-calendar-country", label: "국가" });
  await select.evaluate((element) => { Object.defineProperty(element, "__stable342", { value: true }); });
  fail = false; await page.getByRole("button", { name: "다시 조회", exact: true }).click(); await expect.poll(() => !!releaseKR).toBe(true);
  await select.focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await expect(select).toHaveValue("CN"); await expect(select).toBeFocused(); await expect(page.getByText("CN 원본", { exact: true })).toBeVisible();
  releaseKR!(); await expect(select).toHaveValue("CN"); expect(await select.evaluate((element) => (element as HTMLElement & { __stable342?: boolean }).__stable342)).toBe(true); await expect(page.getByText("KR 원본", { exact: true })).toHaveCount(0);
  // Login mutation finishes before its initial GET. That read must not lock
  // the native selector or let its late response override a new selection.
  authorized = false; releaseKR = undefined; await page.reload();
  await page.getByLabel("관리자 비밀번호").fill("mock-admin"); await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect.poll(() => !!releaseKR).toBe(true); await expect(select).toBeEnabled();
  await select.selectOption("US"); await expect(page.getByText("US 원본", { exact: true })).toBeVisible(); releaseKR!(); await expect(select).toHaveValue("US");

});

test("412와 401 뒤 보존 초안은 명시적 검토 전 mutation을 재전송하지 않는다", async ({ page }) => {
  let authenticated = false, mutations = 0, reject: 401 | 412 = 412;
  await page.route("**/api/project-master/admin-sessions", async (route) => { authenticated = true; await route.fulfill({ status: 201, json: { data: {} } }); });
  await page.route(`**${root}/countries/KR/years/2026`, async (route) => {
    if (route.request().method() === "GET") { await route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? snapshot("KR", 2026, mutations + 1) : { error: {} } }); return; }
    mutations++; if (reject === 401) authenticated = false; await route.fulfill({ status: reject, json: { error: { message: "제어된 충돌" } } });
  });
  await page.goto("/country-calendar-admin"); await page.getByLabel("관리자 비밀번호").fill("mock-admin"); await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByLabel("출처 버전").fill("draft-v2"); await page.getByRole("button", { name: "출처 정보 저장", exact: true }).click();
  await expect(page.getByLabel("출처 버전")).toHaveValue("draft-v2"); await expect(page.getByRole("button", { name: "출처 정보 저장", exact: true })).toBeDisabled(); expect(mutations).toBe(1);
  await page.getByRole("button", { name: "새로고침", exact: true }).click(); await expect(page.getByRole("button", { name: "출처 정보 저장", exact: true })).toBeDisabled(); expect(mutations).toBe(1);
  await page.getByRole("button", { name: "최신 데이터 검토 완료", exact: true }).click(); reject = 401; await page.getByRole("button", { name: "출처 정보 저장", exact: true }).click(); await expect(page.getByLabel("관리자 비밀번호")).toBeVisible(); expect(mutations).toBe(2);
  await page.getByLabel("관리자 비밀번호").fill("mock-admin"); await page.getByRole("button", { name: "로그인", exact: true }).click(); await expect(page.getByLabel("출처 버전")).toHaveValue("draft-v2"); await expect(page.getByRole("button", { name: "출처 정보 저장", exact: true })).toBeDisabled(); expect(mutations).toBe(2);
});

test("파일 UTF-8 오류·읽기 epoch·preview 만료와 pending Escape를 잠근다", async ({ page }) => {
  let authenticated = false, release: (() => void) | undefined, applies = 0;
  await page.route("**/api/project-master/admin-sessions", async (route) => { authenticated = true; await route.fulfill({ status: 201, json: { data: {} } }); });
  await page.route(`**${root}/countries/KR/years/2026`, (route) => route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? snapshot() : { error: {} } }));
  await page.route(`**${root}/import/preview`, async (route) => {
    const request = route.request().postDataJSON();
    expect(request.content).toContain("latest-file");
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ json: { data: { revision: 1, previewToken: "opaque-mock", expiresAt: new Date(Date.now() + 1000).toISOString(), dataset: snapshot().data.dataset, importDataset: { countryCode: "KR", year: 2026, sourceVersion: "E2E-1", sourceUrl: "https://example.com", dateCount: 1 }, summary: { additions: 0, changes: 1, deletions: 0, unchanged: 0, metadataChanged: false }, changed: true } } });
  });
  await page.route(`**${root}/import/apply`, async (route) => { applies++; await route.fulfill({ json: snapshot() }); });
  await page.goto("/country-calendar-admin"); await page.getByLabel("관리자 비밀번호").fill("mock-admin"); await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "JSON/CSV 가져오기", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "국가 캘린더 JSON/CSV 가져오기", exact: true });
  await dialog.getByLabel("UTF-8 파일").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from([0xff]) }); await expect(dialog.getByRole("alert")).toContainText("UTF-8"); await expect(dialog.getByRole("button", { name: "가져오기 미리보기", exact: true })).toBeDisabled();
  await page.evaluate(() => { const original = File.prototype.arrayBuffer; File.prototype.arrayBuffer = async function () { if (this.name === "old.json") { await new Promise((resolve) => setTimeout(resolve, 250)); } return original.call(this); }; });
  await dialog.getByLabel("UTF-8 파일").setInputFiles({ name: "old.json", mimeType: "application/json", buffer: Buffer.from("old-file") }); await dialog.getByLabel("UTF-8 파일").setInputFiles({ name: "latest.json", mimeType: "application/json", buffer: Buffer.from("\uFEFFlatest-file") });
  await dialog.getByRole("button", { name: "가져오기 미리보기", exact: true }).click(); await expect.poll(() => !!release).toBe(true);
  for (let index = 0; index < 3; index++) await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
  release!(); await expect(dialog.getByRole("heading", { name: "전체 교체 미리보기" })).toBeVisible(); await dialog.getByRole("checkbox").check(); await expect(dialog.getByRole("alert").filter({ hasText: "만료" })).toBeVisible(); await expect(dialog.getByRole("button", { name: "확인한 자료 적용", exact: true })).toBeDisabled(); expect(applies).toBe(0);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(page.getByRole("button", { name: "JSON/CSV 가져오기", exact: true })).toBeFocused();
});
