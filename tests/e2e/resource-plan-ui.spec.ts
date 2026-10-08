import {
  expect,
  test,
  isolatedApplicationOptions,
} from "./fixtures/isolated-application";
import type {
  ProjectSnapshotResponse,
  ProjectTaskDto,
} from "../../src/contracts/projects";
const password = "Synthetic525Admin!";
test.use({
  ...isolatedApplicationOptions,
  isolatedResourceAdminPassword: password,
  viewport: { width: 1440, height: 900 },
});

test("#527 실제 SQLite/HTTP 선택80·Project140·Group75·일별개인과 투입", async ({
  page,
  baseURL,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const origin = baseURL!;
  const created = await page.request.post("/api/projects", {
    headers: { Origin: origin },
    data: {
      name: "Resource Dashboard #525",
      ownerName: "E2E 자동화",
      description: "실제 비빈 Dashboard fixture",
      editPassword: "UI525!",
    },
  });
  expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string,
    api = `/api/projects/${publicId}`;
  const get = async () =>
    (await (await page.request.get(api)).json()) as ProjectSnapshotResponse;
  let snapshot = await get();
  const headers = () => ({
    Origin: origin,
    "If-Match": `"${snapshot.data.project.revision}"`,
  });
  const mutate = async (
    path: string,
    data: unknown,
    method: "post" | "put" | "patch" = "post",
    expected = 200,
  ) => {
    const response = await page.request[method](`${api}${path}`, {
      headers: headers(),
      data,
    });
    expect(response.status(), await response.text()).toBe(expected);
    snapshot = await get();
    return response;
  };
  const add = async (name: string, type: "task" | "milestone" = "task") => {
    const response = await mutate(
      "/tasks",
      {
        name,
        type,
        start: "2026-10-06",
        duration: type === "task" ? 1 : 0,
        progress: 0,
      },
      "post",
      201,
    );
    return (await response.json()).data.tasks.find(
      (task: ProjectTaskDto) => task.name === name,
    ) as ProjectTaskDto;
  };
  const shared = await add("공동 담당 작업"),
    unset = await add("다른 단계 작업"),
    groupOnly = await add("Group만 지정 작업"),
    milestone = await add("인수 Milestone", "milestone");
  await add("완전 미할당 작업");
  await mutate("/milestone-memberships", {
    changes: [{ taskId: shared.taskId, milestoneTaskId: milestone.taskId }],
  });
  expect(
    (
      await page.request.post("/api/resource-catalog/admin-sessions", {
        headers: { Origin: origin },
        data: { password },
      })
    ).status(),
  ).toBe(201);
  let catalog = (await (await page.request.get("/api/resources")).json()).data;
  const catalogMutate = async (
    path: string,
    data: unknown,
    method: "post" | "put" | "patch" = "post",
    expected = 201,
  ) => {
    const response = await page.request[method](path, {
      headers: { Origin: origin, "If-Match": `"${catalog.revision}"` },
      data,
    });
    expect(response.status(), await response.text()).toBe(expected);
    catalog = (await response.json()).data;
  };
  await catalogMutate("/api/resources", {
    name: "개발 담당 Alice",
    code: "R-A",
    roles: ["PI", "DEVELOPER"],
    developerGrade: "ADVANCED",
  });
  const r1 = catalog.resources.find(
    (resource: { code: string }) => resource.code === "R-A",
  ).id as string;
  await catalogMutate("/api/resources", {
    name: "설비 담당 Bob",
    code: "R-B",
    roles: ["EQUIPMENT_OWNER"],
  });
  const r2 = catalog.resources.find(
    (resource: { code: string }) => resource.code === "R-B",
  ).id as string;
  await catalogMutate("/api/resource-groups", {
    name: "공동 그룹",
    code: "G-A",
  });
  const g1 = catalog.groups.find(
    (group: { code: string }) => group.code === "G-A",
  ).id as string;
  await catalogMutate("/api/resource-groups", {
    name: "개발 그룹",
    code: "G-B",
  });
  const g2 = catalog.groups.find(
    (group: { code: string }) => group.code === "G-B",
  ).id as string;
  await catalogMutate(
    `/api/resource-groups/${g1}/members`,
    { resourceIds: [r1, r2] },
    "put",
    200,
  );
  await catalogMutate(
    `/api/resource-groups/${g2}/members`,
    { resourceIds: [r1] },
    "put",
    200,
  );
  await mutate(
    `/tasks/${shared.taskId}/assignments`,
    {
      catalogRevision: catalog.revision,
      targets: [
        {
          kind: "resource",
          id: r1,
          allocation: { start: null, end: null, percent: 80 },
        },
        {
          kind: "resource",
          id: r2,
          allocation: { start: null, end: null, percent: 10 },
        },
      ],
    },
    "put",
  );
  await mutate(
    `/tasks/${groupOnly.taskId}/assignments`,
    { catalogRevision: catalog.revision, targets: [{ kind: "group", id: g1 }] },
    "put",
  );
  const second = await add("다른 단계", "milestone");
  await mutate("/milestone-memberships", {
    changes: [{ taskId: unset.taskId, milestoneTaskId: second.taskId }],
  });
  await mutate(
    `/tasks/${unset.taskId}/assignments`,
    {
      catalogRevision: catalog.revision,
      targets: [
        {
          kind: "resource",
          id: r1,
          allocation: { start: null, end: null, percent: 60 },
        },
      ],
    },
    "put",
  );
  await catalogMutate("/api/resources", {
    name: "미설정 담당 Carol",
    code: "R-C",
    roles: ["DEVELOPER"],
    developerGrade: "BEGINNER",
  });
  const r3 = catalog.resources.find((r: { code: string }) => r.code === "R-C")
    .id as string;
  await catalogMutate(
    `/api/resource-groups/${g2}/members`,
    { resourceIds: [r1, r3] },
    "put",
    200,
  );
  const unknown = await add("미설정 배정 작업");
  await mutate("/milestone-memberships", {
    changes: [{ taskId: unknown.taskId, milestoneTaskId: second.taskId }],
  });
  await mutate(
    `/tasks/${unknown.taskId}/assignments`,
    {
      catalogRevision: catalog.revision,
      targets: [{ kind: "resource", id: r3 }],
    },
    "put",
  );
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const publicPage = await readonly.newPage();
    await publicPage.goto(`/projects/${publicId}`);
    await publicPage.getByRole("tab", { name: "리소스", exact: true }).click();
    const root = publicPage.locator('[data-resource-dashboard="true"]');
    await expect(root).toHaveAttribute("data-ready", "true");
    await root.getByLabel("기간 시작", { exact: true }).fill("2026-10-06");
    await root.getByLabel("기간 종료", { exact: true }).fill("2026-10-06");
    await expect(root).toHaveAttribute("data-ready", "true");
    await root
      .getByLabel("Milestone", { exact: true })
      .selectOption(milestone.taskId);
    await expect(root).toHaveAttribute("data-ready", "true");
    await root.getByLabel("리소스 보기", { exact: true }).selectOption("plan");
    await expect(root).toHaveAttribute("data-ready", "true");
    const plan = root.getByRole("region", {
      name: "Resource Plan",
      exact: true,
    });
    const report = await (
      await readonly.request.get(
        `${api}/resource-dashboard?mode=group&granularity=week&from=2026-10-06&to=2026-10-06&milestoneIds=${milestone.taskId}`,
      )
    ).json();
    expect(report.data.plan.population.resourceCount).toBe(3);
    expect(
      report.data.plan.resources.find(
        (r: { resourceId: string }) => r.resourceId === r1,
      ).summary,
    ).toMatchObject({
      selected: { knownMd: 0.8, loadPercent: 80 },
      project: { knownMd: 1.4, loadPercent: 140 },
    });
    expect(
      report.data.plan.groups.find((g: { groupId: string }) => g.groupId === g1)
        .summary.project.loadPercent,
    ).toBe(75);
    await plan.getByLabel("부하 범위").selectOption("project");
    await plan.getByLabel("기간 셀 지표").selectOption("load");
    const group = plan
      .locator('tr[data-plan-row="group"]')
      .filter({ hasText: "공동 그룹" });
    await expect(group).toContainText("75.00 %");
    await expect(group).toContainText("Project 전체 · 초과 0.40 M/D · 1명");
    const daily = publicPage.waitForResponse((r) =>
      r.url().includes("/plan/daily?"),
    );
    await group.locator("td").first().getByRole("button").first().click();
    expect((await daily).status()).toBe(200);
    const detail = plan.getByRole("region", {
      name: "기간 부하 상세",
      exact: true,
    });
    await expect(detail.locator("h3")).toBeFocused();
    await detail
      .getByRole("button", { name: "2026-10-06", exact: true })
      .click();
    await expect(detail.locator("tbody tr")).toHaveCount(2);
    await expect(detail).toContainText("개발 담당 Alice");
    await expect(detail).toContainText("140.00%");
    const assignmentResponse = publicPage.waitForResponse((r) =>
      r.url().includes("/plan/day-assignments?"),
    );
    await detail
      .getByRole("button", { name: "개발 담당 Alice", exact: true })
      .click();
    const assignment = await assignmentResponse;
    expect(assignment.status()).toBe(200);
    const contributions = (await assignment.json()).data;
    expect(contributions.demandScope).toBe("project");
    expect(contributions.selector).toEqual({
      kind: "resource",
      resourceId: r1,
    });
    expect(contributions.rows.map((r: { taskId: string }) => r.taskId)).toEqual(
      expect.arrayContaining([shared.taskId, unset.taskId]),
    );
    await expect(detail).toContainText("공동 담당 작업");
    await expect(detail).toContainText("다른 단계 작업");
    await detail.locator("h3").press("Escape");
    await detail.locator("h3").press("Escape");
    await detail.locator("h3").press("Escape");
    await root.getByRole("button", { name: "개인", exact: true }).click();
    await plan.getByLabel("부하 범위").selectOption("selected");
    const person = plan
      .locator('tr[data-plan-row="resource"]')
      .filter({ hasText: "개발 담당 Alice" });
    await expect(person).toContainText("80.00 %");
    await expect(person).toContainText("Project 전체");
    await person
      .getByRole("button", { name: "개발 담당 Alice", exact: true })
      .click();
    const mrow = plan
      .locator('tr[data-plan-row="resourceMilestone"]')
      .filter({ hasText: "인수 Milestone" });
    await expect(mrow).toContainText("단계 기여(선택) · 80.00 %");
    await expect(mrow).toContainText("개인 전체 참고 140.00 %");
    await root.getByLabel("기간 단위", { exact: true }).selectOption("month");
    await expect(root).toHaveAttribute("data-ready", "true");
    await expect(person.getByRole("button").first()).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(
      plan
        .locator('tr[data-plan-row="resource"]')
        .filter({ hasText: "미설정 담당 Carol" }),
    ).toContainText("0부하");
    await mutate(
      "/work-calendar",
      {
        countryRules: [],
        customDates: [
          {
            name: "그룹 휴무",
            date: "2026-10-06",
            targetType: "RESOURCE_GROUP",
            targetId: g1,
            dayType: "NON_WORKING",
          },
          {
            name: "개인 특별근무",
            date: "2026-10-06",
            targetType: "RESOURCE",
            targetId: r1,
            dayType: "WORKING",
          },
        ],
      },
      "put",
    );
    await root.getByRole("button", { name: "새로고침", exact: true }).click();
    await expect(root).toHaveAttribute("data-ready", "false");
    await root
      .getByRole("button", { name: "최신 일정 조회", exact: true })
      .click();
    await expect(root).toHaveAttribute("data-ready", "true");
    await expect(
      plan
        .locator('tr[data-plan-row="resource"]')
        .filter({ hasText: "설비 담당 Bob" }),
    ).toContainText("비근무기간");
    await plan.getByLabel("기간 셀 지표").selectOption("load");
    await expect(
      plan
        .locator('tr[data-plan-row="resource"]')
        .filter({ hasText: "개발 담당 Alice" }),
    ).toContainText("80.00 %");
    expect(await readonly.cookies()).toEqual([]);
    expect((await get()).data.project.revision).toBe(
      snapshot.data.project.revision,
    );
    await testInfo.attach("actual-resource-plan-ui", {
      body: JSON.stringify({
        revision: snapshot.data.project.revision,
        plan: report.data.plan,
        contributions,
      }),
      contentType: "application/json",
    });
  } finally {
    await readonly.close();
  }
});
