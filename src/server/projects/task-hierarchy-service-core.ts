import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { projectCalendarDto, resolveProjectWorkingCalendar } from "../calendars/calendar-resolution-core";
import type {
  ProjectTaskDto,
  ScheduleWarningDto,
  TaskHierarchyCommandRequest,
  TaskHierarchyPlacement,
  TaskMutationResponse,
} from "../../contracts/projects";
import { recalculateHierarchy, scheduleLeaf } from "../../domain/scheduling";
import { EditSessionRepository, ProjectRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
import {
  EditSessionInvalidError,
  EmptySummaryNotAllowedError,
  InvalidParentTaskError,
  InvalidTaskInputError,
  PersistedScheduleInvalidError,
  recalculatePersistedHierarchy,
  RevisionMismatchError,
  TaskLimitExceededError,
  TaskNotFoundError,
  UnsupportedScheduleStructureError,
  type AuthorizedEditSession,
} from "./project-service-core";

const MAX_PROJECT_TASKS = 5_000;
const ID_ATTEMPTS = 8;

export class TaskHierarchyNoopError extends Error {
  constructor() {
    super("The requested hierarchy command cannot change this task.");
    this.name = "TaskHierarchyNoopError";
  }
}

export class TaskCopyAssignmentUnsupportedError extends Error {
  constructor() {
    super("Task assignments cannot yet be copied by this command.");
    this.name = "TaskCopyAssignmentUnsupportedError";
  }
}

export interface TaskHierarchyServiceOptions {
  clock?: () => Date;
  generateTaskPublicId?: () => string;
  generateTaskExternalId?: () => string;
}

function taskDtos(tasks: readonly TaskRecord[]): ProjectTaskDto[] {
  const externalById = new Map(tasks.map((task) => [task.id, task.externalId]));
  return tasks.map((task) => {
    const parentExternalId = task.parentId === null ? null : externalById.get(task.parentId);
    if (task.parentId !== null && parentExternalId === undefined) throw new PersistedScheduleInvalidError();
    return {
      taskId: task.publicId,
      externalId: task.externalId,
      name: task.name,
      description: task.description,
      url: task.url,
      type: task.type,
      scheduleMode: task.scheduleMode,
      requestedStart: task.requestedStart,
      start: task.startDate,
      end: task.endDate,
      duration: task.duration,
      progress: task.progress,
      parentExternalId: parentExternalId ?? null,
      siblingOrder: task.sortOrder,
    };
  });
}

function warningDtos(warnings: ReturnType<typeof scheduleLeaf>["warnings"]): ScheduleWarningDto[] {
  return warnings.map((warning) => ({
    code: warning.code,
    path: "start",
    requestedStart: warning.requestedStart,
    start: warning.start,
  }));
}

function orderedSiblings(tasks: readonly TaskRecord[], parentId: number | null): TaskRecord[] {
  return tasks
    .filter((task) => task.parentId === parentId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
}

function descendants(rootId: number, tasks: readonly TaskRecord[]): TaskRecord[] {
  const children = new Map<number, TaskRecord[]>();
  for (const task of tasks) {
    if (task.parentId === null) continue;
    const bucket = children.get(task.parentId) ?? [];
    bucket.push(task);
    children.set(task.parentId, bucket);
  }
  for (const bucket of children.values()) {
    bucket.sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
  }
  const result: TaskRecord[] = [];
  const visit = (id: number) => {
    for (const child of children.get(id) ?? []) {
      result.push(child);
      visit(child.id);
    }
  };
  visit(rootId);
  return result;
}

function wouldCreateCycle(task: TaskRecord, parentId: number | null, tasks: readonly TaskRecord[]): boolean {
  if (parentId === null) return false;
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  let current = byId.get(parentId);
  while (current) {
    if (current.id === task.id) return true;
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return false;
}

function insertionTarget(
  anchor: TaskRecord,
  placement: TaskHierarchyPlacement,
  tasks: readonly TaskRecord[],
): { parentId: number | null; index: number } {
  if (placement === "child") {
    const children = orderedSiblings(tasks, anchor.id);
    return { parentId: anchor.id, index: children.length };
  }
  const siblings = orderedSiblings(tasks, anchor.parentId);
  const index = siblings.findIndex((task) => task.id === anchor.id);
  if (index < 0) throw new PersistedScheduleInvalidError();
  return { parentId: anchor.parentId, index: index + (placement === "after" ? 1 : 0) };
}

export class TaskHierarchyService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly schedules: ScheduleRepository;
  private readonly resources: ResourceCatalogRepository;
  private readonly clock: () => Date;
  private readonly generateTaskPublicId: () => string;
  private readonly generateTaskExternalId: () => string;

  constructor(private readonly database: Database.Database, options: TaskHierarchyServiceOptions = {}) {
    this.projects = new ProjectRepository(database);
    this.sessions = new EditSessionRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.resources = new ResourceCatalogRepository(database);
    this.clock = options.clock ?? (() => new Date());
    this.generateTaskPublicId = options.generateTaskPublicId ?? randomUUID;
    this.generateTaskExternalId = options.generateTaskExternalId ?? randomUUID;
  }

  private requireCurrentProject(authorization: AuthorizedEditSession, now: Date) {
    const session = this.sessions.findById(authorization.sessionId);
    const project = this.projects.findCredentialById(authorization.projectId);
    const expiresAt = session ? Date.parse(session.expiresAt) : Number.NaN;
    if (
      !session || !project || session.revokedAt !== null ||
      !session.tokenHash.equals(authorization.tokenHash) ||
      session.projectId !== project.id ||
      session.authVersion !== project.authVersion ||
      project.publicId !== authorization.projectPublicId ||
      project.authVersion !== authorization.projectAuthVersion ||
      !Number.isFinite(expiresAt) || expiresAt <= now.getTime()
    ) {
      throw new EditSessionInvalidError();
    }
    return project;
  }

  private rewriteFamily(
    projectId: number,
    parentId: number | null,
    order: readonly TaskRecord[],
    now: string,
  ): void {
    order.forEach((task, index) => {
      if (!this.schedules.updateTaskPlacement(projectId, task.publicId, parentId, index, now)) {
        throw new TaskNotFoundError();
      }
    });
  }

  private assertParentCanContain(
    projectId: number,
    parent: TaskRecord,
    tasks: readonly TaskRecord[],
    now: string,
    changed: Set<string>,
  ): void {
    if (parent.type === "milestone") throw new InvalidParentTaskError();
    if (parent.type === "task") {
      if (orderedSiblings(tasks, parent.id).length > 0) throw new PersistedScheduleInvalidError();
      if (!this.schedules.convertTaskToSummary(projectId, parent.publicId, now)) {
        throw new TaskNotFoundError();
      }
      changed.add(parent.externalId);
    }
  }

  private applySummaryDerivations(
    projectId: number,
    calendar: ReturnType<typeof resolveProjectWorkingCalendar>,
    now: string,
    changed: Set<string>,
  ): void {
    const records = this.schedules.listTasks(projectId);
    let derived: readonly ProjectTaskDto[];
    try {
      derived = recalculateHierarchy(taskDtos(records), calendar);
    } catch {
      throw new PersistedScheduleInvalidError();
    }
    const persisted = new Map(records.map((task) => [task.publicId, task]));
    for (const task of derived) {
      if (task.type !== "summary") continue;
      const current = persisted.get(task.taskId);
      if (!current) throw new PersistedScheduleInvalidError();
      if (
        current.startDate === task.start &&
        current.endDate === task.end &&
        current.duration === task.duration &&
        current.progress === task.progress &&
        current.scheduleMode === "auto" &&
        current.requestedStart === null
      ) continue;
      if (!this.schedules.updateSummarySchedule(projectId, task.taskId, {
        startDate: task.start,
        endDate: task.end,
        duration: task.duration,
        progress: task.progress,
        updatedAt: now,
      })) throw new PersistedScheduleInvalidError();
      changed.add(task.externalId);
    }
  }

  private ensureOldParentRemainsValid(task: TaskRecord, tasks: readonly TaskRecord[]): void {
    if (task.parentId === null) return;
    if (orderedSiblings(tasks, task.parentId).length === 1) {
      throw new EmptySummaryNotAllowedError();
    }
  }

  private makeIds(projectId: number): { publicId: string; externalId: string } {
    for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
      const publicId = this.generateTaskPublicId();
      const externalId = this.generateTaskExternalId();
      if (
        publicId !== externalId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(publicId) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(externalId) &&
        !this.schedules.taskPublicIdExists(publicId) &&
        !this.schedules.findTaskByExternalId(projectId, externalId)
      ) return { publicId, externalId };
    }
    throw new Error("Unique task identifiers could not be generated.");
  }

  execute(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    command: TaskHierarchyCommandRequest,
  ): TaskMutationResponse {
    const mutate = this.database.transaction(() => {
      const now = this.clock();
      const nowText = now.toISOString();
      const project = this.requireCurrentProject(authorization, now);
      if (project.revision !== expectedRevision) throw new RevisionMismatchError();

      const initialTasks = this.schedules.listTasks(project.id);
      const links = this.schedules.listLinks(project.id);
      if (links.length > 0) throw new UnsupportedScheduleStructureError();
      const calendar = resolveProjectWorkingCalendar(this.database, project.id);
      recalculatePersistedHierarchy(initialTasks, calendar);

      const byPublicId = new Map(initialTasks.map((task) => [task.publicId, task]));
      const changed = new Set<string>();
      const warnings: ScheduleWarningDto[] = [];

      if (command.kind === "create") {
        if (initialTasks.length >= MAX_PROJECT_TASKS) throw new TaskLimitExceededError();
        const anchor = byPublicId.get(command.anchorTaskId);
        if (!anchor) throw new TaskNotFoundError();
        const target = insertionTarget(anchor, command.placement, initialTasks);
        if (command.placement === "child") this.assertParentCanContain(project.id, anchor, initialTasks, nowText, changed);
        const scheduled = scheduleLeaf({
          type: command.task.type,
          requestedStart: command.task.start,
          duration: command.task.duration,
          scheduleMode: command.task.scheduleMode,
          end: command.task.end,
        }, calendar);
        warnings.push(...warningDtos(scheduled.warnings));
        const ids = this.makeIds(project.id);
        const inserted = this.schedules.insertTask({
          projectId: project.id,
          externalId: ids.externalId,
          publicId: ids.publicId,
          name: command.task.name.trim(),
          description: command.task.description ?? null,
          url: command.task.url ?? null,
          type: scheduled.type,
          scheduleMode: scheduled.scheduleMode,
          requestedStart: scheduled.requestedStart,
          startDate: scheduled.start,
          endDate: scheduled.end,
          duration: scheduled.duration,
          progress: command.task.progress,
          parentId: target.parentId,
          sortOrder: this.schedules.nextSiblingSortOrder(project.id, target.parentId),
          createdAt: nowText,
          updatedAt: nowText,
        });
        const latest = this.schedules.listTasks(project.id);
        const family = orderedSiblings(latest, target.parentId).filter((task) => task.id !== inserted.id);
        family.splice(Math.min(target.index, family.length), 0, inserted);
        this.rewriteFamily(project.id, target.parentId, family, nowText);
        changed.add(inserted.externalId);
      } else if (command.kind === "convert") {
        const task = byPublicId.get(command.taskId);
        if (!task) throw new TaskNotFoundError();
        if (task.type === command.targetType) throw new TaskHierarchyNoopError();
        if (command.targetType === "summary" || task.type === "summary") {
          throw new TaskHierarchyNoopError();
        }
        if (orderedSiblings(initialTasks, task.id).length > 0 || task.requestedStart === null) {
          throw new InvalidTaskInputError();
        }
        const scheduled = scheduleLeaf({
          type: command.targetType,
          requestedStart: task.requestedStart,
          duration: command.targetType === "milestone" ? 0 : Math.max(1, task.duration),
          scheduleMode: task.scheduleMode,
        }, calendar);
        warnings.push(...warningDtos(scheduled.warnings));
        const updated = this.schedules.updateTask(project.id, task.publicId, {
          name: task.name,
          type: scheduled.type,
          scheduleMode: scheduled.scheduleMode,
          requestedStart: scheduled.requestedStart,
          startDate: scheduled.start,
          endDate: scheduled.end,
          duration: scheduled.duration,
          progress: task.progress,
          updatedAt: nowText,
        });
        if (!updated) throw new TaskNotFoundError();
        changed.add(task.externalId);
      } else if (command.kind === "move") {
        const task = byPublicId.get(command.taskId);
        if (!task) throw new TaskNotFoundError();
        const siblings = orderedSiblings(initialTasks, task.parentId);
        const index = siblings.findIndex((candidate) => candidate.id === task.id);
        const targetIndex = index + (command.direction === "up" ? -1 : 1);
        if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) throw new TaskHierarchyNoopError();
        [siblings[index], siblings[targetIndex]] = [siblings[targetIndex], siblings[index]];
        this.rewriteFamily(project.id, task.parentId, siblings, nowText);
        changed.add(task.externalId);
      } else if (command.kind === "indent") {
        const task = byPublicId.get(command.taskId);
        if (!task) throw new TaskNotFoundError();
        const siblings = orderedSiblings(initialTasks, task.parentId);
        const index = siblings.findIndex((candidate) => candidate.id === task.id);
        if (index <= 0) throw new TaskHierarchyNoopError();
        const parent = siblings[index - 1];
        this.ensureOldParentRemainsValid(task, initialTasks);
        this.assertParentCanContain(project.id, parent, initialTasks, nowText, changed);
        const oldFamily = siblings.filter((candidate) => candidate.id !== task.id);
        this.rewriteFamily(project.id, task.parentId, oldFamily, nowText);
        const children = orderedSiblings(this.schedules.listTasks(project.id), parent.id);
        children.push(task);
        this.rewriteFamily(project.id, parent.id, children, nowText);
        changed.add(task.externalId);
      } else if (command.kind === "outdent") {
        const task = byPublicId.get(command.taskId);
        if (!task) throw new TaskNotFoundError();
        if (task.parentId === null) throw new TaskHierarchyNoopError();
        const parent = initialTasks.find((candidate) => candidate.id === task.parentId);
        if (!parent) throw new PersistedScheduleInvalidError();
        this.ensureOldParentRemainsValid(task, initialTasks);
        const oldFamily = orderedSiblings(initialTasks, task.parentId).filter((candidate) => candidate.id !== task.id);
        this.rewriteFamily(project.id, task.parentId, oldFamily, nowText);
        const upper = orderedSiblings(this.schedules.listTasks(project.id), parent.parentId);
        const parentIndex = upper.findIndex((candidate) => candidate.id === parent.id);
        upper.splice(parentIndex + 1, 0, task);
        this.rewriteFamily(project.id, parent.parentId, upper, nowText);
        changed.add(task.externalId);
      } else if (command.kind === "reparent") {
        const task = byPublicId.get(command.taskId);
        const anchor = byPublicId.get(command.anchorTaskId);
        if (!task || !anchor) throw new TaskNotFoundError();
        if (task.id === anchor.id) throw new TaskHierarchyNoopError();
        const target = insertionTarget(anchor, command.placement, initialTasks);
        if (wouldCreateCycle(task, target.parentId, initialTasks)) throw new InvalidTaskInputError();
        if (task.parentId === target.parentId) {
          const family = orderedSiblings(initialTasks, task.parentId).filter((candidate) => candidate.id !== task.id);
          const anchorIndex = family.findIndex((candidate) => candidate.id === anchor.id);
          const index = command.placement === "child"
            ? family.length
            : Math.max(0, anchorIndex + (command.placement === "after" ? 1 : 0));
          family.splice(Math.min(index, family.length), 0, task);
          this.rewriteFamily(project.id, task.parentId, family, nowText);
        } else {
          this.ensureOldParentRemainsValid(task, initialTasks);
          if (command.placement === "child") this.assertParentCanContain(project.id, anchor, initialTasks, nowText, changed);
          const oldFamily = orderedSiblings(initialTasks, task.parentId).filter((candidate) => candidate.id !== task.id);
          this.rewriteFamily(project.id, task.parentId, oldFamily, nowText);
          const refreshed = this.schedules.listTasks(project.id);
          const refreshedAnchor = refreshed.find((candidate) => candidate.publicId === anchor.publicId);
          if (!refreshedAnchor) throw new TaskNotFoundError();
          const refreshedTarget = insertionTarget(refreshedAnchor, command.placement, refreshed);
          const newFamily = orderedSiblings(refreshed, refreshedTarget.parentId).filter((candidate) => candidate.id !== task.id);
          newFamily.splice(Math.min(refreshedTarget.index, newFamily.length), 0, task);
          this.rewriteFamily(project.id, refreshedTarget.parentId, newFamily, nowText);
        }
        changed.add(task.externalId);
      } else if (command.kind === "copy") {
        const source = byPublicId.get(command.taskId);
        const anchor = byPublicId.get(command.anchorTaskId);
        if (!source || !anchor) throw new TaskNotFoundError();
        const branch = [source, ...descendants(source.id, initialTasks)];
        if (initialTasks.length + branch.length > MAX_PROJECT_TASKS) throw new TaskLimitExceededError();
        const branchIds = new Set(branch.map((task) => task.publicId));
        if (this.resources.listAssignments(project.id).some((assignment) => branchIds.has(assignment.taskPublicId))) {
          throw new TaskCopyAssignmentUnsupportedError();
        }
        if (command.placement === "child") this.assertParentCanContain(project.id, anchor, initialTasks, nowText, changed);
        const refreshed = this.schedules.listTasks(project.id);
        const refreshedAnchor = refreshed.find((candidate) => candidate.publicId === anchor.publicId);
        if (!refreshedAnchor) throw new TaskNotFoundError();
        const target = insertionTarget(refreshedAnchor, command.placement, refreshed);
        const newBySource = new Map<number, TaskRecord>();
        for (const original of branch) {
          const ids = this.makeIds(project.id);
          const parentId = original.id === source.id
            ? target.parentId
            : original.parentId === null ? null : newBySource.get(original.parentId)?.id;
          if (original.id !== source.id && parentId === undefined) throw new PersistedScheduleInvalidError();
          const inserted = this.schedules.insertTask({
            projectId: project.id,
            externalId: ids.externalId,
            publicId: ids.publicId,
            name: original.name,
            description: original.description,
            url: original.url,
            type: original.type,
            scheduleMode: original.scheduleMode,
            requestedStart: original.requestedStart,
            startDate: original.startDate,
            endDate: original.endDate,
            duration: original.duration,
            progress: original.progress,
            parentId: parentId ?? null,
            sortOrder: original.id === source.id
              ? this.schedules.nextSiblingSortOrder(project.id, target.parentId)
              : original.sortOrder,
            createdAt: nowText,
            updatedAt: nowText,
          });
          newBySource.set(original.id, inserted);
          changed.add(inserted.externalId);
        }
        const copiedRoot = newBySource.get(source.id);
        if (!copiedRoot) throw new PersistedScheduleInvalidError();
        const family = orderedSiblings(this.schedules.listTasks(project.id), target.parentId)
          .filter((candidate) => candidate.id !== copiedRoot.id);
        family.splice(Math.min(target.index, family.length), 0, copiedRoot);
        this.rewriteFamily(project.id, target.parentId, family, nowText);
      }

      this.applySummaryDerivations(project.id, calendar, nowText, changed);
      const updatedProject = this.projects.advanceRevision(project.id, expectedRevision, nowText);
      if (!updatedProject) throw new RevisionMismatchError();
      const tasks = this.schedules.listTasks(project.id);
      return {
        data: {
          project: {
            publicId: updatedProject.publicId,
            name: updatedProject.name,
            description: updatedProject.description,
            revision: updatedProject.revision,
            calendar: projectCalendarDto(this.database, project.id),
          },
          tasks: taskDtos(tasks),
          links: [],
          warnings,
          operation: {
            kind: "taskHierarchy" as const,
            command: command.kind,
            changedTaskExternalIds: [...changed],
            deletedTaskExternalIds: [],
            deletedLinkIds: [],
          },
        },
      } satisfies TaskMutationResponse;
    });
    return mutate.immediate();
  }
}
