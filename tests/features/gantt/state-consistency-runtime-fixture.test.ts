import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readCoreSnapshot, sameCoreSnapshot, normalizeSerializedCore } from "../../../src/features/gantt/state-consistency";
import snapshot from "../../fixtures/gantt-state-consistency/actual-core-2.7.3.json";
import provenance from "../../fixtures/gantt-state-consistency/actual-core-provenance.json";

const root = fileURLToPath(new URL("../../../", import.meta.url));
// JSON is an evidence transport; the public runtime API returns Date objects.
const hydrate = (value: unknown): unknown => JSON.parse(JSON.stringify(value), (key, item) =>
  (key === "start" || key === "end") && typeof item === "string" ? new Date(item) : item);
const read = () => normalizeSerializedCore({ tasks: hydrate(snapshot.serializeTasks), tree: hydrate(snapshot.serializeTree), links: hydrate(snapshot.serializeLinks) });

describe("U1 installed 2.7.3 synthetic browser reader evidence", () => {
  it("pins the actual public serialize source, lockfile and snapshot independently of product conformance", () => {
    expect(provenance.installedGanttVersion).toBe("2.7.3");
    expect(provenance.installedStoreVersion).toBe("2.7.2");
    expect(provenance.collection).toBe("SYNTHETIC_CORE_BROWSER");
    for (const [file, fingerprint] of Object.entries(provenance.sha256)) {
      expect(createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex"), file).toBe(fingerprint);
    }
    expect(provenance.counts).toEqual({ tasks: 4, tree: 4, links: 1 });
    expect(provenance.notTested).toContain("actual HTTP/SQLite");
  });
  it("reads complete DFS tree and links through the same public API contract", () => {
    const calls: string[] = [];
    const hydrated = { tasks: hydrate(snapshot.serializeTasks), tree: hydrate(snapshot.serializeTree), links: hydrate(snapshot.serializeLinks) };
    const result = readCoreSnapshot({ serialize(config) {
      const key = config?.data as keyof typeof hydrated;
      calls.push(key); return hydrated[key] as ReturnType<Parameters<typeof readCoreSnapshot>[0]["serialize"]>;
    } });
    expect(calls).toEqual(["tasks", "tree", "links"]);
    expect(result).toEqual(read());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("actual snapshot unreadable");
    expect(result.value.tree.map(task => task.id)).toEqual(["fixture-root", "fixture-c", "fixture-a", "fixture-m"]);
    expect(result.value.tasks.find(task => task.id === "fixture-m")).toMatchObject({ end: null, progress: 0 });
    expect(result.value.links).toEqual([{ id: "fixture-link", source: "fixture-a", target: "fixture-c", type: "e2s" }]);
    expect(result.value.tasks[0]).not.toHaveProperty("data");
    expect(result.value.tasks[0]).not.toHaveProperty("$x");
  });
  it("matches the captured 2.7.3 public snapshot to the ORIGINAL browser.tsx canonical input with undated summary", () => {
    // Mirror browser.tsx's pre-render input (dates here are fixed Asia/Seoul instants).
    const canonical = normalizeCanonicalCore({
      tasks: [
        { id: "fixture-root", text: "Synthetic root", type: "summary", parent: 0, open: true },
        { id: "fixture-c", text: "Synthetic C", type: "task", parent: "fixture-root", start: new Date("2026-01-08T00:00:00+09:00"), end: new Date("2026-01-10T00:00:00+09:00"), progress: 25 },
        { id: "fixture-a", text: "Synthetic A", type: "task", parent: "fixture-root", start: new Date("2026-01-05T00:00:00+09:00"), end: new Date("2026-01-08T00:00:00+09:00"), progress: 50, externalId: "synthetic-A", projectDisplayKey: "SYN.A" },
        { id: "fixture-m", text: "Synthetic milestone", type: "milestone", parent: 0, start: new Date("2026-01-12T00:00:00+09:00"), duration: 0 },
      ],
      links: [{ id: "fixture-link", source: "fixture-a", target: "fixture-c", type: "e2s" }],
    });
    const actual = read();
    expect(canonical.ok && actual.ok && sameCoreSnapshot(actual.value, canonical.value)).toBe(true);
    if (!canonical.ok || !actual.ok) throw new Error("synthetic fixture unreadable");
    expect(canonical.value.tasks[0]).toMatchObject({ start: new Date("2026-01-05T00:00:00+09:00").getTime(), end: new Date("2026-01-10T00:00:00+09:00").getTime() });
    const drift = { ...actual.value, tasks: actual.value.tasks.map(task => task.id === "fixture-root" ? { ...task, start: task.start! + 86_400_000 } : task) };
    expect(sameCoreSnapshot(drift, canonical.value)).toBe(false);
  });
  it("requires Date hydration and does not certify transport strings or a null collection", () => {
    expect(normalizeSerializedCore({ tasks: snapshot.serializeTasks, tree: snapshot.serializeTree, links: snapshot.serializeLinks })).toMatchObject({ ok: false, reason: "INVALID_TASKS" });
    expect(readCoreSnapshot({ serialize: () => null })).toMatchObject({ ok: false });
  });
  it("distinguishes a changed actual date or link from the frozen reader evidence", () => {
    const original = read();
    if (!original.ok) throw new Error("actual snapshot unreadable");
    const dateDrift = { ...original.value, tasks: original.value.tasks.map(task => task.id === "fixture-a" ? { ...task, start: task.start! + 86_400_000 } : task) };
    const linkDrift = { ...original.value, links: [] };
    expect(sameCoreSnapshot(dateDrift, original.value)).toBe(false);
    expect(sameCoreSnapshot(linkDrift, original.value)).toBe(false);
    expect(sameCoreSnapshot(original.value, original.value)).toBe(true);
  });
});
