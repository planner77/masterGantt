import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { dashboardFixture } from "../fixtures/milestone-dashboard";
import { installStatefulProjectFixture, publicId, projectPath, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";
import { openWorkspaceView } from "./helpers/workspace-navigation";

for (const width of [390, 768, 1024, 1440, 1920]) {
  test(`#717 이름 우선과 전체 ID 접근 ${width}px`, async ({ page, context }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const f = await installStatefulProjectFixture(page);
    const milestone = f.tasks.find(task => task.type === "milestone")!;
    milestone.name = "고객 인수 승인 · 긴 이름의 동일 Milestone";
    milestone.externalId = "MILESTONE-PLANT-VERY-LONG-EXTERNAL-IDENTIFIER-001";
    f.tasks.push({ ...milestone, taskId: "00000000-0000-4000-9000-000000000717", externalId: "MILESTONE-PLANT-VERY-LONG-EXTERNAL-IDENTIFIER-002", siblingOrder: 3 });
    f.logistics = { processes: [1, 2].map(n => ({ id: `process-canonical-${n}`, name: "동일 공정 · 작업 준비", code: `PROCESS-LONG-EXTERNAL-IDENTIFIER-${n}`, sortOrder: n, parentProcessId: null, active: true, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" })), equipment: [], systems: [], systemLinks: [] };
    await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(f, new URL(route.request().url()).searchParams) } }));
    await page.goto(`/projects/${publicId}`);
    const gantt = await rememberGanttRoot(page);
    await openWorkspaceView(page, "milestones");
    const panel = page.getByTestId("milestone-dashboard");
    await expect(panel).toHaveAttribute("data-ready", "true");
    const row = panel.locator(`tr[data-milestone-task-id="${milestone.taskId}"]`);
    await expect(row.getByRole("button", { name: milestone.name, exact: true })).toBeVisible();
    const details = row.locator("details").first();
    await expect(details).not.toHaveAttribute("open", "");
    await expect(details.getByRole("button", { name: "작업 ID 복사", exact: true })).toBeHidden();
    await details.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open", "");
    await expect(details.getByLabel("작업 ID", { exact: true })).toHaveValue(milestone.taskId);
    await details.getByRole("button", { name: "작업 ID 복사", exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(milestone.taskId);
    await expect(details.getByRole("status")).toContainText("복사 완료");
    if (width === 1440) {
      await page.evaluate(() => { Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async () => { throw new Error("clipboard denied fixture"); } }); });
      await details.getByRole("button", { name: "작업 ID 복사", exact: true }).click();
      await expect(details.getByRole("status")).toContainText("직접 복사");
      const raw = details.getByLabel("작업 ID", { exact: true });
      await raw.focus();
      expect(await raw.evaluate(element => { const input = element as HTMLTextAreaElement; return input.value.slice(input.selectionStart, input.selectionEnd); })).toBe(milestone.taskId);
      await page.evaluate(() => { Reflect.deleteProperty(navigator.clipboard, "writeText"); });
    }
    await details.locator("summary").click();
    await panel.getByLabel("Milestone 검색", { exact: true }).fill(milestone.externalId);
    await expect(panel.locator("tbody tr[data-milestone-task-id]")).toHaveCount(1);
    await panel.getByLabel("Milestone 검색", { exact: true }).fill("00000000-0000-4000-9000-000000000717");
    await expect(panel.locator('tr[data-milestone-task-id="00000000-0000-4000-9000-000000000717"]')).toBeVisible();
    await panel.getByLabel("Milestone 검색", { exact: true }).fill("");
    await expect(panel.locator("tbody tr[data-milestone-task-id]")).toHaveCount(2);
    await row.getByRole("button", { name: `${milestone.name} 관리`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `${milestone.name} 관리`, exact: true });
    await expect(dialog).toBeVisible();
    const dialogGeometry = await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width }; });
    expect(dialogGeometry.x).toBeGreaterThanOrEqual(0);
    expect(dialogGeometry.right).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row.getByRole("button", { name: `${milestone.name} 관리`, exact: true })).toBeFocused();
    const directory = "output/playwright/issue-717/after";
    await mkdir(directory, { recursive: true });
    await panel.getByRole("region", { name: "Milestone 전체 상태 표 가로 스크롤", exact: true }).evaluate(el => { el.scrollLeft = 0; });
    await page.screenshot({ path: `${directory}/milestone-${width}.png`, fullPage: false });
    await openWorkspaceView(page, "processes");
    const processes = page.locator("#panel-processes");
    await expect(processes.locator("thead th").first()).toHaveText("공정명");
    await expect(processes.locator("tbody tr")).toHaveCount(2);
    await page.screenshot({ path: `${directory}/process-default-${width}.png`, fullPage: false });
    await page.getByLabel("물류 항목 검색", { exact: true }).fill("PROCESS-LONG-EXTERNAL-IDENTIFIER-2");
    await expect(processes.locator("tbody tr")).toHaveCount(1);
    const processRow = processes.locator("tbody tr").first();
    const processDetails = processRow.locator("details");
    await processDetails.locator("summary").focus();
    await page.keyboard.press("Space");
    await expect(processDetails.getByLabel("공정 ID", { exact: true })).toHaveValue("process-canonical-2");
    await expect(processDetails.getByLabel("공정 코드", { exact: true })).toHaveValue("PROCESS-LONG-EXTERNAL-IDENTIFIER-2");
    await processDetails.getByRole("button", { name: "공정 코드 복사", exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("PROCESS-LONG-EXTERNAL-IDENTIFIER-2");
    const geometry = await processes.evaluate(el => ({ identityWidth: el.querySelector("tbody tr td")!.getBoundingClientRect().width, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, ownerWidth: el.querySelector("table")!.parentElement!.clientWidth, tableWidth: el.querySelector("table")!.scrollWidth }));
    expect(geometry.identityWidth).toBeGreaterThanOrEqual(220);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: `${directory}/process-${width}.png`, fullPage: false });
    await writeFile(`${directory}/geometry-${width}.json`, JSON.stringify({ width, geometry, dialogGeometry, source: "Issue #717 working tree; mocked HTTP canonical fixture", revision: f.project.revision }, null, 2));
    await info.attach(`identity-geometry-${width}`, { body: JSON.stringify({ geometry, dialogGeometry }), contentType: "application/json" });
    await expectSameGanttRoot(page, gantt);
    expect(f.patchRequests).toHaveLength(0);
    expect(f.posts).toHaveLength(0);
    expect(f.project.revision).toBe(f.initialRevision);
  });
}


test.describe("#717 터치", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 1000 } });
  test("이름으로 탐색하고 ID 원문을 펼친다", async ({ page }) => {
    const f = await installStatefulProjectFixture(page);
    await page.route(`**${projectPath}/milestone-dashboard?*`, route => route.fulfill({ json: { data: dashboardFixture(f, new URL(route.request().url()).searchParams) } }));
    await page.goto(`/projects/${publicId}`);
    await page.getByRole("tablist", { name: "프로젝트 작업공간" }).getByRole("tab", { name: "대시보드", exact: true }).tap();
    await page.getByRole("tablist", { name: "대시보드 보기" }).getByRole("tab", { name: "Milestone", exact: true }).tap();
    const row = page.locator(`tr[data-milestone-task-id="${f.tasks[3].taskId}"]`);
    const details = row.locator("details").first();
    await details.locator("summary").tap();
    await expect(details.getByLabel("작업 ID", { exact: true })).toBeVisible();
    await expect(details.getByLabel("작업 ID", { exact: true })).toHaveValue(f.tasks[3].taskId);
    expect(f.patchRequests).toHaveLength(0);
  });
});
