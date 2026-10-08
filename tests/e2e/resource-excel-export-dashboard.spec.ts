import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { installStatefulProjectFixture, projectPath, publicId, deferred } from "../fixtures/stateful-project";
import { resourceDashboardUiFixture } from "../fixtures/resource-dashboard-ui";
import type { ProjectExcelExportRequest } from "../../src/contracts/project-excel-export";

async function setup(page: Page) {
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = false;
  await page.route(`**${projectPath}/resource-dashboard?*`, route => {
    const report = resourceDashboardUiFixture(state, new URL(route.request().url()).searchParams);
    for (const row of [...report.catalog.resources, ...report.catalog.groups]) row.name = "긴 조회 대상 ".repeat(20);
    report.resourceScopeContext = { projectPublicId: publicId, projectRevision: state.project.revision,
      catalogRevision: report.catalogRevision, calendarRevision: report.calendarRevision, dataSnapshotId: "d".repeat(64),
      range: report.range, asOfDate: report.asOfDate, mdPerMm: report.mdPerMm, mdPerMmSource: report.mdPerMmSource,
      mdPerMmProvided: report.filters.mdPerMmProvided, sourceProjection: { kind: "report" } };
    return route.fulfill({ json: { data: report } });
  });
  await page.goto(`/projects/${publicId}`);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  const root = page.locator('[data-resource-dashboard="true"]:visible');
  await expect(root).toHaveAttribute("data-ready", "true");
  return { state, root };
}

test("#529 보고서 범위·기간 옵션은 stale 재조회와 재진입에서 보존", async ({ page }) => {
  const f = await setup(page);
  const requests: ProjectExcelExportRequest[] = [];
  await page.route(`**${projectPath}/exports/excel`, route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 412, json: { error: { code: "REVISION_CONFLICT" } } });
  });
  const trigger = f.root.getByRole("button", { name: "Excel 보고서", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "내보내기", exact: true });
  await expect(dialog.getByLabel("형식")).toBeFocused();
  await expect(dialog.getByLabel("리소스 현황 보고서 포함 (7개 시트)")).toBeChecked();
  await expect(dialog.getByLabel("현재 선택 조건", { exact: true })).toBeChecked();
  await dialog.getByLabel("Project 전체 (확인된 기간·기준일·환산 정책 유지)").check();
  await dialog.getByLabel("월 계획", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("다시 조회하고 확인");
  await expect(dialog.getByRole("button", { name: "내보내기", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "현재 보고서 확인", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "내보내기", exact: true })).toBeDisabled();
  expect(requests).toHaveLength(1);
  expect(requests[0].resourceDashboard).toMatchObject({ basis: "project", granularities: ["week"] });
  expect(requests[0].resourceDashboard).not.toHaveProperty("binding");
  expect(requests[0].resourceDashboard?.expectedReport).not.toHaveProperty("snapshotId");
  expect(requests[0].resourceDashboard?.expectedReport).not.toHaveProperty("filters");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(trigger).toBeFocused();
  await f.root.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(f.root).toHaveAttribute("data-ready", "true");
  await trigger.click();
  await expect(dialog.getByLabel("Project 전체 (확인된 기간·기준일·환산 정책 유지)")).toBeChecked();
  await expect(dialog.getByLabel("주 계획", { exact: true })).toBeChecked();
  await expect(dialog.getByLabel("월 계획", { exact: true })).not.toBeChecked();
  await dialog.getByRole("button", { name: "현재 보고서 확인", exact: true }).click();
  await dialog.getByLabel("현재 선택 조건", { exact: true }).check();
  await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  const options = requests[1].resourceDashboard!;
  expect(options.basis).toBe("current");
  expect(options.expectedReport).toHaveProperty("snapshotId");
  expect(options.expectedReport).not.toHaveProperty("filters.mdPerMmProvided");
  expect(options.expectedReport).not.toHaveProperty("filters.mdPerMm");
});

