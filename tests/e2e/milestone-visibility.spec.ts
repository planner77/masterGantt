import { openWorkspaceView } from "./helpers/workspace-navigation";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { installStatefulProjectFixture, publicId, projectPath, rowNamed, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";
import { waitForGanttReadiness } from "./helpers/gantt-readiness";
import { dashboardFixture } from "../fixtures/milestone-dashboard";

test.use({ timezoneId: "America/New_York" });
const toggle = (page: Page) => page.getByRole("button", { name: "◆ Milestone 표시", exact: true });
const sourceFiles = ["src/features/projects/project-readonly-view.tsx", "src/features/gantt/project-gantt.tsx", "src/features/gantt/milestone-timeline-lane.tsx", "src/features/milestones/milestone-timeline-preference.ts", "src/features/milestones/use-milestone-timeline-preference.ts", "src/features/milestones/project-milestone-dashboard.tsx", "src/features/gantt/milestone-timeline-adapter.ts", "src/features/gantt/task-selection-model.ts", "src/features/gantt/gantt-scale-toolbar.css", "src/features/milestones/project-milestone-stage-table.tsx", "src/features/milestones/project-milestone-dashboard.module.css", "src/features/projects/project-copy-membership-confirm.tsx", "tests/e2e/milestone-visibility.spec.ts"];
async function fixture(page: Page, editable = false, rootTaskId?: string) {
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-04:00"));
  const state = await installStatefulProjectFixture(page); state.sessionEditable = editable;
  for (const task of state.tasks) { task.start = "2026-10-05"; task.end = "2026-10-05"; task.requestedStart = task.type === "summary" ? null : "2026-10-05"; task.duration = task.type === "milestone" ? 0 : 1; task.progress = 0; }
  state.links.push({ id: "00000000-0000-4000-9000-000000000001", predecessorExternalId: state.tasks[1].externalId, successorExternalId: state.tasks[2].externalId, type: "SS", lag: 0 });
  state.tasks[3].parentExternalId = state.tasks[0].externalId; state.tasks[3].siblingOrder = 1;
  state.tasks[0].membership = { explicitMilestoneTaskId: state.tasks[3].taskId, effectiveMilestoneTaskId: state.tasks[3].taskId, inheritedFromTaskId: null };
  await page.route(`**${projectPath}/milestone-dashboard*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.goto(`/projects/${publicId}${rootTaskId ? `?rootTask=${rootTaskId}` : ""}`);
  await expect(toggle(page)).toHaveCount(0);
  await expect(rowNamed(page, rootTaskId ? "Existing summary child" : "Stable leaf")).toBeVisible();
  await capture(page, "initial-projection-diagnostic", await page.locator(".project-gantt-frame").evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline")?.read()));
  await expect(page.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  return state;
}
async function capture(page: Page, name: string, data: unknown) {
  if (!process.env.CAPTURE_ISSUE_552) return;
  const directory = `output/playwright/issue-552/${process.env.CAPTURE_ISSUE_552}`; await mkdir(directory, { recursive: true });
  const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
  await writeFile(`${directory}/${name}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), environment: "Chromium / Next dev / Core2.7.3 / synthetic API / America/New_York", sourceHashes, data }, null, 2));
  await page.screenshot({ path: `${directory}/${name}.png` });
}

