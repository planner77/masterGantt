import type { Locator, Page, Route } from "@playwright/test";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { readBrowserCanonicalSnapshot } from "./helpers/browser-canonical-snapshot";
import { gridOrder, seedReorderProject, taskRow } from "./helpers/grid-task-reorder";
import { chooseTaskInformation, taskInformationDialog } from "./helpers/task-context-menu";

test.use({ ...isolatedApplicationOptions, viewport: { width: 1440, height: 1000 } });

async function openEditor(page: Page, name: string) {
  await taskRow(page, name).click({ button: "right", position: { x: 12, y: 19 } });
  await chooseTaskInformation(page);
  return taskInformationDialog(page);
}

for (const frameDelay of [0, 90]) {
  test(`SC-01 Editor 동일 Revision 재조회는 새 관측과 같은 semantic receipt만 만든다${frameDelay ? " — 실제 RAF 90ms 지연" : ""}`, async ({ page, baseURL, observeIsolatedApi }, info) => {
  const { api, project } = await seedReorderProject(page, baseURL!);
  await page.goto(`/projects/${project.publicId}?__coreTrace=1`);
  const frame = page.locator(".project-gantt-frame");
  await expect(taskRow(page, "Task B")).toBeVisible();
  const editor = await openEditor(page, "Task B");
  if (frameDelay) await page.evaluate(delay => {
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    let serial = 0;
    const pending = new Map<number, { timer: number; raf?: number }>();
    window.requestAnimationFrame = callback => {
      const id = --serial, entry = { timer: 0, raf: undefined as number | undefined };
      pending.set(id, entry);
      entry.timer = window.setTimeout(() => {
        entry.raf = request(timestamp => { pending.delete(id); callback(timestamp); });
      }, delay);
      return id;
    };
    window.cancelAnimationFrame = id => {
      const entry = pending.get(id);
      if (!entry) { cancel(id); return; }
      clearTimeout(entry.timer); if (entry.raf !== undefined) cancel(entry.raf); pending.delete(id);
    };
    Reflect.set(window, "__issue667RestoreAnimationFrames", () => {
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel;
      for (const entry of pending.values()) { clearTimeout(entry.timer); if (entry.raf !== undefined) cancel(entry.raf); }
      pending.clear();
    });
  }, frameDelay);
  try {
  const identity = await frame.getAttribute("data-project-gantt-api-instance");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const receipt = async () => {
    const value = await frame.getAttribute("data-gantt-semantic-projection-receipt");
    return value ? JSON.parse(value) as { semanticId: number; observation: number } : null;
  };
  await expect.poll(receipt).not.toBeNull();
  // Opening the context menu changes selection and the Editor installs its
  // mutation lock. Establish that in-modal source before comparing equivalent
  // reloads; the initial page receipt can predate these real semantic changes.
  const initialObservation = (await receipt())!.observation;
  const establishRead = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === api);
  await editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
  expect((await establishRead).status()).toBe(200);
  await expect(editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true })).toBeEnabled();
  await expect.poll(async () => (await receipt())?.observation).not.toBe(initialObservation);
  const before = (await receipt())!;
  const canonical = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi);
  await frame.evaluate((node) => Reflect.get(node, "__issue568Trace").configure("issue667", "local", "same-revision-editor-reload"));
  const freshRead = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === api);
  await editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
  expect((await freshRead).status()).toBe(200);
  await expect(editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true })).toBeEnabled();
  await expect.poll(async () => (await receipt())?.observation).not.toBe(before.observation);
  expect((await receipt())?.semanticId).toBe(before.semanticId);
  const trace = await frame.evaluate((node) => Reflect.get(node, "__issue568Trace").snapshot()) as { entries: { event: string; action: string }[] };
  const writes = ["update-task", "add-task", "delete-task", "move-task", "add-link", "update-link", "delete-link", "filter-tasks", "scroll-chart", "resize-chart", "set-columns"];
  expect(trace.entries.filter((entry) => entry.event === "core-after" && writes.includes(entry.action))).toEqual([]);
  expect(await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi)).toEqual(canonical);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", identity!);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await info.attach("same-revision-editor-trace", { body: JSON.stringify({ before, after: await receipt(), trace }), contentType: "application/json" });
  await editor.getByRole("button", { name: "취소", exact: true }).click();
  await expect(editor).toHaveCount(0);
  } finally {
    try {
    await info.attach("projection-observation-outcome", { body: JSON.stringify({ frameDelay,
      stage: await frame.getAttribute("data-gantt-projection-observation"),
      receipt: await frame.getAttribute("data-gantt-semantic-projection-receipt") }), contentType: "application/json" });
    } finally {
      if (frameDelay) await page.evaluate(() => { Reflect.get(window, "__issue667RestoreAnimationFrames")(); Reflect.deleteProperty(window, "__issue667RestoreAnimationFrames"); });
    }
  }
});
}

