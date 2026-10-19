"use client";
import { createContext, useContext } from "react";
import type { ResourceExportEvidence } from "./resource-export-model";
import type { ResourceDashboardDto } from "@/contracts/resource-dashboard";
import type { ResourceDrillProjection } from "@/contracts/resource-drill";
import type { ResourceDrillBinding } from "./resource-drill-transport";
import type { WbsViewReportDto, WbsViewPathEntry } from "@/contracts/wbs-dashboard-views";
export interface WbsViewScheduleRequest {
  data: WbsViewReportDto;
  path: WbsViewPathEntry[];
  label: string;
  trigger: HTMLElement;
  taskId?: string;
  assignmentId?: string;
}
export interface ResourceScheduleRequest {
  data: ResourceDashboardDto;
  projection: Extract<ResourceDrillProjection, { kind: "scope" }>;
  label: string;
  trigger: HTMLElement;
  taskId?: string;
  assignmentId?: string;
  /** undefined: current Resource tab binding; null: whole-Project Logistics source. */
  binding?: ResourceDrillBinding | null;
}
export const ResourceDrillContext = createContext<{
  binding: ResourceDrillBinding | null;
  onSchedule?: (request: ResourceScheduleRequest) => void;
  onWbsSchedule?: (request: WbsViewScheduleRequest) => void;
  onReport?: (data: ResourceDashboardDto) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenAssignment?: (taskId: string, assignmentId: string, resourceId: string, trigger: HTMLElement) => void;
  onOpenTarget?: (targetId: string, trigger: HTMLElement, code?: string | null) => void;
  viewId?: number;
  onExport?: (trigger: HTMLButtonElement) => void;
  onExportEvidence?: (evidence: ResourceExportEvidence) => void;
  locked?: boolean;
}>({ binding: null });
export const useResourceDrill = () => useContext(ResourceDrillContext);
