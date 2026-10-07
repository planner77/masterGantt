import { GanttDemo } from "@/features/gantt/gantt-demo";
import { getSchedulingRuntimeFixture } from "@/features/gantt/scheduling-runtime-fixture";
import { ErrorBoundaryProbe } from "@/features/testing/error-boundary-probe";
import { isE2eErrorBoundaryProbeEnabled } from "@/server/testing/error-boundary-probe-gate";

type GanttDemoPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function GanttDemoPage({ searchParams }: GanttDemoPageProps) {
  const params = await searchParams;
  const showBoundaryProbe =
    params.__e2eBoundary === "1" && isE2eErrorBoundaryProbeEnabled();

  return (
    <>
      {showBoundaryProbe ? <ErrorBoundaryProbe probeId="gantt-demo" /> : null}
      <GanttDemo serverSchedulingFixture={getSchedulingRuntimeFixture()} />
    </>
  );
}
