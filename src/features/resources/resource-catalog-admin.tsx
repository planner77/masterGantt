"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";

import type {
  ResourceCatalogResponse,
  ResourceDto,
  DeveloperGrade,
  ResourceGroupDto,
} from "@/contracts/resources";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { filterGroups, filterResources } from "./resource-search-filter";
import styles from "./resource-catalog-admin.module.css";

const DEVELOPER_GRADE_OPTIONS: Array<{ value: DeveloperGrade | ""; label: string }> = [
  { value: "", label: "미지정" },
  { value: "BEGINNER", label: "초급" },
  { value: "INTERMEDIATE", label: "중급" },
  { value: "ADVANCED", label: "고급" },
  { value: "EXPERT", label: "특급" },
];
function developerGradeLabel(value: DeveloperGrade | null | undefined): string {
  return DEVELOPER_GRADE_OPTIONS.find((option) => option.value === (value ?? ""))?.label ?? "등급 미지정";
}

function isCatalog(value: unknown): value is ResourceCatalogResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" && "revision" in data &&
    typeof data.revision === "number" && Number.isSafeInteger(data.revision) && data.revision >= 1 &&
    "resources" in data && Array.isArray(data.resources) &&
    "groups" in data && Array.isArray(data.groups) &&
    [...data.resources, ...data.groups].every((item) => item && typeof item === "object" &&
      typeof item.id === "string" && typeof item.name === "string" &&
      (item.code === null || typeof item.code === "string") && typeof item.active === "boolean" &&
      (!("developerGrade" in item) || item.developerGrade === null || ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"].includes(String(item.developerGrade))) &&
      (!("projectUsageCount" in item) || (typeof item.projectUsageCount === "number" && Number.isSafeInteger(item.projectUsageCount) && item.projectUsageCount >= 0)) &&
      (!("deletable" in item) || typeof item.deletable === "boolean")) &&
    data.groups.every((group) => Array.isArray(group.memberResourceIds) &&
      group.memberResourceIds.every((id: unknown) => typeof id === "string"));
}

function revisionTag(revision: number): string {
  return `"${revision}"`;
}

function apiErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  const apiError = value.error;
  if (!apiError || typeof apiError !== "object" || !("code" in apiError)) return null;
  return typeof apiError.code === "string" ? apiError.code : null;
}

function projectUsageReason(target: ResourceDto | ResourceGroupDto): string {
  if (typeof target.projectUsageCount === "number") {
    return target.projectUsageCount > 0
      ? `${target.projectUsageCount}개 프로젝트에서 사용 중`
      : "프로젝트에서 사용하지 않음";
  }
  return "프로젝트 사용 여부 확인 필요";
}

type PendingDeleteTarget = Readonly<{
  kind: "resource" | "group";
  id: string;
  name: string;
}>;

