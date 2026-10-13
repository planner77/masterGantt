import { notFound } from "next/navigation";
import { isE2eErrorBoundaryProbeEnabled } from "@/server/testing/error-boundary-probe-gate";
import { GanttAdapterLoader } from "@/features/gantt/diagnostics/gantt-adapter-loader";

export const dynamic = "force-dynamic";
export default async function GanttAdapterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isE2eErrorBoundaryProbeEnabled()) notFound();
  const params = await searchParams;
  return <GanttAdapterLoader mode={params.mode === "A" || params.mode === "C" ? params.mode : "B"} scale={params.scale === "week" ? "week" : "day"} />;
}
