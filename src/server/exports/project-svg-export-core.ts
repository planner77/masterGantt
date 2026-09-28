import type { ProjectGanttImageExportRequest } from "@/contracts/project-gantt-image-export";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "@/contracts/projects";
import { dateToOrdinal, dayOfWeek, ordinalToDate } from "../../domain/scheduling/date-only";

const MAX_TASKS = 5_000;
const MAX_LINKS = 20_000;
const MAX_DAYS = 3_650;
const MAX_CELLS = 1_000_000;
const MAX_SIDE_PX = 16_384;
const MAX_BYTES = 16 * 1_024 * 1_024;
const MAX_TEXT = 32_767;
const ROW_HEIGHT = 28;
const TITLE_HEIGHT = 52;
const HEADER_HEIGHT = 56;
const BOTTOM_MARGIN = 20;
const GRID_WIDTH = 480;
const DAY_WIDTH = 32;
const WEEK_DAY_WIDTH = 10;

export class ProjectSvgExportError extends Error {
  readonly code: "EXPORT_LIMIT_EXCEEDED" | "EXPORT_UNSUPPORTED" | "EXPORT_RANGE_NO_OVERLAP";

  constructor(code: "EXPORT_LIMIT_EXCEEDED" | "EXPORT_UNSUPPORTED" | "EXPORT_RANGE_NO_OVERLAP", message: string) {
    super(message);
    this.name = "ProjectSvgExportError";
    this.code = code;
  }
}

interface Row {
  task: ProjectTaskDto;
  depth: number;
  wbs: string;
  start: number;
  end: number;
}

function xml(value: string): string {
  const characters = Array.from(value);
  if (characters.length > MAX_TEXT) {
    throw new ProjectSvgExportError("EXPORT_LIMIT_EXCEEDED", "SVG text exceeds the export limit.");
  }
  return characters.map((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d
      || codePoint >= 0xd800 && codePoint <= 0xdfff
      || (codePoint & 0xffff) >= 0xfffe
      ? "\uFFFD"
      : character;
  }).join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function label(value: string, max = 36): string {
  const characters = Array.from(value);
  return xml(characters.length > max ? `${characters.slice(0, max - 1).join("")}…` : value);
}

function ordinal(value: string): number {
  try {
    return dateToOrdinal(value);
  } catch {
    throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "Canonical snapshot contains an invalid date.");
  }
}

function orderedRows(tasks: readonly ProjectTaskDto[]): Row[] {
  if (tasks.length > MAX_TASKS) {
    throw new ProjectSvgExportError("EXPORT_LIMIT_EXCEEDED", "Task count exceeds the SVG export limit.");
  }
  const byId = new Map<string, ProjectTaskDto>();
  const children = new Map<string | null, ProjectTaskDto[]>();
  for (const task of tasks) {
    if (byId.has(task.externalId)) {
      throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "Canonical snapshot contains duplicate task IDs.");
    }
    byId.set(task.externalId, task);
    const bucket = children.get(task.parentExternalId) ?? [];
    bucket.push(task);
    children.set(task.parentExternalId, bucket);
  }
  for (const task of tasks) {
    if (task.parentExternalId !== null && !byId.has(task.parentExternalId)) {
      throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "Canonical snapshot has an unknown parent.");
    }
  }
  for (const bucket of children.values()) {
    bucket.sort((left, right) => left.siblingOrder - right.siblingOrder || left.externalId.localeCompare(right.externalId));
  }
  const rows: Row[] = [];
  const seen = new Set<string>();
  const walk = (task: ProjectTaskDto, depth: number, wbs: string) => {
    if (seen.has(task.externalId)) {
      throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "Canonical snapshot has an invalid task hierarchy.");
    }
    seen.add(task.externalId);
    const start = ordinal(task.start);
    const end = ordinal(task.end);
    if (end < start || !Number.isFinite(task.duration) || !Number.isFinite(task.progress)) {
      throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "Canonical snapshot has an invalid task schedule.");
    }
    rows.push({ task, depth, wbs, start, end });
    (children.get(task.externalId) ?? []).forEach((child, index) => walk(child, depth + 1, `${wbs}.${index + 1}`));
  };
  (children.get(null) ?? []).forEach((task, index) => walk(task, 0, String(index + 1)));
  if (rows.length !== tasks.length) {
    throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "Canonical snapshot has an unreachable task cycle.");
  }
  return rows;
}

