import { describe, expect, it } from "vitest";
import {
  wbsScheduleDisplayScope,
  clearResourceDrill,
  resourceDrillLiveVisits,
  pushResourceDrillFrame,
  RESOURCE_DRILL_RETURN_LIMIT,
  resourceDrillConflict,
  resourceDrillGuardReason,
  returnFromResourceDrill,
  type ResourceDrillFrame,
  type ResourceDrillGuards,
} from "../../../src/features/resources/resource-drill-navigation-model";

const guards: ResourceDrillGuards = {
  ready: true,
  readAllowed: true,
  busy: false,
  dirty: false,
  editorOpening: false,
  editorOpen: false,
  relationOpen: false,
  settingsOpen: false,
  deletePending: false,
  copyPending: false,
  importPending: false,
};
const state = (view: string, name: string) => ({
  view,
  filter: name,
  unit: "mm",
  rootTaskId: "root",
  scroll: { left: 120, top: 96 },
});

describe("Resource drill navigation model", () => {
  it("restores latest source and prior chain in LIFO order, preserving destination preconditions", () => {
    const source = state("resources", "selected-stage"),
      before = state("schedule", "existing-WBS"),
      destination = state("schedule", "exact-N"),
      next = state("milestones", "next-exact"),
      first = { source, destinationBefore: before, destination };
    const pushed = pushResourceDrillFrame([], first);
    expect(pushed.kind).toBe("accepted");
    const frames = pushResourceDrillFrame(pushed.frames, {
      source: destination,
      destinationBefore: state("milestones", "old"),
      destination: next,
    }).frames;
    const returned = returnFromResourceDrill(frames);
    expect(returned.kind).toBe("restore");
    if (returned.kind === "restore") expect(returned.state).toBe(destination);
    expect(returned.frames).toEqual([first]);
    const origin = returnFromResourceDrill(returned.frames);
    if (origin.kind === "restore") expect(origin.state).toBe(source);
    expect(before.filter).toBe("existing-WBS");
    expect(frames).toHaveLength(2);
  });
  it("clears to the current destination's pre-drill conditions and explicitly discards the return chain", () => {
    const before = state("schedule", "old-search"),
      frames = [
        {
          source: state("milestones", "M1"),
          destinationBefore: state("resources", "old-resource"),
          destination: state("resources", "M1"),
        },
        {
          source: state("resources", "M1"),
          destinationBefore: before,
          destination: state("schedule", "exact"),
        },
      ];
    const cleared = clearResourceDrill(frames, (s) => s.view);
    expect(cleared.kind).toBe("restore");
    if (cleared.kind === "restore") expect(cleared.state).toBe(before);
    expect(cleared.frames).toEqual([]);
    expect(frames).toHaveLength(2);
    expect(
      clearResourceDrill([], (s: ReturnType<typeof state>) => s.view).kind,
    ).toBe("none");
    expect(returnFromResourceDrill([]).kind).toBe("none");
  });
  it("clears repeated A→B→A→B to earliest B baseline and A→B→A to earliest A baseline", () => {
    const a = state("A", "baselineA"),
      b = state("B", "baselineB"),
      scopedB = state("B", "temporaryB"),
      scopedA = state("A", "temporaryA");
    const chain = [
      { source: a, destinationBefore: b, destination: scopedB },
      { source: scopedB, destinationBefore: a, destination: scopedA },
      {
        source: scopedA,
        destinationBefore: scopedB,
        destination: state("B", "secondTemporaryB"),
      },
    ];
    const clearB = clearResourceDrill(chain, (s) => s.view);
    if (clearB.kind === "restore") expect(clearB.state).toBe(b);
    expect(clearB.frames).toEqual([]);
    const clearA = clearResourceDrill(chain.slice(0, 2), (s) => s.view);
    if (clearA.kind === "restore") expect(clearA.state).toBe(a);
    expect(clearA.frames).toEqual([]);
    const pop = returnFromResourceDrill(chain);
    if (pop.kind === "restore") expect(pop.state).toBe(scopedA);
    expect(pop.frames).toHaveLength(2);
  });
  it("clears a manually activated peer while preserving its initial baseline", () => {
    const a = state("A", "baselineA"),
      b = state("B", "baselineB");
    const frames = [
      { source: a, destinationBefore: b, destination: state("B", "temporary") },
    ];
    const cleared = clearResourceDrill(frames, (s) => s.view, a);
    if (cleared.kind === "restore") expect(cleared.state).toBe(a);
    expect(cleared.frames).toEqual([]);
  });
  it("pins only live visits through fifty pop/return cycles and at most nine chained contexts", () => {
    type Visit = { visit: number };
    const base: Visit = { visit: 0 };
    let frames: readonly ResourceDrillFrame<Visit>[] = [];
    let current = base;
    let cache = new Set([0]);
    for (let i = 1; i <= 50; i++) {
      const target = { visit: i };
      frames = pushResourceDrillFrame(frames, {
        source: current,
        destinationBefore: base,
        destination: target,
      }).frames;
      current = target;
      cache.add(i);
      cache = new Set(resourceDrillLiveVisits(frames, current, (s) => s.visit));
      expect(cache.size).toBe(2);
      const popped = returnFromResourceDrill(frames);
      if (popped.kind === "restore") current = popped.state;
      frames = popped.frames;
      cache = new Set(resourceDrillLiveVisits(frames, current, (s) => s.visit));
      expect([...cache]).toEqual([0]);
    }
    for (let i = 1; i <= 8; i++) {
      const target = { visit: i };
      frames = pushResourceDrillFrame(frames, {
        source: current,
        destinationBefore: base,
        destination: target,
      }).frames;
      current = target;
      expect(
        resourceDrillLiveVisits(frames, current, (s) => s.visit).length,
      ).toBeLessThanOrEqual(9);
    }
    expect(resourceDrillLiveVisits(frames, current, (s) => s.visit)).toContain(
      0,
    );
  });
  it("blocks the ninth frame without evicting the original source", () => {
    let frames: readonly ResourceDrillFrame<ReturnType<typeof state>>[] = [];
    for (let i = 0; i < RESOURCE_DRILL_RETURN_LIMIT; i++)
      frames = pushResourceDrillFrame(frames, {
        source: state("resources", String(i)),
        destinationBefore: state("schedule", "old"),
        destination: state("schedule", "N"),
      }).frames;
    const blocked = pushResourceDrillFrame(frames, frames[0]);
    expect(blocked.kind).toBe("limit");
    expect(blocked.frames).toBe(frames);
    expect(blocked.frames[0].source.filter).toBe("0");
    expect(blocked.frames).toHaveLength(8);
  });
  it("keeps exact empty empty and excludes ancestors from distinct matching/hidden counts", () => {
    expect(resourceDrillConflict([], null, ["summary"])).toMatchObject({
      kind: "empty",
      taskIds: [],
      taskCount: 0,
    });
    const conflict = resourceDrillConflict(
      ["taskA", "taskB", "taskA"],
      ["taskA", "summary"],
      ["summary", "parent", "summary", "taskA"],
    );
    expect(conflict).toEqual({
      kind: "confirm",
      taskIds: ["taskA", "taskB"],
      contextIds: ["summary", "parent"],
      hiddenTaskIds: ["taskB"],
      taskCount: 2,
      ancestorCount: 2,
      visibleTaskCount: 1,
      hiddenTaskCount: 1,
    });
    expect(
      resourceDrillConflict(["taskA", "taskB"], null, ["summary"]).kind,
    ).toBe("compatible");
    expect(resourceDrillConflict(["taskA"], [], [])).toMatchObject({
      kind: "confirm",
      hiddenTaskCount: 1,
    });
  });
  it("allows readonly navigation and rejects every pending interaction without bypassing stale checks", () => {
    expect(resourceDrillGuardReason(guards, "snapshot", "snapshot")).toBeNull();
    for (const key of [
      "busy",
      "dirty",
      "editorOpening",
      "editorOpen",
      "relationOpen",
      "settingsOpen",
      "deletePending",
      "copyPending",
      "importPending",
    ] as const)
      expect(
        resourceDrillGuardReason(
          { ...guards, [key]: true },
          "snapshot",
          "snapshot",
        ),
      ).not.toBeNull();
    expect(
      resourceDrillGuardReason(
        { ...guards, ready: false },
        "snapshot",
        "snapshot",
      ),
    ).toBe("not-ready");
    expect(
      resourceDrillGuardReason(
        { ...guards, readAllowed: false },
        "snapshot",
        "snapshot",
      ),
    ).toBe("read-denied");
    expect(resourceDrillGuardReason(guards, "old", "new")).toBe("stale");
    expect(resourceDrillGuardReason(guards, "", "")).toBe("stale");
    expect(
      resourceDrillGuardReason({ ...guards, editorOpen: true }, "old", "new"),
    ).toBe("stale");
  });
});


