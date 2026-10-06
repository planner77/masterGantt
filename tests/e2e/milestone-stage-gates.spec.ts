import { inflateRawSync } from "node:zlib";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, ProjectTaskDto, TaskMutationResponse } from "../../src/contracts/projects";

test.use(isolatedApplicationOptions);

test("단계 소속 실제 HTTP 저장·완료 잠금·재시작·안전 거부", async ({ page, baseURL, restartIsolatedApplication }) => {
  test.setTimeout(150_000);
  const origin = baseURL!;
  const created = await page.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Stage gates #460", ownerName: "E2E 자동화", description: "실제 SQLite 저장", editPassword: "Stage460!" } });
  expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string;
  const api = `/api/projects/${publicId}`;
  const get = async () => (await (await page.request.get(api)).json()) as ProjectSnapshotResponse;
  let snapshot = await get();
  const headers = () => ({ Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` });
  const add = async (name: string, type: ProjectTaskDto["type"], parentTaskId?: string) => {
    const response = await page.request.post(`${api}/tasks`, { headers: headers(), data: type === "summary" ? { name, type, parentTaskId } : { name, type, start: "2026-10-05", duration: type === "milestone" ? 0 : 2, progress: 0, parentTaskId } });
    expect(response.status()).toBe(201); const value = await response.json() as TaskMutationResponse; snapshot = { data: { ...value.data, permission: "edit" } }; return value.data.tasks.find((task) => task.name === name)!;
  };
  const m = await add("M", "milestone"), s = await add("S", "summary"), t = await add("T", "task", s.taskId);
  const beforeRevision = snapshot.data.project.revision;
  const assign = await page.request.post(`${api}/milestone-memberships`, { headers: headers(), data: { changes: [{ taskId: s.taskId, milestoneTaskId: m.taskId }] } });
  expect(assign.status()).toBe(200); snapshot = await get(); expect(snapshot.data.project.revision).toBe(beforeRevision + 1);
  expect(snapshot.data.tasks.find((task) => task.taskId === t.taskId)?.membership).toMatchObject({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: m.taskId, inheritedFromTaskId: s.taskId });
  const pending = await page.request.patch(`${api}/tasks/${m.taskId}`, { headers: headers(), data: { progress: 100 } });
  expect(pending.status()).toBe(409); expect((await pending.json()).error.code).toBe("MILESTONE_NOT_READY");
  const completeTask = await page.request.patch(`${api}/tasks/${t.taskId}`, { headers: headers(), data: { status: "completed" } }); expect(completeTask.status()).toBe(200); snapshot = await get();
  expect(snapshot.data.tasks.find((task) => task.taskId === m.taskId)?.stageGate?.ready).toBe(true);
  const completeMilestone = await page.request.patch(`${api}/tasks/${m.taskId}`, { headers: headers(), data: { progress: 100 } }); expect(completeMilestone.status()).toBe(200); snapshot = await get();
  const locked = await page.request.post(`${api}/tasks`, { headers: headers(), data: { name: "Blocked child", type: "task", start: "2026-10-05", duration: 1, progress: 0, parentTaskId: s.taskId } });
  expect(locked.status()).toBe(409); expect((await locked.json()).error.code).toBe("COMPLETED_MILESTONE_STRUCTURE_LOCKED"); expect(await get()).toEqual(snapshot);
  const exportResponse = await page.request.post(`${api}/exports/excel`, { headers: headers(), data: { includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 200 }] } } });
  expect(exportResponse.status()).toBe(200);
  const workbook = await exportResponse.body();
  expect(workbook.subarray(0, 2).toString()).toBe("PK");
  let offset = 0, workbookXml = "";
  while (offset + 30 <= workbook.length && workbook.readUInt32LE(offset) === 0x04034b50) {
    const method = workbook.readUInt16LE(offset + 8), size = workbook.readUInt32LE(offset + 18), nameLength = workbook.readUInt16LE(offset + 26), extraLength = workbook.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength, name = workbook.subarray(offset + 30, offset + 30 + nameLength).toString();
    const content = workbook.subarray(start, start + size);
    if (name.endsWith(".xml")) workbookXml += (method === 8 ? inflateRawSync(content) : content).toString();
    offset = start + size;
  }
  for (const id of [s.taskId, m.taskId, t.taskId]) expect(workbookXml).toContain(id);
  const jsonExport = await page.request.post(`${api}/exports/json`, { headers: headers(), data: { scope: "project" } });
  expect(jsonExport.status()).toBe(200);
  const exported = await jsonExport.json(); expect(exported.schemaVersion).toBe("1.1");
  expect(exported.memberships).toEqual([{ taskExternalId: s.externalId, milestoneExternalId: m.externalId }]);
  expect(exported.tasks.find((task: { externalId: string }) => task.externalId === m.externalId).status).toBe("completed");
  const noPreview = await page.request.post(`${api}/imports`, { headers: headers(), data: { schemaVersion: "1.0", tasks: [] } });
  expect(noPreview.status()).toBe(428); expect((await noPreview.json()).error.code).toBe("IMPORT_PREVIEW_REQUIRED");
  const invalidPreview = await page.request.post(`${api}/imports/preview`, { headers: headers(), data: { schemaVersion: "1.0", tasks: [] } });
  expect(invalidPreview.status()).toBe(422); expect((await invalidPreview.json()).error.code).toBe("IMPORT_VALIDATION_FAILED");
  await restartIsolatedApplication(); expect(await get()).toEqual(snapshot);
  const readonly = await page.context().browser()!.newContext({ baseURL: origin });
  try {
    const unauthorized = await readonly.request.post(`${api}/milestone-memberships`, { headers: headers(), data: { changes: [{ taskId: s.taskId, milestoneTaskId: null }] } }); expect(unauthorized.status()).toBe(401);
  } finally { await readonly.close(); }
  const reopened = await page.request.patch(`${api}/tasks/${m.taskId}`, { headers: headers(), data: { status: "not_started" } }); expect(reopened.status()).toBe(200); snapshot = await get();
  const deleted = await page.request.delete(api, { headers: headers() }); expect(deleted.status()).toBe(204);
});
