import { describe,expect,it } from "vitest";
import { toResourcePublicV2,fromResourcePublicV2,isRetiredResourceSelection } from "../../src/contracts/resource-public-v2";
import { prepareResourceKpiSnapshot,selectResourceKpiAssignments } from "../../src/domain/resources/resource-kpi";
import { resourceTargetKpiFixture } from "../fixtures/resource-target-kpi";
import { resourceReadInput,resourceReadParams,resourceReadVersion } from "../../src/server/resources/resource-public-v2-core";

describe("#785 physical public read boundary",()=>{
  it("preserves canonical identity, relation coverage and user names while excluding archived entity IDs",()=>{
    const raw={data:{schema:"wbs-view-report/1",name:"target-binding",taskSources:[{taskId:"T",contextState:"legacy-null",processIds:[],workAreaIds:[],equipmentIds:["E"],systemIds:[],targetIds:["PRIVATE-GROUP"],targetSources:{taskId:"T",effectiveEquipmentIds:["E"],effectiveSystemIds:[],effectiveTargetIds:["PRIVATE-GROUP"],effectiveMembers:[{kind:"equipment",entityId:"E",provenance:[{targetId:"PRIVATE-GROUP",bindingId:"B",memberId:"M",sourceTaskId:"S",coverage:2,scope:"subtree",selection:"subset",inherited:true}]}]}}],diagnostics:{inactiveTargetIds:["PRIVATE-GROUP"],inactiveInstanceIds:[{kind:"equipment",id:"E"}]}}};
    const wire=toResourcePublicV2(raw);
    expect(JSON.stringify(wire)).not.toContain("PRIVATE-GROUP");
    expect(wire).toMatchObject({data:{schema:"wbs-view-report/2",name:"target-binding",taskSources:[{taskId:"T",physicalSources:{effectiveMembers:[{kind:"equipment",entityId:"E",provenance:[{relationId:"B",memberReference:"M",sourceTaskId:"S",coverage:2,scope:"subtree",selection:"subset",inherited:true}]}]}}]}});
    expect(fromResourcePublicV2(wire)).toMatchObject({data:{schema:"wbs-view-report/2",taskSources:[{targetIds:[],targetSources:{effectiveTargetIds:[]}}]}});
    expect(fromResourcePublicV2(raw)).toBe(raw);
  });
  it("explicitly versions legacy reads and rejects retired selectors on the current boundary",()=>{
    expect(resourceReadVersion(new Request("http://example.test"))).toBe(2);
    expect(resourceReadVersion(new Request("http://example.test",{headers:{"X-MasterGantt-Resource-Version":"1"}}))).toBe(1);
    for(const input of [{targetIds:["x"]},{projection:{selector:{dimension:"targetProjection"}}},{projectionOrder:["resource","target"]}]){
      expect(isRetiredResourceSelection(input)).toBe(true);
      expect(()=>resourceReadInput(input,2)).toThrowError(expect.objectContaining({status:410,code:"RESOURCE_SELECTION_RETIRED"}));
      expect(resourceReadInput(input,1)).toBe(input);
    }
    expect(resourceReadParams(new URLSearchParams("equipmentIds=E&equipmentTypeCodes=amr"),2).toString()).toBe("equipmentIds=E&physicalEquipmentTypeCodes=amr");
  });
  it("physical selectors union archived whole/subset/inherited and direct instances without widening subsets or double-counting",()=>{
    const source=resourceTargetKpiFixture(),prepared=prepareResourceKpiSnapshot(source),legacy=prepared.logistics!.resolved;
    for(const kind of ["equipment","system"] as const) for(const instance of source.logistics.instances.filter(row=>row.kind===kind)){
      const key=kind === "equipment"?"equipmentIds":"systemIds";
      const selected=selectResourceKpiAssignments(prepared,{[key]:[instance.entityId]});
      const expected=source.tasks.filter(row=>row.type === "task" && (kind === "equipment"?legacy.get(row.taskId)!.effectiveEquipmentIds:legacy.get(row.taskId)!.effectiveSystemIds).includes(instance.entityId)).map(row=>row.taskId).sort();
      expect(selected.t0.map(row=>row.taskId).sort()).toEqual(expected);
      expect(new Set(selected.assignments.map(row=>row.assignmentId)).size).toBe(selected.assignments.length);
    }
    const mcs=selectResourceKpiAssignments(prepared,{systemIds:["MCS-1"]});
    expect(mcs.t0.map(row=>row.taskId)).toContain("LEGACY");
    const mixed=selectResourceKpiAssignments(prepared,{equipmentIds:["AMR-B"]});
    expect(mixed.t0.map(row=>row.taskId)).toContain("MIXED");
    expect(mixed.t0.map(row=>row.taskId)).not.toContain("ACS-ONLY");
    expect(selectResourceKpiAssignments(prepared,{equipmentIds:["AMR-B"],physicalEquipmentTypeCodes:["amr"]}).t0.map(row=>row.taskId)).toEqual(mixed.t0.map(row=>row.taskId));
  });
});
