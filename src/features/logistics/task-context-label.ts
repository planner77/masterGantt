import type { ProjectTaskDto } from "@/contracts/projects";

/** Display canonical external-ID ancestry; no independent schedule/WBS calculation. */
export function taskContextLabels(tasks: readonly ProjectTaskDto[]): Record<string, string> {
  const byExternalId = new Map(tasks.map(task => [task.externalId, task]));
  return Object.fromEntries(tasks.map(task => {
    const parts = [`${task.externalId} ${task.name}`];
    const visited = new Set([task.externalId]);
    let parent = task.parentExternalId;
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      const row = byExternalId.get(parent);
      if (!row) { parts.unshift(parent); break; }
      parts.unshift(`${row.externalId} ${row.name}`);
      parent = row.parentExternalId;
    }
    return [task.taskId, parts.join(" / ")];
  }));
}
