import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import { mkdir, writeFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";
import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import { issue621ResourcePassword, seedIssue621 } from "./fixtures/issue-621-target-project";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: issue621ResourcePassword, viewport: { width: 1440, height: 900 } });

async function openResource(page: Page) {
  await openWorkspaceView(page, "resources");
  const root = page.locator('[data-resource-dashboard="true"]:visible');
  await expect(root).toHaveAttribute("data-ready", "true");
  await root.getByLabel("기간 시작", { exact: true }).fill("2026-10-14");
  await root.getByLabel("기간 종료", { exact: true }).fill("2026-10-15");
  await expect(root).toHaveAttribute("data-ready", "true");
  return root;
}
async function taskEditor(page: Page) {
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  return editor;
}
async function openAssignments(root: Locator, name?: string, ready = true) {
  await root.getByRole("button", { name: "개인", exact: true }).click();
  const region = root.getByRole("region", { name: "개인 현황", exact: true });
  await region.locator("tbody tr > th > button").filter(name ? { hasText: name } : {}).first().click();
  if (ready) await expect(root.locator(".resource-dashboard-detail").first()).toHaveAttribute("data-detail-state", "ready");
}
async function openShared(root: Locator) {
  await openAssignments(root);
  await expect(root.locator(".resource-dashboard-detail")).toHaveAttribute("data-detail-state", "ready");
  await root.locator(".resource-dashboard-detail").getByRole("button", { name: "통합 시운전", exact: true }).first().click();
}

test("#621 실제 HTTP union 총계·두 Target 공유 identity·페이지·권한/412·조회 mutation0", async ({ page, browser, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin, observeIsolatedApi);
  const before = await f.snapshot();
  const report = await f.report();
  expect(report.summary).toMatchObject({ taskCount: 2, assignmentCount: 3, effort: { knownMd: 3, unsetCount: 1, state: "partial", plannedMm: null } });
  expect(report.targetProjection!.metadata.subtotalsAdditive).toBe(false);
  for (const projectionOrder of ["target,group,resource", "resource,group,target"]) expect((await f.report({ projectionOrder })).summary).toEqual(report.summary);
  const a = await f.report({ targetIds: f.targets[0].id });
  const b = await f.report({ targetIds: f.targets[1].id });
  expect(a.summary.effort.knownMd + b.summary.effort.knownMd).toBe(6);
  expect((await f.report({ targetIds: f.targets.map(row => row.id).join(",") })).summary).toEqual(report.summary);
  const first = await f.details(report, { limit: "1" });
  const second = await f.details(report, { limit: "1", offset: "1" });
  expect(first.totalCount).toBe(3); expect(first.nextOffset).toBe(1);
  expect(second.rows[0].assignment!.assignmentId).not.toBe(first.rows[0].assignment!.assignmentId);
  expect((await f.report()).summary).toEqual(report.summary);
  const exactId = (await f.details(report)).rows.find(row => row.taskId === f.task.taskId && row.assignment?.resourceId === f.resources[0].id)!.assignment!.assignmentId;
  for (const target of f.targets) {
    const exactResponse = await page.request.post(`${f.api}/resource-dashboard/query`, { headers: { Origin: origin, "X-MasterGantt-Resource-Version": "1" }, data: {
      sourceContext: report.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [exactId] },
      filters: { from: "2026-10-14", to: "2026-10-15", mdPerMm: null, targetIds: [target.id], projectionOrder: ["resource", "target"] }, projection: { kind: "report" },
    } });
    expect(exactResponse.status(), await exactResponse.text()).toBe(200);
    const exactReport = (await exactResponse.json()).data as ResourceDashboardDto;
    expect(exactReport.summary).toMatchObject({ assignmentCount: 1, resourceCount: 1, taskCount: 1, effort: { knownMd: 2 } });
    const exactTarget = exactReport.targetProjection!.children[0].children.find(node => node.id === target.id)!;
    const exactDetail = await page.request.post(`${f.api}/resource-dashboard/query`, { headers: { Origin: origin, "X-MasterGantt-Resource-Version": "1" }, data: {
      sourceContext: report.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [exactId] },
      filters: { from: "2026-10-14", to: "2026-10-15", mdPerMm: null, targetIds: [target.id], projectionOrder: ["resource", "target"] },
      projection: { kind: "details", snapshotId: exactReport.snapshotId, selector: exactTarget.summary.selector, view: "assignments", offset: 0, limit: 50 },
    } });
    expect(exactDetail.status(), await exactDetail.text()).toBe(200);
    const exactRows = (await exactDetail.json()).data;
    expect(exactRows.totalCount).toBe(1);
    expect(exactRows.rows[0].assignment.assignmentId).toBe(exactId);
  }
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const response = await readonly.request.patch(`${f.api}/tasks/${f.task.taskId}`, { headers: { Origin: origin, "If-Match": `"${before.data.project.revision}"` }, data: { name: "Denied" } });
    expect(response.status()).toBe(401);
    const wrongScope = await page.request.patch(`${f.api}/tasks/${f.targets[0].id}`, { headers: { Origin: origin, "If-Match": `"${before.data.project.revision}"` }, data: { name: "Virtual target must not become task" } });
    expect(wrongScope.status()).toBe(404);
    const stale = await page.request.patch(`${f.api}/tasks/${f.task.taskId}`, { headers: { Origin: origin, "If-Match": '"1"' }, data: { name: "Stale" } });
    expect(stale.status()).toBe(412);
    expect(await f.snapshot()).toEqual(before);
    const publicPage = await readonly.newPage();
    await publicPage.goto(`/projects/${f.publicId}`);
    const root = await openResource(publicPage);
    await openShared(root);
    const editor = await taskEditor(publicPage);
    await expect(editor.getByLabel("작업명", { exact: true })).toHaveJSProperty("readOnly", true);
    await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
    expect(await f.snapshot()).toEqual(before);
  } finally { await readonly.close(); }
  await info.attach("issue621-http-union", { contentType: "application/json", body: JSON.stringify({ summary: report.summary, a: a.summary, b: b.summary, taskId: f.task.taskId, assignmentIds: [first, second].map(detail => detail.rows[0].assignment!.assignmentId) }) });
});

