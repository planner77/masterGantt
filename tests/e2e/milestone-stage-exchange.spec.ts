import { inflateRawSync } from "node:zlib";
import type { Page, Download } from "@playwright/test";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ImportPayload11 } from "../../src/contracts/import";
import type { ProjectImportPreviewResponse } from "../../src/contracts/project-import";
import type { ProjectSnapshotResponse, ProjectTaskDto, TaskMutationResponse, CopyProjectResponse } from "../../src/contracts/projects";
import type { MilestoneDashboardResponse } from "../../src/contracts/milestone-dashboard";
import type { InstantiateProjectTemplateResponse, ProjectTemplateDetailResponse } from "../../src/contracts/project-templates";
import { chooseTaskInformation } from "./helpers/task-context-menu";

const editPassword = "Stage464!";
const adminPassword = "Stage464SyntheticAdmin!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: adminPassword, viewport: { width: 1440, height: 900 } });

async function createProject(page: Page, origin: string, name: string) {
  const created = await page.request.post("/api/projects", { headers: { Origin: origin }, data: { name, description: "합성 일정 교환 fixture", ownerName: "E2E 자동화", editPassword } });
  expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string, api = `/api/projects/${publicId}`;
  const get = async () => {
    const response = await page.request.get(api); expect(response.status()).toBe(200);
    return await response.json() as ProjectSnapshotResponse;
  };
  let snapshot = await get();
  const headers = () => ({ Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` });
  const mutate = async (path: string, data: unknown, method: "post" | "put" | "patch" = "post", status = 200) => {
    const response = await page.request[method](`${api}${path}`, { headers: headers(), data });
    expect(response.status(), `${method} ${path}: ${await response.text()}`).toBe(status);
    snapshot = await get(); return response;
  };
  const add = async (name: string, type: ProjectTaskDto["type"], externalId: string, parentTaskId?: string, duration = 2) => {
    const response = await mutate("/tasks", { name, type, externalId, parentTaskId, ...(type === "summary" ? {} : { start: "2026-10-06", duration: type === "milestone" ? 0 : duration, progress: 0 }) }, "post", 201);
    return (await response.json() as TaskMutationResponse).data.tasks.find((task) => task.externalId === externalId)!;
  };
  const refresh = async () => { snapshot = await get(); return snapshot; };
  const unlock = async () => {
    expect((await page.request.post(`${api}/edit-sessions`, { headers: { Origin: origin }, data: { editPassword } })).status()).toBe(204);
    return refresh();
  };
  return { publicId, api, get, refresh, headers, mutate, add, unlock, get snapshot() { return snapshot; } };
}

type ProjectHarness = Awaited<ReturnType<typeof createProject>>;
function canonicalContent(snapshot: ProjectSnapshotResponse) {
  return { project: snapshot.data.project, tasks: snapshot.data.tasks, links: snapshot.data.links, assignments: snapshot.data.assignments, logistics: snapshot.data.logistics };
}

/** Compare persisted meaning through external refs while allowing new UUIDs. */
function taskMeaning(snapshot: ProjectSnapshotResponse) {
  const idToExternal = new Map(snapshot.data.tasks.map((task) => [task.taskId, task.externalId]));
  const ref = (id: string | null | undefined) => id ? idToExternal.get(id) : null;
  return snapshot.data.tasks.map((task) => ({ externalId: task.externalId, name: task.name, type: task.type,
    parentExternalId: task.parentExternalId, siblingOrder: task.siblingOrder,
    scheduleMode: task.scheduleMode, requestedStart: task.requestedStart, start: task.start, end: task.end, duration: task.duration,
    progress: task.progress, status: task.status, description: task.description, url: task.url,
    baselineStart: task.baselineStart, baselineDuration: task.baselineDuration, baselineEnd: task.baselineEnd,
    membership: { explicit: ref(task.membership?.explicitMilestoneTaskId), effective: ref(task.membership?.effectiveMilestoneTaskId), inheritedFrom: ref(task.membership?.inheritedFromTaskId) },
    gate: task.stageGate ? { ...task.stageGate, memberTaskIds: task.stageGate.memberTaskIds.map(ref).sort(), incompleteMemberTaskIds: task.stageGate.incompleteMemberTaskIds.map(ref).sort(), predecessorMilestoneTaskIds: task.stageGate.predecessorMilestoneTaskIds.map(ref).sort(), incompletePredecessorMilestoneTaskIds: task.stageGate.incompletePredecessorMilestoneTaskIds.map(ref).sort() } : undefined,
  })).sort((a, b) => a.externalId.localeCompare(b.externalId));
}
const linkMeaning = (snapshot: ProjectSnapshotResponse) => snapshot.data.links.map((link) => ({ predecessorExternalId: link.predecessorExternalId, successorExternalId: link.successorExternalId, type: link.type, lag: link.lag, legacyMixed: link.legacyMixed })).sort((a, b) => a.predecessorExternalId.localeCompare(b.predecessorExternalId) || a.successorExternalId.localeCompare(b.successorExternalId));
const row = (page: Page, taskId: string) => page.locator(`#project-panel-schedule .wx-table-container .wx-row[data-id=":${taskId}"]`).first();
async function openTask(page: Page, taskId: string) {
  await row(page, taskId).click({ button: "right" }); await chooseTaskInformation(page);
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true }); await expect(dialog).toBeVisible(); return dialog;
}
async function downloadBytes(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const parts: Buffer[] = []; for await (const chunk of stream!) parts.push(Buffer.from(chunk)); return Buffer.concat(parts);
}
function zipEntries(bytes: Buffer) {
  const entries = new Map<string, string>(); let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8), size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.toString("utf8", offset + 30, offset + 30 + nameLength), start = offset + 30 + nameLength + extraLength;
    const content = bytes.subarray(start, start + size); entries.set(name, (method === 0 ? content : inflateRawSync(content)).toString("utf8")); offset = start + size;
  }
  return entries;
}
function xmlText(value: string) { return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }
function sheetRows(xml: string) {
  return Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), ([, body]) => {
    const cells = new Map<string, string | number>();
    for (const [, attributes, content] of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const column = attributes.match(/\br="([A-Z]+)\d+"/)?.[1]; if (!column) continue;
      const number = content?.match(/<v>([^<]*)<\/v>/)?.[1], text = content?.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/)?.[1];
      cells.set(column, text === undefined ? number === undefined ? "" : Number(number) : xmlText(text));
    }
    return cells;
  });
}
function namedSheets(entries: Map<string, string>) {
  return new Map(Array.from(entries.get("xl/workbook.xml")!.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*sheetId="(\d+)"/g), ([, name, id]) => [xmlText(name), sheetRows(entries.get(`xl/worksheets/sheet${id}.xml`)!) ]));
}

