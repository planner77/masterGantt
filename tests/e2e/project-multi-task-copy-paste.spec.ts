import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { Page } from "@playwright/test";
import type { ProjectSnapshotResponse, ProjectTaskDto, TaskMutationResponse } from "../../src/contracts/projects";
import { chooseTaskInformation } from "./helpers/task-context-menu";

test.use({ ...isolatedApplicationOptions, viewport: { width: 1440, height: 1000 } });
test.setTimeout(90_000);
const row = (page: Page, id: string) => page.locator(`.project-gantt-widget .wx-row[data-id=":${id}"], .project-gantt-widget .wx-row[data-id="${id}"]`);
const checkbox = (page: Page, id: string) => row(page, id).locator("input[data-copy-selection]");
const menu = (page: Page) => page.getByRole("menu", { name: "작업 메뉴", exact: true });
async function seed(page: Page, origin: string) {
  const created = await page.request.post("/api/projects", { headers: { Origin: origin }, data: {
    name: "다중 복사 #384", ownerName: "E2E 자동화", description: "실제 SQLite 다중 Copy 검증", editPassword: "Copy384!",
  } });
  expect(created.status()).toBe(201);
  const project = (await created.json()).data.project;
  const api = `/api/projects/${project.publicId}`;
  let current = await (await page.request.get(api)).json() as ProjectSnapshotResponse | TaskMutationResponse;
  const tasks: Record<string, ProjectTaskDto> = {};
  async function add(name: string, summary: boolean, parent?: ProjectTaskDto) {
    const response = await page.request.post(`${api}/tasks`, {
      headers: { Origin: origin, "If-Match": `"${current.data.project.revision}"` },
      data: summary ? { name, type: "summary" } : { name, type: "task", start: "2026-10-06", duration: 2, progress: 0, ...(parent ? { parentTaskId: parent.taskId } : {}) },
    });
    expect(response.status()).toBe(201); current = await response.json() as TaskMutationResponse;
    tasks[name] = current.data.tasks.find((task) => task.name === name)!; return tasks[name];
  }
  const source = await add("Summary A", true);
  await add("Summary B", true);
  await add("새 작업1", false, source); await add("새 작업2", false, source); await add("새 작업3", false, source); await add("외부 작업", false);
  for (const [from, to] of [["새 작업1", "새 작업2"], ["새 작업2", "새 작업3"], ["외부 작업", "새 작업1"]]) {
    const response = await page.request.post(`${api}/links`, {
      headers: { Origin: origin, "If-Match": `"${current.data.project.revision}"` },
      data: { predecessorExternalId: tasks[from].externalId, successorExternalId: tasks[to].externalId, type: "FS", lag: 1 },
    });
    expect(response.status()).toBe(201); current = await response.json() as TaskMutationResponse;
  }
  await page.goto(`/projects/${project.publicId}`);
  await expect(checkbox(page, tasks["새 작업1"].taskId)).toBeVisible();
  return { api, current, tasks };
}

