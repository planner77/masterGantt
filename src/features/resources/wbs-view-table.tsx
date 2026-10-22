"use client";
import type { WbsViewNode, WbsViewReportDto } from "@/contracts/wbs-dashboard-views";
import { flattenWbsViewNodes, wbsViewNodeLabel, WBS_VIEW_LABELS } from "./wbs-view-model";
import { plannedEffort } from "./resource-dashboard-model";
import styles from "./wbs-view.module.css";
export function WbsViewTable({ data, expanded, sort, locked, selected, rowSearch = "", rowAnnotation, onToggle, onDetails, onOriginal }: { data: WbsViewReportDto; expanded: ReadonlySet<string>; sort: "name-asc" | "name-desc"; locked: boolean; selected: string | null; rowSearch?: string; rowAnnotation?: (node: WbsViewNode) => string | undefined; onToggle: (key: string) => void; onDetails: (node: WbsViewNode, trigger: HTMLElement) => void; onOriginal?: (node: WbsViewNode, trigger: HTMLElement) => void }) {
  return <table className={styles.table} aria-label="공통 계층 결과"><colgroup><col className={styles.identityCol}/><col className={styles.effortCol}/><col/><col/><col/><col className={styles.actionsCol}/></colgroup>
    <thead><tr><th scope="col">이름 / 조회 축</th><th scope="col">계획공수 M/D</th><th scope="col">Task</th><th scope="col">완료</th><th scope="col">지연</th><th scope="col">상세 / 원본</th></tr></thead>
    <tbody>{flattenWbsViewNodes(data.children, rowSearch.trim() ? new Set(allKeys(data.children)) : expanded, sort).filter(({node}) => !rowSearch.trim() || wbsViewNodeLabel(node).toLocaleLowerCase().includes(rowSearch.trim().toLocaleLowerCase())).map(({ node, depth }) => <tr key={node.viewRowKey} data-view-row-key={node.viewRowKey} data-depth={depth} data-dimension={node.selector.dimension} data-entity-id={node.selector.id ?? ""} aria-selected={selected === node.viewRowKey || undefined}>
      <th scope="row"><div className={styles.identity} style={{ paddingInlineStart: Math.min(depth * 16, 96) }}>
        {node.children.length && !rowSearch.trim() ? <button type="button" aria-label={`${wbsViewNodeLabel(node)} 하위 ${expanded.has(node.viewRowKey) ? "접기" : "펼치기"}`} aria-expanded={expanded.has(node.viewRowKey)} onClick={() => onToggle(node.viewRowKey)}>{expanded.has(node.viewRowKey) ? "−" : "+"}</button> : null}
        <span>{wbsViewNodeLabel(node)}<small>{WBS_VIEW_LABELS[node.selector.dimension]}{rowAnnotation?.(node) ? ` · ${rowAnnotation(node)}` : !node.taskIds.length ? " · 등록 정보만 있음" : ""}</small></span></div></th>
      <td>{plannedEffort(node.totals.assignments.effort, "md")}</td><td>{node.totals.tasks.taskCount}</td><td>{node.totals.tasks.completed.count}</td><td>{node.totals.tasks.delayed.count}</td>
      <td><div className={styles.controls}><button type="button" data-resource-action="entity-details" disabled={locked} onClick={event => onDetails(node, event.currentTarget)}>상세</button>{node.selector.id && ["equipment", "system", "process", "milestone", "resource", "workArea"].includes(node.selector.dimension) && onOriginal ? <button type="button" data-resource-action="entity-original" disabled={locked} onClick={event => onOriginal(node, event.currentTarget)}>원본</button> : null}</div></td>
    </tr>)}</tbody>
  </table>;
}

function allKeys(nodes: WbsViewNode[]): string[] { return nodes.flatMap(node => [node.viewRowKey, ...allKeys(node.children)]); }
