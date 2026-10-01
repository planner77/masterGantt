import { recalculateDependencies, type DependencyLinkInput } from "./dependency";
import { recalculateHierarchy, type HierarchyTaskInput } from "./hierarchy";
import { scheduleLeaf } from "./leaf";
import type { WorkingCalendar } from "./calendar";

/**
 * Rebuild every leaf from its request before applying the whole graph. Using
 * effective dates as the base would prevent successors from moving earlier.
 * No mutation or I/O; Manual conflicts are returned for atomic caller rejection.
 */
export function recalculateTaskCandidate<T extends HierarchyTaskInput>(
  tasks: readonly T[], links: readonly DependencyLinkInput[], calendar: WorkingCalendar,
) {
  const base = tasks.map((task) => {
    if (task.type === "summary") return { ...task };
    const scheduled = scheduleLeaf({
      type: task.type,
      requestedStart: task.requestedStart as string,
      duration: task.duration as number,
      scheduleMode: task.scheduleMode,
    }, calendar);
    return { ...task, start: scheduled.start, end: scheduled.end };
  });
  const dependency = recalculateDependencies(base, links, calendar);
  return {
    tasks: recalculateHierarchy(dependency.tasks, calendar),
    manualConflicts: dependency.manualConflicts,
  };
}
