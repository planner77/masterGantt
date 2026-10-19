import type Database from "better-sqlite3";
import type { LogisticsDashboardDto, LogisticsDashboardFilterInput, LogisticsIntegratedKpiDto } from "../../contracts/logistics-dashboard";
import { WbsTaskLedgerInputError, selectWbsTaskLedger, type WbsTaskLedgerSnapshot } from "../../domain/resources/wbs-task-ledger";
import { ResourceKpiTargetInputError, ResourceKpiTargetLimitError } from "../../domain/resources/resource-kpi-targets";
import { summarizeResourceKpiAssignments } from "../../domain/resources/resource-kpi";
import { PublicApiError } from "../http/api-error-core";
import { calculateLogisticsDashboardPure, LogisticsDashboardService, type CalculateDashboardInput } from "./logistics-dashboard-service";
import { readLogisticsKpiSnapshot } from "./logistics-kpi-snapshot-core";
import { relatedMilestoneStages } from "../projects/milestone-dashboard-projection-core";
import { resourceFingerprint } from "../resources/resource-data-context-core";

const sorted = (values: readonly string[]) => [...new Set(values)].sort();
const limit = () => new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", "물류 KPI 원본 또는 응답 한도를 초과했습니다.");

/** Only this opt-in consumer adapts the ledger's effective union to the historical
 * calculator. Neither the canonical graph nor the legacy dashboard is changed. */
