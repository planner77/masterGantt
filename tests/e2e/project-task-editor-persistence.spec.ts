import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";
import { chooseTaskInformation } from "./helpers/task-context-menu";

test.use(isolatedApplicationOptions);

test("persists explicit editor changes, task details and safe URL click without remount", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Editor persistence ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("EditPwd1234!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const taskUrl = `${origin}/projects/new`;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const parentResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${initial.data.project.revision}"` },
    data: { name: "Editor parent", type: "task", start: "2026-09-18", duration: 1, progress: 0 },
  });
  expect(parentResponse.status()).toBe(201);
  const parentBody = await parentResponse.json() as TaskMutationResponse;
  const parent = parentBody.data.tasks.find((entry) => entry.name === "Editor parent")!;
  const childResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${parentBody.data.project.revision}"` },
    data: { parentTaskId: parent.taskId, convertParentToSummary: true, name: "Persistent child", type: "task", start: "2026-09-18", duration: 1, progress: 10 },
  });
  expect(childResponse.status()).toBe(201);
  const childBody = await childResponse.json() as TaskMutationResponse;
  const child = childBody.data.tasks.find((entry) => entry.name === "Persistent child")!;
  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const row = page.locator(".project-gantt-widget .wx-row", { hasText: "Persistent child" }).first();
  await expect(row).toBeVisible();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  let patches = 0;
  let navigations = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === `${api}/tasks/${child.taskId}`) patches += 1;
    if (request.resourceType() === "document") navigations += 1;
  });
  await row.getByText("Persistent child", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel("작업명", { exact: true }).fill("Saved via editor");
  await editor.getByLabel("기간 (근무일)", { exact: true }).fill("2");
  const progress = editor.getByLabel("진행률 (%)", { exact: true });
  await progress.fill("75");
  await expect(progress).toHaveValue("75");
  await expect(progress).toHaveAttribute("aria-valuetext", "75%");
  await editor.getByLabel("Description", { exact: true }).fill("첫 줄\n둘째 줄");
  await editor.getByLabel("URL", { exact: true }).fill(taskUrl);
  await expect(progress).toHaveAttribute("aria-valuetext", "75%");
  expect(patches).toBe(0);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 저장했습니다");
  expect(patches).toBe(1);
  expect(navigations).toBe(0);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.project.revision).toBe(childBody.data.project.revision + 1);
  expect(stored.data.tasks.find((entry) => entry.taskId === child.taskId)).toMatchObject({
    name: "Saved via editor", requestedStart: "2026-09-18", start: "2026-09-18", end: "2026-09-21", duration: 2, progress: 75,
    description: "첫 줄\n둘째 줄", url: taskUrl,
  });
  expect(stored.data.tasks.find((entry) => entry.taskId === parent.taskId)).toMatchObject({ type: "summary", start: "2026-09-18", end: "2026-09-21", progress: 75 });

  await page.reload();
  await expect(page.getByRole("grid").getByText("Saved via editor", { exact: true })).toBeVisible();
  const reloadedFrame = page.locator(".project-gantt-frame");
  const reloadedInstance = await reloadedFrame.getAttribute("data-project-gantt-instance");
  const decoratedRow = page.locator(".project-gantt-widget .wx-row", { hasText: "Saved via editor" }).first();
  await expect(decoratedRow).toHaveAttribute("data-task-url", taskUrl, { timeout: 5000 });
  const popupPromise = page.waitForEvent("popup");
  await page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${child.taskId}"]`).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  expect(new URL(popup.url()).pathname).toBe("/projects/new");
  await popup.close();
  await expect(reloadedFrame).toHaveAttribute("data-project-gantt-instance", reloadedInstance!);

  await decoratedRow.getByText("Saved via editor", { exact: true }).click({ button: "right" });
  await expect(page.getByRole("menu", { name: "작업 메뉴" })).toBeVisible();
  await page.keyboard.press("Escape");

  const storageState = await page.context().storageState();
  for (const timezoneId of ["UTC", "Asia/Seoul", "America/New_York"]) {
    const context = await browser.newContext({ timezoneId, storageState, viewport: { width: 1440, height: 1000 } });
    try {
      const check = await context.newPage();
      await check.goto(`${origin}${path}`);
      await expect(check.getByText("편집 중", { exact: true })).toBeVisible();
      await check.locator(`.wx-bar[data-task-id=":${child.taskId}"]`).click({ button: "right" });
      await chooseTaskInformation(check);
      const information = check.getByRole("dialog", { name: "작업 정보", exact: true });
      await expect(information.getByLabel("작업명", { exact: true })).toHaveValue("Saved via editor");
      await expect(information.getByLabel("요청 시작일", { exact: true })).toHaveValue("2026-09-18");
      await expect(information.getByLabel("기간 (근무일)", { exact: true })).toHaveValue("2");
    } finally { await context.close(); }
  }
});

