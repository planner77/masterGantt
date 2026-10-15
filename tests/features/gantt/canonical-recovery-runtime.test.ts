import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import observation from "../../fixtures/gantt-canonical-recovery/actual-recovery-2.7.3.json";
import provenance from "../../fixtures/gantt-canonical-recovery/actual-recovery-provenance.json";
import { normalizeSerializedCore } from "../../../src/features/gantt/state-consistency";

const root = fileURLToPath(new URL("../../../", import.meta.url));
describe("U2 installed public Core recovery evidence", () => {
  it("pins actual module, fixture and installed lockfile without claiming production or HTTP validation", () => {
    expect(provenance.installedGanttVersion).toBe("2.7.3");
    expect(provenance.installedStoreVersion).toBe("2.7.2");
    expect(provenance.counts).toEqual({ tasks: 5, links: 2, scenarios: 12 });
    for (const [path, fingerprint] of Object.entries(provenance.sha256)) {
      expect(createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex"), path).toBe(fingerprint);
    }
    expect(provenance.notTested).toContain("actual HTTP/SQLite and server commit ambiguity");
    expect(provenance.notTested).toContain("production U5 wiring and full native dirty event registration");
    expect(provenance.originalFailures.filter(failure => failure.phase === "PRE_REVIEW")).toHaveLength(1);
  });
  it("records all refused actual data transitions as drift then verified conformance", () => {
    expect(observation.rows.map(row => row.name)).toEqual(provenance.scenarios);
    expect(observation.rows.every(row => row.outcome === "SETTLED" && row.finalMatch)).toBe(true);
    expect(observation.rows.slice(1).every(row => "driftDetected" in row && row.driftDetected)).toBe(true);
    const row = (name: string) => observation.rows.find(value => value.name === name)!;
    expect(row("fresh-dto-no-op").actions).toEqual([]);
    expect(row("date-422").actions).toEqual(["update-task"]);
    expect(row("metadata-422").actions).toEqual(["update-task"]);
    expect(row("link-add-422").actions).toEqual(["delete-link"]);
    expect(row("link-delete-422").actions).toEqual(["add-link"]);
    const childActions: readonly string[] = row("parent-add-422-surviving-child").actions;
    expect(childActions.indexOf("move-task")).toBeLessThan(childActions.indexOf("delete-task"));
    expect(observation.serverMutationCalls).toBe(0);
    expect(observation.rows.flatMap(row => row.actions).some(action => ["scroll-chart", "resize-chart", "filter-tasks", "set-columns", "select-task"].includes(action))).toBe(false);
  });
  it("preserves surviving selection and collapsed full hierarchy including Milestone and links", () => {
    for (const row of observation.rows.slice(1)) {
      expect("selected" in row ? row.selected : null).toEqual(["fixture-b"]);
    }
    expect(observation.rows.at(-1)).toMatchObject({ treeOpen: false });
    const hydrate = (value: unknown): unknown => JSON.parse(JSON.stringify(value), (key, item) =>
      (key === "start" || key === "end") && typeof item === "string" ? new Date(item) : item);
    const result = normalizeSerializedCore({ tasks: hydrate(observation.snapshot.tasks), tree: hydrate(observation.snapshot.tree), links: hydrate(observation.snapshot.links) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("actual public recovery snapshot invalid");
    expect(result.value.tree.map(task => task.id)).toEqual(["fixture-root", "fixture-a", "fixture-b", "fixture-c", "fixture-m"]);
    expect(result.value.links.map(link => link.id).sort()).toEqual(["fixture-ab", "fixture-bc"]);
    expect(result.value.tasks.find(task => task.id === "fixture-m")).toMatchObject({ end: null, progress: 0 });
    expect(result.value.tasks.find(task => task.id === "fixture-b")).toMatchObject({ externalId: null, projectDisplayKey: null });
  });
});
