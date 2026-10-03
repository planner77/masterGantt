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

const startCell = (page: Page, name: string) =>
  rowNamed(page, name).locator('[role="gridcell"][data-col-id=":projectStart"]');
const startPicker = (page: Page) =>
  ganttRoot(page).getByRole("dialog", { name: "시작일 날짜 선택", exact: true });
const startInput = (page: Page) =>
  startPicker(page).getByLabel("시작일 선택", { exact: true });

async function routeStartUpdates(page: Page, fixture: StatefulProjectFixture) {
  const patches: Request[] = [];
  let failure: 409 | 412 | 422 | 500 | "network" | null = null;
  const handler = async (route: Route) => {
    const request = route.request();
    if (request.method() !== "PATCH") { await route.continue(); return; }
    patches.push(request);
    if (failure === "network") { failure = null; await route.abort("failed"); return; }
    if (failure !== null) {
      const status = failure;
      failure = null;
      await route.fulfill({
        status,
        json: {
          error: {
            code: status === 412 ? "REVISION_MISMATCH" : status === 409 ? "MANUAL_DEPENDENCY_CONFLICT" : status === 422 ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
            message: "Rejected by Issue #370 fixture.",
            details: [],
            requestId: "issue-370",
          },
        },
      });
      return;
    }

    expect(request.headers()["if-match"]).toBe(`"${fixture.project.revision}"`);
    const taskId = new URL(request.url()).pathname.split("/").at(-1);
    const task = fixture.tasks.find((entry) => entry.taskId === taskId);
    expect(task).toBeTruthy();
    const body = request.postDataJSON() as { start?: string };
    expect(Object.keys(body)).toEqual(["start"]);
    expect(body.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    task!.requestedStart = body.start!;
    task!.start = body.start!;
    task!.end = body.start!;
    fixture.project.revision += 1;
    const response: TaskMutationResponse = {
      data: {
        project: { ...fixture.project },
        tasks: fixture.tasks.map((entry) => ({ ...entry })),
        links: fixture.links.map((entry) => ({ ...entry })),
        warnings: [],
        operation: {
          kind: "taskUpdate",
          changedTaskExternalIds: [task!.externalId],
          deletedTaskExternalIds: [],
          deletedLinkIds: [],
        },
      },
    };
    await route.fulfill({ json: response });
  };
  await page.route(`**${taskPath}/*`, handler);
  return { patches, failOnce: (next: typeof failure) => { failure = next; } };
}

test("Grid 시작일 single click Date Picker는 start-only canonical PATCH를 저장한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  const route = await routeStartUpdates(page, fixture);
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  const beforeText = await startCell(page, "Stable leaf").textContent();

  await startCell(page, "Stable leaf").click();
  await expect(startPicker(page)).toBeVisible();
  await expect(startInput(page)).toBeFocused();
  await expect(startInput(page)).toHaveValue("2026-09-16");
  await startInput(page).fill("2026-09-21");

  await expect.poll(() => route.patches.length).toBe(1);
  expect(route.patches[0]?.postDataJSON()).toEqual({ start: "2026-09-21" });
  await expectSameGanttRoot(page, identity);
  await expect.poll(() => startCell(page, "Stable leaf").textContent()).not.toBe(beforeText);

  await page.reload();
  await expect(startCell(page, "Stable leaf")).toBeVisible();
  expect(fixture.tasks[2].requestedStart).toBe("2026-09-21");
  expect(fixture.tasks[2].start).toBe("2026-09-21");
});

test("Summary/readonly는 차단하고 keyboard Escape와 실패는 canonical 값을 보존한다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  const route = await routeStartUpdates(page, fixture);
  await page.goto(`/projects/${publicId}`);

  await startCell(page, "Stable summary").click();
  await expect(startPicker(page)).toHaveCount(0);
  expect(route.patches).toHaveLength(0);

  const milestoneCell = startCell(page, "Stable milestone");
  await milestoneCell.focus();
  await milestoneCell.press("Enter");
  await expect(startPicker(page)).toBeVisible();
  await expect(startInput(page)).toBeFocused();
  await startInput(page).press("Escape");
  await expect(startPicker(page)).toHaveCount(0);
  await expect(milestoneCell).toBeFocused();
  expect(route.patches).toHaveLength(0);

  const originalStart = fixture.tasks[2].start;
  route.failOnce(500);
  await startCell(page, "Stable leaf").click();
  await startInput(page).fill("2026-09-22");
  await expect.poll(() => route.patches.length).toBe(1);
  await expect(ganttRoot(page).getByRole("alert")).toBeVisible();
  expect(fixture.tasks[2].start).toBe(originalStart);
  await expect(startCell(page, "Stable leaf")).toBeVisible();

  fixture.sessionEditable = false;
  await page.reload();
  await startCell(page, "Stable leaf").click();
  await expect(startPicker(page)).toHaveCount(0);
  await expect(startCell(page, "Stable leaf")).toHaveAttribute("aria-readonly", "true");
  expect(route.patches).toHaveLength(1);
});

test("Date Picker는 좁은 viewport에서도 열리고 document overflow를 추가하지 않는다", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  await routeStartUpdates(page, fixture);
  await page.goto(`/projects/${publicId}`);

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const cell = startCell(page, "Stable milestone");
    await cell.click();
    await expect(startPicker(page)).toBeVisible();
    const bounds = await startPicker(page).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await startInput(page).press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
