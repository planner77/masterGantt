"use client";
import { useResourceDrill } from "./resource-drill-context";
import { resourceProjectionFetch } from "./resource-drill-transport";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  ResourceDashboardDto,
  ResourceDashboardGroupChildrenDto,
  ResourceDashboardRow,
  ResourceDashboardSummary,
} from "@/contracts/resource-dashboard";
import {
  groupChildrenQuery,
  orderedMilestones,
  plannedEffort,
  readGroupChildren,
} from "./resource-dashboard-model";
import { dashboardError } from "./use-resource-dashboard";

function pct(value: number | null) {
  return value === null ? "진척 미산정" : `${value.toFixed(1)}%`;
}
type Open = (
  summary: ResourceDashboardSummary,
  label: string,
  view: "tasks" | "assignments",
  trigger: HTMLElement,
) => void;
type Props = {
  data: ResourceDashboardDto;
  mode: "group" | "resource";
  unit: "md" | "mm";
  stale: boolean;
  active: boolean;
  onStale: () => void;
  onOpen: Open;
};
export function MilestoneScopeSummaries({
  data,
  unit,
  stale,
  onOpen,
}: Omit<Props, "mode" | "active" | "onStale">) {
  if (data.milestoneSelection && !data.milestoneSelection.applied)
    return (
      <p className="resource-dashboard-hint">
        Milestone 조건 없음 · 기준=선택 · 제외된 배정 0
      </p>
    );
  return (
    <>
      <dl
        className="resource-milestone-scope"
        aria-label="Milestone 선택과 기준 범위"
      >
        {(
          [
            ["선택 Milestone 범위", data.summary],
            ["Milestone 조건 제외 기준", data.reference],
            ["선택에서 제외된 배정", data.excluded],
          ] as const
        ).map(([label, summary]) =>
          summary ? (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{plannedEffort(summary.effort, unit)}</dd>
              <button
                type="button"
                disabled={stale || !summary.taskCount}
                onClick={(e) =>
                  onOpen(summary, label, "tasks", e.currentTarget)
                }
              >
                {summary.taskCount} Task
              </button>
              <small>
                {summary.assignmentCount} Assignment · 선택 할당 작업 진척{" "}
                {pct(summary.assignedTaskProgress.percent)}
              </small>
            </div>
          ) : null,
        )}
      </dl>
      {data.milestoneSelection && !data.milestoneSelection.applied ? (
        <p className="resource-dashboard-hint">
          Milestone 조건이 없어 기준과 선택은 같습니다. 제외된 배정은 없습니다.
        </p>
      ) : null}
    </>
  );
}
function Pager({
  label,
  offset,
  size,
  total,
  onPage,
  disabled,
}: {
  label: string;
  offset: number;
  size: number;
  total: number;
  onPage: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="resource-dashboard-pagination">
      <span>
        {label} {total ? offset + 1 : 0}–{Math.min(offset + size, total)} /{" "}
        {total}
      </span>
      <button
        type="button"
        className="secondary-button"
        aria-label={`${label} 이전`}
        disabled={disabled || offset === 0}
        onClick={() => onPage(Math.max(0, offset - size))}
      >
        이전
      </button>
      <button
        type="button"
        className="secondary-button"
        aria-label={`${label} 다음`}
        disabled={disabled || offset + size >= total}
        onClick={() => onPage(offset + size)}
      >
        다음
      </button>
    </div>
  );
}
export function ResourceMilestoneMatrix(props: Props) {
  const { data, mode, unit, stale, onOpen } = props;
  const [rowOffset, setRowOffset] = useState(0),
    [columnOffset, setColumnOffset] = useState(0),
    [metric, setMetric] = useState("effort");
  const rows = mode === "group" ? data.groups : data.resources,
    stages = orderedMilestones(data),
    visible = stages.slice(columnOffset, columnOffset + 6);
  const metricLabel =
    metric === "effort"
      ? "계획 공수"
      : metric === "tasks"
        ? "고유 Task"
        : metric === "completion"
          ? "완료율"
          : "지연 Task";
  const render = (s: ResourceDashboardSummary | undefined, label: string) =>
    !s || !s.assignmentCount || s.effort.state === "empty" ? (
      <span>대상 없음</span>
    ) : (
      <button
        type="button"
        aria-label={`${label} · ${metricLabel} 상세`}
        disabled={stale || !s.assignmentCount}
        onClick={(e) =>
          onOpen(
            metric === "delayed"
              ? { ...s, selector: { ...s.selector, metric: "delayed" } }
              : s,
            `${label} · ${metricLabel}`,
            metric === "effort" ? "assignments" : "tasks",
            e.currentTarget,
          )
        }
      >
        {metric === "effort"
          ? plannedEffort(s.effort, unit)
          : metric === "tasks"
            ? s.taskCount
            : metric === "completion"
              ? s.completion.percent === null
                ? "완료율 미산정"
                : pct(s.completion.percent)
              : s.delayed}
      </button>
    );
  return (
    <section aria-label="Milestone 비교표">
      <label>
        셀 지표
        <select
          aria-label="셀 지표"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          <option value="effort">계획 공수</option>
          <option value="tasks">고유 Task</option>
          <option value="completion">완료율</option>
          <option value="delayed">지연 Task</option>
        </select>
      </label>
      <Pager
        label="행"
        offset={rowOffset}
        size={50}
        total={rows.length}
        onPage={setRowOffset}
        disabled={stale}
      />
      <Pager
        label="단계"
        offset={columnOffset}
        size={6}
        total={stages.length}
        onPage={setColumnOffset}
        disabled={stale}
      />
      <p className="resource-dashboard-hint">
        전체는 선택 범위 전체입니다. 표시 페이지·열과 무관하며 그룹·Role 소계를
        더하지 않습니다.
      </p>
      <div
        className="resource-dashboard-table-scroll"
        role="region"
        tabIndex={0}
        aria-label={`${mode === "group" ? "그룹" : "개인"} Milestone 비교표`}
      >
        <table
          className="resource-dashboard-matrix"
          style={{ minWidth: 264 + 144 * (visible.length + 1) }}
        >
          <thead>
            <tr>
              <th scope="col">{mode === "group" ? "그룹" : "개인"}</th>
              {visible.map((m) => (
                <th scope="col" key={m.id ?? "unassigned"}>
                  <span className="resource-milestone-identity" title={m.name}>
                    {m.name}
                  </span>
                  <small className="resource-dashboard-date">
                    {m.date ?? "예정일 없음"}
                  </small>
                </th>
              ))}
              <th scope="col">전체</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(rowOffset, rowOffset + 50).map((row) => (
              <tr key={row.id ?? "ungrouped"}>
                <th scope="row">
                  <span
                    className="resource-milestone-identity"
                    title={row.name}
                  >
                    {row.name}
                  </span>
                  <small>
                    {row.code}
                    {!row.active ? " · 비활성" : ""}
                  </small>
                </th>
                {visible.map((m) => (
                  <td key={m.id ?? "unassigned"}>
                    {render(
                      row.milestones.find((c) => c.milestoneTaskId === m.id)
                        ?.summary,
                      `${row.name} · ${m.name}`,
                    )}
                  </td>
                ))}
                <td>{render(row.summary, `${row.name} · 전체`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p>선택 범위에 행이 없습니다.</p> : null}
    </section>
  );
}
const TreeExpansion = createContext<{
  keys: Set<string>;
  admitted: Set<string>;
  count: number;
  register: (id: string, open: boolean) => void;
  pages: Map<string, number>;
  page: (id: string, value: number) => void;
  toggle: (id: string) => void;
} | null>(null);
export function ResourceMilestoneTree(
  props: Props & { order: "milestone" | "resource" },
) {
  const [keys, setKeys] = useState<Set<string>>(() => new Set()),
    [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => new Set()),
    [pages, setPages] = useState<Map<string, number>>(() => new Map());
  const register = useCallback(
    (id: string, open: boolean) =>
      setVisibleKeys((previous) => {
        const next = new Set(previous);
        if (open && next.size < 12) next.add(id);
        else if (!open) next.delete(id);
        return next;
      }),
    [],
  );
  const [offset, setOffset] = useState(0),
    rows = props.mode === "group" ? props.data.groups : props.data.resources;
  return (
    <TreeExpansion.Provider
      value={{
        keys,
        admitted: visibleKeys,
        count: visibleKeys.size,
        register,
        pages,
        page: (id, value) =>
          setPages((previous) => new Map(previous).set(id, value)),
        toggle: (id) =>
          setKeys((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else if (visibleKeys.size < 12) next.add(id);
            return next;
          }),
      }}
    >
      <section aria-label="Milestone 계층 현황">
        <p className="resource-dashboard-hint">
          현재 표시에서 최대 12개 계층을 펼칩니다. 페이지 밖 펼침과 페이지
          위치는 보존되며 집계 범위는 바뀌지 않습니다.
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setKeys(new Set())}
        >
          계층 모두 접기
        </button>
        <Pager
          label="상위 행"
          offset={offset}
          size={50}
          total={rows.length}
          onPage={setOffset}
          disabled={props.stale}
        />
        {rows.slice(offset, offset + 50).map((row) => (
          <TreeNode
            nodeKey={`${props.mode}:${props.order}:${row.id ?? "ungrouped"}`}
            key={row.id ?? "ungrouped"}
            label={row.name}
            stale={props.stale}
          >
            <SummaryLine summary={row.summary} label={row.name} {...props} />
            {props.mode === "group" && props.order === "resource" ? (
              <GroupChildren {...props} groupId={row.id} />
            ) : (
              <MilestoneNodes {...props} row={row} />
            )}
          </TreeNode>
        ))}
        {!rows.length ? <p>선택 범위에 행이 없습니다.</p> : null}
      </section>
    </TreeExpansion.Provider>
  );
}
function TreeNode({
  nodeKey,
  label,
  stale,
  children,
}: {
  nodeKey: string;
  label: string;
  stale: boolean;
  children: React.ReactNode;
}) {
  const id = useId(),
    state = useContext(TreeExpansion),
    requested = state?.keys.has(nodeKey) ?? false,
    expanded = requested && (state?.admitted.has(nodeKey) ?? false);
  const register = state?.register,
    count = state?.count ?? 0;
  useEffect(() => {
    if (!requested) return;
    register?.(nodeKey, true);
    return () => register?.(nodeKey, false);
  }, [requested, nodeKey, register]);
  useEffect(() => {
    if (requested && !expanded && count < 12) register?.(nodeKey, true);
  }, [requested, expanded, count, nodeKey, register]);
  return (
    <div className="resource-milestone-node">
      <button
        type="button"
        className="resource-dashboard-disclosure"
        disabled={stale || (!expanded && (state?.count ?? 0) >= 12)}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => state?.toggle(nodeKey)}
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        <span className="resource-milestone-identity" title={label}>
          {label}
        </span>
      </button>
      {expanded ? <div id={id}>{children}</div> : null}
    </div>
  );
}
function SummaryLine({
  summary: s,
  label,
  unit,
  stale,
  onOpen,
}: { summary: ResourceDashboardSummary; label: string } & Pick<
  Props,
  "unit" | "stale" | "onOpen"
>) {
  return (
    <div className="resource-milestone-summary">
      <button
        type="button"
        disabled={stale || !s.taskCount}
        onClick={(e) => onOpen(s, label, "tasks", e.currentTarget)}
      >
        {s.taskCount} Task
      </button>
      <span>
        완료 {s.completed} · 지연 {s.delayed} · 선택 할당 작업 진척{" "}
        {pct(s.assignedTaskProgress.percent)}
      </span>
      <button
        type="button"
        disabled={stale || !s.assignmentCount}
        onClick={(e) => onOpen(s, label, "assignments", e.currentTarget)}
      >
        {plannedEffort(s.effort, unit)}
      </button>
    </div>
  );
}
function MilestoneNodes(
  props: Props & { row: ResourceDashboardRow; order: "milestone" | "resource" },
) {
  const state = useContext(TreeExpansion),
    pageKey = `milestones:${props.row.summary.selector.dimension}:${props.row.summary.selector.id}:${props.row.summary.selector.resourceId ?? ""}`;
  const offset = state?.pages.get(pageKey) ?? 0,
    setOffset = (v: number) => state?.page(pageKey, v),
    stages = orderedMilestones(props.data);
  return (
    <>
      <Pager
        label="계층 단계"
        offset={offset}
        size={6}
        total={stages.length}
        onPage={setOffset}
        disabled={props.stale}
      />
      {stages.slice(offset, offset + 6).map((m) => {
        const cell = props.row.milestones.find(
            (c) => c.milestoneTaskId === m.id,
          ),
          stage = props.data.stages.find((s) => s.milestoneTaskId === m.id);
        return cell ? (
          <TreeNode
            nodeKey={`${props.row.summary.selector.dimension}:${props.row.summary.selector.id}:${props.row.summary.selector.resourceId ?? ""}:${m.id ?? "unassigned"}`}
            key={m.id ?? "unassigned"}
            label={m.name}
            stale={props.stale}
          >
            <SummaryLine
              summary={cell.summary}
              label={`${props.row.name} · ${m.name}`}
              {...props}
            />
            {stage ? (
              <p>
                단계 전체 소속 {stage.full.completedMemberCount}/
                {stage.full.memberCount} ·{" "}
                {stage.full.ready === null
                  ? "준비 판정 해당 없음"
                  : stage.full.ready
                    ? "준비 완료"
                    : "준비 전"}{" "}
                · 선행 차단 {stage.full.blocked ? "있음" : "없음"}
                {stage.full.manualEvent ? " · 수동 이벤트" : ""}
              </p>
            ) : null}
            {props.mode === "group" && props.order === "milestone" ? (
              <GroupChildren
                {...props}
                groupId={props.row.id}
                milestoneTaskId={m.id}
              />
            ) : null}
          </TreeNode>
        ) : (
          <p key={m.id ?? "unassigned"}>{m.name} · 대상 없음</p>
        );
      })}
    </>
  );
}
function GroupChildren(
  props: Props & {
    groupId: string | null;
    milestoneTaskId?: string | null;
    order: "milestone" | "resource";
  },
) {
  const { binding } = useResourceDrill();
  const tree = useContext(TreeExpansion),
    pageKey = `children:${props.groupId}:${props.milestoneTaskId === undefined ? "all" : (props.milestoneTaskId ?? "unassigned")}`;
  const offset = tree?.pages.get(pageKey) ?? 0,
    setOffset = (v: number) => tree?.page(pageKey, v);
  const [retry, setRetry] = useState(0),
    [value, setValue] = useState<ResourceDashboardGroupChildrenDto | null>(
      null,
    ),
    [error, setError] = useState("");
  const { data, groupId, milestoneTaskId, stale, active, onStale } = props;
  const generation = useRef(0),
    query = groupChildrenQuery(
      data,
      groupId,
      milestoneTaskId,
      offset,
    ).toString();
  useEffect(() => {
    if (stale || !active) return;
    const abort = new AbortController(),
      current = ++generation.current;
    let disposed = false;
    queueMicrotask(async () => {
      if (disposed) return;
      setValue(null);
      setError("");
      try {
        const response = await resourceProjectionFetch(
          binding,
          `/api/projects/${data.projectPublicId}/resource-dashboard/group-children?${query}`,
          { cache: "no-store", signal: abort.signal },
        );
        const body = await response.json();
        if (!response.ok) {
          if (
            response.status === 409 &&
            !disposed &&
            !abort.signal.aborted &&
            current === generation.current
          )
            onStale();
          throw Error(body?.error?.code ?? "REQUEST_FAILED");
        }
        const result = readGroupChildren(
          body,
          data,
          groupId,
          milestoneTaskId,
          offset,
        );
        if (!result) throw Error("INVALID_RESPONSE");
        if (!disposed && current === generation.current) setValue(result);
      } catch (e) {
        if (
          !disposed &&
          !abort.signal.aborted &&
          current === generation.current
        )
          setError(
            dashboardError(e instanceof Error ? e.message : "REQUEST_FAILED"),
          );
      }
    });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [
    query,
    data,
    groupId,
    milestoneTaskId,
    offset,
    stale,
    active,
    onStale,
    retry,
    binding,
  ]);
  return (
    <div aria-label="그룹 교차 개인 현황">
      {error ? (
        <p role="alert">
          {error}
          <button
            type="button"
            disabled={props.stale}
            onClick={() => setRetry((v) => v + 1)}
          >
            개인 다시 시도
          </button>
        </p>
      ) : !value ? (
        <p role="status">개인 조회 중…</p>
      ) : null}
      {value ? (
        <>
          <Pager
            label="그룹 개인"
            offset={offset}
            size={50}
            total={value.totalCount}
            onPage={setOffset}
            disabled={props.stale}
          />
          {value.rows.map((row) => (
            <TreeNode
              nodeKey={`group:${props.groupId}:${props.milestoneTaskId ?? "all"}:resource:${row.id}`}
              key={row.id}
              label={row.name}
              stale={props.stale}
            >
              <SummaryLine summary={row.summary} label={row.name} {...props} />
              {props.milestoneTaskId === undefined ? (
                <MilestoneNodes {...props} mode="resource" row={row} />
              ) : null}
            </TreeNode>
          ))}
          {!value.rows.length ? (
            <p>이 교차 범위에 개인 배정이 없습니다.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
