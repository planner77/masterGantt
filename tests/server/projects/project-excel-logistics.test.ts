import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { ProjectSnapshotResponse } from "../../../src/contracts/projects";
import type { ProjectExcelExportRequest } from "../../../src/contracts/project-excel-export";
import { buildProjectExcelWorkbook } from "../../../src/server/exports/project-excel-export-core";

function extractZipEntries(bytes: Uint8Array): Map<string, string> {
  const archive = Buffer.from(bytes);
  let offset = 0;
  const entries = new Map<string, string>();
  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const name = archive.toString("utf8", offset + 30, offset + 30 + nameLength);
    const contentOffset = offset + 30 + nameLength + extraLength;
    const content = inflateRawSync(archive.subarray(contentOffset, contentOffset + compressedSize)).toString("utf8");
    entries.set(name, content);
    offset = contentOffset + compressedSize;
  }
  return entries;
}

describe("Excel Logistics export report (Issue #189 LG-06)", () => {
  const mockSnapshot: ProjectSnapshotResponse = {
    data: {
      project: {
        publicId: "project-uuid-1",
        name: "=위험한 프로젝트명",
        description: "+위험한 설명",
        status: "in_progress",
        revision: 3,
        calendar: {
          timezone: "Asia/Seoul",
          weekendDays: [6, 0],
          holidays: [],
        },
      },
      tasks: [
        {
          taskId: "task-uuid-1",
          externalId: "T1",
          name: "@위험한 태스크",
          type: "task",
          scheduleMode: "auto",
          requestedStart: null,
          start: "2026-11-02",
          end: "2026-11-06",
          duration: 5,
          progress: 50,
          parentExternalId: null,
          siblingOrder: 1,
        },
      ],
      links: [],
      permission: "readonly",
      logistics: {
        processes: [
          {
            id: "proc-uuid-1",
            code: "P1",
            name: "메인 물류공정",
            parentProcessId: null,
            sortOrder: 1,
            active: true,
            createdAt: "2026-09-27T00:00:00.000Z",
            updatedAt: "2026-09-27T00:00:00.000Z",
          },
          {
            id: "proc-uuid-2",
            code: "=P2-FORMULA",
            name: "하위 입고공정",
            parentProcessId: "proc-uuid-1",
            sortOrder: 2,
            active: true,
            createdAt: "2026-09-27T00:00:00.000Z",
            updatedAt: "2026-09-27T00:00:00.000Z",
          },
        ],
        equipment: [
          {
            id: "eq-uuid-1",
            processId: "proc-uuid-1",
            code: "STK-01",
            name: "스토커 1호기",
            equipmentType: "stocker",
            managementUnit: "unit",
            quantity: 1,
            manufacturer: "대우물류",
            model: "STK-2000",
            description: "고속 스토커",
            active: true,
            controlSystems: [{ systemId: "sys-uuid-1", controlRole: "primary" }],
            resourceRoles: [
              {
                resourceId: "res-uuid-1",
                resourceCode: "RES-01",
                resourceName: "홍길동",
                role: "owner",
                isPrimary: true,
                active: true,
              },
            ],
            createdAt: "2026-09-27T00:00:00.000Z",
            updatedAt: "2026-09-27T00:00:00.000Z",
          },
        ],
        systems: [
          {
            id: "sys-uuid-1",
            code: "SCS",
            name: "스토커 제어 시스템",
            systemType: "scs",
            layer: "controller",
            scope: "processes",
            processIds: ["proc-uuid-1"],
            coordinatedSystemIds: [],
            resourceRoles: [],
            vendor: "현대무벡스",
            description: "SCS 제어기",
            active: true,
            createdAt: "2026-09-27T00:00:00.000Z",
            updatedAt: "2026-09-27T00:00:00.000Z",
          },
        ],
        systemLinks: [],
        taskEquipmentLinks: [
          {
            taskId: "task-uuid-1",
            equipmentId: "eq-uuid-1",
            scope: "self",
          },
        ],
        taskSystemLinks: [
          {
            taskId: "task-uuid-1",
            systemId: "sys-uuid-1",
            scope: "subtree",
          },
        ],
      },
    },
  };

  it("includes Logistics sheet when includeLogistics is true and logistics data exists", () => {
    const request: ProjectExcelExportRequest = {
      includeDependencies: false,
      includeLogistics: true,
      scope: "project",
      scale: "day",
      hierarchyDisplay: "expanded",
      layout: { columns: [{ id: "text", widthPx: 224 }] },
    };

    const bytes = buildProjectExcelWorkbook(mockSnapshot, request);
    const entries = extractZipEntries(bytes);

    // workbook.xml에 Logistics 시트 등록 확인
    const workbookXml = entries.get("xl/workbook.xml");
    expect(workbookXml).toBeDefined();
    expect(workbookXml).toContain('name="Logistics"');

    // sheet4.xml (Gantt, Tasks, Project 다음 4번째 시트) 내용 검증
    const logisticsSheetXml = entries.get("xl/worksheets/sheet4.xml");
    expect(logisticsSheetXml).toBeDefined();

    // 1. 안내 문구
    expect(logisticsSheetXml).toContain("본 시트는 물류 구성 보고용 출력물이며, 전체 프로젝트 무손실 재가져오기(Import) 백업 파일이 아닙니다.");

    // 2. 메타데이터 및 수식 주입 방지 검증 ('=위험한 프로젝트명 -> &#39;=위험한 프로젝트명 또는 &#39; 접두사)
    expect(logisticsSheetXml).toContain("프로젝트명");
    expect(logisticsSheetXml).toContain("&apos;=위험한 프로젝트명"); // xml 이스케이프

    // 3. 공정 마스터 검증
    expect(logisticsSheetXml).toContain("메인 물류공정");
    expect(logisticsSheetXml).toContain("&apos;=P2-FORMULA"); // 수식 주입 방지

    // 4. 설비 마스터 및 제어/역할 검증
    expect(logisticsSheetXml).toContain("STK-01");
    expect(logisticsSheetXml).toContain("스토커 1호기");
    expect(logisticsSheetXml).toContain("SCS(주)");
    expect(logisticsSheetXml).toContain("홍길동(주)[owner]");

    // 5. 시스템 마스터 검증
    expect(logisticsSheetXml).toContain("SCS");
    expect(logisticsSheetXml).toContain("스토커 제어 시스템");

    // 6. 태스크 연결 검증
    expect(logisticsSheetXml).toContain("단일작업(self)");
    expect(logisticsSheetXml).toContain("하위포함(subtree)");
    expect(logisticsSheetXml).toContain("설비");
    expect(logisticsSheetXml).toContain("시스템");
  });

  it("omits Logistics sheet when includeLogistics is false", () => {
    const request: ProjectExcelExportRequest = {
      includeDependencies: false,
      includeLogistics: false,
      scope: "project",
      scale: "day",
      hierarchyDisplay: "expanded",
      layout: { columns: [{ id: "text", widthPx: 224 }] },
    };

    const bytes = buildProjectExcelWorkbook(mockSnapshot, request);
    const entries = extractZipEntries(bytes);

    const workbookXml = entries.get("xl/workbook.xml");
    expect(workbookXml).not.toContain('name="Logistics"');
    expect(entries.has("xl/worksheets/sheet4.xml")).toBe(false);
  });
});