async function seed(page: Page, origin: string) {
  const project = await createProject(page, origin, "Stage exchange #464"), { add, mutate } = project;
  const a = await add("동명 병렬 단계", "milestone", "M-A"), b = await add("동명 병렬 단계", "milestone", "M-B"), join = await add("합류 단계", "milestone", "M-JOIN"), manual = await add("수동 이벤트", "milestone", "M-MANUAL"), completed = await add("완료 기록 단계", "milestone", "M-CLOSED");
  const summary = await add("Summary 기본 단계", "summary", "S"), nested = await add("중첩 Summary override", "summary", "NESTED", summary.taskId), child = await add("상속 일반 작업", "task", "CHILD", summary.taskId, 5), nestedChild = await add("중첩 상속 완료 작업", "task", "NESTED-T", nested.taskId), override = await add("직접 override 작업", "task", "OVERRIDE", summary.taskId);
  const empty = await add("빈 Summary", "summary", "EMPTY"), direct = await add("직접 지정 DAG 시작", "task", "DAG-P", undefined, 1), successor = await add("DAG 후행 작업", "task", "DAG-Q"), free = await add("미지정 개인 공수", "task", "FREE"), closedChild = await add("Milestone 구성 작업", "task", "CLOSED-T");
  const warningSource = await add("외부 명시 단계만 가진 복사 작업", "task", "WARN"), destination = await add("새 단계 상속 destination", "summary", "DEST");
  const bundle = await add("내부 보존 bundle", "summary", "BUNDLE"), internalM = await add("내부 복제 단계", "milestone", "INTERNAL-M", bundle.taskId), internalT = await add("내부 연결 작업", "task", "INTERNAL-T", bundle.taskId);
  await mutate("/milestone-memberships", { changes: [{ taskId: summary.taskId, milestoneTaskId: a.taskId }, { taskId: nested.taskId, milestoneTaskId: b.taskId }, { taskId: override.taskId, milestoneTaskId: join.taskId }, { taskId: empty.taskId, milestoneTaskId: a.taskId }, { taskId: direct.taskId, milestoneTaskId: a.taskId }, { taskId: successor.taskId, milestoneTaskId: join.taskId }, { taskId: closedChild.taskId, milestoneTaskId: completed.taskId }, { taskId: warningSource.taskId, milestoneTaskId: a.taskId }, { taskId: destination.taskId, milestoneTaskId: b.taskId }, { taskId: internalT.taskId, milestoneTaskId: internalM.taskId }] });
  for (const task of [nestedChild, closedChild]) await mutate(`/tasks/${task.taskId}`, { status: "completed" }, "patch");
  await mutate(`/tasks/${completed.taskId}`, { status: "completed" }, "patch");
  await mutate(`/tasks/${child.taskId}`, { baseline: { start: "2026-10-06", duration: 3 }, description: '=단계 설명 <&> "quoted"', url: "https://example.test/stage464" }, "patch");
  for (const predecessor of [a, b]) await mutate("/links", { predecessorExternalId: predecessor.externalId, successorExternalId: join.externalId, type: "FS", lag: 0 }, "post", 201);
  await mutate("/links", { predecessorExternalId: direct.externalId, successorExternalId: successor.externalId, type: "FS", lag: 1 }, "post", 201);
  // Enough real rows for a nonzero native vertical viewport; no DB seed bypass.
  for (let index = 0; index < 25; index++) await add(`교환 검증 일반 작업 ${index}`, "task", `FILLER-${String(index).padStart(2, "0")}`, undefined, index === 24 ? 120 : 1);
  expect((await page.request.post("/api/resource-catalog/admin-sessions", { headers: { Origin: origin }, data: { password: adminPassword } })).status()).toBe(201);
  let catalog = (await (await page.request.get("/api/resources")).json()).data;
  const resource = await page.request.post("/api/resources", { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data: { name: "개인 개발자", roles: ["DEVELOPER"], developerGrade: "ADVANCED" } }); expect(resource.status()).toBe(201); catalog = (await resource.json()).data;
  const resourceId = catalog.resources[0].id as string;
  const group = await page.request.post("/api/resource-groups", { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data: { name: "Summary 참조 그룹" } }); expect(group.status()).toBe(201); catalog = (await group.json()).data;
  const groupId = catalog.groups[0].id as string;
  for (const [task, percent] of [[child, 50], [override, 100], [free, 50]] as const) await mutate(`/tasks/${task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: resourceId, allocation: { start: null, end: null, percent } }] }, "put");
  await mutate(`/tasks/${summary.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "group", id: groupId }] }, "put");
  const processResponse = await mutate("/logistics/processes", { name: "교환 검증 공정", code: "PROC-464" }, "post", 201);
  const processId = (await processResponse.json()).data.logistics.processes[0].id as string;
  const equipmentResponse = await mutate("/logistics/equipment", { processId, name: "교환 검증 설비", code: "EQ-464", equipmentType: "stocker", managementUnit: "unit", quantity: 1 }, "post", 201);
  const equipmentId = (await equipmentResponse.json()).data.logistics.equipment[0].id as string;
  await mutate(`/tasks/${override.taskId}/logistics-links`, { equipmentLinks: [{ equipmentId, scope: "self" }], systemLinks: [] }, "put");
  return { project, a, b, join, manual, completed, summary, nested, child, nestedChild, override, empty, direct, successor, free, closedChild, warningSource, destination, bundle, internalM, internalT, resourceId, groupId, equipmentId };
}

