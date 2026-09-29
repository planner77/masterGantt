import { expect, test } from "@playwright/test";
import type { ProjectLogisticsDto } from "../../src/contracts/logistics";
import {
  expectSameGanttRoot,
  installStatefulProjectFixture,
  publicId,
  rememberGanttRoot,
} from "../fixtures/stateful-project";

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
    const logisticsTab = tabs.getByRole("tab", { name: "물류 구성", exact: true });
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
    await expect(
      page.getByText("물류 공정은 물리적/운영 단위의 물류 흐름이며 Gantt WBS와 독립적으로 관리됩니다."),
    ).toBeVisible();

    // LG-05 dashboard is the default sub-tab. Move explicitly to process management.
    await expect(page.getByRole("tab", { name: "KPI 대시보드" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "공정 관리" }).click();
    const processPanel = page.locator("#panel-processes");
    await expect(processPanel.getByText("PROC-01", { exact: true })).toBeVisible();
    await expect(processPanel.getByText("입고 공정", { exact: true })).toBeVisible();
    await expect(processPanel.getByText("PROC-02", { exact: true })).toBeVisible();
    await expect(processPanel.getByText("보관 공정")).toBeVisible();
    await expect(processPanel.getByText("PROC-03", { exact: true })).toBeVisible();
    await expect(processPanel.getByText("출고 공정", { exact: true })).toBeVisible();

    // Switch to Sub-tab 2: Equipment
    await page.getByRole("tab", { name: "설비 관리" }).click();
    const equipmentPanel = page.locator("#panel-equipment");
    await expect(equipmentPanel.getByText("STK-01", { exact: true })).toBeVisible();
    await expect(equipmentPanel.getByText("1번 자동창고 스토커", { exact: true })).toBeVisible();
    await expect(equipmentPanel.getByText("AGV-F1", { exact: true })).toBeVisible();
    await expect(equipmentPanel.getByText("입고 무인운반차 편대", { exact: true })).toBeVisible();
    await expect(equipmentPanel.getByText("AMR-F1", { exact: true })).toBeVisible();
    // Check primary owner tag
    await expect(equipmentPanel.getByText("★ 홍길동 (owner)", { exact: true }).first()).toBeVisible();

    // Switch to Sub-tab 3: Systems
    await page.getByRole("tab", { name: "물류 시스템" }).click();
    const systemsPanel = page.locator("#panel-systems");
    await expect(systemsPanel.getByText("MCS-01", { exact: true })).toBeVisible();
    await expect(systemsPanel.getByText("통합 반송 조율 시스템", { exact: true })).toBeVisible();
    await expect(systemsPanel.getByText("ACS-01", { exact: true })).toBeVisible();
    await expect(systemsPanel.getByText("SCS-01", { exact: true })).toBeVisible();
    // Check project-common scope badge
    await expect(systemsPanel.getByText("프로젝트 공통", { exact: true })).toBeVisible();
    // Check primary PI tag
    await expect(systemsPanel.getByText("★ 이영희 (pi)", { exact: true })).toBeVisible();

    // Switch to Sub-tab 4: Relations
    await page.getByRole("tab", { name: "제어·조율 관계" }).click();
    const relationsPanel = page.locator("#panel-relations");
    const relationRows = relationsPanel.getByRole("row");
    await expect(relationRows.filter({ hasText: "통합 반송 조율 시스템" }).first()).toBeVisible();
    await expect(relationRows.filter({ hasText: "AGV 관제 제어 시스템 (ACS-01)" }).first()).toBeVisible();
    await expect(relationRows.filter({ hasText: "스토커 제어 시스템 (SCS-01)" }).first()).toBeVisible();

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
      await page.getByRole("tab", { name: "물류 구성", exact: true }).click();

      const tablist = page.getByRole("tablist", { name: "물류 구성 세부 영역" });
      const dashboardTab = tablist.getByRole("tab", { name: "KPI 대시보드", exact: true });
      const relationsTab = tablist.getByRole("tab", { name: "제어·조율 관계", exact: true });

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

  test("Readonly 모드에서는 생성/수정/삭제 버튼이 숨겨지고 안내문이 표시된다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = false;
    fixture.logistics = sampleLogisticsData();

    await page.goto(`/projects/${publicId}`);
    await page.getByRole("tab", { name: "물류 구성" }).click();

    // Verify readonly notice
    await expect(
      page.getByText("조회 전용 모드입니다. 편집을 수행하려면 작업공간 상단의 '편집 활성화'를 진행해 주세요."),
    ).toBeVisible();

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
    await page.getByRole("tab", { name: "물류 구성" }).click();
    await page.getByRole("tab", { name: "공정 관리" }).click();

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
    await expect(page.getByText("PROC-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { exact: true })).toBeVisible();
    await expect(page.getByText("자동 생성 코드 공정", { exact: true })).toBeVisible();

    const processPanel = page.locator("#panel-processes");
    const legacyRow = processPanel.getByRole("row").filter({ hasText: /^PROC-01/ });
    await expect(legacyRow).toHaveCount(1);
    await legacyRow.getByRole("button", { name: "수정", exact: true }).click();
    const editDialog = page.getByRole("dialog", { name: "공정 수정" });
    await expect(editDialog.getByPlaceholder("예: PROC-01")).toHaveValue("PROC-01");
    await expect(editDialog.getByPlaceholder("예: PROC-01")).toBeFocused();
    await editDialog.getByRole("button", { name: "취소", exact: true }).click();
  });

  test("Dialog 취소 시 Escape 키로 닫히고 mutation이 발생하지 않는다", async ({ page }) => {
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
    await page.getByRole("tab", { name: "물류 구성" }).click();
    await page.getByRole("tab", { name: "공정 관리" }).click();

    // Open add process dialog
    const addButton = page.getByRole("button", { name: "+ 공정 추가" });
    await addButton.click();

    const dialog = page.getByRole("dialog", { name: "공정 추가" });
    await expect(dialog).toBeVisible();

    // Create mode has no technical code input and focuses the business name.
    await expect(dialog.getByPlaceholder("예: PROC-01")).toHaveCount(0);
    const nameInput = dialog.getByPlaceholder("예: 입고 공정");
    await expect(nameInput).toBeFocused();
    await nameInput.fill("임시 초안 공정");

    // Press Escape to cancel
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // Verify 0 mutations sent and focus returns to the trigger.
    expect(mutationCount).toBe(0);
    await expect(addButton).toBeFocused();
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
    await page.getByRole("tab", { name: "물류 구성" }).click();
    await page.getByRole("tab", { name: "물류 시스템" }).click();

    const mcsRow = page.locator("tr", { hasText: "MCS-01" });
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
    await page.getByRole("tab", { name: "물류 구성" }).click();
    await page.getByRole("tab", { name: "공정 관리" }).click();

    const processPanel = page.locator("#panel-processes");
    const processRow = processPanel.getByRole("row").filter({ hasText: /^PROC-01/ });
    await expect(processRow).toHaveCount(1);
    await processRow.getByRole("button", { name: "삭제", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "삭제 확인" });
    await confirm.getByRole("button", { name: "삭제", exact: true }).click();

    await expect.poll(() => deleteUrl).toContain("/logistics/processes/proc-1");
    expect(new URL(deleteUrl).search).toBe("");
  });

  test("반응형 4개 폭(390, 768, 1024, 1440px)에서 공정 추가 모달과 문서에 가로 overflow가 없다", async ({ page }) => {
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = true;
    fixture.logistics = sampleLogisticsData();

    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/projects/${publicId}`);
      await page.getByRole("tab", { name: "물류 구성" }).click();
      await page.getByRole("tab", { name: "공정 관리" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "물류 구성" })).toBeVisible();

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
