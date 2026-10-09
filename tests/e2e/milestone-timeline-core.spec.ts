import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { installStatefulProjectFixture, publicId, projectPath } from "../fixtures/stateful-project";
import { dashboardFixture } from "../fixtures/milestone-dashboard";

test.use({ timezoneId: "America/New_York" });

interface Observation { gridWidth: number; instance: string; left: number; top: number; start: Date; end: Date; width: number; chartWidth: number; rows: { id: string; x: number; y: number }[]; links: { id: string; source: string; target: string; type: string }[]; canonicalIds: string[]; events: { action: string; left: number; top: number }[]; }
async function probe<T>(frame: Locator, method: string, argument?: unknown): Promise<T> {
  return frame.evaluate(async (node, input) => {
    const api = Reflect.get(node, "__masterganttMilestoneTimeline");
    return api[input.method](input.argument);
  }, { method, argument });
}
async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => { let n = 5; const tick = () => --n ? requestAnimationFrame(tick) : resolve(); requestAnimationFrame(tick); }));
}
async function fixture(page: Page, kind: "mixed" | "milestone-only" | "empty" = "mixed") {
  const state = await installStatefulProjectFixture(page); state.sessionEditable = false;
  const base = state.tasks[1];
  const task = (n: number, externalId: string, type: "task" | "summary" | "milestone", date: string | null, parentExternalId: string | null = null) => ({ ...base,
    taskId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, externalId, name: externalId, type, parentExternalId, siblingOrder: n,
    start: date, end: date, requestedStart: type === "summary" ? null : date, duration: date === null ? null : type === "milestone" ? 0 : 1, progress: date === null ? null : 0 });
  const tasks = kind === "empty" ? [] : kind === "milestone-only" ? [task(1, "M-only", "milestone", "2026-03-10")] : [
    task(1, "S1", "summary", "2024-02-29"), task(2, "T-leap", "task", "2024-02-29", "S1"),
    task(3, "M-leap", "milestone", "2024-02-29", "S1"), task(4, "LEAF-1", "task", "2026-01-31", "S1"),
    task(5, "S2", "summary", "2026-03-10"), task(6, "T-DST", "task", "2026-03-10", "S2"),
    task(7, "T-year", "task", "2027-01-01", "S2"), task(8, "M-DST", "milestone", "2026-03-10", "S2"),
    task(9, "M-year", "milestone", "2027-01-01"), task(10, "S-empty", "summary", null),
  ];
  state.tasks.splice(0, state.tasks.length, ...tasks);
  if (kind === "mixed") state.links.push(
    { id: "TT", predecessorExternalId: "T-DST", successorExternalId: "T-year", type: "FS", lag: 0 },
    { id: "MM", predecessorExternalId: "M-leap", successorExternalId: "M-DST", type: "FS", lag: 0 },
    { id: "legacy", predecessorExternalId: "M-DST", successorExternalId: "T-year", type: "FS", lag: 0, legacyMixed: true });
  if (kind === "mixed") await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  // These unrelated report fixtures require a nonempty ordinary Task. Keep
  // their inactive requests bounded without inventing Tasks in zero-row cases.
  if (kind !== "mixed") await page.route(`**${projectPath}/resource-dashboard*`, route => route.fulfill({ status: 503, json: { error: { code: "SYNTHETIC_REPORT_UNAVAILABLE" } } }));
  if (kind !== "mixed") await page.route(`**${projectPath}/assigned-targets`, route => route.fulfill({ json: { data: { projectRevision: state.project.revision, catalogRevision: 1, assignments: [], targets: [] } } }));
  await page.route(`**${projectPath}/logistics/dashboard*`, route => route.fulfill({ status: 503, json: { error: { code: "SYNTHETIC_REPORT_UNAVAILABLE" } } }));
  await page.goto(`/projects/${publicId}`);
  const frame = page.locator(".project-gantt-frame");
  await expect.poll(() => frame.evaluate(node => Boolean(Reflect.get(node, "__masterganttMilestoneTimeline")))).toBe(true);
  await settle(page);
  return { state, frame };
}
async function evidence(info: TestInfo, name: string, data: object, page: Page) {
  const sourcePaths = ["src/features/gantt/milestone-timeline-adapter.ts", "src/features/gantt/project-gantt.tsx", "tests/e2e/milestone-timeline-core.spec.ts"];
  const payload = { capturedAt: new Date().toISOString(), baseline: "dca2f7821f277ef31ee3dbcbdc1e51ad257209f0", core: "2.7.3", store: "2.7.2", environment: "Chromium/Next dev, synthetic mocked canonical API", ...data,
    sourceHashes: Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")]))) };
  await info.attach(name, { body: JSON.stringify(payload), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_549) {
    const directory = `output/playwright/issue-549/${process.env.CAPTURE_ISSUE_549}`;
    await mkdir(directory, { recursive: true }); await writeFile(`${directory}/${name}.json`, JSON.stringify(payload, null, 2));
    await page.screenshot({ path: `${directory}/${name}.png` });
  }
}
async function geometry(frame: Locator) {
  return frame.evaluate(node => {
    const chart = node.querySelector<HTMLElement>(".wx-chart")!;
    return Array.from(node.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id]")).map(row => {
      const id = row.getAttribute("data-id"), bar = Array.from(node.querySelectorAll<HTMLElement>(".wx-bar[data-task-id]")).find(el => el.getAttribute("data-task-id") === id);
      const a = row.getBoundingClientRect(), b = bar?.getBoundingClientRect();
      return { id, rowCenter: a.y + a.height / 2, barCenter: b ? b.y + b.height / 2 : null,
        contentX: b ? b.x - chart.getBoundingClientRect().x + chart.scrollLeft : null };
    });
  });
}

