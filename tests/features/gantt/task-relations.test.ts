import { describe, expect, it } from "vitest";
import type { ProjectLinkDto, ProjectTaskDto } from "../../../src/contracts/projects";
import { buildTaskRelations, formatTaskRelationType } from "../../../src/features/gantt/task-relations";

function task(externalId: string, name: string): ProjectTaskDto {
  return {
    taskId: `00000000-0000-4000-8000-${externalId.padStart(12, "0").slice(-12)}`,
    externalId,
    name,
    type: "task",
    scheduleMode: "auto",
    requestedStart: "2026-09-15",
    start: "2026-09-15",
    end: "2026-09-15",
    duration: 1,
    progress: 0,
    parentExternalId: null,
    siblingOrder: 0,
  };
}

function link(id: string, predecessorExternalId: string, successorExternalId: string): ProjectLinkDto {
  return { id, predecessorExternalId, successorExternalId, type: "FS", lag: 0 };
}

describe("Task Editor 관계 표시 모델", () => {
  const tasks = [
    task("TASK-001", "같은 이름"),
    task("TASK-002", "대상 작업"),
    task("TASK-003", "같은 이름"),
    task("TASK-004", "후행 작업"),
  ];
  const links = [
    link("L-1", "TASK-001", "TASK-002"),
    link("L-2", "TASK-003", "TASK-002"),
    link("L-3", "TASK-002", "TASK-004"),
  ];

  it("successorExternalId가 현재 작업이면 선행 작업으로 판정한다", () => {
    const relations = buildTaskRelations(tasks[1], tasks, links);
    expect(relations.predecessors.map((relation) => relation.relatedTaskExternalId)).toEqual(["TASK-001", "TASK-003"]);
    expect(relations.predecessors.every((relation) => relation.direction === "predecessor")).toBe(true);
  });

  it("predecessorExternalId가 현재 작업이면 후행 작업으로 판정한다", () => {
    const relations = buildTaskRelations(tasks[1], tasks, links);
    expect(relations.successors).toHaveLength(1);
    expect(relations.successors[0]).toMatchObject({
      direction: "successor",
      relatedTaskExternalId: "TASK-004",
      relatedTaskName: "후행 작업",
      type: "FS",
      lag: 0,
      resolved: true,
    });
  });

  it("동일한 작업명이 있어도 externalId 기준으로 상대 작업을 구분한다", () => {
    const relations = buildTaskRelations(tasks[1], tasks, links);
    expect(relations.predecessors).toEqual([
      expect.objectContaining({ relatedTaskExternalId: "TASK-001", relatedTaskName: "같은 이름" }),
      expect.objectContaining({ relatedTaskExternalId: "TASK-003", relatedTaskName: "같은 이름" }),
    ]);
  });

  it("관계가 없으면 선행/후행 목록을 빈 배열로 반환한다", () => {
    expect(buildTaskRelations(task("TASK-999", "독립 작업"), tasks, links)).toEqual({ predecessors: [], successors: [] });
  });

  it("상대 작업을 찾지 못한 비정상 snapshot도 숨기지 않고 식별 가능하게 반환한다", () => {
    const relations = buildTaskRelations(tasks[1], tasks, [...links, link("BROKEN", "MISSING", "TASK-002")]);
    expect(relations.predecessors.at(-1)).toMatchObject({
      relatedTaskExternalId: "MISSING",
      relatedTaskName: "작업 정보 없음",
      resolved: false,
    });
  });

  it("복수 관계의 type과 lag를 손실 없이 표시 모델에 보존한다", () => {
    const relations = buildTaskRelations(tasks[1], tasks, [
      ...links,
      { id: "L-4", predecessorExternalId: "TASK-001", successorExternalId: "TASK-002", type: "SS", lag: 2 },
    ]);
    expect(relations.predecessors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "L-1", type: "FS", lag: 0 }),
      expect.objectContaining({ id: "L-2", type: "FS", lag: 0 }),
      expect.objectContaining({ id: "L-4", type: "SS", lag: 2 }),
    ]));
  });

  it("현재 FS 유형을 사용자 친화적으로 표시하고 향후 유형도 한 곳에서 확장한다", () => {
    expect(formatTaskRelationType("FS")).toBe("FS (종료 → 시작)");
    expect(formatTaskRelationType("SS")).toBe("SS (시작 → 시작)");
    expect(formatTaskRelationType("FF")).toBe("FF (종료 → 종료)");
    expect(formatTaskRelationType("SF")).toBe("SF (시작 → 종료)");
    expect(formatTaskRelationType("CUSTOM")).toBe("CUSTOM");
  });
});
