"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { EmptyProjects } from "@/components/empty-projects";
import { ProjectLinkButton } from "@/components/project-link-button";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import type { CopyProjectResponse, ProjectListItemDto } from "@/contracts/projects";
import { browserLocales, browserTimeZone, formatLocaleDateTime, SSR_DATE_LOCALE, SSR_TIME_ZONE, type DisplayLocales } from "@/lib/date-display";
import styles from "./project-list.module.css";

function subscribeToLocaleChanges(): () => void { return () => {}; }
function projectPath(publicId: string): string { return `/projects/${encodeURIComponent(publicId)}`; }
type DeleteTarget = { publicId: string; name: string; revision: number };
type CopyTarget = DeleteTarget & { description: string; tasks: number; links: number; holidays: number; authorized: boolean };

async function readCurrentProject(publicId: string): Promise<{ target: DeleteTarget; description: string; tasks: number; links: number; holidays: number } | null> {
  const response = await fetch(`/api${projectPath(publicId)}`, { cache: "no-store", credentials: "same-origin" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) return null;
  const data = body.data;
  if (typeof data !== "object" || data === null || !("project" in data) || !("tasks" in data) || !("links" in data)) return null;
  const project = data.project;
  if (typeof project !== "object" || project === null || !("name" in project) || typeof project.name !== "string" || !("description" in project) || typeof project.description !== "string" || !("revision" in project) || typeof project.revision !== "number" || !Number.isSafeInteger(project.revision) || !("calendar" in project) || typeof project.calendar !== "object" || project.calendar === null || !("holidays" in project.calendar) || !Array.isArray(project.calendar.holidays) || !Array.isArray(data.tasks) || !Array.isArray(data.links)) return null;
  return { target: { publicId, name: project.name, revision: project.revision }, description: project.description, tasks: data.tasks.length, links: data.links.length, holidays: project.calendar.holidays.length };
}

function validPassword(value: string): boolean { return Array.from(value).length >= 12 && new TextEncoder().encode(value).byteLength <= 1024; }
function suggestedCopyName(name: string): string { const suffix = " (복사본)"; const available = Math.max(1, 200 - Array.from(suffix).length); return `${Array.from(name).slice(0, available).join("")}${suffix}`; }

export function ProjectList({ projects, projectUrls = {} }: Readonly<{ projects: readonly ProjectListItemDto[]; projectUrls?: Readonly<Record<string, string | null>> }>) {
  const router = useRouter();
  const { notify, clearToast } = useWorkspaceNotifications();
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [deletingId, setDeletingId] = useState<string>();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyTarget, setCopyTarget] = useState<CopyTarget | null>(null);
  const [copyName, setCopyName] = useState("");
  const [copyDescription, setCopyDescription] = useState("");
  const [sourcePassword, setSourcePassword] = useState("");
  const [copyPassword, setCopyPassword] = useState("");
  const [copyPasswordConfirm, setCopyPasswordConfirm] = useState("");
  const [resetProgress, setResetProgress] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const mutation = useRef(false);
  const deleteTrigger = useRef<HTMLElement | null>(null);
  const copyTrigger = useRef<HTMLElement | null>(null);
  const locales = useSyncExternalStore<DisplayLocales>(subscribeToLocaleChanges, browserLocales, () => SSR_DATE_LOCALE);
  const timeZone = useSyncExternalStore(subscribeToLocaleChanges, browserTimeZone, () => SSR_TIME_ZONE);
  const visibleProjects = useMemo(() => projects.filter(({ publicId }) => !deletedIds.has(publicId)), [deletedIds, projects]);

  function reportDeleteError(message: string, body?: unknown) { setDeleteError(message); notify("error", message, "프로젝트 삭제", body); }
  function closeDelete() { if (mutation.current) return; setTarget(null); setPassword(""); setDeleteError(null); }
  function closeCopy() { if (mutation.current) return; setCopyTarget(null); setSourcePassword(""); setCopyPassword(""); setCopyPasswordConfirm(""); setCopyError(null); setResetProgress(false); }

  async function prepareDelete(project: ProjectListItemDto, trigger: HTMLButtonElement) {
    if (mutation.current) return;
    deleteTrigger.current = trigger; mutation.current = true; setDeletingId(project.publicId); clearToast(); setDeleteError(null); setPassword("");
    try { const current = await readCurrentProject(project.publicId); if (!current) reportDeleteError("프로젝트 정보를 다시 읽지 못했습니다. 목록을 새로고침해 주세요."); else setTarget(current.target); }
    catch { reportDeleteError("네트워크 연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { mutation.current = false; setDeletingId(undefined); }
  }

  async function prepareCopy(project: ProjectListItemDto, trigger: HTMLButtonElement) {
    if (mutation.current) return;
    copyTrigger.current = trigger; mutation.current = true; clearToast(); setCopyError(null);
    try {
      const current = await readCurrentProject(project.publicId);
      if (!current) { notify("error", "복사할 프로젝트의 최신 정보를 읽지 못했습니다.", "프로젝트 복사"); return; }
      const permissionResponse = await fetch(`/api${projectPath(project.publicId)}/edit-sessions/current`, { cache: "no-store", credentials: "same-origin" });
      const permissionBody: unknown = await permissionResponse.json().catch(() => null);
      const authorized = permissionResponse.ok && typeof permissionBody === "object" && permissionBody !== null && "data" in permissionBody && typeof permissionBody.data === "object" && permissionBody.data !== null && "permission" in permissionBody.data && permissionBody.data.permission === "edit";
      setCopyTarget({ ...current.target, description: current.description, tasks: current.tasks, links: current.links, holidays: current.holidays, authorized });
      setCopyName(suggestedCopyName(current.target.name)); setCopyDescription(current.description); setSourcePassword(""); setCopyPassword(""); setCopyPasswordConfirm(""); setResetProgress(false);
    } catch { notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "프로젝트 복사"); }
    finally { mutation.current = false; }
  }

  async function copyProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!copyTarget || mutation.current) return;
    const name = copyName.trim();
    if (!name || Array.from(name).length > 200) { setCopyError("새 프로젝트명은 1~200자로 입력해 주세요."); return; }
    if (Array.from(copyDescription).length > 4000) { setCopyError("설명은 4,000자 이하여야 합니다."); return; }
    if (!validPassword(copyPassword) || copyPassword !== copyPasswordConfirm) { setCopyError("새 편집 비밀번호는 12자 이상이어야 하며 확인 값과 일치해야 합니다."); return; }
    if (!copyTarget.authorized && !validPassword(sourcePassword)) { setCopyError("원본 프로젝트의 편집 비밀번호를 입력해 주세요."); return; }
    mutation.current = true; setCopying(true); setCopyError(null); clearToast();
    try {
      if (!copyTarget.authorized) {
        const unlock = await fetch(`/api${projectPath(copyTarget.publicId)}/edit-sessions`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editPassword: sourcePassword }) });
        if (unlock.status !== 204) { const body: unknown = await unlock.json().catch(() => null); setCopyError(unlock.status === 401 ? "원본 프로젝트 편집 비밀번호가 올바르지 않습니다." : "원본 프로젝트 편집 권한을 확인할 수 없습니다."); notify("error", "원본 프로젝트 편집 권한을 확인할 수 없습니다.", "프로젝트 복사", body); return; }
      }
      const response = await fetch(`/api${projectPath(copyTarget.publicId)}/copy`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": `"${copyTarget.revision}"` },
        body: JSON.stringify({ name, description: copyDescription, editPassword: copyPassword, resetProgress }),
      });
      const body: unknown = await response.json().catch(() => null);
      const data = typeof body === "object" && body !== null && "data" in body ? (body as CopyProjectResponse).data : null;
      if (response.status === 201 && data?.operation.kind === "projectCopy" && data.project.publicId) {
        notify("success", "프로젝트 복사본을 생성했습니다. 새 프로젝트로 이동합니다.", "프로젝트 복사");
        router.push(projectPath(data.project.publicId)); return;
      }
      setCopyError(response.status === 412 ? "원본 프로젝트가 변경되었습니다. 복사 창을 닫고 다시 시도해 주세요." : response.status === 401 ? "원본 프로젝트 편집 권한이 만료되었습니다." : "프로젝트를 복사하지 못했습니다.");
      notify("error", "프로젝트를 복사하지 못했습니다.", "프로젝트 복사", body);
    } catch { setCopyError("네트워크 연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { mutation.current = false; setCopying(false); setSourcePassword(""); setCopyPassword(""); setCopyPasswordConfirm(""); }
  }

  async function deleteProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!target || mutation.current) return;
    if (!validPassword(password)) { setPassword(""); reportDeleteError("편집 비밀번호는 최소 12자이며 UTF-8 기준 1,024 bytes 이하여야 합니다."); return; }
    const currentTarget = target; const submittedPassword = password; setPassword(""); setDeleteError(null); clearToast(); mutation.current = true; setSubmitting(true);
    try {
      const authorization = await fetch(`/api${projectPath(currentTarget.publicId)}/edit-sessions`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editPassword: submittedPassword }) });
      if (authorization.status !== 204) { const body: unknown = await authorization.json().catch(() => null); reportDeleteError(authorization.status === 401 ? "편집 비밀번호가 올바르지 않습니다. 다시 확인해 주세요." : authorization.status === 429 ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." : "삭제 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", body); return; }
      const response = await fetch(`/api${projectPath(currentTarget.publicId)}`, { method: "DELETE", cache: "no-store", credentials: "same-origin", headers: { "If-Match": `"${currentTarget.revision}"` } });
      if (response.status === 204) { setTarget(null); setDeletedIds((current) => new Set(current).add(currentTarget.publicId)); notify("success", "프로젝트를 삭제했습니다.", "프로젝트 삭제"); router.refresh(); return; }
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 412) { setTarget(null); reportDeleteError("프로젝트가 변경되었습니다. 삭제 버튼을 다시 눌러 최신 정보를 확인해 주세요.", body); }
      else if (response.status === 401 || response.status === 403) reportDeleteError("삭제 권한을 확인할 수 없습니다. 비밀번호와 접속 주소를 확인해 주세요.", body);
      else reportDeleteError("프로젝트를 삭제하지 못했습니다. 목록에서 삭제 여부를 확인한 뒤 다시 시도해 주세요.", body);
    } catch { reportDeleteError("서버 응답을 확인하지 못했습니다. 목록에서 삭제 여부와 네트워크 연결을 확인해 주세요."); }
    finally { mutation.current = false; setSubmitting(false); setPassword(""); }
  }

  return <>
    {visibleProjects.length === 0 ? <EmptyProjects /> : <div className={styles.list} aria-label="프로젝트 목록">
      <p className={styles.count}><strong>{visibleProjects.length}</strong>개의 프로젝트</p><div className={styles.tableWrap}><table aria-label="프로젝트 목록" className={styles.table}>
        <thead><tr><th scope="col">프로젝트</th><th scope="col">설명</th><th scope="col">생성</th><th scope="col">최근 변경</th><th scope="col">작업</th></tr></thead>
        <tbody>{visibleProjects.map((project) => <tr key={project.publicId} data-project-id={project.publicId}>
          <td className={styles.nameCell}><Link className={styles.nameLink} href={projectPath(project.publicId)}>{project.name}</Link></td><td className={styles.descriptionCell}><span className={styles.description}>{project.description || "설명이 없습니다."}</span></td>
          <td className={styles.dateCell}>{formatLocaleDateTime(project.createdAt, locales, timeZone)}</td><td className={styles.dateCell}>{formatLocaleDateTime(project.updatedAt, locales, timeZone)}</td>
          <td className={styles.actions}><Link className={styles.openLink} href={projectPath(project.publicId)}>열기</Link><ProjectLinkButton projectName={project.name} projectUrl={projectUrls[project.publicId] ?? null} />
            <button className={styles.openLink} disabled={deletingId !== undefined || submitting || copying} onClick={(event) => void prepareCopy(project, event.currentTarget)} type="button">프로젝트 복사</button>
            <button className={styles.deleteButton} disabled={deletingId !== undefined || submitting || copying} onClick={(event) => void prepareDelete(project, event.currentTarget)} type="button">{deletingId === project.publicId ? "확인 중" : "삭제"}</button></td>
        </tr>)}</tbody></table></div>
    </div>}
    {copyTarget ? <WorkspaceDialog title="프로젝트 복사" onClose={closeCopy} busy={copying} restoreFocusRef={copyTrigger}>
      <p>원본: <strong>{copyTarget.name}</strong> · 작업 {copyTarget.tasks} · 연결 {copyTarget.links} · 휴일 {copyTarget.holidays}</p><p>시작일·종료일·근무일 기간·프로젝트 휴일을 그대로 복사합니다.</p>
      {copyError ? <p role="alert">{copyError}</p> : null}<form className="project-form compact-form" noValidate onSubmit={copyProject}>
        {!copyTarget.authorized ? <div className="form-field"><label htmlFor="copy-source-password">원본 편집 비밀번호</label><input id="copy-source-password" type="password" autoComplete="current-password" disabled={copying} value={sourcePassword} on