test("linked requested dates, metadata, baseline and successor schedules persist canonically", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Linked editor ${Date.now()}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("EditPwd1234!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const api = `/api${new URL(page.url()).pathname}`;
  const origin = new URL(page.url()).origin;
  let snapshot = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  for (const [name, duration] of [["Chain A", 3], ["Chain B", 2], ["Chain C", 1]] as const) {
    const response = await page.request.post(`${api}/tasks`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data: { name, type: "task", start: "2026-09-14", duration, progress: 0 } });
    expect(response.status()).toBe(201);
    snapshot = await response.json() as ProjectSnapshotResponse;
  }
  const [a, b, c] = ["Chain A", "Chain B", "Chain C"].map((name) => snapshot.data.tasks.find((task) => task.name === name)!);
  for (const [predecessor, successor] of [[a, b], [b, c]]) {
    const response = await page.request.post(`${api}/links`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data: { predecessorExternalId: predecessor.externalId, successorExternalId: successor.externalId, type: "FS", lag: 0 } });
    expect(response.ok()).toBeTruthy();
    snapshot = await response.json() as ProjectSnapshotResponse;
  }
  await page.reload();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const patches: Record<string, unknown>[] = [];
  page.on("request", (request) => { if (request.method() === "PATCH" && request.url().includes(`${api}/tasks/`)) patches.push(request.postDataJSON()); });
  const open = async (taskId: string) => {
    await page.locator(`.wx-row[data-id=":${taskId}"]`).getByText(/Chain/).first().click({ button: "right" });
    await chooseTaskInformation(page);
    return page.getByRole("dialog", { name: "작업 정보", exact: true });
  };
  let editor = await open(b.taskId);
  await expect(editor.getByLabel("요청 시작일", { exact: true })).toHaveValue("2026-09-14");
  await expect(editor.getByLabel("적용 시작일", { exact: true })).toHaveText("2026-09-17");
  await expect(editor.getByLabel("적용 종료일", { exact: true })).toHaveText("2026-09-18");
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    await expect(editor.getByRole("button", { name: "저장", exact: true })).toBeVisible();
    await page.screenshot({ path: `output/playwright/issue258-after-${width}.png`, fullPage: true });
  }
  await editor.getByLabel("작업명", { exact: true }).fill("Chain B edited");
  await editor.getByLabel("Description", { exact: true }).fill("Linked metadata");
  await editor.getByLabel("URL", { exact: true }).fill("https://example.invalid/task");
  await editor.getByLabel("진행률 (%)", { exact: true }).fill("40");
  await editor.getByRole("button", { name: "현재 일정으로 설정", exact: true }).click();
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(patches).toHaveLength(1);
  expect(patches[0]).not.toHaveProperty("start");
  snapshot = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(snapshot.data.tasks.find((task) => task.taskId === b.taskId)).toMatchObject({ requestedStart: "2026-09-14", start: "2026-09-17", end: "2026-09-18", progress: 40, description: "Linked metadata", baselineStart: "2026-09-17", baselineEnd: "2026-09-18" });
  await page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" }).fill("Chain A");
  await expect(page.locator(`.wx-row[data-id=":${c.taskId}"]`)).toHaveCount(0);
  editor = await open(a.taskId);
  await editor.getByLabel("기간 (근무일)", { exact: true }).fill("5");
  await expect(editor.getByRole("button", { name: "현재 일정으로 설정", exact: true })).toBeDisabled();
  await expect(editor).toContainText("변경한 일정을 먼저 저장");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByTestId("workspace-toast")).toContainText("후행 작업 2건");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  snapshot = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(snapshot.data.tasks.find((task) => task.taskId === b.taskId)).toMatchObject({ requestedStart: "2026-09-14", start: "2026-09-21", end: "2026-09-22", baselineStart: "2026-09-17", baselineEnd: "2026-09-18" });
  expect(snapshot.data.tasks.find((task) => task.taskId === c.taskId)).toMatchObject({ start: "2026-09-23" });
  await page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" }).fill("");
  editor = await open(b.taskId);
  await editor.getByLabel("요청 시작일", { exact: true }).fill("2026-09-21");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(patches[2]).toEqual({ start: "2026-09-21" });
  await page.reload();
  snapshot = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(snapshot.data.tasks.find((task) => task.taskId === b.taskId)).toMatchObject({ requestedStart: "2026-09-21", start: "2026-09-21" });
  editor = await open(b.taskId);
  await editor.getByLabel("작업명", { exact: true }).fill("Discard me");
  await page.keyboard.press("Escape");
  await editor.getByRole("button", { name: "변경사항 버리고 닫기" }).click();
  expect(patches).toHaveLength(3);
  const gestureInstance = await frame.getAttribute("data-project-gantt-instance");
  await page.getByRole("button", { name: "일", exact: true }).click();
  for (const mode of ["end", "start", "move"] as const) {
    const bar = page.locator(`.wx-bar[data-task-id=":${a.taskId}"]`);
    await bar.scrollIntoViewIfNeeded();
    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    const x = mode === "start" ? box!.x + 2 : mode === "end" ? box!.x + box!.width - 2 : box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const count = patches.length;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 48, y, { steps: 8 });
    expect(patches).toHaveLength(count);
    await page.mouse.up();
    await expect.poll(() => patches.length).toBe(count + 1);
    await expect(page.getByTestId("workspace-toast")).toContainText("작업을 저장했습니다");
    expect(Object.keys(patches[count]).sort()).toEqual(mode === "end" ? ["duration"] : mode === "start" ? ["duration", "start"] : ["start"]);
    await expect(frame).toHaveAttribute("data-project-gantt-instance", gestureInstance!);
  }
});
