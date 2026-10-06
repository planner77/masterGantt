import type { Page } from "@playwright/test";
import type { ProjectMasterAdminResponse, ProjectMasterCategory } from "../../src/contracts/project-master";

export const master455Categories: Array<{ value: ProjectMasterCategory; label: string }> = [
  { value: "BUSINESS_UNIT", label: "사업부" }, { value: "PRODUCT", label: "제품" }, { value: "SITE_ENTITY", label: "사업장/법인" },
];

export function master455Catalog(): ProjectMasterAdminResponse {
  const items = master455Categories.flatMap((category, index) => [
    { id: `00000000-0000-4000-8000-${String(index * 10 + 1).padStart(12, "0")}`, category: category.value, code: `${index}-short`, name: `${category.label} A`, sortOrder: 0, active: true, usageCount: 2 },
    { id: `00000000-0000-4000-8000-${String(index * 10 + 2).padStart(12, "0")}`, category: category.value, code: `${category.value}-LONG-`.padEnd(64, "x"), name: `긴 한글 ${category.label} 기준정보 이름을 입력하는 영역과 저장 제어를 비교합니다 Long English Master Item Display Name for Stable Control Geometry`.padEnd(200, "N"), sortOrder: 1000000, active: true, usageCount: 12345 },
    { id: `00000000-0000-4000-8000-${String(index * 10 + 3).padStart(12, "0")}`, category: category.value, code: `${index}-inactive`, name: `비활성 ${category.label}`, sortOrder: 10, active: false, usageCount: 1 },
    { id: `00000000-0000-4000-8000-${String(index * 10 + 4).padStart(12, "0")}`, category: category.value, code: `${index}-unused`, name: `미사용 ${category.label}`, sortOrder: 20, active: true, usageCount: 0 },
  ]);
  for (const item of items) {
    if (Array.from(item.name).length > 200 || Array.from(item.code).length > 64 || !Number.isSafeInteger(item.sortOrder) || item.sortOrder < 0 || item.sortOrder > 1000000 || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-8[\da-f]{3}-[\da-f]{12}$/i.test(item.id)) throw new Error("Invalid #455 synthetic API fixture");
  }
  return { data: { revision: 7, items, businessUnits: items.filter(i => i.category === "BUSINESS_UNIT" && i.active), products: items.filter(i => i.category === "PRODUCT" && i.active), siteEntities: items.filter(i => i.category === "SITE_ENTITY" && i.active) } };
}

export async function mockMaster455(page: Page) {
  const catalog = master455Catalog();
  const requests: Array<{ method: string; path: string; ifMatch?: string; body: unknown }> = [];
  const replies: Array<{ status?: number; network?: boolean; malformed?: boolean; wait?: Promise<void> }> = [];
  await page.route("**/api/project-master/**", async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    requests.push({ method: req.method(), path, ifMatch: req.headers()["if-match"], body: req.postDataJSON() });
    if (path.endsWith("admin-sessions")) { await route.fulfill({ status: req.method() === "POST" ? 201 : 204, ...(req.method() === "POST" ? { json: { data: { permission: "project_master_admin", expiresAt: "2026-10-07T00:00:00.000Z" } } } : {}) }); return; }
    const reply = replies.shift();
    if (reply?.wait) await reply.wait;
    if (reply?.network) { await route.abort("failed"); return; }
    if (reply?.status && reply.status >= 400) { await route.fulfill({ status: reply.status, json: { error: { code: "SYNTHETIC_FAILURE" } } }); return; }
    if (reply?.malformed) { await route.fulfill({ status: 200, json: { data: null } }); return; }
    if (req.method() !== "GET" && !path.endsWith("admin-password")) {
      const body = req.postDataJSON();
      if (req.method() === "POST") catalog.data.items.push({ ...body, id: "00000000-0000-4000-8000-000000000099", active: true, usageCount: 0 });
      else { const item = catalog.data.items.find(item => path.endsWith(item.id)); if (item) Object.assign(item, body); }
      catalog.data.revision++;
    }
    await route.fulfill({ status: 200, json: catalog });
  });
  return { catalog, requests, replies };
}

export async function loginMaster455(page: Page) {
  await page.goto("/project-master-admin");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("synthetic-admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("tab", { name: "사업부", exact: true }).waitFor();
}
