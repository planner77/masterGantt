import { expect, test as playwrightTest, type Page, type APIResponse } from "@playwright/test";
import type { ProjectMasterAdminResponse } from "../../../src/contracts/project-master";
import type { ProcessCatalogResponse } from "../../../src/contracts/process-catalog";
import type { CreateProjectResponse, ProjectSnapshotResponse, TaskMutationResponse } from "../../../src/contracts/projects";
import type { LogisticsMutationResponse } from "../../../src/contracts/logistics";
import { observedReadOnlyGet, type ObserveIsolatedApi } from "./isolated-application-diagnostics";

export const targetMasterPassword = "TargetAdm1!";

async function successful(response: APIResponse) {
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(true);
  return response;
}

/** Real HTTP setup: no mocked Target, binding, Task, or persistence responses. */
export async function createTargetProject(page: Page, origin: string, observeApi: ObserveIsolatedApi) {
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
  // #624: close the canonical GET connection to avoid reusing idle pooled sockets.
  // #703: retain safe process/health diagnostics and one GET-only ECONNRESET
  // retry; other transport/HTTP failures and all writes remain fail-closed.
  const snapshot = async () => {
    // The observer receives the normalized API route, never an absolute URL or
    // credential-bearing request. All consumers must supply real E2E diagnostics.
    const response = await observedReadOnlyGet(observeApi, `/api/projects/${publicId}`, () =>
      page.request.get(api, { headers: { Connection: "close" } }));
    if (response.status() !== 200) {
      // #733 F733-005: classify the single real failed GET before asserting.
      // Never replay HTTP failures; retain only allowlisted diagnostics, not
      // IDs/URLs, response body, headers, credentials, or a raw server stack.
      const type = response.headers()["content-type"]?.toLowerCase() ?? "";
      const mediaType = type.includes("application/json") ? "application/json"
        : type.includes("text/html") ? "text/html" : "other";
      let errorCode = "NON_JSON";
      if (mediaType === "application/json") {
        const payload: unknown = await response.json().catch(() => null);
        const error = payload && typeof payload === "object" && "error" in payload
          ? payload.error : null;
        const code = error && typeof error === "object" && "code" in error
          ? error.code : null;
        errorCode = typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
          ? code : "UNCLASSIFIED";
      }
      await playwrightTest.info().attach("issue-733-project-snapshot-http-error", {
        contentType: "application/json",
        body: Buffer.from(JSON.stringify({
          route: "/api/projects/[publicId]", method: "GET",
          status: response.status(), mediaType, errorCode,
          requestIdPresent: Boolean(response.headers()["x-request-id"]),
          httpErrorRetried: false, expectedStatus: 200,
        })),
      }).catch(() => undefined);
    }
    expect(response.status()).toBe(200);
    return await (await successful(response)).json() as ProjectSnapshotResponse;
  };
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
  // #733 F733-006: retain the actual edit-mode assertion while allowing
  // bounded Next dev hydration after the real HTTP fixture setup.
  const navigation = await page.goto(`${origin}/projects/${publicId}`);
  try {
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible({ timeout: 15_000 });
  } catch (error) {
    // Sanitized diagnostics only: do not attach page HTML, URL, cookies or IDs.
    await playwrightTest.info().attach("issue-733-edit-mode-init", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({
        navigationStatus: navigation?.status() ?? null,
        navigationMediaType: navigation?.headers()["content-type"]?.split(";")[0] ?? null,
        editModeVisible: await page.getByText("편집 중", { exact: true }).isVisible().catch(() => false),
        pageReadyState: await page.evaluate(() => document.readyState).catch(() => "unknown"),
        boundedWaitMs: 15_000,
      })),
    }).catch(() => undefined);
    throw error;
  }
  return { publicId, api, origin, snapshot, mutate, processIds, task, parentTask, catalog };
}
