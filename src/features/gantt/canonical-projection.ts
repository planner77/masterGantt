import type { ILink, ITask } from "@svar-ui/react-gantt";
import type { ProjectTaskDto } from "../../contracts/projects";

export interface ProjectionSnapshot {
  readonly revision: number;
  readonly tasks: readonly ITask[];
  readonly links: readonly ILink[];
  readonly displayTasks: readonly ProjectTaskDto[];
}
export interface ProjectionOptions {
  readonly scope: string | null;
  readonly filter: readonly string[] | null;
  readonly displayMode: "compatibility" | "separate-milestones";
  readonly expandedTree?: ReadonlySet<string>;
  readonly columnPrefs: unknown;
  readonly scale: string;
}
export interface CanonicalProjection {
  readonly revision: number;
  readonly tasks: readonly ITask[];
  readonly links: readonly ILink[];
  readonly membershipIds: readonly string[];
  readonly logicalVisibleIds: readonly string[];
  readonly keys: Readonly<Record<"data" | "structure" | "membership" | "layout", string>>;
}

/** Canonical input remains complete. Membership, collapsed visibility and DOM
 * virtualization are independent projections, never alternate write sources. */
export function buildProjection(snapshot: ProjectionSnapshot, options: ProjectionOptions): CanonicalProjection {
  const byId = new Map(snapshot.tasks.map(task => [String(task.id), task]));
  const included = new Set(options.filter === null ? byId.keys() : options.filter.filter(id => byId.has(id)));
  if (options.scope !== null) {
    for (const id of [...included]) {
      let candidate: string | undefined = id;
      const visited = new Set<string>();
      while (candidate && candidate !== options.scope && !visited.has(candidate)) {
        visited.add(candidate);
        const parent: ITask["parent"] = byId.get(candidate)?.parent;
        candidate = parent ? String(parent) : undefined;
      }
      if (candidate !== options.scope) included.delete(id);
    }
  }
  if (options.displayMode === "separate-milestones") {
    for (const task of snapshot.tasks) if (task.type === "milestone") included.delete(String(task.id));
  }
  // Matching descendants require their Summary context, even when collapsed.
  for (const id of [...included]) {
    let parent = byId.get(id)?.parent;
    const visited = new Set<string>([id]);
    while (id !== options.scope && parent && byId.has(String(parent)) && !visited.has(String(parent))) {
      const parentId = String(parent);
      visited.add(parentId);
      included.add(parentId);
      if (parentId === options.scope) break;
      parent = byId.get(parentId)?.parent;
    }
  }
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const task of snapshot.tasks) {
    const id = String(task.id), parent = task.parent ? String(task.parent) : "0";
    if (!task.parent || !byId.has(parent)) roots.push(id);
    else {
      const siblings = children.get(parent) ?? [];
      siblings.push(id); children.set(parent, siblings);
    }
  }
  const orderedIds: string[] = [], visitedOrder = new Set<string>();
  const append = (initial: string[]) => {
    const pending = [...initial].reverse();
    while (pending.length) {
      const id = pending.pop()!;
      if (visitedOrder.has(id)) continue;
      visitedOrder.add(id); orderedIds.push(id);
      const siblings = children.get(id) ?? [];
      for (let index = siblings.length - 1; index >= 0; index--) pending.push(siblings[index]);
    }
  };
  append(roots);
  append([...byId.keys()].filter(id => !visitedOrder.has(id)));
  const membershipIds = orderedIds.filter(id => included.has(id));
  const logicalVisibleIds = membershipIds.filter(id => {
    let parent = byId.get(id)?.parent;
    const visited = new Set<string>([id]);
    while (parent && byId.has(String(parent)) && !visited.has(String(parent))) {
      const parentId = String(parent), task = byId.get(parentId)!;
      if (included.has(parentId) && (options.expandedTree ? !options.expandedTree.has(parentId) : task.open === false)) return false;
      visited.add(parentId);
      parent = task.parent;
    }
    return true;
  });
  return {
    revision: snapshot.revision, tasks: snapshot.tasks, links: snapshot.links, membershipIds, logicalVisibleIds,
    keys: {
      data: JSON.stringify([snapshot.tasks.map(task => [task.id, task.text, task.start, task.end, task.progress, task.type, task.externalId, task.projectDisplayKey]), snapshot.displayTasks, snapshot.links]),
      structure: JSON.stringify([options.scope, snapshot.tasks.map(task => [task.id, task.parent, task.type]), snapshot.links.map(link => [link.id, link.source, link.target, link.type])]),
      membership: JSON.stringify([options.scope, options.displayMode, membershipIds]),
      layout: JSON.stringify([options.columnPrefs, options.scale]),
    },
  };
}

export function diffProjection(previous: CanonicalProjection | null, next: CanonicalProjection) {
  const reasons = (["data", "structure", "membership", "layout"] as const).filter(key => previous?.keys[key] !== next.keys[key]);
  return { reasons, data: reasons.includes("data"), structure: reasons.includes("structure"),
    membership: reasons.includes("membership"), layout: reasons.includes("layout") };
}
