import { describe, expect, it } from "vitest";
import type { ProjectLinkDto, ProjectTaskDto } from "../../../src/contracts/projects";
import {
  findNextRelatedLink,
  getRelatedLinksForAnchor,
  searchCandidateTasks,
} from "../../../src/features/gantt/relation-editor-model";

const sampleTasks: ProjectTaskDto[] = [
  {
    taskId: "task-1",
    externalId: "T1",
    name: "기획 및 분석",
    type: "task",
    scheduleMode: "auto",
    requestedStart: null,
    start: "2026-03-01",
    end: "2026-03-05",
    duration: 5,
    progress: 100,
    parentExternalId: null,
    siblingOrder: 0,
  },
  {
    taskId: "task-2",
    externalId: "T2",
    name: "UI 설계",
    type: "task",
    scheduleMode: "auto",
    requestedStart: null,
    start: "2026-03-06",
    end: "2026-03-10",
    duration: 5,
    progress: 50,
    parentExternalId: null,
    siblingOrder: 1,
  },
  {
    taskId: "task-3",
    externalId: "T3",
    name: "API 개발",
    type: "task",
    scheduleMode: "auto",
    requestedStart: null,
    start: "2026-03-11",
    end: "2026-03-15",
    duration: 5,
    progress: 0,
    parentExternalId: null,
    siblingOrder: 2,
  },
  {
    taskId: "task-summary",
    externalId: "SUM1",
    name: "개발 단계 요약",
    type: "summary",
    scheduleMode: "auto",
    requestedStart: null,
    start: "2026-03-01",
    end: "2026-03-15",
    duration: 15,
    progress: 50,
    parentExternalId: null,
    siblingOrder: 3,
  },
  {
    taskId: "task-milestone",
    externalId: "MS1",
    name: "1차 릴리스",
    type: "milestone",
    scheduleMode: "auto",
    requestedStart: null,
    start: "2026-03-16",
    end: "2026-03-16",
    duration: 0,
    progress: 0,
    parentExternalId: null,
    siblingOrder: 4,
  },
];

const sampleLinks: ProjectLinkDto[] = [
  {
    id: "link-1-2",
    predecessorExternalId: "T1",
    successorExternalId: "T2",
    type: "FS",
    lag: 0,
  },
  {
    id: "link-2-3",
    predecessorExternalId: "T2",
    successorExternalId: "T3",
    type: "FS",
    lag: 1,
  },
];

describe("relation-editor-model", () => {
  describe("getRelatedLinksForAnchor", () => {
    it("returns incoming and outgoing links for the specified anchor task", () => {
      // T2 has incoming link from T1, and outgoing link to T3
      const result = getRelatedLinksForAnchor("T2", sampleLinks, sampleTasks);

      expect(result.predecessors).toHaveLength(1);
      expect(result.predecessors[0].link.id).toBe("link-1-2");
      expect(result.predecessors[0].direction).toBe("incoming");
      expect(result.predecessors[0].targetTask?.name).toBe("기획 및 분석");

      expect(result.successors).toHaveLength(1);
      expect(result.successors[0].link.id).toBe("link-2-3");
      expect(result.successors[0].direction).toBe("outgoing");
      expect(result.successors[0].targetTask?.name).toBe("API 개발");
    });

    it("returns empty lists when anchor task has no links", () => {
      const result = getRelatedLinksForAnchor("MS1", sampleLinks, sampleTasks);
      expect(result.predecessors).toHaveLength(0);
      expect(result.successors).toHaveLength(0);
    });
  });


  describe("findNextRelatedLink", () => {
    it("selects only another relation connected to the current anchor", () => {
      const links: ProjectLinkDto[] = [
        ...sampleLinks,
        {
          id: "link-unrelated",
          predecessorExternalId: "T3",
          successorExternalId: "MS1",
          type: "FS",
          lag: 0,
        },
      ];

      expect(findNextRelatedLink("link-1-2", "T2", links)?.id).toBe("link-2-3");
    });

    it("returns undefined instead of falling back to an unrelated relation", () => {
      const links: ProjectLinkDto[] = [
        {
          id: "link-active",
          predecessorExternalId: "T1",
          successorExternalId: "T2",
          type: "FS",
          lag: 0,
        },
        {
          id: "link-unrelated",
          predecessorExternalId: "T3",
          successorExternalId: "MS1",
          type: "FS",
          lag: 0,
        },
      ];

      expect(findNextRelatedLink("link-active", "T2", links)).toBeUndefined();
    });
  });

  describe("searchCandidateTasks", () => {
    it("excludes summary tasks, self, and already connected tasks", () => {
      // For T2 as anchor, looking for predecessor candidates:
      // - T1 is already a predecessor -> excluded
      // - SUM1 is summary -> excluded
      // - T2 is self -> excluded
      // Candidates should be T3 and MS1
      const candidates = searchCandidateTasks({
        anchorExternalId: "T2",
        direction: "predecessor",
        query: "",
        tasks: sampleTasks,
        links: sampleLinks,
      });

      const candidateIds = candidates.map((c) => c.externalId);
      expect(candidateIds).toContain("T3");
      expect(candidateIds).toContain("MS1");
      expect(candidateIds).not.toContain("T1");
      expect(candidateIds).not.toContain("T2");
      expect(candidateIds).not.toContain("SUM1");
    });

    it("excludes already connected successors when searching for successor candidates", () => {
      // For T2 as anchor, looking for successor candidates:
      // - T3 is already a successor -> excluded
      // - T2 is self -> excluded
      // - SUM1 is summary -> excluded
      // Candidates should be T1 and MS1
      const candidates = searchCandidateTasks({
        anchorExternalId: "T2",
        direction: "successor",
        query: "",
        tasks: sampleTasks,
        links: sampleLinks,
      });

      const candidateIds = candidates.map((c) => c.externalId);
      expect(candidateIds).toContain("T1");
      expect(candidateIds).toContain("MS1");
      expect(candidateIds).not.toContain("T3");
      expect(candidateIds).not.toContain("T2");
      expect(candidateIds).not.toContain("SUM1");
    });

    it("filters candidates by name, externalId, or canonical taskId", () => {
      const byName = searchCandidateTasks({
        anchorExternalId: "T2",
        direction: "successor",
        query: "릴리스",
        tasks: sampleTasks,
        links: sampleLinks,
      });
      expect(byName).toHaveLength(1);
      expect(byName[0].externalId).toBe("MS1");

      const byExternalId = searchCandidateTasks({
        anchorExternalId: "T2",
        direction: "successor",
        query: "MS1",
        tasks: sampleTasks,
        links: sampleLinks,
      });
      expect(byExternalId).toHaveLength(1);
      expect(byExternalId[0].taskId).toBe("task-milestone");

      const byTaskId = searchCandidateTasks({
        anchorExternalId: "T2",
        direction: "successor",
        query: "  TASK-MILESTONE  ",
        tasks: sampleTasks,
        links: sampleLinks,
      });
      expect(byTaskId).toHaveLength(1);
      expect(byTaskId[0].externalId).toBe("MS1");

      const byPartialTaskId = searchCandidateTasks({
        anchorExternalId: "T2",
        direction: "successor",
        query: "MILE",
        tasks: sampleTasks,
        links: sampleLinks,
      });
      expect(byPartialTaskId).toHaveLength(1);
      expect(byPartialTaskId[0].taskId).toBe("task-milestone");
    });
  });
});
