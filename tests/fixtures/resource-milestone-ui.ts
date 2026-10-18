import type { ResourceDashboardDto, ResourceDashboardGroupChildrenDto, ResourceDashboardSummary } from "../../src/contracts/resource-dashboard";
import { longResourceDashboardUiFixture } from "./resource-dashboard-ui";
import type { StatefulProjectFixture } from "./stateful-project";
export function milestoneUiFixture(fixture: StatefulProjectFixture, query: URLSearchParams): ResourceDashboardDto {
  const data = longResourceDashboardUiFixture(fixture, query);
  data.stages = Array.from({ length: 13 }, (_, i) => ({ milestoneTaskId: `00005261-0000-4000-8000-${String(i).padStart(12, "0")}`, name: (`단계 ${i} 긴 한국어 Milestone Long English identity `.repeat(4)).slice(0, 200), scheduledDate: i < 2 ? "2026-09-18" : `2026-09-${String(18 + Math.floor(i / 3)).padStart(2, "0")}`, status: "in_progress", full: { memberCount: 10, completedMemberCount: 2, memberProgressPercent: 40, predecessorCount: 1, incompletePredecessorCount: 1, ready: false, blocked: true, manualEvent: false, completionInconsistent: false }, selected: data.summary }));
  const ids = [...data.stages.map(s => s.milestoneTaskId), null];
  const cell = (s: ResourceDashboardSummary, id: string | null): ResourceDashboardSummary => ({ ...s, taskCount: id === null ? 3 : 9, completed: 1, delayed: 2, assignmentCount: s.resourceCount * (id === null ? 3 : 9), effort: { ...s.effort, knownMd: s.effort.knownMd / 14, plannedMd: s.effort.knownMd / 14, plannedMm: data.mdPerMm ? s.effort.knownMd / 14 / data.mdPerMm : null }, selector: { ...s.selector, milestoneTaskId: id, assignmentScope: "selected" } });
  for (const row of [...data.resources, ...data.groups]) row.milestones = ids.map(id => ({ milestoneTaskId: id, summary: cell(row.summary, id) }));
  // One explicit absent intersection distinguishes missing from configured zero.
  data.resources[1].milestones = data.resources[1].milestones.filter(c => c.milestoneTaskId !== ids[0]);
  data.resources[2].milestones[0].summary.effort = { knownMd: 0, plannedMd: 0, plannedMm: 0, state: "configured", partial: false, unsetCount: 0 };
  data.milestones = ids.map(id => ({ milestoneTaskId: id, summary: cell(data.summary, id) }));
  data.catalog.milestones = data.stages.map(s => ({ id: s.milestoneTaskId, name: s.name }));
  data.reference = { ...data.summary, selector: { ...data.summary.selector, assignmentScope: "milestoneReference" } };
  data.excluded = { ...data.summary, taskCount: 0, assignmentCount: 0, resourceCount: 0, effort: { knownMd: 0, plannedMd: 0, plannedMm: data.mdPerMm ? 0 : null, partial: false, unsetCount: 0, state: "empty" }, selector: { ...data.summary.selector, assignmentScope: "milestoneExcluded" } };
  data.milestoneSelection = { applied: false, reference: "A without Milestone filter", excluded: "reference Assignment IDs minus selected Assignment IDs" };
  return data;
}
export function childrenUiFixture(data: ResourceDashboardDto, query: URLSearchParams): ResourceDashboardGroupChildrenDto {
  const groupId = query.get("groupId") === "ungrouped" ? null : query.get("groupId")!;
  const milestoneTaskId = query.has("milestoneTaskId") ? query.get("milestoneTaskId") === "unassigned" ? null : query.get("milestoneTaskId")! : undefined;
  const group = data.groups.find(g => g.id === groupId)!;
  const selected = data.resources.filter(r => group.resourceIds.includes(r.id!)).map(r => ({ ...r, summary: { ...r.summary, selector: { ...r.summary.selector, dimension: "group" as const, id: groupId, resourceId: r.id!, ...(milestoneTaskId !== undefined ? { milestoneTaskId } : {}) } }, milestones: r.milestones.map(c => ({ ...c, summary: { ...c.summary, selector: { ...c.summary.selector, dimension: "group" as const, id: groupId, resourceId: r.id! } } })) }));
  const offset = Number(query.get("offset")), limit = Number(query.get("limit"));
  return { schema: data.schema, projectPublicId: data.projectPublicId, projectRevision: data.projectRevision, catalogRevision: data.catalogRevision, calendarRevision: data.calendarRevision, snapshotId: data.snapshotId, filters: data.filters, range: data.range, asOfDate: data.asOfDate, mdPerMm: data.mdPerMm, mdPerMmSource: data.mdPerMmSource, groupId, ...(milestoneTaskId !== undefined ? { milestoneTaskId } : {}), summary: group.summary, offset, limit, totalCount: selected.length, nextOffset: offset + limit < selected.length ? offset + limit : null, rows: selected.slice(offset, offset + limit) };
}
