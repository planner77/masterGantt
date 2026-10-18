import { notFound } from "next/navigation";
import { CoreActionTraceLoader } from "@/features/gantt/diagnostics/core-action-trace-loader";
import { isE2eErrorBoundaryProbeEnabled } from "@/server/testing/error-boundary-probe-gate";

export const dynamic = "force-dynamic";

export default function CoreActionTracePage() {
  if (!isE2eErrorBoundaryProbeEnabled()) notFound();
  return <CoreActionTraceLoader />;
}
