import type { ProjectImportPreviewDto } from "../../src/contracts/project-import";
import { stageSnapshotFromProject } from "../../src/domain/milestones/project-stage-model";
import { projectStageGates } from "../../src/domain/milestones/stage-gates";
import type { StatefulProjectFixture } from "./stateful-project";

/** Synthetic canonical snapshot uses the same domain projection as the API. */
export function exchangeSnapshot(fixture: StatefulProjectFixture) {
  const projection=projectStageGates(stageSnapshotFromProject(fixture.tasks,fixture.links));
  return {data:{project:{...fixture.project},tasks:fixture.tasks.map(task=>({...task,membership:projection.membership.get(task.taskId)!,...(task.type==="milestone"?{stageGate:projection.gates.get(task.taskId)!}:{})})),links:fixture.links.map(link=>({...link})),permission:"readonly" as const,logistics:{processes:[],equipment:[],systems:[],systemLinks:[]}}};
}
export function withExternalMembership(fixture: StatefulProjectFixture) {
  const summary=fixture.tasks[0], milestone=fixture.tasks[3];
  summary.membership={explicitMilestoneTaskId:milestone.taskId,effectiveMilestoneTaskId:milestone.taskId,inheritedFromTaskId:null};
}
export function exchangePreview(fixture: StatefulProjectFixture, suffix=""): ProjectImportPreviewDto {
  const schedule={requestedStart:"2026-10-06",start:"2026-10-06",end:"2026-10-06",duration:1,progress:0,status:"not_started" as const,baselineStart:null,baselineDuration:null,baselineEnd:null};
  const normalizedTasks:ProjectImportPreviewDto["normalizedTasks"]=Array.from({length:24},(_,i)=>({...schedule,externalId:`LONG-TASK-${i}${suffix}`,sourceTaskId:`00000000-0000-4000-8000-${String(i+200).padStart(12,"0")}`,name:`아주 긴 단계 소속 확인 작업 이름 Long English identity ${i}${suffix}`,type:"task" as const,parentExternalId:null,description:null,url:null,scheduleMode:"auto" as const,membership:{explicitMilestoneExternalId:"LONG-EXTERNAL-MILESTONE-IDENTITY",effectiveMilestoneExternalId:"LONG-EXTERNAL-MILESTONE-IDENTITY",inheritedFromExternalId:null}}));
  normalizedTasks.unshift({...schedule,externalId:"LONG-EXTERNAL-MILESTONE-IDENTITY",sourceTaskId:"00000000-0000-4000-8000-000000000199",name:"아주 긴 완료 단계 이름 Long Milestone Identity",type:"milestone",parentExternalId:null,description:null,url:null,scheduleMode:"auto",duration:0,membership:{explicitMilestoneExternalId:null,effectiveMilestoneExternalId:null,inheritedFromExternalId:null}});
  return {schemaVersion:"1.1",projectPublicId:fixture.project.publicId,baseRevision:fixture.project.revision,previewDigest:"a".repeat(64),canCommit:true,sourceProject:{name:`Synthetic source${suffix}`,description:"Schedule-only source"},summary:{taskCreates:normalizedTasks.length,linkCreates:0,explicitMembershipCreates:normalizedTasks.length-1},normalizedTasks,changedTasks:[],warnings:[{code:"SYNTHETIC_WARNING",path:"tasks[0]",message:"대상 Calendar를 적용한 서버 미리보기입니다."}],targetCalendar:fixture.project.calendar!};
}
