import type { Route } from "@playwright/test";
import type { ProjectSnapshotResponse } from "../../src/contracts/projects";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { gridOrder, renameInline, seedReorderProject, taskRow } from "./helpers/grid-task-reorder";

test.use({ ...isolatedApplicationOptions, viewport: { width: 1440, height: 1000 } });

for (const scenario of [
  { name: "서버 commit 뒤 응답 500", committed: true, network: false, unavailable: false },
  { name: "서버 commit 없는 응답 500", committed: false, network: false, unavailable: false },
  { name: "서버 commit 뒤 연결 단절", committed: true, network: true, unavailable: false },
  { name: "서버 commit 뒤 응답 500과 조회 실패", committed: true, network: false, unavailable: true },
] as const) {
  test(`SC-05 ${scenario.name}: 최신 서버 확인·재전송 0·같은 Core 인스턴스`, async ({ page, baseURL }, testInfo) => {
    const { api, snapshot } = await seedReorderProject(page, baseURL!);
    const task = snapshot.data.tasks.find((entry) => entry.name === "Task B")!;
    const frame = page.locator(".project-gantt-frame");
    const instance = await frame.getAttribute("data-project-gantt-instance");
    const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
    let patchCount = 0;
    let failedReads = 0;
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
    const patchPath = `${api}/tasks/${task.taskId}`;
    const rejectResponse = async (route: Route) => {
      if (route.request().method() !== "PATCH") { await route.continue(); return; }
      patchCount += 1;
      if (scenario.committed) {
        const committed = await route.fetch();
        expect(committed.status()).toBe(200);
      }
      await responseGate;
      if (scenario.network) await route.abort("connectionreset");
      else await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR" } } });
    };
    const failRead = async (route: Route) => {
      if (route.request().method() === "GET") {
        failedReads += 1;
        await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR" } } });
      } else await route.continue();
    };
    if (scenario.unavailable) await page.route(`**${api}`, failRead);
    await page.route(`**${patchPath}`, rejectResponse);
    // Inline submit remains server-confirmed while the response is held. Do not
    // use the successful-save helper that waits for the new canonical name.
    const row = taskRow(page, "Task B");
    const rowId = await row.getAttribute("data-id");
    await row.locator('[data-col-id=":text"] .wx-content > .wx-text').click();
    const input = page.locator(`.project-gantt-widget .wx-row[data-id="${rowId}"] .wx-cell.wx-editor input.wx-text`);
    await expect(input).toBeFocused();
    await input.fill("Uncertain B");
    await input.press("Enter");
    await expect.poll(() => patchCount).toBe(1);
    releaseResponse();

    if (scenario.unavailable) {
      await expect.poll(() => failedReads).toBeGreaterThanOrEqual(1);
      const recovery = page.getByRole("alert").filter({ hasText: "저장 결과를 확인할 수 없습니다" });
      await expect(recovery).toBeVisible();
      await expect(frame).toHaveAttribute("data-task-mutation-locked", "true");
      await taskRow(page, "Task A").locator('[data-col-id=":text"] .wx-content > .wx-text').click();
      await expect(page.locator('.wx-cell.wx-editor input.wx-text')).toHaveCount(0);
      expect(patchCount).toBe(1);
      await page.screenshot({ path: testInfo.outputPath("uncertain-recovery-1440.png"), fullPage: true });
      await page.unroute(`**${api}`, failRead);
      await recovery.getByRole("button", { name: "최신 상태 다시 조회", exact: true }).click();
      await expect(recovery).toHaveCount(0);
    }

    const expectedName = scenario.committed ? "Uncertain B" : "Task B";
    await expect.poll(() => gridOrder(page)).toEqual(["Task A", expectedName, "Task C"]);
    await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");
    await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
    const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
    expect(stored.data.project.revision).toBe(snapshot.data.project.revision + (scenario.committed ? 1 : 0));
    expect(stored.data.tasks).toEqual(snapshot.data.tasks.map((entry) => entry.taskId === task.taskId && scenario.committed
      ? { ...entry, name: "Uncertain B" } : entry));
    expect(stored.data.links).toEqual(snapshot.data.links);
    expect(patchCount).toBe(1);
    await page.unroute(`**${patchPath}`, rejectResponse);
    // The rejected inline draft retains its original revision. Cancel it before
    // opening a new edit against the newly confirmed server snapshot.
    await taskRow(page, expectedName).locator('[data-col-id=":text"] .wx-content > .wx-text').click();
    const rejectedInput = page.locator('.wx-cell.wx-editor input.wx-text');
    await expect(rejectedInput).toBeVisible();
    await rejectedInput.press("Escape");
    await expect(rejectedInput).toHaveCount(0);
    const nextSave = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === patchPath);
    await renameInline(page, expectedName, "Confirmed B");
    expect((await nextSave).status()).toBe(200);
    const final = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
    expect(final.data.tasks.map((entry) => entry.name)).toEqual(["Task A", "Confirmed B", "Task C"]);
    expect(final.data.project.revision).toBe(stored.data.project.revision + 1);
  });
}

