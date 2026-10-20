import { WBS_VIEW_DIMENSIONS, WBS_VIEW_LIMITS, type WbsViewDimension, type WbsViewNode, type WbsViewSpec } from "../../contracts/wbs-dashboard-views";

export const WBS_VIEW_ROOTS = ["process", "equipment", "system", "resource", "milestone"] as const;
export type WbsViewRoot = typeof WBS_VIEW_ROOTS[number];
export const WBS_VIEW_LABELS: Record<WbsViewDimension, string> = { process: "공정", workArea: "WorkArea", equipment: "설비", system: "물류 시스템", resource: "리소스", milestone: "Milestone", group: "그룹", role: "역할" };
export const defaultWbsViewSpec = (root: WbsViewDimension): WbsViewSpec => ({ version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root, levels: [] });
export type WbsViewValidation = { ok: true; spec: WbsViewSpec } | { ok: false; reason: string; message: string; recovery: "reset" | "remove-level" | "choose-dimension" };
const fail = (reason: string, message: string, recovery: "reset" | "remove-level" | "choose-dimension" = "reset"): WbsViewValidation => ({ ok: false, reason, message, recovery });
export function validateWbsViewSpec(value: unknown): WbsViewValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("INVALID_SPEC", "조회 구성을 초기화해 주세요.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !["version", "contextSourceVersion", "root", "levels", "systemView", "systemIds"].includes(key)) || raw.version !== "wbs-view:v1" || raw.contextSourceVersion !== "explicit-task-context:v1") return fail("OBSOLETE_SPEC", "이전 버전의 조회 구성입니다. 초기화해 주세요.");
  if (!WBS_VIEW_DIMENSIONS.includes(raw.root as WbsViewDimension)) return fail("INVALID_ROOT", "관점을 다시 선택해 주세요.", "choose-dimension");
  if ((raw.systemView !== undefined || raw.systemIds !== undefined) && raw.root !== "system") return fail("INVALID_SYSTEM_ROOT", "시스템 설정은 물류 시스템 관점에서만 사용할 수 있습니다.");
  if (raw.systemView !== undefined && raw.systemView !== "direct" && raw.systemView !== "coordination") return fail("INVALID_SYSTEM_VIEW", "직접 또는 조율 조회를 선택해 주세요.");
  if (raw.systemIds !== undefined && (!Array.isArray(raw.systemIds) || raw.systemIds.length > WBS_VIEW_LIMITS.fanout || raw.systemIds.some(id => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)))) return fail("INVALID_SYSTEM_IDS", "시스템 필터를 다시 선택해 주세요.");
  if (raw.levels !== undefined && !Array.isArray(raw.levels)) return fail("INVALID_LEVELS", "조회 단계를 다시 구성해 주세요.");
  const values: unknown[] = raw.levels as unknown[] | undefined ?? [];
  if (values.length >= WBS_VIEW_LIMITS.depth) return fail("DEPTH_LIMIT", "최상위 관점을 포함하여 최대 8단계입니다.", "remove-level");
  const levels: NonNullable<WbsViewSpec["levels"]> = [];
  const seen = new Set<WbsViewDimension>([raw.root as WbsViewDimension]);
  for (const level of values) {
    let dims: WbsViewDimension[];
    if (typeof level === "string" && WBS_VIEW_DIMENSIONS.includes(level as WbsViewDimension)) { dims = [level as WbsViewDimension]; levels.push(level as WbsViewDimension); }
    else if (level && typeof level === "object" && !Array.isArray(level)) {
      const sibling = level as Record<string, unknown>;
      if (Object.keys(sibling).some(key => !["kind", "dimensions"].includes(key)) || sibling.kind !== "siblings" || !Array.isArray(sibling.dimensions) || sibling.dimensions.length !== 2 || new Set(sibling.dimensions).size !== 2 || sibling.dimensions.some(dim => dim !== "equipment" && dim !== "system")) return fail("INVALID_SIBLINGS", "같은 단계에는 설비와 시스템만 함께 배치할 수 있습니다.", "choose-dimension");
      dims = sibling.dimensions as WbsViewDimension[];
      levels.push({ kind: "siblings", dimensions: [...sibling.dimensions] as ["equipment", "system"] | ["system", "equipment"] });
    } else return fail("INVALID_DIMENSION", "지원하는 조회 축을 선택해 주세요.", "choose-dimension");
    if (dims.some(dim => seen.has(dim))) return fail("DUPLICATE_DIMENSION", "최상위 관점을 포함하여 각 축은 한 번만 사용할 수 있습니다.", "remove-level");
    dims.forEach(dim => seen.add(dim));
  }
  return { ok: true, spec: { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: raw.root as WbsViewDimension, levels, ...(raw.systemView !== undefined ? { systemView: raw.systemView as "direct" | "coordination" } : {}), ...(raw.systemIds !== undefined ? { systemIds: [...new Set(raw.systemIds as string[])].sort() } : {}) } };
}
export const wbsViewNodeLabel = (node: WbsViewNode) => node.name ?? (node.selector.dimension === "resource" ? "미배정" : `${WBS_VIEW_LABELS[node.selector.dimension]} 없음`);
/** Keep the exact server node/totals; overlapping child totals must never be added. */
export function flattenWbsViewNodes(nodes: readonly WbsViewNode[], expanded: ReadonlySet<string>, sort: "name-asc" | "name-desc" = "name-asc"): Array<{ node: WbsViewNode; depth: number }> {
  const rows: Array<{ node: WbsViewNode; depth: number }> = [];
  const visit = (children: readonly WbsViewNode[], depth: number) => {
    for (const node of [...children].sort((a, b) => (sort === "name-desc" ? -1 : 1) * wbsViewNodeLabel(a).localeCompare(wbsViewNodeLabel(b), "ko") || a.viewRowKey.localeCompare(b.viewRowKey))) {
      rows.push({ node, depth });
      if (expanded.has(node.viewRowKey)) visit(node.children, depth + 1);
    }
  };
  visit(nodes, 0);
  return rows;
}
