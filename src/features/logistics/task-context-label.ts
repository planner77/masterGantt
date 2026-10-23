import type { ProjectTaskDto } from "@/contracts/projects";

/** Canonical parent names provide context without repeating identifiers on every row. */
export function taskContextLabels(tasks: readonly ProjectTaskDto[]): Record<string, string> {
  const byExternalId = new Map(tasks.map(task => [task.externalId, task]));
  const labels = tasks.map(task => {
    const parts = [task.name.trim() || "이름 확인 필요"];
    const visited = new Set([task.externalId]);
    let parent = task.parentExternalId;
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      const row = byExternalId.get(parent);
      if (!row) { parts.unshift("상위 작업 확인 필요"); break; }
      parts.unshift(row.name.trim() || "이름 확인 필요");
      parent = row.parentExternalId;
    }
    return { task, label: parts.join(" / ") };
  });
  const counts = new Map<string, number>();
  for (const { label } of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return Object.fromEntries(labels.map(({ task, label }) => [task.taskId,
    (counts.get(label) ?? 0) > 1 ? `${label} (${task.externalId})` : label,
  ]));
}