test("#529 dialog 5폭 geometry·native focus와 늦은 파일 폐기", async ({ page }, info) => {
  const f = await setup(page); const gate = deferred(); let started = false;
  await f.root.getByLabel("리소스·그룹·Task 이름과 코드 검색", { exact: true }).fill("긴 조건검색 ".repeat(20));
  await expect(f.root).toHaveAttribute("data-ready", "true");
  await page.route(`**${projectPath}/exports/excel`, async route => {
    started = true; await gate.promise;
    await route.fulfill({ body: "synthetic workbook", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }).catch(() => undefined);
  });
  const trigger = f.root.getByRole("button", { name: "Excel 보고서", exact: true });
  await trigger.click(); const dialog = page.getByRole("dialog", { name: "내보내기", exact: true });
  await dialog.getByText("현재 조건과 원장 확인", { exact: true }).click();
  const geometry = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const observation = await dialog.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { width: innerWidth, left: rect.left, right: rect.right,
        overflow: document.documentElement.scrollWidth - innerWidth,
        scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
        controls: Array.from(node.querySelectorAll("button,input,select,summary")).map(control => {
          const box = control.getBoundingClientRect(); return { name: control.getAttribute("aria-label") ?? control.textContent, left: box.left, right: box.right };
        }),
        buttons: Array.from(node.querySelectorAll("button")).filter(button => button.textContent !== "닫기").map(button => ({ text: button.textContent, height: button.getBoundingClientRect().height })) };
    });
    expect(observation.left).toBeGreaterThanOrEqual(0); expect(observation.right).toBeLessThanOrEqual(width);
    expect(observation.overflow).toBeLessThanOrEqual(1);
    expect(observation.controls.every(control => control.left >= observation.left && control.right <= observation.right)).toBe(true);
    expect(observation.scrollHeight).toBeGreaterThan(observation.clientHeight);
    expect(observation.buttons.every(button => button.height >= 36)).toBe(true); geometry.push(observation);
    if (process.env.CAPTURE_ISSUE_529 === "1") {
      await mkdir("output/playwright/issue-529-resource-export", { recursive: true });
      await page.screenshot({ path: `output/playwright/issue-529-resource-export/dialog-${width}.png` });
    }
  }
  if (process.env.CAPTURE_ISSUE_529 === "1") {
    const paths = ["src/features/projects/project-excel-export-button.tsx", "src/features/projects/project-export.module.css",
      "src/features/resources/resource-export-model.ts", "src/features/resources/project-resource-dashboard.tsx"];
    const hashes = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
    await writeFile("output/playwright/issue-529-resource-export/geometry.json", JSON.stringify({ environment: "mock Chromium", capturedAt: new Date().toISOString(), hashes, geometry }, null, 2));
  }
  await info.attach("resource-export-geometry-5", { body: JSON.stringify(geometry), contentType: "application/json" });
  await dialog.getByRole("button", { name: "현재 보고서 확인", exact: true }).focus();
  await page.keyboard.press("Tab");
  const focus = await dialog.evaluate(node => { const control = document.activeElement as HTMLElement,
    owner = node.getBoundingClientRect(), box = control.getBoundingClientRect(), style = getComputedStyle(control);
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, ownerTop: owner.top, ownerBottom: owner.bottom,
      scrollTop: node.scrollTop, outline: style.outlineStyle, outlineWidth: style.outlineWidth }; });
  expect(focus.scrollTop).toBeGreaterThan(0); expect(focus.top).toBeGreaterThan(focus.ownerTop);
  expect(focus.bottom).toBeLessThan(focus.ownerBottom); expect(focus.outline).toBe("solid");
  await info.attach("native-focus-scroll", { body: JSON.stringify(focus), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_529 === "1") {
    const path = "output/playwright/issue-529-resource-export/geometry.json";
    const evidence = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify({ ...evidence, nativeFocus: focus }, null, 2));
  }
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await expect(dialog.getByRole("button", { name: "생성 중…", exact: true })).toBeDisabled();
  const downloads: string[] = []; page.on("download", download => downloads.push(download.suggestedFilename()));
  f.state.project.revision++;
  // A newer report revision invalidates the original proof while the server response is pending.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(f.root).toHaveAttribute("data-ready", "false");
  gate.resolve(); await expect(dialog.getByRole("alert")).toContainText("폐기");
  expect(downloads).toEqual([]);
});

test("#529 상세 stale는 일반 opt-in 생성을 차단하고 숨은 Resource trigger는 visible tab으로 복원", async ({ page }) => {
  const f = await setup(page); let exports = 0;
  await page.getByRole("button", { name: "내보내기", exact: true }).first().click();
  const general = page.getByRole("dialog", { name: "내보내기", exact: true });
  await expect(general.getByLabel("리소스 현황 보고서 포함 (7개 시트)")).not.toBeChecked();
  await page.keyboard.press("Escape");
  await page.route(`**${projectPath}/resource-dashboard/details?*`, route => route.fulfill({ status: 409, json: { error: { code: "REPORT_STALE" } } }));
  await page.route(`**${projectPath}/exports/excel`, route => { exports++; return route.fulfill({ status: 500 }); });
  await f.root.locator(".resource-dashboard-kpis > div").filter({ hasText: /^할당 Task/ }).getByRole("button").click();
  await expect(f.root).toHaveAttribute("data-ready", "false");
  await page.getByRole("button", { name: "내보내기", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "내보내기", exact: true });
  await dialog.getByLabel("리소스 현황 보고서 포함 (7개 시트)").check();
  await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("다시 조회하고 확인"); expect(exports).toBe(0);
  await page.keyboard.press("Escape");
  await f.root.getByRole("button", { name: "Excel 보고서", exact: true }).click();
  await dialog.getByRole("button", { name: "보고서 다시 조회", exact: true }).click();
  await expect(f.root).toHaveAttribute("data-ready", "true");
  await dialog.getByRole("button", { name: "현재 보고서 확인", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect.poll(() => exports).toBe(1);
  await expect(dialog.getByRole("alert")).toContainText("파일을 생성할 수 없습니다");
  await page.locator("#project-panel-resources").evaluate(node => { node.setAttribute("hidden", ""); node.setAttribute("inert", ""); });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: "리소스", exact: true })).toBeFocused();
});