test("#621 Resource 동일 Task 저장1·복제0·WBS/Target A/B 역방향 갱신·dirty/pending", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin, observeIsolatedApi);
  const before = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const writes: { method: string; path: string }[] = [];
  page.on("request", request => { const path = new URL(request.url()).pathname; if (path.startsWith(`/api/projects/${f.publicId}`) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !path.endsWith("/resource-dashboard/query") && !isWbsViewReadQuery(request)) writes.push({ method: request.method(), path }); });
  const root = await openResource(page);
  await openShared(root);
  const editor = await taskEditor(page);
  await editor.getByLabel("작업명", { exact: true }).fill("Resource에서 수정한 같은 원본");
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Resource에서 수정한 같은 원본");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/projects/${f.publicId}/tasks/${f.task.taskId}`, async route => { if (route.request().method() === "PATCH") await gate; await route.continue(); });
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("작업명", { exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  release();
  await expect(editor).toHaveCount(0);
  await page.unroute(`**/api/projects/${f.publicId}/tasks/${f.task.taskId}`);
  const changed = await f.snapshot();
  expect(changed.data.tasks).toHaveLength(before.data.tasks.length);
  expect(changed.data.tasks.find(task => task.taskId === f.task.taskId)!.name).toBe("Resource에서 수정한 같은 원본");
  for (const target of f.targets) {
    const report = await f.report({ targetIds: target.id });
    const detail = await f.details(report, { targetIds: target.id });
    expect(detail.rows.filter(row => row.taskId === f.task.taskId).map(row => row.taskName)).toEqual(["Resource에서 수정한 같은 원본", "Resource에서 수정한 같은 원본"]);
  }
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first()).toContainText("Resource에서 수정한 같은 원본");
  await frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first().click({ button: "right" });
  await chooseTaskInformation(page);
  await editor.getByLabel("작업명", { exact: true }).fill("WBS에서 갱신한 같은 원본");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await openResource(page);
  await root.locator(".resource-dashboard-kpis > div").filter({ hasText: /^할당 Task/ }).getByRole("button").click();
  const selectedDetail = root.getByRole("region", { name: "선택 범위 할당 Task", exact: true }).locator(".resource-dashboard-detail");
  await expect(selectedDetail).toHaveAttribute("data-detail-state", "ready");
  await expect(selectedDetail).toContainText("WBS에서 갱신한 같은 원본");
  await expect(selectedDetail.locator(`[data-canonical-task-id="${f.task.taskId}"]`).getByRole("button", { name: "WBS에서 갱신한 같은 원본", exact: true })).toBeVisible();
  expect((await f.snapshot()).data.tasks).toHaveLength(before.data.tasks.length);
  await info.attach("issue621-canonical-identity", { contentType: "application/json", body: JSON.stringify({ taskId: f.task.taskId, resourceUiWrites: writes, taskCount: changed.data.tasks.length, instance }) });
});

