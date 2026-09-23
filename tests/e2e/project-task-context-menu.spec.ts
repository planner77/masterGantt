import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";

test.use(isolatedApplicationOptions);

async function snapshot(page: import("@playwright/test").Page, api: string) {
  const response = await page.request.get(api);
  expect(response.status()).toBe(200);
  return await response.json() as ProjectSnapshotResponse;
}

async function createTask(
  page: import("@playwright/test").Page,
  api: string,
  origin: string,
  revision: number,
  name: string,
) {
  const response = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${revision}"` },
    data: { name, type: "task", start: "2026-09-21", duration: 1, progress: 0 },
  });
  expect(response.status()).toBe(201);
  return await response.json() as TaskMutationResponse;
}

const row = (page: import("@playwright/test").Page, name: string) =>
  page.locator(".project-gantt-widget .wx-row", { hasText: name }).first();

async function openTaskMenu(page: import("@playwright/test").Page, name: string) {
  const target = row(page, name);
  await expect(target).toBeVisible();
  await target.getByText(name, { exact: true }).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "작업 메뉴", exact: true });
  await expect(menu).toBeVisible();
  return menu;
}

async function runSubmenu(
  page: import("@playwright/test").Page,
  menuName: string,
  itemName: string,
) {
  const menu = page.getByRole("menu", { name: "작업 메뉴", exact: true });
  const trigger = menu.getByRole("menuitem", { name: menuName, exact: true });
  await trigger.hover();
  const submenu = page.getByRole("menu", { name: menuName, exact: true });
  await expect(submenu).toBeVisible();
  await submenu.getByRole("menuitem", { name: itemName, exact: true }).click();
}

async function expectStructureToast(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("workspace-toast")).toContainText("작업 구조를 변경했습니다");
}