test("#552 marker OFF membership/reset/peer preserve canonical data and instance", async ({ page }) => {
  const state = await fixture(page), identity = await rememberGanttRoot(page), canonical = JSON.stringify([state.tasks, state.links]);
  const writes: string[] = [], reads: string[] = [];
  page.on("request", request => { if (!["GET", "HEAD"].includes(request.method())) writes.push(request.method()); if (new URL(request.url()).pathname === projectPath && request.method() === "GET") reads.push(request.url()); });
  await page.locator("#project-panel-schedule .project-stage-filter-trigger").click();
  const search = page.getByRole("combobox", { name: "Milestone 이름·외부 ID·작업 ID 검색" });
  await search.fill(state.tasks[3].taskId); await search.press("End"); await search.press("Enter");
  await expect(rowNamed(page, "Existing summary child")).toBeVisible(); await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  await openWorkspaceView(page, "milestones"); await page.getByRole("tab", { name: "일정", exact: true }).click();
  // #2886: unlike the Milestone panel, the Resource panel physically hides
  // the schedule. A later native chart resize/peer return must not resurrect
  // canonical Milestone rows in the ordinary WBS on the same Gantt instance.
  const frame = page.locator(".project-gantt-frame"), marker = state.tasks.find(task => task.type === "milestone")!;
  await openWorkspaceView(page, "resources");
  await expect(page.locator("#project-panel-schedule")).toBeHidden();
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await waitForGanttReadiness(frame, { operation: "observe",
    api: identity.apiId, revision: state.project.revision, scale: "day", scope: null, query: "",
    queryWitness: { kind: "unchanged" }, canonicalIds: state.tasks.map(task => task.taskId),
    requireRenderedRows: true, allowCancelledPriorWork: true });
  const normalIds = state.tasks.filter(task => task.type !== "milestone").map(task => task.taskId);
  const display = await frame.evaluate(element => ({
    coreIds: Reflect.get(element, "__masterganttMilestoneTimeline").read().rows.map((task: { id: string }) => String(task.id)),
    gridIds: [...element.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id]")].map(row => row.dataset.id!.replace(/^:/, "")),
  }));
  expect(display.coreIds).toEqual(normalIds);
  expect(display.gridIds).toEqual(normalIds);
  await expect(frame.locator(`.wx-row[data-id=":${marker.taskId}"],.wx-bar[data-task-id=":${marker.taskId}"]`)).toHaveCount(0);
  await expectSameGanttRoot(page, identity); await expect(page.locator(".project-milestone-lane,.project-milestone-lane-guide")).toHaveCount(0);
  expect(JSON.stringify([state.tasks, state.links])).toBe(canonical); expect(writes).toEqual([]); expect(reads).toEqual([]);
});

test("#552 legacy marker preference and denied storage cannot enable production presentation", async ({ page }) => {
  await page.addInitScript(id => { localStorage.setItem(`mastergantt:milestone-timeline:${id}`, JSON.stringify({ version: 1, showMilestones: true })); Storage.prototype.getItem = function(key) { if (key.startsWith("mastergantt:milestone-timeline:")) throw new DOMException("blocked", "SecurityError"); return null; }; }, publicId);
  const state = await fixture(page);
  await page.reload(); await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  await expect(toggle(page)).toHaveCount(0); await expect(page.locator(".project-milestone-lane,.project-milestone-lane-guide")).toHaveCount(0);
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
});

