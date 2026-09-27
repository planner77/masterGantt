import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import type {
  ControlRole,
  CreateEquipmentRequest,
  CreateLogisticsSystemRequest,
  CreateProcessRequest,
  EquipmentDto,
  EquipmentResourceRoleDto,
  EquipmentRole,
  LogisticsMutationResponse,
  LogisticsSystemDto,
  ProcessDto,
  ProjectLogisticsDto,
  SetEquipmentResourceRolesRequest,
  SetEquipmentSystemsRequest,
  SetSystemChildrenRequest,
  SetSystemProcessesRequest,
  SetSystemResourceRolesRequest,
  SystemLinkDto,
  SystemResourceRoleDto,
  SystemRole,
  UpdateEquipmentRequest,
  UpdateLogisticsSystemRequest,
  UpdateProcessRequest,
} from "../../contracts/logistics";
import type { ProjectDto } from "../../contracts/projects";
import { projectCalendarDto } from "../calendars/calendar-resolution-core";
import { ProjectOwnerRepository } from "../repositories/project-owner-repository-core";
import {
  EditSessionRepository,
  ProjectRepository,
} from "../repositories/project-repository-core";
import {
  LogisticsRepository,
} from "../repositories/logistics-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import {
  EditSessionInvalidError,
  RevisionMismatchError,
  type AuthorizedEditSession,
} from "../projects/project-service-core";

export class LogisticsConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LogisticsConflictError";
  }
}

export class LogisticsEntityNotFoundError extends Error {
  constructor(
    public readonly entity: string,
    public readonly identifier: string,
  ) {
    super(`${entity} '${identifier}' not found.`);
    this.name = "LogisticsEntityNotFoundError";
  }
}

export class LogisticsValidationError extends Error {
  constructor(public readonly details: string[]) {
    super(details.join(" "));
    this.name = "LogisticsValidationError";
  }
}

export class LogisticsCopyNotSupportedYetError extends Error {
  constructor() {
    super("Projects containing logistics data cannot be copied yet.");
    this.name = "LogisticsCopyNotSupportedYetError";
  }
}

function validSession(
  session: ReturnType<EditSessionRepository["findById"]>,
  project: ReturnType<ProjectRepository["findCredentialById"]>,
  authorization: AuthorizedEditSession,
  now: Date,
): boolean {
  if (!session || !project || session.revokedAt !== null) return false;
  const expiry = Date.parse(session.expiresAt);
  return (
    session.projectId === project.id &&
    project.publicId === authorization.projectPublicId &&
    project.authVersion === authorization.projectAuthVersion &&
    session.authVersion === project.authVersion &&
    session.tokenHash.equals(authorization.tokenHash) &&
    Number.isFinite(expiry) &&
    expiry > now.getTime()
  );
}

export class LogisticsService {
  private readonly logisticsRepo: LogisticsRepository;
  private readonly projectRepo: ProjectRepository;
  private readonly ownerRepo: ProjectOwnerRepository;
  private readonly sessionRepo: EditSessionRepository;
  private readonly resourceCatalogRepo: ResourceCatalogRepository;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;

  constructor(
    private readonly database: Database.Database,
    options: {
      clock?: () => Date;
      generatePublicId?: () => string;
    } = {},
  ) {
    this.logisticsRepo = new LogisticsRepository(database);
    this.projectRepo = new ProjectRepository(database);
    this.ownerRepo = new ProjectOwnerRepository(database);
    this.sessionRepo = new EditSessionRepository(database);
    this.resourceCatalogRepo = new ResourceCatalogRepository(database);
    this.clock = options.clock ?? (() => new Date());
    this.generatePublicId = options.generatePublicId ?? randomUUID;
  }

  // --- Read Methods ---

  getProjectIdByPublicId(publicId: string): number | undefined {
    const project = this.projectRepo.findByPublicId(publicId);
    return project?.id;
  }

