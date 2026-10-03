import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import { dragRowAfter, gridOrder, renameInline, seedReorderProject, taskRow } from "./helpers/grid-task-reorder";
test.use({ ...isolatedApplicationOptions, viewport: { width: 1440, height: 1000 } });
test("관계 연결 Task는 same-parent Context Move와 Grid DnD에서 Link를 유지한다", async ({ page, baseURL }) => {
  const { api, snapshot } = await seedReorderProject(page, baseURL!);
  const taskA = snapshot.data.tasks.find((task) => task.name === "Task A")!;
  const taskB = snapshot.data.tasks.find((task) => task.name === "Task B")!;
  const linkResponse = await page.request.post(`${api}/links`, {
    headers: { Origin: baseURL!, "If-Match": `"${snapshot.data.project.revision}"` },
    data: { predecessorExternalId: taskA.externalId, successorExternalId: taskB.externalId, type: "FS", lag: 1 },
  });
  expect(linkResponse.status()).toBe(201);
  const linked = await linkResponse.json() as ProjectSnapshotResponse;
  const link = linked.data.links.find((candidate) =>
    candidate.predecessorExternalId === taskA.externalId && candidate.successorExternalId === taskB.externalId
  )!;
  const beforeB = linked.data.tasks.find((task) => task.taskId === taskB.taskId)!;

  await page.reload();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task B", "Task C"]);
  const relation = page.locator(
    `.project-gantt-widget [data-link-id="${link.id}"], .project-gantt-widget [data-link-id=":${link.id}"]`
  ).first();
  await expect(relation).toBeVisible();

  const menuMove = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/task-commands`
  );
  await taskRow(page, "Task B").getByText("Task B", { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move", exact: true }).click();
  await page.getByRole("menuitem", { name: "Move down", exact: true }).click();
  const menuMoveResponse = await menuMove;
  expect(menuMoveResponse.status()).toBe(200);
  const menuMoved = await menuMoveResponse.json() as TaskMutationResponse;
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B"]);
  expect(menuMoved.data.links).toEqual(linked.data.links);
  expect(menuMoved.data.tasks.find((task) => task.taskId === taskB.taskId)).toMatchObject({
    requestedStart: beforeB.requestedStart, start: beforeB.start, end: beforeB.end,
    duration: beforeB.duration, scheduleMode: beforeB.scheduleMode, parentExternalId: beforeB.parentExternalId,
  });
  await expect(relation).toBeVisible();

  const gridMove = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/task-commands`
  );
  await dragRowAfter(page, "Task B", "Task A");
  const gridMoveResponse = await gridMove;
  expect(gridMoveResponse.status()).toBe(200);
  const gridMoved = await gridMoveResponse.json() as TaskMutationResponse;
  expect(gridMoved.data.project.revision).toBe(menuMoved.data.project.revision + 1);
  expect(gridMoved.data.links).toEqual(linked.data.links);
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task B", "Task C"]);
  await expect(relation).toBeVisible();

  await page.reload();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task B", "Task C"]);
  const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.project.revision).toBe(gridMoved.data.project.revision);
  expect(stored.data.links).toEqual(linked.data.links);
  await expect(page.locator(
    `.project-gantt-widget [data-link-id="${link.id}"], .project-gantt-widget [data-link-id=":${link.id}"]`
  ).first()).toBeVisible();
});