test("Issue #77 Context Menu opens without activating a submenu", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Context initial state ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("CtxPwd12345!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const initial = await snapshot(page, api);
  const created = await createTask(page, api, origin, initial.data.project.revision, "Context initial");
  const taskId = created.data.tasks.find((task) => task.name === "Context initial")!.taskId;

  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();

  const rootMenu = page.getByRole("menu", { name: "작업 메뉴", exact: true });
  const addSubmenu = page.getByRole("menu", { name: "Add", exact: true });

  // Grid: opening the root menu must not implicitly activate the first submenu.
  await openTaskMenu(page, "Context initial");
  await expect(addSubmenu).toBeHidden();
  await expect(rootMenu).toBeFocused();

  // Explicit pointer intent opens the submenu.
  await rootMenu.getByRole("menuitem", { name: "Add", exact: true }).hover();
  await expect(addSubmenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(rootMenu).toHaveCount(0);

  // Reopening starts from a clean root-menu state.
  await openTaskMenu(page, "Context initial");
  await expect(addSubmenu).toBeHidden();
  await expect(rootMenu).toBeFocused();

  // Explicit keyboard navigation selects Add, then ArrowRight enters its submenu.
  await page.keyboard.press("ArrowDown");
  const add = rootMenu.getByRole("menuitem", { name: "Add", exact: true });
  await expect(add).toBeFocused();
  await expect(addSubmenu).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(addSubmenu.getByRole("menuitem", { name: "Child task", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");

  // Chart: same initial behavior as Grid.
  const bar = page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${taskId}"]`);
  await expect(bar).toBeAttached();
  await bar.click({ button: "right" });
  await expect(rootMenu).toBeVisible();
  await expect(rootMenu).toBeFocused();
  await expect(addSubmenu).toBeHidden();
  await page.keyboard.press("Escape");
});

test("Issue #72 Context Menu hierarchy commands persist canonical state without remounting", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Context hierarchy ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("CtxPwd12345!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  let current = await snapshot(page, api);

  const aBody = await createTask(page, api, origin, current.data.project.revision, "Context A");
  const a = aBody.data.tasks.find((task) => task.name === "Context A")!;
  const bBody = await createTask(page, api, origin, aBody.data.project.revision, "Context B");
  const b = bBody.data.tasks.find((task) => task.name === "Context B")!;
  const cBody = await createTask(page, api, origin, bBody.data.project.revision, "Context C");
  const c = cBody.data.tasks.find((task) => task.name === "Context C")!;

  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");

  let menu = await openTaskMenu(page, "Context B");
  for (const name of ["Add", "Convert to", "Edit", "Cut", "Copy", "Paste", "Move", "Indent", "Outdent", "Delete"]) {
    await expect(menu.getByRole("menuitem", { name, exact: true })).toBeVisible();
  }
  await expect(menu.getByRole("menuitem", { name: "Paste", exact: true })).toBeDisabled();
  await expect(menu.getByRole("menuitem", { name: "Outdent", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");

  menu = await openTaskMenu(page, "Context B");
  await runSubmenu(page, "Move", "Move up");
  await expectStructureToast(page);
  current = await snapshot(page, api);
  expect(current.data.tasks
    .filter((task) => task.parentExternalId === null)
    .sort((left, right) => left.siblingOrder - right.siblingOrder)
    .map((task) => task.name)).toEqual(["Context B", "Context A", "Context C"]);

  menu = await openTaskMenu(page, "Context A");
  await menu.getByRole("menuitem", { name: "Indent", exact: true }).click();
  await expectStructureToast(page);
  current = await snapshot(page, api);
  const afterIndentA = current.data.tasks.find((task) => task.taskId === a.taskId)!;
  const afterIndentB = current.data.tasks.find((task) => task.taskId === b.taskId)!;
  expect(afterIndentA.parentExternalId).toBe(afterIndentB.externalId);
  expect(afterIndentB.type).toBe("summary");

  // A가 B의 유일한 child이면 Outdent는 B를 빈 Summary로 만들기 때문에 금지된다.
  // B 아래에 sibling child를 하나 더 만든 뒤에 허용되는 Outdent 경로를 검증한다.
  menu = await openTaskMenu(page, "Context B");
  await runSubmenu(page, "Add", "Child task");
  await expectStructureToast(page);
  current = await snapshot(page, api);
  const bChildren = current.data.tasks.filter((task) => task.parentExternalId === afterIndentB.externalId);
  expect(bChildren).toHaveLength(2);

  menu = await openTaskMenu(page, "Context A");
  await expect(menu.getByRole("menuitem", { name: "Outdent", exact: true })).toBeEnabled();
  await menu.getByRole("menuitem", { name: "Outdent", exact: true }).click();
  await expectStructureToast(page);
  current = await snapshot(page, api);
  expect(current.data.tasks.find((task) => task.taskId === a.taskId)?.parentExternalId).toBeNull();

  menu = await openTaskMenu(page, "Context C");
  await menu.getByRole("menuitem", { name: "Copy", exact: true }).click();
  menu = await openTaskMenu(page, "Context A");
  await expect(menu.getByRole("menuitem", { name: "Paste", exact: true })).toBeEnabled();
  await runSubmenu(page, "Paste", "Below");
  await expectStructureToast(page);
  current = await snapshot(page, api);
  const copies = current.data.tasks.filter((task) => task.name === "Context C");
  expect(copies).toHaveLength(2);
  expect(new Set(copies.map((task) => task.taskId)).size).toBe(2);
  expect(copies.some((task) => task.taskId === c.taskId)).toBe(true);

  menu = await openTaskMenu(page, "Context A");
  await runSubmenu(page, "Convert to", "Milestone");
  await expectStructureToast(page);
  current = await snapshot(page, api);
  expect(current.data.tasks.find((task) => task.taskId === a.taskId)).toMatchObject({
    type: "milestone",
    duration: 0,
  });

  const beforeAddRevision = current.data.project.revision;
  menu = await openTaskMenu(page, "Context A");
  await runSubmenu(page, "Add", "Task below");
  await expectStructureToast(page);
  current = await snapshot(page, api);
  expect(current.data.project.revision).toBe(beforeAddRevision + 1);
  expect(current.data.tasks.some((task) => task.name === "새 작업")).toBe(true);

  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await page.reload();
  current = await snapshot(page, api);
  expect(current.data.tasks.find((task) => task.taskId === a.taskId)?.type).toBe("milestone");
  expect(current.data.tasks.filter((task) => task.name === "Context C")).toHaveLength(2);
  await expect(page.getByRole("grid").getByText("Context A", { exact: true })).toBeVisible();
});


test("Issue #104 unrelated task context actions stay enabled when other tasks are linked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Context link scope ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("CtxPwd12345!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const current = await snapshot(page, api);
  const first = await createTask(page, api, origin, current.data.project.revision, "Linked A");
  const second = await createTask(page, api, origin, first.data.project.revision, "Linked B");
  const third = await createTask(page, api, origin, second.data.project.revision, "Unlinked C");

  const a = third.data.tasks.find((task) => task.name === "Linked A")!;
  const b = third.data.tasks.find((task) => task.name === "Linked B")!;
  const link = await page.request.post(`${api}/links`, {
    headers: { Origin: origin, "If-Match": `"${third.data.project.revision}"` },
    data: {
      predecessorExternalId: a.externalId,
      successorExternalId: b.externalId,
      type: "FS",
      lag: 0,
    },
  });
  expect(link.status()).toBe(201);

  await page.reload();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();

  const unrelatedMenu = await openTaskMenu(page, "Unlinked C");
  for (const name of ["Add", "Convert to", "Cut", "Copy", "Move", "Delete"]) {
    await expect(unrelatedMenu.getByRole("menuitem", { name, exact: true })).toBeEnabled();
  }
  await unrelatedMenu.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.locator(".project-gantt-widget .wx-row", { hasText: "Unlinked C" })).toHaveCount(0);
  const afterDelete = await snapshot(page, api);
  expect(afterDelete.data.links).toHaveLength(1);
  expect(afterDelete.data.links[0]).toMatchObject({
    predecessorExternalId: a.externalId,
    successorExternalId: b.externalId,
  });

  const linkedMenu = await openTaskMenu(page, "Linked A");
  await expect(linkedMenu.getByRole("menuitem", { name: "Edit", exact: true })).toBeEnabled();
  for (const name of ["Add", "Convert to", "Cut", "Copy", "Move", "Delete"]) {
    await expect(linkedMenu.getByRole("menuitem", { name, exact: true })).toBeDisabled();
  }
});
