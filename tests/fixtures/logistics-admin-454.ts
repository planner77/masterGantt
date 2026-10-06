import type { Page } from "@playwright/test";
import type { LogisticsTypeCatalogResponse } from "../../src/contracts/logistics";

export function logistics454Catalog(): LogisticsTypeCatalogResponse {
  return { data: { revision: 7, equipmentTypes: [
    { code: "agv", name: "AGV", active: true, sortOrder: 0, usageCount: 0 },
    { code: "long-equipment" + "abcdefghij".repeat(5), name: "긴 한글 물류 설비 유형 표시명으로 열 너비와 줄바꿈을 비교합니다 Long English Equipment Display Name for Stable Table Geometry", active: true, sortOrder: 1, usageCount: 12345 },
    { code: "legacy-equipment", name: "비활성 설비 Existing Inactive Equipment", active: false, sortOrder: 2, usageCount: 2 },
  ], systemTypes: [
    { code: "mcs", name: "MCS", active: true, sortOrder: 0, usageCount: 0 },
    { code: "long-system-" + "abcdefghij".repeat(5), name: "긴 한글 통합 조율 시스템 유형 표시명 Long English System Type Name with Multiple Words for Density Comparison", active: true, sortOrder: 1, usageCount: 12345 },
    { code: "legacy-system", name: "비활성 시스템 Existing Inactive System", active: false, sortOrder: 2, usageCount: 2 },
  ] } };
}

export async function mockLogistics454(page: Page) {
  const catalog = logistics454Catalog();
  const requests: Array<{ method: string; path: string; ifMatch: string | undefined; body: unknown }> = [];
  const control = { nextReadStatus: 200, nextMutationStatus: 200, networkMutation: false, malformedMutation: false, holdMutation: false, holdRead: false };
  let releaseMutation: (() => void) | null = null;
  let releaseRead: (() => void) | null = null;
  await page.route("**/api/logistics-catalog/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    requests.push({ method: req.method(), path, ifMatch: req.headers()["if-match"], body: req.postDataJSON() });
    if (path.endsWith("admin-sessions")) {
      await route.fulfill({ status: req.method() === "POST" ? 201 : 200, json: { data: { permission: "logistics_catalog_admin" } } });
      return;
    }
    if (req.method() === "GET") {
      if (control.holdRead) await new Promise<void>(resolve => { releaseRead = resolve; });
      const status = control.nextReadStatus; control.nextReadStatus = 200;
      await route.fulfill({ status, json: status === 200 ? catalog : { error: { code: status === 401 ? "UNAUTHORIZED" : "TEMPORARY_FAILURE" } } }); return;
    }
    if (control.holdMutation) await new Promise<void>(resolve => { releaseMutation = resolve; });
    if (control.networkMutation) { control.networkMutation = false; await route.abort("failed"); return; }
    const status = control.nextMutationStatus; control.nextMutationStatus = 200;
    if (status !== 200) {
      if (status === 412) catalog.data.revision += 1;
      await route.fulfill({ status, json: { error: { code: status === 412 ? "REVISION_MISMATCH" : status === 401 ? "UNAUTHORIZED" : "INVALID_INPUT" } } }); return;
    }
    if (control.malformedMutation) { control.malformedMutation = false; await route.fulfill({ status: 200, json: { invalid: true } }); return; }
    if (path.endsWith("admin-password")) { await route.fulfill({ status: 200, json: { data: { changed: true } } }); return; }
    const items = path.includes("equipment-types") ? catalog.data.equipmentTypes : catalog.data.systemTypes;
    const body = req.postDataJSON() as { code?: string; name?: string; sortOrder?: number; active?: boolean };
    if (req.method() === "POST") items.push({ code: body.code!, name: body.name!, sortOrder: body.sortOrder!, active: true, usageCount: 0 });
    else {
      const item = items.find(item => item.code === decodeURIComponent(path.split("/").at(-1)!))!;
      if (body.name !== undefined) item.name = body.name;
      if (body.active !== undefined) item.active = body.active;
    }
    catalog.data.revision += 1;
    await route.fulfill({ status: req.method() === "POST" ? 201 : 200, json: catalog });
  });
  return { catalog, requests, control, releaseMutation: () => { control.holdMutation = false; releaseMutation?.(); }, releaseRead: () => { control.holdRead = false; releaseRead?.(); } };
}

export async function loginLogistics454(page: Page) {
  await page.goto("/logistics-admin");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("synthetic-admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "유형 추가", exact: true }).waitFor();
}
