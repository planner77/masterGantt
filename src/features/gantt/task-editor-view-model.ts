"use client";

export const TASK_EDITOR_TABS = ["task", "resources", "relations", "logistics"] as const;
export type TaskEditorTab = (typeof TASK_EDITOR_TABS)[number] | "memberships";
export function taskEditorTabs(type: string): readonly TaskEditorTab[] { return type === "milestone" ? ["task", "memberships", "resources", "relations", "logistics"] : TASK_EDITOR_TABS; }

export function taskEditorTabForKey(current: TaskEditorTab, key: string, tabs: readonly TaskEditorTab[] = TASK_EDITOR_TABS): TaskEditorTab | null {
  const index = tabs.indexOf(current);
  if (key === "Home") return tabs[0];
  if (key === "End") return tabs[tabs.length - 1];
  if (key === "ArrowRight") return tabs[(index + 1) % tabs.length];
  if (key === "ArrowLeft") return tabs[(index - 1 + tabs.length) % tabs.length];
  return null;
}
