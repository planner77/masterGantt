import { z } from "zod";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import type { ResourceDashboardFilterInput } from "../../contracts/resource-dashboard";
import type { WbsViewPathEntry, WbsViewSpec } from "../../contracts/wbs-dashboard-views";
import { validateWbsViewSpec } from "./wbs-view-model";
const list = z.array(z.string().uuid()).max(8000);
const date = z.string().refine(value => { try { parseDateOnly(value, "date"); return true; } catch { return false; } });
export const wbsViewFiltersSchema = z.object({
  equipmentTypeCodes: z.array(z.string().min(1).max(64)).max(200).optional(),
  from: date.optional(), to: date.optional(), asOfDate: date.optional(), search: z.string().max(200).optional(), taskSearch: z.string().max(200).optional(),
  mode: z.enum(["resource", "group"]).optional(), granularity: z.enum(["week", "month"]).optional(), resourceActivity: z.enum(["all", "active", "inactive"]).optional(), groupActivity: z.enum(["all", "active", "inactive"]).optional(),
  resourceIds: list.optional(), groupIds: z.array(z.union([z.string().uuid(),z.literal("ungrouped")])).max(8000).optional(), milestoneIds: z.array(z.union([z.string().uuid(),z.literal("unassigned")])).max(8000).optional(), taskIds: list.optional(), wbsRootIds: list.optional(),
  roles: z.array(z.enum(["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"])).optional(), developerGrades: z.array(z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "UNSPECIFIED"])).optional(), statuses: z.array(z.enum(["not_started", "in_progress", "completed"])).optional(), mdPerMm: z.number().finite().positive().nullable().optional(),
}).strict();
export const wbsViewPathSchema = z.array(z.object({ dimension: z.enum(["process", "workArea", "equipment", "system", "resource", "milestone", "group", "role"]), id: z.string().min(1).max(100).nullable() }).strict()).max(8);
export interface WbsViewStoredState {
  spec: WbsViewSpec; filters: ResourceDashboardFilterInput; expanded: string[]; rowSearch?: string;
  selected: { viewRowKey: string; path: WbsViewPathEntry[] } | null;
  scroll: { top: number; left: number }; focus: string | null; sort?: "name-asc" | "name-desc";
}
export type WbsViewStorage = Pick<Storage, "getItem" | "setItem">;
const stateSchema = z.object({ spec: z.unknown(), rowSearch: z.string().max(200).optional(), filters: wbsViewFiltersSchema, expanded: z.array(z.string().max(256)).max(5000), selected: z.object({ viewRowKey: z.string().max(256), path: wbsViewPathSchema }).strict().nullable(), scroll: z.object({ top: z.number().finite().nonnegative(), left: z.number().finite().nonnegative() }).strict(), focus: z.string().max(256).nullable(), sort: z.enum(["name-asc", "name-desc"]).optional() }).strict();
const key = (project: string, root: string) => `mastergantt:wbs-view:1:${encodeURIComponent(project)}:${root}`;
const warning = "저장된 조회 구성을 사용할 수 없습니다. 기본 구성으로 초기화하거나 다시 적용해 주세요.";
function checked(value: unknown, root: WbsViewSpec["root"]): WbsViewStoredState | null {
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) return null;
  if(parsed.data.filters.from && parsed.data.filters.to && parsed.data.filters.from > parsed.data.filters.to)return null;
  const spec = validateWbsViewSpec(parsed.data.spec);
  if (!spec.ok || spec.spec.root !== root) return null;
  const path = parsed.data.selected?.path;
  const stages = [[root], ...(spec.spec.levels ?? []).map(level => typeof level === "string" ? [level] : level.dimensions)];
  if (path?.some((entry, index) => !stages[index]?.includes(entry.dimension))) return null;
  return { ...parsed.data, spec: spec.spec };
}
export function loadWbsViewState(storage: WbsViewStorage | null, projectPublicId: string, root: WbsViewSpec["root"]): { state: WbsViewStoredState | null; warning: string | null } {
  try {
    if (!storage) return { state: null, warning: "브라우저 저장소를 사용할 수 없어 이번 화면에서만 구성을 유지합니다." };
    const raw = storage.getItem(key(projectPublicId, root));
    if (raw === null) return { state: null, warning: null };
    const envelope: unknown = JSON.parse(raw);
    if (!envelope || typeof envelope !== "object" || !("schema" in envelope) || envelope.schema !== "wbs-view-state/1" || !("projectPublicId" in envelope) || envelope.projectPublicId !== projectPublicId || !("state" in envelope)) return { state: null, warning };
    const state = checked(envelope.state, root);
    return { state, warning: state ? null : warning };
  } catch { return { state: null, warning }; }
}
export function saveWbsViewState(storage: WbsViewStorage | null, projectPublicId: string, root: WbsViewSpec["root"], value: WbsViewStoredState): { state: WbsViewStoredState | null; warning: string | null } {
  const state = checked(value, root);
  if (!state) return { state: null, warning };
  try {
    if (!storage) throw new Error("storage unavailable");
    storage.setItem(key(projectPublicId, root), JSON.stringify({ schema: "wbs-view-state/1", projectPublicId, state }));
    return { state, warning: null };
  } catch { return { state, warning: "브라우저 저장소를 사용할 수 없어 이번 화면에서만 구성을 유지합니다." }; }
}
