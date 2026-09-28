import { expect, test, type Page } from "@playwright/test";
import { deferred, installStatefulProjectFixture, publicId } from "../fixtures/stateful-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";

const path = `/api/projects/${publicId}`;
async function openTask(page: Page, name = "Stable leaf") {
  await page.locator(".project-gantt-widget .wx-row", { hasText: name }).first().click({ button: "right" });
  await chooseTaskInformation(page);
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await dialog.getByRole("tab", { name: /물류 연결/ }).click();
  return dialog;
}
function logistics() {
  return { processes: [], equipment: [{ id: "eq-1", processId: "proc-1", code: "EQ-01", name: "기존 연결 설비", equipmentType: "stocker", managementUnit: "unit", quantity: 1, manufacturer: "", model: "", description: "", active: true, controlSystems: [], resourceRoles: [{ resourceId: "res-1", resourceCode: "ENG-01", resourceName: "기존 담당자", role: "owner", isPrimary: true, active: true }], createdAt: "", updatedAt: "" }], systems: [], systemLinks: [] } as const;
}
function links(taskId: string) {
  return { data: { taskId, permission: "edit", links: { taskId, directEquipmentLinks: [{ equipmentId: "eq-1", scope: "self" }], inheritedEquipmentLinks: [], effectiveEquipmentIds: ["eq-1"], directSystemLinks: [], inheritedSystemLinks: [], effectiveSystemIds: [] } } };
}

