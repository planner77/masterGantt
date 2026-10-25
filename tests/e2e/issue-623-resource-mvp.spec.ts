import { selectResourceReportView } from "./helpers/resource-workspace";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { ISSUE_623_TARGET_RESOURCE as oracle } from "../fixtures/issue-623-target-resource";
import { inflateRawSync } from "node:zlib";
import type { AssignedTargetsResponse } from "../../src/contracts/resources";
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
type PhaseTiming = { beginBody: (phase?: string) => void; mark: (name: string) => void; finishBody: () => void };
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
        beginBody: (initialPhase = "fixture/seed-http") => { bodyStarted = performance.now(); mark(initialPhase); },
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
  if (!new RegExp(`^/api/projects/${uuid}/(?:assigned-targets|tasks/${uuid}/logistics-links)$`, "i").test(path))
    throw new Error("저장 후 조회에는 같은 origin의 배정/실물 연결 원본 경로가 필요합니다.");
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
  await selectResourceReportView(root, "summary");
  await expect(root).toHaveAttribute("data-ready", "true"); return root;
}
async function sharedDetail(root: Locator, taskId: string) {
  await root.getByRole("button", { name: "개인", exact: true }).click();
  const person = root.getByRole("region", { name: "개인 현황", exact: true }).locator("tbody tr > th > button").first();
  if(await person.getAttribute("aria-expanded") === "false") await person.click();
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
  const acs = (await (await page.request.get(`${f.api}/tasks/${f.acsTask.taskId}/logistics-links`)).json()).data.links;
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
  await expect(goldenRoot.getByLabel("선택 범위 KPI", { exact: true })).toContainText("5.00 M/D");
  await goldenRoot.getByRole("button", { name: "M/M", exact: true }).click();
  await expect(goldenRoot.getByLabel("선택 범위 KPI", { exact: true })).toContainText("0.25 M/M");
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
  expect(workbook.sheet("Resource Entity Sources")).toContain(assignmentId);
  for (const target of f.targets) for (const member of target.members) expect(workbook.sheet("Resource Entity Catalog")).toContain(member.entityId);
  expect(workbook.names.some(name=>/Target/.test(name))).toBe(false);
  expect(workbook.sheet("Resource Entity Sources")).toContain(f.targets[0].members.find(member => member.code === "MCS-1")!.entityId);
  expect(await f.snapshot()).toEqual(initial);
  const evidence = { projectId: f.publicId, taskId: f.task.taskId, assignmentId, targetIds: f.targets.map(target => target.id), standardId: f.standardId, siteIds: [f.siteA, f.siteB], rawGolden: union.summary, workbook: { names: workbook.names, snapshotId: confirmedUiReport.snapshotId, filters: confirmedUiReport.filters, bytes: workbookBytes.length }, members: union.targetProjection!.relatedMembers, instance };
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  expect(await core!.evaluate(element => element.isConnected)).toBe(true);
  await info.attach("issue623-golden-identity", { contentType: "application/json", body: JSON.stringify(evidence) });
  phaseTiming.finishBody();
});

// 새 상세 조회의 준비 완료를 확인한 뒤 기존 선택을 재사용한다.
// 저장마다 locator가 현재 DOM 행을 다시 찾아 이전 요소 참조를 사용하지 않는다.
async function mutationDetail(root: Locator, taskId: string, canonicalRow?: Locator) {
  if (!canonicalRow) return sharedDetail(root, taskId);
  await expect(root.locator(".resource-dashboard-detail")).toHaveAttribute("data-detail-state", "ready");
  return canonicalRow;
}

