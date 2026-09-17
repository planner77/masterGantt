import type Database from "better-sqlite3";

import type {
  ResourceWorkloadGroupDto,
  ResourceWorkloadResourceDto,
  ResourceWorkloadResponse,
  ResourceWorkloadTaskDto,
} from "../../contracts/resources";
import { createWorkingCalendar, isWorkingDay, workingDaysBetween } from "../../domain/scheduling/calendar";
import { dateToOrdinal, ordinalToDate, parseDateOnly } from "../../domain/scheduling/date-only";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";

export class ResourceWorkloadInvalidRangeError extends Error {}

function round(value: number): number { return Math.round(value * 10000) / 10000; }
function minDate(values: Array<string | null>): string | null { const filtered = values.filter((value): value is string => value !== null); return filtered.length ? filtered.reduce((a, b) => a < b ? a : b) : null; }
function maxDate(values: Array<string | null>): string | null { const filtered = values.filter((value): value is string => value !== null); return filtered.length ? filtered.reduce((a, b) => a > b ? a : b) : null; }
function parseMdPerMm(value: string | undefined): number | null { if (value === undefined || value.trim() === "") return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }

export class ResourceWorkloadService {
  private readonly projects: ProjectRepository;
  private readonly schedules: ScheduleRepository;
  private readonly catalog: ResourceCatalogRepository;
  constructor(private readonly database: Database.Database) {
    this.projects = new ProjectRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.catalog = new ResourceCatalogRepository(database);
  }

  get(projectPublicId: string, fromInput?: string | null, toInput?: string | null, mdPerMmInput?: string): ResourceWorkloadResponse | undefined {
    const project = this.projects.findByPublicId(projectPublicId);
    if (!project) return undefined;
    const tasks = this.schedules.listTasks(project.id);
    const taskById = new Map(tasks.map((task) => [task.publicId, task]));
    const holidays = this.schedules.listHolidays(project.id).map((holiday) => ({ date: holiday.holidayDate, name: holiday.name }));
    const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays });
    const assignments = this.catalog.listAssignments(project.id).filter((assignment) => assignment.kind === "resource");
    const resources = this.catalog.listResources();
    const groups = this.catalog.listGroups();
    const taskDates = tasks.flatMap((task) => [task.startDate, task.endDate]);
    const fallback = new Date().toISOString().slice(0, 10);
    const from = fromInput ?? (taskDates.length ? taskDates.reduce((a, b) => a < b ? a : b) : fallback);
    const to = toInput ?? (taskDates.length ? taskDates.reduce((a, b) => a > b ? a : b) : from);
    try { parseDateOnly(from, "from"); parseDateOnly(to, "to"); } catch { throw new ResourceWorkloadInvalidRangeError(); }
    if (from > to) throw new ResourceWorkloadInvalidRangeError();
    const mdPerMm = parseMdPerMm(mdPerMmInput);
    const resourceRows = new Map<string, ResourceWorkloadResourceDto>();
    let unsetCount = 0;
    const uniqueEffort = new Map<string, number>();

    for (const assignment of assignments) {
      const task = taskById.get(assignment.taskPublicId);
      const resource = resources.find((candidate) => candidate.publicId === assignment.targetPublicId);
      if (!task || !resource || task.type !== "task") continue;
      const effectiveStart = assignment.assignmentStart ?? task.startDate;
      const effectiveEnd = assignment.assignmentEnd ?? task.endDate;
      const start = effectiveStart < from ? from : effectiveStart;
      const end = effectiveEnd > to ? to : effectiveEnd;
      if (start > end) continue;
      const configured = assignment.allocationPercent !== null;
      const effortMd = configured ? round(workingDaysBetween(start, end, calendar) * assignment.allocationPercent! / 100) : null;
      const effortMm = effortMd === null || mdPerMm === null ? null : round(effortMd / mdPerMm);
      const detail: ResourceWorkloadTaskDto = { assignmentId: assignment.publicId, taskId: task.publicId, taskName: task.name, start, end, allocationPercent: assignment.allocationPercent, effortMd, effortMm, effortConfigured: configured };
      let row = resourceRows.get(resource.publicId);
      if (!row) {
        row = { id: resource.publicId, name: resource.name, code: resource.code, active: resource.active, start: null, end: null, effortMd: 0, effortMm: mdPerMm === null ? null : 0, unsetCount: 0, overAllocated: false, tasks: [] };
        resourceRows.set(resource.publicId, row);
      }
      row.tasks.push(detail); row.start = minDate([row.start, start]); row.end = maxDate([row.end, end]);
      if (effortMd === null) { row.unsetCount += 1; unsetCount += 1; } else { row.effortMd = round(row.effortMd + effortMd); uniqueEffort.set(assignment.publicId, effortMd); }
    }

    for (const row of resourceRows.values()) {
      row.effortMm = mdPerMm === null ? null : round(row.effortMd / mdPerMm);
      const daily = new Map<string, number>();
      for (const detail of row.tasks) {
        if (!detail.effortConfigured || detail.allocationPercent === null) continue;
        for (let ordinal = dateToOrdinal(detail.start); ordinal <= dateToOrdinal(detail.end); ordinal += 1) {
          const date = ordinalToDate(ordinal); if (!isWorkingDay(date, calendar)) continue;
          const next = (daily.get(date) ?? 0) + detail.allocationPercent; daily.set(date, next); if (next > 100) row.overAllocated = true;
        }
      }
      row.tasks.sort((a, b) => a.start.localeCompare(b.start) || a.taskName.localeCompare(b.taskName, "ko"));
    }

    const groupedIds = new Set(groups.flatMap((group) => group.memberResourceIds));
    const resultGroups: ResourceWorkloadGroupDto[] = [];
    for (const group of groups) {
      const members = group.memberResourceIds.map((id) => resourceRows.get(id)).filter((row): row is ResourceWorkloadResourceDto => !!row);
      if (members.length === 0) continue;
      resultGroups.push({ id: group.publicId, name: group.name, active: group.active, start: minDate(members.map((row) => row.start)), end: maxDate(members.map((row) => row.end)), effortMd: round(members.reduce((sum, row) => sum + row.effortMd, 0)), effortMm: mdPerMm === null ? null : round(members.reduce((sum, row) => sum + row.effortMd, 0) / mdPerMm), unsetCount: members.reduce((sum, row) => sum + row.unsetCount, 0), resources: members });
    }
    const ungrouped = [...resourceRows.values()].filter((row) => !groupedIds.has(row.id));
    if (ungrouped.length) resultGroups.push({ id: null, name: "미분류 리소스", active: true, start: minDate(ungrouped.map((row) => row.start)), end: maxDate(ungrouped.map((row) => row.end)), effortMd: round(ungrouped.reduce((sum, row) => sum + row.effortMd, 0)), effortMm: mdPerMm === null ? null : round(ungrouped.reduce((sum, row) => sum + row.effortMd, 0) / mdPerMm), unsetCount: ungrouped.reduce((sum, row) => sum + row.unsetCount, 0), resources: ungrouped });
    const grandTotalMd = round([...uniqueEffort.values()].reduce((sum, value) => sum + value, 0));
    return { data: { projectRevision: project.revision, catalogRevision: this.catalog.getRevision(), range: { from, to }, mdPerMm, grandTotalMd, grandTotalMm: mdPerMm === null ? null : round(grandTotalMd / mdPerMm), unsetCount, groups: resultGroups } };
  }
}
