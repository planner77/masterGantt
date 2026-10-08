import { mkdir, writeFile } from "node:fs/promises";
import type { APIResponse, Page } from "@playwright/test";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, ProjectTaskDto, TaskMutationResponse } from "../../src/contracts/projects";

test.use(isolatedApplicationOptions);

async function getWithTransientResetRetry(page: Page, url: string): Promise<APIResponse> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await page.request.get(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransientReset = /socket hang up|ECONNRESET/i.test(message);
      if (!isTransientReset || attempt === maxAttempts) throw error;
      await page.waitForTimeout(250 * attempt);
    }
  }
  throw new Error("unreachable");
}
test("#462 actual SQLite stage filter·Grid·common Editor·canonical and geometry", async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const origin = baseURL!;
  const response = await page.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Stage Grid #462", description: "단계 조회 실제 SQLite", ownerName: "E2E", editPassword: "Stage462!" } });
  expect(response.status()).toBe(201); const id = (await response.json()).data.project.publicId as string, api = `/api/projects/${id}`;
  const get = async () => (await (await getWithTransientResetRetry(page, api)).json()) as ProjectSnapshotResponse;
  let snapshot = await get();
  const add = async (name: string, type: ProjectTaskDto["type"], externalId: string, parentTaskId?: string) => {
    const response = await page.request.post(`${api}/tasks`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data: { name, type, externalId, parentTaskId, ...(type === "summary" ? {} : { start: "2026-10-05", duration: type === "milestone" ? 0 : 2, progress: 0 }) } });
    expect(response.status()).toBe(201); const body = await response.json() as TaskMutationResponse; snapshot = { data: { ...body.data, permission: "edit" } }; return body.data.tasks.find((task) => task.externalId === externalId)!;
  };
  const name = "동일 이름 Milestone Very long English milestone identity";
  const m1 = await add(name, "milestone", "M-A"), m2 = await add(name, "milestone", "M-B");
  const summary = await add("기본 Summary", "summary", "S"), child = await add("상속 Child", "task", "C", summary.taskId), override = await add("Override", "task", "O", summary.taskId), empty = await add("빈 Summary", "summary", "E"), free = await add("미지정 Task", "task", "F");
  for (let i = 0; i < 18; i++) await add(`추가 단계 ${i} 긴 한글 English extraordinary identity`, "milestone", `MORE-${String(i).padStart(2, "0")}`);
  const membership = await page.request.post(`${api}/milestone-memberships`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data: { changes: [{ taskId: summary.taskId, milestoneTaskId: m1.taskId }, { taskId: empty.taskId, milestoneTaskId: m1.taskId }, { taskId: override.taskId, milestoneTaskId: m2.taskId }] } }); expect(membership.status()).toBe(200); snapshot = await get();
  // Warm read routes before observing UI: lazy Next dev compilation can Fast Refresh effects.
  for (const path of ["/assigned-targets", "/resource-workload", "/logistics/dashboard?horizonDays=14&systemView=direct", `/tasks/${child.taskId}/logistics-links`, `/tasks/${child.taskId}/assignments`]) { const warm = await page.request.get(`${api}${path}`); await warm.body(); }

  await page.setViewportSize({ width: 1440, height: 844 }); await page.goto(`/projects/${id}`); await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const frame = page.locator(".project-gantt-frame"), instance = await frame.getAttribute("data-project-gantt-api-instance"), row = (taskId: string) => page.locator(`.project-gantt-widget .wx-table-container .wx-row[data-id=":${taskId}"]`).first();
  const header = page.locator(".project-gantt-widget .wx-table-container .wx-header").first();
  let reads = 0, writes = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === api && request.method() === "GET") reads++; if (request.url().includes(api) && !["GET", "HEAD"].includes(request.method())) writes++; });
  const stage = () => page.locator("#project-panel-schedule .project-stage-filter-trigger");
  const select = async (value: string) => { await stage().click(); const input = page.getByRole("combobox", { name: "Milestone 이름·외부 ID·작업 ID 검색" }); await input.fill(`  ${value.toUpperCase()}  `); await expect(page.getByRole("listbox", { name: "Milestone 조회 조건" }).getByRole("option")).toHaveCount(3); await input.press("End"); await input.press("Enter"); };
  await expect(header.getByText("Milestone", { exact: true })).toHaveCount(0);
  await header.click({ button: "right" }); await page.locator(".project-column-menu").getByRole("checkbox", { name: "Milestone", exact: true }).check(); await page.keyboard.press("Escape");
  await expect(row(child.taskId).getByRole("button", { name: /Milestone:/ })).toContainText("상속");
  await select(m1.taskId); await expect(page.getByRole("status").filter({ hasText: "유효 소속 일반 작업 1개" })).toBeVisible(); await expect(row(m1.taskId)).toBeVisible(); await expect(row(empty.taskId)).toBeVisible(); await expect(row(override.taskId)).toHaveCount(0);
  const quick = page.getByRole("group", { name: "작업 유형 빠른 보기" }); await quick.getByRole("button", { name: "Task", exact: true }).click(); await expect(row(m1.taskId)).toHaveCount(0); await expect(row(child.taskId)).toBeVisible(); await expect(stage()).toContainText(name);
  await page.getByRole("button", { name: "Milestone 조건 해제", exact: true }).click(); await expect(row(free.taskId)).toBeVisible(); await expect(quick.getByRole("button", { name: "Task", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await row(summary.taskId).click({ button: "right" }); await page.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click(); await select(m1.taskId); await expect(row(child.taskId)).toBeVisible(); await expect(row(m1.taskId)).toHaveCount(0);
  await page.getByRole("tab", { name: "전체 프로젝트", exact: true }).click(); await expect(stage()).toContainText("전체");
  await page.getByRole("tab", { name: "기본 Summary", exact: true }).click(); await expect(stage()).toContainText(name); await page.getByRole("tab", { name: "전체 프로젝트", exact: true }).click();
  expect(reads).toBe(0); expect(writes).toBe(0); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
  // Same #461 editor is the only mutation surface, and one PATCH updates Grid/filter.
  await row(child.taskId).click({ button: "right" }); await page.getByRole("menuitem", { name: "Milestone 연결…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true }); await expect(dialog.getByRole("tab", { name: "작업 정보", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(writes).toBe(0); const picker = dialog.getByRole("combobox", { name: "Milestone", exact: true }); await picker.fill(m2.taskId); await picker.press("Enter"); const before = snapshot.data.project.revision;
  await dialog.getByRole("button", { name: "저장", exact: true }).click(); await expect(dialog).toHaveCount(0); snapshot = await get(); expect(snapshot.data.project.revision).toBe(before + 1); expect(snapshot.data.tasks.find((task) => task.taskId === child.taskId)?.membership?.explicitMilestoneTaskId).toBe(m2.taskId); expect(writes).toBe(1);
  await expect(row(child.taskId).getByRole("button", { name: /Milestone:/ })).toContainText("직접");
  await row(m2.taskId).click({ button: "right" }); await page.getByRole("menuitem", { name: "소속 작업 관리…", exact: true }).click(); await expect(dialog.getByRole("tab", { name: /소속 작업/ })).toHaveAttribute("aria-selected", "true"); await dialog.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await select(m2.taskId); await expect(page.getByRole("status").filter({ hasText: "유효 소속 일반 작업 2개" })).toBeVisible(); await page.getByRole("button", { name: "초기화", exact: true }).click();
  await mkdir("output/playwright/issue-462", { recursive: true }); const metrics: unknown[] = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 844 }); await stage().click(); const input = page.getByRole("combobox", { name: "Milestone 이름·외부 ID·작업 ID 검색" }); await input.press("End");
    const popup = await page.locator("#project-panel-schedule .project-stage-filter-popup").evaluate((element) => { const box = element.getBoundingClientRect(), input = element.querySelector("input")!, active = document.getElementById(input.getAttribute("aria-activedescendant")!)!, owner = element.querySelector("ul")!, a = active.getBoundingClientRect(), b = owner.getBoundingClientRect(), i = input.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, viewport: innerWidth, activeVisible: a.top >= b.top && a.bottom <= b.bottom, inputFocused: document.activeElement === input, inputVisible: i.left >= box.left && i.right <= box.right, listScroll: owner.scrollTop }; }); expect(popup.left).toBeGreaterThanOrEqual(0); expect(popup.right).toBeLessThanOrEqual(width); expect(popup.activeVisible).toBe(true); expect(popup.inputFocused).toBe(true); expect(popup.inputVisible).toBe(true); expect(popup.listScroll).toBeGreaterThan(0); await input.press("Escape"); await expect(stage()).toBeFocused();
    const geometry = await page.evaluate(() => {
      const bounds = (e: Element) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; };
      const toolbar = document.querySelector('.project-schedule-filter-toolbar')!, tb = bounds(toolbar), controls = Array.from(toolbar.querySelectorAll('button,input')).filter((e) => e.getBoundingClientRect().width > 0).map(bounds);
      const header = document.querySelector('.wx-table-container .wx-header')!, cells = Array.from(header.querySelectorAll('[role="columnheader"]')).filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ id: e.getAttribute('data-header-id'), box: bounds(e) }));
      const row = document.querySelector('.wx-table-container .wx-row[data-id]')!, body = Array.from(row.querySelectorAll('[data-col-id]')).filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ id: e.getAttribute('data-col-id'), box: bounds(e) }));
      const buttons = Array.from(document.querySelectorAll('.wx-table-container .wx-row button, .wx-table-container .wx-row [role=button], .wx-table-container .wx-row input, .wx-table-container .wx-header [role=button]')).filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ control: bounds(e), cell: bounds(e.closest('[role=gridcell], [role=columnheader]')!) }));
      const owner = document.querySelector('.project-gantt-scroll')!, focused = document.activeElement!, f = bounds(focused), style = getComputedStyle(focused), outset = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
      return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, toolbarControlsContained: controls.every((b) => b.left >= tb.left - 1 && b.right <= tb.right + 1), toolbarControlsNonOverlapping: controls.every((a, index) => controls.slice(index + 1).every((b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1)), columnsAligned: cells.every((h) => { const b = body.find((b) => b.id === h.id); return b && Math.abs(h.box.left - b.box.left) <= 1 && Math.abs(h.box.width - b.box.width) <= 1; }), columnBounds: { header: cells, body }, allButtonsContained: buttons.every(({control:a,cell:b}) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1), buttonBounds: buttons, gridScrollWidth: owner.scrollWidth, gridClientWidth: owner.clientWidth, focusVisible: f.left - outset >= 0 && f.right + outset <= innerWidth && f.top - outset >= 0 && f.bottom + outset <= innerHeight };
    }); expect(geometry.documentWidth).toBeLessThanOrEqual(width); expect(popup.top).toBeGreaterThanOrEqual(0); expect(popup.bottom).toBeLessThanOrEqual(844); expect(geometry.columnBounds.header.find((column) => column.id === ':text')!.box.width).toBeGreaterThanOrEqual(180); expect(geometry.columnBounds.header.find((column) => column.id === ':milestoneStage')!.box.width).toBe(180); expect(geometry.toolbarControlsContained).toBe(true); expect(geometry.toolbarControlsNonOverlapping).toBe(true); expect(geometry.columnsAligned).toBe(true); expect(geometry.allButtonsContained).toBe(true); expect(geometry.focusVisible).toBe(true); expect(geometry.columnBounds.header.length).toBeGreaterThan(0); expect(geometry.buttonBounds.length).toBeGreaterThan(0); metrics.push({ width, popup, ...geometry });
    await page.screenshot({ path: `output/playwright/issue-462/stage-grid-${width}.png`, fullPage: true });
  }
  await writeFile("output/playwright/issue-462/geometry.json", JSON.stringify(metrics, null, 2)); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
  const persisted = await get(); expect(persisted.data.project.revision).toBe(snapshot.data.project.revision); expect(persisted.data.tasks.map((task) => task.taskId)).toEqual(snapshot.data.tasks.map((task) => task.taskId));
});
