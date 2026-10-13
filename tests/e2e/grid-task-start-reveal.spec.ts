import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { ProjectTaskDto } from "../../src/contracts/projects";
import { dashboardFixture } from "../fixtures/milestone-dashboard";
import { projectPath } from "../fixtures/stateful-project";
import { installStatefulProjectFixture, publicId } from "../fixtures/stateful-project";

async function fixture(page: Page, editable = false) {
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = editable;
  const base = state.tasks.find(task => task.type === "task")!;
  const tasks: ProjectTaskDto[] = [
    { ...base, taskId: "00000000-0000-4000-8000-000000000101", externalId: "LEAF-1", name: "과거 시작 작업", parentExternalId: null, siblingOrder: 0, start: "2026-01-05", requestedStart: "2026-01-05", end: "2026-01-06", duration: 2 },
    { ...base, taskId: "00000000-0000-4000-8000-000000000102", externalId: "FUTURE", name: "미래 시작 작업", parentExternalId: null, siblingOrder: 1, start: "2027-08-02", requestedStart: "2027-08-02", end: "2027-08-03", duration: 2 },
    { ...base, taskId: "00000000-0000-4000-8000-000000000103", externalId: "LONG", name: "시작 밖 종료 밖 긴 작업", parentExternalId: null, siblingOrder: 2, start: "2026-01-05", requestedStart: "2026-01-05", end: "2027-08-03", duration: 400 },
    { ...base, taskId: "00000000-0000-4000-8000-000000000104", externalId: "PARENT", name: "날짜 있는 부모", type: "summary", parentExternalId: null, siblingOrder: 3, start: "2027-09-06", requestedStart: null, end: "2027-09-07", duration: 2 },
    { ...base, taskId: "00000000-0000-4000-8000-000000000105", externalId: "NESTED", name: "미래 nested 작업", parentExternalId: "PARENT", siblingOrder: 0, start: "2027-09-06", requestedStart: "2027-09-06", end: "2027-09-07", duration: 2 },
    { ...base, taskId: "00000000-0000-4000-8000-000000000106", externalId: "EMPTY", name: "일정 없는 Summary", type: "summary", parentExternalId: null, siblingOrder: 4, start: null, requestedStart: null, end: null, duration: null, progress: null },
    { ...base, taskId: "00000000-0000-4000-8000-000000000107", externalId: "MILESTONE-1", name: "peer 보고 단계", type: "milestone", parentExternalId: null, siblingOrder: 5, start: "2027-09-07", requestedStart: "2027-09-07", end: "2027-09-07", duration: 0 },
  ];
  state.tasks.splice(0, state.tasks.length, ...tasks);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${publicId}`);
  const frame = page.locator(".project-gantt-frame");
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /svar-api-/);
  return { state, frame };
}
async function observe(page: Page, start: string) {
  return page.locator(".project-gantt-frame").evaluate((node, taskStart) => {
    const publicViewport = Reflect.get(node, "__masterganttPublicViewport") as { left: number; top: number };
    const scale = Reflect.get(node, "__masterganttGridReveal") as { start: Date; cellWidth: number; scaleUnit: string; selected: string[] };
    const chart = node.querySelector<HTMLElement>(".wx-chart")!;
    const first = scale.start;
    const firstDay = Date.UTC(first.getFullYear(), first.getMonth(), first.getDate());
    const selectedDay = Date.parse(`${taskStart}T00:00:00Z`);
    const startX = (selectedDay - firstDay) / 86_400_000 * scale.cellWidth / (scale.scaleUnit === "week" ? 7 : 1);
    return { public: publicViewport, dom: { left: chart.scrollLeft, top: node.querySelector(".wx-gantt")!.scrollTop },
      startX, startVisible: startX >= publicViewport.left && startX < publicViewport.left + chart.clientWidth,
      chartWidth: chart.clientWidth, scale: { ...scale, start: first.toISOString() },
      geometry: { chart: { left: chart.getBoundingClientRect().left, right: chart.getBoundingClientRect().right },
        grid: { left: node.querySelector(".wx-table-container")!.getBoundingClientRect().left, right: node.querySelector(".wx-table-container")!.getBoundingClientRect().right },
        viewportWidth: innerWidth, documentOverflow: document.documentElement.scrollWidth - innerWidth },
      events: JSON.parse((node as HTMLElement).dataset.ganttPublicScrollEvents ?? "[]"),
      instance: (node as HTMLElement).dataset.projectGanttApiInstance, syncGeneration: (node as HTMLElement).dataset.ganttCanonicalSyncGeneration };
  }, start);
}

async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => {
    let remaining = 8;
    const next = () => --remaining ? requestAnimationFrame(next) : resolve();
    requestAnimationFrame(next);
  }));
}

async function saveEvidence(info: TestInfo, name: string, data: object) {
  const paths = ["src/features/gantt/project-gantt.tsx", "src/features/projects/project-readonly-view.tsx", "tests/e2e/grid-task-start-reveal.spec.ts"];
  const evidence = { capturedAt: new Date().toISOString(), ...data,
    sourceHashes: Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")]))),
    environment: "Next16.3.8/Core2.7.3; mocked canonical API, native browser pointer" };
  await info.attach(name, { body: JSON.stringify(evidence), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_514) {
    const output = `output/playwright/issue-514/${process.env.CAPTURE_ISSUE_514}`;
    await mkdir(output, { recursive: true });
    await writeFile(`${output}/${name}.json`, JSON.stringify(evidence, null, 2));
  }
}

for (const editable of [false, true]) for (const scale of ["day", "week"] as const) for (const fullscreen of [false, true]) {
  test(`#514 matrix ${editable ? "editable" : "readonly"}/${scale}/${fullscreen ? "fullscreen" : "normal"} root+nested`, async ({ page }, info) => {
    const { state, frame } = await fixture(page, editable);
    if (scale === "week") await page.getByRole("button", { name: "주", exact: true }).click();
    if (fullscreen) {
      await page.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("project-gantt-frame"))).toBe(true);
    }
    await settle(page);
    const initial = await frame.evaluate(node => ({ instance: (node as HTMLElement).dataset.projectGanttApiInstance,
      scale: (node as HTMLElement).dataset.ganttScaleMode, rows: Array.from(node.querySelectorAll(".wx-table-container .wx-row")).map(row => row.getAttribute("data-id")),
      columns: Array.from(node.querySelectorAll(".wx-header .wx-cell")).map(cell => cell.getBoundingClientRect().width) }));
    const observations: unknown[] = [];
    for (const task of [state.tasks[1], state.tasks[4]]) {
      const row = frame.locator(`.wx-table-container .wx-row[data-id=":${task.taskId}"]`);
      const before = await observe(page, task.start!);
      await row.locator('[data-col-id=":projectDuration"]').click();
      await settle(page);
      const right = await observe(page, task.start!);
      expect(right.startVisible).toBe(true);
      expect(right.public.left).toBeGreaterThan(before.public.left);
      await row.locator('[data-col-id=":projectDuration"]').click();
      await settle(page);
      const alreadyVisible = await observe(page, task.start!);
      expect(alreadyVisible.startVisible).toBe(true);
      // Core may adjust its reveal padding; an already-visible start must remain
      // visible without a large navigation jump, rather than an exact pixel lock.
      expect(Math.abs(alreadyVisible.public.left - right.public.left)).toBeLessThanOrEqual(right.scale.cellWidth);
      const past = state.tasks[0];
      await frame.locator(`.wx-table-container .wx-row[data-id=":${past.taskId}"] [data-col-id=":projectDuration"]`).click();
      await settle(page);
      const left = await observe(page, past.start!);
      expect(left.startVisible).toBe(true);
      expect(left.public.left).toBeLessThan(right.public.left);
      observations.push({ hierarchy: task.parentExternalId ? "nested" : "root", before, right, alreadyVisible, left });
    }
    const final = await frame.evaluate(node => ({ instance: (node as HTMLElement).dataset.projectGanttApiInstance,
      scale: (node as HTMLElement).dataset.ganttScaleMode, rows: Array.from(node.querySelectorAll(".wx-table-container .wx-row")).map(row => row.getAttribute("data-id")),
      columns: Array.from(node.querySelectorAll(".wx-header .wx-cell")).map(cell => cell.getBoundingClientRect().width) }));
    expect(final).toEqual(initial);
    expect(state.project.revision).toBe(state.initialRevision);
    expect(state.posts).toHaveLength(0);
    expect(state.patchRequests).toHaveLength(0);
    await saveEvidence(info, `matrix-${editable ? "edit" : "ro"}-${scale}-${fullscreen ? "full" : "normal"}`, { observations, initial, final, mutationCount: state.posts.length + state.patchRequests.length });
  });
}

