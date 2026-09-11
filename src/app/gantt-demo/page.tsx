import type { Metadata } from "next";

import { GanttDemo } from "@/features/gantt/gantt-demo";

export const metadata: Metadata = { title: "Gantt 데모" };

export default function GanttDemoPage() {
  return <GanttDemo />;
}