type Issue623Fixture = Awaited<ReturnType<typeof seedIssue623>>;
async function mutationSession(page: Page, f: Issue623Fixture, observeIsolatedApi: ObserveIsolatedApi) {
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const core = await frame.locator(".wx-gantt").elementHandle();
  const initial = await f.snapshot();
  const union = await f.report();
  const assignmentId = (await f.details(union)).rows[0].assignment!.assignmentId;
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
  return { frame, instance, initial, union, assignmentId, writes, assertSaved };
}
type MutationSession = Awaited<ReturnType<typeof mutationSession>>;
async function renameFromWbs(page: Page, f: Issue623Fixture, session: MutationSession, offset = 0) {
  const { frame, assertSaved } = session;
  // WBS origin: one name PATCH; opening/closing the Target detail is query-only.
  await frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first().click({ button: "right" });
  await chooseTaskInformation(page);
  await editor(page).getByLabel("작업명", { exact: true }).fill("SHARED · WBS 동일 원본");
  await editor(page).getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect((await assertSaved(offset + 1)).name).toBe("SHARED · WBS 동일 원본");
}
async function changeStartFromTarget(page: Page, f: Issue623Fixture, session: MutationSession, taskName: string, offset = 0) {
  const root=await resource(page), row=await sharedDetail(root,f.task.taskId);
  await row.getByRole("button",{name:taskName,exact:true}).click();
  await editor(page).getByLabel("요청 시작일", { exact: true }).fill("2026-10-06");
  await editor(page).getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect((await session.assertSaved(offset + 1)).start).toBe("2026-10-06");
}
async function changeResourceStatusProgress(page: Page, f: Issue623Fixture, session: MutationSession, root: Locator, taskName: string, phaseTiming: PhaseTiming, offset = 0, canonicalRow?: Locator) {
  const { assertSaved } = session;
  for (const [kind, value] of [["status", "in_progress"], ["progress", "35"]] as const) {
    phaseTiming.mark(`mutation/${kind === "status" ? 3 : 4}-${kind}`);
    const row = await mutationDetail(root, f.task.taskId, canonicalRow);
    await row.getByRole("button", { name: taskName, exact: true }).click();
    if (kind === "status") await editor(page).getByLabel("상태", { exact: true }).selectOption(value);
    else await editor(page).getByLabel("진행률 (%)", { exact: true }).fill(value);
    await editor(page).getByRole("button", { name: "저장", exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    const task = await assertSaved(offset + (kind === "status" ? 1 : 2));
    expect(kind === "status" ? task.status : task.progress).toBe(kind === "status" ? "in_progress" : 35);
    await expect(root).toHaveAttribute("data-ready", "true");
  }
}

async function changeAssignmentAllocation(page: Page, f: Issue623Fixture, session: MutationSession, root: Locator, observeIsolatedApi: ObserveIsolatedApi, phaseTiming: PhaseTiming, offset = 0, canonicalRow?: Locator) {
  const { assertSaved, assignmentId } = session;
  phaseTiming.mark("mutation/assignment-edit-ready");
  const row = await mutationDetail(root, f.task.taskId, canonicalRow);
  await row.getByRole("button", { name: `배정 편집: ${f.person.name}`, exact: true }).click();
  const taskEditor = editor(page);
  await expect(taskEditor).toBeVisible();
  await expect(taskEditor.getByRole("tab", { name: /^리소스/ })).toHaveAttribute("aria-selected", "true");
  // 원본 배정과 후보 조회를 마친 준비 상태를 검사하며 기본 테스트 예산은 늘리지 않는다.
  await expect(taskEditor.getByRole("button", { name: /^할당 저장 \(/ })).toBeEnabled({ timeout: 30_000 });
  phaseTiming.mark("mutation/assignment-input-and-save");
  const allocation = taskEditor.getByLabel(`리소스 1 ${f.person.name} 투입률 (%)`, { exact: true });
  await allocation.fill("80");
  await editor(page).getByRole("button", { name: /^할당 저장 \(/ }).click();
  await expect(allocation).toHaveValue("80");
  await editor(page).getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await assertSaved(offset + 1);
  phaseTiming.mark("api/assigned-targets-source");
  const assigned = (await readMutationSource<AssignedTargetsResponse>(page, `/api/projects/${f.publicId}/assigned-targets`, observeIsolatedApi)).data.assignments;
  expect(assigned).toHaveLength(1); expect(assigned[0]).toMatchObject({ id: assignmentId, taskId: f.task.taskId, allocation: { percent: 80 } });
  await expect(root).toHaveAttribute("data-ready", "true");
}

async function changeResourceAndAssignment(page: Page, f: Issue623Fixture, session: MutationSession, root: Locator, taskName: string, observeIsolatedApi: ObserveIsolatedApi, phaseTiming: PhaseTiming, offset = 0, canonicalRow?: Locator) {
  await changeResourceStatusProgress(page, f, session, root, taskName, phaseTiming, offset, canonicalRow);
  await changeAssignmentAllocation(page, f, session, root, observeIsolatedApi, phaseTiming, offset + 2, canonicalRow);
}

async function changeTargetBinding(page: Page, f: Issue623Fixture, session: MutationSession, root: Locator, taskName: string, observeIsolatedApi: ObserveIsolatedApi, phaseTiming: PhaseTiming, offset = 0, canonicalRow?: Locator) {
  phaseTiming.mark("ui/direct-logistics-save");
  const original=(await (await page.request.get(`${f.api}/tasks/${f.task.taskId}/logistics-links`)).json()).data.links;
  const row=await mutationDetail(root,f.task.taskId,canonicalRow);
  await row.getByRole("button",{name:taskName,exact:true}).click();
  await editor(page).getByRole("tab",{name:/물류 연결/}).click();
  const physical=editor(page).getByRole("region",{name:"기존 연결 출처",exact:true});
  await expect(physical).toBeVisible();await expect(physical).not.toContainText(f.targets[1].name);
  await editor(page).getByRole("checkbox",{name:/^AMR B/}).check();
  const savePath = new URL(`${f.api}/tasks/${f.task.taskId}/logistics-links`).pathname;
  const savePattern = `**${savePath}`;
  let releaseSave!: () => void, markStarted!: () => void;
  const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
  const requestStarted = new Promise<void>(resolve => { markStarted = resolve; });
  const holdSave = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "PUT") return route.continue();
    markStarted();
    await saveGate;
    await route.continue();
  };
  await page.route(savePattern, holdSave);
  const savedResponse = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).pathname === savePath)
    .then(response => ({ response }), error => ({ error }));
  try {
    await editor(page).getByRole("button", { name: "물류 연결 저장", exact: true }).click();
    await requestStarted;
    await expect(editor(page).getByRole("button", { name: /^물류 연결 저장/ })).toBeDisabled();
    releaseSave();
    const result = await savedResponse;
    if ("error" in result) throw result.error;
    expect(result.response.status(), await result.response.text()).toBe(200);
    await expect(editor(page).getByRole("button", { name: "물류 연결 저장", exact: true })).toBeEnabled();
  } finally {
    releaseSave();
    await page.unroute(savePattern, holdSave);
  }
  await editor(page).getByRole("button",{name:"작업 편집기 닫기",exact:true}).click();
  await session.assertSaved(offset+1);
  const source=(await readMutationSource<{data:{links:typeof original}}>(page,`/api/projects/${f.publicId}/tasks/${f.task.taskId}/logistics-links`,observeIsolatedApi)).data.links;
  expect(source.compatibilityLinks).toEqual(original.compatibilityLinks);
  expect(source.directEquipmentLinks.map((link:{equipmentId:string})=>link.equipmentId)).toContain(f.targets[1].members.find(member=>member.code==="AMR-B")!.entityId);
  expect(source.effectiveEquipmentIds).toEqual(original.effectiveEquipmentIds);
}
async function returnToSchedule(page: Page, f: Issue623Fixture, session: MutationSession, taskName: string, count: number) {
  const { frame, assertSaved } = session;
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first()).toContainText(taskName);
  await assertSaved(count);
}

