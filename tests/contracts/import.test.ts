import {describe,expect,it} from "vitest";
import {validateImportPayload} from "../../src/contracts/import";
import {createWorkingCalendar} from "../../src/domain/scheduling";
const calendar=createWorkingCalendar({timezone:"Asia/Seoul",weekendDays:[6,0]});
const empty = (externalId="S",parentExternalId:string|null=null) => ({externalId,name:"빈 요약",type:"summary",parentExternalId,predecessors:[]});
const envelope=(tasks:unknown[])=>({schemaVersion:"1.0",project:{name:"계층 가져오기",description:""},tasks});
const leaf={externalId:"T",name:"실제 작업",type:"task",start:"2026-10-01",duration:2,progress:40,parentExternalId:"S",predecessors:[]};
describe("Issue #345 pure import payload validation",()=>{
 it("keeps omitted and explicit null nested empty summaries without substitute dates",()=>{
  const result=validateImportPayload(envelope([empty(),{...empty("N","S"),scheduleMode:"auto",requestedStart:null,start:null,end:null,duration:null,progress:null}]),calendar);
  expect(result.success).toBe(true);if(!result.success)return;
  expect(result.tasks).toMatchObject([{type:"summary",start:null,end:null,duration:null,progress:null},{type:"summary",start:null,end:null,duration:null,progress:null}]);
 });
 it("accepts existing valid summary snapshots but derives only from real descendants",()=>{
  const input=envelope([{...empty(),start:"2025-01-01",end:"2025-01-03",duration:3,progress:100},leaf,empty("N","S")]);
  const original=structuredClone(input),result=validateImportPayload(input,calendar);
  expect(input).toEqual(original);expect(result.success).toBe(true);if(!result.success)return;
  expect(result.tasks[0]).toMatchObject({start:"2026-10-01",end:"2026-10-02",duration:2,progress:40});
 });
 it.each(["start","duration","progress"])("rejects null %s on a real leaf",field=>{
  expect(validateImportPayload(envelope([empty(),{...leaf,[field]:null}]),calendar).success).toBe(false);
 });
 it.each([{start:"2026-02-30"},{duration:Infinity},{progress:NaN},{scheduleMode:"manual"},{requestedStart:"2026-10-01"}])("rejects invalid Summary source fields %o",patch=>{
  expect(validateImportPayload(envelope([{...empty(),...patch}]),calendar).success).toBe(false);
 });
 it("keeps strict project, reference, endpoint and date contracts",()=>{
  for(const payload of [envelope([empty(),{...leaf,parentExternalId:"MISSING"}]),envelope([{...empty(),predecessors:[{externalId:"T"}]},leaf]),envelope([empty(),{...leaf,end:"2026-10-05"}]),{...envelope([empty()]),schemaVersion:"2.0"},{...envelope([empty()]),unknown:true}]) {
   expect(validateImportPayload(payload,calendar).success).toBe(false);
  }
 });
});
