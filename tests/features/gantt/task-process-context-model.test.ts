import { describe, expect, it } from "vitest";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { ancestorProcessSources, descendantTaskCount, processDraftError, processDraftKey, validTaskProcessContext } from "../../../src/features/gantt/task-process-context-model";
const tasks = [
  { taskId: "s", externalId: "summary", parentExternalId: null, type: "summary", name: "상위" },
  { taskId: "c", externalId: "child", parentExternalId: "summary", type: "task", name: "하위" },
  { taskId: "other", externalId: "other", parentExternalId: null, type: "task" },
] as ProjectTaskDto[];
describe("Task direct process context editor draft boundaries", () => {
  it("preserves legacy null separately from explicit zero, ignoring array order", () => {
    expect(processDraftKey(null, null)).not.toBe(processDraftKey([], []));
    expect(processDraftKey([{ processId: "a", scope: "self" }, { processId: "b", scope: "subtree" }], [])).toBe(processDraftKey([{ processId: "b", scope: "subtree" }, { processId: "a", scope: "self" }], []));
  });
  it("rejects removing a process before its WorkAreas and narrowing scope first", () => {
    const areas = [{ processId: "a", workAreaId: "wa", scope: "subtree" as const }];
    expect(processDraftError([], areas)).toContain("먼저 해제");
    expect(processDraftError([{ processId: "a", scope: "self" }], areas)).toContain("하위 작업 포함");
    expect(processDraftError([{ processId: "a", scope: "subtree" }], areas)).toBeNull();
    expect(processDraftError([], [])).toBeNull();
  });
  it("refuses missing, malformed, mixed-null, duplicate and orphan context snapshots", () => {
    const valid = { taskId: "c", processLinks: [{ processId: "a", scope: "self" }], workAreaLinks: [] };
    expect(validTaskProcessContext(valid)).toBe(true);
    expect(validTaskProcessContext({ taskId: "c", processLinks: null, workAreaLinks: null })).toBe(true);
    for (const invalid of [null, {}, { ...valid, workAreaLinks: null }, { ...valid, processLinks: [{ processId: "a", scope: "invalid" }] }, { ...valid, processLinks: [...valid.processLinks, ...valid.processLinks] }, { ...valid, processLinks: [], workAreaLinks: [{ processId: "a", workAreaId: "wa", scope: "self" }] }]) expect(validTaskProcessContext(invalid)).toBe(false);
  });
  it("shows ancestor subtree sources without deriving direct assignments or losing explicit zero", () => {
    const contexts = [{ taskId: "s", processLinks: [{ processId: "a", scope: "subtree" as const }, { processId: "b", scope: "self" as const }], workAreaLinks: [] }, { taskId: "c", processLinks: [], workAreaLinks: [] }];
    const sources = ancestorProcessSources("c", tasks, contexts);
    expect(sources).toHaveLength(1);
    expect(sources[0].source.name).toBe("상위");
    expect(sources[0].processLinks).toEqual([{ processId: "a", scope: "subtree" }]);
    expect(contexts[1].processLinks).toEqual([]);
    expect(ancestorProcessSources("other", tasks, contexts)).toEqual([]);
    expect(descendantTaskCount("s", tasks)).toBe(1);
    expect(descendantTaskCount("c", tasks)).toBe(0);
  });
});
