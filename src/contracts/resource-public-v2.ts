/** Public physical read boundary. Archived grouping remains an internal resolver input;
 * the wire retains physical identity and per-relation coverage without exposing that entity. */
export const RESOURCE_READ_VERSION_HEADER = "X-MasterGantt-Resource-Version";
export type ResourceReadVersion = 1 | 2;
const omitted = new Set(["targetId", "targetIds", "targetScopes", "effectiveTargetIds", "inactiveTargetIds", "unusedTargetIds", "projectCommonTargetIds", "noWorkAreaTargetIds", "targetUnlinkedTaskCount", "targetUnlinkedTaskIds", "legacyOnlyTaskCount", "targetNullMeaning", "targetUsage", "targetUsageScope", "targets", "targetWithoutTaskIds"]);
const names: Record<string,string> = {
  targetProjection:"physicalProjection", targetSources:"physicalSources", targetMembers:"instanceMembers",
  targetOptions:"entityOptions", targetContext:"selectionContext", targetPath:"physicalPath",
  targetFilters:"filters", targetProjectReferenceScope:"physicalProjectReferenceScope",
  bindingId:"relationId", memberId:"memberReference", memberIds:"memberReferences",
  coverageByMember:"memberCoverage", physicalEquipmentTypeCodes:"equipmentTypeCodes", physicalSystemTypeCodes:"systemTypeCodes",
};
const values: Record<string,string> = {
  "resource-dashboard/1":"resource-dashboard/2", "wbs-view-report/1":"wbs-view-report/2",
  "direct+target:v1":"physical-connections:v2", "targetProjection":"physicalProjection", "target-binding":"archived-connection", "legacy-target-context":"archived-context",
  "legacy-target-context:v0":"archived-context:v0", "target_binding":"archived_connection", "target_unlinked":"unlinked",
  "same Capacity R and period; Target/Task/Milestone/source restrictions removed":"same Capacity R and period; Task/Milestone/connection restrictions removed",
};
function object(value:unknown): value is Record<string,unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
const valueFields = new Set(["source","schema","sourceKind","sourceKinds","contextSourceVersion","dimension","projectReferenceScope"]);
export function toResourcePublicV2(value:unknown, field?:string):unknown {
  if (Array.isArray(value)) return value.filter(row => !object(row) || row.dimension !== "target" && row.dimension !== "scope").map(row=>toResourcePublicV2(row,field));
  if (!object(value)) return typeof value === "string" && field !== undefined && valueFields.has(field) && values[value] ? values[value] : value;
  const output:Record<string,unknown>={};
  for (const [key,item] of Object.entries(value)) {
    // Resource/Group AssignmentTarget is a separate canonical domain.
    const assignmentIdentity=key === "targetId" && (value.targetKind === "resource" || value.targetKind === "group") && typeof value.id === "string" && typeof value.taskId === "string";
    if (omitted.has(key) && !assignmentIdentity) continue;
    output[names[key] ?? key] = toResourcePublicV2(item,key);
  }
  if (object(value.integrated)) output.schema="logistics-kpi/2";
  return output;
}
export function fromResourcePublicV2(value:unknown):unknown {
  if (!object(value)) return value;
  const data=object(value.data)?value.data:value;
  return typeof data.schema === "string" && ["resource-dashboard/2","wbs-view-report/2","logistics-kpi/2"].includes(data.schema) ? decodePhysical(value,undefined,data.schema === "wbs-view-report/2") : value;
}
const reverseNames = Object.fromEntries(Object.entries(names).map(([a,b])=>[b,a]));
const reverseValues = Object.fromEntries(Object.entries(values).map(([a,b])=>[b,a]));
/** Transitional in-memory adapter for existing validated renderers. It never reconstructs
 * archived group IDs or authorizes writes; public request validation is independent. */
function decodePhysical(value:unknown,field?:string,wbs=false):unknown {
  if (Array.isArray(value)) return value.map(row=>decodePhysical(row,field,wbs));
  if (!object(value)) return typeof value === "string" && field !== undefined && valueFields.has(field) && reverseValues[value] ? reverseValues[value] : value;
  const output:Record<string,unknown>={};
  for (const [key,item] of Object.entries(value)) {
    // Ordinary response/request filters are not a drill echo's legacy targetFilters.
    const name = key === "filters" || wbs && (key === "equipmentTypeCodes" || key === "systemTypeCodes") ? key : reverseNames[key] ?? key;
    output[name] = decodePhysical(item,key,value.schema === "resource-dashboard/2" ? false : wbs);
  }
  // The public schema version remains evidence of the actual wire contract.
  if ("schema" in value) output.schema=value.schema;
  if ("effectiveEquipmentIds" in value && "effectiveSystemIds" in value) output.effectiveTargetIds=[];
  if ("processIds" in value && "workAreaIds" in value && "equipmentIds" in value && "systemIds" in value && "taskId" in value) output.targetIds=[];
  if (value.source === "physical-connections:v2") {
    output.source=value.source;
    const configuration=output.configuration as Record<string,unknown>|undefined;
    const diagnostics=output.diagnostics as Record<string,unknown>|undefined;
    if(configuration) configuration.targets=[];
    if(diagnostics) diagnostics.targetWithoutTaskIds=[];
  }
  if ("assignmentScope" in value && value.assignmentScope === "exact-source-intersection" && "filters" in value) output.targetFilters=output.filters;
  return output;
}
/** Only physical selectors are accepted by the current public contract. Process/area
 * selection belongs to the WBS view's explicit-context paths. */
export function isRetiredResourceSelection(value:unknown):boolean {
  if (Array.isArray(value)) return value.some(isRetiredResourceSelection);
  if (!object(value)) return false;
  for (const [key,item] of Object.entries(value)) {
    if (["targetIds","targetScopes","memberEquipmentIds","memberSystemIds","directEquipmentIds","directSystemIds","projectProcessIds","processOccurrenceIds","processTypeIds","workAreaIds","targetPath"].includes(key)) return true;
    if (key === "dimension" && (item === "targetProjection" || item === "physicalProjection")) return true;
    if (key === "projectionOrder") return true;
    if (isRetiredResourceSelection(item)) return true;
  }
  return false;
}
/** Wire names map to distinct physical predicates; legacy v1 member semantics stay intact. */
export function resourceV2FiltersToInternal(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(resourceV2FiltersToInternal);
  if (!object(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key === "equipmentTypeCodes" ? "physicalEquipmentTypeCodes" : key === "systemTypeCodes" ? "physicalSystemTypeCodes" : key, resourceV2FiltersToInternal(item)]));
}
