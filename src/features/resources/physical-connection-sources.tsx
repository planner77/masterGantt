"use client";

import type { TaskTargetBindingsDto } from "@/contracts/task-target-bindings";
import type { ResourceDashboardDto } from "@/contracts/resource-dashboard";
import { IdentifierDetails } from "../../components/identifier-details";

type PhysicalCatalog = NonNullable<ResourceDashboardDto["catalog"]["targetOptions"]>;

/** The archive remains a read-only source; only real instances and source Tasks are shown. */
export function PhysicalConnectionSources({ sources, catalog = [] }: { sources?: TaskTargetBindingsDto; catalog?: PhysicalCatalog }) {
  if (!sources) return null;
  const instances = new Map<string, { kind: "equipment" | "system"; id: string }>();
  for (const member of sources.effectiveMembers) instances.set(`${member.kind}:${member.entityId}`, { kind: member.kind, id: member.entityId });
  for (const member of sources.legacySources) instances.set(`${member.kind}:${member.entityId}`, { kind: member.kind, id: member.entityId });
  if (!instances.size) return <small>실물 연결 없음</small>;
  return <details><summary>실물 연결·출처 {instances.size}개</summary><ul>{[...instances.values()].map(instance => {
    const name = catalog.find(item => item.dimension === instance.kind && item.id === instance.id)?.name;
    const members = sources.effectiveMembers.filter(member => member.kind === instance.kind && member.entityId === instance.id);
    const direct = sources.legacySources.filter(member => member.kind === instance.kind && member.entityId === instance.id);
    return <li key={`${instance.kind}:${instance.id}`}>
      <span>{instance.kind === "equipment" ? "설비" : "물류 시스템"} · {name ?? "원본 식별 정보"}</span>
      <IdentifierDetails label="실물 원본 식별 정보" identifiers={[{ label: instance.kind === "equipment" ? "설비 ID" : "시스템 ID", value: instance.id }]} />
      <ul>{members.flatMap(member => member.provenance).map((source, index) => <li key={`${source.bindingId}:${source.memberId}:${index}`}>
        보존 연결 · {source.inherited ? "상속" : "직접"} · {source.scope === "subtree" ? "하위 작업 포함" : "이 작업"} · {source.selection === "whole" ? "전체 구성 연동" : "선택 구성"} · 범위 {source.coverage === null ? "미지정" : source.coverage}
        <IdentifierDetails label="보존 연결 출처" identifiers={[{ label: "원본 작업 ID", value: source.sourceTaskId }, { label: "관계 참조", value: source.bindingId }, { label: "구성 참조", value: source.memberId }]} />
      </li>)}{direct.map((source, index) => <li key={`${source.sourceTaskId}:${source.scope}:${index}`}>
        직접 연결 · {source.inherited ? "상속" : "직접"} · {source.scope === "subtree" ? "하위 작업 포함" : "이 작업"}
        <IdentifierDetails label="직접 연결 출처" identifiers={[{ label: "원본 작업 ID", value: source.sourceTaskId }]} />
      </li>)}</ul>
    </li>;
  })}</ul></details>;
}
