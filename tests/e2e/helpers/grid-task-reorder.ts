import { expect, type Page } from "@playwright/test";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../../src/contracts/projects";
export const taskRow = (page: Page, name: string) => page.locator('.project-gantt-widget .wx-row[role="row"]').filter({ hasText: name });
export async function gridOrder(page: Page) {
  return page.locator('.project-gantt-widget .wx-row[role="row"] [data-col-id=":text"] .wx-content > .wx-text').allTextContents();
}
export async function seedReorderProject(page: Page, origin: string) {
  const response = await page.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Grid reorder #300", ownerName: "E2E 자동화", description: "DnD 영속성 검증", editPassword: "Grid300!" } });
  expect(response.status()).toBe(201);
  const project = (await response.json()).data.project;
  const api = `/api/projects/${project.publicId}`;
  let snapshot: ProjectSnapshotResponse | TaskMutationResponse = (await (await page.request.get(api)).json()) as ProjectSnapshotResponse;
  for (const name of ["Task A", "Task B", "Task C"]) {
    const added = await page.request.post(`${api}/tasks`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data: { name, type: "task", start: "2026-10-05", duration: 2, progress: 0 } });
    expect(added.status()).toBe(201);
    snapshot = await added.json() as TaskMutationResponse;
  }
  await page.goto(`/projects/${project.publicId}`);
  await expect(taskRow(page, "Task B")).toBeVisible();
  return { api, snapshot, project };
}
export async function dragRowAfter(page: Page, source: string, target: string) {
  const start = await taskRow(page, source).locator('[data-col-id=":text"]').boundingBox();
  const end = await taskRow(page, target).boundingBox();
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();
  const x = start!.x + 12;
  await page.mouse.move(x, start!.y + start!.height / 2);
  await page.mouse.down();
  await page.mouse.move(x + 8, start!.y + start!.height / 2 + 8, { steps: 3 });
  await page.mouse.move(x + 8, end!.y + end!.height - 3, { steps: 12 });
  await page.mouse.up();
}
export async function renameInline(page: Page, name: string, nextName: string) {
  const frame = page.locator(".project-gantt-frame");
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");

  const row = taskRow(page, name);
  await expect(row).toBeVisible();
  const cellText = row.locator('[data-col-id=":text"] .wx-content > .wx-text');
  await cellText.click();

  const input = row.locator('.wx-cell.wx-editor input.wx-text');
  await expect(input).toBeFocused();
  await input.fill(nextName);
  await input.press("Enter");
  await expect(taskRow(page, nextName)).toBeVisible();
}