describe("WBS exact schedule display scope", () => {
  const sourceContext = {
    schema: "wbs-view-source/1" as const, contextSourceVersion: "explicit-task-context:v1" as const,
    snapshotId: "wbs-snapshot", projectPublicId: "project", projectRevision: 2, catalogRevision: 3,
    calendarRevision: "calendar", dataSnapshotId: "data", spec: {version:"wbs-view:v1" as const,contextSourceVersion:"explicit-task-context:v1" as const,root:"equipment" as const,levels:["milestone" as const]},
    path: [{dimension:"equipment" as const,id:"E1"},{dimension:"milestone" as const,id:"M"}],
    range:{from:"2026-01-01",to:"2026-12-31"},asOfDate:"2026-06-01",mdPerMm:null,mdPerMmSource:"unset" as const,mdPerMmProvided:false,
  };
  const scope = {snapshotId:"wbs-snapshot",sourceContext,taskIds:["T1","T2"],assignmentIds:["A1","A2"],ancestorSummaryIds:["parent"]};
  const assignments = [{id:"A1",taskId:"T1"},{id:"A2",taskId:"T2"},{id:"E2-assignment",taskId:"T1"}];
  it("preserves exact E1→Milestone scope and narrows Task without including its E2 assignment", () => {
    const result = wbsScheduleDisplayScope(scope,{taskId:"T1"},assignments);
    expect(result.taskIds).toEqual(["T1"]);
    expect(result.assignmentIds).toEqual(["A1"]);
    expect(result.taskCount).toBe(1);
    expect(result.ancestorSummaryIds).toEqual(["parent"]);
    expect(result.sourceContext.sourceProjection).toEqual({kind:"schedule"});
    expect(sourceContext.path).toEqual([{dimension:"equipment",id:"E1"},{dimension:"milestone",id:"M"}]);
  });
  it("rejects foreign Tasks and Assignments instead of expanding the source", () => {
    expect(()=>wbsScheduleDisplayScope(scope,{taskId:"T3"},assignments)).toThrow("REPORT_STALE");
    expect(()=>wbsScheduleDisplayScope(scope,{taskId:"T1",assignmentId:"E2-assignment"},assignments)).toThrow("REPORT_STALE");
    expect(()=>wbsScheduleDisplayScope(scope,{taskId:"T1",assignmentId:"A2"},assignments)).toThrow("REPORT_STALE");
    expect(()=>wbsScheduleDisplayScope(scope,{assignmentId:"A1"},assignments)).toThrow("REPORT_STALE");
  });
  it("allows unassigned Task navigation while preserving an empty Assignment set", () => {
    const result=wbsScheduleDisplayScope({...scope,taskIds:["unassigned"],assignmentIds:[]},{taskId:"unassigned"},assignments);
    expect(result.taskIds).toEqual(["unassigned"]);
    expect(result.assignmentIds).toEqual([]);
  });
});