function isoWeek(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() + 4 - day);
  const year = parsed.getUTCFullYear();
  const first = Date.UTC(year, 0, 1);
  const number = Math.ceil(((parsed.getTime() - first) / 86_400_000 + 1) / 7);
  return `${year}-W${String(number).padStart(2, "0")}`;
}

function headerGroups(dates: readonly string[], key: (date: string) => string): Array<{ start: number; end: number; value: string }> {
  const groups: Array<{ start: number; end: number; value: string }> = [];
  dates.forEach((date, index) => {
    const value = key(date);
    const last = groups.at(-1);
    if (last?.value === value) last.end = index + 1;
    else groups.push({ start: index, end: index + 1, value });
  });
  return groups;
}

/** Builds an image exclusively from one canonical project snapshot; no client rows or SVG markup are accepted. */
export function buildProjectGanttSvg(snapshot: ProjectSnapshotResponse, request: ProjectGanttImageExportRequest): string {
  const rows = orderedRows(snapshot.data.tasks);
  if (snapshot.data.links.length > MAX_LINKS) {
    throw new ProjectSvgExportError("EXPORT_LIMIT_EXCEEDED", "Dependency count exceeds the SVG export limit.");
  }
  const projectFirst = rows.length ? Math.min(...rows.map((row) => row.start)) : null;
  const projectLast = rows.length ? Math.max(...rows.map((row) => row.end)) : null;
  const first = request.scope === "range"
    ? ordinal(request.startDate)
    : projectFirst ?? ordinal("2000-01-01");
  const last = request.scope === "range"
    ? ordinal(request.endDate)
    : projectLast ?? first;
  const days = last - first + 1;
  if (days < 1) throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "The export date range is invalid.");
  if (request.scope === "range" && (projectFirst === null || projectLast === null || last < projectFirst || first > projectLast)) {
    throw new ProjectSvgExportError("EXPORT_RANGE_NO_OVERLAP", "The selected range does not overlap the project timeline.");
  }
  if (days > MAX_DAYS || days * Math.max(rows.length, 1) > MAX_CELLS) {
    throw new ProjectSvgExportError("EXPORT_LIMIT_EXCEEDED", "SVG timeline exceeds the export limit.");
  }
  const dayWidth = request.scale === "day" ? DAY_WIDTH : WEEK_DAY_WIDTH;
  const gridWidth = request.scope === "project" ? GRID_WIDTH : 0;
  const chartX = gridWidth;
  const chartWidth = days * dayWidth;
  const width = chartX + chartWidth;
  const titleHeight = request.scope === "project" ? TITLE_HEIGHT : 0;
  const rowTop = titleHeight + HEADER_HEIGHT;
  const height = rowTop + Math.max(rows.length, 1) * ROW_HEIGHT + BOTTOM_MARGIN;
  if (width > MAX_SIDE_PX || height > MAX_SIDE_PX) {
    throw new ProjectSvgExportError("EXPORT_LIMIT_EXCEEDED", "SVG dimensions exceed the export limit.");
  }

  const dates = Array.from({ length: days }, (_, index) => ordinalToDate(first + index));
  const exceptions = new Map(snapshot.data.project.calendar.exceptions?.map((entry) => [entry.date, entry.dayType]));
  const holidays = new Set(snapshot.data.project.calendar.holidays.map((entry) => entry.date));
  const rowById = new Map(rows.map((row, index) => [row.task.externalId, { row, index }]));
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`,
    `<title>${xml(snapshot.data.project.name)} Gantt</title>`,
    `<desc>Revision ${snapshot.data.project.revision}; ${dates[0]} to ${dates.at(-1)}; ${rows.length} tasks</desc>`,
    `<defs><clipPath id="chart-clip"><rect x="${chartX}" y="${titleHeight}" width="${chartWidth}" height="${height - titleHeight}"/></clipPath><clipPath id="grid-clip"><rect x="0" y="${rowTop}" width="${gridWidth}" height="${height - rowTop}"/></clipPath><clipPath id="grid-name-clip"><rect x="0" y="${rowTop}" width="315" height="${height - rowTop}"/></clipPath><clipPath id="title-clip"><rect x="0" y="0" width="${width}" height="${titleHeight}"/></clipPath><marker id="link-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#64748b"/></marker></defs>`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    ...(request.scope === "project" ? [
      `<rect width="${width}" height="${titleHeight}" fill="#f8fafc"/>`,
      `<g clip-path="url(#title-clip)"><text x="16" y="27" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#0f172a">${label(snapshot.data.project.name, 90)}</text>`,
      `<text x="16" y="44" font-family="Arial,sans-serif" font-size="11" fill="#475569">${dates[0]} – ${dates.at(-1)} · r${snapshot.data.project.revision}</text></g>`,
    ] : []),
    `<rect x="0" y="${titleHeight}" width="${width}" height="${HEADER_HEIGHT}" fill="#eaf2ff"/>`,
  ];

  if (gridWidth) {
    parts.push(`<rect x="0" y="${titleHeight}" width="${gridWidth}" height="${HEADER_HEIGHT}" fill="#dbeafe"/>`);
    parts.push(`<text x="12" y="${titleHeight + 36}" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1e3a8a">WBS / 작업명</text>`);
    parts.push(`<text x="326" y="${titleHeight + 36}" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1e3a8a">시작</text>`);
    parts.push(`<text x="420" y="${titleHeight + 36}" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1e3a8a">기간</text>`);
  }

  for (const group of headerGroups(dates, (date) => date.slice(0, 7))) {
    const x = chartX + group.start * dayWidth;
    const groupWidth = (group.end - group.start) * dayWidth;
    parts.push(`<line x1="${x}" y1="${titleHeight}" x2="${x}" y2="${rowTop}" stroke="#b8cbe4"/>`);
    if (groupWidth >= 44) parts.push(`<text x="${x + 5}" y="${titleHeight + 19}" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#1e3a8a">${group.value}</text>`);
  }
  dates.forEach((date, index) => {
    const x = chartX + index * dayWidth;
    const override = exceptions.get(date);
    const nonWorking = override === "NON_WORKING" || (override !== "WORKING" && (holidays.has(date) || snapshot.data.project.calendar.weekendDays.some((day) => day === dayOfWeek(date))));
    if (nonWorking) {
      const fill = holidays.has(date) || override === "NON_WORKING" ? "#fff7ed" : "#f1f5f9";
      parts.push(`<rect x="${x}" y="${titleHeight + 28}" width="${dayWidth}" height="${height - titleHeight - 28}" fill="${fill}"/>`);
    }
  });
  if (request.scale === "day") {
    dates.forEach((date, index) => {
      const x = chartX + index * dayWidth;
      parts.push(`<text x="${x + 5}" y="${titleHeight + 47}" font-family="Arial,sans-serif" font-size="10" fill="#475569">${date.slice(8)}</text>`);
      parts.push(`<line x1="${x}" y1="${titleHeight + 28}" x2="${x}" y2="${height - BOTTOM_MARGIN}" stroke="#e2e8f0"/>`);
    });
  } else {
    for (const group of headerGroups(dates, isoWeek)) {
      const x = chartX + group.start * dayWidth;
      parts.push(`<line x1="${x}" y1="${titleHeight + 28}" x2="${x}" y2="${height - BOTTOM_MARGIN}" stroke="#d4dfeb"/>`);
      if ((group.end - group.start) * dayWidth >= 40) parts.push(`<text x="${x + 4}" y="${titleHeight + 47}" font-family="Arial,sans-serif" font-size="10" fill="#475569">${group.value}</text>`);
    }
  }
  parts.push(`<line x1="0" y1="${rowTop}" x2="${width}" y2="${rowTop}" stroke="#94a3b8"/>`);

  rows.forEach((row, index) => {
    const y = rowTop + index * ROW_HEIGHT;
    if (index % 2 === 1) parts.push(`<rect x="0" y="${y}" width="${width}" height="${ROW_HEIGHT}" fill="#f8fafc" fill-opacity="0.65"/>`);
    parts.push(`<line x1="0" y1="${y + ROW_HEIGHT}" x2="${width}" y2="${y + ROW_HEIGHT}" stroke="#e2e8f0"/>`);
  });
  if (gridWidth) {
    parts.push('<g clip-path="url(#grid-clip)">');
    rows.forEach((row, index) => {
      const y = rowTop + index * ROW_HEIGHT;
      const name = `${row.wbs} ${row.task.name}`;
      parts.push(`<g clip-path="url(#grid-name-clip)"><text x="${Math.min(12 + row.depth * 14, 178)}" y="${y + 18}" font-family="Arial,sans-serif" font-size="12" ${row.task.type === "summary" ? 'font-weight="700"' : ""} fill="#1e293b">${label(name, Math.max(8, 42 - row.depth * 2))}</text></g>`);
      parts.push(`<text x="326" y="${y + 18}" font-family="Arial,sans-serif" font-size="11" fill="#475569">${row.task.start}</text>`);
      parts.push(`<text x="430" y="${y + 18}" font-family="Arial,sans-serif" font-size="11" fill="#475569">${row.task.duration}</text>`);
    });
    parts.push("</g>");
  }
  if (!rows.length) parts.push(`<text x="${chartX + 16}" y="${rowTop + 19}" font-family="Arial,sans-serif" font-size="12" fill="#64748b">표시할 작업이 없습니다.</text>`);

  parts.push('<g clip-path="url(#chart-clip)">');
  for (const link of snapshot.data.links) {
    if (link.type !== "FS" || link.lag !== 0) {
      throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "Canonical snapshot has an unsupported dependency.");
    }
    const source = rowById.get(link.predecessorExternalId);
    const target = rowById.get(link.successorExternalId);
    if (!source || !target) {
      throw new ProjectSvgExportError("EXPORT_UNSUPPORTED", "Canonical snapshot has an unknown dependency endpoint.");
    }
    const x1 = chartX + (source.row.end - first + 1) * dayWidth;
    const x2 = chartX + (target.row.start - first) * dayWidth;
    if (Math.max(x1, x2) < chartX || Math.min(x1, x2) > chartX + chartWidth) continue;
    const y1 = rowTop + source.index * ROW_HEIGHT + ROW_HEIGHT / 2;
    const y2 = rowTop + target.index * ROW_HEIGHT + ROW_HEIGHT / 2;
    const middle = Math.max(x1 + 6, x2 - 8);
    parts.push(`<path d="M${x1} ${y1} H${middle} V${y2} H${x2}" fill="none" stroke="#64748b" stroke-width="1.5" marker-end="url(#link-arrow)"/>`);
  }
  rows.forEach((row, index) => {
    if (row.end < first || row.start > last) return;
    const visibleStart = Math.max(row.start, first);
    const visibleEnd = Math.min(row.end, last);
    const x = chartX + (visibleStart - first) * dayWidth;
    const barWidth = (visibleEnd - visibleStart + 1) * dayWidth;
    const y = rowTop + index * ROW_HEIGHT;
    const color = row.task.type === "summary" ? "#1e3a8a" : row.task.type === "milestone" ? "#7c3aed" : "#2563eb";
    if (row.task.type === "milestone") {
      const center = chartX + (row.start - first + 0.5) * dayWidth;
      const milestoneHalfWidth = Math.min(8, dayWidth / 2);
      parts.push(`<polygon points="${center},${y + 5} ${center + milestoneHalfWidth},${y + 14} ${center},${y + 23} ${center - milestoneHalfWidth},${y + 14}" fill="${color}"/>`);
    } else {
      parts.push(`<rect x="${x}" y="${y + 6}" width="${barWidth}" height="16" rx="3" fill="${color}"/>`);
      const progress = Math.max(0, Math.min(100, row.task.progress));
      const progressEnd = row.start + (row.end - row.start + 1) * progress / 100;
      const visibleProgressEnd = Math.min(progressEnd, visibleEnd + 1);
      if (visibleProgressEnd > visibleStart) {
        const progressWidth = Math.min(barWidth, Math.round((visibleProgressEnd - visibleStart) * dayWidth));
        if (progressWidth > 0) parts.push(`<rect x="${x}" y="${y + 6}" width="${progressWidth}" height="16" rx="3" fill="#0f766e"/>`);
      }
    }
    if (!gridWidth && barWidth >= 90) parts.push(`<text x="${x + 5}" y="${y + 18}" font-family="Arial,sans-serif" font-size="11" fill="#ffffff">${label(row.task.name, Math.max(4, Math.floor(barWidth / 7)))}</text>`);
  });
  parts.push("</g>");
  if (gridWidth) parts.push(`<line x1="${gridWidth}" y1="${titleHeight}" x2="${gridWidth}" y2="${height - BOTTOM_MARGIN}" stroke="#94a3b8"/>`);
  parts.push("</svg>");
  const result = parts.join("");
  if (Buffer.byteLength(result, "utf8") > MAX_BYTES) {
    throw new ProjectSvgExportError("EXPORT_LIMIT_EXCEEDED", "SVG byte size exceeds the export limit.");
  }
  return result;
}

export const projectSvgExportLimits = Object.freeze({
  maxTasks: MAX_TASKS,
  maxLinks: MAX_LINKS,
  maxDays: MAX_DAYS,
  maxCells: MAX_CELLS,
  maxSidePx: MAX_SIDE_PX,
  maxBytes: MAX_BYTES,
});
