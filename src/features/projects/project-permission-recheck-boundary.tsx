"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { parseCurrentEditPermission } from "@/features/projects/edit-permission";

type ProjectPermissionRecheckBoundaryProps = Readonly<{
  publicId: string;
  children: ReactNode;
}>;

/**
 * Covers browser history/BFCache restoration where React may restore an already
 * mounted Project workspace without re-running the workspace mount effect.
 *
 * Normal client navigation to another publicId still gets the Project workspace's
 * ordinary mount-time check. On a restored document we first make the restored
 * subtree inert, then ask the server about the session bound to this publicId.
 * A valid edit grant keeps the existing subtree (and Gantt scroll/selection state)
 * untouched. Readonly, malformed, failed, or expired checks hard-reload the current
 * URL so stale client edit state is discarded and the workspace restarts readonly.
 *
 * The boundary uses `display: contents` deliberately: ProjectReadonlyView must stay
 * a direct layout participant of `.project-page-shell`. Adding a normal wrapper
 * changes the existing grid/flex sizing contract and can hide or narrow the Gantt.
 * `inert` still applies to the DOM subtree during the short revalidation window.
 */
export function ProjectPermissionRecheckBoundary({
  publicId,
  children,
}: ProjectPermissionRecheckBoundaryProps) {
  const [rechecking, setRechecking] = useState(false);
  const requestGeneration = useRef(0);
  const projectPath = `/projects/${encodeURIComponent(publicId)}`;

  const recheck = useCallback(async () => {
    if (window.location.pathname !== projectPath) return;

    const generation = ++requestGeneration.current;
    setRechecking(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const body: unknown = await response.json().catch(() => null);
      if (generation !== requestGeneration.current || window.location.pathname !== projectPath) return;
      const parsed = response.ok
        ? parseCurrentEditPermission(body)
        : { permission: "readonly" as const, valid: false };
      if (!parsed.valid || parsed.permission !== "edit") {
        window.location.reload();
        return;
      }
    } catch {
      if (generation !== requestGeneration.current || window.location.pathname !== projectPath) return;
      window.location.reload();
      return;
    }
    if (generation === requestGeneration.current) setRechecking(false);
  }, [projectPath, publicId]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void recheck();
    };
    const handlePopState = () => { void recheck(); };
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    return () => {
      requestGeneration.current += 1;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [recheck]);

  return <div
    aria-busy={rechecking || undefined}
    inert={rechecking || undefined}
    style={{ display: "contents" }}
  >
    {rechecking ? <span className="sr-only" role="status">편집 권한을 다시 확인하는 중입니다.</span> : null}
    {children}
  </div>;
}
