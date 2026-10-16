import { expect, type Page, type APIResponse } from "@playwright/test";
import type { ProjectMasterAdminResponse } from "../../../src/contracts/project-master";
import type { ProcessCatalogResponse } from "../../../src/contracts/process-catalog";
import type { CreateProjectResponse, ProjectSnapshotResponse, TaskMutationResponse } from "../../../src/contracts/projects";
import type { LogisticsMutationResponse } from "../../../src/contracts/logistics";

export const targetMasterPassword = "TargetAdm1!";

async function successful(response: APIResponse) {
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(true);
  return response;
}

/** Real HTTP setup: no mocked Target, binding, Task, or persistence responses. */
export async function createTargetProject(page: Page, origin: string) {
  const headers = { Origin: origin };
  await successful(await page.request.post(`${origin}/api/project-master/admin-sessions`, { headers, data: { password: targetMasterPassword } }));
  let masters = await (await successful(await page.request.get(`${origin}/api/project-master/admin/items`))).json() as ProjectMasterAdminResponse;
  const ids: string[] = [];
  for (const [category, code, name] of [["BUSINESS_UNIT", "BU", "물류사업부"], ["PRODUCT", "P", "통합 제품"], ["SITE_ENTITY", "S", "서울 사업장"]]) {
    masters = await (await successful(await page.request.post(`${origin}/api/project-master/admin/items`, {
      headers: { ...headers, "If-Match": `"${masters.data.revision}"` }, data: { category, code, name },
    }))).json() as ProjectMasterAdminResponse;
    ids.push(masters.data.items.find(item => item.category === category && item.code === code)!.id);
  }
  const [businessUnitId, productId, siteEntityId] = ids;
  for (const site of [undefined, siteEntityId]) {
    masters = await (await successful(await page.request.post(`${origin}/api/project-master/admin/relations`, {
      headers: { ...headers, "If-Match": `"${masters.data.revision}"` }, data: { businessUnitId, productId, ...(site ? { siteEntityId: site } : {}) },
    }))).json() as ProjectMasterAdminResponse;
  }
  let catalog = await (await successful(await page.request.get(`${origin}/api/process-catalog/admin`))).json() as ProcessCatalogResponse;
  const catalogWrite = async (path: string, data: object) => {
    catalog = await (await successful(await page.request.post(`${origin}/api/process-catalog/admin/${path}`, {
      headers: { ...headers, "If-Match": `"${catalog.data.processCatalogRevision}"` }, data,
    }))).json() as ProcessCatalogResponse;
  };
  await catalogWrite("types", { code: "ASSEMBLY", name: "조립 공정" });
  const processTypeId = catalog.data.types[0].id;
  for (const code of ["A", "B"]) await catalogWrite("occurrences", { businessUnitId, productId, siteEntityId, processTypeId, code, name: `${code} 공정` });
  const occurrenceA = catalog.data.occurrences.find(row => row.code === "A")!;
  await catalogWrite("work-areas", { occurrenceId: occurrenceA.id, code: "WA-A", name: "A 작업구역" });
  const created = await (await successful(await page.request.post(`${origin}/api/projects`, { headers, data: {
    name: "Target F4 실제 API 검증", description: "", ownerName: "E2E 자동화", editPassword: "EditPwd1234!", businessUnitId, productId, siteEntityId,
  } }))).json() as CreateProjectResponse;
  const publicId = created.data.project.publicId;
  const api = `${origin}/api/projects/${publicId}`;
  const snapshot = async () => await (await successful(await page.request.get(api))).json() as ProjectSnapshotResponse;
  const mutate = async (path: string, data: object, method = "post") => {
    const current = await snapshot();
    return successful(await page.request.fetch(`${api}${path}`, { method, headers: { ...headers, "If-Match": `"${current.data.project.revision}"` }, data }));
  };
  const processIds: string[] = [];
  for (const code of ["A", "B"]) {
    const process = await (await mutate("/logistics/processes", { name: `${code} 공정` })).json() as LogisticsMutationResponse;
    const processId = process.data.logistics.processes.find(row => row.name === `${code} 공정`)!.id;
    processIds.push(processId);
    await mutate(`/logistics/process-mappings/${processId}`, { processCatalogRevision: catalog.data.processCatalogRevision, occurrenceId: catalog.data.occurrences.find(row => row.code === code)!.id }, "put");
  }
  const parent = await (await mutate("/tasks", { name: "관리 Summary", type: "summary" })).json() as TaskMutationResponse;
  const parentTask = parent.data.tasks.find(row => row.name === "관리 Summary")!;
  const child = await (await mutate("/tasks", { name: "통합 시운전", type: "task", parentTaskId: parentTask.taskId, start: "2026-10-14", duration: 2, progress: 0 })).json() as TaskMutationResponse;
  const task = child.data.tasks.find(row => row.name === "통합 시운전")!;
  await page.goto(`${origin}/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  return { publicId, api, origin, snapshot, mutate, processIds, task, parentTask, catalog };
}