async function dashboard(page: Page, project: ProjectHarness, query = "") {
  const response = await page.request.get(`${project.api}/milestone-dashboard${query}`); expect(response.status()).toBe(200); return (await response.json() as MilestoneDashboardResponse).data;
}

test("#464 실제 Editor·Stage/물류/Resource·JSON/Excel 다운로드·Import·Copy/Template·소속 확인 통합", async ({ page, baseURL, browser }, testInfo) => {
  test.setTimeout(360_000); page.setDefaultTimeout(20_000);
  const origin = baseURL!, fixture = await seed(page, origin), { project, child, summary, join, b, free, warningSource, destination } = fixture;
  for (const path of ["/milestone-dashboard", "/assigned-targets", "/resource-workload", "/logistics/dashboard", `/tasks/${child.taskId}/assignments`, `/tasks/${child.taskId}/logistics-links`, "/exports/json", "/exports/excel", "/imports/preview", "/imports"]) await (await page.request.get(`${project.api}${path}`)).body();
  await page.goto(`/projects/${project.publicId}`); await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const editor = await openTask(page, child.taskId); await expect(editor).toContainText("Summary 기본 단계에서 상속");
  const picker = editor.getByRole("combobox", { name: "Milestone", exact: true }); await picker.fill(join.taskId); await picker.press("Enter");
  const beforeEdit = project.snapshot.data.project.revision;
  await editor.getByRole("button", { name: "저장", exact: true }).click(); await expect(editor).toHaveCount(0); await project.refresh();
  expect(project.snapshot.data.project.revision).toBe(beforeEdit + 1);
  const milestoneEditor = await openTask(page, join.taskId); await milestoneEditor.getByRole("tab", { name: /소속 작업/ }).click(); await expect(milestoneEditor).toContainText("유효 일반 작업 3개"); await expect(milestoneEditor).toContainText(child.name); await milestoneEditor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  const header = page.locator("#project-panel-schedule .wx-table-container .wx-header").first(); await header.click({ button: "right" }); await page.locator(".project-column-menu").getByRole("checkbox", { name: "Milestone", exact: true }).check(); await page.keyboard.press("Escape");
  await expect(row(page, child.taskId).getByRole("button", { name: /Milestone:/ })).toContainText(join.name);
  const stageTrigger = page.locator("#project-panel-schedule .project-stage-filter-trigger"); await stageTrigger.click(); const stageSearch = page.getByRole("combobox", { name: "Milestone 이름·외부 ID·작업 ID 검색" }); await stageSearch.fill(join.taskId); await stageSearch.press("End"); await stageSearch.press("Enter"); await expect(row(page, child.taskId)).toBeVisible(); await expect(row(page, free.taskId)).toHaveCount(0);
  await page.getByRole("button", { name: "Milestone 조건 해제", exact: true }).click();
  const full = await dashboard(page, project), partial = await dashboard(page, project, `?milestoneIds=${join.taskId}&from=2026-10-06&to=2026-10-07&mdPerMm=null`);
  expect(full.projectRevision).toBe(project.snapshot.data.project.revision); expect(full.effort.assignmentIds).toHaveLength(3); expect(full.effort.plannedMd).toBe(5.5);
  expect(partial.rows).toHaveLength(1); expect(partial.rows[0].stageGate).toEqual(full.rows.find((stage) => stage.milestoneTaskId === join.taskId)!.stageGate); expect(partial.effort.plannedMd).toBe(4); expect(partial.rows[0].effort.plannedMd).toBe(3); expect(partial.effort.buckets.find((bucket) => bucket.milestoneTaskId === null)?.plannedMd).toBe(1);
  expect(full.rows.find((stage) => stage.milestoneTaskId === join.taskId)?.stageGate.incompletePredecessorMilestoneTaskIds).toHaveLength(2); expect(full.rows.find((stage) => stage.milestoneTaskId === join.taskId)?.stageGate.ready).toBe(false); expect(full.kpi.ready.milestoneTaskIds).toContain(b.taskId);
  const logistics = (await (await page.request.get(`${project.api}/logistics/dashboard?equipmentIds=${fixture.equipmentId}`)).json()).data;
  expect(logistics.milestoneStages.milestoneTaskIds).toEqual([join.taskId]); expect(logistics.milestoneStages.rows[0].stageGate).toEqual(partial.rows[0].stageGate);
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click(); const stagePanel = page.getByTestId("milestone-dashboard"); await expect(stagePanel).toHaveAttribute("data-ready", "true");
  await stagePanel.getByText("Milestone 표시·공수 범위 조건", { exact: true }).click(); await stagePanel.getByLabel("공수 시작일", { exact: true }).fill("2026-10-06"); await stagePanel.getByLabel("공수 종료일", { exact: true }).fill("2026-10-07"); await stagePanel.getByRole("combobox", { name: "M/M 환산 기준", exact: true }).selectOption("unset"); await expect(stagePanel).toHaveAttribute("data-ready", "true"); await expect(stagePanel).toContainText("4 M/D");
  // Exact assignment scope is POSTed and validated against the canonical fingerprint.
  const drillRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().includes(`${project.api}/resource-dashboard/query`) && request.postData()?.includes('"exactAssignments"') === true);
  await stagePanel.getByRole("button", { name: "해당 범위 리소스 보기", exact: true }).click();
  const requestPayload = (await drillRequest).postDataJSON();
  expect([...requestPayload.scope.assignmentIds].sort()).toEqual([...partial.effort.assignmentIds].sort());
  expect(requestPayload.filters).toMatchObject({ from: "2026-10-06", to: "2026-10-07" });
  await expect(page.getByRole("region", { name: "임시 조회 범위", exact: true })).toContainText("Milestone 원본의 정확한 배정 범위");
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click(); await page.getByRole("tab", { name: "KPI 대시보드", exact: true }).click(); await expect(page.getByRole("tabpanel", { name: "물류 구성", exact: true }).getByRole("row", { name: /M-JOIN/ })).toContainText("3");
  await page.getByRole("tab", { name: "일정", exact: true }).click();

  // Download both formats through the actual UI, then inspect their bytes.
  await page.getByRole("button", { name: "내보내기", exact: true }).click(); const exportDialog = page.getByRole("dialog", { name: "내보내기", exact: true }); await exportDialog.getByLabel("형식", { exact: true }).selectOption("json"); await expect(exportDialog).toContainText("Resource·Logistics는 제외");
  const jsonDownload = page.waitForEvent("download"); await exportDialog.getByRole("button", { name: "내보내기", exact: true }).click(); const downloadedJson = await jsonDownload, jsonBytes = await downloadBytes(downloadedJson); const exchange = JSON.parse(jsonBytes.toString("utf8")) as ImportPayload11;
  expect(downloadedJson.suggestedFilename()).toBe(`mastergantt-${project.publicId}-r${project.snapshot.data.project.revision}.json`); expect(exchange.schemaVersion).toBe("1.1"); expect(exchange.source).toMatchObject({ contentScope: "schedule-stage", projectPublicId: project.publicId, projectRevision: full.projectRevision });
  expect(exchange).not.toHaveProperty("assignments"); expect(exchange).not.toHaveProperty("logistics"); expect(exchange.tasks).toHaveLength(project.snapshot.data.tasks.length); expect(exchange.memberships).toContainEqual({ taskExternalId: child.externalId, milestoneExternalId: join.externalId });
  expect(exchange.tasks.find((task) => task.externalId === child.externalId)).toMatchObject({ requestedStart: "2026-10-06", sourceTaskId: child.taskId, baseline: { start: "2026-10-06", duration: 3 } }); expect(exchange.tasks.find((task) => task.externalId === fixture.successor.externalId)?.requestedStart).toBe("2026-10-06");
  expect(exchange.tasks.every((task) => !("stageGate" in task) && !("membership" in task) && !("assignments" in task))).toBe(true);
  await page.getByRole("button", { name: "내보내기", exact: true }).click(); await exportDialog.getByLabel("형식", { exact: true }).selectOption("excel"); await exportDialog.getByLabel("일정 Dependency 제외", { exact: true }).check(); await exportDialog.getByLabel("리소스 공수 견적 포함 (역할·개발자 Summary/Detail)", { exact: true }).check(); await expect(exportDialog).toContainText("현재 Dashboard의 검색·선택·공수 조건·수동 기준일은 적용하지 않습니다");
  const excelDownload = page.waitForEvent("download"); await exportDialog.getByRole("button", { name: "내보내기", exact: true }).click(); const excelBytes = await downloadBytes(await excelDownload); const entries = zipEntries(excelBytes), sheets = namedSheets(entries);
  expect(sheets.has("Dependencies")).toBe(false); expect(sheets.has("Tasks")).toBe(true); expect(sheets.has("Milestone Stages")).toBe(true);
  const tasksXml = entries.get("xl/worksheets/sheet2.xml")!; expect(tasksXml).toContain(child.taskId); expect(tasksXml).toContain(join.taskId); expect(tasksXml).toContain(summary.taskId); expect(tasksXml).not.toContain("<f>");
  const taskCells = sheets.get("Tasks")!, taskByExternal = (externalId: string) => taskCells.find((cells) => cells.get("C") === externalId)!;
  expect(taskCells[0].get("K")).toBe("Task ID"); expect(taskCells[0].get("R")).toBe("명시 단계 ID"); expect(taskCells[0].get("T")).toBe("유효 단계 ID(파생)"); expect(taskCells[0].get("V")).toBe("상속 출처 ID(파생)");
  expect(taskByExternal(child.externalId).get("K")).toBe(child.taskId); expect(taskByExternal(child.externalId).get("R")).toBe(join.taskId); expect(taskByExternal(child.externalId).get("S")).toBe(join.externalId); expect(taskByExternal(child.externalId).get("T")).toBe(join.taskId); expect(taskByExternal(child.externalId).get("V") ?? "").toBe(""); expect(taskByExternal(child.externalId).get("I")).toBe('=단계 설명 <&> "quoted"'); expect(taskByExternal(child.externalId).get("P")).toBe(3);
  const inherited = project.snapshot.data.tasks.find((task) => task.externalId === "NESTED-T")!;
  expect(taskByExternal(inherited.externalId).get("R") ?? "").toBe(""); expect(taskByExternal(inherited.externalId).get("T")).toBe(b.taskId); expect(taskByExternal(inherited.externalId).get("V")).toBe(inherited.membership!.inheritedFromTaskId); expect(taskByExternal(summary.externalId).get("O") ?? "").toBe("");
  const stageCells = sheets.get("Milestone Stages")!, metadata = (key: string) => stageCells.find((cells) => cells.get("A") === key)!.get("B");
  expect(metadata("projectPublicId")).toBe(project.publicId); expect(metadata("projectRevision")).toBe(full.projectRevision); expect(metadata("catalogRevision")).toBe(full.catalogRevision); expect(metadata("from")).toBe(full.workloadRange.from); expect(metadata("to")).toBe(full.workloadRange.to); expect(metadata("gateBasis")).toBe("전체 E(M)/P(M)");
  expect(stageCells.find((cells) => cells.get("A") === "Grand Total" && cells.get("C") === "전체")!.get("D")).toBe(full.effort.plannedMd);
  expect(stageCells.find((cells) => cells.get("A") === "미지정" && cells.get("C") === "전체")!.get("D")).toBe(full.effort.buckets.find((bucket) => bucket.milestoneTaskId === null)!.plannedMd);
  const exportedJoin = stageCells.find((cells) => cells.get("A") === join.taskId && cells.get("B") === join.externalId)!, fullJoin = full.rows.find((stage) => stage.milestoneTaskId === join.taskId)!;
  expect(exportedJoin.get("G")).toBe(String(fullJoin.stageGate.ready)); expect(exportedJoin.get("K")).toBe(fullJoin.stageGate.memberCount); expect(exportedJoin.get("L")).toBe(fullJoin.stageGate.completedMemberCount); expect(exportedJoin.get("U")).toBe(fullJoin.effort.plannedMd);
  const exportedIds = (kind: string, milestoneId?: string) => stageCells.filter((cells) => cells.get("A") === kind && (milestoneId === undefined || cells.get("B") === milestoneId)).map((cells) => cells.get("D")).sort();
  expect(exportedIds("GrandTotal.assignment")).toEqual([...full.effort.assignmentIds].sort()); expect(exportedIds("stage.member", join.taskId)).toEqual([...fullJoin.stageGate.memberTaskIds].sort()); expect(exportedIds("stage.predecessor", join.taskId)).toEqual([...fullJoin.stageGate.predecessorMilestoneTaskIds].sort());
  const defaultWorkloadResponse = await page.request.get(`${project.api}/resource-workload?from=${full.workloadRange.from}&to=${full.workloadRange.to}`); expect(defaultWorkloadResponse.status()).toBe(200); const defaultWorkload = (await defaultWorkloadResponse.json()).data;
  expect(defaultWorkload.projectRevision).toBe(full.projectRevision); expect(defaultWorkload.grandTotalMd).toBe(full.effort.plannedMd); expect(sheets.get("Resource Effort Summary")!.find((cells) => cells.get("A") === "전체 계획 M/D")!.get("B")).toBe(defaultWorkload.grandTotalMd);

  const original = await project.refresh();
  const target = await createProject(page, origin, "JSON 동일 Calendar 대상"); expect(target.snapshot.data.project.calendar).toEqual(original.data.project.calendar); await page.goto(`/projects/${target.publicId}`); await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  let previews = 0, commits = 0; page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname === `${target.api}/imports/preview`) previews++; if (request.method() === "POST" && new URL(request.url()).pathname === `${target.api}/imports`) commits++; });
  await page.locator('summary[aria-label="프로젝트 작업 더보기"]').click(); const previewRead = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${target.api}/imports/preview`); await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({ name: "stage-roundtrip.json", mimeType: "application/json", buffer: jsonBytes });
  const importDialog = page.getByRole("dialog", { name: "JSON 파일 가져오기", exact: true }); const preview = (await (await previewRead).json() as ProjectImportPreviewResponse).data;
  await expect(importDialog).toContainText(`명시 Milestone 소속 ${exchange.memberships!.length}개`); expect(preview.canCommit).toBe(true); expect(preview.baseRevision).toBe(1); expect((await target.get()).data.tasks).toHaveLength(0);
  const commitRead = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${target.api}/imports`); await importDialog.getByRole("button", { name: "기존 일정에 추가", exact: true }).click(); expect((await commitRead).status()).toBe(201); await expect(importDialog).toHaveCount(0); const imported = await target.refresh();
  expect(previews).toBe(1); expect(commits).toBe(1); expect(imported.data.project.revision).toBe(2); expect(imported.data.project.name).toBe("JSON 동일 Calendar 대상"); expect(taskMeaning(imported)).toEqual(taskMeaning(original)); expect(linkMeaning(imported)).toEqual(linkMeaning(original));
  expect(imported.data.tasks.every((task) => !original.data.tasks.some((old) => old.taskId === task.taskId))).toBe(true); expect(imported.data.assignments ?? []).toHaveLength(0); expect(canonicalContent(await project.get())).toEqual(canonicalContent(original));

  await project.unlock(); const beforePreservation = await project.refresh();
  const copyResponse = await project.mutate("/copy", { name: "Whole copy", description: "새 ID 보존", ownerName: "E2E 자동화", editPassword, resetProgress: false }, "post", 201); const copied = await copyResponse.json() as CopyProjectResponse;
  const copySnapshot = await (await page.request.get(`/api/projects/${copied.data.project.publicId}`)).json() as ProjectSnapshotResponse; expect(taskMeaning(copySnapshot)).toEqual(taskMeaning(beforePreservation)); expect(linkMeaning(copySnapshot)).toEqual(linkMeaning(beforePreservation)); expect(copySnapshot.data.tasks.every((task) => !beforePreservation.data.tasks.some((old) => old.taskId === task.taskId))).toBe(true); expect(copySnapshot.data.assignments).toHaveLength(beforePreservation.data.assignments!.length); expect(canonicalContent(await project.get())).toEqual(canonicalContent(beforePreservation));
  await project.unlock(); const resetCopyResponse = await project.mutate("/copy", { name: "Whole copy reset", description: "Template와 초기화 정책 비교", ownerName: "E2E 자동화", editPassword, resetProgress: true }, "post", 201); const resetCopy = await resetCopyResponse.json() as CopyProjectResponse;
  expect(resetCopy.data.tasks.filter((task) => task.type !== "summary").every((task) => task.status === "not_started" && task.progress === 0)).toBe(true); expect(canonicalContent(await project.get())).toEqual(canonicalContent(beforePreservation));
  await project.unlock(); const templateResponse = await page.request.post("/api/project-templates", { headers: project.headers(), data: { sourceProjectPublicId: project.publicId, name: "단계 보존 Template", description: "상태 초기화 fixture" } }); expect(templateResponse.status()).toBe(201); const template = await templateResponse.json() as ProjectTemplateDetailResponse;
  const instantiatedResponse = await page.request.post(`/api/project-templates/${template.data.id}/instantiate`, { headers: { Origin: origin }, data: { name: "Template 신규 Project", ownerName: "E2E 자동화", description: "초기화", editPassword, projectStartDate: "2026-10-06" } }); expect(instantiatedResponse.status()).toBe(201); const instantiated = await instantiatedResponse.json() as InstantiateProjectTemplateResponse;
  expect(instantiated.data.tasks.filter((task) => task.type !== "summary").every((task) => task.status === "not_started" && task.progress === 0)).toBe(true);
  expect(instantiated.data.tasks.map((task) => ({ externalId: task.externalId, status: task.status, progress: task.progress })).sort((a, b) => a.externalId.localeCompare(b.externalId))).toEqual(resetCopy.data.tasks.map((task) => ({ externalId: task.externalId, status: task.status, progress: task.progress })).sort((a, b) => a.externalId.localeCompare(b.externalId)));
  const instanceByExternal = new Map(instantiated.data.tasks.map((task) => [task.externalId, task])); for (const sourceTask of beforePreservation.data.tasks) {
    const result = instanceByExternal.get(sourceTask.externalId)!; expect(result.taskId).not.toBe(sourceTask.taskId);
    const sourceTarget = beforePreservation.data.tasks.find((task) => task.taskId === sourceTask.membership?.explicitMilestoneTaskId)?.externalId;
    expect(result.membership?.explicitMilestoneTaskId).toBe(sourceTarget ? instanceByExternal.get(sourceTarget)!.taskId : null);
  }
  expect(canonicalContent(await project.get())).toEqual(canonicalContent(beforePreservation));

  await project.unlock(); await page.goto(`/projects/${project.publicId}`); await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const commands: unknown[] = []; page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname === `${project.api}/task-commands`) commands.push(request.postDataJSON()); });
  const copyMenu = page.getByRole("menu", { name: "작업 메뉴", exact: true });
  await page.locator(".project-gantt-widget .wx-gantt").evaluate((element) => { element.scrollTop = 192; }); await expect(row(page, warningSource.taskId)).toBeVisible(); await expect(row(page, destination.taskId)).toBeVisible();
  await row(page, warningSource.taskId).getByText(warningSource.name, { exact: true }).click({ button: "right" }); await copyMenu.getByRole("menuitem", { name: "Copy", exact: true }).click();
  const paste = async () => { await row(page, destination.taskId).getByText(destination.name, { exact: true }).click({ button: "right" }); await copyMenu.getByRole("menuitem", { name: "Paste", exact: true }).click(); await page.getByRole("menu", { name: "Paste", exact: true }).getByRole("menuitem", { name: "As child", exact: true }).click(); };
  await paste(); const review = page.getByRole("dialog", { name: "복사 시 Milestone 소속 변경", exact: true }); await expect(review).toContainText("외부 명시 연결 제외 1개"); await expect(review).toContainText("붙여넣기 대상의 Milestone 상속 적용"); expect(commands).toHaveLength(0); await review.getByRole("button", { name: "취소", exact: true }).click(); expect(commands).toHaveLength(0);
  await paste(); const beforeCopy = project.snapshot.data.project.revision, commandRead = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${project.api}/task-commands`); await review.getByRole("button", { name: "변경 내용을 확인하고 복사", exact: true }).click(); expect((await commandRead).status()).toBe(200); await expect(review).toHaveCount(0); const afterCopy = await project.refresh();
  expect(commands).toEqual([{ kind: "copy", taskIds: [warningSource.taskId], anchorTaskId: destination.taskId, placement: "child", acknowledgedMembershipExclusions: true }]); expect(afterCopy.data.project.revision).toBe(beforeCopy + 1);
  const warningCopy = afterCopy.data.tasks.find((task) => task.name === warningSource.name && task.parentExternalId === destination.externalId)!; expect(warningCopy.taskId).not.toBe(warningSource.taskId); expect(warningCopy.membership).toMatchObject({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: b.taskId, inheritedFromTaskId: destination.taskId }); expect(afterCopy.data.tasks.find((task) => task.taskId === warningSource.taskId)?.membership?.explicitMilestoneTaskId).toBe(fixture.a.taskId);
  const boundary = await page.request.post(`${project.api}/task-commands`, { headers: project.headers(), data: { kind: "copy", taskId: fixture.completed.taskId, anchorTaskId: destination.taskId, placement: "after", acknowledgedMembershipExclusions: true } }); expect(boundary.status()).toBe(409); expect((await boundary.json()).error.code).toBe("COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED"); expect(canonicalContent(await project.get())).toEqual(canonicalContent(afterCopy));
  const internalCopyResponse = await project.mutate("/task-commands", { kind: "copy", taskId: fixture.bundle.taskId, anchorTaskId: destination.taskId, placement: "after" }); const internalCopy = await internalCopyResponse.json() as TaskMutationResponse;
  const originalIds = new Set(afterCopy.data.tasks.map((task) => task.taskId));
  const createdIds = new Set(internalCopy.data.tasks.filter((task) => !originalIds.has(task.taskId)).map((task) => task.taskId)), newInternalM = internalCopy.data.tasks.find((task) => createdIds.has(task.taskId) && task.name === fixture.internalM.name)!, newInternalT = internalCopy.data.tasks.find((task) => createdIds.has(task.taskId) && task.name === fixture.internalT.name)!;
  expect(newInternalT.membership).toMatchObject({ explicitMilestoneTaskId: newInternalM.taskId, effectiveMilestoneTaskId: newInternalM.taskId }); expect(newInternalM.taskId).not.toBe(fixture.internalM.taskId); expect(internalCopy.data.tasks.find((task) => task.taskId === fixture.internalT.taskId)?.membership?.explicitMilestoneTaskId).toBe(fixture.internalM.taskId);

  const readonly = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 900 } });
  try {
    const peer = await readonly.newPage(); await peer.goto(`/projects/${project.publicId}`); await expect(peer.getByText("읽기 전용", { exact: true }).first()).toBeVisible(); await peer.locator('summary[aria-label="프로젝트 작업 더보기"]').click(); await expect(peer.getByRole("button", { name: "가져오기 (JSON)", exact: true })).toBeDisabled();
    await peer.locator('summary[aria-label="프로젝트 작업 더보기"]').click(); const frame = peer.locator(".project-gantt-frame"); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /.+/); const apiInstance = await frame.getAttribute("data-project-gantt-api-instance");
    const peerHeader = peer.locator("#project-panel-schedule .wx-table-container .wx-header").first(); await peerHeader.click({ button: "right" }); await peer.locator(".project-column-menu").getByRole("checkbox", { name: "Milestone", exact: true }).check(); await peer.keyboard.press("Escape");
    await peer.getByRole("button", { name: "주", exact: true }).click(); const toggle = row(peer, summary.taskId).locator('[data-action="open-task"]'); await toggle.click(); await expect(toggle).toHaveClass(/wxi-menu-right/);
    const selected = row(peer, free.taskId); await selected.locator('[data-col-id=":text"]').click(); await expect(selected).toHaveClass(/wx-selected/);
    const chart = peer.locator(".project-gantt-widget .wx-chart");
    expect(await chart.evaluate((element) => element.scrollWidth - element.clientWidth), "Week timeline has a real horizontal buffer").toBeGreaterThanOrEqual(120);
    const verticalRange = await peer.locator(".project-gantt-widget .wx-gantt").evaluate((element) => element.scrollHeight - element.clientHeight); expect(verticalRange, "Real task rows have a nonzero vertical buffer").toBeGreaterThanOrEqual(96);
    await chart.evaluate((element) => { element.scrollLeft = 120; }); const vertical = peer.locator(".project-gantt-widget .wx-gantt"); await vertical.evaluate((element) => { element.scrollTop = 96; });
    const live = () => frame.evaluate((element) => { const owner = element as HTMLElement & { readonly __masterganttPublicViewport?: { left: number; top: number } }; return { left: element.querySelector(".wx-chart")!.scrollLeft, top: element.querySelector(".wx-gantt")!.scrollTop, publicLeft: owner.__masterganttPublicViewport?.left, publicTop: owner.__masterganttPublicViewport?.top }; });
    await expect.poll(live).toEqual({ left: 120, top: 96, publicLeft: 120, publicTop: 96 });
    const checkpoint = async (phase: string) => ({ phase, ...(await live()), ...(await frame.evaluate((element) => ({ gridWidth: element.querySelector(".wx-table-container")!.getBoundingClientRect().width, chartWidth: element.querySelector(".wx-chart")!.clientWidth, chartScrollWidth: element.querySelector(".wx-chart")!.scrollWidth, verticalClientHeight: element.querySelector(".wx-gantt")!.clientHeight, verticalScrollHeight: element.querySelector(".wx-gantt")!.scrollHeight, fullscreen: Boolean(document.fullscreenElement) }))) });
    const checkpoints = [await checkpoint("baseline")];
    await peer.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click(); await expect.poll(() => peer.evaluate(() => Boolean(document.fullscreenElement))).toBe(true); checkpoints.push(await checkpoint("fullscreen"));
    await peer.getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click(); await expect.poll(() => peer.evaluate(() => Boolean(document.fullscreenElement))).toBe(false); await expect.poll(live).toEqual({ left: 120, top: 96, publicLeft: 120, publicTop: 96 }); checkpoints.push(await checkpoint("fullscreen-exit"));
    await peer.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click(); await expect(peer.getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true"); await peer.getByRole("tab", { name: "일정", exact: true }).click(); await expect.poll(live).toEqual({ left: 120, top: 96, publicLeft: 120, publicTop: 96 }); checkpoints.push(await checkpoint("peer-return"));
    expect(checkpoints.at(-1)!.gridWidth).toBe(checkpoints[0].gridWidth); expect(checkpoints.at(-1)!.chartWidth).toBe(checkpoints[0].chartWidth);
    await peer.setViewportSize({ width: 1456, height: 900 }); await expect.poll(live).toEqual({ left: 120, top: 96, publicLeft: 120, publicTop: 96 }); await peer.setViewportSize({ width: 1440, height: 900 }); await expect.poll(live).toEqual({ left: 120, top: 96, publicLeft: 120, publicTop: 96 }); checkpoints.push(await checkpoint("subsequent-layout"));
    await expect(peerHeader.getByText("Milestone", { exact: true })).toBeVisible();
    await testInfo.attach("actual-464-viewport-checkpoints", { body: JSON.stringify(checkpoints), contentType: "application/json" });
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstance!); await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week"); await expect(toggle).toHaveClass(/wxi-menu-right/); await expect(selected).toHaveClass(/wx-selected/);
    await peer.screenshot({ path: "output/playwright/issue-464-actual/after-readonly-peer.png" });
    await testInfo.attach("actual-464-viewport", { body: JSON.stringify(await live()), contentType: "application/json" });
  } finally { await readonly.close(); }
  await testInfo.attach("actual-464-contract-evidence", { body: JSON.stringify({ projectRevision: full.projectRevision, catalogRevision: full.catalogRevision, sourceStageIds: full.rows.map((stage) => stage.milestoneTaskId), assignmentIds: full.effort.assignmentIds, defaultGrandMd: full.effort.plannedMd, scopedGrandMd: partial.effort.plannedMd, importedProjectRevision: imported.data.project.revision, copiedProjectId: copied.data.project.publicId, instantiatedProjectId: instantiated.data.project.publicId, copyReviewPostCount: commands.length, finalRevision: project.snapshot.data.project.revision, legacyMixedBrowser: "NOT TESTED: native SQLite server fixtures cover legacy cases; browser does not scan or write test DBs" }), contentType: "application/json" });
});

test("#464 실제 Import 검토 이후 변경은 412·파일 보존·자동 재전송 0과 readonly 권한으로 보호한다", async ({ page, baseURL, browser }) => {
  test.setTimeout(120_000); page.setDefaultTimeout(20_000);
  const project = await createProject(page, baseURL!, "Import stale #464");
  const file = Buffer.from(JSON.stringify({ schemaVersion: "1.1", project: { name: "외부 일정", description: "Create-only" }, tasks: [{ externalId: "M", name: "새 Milestone", type: "milestone", requestedStart: "2026-10-06", duration: 0, progress: 0, status: "not_started", parentExternalId: null, predecessors: [] }, { externalId: "T", name: "외부 작업", type: "task", requestedStart: "2026-10-06", duration: 2, progress: 0, status: "not_started", parentExternalId: null, predecessors: [] }], memberships: [{ taskExternalId: "T", milestoneExternalId: "M" }] }));
  await (await page.request.get(`${project.api}/imports/preview`)).body(); await (await page.request.get(`${project.api}/imports`)).body();
  await page.goto(`/projects/${project.publicId}`); await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  await page.locator('summary[aria-label="프로젝트 작업 더보기"]').click(); const previewRead = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${project.api}/imports/preview`);
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({ name: "stale-stage.json", mimeType: "application/json", buffer: file }); const preview = (await (await previewRead).json() as ProjectImportPreviewResponse).data; expect(preview.baseRevision).toBe(1); expect(preview.canCommit).toBe(true);
  const dialog = page.getByRole("dialog", { name: "JSON 파일 가져오기", exact: true }); await expect(dialog.getByRole("button", { name: "기존 일정에 추가", exact: true })).toBeEnabled();
  await project.add("동시 저장 작업", "task", "CONCURRENT"); const concurrent = await project.refresh(); let commits = 0, latestGets = 0, previewPosts = 0; page.on("request", (request) => { const path = new URL(request.url()).pathname; if (request.method() === "POST" && path === `${project.api}/imports`) commits++; if (request.method() === "GET" && path === project.api) latestGets++; if (request.method() === "POST" && path === `${project.api}/imports/preview`) previewPosts++; });
  const commitRead = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${project.api}/imports`); await dialog.getByRole("button", { name: "기존 일정에 추가", exact: true }).click(); expect((await commitRead).status()).toBe(412);
  await expect(dialog).toContainText("검토 이후 프로젝트가 변경되었습니다"); await expect(dialog).toContainText("stale-stage.json"); await expect(dialog.getByRole("button", { name: "기존 일정에 추가", exact: true })).toBeDisabled(); expect(commits).toBe(1); expect(canonicalContent(await project.get())).toEqual(canonicalContent(concurrent));
  expect(latestGets).toBe(0); expect(previewPosts).toBe(0);
  const latestRead = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === project.api);
  await dialog.getByRole("button", { name: "최신 일정 조회", exact: true }).click(); expect((await latestRead).status()).toBe(200); await expect(dialog).toBeVisible(); await expect(dialog).toContainText("stale-stage.json"); expect(latestGets).toBe(1); expect(commits).toBe(1); expect(previewPosts).toBe(0);
  await expect(dialog.getByRole("button", { name: "기존 일정에 추가", exact: true })).toBeDisabled();
  const refreshedPreviewRead = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${project.api}/imports/preview`);
  await dialog.getByRole("button", { name: "다시 미리보기", exact: true }).click(); const refreshedPreview = (await (await refreshedPreviewRead).json() as ProjectImportPreviewResponse).data; expect(refreshedPreview.baseRevision).toBe(concurrent.data.project.revision); expect(refreshedPreview.canCommit).toBe(true); expect(previewPosts).toBe(1); expect(commits).toBe(1); await expect(dialog).toContainText("stale-stage.json"); await expect(dialog.getByRole("button", { name: "기존 일정에 추가", exact: true })).toBeEnabled();
  expect(canonicalContent(await project.get())).toEqual(canonicalContent(concurrent));
  const recoveredCommitRead = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${project.api}/imports`);
  await dialog.getByRole("button", { name: "기존 일정에 추가", exact: true }).click(); expect((await recoveredCommitRead).status()).toBe(201); await expect(dialog).toHaveCount(0); expect(commits).toBe(2); expect(previewPosts).toBe(1); expect(latestGets).toBe(1);
  const recovered = await project.refresh(); expect(recovered.data.project.revision).toBe(concurrent.data.project.revision + 1); expect(recovered.data.tasks.map((task) => task.externalId).sort()).toEqual(["CONCURRENT", "M", "T"]); const recoveredM = recovered.data.tasks.find((task) => task.externalId === "M")!, recoveredT = recovered.data.tasks.find((task) => task.externalId === "T")!; expect(recoveredT.membership?.explicitMilestoneTaskId).toBe(recoveredM.taskId); expect(recoveredT.membership?.effectiveMilestoneTaskId).toBe(recoveredM.taskId); expect(recovered.data.tasks.find((task) => task.externalId === "CONCURRENT")).toEqual(concurrent.data.tasks[0]);
  const readonly = await browser.newContext({ baseURL: baseURL! });
  try {
    const response = await readonly.request.post(`${project.api}/imports/preview`, { headers: { Origin: baseURL!, "Content-Type": "application/json" }, data: file }); expect(response.status()).toBe(401);
    const peer = await readonly.newPage(); await peer.goto(`/projects/${project.publicId}`); await peer.locator('summary[aria-label="프로젝트 작업 더보기"]').click(); await expect(peer.getByRole("button", { name: "가져오기 (JSON)", exact: true })).toBeDisabled();
  } finally { await readonly.close(); }
});
