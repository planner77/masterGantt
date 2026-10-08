"use client";
import { useState } from "react";
import type { ResourceDashboardDto, ResourceDashboardFilterInput } from "@/contracts/resource-dashboard";
import { ProjectResourceDashboard } from "./project-resource-dashboard";
import {
  ResourceDrillContext,
  type ResourceScheduleRequest,
} from "./resource-drill-context";
import type { ResourceDrillBinding } from "./resource-drill-transport";

type Props = Readonly<{
  publicId: string;
  revision: number;
  active: boolean;
  refreshDisabled: boolean;
  onRefreshProject: () => void;
  viewId: number;
  binding: ResourceDrillBinding | null;
  initialFilters?: ResourceDashboardFilterInput;
  cacheGeneration: number;
  liveViewIds: readonly number[];
  onSchedule: (request: ResourceScheduleRequest) => void;
  onReport: (data: ResourceDashboardDto) => void;
  onOpenTask: (id: string) => void;
}>;
export function ProjectResourceWorkload({
  binding,
  viewId,
  initialFilters,
  cacheGeneration,
  liveViewIds,
  onSchedule,
  onOpenTask,
  onReport,
  ...props
}: Props) {
  const key = String(viewId);
  const [cache, setCache] = useState({
    generation: cacheGeneration,
    views: { "0": { binding: null } } as Record<
      string,
      {
        binding: ResourceDrillBinding | null;
        initialFilters?: ResourceDashboardFilterInput;
      }
    >,
  });
  const pinned = new Set(liveViewIds.map(String));
  pinned.add(key);
  let currentViews = cache.views;
  if (Object.keys(cache.views).some((id) => !pinned.has(id))) {
    currentViews = Object.fromEntries(
      Object.entries(cache.views).filter(([id]) => pinned.has(id)),
    );
  }
  if (!currentViews[key])
    currentViews = { ...currentViews, [key]: { binding, initialFilters } };
  if (currentViews !== cache.views)
    setCache({ generation: cacheGeneration, views: currentViews });
  return (
    <div data-resource-live-contexts={Object.keys(currentViews).length}>
      {Object.entries(currentViews).map(([id, view]) => (
        <div
          key={id}
          data-resource-context-id={id}
          hidden={id !== key}
          inert={id !== key}
        >
          <ResourceDrillContext.Provider
            value={{
              binding: view.binding,
              onSchedule,
              onOpenTask,
              onReport: id === key ? onReport : undefined,
              locked: props.refreshDisabled,
            }}
          >
            <ProjectResourceDashboard
              {...props}
              active={props.active && id === key}
              initialFilters={view.initialFilters}
            />
          </ResourceDrillContext.Provider>
        </div>
      ))}
    </div>
  );
}