test("#514 pending peer wheel and rapid selections preserve latest actual user intent", async ({ page }, info) => {
  const { state, frame } = await fixture(page);
  await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  const chart = frame.locator(".wx-chart"), task = state.tasks[1];
  await chart.hover(); await page.mouse.wheel(120, 0);
  await expect.poll(async () => (await observe(page, task.start!)).public.left).toBe(120);
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  await expect(page.getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("tab", { name: "일정", exact: true }).evaluate(node => (node as HTMLElement).click());
  await chart.hover({ force: true }); await page.mouse.wheel(31, 0);
  // The browser can commit a native wheel after the first non-zero observation.
  // Observe the intended +31px DOM scroll before advancing the paused peer RAF.
  await expect.poll(async () => (await observe(page, task.start!)).dom.left).toBe(151);
  const wheel = await observe(page, task.start!);
  await page.clock.runFor(300);
  const afterWheel = await observe(page, task.start!);
  expect(afterWheel.public.left).toBe(wheel.dom.left);
  expect(afterWheel.dom.left).toBe(wheel.dom.left);
  expect(afterWheel.public.left).not.toBe(120);
  expect(afterWheel.dom.left).not.toBe(120);
  for (const selected of [state.tasks[1], state.tasks[0], state.tasks[4]]) {
    await frame.locator(`.wx-table-container .wx-row[data-id=":${selected.taskId}"] [data-col-id=":projectDuration"]`).click({ force: true });
  }
  const latest = await observe(page, state.tasks[4].start!);
  await page.clock.runFor(300);
  const settled = await observe(page, state.tasks[4].start!);
  expect(settled.startVisible).toBe(true);
  expect(settled.public.left).toBe(latest.public.left);
  expect(settled.dom.left).toBe(latest.dom.left);
  await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${state.tasks[4].taskId}"]`)).toHaveClass(/wx-selected/);
  await page.clock.resume();
  await saveEvidence(info, "pending-input", { wheel, afterWheel, latest, settled });
});

test("#514 pending peer restore expires when the Task filter source changes", async ({ page }, info) => {
  const { state, frame } = await fixture(page);
  await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  const task = state.tasks[1];
  await frame.locator(".wx-chart").hover(); await page.mouse.wheel(120, 0);
  await expect.poll(async () => (await observe(page, task.start!)).public.left).toBe(120);
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  await expect(page.getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("tab", { name: "일정", exact: true }).evaluate(node => (node as HTMLElement).click());
  await page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true }).fill(task.name);
  await frame.locator(`.wx-table-container .wx-row[data-id=":${task.taskId}"] [data-col-id=":projectDuration"]`).click({ force: true });
  const immediate = await observe(page, task.start!);
  await page.clock.runFor(300);
  const settled = await observe(page, task.start!);
  expect(settled.startVisible).toBe(true);
  expect(settled.public.left).toBe(immediate.public.left);
  expect(settled.dom.left).toBe(immediate.dom.left);
  expect(settled.public.left).not.toBe(120);
  await page.clock.resume();
  await saveEvidence(info, "pending-source-filter", { immediate, settled, filter: task.name });
});