test("#621 실물 필터·고유 총계·5폭 내부 scroll·native keyboard·조회 mutation0·remount0", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin, observeIsolatedApi, true);
  const before = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const core = await frame.locator(".wx-gantt").elementHandle();
  const writes: string[] = [], retiredRequests: string[] = [];
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (/\/(logistics\/targets|target-bindings)(?:\/|$)/.test(path)) retiredRequests.push(path);
    if (path.startsWith(`/api/projects/${f.publicId}`) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !path.endsWith("/resource-dashboard/query") && !isWbsViewReadQuery(request)) writes.push(path);
  });
  const root = await openResource(page);
  await expect(page.getByRole("group", {name:"리소스 분석 보기",exact:true}).getByRole("button", {name:/Logistics Target|Target 분석/})).toHaveCount(0);
  const systemId = f.targets[0].members[0].entityId;
  await root.getByLabel("물류 시스템", { exact: true }).selectOption(systemId);
  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root.getByLabel("선택 범위 KPI", { exact: true })).toContainText("3.00");
  await openAssignments(root, f.resources[0].name);
  const row = root.locator(`[data-canonical-task-id="${f.task.taskId}"]`).first();
  await expect(row).toBeVisible();
  await row.getByText(/실물 연결·출처/).click();
  await expect(row).not.toContainText(f.targets[0].name);
  await expect(row).toContainText("물류 시스템");
  const geometry = [];
  for (const width of [390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:1000});
    const region = root.getByRole("region", { name: "개인 현황", exact: true });
    await region.focus(); await page.keyboard.press("ArrowRight");
    const observation = await region.evaluate(owner=>({width:innerWidth,document:document.documentElement.scrollWidth,client:owner.clientWidth,scroll:owner.scrollWidth,focused:document.activeElement===owner}));
    expect(observation.document).toBeLessThanOrEqual(width+1); expect(observation.focused).toBe(true);
    if(width===390) expect(observation.scroll).toBeGreaterThan(observation.client);
    geometry.push(observation);
  }
  expect(retiredRequests).toEqual([]); expect(writes).toEqual([]); expect(await f.snapshot()).toEqual(before);
  await expect(frame).toHaveAttribute("data-project-gantt-instance",instance!); expect(await core!.evaluate(element=>element.isConnected)).toBe(true);
  await mkdir("output/playwright/issue-621",{recursive:true});
  await writeFile("output/playwright/issue-621/physical-geometry.json",JSON.stringify({geometry,writes,retiredRequests}));
  await info.attach("issue621-physical-observations",{contentType:"application/json",body:JSON.stringify({geometry,systemId,writes,retiredRequests})});
});

