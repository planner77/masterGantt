"use client";

export const TASK_EDITOR_TABS = ["task", "resources", "relations"] as const;
export type TaskEditorTab = (typeof TASK_EDITOR_TABS)[number];

export function taskEditorTabForKey(current: TaskEditorTab, key: string): TaskEditorTab | null {
  const index = TASK_EDITOR_TABS.indexOf(current);
  if (key === "Home") return TASK_EDITOR_TABS[0];
  if (key === "End") return TASK_EDITOR_TABS[TASK_EDITOR_TABS.length - 1];
  if (key === "ArrowRight") return TASK_EDITOR_TABS[(index + 1) % TASK_EDITOR_TABS.length];
  if (key === "ArrowLeft") return TASK_EDITOR_TABS[(index - 1 + TASK_EDITOR_TABS.length) % TASK_EDITOR_TABS.length];
  return null;
}
