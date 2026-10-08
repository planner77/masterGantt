import { expect, test } from "@playwright/test";
import { installStatefulProjectFixture, publicId, rowNamed, rememberGanttRoot, expectSameGanttRoot, deferred } from "../fixtures/stateful-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";

test("#462 readonly stage query and keyboard common editor entry preserve instance", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page); fixture.sessionEditable = false;
  const milestone = fixture.tasks.find((task) => task.type === "milestone")!, summary = fixture.tasks.find((task) => task.type === "summary")!;
  summary.membership = { explicitMilestoneTaskId: milestone.taskId, effectiveMilestoneTaskId: milestone.taskId, inheritedFromTaskId: null };
  const requests: string[] = []; await page.goto(`/projects/${publicId}`); await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible(); const identity = await rememberGanttRoot(page);
  page.on("request", (request) => { if (new URL(request.url()).pathname === `/api/projects/${publicId}` || !["GET", "HEAD"].includes(request.method())) requests.push(`${request.method()} ${new URL(request.url()).pathname}`); });
  const trigger = page.locator('#project-panel-schedule .project-stage-filter-trigger'); await trigger.click(); const input = page.getByRole("combobox", { name: "단계 이름·외부 ID·작업 ID 검색" }); await input.fill(` ${milestone.taskId.toUpperCase()} `); await input.press("ArrowDown"); await input.press("ArrowDown"); await input.press("Enter"); await expect(trigger).toBeFocused();
  await expect(rowNamed(page, "Existing summary child")).toBeVisible(); await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
  await rowNamed(page, "Existing summary child").click({ button: "right" }); const menu = page.getByRole("menu", { name: "작업 메뉴", exact: true });
  for (let i=0;i<12;i++) { if (await menu.getByRole("menuitem", { name: "완료 단계 연결…", exact: true }).evaluate((element) => element === document.activeElement)) break; await page.keyboard.press("ArrowDown"); }
  await page.keyboard.press("Enter"); const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true }); await expect(dialog).toBeVisible(); await expect(dialog.getByRole("combobox", { name: "완료 단계", exact: true })).toBeEnabled(); await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await expectSameGanttRoot(page, identity); expect(requests).toEqual([]);
});

test("#462 native mixed Link port interaction is rejected before API and legacy completed endpoint locks mutation", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page); const ordinary = fixture.tasks.find((task) => task.name === "Stable leaf")!, milestone = fixture.tasks.find((task) => task.type === "milestone")!;
  milestone.start = ordinary.start; milestone.end = ordinary.start; milestone.requestedStart = ordinary.start;
  fixture.links.push({ id: "00000000-0000-4000-8000-000000000090", predecessorExternalId: ordinary.externalId, successorExternalId: milestone.externalId, type: "FS", lag: 0, legacyMixed: true });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`/projects/${publicId}`); await expect(page.getByText("편집 중", { exact: true })).toBeVisible(); const identity = await rememberGanttRoot(page); let writes = 0;
  page.on("request", (request) => { if (request.url().includes(`/api/projects/${publicId}/links`) && !["GET", "HEAD"].includes(request.method())) writes++; });
  const source = page.locator(`.wx-bar[data-task-id=":${milestone.taskId}"]`), target = page.locator(`.wx-bar[data-task-id=":${ordinary.taskId}"]`);
  await expect(source).toHaveCount(0); // No native mixed Link port exists for an off-WBS Milestone.
  await expect(target).toBeVisible(); expect(writes).toBe(0); expect(fixture.links).toHaveLength(1); await expectSameGanttRoot(page, identity);
  await rowNamed(page, "Stable leaf").click({ button: "right" }); await chooseTaskInformation(page); const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true }); await dialog.getByRole("tab", { name: /관계/ }).click(); await expect(dialog).toContainText("Stable milestone"); await dialog.getByRole("button", { name: "Stable milestone 관계 편집", exact: true }).click();
  const relation = page.getByRole("dialog", { name: /작업 관계 관리/ }); await expect(relation).toBeVisible(); await expect(relation.getByRole("button", { name: "수정 저장", exact: true })).toBeDisabled(); await expect(relation.getByRole("button", { name: "관계 삭제", exact: true }).first()).toBeEnabled(); await relation.getByRole("button", { name: "닫기", exact: true }).click();
  // External canonical completed state is delivered by the existing visibility refresh.
  milestone.status = "completed"; milestone.progress = 100; fixture.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: fixture.project.revision }); await expect(dialog.getByText("최신 정보 다시 불러오기", { exact: false })).toBeVisible(); await dialog.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
  await dialog.getByRole("tab", { name: /관계/ }).click(); await expect(dialog.getByRole("button", { name: "Stable milestone 관계 삭제", exact: true })).toBeDisabled(); expect(writes).toBe(0);
});

