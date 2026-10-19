import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { seedWbsViewComposer, viewResourcePassword } from "./fixtures/wbs-view-composer";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import type { WbsViewQueryInput, WbsViewReportDto, WbsViewSpec } from "../../src/contracts/wbs-dashboard-views";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: viewResourcePassword, viewport: { width: 1440, height: 1000 } });
const roots = ["process", "equipment", "system", "resource", "milestone"] as const;
type Root = typeof roots[number];
const labels = { process: "공정&WorkArea", equipment: "설비", system: "물류 시스템", resource: "리소스", milestone: "Milestone" };
const dashboard = (page: Page) => page.getByTestId("wbs-view-dashboard").filter({ visible: true });
async function captureFocus(page: Page, label: string) {
  const focus = await page.evaluate(() => ({ active: document.activeElement?.outerHTML, activeRoot: document.activeElement?.closest("[data-wbs-view]")?.getAttribute("data-root"), roots: Array.from(document.querySelectorAll("[data-wbs-view]")).map(element => ({ root: element.getAttribute("data-root"), ready: element.getAttribute("data-ready"), visible: !!element.getClientRects().length })), details: Array.from(document.querySelectorAll<HTMLElement>("[data-projection-detail-key]")).map(element => ({ key: element.dataset.projectionDetailKey })), actions: Array.from(document.querySelectorAll<HTMLButtonElement>("[data-resource-action]")).filter(element=>element.getClientRects().length>0).map(element => ({ action:element.dataset.resourceAction, connected: element.isConnected, disabled: element.disabled, detailKey: element.closest<HTMLElement>("[data-projection-detail-key]")?.dataset.projectionDetailKey })) }));
  await test.info().attach(label, { body: JSON.stringify(focus, null, 2), contentType: "application/json" });
  await test.info().attach(`${label}.png`, { body: await page.screenshot(), contentType: "image/png" });
}
async function openRoot(page: Page, root: Root) {
  await page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "대시보드", exact: true }).click();
  await page.getByRole("tablist", { name: "대시보드 보기", exact: true }).getByRole("tab", { name: labels[root], exact: true }).click();
  await expect(dashboard(page)).toBeVisible();
  await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
}
async function composer(root: Locator) {
  const disclosure = root.locator("details").filter({ has: root.page().locator("summary").filter({ hasText: /^조회 구성$/ }) });
  if (!(await disclosure.evaluate(element => (element as HTMLDetailsElement).open))) {
    await disclosure.locator("summary").focus();
    await disclosure.locator("summary").press("Enter");
  }
  await expect(disclosure).toHaveJSProperty("open", true);
  return disclosure;
}
function nextReport(page: Page) {
  return page.waitForResponse(response => response.url().endsWith("/resource-dashboard/views") && response.request().postDataJSON().projection?.kind !== "details" && response.request().postDataJSON().projection?.kind !== "scope");
}
async function apply(page: Page, expected: NonNullable<WbsViewSpec["levels"]>) {
  const responsePromise = nextReport(page);
  await (await composer(dashboard(page))).getByRole("button", { name: "적용", exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  const input = response.request().postDataJSON() as WbsViewQueryInput;
  expect(input.spec.levels).toEqual(expected);
  await expect(dashboard(page)).toHaveAttribute("data-ready", "true");
  return (await response.json()).data as WbsViewReportDto;
}
async function geometry(page: Page, root: Locator, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.clientWidth)).toBe(width);
  const table = root.getByRole("table", { name: "공통 계층 결과", exact: true });
  const measurement = await table.evaluate(element => {
    const header = Array.from(element.querySelectorAll("thead th")).map(cell => ({ left: cell.getBoundingClientRect().left, width: cell.getBoundingClientRect().width }));
    const first = Array.from(element.querySelectorAll("tbody tr:first-child > *")).map(cell => ({ left: cell.getBoundingClientRect().left, width: cell.getBoundingClientRect().width }));
    const parent = element.parentElement!;
    return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, tableWidth: element.getBoundingClientRect().width, scroll: { width: parent.clientWidth, content: parent.scrollWidth, overflow: getComputedStyle(parent).overflowX }, header, first };
  });
  expect(measurement.document, `${width}px document overflow`).toBeLessThanOrEqual(width + 1);
  expect(measurement.header).toHaveLength(6);
  expect(measurement.first).toHaveLength(6);
  measurement.first.forEach((cell, index) => { expect(Math.abs(cell.left - measurement.header[index].left)).toBeLessThanOrEqual(1); expect(Math.abs(cell.width - measurement.header[index].width)).toBeLessThanOrEqual(1); });
  expect(measurement.scroll.overflow).toMatch(/auto|scroll/);
  if (width <= 768) expect(measurement.scroll.content).toBeGreaterThan(measurement.scroll.width);
  const buttons = [];
  for (const button of await root.getByRole("button").all()) {
    if (await button.isVisible()) {
      const bounds = await button.boundingBox();
      const name = await button.getAttribute("aria-label") ?? await button.innerText();
      expect(bounds!.height, name).toBeGreaterThanOrEqual(44);
      expect(bounds!.width, name).toBeGreaterThanOrEqual(44);
      buttons.push({ name, width: bounds!.width, height: bounds!.height });
    }
  }
  const evidence = { ...measurement, buttons };
  const directory = resolve(process.env.ISSUE730_E2E_ARTIFACT_DIR ?? "output/playwright/issue-730");
  await mkdir(directory, { recursive: true });
  await root.getByRole("region", { name: "공통 계층 표 스크롤", exact: true }).scrollIntoViewIfNeeded();
  await root.getByRole("region", { name: "공통 계층 표 스크롤", exact: true }).evaluate(element => { element.scrollLeft = 0; });
  await page.screenshot({ path: resolve(directory, `composer-${width}.png`), fullPage: true });
  await writeFile(resolve(directory, `geometry-${width}.json`), JSON.stringify(evidence, null, 2));
  await test.info().attach(`issue-730-${width}px`, { body: JSON.stringify(evidence), contentType: "application/json" });
  return evidence;
}