// focused 케이스마다 새로운 SQLite/HTTP 원본과 쓰기 관찰기를 먼저 준비한다.
// 실패하는 Seed도 별도 Fixture에서 FAIL 처리한다. Mutation 본문은 기존 30초 제한이다.
const focusedTest = test.extend<{ focusedAcceptance: { f: Issue623Fixture; session: MutationSession } }>({
  focusedAcceptance: [async ({ page, isolatedApplication: origin, observeIsolatedApi, timeIsolatedStage }, provide) => {
    page.setDefaultTimeout(15_000);
    const f = await timeIsolatedStage("seed_issue_623", () => seedIssue623(page, origin, observeIsolatedApi));
    const session = await mutationSession(page, f, observeIsolatedApi);
    await provide({ f, session });
  }, { scope: "test", timeout: 120_000 }],
});

// 공통 조작 함수와 원본 Assertion을 그대로 사용하며 기존 종단 Smoke를 유지한다.
for (const boundary of ["WBS 변경", "Resource status/progress", "Assignment allocation", "실물 직접 연결", "화면 복귀"] as const) {
  focusedTest(`#623 독립 ${boundary}·원시 ID·mutation 경계`, async ({ page, observeIsolatedApi, phaseTiming, focusedAcceptance }, info) => {
    phaseTiming.beginBody("focused/initial-identity");
    const { f, session } = focusedAcceptance;
    phaseTiming.mark(`focused/${boundary}`);
    const originalName = "SHARED · 통합 시운전";
    let count = 0;
    if (boundary === "WBS 변경") {
      phaseTiming.mark("mutation/1-wbs-name");
      await renameFromWbs(page, f, session);
      phaseTiming.mark("mutation/2-target-start-date");
      await changeStartFromTarget(page, f, session, "SHARED · WBS 동일 원본", 1);
      count = 2;
      await returnToSchedule(page, f, session, "SHARED · WBS 동일 원본", count);
    } else if (boundary === "Resource status/progress") {
      await changeResourceStatusProgress(page, f, session, await resource(page), originalName, phaseTiming);
      count = 2;
      await returnToSchedule(page, f, session, originalName, count);
    } else if (boundary === "Assignment allocation") {
      await changeAssignmentAllocation(page, f, session, await resource(page), observeIsolatedApi, phaseTiming);
      count = 1;
      await returnToSchedule(page, f, session, originalName, count);
    } else if (boundary === "실물 직접 연결") {
      await changeTargetBinding(page, f, session, await resource(page), originalName, observeIsolatedApi, phaseTiming);
      count = 1;
      await returnToSchedule(page, f, session, originalName, count);
    } else {
      await openWorkspaceView(page, "unified");
      await expect(page.getByTestId("process-workarea-summary")).toBeVisible();
      const row = await sharedDetail(await resource(page), f.task.taskId);
      await expect(row).toHaveAttribute("data-canonical-assignment-id", session.assignmentId);
      await returnToSchedule(page, f, session, originalName, count);
      expect(await f.snapshot()).toEqual(session.initial);
    }
    expect(session.writes).toHaveLength(count);
    await info.attach("issue623-focused-identity", { contentType: "application/json", body: JSON.stringify({ boundary, taskId: f.task.taskId, assignmentId: session.assignmentId, initialRevision: session.initial.data.project.revision, revisionDelta: count, writes: session.writes, instance: session.instance }) });
    phaseTiming.finishBody();
  });
}

