import type { Page, Route } from "@playwright/test";
import type { ResourceCatalogResponse, ResourceDto, ResourceGroupDto } from "../../src/contracts/resources";

export async function resourceAdmin453(page: Page) {
  const resources: ResourceDto[] = Array.from({ length: 12 }, (_, index) => ({
    id: `453-r-${index}`, name: index % 2 ? `Long English Resource Identity For Comparison ${index}` : `긴 한국어 리소스 이름 역할 등급 비교 대상 ${index}`,
    code: `RESOURCE-${index}-${"LONG-CODE-".repeat(4)}`, description: "합성 관리 fixture", active: index % 3 !== 2,
    developerGrade: index % 2 ? "EXPERT" : null,
    roles: index % 3 === 0 ? [] : index % 3 === 1 ? ["DEVELOPER"] : ["PI", "DEVELOPER", "EQUIPMENT_OWNER"],
    ...(index === 3 ? {} : { projectUsageCount: index === 2 ? 3 : 0, deletable: index !== 2 }),
  }));
  const groups: ResourceGroupDto[] = Array.from({ length: 5 }, (_, index) => ({
    id: `453-g-${index}`, name: `긴 한국어 English Group Identity 구성원 관리 ${index}`, code: `GROUP-${index}-${"LONG-".repeat(8)}`,
    description: "합성 그룹", active: index !== 2, memberResourceIds: index ? [] : [resources[0].id, resources[2].id],
    projectUsageCount: index === 1 ? 2 : 0, deletable: index !== 1,
  }));
  const state = { catalog: { data: { revision: 7, resources, groups } } as ResourceCatalogResponse,
    requests: [] as Array<{ method: string; path: string; body: Record<string, unknown>; revision?: string }>, gets: 0,
    failure: null as "401" | "403" | "412" | "network" | "409" | null, gate: null as Promise<void> | null, logoutFailure: false, logoutGate: null as Promise<void> | null, logouts: 0 };
  await page.route("**/api/resource-catalog/admin-sessions", async (route) => {
    if (route.request().method() === "DELETE") { state.logouts++; if (state.logoutGate) await state.logoutGate; if (state.logoutFailure) { await route.abort(); return; } }
    await route.fulfill({ status: 204 });
  });
  const handle = async (route: Route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "GET") { state.gets++; await route.fulfill({ json: state.catalog }); return; }
    state.requests.push({ method: request.method(), path, body: request.postDataJSON() ?? {}, revision: request.headers()["if-match"] });
    if (state.gate) await state.gate;
    if (state.failure === "network") { await route.abort(); return; }
    if (state.failure) { if (state.failure === "412") state.catalog.data.revision++; await route.fulfill({ status: Number(state.failure), json: { error: { code: state.failure === "409" ? "RESOURCE_IN_USE" : "TEST_FAILURE" } } }); return; }
    const body = request.postDataJSON() as Record<string, unknown> | null;
    if (request.method() === "POST") {
      const common = { id: `453-new-${state.requests.length}`, name: String(body!.name), code: body!.code as string | null, description: "", active: true, projectUsageCount: 0, deletable: true };
      if (path === "/api/resources") resources.push({ ...common, developerGrade: body!.developerGrade as ResourceDto["developerGrade"], roles: body!.roles as ResourceDto["roles"] });
      else groups.push({ ...common, memberResourceIds: [] });
    } else if (path.endsWith("/members")) {
      const group = groups.find((entry) => path.includes(entry.id))!;
      group.memberResourceIds = body!.resourceIds as string[];
    } else {
      const items = path.startsWith("/api/resources/") ? resources : groups;
      const id = decodeURIComponent(path.split("/").at(-1)!);
      const index = items.findIndex((entry) => entry.id === id);
      if (request.method() === "DELETE") items.splice(index, 1); else Object.assign(items[index], body);
    }
    state.catalog.data.revision++;
    await route.fulfill({ json: state.catalog });
  };
  await page.route("**/api/resources", handle);
  await page.route("**/api/resources/*", handle);
  await page.route("**/api/resource-groups", handle);
  await page.route("**/api/resource-groups/**", handle);
  return state;
}

export async function loginResourceAdmin453(page: Page) {
  await page.goto("/resources");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("Synthetic453!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "새로고침", exact: true }).waitFor();
}
