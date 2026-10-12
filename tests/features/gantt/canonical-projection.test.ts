import { describe, expect, it } from "vitest";
import { buildProjection, diffProjection, type ProjectionSnapshot, type ProjectionOptions } from "../../../src/features/gantt/canonical-projection";
const snapshot: ProjectionSnapshot = { revision: 7, tasks: [
  { id: "summary", type: "summary", parent: 0, open: true, text: "Summary" },
  { id: "nested", type: "summary", parent: "summary", open: false },
  { id: "child", type: "task", parent: "nested", text: "Child" },
  { id: "milestone", type: "milestone", parent: 0 },
], links: [], displayTasks: [] };
const options: ProjectionOptions = { scope: null, filter: null, displayMode: "compatibility", columnPrefs: { text: true }, scale: "Day" };
describe("canonical projection", () => {
  it("is idempotent across repeated snapshots and revision-only changes", () => {
    const first = buildProjection(snapshot, options);
    expect(diffProjection(first, buildProjection({ ...snapshot, revision: 8 }, options)).reasons).toEqual([]);
    expect(first.membershipIds).toEqual(["summary", "nested", "child", "milestone"]);
    expect(first.logicalVisibleIds).toEqual(["summary", "nested", "milestone"]);
  });
  it("changes data only for metadata; never requests a membership/layout refresh", () => {
    const first = buildProjection(snapshot, options);
    const renamed = { ...snapshot, tasks: snapshot.tasks.map(task => task.id === "child" ? { ...task, text: "Changed", projectDisplayKey: "status/new" } : task) };
    expect(diffProjection(first, buildProjection(renamed, options)).reasons).toEqual(["data"]);
  });
  it("keeps matching descendants in membership and required collapsed Summary context", () => {
    const projection = buildProjection(snapshot, { ...options, filter: ["child", "child", "unknown"] });
    expect(projection.membershipIds).toEqual(["summary", "nested", "child"]);
    expect(projection.logicalVisibleIds).toEqual(["summary", "nested"]);
    expect(projection.tasks).toBe(snapshot.tasks);
  });
  it("distinguishes explicit empty filter, empty canonical, Milestone-only and target mode", () => {
    expect(buildProjection(snapshot, { ...options, filter: [] }).membershipIds).toEqual([]);
    expect(buildProjection({ ...snapshot, tasks: [] }, options).logicalVisibleIds).toEqual([]);
    const milestones = { ...snapshot, tasks: [snapshot.tasks[3]] };
    expect(buildProjection(milestones, options).membershipIds).toEqual(["milestone"]);
    expect(buildProjection(milestones, { ...options, displayMode: "separate-milestones" }).membershipIds).toEqual([]);
  });
  it("classifies scope/hierarchy/link shape separately from scale and column layout", () => {
    const first = buildProjection(snapshot, options);
    expect(diffProjection(first, buildProjection(snapshot, { ...options, scale: "Week" })).reasons).toEqual(["layout"]);
    expect(diffProjection(first, buildProjection(snapshot, { ...options, scope: "summary" })).reasons).toContain("structure");
    const changed = { ...snapshot, links: [{ id: "L", source: "child", target: "milestone", type: "e2s" as const }] };
    expect(diffProjection(first, buildProjection(changed, options)).reasons).toEqual(["data", "structure"]);
  });
  it("uses current expanded state without mutating canonical or dropping descendants", () => {
    const projection = buildProjection(snapshot, { ...options, expandedTree: new Set(["summary", "nested"]) });
    expect(projection.logicalVisibleIds).toEqual(projection.membershipIds);
    expect(snapshot.tasks[1].open).toBe(false);
  });
});
