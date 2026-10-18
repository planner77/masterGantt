import { randomUUID, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";
import { validateProjectImportPayload, type ProjectImportValidationResult } from "../../contracts/import";
import type { ImportDiagnosticDto, ImportPreviewScheduleDto, ProjectImportPreviewDto } from "../../contracts/project-import";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../contracts/projects";
import { createWorkingCalendar, endFromStart, type WorkingCalendar } from "../../domain/scheduling";
import { taskStatusFromProgress } from "../../domain/task-status";
import { assertMilestoneCompletionTransitions, assertStageStructureChange, projectStageGates, type StageSnapshot } from "../../domain/milestones/stage-gates";
import { projectCalendarDto, resolveProjectWorkingCalendar } from "../calendars/calendar-resolution-core";
import { PublicApiError } from "../http/api-error-core";
import { MilestoneMembershipRepository } from "../repositories/milestone-membership-repository-core";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";
import type { AuthorizationResult } from "../projects/project-service-core";
import { TaskFieldProjectService } from "../projects/task-field-project-service";
import { parseCreateTaskInput } from "../projects/task-contract";
import { readStageSnapshot, assertStageMutation } from "../projects/milestone-stage-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { parseProjectImportBytes, projectImportPreviewDigest } from "./project-import-parser-core";

type Validated = Extract<ProjectImportValidationResult, { success: true }>;
interface ProjectAccess {
  authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
  getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined;
}

function scheduleDto(task: ProjectTaskDto): ImportPreviewScheduleDto {
  return { requestedStart: task.requestedStart, start: task.start, end: task.end, duration: task.duration, progress: task.progress,
    status: task.type === "summary" ? null : task.status ?? taskStatusFromProgress(task.progress),
    baselineStart: task.baselineStart ?? null, baselineDuration: task.baselineDuration ?? null, baselineEnd: task.baselineEnd ?? null };
}

function candidateStage(before: StageSnapshot, validated: Validated): StageSnapshot {
  const ids = new Map(validated.tasks.map((task, index) => [task.externalId, `import-task-${index}`]));
  return {
    tasks: [...before.tasks, ...validated.tasks.map((task) => ({ taskId: ids.get(task.externalId)!, type: task.type,
      parentTaskId: task.parentExternalId === null ? null : ids.get(task.parentExternalId)!,
      duration: task.duration, progress: task.progress, status: task.status ?? taskStatusFromProgress(task.progress) }))],
    memberships: [...before.memberships, ...validated.memberships.filter((row) => row.milestoneExternalId !== null).map((row) => ({ taskId: ids.get(row.taskExternalId)!, milestoneTaskId: ids.get(row.milestoneExternalId!)! }))],
    links: [...before.links, ...validated.links.map((link) => ({ id: link.id, predecessorTaskId: ids.get(link.predecessorExternalId)!, successorTaskId: ids.get(link.successorExternalId)!, type: link.type, lag: link.lag }))],
  };
}

export class ProjectImportService {
  private readonly access: ProjectAccess;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;

  constructor(private readonly database: Database.Database, options: {
    projectService?: ProjectAccess; clock?: () => Date; generatePublicId?: () => string;
  } = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.generatePublicId = options.generatePublicId ?? randomUUID;
    this.access = options.projectService ?? new TaskFieldProjectService(database, { clock: this.clock });
  }

  authorize(publicId: string, rawToken: string | undefined) { return this.access.authorize(publicId, rawToken); }

  private requireAuthorization(publicId: string, rawToken: string | undefined) {
    const result = this.access.authorize(publicId, rawToken);
    if (result.kind === "projectNotFound") throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    if (result.kind !== "authorized") throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
    return result.authorization;
  }

  private prepare(projectId: number, input: unknown) {
    if (input && typeof input === "object" && Array.isArray((input as { tasks?: unknown }).tasks) && ((input as { tasks: unknown[] }).tasks.length > 5000)) {
      throw new PublicApiError(413, "IMPORT_TOO_LARGE", "Import Task budget exceeded.");
    }
    const calendar = resolveProjectWorkingCalendar(this.database, projectId);
    const validated = validateProjectImportPayload(input, calendar);
    if (!validated.success) {
      const tooLarge = validated.details.some((detail) => ["IMPORT_TOO_LARGE", "HIERARCHY_DEPTH_EXCEEDED", "TASK_LIMIT_EXCEEDED"].includes(detail.code));
      throw new PublicApiError(tooLarge ? 413 : 422, tooLarge ? "IMPORT_TOO_LARGE" : "IMPORT_VALIDATION_FAILED", "The import file failed validation.", validated.details);
    }
    const schedules = new ScheduleRepository(this.database);
    const existing = schedules.listTasks(projectId), existingLinks = schedules.listLinks(projectId);
    if (existing.length + validated.tasks.length > 5000 || existingLinks.length + validated.links.length > 20000) {
      throw new PublicApiError(413, "IMPORT_TOO_LARGE", "The target Project would exceed the import limits.");
    }
    const existingIds = new Set(existing.map((task) => task.externalId));
    if (validated.tasks.some((task) => existingIds.has(task.externalId))) throw new PublicApiError(409, "DUPLICATE_EXTERNAL_ID", "An external ID already exists in the target Project.");
    const byExternalId = new Map(validated.tasks.map((task) => [task.externalId, task]));
    for (const link of validated.links) {
      if (byExternalId.get(link.predecessorExternalId)?.type !== byExternalId.get(link.successorExternalId)?.type) {
        throw new PublicApiError(422, "MIXED_DEPENDENCY_UNSUPPORTED", "New mixed Task/Milestone links are not supported. No rows were imported.");
      }
    }
    // The public Task validator remains the authority for names, description and safe URL values.
    const tasks = validated.tasks.map((task): ProjectTaskDto => {
      const parsed = parseCreateTaskInput(task.type === "summary"
        ? { name: task.name, type: "summary", description: task.description, url: task.url }
        : { name: task.name, type: task.type, scheduleMode: task.scheduleMode, start: task.requestedStart ?? task.start,
            duration: task.duration, progress: task.progress, status: task.status, description: task.description, url: task.url });
      if (!parsed.success) throw new PublicApiError(422, "IMPORT_VALIDATION_FAILED", "Invalid Task metadata.", parsed.details);
      return { ...task, name: parsed.data.name, description: parsed.data.description ?? null, url: parsed.data.url ?? null,
        status: task.status ?? taskStatusFromProgress(task.progress) };
    });
    const prepared: Validated = { ...validated, tasks };
    const before = readStageSnapshot(this.database, projectId), candidate = candidateStage(before, prepared);
    assertStageStructureChange(before, candidate);
    assertMilestoneCompletionTransitions(before, candidate);
    return { prepared, calendar, before };
  }

  private previewDto(publicId: string, revision: number, bytes: Uint8Array, prepared: Validated, calendar: WorkingCalendar, projectId: number): ProjectImportPreviewDto {
    const sourceTasks = new Map(prepared.data.tasks.map((task) => [task.externalId, task]));
    const projection = projectStageGates(candidateStage({ tasks: [], memberships: [], links: [] }, prepared));
    const tempToExternal = new Map(prepared.tasks.map((task, index) => [`import-task-${index}`, task.externalId]));
    const warnings: ImportDiagnosticDto[] = [];
    const targetCalendar = projectCalendarDto(this.database, projectId);
    const sourceCalendar = prepared.data.schemaVersion === "1.1" && prepared.data.source
      ? createWorkingCalendar({ ...prepared.data.source.calendar, holidays: prepared.data.source.calendar.exceptions === undefined ? prepared.data.source.calendar.holidays : [] }) : null;
    const sourceEffectiveTasks = new Map<string, ProjectTaskDto>();
    if (sourceCalendar && prepared.data.schemaVersion === "1.1") {
      const sourceProjection = validateProjectImportPayload(prepared.data, sourceCalendar);
      if (sourceProjection.success) {
        for (const sourceTask of sourceProjection.tasks) sourceEffectiveTasks.set(sourceTask.externalId, sourceTask);
      } else {
        warnings.push({ code: "SOURCE_SCHEDULE_UNAVAILABLE", path: "source.calendar", message: "The advisory source calendar cannot reconstruct the source effective schedule. Authored fields are used for comparison instead." });
      }
    }
    if (sourceCalendar && JSON.stringify(sourceCalendar.exceptions) !== JSON.stringify(calendar.exceptions)) warnings.push({ code: "SOURCE_CALENDAR_IGNORED", path: "source.calendar", message: "The target Project calendar controls imported schedule and baseline end dates." });
    if (!prepared.tasks.length) warnings.push({ code: "EMPTY_IMPORT", path: "tasks", message: "The file contains no Tasks. Commit is disabled." });
    const normalizedTasks = prepared.tasks.map((task, index) => {
      const source = sourceTasks.get(task.externalId)!;
      const membership = projection.membership.get(`import-task-${index}`)!;
      return { ...scheduleDto(task), externalId: task.externalId, sourceTaskId: "sourceTaskId" in source ? source.sourceTaskId ?? null : null,
        name: task.name, type: task.type, parentExternalId: task.parentExternalId, description: task.description ?? null, url: task.url ?? null, scheduleMode: task.scheduleMode,
        membership: { explicitMilestoneExternalId: membership.explicitMilestoneTaskId === null ? null : tempToExternal.get(membership.explicitMilestoneTaskId)!,
          effectiveMilestoneExternalId: membership.effectiveMilestoneTaskId === null ? null : tempToExternal.get(membership.effectiveMilestoneTaskId)!,
          inheritedFromExternalId: membership.inheritedFromTaskId === null ? null : tempToExternal.get(membership.inheritedFromTaskId)! } };
    });
    const changedTasks = prepared.tasks.flatMap((task) => {
      const source = sourceTasks.get(task.externalId)!;
      const requested = "requestedStart" in source ? source.requestedStart ?? null : "start" in source ? source.start ?? null : null;
      let before: ImportPreviewScheduleDto = { requestedStart: requested, start: "start" in source ? source.start ?? null : requested,
        end: "end" in source ? source.end ?? null : null, duration: "duration" in source ? source.duration ?? null : null,
        progress: "progress" in source ? source.progress ?? null : null, status: "status" in source ? source.status : null,
        baselineStart: "baseline" in source ? source.baseline?.start ?? null : null,
        baselineDuration: "baseline" in source ? source.baseline?.duration ?? null : null, baselineEnd: null };
      const sourceEffective = sourceEffectiveTasks.get(task.externalId);
      if (sourceEffective) before = scheduleDto(sourceEffective);
      if (before.baselineStart !== null && before.baselineDuration !== null && sourceCalendar) {
        try { before.baselineEnd = task.type === "milestone" ? before.baselineStart : endFromStart(before.baselineStart, before.baselineDuration, sourceCalendar); }
        catch { warnings.push({ code: "SOURCE_BASELINE_UNAVAILABLE", path: `tasks.${task.externalId}.baseline`, externalId: task.externalId, message: "The advisory source calendar cannot resolve this baseline end. The target calendar remains authoritative." }); }
      }
      const after = scheduleDto(task), reasonCodes: string[] = [];
      if (task.type === "summary") reasonCodes.push("SUMMARY_DERIVED");
      else {
        if (requested !== task.start) reasonCodes.push("SCHEDULE_RECALCULATED");
        if (before.baselineEnd !== null && before.baselineEnd !== after.baselineEnd) reasonCodes.push("BASELINE_TARGET_CALENDAR_RECALCULATED");
      }
      if (requested !== task.start && task.type !== "summary") warnings.push({ code: "SCHEDULE_RECALCULATED", path: `tasks.${task.externalId}`, externalId: task.externalId, message: "The calendar or dependencies change the effective schedule." });
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ externalId: task.externalId, before, after, reasonCodes }];
    });
    return { schemaVersion: prepared.data.schemaVersion, projectPublicId: publicId, baseRevision: revision,
      previewDigest: projectImportPreviewDigest(bytes, publicId, revision), canCommit: prepared.tasks.length > 0, sourceProject: prepared.data.project,
      summary: { taskCreates: prepared.tasks.length, linkCreates: prepared.links.length, explicitMembershipCreates: prepared.memberships.filter((row) => row.milestoneExternalId !== null).length },
      normalizedTasks, changedTasks, warnings, targetCalendar };
  }

  preview(publicId: string, rawToken: string | undefined, bytes: Uint8Array): ProjectImportPreviewDto {
    this.requireAuthorization(publicId, rawToken);
    const input = parseProjectImportBytes(bytes);
    return this.database.transaction(() => {
      const authorization = this.requireAuthorization(publicId, rawToken);
      const { prepared, calendar } = this.prepare(authorization.projectId, input);
      return this.previewDto(publicId, authorization.projectRevision, bytes, prepared, calendar, authorization.projectId);
    }).deferred();
  }

  commit(publicId: string, rawToken: string | undefined, expectedRevision: number, digest: string, bytes: Uint8Array): ProjectSnapshotResponse {
    this.requireAuthorization(publicId, rawToken);
    const input = parseProjectImportBytes(bytes);
    return this.database.transaction(() => {
      const authorization = this.requireAuthorization(publicId, rawToken);
      if (authorization.projectRevision !== expectedRevision) throw new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Preview the import again.");
      const expectedDigest = projectImportPreviewDigest(bytes, publicId, expectedRevision);
      if (!/^[a-f0-9]{64}$/.test(digest) || !timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(expectedDigest, "hex"))) {
        throw new PublicApiError(409, "IMPORT_PREVIEW_MISMATCH", "The file, target Project or preview revision has changed.");
      }
      const { prepared, before } = this.prepare(authorization.projectId, input);
      if (!prepared.tasks.length) throw new PublicApiError(422, "EMPTY_IMPORT", "There are no Tasks to import. No data was saved.");
      const now = this.clock().toISOString(), schedules = new ScheduleRepository(this.database);
      const membershipRepository = new MilestoneMembershipRepository(this.database);
      const records = new Map<string, ReturnType<ScheduleRepository["insertTask"]>>();
      const children = new Map<string | null, ProjectTaskDto[]>();
      for (const task of prepared.tasks) { const list = children.get(task.parentExternalId) ?? []; list.push(task); children.set(task.parentExternalId, list); }
      const pending = [...(children.get(null) ?? [])];
      const rootOffset = schedules.nextRootSortOrder(authorization.projectId);
      for (let cursor = 0; cursor < pending.length; cursor++) {
        const task = pending[cursor];
        let taskPublicId: string | undefined;
        for (let attempt = 0; attempt < 3; attempt++) { const candidate = this.generatePublicId(); if (isCanonicalUuidV4(candidate) && !schedules.taskPublicIdExists(candidate)) { taskPublicId = candidate; break; } }
        if (!taskPublicId) throw new Error("Import Task identity allocation failed.");
        records.set(task.externalId, schedules.insertTask({ projectId: authorization.projectId, publicId: taskPublicId, externalId: task.externalId,
          name: task.name, description: task.description, url: task.url, type: task.type, scheduleMode: task.scheduleMode,
          requestedStart: task.requestedStart, startDate: task.start, endDate: task.end, duration: task.duration, progress: task.progress, status: task.status,
          baselineStart: task.baselineStart, baselineDuration: task.baselineDuration, baselineEnd: task.baselineEnd,
          parentId: task.parentExternalId === null ? null : records.get(task.parentExternalId)!.id,
          sortOrder: task.siblingOrder + (task.parentExternalId === null ? rootOffset : 0), createdAt: now, updatedAt: now }));
        pending.push(...(children.get(task.externalId) ?? []));
      }
      if (records.size !== prepared.tasks.length) throw new Error("Import hierarchy persistence was incomplete.");
      for (const link of prepared.links) schedules.insertLink({ projectId: authorization.projectId, publicId: this.generatePublicId(), predecessorTaskId: records.get(link.predecessorExternalId)!.id,
        successorTaskId: records.get(link.successorExternalId)!.id, type: link.type, lag: link.lag, createdAt: now, updatedAt: now });
      for (const row of prepared.memberships) if (row.milestoneExternalId !== null) membershipRepository.set(authorization.projectId, records.get(row.taskExternalId)!.id, records.get(row.milestoneExternalId)!.id);
      assertStageMutation(this.database, authorization.projectId, before);
      if (!new ProjectRepository(this.database).advanceRevision(authorization.projectId, expectedRevision, now)) throw new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Preview the import again.");
      const snapshot = this.access.getReadonlySnapshot(publicId);
      if (!snapshot || snapshot.data.project.revision !== expectedRevision + 1) throw new Error("Imported canonical snapshot could not be read.");
      return { data: { ...snapshot.data, permission: "edit" as const } };
    }).immediate();
  }
}
