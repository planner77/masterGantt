import { ISSUE_623_TARGET_RESOURCE as oracle } from "../fixtures/issue-623-target-resource";
import { inflateRawSync } from "node:zlib";
import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import { resourceExportFilterInput } from "../../src/features/resources/resource-export-model";
import { mkdir, writeFile } from "node:fs/promises";
import type { Page, Locator } from "@playwright/test";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { issue621ResourcePassword } from "./fixtures/issue-621-target-project";
import { seedIssue623 } from "./fixtures/issue-623-target-resource";
import { chooseTaskInformation } from "./helpers/task-context-menu";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: issue621ResourcePassword, viewport: { width: 1440, height: 1000 } });
const previousMdPerMm = process.env.RESOURCE_MD_PER_MM;
test.beforeAll(() => { process.env.RESOURCE_MD_PER_MM = String(oracle.mdPerMm); });
test.afterAll(() => { if (previousMdPerMm === undefined) delete process.env.RESOURCE_MD_PER_MM; else process.env.RESOURCE_MD_PER_MM = previousMdPerMm; });
function archive(bytes: Buffer) {
  const result = new Map<string, string>(); let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), start = offset + 30 + nameLength + bytes.readUInt16LE(offset + 28);
    result.set(bytes.toString("utf8", offset + 30, offset + 30 + nameLength), inflateRawSync(bytes.subarray(start, start + size)).toString()); offset = start + size;
  }
  const names = [...result.get("xl/workbook.xml")!.matchAll(/name="([^"]+)"/g)].map(match => match[1]);
  return { names, sheet: (name: string) => result.get(`xl/worksheets/sheet${names.indexOf(name) + 1}.xml`)! };
}
const editor = (page: Page) => page.getByRole("dialog", { name: "작업 정보", exact: true });
async function resource(page: Page) {
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  const root = page.locator('[data-resource-dashboard="true"]:visible');
  await expect(root).toHaveAttribute("data-ready", "true");
  await root.getByLabel("기간 시작", { exact: true }).fill("2026-10-05");
  await root.getByLabel("기간 종료", { exact: true }).fill("2026-10-12");
  await root.getByLabel("리소스 보기", { exact: true }).selectOption("targets");
  await root.getByLabel("Target 표시", { exact: true }).selectOption("matrix");
  await expect(root).toHaveAttribute("data-ready", "true"); return root;
}
async function sharedDetail(root: Locator, taskId: string) {
  await root.getByRole("region", { name: "Resource Target 비교표", exact: true }).locator("tbody td button").first().click();
  const detail = root.locator(".resource-dashboard-detail");
  await expect(detail).toHaveAttribute("data-detail-state", "ready");
  return detail.locator(`[data-canonical-task-id="${taskId}"]`).first();
}