test("Grid DnD 확정 후 이름·진행률·재조회와 Context Move는 서버 순서를 보존한다", async ({ page, baseURL }, testInfo) => {
  const { api, snapshot } = await seedReorderProject(page, baseURL!);
  const b = snapshot.data.tasks.find((task) => task.name === "Task B")!;
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const commands: unknown[] = [];
  const patches: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === `${api}/task-commands`)
      commands.push(request.postDataJSON());
    if (request.method() === "PATCH" && new URL(request.url()).pathname === `${api}/tasks/${b.taskId}`)
      patches.push(request.postDataJSON());
  });
  const moved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/task-commands`);
  await dragRowAfter(page, "Task B", "Task C");
  const moveResponse = await moved;
  expect(moveResponse.status()).toBe(200);
  const movedSnapshot = await moveResponse.json() as TaskMutationResponse;
  expect(commands).toHaveLength(1);
  expect(commands[0]).toEqual({ kind: "reparent", taskId: b.taskId, anchorTaskId: snapshot.data.tasks.find((task) => task.name === "Task C")!.taskId, placement: "after" });
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B"]);
  expect(movedSnapshot.data.tasks.map((task) => task.name)).toEqual(["Task A", "Task C", "Task B"]);
  await renameInline(page, "Task B", "Task B 수정");
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B 수정"]);
  expect(patches).toEqual([{ name: "Task B 수정" }]);
  expect(commands).toHaveLength(1); // canonical move actions never feed back into HTTP.
  let stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.project.revision).toBe(movedSnapshot.data.project.revision + 1);
  expect(stored.data.tasks.map((task) => task.name)).toEqual(["Task A", "Task C", "Task B 수정"]);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
  await expect(page.locator(".project-gantt-widget .wx-reorder-task")).toHaveCount(0);
  for (const task of snapshot.data.tasks) {
    const row = await taskRow(page, task.taskId === b.taskId ? "Task B 수정" : task.name).boundingBox();
    const bar = await page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${task.taskId}"]`).boundingBox();
    expect(row).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(Math.abs(row!.y + row!.height / 2 - bar!.y - bar!.height / 2)).toBeLessThan(3);
  }
  await page.screenshot({ path: testInfo.outputPath("after-dnd-rename-1440.png"), fullPage: true });
  await page.reload();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B 수정"]);
  for (const [target, order] of [["Task A", ["Task A", "Task B 수정", "Task C"]], ["Task C", ["Task A", "Task C", "Task B 수정"]]] as const) {
    const nextMove = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/task-commands`);
    await dragRowAfter(page, "Task B 수정", target);
    expect((await nextMove).status()).toBe(200);
    await expect.poll(() => gridOrder(page)).toEqual(order);
    await expect(page.locator(".project-gantt-widget .wx-reorder-task")).toHaveCount(0);
  }
  expect(commands).toHaveLength(3);
  await taskRow(page, "Task B 수정").getByText("Task B 수정", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await editor.getByLabel("진행률 (%)", { exact: true }).fill("35");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B 수정"]);
  await taskRow(page, "Task B 수정").getByText("Task B 수정", { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move", exact: true }).click();
  await page.getByRole("menuitem", { name: "Move up", exact: true }).click();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task B 수정", "Task C"]);
  await taskRow(page, "Task B 수정").getByText("Task B 수정", { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move", exact: true }).click();
  await page.getByRole("menuitem", { name: "Move down", exact: true }).click();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B 수정"]);
  await renameInline(page, "Task B 수정", "Task B 메뉴 수정");
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B 메뉴 수정"]);
  await page.reload();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B 메뉴 수정"]);
  stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.tasks.map((task) => task.name)).toEqual(["Task A", "Task C", "Task B 메뉴 수정"]);
  expect(new Set(stored.data.tasks.map((task) => task.siblingOrder)).size).toBe(3);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(taskRow(page, "Task B 메뉴 수정")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`after-reorder-${width}.png`), fullPage: true });
  }
});
for (const status of [412, 500])
  test(`DnD ${status} 실패는 canonical 순서·revision으로 복구하고 후속 이름만 저장한다`, async ({ page, baseURL }) => {
    const { api, snapshot } = await seedReorderProject(page, baseURL!);
    const instance = await page.locator(".project-gantt-frame").getAttribute("data-project-gantt-instance");
    let release!: () => void;
    let requests = 0;
    await page.route(`**${api}/task-commands`, async (route) => {
      requests++;
      await new Promise<void>((resolve) => { release = resolve; });
      await route.fulfill({ status, json: { error: { code: status === 412 ? "REVISION_MISMATCH" : "INTERNAL_ERROR" } } });
    });
    await dragRowAfter(page, "Task B", "Task C");
    await expect.poll(() => requests).toBe(1);
    await expect(page.locator(".project-gantt-frame")).toHaveAttribute("data-task-mutation-locked", "true");
    await taskRow(page, "Task B").locator('[data-col-id=":text"] .wx-content > .wx-text').click();
    await expect(page.locator('.wx-cell.wx-editor input.wx-text')).toHaveCount(0);
    release();
    await expect(page.getByTestId("workspace-toast")).toContainText(status === 412 ? "다른 편집 내용" : "작업 구조를 변경할 수 없습니다");
    await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task B", "Task C"]);
    const restored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
    expect(restored.data.project.revision).toBe(snapshot.data.project.revision);
    expect(restored.data.tasks).toEqual(snapshot.data.tasks);
    await expect(page.locator(".project-gantt-frame")).toHaveAttribute("data-project-gantt-instance", instance!);
    await renameInline(page, "Task B", "Recovered B");
    await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Recovered B", "Task C"]);
  });
test("Grid pointer 이동은 다른 parent와 Summary 접힘·펼침 뒤에도 구조를 보존한다", async ({ page, baseURL }) => {
  const { api, snapshot: initial } = await seedReorderProject(page, baseURL!);
  let snapshot = initial;
  const add = async (name: string, parentTaskId?: string) => {
    const response = await page.request.post(`${api}/tasks`, { headers: { Origin: baseURL!, "If-Match": `"${snapshot.data.project.revision}"` }, data: { name, type: "task", start: "2026-10-05", duration: 2, progress: 0, ...(parentTaskId ? { parentTaskId, convertParentToSummary: true } : {}) } });
    expect(response.status()).toBe(201);
    snapshot = await response.json() as TaskMutationResponse;
    return snapshot.data.tasks.find((task) => task.name === name)!;
  };
  const parent = await add("Parent P");
  await add("P child 1", parent.taskId);
  await add("P child 2", parent.taskId);
  await page.reload();
  const toggle = taskRow(page, "Parent P").locator('[data-action="open-task"]');
  await expect(taskRow(page, "P child 1")).toBeVisible();
  const identity = await page.locator(".project-gantt-frame").getAttribute("data-project-gantt-api-instance");
  const response = page.waitForResponse((candidate) => candidate.request().method() === "POST" && new URL(candidate.url()).pathname === `${api}/task-commands`);
  await dragRowAfter(page, "Task B", "P child 1");
  expect((await response).status()).toBe(200);
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Parent P", "P child 1", "Task B", "P child 2"]);
  await renameInline(page, "Task B", "Nested B");
  const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.tasks.find((task) => task.name === "Nested B")).toMatchObject({ parentExternalId: parent.externalId, siblingOrder: 1, type: "task" });
  await toggle.click();
  await expect(taskRow(page, "Nested B")).toHaveCount(0);
  await toggle.click();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Parent P", "P child 1", "Nested B", "P child 2"]);
  await expect(page.locator(".project-gantt-frame")).toHaveAttribute("data-project-gantt-api-instance", identity!);
  await page.reload();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Parent P", "P child 1", "Nested B", "P child 2"]);
});
