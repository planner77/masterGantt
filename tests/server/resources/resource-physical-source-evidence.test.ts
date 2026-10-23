import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { RESOURCE_TARGET_LIMITS } from "../../../src/contracts/resource-dashboard";
import { fromResourcePublicV2 } from "../../../src/contracts/resource-public-v2";
import { TaskTargetBindingRepository } from "../../../src/server/repositories/task-target-binding-repository-core";
import { handleGetResourceDashboard, handleGetResourcePlan } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { resourceDashboardTargetsFixture } from "../../fixtures/resource-dashboard-targets";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";

const fixtures: ReturnType<typeof resourceDashboardTargetsFixture>[] = [];
const fixture = () => { const f = resourceDashboardTargetsFixture(); fixtures.push(f); return f; };
afterEach(() => { for (const f of fixtures.splice(0)) f.database.close(); });
const neutral = (body: unknown, f: ReturnType<typeof fixture>) => {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/"(?:targetId|targetIds|targetSources|effectiveTargetIds|targets|targetProjection)"/);
  for (const target of f.targets) expect(text).not.toContain(target.id);
};

/** Actual migrated SQLite and production handlers: source visibility is independent
 * from legacy projection activation, including unfiltered reads and unset diagnostics. */
describe("#785 canonical physical source evidence", () => {
  it.each(["unfiltered", "physical"] as const)("%s detail and Plan preserve physical IDs, subset coverage/null and exact Assignment identity", async mode => {
    const f = fixture(), task = f.tasks.get("T2")!, sourceId = randomUUID();
    f.database.transaction(() => new TaskTargetBindingRepository(f.database).replace(f.project.id, task.id, [{
      id: sourceId, taskId: task.publicId, targetId: f.targets[0].id, scope: "self", selection: "subset",
      memberIds: [f.targets[0].memberIds[0], f.targets[0].memberIds[1]], coverageByMember: [{ memberId: f.targets[0].memberIds[0], coverage: 2 }],
    }], now))();
    const params = new URLSearchParams({ granularity: "week" });
    if (mode === "physical") params.set("systemIds", f.systems[0].publicId);
    const before = f.state(), reportResponse = await handleGetResourceDashboard(f.request(params.toString()), f.project.publicId, { service: f.service });
    expect(reportResponse.status).toBe(200);
    const reportBody = await reportResponse.json(), report = reportBody.data;
    expect(report).not.toHaveProperty("physicalProjection");
    const filters = mode === "physical" ? { granularity: "week" as const, systemIds: [f.systems[0].publicId] } : { granularity: "week" as const };
    for (const view of ["tasks", "assignments"] as const) {
      const query = new URLSearchParams(params);
      Object.entries({ snapshotId: report.snapshotId, dimension: "all", metric: "all", view, limit: "100" }).forEach(([key, value]) => query.set(key, value));
      const response = await handleGetResourceDashboard(f.request(query.toString(), true), f.project.publicId, { service: f.service }, true);
      expect(response.status).toBe(200);
      const wire = await response.json(); neutral(wire, f);
      const expected = f.service.getDetails(f.project.publicId, filters, { snapshotId: report.snapshotId, selector: { dimension: "all", id: null, metric: "all" }, view, offset: 0, limit: 100 })!;
      const decoded = fromResourcePublicV2(wire) as { data: typeof expected };
      expect(decoded.data.rows.map(row => [row.taskId, row.assignment?.assignmentId ?? null])).toEqual(expected.rows.map(row => [row.taskId, row.assignment?.assignmentId ?? null]));
      expect(wire.data.rows.every((row: { physicalSources?: unknown }) => row.physicalSources !== undefined)).toBe(true);
      const subset = decoded.data.rows.find(row => row.taskId === task.publicId)!.targetSources!;
      expect(subset.effectiveEquipmentIds).toEqual([f.equipment[0].publicId]);
      expect(subset.effectiveSystemIds).toEqual([f.systems[0].publicId]);
      expect(subset.effectiveMembers.find(row => row.kind === "equipment")!.provenance[0]).toMatchObject({ bindingId: sourceId, memberId: f.targets[0].memberIds[0], sourceTaskId: task.publicId, selection: "subset", scope: "self", inherited: false, coverage: 2 });
      expect(subset.effectiveMembers.find(row => row.kind === "system")!.provenance[0].coverage).toBeNull();
      if (mode === "unfiltered") expect(decoded.data.rows.find(row => row.taskId === f.tasks.get("T5")!.publicId)!.targetSources!.legacySources).toContainEqual(expect.objectContaining({ kind: "system", entityId: f.systems[2].publicId, sourceTaskId: f.tasks.get("T5")!.publicId }));
    }
    // The T0 unset diagnostic must retain evidence before personal filters as well.
    const diagnosticParams = new URLSearchParams(params);
    Object.entries({ snapshotId: report.snapshotId, dimension: "diagnostic", metric: "unset", view: "tasks", limit: "100" }).forEach(([key, value]) => diagnosticParams.set(key, value));
    const diagnostic = await handleGetResourceDashboard(f.request(diagnosticParams.toString(), true), f.project.publicId, { service: f.service }, true);
    expect(diagnostic.status).toBe(200);
    const diagnosticBody = await diagnostic.json(); neutral(diagnosticBody, f);
    expect(diagnosticBody.data.rows.find((row: { taskId: string }) => row.taskId === task.publicId).physicalSources.effectiveEquipmentIds).toEqual([f.equipment[0].publicId]);
    const planQuery = new URLSearchParams(params);
    Object.entries({ snapshotId: report.snapshotId, periodId: "all", row: "resource", resourceId: f.resources.get("R1")!.publicId, demandScope: "selected", date: "2026-10-05", limit: "100" }).forEach(([key, value]) => planQuery.set(key, value));
    const planResponse = await handleGetResourcePlan(f.request(planQuery.toString()), f.project.publicId, { service: f.service }, "day-assignments");
    expect(planResponse.status).toBe(200);
    const planBody = await planResponse.json(); neutral(planBody, f);
    const subsetPlan = planBody.data.rows.find((row: { assignmentId: string }) => row.assignmentId === f.assignmentIds.get("A3"));
    expect(subsetPlan.taskId).toBe(task.publicId);
    expect(subsetPlan.physicalSources.effectiveMembers.find((row: { kind: string }) => row.kind === "equipment").provenance[0]).toMatchObject({ relationId: sourceId, memberReference: f.targets[0].memberIds[0], sourceTaskId: task.publicId, coverage: 2 });
    expect(subsetPlan.physicalSources.effectiveMembers.find((row: { kind: string }) => row.kind === "system").provenance[0].coverage).toBeNull();
    expect(f.state()).toEqual(before);
  });

  it("keeps the repeated source-row 5000 bound for unfiltered and physical detail/Plan pages before DTO materialization", async () => {
    const f = fixture(), bindings = new TaskTargetBindingRepository(f.database), person = f.resources.get("R1")!;
    f.database.transaction(() => {
      for (let index = 0; index < 50; index++) {
        const system = f.logistics.insertSystem({ publicId: randomUUID(), projectId: f.project.id, code: `SOURCE-${index}`, name: `Source ${index}`, systemType: "mcs", layer: "coordinator", scope: "project", now });
        f.database.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,system_id,created_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), f.project.id, f.targets[0].internalId, "system", system.id, now);
      }
      for (let index = 0; index < 50; index++) {
        const task = f.schedules.insertTask({ publicId: randomUUID(), projectId: f.project.id, externalId: `SOURCE-TASK-${index}`, name: `Source Task ${index}`, type: "task", parentId: null, sortOrder: 100 + index, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-09", duration: 4, progress: 0, createdAt: now, updatedAt: now });
        f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now, targets: [{ publicId: person.publicId, internalId: person.id, kind: "resource", assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 100 }] });
        bindings.replace(f.project.id, task.id, [{ id: randomUUID(), taskId: task.publicId, targetId: f.targets[0].id, scope: "self", selection: "whole", memberIds: [] }], now);
      }
    })();
    expect(50 * (1 + 2 * 53)).toBeGreaterThan(RESOURCE_TARGET_LIMITS.responseSourceRows);
    const before = f.state();
    for (const physical of [false, true]) {
      const params = new URLSearchParams({ granularity: "week" });
      if (physical) params.set("systemIds", f.systems[2].publicId);
      const reportResponse = await handleGetResourceDashboard(f.request(params.toString()), f.project.publicId, { service: f.service });
      expect(reportResponse.status).toBe(200); const report = (await reportResponse.json()).data;
      expect(report).not.toHaveProperty("physicalProjection");
      const query = new URLSearchParams(params);
      Object.entries({ snapshotId: report.snapshotId, dimension: "all", metric: "all", view: "assignments", limit: "100" }).forEach(([key, value]) => query.set(key, value));
      const details = await handleGetResourceDashboard(f.request(query.toString(), true), f.project.publicId, { service: f.service }, true);
      expect(details.status).toBe(422); expect((await details.json()).error.code).toBe("REPORT_LIMIT_EXCEEDED");
      const plan = new URLSearchParams(params);
      Object.entries({ snapshotId: report.snapshotId, periodId: "all", row: "resource", resourceId: person.publicId, demandScope: "selected", date: "2026-10-05", limit: "100" }).forEach(([key, value]) => plan.set(key, value));
      const planResponse = await handleGetResourcePlan(f.request(plan.toString()), f.project.publicId, { service: f.service }, "day-assignments");
      expect(planResponse.status).toBe(422); expect((await planResponse.json()).error.code).toBe("REPORT_LIMIT_EXCEEDED");
    }
    expect(f.state()).toEqual(before);
  });
});
