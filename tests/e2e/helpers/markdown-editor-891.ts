import { expect, type Locator, type Page } from "@playwright/test";
import type { ProjectSnapshotResponse } from "../../../src/contracts/projects";
import { submitProjectAndExpectCreated } from "../fixtures/isolated-application";
import { chooseTaskInformation } from "./task-context-menu";
import { openMilestoneEditor } from "./milestone-ui";
import { openWorkspaceView } from "./workspace-navigation";

export const shortMarkdown891 = "Short synthetic description.";
export const longMarkdown891 = "Long synthetic paragraph for geometry.\n\n".repeat(40);
export interface MarkdownFixture891 {
  origin: string;
  path: string;
  api: string;
  tasks: Array<{ taskId: string; name: string; type: "task" | "summary" | "milestone"; long: boolean }>;
  issues: Array<{ issueId: string; name: string; long: boolean }>;
}

/** Existing HTTP/SQLite fixture and exact Task/Issue contracts; no successful API is mocked. */
export async function seedMarkdownFixture891(page: Page): Promise<MarkdownFixture891> {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름", { exact: true }).fill("Issue 891 synthetic editor");
  await page.getByLabel("편집 비밀번호", { exact: true }).fill("EditPwd1234!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const origin = new URL(page.url()).origin, path = new URL(page.url()).pathname, api = "/api" + path;
  let snapshot = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  const tasks: MarkdownFixture891["tasks"] = [];
  for (const type of ["task", "summary", "milestone"] as const) for (const long of [false, true]) {
    const name = `891 ${type} ${long ? "long" : "short"}`;
    const response = await page.request.post(api + "/tasks", {
      headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` },
      data: { name, type, description: long ? longMarkdown891 : shortMarkdown891, descriptionFormat: "markdown",
        ...(type === "summary" ? {} : { start: "2026-11-10", duration: type === "milestone" ? 0 : 1, progress: 0 }) },
    });
    expect(response.status(), `synthetic ${type} creation`).toBe(201);
    snapshot = await response.json() as ProjectSnapshotResponse;
    tasks.push({ taskId: snapshot.data.tasks.find(task => task.name === name)!.taskId, name, type, long });
  }
  const issues: MarkdownFixture891["issues"] = [];
  for (const long of [false, true]) {
    const name = `891 issue ${long ? "long" : "short"}`;
    const response = await page.request.post(api + "/issues", {
      headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` },
      data: { title: name, description: long ? longMarkdown891 : shortMarkdown891, descriptionFormat: "markdown",
        reporterName: "Synthetic", reporterResourceId: null, assigneeName: "", assigneeResourceId: null,
        occurredOn: "2026-11-10", completed: false, completedOn: null, relatedTaskId: null, relatedTaskText: "",
        issuePassword: "IssuePwd1234!", confirmIssuePassword: "IssuePwd1234!" },
    });
    expect(response.status()).toBe(201);
    const result = await response.json();
    snapshot.data.project.revision = result.data.projectRevision;
    issues.push({ issueId: result.data.issue.issueId, name, long });
  }
  await page.reload();
  await expect(page.locator(".project-gantt-frame")).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  return { origin, path, api, tasks, issues };
}

export async function openMarkdownTask891(page: Page, task: MarkdownFixture891["tasks"][number]): Promise<Locator> {
  if (task.type === "milestone") return openMilestoneEditor(page, task.taskId);
  await openWorkspaceView(page, "schedule");
  await page.locator(`.wx-row[data-id=":${task.taskId}"]`).getByText(task.name, { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(dialog.locator('.mastergantt-markdown-contenteditable[contenteditable="true"]')).toBeVisible();
  return dialog;
}

export async function openMarkdownIssue891(page: Page, name?: string): Promise<Locator> {
  await page.getByRole("tablist", { name: "프로젝트 작업공간" }).getByRole("tab", { name: "Issue", exact: true }).click();
  const workspace = page.getByTestId("project-issue-workspace");
  await workspace.getByRole("button", { name: name ?? "Issue 등록", exact: true }).click();
  const dialog = workspace.getByRole("dialog");
  await expect(dialog.locator('.mastergantt-markdown-contenteditable[contenteditable="true"]')).toBeVisible();
  return dialog;
}

export async function dialogGeometry891(page: Page, dialog: Locator) {
  const box = (await dialog.boundingBox())!;
  const header = dialog.locator("header, [class*='editorHeader']").first();
  const footer = await dialog.locator("footer").count() ? dialog.locator("footer") : dialog.locator("[class*='editorActions']").last();
  const head = (await header.boundingBox())!, foot = (await footer.boundingBox())!;
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth }));
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(head.y).toBeGreaterThanOrEqual(box.y);
  expect(foot.y + foot.height).toBeLessThanOrEqual(box.y + box.height + 1);
  expect(viewport.overflow).toBeLessThanOrEqual(1);
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  for (const action of await footer.getByRole("button").all()) {
    await expect(action).toBeInViewport();
    const actionBox = (await action.boundingBox())!;
    expect(actionBox.y).toBeGreaterThanOrEqual(foot.y);
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await action.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return !!hit && (element === hit || element.contains(hit));
    })).toBe(true);
  }
  if (await dialog.locator("[data-editor-body]").count()) {
    expect(await dialog.locator("[data-editor-body]").evaluate(element => ["auto", "scroll"].includes(getComputedStyle(element).overflowY))).toBe(true);
  }
  return { box, head, foot, viewport };
}

