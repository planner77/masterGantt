import { deflateRawSync } from "node:zlib";

import type { ProjectLinkDto, ProjectSnapshotResponse, ProjectStatus, ProjectTaskDto } from "@/contracts/projects";
import type { ProjectExcelExportRequest } from "@/contracts/project-excel-export";

const MAX_TASKS = 5_000;
const MAX_DEPENDENCIES = 20_000;
const MAX_TIMELINE_DAYS = 3_650;
const MAX_TIMELINE_CELLS = 1_000_000;
const MAX_CELL_TEXT = 32_767;
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
    if (!validDateOnly(task.start) || !validDateOnly(task.end) || epochDay(task.end) < epochDay(task.start)) {
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
    first = Math.min(first, epochDay(task.start));
    last = Math.max(last, epochDay(task.end));
  }
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

function validateLinks(links: readonly ProjectLinkDto[], tasks: readonly OrderedTask[]): void {
  if (links.length > MAX_DEPENDENCIES) {
    throw new ProjectExcelExportError("EXPORT_LIMIT_EXCEEDED", `Dependency count exceeds ${MAX_DEPENDENCIES}.`);
  }
  const ids = new Set(tasks.map(({ task }) => task.externalId));
  for (const link of links) {
    if (link.type !== "FS" || link.lag !== 0 || !ids.has(link.predecessorExternalId) || !ids.has(link.successorExternalId)) {
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
    cells.push({ column: column++, style: STYLE.date, type: "number", value: excelSerial(entry.task.start) });
    cells.push({ column: column++, style: STYLE.integer, type: "number", value: entry.task.duration });
    const start = epochDay(entry.task.start);
    const end = epochDay(entry.task.end);
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
      } else if (current >= start && current <= end) {
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
      { column: 5, style: STYLE.date, type: "number", value: excelSerial(task.start) },
      { column: 6, style: STYLE.date, type: "number", value: excelSerial(task.end) },
      { column: 7, style: STYLE.integer, type: "number", value: task.duration },
      { column: 8, style: STYLE.percent, type: "number", value: task.progress / 100 },
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

export function buildProjectExcelWorkbook(snapshot: ProjectSnapshotResponse, request: ProjectExcelExportRequest): Uint8Array<ArrayBuffer> {
  const tasks = orderedTasks(snapshot.data.tasks);
  const dates = timeline(tasks);
  if (request.includeDependencies) validateLinks(snapshot.data.links, tasks);
  const gantt = ganttSheet(snapshot, tasks, dates, request);
  const drawing = request.includeDependencies && snapshot.data.links.length > 0;
  const names = ["Gantt", "Tasks", "Project", ...(request.includeDependencies ? ["Dependencies"] : [])];
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
  if (request.includeDependencies) entries.push({ path: "xl/worksheets/sheet4.xml", content: dependenciesSheet(snapshot.data.links, tasks) });
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
  maxOutlineLevel: MAX_OUTLINE_LEVEL,
});
