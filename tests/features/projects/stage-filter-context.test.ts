import { describe, expect, it } from "vitest";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { stageCandidateContext } from "../../../src/features/projects/stage-filter-picker";

function task(taskId: string, name: string, parentExternalId: string | null = null): ProjectTaskDto {
  return { taskId, externalId: taskId, name, parentExternalId, type: "milestone", scheduleMode: "auto",
    requestedStart: null, start: "2026-10-01", end: "2026-10-01", duration: 0, progress: 0, siblingOrder: 0 };
}

describe("Milestone picker context", () => {
  it("adds external identity only when the displayed name and context collide", () => {
    const first = task("MS-A", "승인", "P-A"), second = task("MS-B", "승인", "P-B");
    const tasks = [task("P-A", "공정"), task("P-B", "공정"), first, second];
    expect(stageCandidateContext(first, tasks)).toMatch(/공정.*적용 예정일 2026-10-01.*MS-A$/);
    expect(stageCandidateContext(second, tasks)).toMatch(/MS-B$/);
    tasks[1].name = "다른 공정";
    expect(stageCandidateContext(first, tasks)).not.toContain("MS-A");
    expect(stageCandidateContext(second, tasks)).toContain("다른 공정");
    expect(stageCandidateContext(second, tasks)).not.toContain("MS-B");
  });
  it("uses date context to distinguish same-name Milestones without exposing identifiers", () => {
    const first = task("MS-A", "승인"), second = { ...task("MS-B", "승인"), start: "2026-10-02" };
    expect(stageCandidateContext(first, [first, second])).not.toContain("MS-A");
    expect(stageCandidateContext(second, [first, second])).toContain("2026-10-02");
  });
});
