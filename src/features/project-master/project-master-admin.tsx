"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type {
  ProjectMasterAdminResponse,
  ProjectMasterCategory,
  ProjectMasterItemDto,
} from "@/contracts/project-master";
import { AdminAuth, adminAuthStyles } from "@/components/admin-auth";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import styles from "./project-master-admin.module.css";

const CATEGORIES: Array<{ value: ProjectMasterCategory; label: string }> = [
  { value: "BUSINESS_UNIT", label: "사업부" },
  { value: "PRODUCT", label: "제품" },
  { value: "SITE_ENTITY", label: "사업장/법인" },
];

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
];

function isAdminCatalog(value: unknown): value is ProjectMasterAdminResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" &&
    "revision" in data && typeof data.revision === "number" &&
    "items" in data && Array.isArray(data.items);
}

function revisionTag(revision: number): string { return `"${revision}"`; }

export function ProjectMasterAdmin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [catalog, setCatalog] = useState<ProjectMasterAdminResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("error");
  const [category, setCategory] = useState<ProjectMasterCategory>("BUSINESS_UNIT");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; code: string; sortOrder: number }>>({});
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordTrigger = useRef<HTMLButtonElement>(null);
  const loginInput = useRef<HTMLInputElement>(null);
  const categoryTabs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authenticated && !busy) loginInput.current?.focus();
  }, [authenticated, busy]);

  function applyCatalog(next: ProjectMasterAdminResponse) {
    setCatalog(next);
    setState("ready");
    setDrafts(Object.fromEntries(next.data.items.map((item) => [item.id, {
      name: item.name, code: item.code, sortOrder: item.sortOrder,
    }])));
  }

  async function loadCatalog(): Promise<boolean> {
    setState("loading");
    try {
      const response = await fetch("/api/project-master/admin/items", { credentials: "same-origin", cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        setAuthenticated(false); setCatalog(null); setState("error");
        setError("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return false;
      }
      if (!response.ok || !isAdminCatalog(body)) {
        setState("error"); setError("최신 기준정보를 불러오지 못했습니다.");
        return false;
      }
      applyCatalog(body);
      return true;
    } catch {
      setState("error"); setError("기준정보 서버에 연결할 수 없습니다.");
      return false;
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    const candidate = password; setPassword(""); setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/project-master/admin-sessions", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: candidate }),
      });
      if (!response.ok) { setError("프로젝트 기준정보 관리자 인증에 실패했습니다."); return; }
      setAuthenticated(true);
      await loadCatalog();
    } catch { setError("관리자 인증 서버에 연결할 수 없습니다."); }
    finally { setPassword(""); setBusy(false); }
  }

  async function mutate(url: string, method: "POST" | "PATCH", body: unknown): Promise<boolean> {
    if (!catalog || state !== "ready" || busy) return false;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(url, {
        method, credentials: "same-origin",
        headers: { "Content-Type": "application/json", "If-Match": revisionTag(catalog.data.revision) },
        body: JSON.stringify(body),
      });
      const value: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        setAuthenticated(false); setCatalog(null); setState("error");
        setError("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return false;
      }
      if (response.status === 412) {
        await loadCatalog();
        setError("다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 확인한 후 다시 저장해 주세요.");
        return false;
      }
      if (!response.ok || !isAdminCatalog(value)) {
        setError(response.status === 409
          ? "사용 중인 기준정보의 안정 코드(code)는 변경할 수 없습니다."
          : "변경사항을 저장하지 못했습니다. 입력값과 중복 코드를 확인해 주세요.");
        return false;
      }
      applyCatalog(value); setNotice("변경사항을 저장했습니다.");
      return true;
    } catch {
      setState("error"); setError("저장 결과를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.");
      return false;
    } finally { setBusy(false); }
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !code.trim()) return;
    if (await mutate("/api/project-master/admin/items", "POST", {
      category, name: name.trim(), code: code.trim(), sortOrder,
    })) {
      setName(""); setCode(""); setSortOrder(0);
    }
  }

  async function saveItem(item: ProjectMasterItemDto) {
    const draft = drafts[item.id];
    if (!draft) return;
    await mutate(`/api/project-master/admin/items/${encodeURIComponent(item.id)}`, "PATCH", draft);
  }

  async function toggleItem(item: ProjectMasterItemDto) {
    await mutate(`/api/project-master/admin/items/${encodeURIComponent(item.id)}`, "PATCH", { active: !item.active });
  }

  async function logout() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await fetch("/api/project-master/admin-sessions", { method: "DELETE", credentials: "same-origin" });
    } finally {
      setAuthenticated(false); setCatalog(null); setState("error"); setBusy(false); setPassword("");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!newPassword || newPassword !== confirmPassword || Array.from(newPassword).length > 12) {
      setError("새 관리자 비밀번호는 1~12자이며 확인 값이 일치해야 합니다.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/project-master/admin-password", {
        method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      if (!response.ok) { setError("관리자 비밀번호를 변경하지 못했습니다."); return; }
      setPasswordOpen(false); setNotice("관리자 비밀번호를 변경했습니다.");
    } catch { setError("비밀번호 변경 결과를 확인할 수 없습니다."); }
    finally { setNewPassword(""); setConfirmPassword(""); setBusy(false); }
  }

  function handleCategoryKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target = -1;
    if (event.key === "ArrowRight") target = (index + 1) % CATEGORIES.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = CATEGORIES.length - 1;
    if (target < 0) return;
    event.preventDefault();
    const next = CATEGORIES[target];
    if (!next) return;
    setCategory(next.value);
    categoryTabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
  }

  const categoryLabel = CATEGORIES.find((entry) => entry.value === category)?.label ?? "";
  const categoryItems = useMemo(
    () => catalog?.data.items.filter((item) => item.category === category) ?? [],
    [catalog, category],
  );
  const items = useMemo(
    () => categoryItems.filter((item) => {
      if (statusFilter === "active") return item.active;
      if (statusFilter === "inactive") return !item.active;
      return true;
    }),
    [categoryItems, statusFilter],
  );
  const emptyMessage = categoryItems.length === 0
    ? "등록된 항목이 없습니다."
    : statusFilter === "active"
      ? "활성 상태의 항목이 없습니다."
      : statusFilter === "inactive"
        ? "비활성 상태의 항목이 없습니다."
        : "등록된 항목이 없습니다.";

  if (!authenticated) return (
    <AdminAuth title="프로젝트 기준정보 관리자 로그인" titleId="project-master-auth-title"
      description="프로젝트 편집 비밀번호와 별도의 글로벌 기준정보 관리자 권한이 필요합니다.">
      <form className={adminAuthStyles.form} onSubmit={(event) => void login(event)}>
        {error ? <p id="project-master-login-error" className={adminAuthStyles.error} role="alert">{error}</p> : null}
        <div className={adminAuthStyles.controls}>
          <label className={adminAuthStyles.field}>관리자 비밀번호
            <input ref={loginInput} type="password" autoComplete="current-password" value={password} disabled={busy}
              aria-describedby={error ? "project-master-login-error" : undefined} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className={`primary-button ${adminAuthStyles.submit}`} disabled={busy || !password} type="submit">{busy ? "확인 중…" : "로그인"}</button>
        </div>
      </form>
    </AdminAuth>
  );

  return <div className={styles.panel}>
    <section className={styles.sessionSection} aria-labelledby="project-master-session-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>관리자 인증</p>
        <h2 id="project-master-session-title">프로젝트 기준정보 관리자 인증됨</h2>
        <p className={styles.note}>전 프로젝트 공통 기준정보를 편집할 수 있습니다.</p>
      </div>
      <div className={styles.actions}>
        <button ref={passwordTrigger} className="secondary-button" type="button" disabled={busy}
          onClick={() => setPasswordOpen(true)}>관리자 비밀번호 변경</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void loadCatalog()}>새로고침</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void logout()}>로그아웃</button>
      </div>
    </section>

    <div className={styles.feedback} aria-live="polite">
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.note} role="status">{notice}</p> : null}
      {state !== "ready" ? <p className={styles.note} role="status">{state === "loading" ? "최신 기준정보를 불러오는 중…" : "최신 목록 확인 전에는 변경할 수 없습니다."}</p> : null}
    </div>

    <section className={styles.catalogSection} aria-labelledby="project-master-catalog-title">
      <div className={styles.catalogHeader}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>기준정보 관리</p>
          <h2 id="project-master-catalog-title">프로젝트 기준정보</h2>
          <p className={styles.note}>관리할 범주를 선택한 뒤 항목을 추가하거나 목록에서 수정합니다.</p>
        </div>
        <div ref={categoryTabs} className={styles.tabs} role="tablist" aria-label="프로젝트 기준정보 범주">
          {CATEGORIES.map((entry, index) => {
            const selected = category === entry.value;
            return <button
              key={entry.value}
              id={`project-master-tab-${entry.value.toLowerCase()}`}
              type="button"
              role="tab"
              className={`secondary-button ${styles.tab}`}
              aria-selected={selected}
              aria-controls="project-master-category-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setCategory(entry.value)}
              onKeyDown={(event) => handleCategoryKeyDown(event, index)}
            >{entry.label}</button>;
          })}
        </div>
      </div>

      <div
        id="project-master-category-panel"
        className={styles.categoryPanel}
        role="tabpanel"
        aria-labelledby={`project-master-tab-${category.toLowerCase()}`}
      >
        <h2 className={styles.categoryTitle}>{categoryLabel}</h2>

        <section className={styles.editorSection} aria-labelledby="project-master-editor-title">
          <div className={styles.subsectionHeading}>
            <h3 id="project-master-editor-title">항목 추가</h3>
            <p className={styles.note}>이름, 안정 코드, 정렬 순서를 입력합니다.</p>
          </div>
          <form className={styles.formGrid} onSubmit={(event) => void addItem(event)}>
            <label className={styles.field}>이름<input maxLength={200} disabled={busy || state !== "ready"} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className={styles.field}>코드<input maxLength={64} disabled={busy || state !== "ready"} value={code} onChange={(event) => setCode(event.target.value)} /></label>
            <label className={styles.field}>정렬<input min={0} max={1000000} type="number" disabled={busy || state !== "ready"} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></label>
            <button className="primary-button" type="submit" disabled={busy || state !== "ready" || !name.trim() || !code.trim()}>항목 추가</button>
          </form>
        </section>

        <section className={styles.listSection} aria-labelledby="project-master-list-title">
          <div className={styles.listToolbar}>
            <div className={styles.subsectionHeading}>
              <h3 id="project-master-list-title">{categoryLabel} 목록</h3>
              <p className={styles.note}>전체 {categoryItems.length}건 · 표시 {items.length}건</p>
            </div>
            <div className={styles.statusFilters} role="group" aria-label={`${categoryLabel} 상태 필터`}>
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  className={`secondary-button ${styles.statusFilterButton}`}
                  type="button"
                  aria-pressed={statusFilter === filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <p className={styles.empty} role="status">{emptyMessage}</p>
          ) : (
            <div className={styles.tableScroll} data-testid="project-master-table-scroll">
              <table className={styles.table} aria-label={`${categoryLabel} 기준정보 목록`}>
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">코드</th>
                    <th scope="col">정렬</th>
                    <th scope="col">상태 / 사용</th>
                    <th scope="col">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const draft = drafts[item.id] ?? { name: item.name, code: item.code, sortOrder: item.sortOrder };
                    return <tr key={item.id} className={item.active ? undefined : styles.inactive}>
                      <td>
                        <input aria-label={`${item.name} 이름`} value={draft.name} disabled={busy}
                          onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, name: event.target.value } }))} />
                      </td>
                      <td>
                        <input aria-label={`${item.name} 코드`} value={draft.code} disabled={busy || (item.usageCount ?? 0) > 0}
                          title={(item.usageCount ?? 0) > 0 ? "사용 중인 안정 코드는 변경할 수 없습니다." : undefined}
                          onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, code: event.target.value } }))} />
                      </td>
                      <td className={styles.sortCell}>
                        <input aria-label={`${item.name} 정렬 순서`} type="number" min={0} value={draft.sortOrder} disabled={busy}
                          onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, sortOrder: Number(event.target.value) } }))} />
                      </td>
                      <td>
                        <div className={styles.statusMeta}>
                          <span className={`${styles.statusBadge} ${item.active ? styles.statusActive : styles.statusInactive}`}>
                            {item.active ? "활성" : "비활성"}
                          </span>
                          <span className={styles.usage}>사용 프로젝트 {item.usageCount ?? 0}</span>
                        </div>
                      </td>
                      <td>
                        <div className={`${styles.actions} ${styles.itemActions}`}>
                          <button className="secondary-button" type="button" disabled={busy || state !== "ready"} onClick={() => void saveItem(item)}>저장</button>
                          <button className="secondary-button" type="button" disabled={busy || state !== "ready"} onClick={() => void toggleItem(item)}>{item.active ? "비활성화" : "재활성화"}</button>
                        </div>
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>

    {passwordOpen ? <WorkspaceDialog title="프로젝트 기준정보 관리자 비밀번호 변경" restoreFocusRef={passwordTrigger} busy={busy}
      onClose={() => { if (!busy) { setPasswordOpen(false); setNewPassword(""); setConfirmPassword(""); } }}>
      <form className="project-form compact-form" onSubmit={(event) => void changePassword(event)}>
        <div className="form-field"><label htmlFor="project-master-new-password">새 비밀번호</label>
          <input id="project-master-new-password" type="password" autoComplete="new-password" value={newPassword} disabled={busy} onChange={(event) => setNewPassword(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="project-master-confirm-password">새 비밀번호 확인</label>
          <input id="project-master-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} disabled={busy} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setPasswordOpen(false)}>취소</button>
          <button className="primary-button" type="submit" disabled={busy || !newPassword || newPassword !== confirmPassword}>비밀번호 변경</button>
        </div>
      </form>
    </WorkspaceDialog> : null}
  </div>;
}
