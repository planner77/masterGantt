import { expect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
import type { TaskMutationResponse } from "../../src/contracts/projects";
import { installMilestoneDashboardFixture, openMilestoneEditor } from "./helpers/milestone-ui";
import {
  expectSameGanttRoot,
  ganttRoot,
  installStatefulProjectFixture,
  publicId,
  rememberGanttRoot,
  rowNamed,
  taskPath,
  type StatefulProjectFixture,
} from "../fixtures/stateful-project";

const id = (ordinal: number) => `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;
const nameCell = (page: Page, name: string) => rowNamed(page, name).locator('[role="gridcell"][data-col-id=":text"]');
const inlineInput = (page: Page) => ganttRoot(page).locator(".wx-table-container .wx-cell.wx-editor input.wx-text");

function barContentBox(bar: Locator) {
  return bar.evaluate((element) => {
    const chart = element.closest<HTMLElement>('.wx-chart[tabindex="-1"]');
    if (!chart) throw new Error("Gantt chart scrollport is missing");
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x - chart.getBoundingClientRect().x + chart.scrollLeft, width: bounds.width };
  });
}

async function openName(page: Page, name: string) {
  const cell = nameCell(page, name);
  const rowId = await cell.locator("..").getAttribute("data-id");
  expect(rowId).not.toBeNull();
  await cell.locator(".wx-content > .wx-text").click();
  const input = ganttRoot(page).locator(`.wx-table-container .wx-row[data-id="${rowId}"] .wx-cell.wx-editor input.wx-text`);
  await expect(input).toBeFocused();
  return input;
}

async function openNameWithF2(page: Page, name: string, ordinal: number) {
  // A real Grid click synchronizes Core's focusCell. DOM .focus() alone does
  // not update that state, so F2 could otherwise edit the previously selected row.
  const opened = await openName(page, name);
  await opened.press("Escape");
  const cell = nameCell(page, name);
  await expect(cell).toBeFocused();
  await cell.press("F2");
  const input = ganttRoot(page).locator(`.wx-table-container .wx-row[data-id=":${id(ordinal)}"] .wx-cell.wx-editor input.wx-text`);
  await expect(input).toBeFocused();
  return input;
}

async function routeRenames(page: Page, fixture: StatefulProjectFixture) {
  const patches: Request[] = [];
  let failure: 401 | 409 | 412 | 500 | "network" | null = null;
  let pendingGate: Promise<void> | null = null;
  const handler = async (route: Route) => {
    const request = route.request();
    if (request.method() !== "PATCH") { await route.continue(); return; }
    patches.push(request);
    const gate = pendingGate;
    pendingGate = null;
    if (gate) await gate;
    if (failure === "network") { failure = null; await route.abort("failed"); return; }
    if (failure !== null) {
      const status = failure; failure = null;
      await route.fulfill({ status, json: { error: { code: status === 412 ? "REVISION_MISMATCH" : status === 401 ? "UNAUTHORIZED" : status === 409 ? "UNSUPPORTED_SCHEDULE_STRUCTURE" : "INTERNAL_ERROR", message: "Rejected by inline-name fixture." } } });
      return;
    }
    expect(request.headers()["if-match"]).toBe(`"${fixture.project.revision}"`);
    const taskId = new URL(request.url()).pathname.split("/").at(-1);
    const task = fixture.tasks.find((entry) => entry.taskId === taskId);
    expect(task).toBeTruthy();
    const body = request.postDataJSON() as { name?: string };
    expect(Object.keys(body)).toEqual(["name"]);
    task!.name = body.name!;
    fixture.project.revision += 1;
    const response: TaskMutationResponse = { data: {
      project: { ...fixture.project }, tasks: fixture.tasks.map((entry) => ({ ...entry })),
      links: fixture.links.map((entry) => ({ ...entry })), warnings: [],
      operation: { kind: "taskUpdate", changedTaskExternalIds: [task!.externalId], deletedTaskExternalIds: [], deletedLinkIds: [] },
    } };
    await route.fulfill({ json: response });
  };
  await page.route(`**${taskPath}/*`, handler);
  return { patches, failOnce: (next: typeof failure) => { failure = next; },
    pauseNext: () => {
      let release = () => {};
      pendingGate = new Promise<void>(resolve => { release = resolve; });
      return release;
    },
  };
}

for (const key of ["Tab", "Shift+Tab"] as const) {
  test(`#572 실제 ${key} 저장은 단일 PATCH와 늦은 성공 뒤 도착 focus를 유지한다`, async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    const route = await routeRenames(page, fixture);
    await page.goto(`/projects/${publicId}`);
    const input = await openName(page, "Stable leaf");
    const release = route.pauseNext();
    try {
      await input.fill(`Saved with ${key}`);
      await input.press(key);
      await expect.poll(() => route.patches.length).toBe(1);
      await expect(page.locator('.project-gantt-inline-name-status')).toHaveText("작업명을 저장하는 중…");
      const arrived = await page.evaluateHandle(() => document.activeElement);
      expect(await arrived.evaluate(element => element !== document.body && element instanceof HTMLElement)).toBe(true);
      release();
      await expect(nameCell(page, `Saved with ${key}`)).toBeVisible();
      await expect(page.locator('.project-gantt-inline-name-status')).toHaveText("작업명을 저장했습니다.");
      expect(await arrived.evaluate(element => document.activeElement === element)).toBe(true);
      expect(route.patches).toHaveLength(1);
    } finally { release(); }
  });
}

test("#572 pointer blur의 늦은 응답은 toolbar focus와 서버 확정 이름을 유지한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  const route = await routeRenames(page, fixture);
  await page.goto(`/projects/${publicId}`);
  const beforeRevision = fixture.project.revision;
  const input = await openName(page, "Stable leaf");
  const release = route.pauseNext();
  try {
    await input.fill("Delayed canonical name");
    const week = page.getByRole("button", { name: "주", exact: true });
    await week.click();
    await expect.poll(() => route.patches.length).toBe(1);
    await expect(week).toBeFocused();
    await expect(page.locator('.project-gantt-inline-name-status')).toHaveText("작업명을 저장하는 중…");
    release();
    await expect(nameCell(page, "Delayed canonical name")).toBeVisible();
    await expect(page.locator('.project-gantt-inline-name-status')).toHaveText("작업명을 저장했습니다.");
    await expect(week).toBeFocused();
    expect(fixture.project.revision).toBe(beforeRevision + 1);
    expect(route.patches).toHaveLength(1);
    await page.reload();
    await expect(nameCell(page, "Delayed canonical name")).toBeVisible();
  } finally { release(); }
});

for (const [tab, visibilityAttribute] of [
  ["resources", "hidden"],
  ["milestones", "inert"],
] as const) {
  test(`#572 ${tab} 탭에 숨겨진 동안 저장된 이름은 일정 복귀 때 확인된다`, async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    const route = await routeRenames(page, fixture);
    await page.goto(`/projects/${publicId}`);
    const rootIdentity = await rememberGanttRoot(page);
    const input = await openName(page, "Stable leaf");
    const release = route.pauseNext();
    try {
      const name = `Saved while ${tab} hidden`;
      await input.fill(name);
      await page.locator(`#project-tab-${tab}`).click();
      await expect.poll(() => route.patches.length).toBe(1);
      const schedulePanel = page.locator("#project-panel-schedule");
      await expect(schedulePanel).toHaveAttribute(visibilityAttribute, "");
      release();
      await expect.poll(() => fixture.project.revision).toBe(fixture.initialRevision + 1);
      // Allow the finite two-second verification to expire while the Gantt is
      // hidden/inert. Returning to the schedule must trigger a new check.
      const status = page.locator(".project-gantt-inline-name-status");
      await expect(status).toContainText("해당 행이 표시되면", { timeout: 7000 });
      await page.locator("#project-tab-schedule").click();
      await expect(schedulePanel).not.toHaveAttribute(visibilityAttribute, "");
      await expect(nameCell(page, name)).toBeVisible();
      await expect(status).toHaveText("작업명을 저장했습니다.");
      await expectSameGanttRoot(page, rootIdentity);
      expect(route.patches).toHaveLength(1);
    } finally { release(); }
  });
}

test("#572 실패한 이름 초안은 같은 작업을 명시적으로 다시 열 때 복원된다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  let patches = 0;
  await page.route(`**${taskPath}/*`, async route => {
    if (route.request().method() !== "PATCH") return route.continue();
    patches += 1;
    await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "Rejected rename" } } });
  });
  await page.goto(`/projects/${publicId}`);
  const input = await openName(page, "Stable leaf");
  await input.fill("보존할 이름 초안");
  await input.press("Enter");
  await expect(ganttRoot(page).getByRole("alert")).toBeVisible();
  await expect(nameCell(page, "Stable leaf")).toBeVisible();
  expect(patches).toBe(1);
  const reopened = await openName(page, "Stable leaf");
  await expect(reopened).toHaveValue("보존할 이름 초안");
  expect(patches).toBe(1);
  await reopened.press("Escape");
});

test("#572 412 뒤 명시 재조회는 보존 초안을 새 Revision으로 자동 승인하지 않는다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  const route = await routeRenames(page, fixture);
  await page.goto(`/projects/${publicId}`);
  route.failOnce(412);
  const input = await openName(page, "Stable leaf");
  await input.fill("충돌한 원문 초안");
  await input.press("Enter");
  await expect(ganttRoot(page).getByRole("alert")).toBeVisible();
  expect(route.patches).toHaveLength(1);
  fixture.tasks[2].name = "Other canonical name";
  fixture.project.revision += 1;
  await nameCell(page, "Stable leaf").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await dialog.getByRole("button", { name: "최신 정보 다시 불러오기" }).click();
  await expect(dialog.getByRole("textbox", { name: "작업명", exact: true })).toHaveValue("Other canonical name");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  const preserved = await openName(page, "Other canonical name");
  await expect(preserved).toHaveValue("충돌한 원문 초안");
  await preserved.press("Enter");
  await expect(preserved).toHaveAttribute("aria-invalid", "true");
  await expect(ganttRoot(page).getByRole("alert")).toContainText("기준 Revision");
  expect(route.patches).toHaveLength(1);
  await preserved.press("Escape");
  const fresh = await openName(page, "Other canonical name");
  await expect(fresh).toHaveValue("Other canonical name");
  await fresh.fill("Reviewed fresh name");
  await fresh.press("Enter");
  await expect(nameCell(page, "Reviewed fresh name")).toBeVisible();
  await expect(page.locator('.project-gantt-inline-name-status')).toHaveText("작업명을 저장했습니다.");
  expect(route.patches).toHaveLength(2);
});

test("#572 합성 composition blur는 Core clickOutside에서도 PATCH 없이 원문을 유지한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  const route = await routeRenames(page, fixture);
  await page.goto(`/projects/${publicId}`);
  const input = await openName(page, "Stable leaf");
  await input.fill("조합 중 원문");
  await input.dispatchEvent("compositionstart");
  await page.getByRole("button", { name: "주", exact: true }).click();
  await expect(inlineInput(page)).toHaveValue("조합 중 원문");
  expect(route.patches).toHaveLength(0);
  await inlineInput(page).dispatchEvent("compositionend");
  await inlineInput(page).press("Escape");
  await expect(inlineInput(page)).toHaveCount(0);
  expect(route.patches).toHaveLength(0);
});

test("#572 저장 중 가상화로 사라진 행은 다시 마운트된 실제 이름으로 완료를 확인한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  for (let ordinal = 5; ordinal <= 65; ordinal += 1) {
    fixture.tasks.push({ ...fixture.tasks[2], taskId: id(ordinal), externalId: `LONG-${ordinal}`, name: `Long row ${ordinal}`, siblingOrder: ordinal });
  }
  const route = await routeRenames(page, fixture);
  await page.goto(`/projects/${publicId}`);
  const input = await openName(page, "Stable leaf");
  const release = route.pauseNext();
  try {
    await input.fill("Virtualized confirmed name");
    await input.press("Enter");
    await expect.poll(() => route.patches.length).toBe(1);
    const chart = ganttRoot(page).locator(".wx-chart").first();
    await chart.hover();
    await page.mouse.wheel(0, 1800);
    await expect(ganttRoot(page).locator(`.wx-table-container .wx-row[data-id=":${id(3)}"]`)).toHaveCount(0);
    release();
    await expect.poll(() => fixture.project.revision).toBe(fixture.initialRevision + 1);
    await expect(page.locator('.project-gantt-inline-name-status')).toContainText("해당 행이 표시되면");
    await expect(page.locator('.project-gantt-inline-name-status')).not.toHaveText("작업명을 저장했습니다.");
    await chart.hover();
    await page.mouse.wheel(0, -2400);
    await expect(nameCell(page, "Virtualized confirmed name")).toBeVisible();
    await expect(page.locator('.project-gantt-inline-name-status')).toHaveText("작업명을 저장했습니다.");
    expect(route.patches).toHaveLength(1);
  } finally { release(); }
});

test("single-click names use one canonical PATCH across Summary, Task and Milestone", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await installMilestoneDashboardFixture(page, fixture);
  fixture.tasks[2].url = "https://example.invalid/leaf";
  const route = await routeRenames(page, fixture);
  await page.addInitScript(() => {
    const tracked = window as typeof window & { __openedTaskUrls?: string[] };
    tracked.__openedTaskUrls = [];
    window.open = ((url?: string | URL) => { tracked.__openedTaskUrls!.push(String(url)); return null; }) as typeof window.open;
  });
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  await expect.poll(() => rowNamed(page, "Stable leaf").getAttribute("data-task-url")).toBe("https://example.invalid/leaf");
  const summaryToggleClass = await nameCell(page, "Stable summary").locator('[data-action="open-task"]').getAttribute("class");
  const leafBar = ganttRoot(page).locator(`.wx-bar[data-task-id=":${id(3)}"]`);
  const leafBarBefore = await barContentBox(leafBar);

  for (const [before, after] of [["Stable summary", "Renamed summary"], ["Stable leaf", "001"]] as const) {
    const input = await openName(page, before);
    await input.fill(`  ${after}  `);
    const beforeCount = route.patches.length;
    await input.press("Enter");
    await expect.poll(() => route.patches.length).toBe(beforeCount + 1);
    await expect(nameCell(page, after)).toBeVisible();
    await expectSameGanttRoot(page, identity);
  }
  const milestoneEditor = await openMilestoneEditor(page, id(4));
  await milestoneEditor.getByLabel("작업명", { exact: true }).fill("Renamed milestone");
  await milestoneEditor.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => fixture.tasks[3].name).toBe("Renamed milestone");
  await milestoneEditor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(milestoneEditor).toHaveCount(0);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(nameCell(page, "Renamed milestone")).toHaveCount(0);
  expect(await nameCell(page, "Renamed summary").locator('[data-action="open-task"]').getAttribute("class")).toBe(summaryToggleClass);
  const leafBarAfter = await barContentBox(leafBar);
  expect(leafBarAfter.x).toBeCloseTo(leafBarBefore.x, 0);
  expect(leafBarAfter.width).toBeCloseTo(leafBarBefore.width, 0);
  const leafKeyboardInput = await openNameWithF2(page, "001", 3);
  await leafKeyboardInput.fill("002");
  await leafKeyboardInput.press("Enter");
  await expect(nameCell(page, "002")).toBeVisible();
  await expect(nameCell(page, "Renamed milestone")).toHaveCount(0); // No inline editor for off-WBS Milestones.
  expect(route.patches.map((request) => request.postDataJSON())).toEqual([{ name: "Renamed summary" }, { name: "001" }, { name: "Renamed milestone" }, { name: "002" }]);
  expect(route.patches.map((request) => new URL(request.url()).pathname.split("/").at(-1))).toEqual([id(1), id(3), id(4), id(3)]);
  expect(await page.evaluate(() => (window as typeof window & { __openedTaskUrls?: string[] }).__openedTaskUrls)).toEqual([]);
  await page.reload();
  for (const name of ["Renamed summary", "002"]) await expect(nameCell(page, name)).toBeVisible();
  expect(fixture.tasks[3].name).toBe("Renamed milestone");

  // Other cells and tree controls keep their native behavior and do not open an editor.
  await nameCell(page, "Renamed summary").locator('[data-action="open-task"]').click();
  await expect(inlineInput(page)).toHaveCount(0);
  await expect(rowNamed(page, "Renamed milestone")).toHaveCount(0);
  await expect(inlineInput(page)).toHaveCount(0);
  expect(route.patches).toHaveLength(4);
});

test("invalid input stays focused, Escape cancels, blur saves once, and failures keep canonical names", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await installMilestoneDashboardFixture(page, fixture);
  const route = await routeRenames(page, fixture);
  await page.goto(`/projects/${publicId}`);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const editor = await openName(page, "Stable leaf");
    const bounds = await editor.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await editor.press("Escape");
    await expect(inlineInput(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const input = await openName(page, "Stable leaf");
  await input.fill("   ");
  await input.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute("aria-describedby", /inline-name-status/);
  await expect(ganttRoot(page).getByRole("alert")).toContainText("1~200자");
  const errorBounds = await ganttRoot(page).getByRole("alert").boundingBox();
  expect(errorBounds).not.toBeNull();
  expect(errorBounds!.x).toBeGreaterThanOrEqual(0);
  expect(errorBounds!.x + errorBounds!.width).toBeLessThanOrEqual(391);
  expect(route.patches).toHaveLength(0);
  await input.fill("x".repeat(201));
  await input.press("Enter");
  await expect(input).toBeFocused();
  expect(route.patches).toHaveLength(0);
  await input.fill("한글 조합 중");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(input).toBeFocused();
  expect(route.patches).toHaveLength(0);
  await input.dispatchEvent("compositionend");
  await input.fill("Cancel me");
  await input.press("Escape");
  await expect(inlineInput(page)).toHaveCount(0);
  await expect(nameCell(page, "Stable leaf")).toBeFocused();
  expect(route.patches).toHaveLength(0);

  const retry = await openName(page, "Stable leaf");
  await retry.fill("Blur saved");
  await page.getByRole("button", { name: "주", exact: true }).click();
  await expect(nameCell(page, "Blur saved")).toBeVisible();
  expect(route.patches).toHaveLength(1);

  route.failOnce(500);
  const rejected = await openName(page, "Blur saved");
  await rejected.fill("Rejected name");
  await rejected.press("Enter");
  await expect(ganttRoot(page).getByRole("alert")).toBeVisible();
  await expect(nameCell(page, "Blur saved")).toBeVisible();
  expect(route.patches).toHaveLength(2);

  for (const failure of [409, 412, "network"] as const) {
    route.failOnce(failure);
    const attempted = await openName(page, "Blur saved");
    await attempted.fill(`Failed ${failure}`);
    await attempted.press("Enter");
    await expect(nameCell(page, "Blur saved")).toBeVisible();
    if (failure === 412) {
      // The conflict draft remains on its old base until explicitly discarded.
      const stale = await openName(page, "Blur saved");
      await stale.press("Escape");
    }
  }
  expect(route.patches).toHaveLength(5);

  // Linked metadata changes keep the canonical schedule intact.
  const linkedRace = await openName(page, "Blur saved");
  fixture.links.push({ id: "late-link", predecessorExternalId: "SUMMARY-CHILD-1", successorExternalId: "LEAF-1", type: "FS", lag: 0 });
  await linkedRace.fill("Allowed linked rename");
  await linkedRace.press("Enter");
  await expect(nameCell(page, "Allowed linked rename")).toBeVisible();
  expect(route.patches).toHaveLength(6);

  route.failOnce(401);
  const unauthorized = await openMilestoneEditor(page, id(4));
  await unauthorized.getByLabel("작업명", { exact: true }).fill("Unauthorized name");
  await unauthorized.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => route.patches.length).toBe(7);
  expect(fixture.tasks[3].name).toBe("Stable milestone");
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  expect(route.patches).toHaveLength(7);
});

test("linked endpoints, unrelated tasks, readonly state, and narrow layout preserve existing contracts", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await installMilestoneDashboardFixture(page, fixture);
  fixture.links.push({ id: "inline-link", predecessorExternalId: "SUMMARY-CHILD-1", successorExternalId: "LEAF-1", type: "FS", lag: 0 });
  fixture.tasks[2].url = "https://example.invalid/linked";
  const route = await routeRenames(page, fixture);
  await page.addInitScript(() => {
    const tracked = window as typeof window & { __openedTaskUrls?: string[] };
    tracked.__openedTaskUrls = [];
    window.open = ((url?: string | URL) => { tracked.__openedTaskUrls!.push(String(url)); return null; }) as typeof window.open;
  });
  await page.goto(`/projects/${publicId}`);
  await expect(nameCell(page, "Stable leaf")).not.toHaveAttribute("aria-readonly", "true");
  const original = { ...fixture.tasks[2] };
  const linked = await openName(page, "Stable leaf");
  await linked.fill("Linked rename");
  await linked.press("Enter");
  await expect(nameCell(page, "Linked rename")).toBeVisible();
  expect(fixture.tasks[2]).toMatchObject({ requestedStart: original.requestedStart, start: original.start, end: original.end, duration: original.duration });
  expect(route.patches).toHaveLength(1);
  await ganttRoot(page).locator(`.wx-bar[data-task-id=":${id(3)}"]`).click();
  await expect.poll(async () => (await page.evaluate(() => (window as typeof window & { __openedTaskUrls?: string[] }).__openedTaskUrls))?.length).toBe(1);
  const unrelated = await openMilestoneEditor(page, id(4));
  await unrelated.getByLabel("작업명", { exact: true }).fill("Unrelated rename");
  await unrelated.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => fixture.tasks[3].name).toBe("Unrelated rename");
  await unrelated.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(unrelated).toHaveCount(0);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(nameCell(page, "Unrelated rename")).toHaveCount(0);

  fixture.sessionEditable = false;
  await page.reload();
  await nameCell(page, "Linked rename").locator(".wx-content > .wx-text").click();
  await expect(inlineInput(page)).toHaveCount(0);
  const readonlyMilestone = await openMilestoneEditor(page, id(4));
  await expect(readonlyMilestone.getByLabel("작업명", { exact: true })).toHaveAttribute("readonly", "");
  await expect(readonlyMilestone.getByRole("button", { name: "저장", exact: true })).toHaveCount(0);
  await readonlyMilestone.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  expect(route.patches).toHaveLength(2);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(ganttRoot(page).locator(".wx-table-container")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("이름 클릭 의도는 pointerup 전 native layout 변경에도 유지된다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/projects/${publicId}`);
  const text = nameCell(page, "Stable leaf").locator(".wx-content > .wx-text");
  await expect(text).toBeVisible();
  await text.scrollIntoViewIfNeeded();
  const box = await text.boundingBox();
  expect(box).not.toBeNull();
  const point = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  const taskAtPoint = () => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".wx-content > .wx-text")?.closest(".wx-row")?.getAttribute("data-id"), point);
  await expect.poll(taskAtPoint).toBe(`:${id(3)}`);
  await page.mouse.move(point.x, point.y);
  const frame = page.locator(".project-gantt-frame");
  await expect.poll(async () => {
    const value = await frame.getAttribute("data-gantt-projection-receipt");
    return value === null ? null : JSON.parse(value).outcome;
  }).toBe("SETTLED");
  const beforeGeneration = JSON.parse((await frame.getAttribute("data-gantt-projection-receipt"))!).generation as number;
  await page.mouse.down();
  await page.setViewportSize({ width: 768, height: 844 });
  await expect.poll(async () => {
    const receipt = JSON.parse((await frame.getAttribute("data-gantt-projection-receipt"))!);
    return receipt.generation > beforeGeneration && receipt.outcome === "SETTLED";
  }).toBe(true);
  await expect.poll(taskAtPoint).toBe(`:${id(3)}`);
  await page.mouse.up();
  await expect(inlineInput(page)).toBeFocused();
  await inlineInput(page).press("Escape");
});
