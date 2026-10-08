import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../src/contracts/projects";
import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
const password = "Synthetic525Admin!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: password, viewport: { width: 1440, height: 900 } });

test("#525 실제 비빈 SQLite/HTTP 공동 Task·중첩 분류·미설정·진단·snapshot 복구", async ({ page, baseURL, browser }, testInfo) => {
  test.setTimeout(180_000);
  const origin = baseURL!;
  const created = await page.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Resource Dashboard #525", ownerName: "E2E 자동화", description: "실제 비빈 Dashboard fixture", editPassword: "UI525!" } }); expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string, api = `/api/projects/${publicId}`;
  const get = async () => (await (await page.request.get(api)).json()) as ProjectSnapshotResponse;
  let snapshot = await get();
  const headers = () => ({ Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` });
  const mutate = async (path: string, data: unknown, method: "post" | "put" | "patch" = "post", expected = 200) => { const response = await page.request[method](`${api}${path}`, { headers: headers(), data }); expect(response.status(), await response.text()).toBe(expected); snapshot = await get(); return response; };
  const add = async (name: string, type: "task" | "milestone" = "task") => { const response = await mutate("/tasks", { name, type, start: "2026-10-05", duration: type === "task" ? 4 : 0, progress: 0 }, "post", 201); return (await response.json()).data.tasks.find((task: ProjectTaskDto) => task.name === name) as ProjectTaskDto; };
  const shared = await add("공동 담당 작업"), unset = await add("공수 미설정 작업"), unassigned = await add("완전 미할당 작업"), groupOnly = await add("Group만 지정 작업"), milestone = await add("인수 Milestone", "milestone");
  await mutate("/milestone-memberships", { changes: [{ taskId: shared.taskId, milestoneTaskId: milestone.taskId }] });
  expect((await page.request.post("/api/resource-catalog/admin-sessions", { headers: { Origin: origin }, data: { password } })).status()).toBe(201);
  let catalog = (await (await page.request.get("/api/resources")).json()).data;
  const catalogMutate = async (path: string, data: unknown, method: "post" | "put" | "patch" = "post", expected = 201) => { const response = await page.request[method](path, { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data }); expect(response.status(), await response.text()).toBe(expected); catalog = (await response.json()).data; };
  await catalogMutate("/api/resources", { name: "개발 담당 Alice", code: "R-A", roles: ["PI", "DEVELOPER"], developerGrade: "ADVANCED" }); const r1 = catalog.resources.find((resource: { code: string }) => resource.code === "R-A").id as string;
  await catalogMutate("/api/resources", { name: "설비 담당 Bob", code: "R-B", roles: ["EQUIPMENT_OWNER"] }); const r2 = catalog.resources.find((resource: { code: string }) => resource.code === "R-B").id as string;
  await catalogMutate("/api/resource-groups", { name: "공동 그룹", code: "G-A" }); const g1 = catalog.groups.find((group: { code: string }) => group.code === "G-A").id as string;
  await catalogMutate("/api/resource-groups", { name: "개발 그룹", code: "G-B" }); const g2 = catalog.groups.find((group: { code: string }) => group.code === "G-B").id as string;
  await catalogMutate(`/api/resource-groups/${g1}/members`, { resourceIds: [r1, r2] }, "put", 200); await catalogMutate(`/api/resource-groups/${g2}/members`, { resourceIds: [r1] }, "put", 200);
  await mutate(`/tasks/${shared.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: r1, allocation: { start: null, end: null, percent: 50 } }, { kind: "resource", id: r2, allocation: { start: null, end: null, percent: 33.333333 } }] }, "put");
  await mutate(`/tasks/${unset.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: r1 }] }, "put");
  await mutate(`/tasks/${groupOnly.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "group", id: g1 }] }, "put");
  const reportResponse = await page.request.get(`${api}/resource-dashboard?mode=group`); expect(reportResponse.status()).toBe(200); const report = (await reportResponse.json()).data as ResourceDashboardDto;
  expect(report.summary.taskCount).toBe(2); expect(report.summary.resourceCount).toBe(2); expect(report.summary.assignmentCount).toBe(3); expect(report.summary.effort.state).toBe("partial"); expect(report.diagnostics.personallyUnassigned.count).toBe(2); expect(report.groups.reduce((sum, group) => sum + group.summary.effort.knownMd, 0)).toBeGreaterThan(report.summary.effort.knownMd);
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const publicPage = await readonly.newPage(); await publicPage.goto(`/projects/${publicId}`); await expect(publicPage.getByText("읽기 전용", { exact: true }).first()).toBeVisible(); await publicPage.getByRole("tab", { name: "리소스", exact: true }).click(); const root = publicPage.locator('[data-resource-dashboard="true"]'); await expect(root).toHaveAttribute("data-ready", "true");
    const kpis = root.getByLabel("선택 범위 KPI"); await expect(kpis).toContainText("2명"); await expect(kpis).toContainText("알려진 부분합"); await root.getByRole("button", { name: "개인", exact: true }).click(); await expect(kpis.getByRole("button", { name: "2건", exact: true })).toBeVisible();
    const detailResponse = publicPage.waitForResponse((response) => response.url().includes("/resource-dashboard/details?") && new URL(response.url()).searchParams.get("view") === "tasks"); await kpis.getByRole("button", { name: "2건", exact: true }).click(); const details = await detailResponse; expect(details.status()).toBe(200); const taskDetails = (await details.json()).data; expect(taskDetails.totalCount).toBe(2); expect(taskDetails.rows.filter((row: { taskId: string }) => row.taskId === shared.taskId)).toHaveLength(1); const selected = root.getByRole("region", { name: "선택 범위 할당 Task", exact: true }); await expect(selected.locator("tbody button").filter({ hasText: /^공동 담당 작업$/ })).toHaveCount(1); await expect(selected.getByRole("columnheader", { name: "Assignment 투입 구간" })).toHaveCount(0); await root.getByRole("button", { name: "상세 닫기" }).click();
    await root.getByRole("button", { name: "개발 담당 Alice (R-A)" }).click(); await expect(root.getByRole("columnheader", { name: "Assignment 투입 구간" })).toBeVisible(); await expect(root.locator(".resource-dashboard-detail-table tbody tr").filter({ hasText: shared.name }).getByRole("cell").last()).toContainText("인수 Milestone"); await expect(root.getByText("공수 미설정", { exact: true }).last()).toBeVisible();
    await root.getByRole("button", { name: /^필터/ }).click(); await root.getByLabel("Global Role", { exact: true }).selectOption("DEVELOPER"); await expect(root).toHaveAttribute("data-ready", "true"); await expect(kpis).toContainText("1명");
    await root.getByLabel("작업 검색", { exact: true }).fill("공수 미설정 작업"); await expect(root).toHaveAttribute("data-ready", "true"); await expect(kpis).toContainText("산정 불가 · 공수 미설정"); await expect(root.getByRole("button", { name: "M/M", exact: true })).toBeDisabled();
    await root.getByRole("button", { name: "초기화" }).click(); await expect(root).toHaveAttribute("data-ready", "true"); await root.getByText(/보조 진단 · 개인 조건/).click(); await root.getByRole("button", { name: "개인 미배정 2건", exact: true }).click(); await expect(root.locator("tbody button").filter({ hasText: /^완전 미할당 작업$/ })).toBeVisible(); await expect(root.locator("tbody button").filter({ hasText: /^Group만 지정 작업$/ })).toBeVisible(); await root.getByRole("button", { name: "상세 닫기" }).click();
    await catalogMutate(`/api/resources/${r2}`, { active: false }, "patch", 200); await root.getByRole("button", { name: "새로고침", exact: true }).click(); await expect(root).toHaveAttribute("data-ready", "true"); await expect(root.getByText("비활성 · 기존 할당")).toBeVisible();
    await mutate(`/tasks/${shared.taskId}`, { name: "외부 변경 공동 작업" }, "patch"); await root.getByRole("button", { name: "새로고침", exact: true }).click(); await expect(root).toHaveAttribute("data-ready", "false"); await root.getByRole("button", { name: "최신 일정 조회" }).click(); await expect(root).toHaveAttribute("data-ready", "true");
    expect(await readonly.cookies()).toEqual([]); const final = await get(); expect(final.data.project.revision).toBe(snapshot.data.project.revision); expect(final.data.tasks.some((task) => task.taskId === unassigned.taskId)).toBe(true);
    await testInfo.attach("actual-http-report", { body: JSON.stringify({ publicId, projectRevision: snapshot.data.project.revision, rawSummary: report.summary, diagnostics: report.diagnostics }), contentType: "application/json" });
  } finally { await readonly.close(); }
});