for (const width of [390, 768, 1024, 1440, 1920]) test(`#549 Core filter geometry/no-loss ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const { state, frame } = await fixture(page), before = await probe<Observation>(frame, "read"), canonical = JSON.stringify({ tasks: state.tasks, links: state.links });
  const ids = state.tasks.filter(task => task.type !== "milestone").map(task => task.taskId);
  await probe(frame, "filter", ids); await settle(page);
  const observations = [];
  for (const scale of ["day", "week"]) {
    await page.getByRole("button", { name: scale === "day" ? "일" : "주", exact: true }).click(); await settle(page);
    // Scale rerenders must retain the same filtered rows and public instance.
    expect((await probe<Observation>(frame, "read")).rows.map(row => row.id)).toEqual(ids);
    for (const task of state.tasks.filter(task => task.type === "task")) {
      await probe(frame, "reveal", task.start); await settle(page);
      const coordinate = await probe<{ contentX: number; visible: boolean }>(frame, "coordinate", task.start);
      const measured = (await geometry(frame)).find(row => row.id === `:${task.taskId}`)!;
      expect(coordinate.visible).toBe(true);
      expect(Math.abs(measured.contentX! - coordinate.contentX)).toBeLessThanOrEqual(1);
      expect(Math.abs(measured.rowCenter - measured.barCenter!)).toBeLessThanOrEqual(1);
      observations.push({ scale, date: task.start, coordinate, measured });
    }
    const measuredRows = await geometry(frame);
    expect(measuredRows.map(row => row.id)).toEqual(ids.map(id => `:${id}`));
    for (const row of measuredRows.filter(row => row.barCenter !== null)) expect(Math.abs(row.rowCenter - row.barCenter!)).toBeLessThanOrEqual(1);
    for (const hidden of state.tasks.filter(task => task.type === "milestone")) await expect(frame.locator(`.wx-bar[data-task-id=":${hidden.taskId}"]`)).toHaveCount(0);
    await expect(frame.locator('.wx-links [data-link-id=":TT"]')).toHaveCount(1);
    await expect(frame.locator('.wx-links [data-link-id=":MM"],.wx-links [data-link-id=":legacy"]')).toHaveCount(0);
  }
  const after = await probe<Observation>(frame, "read");
  expect(after.instance).toBe(before.instance); expect(after.links).toEqual(before.links); expect(after.canonicalIds).toEqual(before.canonicalIds);
  expect(JSON.stringify({ tasks: state.tasks, links: state.links })).toBe(canonical);
  expect(state.patchRequests).toHaveLength(0); expect(state.posts).toHaveLength(0);
  await evidence(info, `geometry-${width}`, { before, after, observations, mutationCount: 0 }, page);
  await probe(frame, "filter", null); await settle(page);
  expect((await probe<Observation>(frame, "read")).rows).toHaveLength(state.tasks.length);
});

test("#549 DST reveal uses the same calendar-day geometry as native Task bars", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { frame } = await fixture(page);
  const observations = [];
  for (const scale of ["day", "week"]) {
    await page.getByRole("button", { name: scale === "day" ? "일" : "주", exact: true }).click(); await settle(page);
    const coordinate = await probe<{ contentX: number }>(frame, "coordinate", "2026-03-10");
    await probe(frame, "nativeDateReveal", "2026-03-10"); await settle(page);
    const native = await probe<Observation>(frame, "read");
    await probe(frame, "scroll", 0); await probe(frame, "reveal", "2026-03-10"); await settle(page);
    const corrected = await probe<Observation>(frame, "read");
    expect(Math.abs(corrected.left - coordinate.contentX)).toBeLessThanOrEqual(1);
    const left = corrected.left; await probe(frame, "reveal", "2026-03-10"); await settle(page);
    expect((await probe<Observation>(frame, "read")).left).toBe(left);
    observations.push({ scale, coordinate, native, corrected, nativeError: native.left - coordinate.contentX });
  }
  await evidence(info, "DST-reveal", { observations }, page);
});

for (const kind of ["milestone-only", "empty"] as const) test(`#549 ${kind} date axis remains distinct from row emptiness`, async ({ page }, info) => {
  const { state, frame } = await fixture(page, kind), before = await probe<Observation>(frame, "read");
  await probe(frame, "filter", []); await settle(page);
  const after = await probe<Observation>(frame, "read");
  expect(after.rows).toHaveLength(0); expect(after.width).toBeGreaterThan(0); expect(after.chartWidth).toBeGreaterThan(0);
  expect(after.start).toEqual(before.start);
  // Existing #367 may extend the right buffer after scrollbar geometry changes;
  // filtering must retain the axis, never shrink its canonical date coverage.
  expect(after.end.getTime()).toBeGreaterThanOrEqual(before.end.getTime()); expect(after.instance).toBe(before.instance);
  let coordinateAfter = null;
  if (kind === "milestone-only") {
    expect(await probe(frame, "reveal", state.tasks[0].start)).toBe(true); await settle(page);
    coordinateAfter = await probe<{ insideRange: boolean; visible: boolean }>(frame, "coordinate", state.tasks[0].start);
    expect(coordinateAfter.insideRange).toBe(true); expect(coordinateAfter.visible).toBe(true);
  }
  expect(after.canonicalIds).toEqual(before.canonicalIds); expect(after.links).toEqual(before.links);
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0); expect(state.project.revision).toBe(state.initialRevision);
  await evidence(info, kind, { before, after, population: state.tasks.length, coordinateAfter, mutationCount: 0 }, page);
});

