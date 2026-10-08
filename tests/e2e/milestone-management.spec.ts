import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { deferred, installStatefulProjectFixture, publicId, projectPath, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";
import { recalculateHierarchy } from "../../src/domain/scheduling/hierarchy";
import { workingCalendarFromProjectCalendar } from "../../src/features/gantt/project-task-adapter";
import { membershipProjection } from "../../src/features/gantt/milestone-membership-model";
import { dashboardFixture } from "../fixtures/milestone-dashboard";

const panel = (page: Page) => page.locator("#project-panel-milestones");
const editor = (page: Page) => page.getByRole("dialog", { name: "작업 정보", exact: true });
async function fixture(page: Page, editable = true, count = 30) {
  const state = await installStatefulProjectFixture(page); state.sessionEditable = editable; state.project.calendar.weekendDays = [6, 0];
  state.tasks.splice(0, state.tasks.length, ...state.tasks.filter(task => task.type !== "milestone"));
  const base = state.tasks.find(task => task.externalId === "LEAF-1")!;
  for (let n = 1; n <= count; n++) state.tasks.push({ ...base, taskId: `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`, externalId: `M-${String(n).padStart(3, "0")}`, type: "milestone", siblingOrder: n + 1, name: n < 3 ? "동일 이름 긴 Milestone 관리 단계 업무 인수 검토와 최종 확인" : `수동 이벤트 ${n}`, duration: 0, parentExternalId: null, start: "2026-10-05", end: "2026-10-05", requestedStart: "2026-10-05", progress: 0, status: "not_started", membership: { explicitMilestoneTaskId: null, effectiveMilestoneTaskId: null, inheritedFromTaskId: null }, stageGate: { memberTaskIds: [], memberCount: 0, completedMemberCount: 0, incompleteMemberTaskIds: [], memberProgressPercent: null, predecessorMilestoneTaskIds: [], incompletePredecessorMilestoneTaskIds: [], membersCompleted: true, predecessorsCompleted: true, ready: null, blocked: false, manualEvent: true, completionInconsistent: false } });
  recalculateHierarchy(state.tasks, workingCalendarFromProjectCalendar(state.project.calendar));
  const projection = membershipProjection(state.tasks, state.links);
  expect(projection.gates.size).toBe(count);
  await page.route(`**${projectPath}/milestone-dashboard?*`, route => {
    const report = dashboardFixture(state, new URL(route.request().url()).searchParams);
    report.rows = report.rows.map(row => ({ ...row, stageGate: state.tasks.find(task => task.taskId === row.milestoneTaskId)!.stageGate ?? row.stageGate }));
    return route.fulfill({ json: { data: report } });
  });
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  await expect(panel(page).getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  return { state, identity };
}
async function capture(page: Page, info: TestInfo, name: string, observation: object) {
  const paths = ["src/features/projects/project-readonly-view.tsx", "src/features/milestones/milestone-management-model.ts", "src/features/milestones/milestone-create-dialog.tsx", "src/features/milestones/project-milestone-dashboard.tsx", "src/features/milestones/project-milestone-stage-table.tsx", "src/features/milestones/project-milestone-dashboard.module.css", "tests/e2e/milestone-management.spec.ts"];
  const data = { capturedAt: new Date().toISOString(), environment: "Chromium/Next dev synthetic mock API", ...observation, sourceHashes: Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")]))) };
  await info.attach(name, { body: JSON.stringify(data), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_550) { const directory = `output/playwright/issue-550/${process.env.CAPTURE_ISSUE_550}`; await mkdir(directory, { recursive: true }); await writeFile(`${directory}/${name}.json`, JSON.stringify(data, null, 2)); await page.screenshot({ path: `${directory}/${name}.png` }); }
}

async function layoutObservation(page: Page) {
  return page.evaluate(() => {
    const dashboard = document.querySelector('[data-testid="milestone-dashboard"]')!;
    const table = dashboard.querySelector('table[class*="stageTable"]')!;
    const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const headers = Array.from(table.querySelectorAll("thead th")).map(rect);
    const cells = Array.from(table.querySelectorAll("tbody tr:first-child td")).map(rect);
    const buttons = Array.from(table.querySelectorAll("tbody tr:first-child button")).map(button => ({ button: rect(button), cell: rect(button.closest("td")!) }));
    const toolbar = dashboard.querySelector('[class*="sectionHeading"]')!;
    const controls = Array.from(toolbar.querySelectorAll("button")).map(rect);
    const focus = document.activeElement!, style = getComputedStyle(focus);
    return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth, dashboard: rect(dashboard), owner: rect(table.parentElement!), headers, cells, buttons, toolbar: rect(toolbar), controls, focus: { rect: rect(focus), outline: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), outlineOffset: parseFloat(style.outlineOffset), owner: rect(focus.closest("dialog")!) } };
  });
}

async function fallbackObservation(page: Page) {
  return page.evaluate(() => {
    const target = document.activeElement as HTMLElement, r = target.getBoundingClientRect(), style = getComputedStyle(target);
    const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 }, hit = document.elementFromPoint(point.x, point.y);
    const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    const occluding = Array.from(document.querySelectorAll("body *")).filter(element => {
      const css = getComputedStyle(element), box = element.getBoundingClientRect();
      if (!["sticky", "fixed"].includes(css.position) || css.visibility === "hidden" || css.display === "none" || Number(css.opacity) === 0 || !box.width || !box.height || element.contains(target)) return false;
      const background = css.backgroundColor;
      if (background === "transparent" || /rgba\([^)]*,\s*0\s*\)/.test(background)) return false;
      return box.x < r.right + ring && box.right > r.x - ring && box.y < r.bottom + ring && box.bottom > r.y - ring;
    }).map(element => ({ tag: element.tagName, className: element.className }));
    const chart = document.querySelector<HTMLElement>(".project-gantt-frame .wx-chart");
    return { kind: target.getAttribute("data-milestone-focus"), viewport: { width: innerWidth, height: innerHeight }, rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }, outline: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), ring, centerHit: Boolean(hit && (hit === target || target.contains(hit))), occluding, pageScroll: { x: scrollX, y: scrollY }, chartScroll: chart ? { left: chart.scrollLeft, top: chart.scrollTop } : null };
  });
}

