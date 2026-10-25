import { describe, expect, it } from "vitest";
import { workAreaBelongsToProcess } from "../../src/domain/resources/resource-kpi-targets";
import { resolveWbsTaskLedger, selectWbsTaskLedger, summarizeWbsTaskLedger } from "../../src/domain/resources/wbs-task-ledger";
import { wbsTaskLedgerFixture } from "../fixtures/wbs-task-ledger";

describe("#762 WorkArea identity across new and legacy ledger sources",()=>{
  it("uses the exact Project process owner instead of nullable occurrence equality",()=>{
    const area={id:"A",occurrenceId:null,projectProcessId:"PA"};
    expect(workAreaBelongsToProcess(area,{id:"PA",occurrenceId:null})).toBe(true);
    expect(workAreaBelongsToProcess(area,{id:"PB",occurrenceId:null})).toBe(false);
    expect(workAreaBelongsToProcess(area,{id:"PA",occurrenceId:"LEGACY"})).toBe(true);
    expect(workAreaBelongsToProcess({id:"A",occurrenceId:null},{id:"PA",occurrenceId:null})).toBe(false);
    expect(workAreaBelongsToProcess({id:"A",occurrenceId:"OA"},{id:"PB",occurrenceId:"OA"})).toBe(true);
  });
  it("keeps canonical Task, Assignment, fleet and source totals equal when direct ownership replaces only fixture location metadata",()=>{
    const legacy=wbsTaskLedgerFixture(),original=resolveWbsTaskLedger(legacy),input=structuredClone(legacy);
    input.kpi.logistics={...input.kpi.logistics!,processes:input.kpi.logistics!.processes.map(p=>({...p,occurrenceId:null})),workAreas:[{id:"WA",occurrenceId:null,projectProcessId:"PA"},{id:"WB",occurrenceId:null,projectProcessId:"PB"}]};
    input.equipmentWorkAreas=input.equipmentWorkAreas.map(row=>({...row,occurrenceId:null}));
    const current=resolveWbsTaskLedger(input);
    const selectors=[[],[{dimension:"process" as const,id:"PA"}],[{dimension:"workArea" as const,id:"WA"}],[{dimension:"equipment" as const,id:"E10"}],[{dimension:"system" as const,id:"MCS"}],[{dimension:"resource" as const,id:"R1"}],[{dimension:"milestone" as const,id:"M"}]];
    for(const path of selectors) {
      const prior=summarizeWbsTaskLedger(original,selectWbsTaskLedger(original,path)),next=summarizeWbsTaskLedger(current,selectWbsTaskLedger(current,path));
      expect(next.tasks).toEqual(prior.tasks);expect(next.assignments).toEqual(prior.assignments);expect(next.relatedMembers).toEqual(prior.relatedMembers);expect(next.configurationReference).toEqual(prior.configurationReference);
    }
    input.equipmentWorkAreas=input.equipmentWorkAreas.map((row,index)=>index===0?{...row,processId:"PB"}:row);
    expect(()=>resolveWbsTaskLedger(input)).toThrowError(expect.objectContaining({code:"WORK_AREA_OWNERSHIP_MISMATCH"}));
  });
});
