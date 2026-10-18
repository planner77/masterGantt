"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ProjectResourceMembershipDto as Resource, ProjectResourceMembershipResponse as MembershipResponse } from "@/contracts/project-resource-memberships";
import type { AssignedTargetsResponse, ProjectAssignmentDto } from "@/contracts/resources";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { emptyMembershipFilters, membershipError, membershipGrades, membershipQuery, membershipRoles, type MembershipFilters } from "./project-resource-memberships-model";
import styles from "./project-resource-memberships.module.css";

type Props = { publicId: string; revision: number; active: boolean; editable: boolean; disabled: boolean; recoveryRequired?: boolean; onChanged: () => Promise<boolean>; onUnauthorized: () => void; onOpenAssignment: (taskId: string, assignmentId: string, resourceId: string, trigger: HTMLElement) => void; taskNames: ReadonlyMap<string, string> };
function validResponse(value: unknown): value is MembershipResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data as MembershipResponse["data"] | null;
  return !!data && Number.isSafeInteger(data.projectRevision) && Number.isSafeInteger(data.catalogRevision) && Number.isSafeInteger(data.total) && !!data.counts && Array.isArray(data.resources) && data.resources.every(row => typeof row.id === "string" && typeof row.name === "string" && Array.isArray(row.groups) && Array.isArray(row.roles) && !!row.usage && !!row.sources && typeof row.registered === "boolean");
}
function Filters({ value, onChange, groups, prefix, disabled = false }: { disabled?: boolean; value: MembershipFilters; onChange: (value: MembershipFilters) => void; groups: Map<string, string>; prefix: string }) {
  const update = (key: keyof MembershipFilters, next: string) => onChange({ ...value, [key]: next });
  return <fieldset className={styles.filterFields} disabled={disabled}><div className={styles.filters}><label>{prefix} 이름 검색<input type="search" value={value.q} maxLength={200} placeholder="이름 또는 코드" onChange={event => update("q", event.target.value)} /></label></div>
    <details className={styles.advanced}><summary>필터</summary><div className={styles.filters}>
      <label>전역 역할<select value={value.role} onChange={event => update("role", event.target.value)}><option value="">전체</option>{membershipRoles.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>개발자 등급<select value={value.grade} onChange={event => update("grade", event.target.value)}><option value="">전체</option>{membershipGrades.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Group<select value={value.groupId} onChange={event => update("groupId", event.target.value)}><option value="">전체</option>{[...groups].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>등록 상태<select value={value.registration} onChange={event => update("registration", event.target.value)}><option value="">전체</option><option value="registered">등록됨</option><option value="unregistered">등록 필요</option></select></label>
      <label>사용 상태<select value={value.usage} onChange={event => update("usage", event.target.value)}><option value="">전체</option><option value="unassigned">사용 없음 (등록만 포함)</option><option value="assigned">작업 배정됨</option><option value="roleOnly">책임 역할만 있음</option></select></label>
      <label>활성 상태<select value={value.active} onChange={event => update("active", event.target.value)}><option value="">전체</option><option value="true">활성</option><option value="false">비활성</option></select></label>
      <button type="button" className="secondary-button" onClick={() => onChange({ ...emptyMembershipFilters })}>필터 해제</button>
    </div></details></fieldset>;
}
function ResourceCells({ resource }: { resource: Resource }) {
  return <><td><strong>{resource.name}</strong>{resource.code ? <div className={styles.metadata}>{resource.code}</div> : null}{!resource.active ? <span className={styles.badge}>비활성</span> : null}</td>
    <td><div className={styles.badges}>{resource.roles.length ? resource.roles.map(role => <span className={styles.badge} key={role}>{membershipRoles.find(item => item.value === role)?.label ?? role}</span>) : "역할 미지정"}</div><div className={styles.metadata}>{membershipGrades.find(item => item.value === resource.developerGrade)?.label ?? "등급 미지정"}</div></td>
    <td>{resource.groups.length ? resource.groups.map(group => <div key={group.id}>{group.name}{!group.active ? " (비활성)" : ""}</div>) : "Group 없음"}</td>
    <td><div>{resource.registered ? "등록됨" : "등록 필요"}</div><div className={styles.metadata}>{resource.usage.taskAssignments ? `작업 배정 ${resource.usage.taskAssignments}건` : "작업 미배정"}{resource.usage.responsibilityAssignments ? ` · Summary·Milestone 책임 참조 ${resource.usage.responsibilityAssignments}건` : ""}{resource.usage.equipmentRoles ? ` · 설비 담당 ${resource.usage.equipmentRoles}건` : ""}{resource.usage.systemRoles ? ` · 시스템 책임 역할 ${resource.usage.systemRoles}건` : ""}</div></td></>;
}
function ResourceTable({ resources, children }: { resources: Resource[]; children: (row: Resource) => ReactNode }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="프로젝트 리소스 목록, 가로 스크롤 가능"><table className={styles.table}><thead><tr><th scope="col">이름</th><th scope="col">전역 역할 / 등급</th><th scope="col">Group</th><th scope="col">등록 / 프로젝트 사용</th><th scope="col">동작</th></tr></thead><tbody>{resources.map(row => <tr key={row.id}><ResourceCells resource={row} /><td>{children(row)}</td></tr>)}</tbody></table></div>;
}

export function ProjectResourceMemberships(props: Props) {
  const { publicId, revision, active, editable, disabled, recoveryRequired } = props;
  const endpoint = `/api/projects/${encodeURIComponent(publicId)}/resource-memberships`;
  const [data, setData] = useState<MembershipResponse["data"] | null>(null);
  const [catalog, setCatalog] = useState<MembershipResponse["data"] | null>(null);
  const [filters, setFilters] = useState({ ...emptyMembershipFilters });
  const [catalogFilters, setCatalogFilters] = useState({ ...emptyMembershipFilters });
  const [offset, setOffset] = useState(0);
  const [catalogOffset, setCatalogOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [selection, setSelection] = useState<Resource | null>(null);
  const [discard, setDiscard] = useState(false);
  const [remove, setRemove] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [assignmentResource, setAssignmentResource] = useState<Resource | null>(null);
  const [assignments, setAssignments] = useState<ProjectAssignmentDto[] | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const registerTrigger = useRef<HTMLButtonElement>(null);
  const refreshTrigger = useRef<HTMLButtonElement>(null);
  const mutationPending = useRef(false);
  const writeRecoveryRequired = useRef(false);
  const restoreAfterMutation = useRef(false);
  useEffect(() => { if (!busy && restoreAfterMutation.current) { restoreAfterMutation.current = false; const target = trigger.current?.isConnected ? trigger.current : registerTrigger.current; (target?.matches(":disabled") ? refreshTrigger.current : target)?.focus({ preventScroll: true }); } }, [busy]);
  const selectionRevision = useRef<{ project: number; catalog: number } | null>(null);
  const groups = useRef(new Map<string, string>());
  const [groupOptions, setGroupOptions] = useState(new Map<string, string>());

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const scope = dialog ? "catalog" : "project";
    const setPending = dialog ? setCatalogLoading : setLoading;
    const setFailure = dialog ? setCatalogError : setError;
    const timer = setTimeout(() => {
      setPending(true); if (dialog || !recoveryRequired) setFailure(null);
      void (async () => {
        try {
          const response = await fetch(`${endpoint}?${membershipQuery(scope, dialog ? catalogFilters : filters, dialog ? catalogOffset : offset)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
          const body: unknown = await response.json().catch(() => null);
          if (controller.signal.aborted) return;
          if (!response.ok || !validResponse(body)) { setFailure(membershipError(response.status)); return; }
          groups.current = new Map((body.data.groups ?? []).map(group => [group.id, group.name]));
          setGroupOptions(new Map(groups.current));
          if (dialog) setCatalog(body.data); else setData(body.data);
          setStale(body.data.projectRevision !== revision || writeRecoveryRequired.current);
        } catch { if (!controller.signal.aborted) setFailure(membershipError(0)); }
        finally { if (!controller.signal.aborted) setPending(false); }
      })();
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [active, endpoint, revision, filters, offset, dialog, catalogFilters, catalogOffset, reload, recoveryRequired]);

  useEffect(() => {
    if (!assignmentResource) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/assigned-targets`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body = await response.json() as AssignedTargetsResponse;
        if (controller.signal.aborted) return;
        if (!response.ok || body.data.projectRevision !== revision || !Array.isArray(body.data.assignments)) { setAssignmentError("작업 배정이 변경되었습니다. 최신 상태를 조회한 뒤 다시 열어 주세요."); return; }
        setAssignments(body.data.assignments.filter(item => item.target.kind === "resource" && item.target.id === assignmentResource.id));
      } catch { if (!controller.signal.aborted) setAssignmentError("작업 배정을 불러오지 못했습니다. 닫고 다시 시도해 주세요."); }
    })();
    return () => controller.abort();
  }, [assignmentResource, publicId, revision]);

  function closeRegistration() { if (busy) return; if (selection) setDiscard(true); else setDialog(false); }
  async function mutate(resource: Resource, registered: boolean) {
    const source = registered ? catalog : data;
    if (mutationPending.current || !editable || disabled || stale || !source) return;
    if (registered && selectionRevision.current && (source.projectRevision !== selectionRevision.current.project || source.catalogRevision !== selectionRevision.current.catalog)) { setStale(true); setCatalogError("선택 이후 원본이 변경되었습니다. 최신 목록을 불러온 뒤 다시 선택해 주세요."); return; }
    mutationPending.current = true; setBusy(true); setError(null); setCatalogError(null); setNotice(null);
    try {
      const response = await fetch(registered ? endpoint : `${endpoint}/${encodeURIComponent(resource.id)}`, { method: registered ? "POST" : "DELETE", credentials: "same-origin", headers: { "If-Match": `"${source.projectRevision}"`, ...(registered ? { "Content-Type": "application/json" } : {}) }, ...(registered ? { body: JSON.stringify({ resourceId: resource.id, catalogRevision: source.catalogRevision }) } : {}) });
      const body = await response.json().catch(() => null);
      if (!response.ok || !validResponse(body)) {
        const message = membershipError(response.status, body?.error?.code);
        (registered ? setCatalogError : setError)(message);
        if (response.status === 401) props.onUnauthorized();
        if ([409, 412].includes(response.status) || response.status >= 500 || response.ok) { writeRecoveryRequired.current = true; setStale(true); }
        return;
      }
      restoreAfterMutation.current = true;
      setData(body.data); setSelection(null); setDialog(false); setRemove(null);
      const canonical = await props.onChanged();
      if (!canonical) { writeRecoveryRequired.current = true; setStale(true); setError("등록 변경은 저장되었지만 프로젝트 최신 상태를 확인하지 못했습니다. 최신 상태를 조회해 주세요."); }
      else setNotice(`${resource.name} ${registered ? "등록" : "등록 해제"} 완료`);
      setReload(value => value + 1);
    } catch { writeRecoveryRequired.current = true; setStale(true); (registered ? setCatalogError : setError)("저장 결과를 확인하지 못했습니다. 적용되었을 수 있으므로 최신 상태를 조회한 뒤 다시 검토해 주세요."); }
    finally { mutationPending.current = false; setBusy(false); }
  }
  const refresh = async () => { setSelection(null); setStale(true); if (await props.onChanged()) { writeRecoveryRequired.current = false; setReload(value => value + 1); } else setError("프로젝트 최신 상태를 확인하지 못했습니다. 다시 시도해 주세요."); };
  const disabledMutation = !editable || disabled || busy || stale;
  const projectRows = data?.resources ?? [];
  return <div className={styles.panel} aria-busy={loading || busy}>
    <div className={styles.heading}><div><h2>프로젝트 리소스</h2><p className={styles.description}>등록은 작업 배정이나 편집 권한을 부여하지 않습니다. 작업 배정은 수행 계획이며 실적이 아닙니다.</p></div><div className={styles.toolbar}><button className="primary-button" ref={registerTrigger} type="button" disabled={disabledMutation} onClick={() => { trigger.current = registerTrigger.current; setSelection(null); setCatalogFilters({ ...emptyMembershipFilters }); setCatalogOffset(0); setDialog(true); }}>리소스 등록</button><button ref={refreshTrigger} className="secondary-button" type="button" disabled={busy || (disabled && !props.recoveryRequired) || loading} onClick={() => void refresh()}>최신 상태 조회</button><a href="/resources" target="_blank" rel="noreferrer">공용 리소스 관리 (별도 관리자)</a></div></div>
    {!editable ? <p className={styles.notice}>읽기 전용입니다. 등록·해제하려면 프로젝트 편집 잠금을 해제해 주세요.</p> : null}
    <div className={styles.counts} aria-label="프로젝트 전체 인원"><span>등록 {data?.counts.registered ?? "—"}명</span><span>작업 배정 {data?.counts.assigned ?? "—"}명</span><span>책임 역할만 {data?.counts.roleOnly ?? "—"}명</span><span>비활성 {data?.counts.inactive ?? "—"}명</span></div>
    <Filters disabled={busy} prefix="프로젝트 리소스" value={filters} groups={groupOptions} onChange={value => { setFilters(value); setOffset(0); }} />
    {stale ? <p className={styles.notice}>프로젝트 최신 상태를 조회한 뒤 변경할 수 있습니다.</p> : null}
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}{error ? <p role="alert" className={styles.notice}>{error}</p> : null}
    {loading ? <p role="status">리소스를 불러오는 중…</p> : null}
    {!loading && !error && data ? <><p className={styles.metadata}>필터 결과 {data.total}명 · {offset + (projectRows.length ? 1 : 0)}–{offset + projectRows.length}명 표시</p>{!projectRows.length ? <p className={styles.notice}>등록되었거나 작업 배정·책임 역할에서 사용 중인 리소스가 없습니다. 필터를 해제하거나 기존 공용 리소스를 등록해 주세요.</p> : <ResourceTable resources={projectRows}>{row => <>{(row.usage.taskAssignments > 0 || row.usage.responsibilityAssignments > 0) ? <button className="secondary-button" type="button" disabled={busy || disabled} onClick={event => { trigger.current = event.currentTarget; setAssignments(null); setAssignmentError(null); setAssignmentResource(row); }}>배정 보기</button> : null}{row.registered ? <><button type="button" className="secondary-button" disabled={disabledMutation || Object.values(row.usage).some(count => count > 0)} onClick={event => { trigger.current = event.currentTarget; setRemove(row); }}>등록 해제</button>{Object.values(row.usage).some(count => count > 0) ? <div className={styles.metadata}>사용 중: 배정·책임 역할을 먼저 정리해 주세요.</div> : null}</> : <button type="button" disabled={disabledMutation || !row.active} onClick={event => { trigger.current = event.currentTarget; setSelection(row); selectionRevision.current = data ? { project: data.projectRevision, catalog: data.catalogRevision } : null; setDialog(true); }}>등록 검토</button>}</>}</ResourceTable>}<Pagination offset={offset} total={data.total} disabled={busy} onChange={setOffset} /></> : null}
    {dialog ? <WorkspaceDialog title="프로젝트 리소스 등록" size="wide" onClose={closeRegistration} busy={busy} restoreFocusRef={trigger}><div className={styles.dialogBody} aria-busy={catalogLoading || busy}><p>공용 리소스를 선택해 이 프로젝트에 등록합니다. 작업 배정·공수·편집 권한은 추가하지 않습니다.</p><Filters disabled={busy} prefix="공용 리소스" value={catalogFilters} groups={groupOptions} onChange={value => { setCatalogFilters(value); setCatalogOffset(0); }} />{catalogError ? <p role="alert" className={styles.notice}>{catalogError}</p> : null}{stale ? <button type="button" className="secondary-button" disabled={busy} onClick={() => void refresh()}>최신 목록 다시 불러오기</button> : null}{catalogLoading ? <p role="status">공용 리소스를 불러오는 중…</p> : null}{!catalogLoading && !catalogError && catalog ? <><p className={styles.metadata}>검색 결과 {catalog.total}명</p>{catalog.resources.length ? <ResourceTable resources={catalog.resources}>{row => <label><input type="radio" name="project-resource-selection" checked={selection?.id === row.id} disabled={busy || !row.active || row.registered || stale} onChange={() => { setSelection(row); selectionRevision.current = { project: catalog.projectRevision, catalog: catalog.catalogRevision }; }} /> {row.registered ? "이미 등록됨" : !row.active ? "비활성: 등록 불가" : "선택"}</label>}</ResourceTable> : <p className={styles.notice}>조건에 맞는 공용 리소스가 없습니다. 필터를 해제하거나 공용 리소스 관리에서 원본을 확인해 주세요.</p>}<Pagination offset={catalogOffset} total={catalog.total} disabled={busy} onChange={setCatalogOffset} /></> : null}<div className={styles.selection}><span>{selection ? `선택: ${selection.name}` : "등록할 리소스를 선택해 주세요."}</span><button className="primary-button" type="button" disabled={disabledMutation || !selection || catalogLoading || !!catalogError} onClick={() => selection && void mutate(selection, true)}>{busy ? "등록 중…" : "선택 리소스 등록"}</button></div></div></WorkspaceDialog> : null}
    {discard ? <WorkspaceDialog title="리소스 선택 취소" onClose={() => setDiscard(false)}><p>선택한 리소스를 등록하지 않고 닫으시겠습니까?</p><div className={styles.toolbar}><button type="button" className="secondary-button" onClick={() => setDiscard(false)}>계속 선택</button><button type="button" onClick={() => { setDiscard(false); setSelection(null); setDialog(false); }}>선택 버리고 닫기</button></div></WorkspaceDialog> : null}
    {remove ? <WorkspaceDialog title="프로젝트 리소스 등록 해제" busy={busy} restoreFocusRef={trigger} onClose={() => setRemove(null)}><p>{remove.name}의 프로젝트 등록을 해제하시겠습니까? 공용 리소스 원본과 과거 배정은 삭제하지 않습니다.</p>{error ? <p role="alert">{error}</p> : null}<button className="primary-button" type="button" disabled={disabledMutation} onClick={() => void mutate(remove, false)}>등록 해제 확인</button></WorkspaceDialog> : null}
    {assignmentResource ? <WorkspaceDialog title={`${assignmentResource.name} 작업 배정`} restoreFocusRef={trigger} onClose={() => setAssignmentResource(null)}>{assignmentError ? <p role="alert">{assignmentError}</p> : assignments ? assignments.length ? assignments.map(item => <p key={item.id}><button className="secondary-button" type="button" disabled={disabled || !editable} onClick={() => { const origin = trigger.current ?? registerTrigger.current; setAssignmentResource(null); if (origin) props.onOpenAssignment(item.taskId, item.id, assignmentResource.id, origin); }}>{props.taskNames.get(item.taskId) ?? "작업"} 배정 편집</button>{!editable ? " (읽기 전용)" : ""}</p>) : <p>개인 작업 배정이 없습니다.</p> : <p role="status">작업 배정을 불러오는 중…</p>}</WorkspaceDialog> : null}
  </div>;
}
function Pagination({ offset, total, disabled, onChange }: { offset: number; total: number; disabled: boolean; onChange: (offset: number) => void }) { return <div className={styles.pagination}><button type="button" className="secondary-button" disabled={disabled || offset === 0} onClick={() => onChange(Math.max(0, offset - 50))}>이전 50명</button><button type="button" className="secondary-button" disabled={disabled || offset + 50 >= total} onClick={() => onChange(offset + 50)}>다음 50명</button></div>; }
