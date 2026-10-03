import { PersistedScheduleInvalidError } from "../projects/project-service-core";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import {
  type CreateProjectTemplateRequest,
  type DuplicateProjectTemplateRequest,
  type InstantiateProjectTemplateRequest,
  type InstantiateProjectTemplateResponse,
  type ProjectTemplateDetailDto,
  type ProjectTemplateDto,
  type ProjectTemplateSnapshot,
  type TemplateAssignmentSnapshotItem,
  type TemplateEquipmentSnapshotItem,
  type TemplateLinkSnapshotItem,
  type TemplateProcessSnapshotItem,
  type TemplateSystemSnapshotItem,
  type TemplateTaskEquipmentLinkSnapshotItem,
  type TemplateTaskSnapshotItem,
  type TemplateTaskSystemLinkSnapshotItem,
  type UpdateProjectTemplateRequest,
} from "../../contracts/project-templates";
import type { ProjectDto, ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";
import type { ProjectAssignmentDto } from "../../contracts/resources";
import {
  endFromStart,
  isWorkingDay,
  nextWorkingDay,
  recalculateFinishStartDependencies,
  recalculateHierarchy,
  workingDaysBetween,
} from "../../domain/scheduling";
import {
  projectCalendarDto,
  resolveProjectWorkingCalendar,
} from "../calendars/calendar-resolution-core";
import { LogisticsService } from "../logistics/logistics-service-core";
import { ProjectMasterService } from "../project-master/project-master-service-core";
import { ProjectOwnerRepository } from "../repositories/project-owner-repository-core";
import { WorkCalendarRepository } from "../repositories/work-calendar-repository-core";
import {
  EditSessionRepository,
  ProjectRepository,
  type EditSessionRecord,
  type ProjectRecord,
} from "../repositories/project-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";
import {
  ProjectTemplateRecord,
  ProjectTemplateRepository,
} from "../repositories/project-template-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { LogisticsRepository } from "../repositories/logistics-repository-core";
import {
  hashEditPassword,
  type PasswordHashRecord,
} from "../security/password-core";
import {
  createSessionToken,
  sessionExpiry,
  type NewSessionToken,
} from "../security/session-core";
import {
  EditSessionInvalidError,
  RevisionMismatchError,
  type AuthorizedEditSession,
} from "../projects/project-service-core";

export class ProjectTemplateError extends Error {
  readonly code:
    | "TEMPLATE_NOT_FOUND"
    | "TEMPLATE_INACTIVE"
    | "INVALID_TEMPLATE_REQUEST"
    | "SOURCE_PROJECT_NOT_FOUND"
    | "UNAUTHORIZED"
    | "REVISION_MISMATCH";

  constructor(
    code:
      | "TEMPLATE_NOT_FOUND"
      | "TEMPLATE_INACTIVE"
      | "INVALID_TEMPLATE_REQUEST"
      | "SOURCE_PROJECT_NOT_FOUND"
      | "UNAUTHORIZED"
      | "REVISION_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "ProjectTemplateError";
    this.code = code;
  }
}

function validSession(
  session: EditSessionRecord | undefined,
  project: ProjectRecord | undefined,
  authorization: AuthorizedEditSession,
  now: Date,
): boolean {
  if (!session || !project) return false;
  if (session.projectId !== authorization.projectId) return false;
  if (session.authVersion !== authorization.projectAuthVersion) return false;
  if (!session.tokenHash.equals(authorization.tokenHash)) return false;
  if (project.authVersion !== authorization.projectAuthVersion) return false;
  return new Date(session.expiresAt).getTime() > now.getTime();
}

export interface ProjectTemplateServiceOptions {
  clock?: () => Date;
  hashPassword?: (password: string) => Promise<PasswordHashRecord>;
  generateSessionToken?: () => NewSessionToken;
}

export class ProjectTemplateService {
  private readonly templates: ProjectTemplateRepository;
  private readonly projects: ProjectRepository;
  private readonly schedules: ScheduleRepository;
  private readonly calendars: WorkCalendarRepository;
  private readonly resources: ResourceCatalogRepository;
  private readonly logisticsRepo: LogisticsRepository;
  private readonly logisticsService: LogisticsService;
  private readonly sessions: EditSessionRepository;
  private readonly owners: ProjectOwnerRepository;
  private readonly projectMaster: ProjectMasterService;
  private readonly clock: () => Date;
  private readonly hashPassword: (password: string) => Promise<PasswordHashRecord>;
  private readonly generateSessionToken: () => NewSessionToken;

  constructor(
    private readonly database: Database.Database,
    options: ProjectTemplateServiceOptions = {},
  ) {
    this.templates = new ProjectTemplateRepository(database);
    this.projects = new ProjectRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.calendars = new WorkCalendarRepository(database);
    this.resources = new ResourceCatalogRepository(database);
    this.logisticsRepo = new LogisticsRepository(database);
    this.logisticsService = new LogisticsService(database, options);
    this.sessions = new EditSessionRepository(database);
    this.owners = new ProjectOwnerRepository(database);
    this.projectMaster = new ProjectMasterService(database, { clock: options.clock });
    this.clock = options.clock ?? (() => new Date());
    this.hashPassword = options.hashPassword ?? ((password: string) => hashEditPassword(password));
    this.generateSessionToken = options.generateSessionToken ?? (() => createSessionToken());
  }

  listTemplates(options?: { activeOnly?: boolean; query?: string }): ProjectTemplateDto[] {
    const records = this.templates.listTemplates(options);
    return records.map((r) => this.toDto(r));
  }

  getTemplate(publicId: string): ProjectTemplateDetailDto {
    const record = this.templates.findTemplateByPublicId(publicId);
    if (!record) {
      throw new ProjectTemplateError("TEMPLATE_NOT_FOUND", "Project template not found.");
    }
    return this.toDetailDto(record);
  }

  createTemplateFromProject(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CreateProjectTemplateRequest,
  ): ProjectTemplateDetailDto {
    const now = this.clock();
    const nowText = now.toISOString();

    const normalizedName = input.name.trim();
    if (normalizedName.length < 1 || Array.from(normalizedName).length > 200) {
      throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Template name must be 1 to 200 characters.");
    }
    const normalizedDescription = (input.description ?? "").trim();
    if (Array.from(normalizedDescription).length > 4000) {
      throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Template description must be at most 4000 characters.");
    }

    return this.database.transaction(() => {
      const source = this.projects.findCredentialById(authorization.projectId);
      const sourceSession = this.sessions.findById(authorization.sessionId);

      if (!validSession(sourceSession, source, authorization, now)) {
        throw new EditSessionInvalidError();
      }
      if (!source || source.revision !== expectedRevision) {
        throw new RevisionMismatchError();
      }

      const calendar = resolveProjectWorkingCalendar(this.database, source.id);
      const tasks = this.schedules.listTasks(source.id);
      const links = this.schedules.listLinks(source.id);
      const assignments = this.resources.listAssignments(source.id);
      const logisticsDto = this.logisticsService.getLogisticsDto(source.id);

      // 기준 시작일: 가장 빠른 태스크 시작일 (없으면 프로젝트 생성일자)
      let refStart = source.createdAt.slice(0, 10);
      const scheduledDates = tasks.flatMap((task) => task.startDate === null ? [] : [task.startDate]);
      if (scheduledDates.length > 0) refStart = scheduledDates.reduce((a,b) => a < b ? a : b);
      if (!isWorkingDay(refStart, calendar)) {
        refStart = nextWorkingDay(refStart, calendar, true);
      }

      const taskExternalById = new Map(tasks.map((t) => [t.id, t.externalId]));
      const taskSnapshots: TemplateTaskSnapshotItem[] = tasks.map((t) => {
        let offsetDays: number | null = null;
        try {
          if (t.startDate === null) throw new Error("Unscheduled summary");
          const days = workingDaysBetween(refStart, t.startDate, calendar);
          offsetDays = Math.max(0, days - 1);
        } catch {
          offsetDays = t.startDate === null ? null : 0;
        }
        return {
          externalId: t.externalId,
          name: t.name,
          type: t.type,
          scheduleMode: t.scheduleMode,
          offsetDays,
          duration: t.duration,
          parentExternalId: t.parentId !== null ? (taskExternalById.get(t.parentId) ?? null) : null,
          siblingOrder: t.sortOrder,
          description: t.description ?? undefined,
          url: t.url ?? undefined,
        };
      });

      const linkSnapshots: TemplateLinkSnapshotItem[] = links.map((l) => ({
        predecessorExternalId: taskExternalById.get(l.predecessorTaskId)!,
        successorExternalId: taskExternalById.get(l.successorTaskId)!,
        type: l.type,
        lag: l.lag,
      }));

      const assignmentSnapshots: TemplateAssignmentSnapshotItem[] = assignments.map((a) => {
        let offsetStartDays: number | null = null;
        let offsetEndDays: number | null = null;
        if (a.assignmentStart) {
          try {
            offsetStartDays = Math.max(0, workingDaysBetween(refStart, a.assignmentStart, calendar) - 1);
          } catch {
            offsetStartDays = null;
          }
        }
        if (a.assignmentEnd) {
          try {
            offsetEndDays = Math.max(0, workingDaysBetween(refStart, a.assignmentEnd, calendar) - 1);
          } catch {
            offsetEndDays = null;
          }
        }
        return {
          taskExternalId: taskExternalById.get(a.taskId) ?? "",
          kind: a.kind,
          targetPublicId: a.targetPublicId,
          offsetStartDays,
          offsetEndDays,
          allocationPercent: a.allocationPercent,
        };
      }).filter((a) => a.taskExternalId.length > 0);

      // 물류 스냅샷
      const processCodeById = new Map(logisticsDto.processes.map((p) => [p.id, p.code]));
      const systemCodeById = new Map(logisticsDto.systems.map((s) => [s.id, s.code]));
      const equipmentCodeById = new Map(logisticsDto.equipment.map((e) => [e.id, e.code]));

      const processSnapshots: TemplateProcessSnapshotItem[] = logisticsDto.processes.map((p) => ({
        code: p.code,
        name: p.name,
        parentCode: p.parentProcessId ? (processCodeById.get(p.parentProcessId) ?? null) : null,
        sortOrder: p.sortOrder,
        active: p.active,
      }));

      const systemSnapshots: TemplateSystemSnapshotItem[] = logisticsDto.systems.map((s) => ({
        code: s.code,
        name: s.name,
        systemType: s.systemType,
        layer: s.layer,
        scope: s.scope,
        processCodes: s.processIds.map((pid) => processCodeById.get(pid)).filter(Boolean) as string[],
        coordinatedSystemCodes: s.coordinatedSystemIds.map((cid) => systemCodeById.get(cid)).filter(Boolean) as string[],
        resourceRoles: s.resourceRoles.map((r) => ({
          resourcePublicId: r.resourceId,
          role: r.role,
          isPrimary: r.isPrimary,
        })),
        vendor: s.vendor ?? undefined,
        description: s.description ?? undefined,
        active: s.active,
      }));

      const equipmentSnapshots: TemplateEquipmentSnapshotItem[] = logisticsDto.equipment.map((e) => ({
        code: e.code,
        name: e.name,
        equipmentType: e.equipmentType,
        managementUnit: e.managementUnit,
        quantity: e.quantity,
        processCode: processCodeById.get(e.processId) ?? "",
        controlSystems: e.controlSystems.map((cs) => ({
          systemCode: systemCodeById.get(cs.systemId) ?? "",
          controlRole: cs.controlRole,
        })),
        resourceRoles: e.resourceRoles.map((r) => ({
          resourcePublicId: r.resourceId,
          role: r.role,
          isPrimary: r.isPrimary,
        })),
        manufacturer: e.manufacturer ?? undefined,
        model: e.model ?? undefined,
        description: e.description ?? undefined,
        active: e.active,
      }));

      const taskEquipmentLinkSnapshots: TemplateTaskEquipmentLinkSnapshotItem[] = (
        logisticsDto.taskEquipmentLinks ?? []
      ).map((l) => {
        const task = tasks.find((t) => t.publicId === l.taskId);
        return {
          taskExternalId: task ? task.externalId : "",
          equipmentCode: equipmentCodeById.get(l.equipmentId) ?? "",
          scope: l.scope,
        };
      }).filter((l) => l.taskExternalId && l.equipmentCode);

      const taskSystemLinkSnapshots: TemplateTaskSystemLinkSnapshotItem[] = (
        logisticsDto.taskSystemLinks ?? []
      ).map((l) => {
        const task = tasks.find((t) => t.publicId === l.taskId);
        return {
          taskExternalId: task ? task.externalId : "",
          systemCode: systemCodeById.get(l.systemId) ?? "",
          scope: l.scope,
        };
      }).filter((l) => l.taskExternalId && l.systemCode);

      const selectedMaster = this.projectMaster.projectSelectionDto(source.id);
      const snapshot: ProjectTemplateSnapshot = {
        sourceRevision: source.revision,
        projectMaster: {
          businessUnitId: selectedMaster.businessUnit?.id ?? null,
          productId: selectedMaster.product?.id ?? null,
          siteEntityId: selectedMaster.siteEntity?.id ?? null,
        },
        calendar: {
          timezone: source.calendarTimezone,
          weekendDays: [6, 0],
          holidays: calendar.holidays.map((h) => ({ date: h.date, name: h.name ?? undefined })),
        },
        tasks: taskSnapshots,
        links: linkSnapshots,
        assignments: assignmentSnapshots,
        logistics: {
          processes: processSnapshots,
          equipment: equipmentSnapshots,
          systems: systemSnapshots,
          taskEquipmentLinks: taskEquipmentLinkSnapshots,
          taskSystemLinks: taskSystemLinkSnapshots,
        },
      };

      const taskCount = tasks.filter((t) => t.type !== "milestone").length;
      const milestoneCount = tasks.filter((t) => t.type === "milestone").length;

      const record = this.templates.insertTemplate({
        publicId: randomUUID(),
        name: normalizedName,
        description: normalizedDescription,
        sourceProjectId: source.id,
        sourceProjectName: source.name,
        active: input.active === false ? 0 : 1,
        taskCount,
        milestoneCount,
        contentJson: JSON.stringify(snapshot),
        now: nowText,
      });

      return this.toDetailDto(record);
    })();
  }

  updateTemplate(publicId: string, input: UpdateProjectTemplateRequest): ProjectTemplateDto {
    const record = this.templates.findTemplateByPublicId(publicId);
    if (!record) {
      throw new ProjectTemplateError("TEMPLATE_NOT_FOUND", "Project template not found.");
    }

    const nowText = this.clock().toISOString();
    let name: string | undefined;
    if (input.name !== undefined) {
      name = input.name.trim();
      if (name.length < 1 || Array.from(name).length > 200) {
        throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Template name must be 1 to 200 characters.");
      }
    }
    let description: string | undefined;
    if (input.description !== undefined) {
      description = input.description.trim();
      if (Array.from(description).length > 4000) {
        throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Template description must be at most 4000 characters.");
      }
    }
    const active = input.active !== undefined ? (input.active ? 1 : 0) : undefined;

    const updated = this.templates.updateTemplate(record.id, {
      name,
      description,
      active,
      now: nowText,
    });

    return this.toDto(updated!);
  }

  duplicateTemplate(publicId: string, input?: DuplicateProjectTemplateRequest): ProjectTemplateDetailDto {
    const record = this.templates.findTemplateByPublicId(publicId);
    if (!record) {
      throw new ProjectTemplateError("TEMPLATE_NOT_FOUND", "Project template not found.");
    }

    const nowText = this.clock().toISOString();
    const candidateName = input?.name?.trim() || `${record.name} (복사본)`;
    const newName = Array.from(candidateName).slice(0, 200).join("");

    const newRecord = this.templates.insertTemplate({
      publicId: randomUUID(),
      name: newName,
      description: record.description,
      sourceProjectId: record.sourceProjectId,
      sourceProjectName: record.sourceProjectName,
      active: record.active,
      taskCount: record.taskCount,
      milestoneCount: record.milestoneCount,
      contentJson: record.contentJson,
      now: nowText,
    });

    return this.toDetailDto(newRecord);
  }

  deleteTemplate(publicId: string): boolean {
    const record = this.templates.findTemplateByPublicId(publicId);
    if (!record) {
      throw new ProjectTemplateError("TEMPLATE_NOT_FOUND", "Project template not found.");
    }
    return this.templates.deleteTemplate(record.id);
  }

  async instantiateProject(
    templatePublicId: string,
    input: InstantiateProjectTemplateRequest,
  ): Promise<{ response: InstantiateProjectTemplateResponse; rawSessionToken: string }> {
    const template = this.templates.findTemplateByPublicId(templatePublicId);
    if (!template) {
      throw new ProjectTemplateError("TEMPLATE_NOT_FOUND", "Project template not found.");
    }
    if (template.active !== 1) {
      throw new ProjectTemplateError("TEMPLATE_INACTIVE", "Cannot instantiate an inactive template.");
    }

    const normalizedName = input.name.trim();
    if (normalizedName.length < 1 || Array.from(normalizedName).length > 200) {
      throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Project name must be 1 to 200 characters.");
    }
    const normalizedOwner = input.ownerName.trim();
    if (normalizedOwner.length < 1 || Array.from(normalizedOwner).length > 100) {
      throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Owner name must be 1 to 100 characters.");
    }
    const normalizedDescription = (input.description ?? "").trim();
    if (Array.from(normalizedDescription).length > 4000) {
      throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Description must be at most 4000 characters.");
    }
    if (!input.editPassword || Array.from(input.editPassword).length < 1 || Array.from(input.editPassword).length > 12) {
      throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Password must be 1 to 12 characters.");
    }

    const snapshot = JSON.parse(template.contentJson) as ProjectTemplateSnapshot;
    const passwordParameters = await this.hashPassword(input.editPassword);

    const now = this.clock();
    const nowText = now.toISOString();
    const newPublicId = randomUUID();
    const sessionToken = this.generateSessionToken();
    const warnings: string[] = [];

    return this.database.transaction(() => {
      // 1. 프로젝트 레코드 생성
      const project = this.projects.insert({
        publicId: newPublicId,
        name: normalizedName,
        description: normalizedDescription,
        status: "planned",
        passwordKdf: passwordParameters.algorithm,
        passwordSalt: passwordParameters.salt,
        passwordHash: passwordParameters.hash,
        scryptN: passwordParameters.n,
        scryptR: passwordParameters.r,
        scryptP: passwordParameters.p,
        scryptKeyLength: passwordParameters.keyLength,
        calendarTimezone: "Asia/Seoul",
        createdAt: nowText,
        updatedAt: nowText,
      });

      this.owners.setByPublicId(newPublicId, normalizedOwner);
      if (snapshot.projectMaster) {
        const resolvedMaster = this.projectMaster.resolveProjectSelection(snapshot.projectMaster, { allowInactive: true });
        this.projectMaster.setProjectSelection(project.id, resolvedMaster);
        const selected = this.projectMaster.projectSelectionDto(project.id);
        if ([selected.businessUnit, selected.product, selected.siteEntity].some((item) => item && !item.active)) {
          warnings.push("템플릿의 비활성 프로젝트 기준정보 참조를 그대로 보존했습니다.");
        }
      }

      // 2. 캘린더 규칙/휴일 생성
      const defaultRule = this.calendars.insertRule({
        publicId: randomUUID(),
        projectId: project.id,
        kind: "CUSTOM",
        name: "프로젝트 기본 캘린더",
        countryCode: null,
        targetType: "PROJECT",
        targetPublicId: null,
        scope: "FULL_PROJECT",
        effectiveFrom: null,
        effectiveTo: null,
        sourceVersion: null,
        now: nowText,
      });

      for (const h of snapshot.calendar.holidays ?? []) {
        this.calendars.insertDate({
          calendarRuleId: defaultRule.id,
          date: h.date,
          dayType: "NON_WORKING",
          name: h.name ?? null,
          sourceKey: null,
          sourceVersion: null,
          now: nowText,
        });
      }

      const calendar = resolveProjectWorkingCalendar(this.database, project.id);

      // 3. 시작일 기준 근무일 계산 및 태스크 삽입
      let projectStart = input.projectStartDate;
      if (!isWorkingDay(projectStart, calendar)) {
        projectStart = nextWorkingDay(projectStart, calendar, true);
      }

      const newByExternalId = new Map<string, { id: number; publicId: string; externalId: string; type: string }>();
      const pendingTasks = [...snapshot.tasks];

      while (pendingTasks.length > 0) {
        let inserted = 0;
        for (let i = pendingTasks.length - 1; i >= 0; i -= 1) {
          const t = pendingTasks[i];
          if (t.parentExternalId !== null && !newByExternalId.has(t.parentExternalId)) {
            continue;
          }

          const taskPublicId = randomUUID();
          if (t.type !== "summary" && (t.offsetDays === null || t.duration === null)) {
            throw new PersistedScheduleInvalidError();
          }
          const startDate = t.type === "summary" ? null : endFromStart(projectStart, t.offsetDays! + 1, calendar);
          const endDate = t.type === "summary" ? null : t.type === "milestone"
            ? startDate
            : endFromStart(startDate!, Math.max(1, t.duration!), calendar);

          const parentRecord = t.parentExternalId ? newByExternalId.get(t.parentExternalId) : undefined;
          const insertedTask = this.schedules.insertTask({
            publicId: taskPublicId,
            projectId: project.id,
            parentId: parentRecord ? parentRecord.id : null,
            externalId: t.externalId,
            name: t.name,
            type: t.type,
            scheduleMode: t.scheduleMode,
            requestedStart: t.type === "summary" ? null : startDate,
            startDate,
            endDate,
            duration: t.type === "summary" ? null : t.type === "milestone" ? 0 : Math.max(1, t.duration!),
            progress: t.type === "summary" ? null : 0,
            sortOrder: t.siblingOrder,
            description: t.description ?? null,
            url: t.url ?? null,
            createdAt: nowText,
            updatedAt: nowText,
          });

          newByExternalId.set(t.externalId, {
            id: insertedTask.id,
            publicId: taskPublicId,
            externalId: t.externalId,
            type: t.type,
          });

          pendingTasks.splice(i, 1);
          inserted += 1;
        }

        if (inserted === 0) {
          throw new ProjectTemplateError("INVALID_TEMPLATE_REQUEST", "Cycle detected in template task hierarchy.");
        }
      }

      // 4. 의존관계(Links) 삽입
      for (const link of snapshot.links) {
        const pred = newByExternalId.get(link.predecessorExternalId);
        const succ = newByExternalId.get(link.successorExternalId);
        if (!pred || !succ) continue;

        this.schedules.insertLink({
          publicId: randomUUID(),
          projectId: project.id,
          predecessorTaskId: pred.id,
          successorTaskId: succ.id,
          type: link.type,
          lag: link.lag,
          createdAt: nowText,
          updatedAt: nowText,
        });
      }

      // 5. 스케줄링 엔진 전체 재계산 및 정규화
      const currentTasks = this.schedules.listTasks(project.id);
      const currentLinks = this.schedules.listLinks(project.id);
      const taskDtoMap = new Map(currentTasks.map((t) => [t.id, t.externalId]));

      const initialDtos = currentTasks.map((t) => ({
        taskId: t.publicId,
        externalId: t.externalId,
        name: t.name,
        type: t.type,
        scheduleMode: t.scheduleMode,
        requestedStart: t.requestedStart,
        start: t.startDate,
        end: t.endDate,
        duration: t.duration,
        progress: 0,
        parentExternalId: t.parentId ? (taskDtoMap.get(t.parentId) ?? null) : null,
        siblingOrder: t.sortOrder,
      }));

      const linkDtos = currentLinks.map((l) => ({
        id: l.publicId,
        predecessorExternalId: taskDtoMap.get(l.predecessorTaskId)!,
        successorExternalId: taskDtoMap.get(l.successorTaskId)!,
        type: l.type,
        lag: l.lag,
      }));

      const derivedHierarchy = recalculateHierarchy(
        recalculateFinishStartDependencies(
          recalculateHierarchy(initialDtos, calendar),
          linkDtos,
          calendar,
        ).tasks,
        calendar,
      );

      for (const d of derivedHierarchy) {
        this.database.prepare(`
          UPDATE tasks
          SET start_date = ?, end_date = ?, duration = ?, progress = ?
          WHERE public_id = ?
        `).run(d.start, d.end, d.duration, d.progress, d.taskId);
      }

      // 6. 리소스 배정 복제
      const assignmentsByTaskId = new Map<number, Array<{
        assignmentPublicId: string;
        kind: "resource" | "group";
        internalId: number;
        publicId: string;
        assignmentStart: string | null;
        assignmentEnd: string | null;
        allocationPercent: number | null;
      }>>();

      for (const a of snapshot.assignments) {
        const taskInfo = newByExternalId.get(a.taskExternalId);
        if (!taskInfo) continue;

        let internalTargetId: number | undefined;
        let isActive = true;

        if (a.kind === "resource") {
          const res = this.resources.findResourceByPublicId(a.targetPublicId);
          if (res) {
            internalTargetId = res.id;
            isActive = res.active;
          }
        } else {
          const grp = this.resources.findGroupByPublicId(a.targetPublicId);
          if (grp) {
            internalTargetId = grp.id;
            isActive = grp.active;
          }
        }

        if (!internalTargetId) {
          warnings.push(`배정 대상 리소스/그룹(${a.targetPublicId})이 존재하지 않아 배정이 생략되었습니다.`);
          continue;
        }
        if (!isActive) {
          warnings.push(`배정 대상 리소스/그룹(${a.targetPublicId})이 현재 비활성 상태입니다.`);
        }

        const list = assignmentsByTaskId.get(taskInfo.id) ?? [];
        list.push({
          assignmentPublicId: randomUUID(),
          kind: a.kind,
          internalId: internalTargetId,
          publicId: a.targetPublicId,
          assignmentStart: a.offsetStartDays == null
            ? null
            : endFromStart(projectStart, a.offsetStartDays + 1, calendar),
          assignmentEnd: a.offsetEndDays == null
            ? null
            : endFromStart(projectStart, a.offsetEndDays + 1, calendar),
          allocationPercent: a.allocationPercent,
        });
        assignmentsByTaskId.set(taskInfo.id, list);
      }

      for (const [taskId, targets] of assignmentsByTaskId.entries()) {
        this.resources.replaceTaskAssignments({
          projectId: project.id,
          taskId,
          targets,
          now: nowText,
        });
      }

      // 7. 물류 마스터 복제
      const logisticsSnapshot = snapshot.logistics;
      if (logisticsSnapshot) {
        // 7.1 공정
        const processByCode = new Map<string, { id: number; publicId: string }>();
        const pendingProcs = [...logisticsSnapshot.processes];
        while (pendingProcs.length > 0) {
          let insertedProc = 0;
          for (let i = pendingProcs.length - 1; i >= 0; i -= 1) {
            const p = pendingProcs[i];
            if (p.parentCode !== null && !processByCode.has(p.parentCode)) {
              continue;
            }
            const parent = p.parentCode ? processByCode.get(p.parentCode) : undefined;
            const newProc = this.logisticsRepo.insertProcess({
              publicId: randomUUID(),
              projectId: project.id,
              code: p.code,
              name: p.name,
              parentId: parent ? parent.id : null,
              sortOrder: p.sortOrder,
              active: p.active ? 1 : 0,
              now: nowText,
            });
            processByCode.set(p.code, { id: newProc.id, publicId: newProc.publicId });
            pendingProcs.splice(i, 1);
            insertedProc += 1;
          }
          if (insertedProc === 0) break;
        }

        // 7.2 시스템
        const systemByCode = new Map<string, { id: number; publicId: string }>();
        for (const s of logisticsSnapshot.systems) {
          const newSys = this.logisticsRepo.insertSystem({
            publicId: randomUUID(),
            projectId: project.id,
            code: s.code,
            name: s.name,
            systemType: s.systemType,
            layer: s.layer,
            scope: s.scope,
            vendor: s.vendor,
            description: s.description,
            active: s.active ? 1 : 0,
            now: nowText,
          });
          systemByCode.set(s.code, { id: newSys.id, publicId: newSys.publicId });

          // 담당 공정
          const procIds = s.processCodes
            .map((c) => processByCode.get(c)?.id)
            .filter((id): id is number => typeof id === "number");
          if (procIds.length > 0) {
            this.logisticsRepo.setSystemProcesses(project.id, newSys.id, procIds, nowText);
          }

          // 리소스 역할
          const roles = s.resourceRoles.map((r) => {
            const res = this.resources.findResourceByPublicId(r.resourcePublicId);
            if (!res?.active) {
              warnings.push(`시스템(${s.code}) 담당 리소스(${r.resourcePublicId})가 비활성 상태입니다.`);
            }
            return {
              resourceId: res ? res.id : 0,
              role: r.role,
              isPrimary: r.isPrimary ? 1 : 0,
            };
          }).filter((r) => r.resourceId > 0);
          if (roles.length > 0) {
            this.logisticsRepo.replaceSystemResourceRoles(project.id, newSys.id, roles, nowText);
          }
        }

        // 조율 시스템 링크
        for (const s of logisticsSnapshot.systems) {
          const sourceSys = systemByCode.get(s.code);
          if (!sourceSys || !s.coordinatedSystemCodes?.length) continue;
          const targetIds = s.coordinatedSystemCodes
            .map((c) => systemByCode.get(c)?.id)
            .filter((id): id is number => typeof id === "number");
          if (targetIds.length > 0) {
            this.logisticsRepo.setCoordinatedSystems(project.id, sourceSys.id, targetIds, nowText);
          }
        }

        // 7.3 설비
        const equipmentByCode = new Map<string, { id: number; publicId: string }>();
        for (const e of logisticsSnapshot.equipment) {
          const proc = processByCode.get(e.processCode);
          if (!proc) continue;

          const newEq = this.logisticsRepo.insertEquipment({
            publicId: randomUUID(),
            projectId: project.id,
            processId: proc.id,
            code: e.code,
            name: e.name,
            equipmentType: e.equipmentType,
            managementUnit: e.managementUnit,
            quantity: e.quantity,
            manufacturer: e.manufacturer,
            model: e.model,
            description: e.description,
            active: e.active ? 1 : 0,
            now: nowText,
          });
          equipmentByCode.set(e.code, { id: newEq.id, publicId: newEq.publicId });

          // 제어 시스템
          const controlSystems = e.controlSystems.map((cs) => {
            const sys = systemByCode.get(cs.systemCode);
            return {
              systemId: sys ? sys.id : 0,
              controlRole: cs.controlRole,
            };
          }).filter((cs) => cs.systemId > 0);
          if (controlSystems.length > 0) {
            this.logisticsRepo.setEquipmentSystems(project.id, newEq.id, controlSystems, nowText);
          }

          // 리소스 역할
          const roles = e.resourceRoles.map((r) => {
            const res = this.resources.findResourceByPublicId(r.resourcePublicId);
            if (!res?.active) {
              warnings.push(`설비(${e.code}) 담당 리소스(${r.resourcePublicId})가 비활성 상태입니다.`);
            }
            return {
              resourceId: res ? res.id : 0,
              role: r.role,
              isPrimary: r.isPrimary ? 1 : 0,
            };
          }).filter((r) => r.resourceId > 0);
          if (roles.length > 0) {
            this.logisticsRepo.replaceEquipmentResourceRoles(project.id, newEq.id, roles, nowText);
          }
        }

        // 7.4 태스크 물류 연결
        const eqLinksByTaskId = new Map<number, Array<{ equipmentId: number; scope: "self" | "subtree" }>>();
        for (const l of logisticsSnapshot.taskEquipmentLinks) {
          const task = newByExternalId.get(l.taskExternalId);
          const eq = equipmentByCode.get(l.equipmentCode);
          if (!task || !eq) continue;
          const list = eqLinksByTaskId.get(task.id) ?? [];
          list.push({ equipmentId: eq.id, scope: l.scope });
          eqLinksByTaskId.set(task.id, list);
        }
        for (const [taskId, links] of eqLinksByTaskId.entries()) {
          this.logisticsRepo.replaceTaskEquipmentLinks(project.id, taskId, links, nowText);
        }

        const sysLinksByTaskId = new Map<number, Array<{ systemId: number; scope: "self" | "subtree" }>>();
        for (const l of logisticsSnapshot.taskSystemLinks) {
          const task = newByExternalId.get(l.taskExternalId);
          const sys = systemByCode.get(l.systemCode);
          if (!task || !sys) continue;
          const list = sysLinksByTaskId.get(task.id) ?? [];
          list.push({ systemId: sys.id, scope: l.scope });
          sysLinksByTaskId.set(task.id, list);
        }
        for (const [taskId, links] of sysLinksByTaskId.entries()) {
          this.logisticsRepo.replaceTaskSystemLinks(project.id, taskId, links, nowText);
        }
      }

      // 8. 세션 생성
      this.sessions.insert({
        projectId: project.id,
        tokenHash: sessionToken.tokenHash,
        authVersion: project.authVersion,
        createdAt: nowText,
        expiresAt: sessionExpiry(now).toISOString(),
      });

      // 9. 결과 DTO 구성
      const finalTasks = this.schedules.listTasks(project.id);
      const finalLinks = this.schedules.listLinks(project.id);
      const taskMap = new Map(finalTasks.map((t) => [t.id, t.externalId]));

      const projectDto: ProjectDto = {
        publicId: project.publicId,
        name: project.name,
        description: project.description,
        status: "planned",
        ownerName: normalizedOwner,
        ...this.projectMaster.projectSelectionDto(project.id),
        revision: 1,
        calendar: projectCalendarDto(this.database, project.id),
      };

      const taskDtos: ProjectTaskDto[] = finalTasks.map((t) => ({
        taskId: t.publicId,
        externalId: t.externalId,
        name: t.name,
        type: t.type,
        scheduleMode: t.scheduleMode,
        requestedStart: t.requestedStart,
        start: t.startDate,
        end: t.endDate,
        duration: t.duration,
        progress: t.progress,
        status: t.status,
        parentExternalId: t.parentId ? (taskMap.get(t.parentId) ?? null) : null,
        siblingOrder: t.sortOrder,
        description: t.description ?? undefined,
        url: t.url ?? undefined,
      }));

      const linkDtosResult: ProjectLinkDto[] = finalLinks.map((l) => ({
        id: l.publicId,
        predecessorExternalId: taskMap.get(l.predecessorTaskId)!,
        successorExternalId: taskMap.get(l.successorTaskId)!,
        type: l.type,
        lag: l.lag,
      }));

      const assignmentDtosResult: ProjectAssignmentDto[] = this.resources.listAssignments(project.id).map((assignment) => ({
        id: assignment.publicId,
        taskId: assignment.taskPublicId,
        target: { kind: assignment.kind, id: assignment.targetPublicId },
        allocation: assignment.kind === "resource"
          ? { start: assignment.assignmentStart, end: assignment.assignmentEnd, percent: assignment.allocationPercent }
          : null,
      }));

      const response: InstantiateProjectTemplateResponse = {
        data: {
          project: projectDto,
          tasks: taskDtos,
          links: linkDtosResult,
          assignments: assignmentDtosResult,
          permission: "edit",
          operation: {
            kind: "projectTemplateInstantiation",
            templatePublicId: template.publicId,
            templateName: template.name,
            counts: {
              tasks: taskDtos.length,
              links: linkDtosResult.length,
              holidays: projectDto.calendar.holidays.length,
              assignments: assignmentDtosResult.length,
              processes: logisticsSnapshot?.processes.length ?? 0,
              equipment: logisticsSnapshot?.equipment.length ?? 0,
              systems: logisticsSnapshot?.systems.length ?? 0,
            },
          },
          warnings,
        },
      };

      return { response, rawSessionToken: sessionToken.rawToken };
    })();
  }

  private toDto(record: ProjectTemplateRecord): ProjectTemplateDto {
    let processCount = 0;
    let equipmentCount = 0;
    let systemCount = 0;
    try {
      const parsed = JSON.parse(record.contentJson) as ProjectTemplateSnapshot;
      if (parsed.logistics) {
        processCount = parsed.logistics.processes?.length ?? 0;
        equipmentCount = parsed.logistics.equipment?.length ?? 0;
        systemCount = parsed.logistics.systems?.length ?? 0;
      }
    } catch {
      // ignore parse errors for counts
    }

    return {
      id: record.publicId,
      name: record.name,
      description: record.description,
      sourceProjectId: record.sourceProjectPublicId,
      sourceProjectName: record.sourceProjectName,
      active: record.active === 1,
      taskCount: record.taskCount,
      milestoneCount: record.milestoneCount,
      processCount,
      equipmentCount,
      systemCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toDetailDto(record: ProjectTemplateRecord): ProjectTemplateDetailDto {
    const base = this.toDto(record);
    let previewTasks: ProjectTemplateDetailDto["previewTasks"] = [];
    let sourceRevision = 1;

    try {
      const parsed = JSON.parse(record.contentJson) as ProjectTemplateSnapshot;
      sourceRevision = parsed.sourceRevision ?? 1;
      previewTasks = (parsed.tasks ?? []).map((t) => ({
        externalId: t.externalId,
        name: t.name,
        type: t.type,
        scheduleMode: t.scheduleMode,
        offsetDays: t.offsetDays,
        duration: t.duration,
        parentExternalId: t.parentExternalId,
        siblingOrder: t.siblingOrder,
        description: t.description,
        url: t.url,
      }));
    } catch {
      previewTasks = [];
    }

    return {
      ...base,
      previewTasks,
      sourceRevision,
    };
  }
}
