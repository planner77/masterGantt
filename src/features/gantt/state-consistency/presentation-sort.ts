import type { IColumnConfig, ITask } from "@svar-ui/react-gantt";
import { getValue } from "@svar-ui/grid-store";

export interface PresentationSortClause {
  readonly key: string;
  readonly order: "asc" | "desc";
}

const validKey = (key: unknown): key is string => typeof key === "string" && key.length > 0 && !key.split(".").some(part => ["__proto__", "prototype", "constructor"].includes(part));

/** Stable sorting keeps the previous display order for equal values. Retain
 * those older priorities as tie breakers, without retaining an event log. */
export function mergePresentationSort(
  active: readonly PresentationSortClause[],
  previousEffective: readonly PresentationSortClause[],
  allowedKeys?: readonly string[],
): readonly PresentationSortClause[] {
  const allowed = allowedKeys ? new Set(allowedKeys) : null;
  const result: PresentationSortClause[] = [];
  const seen = new Set<string>();
  for (const clause of active.length ? [...active, ...previousEffective] : []) {
    if (!validKey(clause.key) || (clause.order !== "asc" && clause.order !== "desc") ||
        (allowed && !allowed.has(clause.key)) || seen.has(clause.key)) continue;
    seen.add(clause.key);
    result.push(Object.freeze({ key: clause.key, order: clause.order }));
  }
  return Object.freeze(result);
}

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === "string") return left.localeCompare(String(right), undefined, { numeric: true });
  if (left instanceof Date || right instanceof Date) {
    if (!left) return 1;
    if (!right) return -1;
    if (!(left instanceof Date) || !(right instanceof Date)) throw new Error("mixed date values");
    return left.getTime() - right.getTime();
  }
  if (![left, right].every(value => value === null || value === undefined || typeof value === "number" || typeof value === "string"))
    throw new Error("unsupported sort value");
  return Number(left ?? 0) - Number(right ?? 0);
}

/** Derive an exact full preorder from canonical payload and public column
 * contracts. Reading the rendered/native row order cannot mint this proof. */
export function expectedPresentationOrder(
  canonicalTasks: readonly ITask[],
  columns: readonly IColumnConfig[],
  effectiveClauses: readonly PresentationSortClause[],
): readonly string[] | null {
  try {
    const ids = canonicalTasks.map(task => {
      if ((typeof task.id !== "string" || !task.id.length) && (typeof task.id !== "number" || !Number.isFinite(task.id)))
        throw new Error("invalid id");
      return String(task.id);
    });
    if (ids.some(id => !id || id === "0") || new Set(ids).size !== ids.length) return null;
    const byId = new Map(canonicalTasks.map((task, index) => [ids[index], Object.freeze({ ...task })]));
    const children = new Map<string, string[]>();
    canonicalTasks.forEach((task, index) => {
      const parent = task.parent === undefined || task.parent === null || task.parent === 0 ? "0" : String(task.parent);
      if (task.parent !== undefined && task.parent !== null && typeof task.parent !== "string" &&
          (typeof task.parent !== "number" || !Number.isFinite(task.parent))) throw new Error("invalid parent");
      if (parent !== "0" && !byId.has(parent)) throw new Error("missing parent");
      const branch = children.get(parent) ?? [];
      branch.push(ids[index]); children.set(parent, branch);
    });
    const preorder = (branches: ReadonlyMap<string, readonly string[]>) => {
      const result: string[] = [], visited = new Set<string>(), pending = [...(branches.get("0") ?? [])].reverse();
      while (pending.length) {
        const id = pending.pop()!;
        if (visited.has(id)) throw new Error("cycle");
        visited.add(id); result.push(id);
        const branch = branches.get(id) ?? [];
        for (let index = branch.length - 1; index >= 0; index--) pending.push(branch[index]);
      }
      return result;
    };
    const canonicalOrder = preorder(children);
    if (canonicalOrder.length !== ids.length || canonicalOrder.some((id, index) => id !== ids[index])) return null;
    if (!effectiveClauses.length) return Object.freeze(canonicalOrder);
    const uniqueKeys = new Set<string>();
    const comparators = effectiveClauses.map(clause => {
      if (!validKey(clause.key) || uniqueKeys.has(clause.key) || (clause.order !== "asc" && clause.order !== "desc"))
        throw new Error("invalid sort descriptor");
      uniqueKeys.add(clause.key);
      const column = columns.find(column => String(column.id) === clause.key);
      return (left: Readonly<ITask>, right: Readonly<ITask>) => {
        const compared = typeof column?.sort === "function"
          ? column.sort(left, right)
          : compareValues(column ? getValue(left, column) : left[clause.key], column ? getValue(right, column) : right[clause.key]);
        if (!Number.isFinite(compared)) throw new Error("invalid comparison");
        return clause.order === "asc" ? compared : -compared;
      };
    });
    const sorted = new Map<string, readonly string[]>();
    for (const [parent, branch] of children) {
      sorted.set(parent, branch.map((id, index) => ({ id, index })).sort((left, right) => {
        for (const compare of comparators) {
          const result = compare(byId.get(left.id)!, byId.get(right.id)!);
          if (result) return result;
        }
        return left.index - right.index;
      }).map(item => item.id));
    }
    return Object.freeze(preorder(sorted));
  } catch { return null; }
}
