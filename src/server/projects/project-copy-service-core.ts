import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import { projectCalendarDto, resolveProjectWorkingCalendar } from "../calendars/calendar-resolution-core";

import type {
  CopyProjectRequest,
  CopyProjectResponse,
  ProjectTaskDto,
} from "../../contracts/projects";
import { recalculateHierarchy } from "../../domain/scheduling";
import { ProjectOwnerRepository } from "../repositories/project-owner-repository-core";
import { WorkCalendarRepository } from "../repositories/work-calendar-repository-core";
import {
  EditSessionRepository,
  ProjectRepository,
} from "../repositories/project-repository-core";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
import {
  LogisticsRepository,
  type ProcessRecord,
  type EquipmentRecord,
  type LogisticsSystemRecord,
} from "../repositories/logistics-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { LogisticsService, LogisticsCopyNotSupportedYetError } from "../logistics/logistics-service-core";
import {
  hashEditPassword,
  type PasswordHashRecord,
} from "../security/password-core";
import {
  createSessionToken,
  sessionExpiry,
  type NewSessionToken,
} from "../security/session-core";
import { isCanonicalUuidV4 } from "./project-contract";
import {
  EditSessionInvalidError,
  PersistedScheduleInvalidError,
  RevisionMismatchError,
  recalculatePersistedHierarchy,
  type AuthorizedEditSession,
} from "./project-service-core";

export { LogisticsCopyNotSupportedYetError };

const ID_ATTEMPTS = 3;
const MAX_PROJECT_TASKS = 5_000;

export interface ProjectCopyServiceOptions {
  clock?: () => Date;
  generatePublicId?: () => string;
  generateTaskPublicId?: () => string;
  generateLinkPublicId?: () => string;
  hashPassword?: (password: string) => Promise<PasswordHashRecord>;
  generateSessionToken?: () => NewSessionToken;
}

export interface CopiedProject {
  response: CopyProjectResponse;
  rawSessionToken: string;
}

function dtoTasks(tasks: readonly TaskRecord[]): ProjectTaskDto[] {
  const externalById = new Map(tasks.map((task) => [task.id, task.externalId]));
  return tasks.map((task) => ({
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
    parentExternalId: task.parentId === null
      ? null
      : externalById.get(task.parentId) ?? null,
    siblingOrder: task.sortOrder,
  }));
}

function validSession(
  session: ReturnType<EditSessionRepository["findById"]>,
  project: ReturnType<ProjectRepository["findCredentialById"]>,
  authorization: AuthorizedEditSession,
  now: Date,
): boolean {
  if (!session || !project || session.revokedAt !== null) return false;
  const expiry = Date.parse(session.expiresAt);
  return session.projectId === project.id &&
    project.publicId === authorization.projectPublicId &&
    project.authVersion === authorization.projectAuthVersion &&
    session.authVersion === project.authVersion &&
    session.tokenHash.equals(authorization.tokenHash) &&
    Number.isFinite(expiry) &&
    expiry > now.getTime();
}

export class ProjectCopyService {
  private readonly projects: ProjectRepository;
  private readonly owners: ProjectOwnerRepository;
  private readonly sessions: EditSessionRepository;
  private readonly schedules: ScheduleRepository;
  private readonly calendars: WorkCalendarRepository;
  private readonly logistics: LogisticsRepository;
  private readonly resourceCatalog: ResourceCatalogRepository;
  private readonly logisticsService: LogisticsService;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;
  private readonly generateTaskPublicId: () => string;
  private readonly generateLinkPublicId: () => string;
  private readonly hashPassword: (password: string) => Promise<PasswordHashRecord>;
  private readonly generateSessionToken: () => NewSessionToken;