test("#623 여섯 별도 mutation·양방향 동일원본 복귀", async ({ page, isolatedApplication: origin, observeIsolatedApi, phaseTiming, timeIsolatedStage }, info) => {
  // 실측에 따른 기존 90초 상한을 유지한다. 반복 Dashboard 진입은 집중 테스트에서
  // 확인하고, 이 smoke는 WBS·Target·Resource를 잇는 여섯 UI 저장과 복귀를 보존한다.
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  phaseTiming.beginBody();
  const f = await timeIsolatedStage("seed_issue_623", () => seedIssue623(page, origin, observeIsolatedApi));
  phaseTiming.mark("api/mutation-source-identity");
  const session = await mutationSession(page, f, observeIsolatedApi);
  const { assignmentId, writes, union, instance } = session;
  phaseTiming.mark("mutation/1-wbs-name");
  await renameFromWbs(page, f, session);
  phaseTiming.mark("mutation/2-target-start-date");
  const taskName = "SHARED · WBS 동일 원본";
  await changeStartFromTarget(page, f, session, taskName, 1);
  phaseTiming.mark("ui/resource-transition");
  const root = await resource(page);
  const canonicalRow = await sharedDetail(root, f.task.taskId);
  await expect(canonicalRow).toHaveAttribute("data-canonical-assignment-id", assignmentId);
  await changeResourceAndAssignment(page, f, session, root, taskName, observeIsolatedApi, phaseTiming, 2, canonicalRow);
  phaseTiming.mark("mutation/6-target-membership");
  await changeTargetBinding(page, f, session, root, taskName, observeIsolatedApi, phaseTiming, 5, canonicalRow);
  phaseTiming.mark("ui/schedule-return-and-write-contract");
  await returnToSchedule(page, f, session, taskName, 6);
  const taskPath = `/api/projects/${f.publicId}/tasks/${f.task.taskId}`;
  expect(writes.slice(0, 4).map(write => [write.method, write.path])).toEqual(Array.from({ length: 4 }, () => ["PATCH", taskPath]));
  expect(writes[0].body).toMatchObject({ name: "SHARED · WBS 동일 원본" });
  expect(writes[1].body).toMatchObject({ start: "2026-10-06" });
  expect(writes[2].body).toMatchObject({ status: "in_progress" });
  expect(writes[3].body).toMatchObject({ progress: 35 });
  expect(writes[4]).toMatchObject({ method: "PUT", path: `${taskPath}/assignments`, body: { editAssignmentId: assignmentId } });
  expect(writes[5]).toMatchObject({ method: "PUT", path: `${taskPath}/logistics-links` });
  const evidence = { projectId: f.publicId, taskId: f.task.taskId, assignmentId, targetIds: f.targets.map(target => target.id), standardId: f.standardId, siteIds: [f.siteA, f.siteB], rawGolden: union.summary, members: union.targetProjection!.relatedMembers, writes, instance };
  await mkdir("output/playwright/issue-750", { recursive: true });
  await writeFile("output/playwright/issue-750/cumulative.json", JSON.stringify(evidence, null, 2));
  await info.attach("issue623-cumulative-identity", { contentType: "application/json", body: JSON.stringify(evidence) });
  phaseTiming.finishBody();
});