test("#514 reveal retains context-menu, modifier and keyboard selection semantics", async ({ page }, info) => {
  const { state, frame } = await fixture(page, true);
  const past = state.tasks[0], future = state.tasks[1], nested = state.tasks[4];
  const row = (id: string) => frame.locator(`.wx-table-container .wx-row[data-id=":${id}"]`);
  const menu = page.getByRole("menu", { name: "작업 메뉴", exact: true });
  const evidence: unknown[] = [];
  const before = await observe(page, future.start!);
  await row(future.taskId).locator(".wx-text").click({ button: "right" });
  await expect(menu).toBeVisible(); await settle(page);
  const contextBeforeReveal = await observe(page, future.start!);
  expect(contextBeforeReveal.public.left).toBe(before.public.left);
  expect(contextBeforeReveal.dom.left).toBe(before.dom.left);
  await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0);
  await row(future.taskId).locator('[data-col-id=":projectDuration"]').click(); await settle(page);
  const revealed = await observe(page, future.start!); expect(revealed.startVisible).toBe(true);
  await row(past.taskId).locator(".wx-text").click({ button: "right" });
  await expect(menu).toBeVisible(); await settle(page);
  const contextAfterReveal = await observe(page, future.start!);
  expect(contextAfterReveal.public.left).toBe(revealed.public.left);
  expect(contextAfterReveal.dom.left).toBe(revealed.dom.left);
  await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0);
  evidence.push({ before, contextBeforeReveal, revealed, contextAfterReveal });
  for (const [modifier, task] of [["Control", future], ["Meta", nested]] as const) {
    const prior = await observe(page, future.start!);
    await row(task.taskId).locator(".wx-text").click({ modifiers: [modifier] }); await settle(page);
    const after = await observe(page, future.start!);
    expect(after.public.left).toBe(prior.public.left);
    expect(after.dom.left).toBe(prior.dom.left);
    await expect(row(task.taskId).locator("input[data-copy-selection]")).toBeChecked();
    evidence.push({ modifier, prior, after });
  }
  await row(past.taskId).locator(".wx-text").click({ modifiers: ["Shift"] });
  // The previous anchor was nested under another parent: existing Shift
  // semantics intentionally fall back to this single root, rather than range.
  await expect(row(past.taskId).locator("input[data-copy-selection]")).toBeChecked();
  await expect(row(future.taskId).locator("input[data-copy-selection]")).not.toBeChecked();
  await row(future.taskId).locator(".wx-text").click({ modifiers: ["Shift"] });
  const checkbox = row(future.taskId).locator("input[data-copy-selection]");
  await expect(checkbox).toBeChecked();
  const priorKeyboard = await observe(page, future.start!);
  await checkbox.focus(); await page.keyboard.press("Space");
  await expect(checkbox).not.toBeChecked(); await settle(page);
  const afterKeyboard = await observe(page, future.start!);
  expect(afterKeyboard.public.left).toBe(priorKeyboard.public.left);
  expect(afterKeyboard.dom.left).toBe(priorKeyboard.dom.left);
  await page.keyboard.press("Escape"); await expect(checkbox).toBeFocused();
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  evidence.push({ priorKeyboard, afterKeyboard });
  await saveEvidence(info, "selection-context-guards", { observations: evidence });
});

