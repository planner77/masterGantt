import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TaskTargetBindingsDto } from "../../../src/contracts/task-target-bindings";
import { PhysicalConnectionSources } from "../../../src/features/resources/physical-connection-sources";

const sources: TaskTargetBindingsDto = {
  taskId: "task-current", bindings: [], inheritedBindings: [], effectiveTargetIds: ["archive-domain-id-must-not-render"],
  effectiveEquipmentIds: ["equipment-id"], effectiveSystemIds: [], legacySources: [],
  effectiveMembers: [{ kind: "equipment", entityId: "equipment-id", coverageState: "multiple", provenance: [
    {bindingId:"opaque-relation-1",memberId:"opaque-member-1",targetId:"archive-domain-id-must-not-render",sourceTaskId:"summary-source",scope:"subtree",selection:"whole",inherited:true,coverage:null,coverageMode:"whole"},
    {bindingId:"opaque-relation-2",memberId:"opaque-member-2",targetId:"archive-domain-id-must-not-render",sourceTaskId:"task-current",scope:"self",selection:"subset",inherited:false,coverage:0,coverageMode:"partial"},
  ] }],
};
describe("#785 physical source disclosure", () => {
  it("retains distinct source scope/coverage and canonical physical identity without exposing the archived entity", () => {
    const html=renderToStaticMarkup(createElement(PhysicalConnectionSources,{sources,catalog:[{dimension:"equipment",id:"equipment-id",name:"공유 설비",active:true,code:"E-1"}]}));
    expect(html).toContain("공유 설비");expect(html).toContain("equipment-id");
    expect(html).toContain("summary-source");expect(html).toContain("task-current");
    expect(html).toContain("하위 작업 포함");expect(html).toContain("전체 구성 연동");expect(html).toContain("선택 구성");
    expect(html).toContain("범위 0");expect(html).toContain("범위 미지정");
    expect(html).toContain("opaque-relation-1");expect(html).toContain("opaque-relation-2");
    expect(html).not.toContain("archive-domain-id-must-not-render");expect(html).not.toContain("Target");
  });
  it("keeps direct-only instance sources and reports a valid empty relation explicitly", () => {
    const direct={...sources,effectiveMembers:[],effectiveEquipmentIds:[],effectiveSystemIds:["system-id"],legacySources:[{sourceKind:"legacy_direct" as const,sourceTaskId:"summary-direct",kind:"system" as const,entityId:"system-id",scope:"subtree" as const,inherited:true}]};
    const html=renderToStaticMarkup(createElement(PhysicalConnectionSources,{sources:direct}));
    expect(html).toContain("system-id");expect(html).toContain("summary-direct");expect(html).toContain("하위 작업 포함");
    expect(renderToStaticMarkup(createElement(PhysicalConnectionSources,{sources:{...direct,legacySources:[],effectiveSystemIds:[]}}))).toContain("실물 연결 없음");
  });
});
