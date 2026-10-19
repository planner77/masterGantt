import { describe, expect, it } from "vitest";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { relationCandidateContext } from "../../../src/features/gantt/relation-editor-dialog";

function task(taskId: string, name: string, parentExternalId: string | null = null): ProjectTaskDto {
  return {
    taskId, externalId: taskId, name, parentExternalId, type: "task", scheduleMode: "auto",
    requestedStart: null, start: "2026-10-01", end: "2026-10-02", duration: 2, progress: 0, siblingOrder: 0,
  };
}

describe("relation candidate context", () => {
  it("distinguishes children of distinct parents with identical displayed names", () => {
    const first = task("CHILD-A", "설치", "PARENT-A");
    const second = task("CHILD-B", "설치", "PARENT-B");
    const tasks = [task("PARENT-A", "공정"), task("PARENT-B", "공정"), first, second];
    expect(relationCandidateContext(first, tasks)).toBe("공정 · 2026-10-01 · CHILD-A");
    expect(relationCandidateContext(second, tasks)).toBe("공정 · 2026-10-01 · CHILD-B");
  });
  it("keeps identifiers hidden when the visible parent context distinguishes candidates", () => {
    const first = task("CHILD-A", "설치", "PARENT-A");
    const second = task("CHILD-B", "설치", "PARENT-B");
    const tasks = [task("PARENT-A", "기계 공정"), task("PARENT-B", "전기 공정"), first, second];
    expect(relationCandidateContext(first, tasks)).toBe("기계 공정 · 2026-10-01");
    expect(relationCandidateContext(second, tasks)).toBe("전기 공정 · 2026-10-01");
  });
});
