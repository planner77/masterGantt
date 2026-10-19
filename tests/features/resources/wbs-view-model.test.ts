import { describe,it,expect } from "vitest";
import { WBS_VIEW_DIMENSIONS } from "../../../src/contracts/wbs-dashboard-views";
import { parseWbsViewQuery } from "../../../src/server/resources/wbs-dashboard-views-query-core";
import { WBS_VIEW_ROOTS,defaultWbsViewSpec,validateWbsViewSpec,flattenWbsViewNodes } from "../../../src/features/resources/wbs-view-model";
import { loadWbsViewState,saveWbsViewState,type WbsViewStoredState } from "../../../src/features/resources/wbs-view-storage";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
const oracle=(spec:unknown)=>{try{parseWbsViewQuery({spec});return true;}catch{return false;}};
describe("WBS client spec server-oracle parity",()=>{
 it("matches all roots × ordered pairs including duplicate and invalid axes",()=>{
  const dimensions=[...WBS_VIEW_DIMENSIONS,"obsolete",null];
  for(const root of WBS_VIEW_DIMENSIONS) for(const a of dimensions) for(const b of dimensions) {
   const value={...defaultWbsViewSpec(root),levels:[a,b]};expect(validateWbsViewSpec(value).ok,JSON.stringify(value)).toBe(oracle(value));
  }
 });
 it("matches deterministic arbitrary order/depth and typed sibling matrices",()=>{
  let seed=730;
  for(let i=0;i<500;i++){
   seed=(seed*1664525+1013904223)>>>0;
   const root=WBS_VIEW_DIMENSIONS[seed%8],length=(seed>>>8)%10;
   const levels=Array.from({length},(_,j)=>WBS_VIEW_DIMENSIONS[((seed>>>(j%20))+j)%8]);
   const value={...defaultWbsViewSpec(root),levels};expect(validateWbsViewSpec(value).ok).toBe(oracle(value));
  }
  for(const root of WBS_VIEW_DIMENSIONS) for(const dimensions of [["equipment","system"],["system","equipment"],["system","system"],["resource","group"],["equipment"]]) for(const tail of [[],["workArea"],[root]]){
   const value={...defaultWbsViewSpec(root),levels:[{kind:"siblings",dimensions},...tail]};expect(validateWbsViewSpec(value).ok).toBe(oracle(value));
  }
 });
 it("rejects obsolete/unknown schema and preserves exact server nodes under flatten sort",()=>{
  for(const value of [null,{}, {...defaultWbsViewSpec("process"),unknown:true},{...defaultWbsViewSpec("equipment"),levels:["equipment"]}]) expect(validateWbsViewSpec(value).ok).toBe(oracle(value));
  const f=wbsDashboardViewsFixture();
  try {
   const report=f.service.queryWbsView(f.project.publicId,{spec:{...defaultWbsViewSpec("equipment"),levels:["process"]}})!;
   if(report.projection!=="report")throw Error("report");
   const before=JSON.stringify(report),expanded=new Set(report.children.map(node=>node.viewRowKey));
   const flattened=flattenWbsViewNodes(report.children,expanded,"name-desc");
   expect(flattened.length).toBeGreaterThan(report.children.length);
   for(const node of report.children)expect(flattened.find(row=>row.node===node)?.node.totals).toBe(node.totals);
   expect(new Set(flattened.map(row=>row.node.viewRowKey)).size).toBe(flattened.length);
   expect(JSON.stringify(report)).toBe(before);
  }finally{f.database.close();}
 });
});
describe("personal WBS storage",()=>{
 const state:WbsViewStoredState={rowSearch:"설비 이름",spec:defaultWbsViewSpec("process"),filters:{taskSearch:"needle",statuses:["completed"]},expanded:["row"],selected:{viewRowKey:"row",path:[{dimension:"process",id:"p"}]},scroll:{top:30,left:2},focus:"row",sort:"name-desc"};
 const memory=()=>{const map=new Map<string,string>();return {getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);},map};};
 it("isolates project/root, roundtrips full state, never persists server source data",()=>{
  const storage=memory();expect(saveWbsViewState(storage,"p","process",state).warning).toBeNull();expect(loadWbsViewState(storage,"p","process").state).toEqual(state);
  expect(saveWbsViewState(storage,"p","process",{...state,rowSearch:"a".repeat(201)}).warning).toBeTruthy();
  expect(loadWbsViewState(storage,"other","process").state).toBeNull();expect(loadWbsViewState(storage,"p","equipment").state).toBeNull();
  expect(saveWbsViewState(storage,"p","process",{...state,snapshotId:"secret"} as WbsViewStoredState).warning).toBeTruthy();
 });
 it("recovers visibly from denied/corrupt/obsolete storage and obsolete dimensions",()=>{
  const denied={getItem:()=>{throw Error("denied");},setItem:()=>{throw Error("quota");}};
  expect(loadWbsViewState(denied,"p","process").warning).toBeTruthy();expect(saveWbsViewState(denied,"p","process",state)).toMatchObject({state,warning:expect.any(String)});
  for(const raw of [JSON.stringify({schema:"wbs-view-state/1",projectPublicId:"p",state:{...state,filters:{from:"2026-02-31"}}}), JSON.stringify({schema:"wbs-view-state/1",projectPublicId:"p",state:{...state,filters:{resourceIds:["obsolete-id"]}}}), "{",JSON.stringify({schema:"wbs-view-state/0",projectPublicId:"p",state}),JSON.stringify({schema:"wbs-view-state/1",projectPublicId:"p",state:{...state,spec:{...state.spec,levels:["old"]}}})]){
   const storage={getItem:()=>raw,setItem:()=>{}};expect(loadWbsViewState(storage,"p","process")).toMatchObject({state:null,warning:expect.any(String)});
  }
 });
 it("restores root-only and two user-edited hierarchies for every fixed root",()=>{
  for(const root of WBS_VIEW_ROOTS){
   const storage=memory(),other=WBS_VIEW_DIMENSIONS.filter(dimension=>dimension!==root);
   for(const levels of [[],[other[0]],[other[1],other[0]]]){
    const value={...state,spec:{...defaultWbsViewSpec(root),levels},selected:null};
    expect(saveWbsViewState(storage,"p",root,value).state).toEqual(value);
    expect(loadWbsViewState(storage,"p",root).state).toEqual(value);
   }
  }
 });
});
