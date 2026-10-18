import { notFound } from "next/navigation";

import { ErrorBoundaryProbe } from "@/features/testing/error-boundary-probe";
import { isE2eErrorBoundaryProbeEnabled } from "@/server/testing/error-boundary-probe-gate";

export const dynamic = "force-dynamic";

export default function E2eErrorBoundaryPage() {
  if (!isE2eErrorBoundaryProbeEnabled()) notFound();

  return <ErrorBoundaryProbe probeId="root" />;
}