test("#462 canonical URL update/delete and tree/scroll/scale survive stage transitions", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page); fixture.sessionEditable = false;
  const leaf = fixture.tasks.find((task) => task.name === "Stable leaf")!, summary = fixture.tasks.find((task) => task.type === "summary")!, milestone = fixture.tasks.find((task) => task.type === "milestone")!;
  leaf.url = "https://example.test/a"; summary.membership = { explicitMilestoneTaskId: milestone.taskId, effectiveMilestoneTaskId: milestone.taskId, inheritedFromTaskId: null };
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`/projects/${publicId}`); await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible(); const identity = await rememberGanttRoot(page);
  const summaryRow = rowNamed(page, "Stable summary"), toggle = summaryRow.locator('[data-action="open-task"]'); await toggle.click(); await expect(toggle).toHaveClass(/wxi-menu-right/);
  const frame = page.locator('.project-gantt-frame'), scale = await frame.getAttribute('data-gantt-scale-mode'); const grid = page.locator('.project-gantt-scroll'); await grid.evaluate((element) => { element.scrollLeft = 32; }); const scroll = await grid.evaluate((element) => element.scrollLeft);
  let reads = 0; page.on('request', (request) => { if (new URL(request.url()).pathname === `/api/projects/${publicId}`) reads++; });
  await page.locator('#project-panel-schedule .project-stage-filter-trigger').click(); const picker = page.getByRole('combobox', { name: '단계 이름·외부 ID·작업 ID 검색' }); await picker.fill(milestone.taskId); await picker.press('End'); await picker.press('Enter'); await expect(toggle).toHaveClass(/wxi-menu-right/); await page.getByRole('button', { name: '단계 조건 해제', exact: true }).click(); await expect(toggle).toHaveClass(/wxi-menu-right/);
  await expectSameGanttRoot(page, identity); await expect(frame).toHaveAttribute('data-gantt-scale-mode', scale!); expect(await grid.evaluate((element) => element.scrollLeft)).toBe(scroll); expect(reads).toBe(0);
  const leafRow = rowNamed(page, 'Stable leaf'); await expect(leafRow).toHaveAttribute('data-task-url', 'https://example.test/a');
  await page.evaluate(() => { const current = window as typeof window & { stageOpenedUrls: string[] }; current.stageOpenedUrls = []; window.open = ((url?: string | URL, _target?: string, features?: string) => { current.stageOpenedUrls.push(`${url}|${features}`); return null; }) as typeof window.open; });
  await leafRow.getByText('Stable leaf', { exact: true }).click(); expect(await page.evaluate(() => (window as typeof window & { stageOpenedUrls: string[] }).stageOpenedUrls)).toEqual(['https://example.test/a|noopener,noreferrer']);
  leaf.url = 'http://example.test/b'; fixture.project.revision++;
  await page.evaluate(({publicId,revision}) => window.dispatchEvent(new StorageEvent('storage', { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), {publicId,revision:fixture.project.revision}); await expect(leafRow).toHaveAttribute('data-task-url', 'http://example.test/b');
  leaf.url = null; fixture.project.revision++; await page.evaluate(({publicId,revision}) => window.dispatchEvent(new StorageEvent('storage', { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), {publicId,revision:fixture.project.revision}); await expect(leafRow).not.toHaveAttribute('data-task-url');
  await leafRow.getByText('Stable leaf', { exact: true }).click(); expect(await page.evaluate(() => (window as typeof window & { stageOpenedUrls: string[] }).stageOpenedUrls)).toHaveLength(1); await expectSameGanttRoot(page, identity);
});


test("#462 stage column preserves resized name width and pending disables editor entry", async ({ page }) => {
  const fixture = await installStatefulProjectFixture(page);
  const summary = fixture.tasks.find((task) => task.type === "summary")!, milestone = fixture.tasks.find((task) => task.type === "milestone")!;
  summary.membership = { explicitMilestoneTaskId: milestone.taskId, effectiveMilestoneTaskId: milestone.taskId, inheritedFromTaskId: null };
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`/projects/${publicId}`); await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const identity = await rememberGanttRoot(page), header = page.locator('.wx-table-container .wx-header').first(), nameCell = header.locator('[data-header-id=":text"]');
  const before = (await nameCell.boundingBox())!.width, grip = (await nameCell.locator('.wx-grip').boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down(); await page.mouse.move(grip.x + grip.width / 2 + 48, grip.y + grip.height / 2, { steps: 6 }); await page.mouse.up();
  const resized = (await nameCell.boundingBox())!.width; expect(resized).toBeGreaterThan(before + 20);
  const toggle = async (shown: boolean) => { await header.click({ button: 'right' }); await page.locator('.project-column-menu').getByRole('checkbox', { name: '완료 단계', exact: true }).setChecked(shown); await page.keyboard.press('Escape'); };
  await toggle(true); expect((await nameCell.boundingBox())!.width).toBeCloseTo(resized, 0); expect((await header.locator('[data-header-id=":milestoneStage"]').boundingBox())!.width).toBe(180);
  await toggle(false); expect((await nameCell.boundingBox())!.width).toBeCloseTo(resized, 0); await toggle(true);
  const gate = deferred(), started = deferred(); fixture.nextPost = { kind: 'success', gate, started };
  await page.getByRole('button', { name: '요약 작업 추가', exact: true }).click(); await started.promise;
  const row = rowNamed(page, 'Existing summary child'); await expect(row.getByRole('button', { name: /완료 단계:/ })).toBeDisabled();
  await row.click({ button: 'right' }); const menu = page.getByRole('menu', { name: '작업 메뉴', exact: true }); await expect(menu.getByRole('menuitem', { name: '완료 단계 연결…', exact: true })).toBeDisabled(); await page.keyboard.press('Escape');
  gate.resolve(); await expect(page.getByRole('button', { name: '요약 작업 추가', exact: true })).toBeEnabled(); await expectSameGanttRoot(page, identity); expect(fixture.posts).toHaveLength(1);
});
