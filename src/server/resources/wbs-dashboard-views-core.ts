import { selectWbsTaskLedger, summarizeWbsTaskLedger, summarizeWbsTaskLedgerConfiguration, type WbsTaskLedgerSnapshot, type WbsTaskLedgerSelection, type WbsTaskLedgerRow } from "../../domain/resources/wbs-task-ledger";
import { WBS_VIEW_LIMITS, type WbsViewQueryInput, type WbsViewPathEntry, type WbsViewDimension } from "../../contracts/wbs-dashboard-views";
import { getResourceKpiDiagnostics } from "../../domain/resources/resource-kpi";
import { PublicApiError } from "../http/api-error-core";
import { resourceFingerprint } from "./resource-data-context-core";
const limit = (): never => { throw new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", "WBS 조회 계층·출처 한도를 초과했습니다. 조회 단계 또는 범위를 줄여 주세요."); };
const unavailable = (): never => { throw new PublicApiError(400, "INVALID_SELECTION", "현재 WBS 조회의 정확한 경로를 다시 선택해 주세요."); };
import type { WbsViewNode } from "../../contracts/wbs-dashboard-views";
export function wbsViewSelectedSources(row: WbsTaskLedgerRow, assignmentIds: ReadonlySet<string>, path: readonly WbsViewPathEntry[] = []) {
  return row.sources.filter(source => {
    if (source.effective === false) return false;
    if (source.assignmentId) return assignmentIds.has(source.assignmentId);
    if (source.entityKind === "equipment" && !row.equipmentIds.includes(source.entityId) || source.entityKind === "system" && !row.systemIds.includes(source.entityId)) return false;
    if (["process", "workArea", "equipment", "system"].includes(source.dimension)) return path.filter(entry => entry.dimension === source.dimension).every(entry => entry.id === source.entityId);
    return true;
  });
}
/** View stages never create parent-child relations between sibling instance kinds. */
export function createWbsViewProjection(ledger: WbsTaskLedgerSnapshot, input: WbsViewQueryInput, labels: ReadonlyMap<string, string>, restriction?: { tasks: ReadonlySet<string>; assignments?: ReadonlySet<string> }) {
  const stages: WbsViewDimension[][] = [[input.spec.root], ...(input.spec.levels ?? []).map(level => typeof level === "string" ? [level] : level.dimensions)];
  let cells = 0, sourceRows = 0, candidateWork = 0;
  const select = (path: WbsViewPathEntry[]): WbsTaskLedgerSelection => {
    const value = selectWbsTaskLedger(ledger, path);
    if (!restriction) return value;
    let rows = value.rows.filter(row => restriction.tasks.has(row.taskId));
    const selectedIds = new Set(rows.map(row => row.taskId));
    const assignments = value.assignments.filter(row => selectedIds.has(row.taskId) && (!restriction.assignments || restriction.assignments.has(row.assignmentId)));
    const personalPath = path.filter(row => row.dimension === "resource" || row.dimension === "group" || row.dimension === "role");
    if (personalPath.length) {
      const assignedTaskIds = new Set(assignments.map(row => row.taskId));
      const rawAssignedTaskIds = new Set(ledger.prepared.assignments.filter(row => row.kind === "resource").map(row => row.taskId));
      rows = rows.filter(row => assignedTaskIds.has(row.taskId) || personalPath.every(entry => entry.id === null) && !rawAssignedTaskIds.has(row.taskId));
    }
    const taskIds = rows.map(row => row.taskId);
    const t0 = value.selection.t0.filter(row => restriction.tasks.has(row.taskId));
    return { ...value, rows, taskIds, assignments, assignmentIds: assignments.map(row => row.assignmentId), selection: { ...value.selection, assignments, t0, t0Ids: new Set(t0.map(row => row.taskId)) } };
  };
  const candidates = (path: WbsViewPathEntry[], dimension: WbsViewDimension) => {
    const current = select(path), projected: Array<string | null> = [];
    const add = (values: readonly string[]) => {
      candidateWork += Math.max(1, values.length);
      if (candidateWork > WBS_VIEW_LIMITS.sourceRows) limit();
      projected.push(...(values.length ? values : [null]));
    };
    if (dimension === "resource" || dimension === "group" || dimension === "role") {
      for (const row of current.assignments) add(dimension === "resource" ? [row.resourceId] : dimension === "group" ? row.groupIds : row.roles);
      const rawAssigned = new Set(ledger.prepared.assignments.filter(row => row.kind === "resource").map(row => row.taskId));
      if (current.rows.some(row => !rawAssigned.has(row.taskId))) add([]);
    } else for (const row of current.rows) add(dimension === "process" ? row.processIds : dimension === "workArea" ? row.workAreaIds : dimension === "equipment" ? row.equipmentIds : dimension === "system" ? row.systemIds : row.milestoneTaskId === null ? [] : [row.milestoneTaskId]);
    // Task candidates and registered configuration are independent populations.
    // Only real configuration axes may extend an empty Task branch.
    const logistics = ledger.prepared.logistics!;
    if (path.length && path.every(entry => ["process", "workArea", "equipment", "system"].includes(entry.dimension))) {
      const configuration = summarizeWbsTaskLedgerConfiguration(ledger, path);
      if (dimension === "equipment" || dimension === "system") {
        const ids = dimension === "equipment" ? configuration.equipmentIds : configuration.systemIds;
        if (ids.length) add(ids);
      }
      else if (dimension === "workArea") {
        const process = path.find(entry => entry.dimension === "process");
        const instancePath = path.some(entry => entry.dimension === "equipment" || entry.dimension === "system");
        const equipmentIds = new Set(configuration.equipmentIds);
        // A System reaches an area only through its actual controls relation.
        for (const systemId of configuration.systemIds) for (const equipment of ledger.configuration.equipment) {
          if (equipment.controlSystems.some(control => control.systemId === systemId)) equipmentIds.add(equipment.id);
        }
        const membershipAreas = new Set(ledger.configuration.equipmentWorkAreas.filter(row => equipmentIds.has(row.equipmentId)).map(row => row.workAreaId));
        const areas = logistics.workAreas.filter(area => (!process || process.id !== null && logistics.byProcess.get(process.id)!.occurrenceId === area.occurrenceId) && (!instancePath || membershipAreas.has(area.id)));
        add(areas.map(row => row.id));
        if (summarizeWbsTaskLedgerConfiguration(ledger, [...path, { dimension: "workArea", id: null }]).members.length) add([]);
      } else if (dimension === "process") {
        const area = path.find(entry => entry.dimension === "workArea");
        if (area?.id) add(logistics.processes.filter(process => process.occurrenceId === logistics.byWorkArea.get(area.id!)!.occurrenceId).map(process => process.id));
        else {
          for (const member of configuration.members) add(member.kind === "equipment" ? [...new Set([...(member.projectProcessId ? [member.projectProcessId] : []), ...ledger.configuration.equipmentWorkAreas.filter(row => row.equipmentId === member.entityId).map(row => row.processId)])] : ledger.configuration.systems.find(row => row.id === member.entityId)!.processIds);
        }
      }
    }
    if (!path.length) {
      if (dimension === "process") {
        projected.push(...logistics.processes.map(row => row.id));
        if (ledger.configuration.systems.some(row => row.scope === "project")) projected.push(null);
      }
      if (dimension === "workArea") projected.push(...logistics.workAreas.map(row => row.id));
      if (dimension === "equipment" || dimension === "system") projected.push(...logistics.instances.filter(row => row.kind === dimension).map(row => row.entityId));
      if (dimension === "resource") projected.push(...ledger.configuration.resourceMemberships.map(row => row.id));
      if (dimension === "group") projected.push(...ledger.groupIds);
      if (dimension === "milestone") projected.push(...ledger.prepared.tasks.filter(row => row.type === "milestone").map(row => row.taskId));
      if (dimension === "role") projected.push(...ledger.prepared.resources.flatMap(row => row.roles));
    }
    const result = [...new Set(projected)].sort((a, b) => a === null ? 1 : b === null ? -1 : a.localeCompare(b));
    if (result.length > WBS_VIEW_LIMITS.fanout) limit();
    return result;
  };
  const selectedPath = input.projection && input.projection.kind !== "report" ? input.projection.path : [];
  for (let depth = 0; depth < selectedPath.length; depth++) {
    const entry = selectedPath[depth];
    if (!stages[depth]?.includes(entry.dimension) || !candidates(selectedPath.slice(0, depth), entry.dimension).includes(entry.id)) unavailable();
  }
  const selected = select(selectedPath);
  const summary = (selection: WbsTaskLedgerSelection) => {
    const totals = summarizeWbsTaskLedger(ledger, selection);
    if (restriction?.assignments) totals.diagnostics = getResourceKpiDiagnostics({ ...ledger.prepared, assignments: ledger.prepared.assignments.filter(row => restriction.assignments!.has(row.assignmentId)) }, selection.selection);
    const { tasks, assignments, relatedMembers, configurationReference, diagnostics, participation } = totals;
    return { tasks, assignments, relatedMembers, configurationReference, diagnostics, participation };
  };
  const build = (path: WbsViewPathEntry[], depth: number): WbsViewNode[] => {
    if (depth === stages.length) return [];
    const entries = stages[depth].flatMap(dimension => candidates(path, dimension).map(id => ({ dimension, id })));
    if (entries.length > WBS_VIEW_LIMITS.fanout || cells + entries.length > WBS_VIEW_LIMITS.cells) limit();
    cells += entries.length;
    return entries.map(selector => {
      const childPath = [...path, selector], selection = select(childPath);
      const assignments = new Set(selection.assignmentIds);
      const provenance = selection.rows.map(row => ({ taskId: row.taskId, sources: wbsViewSelectedSources(row, assignments, childPath) }));
      for (const row of provenance) { sourceRows += row.sources.length; if (sourceRows > WBS_VIEW_LIMITS.sourceRows) limit(); }
      return { selector, path: childPath, viewRowKey: resourceFingerprint({ projectPublicId: ledger.input.snapshotProjectPublicId, spec: input.spec, path: childPath }), name: selector.id === null ? null : labels.get(JSON.stringify([selector.dimension, selector.id])) ?? selector.id,
        taskIds: selection.taskIds, assignmentIds: selection.assignmentIds, totals: summary(selection), provenance, children: build(childPath, depth + 1) };
    });
  };
  return { selected, totals: summary(selected), children: input.projection?.kind === "details" || input.projection?.kind === "scope" ? [] : build([], 0) };
}