for (const width of [390, 768, 1024, 1440, 1920]) test(`#552 marker OFF Day/Week column geometry ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const state = await fixture(page), identity = await rememberGanttRoot(page);
  const frame = page.locator(".project-gantt-frame"), header = frame.locator(".wx-table-container .wx-header").first();
  for (const scale of ["일", "주"]) {
    await page.getByRole("button", { name: scale, exact: true }).click();
    const ready = async () => waitForGanttReadiness(frame, { operation: "observe", api: await frame.getAttribute("data-project-gantt-api-instance"), revision: state.project.revision, scale: scale === "일" ? "day" : "week", scope: null, query: "", queryWitness: { kind: "unchanged" }, canonicalIds: state.tasks.map(task => task.taskId), requireRenderedRows: true });
    for (const visible of [true, false, true]) {
      await ready(); await header.scrollIntoViewIfNeeded(); await header.focus(); await header.press("Shift+F10"); const option = page.locator(".project-column-menu").getByRole("checkbox", { name: "외부 ID", exact: true });
      if (visible) await option.check(); else await option.uncheck(); await page.keyboard.press("Escape");
      await expect(page.locator(".project-column-menu")).toHaveCount(0); await ready();
      const geometry = await frame.evaluate(node => {
        const row = node.querySelector('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000002"]')!.getBoundingClientRect(), bar = node.querySelector('.wx-bar[data-task-id=":00000000-0000-4000-8000-000000000002"]')!.getBoundingClientRect();
        return { rowCenter:row.y+row.height/2, chartCenter:bar.y+bar.height/2, documentWidth:document.documentElement.scrollWidth, windowWidth:innerWidth };
      });
      expect(Math.abs(geometry.rowCenter-geometry.chartCenter)).toBeLessThanOrEqual(1); expect(geometry.documentWidth).toBeLessThanOrEqual(width);
      await expect(frame.locator(".project-milestone-lane,.project-milestone-lane-guide")).toHaveCount(0);
      await expect(frame.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"],.wx-bar[data-task-id=":00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
      await expectSameGanttRoot(page, identity);
    }
  }
  if (width === 390 || width === 1440) await page.screenshot({ path: `/tmp/issue552-marker-off-${width}.png`, fullPage: true });
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
});

for (const width of [390, 1024, 1440]) test(`#552 OFF date request ${width}px opens canonical detail without hidden selection or axis commands`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const state = await fixture(page), identity = await rememberGanttRoot(page);
  const frame = page.locator(".project-gantt-frame"), panel = page.locator("#project-panel-milestones");
  const before = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  await openWorkspaceView(page, "milestones");
  await panel.getByLabel("Milestone 검색", { exact: true }).fill("Stable milestone");
  const id = state.tasks[3].taskId, row = panel.locator(`[data-milestone-task-id="${id}"]`), trigger = row.getByRole("button", { name: / 관리$/ });
  await trigger.focus(); await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: / 관리$/ }).getByRole("button", { name: "Milestone 날짜·소속 확인", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true }); await expect(editor).toBeVisible();
  await expect(editor.getByRole("textbox", { name: "작업명", exact: true })).toHaveValue("Stable milestone");
  await page.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(panel).toBeVisible(); await expect(trigger).toBeFocused(); await expect(panel.getByLabel("Milestone 검색", { exact: true })).toHaveValue("Stable milestone");
  await expect(frame.locator(".project-milestone-lane,.project-milestone-lane-guide")).toHaveCount(0);
  const after = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(after.left).toBe(before.left); expect(after.top).toBe(before.top); expect(after.start).toEqual(before.start); expect(after.end).toEqual(before.end);
  expect(after.selected).not.toContain(id); await expectSameGanttRoot(page, identity); expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
});

test("#552 legacy native M selection is removed by public toggle while the ordinary Task selection remains", async ({ page }) => {
  const state = await fixture(page, true), frame = page.locator(".project-gantt-frame");
  const taskId = state.tasks[1].taskId, milestoneId = state.tasks[3].taskId;
  await rowNamed(page, "Existing summary child").locator("input[data-copy-selection]").check();
  await frame.evaluate((node, id) => Reflect.get(node, "__masterganttMilestoneTimeline").select([id]), milestoneId);
  const before = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(before.selected).toEqual(expect.arrayContaining([taskId, milestoneId])); expect(before.appSelection).toEqual([taskId]);
  await page.getByRole("button", { name: "필터", exact: true }).click();
  await page.getByRole("group", { name: "Task type", exact: true }).getByRole("checkbox", { name: "task", exact: true }).check(); await page.keyboard.press("Escape");
  await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().selected)).toEqual([taskId]);
  await expect(rowNamed(page, "Existing summary child").locator("input[data-copy-selection]")).toBeChecked();
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await capture(page, "legacy-native-selection-public-cleanup", { before, after: await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read()), method: "development-only public select-task UI selection experiment" });
});

