import type { ProjectDto, ProjectPermission } from "./projects";
import type { ProjectLogisticsDto } from "./logistics";
import type { TaskLogisticsLinkScope } from './logistics';
export interface EquipmentWorkAreaInput { processId: string; workAreaId: string }
export interface EquipmentWorkAreaDto extends EquipmentWorkAreaInput { equipmentId: string; occurrenceId: string }
export interface TaskProcessLink { processId: string; scope: TaskLogisticsLinkScope }
export interface TaskWorkAreaLink extends TaskProcessLink { workAreaId: string }
/** null means the pre-context legacy state; [] is an explicit selection of zero. */
export interface TaskProcessContextDto {
 taskId: string;
 processLinks: TaskProcessLink[] | null;
 workAreaLinks: TaskWorkAreaLink[] | null;
}
export interface ReplaceTaskProcessContextRequest {
 processCatalogRevision: number;
 processLinks: TaskProcessLink[];
 workAreaLinks: TaskWorkAreaLink[];
}

export interface TaskProcessContextResponse {
 data: {projectRevision:number;processCatalogRevision:number;context:TaskProcessContextDto;permission:ProjectPermission};
}
export interface TaskProcessContextMutationResponse {
 data: {project:ProjectDto;logistics:ProjectLogisticsDto;processCatalogRevision:number;context:TaskProcessContextDto;permission:"edit";operation:{kind:"taskProcessContext";taskId:string;changed:boolean}};
}
