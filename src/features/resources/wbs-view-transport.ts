import { z } from "zod";
import type { WbsViewResponseDto, WbsViewQueryInput, WbsViewSpec } from "../../contracts/wbs-dashboard-views";
import { resourceDataContextSchema } from "./resource-drill-scope-model";
import { validateWbsViewSpec } from "./wbs-view-model";
import { wbsViewPathSchema } from "./wbs-view-storage";
const hash = z.string().regex(/^[a-f0-9]{64}$/), count = z.number().int().nonnegative(), ids = z.array(z.string().min(1)).max(50000), date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const record = z.record(z.string(), z.unknown());
const spec = z.custom<WbsViewSpec>(value => validateWbsViewSpec(value).ok);
const scope = z.discriminatedUnion("kind", [z.object({kind:z.literal("summarySubtree"),rootId:z.string().uuid()}).strict(),z.object({kind:z.literal("scheduleSelection"),nodeIds:ids}).strict(),z.object({kind:z.literal("exactAssignments"),assignmentIds:ids}).strict()]);
const source = z.object({ relationKind: z.enum(["task-association","membership","controls","coordinates","assignment"]), sourceKind: z.enum(["explicit-task-context","ancestor-task-context","legacy-target-context","target-binding","legacy-direct","equipment-work-area","equipment-process","system-process","system-controls","system-coordinates","project-registration","responsibility","personal-assignment","group-assignment"]), dimension:z.enum(["process","processOccurrence","workArea","equipment","equipmentType","system","systemType","systemCoordination","target","resource","group","role","milestone","wbs"]), entityId:z.string().min(1), taskId:z.string().optional(), assignmentId:z.string().optional(), entityKind:z.string().optional(), effective:z.boolean().optional() }).passthrough();
const instancePath = z.object({taskId:z.string(),kind:z.enum(["equipment","system"]),instanceId:z.string(),sources:z.array(source),targetMembers:z.array(record),legacySources:z.array(record)}).passthrough();
const ledger = z.object({taskId:z.string(),type:z.enum(["task","summary","milestone"]),processIds:ids,processOccurrenceIds:ids,workAreaIds:ids,equipmentIds:ids,systemIds:ids,targetIds:ids,milestoneTaskId:z.string().nullable(),contextState:z.enum(["legacy-null","explicit-empty","explicit"]),sources:z.array(source),targetSources:record}).passthrough();
const identity = z.object({taskIds:ids,assignmentIds:ids,taskCount:count,assignmentCount:count,ancestorSummaryIds:ids,selectedSources:z.array(z.object({taskId:z.string(),sources:z.array(source)})),instanceIds:z.array(z.object({kind:z.enum(["equipment","system"]),instanceId:z.string()})),instancePaths:z.array(instancePath)}).passthrough();
const fraction = z.object({numerator:z.number().finite(),denominator:z.number().finite(),percent:z.number().finite().nullable()});
const counted = z.object({count,taskIds:ids});
const totals = z.object({tasks:z.object({taskIds:ids,taskCount:count,notStarted:counted,inProgress:counted,completed:counted,delayed:counted,completion:fraction,progress:fraction}),assignments:z.object({taskIds:ids,resourceIds:ids,assignmentIds:ids,taskCount:count,resourceCount:count,assignmentCount:count,notStarted:counted,inProgress:counted,completed:counted,delayed:counted,completion:fraction,assignedTaskProgress:fraction,effort:z.object({knownMd:z.number().finite(),plannedMd:z.number().finite().nullable(),plannedMm:z.number().finite().nullable(),state:z.enum(["empty","configured","partial","unset"]),partial:z.boolean(),unsetCount:count})}).passthrough(),relatedMembers:record,configurationReference:z.object({scope:z.literal("registered configuration; independent from related Task/Assignment population"),equipmentQuantity:z.number().finite().nonnegative(),systemCount:count,equipmentIds:ids,systemIds:ids,selectors:z.array(record),ignoredTaskAndPersonalSelectors:z.array(record),members:z.array(record)}).passthrough(),diagnostics:record,participation:record}).passthrough();
interface CheckedNode { selector: {dimension:string;id:string|null}; path: Array<{dimension:string;id:string|null}>; viewRowKey:string;name:string|null;taskIds:string[];assignmentIds:string[];totals:unknown;provenance:unknown[];children:CheckedNode[] }
const node: z.ZodType<CheckedNode> = z.lazy(() => z.object({selector:z.object({dimension:z.string(),id:z.string().nullable()}),path:wbsViewPathSchema,viewRowKey:hash,name:z.string().nullable(),taskIds:ids,assignmentIds:ids,totals,provenance:z.array(z.object({taskId:z.string(),sources:z.array(source)})),children:z.array(node).max(5000)}));
const base = z.object({schema:z.literal("wbs-view-report/1"),snapshotId:hash,projectPublicId:z.string(),projectRevision:count,spec,filters:record,range:z.object({from:date,to:date}),asOfDate:date,mdPerMm:z.number().finite().positive().nullable(),metadata:record,sourceContext:resourceDataContextSchema.extend({schema:z.literal("wbs-view-source/1"),contextSourceVersion:z.literal("explicit-task-context:v1"),snapshotId:hash,spec,path:wbsViewPathSchema,scope:scope.optional(),range:z.object({from:date,to:date}),asOfDate:date,mdPerMm:z.number().finite().positive().nullable(),mdPerMmSource:z.enum(["query","environment","unset"]),mdPerMmProvided:z.boolean()})}).passthrough();
const equipmentCatalogItem = z.object({
  id:z.string().min(1),name:z.string(),equipmentType:z.string().min(1).max(64),equipmentTypeName:z.string(),
  managementUnit:z.enum(["unit","fleet"]),quantity:z.number().int().nonnegative(),active:z.boolean(),primaryProcessId:z.string().min(1),
  workAreaLinks:z.array(z.object({processId:z.string().min(1),occurrenceId:z.string().min(1).nullable(),workAreaId:z.string().min(1)})).max(50000),
  resourceRoles:z.array(z.object({resourceId:z.string().min(1),resourceName:z.string(),role:z.enum(["owner","contributor"]),isPrimary:z.boolean(),active:z.boolean()})).max(50000),
  controlSystems:z.array(z.object({systemId:z.string().min(1),systemName:z.string(),controlRole:z.enum(["primary","supporting"])})).max(50000),
});
const report = base.extend({projection:z.literal("report"),...identity.shape,totals,children:z.array(node),taskSources:z.array(ledger),configuration:record,configurationCatalog:z.object({equipment:z.array(equipmentCatalogItem).max(50000),processes:z.array(z.object({id:z.string().min(1),name:z.string(),occurrenceId:z.string().nullable()})),workAreas:z.array(z.object({id:z.string().min(1),name:z.string(),occurrenceId:z.string().min(1).nullable(),processIds:ids})),instances:z.array(z.object({kind:z.enum(["equipment","system"]),id:z.string().min(1),name:z.string()})),milestones:z.array(z.object({id:z.string().min(1),name:z.string()}))}),diagnostics:record,fullMilestones:z.array(z.object({milestoneTaskId:z.string(),stageGate:record}))});
const details = base.extend({projection:z.literal("details"),path:wbsViewPathSchema,view:z.enum(["tasks","assignments"]),offset:count,limit:count,totalCount:count,nextOffset:count.nullable(),rows:z.array(z.object({taskId:z.string(),taskName:z.string(),externalId:z.string(),status:z.enum(["not_started","in_progress","completed"]),progress:z.number().finite().nullable(),taskStart:date.nullable(),taskEnd:date.nullable(),duration:z.number().finite().nullable(),wbsPath:z.array(z.object({taskId:z.string(),name:z.string()})),effectiveMilestoneTaskId:z.string().nullable(),explicitMilestoneTaskId:z.string().nullable(),inheritedFromTaskId:z.string().nullable(),assignment:z.object({assignmentId:z.string(),resourceId:z.string(),resourceName:z.string(),resourceCode:z.string().nullable(),active:z.boolean(),roles:z.array(z.string()),developerGrade:z.string().nullable(),groupIds:ids,assignmentStart:date.nullable(),assignmentEnd:date.nullable(),from:date,to:date,allocationPercent:z.number().finite().nullable(),effectiveWorkingDays:z.number().finite(),plannedMd:z.number().finite().nullable(),plannedMm:z.number().finite().nullable()}).passthrough().nullable(),taskSources:ledger,selectedSources:z.array(source),instancePaths:z.array(instancePath)}).passthrough())});
const scoped = base.extend({projection:z.literal("scope"),...identity.shape,path:wbsViewPathSchema,taskSources:z.array(ledger)});
const responseSchema = z.discriminatedUnion("projection",[report,details,scoped]);
export const stableWbsValue = (value:unknown):string => Array.isArray(value) ? `[${value.map(stableWbsValue).join(",")}]` : value && typeof value === "object" ? `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stableWbsValue(v)}`).join(",")}}` : JSON.stringify(value) ?? "null";
const normalizeScope=(value:WbsViewQueryInput["scope"])=>!value?null:value.kind==="summarySubtree"?value:value.kind==="scheduleSelection"?{kind:value.kind,nodeIds:[...new Set(value.nodeIds)].sort()}:{kind:value.kind,assignmentIds:[...new Set(value.assignmentIds)].sort()};
export class WbsViewTransportError extends Error {
  constructor(readonly code:string,message:string,readonly status:number=0) { super(message); this.name="WbsViewTransportError"; }
  get isStale() { return this.code === "STALE_SNAPSHOT" || this.code === "STALE_RESPONSE" || this.status === 409; }
}
export interface WbsViewFetchOptions {projectPublicId:string;projectRevision:number;input:WbsViewQueryInput;signal?:AbortSignal}
/** The runtime boundary validates the WBS contract directly; legacy dashboard DTOs are never cast into it. */
export function readWbsViewResponse(body:unknown, expected:WbsViewFetchOptions):WbsViewResponseDto {
  const envelope = z.object({data:responseSchema}).safeParse(body);
  const invalid = ():never => {throw new WbsViewTransportError("INVALID_RESPONSE","조회 응답의 출처가 일치하지 않습니다. 다시 조회해 주세요.");};
  if(!envelope.success) return invalid();
  const data=envelope.data.data, context=data.sourceContext, projection=expected.input.projection ?? {kind:"report"}, validated=validateWbsViewSpec(expected.input.spec);
  if(!validated.ok || data.projectPublicId!==expected.projectPublicId || data.projectRevision!==expected.projectRevision || context.projectPublicId!==data.projectPublicId || context.projectRevision!==data.projectRevision || context.snapshotId!==data.snapshotId || stableWbsValue(data.spec)!==stableWbsValue(validated.spec) || stableWbsValue(context.spec)!==stableWbsValue(validated.spec) || context.contextSourceVersion!==data.spec.contextSourceVersion || data.projection!==projection.kind || stableWbsValue(normalizeScope(context.scope))!==stableWbsValue(normalizeScope(expected.input.scope)) || stableWbsValue(data.range)!==stableWbsValue(context.range) || data.asOfDate!==context.asOfDate || data.mdPerMm!==context.mdPerMm) return invalid();
  const canonicalFilters = (value:Record<string,unknown>) => Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined && !(Array.isArray(v)&&v.length===0)).map(([key,v])=>[key,Array.isArray(v)?[...new Set(v.map(item=>typeof item==="string"?item.trim():item))].sort():typeof v==="string" && (key==="search"||key==="taskSearch")?v.trim():v]));
  if(stableWbsValue(canonicalFilters(data.filters))!==stableWbsValue(canonicalFilters({...expected.input.filters})))return invalid();
  const mdProvided=expected.input.filters?.mdPerMm !== undefined;
  if(context.mdPerMmProvided!==mdProvided || mdProvided && (context.mdPerMmSource!=="query" || context.mdPerMm!==expected.input.filters?.mdPerMm) || !mdProvided && context.mdPerMmSource==="query")return invalid();
  const path=projection.kind==="report"?[]:projection.path;
  if(stableWbsValue(context.path)!==stableWbsValue(path) || projection.kind!=="report" && data.snapshotId!==projection.snapshotId) return invalid();
  const stages=[[data.spec.root],...(data.spec.levels??[]).map(level=>typeof level==="string"?[level]:level.dimensions)];
  const validPath=(entries:CheckedNode["path"])=>entries.every((entry,index)=>stages[index]?.includes(entry.dimension as typeof stages[number][number]));
  if(!validPath(path)) return invalid();
  if(data.projection!=="report" && stableWbsValue(data.path)!==stableWbsValue(path)) return invalid();
  if(data.projection==="details") {
    if(projection.kind!=="details" || data.view!==projection.view || data.offset!==projection.offset || data.limit!==projection.limit || data.rows.length>data.limit || data.nextOffset!==(data.offset+data.rows.length<data.totalCount?data.offset+data.rows.length:null) || data.rows.some(row=>row.taskId!==row.taskSources.taskId)) return invalid();
  } else {
    if(data.taskCount!==data.taskIds.length || data.assignmentCount!==data.assignmentIds.length || new Set(data.taskIds).size!==data.taskIds.length || new Set(data.assignmentIds).size!==data.assignmentIds.length || stableWbsValue([...data.taskSources.map(row=>row.taskId)].sort())!==stableWbsValue([...data.taskIds].sort()) || stableWbsValue([...data.selectedSources.map(row=>row.taskId)].sort())!==stableWbsValue([...data.taskIds].sort()) || data.instancePaths.some(row=>!data.taskIds.includes(row.taskId))) return invalid();
    if(data.projection==="report") {
      const keys=new Set<string>();
      const check=(children:CheckedNode[],parent:CheckedNode["path"],parentTasks:string[],parentAssignments:string[]):boolean=>children.every(child=>{ if(keys.has(child.viewRowKey)||!validPath(child.path)||stableWbsValue(child.path)!==stableWbsValue([...parent,child.selector])||child.taskIds.some(id=>!parentTasks.includes(id))||child.assignmentIds.some(id=>!parentAssignments.includes(id)))return false; keys.add(child.viewRowKey);return check(child.children,child.path,child.taskIds,child.assignmentIds); });
      if(!check(data.children,[],data.taskIds,data.assignmentIds))return invalid();
    }
  }
  // All nested source data is retained untouched after schema and provenance checks.
  return bodyData(body);
}
function bodyData(body:unknown):WbsViewResponseDto { return (body as {data:WbsViewResponseDto}).data; }
export async function fetchWbsView(options:WbsViewFetchOptions):Promise<WbsViewResponseDto> {
  const response=await fetch(`/api/projects/${encodeURIComponent(options.projectPublicId)}/resource-dashboard/views`,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(options.input),signal:options.signal});
  const body:unknown=await response.json();
  if(!response.ok) { const error=z.object({error:z.object({code:z.string(),message:z.string()})}).safeParse(body);throw new WbsViewTransportError(error.success?error.data.error.code:"REQUEST_FAILED",error.success?error.data.error.message:"조회 요청에 실패했습니다. 다시 시도해 주세요.",response.status); }
  return readWbsViewResponse(body,options);
}
