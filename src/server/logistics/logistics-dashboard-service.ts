import type Database from "better-sqlite3";
import type {
  LogisticsDashboardDto,
  LogisticsDashboardFilterInput,
  LogisticsDashboardKpiDto,
  LogisticsDashboardEffortDto,
  LogisticsDashboardQualityDiagnosticsDto,
  LogisticsDashboardProcessRowDto,
  LogisticsDashboardEquipmentRowDto,
  LogisticsDashboardSystemRowDto,
} from "../../contracts/logistics-dashboard";
import type {
  ProjectLogisticsDto,
  ProcessDto,
  EquipmentDto,
  LogisticsSystemDto,
} from "../../contracts/logistics";
import type { ProjectAssignmentDto, ResourceDto, ResourceGroupDto } from "../../contracts/resources";
import type { ProjectTaskDto, ProjectDto } from "../../contracts/projects";
import { workingDaysBetween, type WorkingCalendar } from "../../domain/scheduling/calendar";
import { resolveResourceWorkingCalendar } from "../calendars/calendar-resolution-core";
import { dateToOrdinal, ordinalToDate, parseDateOnly } from "../../domain/scheduling/date-only";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ProjectOwnerRepository } from "../repositories/project-owner-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { LogisticsService } from "./logistics-service-core";

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function addDaysToDateString(dateStr: string, days: number): string {
  const ordinal = dateToOrdinal(dateStr) + days;
  return ordinalToDate(ordinal);
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export interface EffectiveTaskLogistics {
  directEquipmentIds: Set<string>;
  directSystemIds: Set<string>;
  effectiveEquipmentIds: Set<string>;
  effectiveSystemIds: Set<string>;
}

export function buildAllEffectiveTaskLogistics(
  tasks: ProjectTaskDto[],
  logistics: ProjectLogisticsDto,
): Map<string, EffectiveTaskLogistics> {
  const taskById = new Map<string, ProjectTaskDto>();
  const taskByExternalId = new Map<string, ProjectTaskDto>();
  for (const t of tasks) {
    taskById.set(t.taskId, t);
    taskByExternalId.set(t.externalId, t);
  }

  const directEquipMap = new Map<string, Set<string>>();
  const subtreeEquipMap = new Map<string, Set<string>>();
  for (const link of logistics.taskEquipmentLinks ?? []) {
    if (!directEquipMap.has(link.taskId)) directEquipMap.set(link.taskId, new Set());
    directEquipMap.get(link.taskId)!.add(link.equipmentId);
    if (link.scope === "subtree") {
      if (!subtreeEquipMap.has(link.taskId)) subtreeEquipMap.set(link.taskId, new Set());
      subtreeEquipMap.get(link.taskId)!.add(link.equipmentId);
    }
  }

  const directSysMap = new Map<string, Set<string>>();
  const subtreeSysMap = new Map<string, Set<string>>();
  for (const link of logistics.taskSystemLinks ?? []) {
    if (!directSysMap.has(link.taskId)) directSysMap.set(link.taskId, new Set());
    directSysMap.get(link.taskId)!.add(link.systemId);
    if (link.scope === "subtree") {
      if (!subtreeSysMap.has(link.taskId)) subtreeSysMap.set(link.taskId, new Set());
      subtreeSysMap.get(link.taskId)!.add(link.systemId);
    }
  }

  const result = new Map<string, EffectiveTaskLogistics>();

  for (const t of tasks) {
    const directEquip = directEquipMap.get(t.taskId) ?? new Set<string>();
    const directSys = directSysMap.get(t.taskId) ?? new Set<string>();

    const effectiveEquip = new Set<string>(directEquip);
    const effectiveSys = new Set<string>(directSys);

    // 조상 Summary 순회하여 subtree 상속 수집
    let currentParentExtId = t.parentExternalId;
    while (currentParentExtId) {
      const parentTask = taskByExternalId.get(currentParentExtId);
      if (!parentTask) break;
      const subEq = subtreeEquipMap.get(parentTask.taskId);
      if (subEq) {
        for (const eqId of subEq) effectiveEquip.add(eqId);
      }
      const subSys = subtreeSysMap.get(parentTask.taskId);
      if (subSys) {
        for (const sysId of subSys) effectiveSys.add(sysId);
      }
      currentParentExtId = parentTask.parentExternalId;
    }

    result.set(t.taskId, {
      directEquipmentIds: directEquip,
      directSystemIds: directSys,
      effectiveEquipmentIds: effectiveEquip,
      effectiveSystemIds: effectiveSys,
    });
  }

  return result;
}

export interface CalculateDashboardInput {
  project: ProjectDto;
  catalogRevision: number;
  tasks: ProjectTaskDto[];
  logistics: ProjectLogisticsDto;
  assignments: ProjectAssignmentDto[];
  resources: ResourceDto[];
  groups: ResourceGroupDto[];
  calendarForResource: (resourceId: string) => WorkingCalendar;
  filter: LogisticsDashboardFilterInput;
  now?: Date;
}

export function calculateLogisticsDashboardPure(input: CalculateDashboardInput): LogisticsDashboardDto {
  const {
    project,
    catalogRevision,
    tasks,
    logistics,
    assignments,
    resources,
    calendarForResource,
    filter,
  } = input;

  const timezone = project.calendar?.timezone ?? "Asia/Seoul";
  const now = input.now ?? new Date();
  const asOfDate = filter.asOfDate ?? dateInTimeZone(now, timezone);
  parseDateOnly(asOfDate, "asOfDate");

  const horizonDays = Math.max(1, Math.min(90, Math.floor(filter.horizonDays ?? 14)));
  const systemView = filter.systemView ?? "direct";
  const activeOnly = filter.activeOnly ?? false;
  const includeDescendantProcesses = filter.includeDescendantProcesses ?? true;
  const mdPerMm = filter.mdPerMm ?? 20;

  const calculatedAt = now.toISOString();

  // Fast lookups
  const processById = new Map<string, ProcessDto>();
  const childProcessesByParentId = new Map<string, string[]>();
  for (const p of logistics.processes) {
    processById.set(p.id, p);
    if (p.parentProcessId) {
      if (!childProcessesByParentId.has(p.parentProcessId)) {
        childProcessesByParentId.set(p.parentProcessId, []);
      }
      childProcessesByParentId.get(p.parentProcessId)!.push(p.id);
    }
  }

  const equipmentById = new Map<string, EquipmentDto>();
  for (const eq of logistics.equipment) {
    equipmentById.set(eq.id, eq);
  }

  const systemById = new Map<string, LogisticsSystemDto>();
  for (const sys of logistics.systems) {
    systemById.set(sys.id, sys);
  }

  const resourceById = new Map<string, ResourceDto>();
  for (const res of resources) {
    resourceById.set(res.id, res);
  }

  // Coordinator 자손 시스템 DAG 순회 헬퍼
  const getCoordinatorDescendantSystemIds = (rootSystemId: string): Set<string> => {
    const visited = new Set<string>();
    const queue = [rootSystemId];
    visited.add(rootSystemId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentSys = systemById.get(currentId);
      if (!currentSys || !currentSys.coordinatedSystemIds) continue;
      for (const childId of currentSys.coordinatedSystemIds) {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push(childId);
        }
      }
    }
    return visited;
  };

  // 공정 자손 수집 헬퍼
  const getAllDescendantProcessIds = (processId: string): Set<string> => {
    const set = new Set<string>();
    const queue = [processId];
    set.add(processId);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const children = childProcessesByParentId.get(curr) ?? [];
      for (const ch of children) {
        if (!set.has(ch)) {
          set.add(ch);
          queue.push(ch);
        }
      }
    }
    return set;
  };

  // 유효 연결 맵 생성
  const taskLogisticsMap = buildAllEffectiveTaskLogistics(tasks, logistics);

  // 작업별 직접 할당 자원 ID 맵
  const taskDirectAssigneeIds = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (a.target.kind === "resource") {
      if (!taskDirectAssigneeIds.has(a.taskId)) {
        taskDirectAssigneeIds.set(a.taskId, new Set());
      }
      taskDirectAssigneeIds.get(a.taskId)!.add(a.target.id);
    }
  }

  // 필터 대상 계산
  const hasFilter =
    (filter.processIds && filter.processIds.length > 0) ||
    (filter.equipmentIds && filter.equipmentIds.length > 0) ||
    (filter.systemIds && filter.systemIds.length > 0) ||
    (filter.taskAssigneeResourceIds && filter.taskAssigneeResourceIds.length > 0) ||
    (filter.roleResourceIds && filter.roleResourceIds.length > 0) ||
    activeOnly;

  // 공정 필터 대상 프로세스 ID 집합
  let filterTargetProcessIds: Set<string> | null = null;
  if (filter.processIds && filter.processIds.length > 0) {
    filterTargetProcessIds = new Set<string>();
    for (const pid of filter.processIds) {
      if (includeDescendantProcesses) {
        for (const d of getAllDescendantProcessIds(pid)) {
          filterTargetProcessIds.add(d);
        }
      } else {
        filterTargetProcessIds.add(pid);
      }
    }
  }

  const filterTargetEquipmentIds = filter.equipmentIds && filter.equipmentIds.length > 0
    ? new Set<string>(filter.equipmentIds)
    : null;

  // 시스템 필터 대상 집합 (coordination 뷰 반영)
  let filterTargetSystemIds: Set<string> | null = null;
  let filterCoordinationEquipmentIds: Set<string> | null = null;
  if (filter.systemIds && filter.systemIds.length > 0) {
    if (systemView === "coordination") {
      filterTargetSystemIds = new Set<string>();
      filterCoordinationEquipmentIds = new Set<string>();
      for (const sysId of filter.systemIds) {
        const descendantSysIds = getCoordinatorDescendantSystemIds(sysId);
        for (const sId of descendantSysIds) {
          filterTargetSystemIds.add(sId);
        }
      }
      // descendantSysIds 안의 컨트롤러가 제어하는 설비 ID 수집
      for (const sId of filterTargetSystemIds) {
        for (const eq of logistics.equipment) {
          if (eq.controlSystems?.some((s) => s.systemId === sId)) {
            filterCoordinationEquipmentIds.add(eq.id);
          }
        }
      }
    } else {
      filterTargetSystemIds = new Set<string>(filter.systemIds);
    }
  }

  const filterTaskAssigneeResourceIds = filter.taskAssigneeResourceIds && filter.taskAssigneeResourceIds.length > 0
    ? new Set<string>(filter.taskAssigneeResourceIds)
    : null;

  const filterRoleResourceIds = filter.roleResourceIds && filter.roleResourceIds.length > 0
    ? new Set<string>(filter.roleResourceIds)
    : null;

  // Leaf 태스크 및 마일스톤 분류 및 필터링
  const includedTasks: ProjectTaskDto[] = [];
  const includedMilestones: ProjectTaskDto[] = [];

  for (const t of tasks) {
    if (t.type === "summary") continue; // Summary는 KPI 직접 대상 아님

    const effective = taskLogisticsMap.get(t.taskId) ?? {
      directEquipmentIds: new Set(),
      directSystemIds: new Set(),
      effectiveEquipmentIds: new Set(),
      effectiveSystemIds: new Set(),
    };

    if (hasFilter) {
      // 1. 공정 필터
      if (filterTargetProcessIds) {
        let match = false;
        // 설비 연결 확인
        for (const eqId of effective.effectiveEquipmentIds) {
          const eq = equipmentById.get(eqId);
          if (eq && filterTargetProcessIds.has(eq.processId)) {
            match = true;
            break;
          }
        }
        // 시스템 연결 확인
        if (!match) {
          for (const sysId of effective.effectiveSystemIds) {
            const sys = systemById.get(sysId);
            if (sys && sys.processIds?.some((p) => filterTargetProcessIds!.has(p))) {
              match = true;
              break;
            }
          }
        }
        if (!match) continue;
      }

      // 2. 설비 필터
      if (filterTargetEquipmentIds) {
        let match = false;
        for (const eqId of effective.effectiveEquipmentIds) {
          if (filterTargetEquipmentIds.has(eqId)) {
            match = true;
            break;
          }
        }
        if (!match) continue;
      }

      // 3. 시스템 필터
      if (filterTargetSystemIds) {
        let match = false;
        for (const sysId of effective.effectiveSystemIds) {
          if (filterTargetSystemIds.has(sysId)) {
            match = true;
            break;
          }
        }
        if (!match && filterCoordinationEquipmentIds) {
          for (const eqId of effective.effectiveEquipmentIds) {
            if (filterCoordinationEquipmentIds.has(eqId)) {
              match = true;
              break;
            }
          }
        }
        if (!match) continue;
      }

      // 4. 작업 직접 담당 리소스 필터
      if (filterTaskAssigneeResourceIds) {
        const assignees = taskDirectAssigneeIds.get(t.taskId);
        if (!assignees || ![...assignees].some((id) => filterTaskAssigneeResourceIds!.has(id))) {
          continue;
        }
      }

      // 5. 설비/시스템 역할 리소스 필터
      if (filterRoleResourceIds) {
        let match = false;
        // 설비 역할
        for (const eqId of effective.effectiveEquipmentIds) {
          const eq = equipmentById.get(eqId);
          if (eq?.resourceRoles?.some((r) => filterRoleResourceIds!.has(r.resourceId))) {
            match = true;
            break;
          }
        }
        // 시스템 역할
        if (!match) {
          for (const sysId of effective.effectiveSystemIds) {
            const sys = systemById.get(sysId);
            if (sys?.resourceRoles?.some((r) => filterRoleResourceIds!.has(r.resourceId))) {
              match = true;
              break;
            }
          }
        }
        if (!match) continue;
      }

      // 6. activeOnly 필터
      if (activeOnly) {
        let hasActiveTarget = false;
        for (const eqId of effective.effectiveEquipmentIds) {
          const eq = equipmentById.get(eqId);
          if (eq?.active) {
            hasActiveTarget = true;
            break;
          }
        }
        if (!hasActiveTarget) {
          for (const sysId of effective.effectiveSystemIds) {
            const sys = systemById.get(sysId);
            if (sys?.active) {
              hasActiveTarget = true;
              break;
            }
          }
        }
        // 물류 타겟이 아예 없거나 모두 inactive이면 제외
        if (!hasActiveTarget) continue;
      }
    }

    if (t.type === "task") {
      includedTasks.push(t);
    } else if (t.type === "milestone") {
      includedMilestones.push(t);
    }
  }

  // 1. 기간 가중 진척률
  let totalDuration = 0;
  let weightedProgressSum = 0;
  const overdueTaskIds: string[] = [];

  for (const t of includedTasks) {
    const dur = Math.max(1, t.duration);
    totalDuration += dur;
    weightedProgressSum += dur * t.progress;

    // 미완료 지연 일반 작업: progress < 100 AND inclusive end < asOfDate
    if (t.progress < 100 && t.end < asOfDate) {
      overdueTaskIds.push(t.taskId);
    }
  }

  const progressPercent = totalDuration > 0 ? round4(weightedProgressSum / totalDuration) : null;

  // 2. Milestone 경보
  const upcomingLimitDate = addDaysToDateString(asOfDate, horizonDays - 1);
  const milestoneOverdueIds: string[] = [];
  const milestoneUpcomingIds: string[] = [];

  for (const m of includedMilestones) {
    if (m.progress < 100) {
      const due = m.start; // 마일스톤 start === end
      if (due < asOfDate) {
        milestoneOverdueIds.push(m.taskId);
      } else if (due >= asOfDate && due <= upcomingLimitDate) {
        milestoneUpcomingIds.push(m.taskId);
      }
    }
  }

  const kpi: LogisticsDashboardKpiDto = {
    progressPercent,
    totalDuration,
    taskCount: includedTasks.length,
    overdueTaskCount: overdueTaskIds.length,
    overdueTaskIds,
    milestoneTotalCount: includedMilestones.length,
    milestoneOverdueCount: milestoneOverdueIds.length,
    milestoneOverdueIds,
    milestoneUpcomingCount: milestoneUpcomingIds.length,
    milestoneUpcomingIds,
  };

  // 3. 보조 계획 공수 계산
  const includedTaskIdSet = new Set<string>(includedTasks.map((t) => t.taskId));
  const uniqueEffort = new Map<string, number>();
  let unsetAllocationCount = 0;
  let minWorkloadDate: string | null = null;
  let maxWorkloadDate: string | null = null;

  for (const a of assignments) {
    if (a.target.kind !== "resource") continue;
    if (!includedTaskIdSet.has(a.taskId)) continue;

    const task = tasks.find((t) => t.taskId === a.taskId);
    if (!task || task.type !== "task") continue;

    const effectiveStart = a.allocation?.start ?? task.start;
    const effectiveEnd = a.allocation?.end ?? task.end;

    if (!minWorkloadDate || effectiveStart < minWorkloadDate) minWorkloadDate = effectiveStart;
    if (!maxWorkloadDate || effectiveEnd > maxWorkloadDate) maxWorkloadDate = effectiveEnd;

    if (a.allocation?.percent === null || a.allocation?.percent === undefined) {
      unsetAllocationCount += 1;
      continue;
    }

    const calendar = calendarForResource(a.target.id);
    const effort = round4((workingDaysBetween(effectiveStart, effectiveEnd, calendar) * a.allocation.percent) / 100);
    uniqueEffort.set(a.id, effort);
  }

  const plannedMd = round4([...uniqueEffort.values()].reduce((sum, v) => sum + v, 0));
  const plannedMm = mdPerMm !== null && mdPerMm > 0 ? round4(plannedMd / mdPerMm) : null;

  const effort: LogisticsDashboardEffortDto = {
    plannedMd,
    plannedMm,
    mdPerMm,
    unsetAllocationCount,
    workloadRange: {
      from: minWorkloadDate,
      to: maxWorkloadDate,
    },
  };

  // 4. 품질 진단 계산
  const allLeafTasks = tasks.filter((t) => t.type !== "summary");
  let unlinkedLeafTaskCount = 0;
  for (const lt of allLeafTasks) {
    const eff = taskLogisticsMap.get(lt.taskId);
    if (!eff || (eff.effectiveEquipmentIds.size === 0 && eff.effectiveSystemIds.size === 0)) {
      unlinkedLeafTaskCount += 1;
    }
  }

  let equipmentWithoutPrimaryControllerCount = 0;
  let equipmentWithoutOwnerCount = 0;
  let totalEquipmentQuantity = 0;
  for (const eq of logistics.equipment) {
    totalEquipmentQuantity += eq.quantity;
    if (eq.active) {
      const hasPrimarySys = eq.controlSystems?.some((s) => s.controlRole === "primary");
      if (!hasPrimarySys) equipmentWithoutPrimaryControllerCount += 1;

      const hasPrimaryOwner = eq.resourceRoles?.some((r) =>
        r.role === "owner" &&
        r.isPrimary &&
        r.active !== false &&
        resourceById.get(r.resourceId)?.active !== false
      );
      if (!hasPrimaryOwner) equipmentWithoutOwnerCount += 1;
    }
  }

  let systemsWithoutPrimaryPICount = 0;
  for (const sys of logistics.systems) {
    if (sys.active) {
      const hasPrimaryPI = sys.resourceRoles?.some((r) =>
        r.role === "pi" &&
        r.isPrimary &&
        r.active !== false &&
        resourceById.get(r.resourceId)?.active !== false
      );
      if (!hasPrimaryPI) systemsWithoutPrimaryPICount += 1;
    }
  }

  const quality: LogisticsDashboardQualityDiagnosticsDto = {
    unlinkedLeafTaskCount,
    totalLeafTaskCount: allLeafTasks.length,
    unlinkedLeafTaskPercent: allLeafTasks.length > 0 ? round4((unlinkedLeafTaskCount / allLeafTasks.length) * 100) : null,
    equipmentWithoutPrimaryControllerCount,
    equipmentWithoutOwnerCount,
    systemsWithoutPrimaryPICount,
    totalEquipmentMasterCount: logistics.equipment.length,
    totalEquipmentQuantity,
  };

  // 5. Breakdowns 계산
  // 공정별 집계
  const breakdownTasks = includedTasks;
  const breakdownProcesses = activeOnly ? logistics.processes.filter((proc) => proc.active) : logistics.processes;
  const breakdownEquipment = activeOnly ? logistics.equipment.filter((eq) => eq.active) : logistics.equipment;
  const breakdownSystems = activeOnly ? logistics.systems.filter((sys) => sys.active) : logistics.systems;

  const processRows: LogisticsDashboardProcessRowDto[] = breakdownProcesses.map((proc) => {
    // 해당 공정에 속한 설비들
    const procEqIds = new Set(logistics.equipment.filter((eq) => eq.processId === proc.id).map((eq) => eq.id));
    // 해당 공정에 매핑된 시스템들
    const procSysIds = new Set(logistics.systems.filter((s) => s.processIds?.includes(proc.id)).map((s) => s.id));

    const matchedTasks: ProjectTaskDto[] = [];
    const matchedTaskIds = new Set<string>();

    for (const t of breakdownTasks) {
      const eff = taskLogisticsMap.get(t.taskId);
      if (!eff) continue;
      let match = false;
      for (const eqId of eff.effectiveEquipmentIds) {
        if (procEqIds.has(eqId)) { match = true; break; }
      }
      if (!match) {
        for (const sysId of eff.effectiveSystemIds) {
          if (procSysIds.has(sysId)) { match = true; break; }
        }
      }
      if (match) {
        matchedTasks.push(t);
        matchedTaskIds.add(t.taskId);
      }
    }

    let durSum = 0;
    let weightSum = 0;
    let overdueCount = 0;
    for (const t of matchedTasks) {
      const dur = Math.max(1, t.duration);
      durSum += dur;
      weightSum += dur * t.progress;
      if (t.progress < 100 && t.end < asOfDate) overdueCount += 1;
    }

    // 공수
    let mdSum = 0;
    for (const a of assignments) {
      if (a.target.kind === "resource" && matchedTaskIds.has(a.taskId) && a.allocation?.percent) {
        const t = tasks.find((item) => item.taskId === a.taskId);
        if (t && t.type === "task") {
          const s = a.allocation.start ?? t.start;
          const e = a.allocation.end ?? t.end;
          const cal = calendarForResource(a.target.id);
          mdSum += (workingDaysBetween(s, e, cal) * a.allocation.percent) / 100;
        }
      }
    }

    return {
      id: proc.id,
      code: proc.code,
      name: proc.name,
      active: proc.active,
      taskCount: matchedTasks.length,
      progressPercent: durSum > 0 ? round4(weightSum / durSum) : null,
      overdueTaskCount: overdueCount,
      plannedMd: round4(mdSum),
      taskIds: [...matchedTaskIds],
    };
  });

  // 설비별 집계
  const equipmentRows: LogisticsDashboardEquipmentRowDto[] = breakdownEquipment.map((eq) => {
    const matchedTasks: ProjectTaskDto[] = [];
    const matchedTaskIds = new Set<string>();

    for (const t of breakdownTasks) {
      const eff = taskLogisticsMap.get(t.taskId);
      if (eff?.effectiveEquipmentIds.has(eq.id)) {
        matchedTasks.push(t);
        matchedTaskIds.add(t.taskId);
      }
    }

    let durSum = 0;
    let weightSum = 0;
    let overdueCount = 0;
    for (const t of matchedTasks) {
      const dur = Math.max(1, t.duration);
      durSum += dur;
      weightSum += dur * t.progress;
      if (t.progress < 100 && t.end < asOfDate) overdueCount += 1;
    }

    let mdSum = 0;
    for (const a of assignments) {
      if (a.target.kind === "resource" && matchedTaskIds.has(a.taskId) && a.allocation?.percent) {
        const t = tasks.find((item) => item.taskId === a.taskId);
        if (t && t.type === "task") {
          const s = a.allocation.start ?? t.start;
          const e = a.allocation.end ?? t.end;
          const cal = calendarForResource(a.target.id);
          mdSum += (workingDaysBetween(s, e, cal) * a.allocation.percent) / 100;
        }
      }
    }

    const proc = processById.get(eq.processId);
    const primarySysMap = eq.controlSystems?.find((s) => s.controlRole === "primary");
    const primarySys = primarySysMap ? systemById.get(primarySysMap.systemId) : null;
    const primaryOwnerRole = eq.resourceRoles?.find((r) => r.role === "owner" && r.isPrimary);
    const primaryOwner = primaryOwnerRole ? resourceById.get(primaryOwnerRole.resourceId) : null;

    return {
      id: eq.id,
      code: eq.code,
      name: eq.name,
      equipmentType: eq.equipmentType,
      quantity: eq.quantity,
      processId: eq.processId,
      processName: proc?.name ?? null,
      primaryControllerName: primarySys?.name ?? null,
      ownerName: primaryOwner?.name ?? null,
      active: eq.active,
      taskCount: matchedTasks.length,
      progressPercent: durSum > 0 ? round4(weightSum / durSum) : null,
      overdueTaskCount: overdueCount,
      plannedMd: round4(mdSum),
      taskIds: [...matchedTaskIds],
    };
  });

  // 시스템별 집계
  const systemRows: LogisticsDashboardSystemRowDto[] = breakdownSystems.map((sys) => {
    const matchedTasks: ProjectTaskDto[] = [];
    const matchedTaskIds = new Set<string>();

    const targetSysIds = systemView === "coordination"
      ? getCoordinatorDescendantSystemIds(sys.id)
      : new Set([sys.id]);

    const coordinationEqIds = new Set<string>();
    if (systemView === "coordination") {
      for (const sId of targetSysIds) {
        for (const eq of logistics.equipment) {
          if (eq.controlSystems?.some((s) => s.systemId === sId)) {
            coordinationEqIds.add(eq.id);
          }
        }
      }
    }

    for (const t of breakdownTasks) {
      const eff = taskLogisticsMap.get(t.taskId);
      if (!eff) continue;
      let match = false;
      for (const sId of targetSysIds) {
        if (eff.effectiveSystemIds.has(sId)) { match = true; break; }
      }
      if (!match && systemView === "coordination") {
        for (const eqId of coordinationEqIds) {
          if (eff.effectiveEquipmentIds.has(eqId)) { match = true; break; }
        }
      }
      if (match) {
        matchedTasks.push(t);
        matchedTaskIds.add(t.taskId);
      }
    }

    let durSum = 0;
    let weightSum = 0;
    let overdueCount = 0;
    for (const t of matchedTasks) {
      const dur = Math.max(1, t.duration);
      durSum += dur;
      weightSum += dur * t.progress;
      if (t.progress < 100 && t.end < asOfDate) overdueCount += 1;
    }

    let mdSum = 0;
    for (const a of assignments) {
      if (a.target.kind === "resource" && matchedTaskIds.has(a.taskId) && a.allocation?.percent) {
        const t = tasks.find((item) => item.taskId === a.taskId);
        if (t && t.type === "task") {
          const s = a.allocation.start ?? t.start;
          const e = a.allocation.end ?? t.end;
          const cal = calendarForResource(a.target.id);
          mdSum += (workingDaysBetween(s, e, cal) * a.allocation.percent) / 100;
        }
      }
    }

    const primaryPIRole = sys.resourceRoles?.find((r) => r.role === "pi" && r.isPrimary);
    const primaryPI = primaryPIRole ? resourceById.get(primaryPIRole.resourceId) : null;

    return {
      id: sys.id,
      code: sys.code,
      name: sys.name,
      systemType: sys.systemType,
      layer: sys.layer,
      primaryPIName: primaryPI?.name ?? null,
      active: sys.active,
      taskCount: matchedTasks.length,
      progressPercent: durSum > 0 ? round4(weightSum / durSum) : null,
      overdueTaskCount: overdueCount,
      plannedMd: round4(mdSum),
      taskIds: [...matchedTaskIds],
    };
  });

  return {
    projectRevision: project.revision,
    catalogRevision,
    asOfDate,
    timezone,
    calculatedAt,
    horizonDays,
    systemView,
    activeOnly,
    kpi,
    effort,
    quality,
    breakdowns: {
      processes: processRows,
      equipment: equipmentRows,
      systems: systemRows,
    },
    includedTaskIds: includedTasks.map((t) => t.taskId),
    includedMilestoneIds: includedMilestones.map((t) => t.taskId),
  };
}

