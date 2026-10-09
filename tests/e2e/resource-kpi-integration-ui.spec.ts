import { mkdir, writeFile, readFile } from "node:fs/promises";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { integrationAdminPassword, seedResourceKpiIntegration, ganttIntegrationState } from "./fixtures/resource-kpi-integration-ui";
import { RESOURCE_KPI_INTEGRATION, resourceKpiIntegrationFixture } from "../fixtures/resource-kpi-integration";
import { calculateResourcePlan } from "../../src/domain/resources/resource-plan";
import { prepareResourceKpiSnapshot, selectResourceKpiAssignments, calculateResourceKpi } from "../../src/domain/resources/resource-kpi";
import { detailsQuery } from "../../src/features/resources/resource-dashboard-model";
import { inflateRawSync } from "node:zlib";
import type { ProjectExcelExportRequest } from "../../src/contracts/project-excel-export";
import type { ResourceDashboardDto, ResourceDashboardDetailsDto } from "../../src/contracts/resource-dashboard";

test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: integrationAdminPassword, viewport: { width: 1440, height: 900 } });

test("#530 실제 SQLite 원장과 UI 3계층·2matrix·Plan·5폭·Excel·Gantt 왕복", async ({ page, baseURL }, info) => {
  test.setTimeout(240_000);
  const seeded = await seedResourceKpiIntegration(page.request, baseURL!);
  const canonical = await seeded.getSnapshot();
  const reports: ResourceDashboardDto[] = [];
  const exportRequests: ProjectExcelExportRequest[] = [];
  page.on("request", request => { if (request.url().endsWith(`${seeded.api}/exports/excel`)) exportRequests.push(request.postDataJSON() as ProjectExcelExportRequest); });
  page.on("response", async response => {
    if (response.url().includes(`${seeded.api}/resource-dashboard?`) && response.status() === 200) {
      const body = await response.json().catch(() => null);
      if (body) reports.push(body.data as ResourceDashboardDto);
    }
  });
  await page.goto(`/projects/${seeded.publicId}`);
  const frame = page.locator(".project-gantt-frame");
  await expect(frame).toBeVisible();
  await page.getByRole("button", { name: "일", exact: true }).click();
  await frame.locator(`.wx-row[data-id=":${seeded.tasks.T1.taskId}"]`).first().click();
  await expect(frame.locator(".wx-row.wx-selected")).toHaveCount(1);
  await expect.poll(() => frame.getAttribute("data-gantt-canonical-sync-depth")).toBe("0");
  await frame.evaluate(async () => {
    for (let tick = 0; tick < 20; tick++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  const chart = frame.locator(".wx-chart");
  await chart.hover(); await page.mouse.wheel(120, 0);
  await expect.poll(async () => (await ganttIntegrationState(page)).left).toBeGreaterThan(0);
  await frame.evaluate(async () => { for (let tick = 0; tick < 12; tick++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
  const before = await ganttIntegrationState(page);
  expect(before.left).toBeGreaterThan(0);
  expect(before.columns.length).toBeGreaterThan(0);
  expect(before.selection.length).toBe(1);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  const root = page.locator('[data-resource-dashboard="true"]:visible');
  await expect(root).toHaveAttribute("data-ready", "true");
  await root.getByLabel("기간 시작", { exact: true }).fill(RESOURCE_KPI_INTEGRATION.from);
  await root.getByLabel("기간 종료", { exact: true }).fill(RESOURCE_KPI_INTEGRATION.to);
  await expect.poll(() => reports.at(-1)?.range).toEqual({ from: RESOURCE_KPI_INTEGRATION.from, to: RESOURCE_KPI_INTEGRATION.to });
  await expect(root).toHaveAttribute("data-ready", "true");
  const report = reports.at(-1)!;
  expect(report.summary).toMatchObject({ assignmentCount: 5, taskCount: 4, resourceCount: 2, effort: { knownMd: 11.5, unsetCount: 1 } });
  const oracle = calculateResourceKpi({ ...resourceKpiIntegrationFixture(), asOfDate: report.asOfDate, mdPerMm: report.mdPerMm });
  expect(report.summary.effort.knownMd).toBe(oracle.total.effort.knownMd);
  expect(report.summary.completed).toBe(oracle.total.completed.count);
  expect(report.summary.delayed).toBe(oracle.total.delayed.count);
  expect(report.summary.completion.numerator).toBe(oracle.total.completion.numerator);
  expect(report.summary.completion.denominator).toBe(oracle.total.completion.denominator);
  expect(report.groups.reduce((sum, group) => sum + group.summary.effort.knownMd, 0)).toBe(17);
  await expect(root.getByLabel("선택 범위 KPI", { exact: true })).toContainText("11.50");
  await expect(root.getByLabel("선택 범위 KPI", { exact: true })).toContainText("미설정");
  await expect(root.getByRole("button", { name: "M/M", exact: true })).toBeDisabled();
  const explicit = (await (await page.request.get(`${seeded.api}/resource-dashboard?from=${RESOURCE_KPI_INTEGRATION.from}&to=${RESOURCE_KPI_INTEGRATION.to}&mdPerMm=20&asOfDate=${RESOURCE_KPI_INTEGRATION.asOfDate}`)).json()).data;
  expect(explicit.summary.effort.knownMd).toBe(report.summary.effort.knownMd);
  expect(explicit.summary.effort.plannedMm).toBe(0.575);
  const observations = [];
  const view = root.getByLabel("리소스 보기", { exact: true });
  for (const mode of ["group", "resource"] as const) {
    await root.getByRole("button", { name: mode === "group" ? "그룹" : "개인", exact: true }).click();
    await view.selectOption("tree");
    for (const order of mode === "group" ? ["milestone", "resource"] : ["milestone"]) {
      if (mode === "group") await root.getByLabel("집계 순서", { exact: true }).selectOption(order);
      const tree = root.getByRole("region", { name: "Milestone 계층 현황", exact: true });
      await expect(tree).toBeVisible();
      await expect(tree).toContainText(mode === "group" ? "G1" : "A");
      await tree.getByRole("button", { name: "계층 모두 접기", exact: true }).click();
      const path = mode === "group" ? (order === "milestone" ? ["G1", "M1", "A"] : ["G1", "A", "M1"]) : ["A", "M1"];
      let branch = tree;
      for (const name of path) {
        const disclosure = branch.locator("button[aria-expanded]").filter({ hasText: new RegExp(`^[▸▾]?${name}$`) }).first();
        await disclosure.focus(); await page.keyboard.press("Enter");
        await expect(disclosure).toHaveAttribute("aria-expanded", "true");
        branch = disclosure.locator("..");
      }
      await branch.getByRole("button", { name: /2\.50 M\/D/ }).click();
      await expect(root.locator(".resource-dashboard-selected h3")).toBeFocused();
      await expect(root.locator(".resource-dashboard-selected")).toContainText("T1");
      await page.keyboard.press("Escape");
      observations.push({ kind: "tree", mode, order, text: await tree.innerText() });
    }
    await view.selectOption("matrix");
    const region = root.getByRole("region", { name: `${mode === "group" ? "그룹" : "개인"} Milestone 비교표`, exact: true });
    const first = region.locator("tbody").getByRole("button", { name: `${mode === "group" ? "G1" : "A"} · M1 · 계획 공수 상세`, exact: true }).first();
    await first.focus(); await page.keyboard.press("Enter");
    const title = root.locator(".resource-dashboard-selected h3");
    await expect(title).toBeFocused();
    await expect(root.locator(".resource-dashboard-selected")).toContainText("T1");
    await page.keyboard.press("Escape"); await expect(first).toBeFocused();
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await region.scrollIntoViewIfNeeded();
      const geometry = await region.evaluate(owner => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        clientWidth: owner.clientWidth, scrollWidth: owner.scrollWidth,
        rows: owner.querySelectorAll("tbody tr").length,
        columns: owner.querySelectorAll("thead th").length,
        controlsContained: Array.from(owner.querySelectorAll("td button")).every(button => {
          const box = button.getBoundingClientRect(), cell = button.closest("td")!.getBoundingClientRect();
          return box.left >= cell.left - 1 && box.right <= cell.right + 1;
        }) }));
      expect(geometry.documentWidth).toBe(width); expect(geometry.controlsContained).toBe(true);
      expect(geometry.rows).toBe(2);
      await first.focus(); await page.keyboard.press("Tab");
      const focus = await region.evaluate(owner => {
        const active = document.activeElement as HTMLElement, box = active.getBoundingClientRect(), bounds = owner.getBoundingClientRect(), style = getComputedStyle(active);
        const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        return { tag: active.tagName, ring, left: box.left - ring, right: box.right + ring,
          top: box.top - ring, bottom: box.bottom + ring, ownerTop: bounds.top, ownerBottom: bounds.bottom, viewportHeight: innerHeight, ownerLeft: bounds.left, ownerRight: bounds.right, painted: document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === active };
      });
      expect(focus.tag).toBe("BUTTON"); expect(focus.ring).toBeGreaterThan(0);
      expect(focus.left).toBeGreaterThanOrEqual(focus.ownerLeft); expect(focus.right).toBeLessThanOrEqual(focus.ownerRight);
      expect(focus.top).toBeGreaterThanOrEqual(Math.max(0, focus.ownerTop));
      expect(focus.bottom).toBeLessThanOrEqual(Math.min(focus.viewportHeight, focus.ownerBottom));
      expect(focus.painted).toBe(true);
      observations.push({ kind: "matrix", mode, ...geometry, nativeTab: focus });
      if (process.env.CAPTURE_ISSUE_530 === "1") {
        await mkdir("output/playwright/issue530", { recursive: true });
        await page.screenshot({ path: `output/playwright/issue530/${mode}-${width}.png` });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await view.selectOption("plan");
  for (const granularity of ["week", "month"] as const) {
    await root.getByLabel("기간 단위", { exact: true }).selectOption(granularity);
    await expect(root).toHaveAttribute("data-ready", "true");
    await expect.poll(() => reports.at(-1)?.plan?.granularity).toBe(granularity);
    const input = { ...resourceKpiIntegrationFixture(), asOfDate: reports.at(-1)!.asOfDate, mdPerMm: reports.at(-1)!.mdPerMm };
    const prepared = prepareResourceKpiSnapshot(input), rows = selectResourceKpiAssignments(prepared, {}).assignments;
    const planOracle = calculateResourcePlan({ ...input, mdPerMm: prepared.mdPerMm, granularity,
      capacityResourceIds: input.resources.map(resource => resource.resourceId), selectedAssignments: rows, fullProjectAssignments: rows,
      limits: { resourceDays: 200000, assignmentDays: 1000000, matrixCells: 5000 } });
    expect(reports.at(-1)!.plan!.totals.summary.selected).toEqual(planOracle.totals.summary.selected);
    expect(reports.at(-1)!.plan!.totals.summary.selected.capacityMd).toBe(10);
  }
  const plan = root.getByRole("region", { name: "Resource Plan", exact: true });
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await plan.evaluate(node => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      rows: node.querySelectorAll("tbody tr[data-plan-row]").length, columns: node.querySelectorAll("thead th").length }));
    expect(geometry.documentWidth).toBe(width); expect(geometry.rows).toBeGreaterThan(0); expect(geometry.rows).toBeLessThanOrEqual(50);
    observations.push({ kind: "plan", ...geometry });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const cell = plan.locator('tr[data-plan-row="total"] td button').first();
  await cell.focus(); await page.keyboard.press("Enter");
  const planDetail = plan.getByRole("region", { name: "기간 부하 상세", exact: true });
  await expect(planDetail.locator("h3")).toBeFocused();
  await expect(planDetail).toContainText("2026-10-05");
  await page.keyboard.press("Escape"); await expect(cell).toBeFocused();
  const summaryResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `${seeded.api}/resource-dashboard` && !url.searchParams.has("granularity") && response.status() === 200;
  });
  await view.selectOption("summary");
  await (await summaryResponse).json();
  await expect(root).toHaveAttribute("data-ready", "true");
  await root.getByRole("button", { name: "Excel 보고서", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "내보내기", exact: true });
  await expect(dialog.getByLabel("형식")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(root.getByRole("button", { name: "Excel 보고서", exact: true })).toBeFocused();
  await root.getByRole("button", { name: "Excel 보고서", exact: true }).click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toMatch(/\.xlsx$/);
  await info.attach("actual-resource-kpi-workbook", { path: (await downloaded.path())!, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const bytes = await readFile((await downloaded.path())!);
  const entries = new Map<string, string>(); let at = 0;
  while (at + 30 <= bytes.length && bytes.readUInt32LE(at) === 0x04034b50) {
    const size = bytes.readUInt32LE(at + 18), length = bytes.readUInt16LE(at + 26), start = at + 30 + length + bytes.readUInt16LE(at + 28);
    entries.set(bytes.toString("utf8", at + 30, at + 30 + length), inflateRawSync(bytes.subarray(start, start + size)).toString()); at = start + size;
  }
  const names = [...entries.get("xl/workbook.xml")!.matchAll(/name="([^"]+)"/g)].map(match => match[1]);
  const assignmentsXml = entries.get(`xl/worksheets/sheet${names.indexOf("Resource Assignments") + 1}.xml`)!;
  expect([...assignmentsXml.matchAll(/<row /g)]).toHaveLength(6);
  expect(exportRequests).toHaveLength(1);
  const options = exportRequests[0].resourceDashboard!;
  expect(options.basis).toBe("current");
  if (!("snapshotId" in options.expectedReport)) throw Error("current report snapshot proof required");
  const expectedSnapshotId = options.expectedReport.snapshotId;
  const currentReport = reports.find(report => report.snapshotId === expectedSnapshotId)!;
  expect(options.expectedReport.context).toEqual(currentReport.resourceScopeContext);
  const reportXml = entries.get(`xl/worksheets/sheet${names.indexOf("Resource Report") + 1}.xml`)!;
  expect(reportXml).toContain(currentReport.snapshotId);
  expect(reportXml).toContain(currentReport.asOfDate);
  expect(reportXml).toContain(currentReport.calendarRevision);
  const query = detailsQuery(currentReport, currentReport.summary.selector, "assignments", 0);
  const details = (await (await page.request.get(`${seeded.api}/resource-dashboard/details?${query}`)).json()).data as ResourceDashboardDetailsDto;
  expect(details.rows).toHaveLength(5);
  for (const detail of details.rows) {
    const row = [...assignmentsXml.matchAll(/<row[^>]*>(.*?)<\/row>/g)].find(match => match[1].includes(detail.assignment!.assignmentId))![1];
    expect(row).toContain(detail.taskId);
    const raw = /<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/.exec(row);
    if (detail.assignment!.plannedMd === null) expect(row).toMatch(/<c r="Y\d+"[^>]*\/>/);
    else expect(Number(raw![1])).toBe(detail.assignment!.plannedMd);
  }
  expect([...assignmentsXml.matchAll(/<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/g)].reduce((sum, match) => sum + Number(match[1]), 0)).toBe(currentReport.summary.effort.knownMd);
  // Responsive layout changes invalidate historical viewport restoration.
  // Compare navigation independently after returning to fixed geometry.
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect.poll(() => frame.getAttribute("data-gantt-canonical-sync-depth")).toBe("0");
  await chart.hover(); await page.mouse.wheel(120, 0);
  await expect.poll(async () => (await ganttIntegrationState(page)).left).toBeGreaterThan(0);
  await frame.evaluate(async element => {
    let previous = "", stable = 0;
    for (let tick = 0; tick < 90 && stable < 8; tick++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const native = element.querySelector(".wx-chart")!.scrollLeft;
      const publicValue = Reflect.get(element, "__masterganttPublicViewport")?.left;
      const current = `${native}:${publicValue}:${element.getAttribute("data-gantt-canonical-sync-depth")}`;
      stable = current === previous && native === publicValue && element.getAttribute("data-gantt-canonical-sync-depth") === "0" ? stable + 1 : 0;
      previous = current;
    }
    if (stable < 8) throw new Error("Fixed-geometry Gantt did not settle before navigation comparison");
  });
  const fixedBefore = await ganttIntegrationState(page);
  expect(fixedBefore.instance).toBe(before.instance);
  expect(fixedBefore.left).toBeGreaterThan(0);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await root.getByLabel("선택 범위 KPI", { exact: true }).locator("div").filter({ hasText: /^할당 Task/ }).getByRole("button").click();
  const detail = root.locator(".resource-dashboard-detail");
  await expect(detail.locator("tbody tr")).toHaveCount(4);
  await detail.getByRole("button", { name: "전체 범위 일정 보기", exact: true }).click();
  const strip = page.getByRole("region", { name: "임시 조회 범위", exact: true });
  await expect(strip).toContainText("고유 Task 4"); await expect(strip).toContainText("Assignment 5");
  await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  for (const name of ["T1", "T2", "T3", "T6"]) await expect(frame.locator(`.wx-row[data-id=":${seeded.tasks[name].taskId}"]`)).toBeVisible();
  for (const name of ["T4", "T5"]) await expect(frame.locator(`.wx-row[data-id=":${seeded.tasks[name].taskId}"]`)).toHaveCount(0);
  await strip.getByRole("button", { name: /원래 보기/ }).click();
  await expect(detail.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Milestone 대시보드", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(root.getByLabel("기간 시작", { exact: true })).toHaveValue(RESOURCE_KPI_INTEGRATION.from);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect.poll(() => ganttIntegrationState(page)).toEqual(fixedBefore);
  expect((await seeded.getSnapshot()).data).toEqual(canonical.data);
  await info.attach("actual-ledger-ui-geometry", { body: JSON.stringify({ report, observations, before, fixedBefore, exportRequests, assignmentIds: details.rows.map(row => row.assignment!.assignmentId) }), contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_530 === "1") await writeFile("output/playwright/issue530/geometry.json", JSON.stringify({ environment: "actual SQLite HTTP Chromium", browserVersion: page.context().browser()?.version(), devicePixelRatio: await page.evaluate(() => devicePixelRatio), observations }, null, 2));
});

test("#530 실제 readonly 원장의 외부 변경은 상세와 Excel을 stale로 잠근다", async ({ page, browser, baseURL }) => {
  test.setTimeout(180_000);
  const seed = await seedResourceKpiIntegration(page.request, baseURL!);
  const readonly = await browser.newContext({ baseURL });
  try {
    const publicPage = await readonly.newPage();
    await publicPage.goto(`/projects/${seed.publicId}`);
    await publicPage.getByRole("tab", { name: "리소스", exact: true }).click();
    const root = publicPage.locator('[data-resource-dashboard="true"]:visible');
    await expect(root).toHaveAttribute("data-ready", "true");
    expect(await readonly.cookies()).toEqual([]);
    await seed.mutate(`/tasks/${seed.tasks.T2.taskId}`, { name: "T2 external change" }, "patch");
    const response = publicPage.waitForResponse(response => response.url().includes("/resource-dashboard/details?") && response.status() === 409);
    await root.getByLabel("선택 범위 KPI", { exact: true }).locator("div").filter({ hasText: /^할당 Task/ }).getByRole("button").click();
    expect((await response).status()).toBe(409);
    await expect(root).toHaveAttribute("data-ready", "false");
    let exportRequests = 0;
    publicPage.on("request", request => { if (request.url().endsWith("/exports/excel")) exportRequests++; });
    await root.getByRole("button", { name: "Excel 보고서", exact: true }).click();
    const dialog = publicPage.getByRole("dialog", { name: "내보내기", exact: true });
    await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("다시 조회");
    expect(exportRequests).toBe(0);
    await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("다시 조회");
    expect(exportRequests).toBe(0);
    await publicPage.keyboard.press("Escape");
    await expect(root.getByRole("alert").first()).toContainText("데이터");
    expect(await readonly.cookies()).toEqual([]);
  } finally { await readonly.close(); }
});

test("#530 고정 geometry exact 일정 drill 복귀는 원래 nonzero viewport를 보존", async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  const seed = await seedResourceKpiIntegration(page.request, baseURL!);
  await page.goto(`/projects/${seed.publicId}`);
  const frame = page.locator(".project-gantt-frame");
  await expect(frame).toBeVisible();
  await frame.locator(`.wx-row[data-id=":${seed.tasks.T1.taskId}"]`).first().click();
  await expect.poll(() => frame.getAttribute("data-gantt-canonical-sync-depth")).toBe("0");
  await frame.locator(".wx-chart").hover(); await page.mouse.wheel(120, 0);
  await expect.poll(async () => (await ganttIntegrationState(page)).left).toBeGreaterThan(0);
  await frame.evaluate(async () => { for (let tick = 0; tick < 12; tick++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
  const before = await ganttIntegrationState(page), canonical = await seed.getSnapshot();
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  const root = page.locator('[data-resource-dashboard="true"]:visible');
  await expect(root).toHaveAttribute("data-ready", "true");
  const initialCapture = await frame.getAttribute("data-gantt-peer-capture");
  await root.getByLabel("선택 범위 KPI", { exact: true }).locator("div").filter({ hasText: /^할당 Task/ }).getByRole("button").click();
  const detail = root.locator(".resource-dashboard-detail");
  await expect(detail.locator("tbody tr")).toHaveCount(4);
  await detail.getByRole("button", { name: "전체 범위 일정 보기", exact: true }).click();
  const strip = page.getByRole("region", { name: "임시 조회 범위", exact: true });
  await expect(strip).toContainText("고유 Task 4");
  await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  await strip.getByRole("button", { name: /원래 보기/ }).click();
  await expect(detail.locator("tbody tr")).toHaveCount(4);
  const returnCapture = await frame.getAttribute("data-gantt-peer-capture");
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  try {
    await expect.poll(() => ganttIntegrationState(page)).toEqual(before);
    // A stale metadata-only scroll command must not replace the peer restore
    // with zero after the first successful snapshot comparison.
    await frame.evaluate(async () => {
      for (let tick = 0; tick < 12; tick++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    });
    await expect.poll(() => ganttIntegrationState(page)).toEqual(before);
    // #568: a late SVAR layout can move the native chart to zero before
    // scroll-chart(0) reaches Core. Recreate a native-only reset with no
    // user input and require the exact public/native viewport to recover.
    const chart = frame.locator(".wx-chart");
    const capacity = await chart.evaluate(element => element.scrollWidth - element.clientWidth);
    expect(capacity).toBeGreaterThanOrEqual(before.publicViewport.left);
    const priorRepairs = Number(await frame.getAttribute("data-gantt-peer-native-repairs") ?? 0);
    // After native capacity/Core settle, the guard has a new repair budget.
    // Two distinct delayed native-only resets must each recover without
    // a stale programmatic command overwriting Core or user scroll.
    for (let cycle = 1; cycle <= 2; cycle++) {
      await chart.evaluate(element => { element.scrollLeft = 0; });
      await expect.poll(() => ganttIntegrationState(page)).toEqual(before);
      await expect.poll(async () => Number(await frame.getAttribute("data-gantt-peer-native-repairs") ?? 0))
        .toBeGreaterThanOrEqual(priorRepairs + cycle);
    }
    const staleAfterPeer = await frame.evaluate((element, expectedLeft) => {
      const raw = element.getAttribute("data-gantt-public-scroll-events") ?? "[]";
      const events = JSON.parse(raw) as { action: string; requestedLeft?: number }[];
      const lastExplicitReturn = events.findLastIndex(event => event.action === "scroll-chart" && event.requestedLeft === expectedLeft);
      if (lastExplicitReturn < 0) return -1;
      return events.slice(lastExplicitReturn + 1).filter(event => event.action === "scroll-chart" && event.requestedLeft === 0).length;
    }, before.publicViewport.left);
    expect(staleAfterPeer).toBe(0);
    expect(await seed.getSnapshot()).toEqual(canonical);
  } finally {
    await info.attach("fixed-geometry-exact-drill", { body: JSON.stringify({
      before, after: await ganttIntegrationState(page), initialCapture, returnCapture,
      peerRestore: await frame.getAttribute("data-gantt-peer-restore"),
      guardBlocks: await frame.getAttribute("data-gantt-peer-scroll-guard-blocks"),
      nativeRepairs: await frame.getAttribute("data-gantt-peer-native-repairs"),
      repairFailure: await frame.getAttribute("data-gantt-peer-native-repair-failure"),
      publicEvents: await frame.getAttribute("data-gantt-public-scroll-events"),
      capacity: await frame.locator(".wx-chart").evaluate(element => element.scrollWidth - element.clientWidth),
    }), contentType: "application/json" });
  }
});

test("#530 nested frame pop과 clear는 서로 다른 원래 Core/native 위치를 보존", async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  const seed = await seedResourceKpiIntegration(page.request, baseURL!);
  await page.goto(`/projects/${seed.publicId}?__coreTrace=1`);
  const frame = page.locator(".project-gantt-frame");
  const schedule = page.getByRole("tab", {name: "일정", exact: true});
  const resource = page.getByRole("tab", {name: "리소스", exact: true});
  const strip = page.getByRole("region", {name: "임시 조회 범위", exact: true});
  async function settle() { await expect.poll(() => frame.getAttribute("data-gantt-canonical-sync-depth")).toBe("0"); await frame.evaluate(async () => {for(let n=0;n<12;n++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));}); }
  async function drill() {
    await resource.click();
    const root = page.locator('[data-resource-dashboard="true"]:visible');
    await expect(root).toHaveAttribute("data-ready", "true");
    await root.getByLabel("선택 범위 KPI", {exact:true}).locator("div").filter({hasText:/^할당 Task/}).getByRole("button").click();
    await root.locator(".resource-dashboard-detail").getByRole("button",{name:"전체 범위 일정 보기",exact:true}).click();
    await expect(schedule).toHaveAttribute("aria-selected","true"); await settle();
  }
  await expect(frame).toBeVisible(); await settle();
  await frame.locator(".wx-chart").hover(); await page.mouse.wheel(120,0); await settle();
  const origin = await ganttIntegrationState(page);
  expect(origin.left).toBeGreaterThan(0);
  await drill();
  await frame.locator(".wx-chart").hover(); await page.mouse.wheel(240,0); await settle();
  const middle = await ganttIntegrationState(page);
  expect(middle.left).toBeGreaterThan(origin.left);
  await drill();
  await strip.getByRole("button",{name:/원래 보기/}).click(); await expect(resource).toHaveAttribute("aria-selected","true"); await schedule.click();
  try {
    await expect.poll(() => ganttIntegrationState(page)).toEqual(middle);
    // 복원 후 Gantt 외부 프로젝트 제목 클릭으로는 이전 좌표 보호가 해제되지 않는다.
    await page.getByRole("heading", { name: "Resource KPI integration #530" }).click();
    await frame.evaluate(async () => {
      for (let tick = 0; tick < 12; tick++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    });
    await expect.poll(() => ganttIntegrationState(page)).toEqual(middle);
    // 중첩 원래 보기 복원 이후에는 이전 metadata-only 0 좌표가 재적용되지 않아야 한다.
    const rebaseToZero = await frame.evaluate((element, target) => {
      const events = JSON.parse(element.getAttribute("data-gantt-public-scroll-events") ?? "[]") as {action: string; requestedLeft?: number}[];
      const targetIndex = events.findLastIndex(event => event.action === "scroll-chart" && event.requestedLeft === target);
      if (targetIndex < 0) return -1;
      return events.slice(targetIndex + 1).filter(event => event.action === "scroll-chart" && event.requestedLeft === 0).length;
    }, middle.publicViewport.left);
    expect(rebaseToZero).toBe(0);
  } finally {
    await info.attach("nested-frame-return-first-pop", {
      body: JSON.stringify({expected: middle, actual: await ganttIntegrationState(page),
        captured: await frame.getAttribute("data-gantt-peer-capture"),
        restored: await frame.getAttribute("data-gantt-peer-restore"),
        events: await frame.getAttribute("data-gantt-public-scroll-events")}),
      contentType: "application/json",
    });
  }
  // #568: 원래 좌표 복원 뒤 뒤늦게 실행된 scroll-chart(0)의 최초 writer를 보존한다.
  // Trace는 dev/test opt-in이며 제품 계약·수용 assertion/timeout/retry는 그대로 유지한다.
  await expect.poll(() => frame.evaluate(element => "__issue568Trace" in element)).toBe(true);
  const traceHead = process.env.ISSUE568_HEAD ?? process.env.GITHUB_SHA ?? "uncommitted";
  await frame.evaluate((element, { run, head }) => {
    const trace = (element as HTMLElement & {
      __issue568Trace?: { configure: (run: string, head: string, scenario: string) => void };
    }).__issue568Trace;
    if (!trace) throw new Error("Issue #568 trace unavailable");
    trace.configure(run, head, "nested-second-pop");
  }, { run: `ci530-repeat-${info.retry}`, head: traceHead });
  try {
  await resource.click(); await strip.getByRole("button",{name:/원래 보기/}).click(); await expect(strip).toHaveCount(0); await schedule.click();
  await expect.poll(() => ganttIntegrationState(page)).toEqual(origin);
  // Admission cannot rely on Core alone: physical chart scroll capacity
  // must accept the original 120px before an explicit peer restore is sent.
  // A Core+DOM match can precede the receipt, which is deliberately
  // published only after the extra three stable layout frames.
  await expect.poll(async () => {
    const raw = await frame.getAttribute("data-gantt-peer-restore");
    return raw ? JSON.parse(raw) : null;
  }).toMatchObject({
    requestedLeft: origin.publicViewport.left,
    capacityStableFrames: 3,
    settleStableFrames: 3,
  });
  const secondReceipt = await frame.getAttribute("data-gantt-peer-restore");
  expect(secondReceipt).not.toBeNull();
  const restoredCapacity = JSON.parse(secondReceipt!) as {
    requestedLeft: number; publicLeft: number; domLeft: number;
    nativeCapacity: number; admissionCapacity: number;
    capacityStableFrames: number; settleStableFrames: number;
  };
  expect(restoredCapacity.requestedLeft).toBe(origin.publicViewport.left);
  expect(restoredCapacity.publicLeft).toBe(origin.publicViewport.left);
  expect(restoredCapacity.domLeft).toBe(origin.left);
  expect(restoredCapacity.admissionCapacity).toBeGreaterThanOrEqual(origin.left - 1);
  expect(restoredCapacity.nativeCapacity).toBeGreaterThanOrEqual(origin.left - 1);
  expect(restoredCapacity.capacityStableFrames).toBeGreaterThanOrEqual(3);
  expect(restoredCapacity.settleStableFrames).toBeGreaterThanOrEqual(3);
  // A new nested journey clears to the earliest schedule destination baseline.
  await drill(); await frame.locator(".wx-chart").hover(); await page.mouse.wheel(240,0); await settle(); await drill();
  await strip.getByRole("button",{name:/임시 이동 범위 전체 해제/}).click();
  await expect(strip).toHaveCount(0);
  await expect.poll(() => ganttIntegrationState(page)).toEqual(origin);
  await info.attach("nested-pop-clear-positions",{body:JSON.stringify({origin,middle,after:await ganttIntegrationState(page),guardBlocks:await frame.getAttribute("data-gantt-peer-scroll-guard-blocks")}),contentType:"application/json"});
  // #530: 실제 사용자가 차트를 왼쪽으로 스크롤하면 보호가 해제되어야 한다.
  await frame.locator(".wx-chart").hover(); await page.mouse.wheel(-240, 0);
  await expect.poll(async () => { const state = await ganttIntegrationState(page); return { coreLeft: state.publicViewport.left, nativeLeft: state.left }; }).toEqual({ coreLeft:0, nativeLeft:0 });
  } finally {
    const trace = await frame.evaluate(element => (element as HTMLElement & {
      __issue568Trace?: { snapshot: () => unknown };
    }).__issue568Trace?.snapshot() ?? null);
    await info.attach("issue568-nested-return-trace", {
      body: JSON.stringify({
        source: "PR #575 / Issue #568 dev-test opt-in observation",
        head: traceHead, origin, actual: await ganttIntegrationState(page),
        publicEvents: await frame.getAttribute("data-gantt-public-scroll-events"),
        peerRestore: await frame.getAttribute("data-gantt-peer-restore"),
        capacityFailure: await frame.getAttribute("data-gantt-peer-restore-capacity-failure"),
        settleFailure: await frame.getAttribute("data-gantt-peer-restore-settle-failure"),
        nativeRepairs: await frame.getAttribute("data-gantt-peer-native-repairs"),
        canonicalGeneration: await frame.getAttribute("data-gantt-canonical-sync-generation"),
        trace,
      }, null, 2),
      contentType: "application/json",
    });
  }
});

test("#530 explicit frame 복귀 pending queue는 실제 wheel 이후 Core/native 사용자 위치를 유지", async ({page,baseURL},info) => {
  const seed = await seedResourceKpiIntegration(page.request,baseURL!);
  await page.goto(`/projects/${seed.publicId}`);
  const frame=page.locator(".project-gantt-frame"), chart=frame.locator(".wx-chart");
  const schedule=page.getByRole("tab",{name:"일정",exact:true}), resource=page.getByRole("tab",{name:"리소스",exact:true});
  await expect(frame).toBeVisible(); await chart.hover(); await page.mouse.wheel(120,0);
  await expect.poll(async()=> (await ganttIntegrationState(page)).left).toBe(120);
  await resource.click();
  const root=page.locator('[data-resource-dashboard="true"]:visible'); await expect(root).toHaveAttribute("data-ready","true");
  await root.getByLabel("선택 범위 KPI",{exact:true}).locator("div").filter({hasText:/^할당 Task/}).getByRole("button").click();
  await root.locator(".resource-dashboard-detail").getByRole("button",{name:"전체 범위 일정 보기",exact:true}).click();
  const strip=page.getByRole("region",{name:"임시 조회 범위",exact:true});
  await strip.getByRole("button",{name:/원래 보기/}).click(); await expect(resource).toHaveAttribute("aria-selected","true");
  // Keep the pause target ahead of installed virtual time; install() itself does not freeze time.
  // Preserves the same wall-clock instant after the fast-forward without a race to the past.
  const pauseTime = new Date();
  await page.clock.install({ time: new Date(pauseTime.getTime() - 60_000) });
  await page.clock.pauseAt(pauseTime);
  await schedule.evaluate(node=>(node as HTMLElement).click()); await expect(frame).toBeVisible();
  const bounds=await chart.boundingBox(); if(!bounds) throw Error("visible chart required");
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2); await page.mouse.wheel(40,0);
  await expect.poll(async()=> (await ganttIntegrationState(page)).publicViewport.left).toBeGreaterThan(0);
  const user=await ganttIntegrationState(page);
  expect(user.publicViewport.left).not.toBe(120); expect(user.left).not.toBe(120);
  expect(user.left).toBeGreaterThan(0);
  const viewport = async () => { const state = await ganttIntegrationState(page); return {publicViewport:state.publicViewport,left:state.left,top:state.top,instance:state.instance,apiInstance:state.apiInstance}; };
  const expected = {publicViewport:user.publicViewport,left:user.left,top:user.top,instance:user.instance,apiInstance:user.apiInstance};
  await page.clock.runFor(500);
  await expect.poll(viewport).toEqual(expected);
  await page.clock.runFor(500);
  await expect.poll(viewport).toEqual(expected);
  const targetIds = Object.values(seed.tasks);
  for (const task of targetIds) await expect(frame.locator(`.wx-row[data-id=":${task.taskId}"]`).first()).toBeVisible();
  await info.attach("explicit-return-native-input-cancel",{body:JSON.stringify({user,settled:await ganttIntegrationState(page)}),contentType:"application/json"});
  await page.clock.resume();
});

test("#530 explicit frame pending queue는 실제 viewport resize 후 이전 위치를 복원하지 않는다", async ({page,baseURL},info) => {
  const seed = await seedResourceKpiIntegration(page.request,baseURL!);
  await page.goto(`/projects/${seed.publicId}`);
  const frame=page.locator(".project-gantt-frame"), chart=frame.locator(".wx-chart");
  const schedule=page.getByRole("tab",{name:"일정",exact:true}), resource=page.getByRole("tab",{name:"리소스",exact:true});
  await expect(frame).toBeVisible(); await chart.hover(); await page.mouse.wheel(120,0);
  await expect.poll(async()=> (await ganttIntegrationState(page)).left).toBe(120);
  await resource.click();
  const root=page.locator('[data-resource-dashboard="true"]:visible'); await expect(root).toHaveAttribute("data-ready","true");
  await root.getByLabel("선택 범위 KPI",{exact:true}).locator("div").filter({hasText:/^할당 Task/}).getByRole("button").click();
  await root.locator(".resource-dashboard-detail").getByRole("button",{name:"전체 범위 일정 보기",exact:true}).click();
  const strip=page.getByRole("region",{name:"임시 조회 범위",exact:true});
  await strip.getByRole("button",{name:/원래 보기/}).click(); await expect(resource).toHaveAttribute("aria-selected","true");
  // Keep the pause target ahead of installed virtual time; install() itself does not freeze time.
  // Preserves the same wall-clock instant after the fast-forward without a race to the past.
  const pauseTime = new Date();
  await page.clock.install({ time: new Date(pauseTime.getTime() - 60_000) });
  await page.clock.pauseAt(pauseTime);
  await schedule.evaluate(node=>(node as HTMLElement).click()); await expect(frame).toBeVisible();
  const bounds=await chart.boundingBox(); if(!bounds) throw Error("visible chart required");
  await page.setViewportSize({width:1024,height:768});
  const user=await ganttIntegrationState(page);
  expect(user.publicViewport.left).not.toBe(120); expect(user.left).not.toBe(120);
  expect(await page.evaluate(()=>({width:innerWidth,height:innerHeight}))).toEqual({width:1024,height:768});
  const viewport = async () => { const state = await ganttIntegrationState(page); return {publicViewport:state.publicViewport,left:state.left,top:state.top,instance:state.instance,apiInstance:state.apiInstance}; };
  const expected = {publicViewport:user.publicViewport,left:user.left,top:user.top,instance:user.instance,apiInstance:user.apiInstance};
  await page.clock.runFor(500);
  await expect.poll(viewport).toEqual(expected);
  await page.clock.runFor(500);
  await expect.poll(viewport).toEqual(expected);
  const targetIds = Object.values(seed.tasks);
  for (const task of targetIds) await expect(frame.locator(`.wx-row[data-id=":${task.taskId}"]`).first()).toBeVisible();
  await info.attach("explicit-return-viewport-geometry-cancel",{body:JSON.stringify({user,settled:await ganttIntegrationState(page)}),contentType:"application/json"});
  await page.clock.resume();
});

test("#530 실제 M1 원인→정확한 Resource 지연 KPI→일정→Resource→M1 LIFO", async ({page,baseURL},info) => {
  test.setTimeout(180_000);
  const seed = await seedResourceKpiIntegration(page.request,baseURL!);
  // Explicit derived ledger: only T1 and its two personal allocation windows
  // move to a completed five-workday period. The shared oracle stays immutable.
  const range = {from:"2026-09-28",to:"2026-10-02"};
  const original = await seed.getSnapshot();
  await seed.mutate(`/tasks/${seed.tasks.T1.taskId}`,{start:range.from},"patch");
  const catalog = (await (await page.request.get("/api/resources")).json()).data;
  await seed.mutate(`/tasks/${seed.tasks.T1.taskId}/assignments`,{catalogRevision:catalog.revision,targets:[
    {kind:"resource",id:seed.resources.A,allocation:{start:range.from,end:range.to,percent:50}},
    {kind:"resource",id:seed.resources.B,allocation:{start:range.from,end:range.to,percent:100}},
  ]},"put");
  const canonical = await seed.getSnapshot();
  const t1 = canonical.data.tasks.find(task=>task.taskId===seed.tasks.T1.taskId)!;
  expect(t1).toMatchObject({start:range.from,end:range.to,duration:5,status:"not_started",progress:0});
  const assignmentIds = (canonical.data.assignments ?? []).filter(assignment=>assignment.taskId===t1.taskId).map(assignment=>assignment.id).sort();
  expect(assignmentIds).toHaveLength(2);
  for(const assignment of (canonical.data.assignments ?? []).filter(assignment=>assignment.taskId===t1.taskId))
    expect(assignment.allocation).toMatchObject({start:range.from,end:range.to,percent:assignment.target.id===seed.resources.A?50:100});
  expect(canonical.data.project.calendar).toEqual(original.data.project.calendar);
  const resourceReports:ResourceDashboardDto[]=[], milestoneReports:import("../../src/contracts/milestone-dashboard").MilestoneDashboardDto[]=[];
  const queryRequests:import("../../src/contracts/resource-drill").ResourceDrillQueryInput[]=[];
  page.on("request",request=>{if(request.method()==="POST" && request.url().endsWith(`${seed.api}/resource-dashboard/query`)) queryRequests.push(request.postDataJSON());});
  page.on("response",async response=>{
    if(response.status()!==200) return;
    const url=response.url();
    if(url.includes(`${seed.api}/resource-dashboard?`) || url.endsWith(`${seed.api}/resource-dashboard/query`) || url.includes(`${seed.api}/milestone-dashboard?`)) {
      const body=await response.json().catch(()=>null);if(!body) return;
      if(url.includes("/milestone-dashboard?")) milestoneReports.push(body.data);else if(body.data?.summary) resourceReports.push(body.data);
    }
  });
  await page.goto(`/projects/${seed.publicId}`);
  const frame=page.locator(".project-gantt-frame");await expect(frame).toBeVisible();
  const instance=(await ganttIntegrationState(page)).instance;
  const milestoneTab=page.getByRole("tab",{name:"Milestone 대시보드",exact:true});
  const resourceTab=page.getByRole("tab",{name:"리소스",exact:true});
  const scheduleTab=page.getByRole("tab",{name:"일정",exact:true});
  await milestoneTab.click();
  const milestone=page.getByTestId("milestone-dashboard");await expect(milestone).toHaveAttribute("data-ready","true");
  await milestone.getByLabel("Milestone 검색",{exact:true}).fill("M1");
  await milestone.getByText("Milestone 표시·공수 범위 조건",{exact:true}).click();
  await milestone.getByLabel("공수 시작일",{exact:true}).fill(range.from);
  await milestone.getByLabel("공수 종료일",{exact:true}).fill(range.to);
  await expect(milestone).toHaveAttribute("data-ready","true");
  await expect.poll(()=>milestoneReports.some(report=>report.workloadRange.from===range.from && report.workloadRange.to===range.to && report.filters.search==="M1")).toBe(true);
  const milestoneReport=milestoneReports.findLast(report=>report.workloadRange.from===range.from && report.workloadRange.to===range.to && report.filters.search==="M1")!;
  expect(milestoneReport.asOfDate>range.to).toBe(true);
  const m1Bucket=milestoneReport.effort.buckets.find(bucket=>bucket.milestoneTaskId===seed.tasks.M1.taskId)!;
  expect(m1Bucket.taskIds).toEqual([t1.taskId]);expect([...m1Bucket.assignmentIds].sort()).toEqual(assignmentIds);expect(m1Bucket.plannedMd).toBe(7.5);
  const cause=milestone.getByRole("button",{name:"M1 전체 원인 확인",exact:true});await cause.focus();await page.keyboard.press("Enter");
  const causeHeading=milestone.getByRole("heading",{name:"M1 · 전체 Milestone 원인",exact:true});await expect(causeHeading).toBeFocused();
  const causeRegion=causeHeading.locator("xpath=../..");await expect(causeRegion).toContainText("T1");
  const crossTrigger=milestone.getByRole("region",{name:"범위 내 Milestone 공수 표 가로 스크롤",exact:true}).locator("tbody tr").filter({hasText:"M1"}).getByRole("button",{name:"리소스",exact:true});
  await crossTrigger.focus();await page.keyboard.press("Enter");
  await expect(resourceTab).toHaveAttribute("aria-selected","true");
  const resource=page.locator('[data-resource-dashboard="true"]:visible');await expect(resource).toHaveAttribute("data-ready","true");
  await expect(resource.getByLabel("기간 시작",{exact:true})).toHaveValue(range.from);
  await expect(resource.getByLabel("기간 종료",{exact:true})).toHaveValue(range.to);
  await expect.poll(()=>resourceReports.some(report=>report.range.from===range.from && report.range.to===range.to && report.summary.taskCount===1 && report.summary.assignmentCount===2)).toBe(true);
  const report=resourceReports.findLast(report=>report.range.from===range.from && report.range.to===range.to && report.summary.taskCount===1 && report.summary.assignmentCount===2)!;
  const source=resourceKpiIntegrationFixture();
  const oracle=calculateResourceKpi({...source,from:range.from,to:range.to,asOfDate:report.asOfDate,mdPerMm:report.mdPerMm,
    tasks:source.tasks.map(task=>task.taskId==="T1"?{...task,start:range.from,end:range.to}:task),
    assignments:source.assignments.map(assignment=>assignment.taskId==="T1"?{...assignment,start:range.from,end:range.to}:assignment),filters:{taskIds:["T1"]}});
  expect(report.summary.effort.knownMd).toBe(oracle.total.effort.knownMd);expect(report.summary.effort.knownMd).toBe(7.5);
  expect(report.summary.delayed).toBe(oracle.total.delayed.count);expect(report.summary.delayed).toBe(1);
  const binding=queryRequests.findLast(request=>request.projection.kind==="report" && request.filters.from===range.from && request.filters.to===range.to)!;
  expect(binding.scope.kind).toBe("exactAssignments");
  if(binding.scope.kind!=="exactAssignments") throw Error("M1 exact Assignment source binding required");
  expect([...binding.scope.assignmentIds].sort()).toEqual(assignmentIds);
  const assignmentResponse=await page.request.post(`${seed.api}/resource-dashboard/query`,{headers:{Origin:baseURL!},data:{...binding,
    projection:{kind:"details",snapshotId:report.snapshotId,selector:report.summary.selector,view:"assignments",offset:0,limit:50}}});
  expect(assignmentResponse.status()).toBe(200);const assignments=(await assignmentResponse.json()).data as ResourceDashboardDetailsDto;
  expect(assignments.rows).toHaveLength(2);expect(assignments.rows.map(row=>row.assignment!.assignmentId).sort()).toEqual(assignmentIds);expect(assignments.rows.every(row=>row.taskId===t1.taskId)).toBe(true);
  expect(assignments.rows.reduce((sum,row)=>sum+row.assignment!.plannedMd!,0)).toBe(7.5);
  const kpi=resource.getByLabel("선택 범위 KPI",{exact:true});
  const delayed=kpi.locator("div").filter({hasText:/^지연 Task/}).getByRole("button");await expect(delayed).toHaveText("1건");await delayed.focus();await page.keyboard.press("Enter");
  const detail=resource.locator(".resource-dashboard-detail");await expect(detail.locator("tbody tr")).toHaveCount(1);await expect(detail).toContainText("T1");
  const strip=page.getByRole("region",{name:"임시 조회 범위",exact:true});
  await detail.getByRole("button",{name:"전체 범위 일정 보기",exact:true}).click();
  await expect(scheduleTab).toHaveAttribute("aria-selected","true");await expect(strip).toContainText("고유 Task 1");await expect(strip).toContainText("Assignment 2");
  await expect(frame.locator(`.wx-row[data-id=":${t1.taskId}"]`)).toBeVisible();
  for(const key of ["T2","T3","T4","T5","T6"]) await expect(frame.locator(`.wx-row[data-id=":${seed.tasks[key].taskId}"]`)).toHaveCount(0);
  await strip.getByRole("button",{name:/원래 보기/}).click();await expect(resourceTab).toHaveAttribute("aria-selected","true");
  await expect(detail.locator("tbody tr")).toHaveCount(1);await expect(resource.getByLabel("기간 시작",{exact:true})).toHaveValue(range.from);await expect(resource.getByLabel("기간 종료",{exact:true})).toHaveValue(range.to);
  await strip.getByRole("button",{name:/원래 보기/}).click();await expect(milestoneTab).toHaveAttribute("aria-selected","true");await expect(strip).toHaveCount(0);
  await expect(milestone.getByLabel("Milestone 검색",{exact:true})).toHaveValue("M1");await expect(milestone.getByLabel("공수 시작일",{exact:true})).toHaveValue(range.from);await expect(milestone.getByLabel("공수 종료일",{exact:true})).toHaveValue(range.to);
  await expect(causeHeading).toBeVisible();await expect(causeRegion).toContainText("T1");await expect(crossTrigger).toBeFocused();
  const after=await seed.getSnapshot();expect(after).toEqual(canonical);expect((await ganttIntegrationState(page)).instance).toBe(instance);
  const receipt={variant:"T1 task and two personal allocation windows moved to past five weekdays; selected M1 scope only",baseRange:RESOURCE_KPI_INTEGRATION,range,
    asOfDate:report.asOfDate,projectPublicId:seed.publicId,taskId:t1.taskId,milestoneTaskId:seed.tasks.M1.taskId,assignmentIds,projectRevision:canonical.data.project.revision,
    calendar:canonical.data.project.calendar,binding,milestoneContext:milestoneReport.resourceScopeContext,resourceReport:report,assignmentDetails:assignments,
    oracle:{knownMd:oracle.total.effort.knownMd,taskCount:oracle.total.taskCount,assignmentCount:oracle.total.assignmentCount,delayed:oracle.total.delayed.count},
    snapshotDataUnchanged:true,revisionUnchanged:true,instanceUnchanged:true,flows:["M1 cause→M1 exact Resource T1/Assignment2","Resource delayed KPI1→exact T1 schedule→Resource delayed detail→M1 cause/filter/period/focus"]};
  await info.attach("actual-cross-flow-derived-ledger",{body:JSON.stringify(receipt),contentType:"application/json"});
  await writeFile("output/playwright/issue530/cross-flow-evidence.json",JSON.stringify(receipt,null,2));
});