test("SC-05 Editor commit 뒤 500·GET 실패는 초안을 보존하고 명시 재조회로만 복구한다", async ({ page, baseURL, observeIsolatedApi }, info) => {
  const { api, snapshot } = await seedReorderProject(page, baseURL!);
  const task = snapshot.data.tasks.find((entry) => entry.name === "Task B")!;
  const frame = page.locator(".project-gantt-frame");
  const identity = await frame.getAttribute("data-project-gantt-instance");
  const apiIdentity = await frame.getAttribute("data-project-gantt-api-instance");
  const patchPath = `${api}/tasks/${task.taskId}`;
  const patches: { body: unknown; revision: string | undefined }[] = [];
  let failedReads = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === patchPath)
      patches.push({ body: request.postDataJSON(), revision: request.headers()["if-match"] });
  });
  const commitThenFail = async (route: Route) => {
    if (route.request().method() !== "PATCH") { await route.continue(); return; }
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR" } } });
  };
  const failRead = async (route: Route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    failedReads += 1;
    await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR" } } });
  };
  const editor = await openEditor(page, "Task B");
  await editor.getByLabel("작업명", { exact: true }).fill("Committed editor B");
  await page.route(`**${patchPath}`, commitThenFail);
  await page.route(`**${api}`, failRead);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => failedReads).toBeGreaterThanOrEqual(1);
  await expect(frame).toHaveAttribute("data-task-mutation-locked", "true");
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Committed editor B");
  await expect(editor).toContainText("저장 결과를 확인한 뒤 편집할 수 있습니다. 최신 정보를 다시 불러와 주세요.");
  await expect(editor).not.toContainText("편집 권한이 없습니다");
  // UNKNOWN makes the Editor read-only, which may remove its Save action.
  // Either rendering must expose no enabled mutation while recovery is pending.
  await expect(editor.getByRole("button", { name: "저장", exact: true }).and(editor.locator(":enabled"))).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "취소", exact: true })).toBeEnabled();
  const reload = editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true });
  await expect(reload).toBeEnabled();
  expect(patches).toEqual([{ body: { name: "Committed editor B" }, revision: `"${snapshot.data.project.revision}"` }]);

  // Failed canonical reads must not turn cancel/reload into pending actions.
  await editor.getByRole("button", { name: "취소", exact: true }).click();
  await expect(editor.getByText("저장하지 않은 변경사항을 버리고 닫을까요?", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Committed editor B");
  await reload.click();
  await expect(editor.getByText("저장하지 않은 변경사항을 버리고 최신 정보를 불러올까요?", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "계속 편집", exact: true }).click();
  await page.screenshot({ path: info.outputPath("editor-uncertain-recovery.png"), fullPage: true });
  await page.unroute(`**${api}`, failRead);
  await page.unroute(`**${patchPath}`, commitThenFail);
  await reload.click();
  await editor.getByRole("button", { name: "변경사항 버리고 다시 불러오기", exact: true }).click();
  // The open modal still owns the native Gantt edit lock. Recovery is proven
  // by the disappearance of its alert and re-enabled Editor save action.
  await expect(frame).toHaveAttribute("data-task-mutation-locked", "true");
  await expect(page.locator('[role="alert"]').filter({ hasText: "저장 결과를 확인할 수 없습니다. 초안은 유지되며" })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Committed editor B");
  expect(patches).toHaveLength(1);
  const recovered = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi) as ProjectSnapshotResponse;
  expect(recovered.data.project.revision).toBe(snapshot.data.project.revision + 1);
  expect(recovered.data.tasks).toEqual(snapshot.data.tasks.map((entry) => entry.taskId === task.taskId ? { ...entry, name: "Committed editor B" } : entry));
  expect(recovered.data.links).toEqual(snapshot.data.links);

  await editor.getByLabel("작업명", { exact: true }).fill("Intended next editor B");
  const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === patchPath);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(editor).toHaveCount(0);
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Intended next editor B", "Task C"]);
  expect(patches).toEqual([
    { body: { name: "Committed editor B" }, revision: `"${snapshot.data.project.revision}"` },
    { body: { name: "Intended next editor B" }, revision: `"${recovered.data.project.revision}"` },
  ]);
  const final = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi) as ProjectSnapshotResponse;
  expect(final.data.project.revision).toBe(recovered.data.project.revision + 1);
  expect(final.data.tasks).toEqual(recovered.data.tasks.map((entry) => entry.taskId === task.taskId ? { ...entry, name: "Intended next editor B" } : entry));
  expect(final.data.links).toEqual(recovered.data.links);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", identity!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiIdentity!);
});