test("SC-05 이전 GET이 늦게 도착해도 commit 미확인 잠금을 해제하지 않는다", async ({ page, baseURL }) => {
  const { api, snapshot } = await seedReorderProject(page, baseURL!);
  const task = snapshot.data.tasks.find((entry) => entry.name === "Task B")!;
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-api-instance");
  let readCount = 0;
  let failedReads = 0;
  let allowLatestRead = false;
  let patchCount = 0;
  let oldResponseReady = false;
  let releaseOldResponse!: () => void;
  const oldResponseGate = new Promise<void>((resolve) => { releaseOldResponse = resolve; });
  await page.route(`**${api}/resource-dashboard?**`, (route) => route.fulfill({
    status: 500, json: { error: { code: "INTERNAL_ERROR" } },
  }));
  await page.route(`**${api}`, async (route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    readCount += 1;
    if (readCount === 1) {
      // Fetch the real pre-mutation SQLite snapshot, then delay only delivery.
      const old = await route.fetch();
      expect(old.status()).toBe(200);
      expect((await old.json()).data.project.revision).toBe(snapshot.data.project.revision);
      oldResponseReady = true;
      await oldResponseGate;
      await route.fulfill({ response: old });
    } else if (!allowLatestRead) {
      failedReads += 1;
      await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR" } } });
    } else await route.continue();
  });
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await page.getByRole("button", { name: "최신 일정 조회", exact: true }).click();
  await expect.poll(() => oldResponseReady).toBe(true);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await page.route(`**${api}/tasks/${task.taskId}`, async (route) => {
    if (route.request().method() !== "PATCH") { await route.continue(); return; }
    patchCount += 1;
    const committed = await route.fetch();
    expect(committed.status()).toBe(200);
    await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR" } } });
  });
  const row = taskRow(page, "Task B");
  const rowId = await row.getAttribute("data-id");
  await row.locator('[data-col-id=":text"] .wx-content > .wx-text').click();
  const input = page.locator(`.project-gantt-widget .wx-row[data-id="${rowId}"] .wx-cell.wx-editor input.wx-text`);
  await input.fill("Committed after old GET");
  await input.press("Enter");
  const recovery = page.getByRole("alert").filter({ hasText: "저장 결과를 확인할 수 없습니다" });
  await expect(recovery).toBeVisible();
  expect(failedReads).toBeGreaterThanOrEqual(1);
  const oldDelivered = page.waitForResponse((response) => new URL(response.url()).pathname === api && response.status() === 200);
  releaseOldResponse();
  await oldDelivered;
  // Give the delivered response time to run its state update, including paints.
  await frame.evaluate(async () => {
    for (let tick = 0; tick < 10; tick++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  await expect(recovery).toBeVisible();
  await expect(frame).toHaveAttribute("data-task-mutation-locked", "true");
  await taskRow(page, "Task A").locator('[data-col-id=":text"] .wx-content > .wx-text').click();
  await expect(page.locator('.wx-cell.wx-editor input.wx-text')).toHaveCount(0);
  expect(patchCount).toBe(1);
  allowLatestRead = true;
  await recovery.getByRole("button", { name: "최신 상태 다시 조회", exact: true }).click();
  await expect(recovery).toHaveCount(0);
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Committed after old GET", "Task C"]);
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
  expect(readCount).toBeGreaterThanOrEqual(3);
  expect(patchCount).toBe(1);
  const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.project.revision).toBe(snapshot.data.project.revision + 1);
  expect(stored.data.tasks).toEqual(snapshot.data.tasks.map((entry) => entry.taskId === task.taskId
    ? { ...entry, name: "Committed after old GET" } : entry));
  expect(stored.data.links).toEqual(snapshot.data.links);
});

test("SC-13 U5 공통 연결은 native Milestone 행과 전체 canonical을 보존하고 marker를 활성화하지 않는다", async ({ page, baseURL }) => {
  const { api, snapshot } = await seedReorderProject(page, baseURL!);
  const created = await page.request.post(`${api}/tasks`, {
    headers: { Origin: baseURL!, "If-Match": `"${snapshot.data.project.revision}"` },
    data: { name: "Native milestone #667", type: "milestone", start: "2026-10-05", duration: 0, progress: 0 },
  });
  expect(created.status()).toBe(201);
  const canonical = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const milestone = canonical.data.tasks.find((entry) => entry.name === "Native milestone #667")!;
  await page.reload();
  await expect(taskRow(page, milestone.name)).toBeVisible();
  await expect(page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${milestone.taskId}"]`)).toBeVisible();
  await expect(page.locator(".project-milestone-lane")).toHaveCount(0);
  const after = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(after).toEqual(canonical);
});