test("#730 지연 원본은 새 상세·상세 Task 명령·이름 검색에 양보한다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedWbsViewComposer(page, origin, observeIsolatedApi);
  await openRoot(page, "equipment");
  const root = dashboard(page);
  const row = root.locator('tr[data-dimension="equipment"][data-entity-id="' + f.equipment.id + '"]');
  const pattern = "**/api/projects/" + f.publicId + "/resource-dashboard/views";
  const release: Array<() => void> = [];
  let settled = 0;
  let delayScope = true;
  let passScopes = 0;
  await page.route(pattern, async route => {
    if (!delayScope || route.request().postDataJSON().projection?.kind !== "scope") return route.continue();
    if (passScopes > 0) { passScopes--; return route.continue(); }
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await new Promise<void>(unblock => { release.push(unblock); });
    try { await route.fulfill({ response }); } catch { /* navigation cancelled its request */ }
    finally { settled++; }
  });
  const original = row.getByRole("button", { name: "원본", exact: true });
  const equipmentTab = page.getByRole("tablist", { name: "대시보드 보기", exact: true }).getByRole("tab", { name: "설비", exact: true });
  const initialScreen = new URL(page.url()).searchParams.get("screen");
  // 설비 원본의 실제 목적지는 관리 모달이다. Task dialog만 검사하면 오작동을 놓친다.
  const assertNoEquipmentDestination = async () => {
    // 응답 전달 뒤 브라우저의 promise 처리와 React commit까지 관찰한다.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole("dialog", { name: "설비 수정", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(equipmentTab).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).searchParams.get("screen")).toBe(initialScreen);
  };
  await original.click();
  await expect.poll(() => release.length).toBe(1);
  await row.getByRole("button", { name: "상세", exact: true }).click();
  await expect(root.getByRole("region", { name: "계층 원본 상세", exact: true })).toBeVisible();
  release[0]();
  await expect.poll(() => settled).toBe(1);
  await assertNoEquipmentDestination();
  await expect(row).toHaveAttribute("aria-selected", "true");
  await expect(root.getByRole("region", { name: "계층 원본 상세", exact: true }).getByRole("heading")).toHaveText(f.equipment.name);
  await expect(root).toBeVisible();
  // 이미 열린 상세의 원본 명령도 이전 기준정보 탐색을 즉시 취소해야 한다.
  const detail = root.getByRole("region", { name: "계층 원본 상세", exact: true });
  const taskOriginal = detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true });
  await expect(taskOriginal).toBeVisible();
  await original.click();
  await expect.poll(() => release.length).toBe(2);
  await taskOriginal.click();
  await expect.poll(() => release.length).toBe(3);
  release[1]();
  await expect.poll(() => settled).toBe(2);
  await assertNoEquipmentDestination();
  await expect(detail).toBeVisible();
  release[2]();
  await expect.poll(() => settled).toBe(3);
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
  delayScope = false;
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(taskOriginal).toBeFocused();
  await assertNoEquipmentDestination();
  delayScope = true;
  // 반대 순서에서도 늦은 상세 원본이 최신 설비 원본 명령을 덮어쓰지 않는다.
  await taskOriginal.click();
  await expect.poll(() => release.length).toBe(4);
  await original.click();
  await expect.poll(() => release.length).toBe(5);
  release[3]();
  await expect.poll(() => settled).toBe(4);
  await assertNoEquipmentDestination();
  await expect(detail).toBeVisible();
  release[4]();
  await expect.poll(() => settled).toBe(5);
  const equipmentEditor = page.getByRole("dialog", { name: "설비 수정", exact: true });
  await expect(equipmentEditor).toBeVisible();
  await expect(equipmentEditor.getByLabel("설비명 *", { exact: true })).toHaveValue(f.equipment.name);
  await expect(editor).toHaveCount(0);
  delayScope = false;
  await equipmentEditor.getByRole("button", { name: "취소", exact: true }).click();
  await expect(equipmentEditor).toHaveCount(0);
  await expect(root).toBeVisible();
  await expect(detail).toBeVisible();
  delayScope = true;
  await root.getByRole("button", { name: "상세 닫기", exact: true }).click();
  await original.click();
  await expect.poll(() => release.length).toBe(6);
  await root.getByLabel("표의 이름 찾기", { exact: true }).fill("등록만 설비");
  await expect(row).toHaveCount(0);
  release[5]();
  await expect.poll(() => settled).toBe(6);
  await assertNoEquipmentDestination();
  await expect(root.getByRole("region", { name: "계층 원본 상세", exact: true })).toHaveCount(0);
  await expect(root.getByLabel("표의 이름 찾기", { exact: true })).toHaveValue("등록만 설비");
  // 상세 검증 뒤 host가 다시 확인하는 두 번째 scope에서도 같은 최신 의도를 지킨다.
  await root.getByLabel("표의 이름 찾기", { exact: true }).fill("");
  await row.getByRole("button", { name: "상세", exact: true }).click();
  await expect(taskOriginal).toBeVisible();
  passScopes = 1;
  await detail.getByRole("button", { name: "이 범위 일정 보기", exact: true }).click();
  await expect.poll(() => release.length).toBe(7);
  await root.getByLabel("표의 이름 찾기", { exact: true }).fill("등록만 설비");
  await expect(detail).toHaveCount(0);
  release[6]();
  await expect.poll(() => settled).toBe(7);
  await assertNoEquipmentDestination();
  await expect(page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "대시보드", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(root).toBeVisible();
  await expect(root.getByLabel("표의 이름 찾기", { exact: true })).toHaveValue("등록만 설비");
  await expect(page.getByRole("region", { name: "임시 조회 범위", exact: true })).toHaveCount(0);
  await page.unroute(pattern);
});

