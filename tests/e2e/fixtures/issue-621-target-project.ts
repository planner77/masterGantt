import type { Page } from "@playwright/test";
import type { LogisticsTargetMutationResponse } from "../../../src/contracts/logistics-targets";
import type { ResourceDashboardDto, ResourceDashboardDetailsDto } from "../../../src/contracts/resource-dashboard";
import type { TaskMutationResponse } from "../../../src/contracts/projects";
import { expect } from "./isolated-application";
import { createTargetProject } from "./target-project";

export const issue621ResourcePassword = "Resource621Synthetic!";
export async function seedIssue621(page: Page, origin: string, wide = false) {
  const f = await createTargetProject(page, origin);
  const targets = [];
  for (const [index, code] of (wide ? ["A", "B", "C", "D", "E"] : ["A", "B"]).entries()) {
    const response = await f.mutate("/logistics/targets", {
      code: `TARGET-${code}`, name: `Target ${code} · 긴 물류 설비 통합 제어 대상 이름`, scope: "process", projectProcessId: f.processIds[index % 2],
      ...(index === 0 ? { workAreaId: f.catalog.data.workAreas[0].id } : {}),
      members: [{ kind: "system", create: { code: `ACS-${code}`, name: `제어 시스템 ${code}`, systemType: "acs", layer: "controller", scope: "project" } }],
    });
    targets.push(((await response.json()) as LogisticsTargetMutationResponse).data.target!);
  }
  await f.mutate(`/tasks/${f.task.taskId}/target-bindings`, { bindings: targets.map(target => ({ targetId: target.id, scope: "self", selection: "whole", memberIds: [] })) }, "put");
  expect((await page.request.post(`${origin}/api/resource-catalog/admin-sessions`, { headers: { Origin: origin }, data: { password: issue621ResourcePassword } })).status()).toBe(201);
  let catalog = (await (await page.request.get(`${origin}/api/resources`)).json()).data;
  const write = async (path: string, data: object, method = "post") => {
    const response = await page.request.fetch(`${origin}${path}`, { method, headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data });
    expect(response.ok(), await response.text()).toBe(true);
    catalog = (await response.json()).data;
  };
  const resources = [];
  for (const code of ["ALICE", "BOB"]) {
    await write("/api/resources", { code, name: `${code} · 긴 공동 담당 리소스 이름`, roles: ["DEVELOPER"], developerGrade: "ADVANCED" });
    resources.push(catalog.resources.find((row: { code: string }) => row.code === code));
  }
  for (const code of ["G1", "G2"]) {
    await write("/api/resource-groups", { code, name: `${code} · 겹치는 공동 그룹 긴 이름` });
    const group = catalog.groups.find((row: { code: string }) => row.code === code);
    await write(`/api/resource-groups/${group.id}/members`, { resourceIds: resources.map(row => row.id) }, "put");
  }
  await f.mutate(`/tasks/${f.task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: resources.map((resource, index) => ({ kind: "resource", id: resource.id, allocation: { start: null, end: null, percent: index === 0 ? 100 : 50 } })) }, "put");
  const added = (await (await f.mutate("/tasks", { name: "A 공수 미설정 작업", type: "task", start: "2026-10-14", duration: 2, progress: 0 })).json()) as TaskMutationResponse;
  const unset = added.data.tasks.find(task => task.name === "A 공수 미설정 작업")!;
  await f.mutate(`/tasks/${unset.taskId}/target-bindings`, { bindings: [{ targetId: targets[0].id, scope: "self", selection: "whole", memberIds: [] }] }, "put");
  await f.mutate(`/tasks/${unset.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: resources[0].id }] }, "put");
  const query = new URLSearchParams({ from: "2026-10-14", to: "2026-10-15", mdPerMm: "null", projectionOrder: "group,resource,target" });
  const report = async (extra: Record<string, string> = {}) => {
    const response = await page.request.get(`${f.api}/resource-dashboard?${new URLSearchParams({ ...Object.fromEntries(query), ...extra })}`);
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()).data as ResourceDashboardDto;
  };
  const details = async (data: ResourceDashboardDto, extra: Record<string, string> = {}) => {
    const response = await page.request.get(`${f.api}/resource-dashboard/details?${new URLSearchParams({ ...Object.fromEntries(query), snapshotId: data.snapshotId, dimension: "all", view: "assignments", ...extra })}`);
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()).data as ResourceDashboardDetailsDto;
  };
  await page.reload();
  return { ...f, targets, resources, report, details, unset };
}
