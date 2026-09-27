import { describe, expect, it } from "vitest";

import {
  extractCollapsedSummaryIds,
  getSummaryToggleStorageKey,
  loadSummaryTogglePreference,
  parseSummaryTogglePreference,
  saveSummaryTogglePreference,
  serializeSummaryTogglePreference,
  type StorageLike,
} from "../../../src/features/gantt/summary-toggle-preference";

describe("summary-toggle-preference", () => {
  const projectIdA = "11111111-1111-4111-8111-111111111111";
  const projectIdB = "22222222-2222-4222-8222-222222222222";

  class MockStorage implements StorageLike {
    private store = new Map<string, string>();
    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
  }

  describe("getSummaryToggleStorageKey", () => {
    it("creates isolated storage keys per project", () => {
      expect(getSummaryToggleStorageKey(projectIdA)).toBe(
        `mastergantt:summary-toggle:${projectIdA}`,
      );
      expect(getSummaryToggleStorageKey(projectIdB)).toBe(
        `mastergantt:summary-toggle:${projectIdB}`,
      );
      expect(getSummaryToggleStorageKey(projectIdA)).not.toBe(
        getSummaryToggleStorageKey(projectIdB),
      );
    });
  });

  describe("parseSummaryTogglePreference", () => {
    it("parses valid v1 payload", () => {
      const raw = JSON.stringify({
        version: 1,
        collapsedSummaryIds: ["sum-1", "sum-2"],
      });
      expect(parseSummaryTogglePreference(raw)).toEqual(["sum-1", "sum-2"]);
    });

    it("deduplicates collapsed IDs", () => {
      const raw = JSON.stringify({
        version: 1,
        collapsedSummaryIds: ["sum-1", "sum-2", "sum-1", "sum-2"],
      });
      expect(parseSummaryTogglePreference(raw)).toEqual(["sum-1", "sum-2"]);
    });

    it("filters out stale IDs when currentSummaryIds is provided", () => {
      const raw = JSON.stringify({
        version: 1,
        collapsedSummaryIds: ["sum-1", "sum-2", "sum-deleted"],
      });
      const current = new Set(["sum-1", "sum-2", "sum-3"]);
      expect(parseSummaryTogglePreference(raw, current)).toEqual(["sum-1", "sum-2"]);
    });

    it("returns empty array on malformed JSON", () => {
      expect(parseSummaryTogglePreference("invalid json {")).toEqual([]);
      expect(parseSummaryTogglePreference("")).toEqual([]);
      expect(parseSummaryTogglePreference(null)).toEqual([]);
    });

    it("returns empty array on incompatible schema version", () => {
      const v2 = JSON.stringify({
        version: 2,
        collapsedSummaryIds: ["sum-1"],
      });
      expect(parseSummaryTogglePreference(v2)).toEqual([]);

      const missingVersion = JSON.stringify({
        collapsedSummaryIds: ["sum-1"],
      });
      expect(parseSummaryTogglePreference(missingVersion)).toEqual([]);
    });

    it("returns empty array when collapsedSummaryIds is not an array", () => {
      const invalid = JSON.stringify({
        version: 1,
        collapsedSummaryIds: "sum-1",
      });
      expect(parseSummaryTogglePreference(invalid)).toEqual([]);
    });
  });

  describe("serializeSummaryTogglePreference", () => {
    it("serializes to valid v1 payload and deduplicates", () => {
      const serialized = serializeSummaryTogglePreference(["sum-1", "sum-2", "sum-1"]);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual({
        version: 1,
        collapsedSummaryIds: ["sum-1", "sum-2"],
      });
    });
  });

  describe("loadSummaryTogglePreference and saveSummaryTogglePreference", () => {
    it("saves and loads preferences per project without leaking across projects", () => {
      const storage = new MockStorage();

      saveSummaryTogglePreference(projectIdA, ["sum-A1", "sum-A2"], storage);
      saveSummaryTogglePreference(projectIdB, ["sum-B1"], storage);

      expect(loadSummaryTogglePreference(projectIdA, undefined, storage)).toEqual([
        "sum-A1",
        "sum-A2",
      ]);
      expect(loadSummaryTogglePreference(projectIdB, undefined, storage)).toEqual(["sum-B1"]);
    });

    it("normalizes stale IDs back to storage during load", () => {
      const storage = new MockStorage();
      storage.setItem(
        getSummaryToggleStorageKey(projectIdA),
        JSON.stringify({
          version: 1,
          collapsedSummaryIds: ["sum-1", "sum-deleted"],
        }),
      );

      const current = new Set(["sum-1", "sum-2"]);
      expect(loadSummaryTogglePreference(projectIdA, current, storage)).toEqual(["sum-1"]);
      expect(storage.getItem(getSummaryToggleStorageKey(projectIdA))).toBe(
        serializeSummaryTogglePreference(["sum-1"]),
      );
    });

    it("normalizes an all-stale preference to an empty list", () => {
      const storage = new MockStorage();
      storage.setItem(
        getSummaryToggleStorageKey(projectIdA),
        JSON.stringify({
          version: 1,
          collapsedSummaryIds: ["sum-deleted"],
        }),
      );

      const current = new Set(["sum-1", "sum-2"]);
      expect(loadSummaryTogglePreference(projectIdA, current, storage)).toEqual([]);
      expect(storage.getItem(getSummaryToggleStorageKey(projectIdA))).toBe(
        serializeSummaryTogglePreference([]),
      );
    });

    it("handles storage exceptions gracefully during load", () => {
      const faultyStorage: StorageLike = {
        getItem: () => {
          throw new Error("SecurityError: storage disabled");
        },
        setItem: () => {},
      };
      expect(() =>
        loadSummaryTogglePreference(projectIdA, undefined, faultyStorage),
      ).not.toThrow();
      expect(loadSummaryTogglePreference(projectIdA, undefined, faultyStorage)).toEqual([]);
    });

    it("handles storage exceptions gracefully during save", () => {
      const faultyStorage: StorageLike = {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      };
      expect(() =>
        saveSummaryTogglePreference(projectIdA, ["sum-1"], faultyStorage),
      ).not.toThrow();
    });

    it("returns empty array if projectPublicId is empty", () => {
      const storage = new MockStorage();
      expect(loadSummaryTogglePreference("", undefined, storage)).toEqual([]);
      saveSummaryTogglePreference("", ["sum-1"], storage);
      expect(storage.getItem("mastergantt:summary-toggle:")).toBeNull();
    });
  });

  describe("extractCollapsedSummaryIds", () => {
    it("extracts only true collapsed IDs that exist in currentSummaryIds", () => {
      const state = new Map<string, boolean>([
        ["sum-1", true],
        ["sum-2", false],
        ["sum-3", true],
        ["leaf-task", true], // not in summary set
      ]);
      const currentSummaries = new Set(["sum-1", "sum-2", "sum-3"]);

      const collapsed = extractCollapsedSummaryIds(state, currentSummaries);
      expect(collapsed).toEqual(["sum-1", "sum-3"]);
    });
  });
});
