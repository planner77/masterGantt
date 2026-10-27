import { openWorkspaceView } from "./helpers/workspace-navigation";
import { expect, test, type Locator } from "@playwright/test";
import type { ProjectLogisticsDto } from "../../src/contracts/logistics";
import {
  expectSameGanttRoot,
  installStatefulProjectFixture,
  publicId,
  rememberGanttRoot,
} from "../fixtures/stateful-project";

async function expectIdentifier(panel: Locator, name: string, label: string, value: string) {
  const row = panel.getByRole("row").filter({ has: panel.page().locator("strong").filter({ hasText: name }) }).first();
  // #762: the WorkArea button repeats the process name for screen readers.
  // Match the visible identity cell, not the entire row’s text descendants.
  const displayedName = row.locator("strong").first();
  await expect(displayedName).toHaveText(name);
  await expect(displayedName).toBeVisible();
  const identifiers = row.locator("details").first();
  await identifiers.locator("summary").click();
  await expect(identifiers.getByLabel(label, { exact: true })).toBeVisible();
  await expect(identifiers.getByLabel(label, { exact: true })).toHaveValue(value);
  await identifiers.locator("summary").click();
}

function sampleLogisticsData(): ProjectLogisticsDto {
  return {
    processes: [
      {
        id: "proc-1",
        code: "PROC-01",
        name: "입고 공정",
        parentProcessId: null,
        sortOrder: 1,
        active: true,
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
      {
        id: "proc-2",
        code: "PROC-02",
        name: "보관 공정",
        parentProcessId: "proc-1",
        sortOrder: 2,
        active: true,
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
      {
        id: "proc-3",
        code: "PROC-03",
        name: "출고 공정",
        parentProcessId: null,
        sortOrder: 3,
        active: true,
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
    ],
    equipment: [
      {
        id: "eq-1",
        processId: "proc-2",
        code: "STK-01",
        name: "1번 자동창고 스토커",
        equipmentType: "stocker",
        managementUnit: "unit",
        quantity: 1,
        manufacturer: "Hankook Logistics",
        model: "STK-5000",
        description: "고단 랙 자동 보관 설비",
        active: true,
        controlSystems: [{ systemId: "sys-2", controlRole: "primary" }],
        resourceRoles: [
          {
            resourceId: "res-1",
            resourceCode: "ENG-01",
            resourceName: "홍길동",
            role: "owner",
            isPrimary: true,
            active: true,
          },
          {
            resourceId: "res-2",
            resourceCode: "DEV-01",
            resourceName: "김철수",
            role: "contributor",
            isPrimary: false,
            active: true,
          },
        ],
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
      {
        id: "eq-2",
        processId: "proc-1",
        code: "AGV-F1",
        name: "입고 무인운반차 편대",
        equipmentType: "agv",
        managementUnit: "fleet",
        quantity: 4,
        manufacturer: "Robotics Korea",
        model: "AGV-200",
        description: "원자재 입고 및 이송",
        active: true,
        controlSystems: [{ systemId: "sys-1", controlRole: "primary" }],
        resourceRoles: [
          {
            resourceId: "res-1",
            resourceCode: "ENG-01",
            resourceName: "홍길동",
            role: "owner",
            isPrimary: true,
            active: true,
          },
        ],
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
      {
        id: "eq-3",
        processId: "proc-3",
        code: "AMR-F1",
        name: "출고 자율이동로봇 편대",
        equipmentType: "amr",
        managementUnit: "fleet",
        quantity: 6,
        manufacturer: "AutoMover",
        model: "AMR-100",
        description: "출고 소팅 및 피킹 이송",
        active: true,
        controlSystems: [],
        resourceRoles: [],
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
    ],
    systems: [
      {
        id: "sys-0",
        code: "MCS-01",
        name: "통합 반송 조율 시스템",
        systemType: "mcs",
        layer: "coordinator",
        scope: "project",
        processIds: [],
        coordinatedSystemIds: ["sys-1", "sys-2"],
        resourceRoles: [
          {
            resourceId: "res-3",
            resourceCode: "PI-01",
            resourceName: "이영희",
            role: "pi",
            isPrimary: true,
            active: true,
          },
          {
            resourceId: "res-2",
            resourceCode: "DEV-01",
            resourceName: "김철수",
            role: "developer",
            isPrimary: false,
            active: true,
          },
        ],
        vendor: "SmartLogistics",
        description: "물류 전 영역 상위 관제 및 작업 조율",
        active: true,
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
      {
        id: "sys-1",
        code: "ACS-01",
        name: "AGV 관제 제어 시스템",
        systemType: "acs",
        layer: "controller",
        scope: "processes",
        processIds: ["proc-1", "proc-3"],
        coordinatedSystemIds: [],
        resourceRoles: [
          {
            resourceId: "res-2",
            resourceCode: "DEV-01",
            resourceName: "김철수",
            role: "pi",
            isPrimary: true,
            active: true,
          },
        ],
        vendor: "RoboControl",
        description: "AGV 배차 및 경로 제어",
        active: true,
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
      {
        id: "sys-2",
        code: "SCS-01",
        name: "스토커 제어 시스템",
        systemType: "scs",
        layer: "controller",
        scope: "processes",
        processIds: ["proc-2"],
        coordinatedSystemIds: [],
        resourceRoles: [],
        vendor: "Hankook Logistics",
        description: "자동창고 스토커 크레인 제어",
        active: true,
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      },
    ],
    systemLinks: [
      { sourceSystemId: "sys-0", targetSystemId: "sys-1", relationType: "coordinates" },
      { sourceSystemId: "sys-0", targetSystemId: "sys-2", relationType: "coordinates" },
    ],
  };
}

test.describe("Issue #186 물류 구성 탭 및 관리 화면 (LG-03)", () => {
  test("#726 설비 유형 조회 중·실패·빈 목록은 이유와 초안을 유지하고 readonly는 추가를 숨긴다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.logistics = sampleLogisticsData();
    const writes: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/api/") && !["GET", "HEAD"].includes(request.method())) {
        writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });
    let catalogMode: "loading" | "empty" | "ready" = "loading";
    let releaseLoading!: () => void;
    const loadingResponse = new Promise<void>(resolve => { releaseLoading = resolve; });
    await page.route("**/api/logistics-catalog/types", async route => {
      if (catalogMode === "loading") {
        await loadingResponse;
        await route.fulfill({ status: 503, json: { error: { code: "TEST_UNAVAILABLE" } } });
        return;
      }
      await route.fulfill({ json: { data: {
        equipmentTypes: catalogMode === "ready" ? [{ code: "agv", name: "무인운반차" }] : [],
        systemTypes: [],
      } } });
    });
    await page.route(`**/api/projects/${publicId}/logistics/process-context`, route => route.fulfill({ json: { data: {
      projectRevision: fixture.project.revision,
      processCatalogRevision: 1,
      workAreas: [], occurrences: [], mappings: [],
    } } }));
    try {
      await page.goto(`/projects/${publicId}`);
      await openWorkspaceView(page, "equipment");
      await page.getByRole("button", { name: "+ 설비 추가", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "설비 추가", exact: true });
      const code = dialog.getByRole("textbox", { name: "설비 코드", exact: false });
      const name = dialog.getByRole("textbox", { name: "설비명", exact: false });
      const type = dialog.getByRole("combobox", { name: "설비 유형", exact: false });
      await code.fill("DRAFT-726");
      await name.fill("유형 조회 중 보존할 설비 초안");
      await expect(dialog.getByRole("status").filter({ hasText: "설비 유형 목록을 불러오는 중" })).toBeVisible();
      await expect(type).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();

      releaseLoading();
      await expect(dialog.getByRole("alert").filter({ hasText: "설비 유형 조회에 실패해 저장할 수 없습니다" })).toBeVisible();
      await expect(type).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "유형 조회 실패", exact: true })).toBeDisabled();
      await expect(code).toHaveValue("DRAFT-726");
      await expect(name).toHaveValue("유형 조회 중 보존할 설비 초안");

      catalogMode = "empty";
      await dialog.getByRole("button", { name: "유형 목록 다시 시도", exact: true }).click();
      await expect(dialog.getByRole("status").filter({ hasText: "활성 설비 유형이 없습니다" })).toBeVisible();
      await expect(dialog).toContainText("공통 기준정보 관리자가 유형을 등록·활성화한 뒤 다시 조회해 주세요.");
      await expect(type).toBeEnabled();
      await expect(type.getByRole("option")).toHaveCount(1);
      await expect(type).toHaveValue("");
      await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();

      catalogMode = "ready";
      await dialog.getByRole("button", { name: "유형 목록 다시 시도", exact: true }).click();
      await expect(type.getByRole("option", { name: "무인운반차", exact: true })).toHaveCount(1);
      await type.selectOption("agv");
      await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
      await expect(code).toHaveValue("DRAFT-726");
      await expect(name).toHaveValue("유형 조회 중 보존할 설비 초안");
      await dialog.getByRole("button", { name: "취소", exact: true }).click();
      await dialog.getByRole("button", { name: "변경 폐기", exact: true }).click();
      await expect(dialog).toHaveCount(0);

      fixture.sessionEditable = false;
      await page.reload();
      await openWorkspaceView(page, "equipment");
      await expect(page.getByText("조회 전용 모드입니다. 편집을 수행하려면 작업공간 상단의 '편집 활성화'를 진행해 주세요.")).toBeVisible();
      await expect(page.getByRole("button", { name: "+ 설비 추가", exact: true })).toHaveCount(0);
      expect(writes).toEqual([]);
    } finally {
      releaseLoading();
    }
  });

  test("물류 구성 탭 전환 시 Gantt 인스턴스가 유지되고 공정/설비/시스템/연계 화면이 표시된다", async ({
    page,
  }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.logistics = sampleLogisticsData();

    await page.goto(`/projects/${publicId}`);
    await expect(page.getByRole("heading", { level: 1, name: fixture.project.name })).toBeVisible();

    const identity = await rememberGanttRoot(page);

    // Verify workspace tabs
    const tabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
    const logisticsTab = tabs.getByRole("tab", { name: "기준정보", exact: true });
    const scheduleTab = tabs.getByRole("tab", { name: "일정", exact: true });

    await expect(logisticsTab).toBeVisible();
    await expect(scheduleTab).toHaveAttribute("aria-selected", "true");

    // Click logistics tab
    await logisticsTab.click();
    await expect(logisticsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#project-panel-logistics")).toBeVisible();
    await expect(page.locator("#project-panel-schedule")).toBeHidden();

    // Verify Gantt instance preserved
    await expectSameGanttRoot(page, identity);

    // Verify Header notice & WBS distinction
    await page.getByRole("button", { name: "물류 구성 도움말", exact: true }).click();
    await expect(
      page.getByText("물류 공정은 물리적/운영 단위의 물류 흐름이며 Gantt WBS와 독립적으로 관리됩니다."),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // LG-05 dashboard is the default sub-tab. Move explicitly to process management.
    await expect(page.getByRole("tablist", { name: "기준정보 보기" }).getByRole("tab", { name: "공정&WorkArea", exact: true })).toHaveAttribute("aria-selected", "true");
    await openWorkspaceView(page, "processes");
    const processPanel = page.locator("#panel-processes");
    await expectIdentifier(processPanel, "입고 공정", "공정 코드", "PROC-01");
    await expect(processPanel.locator("#logistics-master-process-proc-1 strong")).toHaveText("입고 공정");
    await expect(processPanel.locator("#logistics-master-process-proc-1").getByRole("button", { name: /작업 구역.*입고 공정/ })).toBeVisible();
    await expectIdentifier(processPanel, "보관 공정", "공정 코드", "PROC-02");
    await expect(processPanel.locator("#logistics-master-process-proc-2 strong")).toHaveText("보관 공정");
    await expectIdentifier(processPanel, "출고 공정", "공정 코드", "PROC-03");
    await expect(processPanel.locator("#logistics-master-process-proc-3 strong")).toHaveText("출고 공정");

    // Switch to Sub-tab 2: Equipment
    await openWorkspaceView(page, "equipment");
    const equipmentPanel = page.locator("#panel-equipment");
    await expectIdentifier(equipmentPanel, "1번 자동창고 스토커", "설비 코드", "STK-01");
    await expect(equipmentPanel.getByText("1번 자동창고 스토커", { exact: true })).toBeVisible();
    await expectIdentifier(equipmentPanel, "입고 무인운반차 편대", "설비 코드", "AGV-F1");
    await expect(equipmentPanel.getByText("입고 무인운반차 편대", { exact: true })).toBeVisible();
    await expectIdentifier(equipmentPanel, "출고 자율이동로봇 편대", "설비 코드", "AMR-F1");
    // Check primary owner tag
    await expect(equipmentPanel.getByText("★ 홍길동 (owner)", { exact: true }).first()).toBeVisible();

    // Switch to Sub-tab 3: Systems
    await openWorkspaceView(page, "systems");
    const systemsPanel = page.locator("#panel-systems");
    await expectIdentifier(systemsPanel, "통합 반송 조율 시스템", "시스템 코드", "MCS-01");
    await expect(systemsPanel.getByText("통합 반송 조율 시스템", { exact: true })).toBeVisible();
    await expectIdentifier(systemsPanel, "AGV 관제 제어 시스템", "시스템 코드", "ACS-01");
    await expectIdentifier(systemsPanel, "스토커 제어 시스템", "시스템 코드", "SCS-01");
    // Check project-common scope badge
    await expect(systemsPanel.getByText("프로젝트 공통", { exact: true })).toBeVisible();
    // Check primary PI tag
    await expect(systemsPanel.getByText("★ 이영희 (pi)", { exact: true })).toBeVisible();

    // Switch to Sub-tab 4: Relations
    await openWorkspaceView(page, "relations");
    const relationsPanel = page.locator("#panel-relations");
    const relationRows = relationsPanel.getByRole("row");
    await expect(relationRows.filter({ hasText: "통합 반송 조율 시스템" }).first()).toBeVisible();
    await expect(relationRows.filter({ hasText: "AGV 관제 제어 시스템" }).first()).toBeVisible();
    await expect(relationRows.filter({ hasText: "스토커 제어 시스템" }).first()).toBeVisible();

    // Switch back to schedule tab and verify Gantt intact
    await scheduleTab.click();
    await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#project-panel-schedule")).toBeVisible();
    await expectSameGanttRoot(page, identity);
  });

  for (const width of [390, 768, 1024, 1440]) {
    test(`Issue #279 물류 서브탭은 수직 스크롤 없이 단일 행과 키보드 가시성을 유지한다 (${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const fixture = await installStatefulProjectFixture(page);
      fixture.sessionEditable = true;
      fixture.logistics = sampleLogisticsData();

      await page.goto(`/projects/${publicId}`);
      await openWorkspaceView(page, "logistics");

      const tablist = page.getByRole("tablist", { name: "기준정보 보기" });
      const dashboardTab = tablist.getByRole("tab", { name: "공정&WorkArea", exact: true });
      const relationsTab = tablist.getByRole("tab", { name: "리소스", exact: true });

      const metrics = await tablist.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        };
      });

      expect(metrics.overflowX).toBe("auto");
      expect(metrics.overflowY).toBe("hidden");
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
      if (width >= 1024) {
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      }

      await dashboardTab.focus();
      await page.keyboard.press("End");
      await expect(relationsTab).toBeFocused();
      await expect(relationsTab).toHaveAttribute("aria-selected", "true");

      const focusedBounds = await tablist.evaluate((element) => {
        const selected = element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (!selected) throw new Error("selected logistics sub-tab not found");
        const listRect = element.getBoundingClientRect();
        const tabRect = selected.getBoundingClientRect();
        return {
          listLeft: listRect.left,
          listRight: listRect.right,
          tabLeft: tabRect.left,
          tabRight: tabRect.right,
          scrollTop: element.scrollTop,
        };
      });

      expect(focusedBounds.tabLeft).toBeGreaterThanOrEqual(focusedBounds.listLeft - 1);
      expect(focusedBounds.tabRight).toBeLessThanOrEqual(focusedBounds.listRight + 1);
      expect(focusedBounds.scrollTop).toBe(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      ).toBe(true);
    });
  }

  test("Readonly 모드에서는 생성/수정/삭제 버튼을 숨기고 좁은 화면의 안내·도움말·표 스크롤을 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = false;
    fixture.logistics = sampleLogisticsData();

    await page.goto(`/projects/${publicId}`);
    await openWorkspaceView(page, "logistics");

    // Verify readonly notice
    await expect(
      page.getByText("조회 전용 모드입니다. 편집을 수행하려면 작업공간 상단의 '편집 활성화'를 진행해 주세요."),
    ).toBeVisible();

    const help = page.getByRole("button", { name: "물류 구성 도움말", exact: true });
    await help.click();
    await expect(page.getByText("물류 공정은 물리적/운영 단위의 물류 흐름이며 Gantt WBS와 독립적으로 관리됩니다.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeFocused();
    const geometry = await page.locator("#panel-processes table").evaluate(table => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      tableWidth: table.getBoundingClientRect().width,
      ownerWidth: table.parentElement!.clientWidth,
      scrollWidth: table.parentElement!.scrollWidth,
    }));
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.tableWidth).toBeGreaterThan(geometry.ownerWidth);
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.ownerWidth);

    // Ensure + 공정 추가 button is not rendered
    await expect(page.getByRole("button", { name: "+ 공정 추가" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ 설비 추가" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ 시스템 추가" })).toHaveCount(0);
  });

  test("공정 추가는 코드 입력 없이 저장하고 서버 생성 코드를 canonical 응답으로 표시한다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = true;
    fixture.logistics = sampleLogisticsData();

    let requestBody: Record<string, unknown> | null = null;
    await page.route(`**/api/projects/${publicId}/logistics/processes`, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }

      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      const current = sampleLogisticsData();
      const created = {
        id: "proc-generated",
        code: "PROC-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "자동 생성 코드 공정",
        parentProcessId: null,
        sortOrder: 0,
        active: true,
        createdAt: "2026-09-29T00:00:00.000Z",
        updatedAt: "2026-09-29T00:00:00.000Z",
      };
      await route.fulfill({
        status: 201,
        json: {
          data: {
            project: { ...fixture.project, revision: fixture.project.revision + 1 },
            logistics: { ...current, processes: [...current.processes, created] },
            permission: "edit",
            operation: {
              kind: "logisticsMutation",
              entity: "process",
              action: "create",
              targetPublicId: created.id,
            },
          },
        },
      });
    });

    await page.goto(`/projects/${publicId}`);
    await openWorkspaceView(page, "logistics");
    await openWorkspaceView(page, "processes");

    await page.getByRole("button", { name: "+ 공정 추가" }).click();
    const dialog = page.getByRole("dialog", { name: "공정 추가" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("예: PROC-01")).toHaveCount(0);
    await expect(dialog.getByText("공정 코드 *", { exact: true })).toHaveCount(0);

    const nameInput = dialog.getByPlaceholder("예: 입고 공정");
    await expect(nameInput).toBeFocused();
    await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
    await nameInput.fill("자동 생성 코드 공정");
    await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await expect.poll(() => requestBody).not.toBeNull();
    expect(requestBody).toEqual({
      name: "자동 생성 코드 공정",
      parentProcessId: null,
      sortOrder: 0,
      active: true,
    });
    expect(requestBody).not.toHaveProperty("code");
    await expect(dialog).toHaveCount(0);
    await expectIdentifier(page.locator("#panel-processes"), "자동 생성 코드 공정", "공정 코드", "PROC-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await expect(page.locator("#logistics-master-process-proc-generated strong")).toHaveText("자동 생성 코드 공정");

    const processPanel = page.locator("#panel-processes");
    const legacyRow = processPanel.getByRole("row").filter({ has: page.locator("strong").filter({ hasText: "입고 공정" }) });
    await expect(legacyRow).toHaveCount(1);
    await legacyRow.getByRole("button", { name: "수정", exact: true }).click();
    const editDialog = page.getByRole("dialog", { name: "공정 수정" });
    await expect(editDialog.getByPlaceholder("예: PROC-01")).toHaveValue("PROC-01");
    await expect(editDialog.getByPlaceholder("예: PROC-01")).toBeFocused();
    await editDialog.getByRole("button", { name: "취소", exact: true }).click();
  });

  test("Dialog 취소 시 Escape는 변경 없는 창만 닫고 초안은 명시 폐기 전까지 보존한다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = true;
    fixture.logistics = sampleLogisticsData();

    let mutationCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("/logistics/") && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method())) {
        mutationCount++;
      }
    });

    await page.goto(`/projects/${publicId}`);
    await openWorkspaceView(page, "logistics");
    await openWorkspaceView(page, "processes");

    // Open add process dialog
    const addButton = page.getByRole("button", { name: "+ 공정 추가" });
    await addButton.click();

    const dialog = page.getByRole("dialog", { name: "공정 추가" });
    await expect(dialog).toBeVisible();

    // Create mode has no technical code input and focuses the business name.
    await expect(dialog.getByPlaceholder("예: PROC-01")).toHaveCount(0);
    const nameInput = dialog.getByPlaceholder("예: 입고 공정");
    await expect(nameInput).toBeFocused();
    // A pristine dialog closes immediately and returns to its exact trigger.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(addButton).toBeFocused();
    expect(mutationCount).toBe(0);

    await addButton.click();
    await nameInput.fill("임시 초안 공정");
    const discard = page.getByRole("dialog", { name: "공정 변경 내용 버리기", exact: true });

    // Dirty Escape requests confirmation; it must not silently lose the draft.
    await page.keyboard.press("Escape");
    await expect(discard).toBeVisible();
    await expect(nameInput).toHaveValue("임시 초안 공정");
    expect(mutationCount).toBe(0);
    await discard.getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(discard).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(nameInput).toHaveValue("임시 초안 공정");

    // The header close command must also preserve the same dirty draft.
    await dialog.getByRole("button", { name: "공정 추가 닫기", exact: true }).click();
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(nameInput).toHaveValue("임시 초안 공정");
    expect(mutationCount).toBe(0);

    // Cancel uses the same guard. Escape from the nested confirmation cancels
    // only that decision and keeps the original dialog and its draft intact.
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(discard).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(discard).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(nameInput).toHaveValue("임시 초안 공정");
    expect(mutationCount).toBe(0);

    await page.keyboard.press("Escape");
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "변경 내용 버리기", exact: true }).click();
    await expect(discard).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    expect(mutationCount).toBe(0);
    await expect(addButton).toBeFocused();

    // Editing an existing process has the same draft-preservation contract.
    const editButton = page.locator("#logistics-master-process-proc-1").getByRole("button", { name: "수정", exact: true });
    await editButton.click();
    const editDialog = page.getByRole("dialog", { name: "공정 수정", exact: true });
    const editName = editDialog.getByPlaceholder("예: 입고 공정");
    await editName.fill("기존 공정의 미저장 초안");
    await editDialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(editName).toHaveValue("기존 공정의 미저장 초안");
    await page.keyboard.press("Escape");
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "변경 내용 버리기", exact: true }).click();
    await expect(editDialog).toHaveCount(0);
    await expect(discard).toHaveCount(0);
    await expect(editButton).toBeFocused();
    await expect(page.locator("#logistics-master-process-proc-1 strong")).toHaveText("입고 공정");
    expect(mutationCount).toBe(0);
  });

  test("공정 초안은 pending 중복 제출·Escape와 network/412/401 이후에도 보존된다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = true;
    fixture.logistics = sampleLogisticsData();
    const originalLogistics = JSON.stringify(fixture.logistics);
    const requests: Array<{ name: string; revision: string | undefined }> = [];
    let mode: "network" | "stale" | "unauthorized" = "network";
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/projects/${publicId}/logistics/processes`, async route => {
      if (route.request().method() !== "POST") return route.fallback();
      requests.push({ name: route.request().postDataJSON().name, revision: route.request().headers()["if-match"] });
      if (mode === "network") { await gate; await route.abort("failed"); return; }
      if (mode === "stale") {
        fixture.project.revision += 1;
        await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH", message: "stale" } } });
        return;
      }
      fixture.sessionEditable = false;
      await route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED", message: "expired" } } });
    });
    await page.goto(`/projects/${publicId}`);
    await openWorkspaceView(page, "processes");
    const add = page.getByRole("button", { name: "+ 공정 추가", exact: true });
    const dialog = page.getByRole("dialog", { name: "공정 추가", exact: true });
    const name = dialog.getByPlaceholder("예: 입고 공정");
    const save = dialog.locator('button[type="submit"]');
    const discard = page.getByRole("dialog", { name: "공정 변경 내용 버리기", exact: true });
    async function discardDraft() {
      await dialog.getByRole("button", { name: "취소", exact: true }).click();
      await expect(discard).toBeVisible();
      await discard.getByRole("button", { name: "변경 내용 버리기", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(discard).toHaveCount(0);
    }
    await add.click();
    await expect(save).toHaveText("저장");
    await name.fill("네트워크 오류 보존 초안");
    await save.click();
    await expect.poll(() => requests.length).toBe(1);
    await expect(save).toHaveText("저장 중…");
    await expect(save).toBeDisabled();
    await expect(name).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "공정 추가 닫기", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(discard).toHaveCount(0);
    expect(requests).toHaveLength(1);
    release();
    await expect(dialog).toContainText("네트워크 연결");
    await expect(dialog).toContainText("저장을 잠갔습니다.");
    await expect(name).toHaveValue("네트워크 오류 보존 초안");
    await expect(save).toBeDisabled();
    await discardDraft();
    await expect(add).toBeFocused();

    mode = "stale";
    await add.click();
    await name.fill("412 보존 초안");
    await save.click();
    await expect(dialog).toContainText("저장을 잠갔습니다.");
    await expect(name).toHaveValue("412 보존 초안");
    await expect(save).toBeDisabled();
    expect(requests).toHaveLength(2);
    await discardDraft();
    await expect(add).toBeFocused();

    mode = "unauthorized";
    await add.click();
    await name.fill("401 보존 초안");
    await save.click();
    await expect(dialog).toContainText("편집 권한이 만료되었습니다.");
    await expect(name).toHaveValue("401 보존 초안");
    await expect(save).toBeDisabled();
    await expect(dialog).toContainText("저장을 잠갔습니다.");
    expect(requests.map(request => request.name)).toEqual(["네트워크 오류 보존 초안", "412 보존 초안", "401 보존 초안"]);
    expect(requests.map(request => request.revision)).toEqual(['"40"', '"40"', '"41"']);
    expect(JSON.stringify(fixture.logistics)).toBe(originalLogistics);
    await discardDraft();
    await expect(add).toHaveCount(0);
  });

  test("하위 조율 저장은 childSystemIds 계약을 사용하고 401이면 즉시 읽기 전용으로 전환한다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = true;
    fixture.logistics = sampleLogisticsData();

    let requestBody: unknown = null;
    await page.route(`**/api/projects/${publicId}/logistics/systems/sys-0/children`, async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 401,
        json: { error: { code: "UNAUTHORIZED", message: "expired", details: [], requestId: "lg-03-review" } },
      });
    });

    await page.goto(`/projects/${publicId}`);
    await openWorkspaceView(page, "logistics");
    await openWorkspaceView(page, "systems");

    const mcsRow = page.locator("#panel-systems").getByRole("row").filter({ has: page.getByText("통합 반송 조율 시스템", { exact: true }) });
    await mcsRow.getByRole("button", { name: "하위연계" }).click();
    const dialog = page.getByRole("dialog", { name: /하위 조율 시스템 연계/ });
    await dialog.getByRole("button", { name: "저장" }).click();

    await expect.poll(() => requestBody).not.toBeNull();
    expect(requestBody).toEqual({ childSystemIds: ["sys-1", "sys-2"] });
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(mcsRow.getByRole("button", { name: "하위연계" })).toHaveCount(0);
  });

  test("삭제 확인은 최신 main의 영구 삭제 DELETE 계약으로 호출한다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = true;
    fixture.logistics = sampleLogisticsData();

    let deleteUrl = "";
    await page.route(`**/api/projects/${publicId}/logistics/processes/proc-1`, async (route) => {
      deleteUrl = route.request().url();
      await route.fulfill({
        status: 409,
        json: { error: { code: "PROCESS_IN_USE", message: "in use", details: [], requestId: "lg-03-review" } },
      });
    });

    await page.goto(`/projects/${publicId}`);
    await openWorkspaceView(page, "logistics");
    await openWorkspaceView(page, "processes");

    const processPanel = page.locator("#panel-processes");
    const processRow = processPanel.getByRole("row").filter({ has: page.locator("strong").filter({ hasText: "입고 공정" }) });
    await expect(processRow).toHaveCount(1);
    await processRow.getByRole("button", { name: "삭제", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "삭제 확인" });
    await confirm.getByRole("button", { name: "삭제", exact: true }).click();

    await expect.poll(() => deleteUrl).toContain("/logistics/processes/proc-1");
    expect(new URL(deleteUrl).search).toBe("");
  });

  test("반응형 5개 폭(390, 768, 1024, 1440, 1920px)에서 공용 shell·공정 추가 모달과 문서에 가로 overflow가 없다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = true;
    fixture.logistics = sampleLogisticsData();

    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/projects/${publicId}`);
      await openWorkspaceView(page, "logistics");
      await openWorkspaceView(page, "processes");
      const heading = page.getByRole("heading", { level: 2, name: "물류 구성" });
      await expect(heading).toBeVisible();
      await expect(page.getByRole("button", { name: "물류 구성 도움말", exact: true })).toBeVisible();
      const shell = await heading.evaluate(element => {
        const host = element.closest("#project-panel-logistics")!;
        const container = host.lastElementChild!;
        const parent = host.getBoundingClientRect(), child = container.getBoundingClientRect();
        return { leftGap: child.left - parent.left, rightGap: parent.right - child.right };
      });
      expect(Math.abs(shell.leftGap)).toBeLessThanOrEqual(1);
      expect(Math.abs(shell.rightGap)).toBeLessThanOrEqual(1);

      const addButton = page.getByRole("button", { name: "+ 공정 추가" });
      await addButton.click();
      const dialog = page.getByRole("dialog", { name: "공정 추가" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByPlaceholder("예: PROC-01")).toHaveCount(0);
      await expect(dialog.getByPlaceholder("예: 입고 공정")).toBeFocused();

      const geometry = await page.evaluate(() => {
        const dialog = document.querySelector("dialog[open]");
        const rect = dialog?.getBoundingClientRect();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          dialogLeft: rect?.left ?? -1,
          dialogRight: rect?.right ?? Number.POSITIVE_INFINITY,
          viewportWidth: window.innerWidth,
        };
      });
      expect(geometry.scrollWidth, `viewport ${width}px: document width ${geometry.scrollWidth}px`).toBeLessThanOrEqual(
        geometry.clientWidth + 1,
      );
      expect(geometry.dialogLeft, `viewport ${width}px: dialog left`).toBeGreaterThanOrEqual(0);
      expect(geometry.dialogRight, `viewport ${width}px: dialog right`).toBeLessThanOrEqual(geometry.viewportWidth + 1);

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(addButton).toBeFocused();
    }
  });
});