test("#730 실제 HTTP 다섯 고정 관점·수정 계층 두 구성·저장 복원·Gantt 보존", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedWbsViewComposer(page, origin, observeIsolatedApi);
  const baseline = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const originalGantt = await frame.locator(".wx-gantt").elementHandle();
  let mutations = 0;
  page.on("request", request => { if (request.url().includes(`/api/projects/${f.publicId}/`) && !["GET", "HEAD"].includes(request.method()) && !isWbsViewReadQuery(request)) mutations++; });
  for (const root of roots) {
    const response = nextReport(page);
    await openRoot(page, root);
    const data = (await (await response).json()).data as WbsViewReportDto;
    expect(data.spec).toMatchObject({ root, levels: [] });
    const source = await page.request.post(`${f.api}/resource-dashboard/views`, { headers: { Origin: origin }, data: { spec: data.spec, filters: data.filters } });
    expect(source.status()).toBe(200);
    expect((await source.json()).data.totals).toEqual(data.totals);
    await expect((await composer(dashboard(page))).getByRole("combobox", { name: "하위 축 1", exact: true })).toHaveCount(0);
  }
  await openRoot(page, "equipment");
  const config = await composer(dashboard(page));
  await config.getByRole("button", { name: "설비 → 공정 → 시스템 → Resource", exact: true }).click();
  await apply(page, ["process", "system", "resource"]);
  await config.getByRole("button", { name: "설비 → Milestone → 공정", exact: true }).click();
  await apply(page, ["milestone", "process"]);
  await config.getByRole("button", { name: "2번째 축 위로", exact: true }).click();
  await apply(page, ["process", "milestone"]);
  await page.reload();
  const restored = nextReport(page);
  await openRoot(page, "equipment");
  expect(((await (await restored).json()).data as WbsViewReportDto).spec.levels).toEqual(["process", "milestone"]);
  await expect((await composer(dashboard(page))).getByRole("combobox", { name: "하위 축 1", exact: true })).toHaveValue("process");
  // Reload starts a new Gantt; all subsequent in-page configuration/nav must retain it.
  const reloadedInstance = await frame.getAttribute("data-project-gantt-instance");
  const reloadedGantt = await frame.locator(".wx-gantt").elementHandle();
  await openRoot(page, "process");
  const processConfig = await composer(dashboard(page));
  await processConfig.getByRole("button", { name: "하위 축 추가", exact: true }).click();
  await processConfig.getByRole("combobox", { name: "하위 축 1", exact: true }).selectOption("siblings");
  const typed = await apply(page, [{ kind: "siblings", dimensions: ["equipment", "system"] }]);
  const processA = typed.children.find(node => node.selector.id === f.processIds[0])!;
  expect(processA.children.some(node => node.selector.dimension === "equipment" && node.selector.id === f.equipment.id)).toBe(true);
  expect(processA.children.some(node => node.selector.dimension === "system" && node.selector.id === f.system.id)).toBe(true);
  await dashboard(page).getByRole("button", { name: "A 공정 하위 펼치기", exact: true }).click();
  const table = dashboard(page).getByRole("table", { name: "공통 계층 결과", exact: true });
  await expect(table.getByRole("rowheader").filter({ hasText: f.equipment.name })).toBeVisible();
  await expect(table.getByRole("rowheader").filter({ hasText: f.system.name })).toBeVisible();
  await expect(table.locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`)).toHaveAttribute("data-depth", "1");
  await expect(table.locator(`tr[data-dimension="system"][data-entity-id="${f.system.id}"]`)).toHaveAttribute("data-depth", "1");
  const expandedProcess = dashboard(page).getByRole("button", { name: "A 공정 하위 접기", exact: true });
  await expect(expandedProcess).toHaveAttribute("aria-expanded", "true");
  await dashboard(page).getByLabel("표의 이름 찾기", { exact: true }).fill("A 공정");
  await expect(table.locator("button[aria-expanded]")).toHaveCount(0);
  await dashboard(page).getByLabel("표의 이름 찾기", { exact: true }).fill("");
  await expect(expandedProcess).toHaveAttribute("aria-expanded", "true");
  await expect(table.locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`)).toBeVisible();
  await openWorkspaceView(page, "schedule");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", reloadedInstance!);
  expect(await reloadedGantt!.evaluate(element => element.isConnected)).toBe(true);
  expect(instance).toBeTruthy(); expect(originalGantt).toBeTruthy();
  expect(mutations).toBe(0);
  expect((await f.snapshot()).data).toEqual(baseline.data);
  const secondProject = await page.request.post(`${origin}/api/projects`, { headers: { Origin: origin }, data: { name: "조회 설정 격리", ownerName: "E2E 자동화", description: "", editPassword: "EditPwd1234!" } });
  expect(secondProject.status()).toBe(201);
  const secondId = (await secondProject.json()).data.project.publicId as string;
  await page.goto(`${origin}/projects/${secondId}`);
  await openRoot(page, "equipment");
  await expect((await composer(dashboard(page))).getByRole("combobox", { name: "하위 축 1", exact: true })).toHaveCount(0);
  await expect(dashboard(page).getByText("현재 조건에 해당하는 결과가 없습니다.", { exact: true })).toBeVisible();
  await page.goto(`${origin}/projects/${f.publicId}`);
  await openRoot(page, "equipment");
  await expect((await composer(dashboard(page))).getByRole("combobox", { name: "하위 축 1", exact: true })).toHaveValue("process");
  await expect((await composer(dashboard(page))).getByRole("combobox", { name: "하위 축 2", exact: true })).toHaveValue("milestone");
  await info.attach("actual-http-acceptance", { body: JSON.stringify({ publicId: f.publicId, roots, projectRevision: baseline.data.project.revision, mutations, typedPaths: processA.children.map(node => node.path), reloadedInstance }), contentType: "application/json" });
});

