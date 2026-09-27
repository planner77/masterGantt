import type Database from "better-sqlite3";
import type {
  ControlRole,
  EquipmentRole,
  EquipmentType,
  LogisticsSystemType,
  ManagementUnit,
  SystemLayer,
  SystemRole,
  SystemScope,
  TaskLogisticsLinkScope,
} from "../../contracts/logistics";

export interface ProcessRecord {
  id: number;
  publicId: string;
  projectId: number;
  code: string;
  name: string;
  parentId: number | null;
  sortOrder: number;
  active: number;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentRecord {
  id: number;
  publicId: string;
  projectId: number;
  processId: number;
  code: string;
  name: string;
  equipmentType: EquipmentType;
  managementUnit: ManagementUnit;
  quantity: number;
  manufacturer: string;
  model: string;
  description: string;
  active: number;
  createdAt: string;
  updatedAt: string;
}

export interface LogisticsSystemRecord {
  id: number;
  publicId: string;
  projectId: number;
  code: string;
  name: string;
  systemType: LogisticsSystemType;
  layer: SystemLayer;
  scope: SystemScope;
  vendor: string;
  description: string;
  active: number;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentSystemRecord {
  equipmentId: number;
  systemId: number;
  controlRole: ControlRole;
}

export interface EquipmentResourceRoleRecord {
  id: number;
  projectId: number;
  equipmentId: number;
  resourceId: number;
  role: EquipmentRole;
  isPrimary: number; // 0 | 1
  createdAt: string;
  updatedAt: string;
  resourcePublicId: string;
  resourceCode: string;
  resourceName: string;
  resourceActive: number;
}

export interface SystemResourceRoleRecord {
  id: number;
  projectId: number;
  systemId: number;
  resourceId: number;
  role: SystemRole;
  isPrimary: number; // 0 | 1
  createdAt: string;
  updatedAt: string;
  resourcePublicId: string;
  resourceCode: string;
  resourceName: string;
  resourceActive: number;
}

export interface SystemLinkRecord {
  sourceSystemId: number;
  targetSystemId: number;
  relationType: "coordinates";
}

export interface TaskEquipmentLinkRecord {
  id: number;
  projectId: number;
  taskId: number;
  equipmentId: number;
  scope: TaskLogisticsLinkScope;
  createdAt: string;
  updatedAt: string;
  taskPublicId: string;
  taskName: string;
  taskType: string;
  equipmentPublicId: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentType: EquipmentType;
  equipmentActive: number;
}

export interface TaskSystemLinkRecord {
  id: number;
  projectId: number;
  taskId: number;
  systemId: number;
  scope: TaskLogisticsLinkScope;
  createdAt: string;
  updatedAt: string;
  taskPublicId: string;
  taskName: string;
  taskType: string;
  systemPublicId: string;
  systemCode: string;
  systemName: string;
  systemType: LogisticsSystemType;
  systemActive: number;
}

export interface InsertProcessRecord {
  publicId: string;
  projectId: number;
  code: string;
  name: string;
  parentId: number | null;
  sortOrder?: number;
  active?: number;
  now: string;
}

export interface UpdateProcessRecord {
  code?: string;
  name?: string;
  parentId?: number | null;
  sortOrder?: number;
  active?: number;
  now: string;
}

export interface InsertEquipmentRecord {
  publicId: string;
  projectId: number;
  processId: number;
  code: string;
  name: string;
  equipmentType: EquipmentType;
  managementUnit: ManagementUnit;
  quantity: number;
  manufacturer?: string;
  model?: string;
  description?: string;
  active?: number;
  now: string;
}

export interface UpdateEquipmentRecord {
  processId?: number;
  code?: string;
  name?: string;
  equipmentType?: EquipmentType;
  managementUnit?: ManagementUnit;
  quantity?: number;
  manufacturer?: string;
  model?: string;
  description?: string;
  active?: number;
  now: string;
}

export interface InsertSystemRecord {
  publicId: string;
  projectId: number;
  code: string;
  name: string;
  systemType: LogisticsSystemType;
  layer: SystemLayer;
  scope: SystemScope;
  vendor?: string;
  description?: string;
  active?: number;
  now: string;
}

export interface UpdateSystemRecord {
  code?: string;
  name?: string;
  systemType?: LogisticsSystemType;
  layer?: SystemLayer;
  scope?: SystemScope;
  vendor?: string;
  description?: string;
  active?: number;
  now: string;
}

export class LogisticsRepository {
  constructor(private readonly database: Database.Database) {}