test("#623 실제 통합 구성·F0 원시5M/D·여섯 별도 mutation·양방향 동일원본 복귀", async ({ page, isolatedApplication: origin }, info) => {
  // The recorded integrated flow reaches 30.6s; keep its allowance finite and scoped.
  test.setTimeout(60_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue623(page, origin);
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const core = await frame.locator(".wx-gantt").elementHandle();
  const initial = await f.snapshot();
  const union = await f.report();
  expect(union.summary).toMatchObject({ taskCount: 1, assignmentCount: 1, effort: { knownMd: oracle.expected.shared.knownMd, plannedMm: oracle.expected.shared.plannedMm } });
  for (const target of f.targets) expect((await f.report({ targetIds: target.id })).summary.effort.knownMd).toBe(5);
  expect(union.targetProjection!.relatedMembers).toMatchObject({ equipmentQuantity: oracle.expected.shared.equipmentQuantity, systemCount: oracle.expected.shared.systemCount });
  const source = (await f.details(union)).rows[0];
  const assignmentId = source.assignment!.assignmentId;
  expect(source.targetSources!.inheritedBindings).toHaveLength(1);
  expect(source.targetSources!.bindings).toHaveLength(2);
  const acs = (await (await page.request.get(`${f.api}/tasks/${f.acsTask.taskId}/target-bindings`)).json()).data.effective;
  expect(acs.effectiveEquipmentIds).toEqual([]);
  expect(acs.effectiveSystemIds).toEqual([f.targets[0].members.find(member => member.code === "ACS-A")!.entityId]);
  expect(f.targets[0].members.find(member => member.code === "MCS-1")!.entityId).toBe(f.targets[1].members.find(member => member.code === "MCS-1")!.entityId);
  // Observe the UI's exact report and use its own filters/snapshot for OOXML.
  let uiReport: ResourceDashboardDto | null = null;
  page.on("response", async response => {
    if (new URL(response.url()).pathname === `/api/projects/${f.publicId}/resource-dashboard` && response.ok()) {
      const body = await response.json().catch(() => null); if (body) uiReport = body.data;
    }
  });
  const goldenRoot = await resource(page);
  await goldenRoot.getByLabel("기간 종료", { exact: true }).fill("2026-10-11");
  await goldenRoot.getByRole("button", { name: /^필터(?: \d+)?$/ }).click();
  await goldenRoot.getByLabel("작업 검색", { exact: true }).fill("SHARED");
  await expect(goldenRoot).toHaveAttribute("data-ready", "true");
  await expect(goldenRoot.getByTestId("resource-target-view")).toContainText("선택 전체: 5.00 M/D");
  const goldenCells = goldenRoot.getByRole("region", { name: "Resource Target 비교표", exact: true }).locator("tbody td button");
  await expect(goldenCells).toHaveCount(2);
  for (const cell of await goldenCells.all()) await expect(cell).toContainText("5.00 M/D");
  await goldenRoot.getByRole("button", { name: "M/M", exact: true }).click();
  await expect(goldenRoot.getByTestId("resource-target-view")).toContainText("선택 전체: 0.25 M/M");
  await goldenRoot.getByRole("button", { name: "M/D", exact: true }).click();
  await expect.poll(() => uiReport?.filters.taskSearch).toBe("SHARED");
  const confirmedUiReport = uiReport! as ResourceDashboardDto;
  expect(confirmedUiReport.summary.effort).toMatchObject({ knownMd: oracle.expected.shared.knownMd, plannedMm: oracle.expected.shared.plannedMm });
  const goldenRow = await sharedDetail(goldenRoot, f.task.taskId);
  await expect(goldenRow).toHaveAttribute("data-canonical-assignment-id", assignmentId);
  const workbookResponse = await page.request.post(`${f.api}/exports/excel`, { headers: { Origin: origin, "If-Match": `"${confirmedUiReport.projectRevision}"` }, data: {
    scope: "project", scale: "day", hierarchyDisplay: "expanded", includeDependencies: false, layout: { columns: [{ id: "text", widthPx: 224 }] }, resourceDashboard: {
      basis: "current", expectedReport: { context: confirmedUiReport.resourceScopeContext, snapshotId: confirmedUiReport.snapshotId, filters: resourceExportFilterInput(confirmedUiReport.filters) }, granularities: ["week", "month"],
    },
  } });
  expect(workbookResponse.status(), await workbookResponse.text()).toBe(200);
  const workbook = archive(await workbookResponse.body()), assignmentXml = workbook.sheet("Resource Assignments");
  expect(assignmentXml).toContain(assignmentId); expect(assignmentXml).toContain(f.task.taskId); expect(assignmentXml).toContain(f.person.id);
  expect([...assignmentXml.matchAll(/<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/g)].map(match => Number(match[1]))).toEqual([oracle.expected.shared.knownMd]);
  expect([...assignmentXml.matchAll(/<c r="Z\d+"[^>]*><v>([^<]+)<\/v><\/c>/g)].map(match => Number(match[1]))).toEqual([oracle.expected.shared.plannedMm]);
  expect(workbook.sheet("Resource Target Sources")).toContain(assignmentId);
  for (const target of f.targets) expect(workbook.sheet("Resource Target Catalog")).toContain(target.id);
  expect(workbook.sheet("Resource Target Sources")).toContain(f.targets[0].members.find(member => member.code === "MCS-1")!.entityId);
  expect(await f.snapshot()).toEqual(initial);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  const writes: { method: string; path: string; body: unknown }[] = [];
  page.on("request", request => { const path = new URL(request.url()).pathname; if (path.startsWith(`/api/projects/${f.publicId}`) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !path.endsWith("/resource-dashboard/query")) writes.push({ method: request.method(), path, body: request.postDataJSON() }); });
  const assertSaved = async (count: number) => {
    expect(writes).toHaveLength(count);
    const fresh = await f.snapshot();
    expect(fresh.data.tasks.map(task => task.taskId)).toEqual(initial.data.tasks.map(task => task.taskId));
    expect(fresh.data.project.revision).toBe(initial.data.project.revision + count);
    await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
    expect(await core!.evaluate(element => element.isConnected)).toBe(true);
    return fresh.data.tasks.find(task => task.taskId === f.task.taskId)!;
  };
  // WBS origin: one name PATCH; opening/closing the Target detail is query-only.
  await frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first().click({ button: "right" });
  await chooseTaskInformation(page);
  await editor(page).getByLabel("작업명", { exact: true }).fill("SHARED · WBS 동일 원본");
  await editor(page).getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect((await assertSaved(1)).name).toBe("SHARED · WBS 동일 원본");
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: "물류 대상(Target)", exact: true }).click();
  await page.getByRole("button", { name: `Target 상세: ${f.targets[0].name}`, exact: true }).click();
  const targetDetail = page.getByRole("dialog", { name: `Target 상세 · ${f.targets[0].name}`, exact: true });
  await expect(targetDetail).toContainText(f.task.taskId);
  await targetDetail.getByRole("button", { name: /원본 작업 편집:.*SHARED · WBS 동일 원본/ }).click();
  await editor(page).getByLabel("요청 시작일", { exact: true }).fill("2026-10-06");
  await editor(page).getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect((await assertSaved(2)).start).toBe("2026-10-06");
  await expect(targetDetail).toBeVisible(); await page.keyboard.press("Escape");
  const root = await resource(page);
  for (const [kind, value] of [["status", "in_progress"], ["progress", "35"]] as const) {
    const row = await sharedDetail(root, f.task.taskId);
    await row.getByRole("button", { name: "SHARED · WBS 동일 원본", exact: true }).click();
    if (kind === "status") await editor(page).getByLabel("상태", { exact: true }).selectOption(value);
    else await editor(page).getByLabel("진행률 (%)", { exact: true }).fill(value);
    await editor(page).getByRole("button", { name: "저장", exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    const task = await assertSaved(kind === "status" ? 3 : 4);
    expect(kind === "status" ? task.status : task.progress).toBe(kind === "status" ? "in_progress" : 35);
    await expect(root).toHaveAttribute("data-ready", "true");
  }
  let row = await sharedDetail(root, f.task.taskId);
  await row.getByRole("button", { name: `배정 편집: ${f.person.name}`, exact: true }).click();
  const allocation = editor(page).getByLabel(`리소스 1 ${f.person.name} (${f.person.code}) 투입률 (%)`, { exact: true });
  await allocation.fill("80");
  await editor(page).getByRole("button", { name: /^할당 저장 \(/ }).click();
  await expect(allocation).toHaveValue("80");
  await editor(page).getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await assertSaved(5);
  const assigned = (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data.assignments;
  expect(assigned).toHaveLength(1); expect(assigned[0]).toMatchObject({ id: assignmentId, taskId: f.task.taskId, allocation: { percent: 80 } });
  await expect(root).toHaveAttribute("data-ready", "true");
  row = await sharedDetail(root, f.task.taskId);
  await row.getByRole("button", { name: "SHARED · WBS 동일 원본", exact: true }).click();
  await editor(page).getByRole("tab", { name: /물류 연결/ }).click();
  const binding = editor(page).getByRole("region", { name: "작업 Target 연결", exact: true });
  await binding.getByRole("combobox", { name: `${f.targets[1].name} 구성원 선택`, exact: true }).selectOption("subset");
  await binding.getByLabel(/ACS B \(ACS-B\)/).check();
  await binding.getByRole("button", { name: "Target 연결 저장", exact: true }).click();
  await expect(binding.getByRole("button", { name: "Target 연결 저장", exact: true })).toBeDisabled();
  await editor(page).getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await assertSaved(6);
  const newSources = (await (await page.request.get(`${f.api}/tasks/${f.task.taskId}/target-bindings`)).json()).data;
  expect(newSources.bindings.find((item: { targetId: string }) => item.targetId === f.targets[1].id).memberIds).toEqual([f.targets[1].members.find(member => member.code === "ACS-B")!.id]);
  expect(newSources.effective.effectiveEquipmentIds).toEqual([f.targets[0].members.find(member => member.code === "AMR-A")!.entityId]);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first()).toContainText("SHARED · WBS 동일 원본");
  await assertSaved(6);
  const taskPath = `/api/projects/${f.publicId}/tasks/${f.task.taskId}`;
  expect(writes.slice(0, 4).map(write => [write.method, write.path])).toEqual(Array.from({ length: 4 }, () => ["PATCH", taskPath]));
  expect(writes[0].body).toMatchObject({ name: "SHARED · WBS 동일 원본" });
  expect(writes[1].body).toMatchObject({ start: "2026-10-06" });
  expect(writes[2].body).toMatchObject({ status: "in_progress" });
  expect(writes[3].body).toMatchObject({ progress: 35 });
  expect(writes[4]).toMatchObject({ method: "PUT", path: `${taskPath}/assignments`, body: { editAssignmentId: assignmentId } });
  expect(writes[5]).toMatchObject({ method: "PUT", path: `${taskPath}/target-bindings` });
  const evidence = { projectId: f.publicId, taskId: f.task.taskId, assignmentId, targetIds: f.targets.map(target => target.id), standardId: f.standardId, siteIds: [f.siteA, f.siteB], rawGolden: union.summary, workbook: { names: workbook.names, snapshotId: confirmedUiReport.snapshotId, filters: confirmedUiReport.filters, bytes: (await workbookResponse.body()).length }, members: union.targetProjection!.relatedMembers, writes, instance };
  await mkdir("output/playwright/issue-623", { recursive: true });
  await writeFile("output/playwright/issue-623/cumulative.json", JSON.stringify(evidence, null, 2));
  await info.attach("issue623-cumulative-identity", { contentType: "application/json", body: JSON.stringify(evidence) });
});

test("#623 실제 Target 다열·중첩Group 다섯화면폭 geometry·keyboard·query0·렌더관측", async ({ page, isolatedApplication: origin }, info) => {
  page.setDefaultTimeout(15_000);
  const f = await seedIssue623(page, origin, true);
  const before = await f.snapshot();
  const frame = page.locator(".project-gantt-frame"); const instance = await frame.getAttribute("data-project-gantt-instance");
  const writes: string[] = []; page.on("request", request => { if (new URL(request.url()).pathname.startsWith(`/api/projects/${f.publicId}`) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !request.url().includes("/resource-dashboard/query")) writes.push(request.url()); });
  const start = performance.now(); const root = await resource(page); const renderMilliseconds = performance.now() - start;
  const measurements = []; await mkdir("output/playwright/issue-623", { recursive: true });
  for (const width of [390, 768, 1024, 1440, 1920]) for (const layout of ["tree", "matrix"]) {
    await page.setViewportSize({ width, height: 1000 }); await root.getByLabel("Target 표시", { exact: true }).selectOption(layout);
    if (layout === "tree") await root.getByLabel("Target 집계 순서", { exact: true }).selectOption("target");
    else await root.getByLabel("Target 비교 행", { exact: true }).selectOption("group");
    await expect(root).toHaveAttribute("data-ready", "true");
    const region = root.getByRole("region", { name: layout === "tree" ? "Resource Target 계층" : "Resource Target 비교표", exact: true });
    await region.evaluate(element => { element.scrollLeft = 0; });
    await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBe(0);
    await region.focus();
    await expect(region).toBeFocused();
    const scrollLeftBefore = await region.evaluate(element => element.scrollLeft);
    await page.keyboard.press("ArrowRight");
    if (width === 390) {
      await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(scrollLeftBefore);
    }
    await expect(region).toBeFocused();
    const keyboardMovement = { scrollLeftBefore, scrollLeftAfter: await region.evaluate(element => element.scrollLeft) };
    const geometry = await region.evaluate(element => {
      const rect = (node: Element) => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width }; };
      const headers = [...element.querySelectorAll("thead tr:first-child > *")].map(rect); const cells = [...element.querySelectorAll("tbody tr:first-child > *")].map(rect);
      return { viewport: innerWidth, document: document.documentElement.scrollWidth, owner: element.clientWidth, scroll: element.scrollWidth, focused: document.activeElement === element, headers, cells, buttons: [...element.querySelectorAll("tbody button")].map(button => ({ ...rect(button), parent: rect(button.closest("td,th")!) })) };
    });
    expect(geometry.document).toBeLessThanOrEqual(width + 1); expect(geometry.focused).toBe(true);
    if (width === 390) expect(geometry.scroll).toBeGreaterThan(geometry.owner);
    for (let i = 0; i < geometry.headers.length; i++) { expect(Math.abs(geometry.headers[i].left - geometry.cells[i].left)).toBeLessThanOrEqual(1); expect(Math.abs(geometry.headers[i].right - geometry.cells[i].right)).toBeLessThanOrEqual(1); }
    for (const button of geometry.buttons) { expect(button.left).toBeGreaterThanOrEqual(button.parent.left - 1); expect(button.right).toBeLessThanOrEqual(button.parent.right + 1); }
    measurements.push({ layout, ...geometry, keyboardMovement }); await page.screenshot({ path: `output/playwright/issue-623/${layout}-${width}.png`, fullPage: true });
  }
  expect(writes).toEqual([]); expect(await f.snapshot()).toEqual(before); await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  const evidence = { synthetic: true, projectPublicId: f.publicId, targetCount: f.targets.length, taskCount: before.data.tasks.length, renderMilliseconds, measurements, writes };
  await writeFile("output/playwright/issue-623/geometry.json", JSON.stringify(evidence, null, 2));
  await info.attach("issue623-ui-observations", { contentType: "application/json", body: JSON.stringify(evidence) });
});
