import { GanttDemo } from "@/features/gantt/gantt-demo";
import { getSchedulingRuntimeFixture } from "@/features/gantt/scheduling-runtime-fixture";

export default function GanttDemoPage() {
  return <GanttDemo serverSchedulingFixture={getSchedulingRuntimeFixture()} />;
}