  hasLogisticsData(projectId: number): boolean {
    const row = this.database
      .prepare(
        `
          SELECT 1 FROM project_processes WHERE project_id = ?
          UNION
          SELECT 1 FROM project_equipment WHERE project_id = ?
          UNION
          SELECT 1 FROM project_logistics_systems WHERE project_id = ?
          LIMIT 1
        `,
      )
      .get(projectId, projectId, projectId);
    return row !== undefined;
  }

  // --- Processes ---

  listProcesses(projectId: number): ProcessRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            id, public_id AS publicId, project_id AS projectId,
            code, name, parent_id AS parentId, sort_order AS sortOrder,
            active, created_at AS createdAt, updated_at AS updatedAt
          FROM project_processes
          WHERE project_id = ?
          ORDER BY sort_order ASC, id ASC
        `,
      )
      .all(projectId) as ProcessRecord[];
  }

  findProcessById(projectId: number, id: number): ProcessRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              code, name, parent_id AS parentId, sort_order AS sortOrder,
              active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_processes
            WHERE project_id = ? AND id = ?
          `,
        )
        .get(projectId, id) as ProcessRecord | undefined) ?? undefined
    );
  }

  findProcessByPublicId(
    projectId: number,
    publicId: string,
  ): ProcessRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              code, name, parent_id AS parentId, sort_order AS sortOrder,
              active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_processes
            WHERE project_id = ? AND public_id = ?
          `,
        )
        .get(projectId, publicId) as ProcessRecord | undefined) ?? undefined
    );
  }

  findProcessByCode(
    projectId: number,
    code: string,
  ): ProcessRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              code, name, parent_id AS parentId, sort_order AS sortOrder,
              active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_processes
            WHERE project_id = ? AND code = ?
          `,
        )
        .get(projectId, code) as ProcessRecord | undefined) ?? undefined
    );
  }

  insertProcess(record: InsertProcessRecord): ProcessRecord {
    const result = this.database
      .prepare(
        `
          INSERT INTO project_processes (
            public_id, project_id, code, name, parent_id, sort_order, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        record.publicId,
        record.projectId,
        record.code,
        record.name,
        record.parentId,
        record.sortOrder ?? 0,
        record.active ?? 1,
        record.now,
        record.now,
      );

    return this.findProcessById(record.projectId, Number(result.lastInsertRowid))!;
  }

  updateProcess(
    projectId: number,
    id: number,
    updates: UpdateProcessRecord,
  ): ProcessRecord | undefined {
    const current = this.findProcessById(projectId, id);
    if (!current) return undefined;

    const code = updates.code ?? current.code;
    const name = updates.name ?? current.name;
    const parentId =
      updates.parentId !== undefined ? updates.parentId : current.parentId;
    const sortOrder =
      updates.sortOrder !== undefined ? updates.sortOrder : current.sortOrder;
    const active =
      updates.active !== undefined ? updates.active : current.active;

    this.database
      .prepare(
        `
          UPDATE project_processes
          SET code = ?, name = ?, parent_id = ?, sort_order = ?, active = ?, updated_at = ?
          WHERE project_id = ? AND id = ?
        `,
      )
      .run(code, name, parentId, sortOrder, active, updates.now, projectId, id);

    return this.findProcessById(projectId, id);
  }

  deleteProcess(projectId: number, id: number): boolean {
    const result = this.database
      .prepare(
        `
          DELETE FROM project_processes
          WHERE project_id = ? AND id = ?
        `,
      )
      .run(projectId, id);
    return result.changes > 0;
  }

  countChildProcesses(projectId: number, processId: number): number {
    const row = this.database
      .prepare(
        `
          SELECT count(*) AS count
          FROM project_processes
          WHERE project_id = ? AND parent_id = ?
        `,
      )
      .get(projectId, processId) as { count: number };
    return row.count;
  }

  countEquipmentForProcess(projectId: number, processId: number): number {
    const row = this.database
      .prepare(
        `
          SELECT count(*) AS count
          FROM project_equipment
          WHERE project_id = ? AND process_id = ?
        `,
      )
      .get(projectId, processId) as { count: number };
    return row.count;
  }

  countSystemProcessesForProcess(projectId: number, processId: number): number {
    const row = this.database
      .prepare(
        `
          SELECT count(*) AS count
          FROM project_system_processes
          WHERE project_id = ? AND process_id = ?
        `,
      )
      .get(projectId, processId) as { count: number };
    return row.count;
  }

  // --- Equipment ---

  listEquipment(projectId: number): EquipmentRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            id, public_id AS publicId, project_id AS projectId,
            process_id AS processId, code, name, equipment_type AS equipmentType,
            management_unit AS managementUnit, quantity, manufacturer,
            model, description, active, created_at AS createdAt, updated_at AS updatedAt
          FROM project_equipment
          WHERE project_id = ?
          ORDER BY id ASC
        `,
      )
      .all(projectId) as EquipmentRecord[];
  }

  findEquipmentById(projectId: number, id: number): EquipmentRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              process_id AS processId, code, name, equipment_type AS equipmentType,
              management_unit AS managementUnit, quantity, manufacturer,
              model, description, active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_equipment
            WHERE project_id = ? AND id = ?
          `,
        )
        .get(projectId, id) as EquipmentRecord | undefined) ?? undefined
    );
  }

  findEquipmentByPublicId(
    projectId: number,
    publicId: string,
  ): EquipmentRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              process_id AS processId, code, name, equipment_type AS equipmentType,
              management_unit AS managementUnit, quantity, manufacturer,
              model, description, active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_equipment
            WHERE project_id = ? AND public_id = ?
          `,
        )
        .get(projectId, publicId) as EquipmentRecord | undefined) ?? undefined
    );
  }

  findEquipmentByCode(
    projectId: number,
    code: string,
  ): EquipmentRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              process_id AS processId, code, name, equipment_type AS equipmentType,
              management_unit AS managementUnit, quantity, manufacturer,
              model, description, active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_equipment
            WHERE project_id = ? AND code = ?
          `,
        )
        .get(projectId, code) as EquipmentRecord | undefined) ?? undefined
    );
  }

  insertEquipment(record: InsertEquipmentRecord): EquipmentRecord {
    const result = this.database
      .prepare(
        `
          INSERT INTO project_equipment (
            public_id, project_id, process_id, code, name, equipment_type,
            management_unit, quantity, manufacturer, model, description,
            active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        record.publicId,
        record.projectId,
        record.processId,
        record.code,
        record.name,
        record.equipmentType,
        record.managementUnit,
        record.quantity,
        record.manufacturer ?? "",
        record.model ?? "",
        record.description ?? "",
        record.active ?? 1,
        record.now,
        record.now,
      );

    return this.findEquipmentById(record.projectId, Number(result.lastInsertRowid))!;
  }

  updateEquipment(
    projectId: number,
    id: number,
    updates: UpdateEquipmentRecord,
  ): EquipmentRecord | undefined {
    const current = this.findEquipmentById(projectId, id);
    if (!current) return undefined;

    const processId =
      updates.processId !== undefined ? updates.processId : current.processId;
    const code = updates.code ?? current.code;
    const name = updates.name ?? current.name;
    const equipmentType = updates.equipmentType ?? current.equipmentType;
    const managementUnit = updates.managementUnit ?? current.managementUnit;
    const quantity =
      updates.quantity !== undefined ? updates.quantity : current.quantity;
    const manufacturer =
      updates.manufacturer !== undefined ? updates.manufacturer : current.manufacturer;
    const model = updates.model !== undefined ? updates.model : current.model;
    const description =
      updates.description !== undefined ? updates.description : current.description;
    const active =
      updates.active !== undefined ? updates.active : current.active;

    this.database
      .prepare(
        `
          UPDATE project_equipment
          SET process_id = ?, code = ?, name = ?, equipment_type = ?,
              management_unit = ?, quantity = ?, manufacturer = ?, model = ?,
              description = ?, active = ?, updated_at = ?
          WHERE project_id = ? AND id = ?
        `,
      )
      .run(
        processId,
        code,
        name,
        equipmentType,
        managementUnit,
        quantity,
        manufacturer,
        model,
        description,
        active,
        updates.now,
        projectId,
        id,
      );

    return this.findEquipmentById(projectId, id);
  }

  deleteEquipment(projectId: number, id: number): boolean {
    const result = this.database
      .prepare(
        `
          DELETE FROM project_equipment
          WHERE project_id = ? AND id = ?
        `,
      )
      .run(projectId, id);
    return result.changes > 0;
  }

  listEquipmentSystems(
    projectId: number,
    equipmentId: number,
  ): EquipmentSystemRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            equipment_id AS equipmentId, system_id AS systemId,
            control_role AS controlRole
          FROM project_equipment_systems
          WHERE project_id = ? AND equipment_id = ?
          ORDER BY id ASC
        `,
      )
      .all(projectId, equipmentId) as EquipmentSystemRecord[];
  }

  listAllEquipmentSystems(projectId: number): EquipmentSystemRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            equipment_id AS equipmentId, system_id AS systemId,
            control_role AS controlRole
          FROM project_equipment_systems
          WHERE project_id = ?
          ORDER BY id ASC
        `,
      )
      .all(projectId) as EquipmentSystemRecord[];
  }

  setEquipmentSystems(
    projectId: number,
    equipmentId: number,
    systems: { systemId: number; controlRole: ControlRole }[],
    now: string,
  ): void {
    const deleteStmt = this.database.prepare(
      `DELETE FROM project_equipment_systems WHERE project_id = ? AND equipment_id = ?`,
    );
    const insertStmt = this.database.prepare(
      `
        INSERT INTO project_equipment_systems (
          project_id, equipment_id, system_id, control_role, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
    );

    deleteStmt.run(projectId, equipmentId);
    for (const sys of systems) {
      insertStmt.run(projectId, equipmentId, sys.systemId, sys.controlRole, now);
    }
  }

  // --- Logistics Systems ---

  listSystems(projectId: number): LogisticsSystemRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            id, public_id AS publicId, project_id AS projectId,
            code, name, system_type AS systemType, layer, scope,
            vendor, description, active, created_at AS createdAt, updated_at AS updatedAt
          FROM project_logistics_systems
          WHERE project_id = ?
          ORDER BY id ASC
        `,
      )
      .all(projectId) as LogisticsSystemRecord[];
  }

  findSystemById(
    projectId: number,
    id: number,
  ): LogisticsSystemRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              code, name, system_type AS systemType, layer, scope,
              vendor, description, active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_logistics_systems
            WHERE project_id = ? AND id = ?
          `,
        )
        .get(projectId, id) as LogisticsSystemRecord | undefined) ?? undefined
    );
  }

  findSystemByPublicId(
    projectId: number,
    publicId: string,
  ): LogisticsSystemRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              code, name, system_type AS systemType, layer, scope,
              vendor, description, active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_logistics_systems
            WHERE project_id = ? AND public_id = ?
          `,
        )
        .get(projectId, publicId) as LogisticsSystemRecord | undefined) ?? undefined
    );
  }

  findSystemByCode(
    projectId: number,
    code: string,
  ): LogisticsSystemRecord | undefined {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id, public_id AS publicId, project_id AS projectId,
              code, name, system_type AS systemType, layer, scope,
              vendor, description, active, created_at AS createdAt, updated_at AS updatedAt
            FROM project_logistics_systems
            WHERE project_id = ? AND code = ?
          `,
        )
        .get(projectId, code) as LogisticsSystemRecord | undefined) ?? undefined
    );
  }

  insertSystem(record: InsertSystemRecord): LogisticsSystemRecord {
    const result = this.database
      .prepare(
        `
          INSERT INTO project_logistics_systems (
            public_id, project_id, code, name, system_type, layer,
            scope, vendor, description, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        record.publicId,
        record.projectId,
        record.code,
        record.name,
        record.systemType,
        record.layer,
        record.scope,
        record.vendor ?? "",
        record.description ?? "",
        record.active ?? 1,
        record.now,
        record.now,
      );

    return this.findSystemById(record.projectId, Number(result.lastInsertRowid))!;
  }

  updateSystem(
    projectId: number,
    id: number,
    updates: UpdateSystemRecord,
  ): LogisticsSystemRecord | undefined {
    const current = this.findSystemById(projectId, id);
    if (!current) return undefined;

    const code = updates.code ?? current.code;
    const name = updates.name ?? current.name;
    const systemType = updates.systemType ?? current.systemType;
    const layer = updates.layer ?? current.layer;
    const scope = updates.scope ?? current.scope;
    const vendor = updates.vendor !== undefined ? updates.vendor : current.vendor;
    const description =
      updates.description !== undefined ? updates.description : current.description;
    const active =
      updates.active !== undefined ? updates.active : current.active;

    this.database
      .prepare(
        `
          UPDATE project_logistics_systems
          SET code = ?, name = ?, system_type = ?, layer = ?, scope = ?,
              vendor = ?, description = ?, active = ?, updated_at = ?
          WHERE project_id = ? AND id = ?
        `,
      )
      .run(
        code,
        name,
        systemType,
        layer,
        scope,
        vendor,
        description,
        active,
        updates.now,
        projectId,
        id,
      );

    return this.findSystemById(projectId, id);
  }

  deleteSystem(projectId: number, id: number): boolean {
    const result = this.database
      .prepare(
        `
          DELETE FROM project_logistics_systems
          WHERE project_id = ? AND id = ?
        `,
      )
      .run(projectId, id);
    return result.changes > 0;
  }

  listSystemProcesses(projectId: number, systemId: number): number[] {
    return this.database
      .prepare(
        `
          SELECT process_id AS processId
          FROM project_system_processes
          WHERE project_id = ? AND system_id = ?
          ORDER BY id ASC
        `,
      )
      .pluck()
      .all(projectId, systemId) as number[];
  }

  listAllSystemProcesses(
    projectId: number,
  ): { systemId: number; processId: number }[] {
    return this.database
      .prepare(
        `
          SELECT system_id AS systemId, process_id AS processId
          FROM project_system_processes
          WHERE project_id = ?
          ORDER BY id ASC
        `,
      )
      .all(projectId) as { systemId: number; processId: number }[];
  }

  setSystemProcesses(
    projectId: number,
    systemId: number,
    processIds: number[],
    now: string,
  ): void {
    const deleteStmt = this.database.prepare(
      `DELETE FROM project_system_processes WHERE project_id = ? AND system_id = ?`,
    );
    const insertStmt = this.database.prepare(
      `
        INSERT INTO project_system_processes (
          project_id, system_id, process_id, created_at
        ) VALUES (?, ?, ?, ?)
      `,
    );

    deleteStmt.run(projectId, systemId);
    for (const pid of processIds) {
      insertStmt.run(projectId, systemId, pid, now);
    }
  }

  listSystemLinks(projectId: number): SystemLinkRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            source_system_id AS sourceSystemId,
            target_system_id AS targetSystemId,
            relation_type AS relationType
          FROM project_system_links
          WHERE project_id = ?
          ORDER BY id ASC
        `,
      )
      .all(projectId) as SystemLinkRecord[];
  }

  listCoordinatedSystems(
    projectId: number,
    coordinatorSystemId: number,
  ): number[] {
    return this.database
      .prepare(
        `
          SELECT target_system_id
          FROM project_system_links
          WHERE project_id = ? AND source_system_id = ?
          ORDER BY id ASC
        `,
      )
      .pluck()
      .all(projectId, coordinatorSystemId) as number[];
  }

  setCoordinatedSystems(
    projectId: number,
    coordinatorSystemId: number,
    targetSystemIds: number[],
    now: string,
  ): void {
    const deleteStmt = this.database.prepare(
      `DELETE FROM project_system_links WHERE project_id = ? AND source_system_id = ?`,
    );
    const insertStmt = this.database.prepare(
      `
        INSERT INTO project_system_links (
          project_id, source_system_id, target_system_id, relation_type, created_at
        ) VALUES (?, ?, ?, 'coordinates', ?)
      `,
    );

    deleteStmt.run(projectId, coordinatorSystemId);
    for (const targetId of targetSystemIds) {
      insertStmt.run(projectId, coordinatorSystemId, targetId, now);
    }
  }

  countControllingEquipment(projectId: number, systemId: number): number {
    const row = this.database
      .prepare(
        `
          SELECT count(*) AS count
          FROM project_equipment_systems
          WHERE project_id = ? AND system_id = ?
        `,
      )
      .get(projectId, systemId) as { count: number };
    return row.count;
  }

  countCoordinatingSources(projectId: number, systemId: number): number {
    const row = this.database
      .prepare(
        `
          SELECT count(*) AS count
          FROM project_system_links
          WHERE project_id = ? AND target_system_id = ?
        `,
      )
      .get(projectId, systemId) as { count: number };
    return row.count;
  }

  countCoordinatedTargets(projectId: number, systemId: number): number {
    const row = this.database
      .prepare(
        `
          SELECT count(*) AS count
          FROM project_system_links
          WHERE project_id = ? AND source_system_id = ?
        `,
      )
      .get(projectId, systemId) as { count: number };
    return row.count;
  }

  listEquipmentResourceRoles(
    projectId: number,
    equipmentId?: number,
  ): EquipmentResourceRoleRecord[] {
    const whereClause =
      equipmentId !== undefined
        ? "WHERE err.project_id = ? AND err.equipment_id = ?"
        : "WHERE err.project_id = ?";
    const params =
      equipmentId !== undefined ? [projectId, equipmentId] : [projectId];

    return this.database
      .prepare(
        `
          SELECT
            err.id AS id,
            err.project_id AS projectId,
            err.equipment_id AS equipmentId,
            err.resource_id AS resourceId,
            err.role AS role,
            err.is_primary AS isPrimary,
            err.created_at AS createdAt,
            err.updated_at AS updatedAt,
            r.public_id AS resourcePublicId,
            r.code AS resourceCode,
            r.name AS resourceName,
            r.active AS resourceActive
          FROM project_equipment_resource_roles err
          JOIN resources r ON r.id = err.resource_id
          ${whereClause}
          ORDER BY err.id ASC
        `,
      )
      .all(...params) as EquipmentResourceRoleRecord[];
  }

  replaceEquipmentResourceRoles(
    projectId: number,
    equipmentId: number,
    roles: Array<{ resourceId: number; role: EquipmentRole; isPrimary: number }>,
    now: string,
  ): void {
    const deleteStmt = this.database.prepare(
      `DELETE FROM project_equipment_resource_roles WHERE project_id = ? AND equipment_id = ?`,
    );
    const insertStmt = this.database.prepare(
      `
        INSERT INTO project_equipment_resource_roles (
          project_id, equipment_id, resource_id, role, is_primary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    );

    deleteStmt.run(projectId, equipmentId);
    for (const r of roles) {
      insertStmt.run(
        projectId,
        equipmentId,
        r.resourceId,
        r.role,
        r.isPrimary,
        now,
        now,
      );
    }
  }

  listSystemResourceRoles(
    projectId: number,
    systemId?: number,
  ): SystemResourceRoleRecord[] {
    const whereClause =
      systemId !== undefined
        ? "WHERE srr.project_id = ? AND srr.system_id = ?"
        : "WHERE srr.project_id = ?";
    const params =
      systemId !== undefined ? [projectId, systemId] : [projectId];

    return this.database
      .prepare(
        `
          SELECT
            srr.id AS id,
            srr.project_id AS projectId,
            srr.system_id AS systemId,
            srr.resource_id AS resourceId,
            srr.role AS role,
            srr.is_primary AS isPrimary,
            srr.created_at AS createdAt,
            srr.updated_at AS updatedAt,
            r.public_id AS resourcePublicId,
            r.code AS resourceCode,
            r.name AS resourceName,
            r.active AS resourceActive
          FROM project_system_resource_roles srr
          JOIN resources r ON r.id = srr.resource_id
          ${whereClause}
          ORDER BY srr.id ASC
        `,
      )
      .all(...params) as SystemResourceRoleRecord[];
  }

  replaceSystemResourceRoles(
    projectId: number,
    systemId: number,
    roles: Array<{ resourceId: number; role: SystemRole; isPrimary: number }>,
    now: string,
  ): void {
    const deleteStmt = this.database.prepare(
      `DELETE FROM project_system_resource_roles WHERE project_id = ? AND system_id = ?`,
    );
    const insertStmt = this.database.prepare(
      `
        INSERT INTO project_system_resource_roles (
          project_id, system_id, resource_id, role, is_primary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    );

    deleteStmt.run(projectId, systemId);
    for (const r of roles) {
      insertStmt.run(
        projectId,
        systemId,
        r.resourceId,
        r.role,
        r.isPrimary,
        now,
        now,
      );
    }
  }

  countResourceEquipmentRoles(resourceId: number): number {
    const row = this.database
      .prepare(
        `SELECT count(*) AS count FROM project_equipment_resource_roles WHERE resource_id = ?`,
      )
      .get(resourceId) as { count: number };
    return row.count;
  }

  countResourceSystemRoles(resourceId: number): number {
    const row = this.database
      .prepare(
        `SELECT count(*) AS count FROM project_system_resource_roles WHERE resource_id = ?`,
      )
      .get(resourceId) as { count: number };
    return row.count;
  }

  findTaskEquipmentLinks(projectId: number, taskId: number): TaskEquipmentLinkRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            tel.id AS id,
            tel.project_id AS projectId,
            tel.task_id AS taskId,
            tel.equipment_id AS equipmentId,
            tel.scope AS scope,
            tel.created_at AS createdAt,
            tel.updated_at AS updatedAt,
            t.public_id AS taskPublicId,
            t.name AS taskName,
            t.type AS taskType,
            e.public_id AS equipmentPublicId,
            e.code AS equipmentCode,
            e.name AS equipmentName,
            e.equipment_type AS equipmentType,
            e.active AS equipmentActive
          FROM task_equipment_links tel
          JOIN tasks t ON t.id = tel.task_id AND t.project_id = tel.project_id
          JOIN project_equipment e ON e.id = tel.equipment_id AND e.project_id = tel.project_id
          WHERE tel.project_id = ? AND tel.task_id = ?
          ORDER BY tel.id ASC
        `,
      )
      .all(projectId, taskId) as TaskEquipmentLinkRecord[];
  }

  findTaskSystemLinks(projectId: number, taskId: number): TaskSystemLinkRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            tsl.id AS id,
            tsl.project_id AS projectId,
            tsl.task_id AS taskId,
            tsl.system_id AS systemId,
            tsl.scope AS scope,
            tsl.created_at AS createdAt,
            tsl.updated_at AS updatedAt,
            t.public_id AS taskPublicId,
            t.name AS taskName,
            t.type AS taskType,
            s.public_id AS systemPublicId,
            s.code AS systemCode,
            s.name AS systemName,
            s.system_type AS systemType,
            s.active AS systemActive
          FROM task_system_links tsl
          JOIN tasks t ON t.id = tsl.task_id AND t.project_id = tsl.project_id
          JOIN project_logistics_systems s ON s.id = tsl.system_id AND s.project_id = tsl.project_id
          WHERE tsl.project_id = ? AND tsl.task_id = ?
          ORDER BY tsl.id ASC
        `,
      )
      .all(projectId, taskId) as TaskSystemLinkRecord[];
  }

  listAllTaskEquipmentLinks(projectId: number): TaskEquipmentLinkRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            tel.id AS id,
            tel.project_id AS projectId,
            tel.task_id AS taskId,
            tel.equipment_id AS equipmentId,
            tel.scope AS scope,
            tel.created_at AS createdAt,
            tel.updated_at AS updatedAt,
            t.public_id AS taskPublicId,
            t.name AS taskName,
            t.type AS taskType,
            e.public_id AS equipmentPublicId,
            e.code AS equipmentCode,
            e.name AS equipmentName,
            e.equipment_type AS equipmentType,
            e.active AS equipmentActive
          FROM task_equipment_links tel
          JOIN tasks t ON t.id = tel.task_id AND t.project_id = tel.project_id
          JOIN project_equipment e ON e.id = tel.equipment_id AND e.project_id = tel.project_id
          WHERE tel.project_id = ?
          ORDER BY tel.id ASC
        `,
      )
      .all(projectId) as TaskEquipmentLinkRecord[];
  }

  listAllTaskSystemLinks(projectId: number): TaskSystemLinkRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            tsl.id AS id,
            tsl.project_id AS projectId,
            tsl.task_id AS taskId,
            tsl.system_id AS systemId,
            tsl.scope AS scope,
            tsl.created_at AS createdAt,
            tsl.updated_at AS updatedAt,
            t.public_id AS taskPublicId,
            t.name AS taskName,
            t.type AS taskType,
            s.public_id AS systemPublicId,
            s.code AS systemCode,
            s.name AS systemName,
            s.system_type AS systemType,
            s.active AS systemActive
          FROM task_system_links tsl
          JOIN tasks t ON t.id = tsl.task_id AND t.project_id = tsl.project_id
          JOIN project_logistics_systems s ON s.id = tsl.system_id AND s.project_id = tsl.project_id
          WHERE tsl.project_id = ?
          ORDER BY tsl.id ASC
        `,
      )
      .all(projectId) as TaskSystemLinkRecord[];
  }

  replaceTaskEquipmentLinks(
    projectId: number,
    taskId: number,
    links: Array<{ equipmentId: number; scope: TaskLogisticsLinkScope }>,
    now: string,
  ): void {
    const deleteStmt = this.database.prepare(
      `DELETE FROM task_equipment_links WHERE project_id = ? AND task_id = ?`,
    );
    const insertStmt = this.database.prepare(
      `
        INSERT INTO task_equipment_links (
          project_id, task_id, equipment_id, scope, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    );

    deleteStmt.run(projectId, taskId);
    for (const l of links) {
      insertStmt.run(projectId, taskId, l.equipmentId, l.scope, now, now);
    }
  }

  replaceTaskSystemLinks(
    projectId: number,
    taskId: number,
    links: Array<{ systemId: number; scope: TaskLogisticsLinkScope }>,
    now: string,
  ): void {
    const deleteStmt = this.database.prepare(
      `DELETE FROM task_system_links WHERE project_id = ? AND task_id = ?`,
    );
    const insertStmt = this.database.prepare(
      `
        INSERT INTO task_system_links (
          project_id, task_id, system_id, scope, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    );

    deleteStmt.run(projectId, taskId);
    for (const l of links) {
      insertStmt.run(projectId, taskId, l.systemId, l.scope, now, now);
    }
  }

  countTaskEquipmentLinks(projectId: number, equipmentId: number): number {
    const row = this.database
      .prepare(
        `SELECT count(*) AS count FROM task_equipment_links WHERE project_id = ? AND equipment_id = ?`,
      )
      .get(projectId, equipmentId) as { count: number };
    return row.count;
  }

  countTaskSystemLinks(projectId: number, systemId: number): number {
    const row = this.database
      .prepare(
        `SELECT count(*) AS count FROM task_system_links WHERE project_id = ? AND system_id = ?`,
      )
      .get(projectId, systemId) as { count: number };
    return row.count;
  }
}