test("#549 public event order/resize/columns/fullscreen/peer return retain filtered instance", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); const { state, frame } = await fixture(page);
  const ids = state.tasks.filter(task => task.type !== "milestone").map(task => task.taskId);
  await probe(frame, "filter", ids); await probe(frame, "reveal", "2026-03-10"); await settle(page);
  const before = await probe<Observation>(frame, "read");
  const header = frame.locator(".wx-header").getByText("작업", { exact: true }).locator("..");
  const columnBefore = (await header.boundingBox())!.width, grip = (await header.locator(".wx-grip").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(grip.x + 48, grip.y + grip.height / 2, { steps: 6 }); await page.mouse.up();
  expect((await header.boundingBox())!.width).toBeGreaterThan(columnBefore + 20);
  const splitter = frame.locator(".wx-resizer.wx-resizer-display-all").first(), box = (await splitter.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 20); await page.mouse.down(); await page.mouse.move(box.x + 48, box.y + 20, { steps: 6 }); await page.mouse.up();
  await settle(page); const resized = await probe<Observation>(frame, "read"); expect(resized.gridWidth ?? 0).not.toBe(before.gridWidth);
  await page.setViewportSize({ width: 1024, height: 1000 }); await settle(page);
  await page.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click(); await settle(page);
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click(); await settle(page);
  const peerBefore = await probe<Observation>(frame, "read");
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  await page.getByRole("tab", { name: "일정", exact: true }).click(); await settle(page);
  const peerAfter = await probe<Observation>(frame, "read");
  expect(Math.abs(peerAfter.left - peerBefore.left)).toBeLessThanOrEqual(1);
  expect(peerAfter.instance).toBe(before.instance); expect(peerAfter.rows.map(row => row.id)).toEqual(ids);
  expect(peerAfter.links).toEqual(before.links);
  // #530 protects a just-restored peer viewport against stale programmatic
  // scroll-chart commands. A trusted wheel inside the Chart is a new user
  // intent and releases that guard before the synthetic right-edge probe.
  await frame.locator(".wx-chart").hover();
  await page.mouse.wheel(31, 0);
  await probe(frame, "scroll", peerAfter.width - peerAfter.chartWidth);
  // #367 schedules extension on a requestAnimationFrame after Core scroll.
  // Preserve the real extension assertion; do not assume five RAFs always
  // include both the Core event and the new scale commit.
  await expect.poll(
    async () => (await probe<Observation>(frame, "read")).width,
    { message: "timeline extends near its right edge after a trusted user wheel", timeout: 10_000 },
  ).toBeGreaterThan(peerAfter.width);
  await settle(page);
  const after = await probe<Observation>(frame, "read");
  expect(after.instance).toBe(before.instance);
  expect(after.rows.map(row => row.id)).toEqual(ids);
  expect(after.links).toEqual(before.links);
  expect(after.canonicalIds).toEqual(before.canonicalIds);
  expect(after.events.some(event => event.action === "filter-tasks")).toBe(true);
  expect(after.events.some(event => event.action === "resize-chart")).toBe(true);
  expect(after.events.some(event => event.action === "scroll-chart")).toBe(true);
  expect(state.patchRequests).toHaveLength(0); expect(state.posts).toHaveLength(0);
  await evidence(info, "viewport-events", { before, resized, peerBefore, peerAfter, after, mutationCount: 0 }, page);
});