test("다중 checkbox Copy의 canonical 순서·내부 Link·instance·reload 및 4폭", async ({ page, baseURL, restartIsolatedApplication }, testInfo) => {
  test.setTimeout(180_000);
  const { api, current, tasks } = await seed(page, baseURL!);
  const a = tasks["새 작업1"], b = tasks["새 작업2"], target = tasks["Summary B"];
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const commands: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === `${api}/task-commands`) commands.push(request.postDataJSON());
  });
  const taskHeader = page.locator(".project-gantt-widget .wx-header").getByText("작업", { exact: true }).locator("..");
  const grip = await taskHeader.locator(".wx-grip").boundingBox(); expect(grip).not.toBeNull();
  const initialWidth = (await taskHeader.boundingBox())!.width;
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2); await page.mouse.down();
  await page.mouse.move(grip!.x + grip!.width / 2 + 35, grip!.y + grip!.height / 2, { steps: 5 }); await page.mouse.up();
  const customWidth = (await taskHeader.boundingBox())!.width; expect(customWidth).toBeGreaterThan(initialWidth + 20);
  await page.getByRole("group", { name: "Gantt 표시 단위" }).getByRole("button", { name: "주", exact: true }).click();
  await checkbox(page, b.taskId).check(); await checkbox(page, a.taskId).check();
  await expect(page.getByRole("group", { name: "복사 대상 선택" })).toContainText("선택 2개");
  await expect(row(page, a.taskId)).toHaveAttribute("aria-selected", "true");
  await row(page, a.taskId).getByText(a.name, { exact: true }).click({ button: "right" });
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(checkbox(page, a.taskId)).toBeChecked(); await expect(checkbox(page, b.taskId)).toBeChecked(); expect(commands).toHaveLength(0);
  await row(page, tasks["Summary A"].taskId).locator('[data-action="open-task"]').click();
  await expect(row(page, a.taskId)).toHaveCount(0);
  const chart = page.locator('.project-gantt-widget .wx-chart[tabindex="-1"]');
  const scrollBefore = await chart.evaluate((element) => element.scrollLeft);
  await row(page, target.taskId).getByText(target.name, { exact: true }).click({ button: "right" });
  await menu(page).getByRole("menuitem", { name: "Paste", exact: true }).click();
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/task-commands`);
  await page.getByRole("menu", { name: "Paste", exact: true }).getByRole("menuitem", { name: "As child", exact: true }).click();
  const response = await responsePromise; expect(response.status()).toBe(200);
  const result = await response.json() as TaskMutationResponse;
  expect(commands).toEqual([{ kind: "copy", taskIds: [a.taskId, b.taskId], anchorTaskId: target.taskId, placement: "child" }]);
  expect(result.data.project.revision).toBe(current.data.project.revision + 1);
  const copied = result.data.tasks.filter((task) => task.parentExternalId === target.externalId).sort((left, right) => left.siblingOrder - right.siblingOrder);
  expect(copied.map((task) => task.name)).toEqual([a.name, b.name]); expect(copied.every((task) => ![a.taskId, b.taskId].includes(task.taskId))).toBe(true);
  const copiedLink = result.data.links.find((link) => link.predecessorExternalId === copied[0].externalId && link.successorExternalId === copied[1].externalId)!;
  expect(copiedLink).toMatchObject({ type: "FS", lag: 1 }); expect(current.data.links.some((link) => link.id === copiedLink.id)).toBe(false);
  expect(result.data.links).toHaveLength(current.data.links.length + 1);
  for (const original of current.data.links) expect(result.data.links).toContainEqual(original);
  await expect(row(page, copied[0].taskId)).toBeVisible(); await expect(row(page, copied[1].taskId)).toBeVisible();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  await expect(row(page, a.taskId)).toHaveCount(0);
  expect(Math.abs((await taskHeader.boundingBox())!.width - customWidth)).toBeLessThanOrEqual(1);
  expect(await chart.evaluate((element) => element.scrollLeft)).toBe(scrollBefore);
  await expect(page.locator(`[data-link-id=":${copiedLink.id}"], [data-link-id="${copiedLink.id}"]`).first()).toBeVisible();
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);
  await row(page, copied[1].taskId).getByText(copied[1].name, { exact: true }).click({ button: "right" }); await chooseTaskInformation(page);
  await page.getByRole("dialog", { name: "작업 정보", exact: true }).getByRole("tab", { name: /^관계/ }).click();
  await expect(page.getByRole("dialog", { name: "작업 정보", exact: true })).toContainText(copied[0].name); await page.keyboard.press("Escape");
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await expect(checkbox(page, copied[0].taskId)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`multi-copy-${width}.png`), fullPage: true });
  }
  await page.reload(); await expect(row(page, copied[0].taskId)).toBeVisible();
  const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.project.revision).toBe(result.data.project.revision); expect(stored.data.links).toContainEqual(copiedLink);
  const cookies = await page.context().cookies();
  await restartIsolatedApplication();
  expect(await page.context().cookies()).toEqual(cookies);
  const restartedResponse = await page.request.get(api); expect(restartedResponse.status()).toBe(200);
  const restarted = await restartedResponse.json() as ProjectSnapshotResponse;
  expect(restarted.data.project.publicId).toBe(stored.data.project.publicId);
  expect(restarted.data.project.revision).toBe(stored.data.project.revision);
  expect(restarted.data.tasks).toEqual(stored.data.tasks); expect(restarted.data.links).toEqual(stored.data.links);
  const session = await (await page.request.get(`${api}/edit-sessions/current`)).json();
  expect(session.data.permission).toBe("edit");
  await page.reload(); await expect(row(page, copied[0].taskId)).toBeVisible(); await expect(row(page, copied[1].taskId)).toBeVisible();
  await expect(page.locator(`[data-link-id=":${copiedLink.id}"], [data-link-id="${copiedLink.id}"]`).first()).toBeVisible();
});

test("modifier·Shift checkbox·Space·Escape·checkbox Copy/Paste shortcut", async ({ page, baseURL }) => {
  const { api, tasks } = await seed(page, baseURL!);
  const a = tasks["새 작업1"], b = tasks["새 작업2"], c = tasks["새 작업3"];
  const group = page.getByRole("group", { name: "복사 대상 선택" });
  await checkbox(page, a.taskId).click(); await checkbox(page, c.taskId).click({ modifiers: ["Shift"] });
  await expect(group).toContainText("선택 3개"); for (const task of [a, b, c]) await expect(checkbox(page, task.taskId)).toBeChecked();
  await checkbox(page, b.taskId).focus(); await page.keyboard.press("Space"); await expect(group).toContainText("선택 2개");
  await expect(checkbox(page, b.taskId)).not.toBeChecked(); await page.keyboard.press("Space"); await expect(group).toContainText("선택 3개");
  await page.keyboard.press("Escape"); await expect(group).toContainText("선택 0개"); await expect(checkbox(page, b.taskId)).toBeFocused();
  await row(page, a.taskId).getByText(a.name, { exact: true }).click({ modifiers: ["Control"] });
  await row(page, b.taskId).getByText(b.name, { exact: true }).click({ modifiers: ["Control"] });
  await expect(group).toContainText("선택 2개"); await expect(page.locator(".wx-cell.wx-editor input")).toHaveCount(0);
  await checkbox(page, b.taskId).focus(); await page.keyboard.press("Control+c");
  await expect(page.getByText(/선택한 2개 작업을 복사했습니다/)).toBeVisible();
  await expect(checkbox(page, a.taskId)).toBeChecked(); await expect(checkbox(page, b.taskId)).toBeChecked();
  const target = tasks["Summary B"]; await checkbox(page, target.taskId).focus();
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/task-commands`);
  await page.keyboard.press("Control+v"); const response = await responsePromise; expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ kind: "copy", taskIds: [a.taskId, b.taskId], anchorTaskId: target.taskId, placement: "after" });
});

