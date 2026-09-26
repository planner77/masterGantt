import type {
  ControlRole,
  CreateEquipmentRequest,
  CreateLogisticsSystemRequest,
  CreateProcessRequest,
  EquipmentType,
  LogisticsSystemType,
  ManagementUnit,
  SetEquipmentSystemsRequest,
  SetSystemChildrenRequest,
  SetSystemProcessesRequest,
  SystemLayer,
  SystemScope,
  UpdateEquipmentRequest,
  UpdateLogisticsSystemRequest,
  UpdateProcessRequest,
} from "../../contracts/logistics";

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  details: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const VALID_EQUIPMENT_TYPES: Set<EquipmentType> = new Set([
  "stocker",
  "agv",
  "amr",
  "oht",
  "conveyor",
  "other",
]);

const VALID_MANAGEMENT_UNITS: Set<ManagementUnit> = new Set(["unit", "fleet"]);

const VALID_SYSTEM_TYPES: Set<LogisticsSystemType> = new Set([
  "scs",
  "acs",
  "ocs",
  "lcs",
  "mcs",
  "other",
]);

const VALID_SYSTEM_LAYERS: Set<SystemLayer> = new Set(["controller", "coordinator"]);

const VALID_SYSTEM_SCOPES: Set<SystemScope> = new Set(["project", "processes"]);

const VALID_CONTROL_ROLES: Set<ControlRole> = new Set(["primary", "supporting"]);

export function parseCreateProcessInput(
  raw: unknown,
): ValidationResult<CreateProcessRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  const details: string[] = [];

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length > 64) {
    details.push("Process code must be non-empty and at most 64 characters.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    details.push("Process name must be non-empty and at most 200 characters.");
  }

  let parentProcessId: string | null | undefined = undefined;
  if (body.parentProcessId !== undefined) {
    if (body.parentProcessId === null) {
      parentProcessId = null;
    } else if (typeof body.parentProcessId === "string" && body.parentProcessId.trim().length > 0) {
      parentProcessId = body.parentProcessId.trim();
    } else {
      details.push("parentProcessId must be a valid string or null.");
    }
  }

  let sortOrder: number | undefined = undefined;
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) && body.sortOrder >= 0) {
      sortOrder = body.sortOrder;
    } else {
      details.push("sortOrder must be a non-negative integer.");
    }
  }

  let active: boolean | undefined = undefined;
  if (body.active !== undefined) {
    if (typeof body.active === "boolean") {
      active = body.active;
    } else {
      details.push("active must be a boolean.");
    }
  }

  if (details.length > 0) {
    return { success: false, details };
  }

  return {
    success: true,
    data: {
      code,
      name,
      parentProcessId,
      sortOrder,
      active,
    },
  };
}

export function parseUpdateProcessInput(
  raw: unknown,
): ValidationResult<UpdateProcessRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  const details: string[] = [];
  const result: UpdateProcessRequest = {};

  if (body.code !== undefined) {
    if (typeof body.code === "string" && body.code.trim().length > 0 && body.code.trim().length <= 64) {
      result.code = body.code.trim();
    } else {
      details.push("Process code must be non-empty and at most 64 characters.");
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 200) {
      result.name = body.name.trim();
    } else {
      details.push("Process name must be non-empty and at most 200 characters.");
    }
  }

  if (body.parentProcessId !== undefined) {
    if (body.parentProcessId === null) {
      result.parentProcessId = null;
    } else if (typeof body.parentProcessId === "string" && body.parentProcessId.trim().length > 0) {
      result.parentProcessId = body.parentProcessId.trim();
    } else {
      details.push("parentProcessId must be a valid string or null.");
    }
  }

  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) && body.sortOrder >= 0) {
      result.sortOrder = body.sortOrder;
    } else {
      details.push("sortOrder must be a non-negative integer.");
    }
  }

  if (body.active !== undefined) {
    if (typeof body.active === "boolean") {
      result.active = body.active;
    } else {
      details.push("active must be a boolean.");
    }
  }

  if (details.length > 0) {
    return { success: false, details };
  }

  return { success: true, data: result };
}