test("#514 narrow logical viewport smoke and three-wide page start reveal geometry", async ({ page }, info) => {
  const { state, frame } = await fixture(page);
  // Expose both native panes using supported UI before the narrow-width smoke.
  // The default 480px Grid intentionally sits in a horizontally scrolling
  // work area; it cannot expose the Chart simultaneously at 390px.
  const splitter = frame.locator(".wx-resizer.wx-resizer-display-all").first();
  const split = await splitter.boundingBox();
  expect(split).not.toBeNull();
  await page.mouse.move(split!.x + split!.width / 2, split!.y + 20);
  await page.mouse.down();
  await page.mouse.move(split!.x + split!.width / 2 - 330, split!.y + 20, { steps: 8 });
  await page.mouse.up();
  const observations = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    // Chromium cannot resize a fullscreen browser window with setViewportSize.
    // Resize in normal mode, then exercise the same supported fullscreen UI.
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("project-gantt-frame"))).toBe(true);
    await settle(page);
    for (const task of [state.tasks[1], state.tasks[0]]) {
      const row = frame.locator(`.wx-table-container .wx-row[data-id=":${task.taskId}"]`);
      // On narrow layouts the period column is horizontally outside the Grid
      // viewport; use the actual visible identity cell rather than a clipped cell.
      {
        const name = row.locator('[data-col-id=":text"]');
        const bounds = await name.boundingBox(), grid = await frame.locator(".wx-table-container").boundingBox();
        expect(bounds).not.toBeNull(); expect(grid).not.toBeNull();
        const left = Math.max(bounds!.x, grid!.x), right = Math.min(bounds!.x + bounds!.width, grid!.x + grid!.width);
        expect(right - left).toBeGreaterThan(0);
        const hit = await page.evaluate(({ x, y }) => ({ node: document.elementFromPoint(x, y)?.outerHTML.slice(0, 350), scrollY, viewportHeight: innerHeight }), { x: (left + right) / 2, y: bounds!.y + bounds!.height / 2 });
        observations.push({ width, targetGeometry: { bounds, grid, hit, nativePoint: { x: (left + right) / 2, y: bounds!.y + bounds!.height / 2 } } });
        await saveEvidence(info, "five-widths", { observations });
        // The clipped label's center can be under the Chart. Click its actual
        // visible intersection with the Grid using a real pointer event.
        await page.mouse.click((left + right) / 2, bounds!.y + bounds!.height / 2);
      }
      await expect(row).toHaveClass(/wx-selected/);
      await settle(page);
      const result = await observe(page, task.start!);
      observations.push({ width, taskId: task.taskId, result });
      await saveEvidence(info, "five-widths", { observations });
      expect(result.startVisible).toBe(true);
      expect(result.chartWidth).toBeGreaterThan(0);
      expect(result.geometry.chart.left).toBeLessThan(width);
      const actualStart = result.geometry.chart.left + result.startX - result.public.left;
      expect(actualStart).toBeGreaterThanOrEqual(result.geometry.chart.left);
      if (width >= 1024) expect(actualStart).toBeLessThan(Math.min(width, result.geometry.chart.right));
      observations.push({ width, actualStart, pageStartVisible: actualStart < Math.min(width, result.geometry.chart.right),
        scope: width <= 768 ? "Core logical viewport smoke; existing minWidth720 workarea, automatic page intersection not claimed" : "Core and page intersection reveal" });
    }
    // Restore normal window bounds before the next viewport change.
    await page.evaluate(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    });
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  }
  await saveEvidence(info, "five-widths", { observations });
});

