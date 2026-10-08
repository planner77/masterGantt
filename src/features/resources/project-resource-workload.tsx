"use client";

import { LegacyProjectResourceWorkload } from "./legacy-project-resource-workload";
import { ProjectResourceDashboard } from "./project-resource-dashboard";
import type { MilestoneResourceDrill } from "./milestone-resource-drill";

type Props = Readonly<{ publicId: string; revision: number; active: boolean; refreshDisabled: boolean; onRefreshProject: () => void; drillScope?: MilestoneResourceDrill | null; onClearDrillScope?: () => void }>;
export function ProjectResourceWorkload({ drillScope = null, onClearDrillScope, ...props }: Props) {
  return <>
    <div hidden={Boolean(drillScope)} inert={Boolean(drillScope)}><ProjectResourceDashboard {...props} active={props.active && !drillScope} /></div>
    {drillScope ? <LegacyProjectResourceWorkload publicId={props.publicId} drillScope={drillScope} onClearDrillScope={onClearDrillScope} /> : null}
  </>;
}