test("#552 scoped Summary becoming M keeps the native instance and requires explicit full-project recovery", async ({ page }) => {
  const rootId = "00000000-0000-4000-8000-000000000001", state = await fixture(page, false, rootId), identity = await rememberGanttRoot(page);
  Object.assign(state.tasks[0], { type: "milestone", duration: 0, requestedStart: "2026-10-05", membership: undefined });
  state.tasks[1].parentExternalId = null; state.tasks[1].siblingOrder = 1;
  state.tasks[2].siblingOrder = 2; state.tasks[3].parentExternalId = null; state.tasks[3].siblingOrder = 3;
  state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(page.getByRole("alert").filter({ hasText: "선택한 Summary 범위를 열 수 없습니다." })).toContainText("선택한 범위가 Milestone으로 변경되었습니다. 데이터는 프로젝트 전체 Milestone 목록에 있으며 WBS 범위는 자동으로 넓히지 않습니다.");
  await expect(page.locator(".project-gantt-scope-owner")).toHaveAttribute("inert", ""); await expectSameGanttRoot(page, identity);
  await expect(rowNamed(page, "Stable leaf")).not.toBeVisible();
  // #724 F02: there are two legitimate "전체 일정 보기" buttons. Use the
  // invalid Summary scope's explicit recovery, not the global navigation.
  const recovery = page.getByRole("alert").filter({ hasText: "선택한 Summary 범위를 열 수 없습니다." });
  await expect(page.locator(".project-scope-navigation").getByRole("button", { name: "전체 일정 보기", exact: true })).toHaveAttribute("aria-pressed", "false");
  const recoverFullSchedule = recovery.getByRole("button", { name: "전체 일정 보기", exact: true });
  await expect(recoverFullSchedule).toBeVisible();
  await recoverFullSchedule.click();
  await expect(rowNamed(page, "Stable leaf")).toBeVisible(); await expectSameGanttRoot(page, identity);
  await expect(page.locator(`.wx-table-container .wx-row[data-id$="${rootId}"]`)).toHaveCount(0);
  await capture(page, "scope-summary-m-drift-explicit-recovery", { instance: identity, rootId, canonicalIds: state.tasks.map(task => task.taskId), mutationCount: state.posts.length + state.patchRequests.length });
});

