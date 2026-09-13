"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { EmptyProjects } from "@/components/empty-projects";
import { ProjectLinkButton } from "@/components/project-link-button";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import type { ProjectListItemDto } from "@/contracts/projects";
import { browserLocales, browserTimeZone, formatLocaleDateTime, SSR_DATE_LOCALE, SSR_TIME_ZONE, type DisplayLocales } from "@/lib/date-display";
import styles from "./project-list.module.css";

function subscribeToLocaleChanges(): () => void { return () => {}; }
function projectPath(publicId: string): string { return `/projects/${encodeURIComponent(publicId)}`; }
type DeleteTarget = { publicId: string; name: string; revision: number };

async function readCurrentProject(publicId: string): Promise<DeleteTarget | null> {
  const response = await fetch(`/api${projectPath(publicId)}`, { cache: "no-store", credentials: "same-origin" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) return null;
  const data = body.data;
  if (typeof data !== "object" || data === null || !("project" in data)) return null;
  const project = data.project;
  if (typeof project !== "object" || project === null || !("name" in project) || typeof project.name !== "string" ||
    !("revision" in project) || typeof project.revision !== "number" || !Number.isSafeInteger(project.revision)) return null;
  return { publicId, name: project.name, revision: project.revision };
}

export function ProjectList({ projects, projectUrls = {} }: Readonly<{
  projects: readonly ProjectListItemDto[]; projectUrls?: Readonly<Record<string, string | null>>;
}>) {
  const router = useRouter();
  const { notify, clearToast } = useWorkspaceNotifications();
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [deletingId, setDeletingId] = useState<string>();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mutation = useRef(false);
  const locales = useSyncExternalStore<DisplayLocales>(subscribeToLocaleChanges, browserLocales, () => SSR_DATE_LOCALE);
  const timeZone = useSyncExternalStore(subscribeToLocaleChanges, browserTimeZone, () => SSR_TIME_ZONE);
  const visibleProjects = useMemo(() => projects.filter(({ publicId }) => !deletedIds.has(publicId)), [deletedIds, projects]);

  function reportError(message: string, body?: unknown) {
    setDeleteError(message);
    notify("error", message, "프로젝트 삭제", body);
  }
  function closeDelete() {
    if (mutation.current) return;
    setTarget(null); setPassword(""); setDeleteError(null);
  }
  async function prepareDelete(project: ProjectListItemDto) {
    if (mutation.current) return;
    mutation.current = true;
    setDeletingId(project.publicId); clearToast(); setDeleteError(null); setPassword("");
    try {
      const current = await readCurrentProject(project.publicId);
      if (!current) {
        reportError("프로젝트 정보를 다시 읽지 못했습니다. 목록을 새로고침해 주세요.");
        return;
      }
      setTarget(current);
    } catch {
      reportError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      mutation.current = false; setDeletingId(undefined);
    }
  }
  async function deleteProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || mutation.current) return;
    if (Array.from(password).length < 12 || new TextEncoder().encode(password).byteLength > 1024) {
      setPassword(""); reportError("편집 비밀번호는 최소 12자이며 UTF-8 기준 1,024 bytes 이하여야 합니다."); return;
    }
    const currentTarget = target;
    const submittedPassword = password;
    setPassword(""); setDeleteError(null); clearToast();
    mutation.current = true; setSubmitting(true);
    try {
      // Always verify a newly entered password, even when a valid edit session already exists.
      const authorization = await fetch(`/api${projectPath(currentTarget.publicId)}/edit-sessions`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editPassword: submittedPassword }),
      });
      if (authorization.status !== 204) {
        const body: unknown = await authorization.json().catch(() => null);
        reportError(authorization.status === 401 ? "편집 비밀번호가 올바르지 않습니다. 다시 확인해 주세요."
          : authorization.status === 429 ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "삭제 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", body);
        return;
      }
      const response = await fetch(`/api${projectPath(currentTarget.publicId)}`, {
        method: "DELETE", cache: "no-store", credentials: "same-origin",
        headers: { "If-Match": `"${currentTarget.revision}"` },
      });
      if (response.status === 204) {
        setTarget(null);
        setDeletedIds((current) => new Set(current).add(currentTarget.publicId));
        notify("success", "프로젝트를 삭제했습니다.", "프로젝트 삭제");
        router.refresh();
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 412) {
        setTarget(null);
        reportError("프로젝트가 변경되었습니다. 삭제 버튼을 다시 눌러 최신 정보를 확인해 주세요.", body);
      } else if (response.status === 401 || response.status === 403) {
        reportError("삭제 권한을 확인할 수 없습니다. 비밀번호와 접속 주소를 확인해 주세요.", body);
      } else {
        reportError("프로젝트를 삭제하지 못했습니다. 목록에서 삭제 여부를 확인한 뒤 다시 시도해 주세요.", body);
      }
    } catch {
      reportError("서버 응답을 확인하지 못했습니다. 목록에서 삭제 여부와 네트워크 연결을 확인해 주세요.");
    } finally {
      mutation.current = false; setSubmitting(false); setPassword("");
    }
  }

  return <>
    {visibleProjects.length === 0 ? <EmptyProjects /> : <div className={styles.list} aria-label="프로젝트 목록">
      <p className={styles.count}><strong>{visibleProjects.length}</strong>개의 프로젝트</p>
      <div className={styles.tableWrap}>
        <table aria-label="프로젝트 목록" className={styles.table}>
          <thead><tr><th scope="col">프로젝트</th><th scope="col">설명</th><th scope="col">생성</th><th scope="col">최근 변경</th><th scope="col">작업</th></tr></thead>
          <tbody>{visibleProjects.map((project) => <tr key={project.publicId} data-project-id={project.publicId}>
            <td className={styles.nameCell}><Link className={styles.nameLink} href={projectPath(project.publicId)}>{project.name}</Link></td>
            <td className={styles.descriptionCell}><span className={styles.description}>{project.description || "설명이 없습니다."}</span></td>
            <td className={styles.dateCell}>{formatLocaleDateTime(project.createdAt, locales, timeZone)}</td>
            <td className={styles.dateCell}>{formatLocaleDateTime(project.updatedAt, locales, timeZone)}</td>
            <td className={styles.actions}>
              <Link className={styles.openLink} href={projectPath(project.publicId)}>열기</Link>
              <ProjectLinkButton projectName={project.name} projectUrl={projectUrls[project.publicId] ?? null} />
              <button className={styles.deleteButton} disabled={deletingId !== undefined || submitting}
                onClick={() => void prepareDelete(project)} type="button">{deletingId === project.publicId ? "확인 중" : "삭제"}</button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
    {target ? <WorkspaceDialog title="프로젝트 삭제" onClose={closeDelete} busy={submitting}>
      <p>“{target.name}” 프로젝트와 포함된 모든 일정이 삭제됩니다. 이 작업은 복구할 수 없습니다.</p>
      <p>삭제하려면 이 프로젝트의 편집 비밀번호를 입력해 주세요.</p>
      {deleteError ? <p role="alert">{deleteError}</p> : null}
      <form className="project-form compact-form" noValidate onSubmit={deleteProject}>
        <div className="form-field"><label htmlFor="delete-project-password">삭제 확인 비밀번호</label>
          <input id="delete-project-password" type="password" autoComplete="current-password" disabled={submitting}
            value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "삭제 중…" : "비밀번호 확인 후 삭제"}</button>
      </form>
    </WorkspaceDialog> : null}
  </>;
}
