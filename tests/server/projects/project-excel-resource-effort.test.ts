import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { ProjectExcelExportRequest } from "../../../src/contracts/project-excel-export";
import type { ProjectSnapshotResponse } from "../../../src/contracts/projects";
import type { ResourceWorkloadResponse } from "../../../src/contracts/resources";
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

const snapshot: ProjectSnapshotResponse = {
  data: {
    project: {
      publicId: "2fd0c93f-cd37-4b68-9f09-412239d99c79",
      name: "=위험한 프로젝트",
      description: "",
      status: "in_progress",
      revision: 7,
      calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
    },
    tasks: [{
      taskId: "11111111-1111-4111-8111-111111111111",
      externalId: "T1",
      name: "+위험한 작업",
      type: "task",
      scheduleMode: "auto",
      requestedStart: "2026-09-14",
      start: "2026-09-14",
      end: "2026-09-18",
      duration: 5,
      progress: 50,
      status: "in_progress",
      parentExternalId: null,
      siblingOrder: 1,
    }],
    links: [],
    permission: "readonly",
  },
};

function workload(mdPerMm: number | null): ResourceWorkloadResponse {
  const task = {
    assignmentId: "assignment-public-1",
    taskId: "11111111-1111-4111-8111-111111111111",
    taskName: "+위험한 작업",
    start: "2026-09-14",
    end: "2026-09-18",
    allocationPercent: 100,
    effectiveWorkingDays: 5,
    effortMd: 5,
    effortMm: mdPerMm === null ? null : 0.25,
    effortConfigured: true,
    role: "DEVELOPER" as const,
    taskStart: "2026-09-14",
    taskEnd: "2026-09-18",
    progress: 50,
    status: "in_progress" as const,
    delayed: true,
  };
  const resource = {
    id: "resource-public-1",
    name: "=위험한 개발자",
    code: "@DEV-01",
    active: true,
    developerGrade: "ADVANCED" as const,
    start: "2026-09-14",
    end: "2026-09-18",
    effortMd: 5,
    effortMm: mdPerMm === null ? null : 0.25,
    unsetCount: 0,
    overAllocated: false,
    tasks: [task],
  };
  return {
    data: {
      projectRevision: 7,
      catalogRevision: 11,
      range: { from: "2026-09-14", to: "2026-09-18" },
      mdPerMm,
      grandTotalMd: 5,
      grandTotalMm: mdPerMm === null ? null : 0.25,
      unsetCount: 0,
      asOfDate: "2026-09-19",
      timezone: "Asia/Seoul",
      roleTotals: [
        { role: "DEVELOPER", assignmentCount: 1, effortMd: 5, effortMm: mdPerMm === null ? null : 0.25, unsetCount: 0 },
      ],
      unspecifiedRoleCount: 0,
      overAllocatedResourceCount: 0,
      groups: [
        { id: "group-a", name: "Group A", active: true, start: "2026-09-14", end: "2026-09-18", effortMd: 5, effortMm: mdPerMm === null ? null : 0.25, unsetCount: 0, resources: [resource] },
        { id: "group-b", name: "Group B", active: true, start: "2026-09-14", end: "2026-09-18", effortMd: 5, effortMm: mdPerMm === null ? null : 0.25, unsetCount: 0, resources: [resource] },
      ],
    },
  };
}

const request: ProjectExcelExportRequest = {
  includeDependencies: false,
  includeLogistics: false,
  includeResourceEffort: true,
  scope: "project",
  scale: "day",
  hierarchyDisplay: "expanded",
  layout: { columns: [{ id: "text", widthPx: 224 }] },
};

describe("Excel Resource Effort export (Issue #415)", () => {
  it("appends Summary/Detail, deduplicates assignment rows across groups and preserves safe text", () => {
    const entries = extractZipEntries(buildProjectExcelWorkbook(snapshot, request, workload(20)));
    const workbookXml = entries.get("xl/workbook.xml")!;
    expect(workbookXml).toContain('name="Resource Effort Summary"');
    expect(workbookXml).toContain('name="Resource Effort Detail"');

    const summary = entries.get("xl/worksheets/sheet4.xml")!;
    const detail = entries.get("xl/worksheets/sheet5.xml")!;
    expect(summary).toContain("전체 계획 M/D");
    expect(summary).toContain("<v>5</v>");
    expect(summary).toContain("개발자별 계획 공수");
    expect(summary).toContain("Group A, Group B");
    expect(summary).toContain("&apos;=위험한 개발자");
    expect(detail).toContain("assignment-public-1");
    expect(detail.match(/assignment-public-1/g)).toHaveLength(1);
    expect(detail).toContain("Group A, Group B");
    expect(detail).toContain("&apos;+위험한 작업");
    expect(detail).toContain("&apos;@DEV-01");
    expect(detail).toContain("유효 근무일");
  });

  it("does not invent M/M when RESOURCE_MD_PER_MM is unset", () => {
    const entries = extractZipEntries(buildProjectExcelWorkbook(snapshot, request, workload(null)));
    const summary = entries.get("xl/worksheets/sheet4.xml")!;
    const detail = entries.get("xl/worksheets/sheet5.xml")!;
    expect(summary).toContain("RESOURCE_MD_PER_MM");
    expect(summary).toContain("미설정");
    expect(detail).toContain("Effort M/M");
    expect(detail).toContain("미설정");
  });

  it("rejects Resource effort export when workload revision does not match Project revision", () => {
    const stale = workload(20);
    stale.data.projectRevision = 6;
    expect(() => buildProjectExcelWorkbook(snapshot, request, stale)).toThrow(/must match/i);
  });
});
