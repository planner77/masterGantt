"use client";
import { displayName } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n/provider";


import { Fragment } from "react";
import { IdentifierDetails } from "@/components/identifier-details";
import type { ResourceDashboardDto, ResourceDashboardFilterInput } from "@/contracts/resource-dashboard";

const FILTERS = [
  ["equipmentIds", "설비", "equipment"],
  ["systemIds", "물류 시스템", "system"],
  ["physicalEquipmentTypeCodes", "설비 종류", "equipmentType"],
  ["physicalSystemTypeCodes", "시스템 종류", "systemType"],
] as const;

/** Every option refers to a physical instance/type from the report's read snapshot. */
export function ResourceEntityFilters({ data, filters, onChange, quick = false }: {
  data: ResourceDashboardDto | null;
  filters: ResourceDashboardFilterInput;
  onChange: (patch: Partial<ResourceDashboardFilterInput>) => void;
  quick?: boolean;
}) {
  const { t, locale } = useI18n();
  const catalog = data?.catalog.targetOptions ?? [];
  const noCatalog = !data || data.catalog.targetOptions === undefined;
  const definitions = quick ? FILTERS.slice(0, 2) : FILTERS.slice(2);
  return <>{definitions.map(([key, label, dimension]) => {
    const selected = filters[key]?.[0] ?? "";
    const selectedItem = catalog.find(item => item.dimension === dimension && item.id === selected);
    return <Fragment key={key}>
      <label>{t(label)}<select aria-label={t(label)} value={selected} disabled={noCatalog} onChange={event => onChange({ [key]: event.target.value ? [event.target.value] : [] })}>
        <option value="">{t("전체")}</option>
        {catalog.filter(item => item.dimension === dimension).map(item => <option key={item.id} value={item.id}>{displayName(item, locale)}{catalog.some(other => other.dimension === dimension && other.id !== item.id && displayName(other, locale) === displayName(item, locale)) ? ` (${item.code || item.id})` : ""}{!item.active ? t(" · 비활성 기존 연결") : ""}</option>)}
        {selected && !selectedItem ? <option value={selected}>{t("원본 정보 없음 · 현재 선택")}</option> : null}
      </select></label>
      {selected ? <IdentifierDetails label={t("{value0} 선택 식별 정보", {value0: t(label)})} identifiers={[{ label: "ID", value: selected }, ...(selectedItem?.code ? [{ label: "코드", value: selectedItem.code }] : [])]} /> : null}
    </Fragment>;
  })}</>;
}