  getLogisticsDto(projectId: number): ProjectLogisticsDto {
    const processes = this.logisticsRepo.listProcesses(projectId);
    const equipment = this.logisticsRepo.listEquipment(projectId);
    const systems = this.logisticsRepo.listSystems(projectId);
    const allEqSystems = this.logisticsRepo.listAllEquipmentSystems(projectId);
    const allSysProcesses = this.logisticsRepo.listAllSystemProcesses(projectId);
    const systemLinks = this.logisticsRepo.listSystemLinks(projectId);
    const allEqRoles = this.logisticsRepo.listEquipmentResourceRoles(projectId);
    const allSysRoles = this.logisticsRepo.listSystemResourceRoles(projectId);

    const processPublicIdById = new Map<number, string>(
      processes.map((p) => [p.id, p.publicId]),
    );
    const systemPublicIdById = new Map<number, string>(
      systems.map((s) => [s.id, s.publicId]),
    );

    const eqSystemsByEqId = new Map<number, { systemId: string; controlRole: ControlRole }[]>();
    for (const row of allEqSystems) {
      const sysPub = systemPublicIdById.get(row.systemId);
      if (!sysPub) continue;
      const list = eqSystemsByEqId.get(row.equipmentId) ?? [];
      list.push({ systemId: sysPub, controlRole: row.controlRole });
      eqSystemsByEqId.set(row.equipmentId, list);
    }

    const sysProcessesBySysId = new Map<number, string[]>();
    for (const row of allSysProcesses) {
      const procPub = processPublicIdById.get(row.processId);
      if (!procPub) continue;
      const list = sysProcessesBySysId.get(row.systemId) ?? [];
      list.push(procPub);
      sysProcessesBySysId.set(row.systemId, list);
    }

    const coordinatedBySysId = new Map<number, string[]>();
    for (const link of systemLinks) {
      const targetPub = systemPublicIdById.get(link.targetSystemId);
      if (!targetPub) continue;
      const list = coordinatedBySysId.get(link.sourceSystemId) ?? [];
      list.push(targetPub);
      coordinatedBySysId.set(link.sourceSystemId, list);
    }

    const eqRolesByEqId = new Map<number, EquipmentResourceRoleDto[]>();
    for (const row of allEqRoles) {
      const list = eqRolesByEqId.get(row.equipmentId) ?? [];
      list.push({
        resourceId: row.resourcePublicId,
        resourceCode: row.resourceCode ?? "",
        resourceName: row.resourceName,
        role: row.role,
        isPrimary: row.isPrimary === 1,
        active: row.resourceActive === 1,
      });
      eqRolesByEqId.set(row.equipmentId, list);
    }

    const sysRolesBySysId = new Map<number, SystemResourceRoleDto[]>();
    for (const row of allSysRoles) {
      const list = sysRolesBySysId.get(row.systemId) ?? [];
      list.push({
        resourceId: row.resourcePublicId,
        resourceCode: row.resourceCode ?? "",
        resourceName: row.resourceName,
        role: row.role,
        isPrimary: row.isPrimary === 1,
        active: row.resourceActive === 1,
      });
      sysRolesBySysId.set(row.systemId, list);
    }

    const processDtos: ProcessDto[] = processes.map((p) => ({
      id: p.publicId,
      code: p.code,
      name: p.name,
      parentProcessId: p.parentId !== null ? (processPublicIdById.get(p.parentId) ?? null) : null,
      sortOrder: p.sortOrder,
      active: p.active === 1,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    const equipmentDtos: EquipmentDto[] = equipment.map((e) => ({
      id: e.publicId,
      processId: processPublicIdById.get(e.processId) ?? "",
      code: e.code,
      name: e.name,
      equipmentType: e.equipmentType,
      managementUnit: e.managementUnit,
      quantity: e.quantity,
      manufacturer: e.manufacturer,
      model: e.model,
      description: e.description,
      active: e.active === 1,
      controlSystems: eqSystemsByEqId.get(e.id) ?? [],
      resourceRoles: eqRolesByEqId.get(e.id) ?? [],
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    const systemDtos: LogisticsSystemDto[] = systems.map((s) => ({
      id: s.publicId,
      code: s.code,
      name: s.name,
      systemType: s.systemType,
      layer: s.layer,
      scope: s.scope,
      processIds: sysProcessesBySysId.get(s.id) ?? [],
      coordinatedSystemIds: coordinatedBySysId.get(s.id) ?? [],
      resourceRoles: sysRolesBySysId.get(s.id) ?? [],
      vendor: s.vendor,
      description: s.description,
      active: s.active === 1,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    const systemLinkDtos: SystemLinkDto[] = systemLinks.map((link) => ({
      sourceSystemId: systemPublicIdById.get(link.sourceSystemId) ?? "",
      targetSystemId: systemPublicIdById.get(link.targetSystemId) ?? "",
      relationType: "coordinates",
    }));

    return {
      processes: processDtos,
      equipment: equipmentDtos,
      systems: systemDtos,
      systemLinks: systemLinkDtos,
    };
  }

  getProjectDto(projectId: number): ProjectDto {
    const project = this.projectRepo.findById(projectId);
    if (!project) throw new Error("Project not found.");
    const ownerName = this.ownerRepo.findById(projectId) ?? null;
    return {
      publicId: project.publicId,
      name: project.name,
      description: project.description,
      status: project.status,
      ownerName,
      revision: project.revision,
      calendar: projectCalendarDto(this.database, projectId),
    };
  }

  // --- Auth Verification Helper ---

  private verifyEditAccess(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    now: Date,
  ): ReturnType<ProjectRepository["findCredentialById"]> {
    const project = this.projectRepo.findCredentialById(authorization.projectId);
    const session = this.sessionRepo.findById(authorization.sessionId);

    if (!validSession(session, project, authorization, now)) {
      throw new EditSessionInvalidError();
    }
    if (!project || project.revision !== expectedRevision) {
      throw new RevisionMismatchError();
    }
    return project;
  }

  private buildMutationResponse(
    projectId: number,
    operation: LogisticsMutationResponse["data"]["operation"],
  ): LogisticsMutationResponse {
    return {
      data: {
        project: this.getProjectDto(projectId),
        logistics: this.getLogisticsDto(projectId),
        permission: "edit",
        operation,
      },
    };
  }

  // --- Process Mutations ---

  createProcess(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CreateProcessRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      // Check unique code
      if (this.logisticsRepo.findProcessByCode(projectId, input.code)) {
        throw new LogisticsConflictError("PROCESS_CODE_ALREADY_EXISTS", `Process code '${input.code}' already exists.`);
      }

      // Check parentProcessId if specified
      let parentId: number | null = null;
      if (input.parentProcessId) {
        const parent = this.logisticsRepo.findProcessByPublicId(projectId, input.parentProcessId);
        if (!parent) {
          throw new LogisticsEntityNotFoundError("Process", input.parentProcessId);
        }
        parentId = parent.id;
      }

      const publicId = this.generatePublicId();
      const inserted = this.logisticsRepo.insertProcess({
        publicId,
        projectId,
        code: input.code,
        name: input.name,
        parentId,
        sortOrder: input.sortOrder,
        active: input.active !== undefined ? (input.active ? 1 : 0) : 1,
        now: nowText,
      });

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "process",
        action: "create",
        targetPublicId: inserted.publicId,
      });
    });

    return transaction.immediate();
  }

  updateProcess(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    processPublicId: string,
    input: UpdateProcessRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const current = this.logisticsRepo.findProcessByPublicId(projectId, processPublicId);
      if (!current) {
        throw new LogisticsEntityNotFoundError("Process", processPublicId);
      }

      // Check unique code if changed
      if (input.code && input.code !== current.code) {
        const existing = this.logisticsRepo.findProcessByCode(projectId, input.code);
        if (existing && existing.id !== current.id) {
          throw new LogisticsConflictError("PROCESS_CODE_ALREADY_EXISTS", `Process code '${input.code}' already exists.`);
        }
      }

      // Check parentId if changed
      let parentId: number | null | undefined = undefined;
      if (input.parentProcessId !== undefined) {
        if (input.parentProcessId === null) {
          parentId = null;
        } else {
          if (input.parentProcessId === processPublicId) {
            throw new LogisticsConflictError("PROCESS_CANNOT_BE_PARENT_OF_SELF", "A process cannot be its own parent.");
          }
          const parent = this.logisticsRepo.findProcessByPublicId(projectId, input.parentProcessId);
          if (!parent) {
            throw new LogisticsEntityNotFoundError("Process", input.parentProcessId);
          }
          // Prevent cycle: parent cannot be a descendant of current
          if (this.isDescendantProcess(projectId, parent.id, current.id)) {
            throw new LogisticsConflictError("PROCESS_CYCLE_DETECTED", "Process parent would introduce a cycle in the hierarchy.");
          }
          parentId = parent.id;
        }
      }

      this.logisticsRepo.updateProcess(projectId, current.id, {
        code: input.code,
        name: input.name,
        parentId,
        sortOrder: input.sortOrder,
        active: input.active !== undefined ? (input.active ? 1 : 0) : undefined,
        now: nowText,
      });

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "process",
        action: "update",
        targetPublicId: processPublicId,
      });
    });

    return transaction.immediate();
  }

  deleteProcess(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    processPublicId: string,
    hardDelete: boolean = false,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const current = this.logisticsRepo.findProcessByPublicId(projectId, processPublicId);
      if (!current) {
        throw new LogisticsEntityNotFoundError("Process", processPublicId);
      }

      if (hardDelete) {
        // Check if in use
        const childCount = this.logisticsRepo.countChildProcesses(projectId, current.id);
        if (childCount > 0) {
          throw new LogisticsConflictError("PROCESS_IN_USE", `Cannot permanently delete process with ${childCount} child processes.`);
        }
        const eqCount = this.logisticsRepo.countEquipmentForProcess(projectId, current.id);
        if (eqCount > 0) {
          throw new LogisticsConflictError("PROCESS_IN_USE", `Cannot permanently delete process with ${eqCount} equipment items.`);
        }
        const sysCount = this.logisticsRepo.countSystemProcessesForProcess(projectId, current.id);
        if (sysCount > 0) {
          throw new LogisticsConflictError("PROCESS_IN_USE", `Cannot permanently delete process linked to ${sysCount} systems.`);
        }

        this.logisticsRepo.deleteProcess(projectId, current.id);
      } else {
        // Soft delete: active = 0
        this.logisticsRepo.updateProcess(projectId, current.id, {
          active: 0,
          now: nowText,
        });
      }

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "process",
        action: "delete",
        targetPublicId: processPublicId,
      });
    });

    return transaction.immediate();
  }

  private isDescendantProcess(projectId: number, candidateChildId: number, ancestorId: number): boolean {
    let currentId: number | null = candidateChildId;
    const visited = new Set<number>();

    while (currentId !== null) {
      if (currentId === ancestorId) return true;
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const proc = this.logisticsRepo.findProcessById(projectId, currentId);
      currentId = proc ? proc.parentId : null;
    }
    return false;
  }

  // --- Equipment Mutations ---

  createEquipment(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CreateEquipmentRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const process = this.logisticsRepo.findProcessByPublicId(projectId, input.processId);
      if (!process) {
        throw new LogisticsEntityNotFoundError("Process", input.processId);
      }

      if (this.logisticsRepo.findEquipmentByCode(projectId, input.code)) {
        throw new LogisticsConflictError("EQUIPMENT_CODE_ALREADY_EXISTS", `Equipment code '${input.code}' already exists.`);
      }

      if (input.managementUnit === "unit" && input.quantity !== 1) {
        throw new LogisticsValidationError(["Quantity must be 1 for unit management type."]);
      }

      const publicId = this.generatePublicId();
      const inserted = this.logisticsRepo.insertEquipment({
        publicId,
        projectId,
        processId: process.id,
        code: input.code,
        name: input.name,
        equipmentType: input.equipmentType,
        managementUnit: input.managementUnit,
        quantity: input.quantity ?? 1,
        manufacturer: input.manufacturer,
        model: input.model,
        description: input.description,
        active: input.active !== undefined ? (input.active ? 1 : 0) : 1,
        now: nowText,
      });

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "equipment",
        action: "create",
        targetPublicId: inserted.publicId,
      });
    });

    return transaction.immediate();
  }

  updateEquipment(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    equipmentPublicId: string,
    input: UpdateEquipmentRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const current = this.logisticsRepo.findEquipmentByPublicId(projectId, equipmentPublicId);
      if (!current) {
        throw new LogisticsEntityNotFoundError("Equipment", equipmentPublicId);
      }

      if (input.code && input.code !== current.code) {
        const existing = this.logisticsRepo.findEquipmentByCode(projectId, input.code);
        if (existing && existing.id !== current.id) {
          throw new LogisticsConflictError("EQUIPMENT_CODE_ALREADY_EXISTS", `Equipment code '${input.code}' already exists.`);
        }
      }

      let processId: number | undefined = undefined;
      if (input.processId !== undefined) {
        const proc = this.logisticsRepo.findProcessByPublicId(projectId, input.processId);
        if (!proc) {
          throw new LogisticsEntityNotFoundError("Process", input.processId);
        }
        processId = proc.id;
      }

      const mUnit = input.managementUnit ?? current.managementUnit;
      const qty = input.quantity ?? current.quantity;
      if (mUnit === "unit" && qty !== 1) {
        throw new LogisticsValidationError(["Quantity must be 1 for unit management type."]);
      }

      this.logisticsRepo.updateEquipment(projectId, current.id, {
        processId,
        code: input.code,
        name: input.name,
        equipmentType: input.equipmentType,
        managementUnit: input.managementUnit,
        quantity: input.quantity,
        manufacturer: input.manufacturer,
        model: input.model,
        description: input.description,
        active: input.active !== undefined ? (input.active ? 1 : 0) : undefined,
        now: nowText,
      });

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "equipment",
        action: "update",
        targetPublicId: equipmentPublicId,
      });
    });

    return transaction.immediate();
  }

  deleteEquipment(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    equipmentPublicId: string,
    hardDelete: boolean = false,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const current = this.logisticsRepo.findEquipmentByPublicId(projectId, equipmentPublicId);
      if (!current) {
        throw new LogisticsEntityNotFoundError("Equipment", equipmentPublicId);
      }

      if (hardDelete) {
        const systemMappings = this.logisticsRepo.listEquipmentSystems(projectId, current.id).length;
        const resourceRoles = this.logisticsRepo.listEquipmentResourceRoles(projectId, current.id).length;
        if (systemMappings > 0 || resourceRoles > 0) {
          throw new LogisticsConflictError("EQUIPMENT_IN_USE", `Cannot permanently delete equipment with ${systemMappings} system mapping(s) and ${resourceRoles} resource role(s).`);
        }
        this.logisticsRepo.deleteEquipment(projectId, current.id);
      } else {
        this.logisticsRepo.updateEquipment(projectId, current.id, {
          active: 0,
          now: nowText,
        });
      }

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "equipment",
        action: "delete",
        targetPublicId: equipmentPublicId,
      });
    });

    return transaction.immediate();
  }

  setEquipmentSystems(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    equipmentPublicId: string,
    input: SetEquipmentSystemsRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const current = this.logisticsRepo.findEquipmentByPublicId(projectId, equipmentPublicId);
      if (!current) {
        throw new LogisticsEntityNotFoundError("Equipment", equipmentPublicId);
      }

      const mapped: { systemId: number; controlRole: ControlRole }[] = [];
      let primaryCount = 0;

      for (const item of input.systems) {
        const sys = this.logisticsRepo.findSystemByPublicId(projectId, item.systemId);
        if (!sys) {
          throw new LogisticsEntityNotFoundError("LogisticsSystem", item.systemId);
        }
        // Constraint: only controller layer systems can directly control equipment!
        if (sys.layer !== "controller") {
          throw new LogisticsConflictError(
            "COORDINATOR_CANNOT_DIRECTLY_CONTROL_EQUIPMENT",
            `System '${sys.code}' has layer '${sys.layer}'. Only controller systems can directly control equipment.`,
          );
        }
        if (item.controlRole === "primary") {
          primaryCount += 1;
        }
        mapped.push({ systemId: sys.id, controlRole: item.controlRole });
      }

      if (primaryCount > 1) {
        throw new LogisticsConflictError("MULTIPLE_PRIMARY_SYSTEMS", "An equipment can have at most one primary control system.");
      }

      this.logisticsRepo.setEquipmentSystems(projectId, current.id, mapped, nowText);
      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "equipmentSystems",
        action: "replace",
        targetPublicId: equipmentPublicId,
      });
    });

    return transaction.immediate();
  }

  // --- Logistics Systems Mutations ---

  createSystem(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CreateLogisticsSystemRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      if (this.logisticsRepo.findSystemByCode(projectId, input.code)) {
        throw new LogisticsConflictError("SYSTEM_CODE_ALREADY_EXISTS", `System code '${input.code}' already exists.`);
      }

      const requestedProcessIds = input.processIds ?? [];
      if (input.scope === "project" && requestedProcessIds.length > 0) {
        throw new LogisticsConflictError("SYSTEM_SCOPE_PROCESS_MAPPING_MISMATCH", "Project-scoped systems cannot have process mappings.");
      }
      if (input.scope === "processes" && requestedProcessIds.length === 0) {
        throw new LogisticsConflictError("SYSTEM_PROCESSES_REQUIRED", "Process-scoped systems must have at least one process mapping.");
      }

      const publicId = this.generatePublicId();
      const inserted = this.logisticsRepo.insertSystem({
        publicId,
        projectId,
        code: input.code,
        name: input.name,
        systemType: input.systemType,
        layer: input.layer,
        scope: input.scope,
        vendor: input.vendor,
        description: input.description,
        active: input.active !== undefined ? (input.active ? 1 : 0) : 1,
        now: nowText,
      });

      if (requestedProcessIds.length > 0) {
        const processIds: number[] = [];
        for (const pPub of requestedProcessIds) {
          const proc = this.logisticsRepo.findProcessByPublicId(projectId, pPub);
          if (!proc) {
            throw new LogisticsEntityNotFoundError("Process", pPub);
          }
          processIds.push(proc.id);
        }
        this.logisticsRepo.setSystemProcesses(projectId, inserted.id, processIds, nowText);
      }

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "system",
        action: "create",
        targetPublicId: inserted.publicId,
      });
    });

    return transaction.immediate();
  }

  updateSystem(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    systemPublicId: string,
    input: UpdateLogisticsSystemRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const current = this.logisticsRepo.findSystemByPublicId(projectId, systemPublicId);
      if (!current) {
        throw new LogisticsEntityNotFoundError("LogisticsSystem", systemPublicId);
      }

      if (input.code && input.code !== current.code) {
        const existing = this.logisticsRepo.findSystemByCode(projectId, input.code);
        if (existing && existing.id !== current.id) {
          throw new LogisticsConflictError("SYSTEM_CODE_ALREADY_EXISTS", `System code '${input.code}' already exists.`);
        }
      }

      // If layer changed from controller to coordinator, make sure it does not control equipment
      if (input.layer === "coordinator" && current.layer !== "coordinator") {
        const controllingCount = this.logisticsRepo.countControllingEquipment(projectId, current.id);
        if (controllingCount > 0) {
          throw new LogisticsConflictError(
            "CANNOT_CHANGE_LAYER_WHILE_CONTROLLING_EQUIPMENT",
            `System controls ${controllingCount} equipment. Cannot change layer to coordinator.`,
          );
        }
      }

      // If layer changed from coordinator to controller, make sure it does not coordinate other systems
      if (input.layer === "controller" && current.layer !== "controller") {
        const coordinatingCount = this.logisticsRepo.countCoordinatedTargets(projectId, current.id);
        if (coordinatingCount > 0) {
          throw new LogisticsConflictError(
            "CANNOT_CHANGE_LAYER_WHILE_COORDINATING_SYSTEMS",
            `System coordinates ${coordinatingCount} other systems. Cannot change layer to controller.`,
          );
        }
      }

      const existingProcessIds = this.logisticsRepo.listSystemProcesses(projectId, current.id);
      const finalScope = input.scope ?? current.scope;
      let finalProcessIds = existingProcessIds;
      if (input.processIds !== undefined) {
        const resolved: number[] = [];
        const seenProcessIds = new Set<number>();
        for (const pPub of input.processIds) {
          const proc = this.logisticsRepo.findProcessByPublicId(projectId, pPub);
          if (!proc) throw new LogisticsEntityNotFoundError("Process", pPub);
          if (!seenProcessIds.has(proc.id)) {
            seenProcessIds.add(proc.id);
            resolved.push(proc.id);
          }
        }
        finalProcessIds = resolved;
      }
      if (finalScope === "project") {
        if (input.processIds !== undefined && finalProcessIds.length > 0) {
          throw new LogisticsConflictError("SYSTEM_SCOPE_PROCESS_MAPPING_MISMATCH", "Project-scoped systems cannot have process mappings.");
        }
        finalProcessIds = [];
      } else if (finalProcessIds.length === 0) {
        throw new LogisticsConflictError("SYSTEM_PROCESSES_REQUIRED", "Process-scoped systems must have at least one process mapping.");
      }

      this.logisticsRepo.updateSystem(projectId, current.id, {
        code: input.code,
        name: input.name,
        systemType: input.systemType,
        layer: input.layer,
        scope: input.scope,
        vendor: input.vendor,
        description: input.description,
        active: input.active !== undefined ? (input.active ? 1 : 0) : undefined,
        now: nowText,
      });
      this.logisticsRepo.setSystemProcesses(projectId, current.id, finalProcessIds, nowText);

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "system",
        action: "update",
        targetPublicId: systemPublicId,
      });
    });

    return transaction.immediate();
  }

  deleteSystem(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    systemPublicId: string,
    hardDelete: boolean = false,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const current = this.logisticsRepo.findSystemByPublicId(projectId, systemPublicId);
      if (!current) {
        throw new LogisticsEntityNotFoundError("LogisticsSystem", systemPublicId);
      }

      if (hardDelete) {
        const controllingCount = this.logisticsRepo.countControllingEquipment(projectId, current.id);
        if (controllingCount > 0) {
          throw new LogisticsConflictError("SYSTEM_IN_USE", `Cannot permanently delete system controlling ${controllingCount} equipment.`);
        }
        const coordinatingSources = this.logisticsRepo.countCoordinatingSources(projectId, current.id);
        if (coordinatingSources > 0) {
          throw new LogisticsConflictError("SYSTEM_IN_USE", `Cannot permanently delete system coordinated by ${coordinatingSources} coordinators.`);
        }
        const coordinatedTargets = this.logisticsRepo.countCoordinatedTargets(projectId, current.id);
        if (coordinatedTargets > 0) {
          throw new LogisticsConflictError("SYSTEM_IN_USE", `Cannot permanently delete coordinator with ${coordinatedTargets} coordinated systems.`);
        }
        const processMappings = this.logisticsRepo.listSystemProcesses(projectId, current.id).length;
        const resourceRoles = this.logisticsRepo.listSystemResourceRoles(projectId, current.id).length;
        if (processMappings > 0 || resourceRoles > 0) {
          throw new LogisticsConflictError("SYSTEM_IN_USE", `Cannot permanently delete system with ${processMappings} process mapping(s) and ${resourceRoles} resource role(s).`);
        }

        this.logisticsRepo.deleteSystem(projectId, current.id);
      } else {
        this.logisticsRepo.updateSystem(projectId, current.id, {
          active: 0,
          now: nowText,
        });
      }

      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "system",
        action: "delete",
        targetPublicId: systemPublicId,
      });
    });

    return transaction.immediate();
  }

  setSystemProcesses(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    systemPublicId: string,
    input: SetSystemProcessesRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const current = this.logisticsRepo.findSystemByPublicId(projectId, systemPublicId);
      if (!current) {
        throw new LogisticsEntityNotFoundError("LogisticsSystem", systemPublicId);
      }
      if (current.scope !== "processes") {
        throw new LogisticsConflictError("SYSTEM_SCOPE_PROCESS_MAPPING_MISMATCH", "Only process-scoped systems can have process mappings.");
      }
      if (input.processIds.length === 0) {
        throw new LogisticsConflictError("SYSTEM_PROCESSES_REQUIRED", "Process-scoped systems must have at least one process mapping.");
      }

      const processIds: number[] = [];
      for (const pPub of input.processIds) {
        const proc = this.logisticsRepo.findProcessByPublicId(projectId, pPub);
        if (!proc) {
          throw new LogisticsEntityNotFoundError("Process", pPub);
        }
        processIds.push(proc.id);
      }

      this.logisticsRepo.setSystemProcesses(projectId, current.id, processIds, nowText);
      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "systemProcesses",
        action: "replace",
        targetPublicId: systemPublicId,
      });
    });

    return transaction.immediate();
  }

  setCoordinatedSystems(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    coordinatorPublicId: string,
    input: SetSystemChildrenRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const coordinator = this.logisticsRepo.findSystemByPublicId(projectId, coordinatorPublicId);
      if (!coordinator) {
        throw new LogisticsEntityNotFoundError("LogisticsSystem", coordinatorPublicId);
      }

      if (coordinator.layer !== "coordinator") {
        throw new LogisticsConflictError(
          "CONTROLLER_CANNOT_COORDINATE",
          `System '${coordinator.code}' has layer '${coordinator.layer}'. Only coordinator layer systems can coordinate other systems.`,
        );
      }

      const targetIds: number[] = [];
      const seen = new Set<string>();

      const requestedChildSystemIds = input.childSystemIds ?? input.targetSystemIds ?? [];
      for (const tPub of requestedChildSystemIds) {
        if (tPub === coordinatorPublicId) {
          throw new LogisticsConflictError("COORDINATOR_CANNOT_COORDINATE_SELF", "A coordinator cannot coordinate itself.");
        }
        if (seen.has(tPub)) continue;
        seen.add(tPub);

        const target = this.logisticsRepo.findSystemByPublicId(projectId, tPub);
        if (!target) {
          throw new LogisticsEntityNotFoundError("LogisticsSystem", tPub);
        }
        targetIds.push(target.id);
      }

      // Check cycle: none of targetIds can reach coordinator in the existing graph (excluding current edges)
      for (const targetId of targetIds) {
        if (this.canReachSystem(projectId, targetId, coordinator.id, coordinator.id)) {
          throw new LogisticsConflictError(
            "SYSTEM_COORDINATION_CYCLE_DETECTED",
            "Coordinating this system would introduce a cycle into the coordination hierarchy.",
          );
        }
      }

      this.logisticsRepo.setCoordinatedSystems(projectId, coordinator.id, targetIds, nowText);
      const updatedProject = this.projectRepo.advanceRevision(projectId, expectedRevision, nowText);
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "systemChildren",
        action: "replace",
        targetPublicId: coordinatorPublicId,
      });
    });

    return transaction.immediate();
  }

  private canReachSystem(
    projectId: number,
    sourceId: number,
    targetId: number,
    skipSourceId?: number,
  ): boolean {
    const queue: number[] = [sourceId];
    const visited = new Set<number>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      if (current === skipSourceId) continue;

      const children = this.logisticsRepo.listCoordinatedSystems(projectId, current);
      for (const childId of children) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }

    return false;
  }

  setEquipmentResourceRoles(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    equipmentPublicId: string,
    request: SetEquipmentResourceRolesRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const equipment = this.logisticsRepo.findEquipmentByPublicId(
        projectId,
        equipmentPublicId,
      );
      if (!equipment) {
        throw new LogisticsEntityNotFoundError("Equipment", equipmentPublicId);
      }

      const currentRoles = this.logisticsRepo.listEquipmentResourceRoles(
        projectId,
        equipment.id,
      );
      const currentAssignedPairs = new Set(
        currentRoles.map((r) => `${r.resourcePublicId}:${r.role}`),
      );

      const rolesToInsert: Array<{
        resourceId: number;
        role: EquipmentRole;
        isPrimary: number;
      }> = [];
      const seenPair = new Set<string>();
      let primaryCount = 0;

      for (const item of request.roles) {
        const pairKey = `${item.resourceId}:${item.role}`;
        if (seenPair.has(pairKey)) {
          throw new LogisticsValidationError([
            `Duplicate resource and role pair: ${pairKey}`,
          ]);
        }
        seenPair.add(pairKey);

        const resource = this.resourceCatalogRepo.findResourceByPublicId(
          item.resourceId,
        );
        if (!resource) {
          throw new LogisticsValidationError([
            `Resource not found: ${item.resourceId}`,
          ]);
        }

        if (!resource.active && !currentAssignedPairs.has(pairKey)) {
          throw new LogisticsConflictError(
            "RESOURCE_INACTIVE",
            `Cannot newly assign inactive resource '${resource.name}' (${resource.publicId}).`,
          );
        }

        const isPrimary = item.isPrimary ? 1 : 0;
        if (isPrimary) {
          if (item.role !== "owner") {
            throw new LogisticsValidationError([
              "Only owner role can be designated as primary.",
            ]);
          }
          primaryCount++;
        }

        rolesToInsert.push({
          resourceId: resource.id,
          role: item.role,
          isPrimary,
        });
      }

      if (primaryCount > 1) {
        throw new LogisticsValidationError([
          "At most one primary owner can be designated per equipment.",
        ]);
      }

      this.logisticsRepo.replaceEquipmentResourceRoles(
        projectId,
        equipment.id,
        rolesToInsert,
        nowText,
      );

      const updatedProject = this.projectRepo.advanceRevision(
        projectId,
        expectedRevision,
        nowText,
      );
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "equipmentResourceRoles",
        action: "replace",
        targetPublicId: equipmentPublicId,
      });
    });

    return transaction.immediate();
  }

  setSystemResourceRoles(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    systemPublicId: string,
    request: SetSystemResourceRolesRequest,
  ): LogisticsMutationResponse {
    const now = this.clock();
    const nowText = now.toISOString();

    const transaction = this.database.transaction(() => {
      this.verifyEditAccess(authorization, expectedRevision, now);
      const projectId = authorization.projectId;

      const system = this.logisticsRepo.findSystemByPublicId(
        projectId,
        systemPublicId,
      );
      if (!system) {
        throw new LogisticsEntityNotFoundError("System", systemPublicId);
      }

      const currentRoles = this.logisticsRepo.listSystemResourceRoles(
        projectId,
        system.id,
      );
      const currentAssignedPairs = new Set(
        currentRoles.map((r) => `${r.resourcePublicId}:${r.role}`),
      );

      const rolesToInsert: Array<{
        resourceId: number;
        role: SystemRole;
        isPrimary: number;
      }> = [];
      const seenPair = new Set<string>();
      let primaryCount = 0;

      for (const item of request.roles) {
        const pairKey = `${item.resourceId}:${item.role}`;
        if (seenPair.has(pairKey)) {
          throw new LogisticsValidationError([
            `Duplicate resource and role pair: ${pairKey}`,
          ]);
        }
        seenPair.add(pairKey);

        const resource = this.resourceCatalogRepo.findResourceByPublicId(
          item.resourceId,
        );
        if (!resource) {
          throw new LogisticsValidationError([
            `Resource not found: ${item.resourceId}`,
          ]);
        }

        if (!resource.active && !currentAssignedPairs.has(pairKey)) {
          throw new LogisticsConflictError(
            "RESOURCE_INACTIVE",
            `Cannot newly assign inactive resource '${resource.name}' (${resource.publicId}).`,
          );
        }

        const isPrimary = item.isPrimary ? 1 : 0;
        if (isPrimary) {
          if (item.role !== "pi") {
            throw new LogisticsValidationError([
              "Only PI role can be designated as primary.",
            ]);
          }
          primaryCount++;
        }

        rolesToInsert.push({
          resourceId: resource.id,
          role: item.role,
          isPrimary,
        });
      }

      if (primaryCount > 1) {
        throw new LogisticsValidationError([
          "At most one primary PI can be designated per system.",
        ]);
      }

      this.logisticsRepo.replaceSystemResourceRoles(
        projectId,
        system.id,
        rolesToInsert,
        nowText,
      );

      const updatedProject = this.projectRepo.advanceRevision(
        projectId,
        expectedRevision,
        nowText,
      );
      if (!updatedProject) {
        throw new RevisionMismatchError();
      }

      return this.buildMutationResponse(projectId, {
        kind: "logisticsMutation",
        entity: "systemResourceRoles",
        action: "replace",
        targetPublicId: systemPublicId,
      });
    });

    return transaction.immediate();
  }
}