export class LogisticsDashboardService {
  private readonly projects: ProjectRepository;
  private readonly owners: ProjectOwnerRepository;
  private readonly schedules: ScheduleRepository;
  private readonly logisticsService: LogisticsService;
  private readonly catalog: ResourceCatalogRepository;

  constructor(
    private readonly database: Database.Database,
    private readonly options?: { clock?: () => Date },
  ) {
    this.projects = new ProjectRepository(database);
    this.owners = new ProjectOwnerRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.logisticsService = new LogisticsService(database, options);
    this.catalog = new ResourceCatalogRepository(database);
  }

  getDashboard(projectPublicId: string, filter: LogisticsDashboardFilterInput = {}): LogisticsDashboardDto | undefined {
    const project = this.projects.findByPublicId(projectPublicId);
    if (!project) return undefined;

    // 하나의 read transaction 안에서 모든 데이터 일관성 있게 조회
    return this.database.transaction(() => {
      const tasks = this.schedules.listTasks(project.id).map((task) => ({
        taskId: task.publicId,
        externalId: task.externalId,
        name: task.name,
        type: task.type,
        scheduleMode: task.scheduleMode,
        requestedStart: task.requestedStart,
        start: task.startDate,
        end: task.endDate,
        duration: task.duration,
        progress: task.progress,
        parentExternalId: task.parentId
          ? this.schedules.findTaskById(project.id, task.parentId)?.externalId ?? null
          : null,
        siblingOrder: task.sortOrder,
      }));

      const logistics = this.logisticsService.getLogisticsDto(project.id);
      if (!logistics) return undefined;

      const assignments = this.catalog.listAssignments(project.id).map((a) => ({
        id: a.publicId,
        taskId: a.taskPublicId,
        target: { kind: a.kind, id: a.targetPublicId },
        allocation: {
          start: a.assignmentStart,
          end: a.assignmentEnd,
          percent: a.allocationPercent,
        },
      }));

      const resources = this.catalog.listResources().map((r) => ({
        id: r.publicId,
        name: r.name,
        code: r.code,
        description: r.description ?? "",
        active: r.active,
      }));

      const groups = this.catalog.listGroups().map((g) => ({
        id: g.publicId,
        name: g.name,
        code: g.code,
        description: g.description ?? "",
        active: g.active,
        memberResourceIds: g.memberResourceIds,
      }));

      const calendarCache = new Map<string, WorkingCalendar>();
      const calendarForResource = (resourceId: string): WorkingCalendar => {
        let cal = calendarCache.get(resourceId);
        if (!cal) {
          cal = resolveResourceWorkingCalendar(this.database, project.id, resourceId);
          calendarCache.set(resourceId, cal);
        }
        return cal;
      };

      const projectDto: ProjectDto = {
        publicId: project.publicId,
        name: project.name,
        description: project.description,
        status: project.status,
        ownerName: this.owners.findById(project.id) ?? null,
        revision: project.revision,
        calendar: {
          timezone: "Asia/Seoul",
          weekendDays: [6, 0],
          holidays: [],
        },
      };

      return calculateLogisticsDashboardPure({
        project: projectDto,
        catalogRevision: this.catalog.getRevision(),
        tasks,
        logistics,
        assignments,
        resources,
        groups,
        calendarForResource,
        filter,
        now: this.options?.clock ? this.options.clock() : new Date(),
      });
    })();
  }
}
