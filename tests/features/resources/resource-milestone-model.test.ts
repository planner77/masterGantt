import { describe, it, expect } from "vitest";
import { groupChildrenQuery, readGroupChildren, sameSelector, orderedMilestones, detailsQuery, readDetails } from "../../../src/features/resources/resource-dashboard-model";
import { milestoneUiFixture, childrenUiFixture } from "../../fixtures/resource-milestone-ui";
import { longResourceDashboardDetailUiFixture } from "../../fixtures/resource-dashboard-ui";
import type { StatefulProjectFixture } from "../../fixtures/stateful-project";
const fixture = { project: { publicId: "a3405d3d-8cb4-4da4-9b0f-43a5de330003", revision: 40 }, tasks: [{}, {}, { taskId: "00000000-0000-4000-8000-000000000003", name: "Stable leaf", externalId: "LEAF-1" }] } as StatefulProjectFixture;
describe("Milestone dashboard projection contracts", () => {
  it("orders equal dates by ID and unassigned last independently of input order", () => {
    const data = milestoneUiFixture(fixture, new URLSearchParams("mode=group")); data.stages.reverse();
    const stages = orderedMilestones(data); expect(stages[0].id).toBe("00005261-0000-4000-8000-000000000000"); expect(stages[1].id).toBe("00005261-0000-4000-8000-000000000001"); expect(stages.at(-1)?.id).toBeNull(); expect(stages).toHaveLength(14);
  });
  it("distinguishes omitted Milestone from explicit unassigned and verifies all child echoes", () => {
    const data = milestoneUiFixture(fixture, new URLSearchParams("mode=group")), group = data.groups[0].id;
    for (const milestone of [undefined, null, data.stages[0].milestoneTaskId]) {
      const query = groupChildrenQuery(data, group, milestone, 0); expect(query.has("mdPerMm")).toBe(false); expect(query.has("milestoneTaskId")).toBe(milestone !== undefined);
      const children = childrenUiFixture(data, query); expect(readGroupChildren({ data: children }, data, group, milestone, 0)).not.toBeNull();
      for (const changed of [{ ...children, snapshotId: "b".repeat(64) }, { ...children, offset: 50 }, { ...children, groupId: data.groups[1].id }, { ...children, mdPerMmSource: "query" }, { ...children, filters: { ...children.filters, search: "wrong" } }, { ...children, rows: [{ ...children.rows[0], summary: data.resources[0].summary }] }]) expect(readGroupChildren({ data: changed }, data, group, milestone, 0)).toBeNull();
    }
  });
  it("validates semantic normalized selectors including group-resource intersection and assignment scope", () => {
    const data = milestoneUiFixture(fixture, new URLSearchParams("mode=group")); const selector = { dimension: "group" as const, id: data.groups[0].id, metric: "all" as const, resourceId: data.resources[0].id!, milestoneTaskId: null };
    expect(sameSelector(selector, { metric: "all", id: selector.id, dimension: "group", resourceId: selector.resourceId, milestoneTaskId: null, assignmentScope: "selected" })).toBe(true);
    const query = detailsQuery(data, selector, "tasks", 0); expect(query.get("resourceId")).toBe(selector.resourceId); expect(query.get("assignmentScope")).toBe("selected"); const details = longResourceDashboardDetailUiFixture(fixture, query); expect(readDetails({ data: details }, data, selector, "tasks", 0)).not.toBeNull();
    expect(readDetails({ data: { ...details, selector: { ...details.selector, assignmentScope: "milestoneExcluded" } } }, data, selector, "tasks", 0)).toBeNull();
  });
});
