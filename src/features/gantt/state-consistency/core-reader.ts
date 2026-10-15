import type { IApi } from "@svar-ui/react-gantt";
import type { CanonicalGanttSnapshot } from "../canonical-snapshot-sync";
import type { CoreReadFailure, CoreReadResult, NormalizedCoreLink, NormalizedCoreTask, ObservedCoreSnapshot } from "./contracts";

export interface SerializedCoreInput {
  readonly tasks: unknown;
  readonly tree: unknown;
  readonly links: unknown;
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown): string => {
  if ((typeof value !== "string" || value.length === 0) && (typeof value !== "number" || !Number.isFinite(value))) throw new Error("id");
  return String(value);
};
const parent = (value: unknown) => value === undefined || value === null || value === 0 ? "0" : id(value);
const string = (value: unknown, fallback: string) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new Error("string");
  return value;
};
const optionalString = (value: unknown) => value === undefined || value === null ? null : string(value, "");
const number = (value: unknown, fallback: number) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("number");
  return value;
};
const date = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("date");
  return value.getTime();
};
function task(value: unknown): NormalizedCoreTask {
  if (!object(value)) throw new Error("task");
  const type = string(value.type, "task");
  const externalId = value.externalId;
  if (externalId !== undefined && externalId !== null && typeof externalId !== "string" && (typeof externalId !== "number" || !Number.isFinite(externalId))) throw new Error("externalId");
  return Object.freeze({ id: id(value.id), parent: parent(value.parent), text: string(value.text, ""), type,
    start: date(value.start), end: type === "milestone" ? null : date(value.end), progress: number(value.progress, 0),
    externalId: externalId ?? null, projectDisplayKey: optionalString(value.projectDisplayKey),
    baselineStart: optionalString(value.baselineStart), baselineEnd: optionalString(value.baselineEnd),
    baselineDuration: value.baselineDuration === undefined || value.baselineDuration === null ? null : number(value.baselineDuration, 0) });
}
function link(value: unknown): NormalizedCoreLink {
  if (!object(value)) throw new Error("link");
  return Object.freeze({ id: id(value.id), source: id(value.source), target: id(value.target), type: string(value.type, "e2s") });
}
function array<T>(value: unknown, normalize: (item: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) throw new Error("array");
  return Object.freeze(value.map(normalize));
}
function unique(values: readonly { readonly id: string }[]) {
  return new Set(values.map(value => value.id)).size === values.length;
}
/** 2.7.3 serialize(tasks/tree) yields full flat preorder with nested data
 * references as well. Never flatten data again or omit collapsed descendants. */
function validHierarchy(raw: readonly unknown[], tasks: readonly { readonly id: string; readonly parent: string }[]) {
  if (!unique(tasks)) return false;
  const byId = new Map(tasks.map(value => [value.id, value]));
  const roots: string[] = [], children = new Map<string, string[]>();
  for (const value of tasks) {
    if (value.id === "0" || (value.parent !== "0" && !byId.has(value.parent))) return false;
    const siblings = value.parent === "0" ? roots : children.get(value.parent) ?? [];
    siblings.push(value.id);
    if (value.parent !== "0") children.set(value.parent, siblings);
  }
  const ordered: string[] = [], visited = new Set<string>(), pending = [...roots].reverse();
  while (pending.length) {
    const next = pending.pop()!;
    if (visited.has(next)) return false;
    visited.add(next); ordered.push(next);
    const branch = children.get(next) ?? [];
    for (let index = branch.length - 1; index >= 0; index--) pending.push(branch[index]);
  }
  if (ordered.length !== tasks.length || ordered.some((value, index) => value !== tasks[index].id)) return false;
  return raw.every((value, index) => {
    if (!object(value)) return false;
    const expected = children.get(tasks[index].id) ?? [];
    if (value.data === undefined) return true; // Canonical adapter input has no Core data collection.
    if (value.data === null) return expected.length === 0;
    if (!Array.isArray(value.data)) return false;
    return value.data.length === expected.length && value.data.every((child: unknown, childIndex: number) =>
      object(child) && id(child.id) === expected[childIndex] && parent(child.parent) === tasks[index].id);
  });
}
const failed = (reason: CoreReadFailure): CoreReadResult => ({ ok: false, outcome: "FAILED", reason });
export function normalizeSerializedCore(input: SerializedCoreInput): CoreReadResult {
  let stage: CoreReadFailure = "INVALID_TASKS";
  try {
    const tasks = array(input.tasks, task);
    if (!validHierarchy(input.tasks as readonly unknown[], tasks)) return failed("INVALID_TASKS");
    stage = "INVALID_TREE";
    const tree = array(input.tree, value => {
      if (!object(value)) throw new Error("tree");
      return Object.freeze({ id: id(value.id), parent: parent(value.parent) });
    });
    if (!validHierarchy(input.tree as readonly unknown[], tree)) return failed("INVALID_TREE");
    if (tasks.length !== tree.length || tasks.some((value, index) => value.id !== tree[index].id || value.parent !== tree[index].parent)) return failed("INCONSISTENT_TREE");
    stage = "INVALID_LINKS";
    const links = array(input.links, link);
    const ids = new Set(tasks.map(value => value.id));
    if (!unique(links) || links.some(value => !ids.has(value.source) || !ids.has(value.target))) return failed("INVALID_LINKS");
    return { ok: true, value: Object.freeze({ tasks, tree, links }) };
  } catch { return failed(stage); }
}
/** Only public read APIs; errors and null collections never become empty success. */
export function readCoreSnapshot(api: Pick<IApi, "serialize">): CoreReadResult {
  try {
    return normalizeSerializedCore({ tasks: api.serialize({ data: "tasks" }), tree: api.serialize({ data: "tree" }), links: api.serialize({ data: "links" }) });
  } catch { return failed("READ_FAILED"); }
}
/** Canonical snapshots use the same owned-field normalization, without adopting
 * renderer caches, duration, collapse or selection as server authority. */
export function normalizeCanonicalCore(snapshot: CanonicalGanttSnapshot): CoreReadResult {
  return normalizeSerializedCore({ tasks: snapshot.tasks, tree: snapshot.tasks, links: snapshot.links });
}
export function sameCoreSnapshot(actual: ObservedCoreSnapshot, desired: ObservedCoreSnapshot): boolean {
  return JSON.stringify(actual) === JSON.stringify(desired);
}