export async function checkToolbarTooltips891(page: Page, field: Locator, noShortcut: string) {
  const actions = field.locator(".mdxeditor-toolbar button");
  expect(await actions.count()).toBeGreaterThanOrEqual(2);
  const labels: string[] = [];
  for (const action of await actions.all()) {
    const label = (await action.getAttribute("aria-label"))!;
    expect(label).toMatch(/.+ \(.+\)$/);
    expect(label.includes(noShortcut) || /Ctrl\+|⌘/.test(label)).toBe(true);
    labels.push(label);
    // MDXEditor's native hover trigger is the inner icon span (or outer select span).
    await page.mouse.move(0, 0);
    const icon = action.locator("span").first();
    await (await icon.count() ? icon : action).hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toHaveCount(1);
    await expect(tip).toHaveText(label);
    await expect(tip).toBeVisible();
    await page.mouse.move(0, 0);
    if (await action.getAttribute("disabled") !== null) continue;
    await action.focus();
    await expect(action).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveCount(1);
    await expect(page.getByRole("tooltip")).toHaveText(label);
    const rect = (await page.getByRole("tooltip").boundingBox())!;
    const view = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(view.width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(view.height + 1);
    expect(await page.getByRole("tooltip").evaluate(element => getComputedStyle(element).visibility)).toBe("visible");
    const nativeDialog = await field.evaluate(element => element.closest("dialog")?.id ?? null);
    expect(await page.getByRole("tooltip").evaluate(element => element.closest("dialog")?.id ?? null)).toBe(nativeDialog);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  }
  return labels;
}

export async function resizeMarkdown891(page: Page, dialog: Locator, field: Locator, mode: "rich" | "source") {
  const resizer = field.locator('[data-markdown-resizer="true"]');
  const content = field.locator(mode === "rich" ? '.mastergantt-markdown-contenteditable[contenteditable="true"]' : ".cm-scroller");
  await resizer.scrollIntoViewIfNeeded();
  const before = (await resizer.boundingBox())!, editorBefore = (await content.boundingBox())!;
  const dialogWidth = (await dialog.boundingBox())!.width;
  await page.mouse.move(before.x + before.width - 3, before.y + before.height - 3);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width + 55, before.y + before.height + 85, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await resizer.boundingBox())!.height).toBeGreaterThan(before.height + 40);
  const grown = (await resizer.boundingBox())!, editorGrown = (await content.boundingBox())!;
  expect(grown.width).toBeCloseTo(before.width, 0);
  expect((await dialog.boundingBox())!.width).toBeCloseTo(dialogWidth, 0);
  expect(editorGrown.height).toBeGreaterThan(editorBefore.height + 40);
  await resizer.scrollIntoViewIfNeeded();
  const startMax = (await resizer.boundingBox())!;
  await page.mouse.move(startMax.x + startMax.width - 3, startMax.y + startMax.height - 3);
  await page.mouse.down();
  await page.mouse.move(startMax.x + startMax.width + 100, startMax.y + startMax.height + 2000, { steps: 10 });
  await page.mouse.up();
  const maximum = (await resizer.boundingBox())!;
  const limits = await resizer.evaluate(element => ({
    max: parseFloat(getComputedStyle(element).maxHeight),
    body: element.closest<HTMLElement>("[data-editor-body]")!.clientHeight,
  }));
  expect(maximum.height).toBeCloseTo(limits.max, 0);
  expect(maximum.height).toBeLessThanOrEqual(Math.max(240, limits.body - 12) + 1);
  expect(maximum.width).toBeCloseTo(before.width, 0);
  expect((await dialog.boundingBox())!.width).toBeCloseTo(dialogWidth, 0);
  await resizer.scrollIntoViewIfNeeded();
  const handle = (await resizer.boundingBox())!;
  await page.mouse.move(handle.x + handle.width - 3, handle.y + handle.height - 3);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width - 50, handle.y - 500, { steps: 10 });
  await page.mouse.up();
  const minimum = (await resizer.boundingBox())!;
  expect(minimum.width).toBeCloseTo(before.width, 0);
  expect(minimum.height).toBeGreaterThanOrEqual(240);
  expect(minimum.height).toBeLessThan(grown.height);
  await dialogGeometry891(page, dialog);
  return { before, grown, maximum, minimum, editorBefore, editorGrown };
}

export async function checkLongMarkdownScroll891(page: Page, dialog: Locator, field: Locator, mode: "rich" | "source") {
  const editable = field.locator(mode === "rich" ? '.mastergantt-markdown-contenteditable[contenteditable="true"]' : '.cm-content[contenteditable="true"]');
  await editable.fill(longMarkdown891);
  const resizer = field.locator('[data-markdown-resizer="true"]');
  const scroll = await resizer.evaluate(element => {
    const candidates = [element, ...element.querySelectorAll<HTMLElement>("*")];
    const owner = candidates.find(candidate => {
      const style = getComputedStyle(candidate);
      return /auto|scroll/.test(style.overflowY) && candidate.scrollHeight > candidate.clientHeight + 1;
    });
    if (!owner) return null;
    owner.scrollTop = owner.scrollHeight;
    return { top: owner.scrollTop, height: owner.scrollHeight, client: owner.clientHeight, overflow: getComputedStyle(owner).overflowY };
  });
  expect(scroll).not.toBeNull();
  expect(scroll!.height).toBeGreaterThan(scroll!.client);
  expect(scroll!.top).toBeGreaterThan(0);
  await expect(field.locator(".mdxeditor-toolbar")).toBeInViewport();
  await dialogGeometry891(page, dialog);
  await resizer.evaluate(element => {
    [element, ...element.querySelectorAll<HTMLElement>("*")].forEach(candidate => { candidate.scrollTop = 0; });
  });
}
