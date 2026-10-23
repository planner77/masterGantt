"use client";

import type { ProjectLogisticsDto } from "@/contracts/logistics";
import { EquipmentDashboard } from "@/features/resources/equipment-dashboard";
import { ProcessWorkareaDashboard } from "@/features/resources/process-workarea-dashboard";
import { SystemDashboard } from "@/features/resources/system-dashboard";
import type { WbsViewDimension } from "@/contracts/wbs-dashboard-views";
import { ResourceDrillContext, type WbsViewScheduleRequest, type ResourceScheduleRequest } from "@/features/resources/resource-drill-context";
import type { LogisticsPerspective } from "./logistics-unified-model";

interface Props {
  perspective?: LogisticsPerspective;
  onPerspectiveChange?: (view: LogisticsPerspective) => void;
  publicId: string;
  revision: number;
  active: boolean;
  busy: boolean;
  editable: boolean;
  logistics: ProjectLogisticsDto;
  onOpenTask?: (taskId: string, trigger?: HTMLElement) => void;
  onOpenAssignment?: (taskId: string, assignmentId: string, resourceId: string, trigger: HTMLElement) => void;
  onOpenMilestone?: (taskId: string) => void;
  onWbsSchedule?: (request: WbsViewScheduleRequest) => void;
  onWbsOpenEntity?: (dimension: WbsViewDimension, id: string, trigger: HTMLElement) => void;
  onResourceSchedule?: (request: ResourceScheduleRequest) => void;
}

/** Read-only physical views share the canonical WBS Task and Assignment ledger. */
export function ProjectLogisticsUnified(props: Props) {
  return (
    <ResourceDrillContext.Provider value={{
      binding: null,
      locked: props.busy,
      onWbsSchedule: props.onWbsSchedule,
      onOpenTask: props.onOpenTask,
      onOpenAssignment: props.editable ? props.onOpenAssignment : undefined,
      onSchedule: props.onResourceSchedule ? (request) => props.onResourceSchedule?.({ ...request, binding: null }) : undefined,
    }}>
      {(["process", "equipment", "system"] as const).map(root => {
        const Dashboard = root === "process" ? ProcessWorkareaDashboard : root === "equipment" ? EquipmentDashboard : SystemDashboard;
        return <div key={root} hidden={(props.perspective ?? "process") !== root} inert={(props.perspective ?? "process") !== root}><Dashboard logistics={props.logistics} publicId={props.publicId} revision={props.revision} active={props.active && (props.perspective ?? "process") === root} busy={props.busy} onOpenTask={props.onOpenTask} onOpenAssignment={props.editable ? props.onOpenAssignment : undefined} onOpenEntity={props.editable ? props.onWbsOpenEntity : undefined} onSchedule={props.onWbsSchedule}/></div>;
      })}
    </ResourceDrillContext.Provider>
  );
}
