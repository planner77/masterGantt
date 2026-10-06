import type Database from "better-sqlite3";
import type { ImportPayload11 } from "../../contracts/import";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../contracts/projects";
import { taskStatusFromProgress, taskStatusProgressConsistent } from "../../domain/task-status";
import { PublicApiError } from "../http/api-error-core";
import { TaskFieldProjectService } from "../projects/task-field-project-service";
import { IMPORT_FILE_LIMIT_BYTES } from "../imports/project-import-parser-core";

/** Canonical sibling order is the file order; source UUIDs are advisory, never import identities. */
export function buildProjectJsonExport(snapshot: ProjectSnapshotResponse, exportedAt: string): ImportPayload11 {
  const tasks = snapshot.data.tasks;
  if (tasks.length > 5000 || snapshot.data.links.length > 20000) throw new PublicApiError(422, "EXPORT_LIMIT_EXCEEDED", "The Project exceeds JSON import limits.");
  const byExternal = new Map(tasks.map((task) => [task.externalId, task]));
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  if (byExternal.size !== tasks.length || byId.size !== tasks.length) throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Duplicate canonical Task identities.");
  const children = new Map<string | null, ProjectTaskDto[]>();
  for (const task of tasks) {
    if (task.parentExternalId !== null && byExternal.get(task.parentExternalId)?.type !== "summary") throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Invalid canonical parent.");
    const siblings = children.get(task.parentExternalId) ?? []; siblings.push(task); children.set(task.parentExternalId, siblings);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.siblingOrder - b.siblingOrder || a.externalId.localeCompare(b.externalId));
  const ordered: ProjectTaskDto[] = [], visited = new Set<string>();
  const visit = (parent: string | null) => {
    for (const task of children.get(parent) ?? []) {
      if (visited.has(task.taskId)) throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Invalid canonical hierarchy.");
      visited.add(task.taskId); ordered.push(task); visit(task.externalId);
    }
  };
  visit(null);
  if (ordered.length !== tasks.length) throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Invalid canonical hierarchy.");
  const predecessors = new Map<string, ImportPayload11["tasks"][number]["predecessors"]>();
  for (const link of snapshot.data.links) {
    if (!byExternal.has(link.predecessorExternalId) || !byExternal.has(link.successorExternalId)) throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Invalid canonical dependency.");
    const rows = predecessors.get(link.successorExternalId) ?? [];
    if (rows.length >= 100) throw new PublicApiError(422, "EXPORT_LIMIT_EXCEEDED", "The per-Task dependency count exceeds the JSON import limit of 100.");
    rows.push({ externalId: link.predecessorExternalId, type: link.type, lag: link.lag }); predecessors.set(link.successorExternalId, rows);
  }
  const exportedTasks: ImportPayload11["tasks"] = ordered.map((task) => {
    const common = { externalId: task.externalId, name: task.name, type: task.type, parentExternalId: task.parentExternalId,
      description: task.description ?? null, url: task.url ?? null, sourceTaskId: task.taskId };
    if (task.type === "summary") {
      if ((predecessors.get(task.externalId)?.length ?? 0) || snapshot.data.links.some((link) => link.predecessorExternalId === task.externalId)) throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Summary dependencies cannot be represented safely.");
      return { ...common, type: "summary", scheduleMode: "auto", requestedStart: null, predecessors: [] };
    }
    const status = task.status ?? taskStatusFromProgress(task.progress);
    if (task.requestedStart === null || task.duration === null || task.progress === null || !taskStatusProgressConsistent(status, task.progress)) throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Missing canonical leaf schedule or inconsistent status.");
    if ((task.baselineStart == null) !== (task.baselineDuration == null)) throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Incomplete canonical baseline.");
    return { ...common, type: task.type, scheduleMode: task.scheduleMode, requestedStart: task.requestedStart,
      duration: task.duration, progress: task.progress, status,
      baseline: task.baselineStart == null ? null : { start: task.baselineStart, duration: task.baselineDuration! },
      predecessors: predecessors.get(task.externalId) ?? [] };
  });
  const memberships: NonNullable<ImportPayload11["memberships"]> = [];
  for (const task of ordered) {
    const explicit = task.membership?.explicitMilestoneTaskId;
    if (explicit != null) {
      const milestone = byId.get(explicit);
      if (task.type === "milestone" || milestone?.type !== "milestone") throw new PublicApiError(422, "EXPORT_UNSUPPORTED", "Invalid canonical milestone membership.");
      memberships.push({ taskExternalId: task.externalId, milestoneExternalId: milestone.externalId });
    }
  }
  return { schemaVersion: "1.1", project: { name: snapshot.data.project.name, description: snapshot.data.project.description }, tasks: exportedTasks, memberships,
    source: { projectPublicId: snapshot.data.project.publicId, projectRevision: snapshot.data.project.revision, exportedAt,
      calendar: snapshot.data.project.calendar, contentScope: "schedule-stage" } };
}

export class ProjectJsonExportService {
  constructor(private readonly database: Database.Database, private readonly options: { clock?: () => Date } = {}) {}
  get(publicId: string, expectedRevision: number): Uint8Array | undefined {
    return this.database.transaction(() => {
      const now = (this.options.clock ?? (() => new Date()))();
      const snapshot = new TaskFieldProjectService(this.database, { clock: () => now }).getReadonlySnapshot(publicId);
      if (!snapshot) return undefined;
      if (snapshot.data.project.revision !== expectedRevision) throw new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
      const bytes = new TextEncoder().encode(JSON.stringify(buildProjectJsonExport(snapshot, now.toISOString()), null, 2));
      if (bytes.length > IMPORT_FILE_LIMIT_BYTES) throw new PublicApiError(422, "EXPORT_LIMIT_EXCEEDED", "The JSON file exceeds the 5 MiB import limit.");
      return bytes;
    }).deferred();
  }
}
