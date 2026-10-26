import { openWorkspaceView, workspaceViewTab } from "./helpers/workspace-navigation";
import { isWbsViewReadQuery } from "./helpers/read-only-requests";
import type { Locator } from "@playwright/test";
import type { ResourceCatalogResponse } from "../../src/contracts/resources";
import type { ResourceDrillQueryInput, ResourceDrillScope, ResourceDrillScopeDto } from "../../src/contracts/resource-drill";
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

test("#528 실제 SQLite 일정·리소스 왕복과 정확한 배정·Editor", async ({
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
  const completedMarker = await add("완료 위치 이벤트", "milestone");
  await mutate(`/tasks/${completedMarker.taskId}`, {status:"completed"}, "patch");
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const p = await readonly.newPage();
    p.setDefaultTimeout(15_000);
    await p.goto(`/projects/${publicId}`);
    const frame = p.locator(".project-gantt-frame");
    await expect(frame.locator(".wx-gantt")).toBeVisible();
    const selectedLookup = p.getByRole("button", { name: "담당자·공수 조회", exact: true });
    await expect(selectedLookup).toBeDisabled();
    await expect(selectedLookup).toHaveAccessibleDescription(/작업을 선택해 주세요/);
    await frame
      .locator(`input[data-copy-selection="${shared.taskId}"]`)
      .check();
    // A readonly visitor can discover and invoke the direct lookup by keyboard.
    await expect(selectedLookup).toBeEnabled();
    await expect(selectedLookup).toHaveClass(/secondary-button/);
    await expect(selectedLookup).toHaveAccessibleDescription(/선택한 Task[\s\S]*모든 개인/);
    await selectedLookup.focus();
    await selectedLookup.press("Enter");
    const root = p.locator('[data-resource-dashboard="true"]:visible');
    await expect(root).toHaveAttribute("data-ready", "true");
    await expect(root.getByRole("heading", {name:"리소스 공수", exact:true})).toBeFocused();
    const strip = p.getByRole("region", {
      name: "임시 조회 범위",
      exact: true,
    });
    await expect(strip).toContainText("고유 Task 1");
    await expect(strip).toContainText("Assignment 2");
    await expect(strip).toContainText("출발 환산 미설정");
    await root.getByRole("button", { name: "개인", exact: true }).click();
    const geometry: unknown[] = [];
    await p.evaluate(() => {
      (window as unknown as { drillGantt?: Element | null }).drillGantt =
        document.querySelector(".wx-gantt");
    });
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await p.setViewportSize({ width, height: 900 });
      await strip.evaluate(el => { el.tabIndex = -1; el.focus({preventScroll:true}); });
      await p.keyboard.press("Tab");
      const focusButton = strip.getByRole("button", {name:/원래 보기/});
      await expect(focusButton).toBeFocused();
      const ring = await focusButton.evaluate(button => ({outline:getComputedStyle(button).outlineStyle, width:parseFloat(getComputedStyle(button).outlineWidth)}));
      expect(ring.outline).toBe("solid");
      expect(ring.width).toBeGreaterThanOrEqual(3);
      const observation = await strip.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const buttons = [...el.querySelectorAll("button")].map((button) => {
          const box = button.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            height: box.height,
            primitive: button.classList.contains("secondary-button"),
          };
        });
        return {
          left: rect.left,
          right: rect.right,
          width: window.innerWidth,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          buttons,
        };
      });
      expect(observation.overflow).toBe(0);
      expect(observation.left).toBeGreaterThanOrEqual(0);
      expect(observation.right).toBeLessThanOrEqual(width);
      for (const button of observation.buttons) {
        expect(button.height).toBeGreaterThanOrEqual(40);
        expect(button.primitive).toBe(true);
        expect(button.left).toBeGreaterThanOrEqual(observation.left);
        expect(button.right).toBeLessThanOrEqual(observation.right);
      }
      geometry.push({...observation, focusRing:ring});
      if (width === 390 || width === 1440)
        await p.screenshot({
          path: `docs/evidence/issue-528/resource-drill-${width}.png`,
          fullPage: false,
        });
    }
    await p.setViewportSize({ width: 1440, height: 900 });
    await testInfo.attach("scope-strip-five-widths", {
      body: JSON.stringify(geometry),
      contentType: "application/json",
    });

    const alice = root
      .locator('[data-resource-row="resource"]')
      .filter({ hasText: "Alice" });
    // The dashboard total's Task button opens exact-source detail, never other Task assignments.
    await root
      .locator(".resource-dashboard-kpis > div")
      .filter({ hasText: /^할당 Task/ })
      .getByRole("button")
      .click();
    const detail = root.locator(".resource-dashboard-detail");
    await expect(detail).toContainText("공동 담당 작업");
    await expect(detail).not.toContainText("다른 단계 작업");
    await detail
      .getByRole("button", { name: "공동 담당 작업", exact: true })
      .click();
    const editor = p.locator("dialog").filter({ hasText: "작업 정보" });
    await expect(p.locator("dialog")).toBeVisible();
    await p
      .locator("dialog")
      .getByRole("button", { name: /닫기/ })
      .first()
      .click();
    await expect(p.locator("dialog")).toHaveCount(0);
    await detail
      .getByRole("button", { name: "전체 범위 일정 보기", exact: true })
      .click();
    await expect(
      p.getByRole("tab", { name: "일정", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(strip).toContainText("고유 Task 1");
    await strip.getByRole("button", { name: /원래 보기/ }).click();
    await expect(
      workspaceViewTab(p, "resources"),
    ).toHaveAttribute("aria-selected", "true");
    await expect(detail).toContainText("공동 담당 작업");
    await strip.getByRole("button", { name: /원래 보기/ }).click();
    await expect(
      p.getByRole("tab", { name: "일정", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      frame.locator(`input[data-copy-selection="${shared.taskId}"]`),
    ).toBeChecked();
    await openWorkspaceView(p, "milestones");
    const mRoot = p.locator('[data-testid="milestone-dashboard"]');
    await expect(mRoot).toHaveAttribute('data-ready','true');
    await mRoot.getByLabel("수동 기준일", {exact:true}).check();
    await mRoot.getByLabel("기준일", {exact:true}).fill("2026-10-02");
    await mRoot.getByText("Milestone 표시·공수 범위 조건", {exact:true}).click();
    await mRoot.getByLabel("공수 시작일", {exact:true}).fill("2026-10-01");
    await mRoot.getByLabel("공수 종료일", {exact:true}).fill("2026-10-03");
    await mRoot.getByLabel("M/M 환산 기준").selectOption("query");
    await mRoot.getByLabel("1 M/M당 M/D", {exact:true}).fill("15");
    await expect(mRoot).toHaveAttribute("data-ready", "true");
    await mRoot.getByRole('button',{name:'완료 Milestone 목록에서 확인',exact:true}).click();
    await expect(workspaceViewTab(p, "milestones")).toHaveAttribute('aria-selected','true');
    await expect(mRoot.getByRole('status').filter({hasText:'선택 지표의 Milestone 1개'})).toContainText('현재 목록 조건에 1개');
    await expect(mRoot.locator('tr[data-milestone-task-id]')).toHaveCount(1);
    await expect(mRoot.locator(`tr[data-milestone-task-id="${completedMarker.taskId}"]`)).toBeVisible();
    await expect(frame.locator(`.wx-row[data-id=":${completedMarker.taskId}"]`)).toHaveCount(0);
    await mRoot.getByRole('button',{name:'지표 선택 해제',exact:true}).click();
    await expect(mRoot.getByLabel("기준일",{exact:true})).toHaveValue("2026-10-02");
    await expect(mRoot.getByLabel("공수 시작일",{exact:true})).toHaveValue("2026-10-01");
    await expect(mRoot.getByLabel("공수 종료일",{exact:true})).toHaveValue("2026-10-03");
    await expect(mRoot.getByLabel("1 M/M당 M/D",{exact:true})).toHaveValue("15");
    await p.getByRole('tab',{name:'일정',exact:true}).click();
    // Each visit retains its own detail/mode state; the ninth move cannot evict the first origin.
    for (let step = 0; step < 8; step++) {
      if (step % 2 === 0) {
        await frame
          .locator(`input[data-copy-selection="${shared.taskId}"]`)
          .check();
        await p
          .getByRole("button", {
            name: "담당자·공수 조회",
            exact: true,
          })
          .click();
        const current = p.locator('[data-resource-dashboard="true"]:visible');
        await expect(current).toHaveAttribute("data-ready", "true");
        await expect(current.getByRole("heading", {name:"리소스 공수",exact:true})).toBeFocused();
        await current
          .getByRole("button", { name: "개인", exact: true })
          .click();
        await current
          .locator(".resource-dashboard-kpis > div")
          .filter({ hasText: /^할당 Task/ })
          .getByRole("button")
          .click();
      } else {
        await p
          .locator(".resource-dashboard-detail:visible")
          .getByRole("button", { name: "전체 범위 일정 보기", exact: true })
          .click();
        await expect(
          p.getByRole("tab", { name: "일정", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
      }
      expect(
        Number(
          await p
            .locator("[data-resource-live-contexts]")
            .getAttribute("data-resource-live-contexts"),
        ),
      ).toBeLessThanOrEqual(9);
    }
    await frame
      .locator(`input[data-copy-selection="${shared.taskId}"]`)
      .check();
    await p
      .getByRole("button", {
        name: "담당자·공수 조회",
        exact: true,
      })
      .click();
    await expect(
      p.getByRole("status").filter({ hasText: "최대 8단계" }),
    ).toBeVisible();
    for (let step = 0; step < 8; step++) {
      await strip.getByRole("button", { name: /원래 보기/ }).click();
      if (step % 2 === 0)
        await expect(
          p.locator(".resource-dashboard-detail:visible"),
        ).toContainText("공동 담당 작업");
      else
        await expect(
          p.getByRole("tab", { name: "일정", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
    }
    await expect(p.locator("[data-resource-live-contexts]")).toHaveAttribute(
      "data-resource-live-contexts",
      "1",
    );
    expect(
      await p.evaluate(
        () =>
          (window as unknown as { drillGantt?: Element }).drillGantt ===
          document.querySelector(".wx-gantt"),
      ),
    ).toBe(true);
    await frame.locator(`input[data-copy-selection="${shared.taskId}"]`).check();
    await p.getByRole('button',{name:'담당자·공수 조회',exact:true}).click();
    const latest = p.locator('[data-resource-dashboard="true"]:visible');
    await expect(latest).toHaveAttribute('data-ready','true');
    await latest.locator('.resource-dashboard-kpis > div').filter({hasText:/^할당 Task/}).getByRole('button').click();
    await p.getByRole('tab',{name:'일정',exact:true}).click();
    await p.getByLabel('작업명, 설명, External ID 검색', {exact:true}).fill('다른 단계 작업');
    await openWorkspaceView(p, "resources");
    const trigger = latest.locator('.resource-dashboard-detail').getByRole('button',{name:'전체 범위 일정 보기',exact:true});
    await trigger.click();
    const confirmation = p.getByRole('dialog',{name:'조회 범위 충돌 확인',exact:true});
    await expect(confirmation).toContainText('1개를 숨깁니다');
    await p.keyboard.press('Escape');
    await expect(confirmation).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(confirmation).toBeVisible();
    const projectRevisionBeforeCatalog = snapshot.data.project.revision;
    await catalogMutate(`/api/resources/${r2}`, {active:false}, 'patch', 200);
    expect((await get()).data.project.revision).toBe(projectRevisionBeforeCatalog);
    await confirmation.getByRole('button',{name:'전체 대상 별도 범위로 보기',exact:true}).click();
    await expect(p.getByRole('status').filter({hasText:/변경|최신|다시/}).last()).toBeVisible();
    await expect(workspaceViewTab(p, "resources")).toHaveAttribute('aria-selected','true');
    await confirmation.getByRole('button',{name:'취소',exact:true}).click();
    await expect(trigger).toBeFocused();
    expect(await readonly.cookies()).toEqual([]);
    expect((await get()).data.project.revision).toBe(
      snapshot.data.project.revision,
    );
    await testInfo.attach("actual-resource-drill-ui", {
      body: JSON.stringify({
        taskId: shared.taskId,
        resources: [r1, r2, r3],
        groups: [g1, g2],
        revision: snapshot.data.project.revision,
      }),
      contentType: "application/json",
    });
    void alice;
    void editor;
  } finally {
    await readonly.close().catch(() => undefined);
  }
});


test("#556 선택 Summary 자손과 현재 Summary 전체 담당자·공수를 별도 readonly 명령으로 조회한다", async ({ page, baseURL, browser }, testInfo) => {
  const origin = baseURL!;
  const created = await page.request.post("/api/projects", {
    headers: { Origin: origin },
    data: { name: "Summary resource scope #556", description: "Summary 조회 경계 fixture", ownerName: "E2E 자동화", editPassword: "Summary556!" },
  });
  expect(created.status(), await created.text()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string;
  const api = `/api/projects/${publicId}`;
  const get = async () => (await (await page.request.get(api)).json()) as ProjectSnapshotResponse;
  let snapshot = await get();
  const add = async (name: string, type: "summary" | "task", parentTaskId?: string) => {
    const response = await page.request.post(`${api}/tasks`, {
      headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` },
      data: { name, type, ...(parentTaskId ? { parentTaskId } : {}), ...(type === "task" ? { start: "2026-10-06", duration: 1, progress: 0 } : {}) },
    });
    expect(response.status(), await response.text()).toBe(201);
    snapshot = await get();
    return snapshot.data.tasks.find(task => task.name === name)!;
  };
  const root = await add("현재 전체 Summary", "summary");
  const selected = await add("선택한 내부 Summary", "summary", root.taskId);
  const first = await add("선택 자손 공동담당", "task", selected.taskId);
  const second = await add("선택 자손 다른담당", "task", selected.taskId);
  const sibling = await add("현재 Summary의 나머지 Task", "task", root.taskId);
  const outside = await add("동일 담당자의 범위 밖 Task", "task");
  expect((await page.request.post("/api/resource-catalog/admin-sessions", {
    headers: { Origin: origin }, data: { password },
  })).status()).toBe(201);
  let catalog = (await (await page.request.get("/api/resources")).json()) as ResourceCatalogResponse;
  const people: string[] = [];
  for (const [code, name] of [["A556", "Alice556"], ["B556", "Bob556"], ["C556", "Carol556"]]) {
    const response = await page.request.post("/api/resources", {
      headers: { Origin: origin, "If-Match": `"${catalog.data.revision}"` }, data: { code, name },
    });
    expect(response.status(), await response.text()).toBe(201);
    catalog = await response.json();
    people.push(catalog.data.resources.find(resource => resource.code === code)!.id);
  }
  for (const [taskId, resourceIds] of [
    [first.taskId, [people[0], people[1]]],
    [second.taskId, [people[2]]],
    [sibling.taskId, [people[1]]],
    [outside.taskId, [people[0]]],
  ] as const) {
    const response = await page.request.put(`${api}/tasks/${taskId}/assignments`, {
      headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` },
      data: { catalogRevision: catalog.data.revision, targets: resourceIds.map(id => ({ kind: "resource", id, allocation: { start: null, end: null, percent: 50 } })) },
    });
    expect(response.status(), await response.text()).toBe(200);
    snapshot = await get();
  }
  const before = snapshot;
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const p = await readonly.newPage();
    let writes = 0;
    p.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith(api) && !["GET", "HEAD"].includes(request.method()) && !path.endsWith("/resource-dashboard/query") && !isWbsViewReadQuery(request)) writes++;
    });
    await p.goto(`/projects/${publicId}?rootTask=${root.taskId}`);
    const frame = p.locator(".project-gantt-frame");
    await expect(frame.locator(".wx-gantt")).toBeVisible();
    const instance = await frame.getAttribute("data-project-gantt-api-instance");
    const selectedCheckbox = frame.locator(`input[data-copy-selection="${selected.taskId}"]`);
    await selectedCheckbox.check();
    const strip = p.getByRole("region", { name: "임시 조회 범위", exact: true });
    const observeLookup = async (button: Locator, scope: ResourceDrillScope, taskIds: string[]) => {
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      const received = p.waitForResponse(response => {
        if (new URL(response.url()).pathname !== `${api}/resource-dashboard/query` || response.request().method() !== "POST") return false;
        const input = response.request().postDataJSON() as ResourceDrillQueryInput;
        return input.scope.kind === scope.kind && input.projection.kind === "scope" && input.projection.target === "dashboard";
      });
      await button.focus();
      await button.press("Enter");
      const response = await received;
      expect(response.status()).toBe(200);
      const body = await response.json() as { data: ResourceDrillScopeDto; drill: { scope: ResourceDrillScope } };
      expect(body.drill.scope).toEqual(scope);
      expect([...body.data.taskIds].sort()).toEqual([...taskIds].sort());
      const assignments = before.data.assignments!.filter(assignment => taskIds.includes(assignment.taskId));
      expect([...body.data.assignmentIds].sort()).toEqual(assignments.map(assignment => assignment.id).sort());
      expect(body.data.taskIds).not.toContain(outside.taskId);
      expect(body.data.assignmentIds).not.toContain(before.data.assignments!.find(assignment => assignment.taskId === outside.taskId)!.id);
      expect([...new Set(assignments.map(assignment => assignment.target.id))].sort()).toEqual([...people].sort());
      const dashboard = p.locator('[data-resource-dashboard="true"]:visible');
      await expect(dashboard).toHaveAttribute("data-ready", "true");
      await expect(strip).toContainText(`고유 Task ${taskIds.length}`);
      await expect(strip).toContainText(`Assignment ${assignments.length}`);
      await dashboard.getByRole("button", { name: "개인", exact: true }).click();
      for (const name of ["Alice556", "Bob556", "Carol556"]) {
        await expect(dashboard.locator('[data-resource-row="resource"]').filter({ hasText: name })).toBeVisible();
      }
      if (scope.kind === "summarySubtree") {
        // #809 F809-CI-003: 대시보드 표시 중 숨은 일정 패널의 DOM 형태를
        // 가정하지 않는다. 실제 일정 탭 활성화와 논리 Summary 명령을 기다린다.
        await expect(p.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "false");
        await p.evaluate(() => {
          const panel = document.getElementById("project-panel-schedule");
          const tab = document.getElementById("project-tab-schedule");
          if (!panel || !tab) throw Error("Schedule workspace shell is missing");
          let armed = false;
          const onReturn = () => {
            if (armed || tab.getAttribute("aria-selected") !== "true") return;
            const trigger = panel.querySelector<HTMLButtonElement>('[data-schedule-resource-drill="summary"]');
            if (!trigger) return; // 버튼이 React commit 후에 생성될 수도 있다.
            armed = true;
            observer.disconnect();
            trigger.disabled = true;
            panel.dataset.focusHoldArmed = "true";
            // 기존 두-RAF 시점보다 늦게 enable: React가 먼저 해제해도 유지.
            const hold = new MutationObserver(() => {
              if (trigger.isConnected && !trigger.disabled) trigger.disabled = true;
            });
            hold.observe(trigger, { attributes: true, attributeFilter: ["disabled"] });
            let elapsed = false;
            let released = false;
            const release = () => {
              if (released || !elapsed || panel.dataset.resourceNavigationPending === "true") return;
              released = true;
              hold.disconnect();
              pending.disconnect();
              if (trigger.isConnected) trigger.disabled = false;
              panel.dataset.focusHoldReleased = "true";
            };
            const pending = new MutationObserver(release);
            pending.observe(panel, { attributes: true, attributeFilter: ["data-resource-navigation-pending"] });
            window.setTimeout(() => { elapsed = true; release(); }, 220);
          };
          const observer = new MutationObserver(onReturn);
          observer.observe(document.body, { subtree: true, childList: true, attributes: true,
            attributeFilter: ["aria-selected"] });
          onReturn();
        });
      }
      await strip.getByRole("button", { name: /원래 보기/ }).click();
      await expect(p.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
      if (scope.kind === "summarySubtree") {
        const schedule = p.locator("#project-panel-schedule");
        await expect(schedule).toHaveAttribute("data-focus-hold-armed", "true");
        await expect(schedule).toHaveAttribute("data-focus-hold-released", "true");
        await expect(button).toBeEnabled();
      }
      await expect(button).toBeFocused();
      await expect(selectedCheckbox).toBeChecked();
      expect(new URL(p.url()).searchParams.get("rootTask")).toBe(root.taskId);
      await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
      return body.data;
    };
    const selectedResult = await observeLookup(
      p.getByRole("button", { name: "담당자·공수 조회", exact: true }),
      { kind: "scheduleSelection", nodeIds: [selected.taskId] }, [first.taskId, second.taskId],
    );
    const fullResult = await observeLookup(
      p.getByRole("button", { name: "Summary 전체 담당자·공수", exact: true }),
      { kind: "summarySubtree", rootId: root.taskId }, [first.taskId, second.taskId, sibling.taskId],
    );
    expect(selectedResult.assignmentCount).toBe(3);
    expect(fullResult.assignmentCount).toBe(4);
    expect(writes).toBe(0);
    expect((await get()).data).toEqual(before.data);
    expect(await readonly.cookies()).toEqual([]);
    await testInfo.attach("issue-556-summary-scope-exact-ids", { contentType: "application/json", body: JSON.stringify({ selectedResult, fullResult, excludedTaskId: outside.taskId, writes }) });
  } finally {
    await readonly.close();
  }
});