export function calculateLogisticsIntegratedKpi(input: CalculateDashboardInput, ledger: WbsTaskLedgerSnapshot, dataSnapshotId: string): LogisticsDashboardDto {
  const { logistics, filter } = input;
  const assertIds = (values: string[] | undefined, allowed: readonly string[]) => {
    const ids = new Set(allowed);
    if (values?.some(id => !ids.has(id))) throw new PublicApiError(400, "INVALID_SELECTION", "현재 프로젝트의 물류 KPI 조건을 다시 선택해 주세요.");
  };
  assertIds(filter.processIds, logistics.processes.map(row => row.id));
  assertIds(filter.equipmentIds, logistics.equipment.map(row => row.id));
  assertIds(filter.systemIds, logistics.systems.map(row => row.id));
  assertIds(filter.taskAssigneeResourceIds, input.resources.map(row => row.id));
  assertIds(filter.roleResourceIds, input.resources.map(row => row.id));
  const integratedLogistics = { ...logistics,
    taskEquipmentLinks: ledger.rows.flatMap(row => row.equipmentIds.map(id => ({ taskId: row.taskId, equipmentId: id, scope: "self" as const }))),
    taskSystemLinks: ledger.rows.flatMap(row => row.systemIds.map(id => ({ taskId: row.taskId, systemId: id, scope: "self" as const }))) };
  const common = { ...input, logistics: integratedLogistics, filter: { ...filter, processIds: undefined } };
  const full = calculateLogisticsDashboardPure(common);
  const processIds = new Set(filter.processIds ?? []);
  if (processIds.size && filter.includeDescendantProcesses !== false) {
    for (let changed = true; changed;) {
      changed = false;
      for (const process of logistics.processes) if (process.parentProcessId && processIds.has(process.parentProcessId) && !processIds.has(process.id)) {
        processIds.add(process.id); changed = true;
      }
    }
  }
  // W2: only each Task's explicit context is the new process population. Neither
  // Target membership, Equipment ownership nor Summary ancestry supplies it.
  const processTaskIds = new Set(ledger.rows.filter(row => row.processIds.some(id => processIds.has(id))).map(row => row.taskId));
  const result = processIds.size ? calculateLogisticsDashboardPure({ ...common, stageSnapshot: undefined, tasks: input.tasks.filter(task => task.type === "summary" || processTaskIds.has(task.taskId)) }) : full;
  result.quality = full.quality;
  if (processIds.size && full.milestoneStages) result.milestoneStages = relatedMilestoneStages(full.milestoneStages.rows, result.includedTaskIds, result.includedMilestoneIds);
  const included = new Set(result.includedTaskIds), leafRows = ledger.rows.filter(row => row.type !== "summary");
  const ordinaryRows = ledger.rows.filter(row => row.type === "task");
  const byTask = new Map(input.tasks.map(task => [task.taskId, task]));
  const assignments = input.assignments.filter(row => byTask.get(row.taskId)?.type === "task");
  const personal = assignments.filter(row => row.target.kind === "resource");
  const selectedAssignments = personal.filter(row => included.has(row.taskId));
  const byResource = new Map(input.resources.map(row => [row.id, row]));
  const legacyProcessRows = result.breakdowns.processes;
  result.breakdowns.processes = logistics.processes.filter(process => !filter.activeOnly || process.active).map(process => {
    const taskIds = ordinaryRows.filter(row => included.has(row.taskId) && row.processIds.includes(process.id)).map(row => row.taskId);
    const taskSet = new Set(taskIds);
    const equivalent = legacyProcessRows.find(row => row.id === process.id && row.taskIds.length === taskSet.size && row.taskIds.every(id => taskSet.has(id)));
    // Preserve the existing row's final rounding when the underlying Task set is
    // unchanged; the headline and historical row have distinct rounding contracts.
    if (equivalent) return equivalent;
    // Reuse the historical KPI/effort authority. Empty master lists avoid building
    // unrelated nested breakdowns for each process; context selection is already exact.
    const scoped = calculateLogisticsDashboardPure({ ...input, stageSnapshot: undefined,
      tasks: input.tasks.filter(task => taskSet.has(task.taskId)),
      assignments: input.assignments.filter(assignment => taskSet.has(assignment.taskId)),
      logistics: { ...integratedLogistics, processes: [], equipment: [], systems: [], taskEquipmentLinks: [], taskSystemLinks: [] },
      filter: { asOfDate: result.asOfDate, horizonDays: result.horizonDays, mdPerMm: filter.mdPerMm } });
    return { id: process.id, code: process.code, name: process.name, active: process.active, taskIds, taskCount: scoped.kpi.taskCount,
      progressPercent: scoped.kpi.progressPercent, overdueTaskCount: scoped.kpi.overdueTaskCount, plannedMd: scoped.effort.plannedMd };
  });
  const commonSelection = selectWbsTaskLedger(ledger);
  const commonEffort = summarizeResourceKpiAssignments(ledger.prepared, commonSelection.assignments.filter(row => included.has(row.taskId))).effort;
  const equipment = logistics.equipment.filter(row => !filter.activeOnly || row.active);
  const systems = logistics.systems.filter(row => !filter.activeOnly || row.active);
  const registered = ledger.configuration.resourceMemberships.filter(row => row.registered && (!filter.activeOnly || row.active));
  const activeProcessIds = ledger.prepared.logistics!.processes.filter(row => !filter.activeOnly || ledger.input.processActivity?.find(item => item.id === row.id)?.active !== false).map(row => row.id);
  const workAreas = ledger.prepared.logistics!.workAreas.filter(row => !filter.activeOnly || ledger.input.workAreaActivity?.find(item => item.id === row.id)?.active !== false);
  const targets = ledger.prepared.logistics!.targets.filter(row => !filter.activeOnly || row.active !== false);
  const hasPrimary = (roles: readonly { role: string; isPrimary: boolean; active?: boolean; resourceId: string }[] | undefined, role: "owner" | "pi") => roles?.some(row => row.role === role && row.isPrimary && row.active !== false && byResource.get(row.resourceId)?.active !== false);
  const hasTask = (kind: "equipment" | "system" | "target" | "process" | "workArea", id: string) => ordinaryRows.some(row => row[`${kind}Ids`].includes(id));
  const diagnostic: LogisticsIntegratedKpiDto["diagnostics"] = {
    scope: "full canonical Project; missing responsibility diagnostics use active masters",
    unlinkedTaskIds: ordinaryRows.filter(row => !row.equipmentIds.length && !row.systemIds.length).map(row => row.taskId),
    unlinkedLeafTaskIds: leafRows.filter(row => !row.equipmentIds.length && !row.systemIds.length).map(row => row.taskId),
    completelyUnassignedTaskIds: ordinaryRows.filter(row => !assignments.some(assignment => assignment.taskId === row.taskId)).map(row => row.taskId),
    personallyUnassignedTaskIds: ordinaryRows.filter(row => !personal.some(assignment => assignment.taskId === row.taskId)).map(row => row.taskId),
    groupOnlyTaskIds: ordinaryRows.filter(row => assignments.some(assignment => assignment.taskId === row.taskId && assignment.target.kind === "group") && !personal.some(assignment => assignment.taskId === row.taskId)).map(row => row.taskId),
    unsetAllocationTaskIds: sorted(personal.filter(row => row.allocation?.percent === null || row.allocation?.percent === undefined).map(row => row.taskId)),
    unsetAllocationAssignmentIds: personal.filter(row => row.allocation?.percent === null || row.allocation?.percent === undefined).map(row => row.id),
    equipmentWithoutPrimaryControllerIds: logistics.equipment.filter(row => row.active && !row.controlSystems?.some(control => control.controlRole === "primary")).map(row => row.id),
    equipmentWithoutOwnerIds: logistics.equipment.filter(row => row.active && !hasPrimary(row.resourceRoles, "owner")).map(row => row.id),
    systemsWithoutPrimaryPIIds: logistics.systems.filter(row => row.active && !hasPrimary(row.resourceRoles, "pi")).map(row => row.id),
    equipmentWithoutTaskIds: logistics.equipment.filter(row => !hasTask("equipment", row.id)).map(row => row.id),
    systemsWithoutTaskIds: logistics.systems.filter(row => !hasTask("system", row.id)).map(row => row.id),
    targetWithoutTaskIds: ledger.prepared.logistics!.targets.filter(row => !hasTask("target", row.id)).map(row => row.id),
    processWithoutTaskIds: logistics.processes.filter(row => !hasTask("process", row.id)).map(row => row.id),
    workAreaWithoutTaskIds: ledger.prepared.logistics!.workAreas.filter(row => !hasTask("workArea", row.id)).map(row => row.id),
    legacyContextTaskIds: [...ledger.diagnostics.legacyContextTaskIds], explicitEmptyProcessTaskIds: [...ledger.diagnostics.explicitEmptyProcessTaskIds],
  };
  const integrated: LogisticsIntegratedKpiDto = {
    source: "direct+target:v1", contextSourceVersion: "explicit-task-context:v1", dataSnapshotId,
    snapshotId: resourceFingerprint({ version: "logistics-kpi:v1", dataSnapshotId, filter, asOfDate: result.asOfDate, horizonDays: result.horizonDays, mdPerMm: result.effort.mdPerMm }),
    filters: filter, assignmentIds: sorted(selectedAssignments.map(row => row.id)), effortState: commonEffort.state,
    assignmentRows: assignments.map(row => ({ id: row.id, taskId: row.taskId, targetKind: row.target.kind, targetId: row.target.id,
      targetName: row.target.kind === "resource" ? byResource.get(row.target.id)?.name ?? row.target.id : input.groups.find(group => group.id === row.target.id)?.name ?? row.target.id,
      allocationPercent: row.allocation?.percent ?? null })),
    resourceRows: input.resources.map(row => ({ id: row.id, name: row.name, code: row.code })),
    taskSources: ledger.rows.map(row => ({ taskId: row.taskId, processIds: [...row.processIds], workAreaIds: [...row.workAreaIds], equipmentIds: [...row.equipmentIds],
      systemIds: [...row.systemIds], targetIds: [...row.targetIds], sources: [...row.sources] })),
    configuration: {
      scope: "registered configuration; independent from related Task/Assignment population", processIds: activeProcessIds, workAreaIds: workAreas.map(row => row.id),
      equipmentIds: equipment.map(row => row.id), equipmentQuantity: equipment.reduce((sum, row) => sum + row.quantity, 0), systemIds: systems.map(row => row.id),
      registeredResourceIds: registered.map(row => row.id), participatingResourceIds: ledger.configuration.resourceMemberships.filter(row => !filter.activeOnly || row.active).map(row => row.id),
      assignedResourceIds: sorted(personal.filter(row => !filter.activeOnly || byResource.get(row.target.id)?.active).map(row => row.target.id)),
      targets: targets.map(row => ({ id: row.id, name: (row as typeof row & { name?: string }).name ?? row.id, active: row.active !== false,
        taskIds: ordinaryRows.filter(task => task.targetIds.includes(row.id)).map(task => task.taskId) })),
      workAreas: workAreas.map(row => {
        // Configuration drills use the full canonical ordinary Task/Assignment population;
        // KPI-selected `included` is reserved for the headline and its breakdowns.
        const taskIds = ordinaryRows.filter(task => task.workAreaIds.includes(row.id)).map(task => task.taskId), selected = new Set(taskIds);
        const equipmentIds = sorted(ledger.configuration.equipmentWorkAreas.filter(link => link.workAreaId === row.id && equipment.some(item => item.id === link.equipmentId)).map(link => link.equipmentId));
        return { id: row.id, name: (row as typeof row & { name?: string }).name ?? row.id, active: ledger.input.workAreaActivity?.find(item => item.id === row.id)?.active !== false, processIds: ledger.prepared.logistics!.processes.filter(process => process.occurrenceId === row.occurrenceId).map(process => process.id), taskIds,
          assignmentIds: sorted(personal.filter(assignment => selected.has(assignment.taskId)).map(assignment => assignment.id)), equipmentIds,
          equipmentQuantity: equipment.filter(item => equipmentIds.includes(item.id)).reduce((sum, item) => sum + item.quantity, 0) };
      }),
    }, diagnostics: diagnostic,
  };
  result.integrated = integrated;
  if (Buffer.byteLength(JSON.stringify({ data: result })) > 2 * 1024 * 1024) throw limit();
  return result;
}

export class LogisticsKpiService extends LogisticsDashboardService {
  constructor(private readonly kpiDatabase: Database.Database, private readonly kpiOptions: { clock?: () => Date; mdPerMmEnvironment?: string } = {}) {
    super(kpiDatabase, kpiOptions);
  }
  override getDashboard(publicId: string, filter: LogisticsDashboardFilterInput = {}): LogisticsDashboardDto | undefined {
    return this.kpiDatabase.transaction(() => {
      try {
        const snapshot = readLogisticsKpiSnapshot(this.kpiDatabase, publicId, filter, (this.kpiOptions.clock ?? (() => new Date()))(), this.kpiOptions.mdPerMmEnvironment);
        return snapshot ? calculateLogisticsIntegratedKpi(snapshot.input, snapshot.ledger, snapshot.raw.context.dataSnapshotId) : undefined;
      } catch (error) {
        if (error instanceof ResourceKpiTargetLimitError) throw limit();
        if (error instanceof WbsTaskLedgerInputError || error instanceof ResourceKpiTargetInputError) throw new PublicApiError(422, "KPI_SOURCE_INVALID", "물류 KPI 원본의 문맥과 연결을 확인해 주세요.");
        throw error;
      }
    })();
  }
}