test("#621 Target exact Assignment 개인 수정·공동담당 불변·412/401 초안 보존", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin, observeIsolatedApi);
  // A hidden co-assignee with unset allocation must not block this exact personal edit.
  const catalog = (await (await page.request.get(`${origin}/api/resources`)).json()).data;
  await f.mutate(`/tasks/${f.task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [
    { kind: "resource", id: f.resources[0].id, allocation: { start: null, end: null, percent: 100 } },
    { kind: "resource", id: f.resources[1].id },
  ] }, "put");
  await page.reload();
  const canonical = await f.snapshot();
  const before = (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data;
  const alice = before.assignments.find((row: { taskId: string; target: { id: string } }) => row.taskId === f.task.taskId && row.target.id === f.resources[0].id);
  const bob = before.assignments.find((row: { taskId: string; target: { id: string } }) => row.taskId === f.task.taskId && row.target.id === f.resources[1].id);
  const root = await openResource(page);
  await openAssignments(root, f.resources[0].name);
  const detail = root.locator(".resource-dashboard-detail");
  const row = detail.locator(`[data-canonical-task-id="${f.task.taskId}"][data-canonical-assignment-id="${alice.id}"]`);
  await expect(row).toBeVisible();
  const edit = row.getByRole("button", { name: `배정 편집: ${f.resources[0].name}`, exact: true });
  // Exact edits must not scan the full candidate catalog, but must reauthenticate.
  let candidateLookups = 0, sessionLookups = 0;
  await page.route(`**/api/projects/${f.publicId}/assignment-targets`, route => {
    candidateLookups++;
    return route.continue();
  });
  await page.route(`**/api/projects/${f.publicId}/edit-sessions/current`, route => {
    sessionLookups++;
    return route.continue();
  });
  await edit.focus(); await page.keyboard.press("Enter");
  const editor = await taskEditor(page);
  await expect(editor.getByRole("tab", { name: /^리소스/ })).toHaveAttribute("aria-selected", "true");
  // Wait for the real assignment snapshot (two reads and revision checks),
  // not merely the modal opening. Keep the exact 100%/co-assignee/401/412 checks.
  await expect(editor.getByRole("button", { name: /^할당 저장 \(/ })).toBeEnabled({ timeout: 30_000 });
  const allocation = editor.getByLabel(`리소스 1 ${f.resources[0].name} 투입률 (%)`, { exact: true });
  await expect(allocation).toHaveValue("100");
  expect(candidateLookups).toBe(0);
  expect(sessionLookups).toBeGreaterThanOrEqual(1);
  await expect(editor.getByLabel(`리소스 2 ${f.resources[1].name} 투입률 (%)`, { exact: true })).toHaveCount(0);
  await allocation.fill("80");
  await editor.getByLabel(`리소스 1 ${f.resources[0].name} 투입 시작`, { exact: true }).fill("2026-10-14");
  await editor.getByLabel(`리소스 1 ${f.resources[0].name} 투입 종료`, { exact: true }).fill("2026-10-14");
  let failure: 401 | 412 | null = 412;
  let requests = 0;
  await page.route(`**/api/projects/${f.publicId}/tasks/${f.task.taskId}/assignments`, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    requests += 1;
    if (failure) return route.fulfill({ status: failure, contentType: "application/json", body: JSON.stringify({ error: { code: failure === 412 ? "REVISION_CONFLICT" : "UNAUTHORIZED" } }) });
    await route.continue();
  });
  const save = editor.getByRole("button", { name: /^할당 저장 \(/ });
  await save.click();
  await expect(editor).toContainText("최신 정보를 다시 불러와 주세요");
  await expect(allocation).toHaveValue("80");
  expect((await f.snapshot()).data.project.revision).toBe(canonical.data.project.revision);
  failure = null;
  await save.click();
  await expect.poll(async () => (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data.assignments.find((entry: { id: string }) => entry.id === alice.id)?.allocation.percent).toBe(80);
  const after = (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data;
  expect(after.assignments.find((entry: { id: string }) => entry.id === bob.id)).toEqual(bob);
  expect(after.assignments.find((entry: { id: string }) => entry.id === alice.id)).toMatchObject({ taskId: f.task.taskId, allocation: { start: "2026-10-14", end: "2026-10-14", percent: 80 } });
  expect((await f.snapshot()).data.tasks).toHaveLength(canonical.data.tasks.length);
  await expect(allocation).toHaveValue("80");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(edit).toBeFocused();
  await edit.click();
  await expect(editor.getByRole("tab", { name: /^리소스/ })).toHaveAttribute("aria-selected", "true");
  await expect(editor.getByRole("button", { name: /^할당 저장 \(/ })).toBeEnabled({ timeout: 30_000 });
  await expect(allocation).toHaveValue("80");
  await allocation.fill("70");
  failure = 401;
  await save.click();
  await expect(editor).toContainText("편집 권한이 없습니다");
  await expect(editor).toContainText("리소스 초안은 유지됩니다");
  await expect(allocation).toHaveValue("70");
  expect((await (await page.request.get(`${f.api}/assigned-targets`)).json()).data.assignments.find((entry: { id: string }) => entry.id === alice.id).allocation.percent).toBe(80);
  expect(requests).toBe(3);
  await info.attach("issue621-exact-assignment", { contentType: "application/json", body: JSON.stringify({ assignmentId: alice.id, resourceId: f.resources[0].id, unchangedAssignmentId: bob.id, requests, successfulWrites: 1, taskId: f.task.taskId }) });
});


test("#736 exact Assignment 편집은 만료된 Project edit session에서 초안을 열지 않는다", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const f = await seedIssue621(page, origin, observeIsolatedApi);
  const root = await openResource(page);
  const canonical = await f.snapshot();
  const assigned = (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data;
  const exact = assigned.assignments.find((item: { taskId: string; target: { id: string } }) =>
    item.taskId === f.task.taskId && item.target.id === f.resources[0].id);
  expect(exact?.id).toBeTruthy();
  await openAssignments(root, f.resources[0].name);
  const row = root.locator(".resource-dashboard-detail")
    .locator(`[data-canonical-task-id="${f.task.taskId}"][data-canonical-assignment-id="${exact.id}"]`);
  await expect(row).toBeVisible();
  let checked = 0;
  // The workspace was editable when loaded, but its authoritative edit session
  // is now revoked. A public assigned-targets read alone must not authorize drafts.
  await page.route(`**/api/projects/${f.publicId}/edit-sessions/current`, route => {
    checked++;
    return route.fulfill({ status: 200, json: { data: { permission: "readonly" } } });
  });
  await row.getByRole("button", { name: `배정 편집: ${f.resources[0].name}`, exact: true }).click();
  const editor = await taskEditor(page);
  await expect(editor.getByLabel(`리소스 1 ${f.resources[0].name} 투입률 (%)`, { exact: true })).toBeDisabled({ timeout: 30_000 });
  await expect(editor.getByRole("button", { name: /^할당 저장 \(/ })).toHaveCount(0);
  expect(checked).toBeGreaterThanOrEqual(1);
  expect(await f.snapshot()).toEqual(canonical);
});

test("#621 실물 필터 응답역전·실제409 stale·취소 scope/focus", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(180_000); page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin, observeIsolatedApi);
  const root = await openResource(page);
  const a=f.targets[0].members[0].entityId,b=f.targets[1].members[0].entityId;
  let release!:()=>void, started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),requested=new Promise<void>(resolve=>{started=resolve;});
  await page.route(`**/api/projects/${f.publicId}/resource-dashboard?**`,async route=>{
    if(new URL(route.request().url()).searchParams.get("systemIds")!==a)return route.continue();
    const response=await route.fetch();started();await gate;await route.fulfill({response}).catch(()=>undefined);
  });
  await root.getByLabel("물류 시스템",{exact:true}).selectOption(a); await requested;
  await root.getByLabel("물류 시스템",{exact:true}).selectOption(b); await expect(root).toHaveAttribute("data-ready","true");
  release(); await page.unroute(`**/api/projects/${f.publicId}/resource-dashboard?**`);
  await expect(root.getByLabel("물류 시스템",{exact:true})).toHaveValue(b);
  await expect(root.getByLabel("선택 범위 KPI",{exact:true})).toContainText("3.00");
  await f.mutate(`/tasks/${f.task.taskId}`,{name:"외부 변경으로 보고서 stale"},"patch");
  await openAssignments(root,f.resources[0].name,false);
  const detail=root.locator(".resource-dashboard-detail");
  await expect(detail).toHaveAttribute("data-detail-state","stale");
  await expect(detail.getByRole("button",{name:"전체 범위 일정 보기",exact:true})).toBeDisabled();
  await root.getByRole("button",{name:"새로고침",exact:true}).click();
  await root.getByRole("button",{name:"최신 일정 조회",exact:true}).click();
  await expect(root).toHaveAttribute("data-ready","true");
  const person=root.getByRole("region",{name:"개인 현황",exact:true}).locator("tbody tr > th > button").filter({hasText:f.resources[0].name}).first();
  if(await person.getAttribute("aria-expanded")==="false")await person.click();
  await expect(detail).toHaveAttribute("data-detail-state","ready");
  const trigger=detail.getByRole("button",{name:"외부 변경으로 보고서 stale",exact:true});
  await trigger.click();const editor=await taskEditor(page);
  await editor.getByLabel("작업명",{exact:true}).fill("버릴 초안");await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"변경사항 버리고 닫기",exact:true}).click();
  await expect(editor).toHaveCount(0);await expect(trigger).toBeFocused();
  expect((await f.snapshot()).data.tasks.find(row=>row.taskId===f.task.taskId)!.name).toBe("외부 변경으로 보고서 stale");
  await expect(root.getByLabel("물류 시스템",{exact:true})).toHaveValue(b);
});
