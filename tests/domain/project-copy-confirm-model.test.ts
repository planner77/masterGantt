import { describe, expect, it } from "vitest";
import type { MembershipCopyPlan, ProjectTaskDto } from "../../src/contracts/projects";
import { copyInheritanceLabel, copyMilestoneLabel, copyReviewMatches, type CopyReview } from "../../src/features/projects/project-copy-confirm-model";
const plan:MembershipCopyPlan={rootTaskIds:["t"],copiedTaskIds:["t"],preservedExplicitMemberships:[],excludedExplicitMemberships:[{taskId:"t",milestoneTaskId:"m"}],impacts:[],requiresAcknowledgement:true};
const review:CopyReview={publicId:"p",revision:3,command:{kind:"copy",taskIds:["t"],anchorTaskId:"a",placement:"child"},plan};
const tasks=[{taskId:"m",externalId:"M1",name:"Stage"},{taskId:"s",externalId:"S1",name:"Summary"}] as ProjectTaskDto[];
describe("copy confirmation identity",()=>{
 it("accepts the same reviewed canonical command",()=>expect(copyReviewMatches(review,"p",3,review.command,plan)).toBe(true));
 it.each(["public","revision","anchor","placement","roots","copied","exclusions"])("invalidates acknowledgement when %s changes",(field)=>{let command={...review.command},next={...plan};if(field==="anchor")command={...command,anchorTaskId:"b"};if(field==="placement")command={...command,placement:"after"};if(field==="roots")next={...next,rootTaskIds:["other"]};if(field==="copied")next={...next,copiedTaskIds:["t","child"]};if(field==="exclusions")next={...next,excludedExplicitMemberships:[]};expect(copyReviewMatches(review,field==="public"?"q":"p",field==="revision"?4:3,command,next)).toBe(false);});
 it("labels existing IDs and copied-from metadata separately",()=>{expect(copyMilestoneLabel({kind:"existing",existingMilestoneTaskId:"m"},tasks)).toContain("기존 단계");expect(copyMilestoneLabel({kind:"copied",copiedFromMilestoneTaskId:"m"},tasks)).toContain("복제될 단계 · 원본");expect(copyInheritanceLabel({kind:"copied",copiedFromSummaryTaskId:"s"},tasks)).toContain("복제될 Summary 상속 · 원본");expect(copyMilestoneLabel(null,tasks)).toBe("미지정");});
});
