"use client";
import { createContext, useContext } from "react";
import type { ResourceExportEvidence } from "./resource-export-model";
import type { ResourceDashboardDto } from "@/contracts/resource-dashboard";
import type { ResourceDrillProjection } from "@/contracts/resource-drill";
import type { ResourceDrillBinding } from "./resource-drill-transport";
export interface ResourceScheduleRequest {
  data: ResourceDashboardDto;
  projection: Extract<ResourceDrillProjection, { kind: "scope" }>;
  label: string;
  trigger: HTMLElement;
  taskId?: string;
  assignmentId?: string;
}
export const ResourceDrillContext = createContext<{
  binding: ResourceDrillBinding | null;
  onSchedule?: (request: ResourceScheduleRequest) => void;
  onReport?: (data: ResourceDashboardDto) => void;
  onOpenTask?: (taskId: string) => void;
  viewId?: number;
  onExport?: (trigger: HTMLButtonElement) => void;
  onExportEvidence?: (evidence: ResourceExportEvidence) => void;
  locked?: boolean;
}>({ binding: null });
export const useResourceDrill = () => useContext(ResourceDrillContext);
