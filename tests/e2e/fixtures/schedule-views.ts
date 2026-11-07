import type { Page } from "@playwright/test";
import type { ResourceCatalogResponse } from "../../../src/contracts/resources";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../../src/contracts/projects";
import type { LogisticsTargetMutationResponse } from "../../../src/contracts/logistics-targets";
import { expect } from "./isolated-application";
import { createTargetProject } from "./target-project";
import type { ObserveIsolatedApi } from "./isolated-application-diagnostics";

export const scheduleViewResourcePassword = "Schedule880Synthetic!";

/** Real HTTP setup; only retired compatibility data uses the isolated archive service. */
export async function seedScheduleViews(page: Page, origin: string, observer: ObserveIsolatedApi) {
  const f = await createTargetProject(page, origin, observer);
  const addTask = async (name: string) => {
    const response = await f.mutate("/tasks", { name, type: "task", start: "2026-10-14", duration: 2, progress: 0 });
    return ((await response.json()) as TaskMutationResponse).data.tasks.find(row => row.name === name)!;
  };
  const groupOnly = await addTask("개인 자동 배정 금지");
  const unassigned = await addTask("완전 미할당 원본");
  const ungrouped = await addTask("그룹 미소속 개인 작업");
  await f.mutate("/tasks", { name: "빈 Summary 원본", type: "summary" });
  await f.mutate("/tasks", { name: "View에서 제외하는 Milestone", type: "milestone", start: "2026-10-14", duration: 0, progress: 0 });
  expect((await page.request.post(`${origin}/api/resource-catalog/admin-sessions`, {
    headers: { Origin: origin }, data: { password: scheduleViewResourcePassword },
  })).status()).toBe(201);
  let catalog = (await (await page.request.get(`${origin}/api/resources`)).json()) as ResourceCatalogResponse;
  const catalogWrite = async (path: string, data: object, method = "post") => {
    const response = await page.request.fetch(`${origin}${path}`, {
      method, headers: { Origin: origin, "If-Match": `"${catalog.data.revision}"` }, data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    catalog = (await response.json()) as ResourceCatalogResponse;
  };
  for (const name of ["Alice", "Bob", "Charlie"]) {
    await catalogWrite("/api/resources", { name, code: name, roles: ["DEVELOPER"], developerGrade: "ADVANCED" });
  }
  const [alice, bob, charlie] = ["Alice", "Bob", "Charlie"].map(name => catalog.data.resources.find(row => row.name === name)!);
  for (const name of ["Group 1", "Group 2"]) await catalogWrite("/api/resource-groups", { name, code: name.replace(" ", "-") });
  const [g1, g2] = ["Group 1", "Group 2"].map(name => catalog.data.groups.find(row => row.name === name)!);
  await catalogWrite(`/api/resource-groups/${g1.id}/members`, { resourceIds: [alice.id, bob.id] }, "put");
  await catalogWrite(`/api/resource-groups/${g2.id}/members`, { resourceIds: [alice.id] }, "put");
  await f.mutate(`/tasks/${f.task.taskId}/assignments`, { catalogRevision: catalog.data.revision,
    targets: [alice, bob].map(row => ({ kind: "resource", id: row.id, allocation: { percent: 50, start: null, end: null } })) }, "put");
  await f.mutate(`/tasks/${groupOnly.taskId}/assignments`, { catalogRevision: catalog.data.revision, targets: [{ kind: "group", id: g1.id }] }, "put");
  await f.mutate(`/tasks/${ungrouped.taskId}/assignments`, { catalogRevision: catalog.data.revision, targets: [{ kind: "resource", id: charlie.id }] }, "put");
  // Summary assignment is deliberately not a child assignment.
  await f.mutate(`/tasks/${f.parentTask.taskId}/assignments`, { catalogRevision: catalog.data.revision, targets: [{ kind: "resource", id: charlie.id }] }, "put");
  for (const row of [
    { code: "UNIT-A", name: "AMR 단품 A", equipmentType: "amr", managementUnit: "unit", quantity: 1, model: "A10" },
    { code: "FLEET-B", name: "AMR Fleet B", equipmentType: "amr", managementUnit: "fleet", quantity: 9, model: "" },
    { code: "IDLE-C", name: "업무 없는 Conveyor", equipmentType: "conveyor", managementUnit: "unit", quantity: 1, model: "C20" },
  ]) await f.mutate("/logistics/equipment", { processId: f.processIds[0], ...row });
  const equipment = (await f.snapshot()).data.logistics!.equipment;
  const unit = equipment.find(row => row.code === "UNIT-A")!;
  const fleet = equipment.find(row => row.code === "FLEET-B")!;
  const idle = equipment.find(row => row.code === "IDLE-C")!;
  await f.mutate(`/tasks/${f.parentTask.taskId}/logistics-links`, { equipmentLinks: [{ equipmentId: unit.id, scope: "subtree" }], systemLinks: [] }, "put");
  await f.mutate(`/tasks/${f.task.taskId}/logistics-links`, { equipmentLinks: [{ equipmentId: unit.id, scope: "self" }, { equipmentId: fleet.id, scope: "self" }], systemLinks: [] }, "put");
  const legacy = (await f.seedLegacy("/logistics/targets", { code: "ARCHIVE-880", name: "기존 호환 연결", scope: "process",
    projectProcessId: f.processIds[0], members: [{ kind: "equipment", entityId: unit.id }] })) as LogisticsTargetMutationResponse;
  await f.seedLegacy(`/tasks/${f.task.taskId}/target-bindings`, { bindings: [{ targetId: legacy.data.target!.id, scope: "self", selection: "whole", memberIds: [] }] }, "put");
  await page.reload();
  return { ...f, groupOnly, unassigned, ungrouped, alice, bob, charlie, g1, g2, unit, fleet, idle };
}

/** A single existing import transaction prepares the large read-only population. */
export async function addScheduleViewPopulation(page: Page, origin: string, api: string, count: number) {
  const payload = JSON.stringify({ schemaVersion: "1.1", project: { name: "Virtual population", description: "" },
    tasks: [{ externalId: "VIEW880-ROOT", name: "가상화 조회 범위", type: "summary", parentExternalId: null, predecessors: [] },
      ...Array.from({ length: count }, (_, index) => ({ externalId: `VIEW880-${index}`, name: `가상화 작업 ${String(index).padStart(3, "0")}`,
        type: "task", parentExternalId: "VIEW880-ROOT", requestedStart: index === 0 ? "2026-10-14" : "2027-04-05", duration: 2, progress: 0, status: "not_started", predecessors: [] }))] });
  const preview = await page.request.post(`${api}/imports/preview`, { headers: { Origin: origin, "Content-Type": "application/json" }, data: payload });
  expect(preview.status(), await preview.text()).toBe(200);
  const previewData = (await preview.json()).data;
  const response = await page.request.post(`${api}/imports`, {
    headers: { Origin: origin, "Content-Type": "application/json", "If-Match": `"${previewData.baseRevision}"`, "X-Import-Preview-Digest": previewData.previewDigest }, data: payload,
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as ProjectSnapshotResponse;
}
