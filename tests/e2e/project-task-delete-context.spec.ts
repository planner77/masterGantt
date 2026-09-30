import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";

test.use(isolatedApplicationOptions);

test("confirms and atomically deletes the right-clicked task subtree without remounting Gantt", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Delete subtree ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("DelPwd12345!");
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
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
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
  await expect(menu.getByRole("menuitem", { name: "Delete", exact: true })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Delete", exact: true }).click();

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
    .getByRole("menuitem", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "작업 삭제", exact: true });
  await confirm.getByRole("button", { name: "하위 작업 포함 삭제", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByTestId("workspace-toast")).toContainText("작업을 삭제했습니다");

  expect(deleteRequests).toBe(1);
  expect(new URL(deleteUrl).searchParams.get("includeDescendants")).toBe("true");
  await expect(page.getByText("Delete branch", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delete grandchild", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("grid").getByText("Keep sibling", { exact: true })).toBeVisible();
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);

  const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.project.revision).toBe(seeded.data.project.revision + 1);
  expect(stored.data.tasks.map((task) => task.name).sort()).toEqual(["Delete root", "Keep sibling"]);
  expect(stored.data.tasks.find((task) => task.name === "Delete root"))
    .toMatchObject({ type: "summary", start: "2026-09-18", end: "2026-09-18", duration: 1 });

  await page.reload();
  await expect(page.getByText("Delete branch", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delete grandchild", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("grid").getByText("Keep sibling", { exact: true })).toBeVisible();
});


for (const recovery of ["normal", "stale", "unavailable", "401", "412", "network"] as const) test(`keeps confirmed deletions after repeated last-child rejection (${recovery})`, async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Delete recovery ${Date.now()}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("DelPwd12345!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const api = `/api${new URL(page.url()).pathname}`;
  const origin = new URL(page.url()).origin;
  let snapshot = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  for (const name of ["Keep summary", "Keep last child", "Collapsed summary", "Collapsed child", "Delete C", "Delete D"]) {
    const parent = snapshot.data.tasks.find((task) => task.name === (name === "Collapsed child" ? "Collapsed summary" : "Keep summary"));
    const response = await page.request.post(`${api}/tasks`, {
      headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` },
      data: { name, type: "task", start: "2026-01-14", duration: 1, progress: 0,
        ...(["Keep last child", "Collapsed child"].includes(name) ? { parentTaskId: parent!.taskId, convertParentToSummary: true } : {}) },
    });
    expect(response.status()).toBe(201);
    snapshot = { data: { ...(await response.json() as TaskMutationResponse).data, permission: "readonly" } };
  }
  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /svar-api-/);
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  await page.getByRole("button", { name: "주", exact: true }).click();
  const toggle = page.locator(".project-gantt-widget .wx-row", { hasText: "Collapsed summary" }).first().locator('[data-action="open-task"]');
  await toggle.click();
  await expect(toggle).toHaveClass(/wxi-menu-right/);
  const chart = page.locator(".project-gantt-widget .wx-chart").first();
  await chart.evaluate((element) => { element.scrollLeft = 68; });
  const scrollLeft = await chart.evaluate((element) => element.scrollLeft);
  const trace: unknown[] = [];
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname.startsWith(api) && !response.url().includes("edit-session")) {
      const body = await response.json().catch(() => null);
      trace.push({ method: response.request().method(), url: new URL(response.url()).pathname, status: response.status(), revision: body?.data?.project?.revision, code: body?.error?.code, names: body?.data?.tasks?.map((task: { name: string }) => task.name) });
    }
  });
  const deleted: string[] = [];
  async function deleteThroughGrid(name: string) {
    const task = snapshot.data.tasks.find((entry) => entry.name === name)!;
    const target = name === "Delete D" ? page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${task.taskId}"]`) : page.getByRole("grid").getByText(name, { exact: true });
    if (name === "Delete D") await chart.evaluate((element) => { element.scrollLeft = 0; });
    await target.click({ button: "right" });
    await page.getByRole("menu", { name: "작업 메뉴", exact: true }).getByRole("menuitem", { name: "Delete", exact: true }).click();
  }
  try {
    for (const name of ["Delete C", "Delete D"]) {
      await deleteThroughGrid(name);
      await expect(page.getByTestId("workspace-toast")).toContainText("작업을 삭제했습니다");
      deleted.push(name);
      for (const entry of deleted) await expect(page.getByRole("grid").getByText(entry, { exact: true })).toHaveCount(0);
      const confirmed = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
      await chart.evaluate((element, left) => { element.scrollLeft = left; }, scrollLeft);
      const preservedScrollLeft = await chart.evaluate((element) => element.scrollLeft);
      if (recovery === "stale" || recovery === "unavailable") await page.route(`**${api}`, async (route) => {
        if (recovery === "stale") await route.fulfill({ json: snapshot });
        else await route.abort("failed");
      });
      if (["401", "412", "network"].includes(recovery)) await page.route(`**${api}/tasks/${snapshot.data.tasks.find((task) => task.name === "Keep last child")!.taskId}`, async (route) => {
        if (recovery === "network") await route.abort("failed");
        else await route.fulfill({ status: Number(recovery), json: { error: { code: recovery === "401" ? "EDIT_SESSION_REQUIRED" : "REVISION_MISMATCH", message: "Injected recovery rejection", details: [] } } });
      });
      await deleteThroughGrid("Keep last child");
      await expect(page.getByTestId("workspace-toast")).toContainText(recovery === "401" ? "편집 권한이 만료" : recovery === "412" ? "다른 편집 내용" : recovery === "network" ? "네트워크 연결" : "상위 요약 작업이 비게 됩니다");
      if (recovery === "stale") await page.screenshot({ path: "output/playwright/issue344-after.png" });
      for (const entry of deleted) await expect(page.getByRole("grid").getByText(entry, { exact: true })).toHaveCount(0);
      await expect(page.getByRole("grid").getByText("Keep last child", { exact: true })).toBeVisible();
      await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
      await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
      await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
      await expect(toggle).toHaveClass(/wxi-menu-right/);
      expect(await chart.evaluate((element) => element.scrollLeft)).toBeCloseTo(preservedScrollLeft, 0);
      for (const entry of deleted) {
        const id = snapshot.data.tasks.find((task) => task.name === entry)!.taskId;
        await expect(page.locator(`.wx-bar[data-task-id=":${id}"]`)).toHaveCount(0);
      }
      const childId = snapshot.data.tasks.find((task) => task.name === "Keep last child")!.taskId;
      await expect(page.locator(`.wx-bar[data-task-id=":${childId}"]`)).toHaveCount(1);
      await page.unroute(`**${api}`);
      await page.unroute(`**${api}/tasks/${snapshot.data.tasks.find((task) => task.name === "Keep last child")!.taskId}`);
      if (recovery === "401") {
        await page.getByRole("button", { name: "편집 잠금 해제", exact: true }).click();
        const unlock = page.getByRole("dialog", { name: "편집 활성화", exact: true });
        await unlock.getByLabel("편집 비밀번호", { exact: true }).fill("DelPwd12345!");
        await unlock.getByRole("button", { name: "편집 활성화", exact: true }).click();
        await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
      }
      const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
      expect(stored.data.project.revision).toBe(confirmed.data.project.revision);
      expect(stored.data.tasks.map((task) => task.name)).toEqual(confirmed.data.tasks.map((task) => task.name));
    }
    await page.reload();
    for (const entry of deleted) await expect(page.getByRole("grid").getByText(entry, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("grid").getByText("Keep last child", { exact: true })).toBeVisible();
  } finally {
    await testInfo.attach("canonical-delete-recovery-trace", { body: JSON.stringify(trace, null, 2), contentType: "application/json" });
  }
});
