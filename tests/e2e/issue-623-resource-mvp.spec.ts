import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import { expectRawIdentifier } from "./helpers/identifier-details";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { ISSUE_623_TARGET_RESOURCE as oracle } from "../fixtures/issue-623-target-resource";
import { inflateRawSync } from "node:zlib";
import type { AssignedTargetsResponse } from "../../src/contracts/resources";
import type { TaskTargetBindingsResponse } from "../../src/contracts/task-target-bindings";
import type { ObserveIsolatedApi } from "./fixtures/isolated-application-diagnostics";
import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import { resourceExportFilterInput } from "../../src/features/resources/resource-export-model";
import { mkdir, writeFile } from "node:fs/promises";
import type { Page, Locator } from "@playwright/test";
import { expect, isolatedApplicationOptions, test as isolatedTest } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { issue621ResourcePassword } from "./fixtures/issue-621-target-project";
import { seedIssue623 } from "./fixtures/issue-623-target-resource";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import { readBrowserCanonicalSnapshot } from "./helpers/browser-canonical-snapshot";

// The runtime already depends on this password option. Its dependency keeps the
// conversion environment scoped to the server lifetime without hook-only servers.
type PhaseTiming = { beginBody: () => void; mark: (name: string) => void; finishBody: () => void };
const test = isolatedTest.extend<{ resourceMdPerMmEnvironment: void; phaseTiming: PhaseTiming }>({
  phaseTiming: [async ({}, provide, info) => {
    const started = performance.now();
    let phaseStarted = started, phase = "fixture/setup", bodyStarted: number | undefined, bodyFinished: number | undefined;
    const phases: { name: string; milliseconds: number }[] = [];
    const mark = (name: string) => {
      const now = performance.now();
      phases.push({ name: phase, milliseconds: Math.round(now - phaseStarted) });
      phase = name; phaseStarted = now;
    };
    try {
      await provide({
        beginBody: () => { bodyStarted = performance.now(); mark("fixture/seed-http"); },
        mark,
        finishBody: () => { bodyFinished = performance.now(); mark("fixture/teardown"); },
      });
    } finally {
      mark("finished");
      const bodyMilliseconds = bodyStarted === undefined ? null : Math.round((bodyFinished ?? performance.now()) - bodyStarted);
      // This is diagnostic evidence, never a substitute for assertions or a retry.
      await info.attach("issue623-phase-timing", { contentType: "application/json", body: JSON.stringify({
        test: info.title, status: info.status, timeoutMilliseconds: info.timeout,
        bodyMilliseconds, budgetWarning: bodyMilliseconds !== null && bodyMilliseconds >= info.timeout * 0.8,
        wallMilliseconds: Math.round(performance.now() - started), phases,
      }) });
    }
  }, { auto: true }],
  resourceMdPerMmEnvironment: async ({}, provide) => {
    const previous = process.env.RESOURCE_MD_PER_MM;
    process.env.RESOURCE_MD_PER_MM = String(oracle.mdPerMm);
    try { await provide(); }
    finally {
      if (previous === undefined) delete process.env.RESOURCE_MD_PER_MM;
      else process.env.RESOURCE_MD_PER_MM = previous;
    }
  },
  isolatedResourceAdminPassword: async ({ resourceMdPerMmEnvironment }, provide) => {
    void resourceMdPerMmEnvironment;
    await provide(issue621ResourcePassword);
  },
});
test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, viewport: { width: 1440, height: 1000 } });
function archive(bytes: Buffer) {
  const result = new Map<string, string>(); let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), start = offset + 30 + nameLength + bytes.readUInt16LE(offset + 28);
    result.set(bytes.toString("utf8", offset + 30, offset + 30 + nameLength), inflateRawSync(bytes.subarray(start, start + size)).toString()); offset = start + size;
  }
  const names = [...result.get("xl/workbook.xml")!.matchAll(/name="([^"]+)"/g)].map(match => match[1]);
  return { names, sheet: (name: string) => result.get(`xl/worksheets/sheet${names.indexOf(name) + 1}.xml`)! };
}

