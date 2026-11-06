import { describe, expect, it } from "vitest";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import type { TaskLogisticsLinksDto } from "../../../src/contracts/logistics";
import { projectScheduleView, type ScheduleViewProjectionInput } from "../../../src/features/gantt/schedule-view-projection";

const task = (taskId: string, overrides: Partial<ProjectTaskDto> = {}): ProjectTaskDto => ({ taskId, externalId: taskId, name: taskId,
  type: "task", scheduleMode: "auto", requestedStart: "2026-01-05", start: "2026-01-05", end: "2026-01-09", duration: 5, progress: 25,
  parentExternalId: null, siblingOrder: 1, ...overrides });
const links = (taskId: string, effectiveEquipmentIds: string[] = []): TaskLogisticsLinksDto => ({ taskId,
  directEquipmentLinks: [], inheritedEquipmentLinks: [], effectiveEquipmentIds, directSystemLinks: [], inheritedSystemLinks: [], effectiveSystemIds: [], compatibilityLinks: [] });
function fixture(): ScheduleViewProjectionInput {
  return { view: "resource", tasks: [task("S", { type: "summary" }), task("T1", { parentExternalId: "S" }), task("T2"), task("T3"), task("T4"), task("M", { type: "milestone" })],
    visibleTaskIds: ["S","T1","T2","T3","T4","M"], resources: [{ id: "A", name: "Alice", active: true }, { id: "B", name: "Bob", active: true }, { id: "C", name: "C", active: false }],
    groups: [{ id: "G1", name: "Group", active: true, memberResourceIds: ["A","B"] }, { id: "G2", name: "Group", active: false, memberResourceIds: ["A"] }],
    assignments: [{ id: "a1", taskId: "T1", target: { kind: "resource", id: "A" }, allocation: { start: "2025-01-01", end: "2025-01-01", percent: 50 } },
      { id: "a2", taskId: "T1", target: { kind: "resource", id: "B" } }, { id: "a3", taskId: "T2", target: { kind: "group", id: "G1" } },
      { id: "a4", taskId: "T4", target: { kind: "resource", id: "C" } }, { id: "as", taskId: "S", target: { kind: "group", id: "G2" } }],
    equipment: [{ id: "E1", name: "AMR", equipmentType: "amr", model: "A", managementUnit: "unit", quantity: 1, active: true },
      { id: "E2", name: "AMR", equipmentType: "amr", model: "  ", managementUnit: "fleet", quantity: 17, active: false },
      { id: "E3", name: "Conveyor", equipmentType: "conveyor", model: "A", managementUnit: "unit", quantity: 1, active: true }],
    equipmentTypes: [{ code: "amr", name: "AMR" }, { code: "conveyor", name: "Conveyor" }],
    taskEquipment: [links("T1", ["E1","E2"]), links("T2", ["E1"]), links("T3"), links("T4")] };
}
const leaves = (input: ScheduleViewProjectionInput) => projectScheduleView(input).rows.filter(row => row.kind === "task");