test("접힘은 선택을 보존하고 실제 필터 변경은 선택과 clipboard를 정리한다", async ({ page, baseURL }) => {
  const { tasks } = await seed(page, baseURL!);
  const a = tasks["새 작업1"], b = tasks["새 작업2"], source = tasks["Summary A"], target = tasks["Summary B"];
  const group = page.getByRole("group", { name: "복사 대상 선택" });
  await checkbox(page, a.taskId).check(); await checkbox(page, b.taskId).check();
  await group.getByRole("button", { name: "선택 복사", exact: true }).click();
  await row(page, source.taskId).locator('[data-action="open-task"]').click();
  await expect(row(page, a.taskId)).toHaveCount(0); await expect(group).toContainText("선택 2개 · 접힌 하위 2개");
  await checkbox(page, target.taskId).check(); await expect(group).toContainText("선택 3개 · 접힌 하위 2개");
  const query = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true });
  await query.fill("새 작업1"); await expect(group).toContainText("선택 1개");
  await expect(page.getByText(/표시 범위 밖의 선택 2개를 해제/)).toBeVisible();
  await query.focus(); await page.keyboard.press("Control+c");
  await expect(page.getByText(/선택한 1개 작업을 복사했습니다/)).toHaveCount(0);
  await query.fill(""); await expect(row(page, target.taskId)).toBeVisible();
  await row(page, target.taskId).getByText(target.name, { exact: true }).click({ button: "right" });
  await expect(menu(page).getByRole("menuitem", { name: "Paste", exact: true })).toBeDisabled();
});

