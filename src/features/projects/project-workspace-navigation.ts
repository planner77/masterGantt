/** Navigation only: canonical scope, filters and viewport remain owned by the project host. */
export const DASHBOARD_SCREENS = [
  { key: "dashboard.kpi", label: "KPI" },
  { key: "dashboard.milestones", label: "Milestone" },
  { key: "dashboard.process", label: "공정&WorkArea" },
  { key: "dashboard.equipment", label: "설비" },
  { key: "dashboard.system", label: "물류 시스템" },
  { key: "dashboard.resources", label: "리소스" },
] as const;
export const MASTER_SCREENS = [
  { key: "master.processes", label: "공정&WorkArea" },
  { key: "master.equipment", label: "설비" },
  { key: "master.systems", label: "물류 시스템" },
  { key: "master.resources", label: "리소스" },
] as const;
export type WorkspaceScreen = "schedule" | "issue" | typeof DASHBOARD_SCREENS[number]["key"] | typeof MASTER_SCREENS[number]["key"] | "master.relations";
export type WorkspaceView = "schedule" | "issue" | "milestones" | "resources" | "logistics" | "resource-master";
export type WorkspaceSection = "schedule" | "issue" | "dashboard" | "master";
export function workspaceSection(screen: WorkspaceScreen): WorkspaceSection {
  return screen === "schedule" || screen === "issue" ? screen : screen.startsWith("dashboard.") ? "dashboard" : "master";
}
export function workspaceView(screen: WorkspaceScreen): WorkspaceView {
  if (screen === "schedule" || screen === "issue") return screen;
  if (screen === "dashboard.milestones") return "milestones";
  if (screen === "dashboard.resources") return "resources";
  if (screen === "master.resources") return "resource-master";
  return "logistics";
}
export function legacyWorkspaceScreen(view: WorkspaceView): WorkspaceScreen {
  return view === "schedule" || view === "issue" ? view : view === "milestones" ? "dashboard.milestones" : view === "resources" ? "dashboard.resources" : view === "resource-master" ? "master.resources" : "dashboard.kpi";
}
export function logisticsSubview(screen: WorkspaceScreen) {
  if (screen === "dashboard.kpi") return "dashboard" as const;
  if (screen.startsWith("dashboard.")) return "unified" as const;
  if (screen === "master.equipment") return "equipment" as const;
  if (screen === "master.systems") return "systems" as const;
  if (screen === "master.relations") return "relations" as const;
  return "processes" as const;
}

export function normalizeWorkspaceScreen(value: unknown): WorkspaceScreen | null {
  if (typeof value !== "string") return null;
  if (value === "schedule" || value === "issue" || value === "master.relations" || [...DASHBOARD_SCREENS, ...MASTER_SCREENS].some(screen => screen.key === value)) return value as WorkspaceScreen;
  if (value === "dashboard.target") return "dashboard.process";
  if (value === "master.targets") return "master.processes";
  if (value === "dashboard") return "dashboard.kpi";
  if (value === "master") return "master.processes";
  if (["issue", "milestones", "resources", "logistics", "resource-master"].includes(value)) return legacyWorkspaceScreen(value as WorkspaceView);
  return null;
}
