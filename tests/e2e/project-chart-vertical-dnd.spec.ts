import { expect, test } from "@playwright/test";

import type { TaskMutationResponse } from "../../src/contracts/projects";
import { isolatedApplicationOptions } from "./fixtures/isolated-application";
import { gridOrder, seedReorderProject } from "./helpers/grid-task-reorder";

test.use(isolatedApplicationOptions);

function bar(page: import("@playwright/test").Page, taskId: string) {
  return page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${taskId}"]`);
}

test("Issue #299 Chart bar 수직 DnD는 sibling 순서만 한 번 저장하고 reload 후 유지한다", async ({ page, baseURL }) => {
  const { api, snapshot } = await seedReorderProject(page, baseURL!);
  const taskB = snapshot.data.tasks.find((task) => task.name === "Task B")!;
  const taskC = snapshot.data.tasks.find((task) => task.name === "Task C")!;
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const source = bar(page, taskC.taskId);
  const target = bar(page, taskB.taskId);
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  const hierarchyRequests: unknown[] = [];
  const taskPatches: unknown[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === `${api}/task-commands`) {
      hierarchyRequests.push(request.postDataJSON());
    }
    if (request.method() === "PATCH" && pathname.startsWith(`${api}/tasks/`)) {
      taskPatches.push(request.postDataJSON());
    }
  });

  const commandResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === `${api}/task-commands`,
  );

  const x = sourceBox!.x + sourceBox!.width / 2;
  await page.mouse.move(x, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(x + 1, targetBox!.y + targetBox!.height * 0.25, { steps: 5 });
  await expect(target).toHaveClass(/project-chart-drop-target/);
  await expect(target).toHaveAttribute("data-chart-drop-placement", "before");
  await page.mouse.up();

  const response = await commandResponse;
  expect(response.status()).toBe(200);
  const moved = await response.json() as TaskMutationResponse;
  expect(hierarchyRequests).toEqual([{
    kind: "reparent",
    taskId: taskC.taskId,
    anchorTaskId: taskB.taskId,
    placement: "before",
  }]);
  expect(taskPatches).toEqual([]);
  expect(moved.data.tasks.map((task) => task.name)).toEqual(["Task A", "Task C", "Task B"]);
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B"]);
  await expect(page.locator(".project-chart-drop-target")).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);

  for (const task of moved.data.tasks) {
    const row = await page.locator(`.project-gantt-widget .wx-row[data-id=":${task.taskId}"]`).boundingBox();
    const taskBar = await bar(page, task.taskId).boundingBox();
    expect(row).not.toBeNull();
    expect(taskBar).not.toBeNull();
    expect(Math.abs(row!.y + row!.height / 2 - taskBar!.y - taskBar!.height / 2)).toBeLessThan(3);
  }

  await page.reload();
  await expect.poll(() => gridOrder(page)).toEqual(["Task A", "Task C", "Task B"]);
  const stored = await (await page.request.get(api)).json();
  expect(stored.data.tasks.map((task: { name: string }) => task.name)).toEqual(["Task A", "Task C", "Task B"]);
});
