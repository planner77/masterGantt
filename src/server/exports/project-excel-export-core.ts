import { deflateRawSync } from "node:zlib";

import type { ProjectLinkDto, ProjectSnapshotResponse, ProjectStatus, ProjectTaskDto } from "@/contracts/projects";
import type { ProjectExcelExportRequest } from "@/contracts/project-excel-export";
import type { ResourceWorkloadResponse, ResourceWorkloadTaskDto } from "@/contracts/resources";

const MAX_TASKS = 5_000;
const MAX_DEPENDENCIES = 20_000;
const MAX_TIMELINE_DAYS = 3_650;
const MAX_TIMELINE_CELLS = 1_000_000;
const MAX_CELL_TEXT = 32_767;
const MAX_RESOURCE_EFFORT_ROWS = 50_000;
const MAX_OUTLINE_LEVEL = 7;
const DAY_MS = 86_400_000;
const EXCEL_EPOCH_OFFSET = 25_569;

export class ProjectExcelExportError extends Error {
  readonly code: "EXPORT_LIMIT_EXCEEDED" | "EXPORT_UNSUPPORTED";

  constructor(code: "EXPORT_LIMIT_EXCEEDED" | "EXPORT_UNSUPPORTED", message: string) {
    super(message);
    this.name = "ProjectExcelExportError";
    this.code = code;
  }
}

type OrderedTask = Readonly<{
  task: ProjectTaskDto;
  depth: number;
  wbs: string;
  row: number;
}>;

type Cell = Readonly<{
  column: number;
  style?: number;
  type?: "string" | "number";
  value?: string | number;
}>;

type ZipEntry = Readonly<{ path: string; content: string | Uint8Array }>;

const STYLE = Object.freeze({
  default: 0,
  title: 1,
  header: 2,
  subheader: 3,
  text: 4,
  date: 5,
  integer: 6,
  percent: 7,
  taskBar: 8,
  summaryBar: 9,
  weekend: 10,
  holiday: 11,
  milestone: 12,
  muted: 13,
});

function validDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function epochDay(value: string): number {
  if (!validDateOnly(value)) {
    throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", `Invalid canonical date: ${value}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function dateFromEpochDay(value: number): string {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

function excelSerial(value: string): number {
  return epochDay(value) + EXCEL_EPOCH_OFFSET;
}

function xml(value: string): string {
  if (Array.from(value).length > MAX_CELL_TEXT) {
    throw new ProjectExcelExportError("EXPORT_LIMIT_EXCEEDED", "A text value exceeds the Excel cell limit.");
  }
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "\uFFFD")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(column: number): string {
  let current = column;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function cellReference(column: number, row: number): string {
  return `${columnName(column)}${row}`;
}

function rowXml(row: number, cells: readonly Cell[], outlineLevel = 0, height?: number): string {
  const attributes = [
    `r=\"${row}\"`,
    outlineLevel > 0 ? `outlineLevel=\"${outlineLevel}\"` : "",
    height ? `ht=\"${height}\" customHeight=\"1\"` : "",
  ].filter(Boolean).join(" ");
  const body = [...cells].sort((left, right) => left.column - right.column).map((cell) => {
    const reference = cellReference(cell.column, row);
    const style = cell.style === undefined ? "" : ` s=\"${cell.style}\"`;
    if (cell.value === undefined) return `<c r=\"${reference}\"${style}/>`;
    if (cell.type === "number") return `<c r=\"${reference}\"${style}><v>${cell.value}</v></c>`;
    return `<c r=\"${reference}\"${style} t=\"inlineStr\"><is><t xml:space=\"preserve\">${xml(String(cell.value))}</t></is></c>`;
  }).join("");
  return `<row ${attributes}>${body}</row>`;
}

function orderedTasks(tasks: readonly ProjectTaskDto[]): OrderedTask[] {
  if (tasks.length > MAX_TASKS) {
    throw new ProjectExcelExportError("EXPORT_LIMIT_EXCEEDED", `Task count exceeds ${MAX_TASKS}.`);
  }
  const byExternalId = new Map<string, ProjectTaskDto>();
  for (const task of tasks) {
    if (byExternalId.has(task.externalId)) {
      throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", "Duplicate externalId in canonical snapshot.");
    }
    byExternalId.set(task.externalId, task);
    const unscheduled = task.type === "summary" && task.start === null && task.end === null && task.duration === null && task.progress === null;
    if (!unscheduled && (task.start === null || task.end === null || task.duration === null || task.progress === null || !validDateOnly(task.start) || !validDateOnly(task.end) || epochDay(task.end) < epochDay(task.start))) {
      throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", `Invalid task schedule: ${task.externalId}`);
    }
  }

  const children = new Map<string | null, ProjectTaskDto[]>();
  for (const task of tasks) {
    if (task.parentExternalId !== null && !byExternalId.has(task.parentExternalId)) {
      throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", `Missing parent: ${task.externalId}`);
    }
    const bucket = children.get(task.parentExternalId) ?? [];
    bucket.push(task);
    children.set(task.parentExternalId, bucket);
  }
  for (const bucket of children.values()) {
    bucket.sort((left, right) => left.siblingOrder - right.siblingOrder || left.externalId.localeCompare(right.externalId));
  }

  const result: OrderedTask[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (task: ProjectTaskDto, depth: number, wbs: string) => {
    if (visiting.has(task.externalId) || visited.has(task.externalId)) {
      throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", "Invalid task hierarchy.");
    }
    visiting.add(task.externalId);
    result.push({ task, depth, wbs, row: result.length + 6 });
    (children.get(task.externalId) ?? []).forEach((child, index) => walk(child, depth + 1, `${wbs}.${index + 1}`));
    visiting.delete(task.externalId);
    visited.add(task.externalId);
  };
  (children.get(null) ?? []).forEach((task, index) => walk(task, 0, String(index + 1)));
  if (result.length !== tasks.length) {
    throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", "Hierarchy contains an unreachable cycle.");
  }
  return result;
}

function timeline(tasks: readonly OrderedTask[]): string[] {
  if (tasks.length === 0) return [];
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const { task } of tasks) {
    if (task.start === null || task.end === null) continue;
    first = Math.min(first, epochDay(task.start));
    last = Math.max(last, epochDay(task.end));
  }
  if (!Number.isFinite(first)) return [];
  const days = last - first + 1;
  if (days > MAX_TIMELINE_DAYS) {
    throw new ProjectExcelExportError("EXPORT_LIMIT_EXCEEDED", `Timeline exceeds ${MAX_TIMELINE_DAYS} days.`);
  }
  if (days * Math.max(tasks.length, 1) > MAX_TIMELINE_CELLS) {
    throw new ProjectExcelExportError("EXPORT_LIMIT_EXCEEDED", `Timeline matrix exceeds ${MAX_TIMELINE_CELLS} cells.`);
  }
  return Array.from({ length: days }, (_, index) => dateFromEpochDay(first + index));
}

export function excelIsoWeekHeader(value: string): Readonly<{ key: string; label: string }> {
  const date = new Date(epochDay(value) * DAY_MS);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil((((date.getTime() - yearStart) / DAY_MS) + 1) / 7);
  return {
    key: `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`,
    label: String(week),
  };
}

function groups(values: readonly string[], label: (value: string) => string) {
  const result: Array<{ start: number; end: number; text: string }> = [];
  values.forEach((value, index) => {
    const text = label(value);
    const latest = result.at(-1);
    if (latest?.text === text) latest.end = index;
    else result.push({ start: index, end: index, text });
  });
  return result;
}

function stylesXml(): string {
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">
<numFmts count=\"2\"><numFmt numFmtId=\"164\" formatCode=\"yyyy-mm-dd\"/><numFmt numFmtId=\"165\" formatCode=\"0%\"/></numFmts>
<fonts count=\"3\"><font><sz val=\"10\"/><name val=\"Aptos\"/></font><font><b/><sz val=\"14\"/><name val=\"Aptos Display\"/></font><font><b/><sz val=\"10\"/><color rgb=\"FFFFFFFF\"/><name val=\"Aptos\"/></font></fonts>
<fills count=\"9\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF334155\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE2E8F0\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF2563EB\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF0F766E\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFF1F5F9\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFFFF7ED\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF7C3AED\"/></patternFill></fill></fills>
<borders count=\"2\"><border/><border><left style=\"thin\"/><right style=\"thin\"/><top style=\"thin\"/><bottom style=\"thin\"/><diagonal/></border></borders>
<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>
<cellXfs count=\"14\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/><xf numFmtId=\"0\" fontId=\"2\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"><alignment horizontal=\"center\" vertical=\"center\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyFill=\"1\" applyBorder=\"1\"><alignment horizontal=\"center\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyBorder=\"1\"/><xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\"/><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyBorder=\"1\"/><xf numFmtId=\"165\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\"/><xf numFmtId=\"0\" fontId=\"0\" fillId=\"4\" borderId=\"1\" xfId=\"0\" applyFill=\"1\"/><xf numFmtId=\"0\" fontId=\"0\" fillId=\"5\" borderId=\"1\" xfId=\"0\" applyFill=\"1\"/><xf numFmtId=\"0\" fontId=\"0\" fillId=\"6\" borderId=\"1\" xfId=\"0\" applyFill=\"1\"/><xf numFmtId=\"0\" fontId=\"0\" fillId=\"7\" borderId=\"1\" xfId=\"0\" applyFill=\"1\"/><xf numFmtId=\"0\" fontId=\"0\" fillId=\"8\" borderId=\"1\" xfId=\"0\" applyFill=\"1\"><alignment horizontal=\"center\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/></cellXfs>
<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>`;
}

const ALLOWED_DEPENDENCY_TYPES = new Set(["FS", "SS", "FF", "SF"]);

function validateLinks(links: readonly ProjectLinkDto[], tasks: readonly OrderedTask[]): void {
  if (links.length > MAX_DEPENDENCIES) {
    throw new ProjectExcelExportError("EXPORT_LIMIT_EXCEEDED", `Dependency count exceeds ${MAX_DEPENDENCIES}.`);
  }
  const ids = new Set(tasks.map(({ task }) => task.externalId));
  for (const link of links) {
    if (!ALLOWED_DEPENDENCY_TYPES.has(link.type) || typeof link.lag !== "number" || !Number.isInteger(link.lag) || !ids.has(link.predecessorExternalId) || !ids.has(link.successorExternalId)) {
      throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", `Unsupported dependency: ${link.id}`);
    }
  }
}

function ganttSheet(snapshot: ProjectSnapshotResponse, tasks: readonly OrderedTask[], dates: readonly string[], request: ProjectExcelExportRequest) {
  const { project, links } = snapshot.data;
  const selected = new Map(request.layout.columns.map((column) => [column.id, column.widthPx]));
  const grid = [
    { id: "wbs", title: "WBS", width: 72 },
    { id: "text", title: "작업", width: selected.get("text") ?? 224 },
    ...(selected.has("externalId") ? [{ id: "externalId", title: "외부 ID", width: selected.get("externalId") ?? 128 }] : []),
    { id: "projectStart", title: "시작", width: selected.get("projectStart") ?? 128 },
    { id: "projectDuration", title: "기간", width: selected.get("projectDuration") ?? 84 },
  ];
  const timelineStart = grid.length + 1;
  const rows: string[] = [
    rowXml(1, [{ column: 1, style: STYLE.title, value: project.name }], 0, 24),
    rowXml(2, [{ column: 1, style: STYLE.muted, value: `Revision ${project.revision} · ${project.calendar.timezone}` }]),
  ];
  const monthCells: Cell[] = grid.map((item, index) => ({ column: index + 1, style: STYLE.header, value: item.title }));
  const weekCells: Cell[] = [];
  const dayCells: Cell[] = [];
  dates.forEach((date, index) => {
    const column = timelineStart + index;
    monthCells.push({ column, style: STYLE.header });
    weekCells.push({ column, style: STYLE.subheader });
    dayCells.push({ column, style: STYLE.subheader, value: date.slice(8, 10) });
  });
  for (const group of groups(dates, (date) => date.slice(0, 7))) {
    monthCells[grid.length + group.start] = { column: timelineStart + group.start, style: STYLE.header, value: group.text };
  }
  for (const group of groups(dates, (date) => excelIsoWeekHeader(date).key)) {
    weekCells[group.start] = {
      column: timelineStart + group.start,
      style: STYLE.subheader,
      value: excelIsoWeekHeader(dates[group.start]).label,
    };
  }
  rows.push(rowXml(3, monthCells, 0, 22), rowXml(4, weekCells, 0, 20), rowXml(5, dayCells, 0, 20));

  const holidays = new Set(project.calendar.holidays.map((holiday) => holiday.date));
  for (const entry of tasks) {
    const cells: Cell[] = [];
    let column = 1;
    cells.push({ column: column++, style: STYLE.text, value: entry.wbs });
    cells.push({ column: column++, style: STYLE.text, value: `${"  ".repeat(Math.min(entry.depth, MAX_OUTLINE_LEVEL))}${entry.task.name}` });
    if (selected.has("externalId")) cells.push({ column: column++, style: STYLE.text, value: entry.task.externalId });
    cells.push({ column: column++, style: STYLE.date, type: "number", value: entry.task.start === null ? undefined : excelSerial(entry.task.start) });
    cells.push({ column: column++, style: STYLE.integer, type: "number", value: entry.task.duration ?? undefined });
    const start = entry.task.start === null ? null : epochDay(entry.task.start);
    const end = entry.task.end === null ? null : epochDay(entry.task.end);
    dates.forEach((date, index) => {
      const current = epochDay(date);
      const weekday = new Date(current * DAY_MS).getUTCDay();
      let style = STYLE.default;
      let value: string | undefined;
      if (holidays.has(date)) style = STYLE.holiday;
      else if (project.calendar.weekendDays.includes(weekday as 0 | 6)) style = STYLE.weekend;
      if (entry.task.type === "milestone" && date === entry.task.start) {
        style = STYLE.milestone;
        value = "◆";
      } else if (start !== null && end !== null && current >= start && current <= end) {
        style = entry.task.type === "summary" ? STYLE.summaryBar : STYLE.taskBar;
      }
      if (style !== STYLE.default || value !== undefined) cells.push({ column: timelineStart + index, style, value });
    });
    rows.push(rowXml(entry.row, cells, Math.min(entry.depth, MAX_OUTLINE_LEVEL), 18));
  }
  if (tasks.length === 0) rows.push(rowXml(6, [{ column: 1, style: STYLE.muted, value: "등록된 작업이 없습니다." }]));

  const merges = grid.map((_, index) => `${columnName(index + 1)}3:${columnName(index + 1)}5`);
  for (const group of groups(dates, (date) => date.slice(0, 7))) {
    if (group.end > group.start) merges.push(`${cellReference(timelineStart + group.start, 3)}:${cellReference(timelineStart + group.end, 3)}`);
  }
  for (const group of groups(dates, (date) => excelIsoWeekHeader(date).key)) {
    if (group.end > group.start) merges.push(`${cellReference(timelineStart + group.start, 4)}:${cellReference(timelineStart + group.end, 4)}`);
  }
  const cols = [
    ...grid.map((item, index) => `<col min=\"${index + 1}\" max=\"${index + 1}\" width=\"${Math.max(3, Math.min(100, item.width / 7)).toFixed(2)}\" customWidth=\"1\"/>`),
    ...(dates.length ? [`<col min=\"${timelineStart}\" max=\"${timelineStart + dates.length - 1}\" width=\"4.2\" customWidth=\"1\"/>`] : []),
  ].join("");
  const lastColumn = columnName(Math.max(grid.length, timelineStart + dates.length - 1));
  const lastRow = Math.max(6, tasks.length + 5);
  const drawing = request.includeDependencies && links.length > 0;
  return {
    timelineStart,
    xml: `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheetPr><outlinePr summaryBelow=\"0\"/><pageSetUpPr fitToPage=\"1\"/></sheetPr><dimension ref=\"A1:${lastColumn}${lastRow}\"/><sheetViews><sheetView workbookViewId=\"0\" showGridLines=\"0\"><pane xSplit=\"${grid.length}\" ySplit=\"5\" topLeftCell=\"${cellReference(timelineStart, 6)}\" activePane=\"bottomRight\" state=\"frozen\"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"18\" outlineLevelRow=\"7\"/><cols>${cols}</cols><sheetData>${rows.join("")}</sheetData>${merges.length ? `<mergeCells count=\"${merges.length}\">${merges.map((ref) => `<mergeCell ref=\"${ref}\"/>`).join("")}</mergeCells>` : ""}<pageMargins left=\"0.25\" right=\"0.25\" top=\"0.5\" bottom=\"0.5\" header=\"0.2\" footer=\"0.2\"/><pageSetup orientation=\"landscape\" paperSize=\"9\" fitToWidth=\"1\" fitToHeight=\"0\"/>${drawing ? '<drawing r:id="rId1"/>' : ""}</worksheet>`,
  };
}

function tasksSheet(tasks: readonly OrderedTask[], links: readonly ProjectLinkDto[], includeDependencies: boolean): string {
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  if (includeDependencies) {
    for (const link of links) {
      const before = predecessors.get(link.successorExternalId) ?? [];
      before.push(link.predecessorExternalId);
      predecessors.set(link.successorExternalId, before);
      const after = successors.get(link.predecessorExternalId) ?? [];
      after.push(link.successorExternalId);
      successors.set(link.predecessorExternalId, after);
    }
  }
  const headers = ["WBS", "작업", "외부 ID", "유형", "시작", "종료", "기간(근무일)", "진행률", "설명", "URL", ...(includeDependencies ? ["선행 작업", "후행 작업"] : [])];
  const rows = [rowXml(1, headers.map((value, index) => ({ column: index + 1, style: STYLE.header, value })), 0, 22)];
  tasks.forEach((entry, index) => {
    const task = entry.task;
    const cells: Cell[] = [
      { column: 1, style: STYLE.text, value: entry.wbs },
      { column: 2, style: STYLE.text, value: task.name },
      { column: 3, style: STYLE.text, value: task.externalId },
      { column: 4, style: STYLE.text, value: task.type },
      { column: 5, style: STYLE.date, type: "number", value: task.start === null ? undefined : excelSerial(task.start) },
      { column: 6, style: STYLE.date, type: "number", value: task.end === null ? undefined : excelSerial(task.end) },
      { column: 7, style: STYLE.integer, type: "number", value: task.duration ?? undefined },
      { column: 8, style: STYLE.percent, type: "number", value: task.progress === null ? undefined : task.progress / 100 },
      { column: 9, style: STYLE.text, value: task.description ?? "" },
      { column: 10, style: STYLE.text, value: task.url ?? "" },
    ];
    if (includeDependencies) {
      cells.push({ column: 11, style: STYLE.text, value: (predecessors.get(task.externalId) ?? []).join(", ") });
      cells.push({ column: 12, style: STYLE.text, value: (successors.get(task.externalId) ?? []).join(", ") });
    }
    rows.push(rowXml(index + 2, cells, Math.min(entry.depth, MAX_OUTLINE_LEVEL)));
  });
  const lastColumn = columnName(headers.length);
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetPr><outlinePr summaryBelow=\"0\"/></sheetPr><dimension ref=\"A1:${lastColumn}${Math.max(1, tasks.length + 1)}\"/><sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"18\" outlineLevelRow=\"7\"/><sheetData>${rows.join("")}</sheetData><autoFilter ref=\"A1:${lastColumn}${Math.max(1, tasks.length + 1)}\"/><pageMargins left=\"0.25\" right=\"0.25\" top=\"0.5\" bottom=\"0.5\" header=\"0.2\" footer=\"0.2\"/></worksheet>`;
}

function projectSheet(snapshot: ProjectSnapshotResponse, taskCount: number, includeDependencies: boolean): string {
  const { project, links } = snapshot.data;
  const rows: string[] = [];
  const pair = (row: number, key: string, value: string | number, type: "string" | "number" = "string") => rowXml(row, [
    { column: 1, style: STYLE.header, value: key },
    { column: 2, style: STYLE.text, type, value },
  ]);
  rows.push(pair(1, "프로젝트", project.name), pair(2, "프로젝트 ID", project.publicId), pair(3, "Revision", project.revision, "number"), pair(4, "설명", project.description), pair(5, "시간대", project.calendar.timezone), pair(6, "작업 수", taskCount, "number"), pair(7, "관계 포함", includeDependencies ? "예" : "아니오"));
  if (includeDependencies) rows.push(pair(8, "관계 수", links.length, "number"));
  const holidayStart = includeDependencies ? 10 : 9;
  rows.push(rowXml(holidayStart, [{ column: 1, style: STYLE.header, value: "휴일" }, { column: 2, style: STYLE.header, value: "이름" }]));
  project.calendar.holidays.forEach((holiday, index) => rows.push(rowXml(holidayStart + index + 1, [{ column: 1, style: STYLE.date, type: "number", value: excelSerial(holiday.date) }, { column: 2, style: STYLE.text, value: holiday.name ?? "" }])));
  const statusLabels: Record<ProjectStatus, string> = {
    planned: "예정",
    in_progress: "진행 중",
    completed: "완료",
  };
  const statusRow = holidayStart + project.calendar.holidays.length + 1;
  rows.push(pair(statusRow, "프로젝트 상태", statusLabels[project.status]));
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><dimension ref=\"A1:B${statusRow}\"/><sheetViews><sheetView workbookViewId=\"0\"/></sheetViews><sheetData>${rows.join("")}</sheetData><pageMargins left=\"0.25\" right=\"0.25\" top=\"0.5\" bottom=\"0.5\" header=\"0.2\" footer=\"0.2\"/></worksheet>`;
}

function dependenciesSheet(links: readonly ProjectLinkDto[], tasks: readonly OrderedTask[]): string {
  const byId = new Map(tasks.map((entry) => [entry.task.externalId, entry]));
  const headers = ["관계 ID", "유형", "Lag", "선행 WBS", "선행 작업", "선행 외부 ID", "후행 WBS", "후행 작업", "후행 외부 ID"];
  const rows = [rowXml(1, headers.map((value, index) => ({ column: index + 1, style: STYLE.header, value })), 0, 22)];
  links.forEach((link, index) => {
    const predecessor = byId.get(link.predecessorExternalId)!;
    const successor = byId.get(link.successorExternalId)!;
    rows.push(rowXml(index + 2, [
      { column: 1, style: STYLE.text, value: link.id }, { column: 2, style: STYLE.text, value: link.type }, { column: 3, style: STYLE.integer, type: "number", value: link.lag },
      { column: 4, style: STYLE.text, value: predecessor.wbs }, { column: 5, style: STYLE.text, value: predecessor.task.name }, { column: 6, style: STYLE.text, value: predecessor.task.externalId },
      { column: 7, style: STYLE.text, value: successor.wbs }, { column: 8, style: STYLE.text, value: successor.task.name }, { column: 9, style: STYLE.text, value: successor.task.externalId },
    ]));
  });
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><dimension ref=\"A1:I${Math.max(1, links.length + 1)}\"/><sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews><sheetData>${rows.join("")}</sheetData><autoFilter ref=\"A1:I${Math.max(1, links.length + 1)}\"/><pageMargins left=\"0.25\" right=\"0.25\" top=\"0.5\" bottom=\"0.5\" header=\"0.2\" footer=\"0.2\"/></worksheet>`;
}

function drawingXml(links: readonly ProjectLinkDto[], tasks: readonly OrderedTask[], dates: readonly string[], timelineStart: number): string {
  const byId = new Map(tasks.map((entry) => [entry.task.externalId, entry]));
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const connectors = links.map((link, index) => {
    const predecessor = byId.get(link.predecessorExternalId)!;
    const successor = byId.get(link.successorExternalId)!;
    if (predecessor.task.end === null || successor.task.start === null) throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", "Unscheduled dependency endpoint.");
    const fromCol = timelineStart - 1 + (dateIndex.get(predecessor.task.end) ?? 0);
    const toCol = timelineStart - 1 + (dateIndex.get(successor.task.start) ?? 0);
    const fromRow = predecessor.row - 1;
    const toRow = successor.row - 1;
    const left = Math.min(fromCol + 1, toCol);
    const right = Math.max(fromCol + 1, toCol);
    const top = Math.min(fromRow, toRow);
    const bottom = Math.max(fromRow, toRow);
    return `<xdr:twoCellAnchor editAs=\"oneCell\"><xdr:from><xdr:col>${left}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${top}</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:to><xdr:col>${Math.max(left + 1, right)}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${Math.max(top + 1, bottom)}</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:to><xdr:cxnSp macro=\"\"><xdr:nvCxnSpPr><xdr:cNvPr id=\"${index + 1}\" name=\"Dependency ${index + 1}\"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr><xdr:spPr><a:prstGeom prst=\"bentConnector3\"><a:avLst/></a:prstGeom><a:ln w=\"12700\"><a:solidFill><a:srgbClr val=\"64748B\"/></a:solidFill><a:tailEnd type=\"triangle\" w=\"sm\" len=\"sm\"/></a:ln></xdr:spPr></xdr:cxnSp><xdr:clientData/></xdr:twoCellAnchor>`;
  }).join("");
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><xdr:wsDr xmlns:xdr=\"http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\">${connectors}</xdr:wsDr>`;
}

function workbookXml(names: readonly string[]): string {
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><bookViews><workbookView activeTab=\"0\"/></bookViews><sheets>${names.map((name, index) => `<sheet name=\"${xml(name)}\" sheetId=\"${index + 1}\" r:id=\"rId${index + 1}\"/>`).join("")}</sheets></workbook>`;
}

function workbookRels(sheetCount: number): string {
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">${Array.from({ length: sheetCount }, (_, index) => `<Relationship Id=\"rId${index + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet${index + 1}.xml\"/>`).join("")}<Relationship Id=\"rId${sheetCount + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>`;
}

function contentTypes(sheetCount: number, drawing: boolean): string {
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>${Array.from({ length: sheetCount }, (_, index) => `<Override PartName=\"/xl/worksheets/sheet${index + 1}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>`).join("")}${drawing ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ""}</Types>`;
}

const ROOT_RELS = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>`;
const DRAWING_RELS = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing\" Target=\"../drawings/drawing1.xml\"/></Relationships>`;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function u32(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function zip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const content = typeof entry.content === "string" ? Buffer.from(entry.content, "utf8") : Buffer.from(entry.content);
    const compressed = deflateRawSync(content, { level: 6 });
    const crc = crc32(content);
    const header = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(8), u16(0), u16(33), u32(crc), u32(compressed.length), u32(content.length), u16(name.length), u16(0), name]);
    local.push(header, compressed);
    central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(8), u16(0), u16(33), u32(crc), u32(compressed.length), u32(content.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += header.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(directory.length), u32(offset), u16(0)]);
  return Uint8Array.from(Buffer.concat([...local, directory, end]));
}