export function parseCreateEquipmentInput(
  raw: unknown,
): ValidationResult<CreateEquipmentRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  const details: string[] = [];

  const processId = typeof body.processId === "string" ? body.processId.trim() : "";
  if (!processId) {
    details.push("processId must be specified.");
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length > 64) {
    details.push("Equipment code must be non-empty and at most 64 characters.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    details.push("Equipment name must be non-empty and at most 200 characters.");
  }

  const equipmentType = body.equipmentType as EquipmentType;
  if (!VALID_EQUIPMENT_TYPES.has(equipmentType)) {
    details.push(`equipmentType must be one of: ${[...VALID_EQUIPMENT_TYPES].join(", ")}`);
  }

  const managementUnit = body.managementUnit as ManagementUnit;
  if (!VALID_MANAGEMENT_UNITS.has(managementUnit)) {
    details.push(`managementUnit must be one of: ${[...VALID_MANAGEMENT_UNITS].join(", ")}`);
  }

  let quantity = 1;
  if (body.quantity !== undefined) {
    if (typeof body.quantity === "number" && Number.isInteger(body.quantity) && body.quantity >= 1) {
      quantity = body.quantity;
    } else {
      details.push("quantity must be an integer >= 1.");
    }
  }

  if (managementUnit === "unit" && quantity !== 1) {
    details.push("quantity must be exactly 1 when managementUnit is 'unit'.");
  }

  const manufacturer = typeof body.manufacturer === "string" ? body.manufacturer.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 4000) {
    details.push("description must be at most 4000 characters.");
  }

  let active: boolean | undefined = undefined;
  if (body.active !== undefined) {
    if (typeof body.active === "boolean") {
      active = body.active;
    } else {
      details.push("active must be a boolean.");
    }
  }

  if (details.length > 0) {
    return { success: false, details };
  }

  return {
    success: true,
    data: {
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
    },
  };
}

export function parseUpdateEquipmentRequest(
  raw: unknown,
): ValidationResult<UpdateEquipmentRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  const details: string[] = [];
  const result: UpdateEquipmentRequest = {};

  if (body.processId !== undefined) {
    if (typeof body.processId === "string" && body.processId.trim().length > 0) {
      result.processId = body.processId.trim();
    } else {
      details.push("processId must be a non-empty string.");
    }
  }

  if (body.code !== undefined) {
    if (typeof body.code === "string" && body.code.trim().length > 0 && body.code.trim().length <= 64) {
      result.code = body.code.trim();
    } else {
      details.push("Equipment code must be non-empty and at most 64 characters.");
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 200) {
      result.name = body.name.trim();
    } else {
      details.push("Equipment name must be non-empty and at most 200 characters.");
    }
  }

  if (body.equipmentType !== undefined) {
    const eqType = body.equipmentType as EquipmentType;
    if (VALID_EQUIPMENT_TYPES.has(eqType)) {
      result.equipmentType = eqType;
    } else {
      details.push(`equipmentType must be one of: ${[...VALID_EQUIPMENT_TYPES].join(", ")}`);
    }
  }

  if (body.managementUnit !== undefined) {
    const mUnit = body.managementUnit as ManagementUnit;
    if (VALID_MANAGEMENT_UNITS.has(mUnit)) {
      result.managementUnit = mUnit;
    } else {
      details.push(`managementUnit must be one of: ${[...VALID_MANAGEMENT_UNITS].join(", ")}`);
    }
  }

  if (body.quantity !== undefined) {
    if (typeof body.quantity === "number" && Number.isInteger(body.quantity) && body.quantity >= 1) {
      result.quantity = body.quantity;
    } else {
      details.push("quantity must be an integer >= 1.");
    }
  }

  if (body.manufacturer !== undefined) {
    result.manufacturer = typeof body.manufacturer === "string" ? body.manufacturer.trim() : "";
  }

  if (body.model !== undefined) {
    result.model = typeof body.model === "string" ? body.model.trim() : "";
  }

  if (body.description !== undefined) {
    const desc = typeof body.description === "string" ? body.description.trim() : "";
    if (desc.length > 4000) {
      details.push("description must be at most 4000 characters.");
    } else {
      result.description = desc;
    }
  }

  if (body.active !== undefined) {
    if (typeof body.active === "boolean") {
      result.active = body.active;
    } else {
      details.push("active must be a boolean.");
    }
  }

  if (details.length > 0) {
    return { success: false, details };
  }

  return { success: true, data: result };
}

export function parseSetEquipmentSystemsInput(
  raw: unknown,
): ValidationResult<SetEquipmentSystemsRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.systems)) {
    return { success: false, details: ["systems must be an array."] };
  }

  const details: string[] = [];
  const systems: { systemId: string; controlRole: ControlRole }[] = [];
  let primaryCount = 0;
  const seenSystemIds = new Set<string>();

  for (let i = 0; i < body.systems.length; i += 1) {
    const item = body.systems[i];
    if (typeof item !== "object" || item === null) {
      details.push(`systems[${i}] must be an object.`);
      continue;
    }
    const sys = item as Record<string, unknown>;
    const systemId = typeof sys.systemId === "string" ? sys.systemId.trim() : "";
    if (!systemId) {
      details.push(`systems[${i}].systemId must be a non-empty string.`);
      continue;
    }
    if (seenSystemIds.has(systemId)) {
      details.push(`Duplicate systemId '${systemId}' in systems list.`);
    }
    seenSystemIds.add(systemId);

    const controlRole = sys.controlRole as ControlRole;
    if (!VALID_CONTROL_ROLES.has(controlRole)) {
      details.push(`systems[${i}].controlRole must be 'primary' or 'supporting'.`);
    } else if (controlRole === "primary") {
      primaryCount += 1;
    }

    systems.push({ systemId, controlRole });
  }

  if (primaryCount > 1) {
    details.push("At most one primary control system is allowed per equipment.");
  }

  if (details.length > 0) {
    return { success: false, details };
  }

  return { success: true, data: { systems } };
}

