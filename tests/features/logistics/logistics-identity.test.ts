import { describe, expect, it } from "vitest";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { logisticsMatchesQuery, logisticsName } from "../../../src/features/logistics/logistics-identity";
import { taskContextLabels } from "../../../src/features/logistics/task-context-label";

const task = (taskId: string, externalId: string, name: string, parentExternalId: string | null = null) =>
  ({ taskId, externalId, name, parentExternalId }) as ProjectTaskDto;

describe("logistics display identity", () => {
  it("keeps unique names primary and leaves canonical long codes intact", () => {
    const item = { name: "반송", code: "process-" + "x".repeat(180) };
    expect(logisticsName(item, [item])).toBe("반송");
    expect(item.code).toHaveLength(188);
  });

  it("disambiguates process names using sort order before falling back to full codes", () => {
    const a = { name: "반송", code: "process-a", sortOrder: 1 };
    const b = { name: "반송", code: "process-b", sortOrder: 2 };
    expect(logisticsName(a, [a, b])).toBe("반송 (정렬 1)");
    expect(logisticsName(a, [a, { ...b, sortOrder: 1 }])).toBe("반송 (process-a)");
  });

  it("preserves exact distinguishing codes for duplicate instance names and unnamed legacy rows", () => {
    const peers = [{ name: "AGV", code: "AGV-A" }, { name: "AGV", code: "AGV-B" }];
    expect(peers.map(item => logisticsName(item, peers))).toEqual(["AGV (AGV-A)", "AGV (AGV-B)"]);
    expect(logisticsName({ name: " ", code: "legacy-raw-code" }, [])).toBe("이름 확인 필요 (legacy-raw-code)");
  });
});

describe("task name paths", () => {
  it("uses ancestry to distinguish equal task names without external IDs", () => {
    const rows = [task("a", "A", "반입"), task("b", "B", "반출"), task("a1", "A-1", "검사", "A"), task("b1", "B-1", "검사", "B")];
    expect(taskContextLabels(rows)).toMatchObject({ a1: "반입 / 검사", b1: "반출 / 검사" });
  });

  it("adds full canonical external IDs only when name paths still collide", () => {
    expect(taskContextLabels([task("a", "ext-a", "검사"), task("b", "ext-b", "검사")])).toEqual({ a: "검사 (ext-a)", b: "검사 (ext-b)" });
  });

  it("handles missing ancestry, empty names and cycles without raw UUID fallback", () => {
    const rows = [task("a", "A", "작업", "missing"), task("b", "B", " "), task("c", "C", "순환", "C")];
    expect(taskContextLabels(rows)).toEqual({ a: "상위 작업 확인 필요 / 작업", b: "이름 확인 필요", c: "순환" });
  });
});

describe("logistics instance search", () => {
  it("matches names, codes and exact canonical UUIDs without mutating source values", () => {
    const instance = { name: "반송 설비", code: "EQ-Canonical", id: "f87fa22e-341d-49da-989d-9f91ba44d7db" };
    expect(logisticsMatchesQuery(instance, "반송")).toBe(true);
    expect(logisticsMatchesQuery(instance, "eq-canonical")).toBe(true);
    expect(logisticsMatchesQuery(instance, instance.id.toUpperCase())).toBe(true);
    expect(logisticsMatchesQuery(instance, "unknown-id")).toBe(false);
    expect(instance.code).toBe("EQ-Canonical");
  });
});
