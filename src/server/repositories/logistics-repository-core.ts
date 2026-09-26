import type Database from "better-sqlite3";
import type {
  ControlRole,
  EquipmentType,
  LogisticsSystemType,
  ManagementUnit,
  SystemLayer,
  SystemScope,
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

export interface SystemLinkRecord {
  sourceSystemId: number;
  targetSystemId: number;
  relationType: "coordinates";
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
}