test("#514 native Grid pointer reveals canonical Task start in both horizontal directions", async ({ page }, info) => {
  const { state, frame } = await fixture(page);
  const observations: unknown[] = [];
  const instance = await frame.getAttribute("data-project-gantt-api-instance");
  try {
    const future = state.tasks[1];
    const beforeFuture = await observe(page, future.start!);
    expect(beforeFuture.startVisible).toBe(false);
    await frame.locator(`.wx-table-container .wx-row[data-id=":${future.taskId}"] [data-col-id=":projectDuration"]`).click();
    await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${future.taskId}"]`)).toHaveClass(/wx-selected/);
    await frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const afterFuture = await observe(page, future.start!);
    observations.push({ direction: "future", target: { taskId: future.taskId, start: future.start }, before: beforeFuture, after: afterFuture });
    expect.soft(afterFuture.startVisible).toBe(true);
    expect.soft(afterFuture.public.left).toBeGreaterThan(beforeFuture.public.left);
    const chart = frame.locator(".wx-chart");
    await chart.hover(); await page.mouse.wheel(6000, 0);
    await expect.poll(async () => (await observe(page, state.tasks[0].start!)).public.left).toBeGreaterThan(0);
    const past = state.tasks[0], beforePast = await observe(page, past.start!);
    expect(beforePast.startVisible).toBe(false);
    await frame.locator(`.wx-table-container .wx-row[data-id=":${past.taskId}"] .wx-text`).click();
    await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${past.taskId}"]`)).toHaveClass(/wx-selected/);
    await frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const afterPast = await observe(page, past.start!);
    observations.push({ direction: "past", target: { taskId: past.taskId, start: past.start }, before: beforePast, after: afterPast });
    expect.soft(afterPast.startVisible).toBe(true);
    expect.soft(afterPast.public.left).toBeLessThan(beforePast.public.left);
    await chart.hover(); await page.mouse.wheel(6000, 0);
    await expect.poll(async () => (await observe(page, state.tasks[2].start!)).public.left).toBeGreaterThan(0);
    const long = state.tasks[2], beforeLong = await observe(page, long.start!);
    expect(beforeLong.startVisible).toBe(false);
    const overlap = await frame.evaluate((node, taskId) => {
      const chart = node.querySelector(".wx-chart")!.getBoundingClientRect();
      const bar = node.querySelector<HTMLElement>(`.wx-bar[data-task-id=":${taskId}"]`);
      if (!bar) return null;
      const b = bar.getBoundingClientRect();
      return { left: b.left, right: b.right, chartLeft: chart.left, chartRight: chart.right, overlaps: b.left < chart.right && b.right > chart.left };
    }, long.taskId);
    await frame.locator(`.wx-table-container .wx-row[data-id=":${long.taskId}"] [data-col-id=":projectDuration"]`).click();
    await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${long.taskId}"]`)).toHaveClass(/wx-selected/);
    await frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const afterLong = await observe(page, long.start!);
    observations.push({ direction: "long-overlap", target: { taskId: long.taskId, start: long.start, end: long.end }, overlap, before: beforeLong, after: afterLong });
    expect.soft(afterLong.startVisible).toBe(true);
    expect.soft(afterLong.public.left).toBeLessThan(beforeLong.public.left);
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
    expect(state.project.revision).toBe(state.initialRevision);
  } finally {
    const sourcePaths = ["src/features/gantt/project-gantt.tsx", "tests/e2e/grid-task-start-reveal.spec.ts"];
    const hashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
    const evidence = { capturedAt: new Date().toISOString(), environment: "Next16.3.8/Core2.7.3; actual pointer with mocked canonical API fixture", observations, sourceHashes: hashes };
    await info.attach("grid-start-reveal", { body: JSON.stringify(evidence), contentType: "application/json" });
    if (process.env.CAPTURE_ISSUE_514) {
      const output = `output/playwright/issue-514/${process.env.CAPTURE_ISSUE_514}`;
      await mkdir(output, { recursive: true });
      await writeFile(`${output}/observations.json`, JSON.stringify(evidence, null, 2));
      await page.screenshot({ path: `${output}/grid.png`, fullPage: false });
    }
  }
});


