"use client";
import { useI18n } from "../../lib/i18n/provider";


import type { TaskTargetBindingsDto } from "@/contracts/task-target-bindings";
import type { ResourceDashboardDto } from "@/contracts/resource-dashboard";
import { IdentifierDetails } from "../../components/identifier-details";

type PhysicalCatalog = NonNullable<ResourceDashboardDto["catalog"]["targetOptions"]>;

/** The archive remains a read-only source; only real instances and source Tasks are shown. */
export function PhysicalConnectionSources({ sources, catalog = [] }: { sources?: TaskTargetBindingsDto; catalog?: PhysicalCatalog }) {
  const { t } = useI18n();
  if (!sources) return null;
  const instances = new Map<string, { kind: "equipment" | "system"; id: string }>();
  for (const member of sources.effectiveMembers) instances.set(`${member.kind}:${member.entityId}`, { kind: member.kind, id: member.entityId });
  for (const member of sources.legacySources) instances.set(`${member.kind}:${member.entityId}`, { kind: member.kind, id: member.entityId });
  if (!instances.size) return <small>{t("실물 연결 없음")}</small>;
  return <details><summary>{t("실물 연결·출처")}{" "}{instances.size}{t("개")}</summary><ul>{[...instances.values()].map(instance => {
    const name = catalog.find(item => item.dimension === instance.kind && item.id === instance.id)?.name;
    const members = sources.effectiveMembers.filter(member => member.kind === instance.kind && member.entityId === instance.id);
    const direct = sources.legacySources.filter(member => member.kind === instance.kind && member.entityId === instance.id);
    return <li key={`${instance.kind}:${instance.id}`}>
      <span>{instance.kind === "equipment" ? t("설비") : t("물류 시스템")} · {name ?? t("원본 식별 정보")}</span>
      <IdentifierDetails label={t("실물 원본 식별 정보")} identifiers={[{ label: instance.kind === "equipment" ? "설비 ID" : "시스템 ID", value: instance.id }]} />
      <ul>{members.flatMap(member => member.provenance).map((source, index) => <li key={`${source.bindingId}:${source.memberId}:${index}`}>
        {t("보존 연결 ·")}{" "}{source.inherited ? t("상속") : t("직접")} · {source.scope === "subtree" ? t("하위 작업 포함") : t("이 작업")} · {source.selection === "whole" ? t("전체 구성 연동") : t("선택 구성")} {t("· 범위")}{" "}{source.coverage === null ? t("미지정") : source.coverage}
        <IdentifierDetails label={t("보존 연결 출처")} identifiers={[{ label: "원본 작업 ID", value: source.sourceTaskId }, { label: "관계 참조", value: source.bindingId }, { label: "구성 참조", value: source.memberId }]} />
      </li>)}{direct.map((source, index) => <li key={`${source.sourceTaskId}:${source.scope}:${index}`}>
        {t("직접 연결 ·")}{" "}{source.inherited ? t("상속") : t("직접")} · {source.scope === "subtree" ? t("하위 작업 포함") : t("이 작업")}
        <IdentifierDetails label={t("직접 연결 출처")} identifiers={[{ label: "원본 작업 ID", value: source.sourceTaskId }]} />
      </li>)}</ul>
    </li>;
  })}</ul></details>;
}
