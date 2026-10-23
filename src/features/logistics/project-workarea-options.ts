import type { ProjectWorkAreaDto, ProcessContextResponse } from "@/contracts/process-catalog";
import type { ProcessDto } from "@/contracts/logistics";

/** Preserve the canonical area ID while retaining each explicit process owner. */
export function projectWorkareaOptions(context: ProcessContextResponse["data"], processes: readonly ProcessDto[]) {
  const areas: ProjectWorkAreaDto[] = context.projectWorkAreas ?? context.mappings.flatMap(mapping => context.workAreas.filter(a=>a.occurrenceId===mapping.occurrenceId).map(a=>({...a,processId:mapping.processId,source:"legacy" as const,editable:false,active:a.active&&(mapping.workAreaSelectionActive??mapping.active)&&!!context.occurrences.find(o=>o.id===a.occurrenceId&&o.active)})));
  return areas.map(area => {
    const process = processes.find(row => row.id === area.processId);
    return { ...area, workAreaId: area.id, owner: process?.name ?? "공정 참조 확인 필요", active: area.active && !!process?.active && !area.diagnostics?.includes("classification_mismatch") };
  });
}

export function validProjectWorkareas(value: unknown): value is ProjectWorkAreaDto[] {
  if(!Array.isArray(value))return false;
  const pairs=new Set<string>();
  return value.every(area=>{
    if(!area || typeof area.id!=="string" || !area.id || typeof area.processId!=="string" || !area.processId || typeof area.name!=="string" || typeof area.code!=="string" || typeof area.active!=="boolean" || typeof area.editable!=="boolean" || !Number.isSafeInteger(area.sortOrder) || !Number.isSafeInteger(area.usageCount))return false;
    if(area.source!=="project" && area.source!=="legacy")return false;
    if(area.source==="project" ? area.occurrenceId!==null : typeof area.occurrenceId!=="string" || area.editable)return false;
    const pair=JSON.stringify([area.processId,area.id]);if(pairs.has(pair))return false;pairs.add(pair);return true;
  });
}