export function parseCreateLogisticsSystemInput(
  raw: unknown,
): ValidationResult<CreateLogisticsSystemRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  const details: string[] = [];

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length > 64) {
    details.push("System code must be non-empty and at most 64 characters.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    details.push("System name must be non-empty and at most 200 characters.");
  }

  const systemType = body.systemType as LogisticsSystemType;
  if (!VALID_SYSTEM_TYPES.has(systemType)) {
    details.push(`systemType must be one of: ${[...VALID_SYSTEM_TYPES].join(", ")}`);
  }

  const layer = body.layer as SystemLayer;
  if (!VALID_SYSTEM_LAYERS.has(layer)) {
    details.push(`layer must be one of: ${[...VALID_SYSTEM_LAYERS].join(", ")}`);
  }

  const scope = body.scope as SystemScope;
  if (!VALID_SYSTEM_SCOPES.has(scope)) {
    details.push(`scope must be one of: ${[...VALID_SYSTEM_SCOPES].join(", ")}`);
  }

  let processIds: string[] | undefined = undefined;
  if (body.processIds !== undefined) {
    if (Array.isArray(body.processIds)) {
      processIds = body.processIds
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter((p) => p.length > 0);
    } else {
      details.push("processIds must be an array of strings.");
    }
  }

  const vendor = typeof body.vendor === "string" ? body.vendor.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 4000) {
    details.push("description must be at most 4000 characters.");
  }

  let active: boolean | undefined = undefined;
  if (body.active !== undefined) {
    if (typeof body.active === "boolean") {
      active = body.active;
    } else {
      details.push("active must be a boolean.");
    }
  }

  if (details.length > 0) {
    return { success: false, details };
  }

  return {
    success: true,
    data: {
      code,
      name,
      systemType,
      layer,
      scope,
      processIds,
      vendor,
      description,
      active,
    },
  };
}

export function parseUpdateLogisticsSystemInput(
  raw: unknown,
): ValidationResult<UpdateLogisticsSystemRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  const details: string[] = [];
  const result: UpdateLogisticsSystemRequest = {};

  if (body.code !== undefined) {
    if (typeof body.code === "string" && body.code.trim().length > 0 && body.code.trim().length <= 64) {
      result.code = body.code.trim();
    } else {
      details.push("System code must be non-empty and at most 64 characters.");
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 200) {
      result.name = body.name.trim();
    } else {
      details.push("System name must be non-empty and at most 200 characters.");
    }
  }

  if (body.systemType !== undefined) {
    const sType = body.systemType as LogisticsSystemType;
    if (VALID_SYSTEM_TYPES.has(sType)) {
      result.systemType = sType;
    } else {
      details.push(`systemType must be one of: ${[...VALID_SYSTEM_TYPES].join(", ")}`);
    }
  }

  if (body.layer !== undefined) {
    const sLayer = body.layer as SystemLayer;
    if (VALID_SYSTEM_LAYERS.has(sLayer)) {
      result.layer = sLayer;
    } else {
      details.push(`layer must be one of: ${[...VALID_SYSTEM_LAYERS].join(", ")}`);
    }
  }

  if (body.scope !== undefined) {
    const sScope = body.scope as SystemScope;
    if (VALID_SYSTEM_SCOPES.has(sScope)) {
      result.scope = sScope;
    } else {
      details.push(`scope must be one of: ${[...VALID_SYSTEM_SCOPES].join(", ")}`);
    }
  }

  if (body.vendor !== undefined) {
    result.vendor = typeof body.vendor === "string" ? body.vendor.trim() : "";
  }

  if (body.description !== undefined) {
    const desc = typeof body.description === "string" ? body.description.trim() : "";
    if (desc.length > 4000) {
      details.push("description must be at most 4000 characters.");
    } else {
      result.description = desc;
    }
  }

  if (body.active !== undefined) {
    if (typeof body.active === "boolean") {
      result.active = body.active;
    } else {
      details.push("active must be a boolean.");
    }
  }

  if (details.length > 0) {
    return { success: false, details };
  }

  return { success: true, data: result };
}

export function parseSetSystemProcessesInput(
  raw: unknown,
): ValidationResult<SetSystemProcessesRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.processIds)) {
    return { success: false, details: ["processIds must be an array of strings."] };
  }
  const processIds = body.processIds
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0);

  return { success: true, data: { processIds } };
}

export function parseSetSystemChildrenInput(
  raw: unknown,
): ValidationResult<SetSystemChildrenRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, details: ["Request body must be a JSON object."] };
  }
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.targetSystemIds)) {
    return { success: false, details: ["targetSystemIds must be an array of strings."] };
  }
  const targetSystemIds = body.targetSystemIds
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0);

  return { success: true, data: { targetSystemIds } };
}