test("#730 실제 HTTP 원본 Task·Assignment 복귀, 응답 역전·오류 차단·구버전 설정 복구", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedWbsViewComposer(page, origin, observeIsolatedApi);
  await openRoot(page, "equipment");
  const root = dashboard(page);
  const row = root.getByRole("row").filter({ hasText: f.equipment.name });
  const detailTrigger = row.getByRole("button", { name: "상세", exact: true });
  await detailTrigger.click();
  const detail = root.getByRole("region", { name: "계층 원본 상세", exact: true });
  const taskOriginal = detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true });
  await expect(taskOriginal).toBeVisible();
  await taskOriginal.click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue(f.task.name);
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(root).toBeVisible();
  await expect(taskOriginal).toBeFocused();
  await detail.getByRole("button", { name: "Assignment 보기", exact: true }).click();
  const assignmentOriginal = detail.getByRole("button", { name: `${f.resource.name} Assignment 원본`, exact: true });
  await expect(assignmentOriginal).toBeVisible();
  await assignmentOriginal.click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("tab", { name: /리소스/ })).toHaveAttribute("aria-selected", "true");
  await expect(editor.getByRole("status").filter({ hasText: "선택한 개인의 배정만 편집합니다." })).toContainText(`Assignment ID ${f.assignment.id} · Resource ID ${f.resource.id}`);
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(assignmentOriginal).toBeFocused();
  const scheduleTrigger = detail.getByRole("button", { name: "이 범위 일정 보기", exact: true });
  await scheduleTrigger.click();
  const scheduleTab = page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "일정", exact: true });
  await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
  const pattern = `**/api/projects/${f.publicId}/resource-dashboard/views`;
  let legacyValidation = 0;
  page.on("request", request => { if (/\/resource-dashboard\/(?:drill|details|scope)(?:\?|$)/.test(request.url())) legacyValidation++; });
  await page.route(pattern, route => route.request().postDataJSON().projection?.kind === "scope"
    ? route.fulfill({ status: 409, json: { error: { code: "STALE_SNAPSHOT", message: "일정 복귀 원본이 변경되었습니다." } } }) : route.continue());
  const back = page.getByRole("region", { name: "임시 조회 범위", exact: true }).getByRole("button", { name: /원래 보기/ });
  const rejectedReturn = page.waitForResponse(response => response.url().endsWith("/resource-dashboard/views") && response.status() === 409);
  await back.click();
  await rejectedReturn;
  await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
  await expect(back).toBeEnabled();
  expect(legacyValidation).toBe(0);
  await page.unroute(pattern);
  await back.click();
  await expect(root).toBeVisible();
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("button", { name: "Assignment 보기", exact: true })).toHaveAttribute("aria-pressed", "true");
  try { await expect(scheduleTrigger).toBeFocused(); }
  catch (error) {
    await captureFocus(page,"scope-return-focus-failure");
    throw error;
  }
  await detail.getByRole("heading").focus();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(detailTrigger).toBeFocused();
  await detailTrigger.click();
  await expect(detail).toBeVisible();
  const totalsBeforeNameSearch = await root.getByLabel("고유 총계", { exact: true }).innerText();
  await root.getByLabel("표의 이름 찾기", { exact: true }).fill("등록만 설비");
  await expect(detail).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await expect.poll(() => root.getByLabel("고유 총계", { exact: true }).innerText()).toBe(totalsBeforeNameSearch);
  await root.getByLabel("표의 이름 찾기", { exact: true }).fill("");

  // Fault injection is explicit; successful query responses remain real HTTP.
  let release!: () => void;
  const gate = new Promise<void>(resolveGate => { release = resolveGate; });
  let oldSeen = false, oldFinished = false;
  await page.route(pattern, async route => {
    const input = route.request().postDataJSON() as WbsViewQueryInput;
    if (input.filters?.taskSearch !== "통합") return route.continue();
    const response = await route.fetch(); oldSeen = true;
    await gate;
    try { await route.fulfill({ response }); } finally { oldFinished = true; }
  });
  await root.getByLabel("작업 검색", { exact: true }).fill("통합");
  await expect.poll(() => oldSeen).toBe(true);
  await root.getByLabel("작업 검색", { exact: true }).fill("미배정 작업");
  await expect(root).toHaveAttribute("data-ready", "true");
  release();
  await expect.poll(() => oldFinished).toBe(true);
  await expect(root.getByLabel("작업 검색", { exact: true })).toHaveValue("미배정 작업");
  await expect(root.getByLabel("고유 총계", { exact: true })).toContainText("Task1");
  await page.unroute(pattern);
  await page.route(pattern, route => route.fulfill({ status: 409, json: { error: { code: "STALE_SNAPSHOT", message: "원본 snapshot이 변경되었습니다." } } }));
  await root.getByRole("button", { name: "계층 새로고침", exact: true }).click();
  await expect(root).toHaveAttribute("data-ready", "false");
  await expect(root.getByRole("alert")).toContainText("원본 snapshot이 변경되었습니다.");
  await expect(root.getByRole("button", { name: "상세", exact: true }).first()).toBeDisabled();
  await page.unroute(pattern);
  await root.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(root).toHaveAttribute("data-ready", "true");
  await page.route(pattern, route => route.fulfill({ status: 503, json: { error: { code: "QUERY_UNAVAILABLE", message: "조회 서비스를 사용할 수 없습니다." } } }));
  await root.getByRole("button", { name: "계층 새로고침", exact: true }).click();
  await expect(root).toHaveAttribute("data-ready", "false");
  await expect(root.getByRole("alert")).toContainText("조회 서비스를 사용할 수 없습니다.");
  await page.unroute(pattern);
  await root.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(root).toHaveAttribute("data-ready", "true");
  await page.route(pattern, async route => {
    const response = await route.fetch();
    const envelope = await response.json();
    // Deliberately falsify only provenance; never accept this as a successful report.
    envelope.data.projectRevision++;
    await route.fulfill({ response, json: envelope });
  });
  await root.getByRole("button", { name: "계층 새로고침", exact: true }).click();
  await expect(root).toHaveAttribute("data-ready", "false");
  await expect(root.getByRole("alert")).toContainText("조회 응답의 출처가 일치하지 않습니다");
  await page.unroute(pattern);
  await root.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(root).toHaveAttribute("data-ready", "true");
  await page.evaluate(publicId => localStorage.setItem(`mastergantt:wbs-view:1:${publicId}:equipment`, JSON.stringify({ schema: "wbs-view-state/0", state: {} })), f.publicId);
  await page.reload();
  await openRoot(page, "equipment");
  await expect(root.getByRole("alert")).toContainText("저장된 조회 구성을 사용할 수 없습니다");
  await root.getByRole("button", { name: "저장된 조회 초기화", exact: true }).click();
  await expect(root.getByRole("alert")).toHaveCount(0);
  await expect(root.getByLabel("작업 검색", { exact: true })).toHaveValue("");
});

