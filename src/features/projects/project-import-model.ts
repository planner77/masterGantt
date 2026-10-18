import type { ProjectImportPreviewDto, ImportPreviewScheduleDto } from "@/contracts/project-import";
import type { ProjectSnapshotResponse } from "@/contracts/projects";
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function schedule(value: unknown): value is ImportPreviewScheduleDto {
  return record(value) && ["requestedStart","start","end","baselineStart","baselineEnd"].every((key) => value[key] === null || typeof value[key] === "string") && ["duration","progress","baselineDuration"].every((key) => value[key] === null || typeof value[key] === "number" && Number.isFinite(value[key])) && (value.status === null || ["not_started","in_progress","completed"].includes(String(value.status)));
}
export function importPreviewFrom(value: unknown): ProjectImportPreviewDto | null {
  if (!record(value) || !record(value.data)) return null;
  const d=value.data;
  if (!["1.0","1.1"].includes(String(d.schemaVersion)) || typeof d.projectPublicId !== "string" || !Number.isSafeInteger(d.baseRevision) || Number(d.baseRevision)<1 || typeof d.previewDigest !== "string" || !/^[a-f0-9]{64}$/.test(d.previewDigest) || typeof d.canCommit !== "boolean" || !record(d.summary) || !["taskCreates","linkCreates","explicitMembershipCreates"].every((key) => Number.isSafeInteger((d.summary as Record<string,unknown>)[key]) && Number((d.summary as Record<string,unknown>)[key])>=0) || !record(d.sourceProject) || typeof d.sourceProject.name !== "string" || typeof d.sourceProject.description !== "string" || !record(d.targetCalendar) || typeof d.targetCalendar.timezone !== "string" || !Array.isArray(d.targetCalendar.holidays) || !Array.isArray(d.normalizedTasks) || !Array.isArray(d.changedTasks) || !Array.isArray(d.warnings)) return null;
  if (!d.normalizedTasks.every((t) => schedule(t) && record(t) && typeof t.externalId === "string" && typeof t.name === "string" && ["task","summary","milestone"].includes(String(t.type)) && record(t.membership) && ["explicitMilestoneExternalId","effectiveMilestoneExternalId","inheritedFromExternalId"].every((key) => (t.membership as Record<string,unknown>)[key] === null || typeof (t.membership as Record<string,unknown>)[key] === "string")) || !d.changedTasks.every((c) => record(c) && typeof c.externalId === "string" && schedule(c.before) && schedule(c.after) && Array.isArray(c.reasonCodes) && c.reasonCodes.every((code) => typeof code === "string")) || !d.warnings.every((w) => record(w) && typeof w.code === "string" && typeof w.path === "string" && typeof w.message === "string")) return null;
  return d as unknown as ProjectImportPreviewDto;
}
export function importPreviewMatches(preview: ProjectImportPreviewDto, publicId: string, revision: number): boolean { return preview.projectPublicId === publicId && preview.baseRevision === revision; }
export function canCommitImport(preview: ProjectImportPreviewDto | null, publicId: string, revision: number, sameFile: boolean, editable: boolean, pending: boolean): boolean { return !!preview && importPreviewMatches(preview,publicId,revision) && sameFile && editable && !pending && preview.canCommit && preview.summary.taskCreates>0; }
export function importSnapshotFrom(value: unknown, publicId: string, baseRevision: number): ProjectSnapshotResponse | null {
  if (!record(value) || !record(value.data) || !record(value.data.project)) return null;
  const d=value.data;
  const project=d.project;
  if (!record(project) || project.publicId !== publicId || project.revision !== baseRevision+1 || !Array.isArray(d.tasks) || !d.tasks.every((t) => record(t) && typeof t.taskId === "string" && typeof t.externalId === "string") || !Array.isArray(d.links)) return null;
  return value as unknown as ProjectSnapshotResponse;
}
