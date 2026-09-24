import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { TaskMutationResponse } from "../../src/contracts/projects";
import {
  expectSameGanttRoot,
  ganttRoot,
  installStatefulProjectFixture,
  publicId,
  rememberGanttRoot,
  rowNamed,
  taskPath,
  type StatefulProjectFixture,
} from "../fixtures/stateful-project";

const id = (ordinal: number) => `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;
const nameCell = (page: Page, name: string) => rowNamed(page, name).locator('[role="gridcell"][data-col-id="text"]');
const inlineInput = (page: Page) => ganttRoot(page).locator('[role="gridcell"][data-col-id="text"] input.wx-text');

async function openName(page: Page, name: string) {
  const cell = nameCell(page, name);
  await cell.locator(".wx-content > .wx-text").click();
  await expect(cell.locator("input.wx-text")).toBeFocused();
  return cell.locator("input.wx-text");
}

async function routeRenames(page: Page, fixture: StatefulProjectFixture) {
  const patches: Request[] = [];
  let failure: 401 | 409 | 412 | 500 | "network" | null = null;
  const handler = async (route: Route) => {
    const request = route.request();
    if (request.method() !== "PATCH") { await route.continue(); return; }
    patches.push(request);
    if (failure === "network") { failure = null; await route.abort("failed"); return; }
    if (failure !== null) {
      const status = failure; failure = null;
      await route.fulfill({ status, json: { error: { code: status === 412 ? "REVISION_MISMATCH" : status === 401 ? "UNAUTHORIZED" : status === 409 ? "UNSUPPORTED_SCHEDULE_STRUCTURE" : "INTERNAL_ERROR", message: "Rejected by inline-name fixture." } } });
      return;
    }
    expect(request.headers()["if-match"]).toBe(`"${fixture.project.revision}"`);
    const taskId = new URL(request.url()).pathname.split("/").at(-1);
    const task = fixture.tasks.find((entry) => entry.taskId === taskId);
    expect(task).toBeTruthy();
    const body = request.postDataJSON() as { name?: string };
    expect(Object.keys(body)).toEqual(["name"]);
    if (fixture.links.some((link) => link.predecessorExternalId === task!.externalId || link.successorExternalId === task!.externalId)) {
      await route.fulfill({ status: 409, json: { error: { code: "UNSUPPORTED_SCHEDULE_STRUCTURE", message: "Linked endpoint." } } });
      return;
    }
    task!.name = body.name!;
    fixture.project.revision += 1;
    const response: TaskMutationResponse = { data: {
      project: { ...fixture.project }, tasks: fixture.tasks.map((entry) => ({ ...entry })),
      links: fixture.links.map((entry) => ({ ...entry })), warnings: [],
      operation: { kind: "taskUpdate", changedTaskExternalIds: [task!.externalId], deletedTaskExternalIds: [], deletedLinkIds: [] },
    } };
    await route.fulfill({ json: response });
  };
  await page.route(`**${taskPath}/*`, handler);
  return { patches, failOnce: (next: typeof failure) => { failure = next; } };
}

test("single-click names use one canonical PATCH across Summary, Task and Milestone", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.tasks[2].url = "https://example.invalid/leaf";
  const route = await routeRenames(page, fixture);
  await page.addInitScript(() => {
    const tracked = window as typeof window & { __openedTaskUrls?: string[] };
    tracked.__openedTaskUrls = [];
    window.open = ((url?: string | URL) => { tracked.__openedTaskUrls!.push(String(url)); return null; }) as typeof window.open;
  });
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  await expect.poll(() => rowNamed(page, "Stable leaf").getAttribute("data-task-url")).toBe("https://example.invalid/leaf");
  const summaryToggleClass = await nameCell(page, "Stable summary").locator('[data-action="open-task"]').getAttribute("class");
  const leafBar = ganttRoot(page).locator(`.wx-bar[data-task-id=":${id(3)}"]`);
  const leafBarBefore = await leafBar.boundingBox();
  expect(leafBarBefore).not.toBeNull();

  for (const [before, after] of [["Stable summary", "Renamed summary"], ["Stable leaf", "001"], ["Stable milestone", "Renamed milestone"]] as const) {
    const input = await openName(page, before);
    await input.fill(`  ${after}  `);
    const beforeCount = route.patches.length;
    await input.press("Enter");
    await expect.poll(() => route.patches.length).toBe(beforeCount + 1);
    await expect(nameCell(page, after)).toBeVisible();
    await expectSameGanttRoot(page, identity);
  }
  expect(await nameCell(page, "Renamed summary").locator('[data-action="open-task"]').getAttribute("class")).toBe(summaryToggleClass);
  const leafBarAfter = await leafBar.boundingBox();
  expect(leafBarAfter).not.toBeNull();
  expect(leafBarAfter!.x).toBeCloseTo(leafBarBefore!.x, 0);
  expect(leafBarAfter!.width).toBeCloseTo(leafBarBefore!.width, 0);
  await nameCell(page, "001").focus();
  await nameCell(page, "001").press("F2");
  await expect(inlineInput(page)).toBeFocused();
  await inlineInput(page).fill("002");
  await inlineInput(page).press("Enter");
  await expect(nameCell(page, "002")).toBeVisible();
  await nameCell(page, "Renamed milestone").focus();
  await nameCell(page, "Renamed milestone").press("F2");
  await expect(inlineInput(page)).toBeFocused();
  await inlineInput(page).press("Escape");
  expect(route.patches.map((request) => request.postDataJSON())).toEqual([{ name: "Renamed summary" }, { name: "001" }, { name: "Renamed milestone" }, { name: "002" }]);
  expect(await page.evaluate(() => (window as typeof window & { __openedTaskUrls?: string[] }).__openedTaskUrls)).toEqual([]);
  await page.reload();
  for (const name of ["Renamed summary", "002", "Renamed milestone"]) await expect(nameCell(page, name)).toBeVisible();

  // Other cells and tree controls keep their native behavior and do not open an editor.
  await nameCell(page, "Renamed summary").locator('[data-action="open-task"]').click();
  await expect(inlineInput(page)).toHaveCount(0);
  await rowNamed(page, "Renamed milestone").locator('[role="gridcell"][data-col-id="projectStart"]').click();
  await expect(inlineInput(page)).toHaveCount(0);
  expect(route.patches).toHaveLength(4);
});

test("invalid input stays focused, Escape cancels, blur saves once, and failures keep canonical names", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  const route = await routeRenames(page, fixture);
  await page.goto(`/projects/${publicId}`);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const editor = await openName(page, "Stable leaf");
    const bounds = await editor.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await editor.press("Escape");
    await expect(inlineInput(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const input = await openName(page, "Stable leaf");
  await input.fill("   ");
  await input.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute("aria-describedby", /inline-name-status/);
  await expect(ganttRoot(page).getByRole("alert")).toContainText("1~200자");
  const errorBounds = await ganttRoot(page).getByRole("alert").boundingBox();
  expect(errorBounds).not.toBeNull();
  expect(errorBounds!.x).toBeGreaterThanOrEqual(0);
  expect(errorBounds!.x + errorBounds!.width).toBeLessThanOrEqual(391);
  expect(route.patches).toHaveLength(0);
  await input.fill("x".repeat(201));
  await input.press("Enter");
  await expect(input).toBeFocused();
  expect(route.patches).toHaveLength(0);
  await input.fill("한글 조합 중");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(input).toBeFocused();
  expect(route.patches).toHaveLength(0);
  await input.dispatchEvent("compositionend");
  await input.fill("Cancel me");
  await input.press("Escape");
  await expect(inlineInput(page)).toHaveCount(0);
  await expect(nameCell(page, "Stable leaf")).toBeFocused();
  expect(route.patches).toHaveLength(0);

  const retry = await openName(page, "Stable leaf");
  await retry.fill("Blur saved");
  await page.getByRole("button", { name: "주", exact: true }).click();
  await expect(nameCell(page, "Blur saved")).toBeVisible();
  expect(route.patches).toHaveLength(1);

  route.failOnce(500);
  const rejected = await openName(page, "Blur saved");
  await rejected.fill("Rejected name");
  await rejected.press("Enter");
  await expect(ganttRoot(page).getByRole("alert")).toBeVisible();
  await expect(nameCell(page, "Blur saved")).toBeVisible();
  expect(route.patches).toHaveLength(2);

  for (const failure of [412, "network"] as const) {
    route.failOnce(failure);
    const attempted = await openName(page, "Blur saved");
    await attempted.fill(`Failed ${failure}`);
    await attempted.press("Enter");
    await expect(nameCell(page, "Blur saved")).toBeVisible();
  }
  expect(route.patches).toHaveLength(4);

  // A dependency added by another editor after opening reaches the server's
  // existing 409 protection; the old canonical name remains on screen.
  const linkedRace = await openName(page, "Blur saved");
  fixture.links.push({ id: "late-link", predecessorExternalId: "SUMMARY-CHILD-1", successorExternalId: "LEAF-1", type: "FS", lag: 0 });
  await linkedRace.fill("Forbidden linked rename");
  await linkedRace.press("Enter");
  await expect(nameCell(page, "Blur saved")).toBeVisible();
  await expect(page.getByTestId("workspace-toast")).toContainText("관계가 연결된 작업");
  expect(route.patches).toHaveLength(5);

  route.failOnce(401);
  const unauthorized = await openName(page, "Stable milestone");
  await unauthorized.fill("Unauthorized name");
  await unauthorized.press("Enter");
  await expect(nameCell(page, "Stable milestone")).toBeVisible();
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  expect(route.patches).toHaveLength(6);
});

test("linked endpoints, unrelated tasks, readonly state, and narrow layout preserve existing contracts", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  fixture.links.push({ id: "inline-link", predecessorExternalId: "SUMMARY-CHILD-1", successorExternalId: "LEAF-1", type: "FS", lag: 0 });
  fixture.tasks[2].url = "https://example.invalid/linked";
  const route = await routeRenames(page, fixture);
  await page.addInitScript(() => {
    const tracked = window as typeof window & { __openedTaskUrls?: string[] };
    tracked.__openedTaskUrls = [];
    window.open = ((url?: string | URL) => { tracked.__openedTaskUrls!.push(String(url)); return null; }) as typeof window.open;
  });
  await page.goto(`/projects/${publicId}`);
  await expect(nameCell(page, "Stable leaf")).toHaveAttribute("aria-readonly", "true");
  await expect.poll(() => rowNamed(page, "Stable leaf").getAttribute("data-task-url")).toBe("https://example.invalid/linked");
  await nameCell(page, "Stable leaf").locator(".wx-content > .wx-text").click();
  await expect(inlineInput(page)).toHaveCount(0);
  await expect.poll(async () => (await page.evaluate(() => (window as typeof window & { __openedTaskUrls?: string[] }).__openedTaskUrls))?.length).toBe(1);
  await expect.poll(() => ganttRoot(page).locator(`.wx-bar[data-task-id=":${id(3)}"]`).getAttribute("data-task-url")).toBe("https://example.invalid/linked");
  await ganttRoot(page).locator(`.wx-bar[data-task-id=":${id(3)}"]`).click();
  await expect.poll(async () => (await page.evaluate(() => (window as typeof window & { __openedTaskUrls?: string[] }).__openedTaskUrls))?.length).toBe(2);
  expect(await page.evaluate(() => (window as typeof window & { __openedTaskUrls?: string[] }).__openedTaskUrls)).toEqual([
    "https://example.invalid/linked", "https://example.invalid/linked",
  ]);
  expect(route.patches).toHaveLength(0);
  const unrelated = await openName(page, "Stable milestone");
  await unrelated.fill("Unrelated rename");
  await unrelated.press("Enter");
  await expect(nameCell(page, "Unrelated rename")).toBeVisible();

  fixture.sessionEditable = false;
  await page.reload();
  await nameCell(page, "Unrelated rename").locator(".wx-content > .wx-text").click();
  await expect(inlineInput(page)).toHaveCount(0);
  expect(route.patches).toHaveLength(1);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(ganttRoot(page).locator(".wx-table-container")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