export function ResourceCatalogAdmin() {
  const [catalog, setCatalog] = useState<ResourceCatalogResponse | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("error");
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const loginInput = useRef<HTMLInputElement | null>(null);
  const restoreLoginFocus = useRef(false);
  const [password, setPassword] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const changePasswordTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const resourceSearchRef = useRef<HTMLInputElement>(null);
  const groupSearchRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteTarget | null>(null);
  const [resourceName, setResourceName] = useState("");
  const [resourceCode, setResourceCode] = useState("");
  const [resourceDeveloperGrade, setResourceDeveloperGrade] = useState<DeveloperGrade | "">("");
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedGroupSnapshot, setSelectedGroupSnapshot] = useState<ResourceGroupDto | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [resourceQuery, setResourceQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!authenticated && !busy && restoreLoginFocus.current) {
      loginInput.current?.focus();
      restoreLoginFocus.current = false;
    }
  }, [authenticated, busy]);

  function clearPasswords() {
    setPassword(""); setNewAdminPassword(""); setConfirmAdminPassword("");
  }

  function expireSession() {
    restoreLoginFocus.current = true;
    setAuthenticated(false);
    setCatalogState("error");
    clearPasswords();
    setError("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  function beginRequest() {
    if (pending.current) return null;
    pending.current = true;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null); setNotice(null);
    return controller;
  }

  function finishRequest(controller: AbortController) {
    if (controller.signal.aborted) return;
    pending.current = false;
    setBusy(false);
  }

  async function loadCatalog(controller: AbortController): Promise<boolean> {
    setCatalogState("loading");
    try {
      const response = await fetch("/api/resources", {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return false;
      if (response.status === 401) { expireSession(); return false; }
      if (!response.ok || !isCatalog(body)) {
        setCatalogState("error");
        setError("최신 목록을 확인하지 못했습니다. 목록을 다시 불러온 후 변경해 주세요.");
        return false;
      }
      setCatalog(body);
      setCatalogState("ready");
      return true;
    } catch {
      if (!controller.signal.aborted) {
        setCatalogState("error");
        setError("목록에 연결할 수 없습니다. 다시 시도해 주세요.");
      }
      return false;
    }
  }

  async function refreshCatalog() {
    if (!authenticated) return;
    const controller = beginRequest();
    if (!controller) return;
    try { await loadCatalog(controller); }
    finally { finishRequest(controller); }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const controller = beginRequest();
    if (!controller) return;
    const submittedPassword = password;
    setPassword("");
    try {
      const response = await fetch("/api/resource-catalog/admin-sessions", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: submittedPassword }),
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setError("리소스 관리자 인증에 실패했습니다. 비밀번호와 서버 설정을 확인해 주세요.");
        return;
      }
      setAuthenticated(true);
      await loadCatalog(controller);
    } catch {
      if (!controller.signal.aborted) setError("리소스 카탈로그에 연결할 수 없습니다.");
    } finally {
      setPassword("");
      finishRequest(controller);
    }
  }

  async function mutate(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<boolean> {
    if (!authenticated || !catalog || catalogState !== "ready") return false;
    const controller = beginRequest();
    if (!controller) return false;
    try {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          "If-Match": revisionTag(catalog.data.revision),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const value: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return false;
      if (response.status === 401) {
        expireSession();
        return false;
      }
      if (response.status === 412) {
        if (method === "DELETE") setPendingDelete(null);
        const latest = await loadCatalog(controller);
        if (latest) setError("다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 불러왔습니다. 초안을 확인한 후 다시 저장해 주세요.");
        return false;
      }
      const errorCode = apiErrorCode(value);
      if (response.status === 409 && (errorCode === "RESOURCE_IN_USE" || errorCode === "RESOURCE_GROUP_IN_USE")) {
        if (method === "DELETE") setPendingDelete(null);
        const latest = await loadCatalog(controller);
        if (latest) setError("프로젝트에서 사용 중인 항목은 삭제할 수 없습니다. 최신 사용 상태를 불러왔습니다.");
        return false;
      }
      if (!response.ok || !isCatalog(value)) {
        if (response.ok || response.status >= 500) {
          setCatalogState("error");
          setError("저장 결과를 확인하지 못했습니다. 목록을 다시 확인한 후 저장해 주세요.");
        } else {
          setError("변경사항을 저장하지 못했습니다. 입력값과 중복 코드를 확인해 주세요.");
        }
        return false;
      }
      setCatalog(value);
      setCatalogState("ready");
      setNotice("변경사항을 저장했습니다.");
      return true;
    } catch {
      if (!controller.signal.aborted) {
        setCatalogState("error");
        setError("변경 결과를 확인할 수 없습니다. 목록을 다시 확인한 후 저장해 주세요.");
      }
      return false;
    } finally {
      finishRequest(controller);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authenticated || pending.current) return;
    const length = Array.from(newAdminPassword).length;
    if (length < 1 || length > 12 || newAdminPassword !== confirmAdminPassword) {
      setNotice(null);
      setDialogError("새 관리자 비밀번호는 1~12자이며 확인 값이 일치해야 합니다.");
      return;
    }
    setDialogError(null);
    const controller = beginRequest();
    if (!controller) return;
    const body = { newPassword: newAdminPassword, confirmPassword: confirmAdminPassword };
    setNewAdminPassword(""); setConfirmAdminPassword("");
    try {
      const response = await fetch("/api/resource-catalog/admin-password", {
        method: "PUT", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        setPasswordDialogOpen(false);
        expireSession();
        return;
      }
      if (!response.ok) {
        setDialogError("관리자 비밀번호를 변경하지 못했습니다.");
        return;
      }
      setPasswordDialogOpen(false);
      setNotice("관리자 비밀번호를 변경했습니다.");
    } catch {
      if (!controller.signal.aborted) setDialogError("비밀번호 변경 결과를 확인할 수 없습니다.");
    } finally {
      setNewAdminPassword(""); setConfirmAdminPassword("");
      finishRequest(controller);
    }
  }

  async function addResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = resourceName.trim();
    const code = resourceCode.trim();
    if (!name) return;
    if (await mutate("/api/resources", "POST", { name, code: code || null, developerGrade: resourceDeveloperGrade || null })) {
      setResourceName(""); setResourceCode(""); setResourceDeveloperGrade("");
    }
  }

  async function addGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();
    const code = groupCode.trim();
    if (!name) return;
    if (await mutate("/api/resource-groups", "POST", { name, code: code || null })) {
      setGroupName(""); setGroupCode("");
    }
  }

  function requestDelete(
    kind: "resource" | "group",
    target: ResourceDto | ResourceGroupDto,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    if (target.deletable !== true || pending.current || catalogState !== "ready") return;
    deleteTriggerRef.current = event.currentTarget;
    setPendingDelete({ kind, id: target.id, name: target.name });
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    const successful = await mutate(
      target.kind === "resource"
        ? `/api/resources/${encodeURIComponent(target.id)}`
        : `/api/resource-groups/${encodeURIComponent(target.id)}`,
      "DELETE",
    );
    if (!successful) return;

    if (target.kind === "resource") {
      setSelectedMembers((current) => {
        if (!current.has(target.id)) return current;
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
      setSelectedGroupSnapshot((current) => current ? {
        ...current,
        memberResourceIds: current.memberResourceIds.filter((resourceId) => resourceId !== target.id),
      } : current);
    } else if (selectedGroupId === target.id) {
      setSelectedGroupId("");
      setSelectedGroupSnapshot(null);
      setSelectedMembers(new Set());
      setMemberQuery("");
    }
    setPendingDelete(null);
    setNotice(target.kind === "resource" ? "리소스를 삭제했습니다." : "리소스 그룹을 삭제했습니다.");
    window.setTimeout(() => {
      (target.kind === "resource" ? resourceSearchRef.current : groupSearchRef.current)?.focus({ preventScroll: true });
    }, 0);
  }

  function selectGroup(group: ResourceGroupDto) {
    if (pending.current || catalogState !== "ready") return;
    setSelectedGroupId(group.id);
    setSelectedGroupSnapshot(group);
    setSelectedMembers(new Set(group.memberResourceIds));
    setMemberQuery("");
  }

  async function saveMembers() {
    if (!selectedGroupId || !catalog?.data.groups.some((group) => group.id === selectedGroupId)) return;
    await mutate(`/api/resource-groups/${encodeURIComponent(selectedGroupId)}/members`, "PUT", {
      resourceIds: [...selectedMembers],
    });
  }

  function toggleMember(id: string) {
    if (pending.current || catalogState !== "ready") return;
    setSelectedMembers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function logout() {
    const controller = beginRequest();
    if (!controller) return;
    try {
      const response = await fetch("/api/resource-catalog/admin-sessions", {
        method: "DELETE", credentials: "same-origin", signal: controller.signal,
      });
      if (!response.ok) setError("서버 로그아웃을 확인하지 못했습니다. 관리 화면을 잠갔습니다.");
    } catch {
      if (!controller.signal.aborted) setError("서버 로그아웃을 확인하지 못했습니다. 관리 화면을 잠갔습니다.");
    } finally {
      if (!controller.signal.aborted) {
        setAuthenticated(false); setCatalogState("error"); clearPasswords();
        setCatalog(null); setSelectedGroupId(""); setSelectedGroupSnapshot(null);
        setSelectedMembers(new Set()); finishRequest(controller);
      }
    }
  }

  if (!authenticated) {
    return <form className={styles.login} onSubmit={(event) => void login(event)}>
      <h2>관리자 로그인</h2>
      <p className={styles.note}>프로젝트 편집 비밀번호와 별도의 글로벌 리소스 관리자 권한이 필요합니다.</p>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <label className={styles.field}>관리자 비밀번호
        <input ref={loginInput} type="password" autoComplete="current-password" value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <div className={styles.actions}><button className="primary-button" type="submit" disabled={busy || password.length < 1}>{busy ? "확인 중…" : "로그인"}</button></div>
    </form>;
  }

  if (!catalog) {
    return <div className={styles.panel}>
      {catalogState === "loading" ? <p className={styles.note} role="status">최신 목록을 불러오는 중…</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.actions}>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void refreshCatalog()}>다시 시도</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void logout()}>로그아웃</button>
      </div>
    </div>;
  }

  const currentGroup = catalog.data.groups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedGroup = currentGroup ?? selectedGroupSnapshot;
  const membersDiffer = currentGroup && (currentGroup.memberResourceIds.length !== selectedMembers.size ||
    currentGroup.memberResourceIds.some((id) => !selectedMembers.has(id)));
  const locked = busy || catalogState !== "ready";
  const filteredResources = filterResources(catalog.data.resources, resourceQuery);
  const filteredGroups = filterGroups(catalog.data.groups, groupQuery);
  const filteredMemberResources = filterResources(catalog.data.resources, memberQuery);

  return <div className={styles.panel}>
    <div className={styles.toolbar}>
      <div className={styles.adminActionRow}>
        <button
          ref={changePasswordTriggerRef}
          className="secondary-button"
          type="button"
          disabled={busy}
          onClick={() => { setPasswordDialogOpen(true); setDialogError(null); }}
        >
          관리자 비밀번호 변경
        </button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void refreshCatalog()}>{catalogState === "error" ? "다시 시도" : "새로고침"}</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void logout()}>로그아웃</button>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.note} role="status">{notice}</p> : null}
      {catalogState !== "ready" ? <p className={styles.note} role="status">{catalogState === "loading" ? "최신 목록을 불러오는 중… 이전 조회 결과를 표시합니다." : "이전 조회 결과입니다. 최신 목록을 확인하기 전에는 변경할 수 없습니다."}</p> : null}
    </div>

    <div className={styles.columns}>
      <section className={styles.card} aria-labelledby="resources-title">
        <h2 id="resources-title">리소스</h2>
        <div className={styles.searchBar}>
          <input
            ref={resourceSearchRef}
            placeholder="리소스 검색 (이름 또는 코드)"
            value={resourceQuery}
            disabled={busy}
            onChange={(event) => setResourceQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape") setResourceQuery(""); }}
            aria-label="리소스 검색"
          />
          <span className={styles.matchCount} role="status" aria-live="polite" aria-atomic="true">
            일치 {filteredResources.length} / 전체 {catalog.data.resources.length}
          </span>
        </div>
        <form className={`${styles.formRow} ${styles.resourceCreateForm}`} onSubmit={(event) => void addResource(event)}>
          <label>이름<input value={resourceName} maxLength={200} disabled={locked} onChange={(event) => setResourceName(event.target.value)} /></label>
          <label>코드<input value={resourceCode} maxLength={64} disabled={locked} onChange={(event) => setResourceCode(event.target.value)} /></label>
          <label>개발자 등급<select aria-label="신규 리소스 개발자 등급" value={resourceDeveloperGrade} disabled={locked} onChange={(event) => setResourceDeveloperGrade(event.target.value as DeveloperGrade | "")}>{DEVELOPER_GRADE_OPTIONS.map((option) => <option key={option.value || "unset"} value={option.value}>{option.label}</option>)}</select></label>
          <button className="primary-button" type="submit" disabled={locked || !resourceName.trim()}>추가</button>
        </form>
        {catalog.data.resources.length === 0 ? (
          <p className={styles.emptyState}>등록된 리소스가 없습니다.</p>
        ) : filteredResources.length === 0 ? (
          <p className={styles.emptyState}>검색 조건과 일치하는 리소스가 없습니다.</p>
        ) : (
          <ul className={styles.list}>
            {filteredResources.map((resource: ResourceDto) => {
              const usageId = `resource-usage-${resource.id}`;
              return <li key={resource.id} className={`${styles.item} ${resource.active ? "" : styles.inactive}`}>
                <div>
                  <strong>{resource.name}</strong>
                  <div className={styles.meta}>
                    <span>{resource.code ?? "코드 없음"}</span>
                    <span>개발자 등급: {developerGradeLabel(resource.developerGrade)}</span>
                    <span className={styles.badge}>{resource.active ? "활성" : "비활성"}</span>
                    <span id={usageId} className={styles.usageNote}>{projectUsageReason(resource)}</span>
                  </div>
                </div>
                <div className={styles.resourceActions}>
                  <label className={styles.inlineGradeLabel}>개발자 등급<select aria-label={`${resource.name} 개발자 등급`} value={resource.developerGrade ?? ""} disabled={locked} onChange={(event) => void mutate(`/api/resources/${encodeURIComponent(resource.id)}`, "PATCH", { developerGrade: event.target.value || null })}>{DEVELOPER_GRADE_OPTIONS.map((option) => <option key={option.value || "unset"} value={option.value}>{option.label}</option>)}</select></label>
                  <button className="secondary-button" type="button" disabled={locked} onClick={() => void mutate(`/api/resources/${encodeURIComponent(resource.id)}`, "PATCH", { active: !resource.active })}>{resource.active ? "비활성화" : "재활성화"}</button>
                  {resource.deletable === true
                    ? <button className="danger-button" type="button" disabled={locked} aria-describedby={usageId} aria-label={`${resource.name} 삭제`} onClick={(event) => requestDelete("resource", resource, event)}>삭제</button>
                    : <button className="secondary-button" type="button" disabled={locked} aria-disabled="true" aria-describedby={usageId} aria-label={`${resource.name} 삭제 불가`}>삭제 불가</button>}
                </div>
              </li>;
            })}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="groups-title">
        <h2 id="groups-title">리소스 그룹</h2>
        <div className={styles.searchBar}>
          <input
            ref={groupSearchRef}
            placeholder="리소스 그룹 검색 (이름 또는 코드)"
            value={groupQuery}
            disabled={busy}
            onChange={(event) => setGroupQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape") setGroupQuery(""); }}
            aria-label="리소스 그룹 검색"
          />
          <span className={styles.matchCount} role="status" aria-live="polite" aria-atomic="true">
            일치 {filteredGroups.length} / 전체 {catalog.data.groups.length}
          </span>
        </div>
        <form className={`${styles.formRow} ${styles.groupCreateForm}`} onSubmit={(event) => void addGroup(event)}>
          <label>이름<input value={groupName} maxLength={200} disabled={locked} onChange={(event) => setGroupName(event.target.value)} /></label>
          <label>코드<input value={groupCode} maxLength={64} disabled={locked} onChange={(event) => setGroupCode(event.target.value)} /></label>
          <button className="primary-button" type="submit" disabled={locked || !groupName.trim()}>추가</button>
        </form>
        {catalog.data.groups.length === 0 ? (
          <p className={styles.emptyState}>등록된 리소스 그룹이 없습니다.</p>
        ) : filteredGroups.length === 0 ? (
          <p className={styles.emptyState}>검색 조건과 일치하는 리소스 그룹이 없습니다.</p>
        ) : (
          <ul className={styles.list}>
            {filteredGroups.map((group: ResourceGroupDto) => {
              const usageId = `group-usage-${group.id}`;
              return <li key={group.id} className={`${styles.item} ${group.active ? "" : styles.inactive}`}>
                <div>
                  <strong>{group.name}</strong>
                  <div className={styles.meta}>
                    <span>{group.code ?? "코드 없음"}</span>
                    <span>구성원 {group.memberResourceIds.length}명</span>
                    <span className={styles.badge}>{group.active ? "활성" : "비활성"}</span>
                    <span id={usageId} className={styles.usageNote}>{projectUsageReason(group)}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className="secondary-button" type="button" disabled={locked} onClick={() => selectGroup(group)}>구성원</button>
                  <button className="secondary-button" type="button" disabled={locked} onClick={() => void mutate(`/api/resource-groups/${encodeURIComponent(group.id)}`, "PATCH", { active: !group.active })}>{group.active ? "비활성화" : "재활성화"}</button>
                  {group.deletable === true
                    ? <button className="danger-button" type="button" disabled={locked} aria-describedby={usageId} aria-label={`${group.name} 삭제`} onClick={(event) => requestDelete("group", group, event)}>삭제</button>
                    : <button className="secondary-button" type="button" disabled={locked} aria-disabled="true" aria-describedby={usageId} aria-label={`${group.name} 삭제 불가`}>삭제 불가</button>}
                </div>
              </li>;
            })}
          </ul>
        )}
      </section>
    </div>

    {selectedGroup ? <section className={styles.members} aria-labelledby="members-title">
      <h2 id="members-title">{selectedGroup.name} 구성원</h2>
      {!currentGroup ? <p className={styles.error} role="alert">선택한 그룹이 최신 목록에 없습니다. 구성원 초안을 보존했으며 저장할 수 없습니다.</p> : null}
      {membersDiffer ? <p className={styles.note}>저장된 구성원과 현재 선택이 다릅니다. 목록을 확인한 후 구성원을 저장해 주세요.</p> : null}
      <p className={styles.note}>그룹 구성원은 팀 목록이며, 작업의 그룹 할당을 개인 할당으로 자동 복제하지 않습니다.</p>
      <div className={styles.searchBar}>
        <input
          placeholder="구성원 리소스 검색 (이름 또는 코드)"
          value={memberQuery}
          disabled={busy}
          onChange={(event) => setMemberQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") setMemberQuery(""); }}
          aria-label={`${selectedGroup.name} 구성원 리소스 검색`}
        />
        <span className={styles.matchCount} role="status" aria-live="polite" aria-atomic="true">
          일치 {filteredMemberResources.length} / 전체 {catalog.data.resources.length} · 선택 {selectedMembers.size}
        </span>
      </div>
      {catalog.data.resources.length === 0 ? (
        <p className={styles.emptyState}>등록된 리소스가 없습니다.</p>
      ) : filteredMemberResources.length === 0 ? (
        <p className={styles.emptyState}>검색 조건과 일치하는 리소스가 없습니다.</p>
      ) : (
        <div className={styles.memberGrid}>
          {filteredMemberResources.map((resource) => <label key={resource.id} className={`${styles.member} ${resource.active ? "" : styles.inactive}`}><input type="checkbox" checked={selectedMembers.has(resource.id)} disabled={locked || !currentGroup} onChange={() => toggleMember(resource.id)} />{resource.name}{resource.code ? ` (${resource.code})` : ""}</label>)}
        </div>
      )}
      <div className={styles.memberFooterActions}>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => { setSelectedGroupId(""); setSelectedGroupSnapshot(null); setSelectedMembers(new Set()); setMemberQuery(""); }}>닫기</button>
        <button className="primary-button" type="button" disabled={locked || !currentGroup} onClick={() => void saveMembers()}>구성원 저장</button>
      </div>
    </section> : null}
    {pendingDelete ? (
      <WorkspaceDialog
        title={pendingDelete.kind === "resource" ? "리소스 삭제" : "리소스 그룹 삭제"}
        restoreFocusRef={deleteTriggerRef}
        busy={busy}
        feedback={false}
        onClose={() => { if (!busy) setPendingDelete(null); }}
      >
        <p className={styles.note}><strong>{pendingDelete.name}</strong> 항목을 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
        {pendingDelete.kind === "group"
          ? <p className={styles.note}>그룹만 삭제되며 소속 리소스는 삭제되지 않습니다.</p>
          : null}
        <div className={styles.dialogActions}>
          <button autoFocus className="secondary-button" type="button" disabled={busy} onClick={() => setPendingDelete(null)}>취소</button>
          <button className="danger-button" type="button" disabled={busy} onClick={() => void confirmDelete()}>{busy ? "삭제 중…" : "영구 삭제"}</button>
        </div>
      </WorkspaceDialog>
    ) : null}
    {passwordDialogOpen ? (
      <WorkspaceDialog
        title="관리자 비밀번호 변경"
        restoreFocusRef={changePasswordTriggerRef}
        busy={busy}
        onClose={() => {
          if (!busy) {
            setPasswordDialogOpen(false);
            setNewAdminPassword("");
            setConfirmAdminPassword("");
            setDialogError(null);
          }
        }}
      >
        <form className="project-form compact-form" noValidate onSubmit={(event) => void changePassword(event)}>
          <p className={styles.note}>현재 관리자 권한이 있는 세션에서만 변경할 수 있습니다. 새 비밀번호는 1~12자입니다.</p>
          {dialogError ? <p className={styles.error} role="alert">{dialogError}</p> : null}
          <div className="form-field">
            <label htmlFor="modal-new-admin-password">새 비밀번호</label>
            <input id="modal-new-admin-password" type="password" autoComplete="new-password" minLength={1} value={newAdminPassword} disabled={busy} onChange={(event) => setNewAdminPassword(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="modal-confirm-admin-password">새 비밀번호 확인</label>
            <input id="modal-confirm-admin-password" type="password" autoComplete="new-password" minLength={1} value={confirmAdminPassword} disabled={busy} onChange={(event) => setConfirmAdminPassword(event.target.value)} />
          </div>
          <div className={styles.dialogActions}>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => {
              setPasswordDialogOpen(false);
              setNewAdminPassword("");
              setConfirmAdminPassword("");
              setDialogError(null);
            }}>취소</button>
            <button className="primary-button" type="submit" disabled={busy || !newAdminPassword || newAdminPassword !== confirmAdminPassword}>
              {busy ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        </form>
      </WorkspaceDialog>
    ) : null}
  </div>;
}