test("URL task의 modifier·checkbox 선택은 링크 실행을 막고 일반 Chart 클릭은 유지한다", async ({ page, baseURL }) => {
  const { api, current, tasks } = await seed(page, baseURL!);
  const a = tasks["새 작업1"];
  const url = `${baseURL}/projects/new`;
  const updated = await page.request.patch(`${api}/tasks/${a.taskId}`, { headers: { Origin: baseURL!, "If-Match": `"${current.data.project.revision}"` }, data: { url } });
  expect(updated.status()).toBe(200); await page.reload();
  const bar = page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${a.taskId}"]`);
  await expect(bar).toHaveAttribute("data-task-url", url);
  await page.evaluate(() => {
    const tracked = window as typeof window & { __copyOpenedUrls: string[] };
    tracked.__copyOpenedUrls = [];
    window.open = ((value?: string | URL) => { tracked.__copyOpenedUrls.push(String(value)); return null; }) as typeof window.open;
  });
  for (const modifier of ["Control", "Meta", "Shift"] as const) await bar.click({ modifiers: [modifier] });
  const label = checkbox(page, a.taskId).locator("..");
  await label.click({ position: { x: 3, y: 18 } });
  expect(await page.evaluate(() => (window as typeof window & { __copyOpenedUrls: string[] }).__copyOpenedUrls)).toEqual([]);
  await bar.click();
  expect(await page.evaluate(() => (window as typeof window & { __copyOpenedUrls: string[] }).__copyOpenedUrls)).toEqual([url]);
});

test("pending 다중 Copy는 연속 mutation을 막고 실제 412 후 stale clipboard를 폐기한다", async ({ page, baseURL }) => {
  const { api, current, tasks } = await seed(page, baseURL!);
  const a = tasks["새 작업1"], b = tasks["새 작업2"], target = tasks["Summary B"];
  await checkbox(page, a.taskId).check(); await checkbox(page, b.taskId).check();
  await page.getByRole("group", { name: "복사 대상 선택" }).getByRole("button", { name: "선택 복사", exact: true }).click();
  const concurrent = await page.request.post(`${api}/tasks`, { headers: { Origin: baseURL!, "If-Match": `"${current.data.project.revision}"` }, data: { name: "동시 저장", type: "task", start: "2026-10-06", duration: 1, progress: 0 } });
  expect(concurrent.status()).toBe(201);
  let release!: () => void, count = 0;
  await page.route(`**${api}/task-commands`, async (route) => { count++; await new Promise<void>((resolve) => { release = resolve; }); await route.continue(); });
  await row(page, target.taskId).getByText(target.name, { exact: true }).click({ button: "right" });
  await menu(page).getByRole("menuitem", { name: "Paste", exact: true }).click();
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/task-commands`);
  await page.getByRole("menu", { name: "Paste", exact: true }).getByRole("menuitem", { name: "As child", exact: true }).click();
  await expect.poll(() => count).toBe(1);
  await expect(page.locator(".project-gantt-frame")).toHaveAttribute("data-task-mutation-locked", "true");
  await expect(page.getByRole("group", { name: "복사 대상 선택" }).getByRole("button", { name: "선택 복사", exact: true })).toBeDisabled();
  await checkbox(page, target.taskId).focus(); await page.keyboard.press("Control+c"); await page.keyboard.press("Control+v"); expect(count).toBe(1);
  release(); expect((await responsePromise).status()).toBe(412);
  await expect(page.getByTestId("workspace-toast")).toContainText("다른 편집 내용");
  await expect(page.locator(".project-gantt-frame")).not.toHaveAttribute("data-task-mutation-locked", "true");
  await row(page, target.taskId).getByText(target.name, { exact: true }).click({ button: "right" });
  await expect(menu(page).getByRole("menuitem", { name: "Paste", exact: true })).toBeDisabled();
  const stored = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(stored.data.project.revision).toBe(current.data.project.revision + 1); expect(stored.data.tasks).toHaveLength(current.data.tasks.length + 1); expect(stored.data.links).toEqual(current.data.links);
});

test("다중 선택 상태의 Edit·Cut·Delete는 실제 focus 작업 하나만 적용한다", async ({ page, baseURL }) => {
  const { api, current, tasks } = await seed(page, baseURL!);
  const added = await page.request.post(`${api}/tasks`, { headers: { Origin: baseURL!, "If-Match": `"${current.data.project.revision}"` }, data: { name: "단일 Cut 대상", type: "task", start: "2026-10-06", duration: 1, progress: 0 } });
  expect(added.status()).toBe(201);
  const before = await added.json() as TaskMutationResponse;
  const single = before.data.tasks.find((task) => task.name === "단일 Cut 대상")!, selectedOther = tasks["Summary B"];
  await page.reload(); await checkbox(page, single.taskId).check(); await checkbox(page, selectedOther.taskId).check();
  await row(page, single.taskId).getByText(single.name, { exact: true }).click({ button: "right" }); await chooseTaskInformation(page);
  await expect(page.getByRole("dialog", { name: "작업 정보", exact: true }).getByLabel("작업명", { exact: true })).toHaveValue(single.name); await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "복사 대상 선택" })).toContainText("선택 2개");
  await row(page, single.taskId).getByText(single.name, { exact: true }).click({ button: "right" });
  await menu(page).getByRole("menuitem", { name: "Cut", exact: true }).click();
  const target = tasks["Summary A"];
  await row(page, target.taskId).getByText(target.name, { exact: true }).click({ button: "right" });
  await menu(page).getByRole("menuitem", { name: "Paste", exact: true }).click();
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/task-commands`);
  await page.getByRole("menu", { name: "Paste", exact: true }).getByRole("menuitem", { name: "As child", exact: true }).click();
  const response = await responsePromise; expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ kind: "reparent", taskId: single.taskId, anchorTaskId: target.taskId, placement: "child" });
  const after = await response.json() as TaskMutationResponse;
  expect(after.data.tasks).toHaveLength(before.data.tasks.length);
  expect(after.data.tasks.find((task) => task.taskId === single.taskId)?.parentExternalId).toBe(target.externalId);
  expect(after.data.tasks.find((task) => task.taskId === selectedOther.taskId)?.parentExternalId).toBeNull();
  await page.getByRole("group", { name: "복사 대상 선택" }).getByRole("button", { name: "선택 해제", exact: true }).click();
  await checkbox(page, single.taskId).check(); await checkbox(page, selectedOther.taskId).check();
  await row(page, single.taskId).getByText(single.name, { exact: true }).click({ button: "right" });
  const removedPromise = page.waitForResponse((response) => response.request().method() === "DELETE" && new URL(response.url()).pathname === `${api}/tasks/${single.taskId}`);
  await menu(page).getByRole("menuitem", { name: "Delete", exact: true }).click();
  expect((await removedPromise).status()).toBe(200);
  const persisted = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(persisted.data.tasks).toHaveLength(after.data.tasks.length - 1);
  expect(persisted.data.tasks.some((task) => task.taskId === single.taskId)).toBe(false);
  expect(persisted.data.tasks.some((task) => task.taskId === selectedOther.taskId)).toBe(true);
});