  constructor(
    private readonly database: Database.Database,
    options: ProjectCopyServiceOptions = {},
  ) {
    this.projects = new ProjectRepository(database);
    this.owners = new ProjectOwnerRepository(database);
    this.sessions = new EditSessionRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.calendars = new WorkCalendarRepository(database);
    this.logistics = new LogisticsRepository(database);
    this.resourceCatalog = new ResourceCatalogRepository(database);
    this.clock = options.clock ?? (() => new Date());
    this.logisticsService = new LogisticsService(database, { clock: this.clock });
    this.generatePublicId = options.generatePublicId ?? randomUUID;
    this.generateTaskPublicId = options.generateTaskPublicId ?? randomUUID;
    this.generateLinkPublicId = options.generateLinkPublicId ?? randomUUID;
    this.hashPassword = options.hashPassword ?? hashEditPassword;
    this.generateSessionToken = options.generateSessionToken ?? createSessionToken;
  }

  async copy(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CopyProjectRequest,
  ): Promise<CopiedProject> {
    const password = await this.hashPassword(input.editPassword);
    const newSession = this.generateSessionToken();

    for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
      const newPublicId = this.generatePublicId();
      if (!isCanonicalUuidV4(newPublicId) || this.projects.findByPublicId(newPublicId)) {
        continue;
      }

      const transaction = this.database.transaction((): CopiedProject => {
        const now = this.clock();
        const nowText = now.toISOString();
        const source = this.projects.findCredentialById(authorization.projectId);
        const sourceSession = this.sessions.findById(authorization.sessionId);

        if (!validSession(sourceSession, source, authorization, now)) {
          throw new EditSessionInvalidError();
        }
        if (!source || source.revision !== expectedRevision) {
          throw new RevisionMismatchError();
        }

        const sourceTasks = this.schedules.listTasks(source.id);
        const sourceLinks = this.schedules.listLinks(source.id);
        const sourceHolidays = this.schedules.listHolidays(source.id);
        const sourceCalendarRules = this.calendars.listRules(source.id);
        const sourceCalendarDates = this.calendars.listDates(source.id);
        if (sourceTasks.length > MAX_PROJECT_TASKS) {
          throw new PersistedScheduleInvalidError();
        }

        const calendar = resolveProjectWorkingCalendar(this.database, source.id);
        recalculatePersistedHierarchy(sourceTasks, calendar);

        const project = this.projects.insert({
          publicId: newPublicId,
          name: input.name,
          description: input.description,
          status: "planned",
          passwordKdf: password.algorithm,
          passwordSalt: password.salt,
          passwordHash: password.hash,
          scryptN: password.n,
          scryptR: password.r,
          scryptP: password.p,
          scryptKeyLength: password.keyLength,
          calendarTimezone: "Asia/Seoul",
          createdAt: nowText,
          updatedAt: nowText,
        });
        const ownerName = input.ownerName ?? this.owners.findById(source.id) ?? null;
        if (!this.owners.setByPublicId(newPublicId, ownerName)) {
          throw new Error("Copied project owner metadata could not be persisted.");
        }

        const datesByRule = new Map<number, typeof sourceCalendarDates>();
        for (const date of sourceCalendarDates) {
          const entries = datesByRule.get(date.calendarRuleId) ?? [];
          entries.push(date);
          datesByRule.set(date.calendarRuleId, entries);
        }
        for (const sourceRule of sourceCalendarRules) {
          const copiedRule = this.calendars.insertRule({
            publicId: randomUUID(),
            projectId: project.id,
            kind: sourceRule.kind,
            name: sourceRule.name,
            countryCode: sourceRule.countryCode,
            targetType: sourceRule.targetType,
            targetPublicId: sourceRule.targetPublicId,
            scope: sourceRule.scope,
            effectiveFrom: sourceRule.effectiveFrom,
            effectiveTo: sourceRule.effectiveTo,
            sourceVersion: sourceRule.sourceVersion,
            now: nowText,
          });
          for (const sourceDate of datesByRule.get(sourceRule.id) ?? []) {
            this.calendars.insertDate({
              calendarRuleId: copiedRule.id,
              date: sourceDate.date,
              dayType: sourceDate.dayType,
              name: sourceDate.name,
              sourceKey: sourceDate.sourceKey,
              sourceVersion: sourceDate.sourceVersion,
              now: nowText,
            });
          }
        }

        const newBySourceId = new Map<number, TaskRecord>();
        const pending = [...sourceTasks];
        while (pending.length > 0) {
          let insertedThisPass = 0;
          for (let index = pending.length - 1; index >= 0; index -= 1) {
            const sourceTask = pending[index];
            if (
              sourceTask.parentId !== null &&
              !newBySourceId.has(sourceTask.parentId)
            ) {
              continue;
            }

            let taskPublicId = "";
            for (let idAttempt = 0; idAttempt < ID_ATTEMPTS; idAttempt += 1) {
              const candidate = this.generateTaskPublicId();
              if (
                isCanonicalUuidV4(candidate) &&
                !this.schedules.taskPublicIdExists(candidate)
              ) {
                taskPublicId = candidate;
                break;
              }
            }
            if (!taskPublicId) {
              throw new Error("Unique task identifier could not be generated.");
            }

            const inserted = this.schedules.insertTask({
              projectId: project.id,
              externalId: sourceTask.externalId,
              publicId: taskPublicId,
              name: sourceTask.name,
              description: sourceTask.description,
              url: sourceTask.url,
              type: sourceTask.type,
              scheduleMode: sourceTask.scheduleMode,
              requestedStart: sourceTask.requestedStart,
              startDate: sourceTask.startDate,
              endDate: sourceTask.endDate,
              duration: sourceTask.duration,
              progress: input.resetProgress && sourceTask.type !== "summary"
                ? 0
                : sourceTask.progress,
              parentId: sourceTask.parentId === null
                ? null
                : newBySourceId.get(sourceTask.parentId)!.id,
              sortOrder: sourceTask.sortOrder,
              createdAt: nowText,
              updatedAt: nowText,
            });
            newBySourceId.set(sourceTask.id, inserted);
            pending.splice(index, 1);
            insertedThisPass += 1;
          }

          if (insertedThisPass === 0) {
            throw new PersistedScheduleInvalidError();
          }
        }

        if (input.resetProgress) {
          const copiedTasks = this.schedules.listTasks(project.id);
          const derived = recalculateHierarchy(dtoTasks(copiedTasks), calendar);
          for (const task of derived) {
            if (task.type !== "summary") continue;
            if (!this.schedules.updateSummarySchedule(project.id, task.taskId, {
              startDate: task.start,
              endDate: task.end,
              duration: task.duration,
              progress: task.progress,
              updatedAt: nowText,
            })) {
              throw new PersistedScheduleInvalidError();
            }
          }
        }

        for (const sourceLink of sourceLinks) {
          const predecessor = newBySourceId.get(sourceLink.predecessorTaskId);
          const successor = newBySourceId.get(sourceLink.successorTaskId);
          if (!predecessor || !successor) {
            throw new PersistedScheduleInvalidError();
          }

          let linkPublicId = "";
          for (let idAttempt = 0; idAttempt < ID_ATTEMPTS; idAttempt += 1) {
            const candidate = this.generateLinkPublicId();
            if (
              isCanonicalUuidV4(candidate) &&
              !this.schedules.linkPublicIdExists(candidate)
            ) {
              linkPublicId = candidate;
              break;
            }
          }
          if (!linkPublicId) {
            throw new Error("Unique link identifier could not be generated.");
          }

          this.schedules.insertLink({
            publicId: linkPublicId,
            projectId: project.id,
            predecessorTaskId: predecessor.id,
            successorTaskId: successor.id,
            type: sourceLink.type,
            lag: sourceLink.lag,
            createdAt: nowText,
            updatedAt: nowText,
          });
        }

        // 1. 태스크 리소스 할당(task_assignments) 복사
        const sourceAssignments = this.resourceCatalog.listAssignments(source.id);
        const copiedAssignmentsByTask = new Map<number, Array<{
          assignmentPublicId: string;
          kind: "resource" | "group";
          internalId: number;
          publicId: string;
          assignmentStart: string | null;
          assignmentEnd: string | null;
          allocationPercent: number | null;
        }>>();

        for (const sa of sourceAssignments) {
          const newTask = newBySourceId.get(sa.taskId);
          if (!newTask) continue;
          const list = copiedAssignmentsByTask.get(newTask.id) ?? [];
          list.push({
            assignmentPublicId: randomUUID(),
            kind: sa.kind,
            internalId: sa.targetInternalId,
            publicId: sa.targetPublicId,
            assignmentStart: sa.assignmentStart,
            assignmentEnd: sa.assignmentEnd,
            allocationPercent: sa.allocationPercent,
          });
          copiedAssignmentsByTask.set(newTask.id, list);
        }

        for (const [newTaskId, targets] of copiedAssignmentsByTask.entries()) {
          this.resourceCatalog.replaceTaskAssignments({
            projectId: project.id,
            taskId: newTaskId,
            targets,
            now: nowText,
          });
        }

        // 2. 물류 공정(Processes) 복사 (부모 계층 보존)
        const sourceProcesses = this.logistics.listProcesses(source.id);
        const newBySourceProcessId = new Map<number, ProcessRecord>();
        const pendingProcesses = [...sourceProcesses];

        while (pendingProcesses.length > 0) {
          let insertedCount = 0;
          for (let i = pendingProcesses.length - 1; i >= 0; i -= 1) {
            const sp = pendingProcesses[i];
            if (sp.parentId !== null && !newBySourceProcessId.has(sp.parentId)) {
              continue;
            }
            const newProcess = this.logistics.insertProcess({
              publicId: randomUUID(),
              projectId: project.id,
              code: sp.code,
              name: sp.name,
              parentId: sp.parentId === null ? null : newBySourceProcessId.get(sp.parentId)!.id,
              sortOrder: sp.sortOrder,
              active: sp.active,
              now: nowText,
            });
            newBySourceProcessId.set(sp.id, newProcess);
            pendingProcesses.splice(i, 1);
            insertedCount += 1;
          }
          if (insertedCount === 0) {
            throw new Error("Cycle detected in source process hierarchy.");
          }
        }

        // 3. 물류 시스템(Systems) 복사 및 담당 공정, 리소스 역할 복사
        const sourceSystems = this.logistics.listSystems(source.id);
        const newBySourceSystemId = new Map<number, LogisticsSystemRecord>();

        for (const ss of sourceSystems) {
          const newSystem = this.logistics.insertSystem({
            publicId: randomUUID(),
            projectId: project.id,
            code: ss.code,
            name: ss.name,
            systemType: ss.systemType,
            layer: ss.layer,
            scope: ss.scope,
            vendor: ss.vendor,
            description: ss.description,
            active: ss.active,
            now: nowText,
          });
          newBySourceSystemId.set(ss.id, newSystem);

          // 시스템 담당 공정 복사
          const sourceProcessIds: number[] = this.logistics.listSystemProcesses(source.id, ss.id);
          const newProcessIds: number[] = sourceProcessIds
            .map((spId: number) => newBySourceProcessId.get(spId)?.id)
            .filter((id): id is number => id !== undefined);
          if (newProcessIds.length > 0) {
            this.logistics.setSystemProcesses(project.id, newSystem.id, newProcessIds, nowText);
          }

          // 시스템 리소스 역할 복사 (글로벌 리소스 ID 보존)
          const sourceRoles = this.logistics.listSystemResourceRoles(source.id, ss.id);
          if (sourceRoles.length > 0) {
            this.logistics.replaceSystemResourceRoles(
              project.id,
              newSystem.id,
              sourceRoles.map((r) => ({
                resourceId: r.resourceId,
                role: r.role,
                isPrimary: r.isPrimary,
              })),
              nowText,
            );
          }
        }

        // 4. 시스템 간 조율 링크(System Links) 복사 (모든 시스템 생성 후)
        for (const ss of sourceSystems) {
          if (ss.layer === "coordinator") {
            const sourceLinks = this.logistics.listSystemLinks(source.id);
            const childSystemIds: number[] = sourceLinks
              .filter((l) => l.sourceSystemId === ss.id)
              .map((l) => newBySourceSystemId.get(l.targetSystemId)?.id)
              .filter((id): id is number => id !== undefined);
            if (childSystemIds.length > 0) {
              const newCoordinator = newBySourceSystemId.get(ss.id)!;
              this.logistics.setCoordinatedSystems(project.id, newCoordinator.id, childSystemIds, nowText);
            }
          }
        }

        // 5. 설비(Equipment) 복사 및 제어 시스템 매핑, 리소스 역할 복사
        const sourceEquipment = this.logistics.listEquipment(source.id);
        const newBySourceEquipmentId = new Map<number, EquipmentRecord>();

        for (const se of sourceEquipment) {
          const newProcess = newBySourceProcessId.get(se.processId);
          if (!newProcess) {
            throw new Error(`Referenced process ${se.processId} not found during equipment copy.`);
          }

          const newEquipment = this.logistics.insertEquipment({
            publicId: randomUUID(),
            projectId: project.id,
            processId: newProcess.id,
            code: se.code,
            name: se.name,
            equipmentType: se.equipmentType,
            managementUnit: se.managementUnit,
            quantity: se.quantity,
            manufacturer: se.manufacturer,
            model: se.model,
            description: se.description,
            active: se.active,
            now: nowText,
          });
          newBySourceEquipmentId.set(se.id, newEquipment);

          // 설비-시스템 매핑 복사
          const sourceEqSystems = this.logistics.listEquipmentSystems(source.id, se.id);
          const newEqSystems: Array<{ systemId: number; controlRole: typeof sourceEqSystems[number]["controlRole"] }> = [];
          for (const es of sourceEqSystems) {
            const targetSys = newBySourceSystemId.get(es.systemId);
            if (targetSys) {
              newEqSystems.push({ systemId: targetSys.id, controlRole: es.controlRole });
            }
          }
          if (newEqSystems.length > 0) {
            this.logistics.setEquipmentSystems(project.id, newEquipment.id, newEqSystems, nowText);
          }

          // 설비 리소스 역할 복사 (글로벌 리소스 ID 보존)
          const sourceRoles = this.logistics.listEquipmentResourceRoles(source.id, se.id);
          if (sourceRoles.length > 0) {
            this.logistics.replaceEquipmentResourceRoles(
              project.id,
              newEquipment.id,
              sourceRoles.map((r) => ({
                resourceId: r.resourceId,
                role: r.role,
                isPrimary: r.isPrimary,
              })),
              nowText,
            );
          }
        }

        // 6. 태스크 물류 연결(Task Logistics Links) 복사
        const sourceEqLinks = this.logistics.listAllTaskEquipmentLinks(source.id);
        const sourceSysLinks = this.logistics.listAllTaskSystemLinks(source.id);

        const linksByTaskId = new Map<number, {
          equipmentLinks: Array<{ equipmentId: number; scope: "self" | "subtree" }>;
          systemLinks: Array<{ systemId: number; scope: "self" | "subtree" }>;
        }>();

        for (const el of sourceEqLinks) {
          const newEq = newBySourceEquipmentId.get(el.equipmentId);
          if (!newEq) continue;
          const entry = linksByTaskId.get(el.taskId) ?? { equipmentLinks: [], systemLinks: [] };
          entry.equipmentLinks.push({ equipmentId: newEq.id, scope: el.scope });
          linksByTaskId.set(el.taskId, entry);
        }

        for (const sl of sourceSysLinks) {
          const newSys = newBySourceSystemId.get(sl.systemId);
          if (!newSys) continue;
          const entry = linksByTaskId.get(sl.taskId) ?? { equipmentLinks: [], systemLinks: [] };
          entry.systemLinks.push({ systemId: newSys.id, scope: sl.scope });
          linksByTaskId.set(sl.taskId, entry);
        }

        for (const [sourceTaskId, links] of linksByTaskId.entries()) {
          const newTask = newBySourceId.get(sourceTaskId);
          if (!newTask) continue;
          if (links.equipmentLinks.length > 0) {
            this.logistics.replaceTaskEquipmentLinks(project.id, newTask.id, links.equipmentLinks, nowText);
          }
          if (links.systemLinks.length > 0) {
            this.logistics.replaceTaskSystemLinks(project.id, newTask.id, links.systemLinks, nowText);
          }
        }

        // 7. 비활성 마스터/리소스 경고 수집
        const warnings: string[] = [];
        const hasInactiveMaster =
          sourceProcesses.some((p) => p.active === 0) ||
          sourceEquipment.some((e) => e.active === 0) ||
          sourceSystems.some((s) => s.active === 0);

        if (hasInactiveMaster) {
          warnings.push("비활성화된 공정·설비·시스템 마스터가 원본 관계를 보존하여 복사되었습니다.");
        }

        let hasInactiveResourceRole = false;
        for (const s of sourceSystems) {
          const roles = this.logistics.listSystemResourceRoles(source.id, s.id);
          if (roles.some((r) => r.resourceActive === 0)) {
            hasInactiveResourceRole = true;
            break;
          }
        }
        if (!hasInactiveResourceRole) {
          for (const e of sourceEquipment) {
            const roles = this.logistics.listEquipmentResourceRoles(source.id, e.id);
            if (roles.some((r) => r.resourceActive === 0)) {
              hasInactiveResourceRole = true;
              break;
            }
          }
        }
        if (hasInactiveResourceRole) {
          warnings.push("비활성화된 담당자가 지정된 설비·시스템이 포함되어 있습니다.");
        }

        this.sessions.insert({
          projectId: project.id,
          tokenHash: newSession.tokenHash,
          authVersion: project.authVersion,
          createdAt: nowText,
          expiresAt: sessionExpiry(now).toISOString(),
        });

        const copiedTasks = this.schedules.listTasks(project.id);
        const copiedLinks = this.schedules.listLinks(project.id);
        const externalById = new Map(
          copiedTasks.map((task) => [task.id, task.externalId]),
        );

        const copiedLogistics = this.logisticsService.getLogisticsDto(project.id);

        const response: CopyProjectResponse = {
          data: {
            project: {
              publicId: project.publicId,
              name: project.name,
              description: project.description,
              status: project.status,
              ownerName,
              revision: project.revision,
              calendar: projectCalendarDto(this.database, project.id),
            },
            tasks: dtoTasks(copiedTasks),
            links: copiedLinks.map((link) => ({
              id: link.publicId,
              predecessorExternalId: externalById.get(link.predecessorTaskId)!,
              successorExternalId: externalById.get(link.successorTaskId)!,
              type: link.type,
              lag: link.lag,
            })),
            logistics: copiedLogistics,
            permission: "edit",
            operation: {
              kind: "projectCopy",
              sourcePublicId: source.publicId,
              sourceRevision: source.revision,
              counts: {
                tasks: copiedTasks.length,
                links: copiedLinks.length,
                holidays: sourceHolidays.length,
                ...(sourceAssignments.length > 0 ? { assignments: sourceAssignments.length } : {}),
                ...(sourceProcesses.length > 0 ? { processes: sourceProcesses.length } : {}),
                ...(sourceEquipment.length > 0 ? { equipment: sourceEquipment.length } : {}),
                ...(sourceSystems.length > 0 ? { systems: sourceSystems.length } : {}),
              },
            },
            warnings,
          },
        };

        return {
          response,
          rawSessionToken: newSession.rawToken,
        };
      });

      try {
        return transaction.immediate();
      } catch (error) {
        if (this.projects.findByPublicId(newPublicId)) continue;
        throw error;
      }
    }

    throw new Error("A unique project identifier could not be generated.");
  }
}