test("#730 실제 HTTP 긴 이름·동일 열 budget·5폭 내부 스크롤·키보드·읽기 전용 가상 그룹", async ({ page, browser, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedWbsViewComposer(page, origin, observeIsolatedApi);
  await openRoot(page, "equipment");
  const root = dashboard(page);
  await expect(root.getByRole("table", { name: "공통 계층 결과", exact: true }).getByRole("rowheader").filter({ hasText: "등록만 설비" })).toBeVisible();
  for (const width of [390, 768, 1024, 1440, 1920]) await geometry(page, root, width);
  const config = await composer(root);
  await config.getByRole("button", { name: "하위 축 추가", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(config.getByRole("combobox", { name: "하위 축 1", exact: true })).toBeVisible();
  await config.getByRole("combobox", { name: "하위 축 1", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(config.getByRole("button", { name: "1번째 축 삭제", exact: true })).toBeFocused();
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 1000 }, hasTouch: true });
  try {
    const readonly = await context.newPage();
    await readonly.goto(`/projects/${f.publicId}`);
    await openRoot(readonly, "resource");
    const virtual = dashboard(readonly).getByRole("row").filter({ hasText: "미배정" });
    await expect(virtual).toHaveCount(1);
    await expect(virtual.getByRole("button", { name: "원본", exact: true })).toHaveCount(0);
    await virtual.getByRole("button", { name: "상세", exact: true }).tap();
    await expect(dashboard(readonly).getByRole("region", { name: "계층 원본 상세", exact: true })).toBeVisible();
    expect(await context.cookies()).toEqual([]);
  } finally { await context.close(); }
});

test("#730 실제 HTTP Milestone·리소스·WorkArea 원본 ID와 취소 후 정확한 조회 복귀", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedWbsViewComposer(page, origin, observeIsolatedApi);
  const baseline = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const originalGantt = await frame.locator(".wx-gantt").elementHandle();
  let mutations = 0;
  page.on("request", request => { if (request.url().includes(`/api/projects/${f.publicId}/`) && !["GET", "HEAD"].includes(request.method()) && !isWbsViewReadQuery(request)) mutations++; });
  await openRoot(page, "milestone");
  let root = dashboard(page);
  const milestoneOriginal = root.locator(`tr[data-dimension="milestone"][data-entity-id="${f.milestone.taskId}"]`).getByRole("button", { name: "원본", exact: true });
  await milestoneOriginal.click();
  const taskEditor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(taskEditor.getByLabel("작업명", { exact: true })).toHaveValue(f.milestone.name);
  await page.keyboard.press("Escape");
  await expect(taskEditor).toHaveCount(0);
  await expect(milestoneOriginal).toBeFocused();
  await openRoot(page, "resource");
  root = dashboard(page);
  const resourceOriginal = root.locator(`tr[data-dimension="resource"][data-entity-id="${f.resource.id}"]`).getByRole("button", { name: "원본", exact: true });
  await resourceOriginal.click();
  const resourceDialog = page.getByRole("dialog", { name: `${f.resource.name} 작업 배정`, exact: true });
  await expect(resourceDialog).toBeVisible();
  await expect(resourceDialog.locator(`tr[data-canonical-resource-id="${f.resource.id}"]`)).toContainText("R730");
  await expect(resourceDialog).toContainText("개발자");
  await resourceDialog.getByRole("button", { name: `${f.resource.name} 작업 배정 닫기`, exact: true }).click();
  await expect(resourceDialog).toHaveCount(0);
  await expect(root).toBeVisible();
  await expect.soft(resourceOriginal).toBeFocused();
  if (!await resourceOriginal.evaluate(element=>element===document.activeElement)) await captureFocus(page,"resource-original-return-focus-failure");
  await openRoot(page, "equipment");
  root = dashboard(page);
  const config = await composer(root);
  await config.getByRole("button", { name: "하위 축 추가", exact: true }).click();
  await config.getByRole("combobox", { name: "하위 축 1", exact: true }).selectOption("workArea");
  await apply(page, ["workArea"]);
  await root.getByRole("button", { name: `${f.equipment.name} 하위 펼치기`, exact: true }).click();
  const workAreaOriginal = root.locator(`tr[data-dimension="workArea"][data-entity-id="${f.workArea.id}"]`).getByRole("button", { name: "원본", exact: true });
  await workAreaOriginal.click();
  const areaEditor = page.getByRole("dialog", { name: "작업 구역 수정", exact: true });
  await expect(areaEditor).toBeVisible();
  await expect(areaEditor.locator("form")).toHaveAttribute("data-canonical-catalog-id", f.workArea.id);
  await expect(areaEditor.locator("form")).toHaveAttribute("data-catalog-kind", "workAreas");
  await expect(areaEditor.getByLabel("코드", { exact: true })).toHaveValue(f.workArea.code);
  await expect(areaEditor.getByLabel("이름", { exact: true })).toHaveValue(f.workArea.name);
  await expect(areaEditor.getByRole("combobox", { name: "소유 현장 공정", exact: true })).toHaveValue(f.workArea.occurrenceId);
  await areaEditor.getByRole("button", { name: "취소", exact: true }).click();
  await expect(areaEditor).toHaveCount(0);
  await expect(root).toBeVisible();
  await expect(workAreaOriginal).toBeFocused();
  // 정상 조회의 busy 전환은 사용자의 이동 의도를 자체 취소하지 않는다.
  for (const [view, dimension, id] of [["resource", "resource", f.resource.id], ["milestone", "milestone", f.milestone.taskId]] as const) {
    await openRoot(page, view);
    const source = dashboard(page);
    const selected = source.locator(`tr[data-dimension="${dimension}"][data-entity-id="${id}"]`);
    await selected.getByRole("button", { name: "상세", exact: true }).click();
    const detail = source.getByRole("region", { name: "계층 원본 상세", exact: true });
    await expect(detail.locator(`[data-canonical-task-id="${f.task.taskId}"]`)).toBeVisible();
    const schedule = detail.getByRole("button", { name: "이 범위 일정 보기", exact: true });
    const selectedKey = await selected.getAttribute("data-view-row-key");
    await schedule.click();
    await expect(page.getByRole("tablist", { name: "프로젝트 작업공간", exact: true }).getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("region", { name: "임시 조회 범위", exact: true }).getByRole("button", { name: /원래 보기/ }).click();
    await expect(source).toBeVisible();
    await expect(selected).toHaveAttribute("aria-selected", "true");
    await expect(selected).toHaveAttribute("data-view-row-key", selectedKey!);
    await expect(detail.getByRole("button", { name: "Task 보기", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(detail.locator(`[data-canonical-task-id="${f.task.taskId}"]`)).toBeVisible();
    await expect(schedule).toBeFocused();
    await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
    expect(await originalGantt!.evaluate(element => element.isConnected)).toBe(true);
  }
  expect(mutations).toBe(0);
  expect((await f.snapshot()).data).toEqual(baseline.data);
});

test("#730 실제 원본 Task 저장 후 revision·snapshot 갱신과 선택 관점 보존", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  const f = await seedWbsViewComposer(page, origin, observeIsolatedApi);
  const baseline = await f.snapshot();
  const firstReport = nextReport(page);
  await openRoot(page, "equipment");
  const beforeReport = (await (await firstReport).json()).data as WbsViewReportDto;
  const root = dashboard(page);
  const selectedRow = root.locator(`tr[data-dimension="equipment"][data-entity-id="${f.equipment.id}"]`);
  await selectedRow.getByRole("button", { name: "상세", exact: true }).click();
  const detail = root.getByRole("region", { name: "계층 원본 상세", exact: true });
  await detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  const renamed = "원본 저장 후 통합 시운전";
  await editor.getByLabel("작업명", { exact: true }).fill(renamed);
  let releaseReport!: () => void;
  const reportGate = new Promise<void>(resolveGate => { releaseReport = resolveGate; });
  let reportHeld = false;
  const pattern = `**/api/projects/${f.publicId}/resource-dashboard/views`;
  await page.route(pattern, async route => {
    if (route.request().postDataJSON().projection?.kind !== "report") return route.continue();
    const response = await route.fetch(); reportHeld = true;
    await reportGate;
    await route.fulfill({ response });
  });
  const mutation = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/projects/${f.publicId}/tasks/${f.task.taskId}`);
  const refreshed = nextReport(page);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  const write = await mutation;
  expect(write.status(), await write.text()).toBe(200);
  await expect(editor).toHaveCount(0);
  await expect.poll(() => reportHeld).toBe(true);
  await expect(root).toHaveAttribute("data-ready", "false");
  await expect(detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true })).not.toBeVisible();
  // Successful receipt waiting must survive both former 24/120-frame windows.
  await page.evaluate(async () => { for (let frame = 0; frame < 160; frame++) await new Promise<void>(resolveFrame => requestAnimationFrame(() => resolveFrame())); });
  releaseReport();
  const afterReport = (await (await refreshed).json()).data as WbsViewReportDto;
  await page.unroute(pattern);
  await expect(root).toHaveAttribute("data-ready", "true");
  expect(afterReport.projectRevision).toBe(baseline.data.project.revision + 1);
  expect(afterReport.snapshotId).not.toBe(beforeReport.snapshotId);
  expect(afterReport.spec).toEqual(beforeReport.spec);
  await expect(page.getByRole("tablist", { name: "대시보드 보기", exact: true }).getByRole("tab", { name: "설비", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(selectedRow).toHaveAttribute("aria-selected", "true");
  await expect(detail.getByRole("button", { name: `${f.task.name} Task 원본`, exact: true })).toHaveCount(0);
  const restoredTaskOriginal = detail.getByRole("button", { name: `${renamed} Task 원본`, exact: true });
  await expect(restoredTaskOriginal).toBeVisible();
  try { await expect(restoredTaskOriginal).toBeFocused(); }
  catch (error) { await captureFocus(page,"saved-task-original-focus-failure"); throw error; }
  const saved = await f.snapshot();
  const original = baseline.data.tasks.find(task => task.taskId === f.task.taskId)!;
  const current = saved.data.tasks.find(task => task.taskId === f.task.taskId)!;
  expect(current).toMatchObject({ ...original, name: renamed });
  expect(saved.data.tasks.map(task => task.taskId)).toEqual(baseline.data.tasks.map(task => task.taskId));
  await info.attach("actual-source-save-snapshot", { body: JSON.stringify({ publicId: f.publicId, taskId: f.task.taskId, beforeRevision: beforeReport.projectRevision, afterRevision: afterReport.projectRevision, beforeSnapshotId: beforeReport.snapshotId, afterSnapshotId: afterReport.snapshotId }), contentType: "application/json" });
});
