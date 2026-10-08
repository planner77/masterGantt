import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../src/contracts/projects";
const password = "Synthetic525Admin!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: password, viewport: { width: 1440, height: 900 } });

test("#526 실제 SQLite/HTTP 세 계층·비교표·선택 진척과 전체 Gate", async ({ page, baseURL, browser }, testInfo) => {
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
  const second = await add("두 번째 Milestone", "milestone");
  await mutate("/milestone-memberships", { changes: [{ taskId: unset.taskId, milestoneTaskId: second.taskId }, { taskId: unassigned.taskId, milestoneTaskId: milestone.taskId }] });
  await mutate(`/tasks/${shared.taskId}`, { progress: 100 }, "patch");
  await mutate("/links", { predecessorExternalId: second.externalId, successorExternalId: milestone.externalId, type: "FS", lag: 0 }, "post", 201);
  const parentResponse = await mutate("/tasks", { name: "상속 Summary", type: "summary" }, "post", 201); const parent = (await parentResponse.json()).data.tasks.find((t: ProjectTaskDto) => t.name === "상속 Summary") as ProjectTaskDto;
  const inheritedResponse = await mutate("/tasks", { name: "상속 작업", type: "task", start: "2026-10-05", duration: 2, progress: 100, parentTaskId: parent.taskId }, "post", 201); const inherited = (await inheritedResponse.json()).data.tasks.find((t: ProjectTaskDto) => t.name === "상속 작업") as ProjectTaskDto;
  const overrideResponse = await mutate("/tasks", { name: "명시 override 작업", type: "task", start: "2026-10-05", duration: 2, progress: 0, parentTaskId: parent.taskId }, "post", 201); const override = (await overrideResponse.json()).data.tasks.find((t: ProjectTaskDto) => t.name === "명시 override 작업") as ProjectTaskDto;
  await mutate("/milestone-memberships", { changes: [{ taskId: parent.taskId, milestoneTaskId: milestone.taskId }, { taskId: override.taskId, milestoneTaskId: second.taskId }] });
  for (const task of [inherited, override]) await mutate(`/tasks/${task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: r1, allocation: { start: null, end: null, percent: 50 } }] }, "put");
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const publicPage = await readonly.newPage(); await publicPage.goto(`/projects/${publicId}`); await publicPage.getByRole("tab", { name: "리소스", exact: true }).click(); const root = publicPage.locator('[data-resource-dashboard="true"]'); await expect(root).toHaveAttribute("data-ready", "true");
    await root.getByLabel("리소스 보기", { exact: true }).selectOption("tree");
    let tree = root.getByRole("region", { name: "Milestone 계층 현황", exact: true });
    await tree.getByRole("button", { name: "공동 그룹", exact: true }).click(); await tree.getByRole("button", { name: "인수 Milestone", exact: true }).click();
    await expect(tree.getByText(/선택 할당 작업 진척 100.0%/).first()).toBeVisible(); await expect(tree.getByText(/단계 전체 소속 2\/3/)).toBeVisible(); await expect(tree.getByText(/선행 차단 있음/)).toBeVisible();
    // Group children arrive asynchronously. The Milestone parent has no resourceId,
    // so target Alice's own expanded summary rather than the last summary in the tree.
    const groupChildren = tree.getByLabel("그룹 교차 개인 현황");
    const aliceButton = groupChildren.getByRole("button", { name: "개발 담당 Alice", exact: true });
    await expect(aliceButton).toBeVisible();
    await aliceButton.click();
    const aliceBranch = groupChildren.locator(":scope > .resource-milestone-node").filter({ has: aliceButton });
    const aliceTasks = aliceBranch.locator(":scope > div > .resource-milestone-summary").getByRole("button", { name: "2 Task", exact: true });
    await expect(aliceTasks).toBeVisible();
    const childResponse = publicPage.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/resource-dashboard/details") &&
        url.searchParams.get("dimension") === "group" &&
        url.searchParams.get("resourceId") === r1 &&
        url.searchParams.get("milestoneTaskId") === milestone.taskId;
    });
    await aliceTasks.click();
    const child = await childResponse;
    expect(child.status()).toBe(200);
    const body = (await child.json()).data;
    expect(body.selector).toMatchObject({ dimension: "group", id: g1, resourceId: r1, milestoneTaskId: milestone.taskId });
    expect(body.totalCount).toBe(2);
    expect(body.rows.map((row: { taskId: string }) => row.taskId)).toEqual(expect.arrayContaining([shared.taskId, inherited.taskId]));
    await root.getByRole("button", { name: "상세 닫기" }).click();
    await root.getByLabel("집계 순서", { exact: true }).selectOption("resource"); tree = root.getByRole("region", { name: "Milestone 계층 현황", exact: true }); await tree.getByRole("button", { name: "공동 그룹", exact: true }).click(); await tree.getByRole("button", { name: "개발 담당 Alice", exact: true }).click(); await tree.getByRole("button", { name: "두 번째 Milestone", exact: true }).click(); await expect(tree.locator(".resource-milestone-summary").last().getByText(/알려진 부분합/)).toBeVisible();
    await root.getByRole("button", { name: "개인", exact: true }).click(); tree = root.getByRole("region", { name: "Milestone 계층 현황", exact: true }); await tree.getByRole("button", { name: "개발 담당 Alice", exact: true }).click(); await tree.getByRole("button", { name: "인수 Milestone", exact: true }).click(); await expect(tree.getByText(/준비 전/)).toBeVisible();
    await root.getByLabel("리소스 보기", { exact: true }).selectOption("matrix"); await expect(root.getByRole("region", { name: "개인 Milestone 비교표", exact: true }).locator("tbody tr")).toHaveCount(2); await expect(root.getByRole("region", { name: "개인 Milestone 비교표", exact: true }).getByText("대상 없음").first()).toBeVisible();
    await root.getByLabel("Milestone", { exact: true }).selectOption(milestone.taskId); await expect(root).toHaveAttribute("data-ready", "true"); const summaries = root.getByLabel("Milestone 선택과 기준 범위"); await expect(summaries).toContainText("선택 Milestone 범위"); await expect(summaries).toContainText("선택에서 제외된 배정"); const excluded = summaries.locator("div").filter({ has: publicPage.locator("dt", { hasText: "선택에서 제외된 배정" }) }); const response = publicPage.waitForResponse(r => r.url().includes("/resource-dashboard/details?")); await excluded.getByRole("button", { name: "2 Task", exact: true }).click(); const excludedBody = await (await response).json(); expect(excludedBody.data.selector.assignmentScope).toBe("milestoneExcluded"); expect(excludedBody.data.rows.map((row: { taskId: string }) => row.taskId)).toEqual(expect.arrayContaining([unset.taskId, override.taskId]));
    // A separate Assignment-grain drill is required for the exact excluded effort,
    // including partial/unset allocations. Task-grain detail cannot substitute it.
    await root.getByRole("button", { name: "상세 닫기" }).click();
    const assignmentResponse = publicPage.waitForResponse(r => {
      const url = new URL(r.url());
      return url.pathname.endsWith("/resource-dashboard/details") &&
        url.searchParams.get("assignmentScope") === "milestoneExcluded" &&
        url.searchParams.get("view") === "assignments";
    });
    await excluded.getByRole("button", { name: /선택에서 제외된 배정.*2 Assignment 상세/ }).click();
    const exactAssignments = (await (await assignmentResponse).json()).data;
    expect(exactAssignments.selector.assignmentScope).toBe("milestoneExcluded");
    expect(exactAssignments.view).toBe("assignments");
    expect(exactAssignments.totalCount).toBe(2);
    expect(exactAssignments.rows.every((row: { assignment: unknown }) => row.assignment !== null)).toBe(true);
    expect(exactAssignments.rows.map((row: { taskId: string }) => row.taskId))
      .toEqual(expect.arrayContaining([unset.taskId, override.taskId]));
    await root.getByRole("button", { name: "상세 닫기" }).click();
    expect(await readonly.cookies()).toEqual([]); expect((await get()).data.project.revision).toBe(snapshot.data.project.revision); await testInfo.attach("actual-526-projection", { body: JSON.stringify({ projectPublicId: publicId, revision: snapshot.data.project.revision, groupChild: body, excluded: excludedBody.data }), contentType: "application/json" });
  } finally { await readonly.close(); }
});
