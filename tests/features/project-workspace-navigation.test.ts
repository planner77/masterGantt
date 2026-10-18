import { describe, expect, it } from "vitest";
import { DASHBOARD_SCREENS, MASTER_SCREENS, legacyWorkspaceScreen, logisticsSubview, normalizeWorkspaceScreen, workspaceSection, workspaceView } from "../../src/features/projects/project-workspace-navigation";

describe("Issue #724 workspace destinations", () => {
  it("publishes the ordered analysis and master destinations without adding scope entities", () => {
    expect(DASHBOARD_SCREENS.map(screen => screen.label)).toEqual(["KPI", "Milestone", "공정&WorkArea", "설비", "물류 시스템", "리소스"]);
    expect(MASTER_SCREENS.map(screen => screen.label)).toEqual(["공정&WorkArea", "설비", "물류 시스템", "리소스"]);
    expect(new Set([...DASHBOARD_SCREENS, ...MASTER_SCREENS].map(screen => screen.key)).size).toBe(10);
  });
  it.each([
    ["schedule", "schedule", "schedule"], ["dashboard.milestones", "dashboard", "milestones"],
    ["dashboard.resources", "dashboard", "resources"], ["master.resources", "master", "resource-master"],
    ["dashboard.kpi", "dashboard", "logistics"], ["master.processes", "master", "logistics"],
  ] as const)("routes %s to its existing host", (screen, section, host) => {
    expect(workspaceSection(screen)).toBe(section);
    expect(workspaceView(screen)).toBe(host);
  });
  it.each([
    ["dashboard.kpi", "dashboard"], ["dashboard.process", "unified"], ["dashboard.equipment", "unified"], ["dashboard.system", "unified"], ["dashboard.target", "unified"],
    ["master.processes", "processes"], ["master.equipment", "equipment"], ["master.systems", "systems"],
    ["master.targets", "targets"], ["master.relations", "relations"],
  ] as const)("keeps %s on its public existing logistics subview", (screen, subview) => {
    expect(logisticsSubview(screen)).toBe(subview);
  });
  it.each(["schedule", "milestones", "resources", "resource-master", "logistics"] as const)("retains legacy drill host %s", view => {
    expect(workspaceView(legacyWorkspaceScreen(view))).toBe(view);
  });
  it.each([["dashboard", "dashboard.kpi"], ["master", "master.processes"], ["logistics", "dashboard.kpi"], ["milestones", "dashboard.milestones"], ["resources", "dashboard.resources"], ["master.equipment", "master.equipment"]])("normalizes compatible %s", (input, expected) => {
    expect(normalizeWorkspaceScreen(input)).toBe(expected);
  });
  it.each([null, undefined, {}, 0, "", "dashboard.unknown", "master.unknown", "https://evil.example"]) ("rejects unknown destination %s", input => {
    expect(normalizeWorkspaceScreen(input)).toBeNull();
  });
});
