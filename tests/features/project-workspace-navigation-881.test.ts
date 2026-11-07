import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_WORKSPACE_TABS } from "../../src/contracts/projects";
import { availableWorkspaceScreen, isWorkspaceSectionVisible, normalizeWorkspaceScreen } from "../../src/features/projects/project-workspace-navigation";

describe("Issue #881 visibility", () => {
  it("keeps schedule always visible", () => {
    expect(DEFAULT_PROJECT_WORKSPACE_TABS).toEqual({ issue: true, dashboard: true, master: true });
    expect(isWorkspaceSectionVisible("schedule", { issue: false, dashboard: false, master: false })).toBe(true);
  });
  it("rejects hidden primary/secondary/legacy deep links and restores schedule", () => {
    const tabs = { issue: false, dashboard: false, master: false };
    for (const raw of ["issue", "dashboard", "dashboard.resources", "master", "master.relations", "master.targets", "resources", "milestones"]) {
      const screen = normalizeWorkspaceScreen(raw);
      expect(screen).not.toBeNull();
      expect(availableWorkspaceScreen(screen!, tabs)).toBe("schedule");
    }
    expect(availableWorkspaceScreen("schedule", tabs)).toBe("schedule");
    expect(availableWorkspaceScreen("dashboard.kpi", { issue: false, dashboard: true, master: false })).toBe("dashboard.kpi");
  });
});
