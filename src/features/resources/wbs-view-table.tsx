"use client";
import { useI18n } from "../../lib/i18n/provider";

import type { WbsViewNode, WbsViewReportDto } from "@/contracts/wbs-dashboard-views";
import { flattenWbsViewNodes, wbsViewNodeLabel, WBS_VIEW_LABELS } from "./wbs-view-model";
import { plannedEffort } from "./resource-dashboard-model";
import styles from "./wbs-view.module.css";
export function WbsViewTable({ data, expanded, sort, locked, selected, rowSearch = "", rowAnnotation, onToggle, onDetails, onOriginal }: { data: WbsViewReportDto; expanded: ReadonlySet<string>; sort: "name-asc" | "name-desc"; locked: boolean; selected: string | null; rowSearch?: string; rowAnnotation?: (node: WbsViewNode) => string | undefined; onToggle: (key: string) => void; onDetails: (node: WbsViewNode, trigger: HTMLElement) => void; onOriginal?: (node: WbsViewNode, trigger: HTMLElement) => void }) {
  const {t, locale, formatNumber } = useI18n();
  return <table className={styles.table} aria-label={t("공통 계층 결과")}><colgroup><col className={styles.identityCol}/><col className={styles.effortCol}/><col/><col/><col/><col className={styles.actionsCol}/></colgroup>
    <thead><tr><th scope="col">{t("이름 / 조회 축")}</th><th scope="col">{t("계획공수 M/D")}</th><th scope="col">Task</th><th scope="col">{t("완료")}</th><th scope="col">{t("지연")}</th><th scope="col">{t("상세 / 원본")}</th></tr></thead>
    <tbody>{flattenWbsViewNodes(data.children, rowSearch.trim() ? new Set(allKeys(data.children)) : expanded, sort).filter(({node}) => !rowSearch.trim() || wbsViewNodeLabel(node, locale).toLocaleLowerCase().includes(rowSearch.trim().toLocaleLowerCase())).map(({ node, depth }) => <tr key={node.viewRowKey} data-view-row-key={node.viewRowKey} data-depth={depth} data-dimension={node.selector.dimension} data-entity-id={node.selector.id ?? ""} aria-selected={selected === node.viewRowKey || undefined}>
      <th scope="row"><div className={styles.identity} style={{ paddingInlineStart: Math.min(depth * 16, 96) }}>
        {node.children.length && !rowSearch.trim() ? <button type="button" aria-label={t("{value0} 하위 {value1}", {value0: wbsViewNodeLabel(node, locale), value1: expanded.has(node.viewRowKey) ? t("접기") : t("펼치기")})} aria-expanded={expanded.has(node.viewRowKey)} onClick={() => onToggle(node.viewRowKey)}>{expanded.has(node.viewRowKey) ? "−" : "+"}</button> : null}
        <span>{wbsViewNodeLabel(node, locale)}<small>{t(WBS_VIEW_LABELS[node.selector.dimension])}{rowAnnotation?.(node) ? ` · ${rowAnnotation(node)}` : !node.taskIds.length ? t(" · 등록 정보만 있음") : ""}</small></span></div></th>
      <td>{plannedEffort(node.totals.assignments.effort, "md", locale)}</td><td>{formatNumber(node.totals.tasks.taskCount)}</td><td>{formatNumber(node.totals.tasks.completed.count)}</td><td>{formatNumber(node.totals.tasks.delayed.count)}</td>
      <td><div className={styles.controls}><button type="button" data-resource-action="entity-details" disabled={locked} onClick={event => onDetails(node, event.currentTarget)}>{t("상세")}</button>{node.selector.id && ["equipment", "system", "process", "milestone", "resource", "workArea"].includes(node.selector.dimension) && onOriginal ? <button type="button" data-resource-action="entity-original" disabled={locked} onClick={event => onOriginal(node, event.currentTarget)}>{t("원본")}</button> : null}</div></td>
    </tr>)}</tbody>
  </table>;
}

function allKeys(nodes: WbsViewNode[]): string[] { return nodes.flatMap(node => [node.viewRowKey, ...allKeys(node.children)]); }