test("#552 Grid-only and metadata canonical queue retain ordinary WBS rows and full canonical links", async ({ page }) => {
  const state = await fixture(page), frame = page.locator(".project-gantt-frame"), identity = await rememberGanttRoot(page);
  await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").display("grid"));
  await expect(frame.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  state.tasks[2].name = "Updated ordinary leaf"; state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(rowNamed(page, "Updated ordinary leaf")).toBeVisible();
  await expect(frame.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").display("all"));
  await expect(rowNamed(page, "Updated ordinary leaf")).toBeVisible();
  await expect(frame.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  const after = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(after.canonicalIds).toEqual(state.tasks.map(task => task.taskId)); expect(after.links).toHaveLength(state.links.length);
  await expect(frame.locator('.wx-links [data-link-id=":00000000-0000-4000-9000-000000000001"]')).toHaveCount(1);
  await expectSameGanttRoot(page, identity); expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await capture(page, "grid-metadata-controlled-projection", { after, instance: identity, method: "development-only public displayMode experiment and canonical metadata revision" });
});

test("#552 legacy M-only filter has explicit dashboard and clear actions", async ({ page }) => {
  const state = await fixture(page);
  await page.locator("#project-panel-schedule").evaluate(node => Reflect.get(node, "__masterganttLegacyMilestoneFilter")());
  await expect(page.locator(".wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await expect(page.getByText("Milestone은 일정 행에 표시하지 않습니다. Milestone 대시보드에서 확인하거나 유형 조건을 해제해 주세요.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "유형 조건 해제", exact: true }).click();
  await expect(page.getByRole("button", { name: "필터", exact: true })).toBeFocused();
  await expect(rowNamed(page, "Stable leaf")).toBeVisible(); expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
});

test("#552 Milestone cause and multi-ID KPI stay in exact Dashboard identities with Task drills separate", async ({ page }) => {
  const state = await fixture(page), original = state.tasks.find(task => task.type === "milestone")!;
  const second = { ...original, taskId: "00000000-0000-4000-8000-000000000099", externalId: "M-second", name: "Second milestone", siblingOrder: 99 };
  state.tasks.push(second); await page.reload();
  const frame = page.locator(".project-gantt-frame"), before = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  await openWorkspaceView(page, "milestones");
  const panel = page.locator("#project-panel-milestones");
  await expect(panel.getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  await panel.getByRole("button", { name: "임박 Milestone 목록에서 확인", exact: true }).click();
  await expect(panel.locator("tr[data-milestone-task-id]")).toHaveCount(2);
  await expect(panel.getByRole("heading", { name: "Milestone 전체 상태 · 표시 2개 · 조회 전체 2개", exact: true })).toBeFocused();
  expect(await panel.locator("tr[data-milestone-task-id]").evaluateAll(rows => rows.map(row => row.getAttribute("data-milestone-task-id")))).toEqual([second.taskId, original.taskId]);
  await panel.getByRole("button", { name: "지표 선택 해제", exact: true }).click();
  await expect(panel.getByRole("button", { name: "임박 Milestone 목록에서 확인", exact: true })).toBeFocused();
  await panel.locator(`[data-milestone-task-id="${original.taskId}"]`).getByRole("button", { name: / 전체 원인 확인$/ }).click();
  const cause = panel.getByRole("heading", { name: "미완료 직접 선행 Milestone · 1개", exact: true }).locator("..");
  await cause.getByRole("button", { name: "Milestone 날짜·소속 확인", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "작업 정보", exact: true }).getByRole("textbox", { name: "작업명", exact: true })).toHaveValue(second.name);
  await page.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "임박 Milestone 목록에서 확인", exact: true }).click();
  await panel.getByLabel("Milestone 검색", { exact: true }).fill(second.taskId);
  await expect(panel.locator("tr[data-milestone-task-id]")).toHaveCount(1);
  await expect(panel.getByRole("button", { name: "지표 선택 해제", exact: true })).toHaveCount(0);
  const after = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(after.left).toBe(before.left); expect(after.top).toBe(before.top); expect(after.start).toEqual(before.start); expect(after.end).toEqual(before.end);
  expect(after.selected).not.toContain(second.taskId); expect(after.canonicalIds).toEqual(state.tasks.map(task => task.taskId));
  await expect(frame.locator(".project-milestone-lane,.project-milestone-lane-guide")).toHaveCount(0);
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
});

test("#552 undated Milestone date/details action remains available in readonly without axis navigation", async ({ page }) => {
  const state = await fixture(page), milestone = state.tasks.find(task => task.type === "milestone")!;
  Object.assign(milestone, { start: null, end: null, requestedStart: null, duration: null });
  await page.reload(); await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  const frame = page.locator(".project-gantt-frame"), before = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  await openWorkspaceView(page, "milestones");
  const panel = page.locator("#project-panel-milestones"), row = panel.locator(`[data-milestone-task-id="${milestone.taskId}"]`);
  await expect(row).toContainText("미설정"); await row.getByRole("button", { name: / 관리$/ }).click();
  const action = page.getByRole("dialog", { name: / 관리$/ }).getByRole("button", { name: "Milestone 날짜·소속 확인", exact: true });
  await expect(action).toBeEnabled(); await action.click();
  await expect(page.getByRole("dialog", { name: "작업 정보", exact: true }).getByRole("textbox", { name: "작업명", exact: true })).toHaveValue(milestone.name);
  await page.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(panel).toBeVisible();
  const after = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(after.left).toBe(before.left); expect(after.top).toBe(before.top); expect(after.start).toEqual(before.start); expect(after.end).toEqual(before.end);
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
});
