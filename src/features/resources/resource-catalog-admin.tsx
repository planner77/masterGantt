"use client";

import { useState, type FormEvent } from "react";

import type {
  ResourceCatalogResponse,
  ResourceDto,
  ResourceGroupDto,
} from "@/contracts/resources";
import styles from "./resource-catalog-admin.module.css";

function isCatalog(value: unknown): value is ResourceCatalogResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" && "revision" in data &&
    typeof data.revision === "number" && "resources" in data && Array.isArray(data.resources) &&
    "groups" in data && Array.isArray(data.groups);
}

function revisionTag(revision: number): string {
  return `"${revision}"`;
}

export function ResourceCatalogAdmin() {
  const [catalog, setCatalog] = useState<ResourceCatalogResponse | null>(null);
  const [password, setPassword] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [resourceCode, setResourceCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCatalog(): Promise<ResourceCatalogResponse | null> {
    const response = await fetch("/api/resources", { credentials: "same-origin", cache: "no-store" });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isCatalog(body)) return null;
    setCatalog(body);
    return body;
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/resource-catalog/admin-sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      if (!response.ok || !(await loadCatalog())) {
        setError("리소스 관리자 인증에 실패했습니다. 비밀번호와 서버 설정을 확인해 주세요.");
      }
    } catch {
      setError("리소스 카탈로그에 연결할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function mutate(url: string, method: "POST" | "PATCH" | "PUT", body: unknown) {
    if (!catalog || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": revisionTag(catalog.data.revision),
        },
        body: JSON.stringify(body),
      });
      const value: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        setCatalog(null);
        setError("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (response.status === 412) {
        const latest = await loadCatalog();
        setError(latest ? "다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 다시 불러왔습니다." : "목록이 변경되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (!response.ok || !isCatalog(value)) {
        setError("변경사항을 저장하지 못했습니다. 입력값과 중복 코드를 확인해 주세요.");
        return;
      }
      setCatalog(value);
    } catch {
      setError("변경 결과를 확인할 수 없습니다. 목록을 다시 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const length = Array.from(newAdminPassword).length;
    if (length < 1 || length > 12 || newAdminPassword !== confirmAdminPassword) {
      setError("새 관리자 비밀번호는 1~12자이며 확인 값이 일치해야 합니다.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/resource-catalog/admin-password", {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newAdminPassword, confirmPassword: confirmAdminPassword }),
      });
      setNewAdminPassword(""); setConfirmAdminPassword("");
      if (response.status === 401) { setCatalog(null); setError("관리자 세션이 만료되었습니다. 다시 로그인해 주세요."); return; }
      if (!response.ok) { setError("관리자 비밀번호를 변경하지 못했습니다."); return; }
      setError("관리자 비밀번호를 변경했습니다.");
    } catch {
      setError("비밀번호 변경 결과를 확인할 수 없습니다.");
    } finally { setBusy(false); }
  }

  async function addResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = resourceName.trim();
    const code = resourceCode.trim();
    if (!name) return;
    await mutate("/api/resources", "POST", { name, code: code || null });
    setResourceName(""); setResourceCode("");
  }

  async function addGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();
    const code = groupCode.trim();
    if (!name) return;
    await mutate("/api/resource-groups", "POST", { name, code: code || null });
    setGroupName(""); setGroupCode("");
  }

  function selectGroup(group: ResourceGroupDto) {
    setSelectedGroupId(group.id);
    setSelectedMembers(new Set(group.memberResourceIds));
  }

  async function saveMembers() {
    if (!selectedGroupId) return;
    await mutate(`/api/resource-groups/${encodeURIComponent(selectedGroupId)}/members`, "PUT", {
      resourceIds: [...selectedMembers],
    });
  }

  function toggleMember(id: string) {
    setSelectedMembers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function logout() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await fetch("/api/resource-catalog/admin-sessions", { method: "DELETE", credentials: "same-origin" });
    } finally {
      setCatalog(null); setSelectedGroupId(""); setSelectedMembers(new Set()); setBusy(false);
    }
  }

  if (!catalog) {
    return <form className={styles.login} onSubmit={(event) => void login(event)}>
      <h2>관리자 로그인</h2>
      <p className={styles.note}>프로젝트 편집 비밀번호와 별도의 글로벌 리소스 관리자 권한이 필요합니다.</p>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <label className={styles.field}>관리자 비밀번호
        <input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <div className={styles.actions}><button className="primary-button" type="submit" disabled={busy || password.length < 1}>{busy ? "확인 중…" : "로그인"}</button></div>
    </form>;
  }

  const selectedGroup = catalog.data.groups.find((group) => group.id === selectedGroupId) ?? null;

  return <div className={styles.panel}>
    <div className={styles.toolbar}>
      <div className={styles.actions}>
        <strong>Catalog Revision {catalog.data.revision}</strong>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void loadCatalog()}>새로고침</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void logout()}>로그아웃</button>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>

    <section className={styles.card} aria-labelledby="admin-password-title">
      <h2 id="admin-password-title">관리자 비밀번호 변경</h2>
      <p className={styles.note}>현재 관리자 권한이 있는 세션에서만 변경할 수 있습니다. 새 비밀번호는 1~12자입니다.</p>
      <form className={styles.formRow} onSubmit={(event) => void changePassword(event)}>
        <label>새 비밀번호<input type="password" autoComplete="new-password" minLength={1} maxLength={12} value={newAdminPassword} disabled={busy} onChange={(event) => setNewAdminPassword(event.target.value)} /></label>
        <label>새 비밀번호 확인<input type="password" autoComplete="new-password" minLength={1} maxLength={12} value={confirmAdminPassword} disabled={busy} onChange={(event) => setConfirmAdminPassword(event.target.value)} /></label>
        <button className="primary-button" type="submit" disabled={busy || !newAdminPassword || newAdminPassword !== confirmAdminPassword}>비밀번호 변경</button>
      </form>
    </section>

    <div className={styles.columns}>
      <section className={styles.card} aria-labelledby="resources-title">
        <h2 id="resources-title">리소스</h2>
        <form className={styles.formRow} onSubmit={(event) => void addResource(event)}>
          <label>이름<input value={resourceName} maxLength={200} disabled={busy} onChange={(event) => setResourceName(event.target.value)} /></label>
          <label>코드<input value={resourceCode} maxLength={64} disabled={busy} onChange={(event) => setResourceCode(event.target.value)} /></label>
          <button className="primary-button" type="submit" disabled={busy || !resourceName.trim()}>추가</button>
        </form>
        <ul className={styles.list}>
          {catalog.data.resources.map((resource: ResourceDto) => <li key={resource.id} className={`${styles.item} ${resource.active ? "" : styles.inactive}`}>
            <div><strong>{resource.name}</strong><div className={styles.meta}><span>{resource.code ?? "코드 없음"}</span><span className={styles.badge}>{resource.active ? "활성" : "비활성"}</span></div></div>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void mutate(`/api/resources/${encodeURIComponent(resource.id)}`, "PATCH", { active: !resource.active })}>{resource.active ? "비활성화" : "재활성화"}</button>
          </li>)}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="groups-title">
        <h2 id="groups-title">리소스 그룹</h2>
        <form className={styles.formRow} onSubmit={(event) => void addGroup(event)}>
          <label>이름<input value={groupName} maxLength={200} disabled={busy} onChange={(event) => setGroupName(event.target.value)} /></label>
          <label>코드<input value={groupCode} maxLength={64} disabled={busy} onChange={(event) => setGroupCode(event.target.value)} /></label>
          <button className="primary-button" type="submit" disabled={busy || !groupName.trim()}>추가</button>
        </form>
        <ul className={styles.list}>
          {catalog.data.groups.map((group: ResourceGroupDto) => <li key={group.id} className={`${styles.item} ${group.active ? "" : styles.inactive}`}>
            <div><strong>{group.name}</strong><div className={styles.meta}><span>{group.code ?? "코드 없음"}</span><span>구성원 {group.memberResourceIds.length}명</span><span className={styles.badge}>{group.active ? "활성" : "비활성"}</span></div></div>
            <div className={styles.actions}><button className="secondary-button" type="button" disabled={busy} onClick={() => selectGroup(group)}>구성원</button><button className="secondary-button" type="button" disabled={busy} onClick={() => void mutate(`/api/resource-groups/${encodeURIComponent(group.id)}`, "PATCH", { active: !group.active })}>{group.active ? "비활성화" : "재활성화"}</button></div>
          </li>)}
        </ul>
      </section>
    </div>

    {selectedGroup ? <section className={styles.members} aria-labelledby="members-title">
      <h2 id="members-title">{selectedGroup.name} 구성원</h2>
      <p className={styles.note}>그룹 구성원은 팀 목록이며, 작업의 그룹 할당을 개인 할당으로 자동 복제하지 않습니다.</p>
      <div className={styles.memberGrid}>
        {catalog.data.resources.map((resource) => <label key={resource.id} className={`${styles.member} ${resource.active ? "" : styles.inactive}`}><input type="checkbox" checked={selectedMembers.has(resource.id)} disabled={busy} onChange={() => toggleMember(resource.id)} />{resource.name}{resource.code ? ` (${resource.code})` : ""}</label>)}
      </div>
      <div className={styles.actions}><button className="primary-button" type="button" disabled={busy} onClick={() => void saveMembers()}>구성원 저장</button><button className="secondary-button" type="button" disabled={busy} onClick={() => { setSelectedGroupId(""); setSelectedMembers(new Set()); }}>닫기</button></div>
    </section> : null}
  </div>;
}