test("Shift 범위는 필터 문맥 Summary를 제외하고 동일 match의 query 변경도 clipboard를 폐기한다", async ({ page, baseURL }) => {
  const { api, current, tasks } = await seed(page, baseURL!);
  let revision = current.data.project.revision;
  const add = async (name: string, parent: ProjectTaskDto, summary = false) => {
    const response = await page.request.post(`${api}/tasks`, { headers: { Origin: baseURL!, "If-Match": `"${revision}"` }, data: summary
      ? { name, type: "summary", parentTaskId: parent.taskId }
      : { name, type: "task", parentTaskId: parent.taskId, start: "2026-10-06", duration: 1, progress: 0 } });
    expect(response.status()).toBe(201); const result = await response.json() as TaskMutationResponse;
    revision = result.data.project.revision; return result.data.tasks.find((task) => task.name === name)!;
  };
  const context = await add("문맥 Summary", tasks["Summary A"], true);
  const nested = await add("새 작업 nested", context);
  const last = await add("새 작업4", tasks["Summary A"]);
  await page.reload(); await checkbox(page, context.taskId).check();
  const group = page.getByRole("group", { name: "복사 대상 선택" });
  const query = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true });
  await query.fill("새 작업"); await expect(group).toContainText("선택 0개");
  await expect(row(page, context.taskId)).toBeVisible(); await expect(checkbox(page, context.taskId)).not.toBeChecked();
  await checkbox(page, tasks["새 작업1"].taskId).check(); await checkbox(page, last.taskId).click({ modifiers: ["Shift"] });
  await expect(group).toContainText("선택 4개"); await expect(checkbox(page, context.taskId)).not.toBeChecked(); await expect(checkbox(page, nested.taskId)).not.toBeChecked();
  await group.getByRole("button", { name: "선택 복사", exact: true }).click();
  await query.fill("새");
  await expect(page.getByText("표시 범위가 변경되어 이전 클립보드를 비웠습니다.", { exact: true })).toBeVisible();
  await row(page, context.taskId).getByText(context.name, { exact: true }).click({ button: "right" });
  await expect(menu(page).getByRole("menuitem", { name: "Paste", exact: true })).toBeDisabled();
});
