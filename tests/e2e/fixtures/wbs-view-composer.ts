import { expect, type Page } from "@playwright/test";
import { createTargetProject } from "./target-project";
import type { ObserveIsolatedApi } from "./isolated-application-diagnostics";
import type { TaskMutationResponse } from "../../../src/contracts/projects";

export const viewResourcePassword = "Synthetic730Only!";

/** Real HTTP/SQLite fixture: no successful report, details or mutation is mocked. */
export async function seedWbsViewComposer(page: Page, origin: string, observeApi: ObserveIsolatedApi) {
  const f = await createTargetProject(page, origin, observeApi);
  await f.mutate("/work-calendar", { countryRules: [], customDates: [] }, "put");
  await f.mutate("/logistics/equipment", { processId: f.processIds[0], code: "E10", name: "다공정 장거리 통합 반송 설비 Long operational equipment name", equipmentType: "amr", managementUnit: "fleet", quantity: 123456789 });
  await f.mutate("/logistics/equipment", { processId: f.processIds[1], code: "IDLE", name: "등록만 설비", equipmentType: "amr", managementUnit: "fleet", quantity: 7 });
  await f.mutate("/logistics/systems", { code: "ACS", name: "통합 시스템", systemType: "acs", layer: "controller", scope: "processes", processIds: f.processIds });
  const logistics = (await f.snapshot()).data.logistics!;
  const equipment = logistics.equipment.find(row => row.code === "E10")!;
  const system = logistics.systems.find(row => row.code === "ACS")!;
  await f.mutate(`/tasks/${f.task.taskId}/logistics-links`, { equipmentLinks: [{ equipmentId: equipment.id, scope: "self" }], systemLinks: [{ systemId: system.id, scope: "self" }] }, "put");
  const workArea = f.catalog.data.workAreas.find(row => row.code === "WA-A")!;
  await f.mutate(`/tasks/${f.task.taskId}/process-context`, { processCatalogRevision: f.catalog.data.processCatalogRevision, processLinks: f.processIds.map(processId => ({ processId, scope: "self" })), workAreaLinks: [{ processId: f.processIds[0], workAreaId: workArea.id, scope: "self" }] }, "put");
  const milestoneResponse = await (await f.mutate("/tasks", { name: "인수 Milestone", type: "milestone", start: "2026-10-14", duration: 0, progress: 0 })).json() as TaskMutationResponse;
  const milestone = milestoneResponse.data.tasks.find(row => row.name === "인수 Milestone")!;
  await f.mutate("/milestone-memberships", { changes: [{ taskId: f.task.taskId, milestoneTaskId: milestone.taskId }] });
  await f.mutate("/tasks", { name: "미배정 작업", type: "task", start: "2026-10-14", duration: 2, progress: 0 });
  const admin = await page.request.post(`${origin}/api/resource-catalog/admin-sessions`, { headers: { Origin: origin }, data: { password: viewResourcePassword } });
  expect(admin.status()).toBe(201);
  let catalog = (await (await page.request.get(`${origin}/api/resources`)).json()).data;
  const created = await page.request.post(`${origin}/api/resources`, { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data: { code: "R730", name: "공동 담당 인력", roles: ["DEVELOPER"], developerGrade: "ADVANCED" } });
  expect(created.status()).toBe(201);
  catalog = (await created.json()).data;
  const resource = catalog.resources.find((row: { code: string }) => row.code === "R730") as { id: string; name: string };
  await f.mutate(`/tasks/${f.task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: resource.id, allocation: { start: null, end: null, percent: 100 } }] }, "put");
  const assignment = (await f.snapshot()).data.assignments!.find(row => row.taskId === f.task.taskId && row.target.kind === "resource" && row.target.id === resource.id)!;
  expect(assignment.id).toBeTruthy();
  await page.reload();
  return { ...f, equipment, system, milestone, resource, workArea, assignment };
}
