import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, ProjectTaskDto, TaskMutationResponse } from "../../src/contracts/projects";

test.use(isolatedApplicationOptions);

async function createRootTask(
  page: import("@playwright/test").Page,
  api: string,
  origin: string,
  revision: number,
  name: string,
): Promise<TaskMutationResponse> {
  const response = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${revision}"` },
    data: { name, type: "task", start: "2026-09-29", duration: 1, progress: 0 },
  });
  expect(response.status()).toBe(201);
  return await response.json() as TaskMutationResponse;
}

function orderedRootNames(tasks: readonly ProjectTaskDto[]): string[] {
  return tasks
    .filter((task) => task.parentExternalId === null)
    .slice()
    .sort((left, right) => left.siblingOrder - right.siblingOrder)
    .map((task) => task.name);
}

function bar(page: import("@playwright/test").Page, taskId: string) {
  return page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${taskId}"]`);
}

test("Issue #299 Chart bar vertical drag persists sibling order without schedule mutation", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Chart DnD ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("ChartPwd1234!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const a = await createRootTask(page, api, origin, initial.data.project.revision, "Alpha");
  const b = await createRootTask(page, api, origin, a.data.project.revision, "Beta");
  const c = await createRootTask(page, api, origin, b.data.project.revision, "Gamma");

  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const gamma = c.data.tasks.find((task) => task.name === "Gamma")!;
  const beta = c.data.tasks.find((task) => task.name === "Beta")!;
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const gammaBar = bar(page, gamma.taskId);
  const betaBar = bar(page, beta.taskId);
  await expect(gammaBar).toBeVisible();
  await expect(betaBar).toBeVisible();

  const gammaBox = await gammaBar.boundingBox();
  const betaBox = await betaBar.boundingBox();
  expect(gammaBox).not.toBeNull();
  expect(betaBox).not.toBeNull();

  let commandRequests = 0;
  let taskPatchRequests = 0;
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname.endsWith("/task-commands")) commandRequests += 1;
    if (request.method() === "PATCH" && pathname.includes("/tasks/")) taskPatchRequests += 1;
  });

  const commandResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname.endsWith("/task-commands"),
  );
  await page.mouse.move(gammaBox!.x + gammaBox!.width / 2, gammaBox!.y + gammaBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    gammaBox!.x + gammaBox!.width / 2 + 1,
    betaBox!.y + betaBox!.height * 0.25,
    { steps: 4 },
  );
  await expect(betaBar).toHaveClass(/project-chart-drop-target/);
  await expect(betaBar).toHaveAttribute("data-chart-drop-placement", "before");
  await page.mouse.up();

  const response = await commandResponse;
  expect(response.ok(), `task command HTTP ${response.status()}`).toBe(true);
  const moved = await response.json() as TaskMutationResponse;
  expect(orderedRootNames(moved.data.tasks)).toEqual(["Alpha", "Gamma", "Beta"]);
  expect(commandRequests).toBe(1);
  expect(taskPatchRequests).toBe(0);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);

  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const persisted = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(orderedRootNames(persisted.data.tasks)).toEqual(["Alpha", "Gamma", "Beta"]);

  const rows = page.locator(".project-gantt-widget .wx-table-container .wx-row[data-id]");
  await expect(rows).toHaveCount(3);
  const visibleNames = await rows.locator('[role="gridcell"][data-col-id=":text"]').allTextContents();
  expect(visibleNames.map((value) => value.trim()).filter(Boolean)).toEqual(["Alpha", "Gamma", "Beta"]);
});
