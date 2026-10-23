import { describe, expect, it } from "vitest";
import { resourceSummaryRowIdentity } from "../../../src/features/resources/resource-summary-row-identity";

describe("#785 canonical resource row expansion", () => {
  it("retains the expanded canonical person after a save produces a new report receipt", () => {
    const before = { projectPublicId: "project-1", projectRevision: 10, snapshotId: "read-before-save" };
    const after = { ...before, projectRevision: 11, snapshotId: "read-after-save" };
    const expanded = new Set([resourceSummaryRowIdentity(before, "systemIds=system-1", "", "resource", "person-1")]);
    expect(expanded.has(resourceSummaryRowIdentity(after, "systemIds=system-1", "", "resource", "person-1"))).toBe(true);
  });
  it("isolates the same person by project, filter and parent path, and distinguishes a group from a person", () => {
    const report = { projectPublicId: "project-1" };
    const original = resourceSummaryRowIdentity(report, "systemIds=system-1", "group-a", "resource", "person-1");
    const otherPaths = [
      resourceSummaryRowIdentity({ projectPublicId: "project-2" }, "systemIds=system-1", "group-a", "resource", "person-1"),
      resourceSummaryRowIdentity(report, "systemIds=system-2", "group-a", "resource", "person-1"),
      resourceSummaryRowIdentity(report, "systemIds=system-1", "group-b", "resource", "person-1"),
      resourceSummaryRowIdentity(report, "systemIds=system-1", "group-a", "group", "person-1"),
      resourceSummaryRowIdentity(report, "systemIds=system-1", "group-a", "resource", "person-2"),
    ];
    expect(otherPaths).not.toContain(original);
    expect(new Set(otherPaths).size).toBe(otherPaths.length);
    expect(resourceSummaryRowIdentity(report, "", "", "group", null)).not.toBe(resourceSummaryRowIdentity(report, "", "", "group", "ungrouped"));
  });
});
