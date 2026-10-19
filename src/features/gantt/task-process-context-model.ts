import type { TaskProcessContextDto, TaskProcessLink, TaskWorkAreaLink } from "../../contracts/process-context";
import type { ProjectTaskDto } from "../../contracts/projects";

export function processDraftKey(processLinks: TaskProcessLink[] | null, workAreaLinks: TaskWorkAreaLink[] | null): string {
  return JSON.stringify([processLinks === null ? null : [...processLinks].sort((a,b) => a.processId.localeCompare(b.processId)), workAreaLinks === null ? null : [...workAreaLinks].sort((a,b) => `${a.processId}:${a.workAreaId}`.localeCompare(`${b.processId}:${b.workAreaId}`))]);
}
export function processDraftError(processLinks: TaskProcessLink[], workAreaLinks: TaskWorkAreaLink[]): string | null {
  for (const area of workAreaLinks) {
    const process = processLinks.find(row => row.processId === area.processId);
    if (!process) return "작업 구역을 먼저 해제한 뒤 소유 공정을 해제해 주세요.";
    if (area.scope === "subtree" && process.scope !== "subtree") return "하위 적용 작업 구역의 소유 공정도 하위 작업 포함으로 선택해 주세요.";
  }
  return null;
}
/** Display explicit ancestor sources only; this does not infer or assign a Task process. */
export function ancestorProcessSources(taskId: string, tasks: readonly ProjectTaskDto[], contexts: readonly TaskProcessContextDto[]) {
  const result: Array<{ source: ProjectTaskDto; processLinks: TaskProcessLink[]; workAreaLinks: TaskWorkAreaLink[] }> = [];
  const seen = new Set<string>();
  let parent = tasks.find(task => task.taskId === taskId)?.parentExternalId;
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const source = tasks.find(task => task.externalId === parent);
    if (!source) break;
    const context = contexts.find(item => item.taskId === source.taskId);
    if (source.type === "summary" && context) result.push({ source, processLinks: (context.processLinks ?? []).filter(row => row.scope === "subtree"), workAreaLinks: (context.workAreaLinks ?? []).filter(row => row.scope === "subtree") });
    parent = source.parentExternalId;
  }
  return result.filter(row => row.processLinks.length || row.workAreaLinks.length);
}

export function validTaskProcessContext(value: unknown): value is TaskProcessContextDto {
  if (!value || typeof value !== "object") return false;
  const row = value as TaskProcessContextDto;
  if (typeof row.taskId !== "string") return false;
  if (row.processLinks === null || row.workAreaLinks === null) return row.processLinks === null && row.workAreaLinks === null;
  if (!Array.isArray(row.processLinks) || !Array.isArray(row.workAreaLinks) || row.processLinks.length > 200 || row.workAreaLinks.length > 200) return false;
  const scope = (value: unknown) => value === "self" || value === "subtree";
  if (!row.processLinks.every(link => link && typeof link.processId === "string" && scope(link.scope)) || !row.workAreaLinks.every(link => link && typeof link.processId === "string" && typeof link.workAreaId === "string" && scope(link.scope))) return false;
  return new Set(row.processLinks.map(link => link.processId)).size === row.processLinks.length && new Set(row.workAreaLinks.map(link => `${link.processId}:${link.workAreaId}`)).size === row.workAreaLinks.length && !processDraftError(row.processLinks, row.workAreaLinks);
}

export function descendantTaskCount(taskId: string, tasks: readonly ProjectTaskDto[]): number {
  const root = tasks.find(task => task.taskId === taskId);
  if (!root) return 0;
  const descendants = new Set<string>([root.externalId]);
  let previous = 0;
  while (previous !== descendants.size) {
    previous = descendants.size;
    for (const task of tasks) if (task.parentExternalId && descendants.has(task.parentExternalId)) descendants.add(task.externalId);
  }
  return descendants.size - 1;
}
