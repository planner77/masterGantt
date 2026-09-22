import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";
import { chooseTaskInformation } from "./helpers/task-context-menu";

test.use(isolatedApplicationOptions);

test("persists explicit editor changes, task details and safe URL click without remount", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Editor persistence ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill(`Editor-password-${suffix}`);
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
  await decoratedRow.getByText("Saved via editor", { exact: true }).click();
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
      await expect(information.getByLabel("시작일", { exact: true })).toHaveValue("2026-09-18");
      await expect(information.getByLabel("기간 (근무일)", { exact: true })).toHaveValue("2");
    } finally { await context.close(); }
  }
});