// 각 폭은 새 canonical fixture와 기존 실측 45초 예산에서 두 레이아웃을 확인하며,
// tree→matrix 전환과 모든 읽기 전용 단언을 유지한다.
for (const width of [390, 768, 1024, 1440, 1920]) {
  test(`#623 실제 실물 연결·중첩Group ${width}px geometry·keyboard·query0·렌더관측`, async ({ page, isolatedApplication: origin, observeIsolatedApi, phaseTiming, timeIsolatedStage }, info) => {
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
    const measurements = []; await mkdir("output/playwright/issue-750", { recursive: true });
    for (const layout of ["group", "resource"]) {
      phaseTiming.mark(`ui/${width}px-${layout}-geometry-keyboard`);
      await page.setViewportSize({ width, height: 1000 });
      await root.getByRole("button", { name: layout === "group" ? "그룹" : "개인", exact: true }).click();
      await expect(root).toHaveAttribute("data-ready", "true");
      const region = root.getByRole("region", { name: layout === "group" ? "그룹 현황" : "개인 현황", exact: true });
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
      if (layout === "group") {
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
      measurements.push({ layout, ...geometry, keyboardMovement }); await page.screenshot({ path: `output/playwright/issue-750/${layout}-${width}.png`, fullPage: true });
    }
    expect(writes).toEqual([]); expect(await f.snapshot()).toEqual(before); await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
    const evidence = { synthetic: true, width, projectPublicId: f.publicId, targetCount: f.targets.length, taskCount: before.data.tasks.length, renderMilliseconds, measurements, writes };
    await writeFile(`output/playwright/issue-750/geometry-${width}.json`, JSON.stringify(evidence, null, 2));
    await info.attach(`issue623-ui-observations-${width}px`, { contentType: "application/json", body: JSON.stringify(evidence) });
    phaseTiming.finishBody();
  });
}
