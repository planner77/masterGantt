import { describe, expect, it } from "vitest";
import {
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