describe("#809 exact chart selection handoff",()=>{
 it("retains the selected co-assignee intersection for whole cell and task schedule actions",()=>{
  const sourceContext={projectPublicId:"p",projectRevision:1,catalogRevision:1,calendarRevision:"c",dataSnapshotId:"d",range:{from:"2026-10-05",to:"2026-10-09"},asOfDate:"2026-10-09",mdPerMm:null,mdPerMmSource:"unset" as const,mdPerMmProvided:false,schema:"wbs-view-source/1" as const,contextSourceVersion:"explicit-task-context:v1" as const,snapshotId:"s",spec:{version:"wbs-view:v1" as const,contextSourceVersion:"explicit-task-context:v1" as const,root:"resource" as const},path:[]};
  const scope={snapshotId:"s",sourceContext,taskIds:["T1","T2","T0"],assignmentIds:["A1","co-assignee","A2"],ancestorSummaryIds:[]};
  const assignments=[{id:"A1",taskId:"T1"},{id:"co-assignee",taskId:"T1"},{id:"A2",taskId:"T2"}];
  const exactSelection={taskIds:["T1","T2"],assignmentIds:["A1","A2"]};
  expect(wbsScheduleDisplayScope(scope,{exactSelection},assignments)).toMatchObject({taskIds:["T1","T2"],assignmentIds:["A1","A2"],taskCount:2,assignmentCount:2});
  expect(wbsScheduleDisplayScope(scope,{taskId:"T1",exactSelection},assignments)).toMatchObject({taskIds:["T1"],assignmentIds:["A1"]});
  expect(wbsScheduleDisplayScope(scope,{taskId:"T0",exactSelection:{taskIds:["T0"],assignmentIds:[]}},assignments).assignmentIds).toEqual([]);
  for(const invalid of [{taskIds:["foreign"],assignmentIds:[]},{taskIds:["T2"],assignmentIds:["A1"]},{taskIds:["T1","T1"],assignmentIds:["A1"]},{taskIds:["T1"],assignmentIds:["A1","A1"]}])expect(()=>wbsScheduleDisplayScope(scope,{exactSelection:invalid},assignments)).toThrow("REPORT_STALE");
 });
});