for (const failure of ["500", "network", "malformed", "wrong-task", "wrong-revision", "malformed-role"] as const) {
  test(`조회 ${failure}에서 빈 PUT을 막고 재시도로 기존 연결을 복원한다`, async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.logistics = JSON.parse(JSON.stringify(logistics()));
    let fail = true;
    let mutations = 0;
    let payload: unknown;
    let match: string | undefined;
    await page.route(`**${path}/tasks/*/logistics-links`, async (route) => {
      const req = route.request();
      if (req.method() === "PUT") {
        mutations++; payload = req.postDataJSON(); match = req.headers()["if-match"];
        await route.fulfill({ status: 500, json: {} }); return;
      }
      const taskId = new URL(req.url()).pathname.split("/").at(-2)!;
      if (fail && failure === "network") { await route.abort(); return; }
      await route.fulfill(fail && failure === "500" ? { status: 500, json: {} } : { json: fail && failure === "malformed" ? { data: { links: { directEquipmentLinks: [null] } } } : links(fail && failure === "wrong-task" ? "other-task" : taskId) });
    });
    await page.route(`**${path}/logistics`, (route) => route.fulfill({ json: { data: { project: { ...fixture.project, revision: fail && failure === "wrong-revision" ? 1 : fixture.project.revision }, logistics: fail && failure === "malformed-role" ? { ...fixture.logistics, equipment: [{ ...fixture.logistics!.equipment[0], resourceRoles: [null] }] } : fixture.logistics } } }));
    await page.goto(`/projects/${publicId}`);
    const dialog = await openTask(page);
    await expect(dialog.getByRole("alert")).toContainText("불러오지 못했습니다");
    const save = dialog.getByRole("button", { name: "물류 연결 저장", exact: true });
    await expect(save).toBeDisabled();
    await save.evaluate((button: HTMLButtonElement) => { button.disabled = false; button.click(); });
    expect(mutations).toBe(0);
    await expect(dialog.getByText("등록된 설비가 없습니다.")).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/issue-263/task-links-error-${failure}.png` });
    fail = false;
    await dialog.getByRole("button", { name: "물류 연결 다시 시도" }).click();
    const selected = dialog.getByRole("checkbox", { name: /기존 연결 설비/ });
    await expect(selected).toBeChecked();
    await expect(save).toBeEnabled();
    await save.click();
    await expect.poll(() => mutations).toBe(1);
    expect(payload).toEqual({ equipmentLinks: [{ equipmentId: "eq-1", scope: "self" }], systemLinks: [] });
    expect(match).toBe('"40"');
  });
}

test("이전 작업의 지연 응답은 새 작업의 실패 상태와 저장 차단을 바꾸지 않는다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.logistics = JSON.parse(JSON.stringify(logistics()));
  const gate = deferred();
  const started = deferred();
  let first = true;
  let mutations = 0;
  await page.route(`**${path}/tasks/*/logistics-links`, async (route) => {
    if (route.request().method() === "PUT") { mutations++; await route.fulfill({ json: {} }); return; }
    const taskId = new URL(route.request().url()).pathname.split("/").at(-2)!;
    if (first) { first = false; started.resolve(); await gate.promise; await route.fulfill({ json: links(taskId) }).catch(() => {}); }
    else await route.fulfill({ status: 500, json: {} });
  });
  await page.goto(`/projects/${publicId}`);
  let dialog = await openTask(page);
  await started.promise;
  await expect(dialog.getByText("물류 연결 정보를 불러오는 중…")).toBeVisible();
  await page.keyboard.press("Escape");
  dialog = await openTask(page, "Stable summary");
  await expect(dialog.getByRole("alert")).toContainText("불러오지 못했습니다");
  gate.resolve();
  await expect(dialog.getByRole("button", { name: "물류 연결 저장", exact: true })).toBeDisabled();
  expect(mutations).toBe(0);
});

test("할당 조회 실패는 저장을 막고 재시도로 정상 빈 목록을 구분한다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  let fail = true;
  let mutations = 0;
  await page.route(`**${path}/assigned-targets`, (route) => route.fulfill(fail ? { status: 500, json: {} } : { json: { data: { projectRevision: 40, catalogRevision: 1, assignments: [], targets: [] } } }));
  await page.route(`**${path}/assignment-targets`, (route) => route.fulfill({ json: { data: { catalogRevision: 1, targets: [] } } }));
  page.on("request", (request) => { if (request.url().endsWith("/assignments") && request.method() === "PUT") mutations++; });
  await page.goto(`/projects/${publicId}`);
  const dialog = await openTask(page);
  await dialog.getByRole("tab", { name: /리소스/ }).click();
  await expect(dialog.getByRole("button", { name: /할당 저장/ })).toBeDisabled();
  await expect(dialog.getByText("등록된 할당 대상이 없습니다.")).toHaveCount(0);
  fail = false;
  await dialog.getByRole("button", { name: "할당 정보 다시 시도" }).click();
  await expect(dialog.getByText("등록된 할당 대상이 없습니다.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /할당 저장/ })).toBeEnabled();
  expect(mutations).toBe(0);
});

for (const width of [390, 768, 1024, 1440]) {
  test(`담당자 후보 실패에서 canonical 이름과 재시도/저장 차단 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await installStatefulProjectFixture(page);
    fixture.logistics = JSON.parse(JSON.stringify(logistics()));
    let fail = true;
    let mutations = 0;
    await page.route("**/api/resources", (route) => route.fulfill(fail ? { status: 500, json: {} } : { json: { data: { resources: [{ id: "res-1", name: "기존 담당자", code: "ENG-01", active: true }] } } }));
    page.on("request", (request) => { if (request.url().endsWith("/resource-roles") && request.method() === "PUT") mutations++; });
    await page.goto(`/projects/${publicId}`);
    await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
    await page.getByRole("tab", { name: /^설비 관리/ }).click();
    await page.getByRole("button", { name: "담당자", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /설비 담당자 배정/ });
    await expect(dialog.getByRole("alert")).toContainText("불러오지 못했습니다");
    await expect(dialog.getByText("기존 담당자 (ENG-01)", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("combobox").first()).toBeDisabled();
    expect(mutations).toBe(0);
    await page.screenshot({ path: `output/playwright/issue-263/catalog-error-${width}.png` });
    fail = false;
    await dialog.getByRole("button", { name: "리소스 목록 다시 시도" }).click();
    await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
    await expect(dialog.getByRole("combobox").first()).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(mutations).toBe(0);
  });
}