for (const width of [390, 768, 1024, 1440, 1920]) test(`#550 관리 목록 ${width}px · readonly/keyboard/긴 이름/많은 행`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const { state, identity } = await fixture(page, false), before = JSON.stringify({ tasks: state.tasks, links: state.links, revision: state.project.revision });
  const table = panel(page).getByRole("region", { name: "완료 단계 전체 상태 표 가로 스크롤" });
  await expect(panel(page).getByRole("button", { name: "Milestone 추가", exact: true })).toBeDisabled();
  const rows = panel(page).locator("tr[data-milestone-task-id]");
  expect(await rows.count()).toBe(30);
  const trigger = rows.first().getByRole("button", { name: / 관리$/ });
  await trigger.focus(); await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog", { name: / 관리$/ }); await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Milestone 복사", exact: true })).toBeDisabled();
  await expect(menu.getByRole("button", { name: "Milestone 삭제", exact: true })).toBeDisabled();
  await page.keyboard.press("Shift+Tab");
  expect(await menu.evaluate(node => node.contains(document.activeElement))).toBe(true);
  const bounds = await menu.boundingBox(); expect(bounds).not.toBeNull(); expect(bounds!.width).toBeLessThanOrEqual(width); expect(bounds!.x).toBeGreaterThanOrEqual(0);
  const layout = await layoutObservation(page);
  expect(layout.documentWidth).toBeLessThanOrEqual(width + 1);
  expect(layout.headers).toHaveLength(8); expect(layout.cells).toHaveLength(8);
  layout.headers.forEach((header, index) => { const cell = layout.cells[index]; expect(Math.abs(header.x - cell.x)).toBeLessThanOrEqual(1); expect(Math.abs(header.right - cell.right)).toBeLessThanOrEqual(1); if (index) expect(layout.cells[index - 1].right).toBeLessThanOrEqual(cell.x + 1); });
  for (const { button, cell } of layout.buttons) { expect(button.x).toBeGreaterThanOrEqual(cell.x - 1); expect(button.right).toBeLessThanOrEqual(cell.right + 1); expect(button.y).toBeGreaterThanOrEqual(cell.y - 1); expect(button.bottom).toBeLessThanOrEqual(cell.bottom + 1); }
  for (const control of layout.controls) { expect(control.x).toBeGreaterThanOrEqual(layout.toolbar.x - 1); expect(control.right).toBeLessThanOrEqual(layout.toolbar.right + 1); expect(control.bottom).toBeLessThanOrEqual(layout.toolbar.bottom + 1); }
  expect(layout.focus.outline).not.toBe("none");
  const ring = layout.focus.outlineWidth + layout.focus.outlineOffset;
  expect(layout.focus.rect.x - ring).toBeGreaterThanOrEqual(layout.focus.owner.x - 1); expect(layout.focus.rect.right + ring).toBeLessThanOrEqual(layout.focus.owner.right + 1);
  expect(layout.focus.rect.y - ring).toBeGreaterThanOrEqual(layout.focus.owner.y - 1); expect(layout.focus.rect.bottom + ring).toBeLessThanOrEqual(layout.focus.owner.bottom + 1);
  await capture(page, info, `geometry-${width}`, { width, bounds, layout, rows: await rows.count(), readonly: true, instance: identity });
  await page.keyboard.press("Escape"); await expect(menu).toBeHidden(); await expect(trigger).toBeFocused();
  await trigger.click(); await menu.getByRole("button", { name: "관계 조회·관리", exact: true }).click();
  await expect(editor(page).getByRole("tab", { name: /^관계/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape"); await expect(editor(page)).toBeHidden(); await expect(trigger).toBeFocused();
  await table.evaluate(node => { node.scrollLeft = 0; node.scrollTop = 0; });
  await table.focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("PageDown");
  await expect.poll(() => table.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  const scroll = await table.evaluate(node => ({ left: node.scrollLeft, top: node.scrollTop, width: node.clientWidth, content: node.scrollWidth }));
  if (width < 1100) expect(scroll.left).toBeGreaterThan(0);
  await expectSameGanttRoot(page, identity);
  expect(JSON.stringify({ tasks: state.tasks, links: state.links, revision: state.project.revision })).toBe(before);
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await panel(page).getByLabel("단계 검색", { exact: true }).fill("no-match-550");
  await expect(panel(page).getByText("조건에 일치하는 완료 단계가 없습니다.", { exact: false })).toBeVisible();
});

test("#550 생성 pending·성공 exact ID·dirty 보호·동일 instance", async ({ page }, info) => {
  const { state, identity } = await fixture(page, true, 2), gate = deferred(), started = deferred();
  const trigger = panel(page).getByRole("button", { name: "Milestone 추가", exact: true });
  await trigger.click(); const form = page.getByRole("dialog", { name: "Milestone 추가", exact: true });
  await form.getByLabel("Milestone 이름", { exact: true }).fill(state.tasks.find(task => task.type === "milestone")!.name);
  await form.getByLabel("요청 시작일", { exact: true }).fill("2026-10-09");
  state.nextPost = { kind: "success", gate, started };
  await form.getByRole("button", { name: "Milestone 생성", exact: true }).click(); await started.promise;
  await expect(form.getByRole("button", { name: "생성 중…", exact: true })).toBeDisabled(); await page.keyboard.press("Escape"); await expect(form).toBeVisible();
  gate.resolve(); await expect(form).toBeHidden(); await expect(editor(page)).toBeVisible();
  expect(state.posts[0]).toMatchObject({ type: "milestone", duration: 0, progress: 0, parentExternalId: null }); expect(state.posts[0]).not.toHaveProperty("parentTaskId");
  const created = state.tasks.find(task => task.taskId === state.createdTaskIds[0])!;
  await expect(editor(page)).toContainText(created.externalId);
  await editor(page).getByLabel("작업명", { exact: true }).fill("저장하지 않은 초안");
  await page.keyboard.press("Escape"); await expect(editor(page)).toContainText("저장하지 않은");
  await editor(page).getByRole("button", { name: "변경사항 버리고 닫기", exact: true }).click(); await expect(editor(page)).toBeHidden();
  await expect(trigger).toBeFocused(); await expectSameGanttRoot(page, identity);
  await capture(page, info, "create-success", { createdTaskId: created.taskId, revision: state.project.revision, posts: state.posts, instance: identity });
});

for (const outcome of ["401", "412", "network"] as const) test(`#550 생성 ${outcome} · 입력 보존/자동 재전송 없음`, async ({ page }, info) => {
  const { state } = await fixture(page, true, 2), revision = state.project.revision;
  await panel(page).getByRole("button", { name: "Milestone 추가", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Milestone 추가", exact: true });
  await form.getByLabel("Milestone 이름", { exact: true }).fill("실패 초안"); await form.getByLabel("요청 시작일", { exact: true }).fill("2026-10-09");
  state.nextPost = outcome === "network" ? { kind: "network" } : { kind: "error", status: Number(outcome) as 401 | 412, code: outcome === "401" ? "EDIT_SESSION_REQUIRED" : "REVISION_MISMATCH" };
  await form.getByRole("button", { name: "Milestone 생성", exact: true }).click();
  await expect(form.getByRole("alert").last()).toBeVisible(); await expect(form.getByLabel("Milestone 이름", { exact: true })).toHaveValue("실패 초안");
  await expect(form.getByLabel("요청 시작일", { exact: true })).toHaveValue("2026-10-09");
  expect(state.posts).toHaveLength(1); expect(state.project.revision).toBe(revision); expect(state.createdTaskIds).toHaveLength(0);
  await capture(page, info, `create-${outcome}`, { revision, requestCount: state.posts.length, draftPreserved: true });
  await page.keyboard.press("Escape"); await expect(form).toContainText("초안을 버리고"); await form.getByRole("button", { name: "초안 버리고 닫기", exact: true }).click(); await expect(form).toBeHidden();
});


test("#550 생성 초안 Escape/취소 확인과 계속 입력 · mutation 없음", async ({ page }) => {
  const { state } = await fixture(page, true, 2);
  const add = panel(page).getByRole("button", { name: "Milestone 추가", exact: true });
  await add.click(); const form = page.getByRole("dialog", { name: "Milestone 추가", exact: true });
  await form.getByLabel("Milestone 이름", { exact: true }).fill("유지할 초안");
  await page.keyboard.press("Escape"); await expect(form.getByRole("button", { name: "계속 입력", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(form.getByLabel("Milestone 이름", { exact: true })).toHaveValue("유지할 초안");
  await form.getByRole("button", { name: "취소", exact: true }).click();
  await form.getByRole("button", { name: "초안 버리고 닫기", exact: true }).click();
  await expect(form).toBeHidden(); await expect(add).toBeFocused(); expect(state.posts).toHaveLength(0);
});

test("#550 동일 ID utility·단일 Copy·삭제 확인·삭제 후 목록 focus", async ({ page }, info) => {
  const { state, identity } = await fixture(page, true, 2);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const original = state.tasks.find(task => task.externalId === "M-001")!;
  const row = panel(page).locator(`[data-milestone-task-id="${original.taskId}"]`);
  const trigger = row.getByRole("button", { name: / 관리$/ });
  const menu = page.getByRole("dialog", { name: / 관리$/ });
  await trigger.click(); await menu.getByRole("button", { name: "작업 ID 복사", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(original.taskId);
  const commands: unknown[] = [], deleted: string[] = [];
  const response = (kind: "taskHierarchy" | "taskDelete", changed: string[], removed: string[]) => ({ data: { project: { ...state.project }, tasks: state.tasks, links: state.links, warnings: [], operation: { kind, changedTaskExternalIds: changed, deletedTaskExternalIds: removed, deletedLinkIds: [] } } });
  await page.route(`**${projectPath}/task-commands`, async route => {
    const command = route.request().postDataJSON(); commands.push(command);
    expect(command).toEqual({ kind: "copy", taskId: original.taskId, anchorTaskId: original.taskId, placement: "after" });
    const copied = { ...original, taskId: "00000000-0000-4000-9000-000000009999", externalId: "COPY-550", siblingOrder: 4 };
    state.tasks.push(copied); state.project.revision++;
    await route.fulfill({ json: response("taskHierarchy", [copied.externalId], []) });
  });
  await page.route(`**${projectPath}/tasks/*`, async route => {
    if (route.request().method() !== "DELETE") return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!; deleted.push(id);
    expect(id).toBe(original.taskId);
    state.tasks.splice(state.tasks.findIndex(task => task.taskId === id), 1); state.project.revision++;
    await route.fulfill({ json: response("taskDelete", [], [original.externalId]) });
  });
  await trigger.click(); await menu.getByRole("button", { name: "Milestone 복사", exact: true }).click();
  await expect.poll(() => commands.length).toBe(1);
  await expect(panel(page).getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  await expect(panel(page).locator("tr[data-milestone-task-id]")).toHaveCount(3);
  await trigger.click(); await menu.getByRole("button", { name: "Milestone 삭제", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "작업 삭제", exact: true }); await expect(confirm).toBeVisible();
  expect(deleted).toHaveLength(0); await confirm.getByRole("button", { name: "하위 작업 포함 삭제", exact: true }).click();
  await expect(confirm).toBeHidden(); await expect(row).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-milestone-focus"))).toMatch(/search|add|heading/);
  expect(deleted).toEqual([original.taskId]); await expectSameGanttRoot(page, identity);
  await capture(page, info, "commands-focus", { commands, deleted, revision: state.project.revision, instance: identity });
});

test("#550 생성 중 외부 revision · stale 초안 유지와 제출 차단", async ({ page }, info) => {
  const { state } = await fixture(page, true, 2);
  await panel(page).getByRole("button", { name: "Milestone 추가", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Milestone 추가", exact: true });
  await form.getByLabel("Milestone 이름", { exact: true }).fill("stale 초안");
  await form.getByLabel("요청 시작일", { exact: true }).fill("2026-10-09");
  state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(form).toContainText("기준 Revision이 변경되었습니다");
  await expect(form.getByRole("button", { name: "Milestone 생성", exact: true })).toBeDisabled();
  await expect(form.getByLabel("Milestone 이름", { exact: true })).toHaveValue("stale 초안"); expect(state.posts).toHaveLength(0);
  await capture(page, info, "create-stale", { revision: state.project.revision, posts: 0, draftPreserved: true });
});

test("#550 보고 검색 응답 역전 · 최신 조건과 canonical revision 유지", async ({ page }, info) => {
  const { state } = await fixture(page, false, 2), gate = deferred(), started = deferred(), delivered = deferred();
  await page.route(`**${projectPath}/milestone-dashboard?*`, async route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("search") !== "late-550") return route.fallback();
    const report = dashboardFixture(state, params); started.resolve(); await gate.promise;
    await route.fulfill({ json: { data: report } }); delivered.resolve();
  });
  const search = panel(page).getByLabel("단계 검색", { exact: true });
  await search.fill("late-550"); await started.promise;
  await search.fill("M-001");
  await expect(panel(page).getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  await expect(panel(page).locator("tr[data-milestone-task-id]")).toHaveCount(1);
  gate.resolve(); await delivered.promise;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(search).toHaveValue("M-001");
  await expect(panel(page).locator("tr[data-milestone-task-id]")).toHaveCount(1);
  expect(state.posts).toHaveLength(0); expect(state.project.revision).toBe(state.initialRevision);
  await capture(page, info, "report-order", { search: "M-001", revision: state.project.revision, mutation: 0 });
});

for (const removedBy of ["canonical-delete", "report-filter"] as const) test(`#550 열린 관리 대상 ${removedBy} 소멸 · 현재 목록 focus와 오래된 메뉴 폐기`, async ({ page }, info) => {
  const { state, identity } = await fixture(page, false, 2);
  const beforeChart = await page.locator(".project-gantt-frame .wx-chart").evaluate(node => ({ left: node.scrollLeft, top: node.scrollTop }));
  const milestone = state.tasks.find(task => task.externalId === "M-001")!;
  await panel(page).locator(`[data-milestone-task-id="${milestone.taskId}"]`).getByRole("button", { name: / 관리$/ }).click();
  const menu = page.getByRole("dialog", { name: / 관리$/ }); await expect(menu).toBeVisible();
  if (removedBy === "canonical-delete") state.tasks.splice(state.tasks.indexOf(milestone), 1);
  else await page.route(`**${projectPath}/milestone-dashboard?*`, route => {
    const report = dashboardFixture(state, new URL(route.request().url()).searchParams); report.rows = report.rows.filter(row => row.milestoneTaskId !== milestone.taskId);
    return route.fulfill({ json: { data: report } });
  });
  state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(menu).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-milestone-focus"))).toMatch(/search|add|heading/);
  const fallback = await fallbackObservation(page);
  expect(fallback.outline).not.toBe("none"); expect(fallback.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(fallback.rect.x - fallback.ring).toBeGreaterThanOrEqual(0); expect(fallback.rect.right + fallback.ring).toBeLessThanOrEqual(fallback.viewport.width);
  expect(fallback.rect.y - fallback.ring).toBeGreaterThanOrEqual(0); expect(fallback.rect.bottom + fallback.ring).toBeLessThanOrEqual(fallback.viewport.height);
  expect(fallback.centerHit).toBe(true); expect(fallback.occluding).toEqual([]); expect(fallback.chartScroll).toEqual(beforeChart);
  await expect(panel(page).getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  if (removedBy === "canonical-delete") state.tasks.push(milestone);
  else await page.unroute(`**${projectPath}/milestone-dashboard?*`);
  // Reinstall the report after the filtered-row route is removed; the original
  // isolated fixture route is intentionally not shared with other specs.
  if (removedBy === "report-filter") await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(panel(page).locator(`[data-milestone-task-id="${milestone.taskId}"]`)).toBeVisible(); await expect(menu).toBeHidden();
  await expectSameGanttRoot(page, identity); expect(state.posts).toHaveLength(0);
  await capture(page, info, `expired-${removedBy}`, { removedBy, oldTaskId: milestone.taskId, revision: state.project.revision, fallback, beforeChart, menuReopened: false, mutation: 0, instance: identity });
});

// Hold only the application world's RAF callbacks. React commits and Playwright's
// isolated-world actionability frames still run; no production hook is installed.
async function holdApplicationFrames(page: Page) {
  await page.evaluate(() => {
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    const pending = new Map<number, FrameRequestCallback>(); let next = 1000000000;
    const gate = { held: 0, cancelled: 0, release: async () => {
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel;
      const callbacks = [...pending.values()]; pending.clear();
      await new Promise<void>(resolve => request(time => { callbacks.forEach(callback => callback(time)); request(() => resolve()); }));
      return { held: gate.held, cancelled: gate.cancelled, released: callbacks.length };
    } };
    Object.assign(window, { issue550Frames: gate });
    window.requestAnimationFrame = callback => { const id = next++; pending.set(id, callback); gate.held++; return id; };
    window.cancelAnimationFrame = id => { if (pending.delete(id)) gate.cancelled++; else cancel(id); };
  });
}
async function releaseApplicationFrames(page: Page) {
  return page.evaluate(() => (window as unknown as { issue550Frames: { release: () => Promise<{ held: number; cancelled: number; released: number }> } }).issue550Frames.release());
}

for (const reopen of ["same-id", "other-id"] as const) test(`#550 committed missing → return before RAF · ${reopen} 명시 재열기`, async ({ page }, info) => {
  const { state, identity } = await fixture(page, false, 2);
  const milestone = state.tasks.find(task => task.externalId === "M-001")!;
  const other = state.tasks.find(task => task.externalId === "M-002")!;
  const row = panel(page).locator(`[data-milestone-task-id="${milestone.taskId}"]`);
  await row.getByRole("button", { name: / 관리$/ }).click();
  const menu = page.getByRole("dialog", { name: / 관리$/ }); await expect(menu).toBeVisible();
  await holdApplicationFrames(page);
  state.tasks.splice(state.tasks.indexOf(milestone), 1); state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  // The absent modal and row prove a committed missing render, while every
  // application RAF remains held until the explicit release below.
  await expect(menu).toBeHidden(); await expect(row).toHaveCount(0);
  state.tasks.push(milestone); state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(row).toBeVisible(); await expect(menu).toBeHidden();
  const requested = reopen === "same-id" ? milestone : other;
  await panel(page).locator(`[data-milestone-task-id="${requested.taskId}"]`).getByRole("button", { name: / 관리$/ }).click();
  await expect(menu).toBeVisible(); await expect(menu).toContainText(requested.taskId);
  const frames = await releaseApplicationFrames(page); expect(frames.held).toBeGreaterThan(0); expect(frames.cancelled).toBeGreaterThan(0);
  await expect(menu).toBeVisible(); await expect(menu).toContainText(requested.taskId);
  expect(await menu.evaluate(node => node.contains(document.activeElement))).toBe(true);
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0); await expectSameGanttRoot(page, identity);
  await capture(page, info, `expiry-race-${reopen}`, { committedMissing: true, returnedBeforeFrameRelease: true, automaticReopen: false, requestedTaskId: requested.taskId, frames, dialogRetainsFocus: true, mutation: 0, instance: identity });
});

for (const close of ["cancel", "escape"] as const) test(`#550 삭제 확인 disconnected trigger · ${close} visible fallback`, async ({ page }, info) => {
  const { state, identity } = await fixture(page, true, 2);
  const milestone = state.tasks.find(task => task.externalId === "M-001")!;
  await panel(page).locator(`[data-milestone-task-id="${milestone.taskId}"]`).getByRole("button", { name: / 관리$/ }).click();
  await page.getByRole("dialog", { name: / 관리$/ }).getByRole("button", { name: "Milestone 삭제", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "작업 삭제", exact: true }); await expect(confirmation).toBeVisible();
  let deletes = 0; page.on("request", request => { if (request.method() === "DELETE") deletes++; });
  state.tasks.splice(state.tasks.indexOf(milestone), 1); state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(panel(page).locator(`[data-milestone-task-id="${milestone.taskId}"]`)).toHaveCount(0);
  if (close === "cancel") await confirmation.getByRole("button", { name: "취소", exact: true }).click(); else await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-milestone-focus"))).toMatch(/search|add|heading/);
  const fallback = await fallbackObservation(page);
  expect(fallback.ring).toBe(6); expect(fallback.centerHit).toBe(true); expect(fallback.occluding).toEqual([]);
  expect(fallback.rect.x - fallback.ring).toBeGreaterThanOrEqual(0); expect(fallback.rect.right + fallback.ring).toBeLessThanOrEqual(fallback.viewport.width);
  expect(fallback.rect.y - fallback.ring).toBeGreaterThanOrEqual(0); expect(fallback.rect.bottom + fallback.ring).toBeLessThanOrEqual(fallback.viewport.height);
  expect(deletes).toBe(0); expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0); await expectSameGanttRoot(page, identity);
  await capture(page, info, `delete-close-${close}`, { close, deletedExternally: true, fallback, deleteRequests: deletes, mutation: 0, instance: identity });
});