describe("#880 read-only schedule View projection", () => {
  it("shows coassignment/multiple memberships once per actual path and never assigns group-only work to people", () => {
    const input = fixture(), result = projectScheduleView(input);
    expect(result.uniqueTaskCount).toBe(4); expect(result.taskRowCount).toBe(6);
    expect(result.rows.filter(row => row.canonicalTaskId === "T1")).toHaveLength(3);
    const t2 = result.rows.filter(row => row.canonicalTaskId === "T2"); expect(t2).toHaveLength(1);
    expect(result.rows.find(row => row.viewRowKey === t2[0].parentViewRowKey)?.groupKind).toBe("unspecifiedPerson");
    const t3 = result.rows.find(row => row.canonicalTaskId === "T3")!;
    expect(result.rows.find(row => row.viewRowKey === t3.parentViewRowKey)?.label).toBe("완전 미할당");
    const c = result.rows.find(row => row.groupKind === "resource" && row.entityId === "C")!;
    expect(result.rows.find(row => row.viewRowKey === c.parentViewRowKey)?.label).toBe("그룹 미소속");
    expect(result.diagnostics).toMatchObject({ summaryAssignmentIds: ["as"], inactiveResourceIds: ["C"], inactiveGroupIds: ["G2"] });
  });
  it("keeps canonical identity, schedule, status and unique branch counts without synthetic mutation targets", () => {
    const input = fixture(), result = projectScheduleView(input), t1 = input.tasks.find(row => row.taskId === "T1")!;
    const display = result.rows.filter(row => row.canonicalTaskId === "T1");
    expect(new Set(result.rows.map(row => row.viewRowKey)).size).toBe(result.rows.length);
    expect(display.every(row => row.task === t1 && row.start === "2026-01-05" && row.end === "2026-01-09" && row.progress === 25)).toBe(true);
    expect(result.rows.find(row => row.groupKind === "resourceGroup" && row.entityId === "G1")?.taskCount).toBe(2);
    expect(result.rows.filter(row => row.kind === "group").every(row => row.canonicalTaskId === null && row.task === null && row.progress === null)).toBe(true);
  });
  it("does not project Summary/Milestone responsibilities or inherit Summary personal assignment to descendants", () => {
    const input = fixture(); input.assignments = input.assignments.filter(row => row.taskId === "S");
    const result = projectScheduleView(input);
    expect(result.taskRowCount).toBe(4);
    expect(result.rows.filter(row => row.kind === "group").map(row => row.groupKind)).toEqual(["unassigned"]);
    expect(result.rows.some(row => row.canonicalTaskId === "S" || row.canonicalTaskId === "M")).toBe(false);
  });
  it("deduplicates duplicate membership and assignment paths without summing effort or using allocation dates", () => {
    const input = fixture(); input.groups[0].memberResourceIds.push("A");
    input.assignments = [...input.assignments, { ...input.assignments[0], id: "duplicate-path" }];
    expect(projectScheduleView(input).taskRowCount).toBe(6);
  });
  it("shows a task on each linked original equipment once, fleet once, blank model and idle equipment", () => {
    const input = fixture(); input.view = "equipment";
    input.taskEquipment[0].effectiveEquipmentIds.push("E1");
    const result = projectScheduleView(input);
    expect(result.uniqueTaskCount).toBe(4); expect(result.taskRowCount).toBe(5);
    expect(result.rows.filter(row => row.canonicalTaskId === "T1")).toHaveLength(2);
    expect(result.rows.filter(row => row.groupKind === "equipment")).toHaveLength(3);
    expect(result.rows.find(row => row.entityId === "E2")).toMatchObject({ quantity: 17, managementUnit: "fleet", taskCount: 1, active: false });
    expect(result.rows.find(row => row.entityId === "E3")).toMatchObject({ taskCount: 0, start: null, end: null });
    expect(result.rows.some(row => row.label === "모델 미지정")).toBe(true);
    expect(result.rows.find(row => row.groupKind === "equipmentType" && row.entityId === "amr")?.taskCount).toBe(2);
  });
  it("retains direct/inherited/legacy diagnostics for a single deduplicated equipment Task row", () => {
    const input = fixture(); input.view = "equipment";
    const source = input.taskEquipment[0]; source.directEquipmentLinks = [{ equipmentId: "E1", scope: "self" }];
    source.inheritedEquipmentLinks = [{ equipmentId: "E1", scope: "subtree", sourceTaskId: "S", sourceTaskName: "Summary" }];
    source.compatibilityLinks = [{ sourceId: "archive", kind: "equipment", entityId: "E1", code: "E1", name: "AMR", active: true,
      sourceTaskId: "S", sourceTaskName: "Summary", scope: "subtree", inherited: true, selection: "whole", coverage: null, coverageMode: "whole", readonly: true }];
    const rows = leaves(input).filter(row => row.canonicalTaskId === "T1");
    expect(rows).toHaveLength(2); expect(rows.every(row => row.equipmentSources === source)).toBe(true);
  });
  it("respects current scope/filter without reintroducing Task through membership or equipment metadata", () => {
    const input = fixture(); input.visibleTaskIds = ["T3","M"];
    for (const view of ["resource", "equipment"] as const) {
      const result = projectScheduleView({ ...input, view });
      expect(result.uniqueTaskCount).toBe(1); expect(result.rows.filter(row => row.kind === "task").map(row => row.canonicalTaskId)).toEqual(["T3"]);
    }
    expect(projectScheduleView({ ...input, visibleTaskIds: [] }).rows).toEqual([]);
  });
  it("is deterministic and does not mutate caller-owned canonical Tasks, relationships or model strings", () => {
    const input = fixture(); input.view = "equipment"; const before = JSON.stringify(input);
    const a = projectScheduleView(input), b = projectScheduleView(input);
    expect(a).toEqual(b); expect(JSON.stringify(input)).toBe(before); expect(input.equipment[1].model).toBe("  ");
  });
  it("rejects unavailable canonical/assignment/member/equipment/type references instead of silently moving Tasks to unassigned", () => {
    const input = fixture();
    expect(() => projectScheduleView({ ...input, visibleTaskIds: ["foreign"] })).toThrow("VISIBLE_TASK_UNAVAILABLE");
    expect(() => projectScheduleView({ ...input, resources: input.resources.slice(1) })).toThrow("ASSIGNMENT_TARGET_UNAVAILABLE");
    expect(() => projectScheduleView({ ...input, assignments: [], resources: input.resources.slice(1) })).toThrow("GROUP_MEMBER_UNAVAILABLE");
    expect(() => projectScheduleView({ ...input, view: "equipment", taskEquipment: [] })).toThrow("TASK_EQUIPMENT_SOURCE_UNAVAILABLE");
    expect(() => projectScheduleView({ ...input, view: "equipment", equipment: input.equipment.slice(1) })).toThrow("EQUIPMENT_REFERENCE_UNAVAILABLE");
    expect(() => projectScheduleView({ ...input, view: "equipment", equipmentTypes: [] })).toThrow("EQUIPMENT_TYPE_UNAVAILABLE");
  });
  it("fails closed at row fanout budget without returning a partial normal tree", () => {
    expect(() => projectScheduleView({ ...fixture(), maxRows: 2 })).toThrow("VIEW_ROW_LIMIT_EXCEEDED");
    expect(() => projectScheduleView({ ...fixture(), maxRows: 50_001 })).toThrow("INVALID_ROW_BUDGET");
  });
  it("handles 80+ rows and repeated fanout with unique display keys and branch-local unique Tasks", () => {
    const input = fixture(); input.tasks = Array.from({ length: 100 }, (_, i) => task(`T${i}`)); input.visibleTaskIds = input.tasks.map(row => row.taskId);
    input.assignments = input.tasks.map((row, i) => ({ id: `a${i}`, taskId: row.taskId, target: { kind: "resource", id: "A" } }));
    const result = projectScheduleView(input);
    expect(result.uniqueTaskCount).toBe(100); expect(result.taskRowCount).toBe(200); expect(result.rows).toHaveLength(204);
    expect(new Set(result.rows.map(row => row.viewRowKey)).size).toBe(204);
    expect(result.rows.filter(row => row.groupKind === "resourceGroup").map(row => row.taskCount)).toEqual([100,100]);
  });
  it("accepts localized exceptional labels without changing identity or canonical data", () => {
    const input = fixture(); const a = projectScheduleView(input), b = projectScheduleView({ ...input, labels: { fullyUnassigned: "Unassigned", personUnspecified: "No person specified" } });
    expect(b.rows.map(row => row.viewRowKey)).toEqual(a.rows.map(row => row.viewRowKey));
    expect(b.rows.some(row => row.label === "Unassigned")).toBe(true);
  });
  it("preserves Task identity and path uniqueness over seeded membership, duplicate paths and source permutations", () => {
    for (let seed = 1; seed <= 32; seed += 1) {
      let state = seed;
      const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
      const shuffle = <T,>(values: readonly T[]): T[] => {
        const result = [...values];
        for (let i = result.length - 1; i > 0; i -= 1) {
          const other = Math.floor(random() * (i + 1));
          [result[i], result[other]] = [result[other], result[i]];
        }
        return result;
      };
      const input = fixture();
      input.tasks = [task("S", { type: "summary" }), task("M", { type: "milestone" }),
        ...Array.from({ length: 12 }, (_, i) => task(`T${i}`, { parentExternalId: "S", progress: i * 7 }))];
      input.visibleTaskIds = input.tasks.filter(row => row.type !== "task" || random() > 0.2).map(row => row.taskId);
      input.groups = input.groups.map(group => ({ ...group, memberResourceIds: input.resources.filter(() => random() > 0.4).map(row => row.id) }));
      // Duplicate membership paths are valid input; raw Resource/Group IDs stay unique.
      input.groups[0].memberResourceIds.push("A", "A");
      input.assignments = input.tasks.flatMap((row, i) => {
        const targets = random() > 0.2 ? input.resources.filter(() => random() > 0.5).map(resource => ({ kind: "resource" as const, id: resource.id })) : [];
        return targets.map((target, j) => ({ id: `a-${i}-${j}`, taskId: row.taskId, target }));
      });
      input.assignments = [...input.assignments,
        { id: "group-only", taskId: "T0", target: { kind: "group", id: "G1" } },
        { id: "personal", taskId: "T1", target: { kind: "resource", id: "A" } },
        { id: "duplicate-personal-path", taskId: "T1", target: { kind: "resource", id: "A" } }];
      input.taskEquipment = input.tasks.filter(row => row.type === "task").map(row => {
        const ids = input.equipment.filter(() => random() > 0.45).map(equipment => equipment.id);
        const source = links(row.taskId, ids.length ? [...ids, ids[0]] : []);
        source.directEquipmentLinks = ids.map(equipmentId => ({ equipmentId, scope: "self" }));
        source.inheritedEquipmentLinks = ids.map(equipmentId => ({ equipmentId, scope: "subtree", sourceTaskId: "S", sourceTaskName: "S" }));
        source.compatibilityLinks = ids.map((entityId, i) => ({ sourceId: `archive-${i}`, kind: "equipment", entityId, code: entityId, name: entityId,
          active: true, sourceTaskId: "S", sourceTaskName: "S", scope: "subtree", inherited: true, selection: "whole", coverage: null, coverageMode: "whole", readonly: true }));
        return source;
      });
      for (const view of ["resource", "equipment"] as const) {
        const source = { ...input, view }, immutable = JSON.stringify(source);
        const first = projectScheduleView(source);
        const permuted: ScheduleViewProjectionInput = { ...source, tasks: shuffle(source.tasks), visibleTaskIds: shuffle(source.visibleTaskIds),
          assignments: shuffle(source.assignments), resources: shuffle(source.resources),
          groups: shuffle(source.groups).map(group => ({ ...group, memberResourceIds: shuffle(group.memberResourceIds) })),
          equipment: shuffle(source.equipment), equipmentTypes: shuffle(source.equipmentTypes),
          taskEquipment: shuffle(source.taskEquipment).map(row => ({ ...row, effectiveEquipmentIds: shuffle(row.effectiveEquipmentIds),
            directEquipmentLinks: shuffle(row.directEquipmentLinks), inheritedEquipmentLinks: shuffle(row.inheritedEquipmentLinks), compatibilityLinks: shuffle(row.compatibilityLinks ?? []) })) };
        const second = projectScheduleView(permuted), context = `seed=${seed}, view=${view}`;
        const projected = first.rows.filter(row => row.kind === "task");
        const expected = source.tasks.filter(row => row.type === "task" && source.visibleTaskIds.includes(row.taskId)).map(row => row.taskId).sort();
        expect([...new Set(projected.map(row => row.canonicalTaskId))].sort(), context).toEqual(expected);
        expect(first.uniqueTaskCount, context).toBe(expected.length);
        expect(new Set(first.rows.map(row => row.viewRowKey)).size, context).toBe(first.rows.length);
        expect(new Set(projected.map(row => JSON.stringify([row.parentViewRowKey, row.canonicalTaskId]))).size, context).toBe(projected.length);
        expect(second.rows.map(row => row.viewRowKey).sort(), context).toEqual(first.rows.map(row => row.viewRowKey).sort());
        expect(projected.every(row => row.task === source.tasks.find(task => task.taskId === row.canonicalTaskId)
          && row.start === row.task?.start && row.end === row.task?.end && row.progress === row.task?.progress), context).toBe(true);
        expect(JSON.stringify(source), context).toBe(immutable);
      }
    }
  });
});