// These two persistence reads follow browser writes, so use the same transport.
// Keep setup/authorization clients unchanged, and never retry a failed read.
async function readMutationSource<T>(page: Page, path: string, observeApi: ObserveIsolatedApi): Promise<T> {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  if (!new RegExp(`^/api/projects/${uuid}/(?:assigned-targets|tasks/${uuid}/target-bindings)$`, "i").test(path))
    throw new Error("저장 후 조회에는 같은 origin의 배정/Target 원본 경로가 필요합니다.");
  const response = await observeApi(path, "GET", async () => {
    const result = await page.evaluate(async api => {
      const response = await fetch(api, { credentials: "same-origin", cache: "no-store" });
      const text = await response.text();
      let body: unknown = null, validJson = true;
      try { body = JSON.parse(text); } catch { validJson = false; }
      return { status: response.status, requestId: response.headers.get("x-request-id"), body, validJson };
    }, path);
    return { status: () => result.status, headers: () => ({ "x-request-id": result.requestId ?? "" }), body: result.body, validJson: result.validJson };
  });
  expect(response.status(), "저장 후 원본 조회는 HTTP 200이어야 합니다.").toBe(200);
  expect(response.validJson, "저장 후 원본 조회는 유효한 JSON이어야 합니다.").toBe(true);
  return response.body as T;
}

