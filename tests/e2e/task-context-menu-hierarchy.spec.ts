import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";
import type {
  ProjectSnapshotResponse,
  ProjectTaskDto,
  TaskMutationResponse,
} from "../../src/contracts/projects";

test.use(isolatedApplicationOptions);

const row = (page: import("@playwright/test").Page, name: string) =>
  page.locator(".project-gantt-widget .wx-row", { hasText: name }).first();
const menu = (page: import("@playwright/test").Page) =>
  page.getByRole("menu", { name: "작업 메뉴", exact: true });

async function openMenu(page: import("@playwright/test").Page, name: string) {
  await row(page, name).getByText(name, { exact: true }).click({ button: "right" });
  await expect(menu(page)).toBeVisible();
  return menu(page);
}

async function chooseSubmenu(
  page: import("@playwright/test").Page,
  parent: string,
  item: string,
): Promise<TaskMutationResponse> {
  const root = menu(page);
  const trigger = root.getByRole("menuitem", { name: parent, exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.hover();
  const submenu = page.getByRole("menu", { name: parent, exact: true });
  const action = submenu.getByRole("menuitem", { name: item, exact: true });
  await expect(action).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse((candidate) =>
      candidate.request().method() === "POST" &&
      new URL(candidate.url()).pathname.endsWith("/task-commands"),
    ),
    action.click(),
  ]);
  expect(response.ok(), `task command ${parent} > ${item}: HTTP ${response.status()}`).toBe(true);
  await expect(root).toHaveCount(0);
  return await response.json() as TaskMutationResponse;
}

async function chooseCommand(
  page: import("@playwright/test").Page,
  item: string,
): Promise<TaskMutationResponse> {
  const root = menu(page);
  const action = root.getByRole("menuitem", { name: item, exact: true });
  await expect(action).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse((candidate) =>
      candidate.request().method() === "POST" &&
      new URL(candidate.url()).pathname.endsWith("/task-commands"),
    ),
    action.click(),
  ]);
  expect(response.ok(), `task command ${item}: HTTP ${response.status()}`).toBe(true);
  await expect(root).toHaveCount(0);
  return await response.json() as TaskMutationResponse;
}

async function createRootTask(
  page: import("@playwright/test").Page,
  api: string,
  origin: string,
  revision: number,
  name: string,
): Promise<TaskMutationResponse> {
  const response = await page.request.post(`${api}/tasks`, {
    headers: { Origin: origin, "If-Match": `"${revision}"` },
    data: { name, type: "task", start: "2026-09-21", duration: 1, progress: 0 },
  });
  expect(response.status()).toBe(201);
  return await response.json() as TaskMutationResponse;
}

function orderedRootNames(tasks: readonly ProjectTaskDto[]): string[] {
  return tasks
    .filter((task) => task.parentExternalId === null)
    .sort((left, right) => left.siblingOrder - right.siblingOrder)
    .map((task) => task.name);
}

test("Issue #72 menu exposes Willow commands and readonly users cannot mutate", async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Context menu ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill(`Context-password-${suffix}`);
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

  const path = new URL(page.url()).pathname;
  const api = `/api${path}`;
  const origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const created = await createRootTask(page, api, origin, initial.data.project.revision, "Alpha");
  await page.reload();
  await expect(row(page, "Alpha")).toBeVisible();

  const taskMenu = await openMenu(page, "Alpha");
  for (const label of ["Add", "Convert to", "Edit", "Cut", "Copy", "Paste", "Move", "Indent", "Outdent", "Delete"]) {
    await expect(taskMenu.getByRole("menuitem", { name: label, exact: true })).toHaveCount(1);
  }
  await expect(taskMenu.getByText("Ctrl+X", { exact: true })).toBeVisible();
  await expect(taskMenu.getByText("Ctrl+C", { exact: true })).toBeVisible();
  await expect(taskMenu.getByText("Ctrl+D / Backspace", { exact: true })).toBeVisible();
  await expect(taskMenu.getByRole("menuitem", { name: "Paste", exact: true })).toBeDisabled();
  await expect(taskMenu.getByRole("menuitem", { name: "Indent", exact: true })).toBeDisabled();
  await expect(taskMenu.getByRole("menuitem", { name: "Outdent", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const readonly = await context.newPage();
    await readonly.goto(`${origin}${path}`);
    await expect(readonly.getByText("읽기 전용", { exact: true })).toBeVisible();
    const readonlyMenu = await openMenu(readonly, "Alpha");
    await expect(readonlyMenu.getByRole("menuitem", { name: "Edit", exact: true })).toBeEnabled();
    for (const label of ["Add", "Convert to", "Cut", "Copy", "Paste", "Move", "Indent", "Outdent", "Delete"]) {
      await expect(readonlyMenu.getByRole("menuitem", { name: label, exact: true })).toBeDisabled();
    }
  } finally {
    await context.close();
  }

  expect(created.data.tasks.some((task) => task.name === "Alpha")).toBe(true);
});

test("Issue #72 hierarchy commands persist across reload without remounting the Gantt", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(`Hierarchy E2E ${suffix}`);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill(`Hierarchy-password-${suffix}`);
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
  await expect(row(page, "Gamma")).toBeVisible();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");

  await openMenu(page, "Beta");
  const moved = await chooseSubmenu(page, "Move", "Move up");
  expect(orderedRootNames(moved.data.tasks)).toEqual(["Beta", "Alpha", "Gamma"]);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!);

  await openMenu(page, "Gamma");
  const indented = await chooseCommand(page, "Indent");
  const gammaIndented = indented.data.tasks.find((task) => task.name === "Gamma")!;
  const alphaSummary = indented.data.tasks.find((task) => task.name === "Alpha")!;
  expect(gammaIndented.parentExternalId).toBe(alphaSummary.externalId);
  expect(alphaSummary.type).toBe("summary");

  await openMenu(page, "Gamma");
  await expect(menu(page).getByRole("menuitem", { name: "Outdent", exact: true })).toBeEnabled();
  const outdented = await chooseCommand(page, "Outdent");
  expect(outdented.data.tasks.find((task) => task.name === "Gamma")!.parentExternalId).toBeNull();

  await openMenu(page, "Beta");
  const milestone = await chooseSubmenu(page, "Convert to", "Milestone");
  expect(milestone.data.tasks.find((task) => task.name === "Beta")!.type).toBe("milestone");

  await openMenu(page, "Beta");
  const taskAgain = await chooseSubmenu(page, "Convert to", "Task");
  expect(taskAgain.data.tasks.find((task) => task.name === "Beta")!.type).toBe("task");

  await openMenu(page, "Beta");
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
  await openMenu(page, "Gamma");
  const copied = await chooseSubmenu(page, "Paste", "Below");
  expect(copied.data.tasks.filter((task) => task.name === "Beta")).toHaveLength(2);

  await openMenu(page, "Gamma");
  const added = await chooseSubmenu(page, "Add", "Task above");
  expect(added.data.tasks.some((task) => task.name === "새 작업")).toBe(true);

  const finalRevision = added.data.project.revision;
  await page.reload();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const persisted = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(persisted.data.project.revision).toBe(finalRevision);
  expect(persisted.data.tasks.filter((task) => task.name === "Beta")).toHaveLength(2);
  expect(persisted.data.tasks.find((task) => task.name === "Gamma")!.parentExternalId).toBeNull();
  expect(persisted.data.tasks.some((task) => task.name === "새 작업")).toBe(true);
});
