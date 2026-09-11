import type { Metadata } from "next";

import { GanttDemo } from "@/features/gantt/gantt-demo";
import { getSchedulingRuntimeFixture } from "@/features/gantt/scheduling-runtime-fixture";

export const metadata: Metadata = { title: "Gantt 데모" };

export default function GanttDemoPage() {
  return <GanttDemo serverSchedulingFixture={getSchedulingRuntimeFixture()} />;
}
