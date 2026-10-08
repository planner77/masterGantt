import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import type { ImportPayload11 } from "../../../src/contracts/import";
import type { ProjectSnapshotResponse } from "../../../src/contracts/projects";

/** Fixed authored data; UUIDs are advisory and must never become target identities. */
export function canonicalInterchangeFixture(): ImportPayload11 {
  const tasks: ImportPayload11["tasks"] = [];
  const summary = (externalId: string, parentExternalId: string | null = null) => {
    tasks.push({ externalId, name: externalId, type: "summary", parentExternalId, requestedStart: null, predecessors: [] });
  };
  const leaf = (externalId: string, type: "task" | "milestone" = "task", parentExternalId: string | null = null,
    status: "not_started" | "in_progress" | "completed" = "not_started") => {
    tasks.push({ externalId, name: externalId.startsWith("M-SAME") ? "동명 단계" : externalId === "M-LONG" ? "아주 긴 한글 단계 Long English milestone identity ".repeat(3) : externalId,
      type, parentExternalId, requestedStart: "2026-10-06", duration: type === "milestone" ? 0 : 2,
      progress: status === "completed" ? 100 : status === "in_progress" ? 50 : 0, status, scheduleMode: "auto", predecessors: [],
      description: '=원본 <&> "quoted" 😀', url: "https://example.test/issue-553", baseline: { start: "2026-10-06", duration: type === "milestone" ? 0 : 2 } });
  };
  summary("S"); summary("N", "S"); leaf("INHERITED", "task", "N"); leaf("OVERRIDE", "task", "N", "completed");
  summary("EMPTY", "S"); summary("M-ONLY", "S"); leaf("M-INTERNAL", "milestone", "M-ONLY");
  leaf("M-SAME-A", "milestone"); leaf("M-SAME-B", "milestone"); leaf("M-LONG", "milestone");
  leaf("M-READY", "milestone"); leaf("READY-T", "task", null, "completed");
  leaf("M-CLOSED", "milestone", null, "completed"); leaf("CLOSED-T", "task", null, "completed");
  leaf("M-MANUAL", "milestone"); leaf("FREE"); summary("DEST");
  for (const [index, relation] of (["FS", "SS", "FF", "SF"] as const).entries()) {
    for (const type of ["task", "milestone"] as const) {
      const prefix = type === "task" ? "T" : "M";
      leaf(`${prefix}-${relation}-P`, type); leaf(`${prefix}-${relation}-Q`, type);
      tasks[tasks.length - 1].predecessors = [{ externalId: `${prefix}-${relation}-P`, type: relation, lag: index % 2 ? -1 : 1 }];
    }
  }
  tasks.forEach((task, index) => { task.sourceTaskId = `00000000-0000-4000-8000-${String(index + 55300).padStart(12, "0")}`; });
  return { schemaVersion: "1.1", project: { name: "합성 MT5 canonical fixture", description: "일정·단계 교환 검증" }, tasks,
    memberships: [{ taskExternalId: "S", milestoneExternalId: "M-SAME-A" }, { taskExternalId: "OVERRIDE", milestoneExternalId: "M-SAME-B" },
      { taskExternalId: "READY-T", milestoneExternalId: "M-READY" }, { taskExternalId: "CLOSED-T", milestoneExternalId: "M-CLOSED" },
      { taskExternalId: "DEST", milestoneExternalId: "M-LONG" }] };
}

export const fixtureBytes = () => Buffer.from(JSON.stringify(canonicalInterchangeFixture()));
export const logicalHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Normalize only identities: schedules, status, order, baseline and full Gate remain observable. */
export function canonicalMeaning(snapshot: Pick<ProjectSnapshotResponse, "data">) {
  const byId = new Map(snapshot.data.tasks.map(task => [task.taskId, task.externalId]));
  const ref = (id: string | null | undefined) => id == null ? null : byId.get(id) ?? `DANGLING:${id}`;
  return { tasks: snapshot.data.tasks.map(task => ({ externalId: task.externalId, name: task.name, type: task.type,
    parentExternalId: task.parentExternalId, siblingOrder: task.siblingOrder, description: task.description ?? null, url: task.url ?? null,
    requestedStart: task.requestedStart, start: task.start, end: task.end, duration: task.duration, scheduleMode: task.scheduleMode,
    progress: task.progress, status: task.status, baselineStart: task.baselineStart ?? null, baselineDuration: task.baselineDuration ?? null, baselineEnd: task.baselineEnd ?? null,
    membership: { explicit: ref(task.membership?.explicitMilestoneTaskId), effective: ref(task.membership?.effectiveMilestoneTaskId), inheritedFrom: ref(task.membership?.inheritedFromTaskId) },
    gate: task.stageGate ? { ...task.stageGate, memberTaskIds: task.stageGate.memberTaskIds.map(ref).sort(), incompleteMemberTaskIds: task.stageGate.incompleteMemberTaskIds.map(ref).sort(),
      predecessorMilestoneTaskIds: task.stageGate.predecessorMilestoneTaskIds.map(ref).sort(), incompletePredecessorMilestoneTaskIds: task.stageGate.incompletePredecessorMilestoneTaskIds.map(ref).sort() } : null,
  })).sort((a, b) => a.externalId.localeCompare(b.externalId)),
    links: snapshot.data.links.map(({ predecessorExternalId, successorExternalId, type, lag, legacyMixed }) => ({ predecessorExternalId, successorExternalId, type, lag, legacyMixed: legacyMixed ?? false }))
      .sort((a, b) => `${a.predecessorExternalId}/${a.successorExternalId}`.localeCompare(`${b.predecessorExternalId}/${b.successorExternalId}`)) };
}

/** Read actual OOXML output; no renderer mock or visible-row projection. */
export function workbookEntries(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes), entries = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8), length = buffer.readUInt32LE(offset + 18), nameLength = buffer.readUInt16LE(offset + 26);
    const start = offset + 30 + nameLength + buffer.readUInt16LE(offset + 28), content = buffer.subarray(start, start + length);
    entries.set(buffer.toString("utf8", offset + 30, offset + 30 + nameLength), (method === 0 ? content : inflateRawSync(content)).toString("utf8"));
    offset = start + length;
  }
  return entries;
}
export function workbookSheet(entries: Map<string, string>, name: string) {
  const names = [...entries.get("xl/workbook.xml")!.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*sheetId="(\d+)"/g)];
  const found = names.find(match => match[1] === name);
  if (!found) throw new Error(`Missing worksheet ${name}`);
  return entries.get(`xl/worksheets/sheet${found[2]}.xml`)!;
}
