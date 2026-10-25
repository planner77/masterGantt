import { describe, expect, it } from "vitest";
import { projectWorkareaOptions, validProjectWorkareas } from "../../../src/features/logistics/project-workarea-options";
import type { ProcessContextResponse } from "../../../src/contracts/process-catalog";
import type { ProcessDto } from "../../../src/contracts/logistics";

const processes=[{id:"p1",name:"첫 공정",active:true},{id:"p2",name:"다른 공정",active:false}] as ProcessDto[];
describe("project WorkArea consumer ownership",()=>{
  it("rejects malformed or duplicate owner pairs without rejecting shared aliases",()=>{
    const item={id:"wa",processId:"p1",occurrenceId:null,source:"project",editable:true,active:true,name:"구역",code:"A",sortOrder:0,usageCount:0};
    expect(validProjectWorkareas([item])).toBe(true);
    expect(validProjectWorkareas([{...item,source:"legacy",occurrenceId:"o",editable:false},{...item,processId:"p2",source:"legacy",occurrenceId:"o",editable:false}])).toBe(true);
    for(const invalid of [null,[item,item],[{...item,occurrenceId:"o"}],[{...item,source:"legacy"}],[{...item,active:"true"}],[{...item,sortOrder:NaN}]])expect(validProjectWorkareas(invalid)).toBe(false);
  });
  it("retains direct owner and duplicate legacy aliases without requiring catalog mappings",()=>{
    const item={code:"WA",name:"동일 이름",sortOrder:0,usageCount:0,active:true};
    const context={projectWorkAreas:[{...item,id:"direct",processId:"p1",occurrenceId:null,source:"project",editable:true},{...item,id:"shared",processId:"p1",occurrenceId:"old",source:"legacy",editable:false},{...item,id:"shared",processId:"p2",occurrenceId:"old",source:"legacy",editable:false}],mappings:[],workAreas:[],occurrences:[]} as unknown as ProcessContextResponse["data"];
    const result=projectWorkareaOptions(context,processes);
    expect(result.map(a=>[a.processId,a.workAreaId,a.active,a.source])).toEqual([["p1","direct",true,"project"],["p1","shared",true,"legacy"],["p2","shared",false,"legacy"]]);
    expect(result[0].occurrenceId).toBeNull();
    context.projectWorkAreas![1].diagnostics=["classification_mismatch"];
    const mismatched=projectWorkareaOptions(context,processes)[1];
    expect(mismatched).toMatchObject({id:"shared",processId:"p1",active:false});
  });
  it("supports old fixture catalogs while preserving ancestor activation and process owner",()=>{
    const context={mappings:[{processId:"p1",occurrenceId:"o",active:false,workAreaSelectionActive:true},{processId:"p2",occurrenceId:"o",active:true}],workAreas:[{id:"wa",name:"구역",code:"W",active:true,occurrenceId:"o"}],occurrences:[{id:"o",active:true}]} as ProcessContextResponse["data"];
    expect(projectWorkareaOptions(context,processes).map(a=>[a.processId,a.workAreaId,a.active])).toEqual([["p1","wa",true],["p2","wa",false]]);
    context.occurrences[0].active=false;
    expect(projectWorkareaOptions(context,processes).every(a=>!a.active)).toBe(true);
  });
});