test("비어 있지 않은 AssignmentTargetRefDto를 복원하여 투입률과 If-Match를 보존한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  const taskId = fixture.tasks[2].taskId;
  const target = { kind: "resource", id: "res-1", name: "담당 리소스", code: "RES-01", active: true };
  let payload: unknown;
  let match: string | undefined;
  await page.route(`**${path}/assigned-targets`, (route) => route.fulfill({ json: { data: { projectRevision: 40, catalogRevision: 5, assignments: [{ id: "a-1", taskId, target: { kind: "resource", id: "res-1" }, allocation: { start: null, end: null, percent: 50 } }], targets: [target] } } }));
  await page.route(`**${path}/assignment-targets`, (route) => route.fulfill({ json: { data: { catalogRevision: 5, targets: [target] } } }));
  await page.route(`**${path}/tasks/*/assignments`, (route) => { payload = route.request().postDataJSON(); match = route.request().headers()["if-match"]; return route.fulfill({ status: 500, json: {} }); });
  await page.goto(`/projects/${publicId}`);
  const dialog = await openTask(page);
  await dialog.getByRole("tab", { name: /리소스/ }).click();
  await expect(dialog.getByRole("checkbox", { name: /담당 리소스/ })).toBeChecked();
  await expect(dialog.getByRole("spinbutton", { name: /투입률/ })).toHaveValue("50");
  await dialog.getByRole("button", { name: /할당 저장/ }).click();
  await expect.poll(() => payload).toEqual({ catalogRevision: 5, targets: [{ kind: "resource", id: "res-1", allocation: { start: null, end: null, percent: 50 } }] });
  expect(match).toBe('"40"');
});

test("Readonly 연결 조회 성공에서도 선택과 mutation을 허용하지 않는다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.sessionEditable = false;
  fixture.logistics = JSON.parse(JSON.stringify(logistics()));
  let mutations = 0;
  page.on("request", (request) => { if (request.method() === "PUT") mutations++; });
  await page.route(`**${path}/tasks/*/logistics-links`, (route) => route.fulfill({ json: links(new URL(route.request().url()).pathname.split("/").at(-2)!) }));
  await page.goto(`/projects/${publicId}`);
  const dialog = await openTask(page);
  await expect(dialog.getByRole("checkbox", { name: /기존 연결 설비/ })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: /기존 연결 설비/ })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "물류 연결 저장", exact: true })).toHaveCount(0);
  expect(mutations).toBe(0);
});

test("재조회 실패 시 이전 catalog cache보다 canonical 담당자 이름을 우선한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.logistics = JSON.parse(JSON.stringify(logistics()));
  let fail = false;
  await page.route("**/api/resources", (route) =>
    route.fulfill(
      fail
        ? { status: 500, json: {} }
        : { json: { data: { resources: [{ id: "res-1", name: "이전 캐시 이름", code: "OLD-01", active: true }] } } },
    ),
  );
  await page.goto(`/projects/${publicId}`);
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: /^설비 관리/ }).click();
  await page.getByRole("button", { name: "담당자", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: /설비 담당자 배정/ });
  await expect(dialog.getByText("이전 캐시 이름 (OLD-01)", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  fail = true;
  await page.getByRole("button", { name: "담당자", exact: true }).click();
  dialog = page.getByRole("dialog", { name: /설비 담당자 배정/ });
  await expect(dialog.getByRole("alert")).toContainText("불러오지 못했습니다");
  await expect(dialog.getByText("기존 담당자 (ENG-01)", { exact: true })).toBeVisible();
  await expect(dialog.getByText("이전 캐시 이름 (OLD-01)", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
});

test("시스템 PI의 malformed 후보에서도 canonical 이름과 저장 차단을 유지한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.logistics = { processes: [], equipment: [], systemLinks: [], systems: [{ id: "sys-1", code: "MCS", name: "조율 시스템", systemType: "mcs", layer: "coordinator", scope: "project", processIds: [], coordinatedSystemIds: [], vendor: "", description: "", active: true, createdAt: "", updatedAt: "", resourceRoles: [{ resourceId: "res-1", resourceCode: "PI-01", resourceName: "기존 PI", role: "pi", isPrimary: true, active: true }] }] };
  let fail = true;
  await page.route("**/api/resources", (route) => route.fulfill({ json: { data: { resources: fail ? [null] : [] } } }));
  await page.goto(`/projects/${publicId}`);
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: /^물류 시스템/ }).click();
  await page.getByRole("button", { name: "PI/개발자", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /시스템 PI/ });
  await expect(dialog.getByText("기존 PI (PI-01)", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("불러오지 못했습니다");
  fail = false;
  await dialog.getByRole("button", { name: "리소스 목록 다시 시도" }).click();
  await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
});