interface AxisObservation {
  instance: string;
  width: number;
  chartWidth: number;
  left: number;
  top: number;
  canonicalIds: string[];
  rows: { id: string }[];
  links: { id: string; source: string; target: string; type: string }[];
}
async function readAxis(frame: Locator): Promise<AxisObservation> {
  return frame.evaluate((node) => Reflect.get(node, "__masterganttMilestoneTimeline").read());
}

for (const mutation of ["edit", "add"] as const) {
  test(`SC-09 실제 ${mutation} 성공 뒤 날짜축 확장은 canonical·접힘·선택을 보존한다`, async ({ page, baseURL, observeIsolatedApi }, info) => {
    const { api, snapshot: initial } = await seedReorderProject(page, baseURL!);
    let snapshot = initial;
    const add = async (name: string, parentTaskId?: string) => {
      const response = await page.request.post(`${api}/tasks`, {
        headers: { Origin: baseURL!, "If-Match": `"${snapshot.data.project.revision}"` },
        data: { name, type: "task", start: "2026-10-05", duration: 2, progress: 0, ...(parentTaskId ? { parentTaskId, convertParentToSummary: true } : {}) },
      });
      expect(response.status()).toBe(201);
      snapshot = await response.json() as TaskMutationResponse;
      return snapshot.data.tasks.find((entry) => entry.name === name)!;
    };
    const parent = await add("Axis parent");
    await add("Axis child", parent.taskId);
    const a = snapshot.data.tasks.find((entry) => entry.name === "Task A")!;
    const c = snapshot.data.tasks.find((entry) => entry.name === "Task C")!;
    const linked = await page.request.post(`${api}/links`, {
      headers: { Origin: baseURL!, "If-Match": `"${snapshot.data.project.revision}"` },
      data: { predecessorExternalId: a.externalId, successorExternalId: c.externalId, type: "FS", lag: 0 },
    });
    expect(linked.status()).toBe(201);
    await page.reload();
    await expect(taskRow(page, "Axis child")).toBeVisible();
    const frame = page.locator(".project-gantt-frame");
    await expect.poll(() => frame.evaluate((node) => Boolean(Reflect.get(node, "__masterganttMilestoneTimeline")?.ready))).toBe(true);
    const identity = await frame.getAttribute("data-project-gantt-api-instance");
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith(`${api}/`) && ["POST", "PATCH", "DELETE"].includes(request.method()))
        mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });
    if (mutation === "edit") {
      const editor = await openEditor(page, "Task B");
      await editor.getByLabel("작업명", { exact: true }).fill("Axis confirmed B");
      await editor.getByRole("button", { name: "저장", exact: true }).click();
      await expect(editor).toHaveCount(0);
      await expect(taskRow(page, "Axis confirmed B")).toBeVisible();
    } else {
      const saved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/tasks`);
      await frame.locator('[data-action="add-task"]').first().click();
      expect((await saved).status()).toBe(201);
      await expect(taskRow(page, "새 작업")).toBeVisible();
    }
    expect(mutations).toHaveLength(1);
    await taskRow(page, "Axis parent").locator('[data-action="open-task"]').click();
    await expect(taskRow(page, "Axis child")).toHaveCount(0);
    await taskRow(page, "Task A").click({ button: "right", position: { x: 12, y: 19 } });
    await page.keyboard.press("Escape");
    const selected = () => frame.locator('.wx-row[data-copy-selected="true"]').evaluateAll((rows) => rows.map((row) => row.getAttribute("data-id")));
    const tree = () => frame.locator('[data-action="open-task"]').evaluateAll((nodes) => nodes.map((node) => ({ id: node.closest("[data-id]")?.getAttribute("data-id"), closed: node.classList.contains("wxi-menu-right") })));
    const canonical = await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi) as ProjectSnapshotResponse;
    const before = await readAxis(frame);
    const beforeNames = await gridOrder(page);
    const beforeSelected = await selected();
    const beforeTree = await tree();
    expect(beforeSelected).toEqual([`:${a.taskId}`]);
    expect(before.links).toHaveLength(1);
    const chart = frame.locator(".wx-chart");
    await chart.hover();
    await page.mouse.wheel(31, 0);
    await expect.poll(async () => {
      const state = await readAxis(frame);
      const native = await chart.evaluate((node) => node.scrollLeft);
      return state.left > before.left && Math.abs(native - state.left) <= 1;
    }, { message: "사용자 wheel이 Core와 native Chart에 반영된다" }).toBe(true);
    const wheel = await readAxis(frame);
    await frame.evaluate((node, left) => Reflect.get(node, "__masterganttMilestoneTimeline").scroll(left), wheel.width - wheel.chartWidth);
    await expect.poll(async () => (await readAxis(frame)).width, { message: "실제 날짜축이 우측 경계에서 확장된다", timeout: 10_000 }).toBeGreaterThan(before.width);
    const after = await readAxis(frame);
    expect(after.instance).toBe(before.instance);
    expect(after.canonicalIds).toEqual(canonical.data.tasks.map((entry) => entry.taskId));
    expect(after.rows.map((row) => row.id)).toEqual(before.rows.map((row) => row.id));
    expect(after.links).toEqual(before.links);
    expect(after.top).toBe(before.top);
    expect(after.left).toBeGreaterThan(wheel.left);
    expect(Math.abs(await chart.evaluate((node) => node.scrollLeft) - after.left)).toBeLessThanOrEqual(1);
    expect(await gridOrder(page)).toEqual(beforeNames);
    expect(await selected()).toEqual(beforeSelected);
    expect(await tree()).toEqual(beforeTree);
    await expect(taskRow(page, "Axis child")).toHaveCount(0);
    expect(await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi)).toEqual(canonical);
    expect(mutations).toHaveLength(1);
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", identity!);
    await info.attach(`axis-after-${mutation}`, { body: JSON.stringify({ before, after, canonical, mutations, beforeTree, beforeSelected }), contentType: "application/json" });
    await page.screenshot({ path: info.outputPath(`axis-after-${mutation}.png`), fullPage: true });
  });
}