function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function logisticsSheet(snapshot: ProjectSnapshotResponse, tasks: readonly OrderedTask[]): string {
  const logistics = snapshot.data.logistics;
  if (!logistics) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`;
  }

  const taskByPublicId = new Map(tasks.map((t) => [t.task.taskId, t]));
  const processById = new Map(logistics.processes.map((p) => [p.id, p]));
  const systemById = new Map(logistics.systems.map((s) => [s.id, s]));
  const equipmentById = new Map(logistics.equipment.map((e) => [e.id, e]));

  const rows: string[] = [];
  let currentRow = 1;

  const addRow = (cells: Cell[], height?: number) => {
    rows.push(rowXml(currentRow, cells, 0, height));
    currentRow += 1;
  };

  const addSectionHeader = (title: string) => {
    addRow([{ column: 1, style: STYLE.title, value: safeText(title) }], 24);
  };

  const addTableHeaders = (headers: string[]) => {
    addRow(headers.map((value, idx) => ({ column: idx + 1, style: STYLE.header, value: safeText(value) })), 22);
  };

  // 1. 안내 및 프로젝트/물류 메타데이터 개요
  addRow([
    {
      column: 1,
      style: STYLE.muted,
      value: "본 시트는 물류 구성 보고용 출력물이며, 전체 프로젝트 무손실 재가져오기(Import) 백업 파일이 아닙니다.",
    },
  ]);
  currentRow += 1;

  addSectionHeader("1. 프로젝트 및 물류 구성 요약");
  const totalQuantity = logistics.equipment.reduce((sum, eq) => sum + (eq.quantity || 0), 0);
  const taskLinksCount = (logistics.taskEquipmentLinks?.length ?? 0) + (logistics.taskSystemLinks?.length ?? 0);

  const summaryPairs: [string, string | number, ("string" | "number")?][] = [
    ["프로젝트명", snapshot.data.project.name],
    ["프로젝트 ID", snapshot.data.project.publicId],
    ["프로젝트 Revision", snapshot.data.project.revision, "number"],
    ["산출 기준일", new Date().toISOString().slice(0, 10)],
    ["등록 공정 수", logistics.processes.length, "number"],
    ["등록 설비 수 (총 수량)", `${logistics.equipment.length}개 (${totalQuantity}대)`],
    ["등록 시스템 수", logistics.systems.length, "number"],
    ["태스크-물류 연결 수", taskLinksCount, "number"],
  ];
  for (const [k, v, type] of summaryPairs) {
    addRow([
      { column: 1, style: STYLE.header, value: safeText(k) },
      { column: 2, style: STYLE.text, type: type ?? "string", value: typeof v === "number" ? v : safeText(v) },
    ]);
  }
  currentRow += 1;

  // 2. 공정 마스터 (Processes)
  addSectionHeader("2. 공정 마스터 (Processes)");
  addTableHeaders(["공정 코드", "공정명", "상위 공정 코드", "상위 공정명", "정렬 순서", "활성 상태", "공정 ID"]);
  for (const proc of logistics.processes) {
    const parent = proc.parentProcessId ? processById.get(proc.parentProcessId) : undefined;
    addRow([
      { column: 1, style: STYLE.text, value: safeText(proc.code) },
      { column: 2, style: STYLE.text, value: safeText(proc.name) },
      { column: 3, style: STYLE.text, value: safeText(parent?.code ?? "-") },
      { column: 4, style: STYLE.text, value: safeText(parent?.name ?? "-") },
      { column: 5, style: STYLE.integer, type: "number", value: proc.sortOrder },
      { column: 6, style: STYLE.text, value: proc.active ? "활성" : "비활성" },
      { column: 7, style: STYLE.text, value: safeText(proc.id) },
    ]);
  }
  currentRow += 1;

  // 3. 설비 마스터 및 제어/역할 (Equipment)
  addSectionHeader("3. 설비 마스터 및 제어/역할 (Equipment)");
  addTableHeaders([
    "설비 코드",
    "설비명",
    "설비 유형",
    "관리 단위",
    "수량",
    "소속 공정 코드",
    "제어 시스템(역할)",
    "담당 리소스(역할/주담당)",
    "제조사",
    "모델",
    "설명",
    "활성 상태",
    "설비 ID",
  ]);
  for (const eq of logistics.equipment) {
    const proc = processById.get(eq.processId);
    const controlDesc = eq.controlSystems
      .map((cs) => {
        const sys = systemById.get(cs.systemId);
        const roleLabel = cs.controlRole === "primary" ? "주" : "보조";
        return `${sys?.code ?? cs.systemId}(${roleLabel})`;
      })
      .join(", ");
    const roleDesc = eq.resourceRoles
      .map((rr) => {
        const primaryTag = rr.isPrimary ? "(주)" : "";
        return `${rr.resourceName}${primaryTag}[${rr.role}]`;
      })
      .join(", ");

    addRow([
      { column: 1, style: STYLE.text, value: safeText(eq.code) },
      { column: 2, style: STYLE.text, value: safeText(eq.name) },
      { column: 3, style: STYLE.text, value: safeText(eq.equipmentType) },
      { column: 4, style: STYLE.text, value: safeText(eq.managementUnit) },
      { column: 5, style: STYLE.integer, type: "number", value: eq.quantity },
      { column: 6, style: STYLE.text, value: safeText(proc?.code ?? "-") },
      { column: 7, style: STYLE.text, value: safeText(controlDesc || "-") },
      { column: 8, style: STYLE.text, value: safeText(roleDesc || "-") },
      { column: 9, style: STYLE.text, value: safeText(eq.manufacturer ?? "") },
      { column: 10, style: STYLE.text, value: safeText(eq.model ?? "") },
      { column: 11, style: STYLE.text, value: safeText(eq.description ?? "") },
      { column: 12, style: STYLE.text, value: eq.active ? "활성" : "비활성" },
      { column: 13, style: STYLE.text, value: safeText(eq.id) },
    ]);
  }
  currentRow += 1;

  // 4. 물류 시스템 마스터 (Systems)
  addSectionHeader("4. 물류 시스템 마스터 및 조율/역할 (Systems)");
  addTableHeaders([
    "시스템 코드",
    "시스템명",
    "시스템 유형",
    "계층(Layer)",
    "범위(Scope)",
    "담당 공정",
    "조율 대상 시스템",
    "담당 리소스(역할/주담당)",
    "공급사(Vendor)",
    "설명",
    "활성 상태",
    "시스템 ID",
  ]);
  for (const sys of logistics.systems) {
    const procCodes = (sys.processIds ?? [])
      .map((pid) => processById.get(pid)?.code ?? pid)
      .join(", ");
    const coordCodes = (sys.coordinatedSystemIds ?? [])
      .map((cid) => systemById.get(cid)?.code ?? cid)
      .join(", ");
    const sysRoleDesc = sys.resourceRoles
      .map((rr) => {
        const primaryTag = rr.isPrimary ? "(주)" : "";
        return `${rr.resourceName}${primaryTag}[${rr.role}]`;
      })
      .join(", ");

    addRow([
      { column: 1, style: STYLE.text, value: safeText(sys.code) },
      { column: 2, style: STYLE.text, value: safeText(sys.name) },
      { column: 3, style: STYLE.text, value: safeText(sys.systemType) },
      { column: 4, style: STYLE.text, value: safeText(sys.layer) },
      { column: 5, style: STYLE.text, value: safeText(sys.scope) },
      { column: 6, style: STYLE.text, value: safeText(procCodes || "-") },
      { column: 7, style: STYLE.text, value: safeText(coordCodes || "-") },
      { column: 8, style: STYLE.text, value: safeText(sysRoleDesc || "-") },
      { column: 9, style: STYLE.text, value: safeText(sys.vendor ?? "") },
      { column: 10, style: STYLE.text, value: safeText(sys.description ?? "") },
      { column: 11, style: STYLE.text, value: sys.active ? "활성" : "비활성" },
      { column: 12, style: STYLE.text, value: safeText(sys.id) },
    ]);
  }
  currentRow += 1;

  // 5. 태스크-물류 연결 (Task Logistics Links)
  addSectionHeader("5. 태스크-물류 연결 (Task Logistics Links)");
  addTableHeaders([
    "태스크 WBS",
    "태스크 명",
    "태스크 외부 ID",
    "대상 구분",
    "대상 코드",
    "대상 명",
    "연결 범위",
    "태스크 ID",
    "대상 ID",
  ]);

  const eqLinks = logistics.taskEquipmentLinks ?? [];
  for (const link of eqLinks) {
    const taskEntry = taskByPublicId.get(link.taskId);
    const eq = equipmentById.get(link.equipmentId);
    addRow([
      { column: 1, style: STYLE.text, value: safeText(taskEntry?.wbs ?? "-") },
      { column: 2, style: STYLE.text, value: safeText(taskEntry?.task.name ?? "-") },
      { column: 3, style: STYLE.text, value: safeText(taskEntry?.task.externalId ?? "-") },
      { column: 4, style: STYLE.text, value: "설비" },
      { column: 5, style: STYLE.text, value: safeText(eq?.code ?? "-") },
      { column: 6, style: STYLE.text, value: safeText(eq?.name ?? "-") },
      { column: 7, style: STYLE.text, value: link.scope === "subtree" ? "하위포함(subtree)" : "단일작업(self)" },
      { column: 8, style: STYLE.text, value: safeText(link.taskId) },
      { column: 9, style: STYLE.text, value: safeText(link.equipmentId) },
    ]);
  }

  const sysLinks = logistics.taskSystemLinks ?? [];
  for (const link of sysLinks) {
    const taskEntry = taskByPublicId.get(link.taskId);
    const sys = systemById.get(link.systemId);
    addRow([
      { column: 1, style: STYLE.text, value: safeText(taskEntry?.wbs ?? "-") },
      { column: 2, style: STYLE.text, value: safeText(taskEntry?.task.name ?? "-") },
      { column: 3, style: STYLE.text, value: safeText(taskEntry?.task.externalId ?? "-") },
      { column: 4, style: STYLE.text, value: "시스템" },
      { column: 5, style: STYLE.text, value: safeText(sys?.code ?? "-") },
      { column: 6, style: STYLE.text, value: safeText(sys?.name ?? "-") },
      { column: 7, style: STYLE.text, value: link.scope === "subtree" ? "하위포함(subtree)" : "단일작업(self)" },
      { column: 8, style: STYLE.text, value: safeText(link.taskId) },
      { column: 9, style: STYLE.text, value: safeText(link.systemId) },
    ]);
  }

  const maxCol = 13;
  const lastColName = columnName(maxCol);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColName}${Math.max(1, currentRow)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>${rows.join("")}</sheetData><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

type ResourceEffortExportRow = {
  task: ResourceWorkloadTaskDto;
  resource: {
    id: string;
    code: string | null;
    name: string;
    developerGrade?: string | null;
    overAllocated: boolean;
  };
  groupNames: Set<string>;
};

function effortRoleLabel(role: string | undefined): string {
  if (role === "PI") return "PI";
  if (role === "DEVELOPER") return "개발자 (DEVELOPER)";
  if (role === "EQUIPMENT_OWNER") return "설비 담당 (EQUIPMENT_OWNER)";
  return "미지정 (UNSPECIFIED)";
}

function developerGradeLabel(grade: string | null | undefined): string {
  if (grade === "BEGINNER") return "초급";
  if (grade === "INTERMEDIATE") return "중급";
  if (grade === "ADVANCED") return "고급";
  if (grade === "EXPERT") return "특급";
  return "미지정";
}

function taskStatusLabel(status: string | undefined): string {
  if (status === "not_started") return "시작 전";
  if (status === "in_progress") return "진행 중";
  if (status === "completed") return "완료";
  return "미지정";
}

function roundEffort(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function resourceEffortRows(workload: ResourceWorkloadResponse): ResourceEffortExportRow[] {
  const rows = new Map<string, ResourceEffortExportRow>();
  for (const group of workload.data.groups) {
    for (const resource of group.resources) {
      for (const task of resource.tasks) {
        const current = rows.get(task.assignmentId);
        if (current) {
          current.groupNames.add(group.name);
          continue;
        }
        if (rows.size >= MAX_RESOURCE_EFFORT_ROWS) {
          throw new ProjectExcelExportError("EXPORT_LIMIT_EXCEEDED", `Resource effort rows exceed ${MAX_RESOURCE_EFFORT_ROWS}.`);
        }
        rows.set(task.assignmentId, {
          task,
          resource: {
            id: resource.id,
            code: resource.code,
            name: resource.name,
            developerGrade: resource.developerGrade,
            overAllocated: resource.overAllocated,
          },
          groupNames: new Set([group.name]),
        });
      }
    }
  }
  return [...rows.values()].sort((left, right) =>
    left.resource.name.localeCompare(right.resource.name, "ko")
    || left.task.start.localeCompare(right.task.start)
    || left.task.taskName.localeCompare(right.task.taskName, "ko")
    || left.task.assignmentId.localeCompare(right.task.assignmentId));
}

function effortNumberCell(column: number, value: number | null): Cell {
  return value === null
    ? { column, style: STYLE.text, value: "미설정" }
    : { column, style: STYLE.integer, type: "number", value };
}

function resourceEffortSummarySheet(
  snapshot: ProjectSnapshotResponse,
  workload: ResourceWorkloadResponse,
  details: readonly ResourceEffortExportRow[],
): string {
  const rows: string[] = [];
  let row = 1;
  const add = (cells: Cell[], height?: number) => {
    rows.push(rowXml(row, cells, 0, height));
    row += 1;
  };
  const pair = (label: string, cell: Cell) => add([
    { column: 1, style: STYLE.header, value: safeText(label) },
    { ...cell, column: 2 },
  ]);

  add([{ column: 1, style: STYLE.title, value: "Resource Effort Summary" }], 24);
  add([{ column: 1, style: STYLE.muted, value: "계획 공수(M/D·M/M) 견적 보고서이며 실제 소진 공수·비용을 의미하지 않습니다." }]);
  pair("프로젝트", { column: 2, style: STYLE.text, value: safeText(snapshot.data.project.name) });
  pair("프로젝트 ID", { column: 2, style: STYLE.text, value: safeText(snapshot.data.project.publicId) });
  pair("Project Revision", { column: 2, style: STYLE.integer, type: "number", value: workload.data.projectRevision });
  pair("Catalog Revision", { column: 2, style: STYLE.integer, type: "number", value: workload.data.catalogRevision });
  pair("산출 기준일", workload.data.asOfDate
    ? { column: 2, style: STYLE.date, type: "number", value: excelSerial(workload.data.asOfDate) }
    : { column: 2, style: STYLE.text, value: "미설정" });
  pair("조회 시작", { column: 2, style: STYLE.date, type: "number", value: excelSerial(workload.data.range.from) });
  pair("조회 종료", { column: 2, style: STYLE.date, type: "number", value: excelSerial(workload.data.range.to) });
  pair("RESOURCE_MD_PER_MM", workload.data.mdPerMm === null
    ? { column: 2, style: STYLE.text, value: "미설정" }
    : { column: 2, style: STYLE.integer, type: "number", value: workload.data.mdPerMm });
  pair("전체 계획 M/D", { column: 2, style: STYLE.integer, type: "number", value: workload.data.grandTotalMd });
  pair("전체 계획 M/M", effortNumberCell(2, workload.data.grandTotalMm));
  pair("공수 미설정 건수", { column: 2, style: STYLE.integer, type: "number", value: workload.data.unsetCount });
  pair("역할 미지정 건수", { column: 2, style: STYLE.integer, type: "number", value: workload.data.unspecifiedRoleCount ?? 0 });
  pair("과투입 Resource 수", { column: 2, style: STYLE.integer, type: "number", value: workload.data.overAllocatedResourceCount ?? 0 });
  row += 1;

  add([{ column: 1, style: STYLE.title, value: "역할별 계획 공수" }], 24);
  add(["역할", "Assignment 수", "M/D", "M/M", "공수 미설정"].map((value, index) => ({
    column: index + 1, style: STYLE.header, value,
  })), 22);
  for (const total of workload.data.roleTotals ?? []) {
    add([
      { column: 1, style: STYLE.text, value: effortRoleLabel(total.role) },
      { column: 2, style: STYLE.integer, type: "number", value: total.assignmentCount },
      { column: 3, style: STYLE.integer, type: "number", value: total.effortMd },
      effortNumberCell(4, total.effortMm),
      { column: 5, style: STYLE.integer, type: "number", value: total.unsetCount },
    ]);
  }
  row += 1;

  const developers = new Map<string, {
    id: string; code: string | null; name: string; grade: string | null | undefined;
    groupNames: Set<string>; assignmentCount: number; effortMd: number; unsetCount: number; overAllocated: boolean;
  }>();
  for (const detail of details) {
    if (detail.task.role !== "DEVELOPER") continue;
    let current = developers.get(detail.resource.id);
    if (!current) {
      current = {
        id: detail.resource.id, code: detail.resource.code, name: detail.resource.name,
        grade: detail.resource.developerGrade, groupNames: new Set(), assignmentCount: 0,
        effortMd: 0, unsetCount: 0, overAllocated: detail.resource.overAllocated,
      };
      developers.set(detail.resource.id, current);
    }
    for (const groupName of detail.groupNames) current.groupNames.add(groupName);
    current.assignmentCount += 1;
    if (detail.task.effortMd === null) current.unsetCount += 1;
    else current.effortMd = roundEffort(current.effortMd + detail.task.effortMd);
  }

  add([{ column: 1, style: STYLE.title, value: "개발자별 계획 공수" }], 24);
  add(["Resource ID", "코드", "이름", "개발자 등급", "Resource Group", "Assignment 수", "M/D", "M/M", "미설정", "과투입"].map((value, index) => ({
    column: index + 1, style: STYLE.header, value,
  })), 22);
  for (const developer of [...developers.values()].sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id))) {
    const effortMm = workload.data.mdPerMm === null ? null : roundEffort(developer.effortMd / workload.data.mdPerMm);
    add([
      { column: 1, style: STYLE.text, value: safeText(developer.id) },
      { column: 2, style: STYLE.text, value: safeText(developer.code ?? "") },
      { column: 3, style: STYLE.text, value: safeText(developer.name) },
      { column: 4, style: STYLE.text, value: developerGradeLabel(developer.grade) },
      { column: 5, style: STYLE.text, value: safeText([...developer.groupNames].sort((a, b) => a.localeCompare(b, "ko")).join(", ")) },
      { column: 6, style: STYLE.integer, type: "number", value: developer.assignmentCount },
      { column: 7, style: STYLE.integer, type: "number", value: developer.effortMd },
      effortNumberCell(8, effortMm),
      { column: 9, style: STYLE.integer, type: "number", value: developer.unsetCount },
      { column: 10, style: STYLE.text, value: developer.overAllocated ? "예" : "아니오" },
    ]);
  }
  if (developers.size === 0) add([{ column: 1, style: STYLE.muted, value: "DEVELOPER assignment가 없습니다." }]);

  const lastRow = Math.max(1, row - 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:J${lastRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="10" width="20" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function resourceEffortDetailSheet(
  tasks: readonly OrderedTask[],
  details: readonly ResourceEffortExportRow[],
): string {
  const taskById = new Map(tasks.map((entry) => [entry.task.taskId, entry]));
  const headers = [
    "Assignment ID", "Task ID", "WBS", "Task", "Task 상태", "진행률", "Task 시작", "Task 종료",
    "Resource ID", "Resource 코드", "Resource 이름", "수행 역할", "개발자 등급", "Resource Group",
    "Assignment 시작", "Assignment 종료", "Allocation %", "유효 근무일", "Effort M/D", "Effort M/M",
    "지연", "공수 설정",
  ];
  const rows = [rowXml(1, headers.map((value, index) => ({ column: index + 1, style: STYLE.header, value })), 0, 22)];
  details.forEach((detail, index) => {
    const taskEntry = taskById.get(detail.task.taskId);
    const cells: Cell[] = [
      { column: 1, style: STYLE.text, value: safeText(detail.task.assignmentId) },
      { column: 2, style: STYLE.text, value: safeText(detail.task.taskId) },
      { column: 3, style: STYLE.text, value: safeText(taskEntry?.wbs ?? "") },
      { column: 4, style: STYLE.text, value: safeText(detail.task.taskName) },
      { column: 5, style: STYLE.text, value: taskStatusLabel(detail.task.status) },
      detail.task.progress === null || detail.task.progress === undefined
        ? { column: 6, style: STYLE.text, value: "미설정" }
        : { column: 6, style: STYLE.percent, type: "number", value: detail.task.progress / 100 },
      detail.task.taskStart ? { column: 7, style: STYLE.date, type: "number", value: excelSerial(detail.task.taskStart) } : { column: 7, style: STYLE.text, value: "미설정" },
      detail.task.taskEnd ? { column: 8, style: STYLE.date, type: "number", value: excelSerial(detail.task.taskEnd) } : { column: 8, style: STYLE.text, value: "미설정" },
      { column: 9, style: STYLE.text, value: safeText(detail.resource.id) },
      { column: 10, style: STYLE.text, value: safeText(detail.resource.code ?? "") },
      { column: 11, style: STYLE.text, value: safeText(detail.resource.name) },
      { column: 12, style: STYLE.text, value: effortRoleLabel(detail.task.role) },
      { column: 13, style: STYLE.text, value: developerGradeLabel(detail.resource.developerGrade) },
      { column: 14, style: STYLE.text, value: safeText([...detail.groupNames].sort((a, b) => a.localeCompare(b, "ko")).join(", ")) },
      { column: 15, style: STYLE.date, type: "number", value: excelSerial(detail.task.start) },
      { column: 16, style: STYLE.date, type: "number", value: excelSerial(detail.task.end) },
      detail.task.allocationPercent === null
        ? { column: 17, style: STYLE.text, value: "미설정" }
        : { column: 17, style: STYLE.percent, type: "number", value: detail.task.allocationPercent / 100 },
      detail.task.effectiveWorkingDays === undefined
        ? { column: 18, style: STYLE.text, value: "미설정" }
        : { column: 18, style: STYLE.integer, type: "number", value: detail.task.effectiveWorkingDays },
      effortNumberCell(19, detail.task.effortMd),
      effortNumberCell(20, detail.task.effortMm),
      { column: 21, style: STYLE.text, value: detail.task.delayed ? "예" : "아니오" },
      { column: 22, style: STYLE.text, value: detail.task.effortConfigured ? "설정" : "미설정" },
    ];
    rows.push(rowXml(index + 2, cells));
  });
  const lastRow = Math.max(1, details.length + 1);
  const lastColumn = columnName(headers.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="22" width="18" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

export function buildProjectExcelWorkbook(
  snapshot: ProjectSnapshotResponse,
  request: ProjectExcelExportRequest,
  resourceWorkload?: ResourceWorkloadResponse,
): Uint8Array<ArrayBuffer> {
  const tasks = orderedTasks(snapshot.data.tasks);
  const dates = timeline(tasks);
  if (request.includeDependencies) validateLinks(snapshot.data.links, tasks);
  const gantt = ganttSheet(snapshot, tasks, dates, request);
  const drawing = request.includeDependencies && snapshot.data.links.length > 0;
  const includeLogistics = Boolean(request.includeLogistics && snapshot.data.logistics);
  const includeResourceEffort = Boolean(request.includeResourceEffort);
  if (includeResourceEffort && (!resourceWorkload || resourceWorkload.data.projectRevision !== snapshot.data.project.revision)) {
    throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", "Resource workload must match the exported Project revision.");
  }
  const effortRows = includeResourceEffort ? resourceEffortRows(resourceWorkload!) : [];
  const names = [
    "Gantt",
    "Tasks",
    "Project",
    ...(request.includeDependencies ? ["Dependencies"] : []),
    ...(includeLogistics ? ["Logistics"] : []),
    ...(includeResourceEffort ? ["Resource Effort Summary", "Resource Effort Detail"] : []),
  ];
  const entries: ZipEntry[] = [
    { path: "[Content_Types].xml", content: contentTypes(names.length, drawing) },
    { path: "_rels/.rels", content: ROOT_RELS },
    { path: "xl/workbook.xml", content: workbookXml(names) },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRels(names.length) },
    { path: "xl/styles.xml", content: stylesXml() },
    { path: "xl/worksheets/sheet1.xml", content: gantt.xml },
    { path: "xl/worksheets/sheet2.xml", content: tasksSheet(tasks, request.includeDependencies ? snapshot.data.links : [], request.includeDependencies) },
    { path: "xl/worksheets/sheet3.xml", content: projectSheet(snapshot, tasks.length, request.includeDependencies) },
  ];
  let nextSheetIndex = 4;
  if (request.includeDependencies) {
    entries.push({ path: `xl/worksheets/sheet${nextSheetIndex}.xml`, content: dependenciesSheet(snapshot.data.links, tasks) });
    nextSheetIndex += 1;
  }
  if (includeLogistics) {
    entries.push({ path: `xl/worksheets/sheet${nextSheetIndex}.xml`, content: logisticsSheet(snapshot, tasks) });
    nextSheetIndex += 1;
  }
  if (includeResourceEffort) {
    entries.push({ path: `xl/worksheets/sheet${nextSheetIndex}.xml`, content: resourceEffortSummarySheet(snapshot, resourceWorkload!, effortRows) });
    nextSheetIndex += 1;
    entries.push({ path: `xl/worksheets/sheet${nextSheetIndex}.xml`, content: resourceEffortDetailSheet(tasks, effortRows) });
    nextSheetIndex += 1;
  }
  if (drawing) {
    entries.push({ path: "xl/worksheets/_rels/sheet1.xml.rels", content: DRAWING_RELS });
    entries.push({ path: "xl/drawings/drawing1.xml", content: drawingXml(snapshot.data.links, tasks, dates, gantt.timelineStart) });
  }
  return zip(entries);
}

export const projectExcelExportLimits = Object.freeze({
  maxTasks: MAX_TASKS,
  maxDependencies: MAX_DEPENDENCIES,
  maxTimelineDays: MAX_TIMELINE_DAYS,
  maxTimelineCells: MAX_TIMELINE_CELLS,
  maxCellText: MAX_CELL_TEXT,
  maxResourceEffortRows: MAX_RESOURCE_EFFORT_ROWS,
  maxOutlineLevel: MAX_OUTLINE_LEVEL,
});
