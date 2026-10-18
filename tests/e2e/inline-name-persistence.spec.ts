import type { Page, Request } from "@playwright/test";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";
import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import { chooseTaskInformation } from "./helpers/task-context-menu";

test.use({ ...isolatedApplicationOptions, viewport: { width: 1440, height: 1000 } });

const row = (page: Page, taskId: string) => page.locator(`.project-gantt-widget .wx-table-container .wx-row[data-id=":${taskId}"]`);
const cell = (page: Page, taskId: string) => row(page, taskId).locator('[role="gridcell"][data-col-id=":text"]');
const input = (page: Page, taskId: string) => row(page, taskId).locator(".wx-cell.wx-editor input.wx-text");

async function expectNativeName(page: Page, taskId: string, name: string) {
  await expect(cell(page, taskId).locator(".wx-content > .wx-text")).toHaveText(name);
  const bar = page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${taskId}"]`);
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(name);
}

async function createTask(page: Page) {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill("Issue 572 inline persistence");
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("Inline572!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const api = `/api${new URL(page.url()).pathname}`, origin = new URL(page.url()).origin;
  const initialResponse = await page.request.get(api);
  expect(initialResponse.status()).toBe(200);
  const initial = await initialResponse.json() as ProjectSnapshotResponse;
  const createdResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${initial.data.project.revision}"` },
    data: { name: "Stable leaf", type: "task", start: "2026-10-12", duration: 2, progress: 0 },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json() as TaskMutationResponse;
  const task = created.data.tasks.find(candidate => candidate.name === "Stable leaf")!;
  expect(task).toBeTruthy();
  return { api, created, task };
}

test("#572 실제 SQLite Enter·Tab·Task Editor 이름 저장은 reload 후 일치한다", async ({ page }) => {
  const { api, created, task } = await createTask(page);
  const taskEndpoint = `${api}/tasks/${task.taskId}`;
  const patches: Request[] = [];
  page.on("request", request => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === taskEndpoint) patches.push(request);
  });
  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await expectNativeName(page, task.taskId, "Stable leaf");
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  expect(instance).not.toBeNull();
  let revision = created.data.project.revision;

  for (const [name, key] of [["Enter saved", "Enter"], ["Blur saved", "Tab"]] as const) {
    const before = patches.length;
    await cell(page, task.taskId).locator(".wx-content > .wx-text").click();
    const editor = input(page, task.taskId);
    await expect(editor).toBeFocused();
    await editor.fill(`  ${name}  `);
    const [response] = await Promise.all([
      page.waitForResponse(candidate => candidate.request().method() === "PATCH" && new URL(candidate.url()).pathname === taskEndpoint),
      editor.press(key),
    ]);
    expect(response.status()).toBe(200);
    const saved = await response.json() as TaskMutationResponse;
    expect(saved.data.project.revision).toBe(revision + 1);
    expect(saved.data.tasks.find(candidate => candidate.taskId === task.taskId)?.name).toBe(name);
    await expectNativeName(page, task.taskId, name);
    expect(patches).toHaveLength(before + 1);
    expect(patches.at(-1)!.postDataJSON()).toEqual({ name });
    expect(patches.at(-1)!.headers()["if-match"]).toBe(`"${revision}"`);
    await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
    revision = saved.data.project.revision;
  }

  await page.reload();
  await expectNativeName(page, task.taskId, "Blur saved");
  const reloadedInstance = await frame.getAttribute("data-project-gantt-instance");
  expect(reloadedInstance).not.toBeNull();
  await cell(page, task.taskId).locator(".wx-content > .wx-text").click({ button: "right" });
  await chooseTaskInformation(page);
  const information = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(information.getByLabel("작업명", { exact: true })).toHaveValue("Blur saved");
  await information.getByLabel("작업명", { exact: true }).fill("Editor saved");
  const [editorResponse] = await Promise.all([
    page.waitForResponse(candidate => candidate.request().method() === "PATCH" && new URL(candidate.url()).pathname === taskEndpoint),
    information.getByRole("button", { name: "저장", exact: true }).click(),
  ]);
  expect(editorResponse.status()).toBe(200);
  const editorSaved = await editorResponse.json() as TaskMutationResponse;
  expect(editorSaved.data.project.revision).toBe(revision + 1);
  expect(patches).toHaveLength(3);
  expect(patches[2].headers()["if-match"]).toBe(`"${revision}"`);
  await expect(information).toHaveCount(0);
  await expectNativeName(page, task.taskId, "Editor saved");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", reloadedInstance!);
  revision = editorSaved.data.project.revision;

  await page.reload();
  await expectNativeName(page, task.taskId, "Editor saved");
  await cell(page, task.taskId).locator(".wx-content > .wx-text").click({ button: "right" });
  await chooseTaskInformation(page);
  await expect(information.getByLabel("작업명", { exact: true })).toHaveValue("Editor saved");
  await page.keyboard.press("Escape");
  await expect(information).toHaveCount(0);

  expect(patches).toHaveLength(3);
});

test("#572 실제 SQLite inline 이름 저장은 프로세스 재시작 후 유지된다", async ({ page, restartIsolatedApplication }) => {
  const { api, created, task } = await createTask(page);
  const taskEndpoint = `${api}/tasks/${task.taskId}`;
  const patches: Request[] = [];
  page.on("request", request => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === taskEndpoint) patches.push(request);
  });
  await page.reload();
  await expectNativeName(page, task.taskId, "Stable leaf");
  await cell(page, task.taskId).locator(".wx-content > .wx-text").click();
  await input(page, task.taskId).fill("Restart saved");
  const [response] = await Promise.all([
    page.waitForResponse(candidate => candidate.request().method() === "PATCH" && new URL(candidate.url()).pathname === taskEndpoint),
    input(page, task.taskId).press("Enter"),
  ]);
  expect(response.status()).toBe(200);
  const saved = await response.json() as TaskMutationResponse;
  const revision = created.data.project.revision + 1;
  expect(saved.data.project.revision).toBe(revision);
  expect(patches).toHaveLength(1);
  expect(patches[0].postDataJSON()).toEqual({ name: "Restart saved" });
  expect(patches[0].headers()["if-match"]).toBe(`"${created.data.project.revision}"`);
  await expectNativeName(page, task.taskId, "Restart saved");

  // Uses the fixture's same SQLite/origin with a genuinely new Next process.
  // No route mocks, storage export, or raw database/credential attachments.
  await restartIsolatedApplication();
  const restartedResponse = await page.request.get(api);
  expect(restartedResponse.status()).toBe(200);
  const restarted = await restartedResponse.json() as ProjectSnapshotResponse;
  expect(restarted.data.project.revision).toBe(revision);
  expect(restarted.data.tasks.find(candidate => candidate.taskId === task.taskId)).toMatchObject({
    name: "Restart saved", start: task.start, end: task.end, duration: task.duration, progress: task.progress,
  });
  expect(restarted.data.links).toEqual(created.data.links);
  await page.reload();
  await expectNativeName(page, task.taskId, "Restart saved");
  await cell(page, task.taskId).locator(".wx-content > .wx-text").click({ button: "right" });
  await chooseTaskInformation(page);
  const information = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(information.getByLabel("작업명", { exact: true })).toHaveValue("Restart saved");
  expect(patches).toHaveLength(1);
});
