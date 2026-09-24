import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { ProjectSnapshotResponse, ProjectStatus } from "../../../src/contracts/projects";
import type { ProjectExcelExportRequest } from "../../../src/contracts/project-excel-export";
import { buildProjectExcelWorkbook } from "../../../src/server/exports/project-excel-export-core";

function projectSheetFromWorkbook(bytes: Uint8Array): string {
  const archive = Buffer.from(bytes);
  let offset = 0;
  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const name = archive.toString("utf8", offset + 30, offset + 30 + nameLength);
    const contentOffset = offset + 30 + nameLength + extraLength;
    if (name === "xl/worksheets/sheet3.xml") {
      return inflateRawSync(archive.subarray(contentOffset, contentOffset + compressedSize)).toString("utf8");
    }
    offset = contentOffset + compressedSize;
  }
  throw new Error("Project worksheet is missing from the workbook.");
}

function workbook(status: ProjectStatus, includeDependencies: boolean, holidays: number): string {
  const snapshot: ProjectSnapshotResponse = {
    data: {
      project: {
        publicId: "2fd0c93f-cd37-4b68-9f09-412239d99c79",
        name: "Status project",
        description: "Status export",
        status,
        revision: 4,
        calendar: {
          timezone: "Asia/Seoul",
          weekendDays: [6, 0],
          holidays: holidays ? [{ date: "2026-09-14", name: "Company holiday" }] : [],
        },
      },
      tasks: [], links: [], permission: "readonly",
    },
  };
  const request: ProjectExcelExportRequest = {
    includeDependencies,
    scope: "project",
    scale: "day",
    hierarchyDisplay: "expanded",
    layout: { columns: [{ id: "text", widthPx: 224 }] },
  };
  return projectSheetFromWorkbook(buildProjectExcelWorkbook(snapshot, request));
}

describe("Excel Project sheet status metadata", () => {
  it.each([
    ["planned", "예정"],
    ["in_progress", "진행 중"],
    ["completed", "완료"],
  ] as const)("exports %s as %s while retaining fixed metadata rows", (status, label) => {
    const sheet = workbook(status, false, 0);
    expect(sheet).toContain('<dimension ref="A1:B10"/>');
    expect(sheet).toMatch(/<row r="3">.*Revision.*<v>4<\/v>.*<\/row>/);
    expect(sheet).toMatch(/<row r="7">.*관계 포함.*아니오.*<\/row>/);
    expect(sheet).toMatch(new RegExp(`<row r="10">.*프로젝트 상태.*${label}.*<\\/row>`));
  });

  it("appends status after the holiday rows with dependencies included", () => {
    const sheet = workbook("completed", true, 1);
    expect(sheet).toContain('<dimension ref="A1:B12"/>');
    expect(sheet).toMatch(/<row r="8">.*관계 수.*<v>0<\/v>.*<\/row>/);
    expect(sheet).toMatch(/<row r="10">.*휴일.*이름.*<\/row>/);
    expect(sheet).toMatch(/<row r="11">.*Company holiday.*<\/row>/);
    expect(sheet).toMatch(/<row r="12">.*프로젝트 상태.*완료.*<\/row>/);
  });
});