test("#514 before editable name pointer observes native selection and inline editor reveal", async ({ page }, info) => {
  const { state, frame } = await fixture(page, true);
  const task = state.tasks[1], before = await observe(page, task.start!);
  expect(before.startVisible).toBe(false);
  await frame.locator(`.wx-table-container .wx-row[data-id=":${task.taskId}"] .wx-text`).click();
  await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${task.taskId}"]`)).toHaveClass(/wx-selected/);
  await frame.evaluate(() => new Promise<void>(resolve => { let remaining = 8; const next = () => --remaining ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); }));
  const after = await observe(page, task.start!);
  const evidence = { capturedAt: new Date().toISOString(), before, after, target: { taskId: task.taskId, start: task.start },
    sourceHashes: Object.fromEntries(await Promise.all(["src/features/gantt/project-gantt.tsx", "tests/e2e/grid-task-start-reveal.spec.ts"].map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")]))),
    inlineInputs: await frame.locator('input').count() };
  await info.attach("editable-name-reveal", { body: JSON.stringify(evidence), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_514) {
    const output = `output/playwright/issue-514/${process.env.CAPTURE_ISSUE_514}`; await mkdir(output, { recursive: true });
    await writeFile(`${output}/editable-name.json`, JSON.stringify(evidence, null, 2)); await page.screenshot({ path: `${output}/editable-name.png`, fullPage: false });
  }
  expect(after.startVisible).toBe(true);
  expect(after.public.left).toBeGreaterThan(before.public.left);
});


test("#514 before Week fullscreen nested reveal and null Summary selection", async ({ page }, info) => {
  const { state, frame } = await fixture(page);
  await page.getByRole("button", { name: "주", exact: true }).click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  await page.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("project-gantt-frame"))).toBe(true);
  const nested = state.tasks[4], beforeNested = await observe(page, nested.start!);
  expect(beforeNested.startVisible).toBe(false);
  await frame.locator(`.wx-table-container .wx-row[data-id=":${nested.taskId}"] [data-col-id=":projectDuration"]`).click();
  await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${nested.taskId}"]`)).toHaveClass(/wx-selected/);
  await frame.evaluate(() => new Promise<void>(resolve => { let remaining = 8; const next = () => --remaining ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); }));
  const afterNested = await observe(page, nested.start!);
  expect.soft(afterNested.startVisible).toBe(true);
  const empty = state.tasks[5], beforeEmpty = await observe(page, state.tasks[0].start!);
  expect(beforeEmpty.public.left).toBeGreaterThan(0);
  await frame.locator(`.wx-table-container .wx-row[data-id=":${empty.taskId}"] [data-col-id=":projectDuration"]`).click();
  await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${empty.taskId}"]`)).toHaveClass(/wx-selected/);
  await frame.evaluate(() => new Promise<void>(resolve => { let remaining = 8; const next = () => --remaining ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); }));
  const afterEmpty = await observe(page, state.tasks[0].start!);
  const evidence = { capturedAt: new Date().toISOString(), beforeNested, afterNested, beforeEmpty, afterEmpty, target: { taskId: empty.taskId, canonicalStart: empty.start },
    sourceHashes: Object.fromEntries(await Promise.all(["src/features/gantt/project-gantt.tsx", "tests/e2e/grid-task-start-reveal.spec.ts"].map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")]))), };
  await info.attach("week-nested-null-reveal", { body: JSON.stringify(evidence), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_514) {
    const output = `output/playwright/issue-514/${process.env.CAPTURE_ISSUE_514}`; await mkdir(output, { recursive: true });
    await writeFile(`${output}/week-nested-null.json`, JSON.stringify(evidence, null, 2)); await page.screenshot({ path: `${output}/week-nested-null.png`, fullPage: false });
  }
  expect(afterEmpty.public.left).toBe(beforeEmpty.public.left);
  expect(afterEmpty.dom.left).toBe(beforeEmpty.dom.left);
});


test("#514 before pending peer restore must not overwrite native Grid Task start reveal", async ({ page }, info) => {
  const { state, frame } = await fixture(page);
  await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  const task = state.tasks[1], chart = frame.locator(".wx-chart");
  await chart.hover(); await page.mouse.wheel(120, 0);
  await expect.poll(async () => (await observe(page, task.start!)).public.left).toBe(120);
  const beforePeer = await observe(page, task.start!);
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  await expect(page.getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("tab", { name: "일정", exact: true }).evaluate(node => (node as HTMLElement).click());
  await expect(frame).toBeVisible();
  await frame.locator(`.wx-table-container .wx-row[data-id=":${task.taskId}"] [data-col-id=":projectDuration"]`).click({ force: true });
  await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${task.taskId}"]`)).toHaveClass(/wx-selected/);
  const immediate = await observe(page, task.start!);
  await page.clock.runFor(300);
  const settled = await observe(page, task.start!);
  await page.clock.resume();
  const evidence = { capturedAt: new Date().toISOString(), timerControl: "paused pending peer RAF; native forced pointer event (not DOM click) then run300ms", beforePeer, immediate, settled,
    sourceHashes: Object.fromEntries(await Promise.all(["src/features/gantt/project-gantt.tsx", "src/features/projects/project-readonly-view.tsx", "tests/e2e/grid-task-start-reveal.spec.ts"].map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")]))), };
  await info.attach("pending-peer-reveal", { body: JSON.stringify(evidence), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_514) {
    const output = `output/playwright/issue-514/${process.env.CAPTURE_ISSUE_514}`; await mkdir(output, { recursive: true });
    await writeFile(`${output}/pending-peer.json`, JSON.stringify(evidence, null, 2)); await page.screenshot({ path: `${output}/pending-peer.png`, fullPage: false });
  }
  expect(immediate.startVisible).toBe(true);
  expect(settled.startVisible).toBe(true);
  expect(settled.public.left).toBe(immediate.public.left);
  expect(settled.dom.left).toBe(immediate.dom.left);
});
