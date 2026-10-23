import type { ProjectLogisticsDto } from "@/contracts/logistics";
import type { ResourceDashboardStage, ResourceTargetDimension } from "@/contracts/resource-dashboard";

/** App-owned, read-only projections of the same Resource KPI snapshot (#619/#620). */
export const LOGISTICS_PERSPECTIVES = {
  process: { label: "공정 · WorkArea", order: ["processType", "process", "workArea", "target"] },
  equipment: { label: "설비 종류 · 인스턴스", order: ["equipmentType", "equipment", "target"] },
  system: { label: "시스템 종류 · 인스턴스", order: ["systemType", "system", "target"] },
  target: { label: "Target · Resource", order: ["target", "resource"] },
} as const satisfies Record<string, { label: string; order: readonly ResourceTargetDimension[] }>;
export type LogisticsPerspective = keyof typeof LOGISTICS_PERSPECTIVES;

/** Old details cannot be reused for a different query or canonical snapshot. */
export function currentLogisticsDetail<T extends { snapshotId: string; queryKey: string }>(
  selection: T | null,
  snapshotId: string | undefined,
  queryKey: string,
): T | null {
  return selection && snapshotId && selection.snapshotId === snapshotId && selection.queryKey === queryKey
    ? selection
    : null;
}

/** Configured physical quantity is not Task coverage, completed installation or effort. */
export function configuredLogisticsInventory(logistics: Pick<ProjectLogisticsDto, "equipment" | "systems">) {
  const equipment = new Map<string, number>();
  const conflicted = new Set<string>();
  for (const row of logistics.equipment) {
    if (equipment.has(row.id) && equipment.get(row.id) !== row.quantity) conflicted.add(row.id);
    else if (!equipment.has(row.id)) equipment.set(row.id, row.quantity);
  }
  const systems = new Set(logistics.systems.map(row => row.id));
  return {
    equipmentIds: [...equipment.keys()].sort(),
    systemIds: [...systems].sort(),
    equipmentQuantity: [...equipment.values()].reduce((sum, value) => sum + value, 0),
    conflictingEquipmentIds: [...conflicted].sort(),
  };
}

/** The full canonical Milestone gate cannot be redefined by the selected Task subset. */
export function fullMilestoneGateLabel(stage: ResourceDashboardStage): string {
  if (stage.full.blocked) return "Blocked";
  if (stage.full.ready === true) return "Ready";
  if (stage.full.ready === false) return "Not Ready";
  return "미판정";
}
