import { ISSUE_623_TARGET_RESOURCE as oracle } from "../../fixtures/issue-623-target-resource";
import type { Page } from "@playwright/test";
import { expect } from "./isolated-application";
import { createTargetProject } from "./target-project";
import { issue621ResourcePassword } from "./issue-621-target-project";
import type { LogisticsTargetDto, LogisticsTargetMutationResponse } from "../../../src/contracts/logistics-targets";
import type { ProjectMasterAdminResponse } from "../../../src/contracts/project-master";
import type { ProcessCatalogResponse } from "../../../src/contracts/process-catalog";
import type { ResourceDashboardDto, ResourceDashboardDetailsDto } from "../../../src/contracts/resource-dashboard";

/** Cumulative real HTTP fixture; logical F0 codes map to canonical server UUIDs. */
export async function seedIssue623(page: Page, origin: string, wide = false) {
  const f = await createTargetProject(page, origin);
  // F0 explicitly uses five weekdays; do not inherit the default KR holiday rule.
  await f.mutate("/work-calendar", { countryRules: [], customDates: [] }, "put");
  let masters = (await (await page.request.get(`${origin}/api/project-master/admin/items`)).json()) as ProjectMasterAdminResponse;
  const masterWrite = async (path: string, data: object) => {
    const response = await page.request.post(`${origin}/api/project-master/admin/${path}`, { headers: { Origin: origin, "If-Match": `"${masters.data.revision}"` }, data });
    expect(response.ok(), await response.text()).toBe(true); masters = await response.json();
  };
  const businessUnitId = masters.data.items.find(item => item.category === "BUSINESS_UNIT")!.id;
  const productId = masters.data.items.find(item => item.category === "PRODUCT")!.id;
  const siteA = masters.data.items.find(item => item.category === "SITE_ENTITY")!.id;
  await masterWrite("items", { category: "SITE_ENTITY", code: "SITE-B", name: "제2 사업장" });
  const siteB = masters.data.items.find(item => item.code === "SITE-B")!.id;
  await masterWrite("relations", { businessUnitId, productId, siteEntityId: siteB });
  let processes = (await (await page.request.get(`${origin}/api/process-catalog/admin`)).json()) as ProcessCatalogResponse;
  const processWrite = async (path: string, data: object) => {
    const response = await page.request.post(`${origin}/api/process-catalog/admin/${path}`, { headers: { Origin: origin, "If-Match": `"${processes.data.processCatalogRevision}"` }, data });
    expect(response.ok(), await response.text()).toBe(true); processes = await response.json();
  };
  await processWrite("standards", { code: "STD", name: "제품 표준 조립", productId, processTypeId: processes.data.types[0].id });
  const standardId = processes.data.standards[0].id;
  for (const siteEntityId of [siteA, siteB]) await processWrite("occurrences/apply-standard", { businessUnitId, productId, siteEntityId, standardIds: [standardId] });
  const standards = processes.data.occurrences.filter(item => item.standardProcessId === standardId);
  expect(standards.map(item => item.siteEntityId).sort()).toEqual([siteA, siteB].sort());
  // A is a site addition with optional WorkArea; B uses the product standard.
  await f.mutate(`/logistics/process-mappings/${f.processIds[1]}`, { processCatalogRevision: processes.data.processCatalogRevision, occurrenceId: standards.find(item => item.siteEntityId === siteA)!.id }, "put");
  const targets: LogisticsTargetDto[] = [];
  for (const [index, code] of (wide ? ["A", "B", "C", "D", "E"] : ["A", "B"]).entries()) {
    const sharedMcs = targets[0]?.members.find(member => member.code === "MCS-1");
    const response = await f.mutate("/logistics/targets", { code: `TARGET-${code}`, name: `Target ${code} · 긴 물류 설비 통합 제어 대상 이름`, scope: "process", projectProcessId: f.processIds[index % 2], ...(index === 0 ? { workAreaId: f.catalog.data.workAreas[0].id } : {}), members: [
      { kind: "equipment", create: { code: `AMR-${code}`, name: `AMR ${code}`, equipmentType: "amr", managementUnit: "fleet", quantity: index === 0 ? 10 : 5 } },
      { kind: "system", create: { code: `ACS-${code}`, name: `ACS ${code}`, systemType: "acs", layer: "controller", scope: "project" } },
      sharedMcs ? { kind: "system", entityId: sharedMcs.entityId } : { kind: "system", create: { code: "MCS-1", name: "공유 MCS", systemType: "mcs", layer: "coordinator", scope: "project" } },
    ] });
    targets.push(((await response.json()) as LogisticsTargetMutationResponse).data.target!);
  }
  await f.mutate(`/tasks/${f.task.taskId}`, { name: "SHARED · 통합 시운전", start: oracle.from, duration: 5 }, "patch");
  const bind = (targetId: string, scope: "self" | "subtree" = "self") => ({ targetId, scope, selection: "whole", memberIds: [] });
  await f.mutate(`/tasks/${f.parentTask.taskId}/target-bindings`, { bindings: [bind(targets[0].id, "subtree")] }, "put");
  await f.mutate(`/tasks/${f.task.taskId}/target-bindings`, { bindings: targets.map(target => bind(target.id)) }, "put");
  const added = await (await f.mutate("/tasks", { name: "ACS_ONLY", type: "task", start: oracle.from, duration: 5, progress: 0 })).json();
  const acsTask = added.data.tasks.find((task: { name: string }) => task.name === "ACS_ONLY");
  await f.mutate(`/tasks/${acsTask.taskId}/target-bindings`, { bindings: [{ targetId: targets[0].id, scope: "self", selection: "subset", memberIds: [targets[0].members.find(member => member.code === "ACS-A")!.id] }] }, "put");
  expect((await page.request.post(`${origin}/api/resource-catalog/admin-sessions`, { headers: { Origin: origin }, data: { password: issue621ResourcePassword } })).status()).toBe(201);
  let resources = (await (await page.request.get(`${origin}/api/resources`)).json()).data;
  const resourceWrite = async (path: string, data: object, method = "post") => {
    const response = await page.request.fetch(`${origin}${path}`, { method, headers: { Origin: origin, "If-Match": `"${resources.revision}"` }, data });
    expect(response.ok(), await response.text()).toBe(true); resources = (await response.json()).data;
  };
  await resourceWrite("/api/resources", { code: "R1", name: "R1 · 긴 공동 담당 리소스 이름", roles: ["DEVELOPER"], developerGrade: "ADVANCED" });
  const person = resources.resources.find((resource: { code: string }) => resource.code === "R1");
  for (const code of ["G1", "G2"]) {
    await resourceWrite("/api/resource-groups", { code, name: `${code} · 겹치는 공동 그룹 긴 이름` });
    const group = resources.groups.find((row: { code: string }) => row.code === code);
    await resourceWrite(`/api/resource-groups/${group.id}/members`, { resourceIds: [person.id] }, "put");
  }
  await f.mutate(`/tasks/${f.task.taskId}/assignments`, { catalogRevision: resources.revision, targets: [{ kind: "resource", id: person.id, allocation: { start: null, end: null, percent: 100 } }] }, "put");
  const query = { from: oracle.from, to: oracle.to, asOfDate: oracle.asOfDate, mdPerMm: String(oracle.mdPerMm), taskIds: f.task.taskId, projectionOrder: "group,resource,target" };
  const report = async (extra: Record<string, string> = {}) => {
    const response = await page.request.get(`${f.api}/resource-dashboard?${new URLSearchParams({ ...query, ...extra })}`);
    expect(response.status(), await response.text()).toBe(200); return (await response.json()).data as ResourceDashboardDto;
  };
  const details = async (data: ResourceDashboardDto, extra: Record<string, string> = {}) => {
    const response = await page.request.get(`${f.api}/resource-dashboard/details?${new URLSearchParams({ ...query, snapshotId: data.snapshotId, dimension: "all", view: "assignments", ...extra })}`);
    expect(response.status(), await response.text()).toBe(200); return (await response.json()).data as ResourceDashboardDetailsDto;
  };
  await page.reload();
  return { ...f, targets, person, acsTask, report, details, standards, siteA, siteB, standardId };
}
