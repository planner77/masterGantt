import { mkdir, writeFile } from "node:fs/promises";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { issue621ResourcePassword, seedIssue621 } from "./fixtures/issue-621-target-project";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: issue621ResourcePassword, viewport: { width: 1440, height: 900 } });

test("#622 Target 선택80·Project140·외부 배정 편집 복귀·동일 Excel·다섯 화면폭", async ({ page, isolatedApplication: origin }, info) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin);
  const catalog = (await (await page.request.get(`${origin}/api/resources`)).json()).data;
  for (const [task, target, percent] of [[f.task, f.targets[0], 80], [f.unset, f.targets[1], 60]] as const) {
    await f.mutate(`/tasks/${task.taskId}/target-bindings`, { bindings: [{ targetId: target.id, scope: "self", selection: "whole", memberIds: [] }] }, "put");
    await f.mutate(`/tasks/${task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: f.resources[0].id, allocation: { start: "2026-10-14", end: "2026-10-14", percent } }] }, "put");
  }
  await page.reload();
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  const root = page.locator('[data-resource-dashboard="true"]:visible');
  await expect(root).toHaveAttribute("data-ready", "true");
  await root.getByLabel("기간 시작", { exact: true }).fill("2026-10-14");
  await root.getByLabel("기간 종료", { exact: true }).fill("2026-10-14");
  await root.getByLabel("리소스 보기", { exact: true }).selectOption("plan");
  await root.getByRole("button", { name: "개인", exact: true }).click();
  await root.getByLabel("Target", { exact: true }).selectOption(f.targets[0].id);
  await expect(root).toHaveAttribute("data-ready", "true");
  const plan = root.getByRole("region", { name: "Resource Plan", exact: true });
  await plan.getByLabel("기간 셀 지표", { exact: true }).selectOption("load");
  await expect(plan).toContainText("평균 80.00 %");
  await plan.getByLabel("부하 범위", { exact: true }).selectOption("project");
  await expect(plan).toContainText("평균 140.00 %");
  await plan.getByLabel("부하 범위", { exact: true }).selectOption("selected");
  const table = plan.getByRole("region", { name: "개인 기간 계획표", exact: true });
  const before = await f.snapshot();
  const measurements = [];
  await mkdir("output/playwright/issue-622", { recursive: true });
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await table.focus();
    await page.keyboard.press("ArrowRight");
    const geometry = await table.evaluate(element => ({ width: innerWidth, document: document.documentElement.scrollWidth, client: element.clientWidth, scroll: element.scrollWidth, focused: document.activeElement === element }));
    expect(geometry.document).toBeLessThanOrEqual(width + 1);
    expect(geometry.focused).toBe(true);
    if (width === 390) expect(geometry.scroll).toBeGreaterThan(geometry.client);
    measurements.push(geometry);
    await page.screenshot({ path: `output/playwright/issue-622/plan-${width}.png`, fullPage: true });
  }
  expect(await f.snapshot()).toEqual(before);
  await table.locator("tbody tr").filter({ hasText: f.resources[0].name }).getByRole("button", { name: /Project 전체 · 초과/ }).first().click();
  const detail = root.getByRole("region", { name: "기간 부하 상세", exact: true });
  await expect(detail).toHaveAttribute("data-detail-state", "ready");
  await expect(detail).toContainText(f.targets[0].id);
  await expect(detail).toContainText("선택 Target 밖 배정 포함");
  await detail.locator("tbody th button").first().click();
  await expect(detail).toHaveAttribute("data-detail-state", "ready");
  const row = detail.locator(`[data-canonical-task-id="${f.unset.taskId}"]`);
  await expect(row).toContainText(f.targets[1].name);
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const detailTable = detail.getByRole("region", { name: "기간 상세 표", exact: true });
    await detailTable.focus(); await page.keyboard.press("ArrowRight");
    const geometry = await detailTable.evaluate(element => {
      const rect = (node: Element) => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width }; };
      const headers = [...element.querySelectorAll("thead th")].map(rect);
      const cells = [...element.querySelectorAll("tbody tr:first-child > *")].map(rect);
      const buttons = [...element.querySelectorAll("tbody tr:first-child > th button")].map(button => ({ ...rect(button), parent: rect(button.closest("th")!) }));
      return { width: innerWidth, document: document.documentElement.scrollWidth, client: element.clientWidth, scroll: element.scrollWidth, focused: document.activeElement === element, headers, cells, buttons };
    });
    expect(geometry.document).toBeLessThanOrEqual(width + 1); expect(geometry.focused).toBe(true);
    if (width <= 1024) expect(geometry.scroll).toBeGreaterThan(geometry.client);
    for (let i = 0; i < geometry.headers.length; i += 1) {
      expect(Math.abs(geometry.headers[i].left - geometry.cells[i].left)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.headers[i].right - geometry.cells[i].right)).toBeLessThanOrEqual(1);
    }
    for (const button of geometry.buttons) { expect(button.left).toBeGreaterThanOrEqual(button.parent.left); expect(button.right).toBeLessThanOrEqual(button.parent.right); }
    measurements.push(geometry);
    await page.screenshot({ path: `output/playwright/issue-622/assignment-${width}.png`, fullPage: true });
  }
  const assignmentsBefore = (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data.assignments;
  const outsideAssignment = assignmentsBefore.find((assignment: { taskId: string }) => assignment.taskId === f.unset.taskId)!;
  await expect(row).toHaveAttribute("data-canonical-assignment-id", outsideAssignment.id);
  const edit = row.getByRole("button", { name: `배정 편집: ${f.resources[0].name}`, exact: true });
  await edit.focus(); await page.keyboard.press("Enter");
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  const allocation = editor.getByLabel(`리소스 1 ${f.resources[0].name} (${f.resources[0].code}) 투입률 (%)`, { exact: true });
  await expect(allocation).toHaveValue("60");
  await allocation.fill("40");
  await editor.getByRole("button", { name: /^할당 저장 \(/ }).click();
  await expect(allocation).toHaveValue("40");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(detail).toHaveAttribute("data-detail-state", "ready");
  await expect(row).toContainText("40%");
  const assignmentsAfter = (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data.assignments;
  expect(assignmentsAfter.find((assignment: { id: string }) => assignment.id === outsideAssignment.id)).toMatchObject({ taskId: f.unset.taskId, allocation: { percent: 40 } });
  expect(assignmentsAfter.filter((assignment: { id: string }) => assignment.id !== outsideAssignment.id)).toEqual(assignmentsBefore.filter((assignment: { id: string }) => assignment.id !== outsideAssignment.id));
  await expect(edit).toBeFocused();
  await plan.getByLabel("부하 범위", { exact: true }).selectOption("project");
  await expect(plan).toContainText("평균 120.00 %");
  await plan.getByLabel("부하 범위", { exact: true }).selectOption("selected");
  await expect(plan).toContainText("평균 80.00 %");
  await expect(root.getByLabel("Target", { exact: true })).toHaveValue(f.targets[0].id);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  const exportRequests: unknown[] = [];
  page.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/exports/excel")) exportRequests.push(request.postDataJSON()); });
  for (const project of [false, true]) {
    await root.getByRole("button", { name: "Excel 보고서", exact: true }).click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "내보내기", exact: true }) });
    await dialog.getByRole("checkbox", { name: /리소스 현황 보고서 포함/ }).check();
    await dialog.getByRole("radio", { name: project ? "Project 전체 (확인된 기간·기준일·환산 정책 유지)" : "현재 선택 조건", exact: true }).check();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
    if (await dialog.isVisible()) await page.keyboard.press("Escape");
    await expect(root.getByLabel("Target", { exact: true })).toHaveValue(f.targets[0].id);
  }
  expect(exportRequests).toHaveLength(2);
  expect(exportRequests[0]).toHaveProperty("resourceDashboard.basis", "current");
  expect(exportRequests[0]).toHaveProperty("resourceDashboard.expectedReport.filters.targetIds", [f.targets[0].id]);
  expect(exportRequests[1]).toHaveProperty("resourceDashboard.basis", "project");
  expect(exportRequests[1]).not.toHaveProperty("resourceDashboard.expectedReport.filters");
  await writeFile("output/playwright/issue-622/evidence.json", JSON.stringify({ measurements, exportRequests }, null, 2));
  await info.attach("issue622-ui-evidence", { contentType: "application/json", body: JSON.stringify({ measurements, exportRequests }) });
});
