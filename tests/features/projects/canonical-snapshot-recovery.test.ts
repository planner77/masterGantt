import { describe, expect, it } from "vitest";
import type { ProjectSnapshotResponse } from "../../../src/contracts/projects";
import { canAcceptCanonicalSnapshot, replayConfirmedSnapshot } from "../../../src/features/projects/canonical-snapshot-recovery";

function snapshot(revision: number, names: string[] = [], publicId = "project"): ProjectSnapshotResponse {
  return { data: {
    permission: "readonly",
    project: { publicId, name: "Project", description: "", status: "planned", revision, calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] } },
    tasks: names.map((name, index) => ({ taskId: name, externalId: name, name, type: "task", scheduleMode: "auto", requestedStart: "2026-09-14", start: "2026-09-14", end: "2026-09-14", duration: 1, progress: 0, parentExternalId: null, siblingOrder: index })),
    links: [],
  } };
}

describe("confirmed canonical recovery", () => {
  it("rejects a pre-delete revision and replays the latest confirmed task set", () => {
    const before = snapshot(10, ["A", "C"]);
    const confirmed = snapshot(11, ["A"]);
    expect(canAcceptCanonicalSnapshot(before, confirmed, "project")).toBe(true);
    expect(canAcceptCanonicalSnapshot(confirmed, before, "project")).toBe(false);
    const recovered = replayConfirmedSnapshot(confirmed);
    expect(recovered.data.project.revision).toBe(11);
    expect(recovered.data.tasks.map((task) => task.name)).toEqual(["A"]);
    expect(recovered.data.tasks).not.toBe(confirmed.data.tasks);
    expect(confirmed.data.tasks.map((task) => task.name)).toEqual(["A"]);
  });

  it("accepts equal/newer server revisions, including a committed request whose response was lost", () => {
    const confirmed = snapshot(11);
    expect(canAcceptCanonicalSnapshot(confirmed, snapshot(11), "project")).toBe(true);
    expect(canAcceptCanonicalSnapshot(confirmed, snapshot(12), "project")).toBe(true);
  });

  it("separates project identities and allows a new workspace's initial revision", () => {
    expect(canAcceptCanonicalSnapshot(snapshot(11), snapshot(12, [], "other"), "project")).toBe(false);
    expect(canAcceptCanonicalSnapshot(snapshot(11), snapshot(1, [], "other"), "other")).toBe(true);
    expect(canAcceptCanonicalSnapshot(null, snapshot(1), "project")).toBe(true);
  });
});
