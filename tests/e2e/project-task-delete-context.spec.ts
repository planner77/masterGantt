import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";

test.use(isolatedApplicationOptions);

test("confirms and atomically deletes the right-clicked task subtree without remounting Gantt", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Delete subtree ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill(`Delete-password-${suffix}`);
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;

  const rootResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${initial.data.project.revision}"` },
    data: { name: "Delete root", type: "task", start: "2026-09-14", duration: 1, progress: 0 },
  });
  expect(rootResponse.status()).toBe(201);
  const rootBody = await rootResponse.json() as TaskMutationResponse;
  const root = rootBody.data.tasks.find((task) => task.name === "Delete root")!;

  const branchResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${rootBody.data.project.revision}"` },
    data: { parentTaskId: root.taskId, convertParentToSummary: true, name: "Delete branch", type: "task", start: "2026-09-15", duration: 1, progress: 0 },
  });
  expect(branchResponse.status()).toBe(201);
  const branchBody = await branchResponse.json() as TaskMutationResponse;
  const branch = branchBody.data.tasks.find((task) => task.name === "Delete branch")!;

  const siblingResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${branchBody.data.project.revision}"` },
    data: { parentTaskId: root.taskId, name: "Keep sibling", type: "task", start: "2026-09-18", duration: 1, progress: 0 },
  });
  expect(siblingResponse.status()).toBe(201);
  const siblingBody = await siblingResponse.json() as TaskMutationResponse;

  const grandchildResponse = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${siblingBody.data.project.revision}"` },
    data: { parentTaskId: branch.taskId, convertParentToSummary: true, name: "Delete grandchild", type: "task", start: "2026-09-16", duration: 1, progress: 0 },
  });
  expect(grandchildResponse.status()).toBe(201);
  const seeded = await grandchildResponse.json() as TaskMutationResponse;

  await page.reload();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const row = page.locator(".project-gantt-widget .wx-row", { hasText: "Delete branch" }).first();
  await expect(row).toBeVisible();

  let deleteRequests = 0;
  let deleteUrl = "";
  page.on("request", (request) => {
    if (request.method() === "DELETE" && new URL(request.url()).pathname === `${api}/tasks/${branch.taskId}`) {
      deleteRequests += 1;
      deleteUrl = request.url();
    }
  });

  await row.getByText("Delete branch", { exact: true }).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "작업 메뉴", exact: true });
  await expect(menu.getByRole("menuitem", { name: "작업 삭제", exact: true })).toBeVisible();
  await menu.getByRole("menuitem", { name: "작업 삭제", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "작업 삭제", exact: true });
  await expect(dialog).toContainText("Delete branch");
  await expect(dialog).toContainText("하위 작업 1개, 총 2개 작업");
  expect(deleteRequests).toBe(0);
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(deleteRequests).toBe(0);
  await expect(row).toBeFocused();

  await row.getByText("Delete branch", { exact: true }).click({ button: "right" });
  await page.getByRole("menu", { name: "작업 메뉴", exact: true })
    .getByRole("menuitem", { name: "작업 삭제", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "작업 삭제", exact: true });
  await confirm.getByRole("button", { name: "하위 작업 포함 삭제", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 삭제했습니다");

  expect(deleteRequests).toBe(1);
  expect(new URL(deleteUrl).searchParams.get("includeDescendants")).toBe("true");
  await expect(page.getByText("Delete branch", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delete grandchild", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Keep sibling", { exact: true })).toBeVisible();
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);

  const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.project.revision).toBe(seeded.data.project.revision + 1);
  expect(stored.data.tasks.map((task) => task.name).sort()).toEqual(["Delete root", "Keep sibling"]);
  expect(stored.data.tasks.find((task) => task.name === "Delete root"))
    .toMatchObject({ type: "summary", start: "2026-09-18", end: "2026-09-18", duration: 1 });

  await page.reload();
  await expect(page.getByText("Delete branch", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delete grandchild", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Keep sibling", { exact: true })).toBeVisible();
});
