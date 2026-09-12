"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { EmptyProjects } from "@/components/empty-projects";
import type {
  CurrentEditSessionResponse,
  ProjectListItemDto,
  ProjectSnapshotResponse,
} from "@/contracts/projects";
import {
  browserLocales,
  browserTimeZone,
  formatLocaleDateTime,
  SSR_DATE_LOCALE,
  SSR_TIME_ZONE,
  type DisplayLocales,
} from "@/lib/date-display";

import styles from "./project-list.module.css";

type AccessState = "checking" | "edit" | "readonly";

function subscribeToLocaleChanges(): () => void {
  // Browsers do not expose a locale-change event. useSyncExternalStore still
  // gives SSR and hydration a deterministic fallback before reading navigator.
  return () => {};
}

function projectUrl(publicId: string): string {
  return `/projects/${encodeURIComponent(publicId)}`;
}

async function readPermission(publicId: string): Promise<AccessState> {
  const response = await fetch(`/api${projectUrl(publicId)}/edit-sessions/current`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) return "readonly";

  const body = (await response.json()) as CurrentEditSessionResponse;
  return body.data.permission === "edit" ? "edit" : "readonly";
}

async function readCurrentProject(
  publicId: string,
): Promise<{ name: string; revision: number } | undefined> {
  const response = await fetch(`/api${projectUrl(publicId)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) return undefined;

  const body = (await response.json()) as ProjectSnapshotResponse;
  return { name: body.data.project.name, revision: body.data.project.revision };
}

export function ProjectList({
  projects,
}: Readonly<{ projects: readonly ProjectListItemDto[] }>) {
  const router = useRouter();
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [access, setAccess] = useState<Record<string, AccessState>>({});
  const [deletingId, setDeletingId] = useState<string>();
  const [error, setError] = useState<string>();
  const locales = useSyncExternalStore<DisplayLocales>(
    subscribeToLocaleChanges,
    browserLocales,
    () => SSR_DATE_LOCALE,
  );
  const timeZone = useSyncExternalStore(
    subscribeToLocaleChanges,
    browserTimeZone,
    () => SSR_TIME_ZONE,
  );
  const visibleProjects = useMemo(
    () => projects.filter(({ publicId }) => !deletedIds.has(publicId)),
    [deletedIds, projects],
  );

  const publicIds = useMemo(
    () => visibleProjects.map((project) => project.publicId),
    [visibleProjects],
  );

  useEffect(() => {
    if (publicIds.length === 0) return;
    let active = true;
    void Promise.all(
      publicIds.map(async (publicId) => [publicId, await readPermission(publicId)] as const),
    ).then((results) => {
      if (active) setAccess(Object.fromEntries(results));
    }).catch(() => {
      if (active) {
        setAccess(Object.fromEntries(publicIds.map((publicId) => [publicId, "readonly"])));
      }
    });
    return () => { active = false; };
  }, [publicIds]);

  async function deleteProject(project: ProjectListItemDto): Promise<void> {
    setError(undefined);
    setDeletingId(project.publicId);
    try {
      // Read immediately before confirmation so both the displayed name and
      // revision are current. The server rejects a change after confirmation.
      const currentProject = await readCurrentProject(project.publicId);
      if (currentProject === undefined) {
        throw new Error("프로젝트 정보를 다시 읽지 못했습니다. 목록을 새로고침해 주세요.");
      }
      const confirmed = window.confirm(
        `“${currentProject.name}” 프로젝트와 포함된 모든 일정이 삭제됩니다. 이 작업은 복구할 수 없습니다. 계속할까요?`,
      );
      if (!confirmed) return;

      const response = await fetch(`/api${projectUrl(project.publicId)}`, {
        method: "DELETE",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "If-Match": `"${currentProject.revision}"` },
      });
      if (response.status === 204) {
        setDeletedIds((current) => new Set(current).add(project.publicId));
        router.refresh();
        return;
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("삭제 권한이 만료되었습니다. 프로젝트에서 편집 잠금을 다시 해제해 주세요.");
      }
      if (response.status === 412) {
        throw new Error("프로젝트가 변경되었습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.");
      }
      throw new Error("프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로젝트를 삭제하지 못했습니다.");
    } finally {
      setDeletingId(undefined);
    }
  }

  if (visibleProjects.length === 0) return <EmptyProjects />;

  return (
    <div className={styles.list} aria-label="프로젝트 목록">
      <p className={styles.count}>
        <strong>{visibleProjects.length}</strong>개의 프로젝트
      </p>
      {error ? <p className={styles.status} role="alert">{error}</p> : null}
      <div className={styles.tableWrap}>
        <table aria-label="프로젝트 목록" className={styles.table}>
          <thead>
            <tr>
              <th scope="col">프로젝트</th>
              <th scope="col">설명</th>
              <th scope="col">생성</th>
              <th scope="col">최근 변경</th>
              <th scope="col">작업</th>
            </tr>
          </thead>
          <tbody>
            {visibleProjects.map((project) => {
              const permission = access[project.publicId] ?? "checking";
              const deleting = deletingId === project.publicId;
              return (
                <tr key={project.publicId} data-project-id={project.publicId}>
                  <td className={styles.nameCell}>
                    <Link className={styles.nameLink} href={projectUrl(project.publicId)}>
                      {project.name}
                    </Link>
                  </td>
                  <td className={styles.descriptionCell}>
                    <span className={styles.description}>{project.description || "설명이 없습니다."}</span>
                  </td>
                  <td className={styles.dateCell}>{formatLocaleDateTime(project.createdAt, locales, timeZone)}</td>
                  <td className={styles.dateCell}>{formatLocaleDateTime(project.updatedAt, locales, timeZone)}</td>
                  <td className={styles.actions}>
                    <Link className={styles.openLink} href={projectUrl(project.publicId)}>
                      열기
                    </Link>
                    {permission === "edit" ? (
                      <button
                        className={styles.deleteButton}
                        disabled={deleting}
                        onClick={() => void deleteProject(project)}
                        type="button"
                      >
                        {deleting ? "삭제 중" : "삭제"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
