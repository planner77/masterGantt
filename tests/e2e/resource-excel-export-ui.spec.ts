import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../src/contracts/projects";
import { dashboardQuery } from "../../src/features/resources/resource-dashboard-model";
import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import type { ResourceExcelExportOptions } from "../../src/contracts/resource-excel-export";
import type { ProjectExcelExportRequest } from "../../src/contracts/project-excel-export";

async function sourceHashes() {
  const paths = ["src/features/projects/project-readonly-view.tsx", "src/features/gantt/project-gantt.tsx", "src/features/projects/project-excel-export-button.tsx", "src/features/resources/resource-export-model.ts", "src/features/resources/project-resource-dashboard.tsx", "tests/e2e/resource-excel-export-ui.spec.ts"];
  return Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
}
const password = "Synthetic529Admin!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: password, viewport: { width: 1440, height: 900 } });
function workbookEntries(bytes: Buffer) {
  const entries = new Map<string, string>(); let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8), size = bytes.readUInt32LE(offset + 18),
      length = bytes.readUInt16LE(offset + 26), extra = bytes.readUInt16LE(offset + 28),
      start = offset + 30 + length + extra;
    const content = bytes.subarray(start, start + size);
    entries.set(bytes.toString("utf8", offset + 30, offset + 30 + length), (method === 8 ? inflateRawSync(content) : content).toString());
    offset = start + size;
  }
  return entries;
}
type CellValue = string | number | boolean | null;
const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function sheetRows(xml: string): CellValue[][] {
  return Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), row => {
    const values: CellValue[] = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(cell[1])![1];
      const index = [...ref].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0) - 1;
      const markup = cell[2] ?? "", type = /\bt="([^"]+)"/.exec(cell[1])?.[1];
      const value = /<v>([\s\S]*?)<\/v>/.exec(markup)?.[1];
      values[index] = type === "inlineStr" ? Array.from(markup.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g), match => decode(match[1])).join("")
        : value === undefined ? null : type === "b" ? value === "1" : Number(value);
    }
    return values;
  });
}
function assertReportWorkbook(entries: Map<string, string>, report: ResourceDashboardDto, options: ResourceExcelExportOptions) {
  const sheets = new Map(Array.from(entries.get("xl/workbook.xml")!.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*sheetId="(\d+)"/g), match =>
    [decode(match[1]), sheetRows(entries.get(`xl/worksheets/sheet${match[2]}.xml`)!) ]));
  for (const name of ["Resource Report", "Resource Milestones", "Group Milestones", "Resource Plan", "Resource Assignments", "Resource Quality", "Resource Relations"])
    expect(sheets.has(name), name).toBe(true);
  const metadataRows = sheets.get("Resource Report")!, metadata = new Map(metadataRows.map(row => [row[0], row[1]]));
  expect(metadata.get("projectPublicId")).toBe(report.projectPublicId);
  expect(metadata.get("projectRevision")).toBe(report.projectRevision);
  expect(metadata.get("catalogRevision")).toBe(report.catalogRevision);
  expect(metadata.get("calendarRevision")).toBe(report.calendarRevision);
  expect(metadata.get("snapshotId")).toBe(report.snapshotId);
  expect(JSON.parse(metadata.get("Actual target context") as string)).toEqual(report.resourceScopeContext);
  if (options.originalSourceContext) expect(JSON.parse(metadata.get("Original source provenance (not current totals)") as string)).toEqual(options.originalSourceContext);
  const [head, ...rows] = sheets.get("Resource Assignments")!;
  const id = head.indexOf("assignmentId"), md = head.indexOf("plannedMd"), ids = rows.map(row => row[id]);
  expect(new Set(ids).size).toBe(rows.length); expect(rows.length).toBe(report.summary.assignmentCount);
  expect(rows.every(row => row[md] === null || typeof row[md] === "number")).toBe(true);
  expect(rows.reduce((sum, row) => sum + (typeof row[md] === "number" ? row[md] as number : 0), 0)).toBeCloseTo(report.summary.effort.knownMd, 12);
  if (options.basis === "current" && options.binding?.scope.kind === "exactAssignments")
    expect([...ids].sort()).toEqual([...options.binding.scope.assignmentIds].sort());
  return { assignmentIds: ids, assignmentCount: rows.length, knownMd: report.summary.effort.knownMd, snapshotId: report.snapshotId };
}
async function seed(page: Page, origin: string) {
  const created = await page.request.post("/api/projects", { headers: { Origin: origin },
    data: { name: "Excel Resource #529", ownerName: "E2E", description: "실제 Resource XLSX 다운로드 검증", editPassword: "UI529!" } });
  expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string, api = `/api/projects/${publicId}`;
  const get = async () => await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  let snapshot = await get();
  const mutate = async (path: string, data: unknown, method: "post" | "put" = "post", status = 200) => {
    const response = await page.request[method](`${api}${path}`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data });
    expect(response.status(), await response.text()).toBe(status); snapshot = await get(); return response;
  };
  const add = async (name: string, type: "task" | "milestone") => {
    const response = await mutate("/tasks", { name, type, start: "2026-10-06", duration: type === "task" ? 2 : 0, progress: 0 }, "post", 201);
    return (await response.json()).data.tasks.find((task: ProjectTaskDto) => task.name === name) as ProjectTaskDto;
  };
  const task = await add("=원래 작업 이름", "task"), milestone = await add("보고 단계", "milestone");
  await mutate("/milestone-memberships", { changes: [{ taskId: task.taskId, milestoneTaskId: milestone.taskId }] });
  expect((await page.request.post("/api/resource-catalog/admin-sessions", { headers: { Origin: origin }, data: { password } })).status()).toBe(201);
  const catalog = (await (await page.request.get("/api/resources")).json()).data;
  const resourceResponse = await page.request.post("/api/resources", { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` },
    data: { name: "개발 담당", code: `R529-${publicId.slice(0, 8)}`, roles: ["DEVELOPER"], developerGrade: "ADVANCED" } });
  expect(resourceResponse.status()).toBe(201);
  const currentCatalog = (await resourceResponse.json()).data;
  const resourceId = currentCatalog.resources.find((resource: { code: string }) => resource.code === `R529-${publicId.slice(0, 8)}`).id;
  await mutate(`/tasks/${task.taskId}/assignments`, { catalogRevision: currentCatalog.revision,
    targets: [{ kind: "resource", id: resourceId, allocation: { start: null, end: null, percent: 80 } }] }, "put");
  return { publicId, api, get, snapshot, task };
}
const peerDiagnostics = (page: Page) => page.locator(".project-gantt-frame").evaluate(node => ({
  public: Reflect.get(node, "__masterganttPublicViewport"),
  dom: { left: node.querySelector(".wx-chart")!.scrollLeft, top: node.querySelector(".wx-gantt")!.scrollTop },
  events: node.getAttribute("data-gantt-public-scroll-events"), restore: node.getAttribute("data-gantt-peer-restore"),
  instance: node.getAttribute("data-project-gantt-api-instance"),
  syncDepth: node.getAttribute("data-gantt-canonical-sync-depth"),
  syncGeneration: node.getAttribute("data-gantt-canonical-sync-generation"),
  settledGeneration: node.getAttribute("data-gantt-canonical-sync-settled-generation"),
  activeTabs: Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"]')).map(tab => tab.textContent),
  resourceVisits: Array.from(document.querySelectorAll('[data-resource-context-id]:not([hidden])')).map(view => view.getAttribute("data-resource-context-id")),
}));
test("#529 실제 readonly Resource·exact 이동 보고서 XLSX 다운로드와 기존 작업면 보존", async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  const origin = baseURL!;
  const { publicId, api, get, snapshot, task } = await seed(page, origin);
  // A new browser context has no Project edit session; export remains a readonly command.
  await page.context().clearCookies();
  await page.goto(`/projects/${publicId}`);
  const gantt = page.locator(".project-gantt-widget");
  await expect(gantt).toBeVisible(); await gantt.evaluate(node => node.setAttribute("data-export-kept", "529"));
  const frame = page.locator(".project-gantt-frame");
  await frame.locator(`.wx-row[data-id=":${task.taskId}"]`).first().click();
  await expect(frame.locator(".wx-row.wx-selected")).toHaveCount(1);
  await frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await frame.locator(".wx-chart").first().hover();
  await page.mouse.wheel(120, 0);
  await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttPublicViewport")?.left)).toBeGreaterThan(0);
  const ganttState = () => frame.evaluate(node => ({
    public: Reflect.get(node, "__masterganttPublicViewport"),
    left: node.querySelector(".wx-chart")!.scrollLeft,
    top: node.querySelector(".wx-gantt")!.scrollTop,
    columns: Array.from(node.querySelectorAll(".wx-header .wx-cell")).map(cell => cell.getBoundingClientRect().width),
    selected: Array.from(node.querySelectorAll(".wx-row.wx-selected")).map(row => row.getAttribute("data-id")),
    rows: Array.from(node.querySelectorAll(".wx-row")).map(row => row.getAttribute("data-id")),
  }));
  const beforeExport = await ganttState(); expect(beforeExport.left).toBeGreaterThan(0);

  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  const root = page.locator('[data-resource-dashboard="true"]:visible');
  await expect(root).toHaveAttribute("data-ready", "true");
  const trigger = root.getByRole("button", { name: "Excel 보고서", exact: true });
  await trigger.click(); const dialog = page.getByRole("dialog", { name: "내보내기", exact: true });
  await expect(dialog.getByLabel("형식")).toBeFocused();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await trigger.click();
  const [request, download] = await Promise.all([
    page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/exports/excel")),
    page.waitForEvent("download"), dialog.getByRole("button", { name: "내보내기", exact: true }).click(),
  ]);
  const body = request.postDataJSON() as ProjectExcelExportRequest;
  expect(body.resourceDashboard?.basis).toBe("current");
  expect(request.headers()["if-match"]).toBe(`"${snapshot.data.project.revision}"`);
  const actualReport = async (options: ResourceExcelExportOptions): Promise<ResourceDashboardDto> => {
    const context = options.expectedReport.context;
    const filters = options.basis === "current" ? options.expectedReport.filters : {
      from: context.range.from, to: context.range.to, asOfDate: context.asOfDate,
      ...(context.mdPerMmProvided ? { mdPerMm: context.mdPerMm } : {}),
    };
    const response = options.basis === "current" && options.binding
      ? await page.request.post(`${api}/resource-dashboard/query`, { headers: { Origin: origin }, data: { ...options.binding, filters, projection: { kind: "report" } } })
      : await page.request.get(`${api}/resource-dashboard?${dashboardQuery(filters)}`);
    expect(response.status()).toBe(200); return (await response.json()).data;
  };
  const entries = workbookEntries(await readFile((await download.path())!));
  const currentEvidence = assertReportWorkbook(entries, await actualReport(body.resourceDashboard!), body.resourceDashboard!);
  const xml = [...entries.values()].join(""); expect(xml).toContain("=원래 작업 이름"); expect(xml).not.toContain("<f>");
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await expect(gantt).toHaveAttribute("data-export-kept", "529");
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect.poll(ganttState).toEqual(beforeExport);
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  const mRoot = page.getByTestId("milestone-dashboard"); await expect(mRoot).toHaveAttribute("data-ready", "true");
  await mRoot.getByRole("button", { name: "해당 범위 리소스 보기", exact: true }).click();
  const exactRoot = page.locator('[data-resource-dashboard="true"]:visible'); await expect(exactRoot).toHaveAttribute("data-ready", "true");
  await exactRoot.getByRole("button", { name: "Excel 보고서", exact: true }).click();
  await dialog.getByRole("button", { name: "현재 보고서 확인", exact: true }).click();
  const [exactRequest, exactDownload] = await Promise.all([
    page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/exports/excel")),
    page.waitForEvent("download"), dialog.getByRole("button", { name: "내보내기", exact: true }).click(),
  ]);
  const exactOptions = (exactRequest.postDataJSON() as ProjectExcelExportRequest).resourceDashboard!;
  expect(exactOptions.basis).toBe("current");
  if (exactOptions.basis !== "current") throw new Error("current expected");
  expect(exactOptions.binding?.scope.kind).toBe("exactAssignments");
  expect(exactOptions.originalSourceContext).toEqual(exactOptions.binding?.sourceContext);
  const exactEvidence = assertReportWorkbook(workbookEntries(await readFile((await exactDownload.path())!)), await actualReport(exactOptions), exactOptions);
  await exactRoot.getByRole("button", { name: "Excel 보고서", exact: true }).click();
  await dialog.getByLabel("Project 전체 (확인된 기간·기준일·환산 정책 유지)").check();
  const [wholeRequest, wholeDownload] = await Promise.all([
    page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/exports/excel")),
    page.waitForEvent("download"), dialog.getByRole("button", { name: "내보내기", exact: true }).click(),
  ]);
  const wholeOptions = (wholeRequest.postDataJSON() as ProjectExcelExportRequest).resourceDashboard!;
  expect(wholeOptions.basis).toBe("project"); expect(wholeOptions).not.toHaveProperty("binding");
  const wholeEvidence = assertReportWorkbook(workbookEntries(await readFile((await wholeDownload.path())!)), await actualReport(wholeOptions), wholeOptions);
  await expect(gantt).toHaveAttribute("data-export-kept", "529");
  expect((await get()).data.project.revision).toBe(snapshot.data.project.revision);
  const evidence = { capturedAt: new Date().toISOString(), sourceHashes: await sourceHashes(), readonly: true, ganttBeforeAfter: beforeExport, currentEvidence, exactEvidence, wholeEvidence, exactOptions, originalRevision: snapshot.data.project.revision };
  await mkdir("output/playwright/issue-529-resource-export", { recursive: true });
  await writeFile("output/playwright/issue-529-resource-export/native-workbook.json", JSON.stringify(evidence, null, 2));
  await info.attach("native-resource-export", { body: JSON.stringify(evidence), contentType: "application/json" });
});

test("#529 진단 control: Export 없는 동일 native fixture의 일정·리소스 peer viewport", async ({ page, baseURL }, info) => {
  const f = await seed(page, baseURL!); await page.context().clearCookies(); await page.goto(`/projects/${f.publicId}`);
  const frame = page.locator(".project-gantt-frame");
  await frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first().click();
  await frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await frame.locator(".wx-chart").first().hover(); await page.mouse.wheel(120, 0);
  await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttPublicViewport")?.left)).toBe(120);
  const before = await peerDiagnostics(page);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(page.locator('[data-resource-dashboard="true"]:visible')).toHaveAttribute("data-ready", "true");
  const hidden = await peerDiagnostics(page);
  // The parent must capture the public Core coordinates separately from the
  // native chart DOM positions before leaving the schedule tab.
  const capture = await frame.getAttribute("data-gantt-peer-capture");
  expect(capture).not.toBeNull();
  expect(JSON.parse(capture!)).toEqual({ public: before.public, dom: before.dom });
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  try {
    await expect.poll(() => frame.evaluate(node => ({ public: Reflect.get(node, "__masterganttPublicViewport"),
      dom: { left: node.querySelector(".wx-chart")!.scrollLeft, top: node.querySelector(".wx-gantt")!.scrollTop } })))
      .toEqual({ public: { left: 120, top: 0 }, dom: { left: 120, top: 0 } });
  } finally {
    const evidence = { capturedAt: new Date().toISOString(), sourceHashes: await sourceHashes(), control: "no-export", before, hidden, after: await peerDiagnostics(page) };
    await mkdir("output/playwright/issue-529-resource-export", { recursive: true });
    await writeFile("output/playwright/issue-529-resource-export/peer-control-after.json", JSON.stringify(evidence, null, 2));
    await info.attach("peer-control", { body: JSON.stringify(evidence), contentType: "application/json" });
  }
});


test("#529 pending peer restore cancels on native wheel and canonical filter change", async ({ page, baseURL }, info) => {
  const f = await seed(page, baseURL!); await page.context().clearCookies(); await page.goto(`/projects/${f.publicId}`);
  const frame = page.locator(".project-gantt-frame"), chart = frame.locator(".wx-chart").first();
  await chart.hover(); await page.mouse.wheel(120, 0);
  await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttPublicViewport")?.left)).toBe(120);
  const position = await chart.boundingBox();
  if (!position) throw new Error("visible chart required");
  const resource = page.getByRole("tab", { name: "리소스", exact: true });
  await resource.click(); await expect(page.locator('[data-resource-dashboard="true"]:visible')).toHaveAttribute("data-ready", "true");
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("tab", { name: "일정", exact: true }).evaluate(node => (node as HTMLElement).click());
  await expect(frame).toBeVisible();
  await page.mouse.move(position.x + position.width / 2, position.y + position.height / 2);
  await page.mouse.wheel(40, 0);
  const viewport = () => frame.evaluate(node => ({ public: Reflect.get(node, "__masterganttPublicViewport"),
    dom: { left: node.querySelector(".wx-chart")!.scrollLeft, top: node.querySelector(".wx-gantt")!.scrollTop } }));
  await expect.poll(async () => (await viewport()).public?.left).toBeGreaterThan(0);
  const inputViewport = await viewport();
  expect(inputViewport.public.left).not.toBe(120);
  expect(inputViewport.public.left).not.toBe(0);
  expect(inputViewport.dom.left).not.toBe(120);
  expect(inputViewport.dom.left).not.toBe(0);
  const userViewport = inputViewport;
  await page.clock.runFor(200);
  await expect.poll(viewport).toEqual(userViewport);
  await page.clock.runFor(300);
  await expect.poll(viewport).toEqual(userViewport);
  expect(await frame.getAttribute("data-gantt-peer-restore")).toBeNull();
  const afterInput = await peerDiagnostics(page);
  const events = JSON.parse(afterInput.events!) as { requestedLeft?: number }[];
  const userEvent = events.findLastIndex(event => event.requestedLeft !== undefined && event.requestedLeft !== 0 && event.requestedLeft !== 120);
  expect(userEvent).toBeGreaterThanOrEqual(0);
  expect(events.slice(userEvent + 1).some(event => event.requestedLeft === 120)).toBe(false);
  await page.clock.resume(); await resource.click();
  await expect(page.locator('[data-resource-dashboard="true"]:visible')).toHaveAttribute("data-ready", "true");
  await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 100).toISOString()));
  await page.getByRole("tab", { name: "일정", exact: true }).evaluate(node => (node as HTMLElement).click());
  const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true });
  await search.fill("no matching task");
  await page.clock.runFor(300);
  expect(await frame.getAttribute("data-gantt-peer-restore")).toBeNull();
  const afterFilter = await peerDiagnostics(page);
  expect(afterFilter.syncGeneration).not.toBe(afterInput.syncGeneration);
  await page.clock.resume();
  const evidence = { capturedAt: new Date().toISOString(), sourceHashes: await sourceHashes(), timerControl: "paused RAF while native wheel/filter invalidates pending restore", inputViewport, userViewport, settledAfterInput: afterInput, afterFilter };
  await mkdir("output/playwright/issue-529-resource-export", { recursive: true });
  await writeFile("output/playwright/issue-529-resource-export/peer-restore-cancel.json", JSON.stringify(evidence, null, 2));
  await info.attach("peer-restore-cancel", { body: JSON.stringify(evidence), contentType: "application/json" });
});
