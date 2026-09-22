import type { ProjectListItemDto } from "../../contracts/projects";
import {
  normalizeFilterText,
  textMatchesFilter,
  type TextOperator,
} from "./project-search-filter";

export type ProjectDateOperator = "any" | "equals" | "before" | "after" | "range";

export type ProjectFilterState = Readonly<{
  query: string;
  nameQuery: string;
  nameOperator: TextOperator;
  ownerQuery: string;
  ownerOperator: TextOperator;
  descriptionQuery: string;
  descriptionOperator: Exclude<TextOperator, "equals">;
  ownerState: "all" | "assigned" | "unassigned";
  createdOperator: ProjectDateOperator;
  createdFrom: string;
  createdTo: string;
  updatedOperator: ProjectDateOperator;
  updatedFrom: string;
  updatedTo: string;
}>;

export const EMPTY_PROJECT_FILTER: ProjectFilterState = {
  query: "",
  nameQuery: "",
  nameOperator: "contains",
  ownerQuery: "",
  ownerOperator: "contains",
  descriptionQuery: "",
  descriptionOperator: "contains",
  ownerState: "all",
  createdOperator: "any",
  createdFrom: "",
  createdTo: "",
  updatedOperator: "any",
  updatedFrom: "",
  updatedTo: "",
};

export type ProjectFilterValidation = Readonly<{
  created: string | null;
  updated: string | null;
}>;

function validateDateCondition(operator: ProjectDateOperator, from: string, to: string, label: string): string | null {
  if (operator === "any") return null;
  if (!from) return `${label} 날짜를 입력해 주세요.`;
  if (operator === "range" && !to) return `${label} 범위의 종료 날짜를 입력해 주세요.`;
  if (operator === "range" && from > to) return `${label} 범위의 시작 날짜가 종료 날짜보다 늦을 수 없습니다.`;
  return null;
}

export function validateProjectFilter(filter: ProjectFilterState): ProjectFilterValidation {
  return {
    created: validateDateCondition(filter.createdOperator, filter.createdFrom, filter.createdTo, "생성일"),
    updated: validateDateCondition(filter.updatedOperator, filter.updatedFrom, filter.updatedTo, "최근 변경일"),
  };
}

export function projectCalendarDate(value: string, timeZone: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function dateMatches(
  value: string,
  operator: ProjectDateOperator,
  from: string,
  to: string,
  timeZone: string,
): boolean {
  if (operator === "any") return true;
  const calendarDate = projectCalendarDate(value, timeZone);
  if (!calendarDate || !from) return false;
  if (operator === "equals") return calendarDate === from;
  if (operator === "before") return calendarDate < from;
  if (operator === "after") return calendarDate > from;
  if (!to || from > to) return false;
  return calendarDate >= from && calendarDate <= to;
}

function hasAssignedOwner(project: ProjectListItemDto): boolean {
  return normalizeFilterText(project.ownerName) !== "";
}

export function projectMatchesFilter(
  project: ProjectListItemDto,
  filter: ProjectFilterState,
  timeZone: string,
): boolean {
  const query = normalizeFilterText(filter.query);
  if (query) {
    const haystack = [project.name, project.ownerName, project.description].map(normalizeFilterText);
    if (!haystack.some((value) => value.includes(query))) return false;
  }
  if (!textMatchesFilter(project.name, filter.nameQuery, filter.nameOperator)) return false;
  if (!textMatchesFilter(project.ownerName, filter.ownerQuery, filter.ownerOperator)) return false;
  if (!textMatchesFilter(project.description, filter.descriptionQuery, filter.descriptionOperator)) return false;

  const ownerAssigned = hasAssignedOwner(project);
  if (filter.ownerState === "assigned" && !ownerAssigned) return false;
  if (filter.ownerState === "unassigned" && ownerAssigned) return false;

  if (!dateMatches(project.createdAt, filter.createdOperator, filter.createdFrom, filter.createdTo, timeZone)) return false;
  if (!dateMatches(project.updatedAt, filter.updatedOperator, filter.updatedFrom, filter.updatedTo, timeZone)) return false;
  return true;
}

export function filterProjectList(
  projects: readonly ProjectListItemDto[],
  filter: ProjectFilterState,
  timeZone: string,
  deletedIds: ReadonlySet<string> = new Set<string>(),
): ProjectListItemDto[] {
  return projects
    .filter(({ publicId }) => !deletedIds.has(publicId))
    .filter((project) => projectMatchesFilter(project, filter, timeZone));
}

export function activeProjectFilterCount(filter: ProjectFilterState): number {
  return [
    normalizeFilterText(filter.query) !== "",
    normalizeFilterText(filter.nameQuery) !== "",
    normalizeFilterText(filter.ownerQuery) !== "",
    normalizeFilterText(filter.descriptionQuery) !== "",
    filter.ownerState !== "all",
    filter.createdOperator !== "any",
    filter.updatedOperator !== "any",
  ].filter(Boolean).length;
}