const editor = (page: Page) => page.getByRole("dialog", { name: "작업 정보", exact: true });
async function resource(page: Page) {
  await openWorkspaceView(page, "resources");
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

test("#623 실제 통합 구성·F0 원시5M/D·UI와 Excel 동일 snapshot", async ({ page, isolatedApplication: origin, observeIsolatedApi, phaseTiming, timeIsolatedStage }, info) => {
  // Split the former near-60s flow at the read-only/first-write boundary.
  phaseTiming.beginBody();
  test.setTimeout(60_000);
  page.setDefaultTimeout(15_000);
  const f = await timeIsolatedStage("seed_issue_623", () => seedIssue623(page, origin, observeIsolatedApi));
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const core = await frame.locator(".wx-gantt").elementHandle();
  phaseTiming.mark("api/golden-target-oracle");
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
  phaseTiming.mark("ui/golden-target-and-units");
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
  phaseTiming.mark("excel/export-and-ooxml");
  const workbookResponse = await page.request.post(`${f.api}/exports/excel`, { headers: { Origin: origin, "If-Match": `"${confirmedUiReport.projectRevision}"` }, data: {
    scope: "project", scale: "day", hierarchyDisplay: "expanded", includeDependencies: false, layout: { columns: [{ id: "text", widthPx: 224 }] }, resourceDashboard: {
      basis: "current", expectedReport: { context: confirmedUiReport.resourceScopeContext, snapshotId: confirmedUiReport.snapshotId, filters: resourceExportFilterInput(confirmedUiReport.filters) }, granularities: ["week", "month"],
    },
  } });
  const workbookBytes = await workbookResponse.body();
  expect(workbookResponse.status(), workbookResponse.status() === 200 ? undefined : workbookBytes.toString("utf8")).toBe(200);
  const workbook = archive(workbookBytes), assignmentXml = workbook.sheet("Resource Assignments");
  expect(assignmentXml).toContain(assignmentId); expect(assignmentXml).toContain(f.task.taskId); expect(assignmentXml).toContain(f.person.id);
  expect([...assignmentXml.matchAll(/<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/g)].map(match => Number(match[1]))).toEqual([oracle.expected.shared.knownMd]);
  expect([...assignmentXml.matchAll(/<c r="Z\d+"[^>]*><v>([^<]+)<\/v><\/c>/g)].map(match => Number(match[1]))).toEqual([oracle.expected.shared.plannedMm]);
  expect(workbook.sheet("Resource Target Sources")).toContain(assignmentId);
  for (const target of f.targets) expect(workbook.sheet("Resource Target Catalog")).toContain(target.id);
  expect(workbook.sheet("Resource Target Sources")).toContain(f.targets[0].members.find(member => member.code === "MCS-1")!.entityId);
  expect(await f.snapshot()).toEqual(initial);
  const evidence = { projectId: f.publicId, taskId: f.task.taskId, assignmentId, targetIds: f.targets.map(target => target.id), standardId: f.standardId, siteIds: [f.siteA, f.siteB], rawGolden: union.summary, workbook: { names: workbook.names, snapshotId: confirmedUiReport.snapshotId, filters: confirmedUiReport.filters, bytes: workbookBytes.length }, members: union.targetProjection!.relatedMembers, instance };
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  expect(await core!.evaluate(element => element.isConnected)).toBe(true);
  await info.attach("issue623-golden-identity", { contentType: "application/json", body: JSON.stringify(evidence) });
  phaseTiming.finishBody();
});

test("#623 여섯 별도 mutation·양방향 동일원본 복귀", async ({ page, isolatedApplication: origin, observeIsolatedApi, phaseTiming, timeIsolatedStage }, info) => {
  // #730 F730-010: remote #3027.1 ran for 61,586ms (20,790ms seed) before the
  // original 60s deadline; retain all six writes, exact IDs and revision +6.
  // Only this integrated scenario gets a measured finite 90s budget.
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  phaseTiming.beginBody();
  const f = await timeIsolatedStage("seed_issue_623", () => seedIssue623(page, origin, observeIsolatedApi));
  phaseTiming.mark("api/mutation-source-identity");
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const core = await frame.locator(".wx-gantt").elementHandle();
  const initial = await f.snapshot();
  const union = await f.report();
  const assignmentId = (await f.details(union)).rows[0].assignment!.assignmentId;
  phaseTiming.mark("mutation/1-wbs-name");
  const writes: { method: string; path: string; body: unknown }[] = [];
  page.on("request", request => { const path = new URL(request.url()).pathname; if (path.startsWith(`/api/projects/${f.publicId}`) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !path.endsWith("/resource-dashboard/query") && !isWbsViewReadQuery(request)) writes.push({ method: request.method(), path, body: request.postDataJSON() }); });
  const assertSaved = async (count: number) => {
    expect(writes).toHaveLength(count);
    const fresh = await readBrowserCanonicalSnapshot(page, `/api/projects/${f.publicId}`, observeIsolatedApi);
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
  phaseTiming.mark("mutation/2-target-start-date");
  await openWorkspaceView(page, "logistics");
  await openWorkspaceView(page, "targets");
  await page.getByRole("button", { name: `Target 상세: ${f.targets[0].name}`, exact: true }).click();
  const targetDetail = page.getByRole("dialog", { name: `Target 상세 · ${f.targets[0].name}`, exact: true });
  await expectRawIdentifier(targetDetail, "작업 ID", f.task.taskId);
  await targetDetail.getByRole("button", { name: /원본 작업 편집:.*SHARED · WBS 동일 원본/ }).click();
  await editor(page).getByLabel("요청 시작일", { exact: true }).fill("2026-10-06");
  await editor(page).getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect((await assertSaved(2)).start).toBe("2026-10-06");
  await expect(targetDetail).toBeVisible(); await page.keyboard.press("Escape");
  phaseTiming.mark("ui/resource-transition");
  const root = await resource(page);
  for (const [kind, value] of [["status", "in_progress"], ["progress", "35"]] as const) {
    phaseTiming.mark(`mutation/${kind === "status" ? 3 : 4}-${kind}`);
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
  phaseTiming.mark("mutation/5-assignment-allocation");
  let row = await sharedDetail(root, f.task.taskId);
  await row.getByRole("button", { name: `배정 편집: ${f.person.name}`, exact: true }).click();
  const allocation = editor(page).getByLabel(`리소스 1 ${f.person.name} 투입률 (%)`, { exact: true });
  await allocation.fill("80");
  await editor(page).getByRole("button", { name: /^할당 저장 \(/ }).click();
  await expect(allocation).toHaveValue("80");
  await editor(page).getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await assertSaved(5);
  const assigned = (await readMutationSource<AssignedTargetsResponse>(page, `/api/projects/${f.publicId}/assigned-targets`, observeIsolatedApi)).data.assignments;
  expect(assigned).toHaveLength(1); expect(assigned[0]).toMatchObject({ id: assignmentId, taskId: f.task.taskId, allocation: { percent: 80 } });
  await expect(root).toHaveAttribute("data-ready", "true");
  phaseTiming.mark("mutation/6-target-membership");
  row = await sharedDetail(root, f.task.taskId);
  await row.getByRole("button", { name: "SHARED · WBS 동일 원본", exact: true }).click();
  await editor(page).getByRole("tab", { name: /물류 연결/ }).click();
  // #726: Target bindings are an explicit compatibility disclosure.
  if (!(await editor(page).locator("details").filter({ has: page.getByText("Target 연결 (기존 호환)", { exact: true }) }).evaluate(element => (element as HTMLDetailsElement).open))) {
    await editor(page).getByText("Target 연결 (기존 호환)", { exact: true }).click();
  }
  const binding = editor(page).getByRole("region", { name: "작업 Target 연결", exact: true });
  await binding.getByRole("combobox", { name: `${f.targets[1].name} 구성원 선택`, exact: true }).selectOption("subset");
  await binding.getByRole("group", { name: `${f.targets[1].name} 선택 구성원`, exact: true }).getByRole("checkbox", { name: /^ACS B · 원본 / }).check();
  await binding.getByRole("button", { name: "Target 연결 저장", exact: true }).click();
  await expect(binding.getByRole("button", { name: "Target 연결 저장", exact: true })).toBeDisabled();
  await editor(page).getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await assertSaved(6);
  const newSources = (await readMutationSource<TaskTargetBindingsResponse>(page, `/api/projects/${f.publicId}/tasks/${f.task.taskId}/target-bindings`, observeIsolatedApi)).data;
  const savedBinding = newSources.bindings.find(item => item.targetId === f.targets[1].id);
  expect(savedBinding, "저장한 Target B 연결이 원본에 남아 있어야 합니다.").toBeDefined();
  if (!savedBinding) throw new Error("저장한 Target B 연결이 원본에 없습니다.");
  expect(savedBinding.memberIds).toEqual([f.targets[1].members.find(member => member.code === "ACS-B")!.id]);
  expect(newSources.effective.effectiveEquipmentIds).toEqual([f.targets[0].members.find(member => member.code === "AMR-A")!.entityId]);
  phaseTiming.mark("ui/schedule-return-and-write-contract");
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
  const evidence = { projectId: f.publicId, taskId: f.task.taskId, assignmentId, targetIds: f.targets.map(target => target.id), standardId: f.standardId, siteIds: [f.siteA, f.siteB], rawGolden: union.summary, members: union.targetProjection!.relatedMembers, writes, instance };
  await mkdir("output/playwright/issue-623", { recursive: true });
  await writeFile("output/playwright/issue-623/cumulative.json", JSON.stringify(evidence, null, 2));
  await info.attach("issue623-cumulative-identity", { contentType: "application/json", body: JSON.stringify(evidence) });
  phaseTiming.finishBody();
});

// Each width retains its tree→matrix transition and complete read-only checks,
// with a fresh canonical fixture and the original 30s budget for two layouts.
for (const width of [390, 768, 1024, 1440, 1920]) {
  test(`#623 실제 Target 다열·중첩Group ${width}px geometry·keyboard·query0·렌더관측`, async ({ page, isolatedApplication: origin, observeIsolatedApi, phaseTiming, timeIsolatedStage }, info) => {
    // #730 Release #182.2: fresh SQLite/HTTP setup plus tree/matrix nearly exhausted 30s in all five widths.
    // Bounded per-case budget; no changes to assertions, global timeout, retries, or fail-fast.
    test.setTimeout(45_000);
    phaseTiming.beginBody();
    page.setDefaultTimeout(15_000);
    const f = await timeIsolatedStage("seed_issue_623", () => seedIssue623(page, origin, observeIsolatedApi, true));
    phaseTiming.mark(`ui/${width}px-resource-transition`);
    const before = await f.snapshot();
    const frame = page.locator(".project-gantt-frame"); const instance = await frame.getAttribute("data-project-gantt-instance");
    const writes: string[] = []; page.on("request", request => { if (new URL(request.url()).pathname.startsWith(`/api/projects/${f.publicId}`) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !request.url().includes("/resource-dashboard/query") && !isWbsViewReadQuery(request)) writes.push(request.url()); });
    const start = performance.now(); const root = await resource(page); const renderMilliseconds = performance.now() - start;
    const measurements = []; await mkdir("output/playwright/issue-623", { recursive: true });
    for (const layout of ["tree", "matrix"]) {
      phaseTiming.mark(`ui/${width}px-${layout}-geometry-keyboard`);
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
      if (layout === "tree") {
        const hiddenIdentityActions = region.locator('tbody details:not([open]) button');
        expect(await hiddenIdentityActions.count()).toBeGreaterThan(0);
        await expect(hiddenIdentityActions.first()).toBeHidden();
      }
      const geometry = await region.evaluate(element => {
        const rect = (node: Element) => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width }; };
        const headers = [...element.querySelectorAll("thead tr:first-child > *")].map(rect); const cells = [...element.querySelectorAll("tbody tr:first-child > *")].map(rect);
        return { viewport: innerWidth, document: document.documentElement.scrollWidth, owner: element.clientWidth, scroll: element.scrollWidth, focused: document.activeElement === element, headers, cells, buttons: [...element.querySelectorAll("tbody button")].filter(button => button.checkVisibility() && button.getBoundingClientRect().width > 0 && button.getBoundingClientRect().height > 0).map(button => ({ ...rect(button), parent: rect(button.closest("td,th")!) })) };
      });
      expect(geometry.document).toBeLessThanOrEqual(width + 1); expect(geometry.focused).toBe(true);
      if (width === 390) expect(geometry.scroll).toBeGreaterThan(geometry.owner);
      for (let i = 0; i < geometry.headers.length; i++) { expect(Math.abs(geometry.headers[i].left - geometry.cells[i].left)).toBeLessThanOrEqual(1); expect(Math.abs(geometry.headers[i].right - geometry.cells[i].right)).toBeLessThanOrEqual(1); }
      expect(geometry.buttons.length).toBeGreaterThan(0);
      for (const button of geometry.buttons) { expect(button.left).toBeGreaterThanOrEqual(button.parent.left - 1); expect(button.right).toBeLessThanOrEqual(button.parent.right + 1); }
      measurements.push({ layout, ...geometry, keyboardMovement }); await page.screenshot({ path: `output/playwright/issue-623/${layout}-${width}.png`, fullPage: true });
    }
    expect(writes).toEqual([]); expect(await f.snapshot()).toEqual(before); await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
    const evidence = { synthetic: true, width, projectPublicId: f.publicId, targetCount: f.targets.length, taskCount: before.data.tasks.length, renderMilliseconds, measurements, writes };
    await writeFile(`output/playwright/issue-623/geometry-${width}.json`, JSON.stringify(evidence, null, 2));
    await info.attach(`issue623-ui-observations-${width}px`, { contentType: "application/json", body: JSON.stringify(evidence) });
    phaseTiming.finishBody();
  });
}
