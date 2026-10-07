"use client";
import { canCreateSchedulingLink, linkStructureLocked, MIXED_LINK_EXPLANATION, COMPLETED_LINK_EXPLANATION } from "@/features/gantt/relation-editor-model";
import { StageFilterPicker } from "./stage-filter-picker";
import { ProjectMilestoneDashboard } from "@/features/milestones/project-milestone-dashboard";
import type { MilestoneResourceDrill } from "@/features/resources/milestone-resource-drill";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ProjectLinkButton } from "@/components/project-link-button";
import { ProjectCopyEntry } from "@/features/projects/project-copy-entry";
import { ProjectSaveAsTemplateButton } from "@/features/templates/project-save-as-template-button";
import { ProjectExportButton } from "@/features/projects/project-excel-export-button";
import { previewMembershipCopy } from "@/domain/milestones/membership-copy-plan";
import { ProjectCopyMembershipConfirm } from "./project-copy-membership-confirm";
import { copyReviewMatches, type CopyReview } from "./project-copy-confirm-model";
import { ProjectImportButton } from "@/features/projects/project-import-button";
import { ProjectSettingsDialog } from "@/features/projects/project-settings-dialog";
import { EMPTY_TASK_FILTER, activeTaskFilterCount, applyTaskQuickView, filterTasksWithAncestors, getTaskQuickView, type TaskFilterState } from "@/features/projects/project-search-filter";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { WorkspaceNotifications, useWorkspaceNotifications } from "@/components/workspace-notifications";
import feedbackStyles from "@/components/workspace-feedback.module.css";
import type { DependencyType, LinkMutationResponse, ProjectMetadataMutationResponse, ProjectSnapshotResponse, ProjectStatus, TaskHierarchyCommandRequest, TaskMutationResponse } from "@/contracts/projects";
import { PROJECT_STATUS_OPTIONS, projectStatusLabel } from "@/features/projects/project-status";
import {
  patchProjectStatus,
  projectSnapshotFromStatusMutation,
} from "@/features/projects/project-status-mutation";
import type { AssignedTargetsResponse, AssignmentTargetDto } from "@/contracts/resources";
import type { ProjectGridColumnVisibility } from "@/features/gantt/project-gantt";
import type { ProjectTaskCreateCommand, ProjectTaskUpdateCommand } from "@/features/gantt/project-task-adapter";
import { ProjectTaskEditor, type ProjectTaskEditorHandle, type TaskRelationEditorRequest } from "@/features/gantt/project-task-editor";
import { RelationEditorDialog } from "@/features/gantt/relation-editor-dialog";
import { taskEditorReadOnlyReason, type TaskEditorSaveResult, type TaskEditorSession } from "@/features/gantt/task-editor-model";
import { createTaskDeletePlan, type TaskDeletePlan } from "@/features/gantt/task-delete-model";
import { findTaskContextElement } from "@/features/gantt/task-context-target";
import { taskHasDependencyLinks } from "@/features/gantt/task-link-scope";
import { resolveTaskSubtreeScope } from "@/features/gantt/task-subtree-scope";
import { ProjectResourceWorkload } from "@/features/resources/project-resource-workload";
import { ProjectLogisticsManagement } from "@/features/logistics/project-logistics-management";
import { todayLocalDateString } from "@/lib/date-display";
import { canAcceptCanonicalSnapshot, replayConfirmedSnapshot } from "./canonical-snapshot-recovery";
import { mergePendingProjectRevision, shouldRetireDurableProjectRevision } from "./project-revision-sync";

const ProjectGantt = dynamic(
  () => import("@/features/gantt/project-gantt").then((module) => module.ProjectGantt),
  { ssr: false, loading: () => <div className="gantt-loading" role="status">일정을 불러오는 중입니다.</div> },
);
type LoadState = { status: "loading" } | { status: "ready"; snapshot: ProjectSnapshotResponse } | { status: "not-found" } | { status: "error" };
type Permission = "readonly" | "edit";
type PermissionCheckState = "checking" | "complete";
type PendingTaskDelete = TaskDeletePlan & Readonly<{ revision: number }>;
const INITIAL_COLUMN_VISIBILITY: ProjectGridColumnVisibility = { text: true, externalId: false, projectStart: true, projectDuration: true, baselineStart: false, baselineEnd: false, milestoneStage: false };
const ALL_SCOPE_STATE_KEY = "all";
function scopeStateKey(taskId: string | null): string { return taskId ?? ALL_SCOPE_STATE_KEY; }
function scopeTabId(taskId: string | null): string { return `project-scope-tab-${taskId ?? "all"}`; }

function isSnapshot(value: unknown): value is ProjectSnapshotResponse {
  if (typeof value !== "object" || value === null || !("data" in value)) return false;
  const data = value.data;
  if (typeof data !== "object" || data === null || !("project" in data) || typeof data.project !== "object" || data.project === null) return false;
  const project = data.project;
  return "name" in project && typeof project.name === "string" &&
    "description" in project && typeof project.description === "string" &&
    "status" in project && typeof project.status === "string" && ["planned", "in_progress", "completed"].includes(project.status) &&
    "revision" in project && typeof project.revision === "number" &&
    "calendar" in project && typeof project.calendar === "object" && project.calendar !== null &&
    "timezone" in project.calendar && typeof project.calendar.timezone === "string" &&
    "holidays" in project.calendar && Array.isArray(project.calendar.holidays) &&
    "tasks" in data && Array.isArray(data.tasks) && "links" in data && Array.isArray(data.links);
}
function permissionFrom(value: unknown): Permission {
  if (typeof value === "object" && value !== null && "data" in value &&
    typeof value.data === "object" && value.data !== null &&
    "permission" in value.data && value.data.permission === "edit" &&
    "expiresAt" in value.data && typeof value.data.expiresAt === "string" &&
    value.data.expiresAt.length > 0 && !Number.isNaN(Date.parse(value.data.expiresAt))) return "edit";
  return "readonly";
}
function safeErrorCode(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "object" && value.error !== null && "code" in value.error && typeof value.error.code === "string") return value.error.code;
  return null;
}
function unlockPasswordValid(value: string): boolean { return Array.from(value).length >= 1 && new TextEncoder().encode(value).byteLength <= 1024; }
function newPasswordValid(value: string): boolean { const length = Array.from(value).length; return length >= 1 && length <= 12; }
function revisionTag(revision: number): string { return `"${revision}"`; }
function projectRevisionStorageKey(publicId: string): string { return `mastergantt:project-revision:${publicId}`; }
function announceProjectRevision(publicId: string, revision: number): void {
  try {
    const key = projectRevisionStorageKey(publicId);
    const previous = Number(window.localStorage.getItem(key) ?? "0");
    if (!Number.isFinite(previous) || revision > previous) window.localStorage.setItem(key, String(revision));
  } catch {
    // Cross-tab freshness is best-effort. The canonical API/revision remains authoritative.
  }
}
function snapshotFromMetadataMutation(value: unknown): ProjectSnapshotResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const data = (value as Partial<ProjectMetadataMutationResponse>).data;
  if (!data || typeof data !== "object" || !data.project || typeof data.project !== "object" || !Array.isArray(data.tasks) ||
    !Array.isArray(data.links) || !Array.isArray(data.warnings) || !data.operation || data.operation.kind !== "projectMetadata" ||
    !Array.isArray(data.operation.changedFields)) return null;
  return {
    data: {
      project: data.project,
      tasks: data.tasks,
      links: data.links,
      ...(data.assignments ? { assignments: data.assignments } : {}),
      ...(data.logistics ? { logistics: data.logistics } : {}),
      permission: "readonly",
    },
  };
}
function snapshotFromTaskMutation(value: unknown): ProjectSnapshotResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const data = (value as Partial<TaskMutationResponse>).data;
  if (!data || typeof data !== "object" || !data.project || typeof data.project !== "object" ||
    !Array.isArray(data.tasks) || !Array.isArray(data.links) || !Array.isArray(data.warnings) ||
    !data.operation || !["taskCreate", "taskUpdate", "taskDelete", "taskHierarchy", "milestoneMembership"].includes(data.operation.kind) ||
    !Array.isArray(data.operation.changedTaskExternalIds) || !Array.isArray(data.operation.deletedTaskExternalIds) ||
    !Array.isArray(data.operation.deletedLinkIds)) return null;
  return {
    data: {
      project: data.project,
      tasks: data.tasks,
      links: data.links,
      ...(data.assignments ? { assignments: data.assignments } : {}),
      ...(data.logistics ? { logistics: data.logistics } : {}),
      permission: "readonly",
    },
  };
}
function snapshotFromLinkMutation(value: unknown): ProjectSnapshotResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const data = (value as Partial<LinkMutationResponse>).data;
  if (!data || typeof data !== "object" || !data.project || !Array.isArray(data.tasks) ||
    !Array.isArray(data.links) || !Array.isArray(data.warnings) || !data.operation ||
    !["linkCreate", "linkUpdate", "linkDelete"].includes(data.operation.kind)) return null;
  return {
    data: {
      project: data.project,
      tasks: data.tasks,
      links: data.links,
      ...(data.assignments ? { assignments: data.assignments } : {}),
      ...(data.logistics ? { logistics: data.logistics } : {}),
      permission: "readonly",
    },
  };
}


type ProjectViewProps = Readonly<{ publicId: string; projectUrl?: string | null; ownerName: string }>;
export function ProjectReadonlyView({ publicId, projectUrl = null, ownerName }: ProjectViewProps) {
  return <WorkspaceNotifications key={publicId} scope={`프로젝트 ${publicId}`}>
    <ProjectWorkspace publicId={publicId} projectUrl={projectUrl} ownerName={ownerName} />
  </WorkspaceNotifications>;
}

function ProjectWorkspace({ publicId, projectUrl = null, ownerName }: ProjectViewProps) {
  const searchParams = useSearchParams();
  const initialRootTaskId = searchParams.get("rootTask")?.trim() || null;
  const { notify, clearToast } = useWorkspaceNotifications();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const confirmedSnapshotReference = useRef<ProjectSnapshotResponse | null>(null);
  const crossTabRefreshInFlightReference = useRef(false);
  const crossTabPendingRevisionReference = useRef(0);
  const crossTabDurableCatchUpRevisionReference = useRef(0);
  const [permission, setPermission] = useState<Permission>("readonly");
  const [permissionCheckState, setPermissionCheckState] = useState<PermissionCheckState>("checking");
  const [retryKey, setRetryKey] = useState(0);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [infoPopoverOpen, setInfoPopoverOpen] = useState(false);
  const [activeView, setActiveView] = useState<"schedule" | "resources" | "logistics">("schedule");
  const [scheduleView, setScheduleView] = useState<"gantt" | "milestones">("gantt");
  const [resourceDrill, setResourceDrill] = useState<MilestoneResourceDrill | null>(null);
  const [previousDashboardDrill, setPreviousDashboardDrill] = useState<{ rootTaskId: string | null; filter: TaskFilterState } | null>(null);
  const schedulePeerReferences = useRef<Partial<Record<"gantt" | "milestones", HTMLButtonElement | null>>>({});
  const scheduleGanttPanel = useRef<HTMLDivElement>(null);
  const [peerChartRestore, setPeerChartRestore] = useState<{ key: string; left: number; top: number } | null>(null);
  const peerViewport = useRef<{ publicId: string; rootTaskId: string | null; filter: TaskFilterState; positions: { selector: string; left: number; top: number }[] } | null>(null);
  const [activeRootTaskId, setActiveRootTaskId] = useState<string | null>(() => initialRootTaskId);
  const [openScopeTaskIds, setOpenScopeTaskIds] = useState<readonly string[]>(() => initialRootTaskId ? [initialRootTaskId] : []);
  const [taskFilter, setTaskFilter] = useState<TaskFilterState>(EMPTY_TASK_FILTER);
  const [taskFilterOpen, setTaskFilterOpen] = useState(false);
  const [assignedTargets, setAssignedTargets] = useState<AssignmentTargetDto[]>([]);
  const [targetPickerQuery, setTargetPickerQuery] = useState("");
  const [targetPickerKind, setTargetPickerKind] = useState<"all" | "resource" | "group">("all");
  const [ganttResetGeneration, setGanttResetGeneration] = useState(0);
  const [metadataName, setMetadataName] = useState("");
  const [metadataDescription, setMetadataDescription] = useState("");
  const [metadataStatus, setMetadataStatus] = useState<ProjectStatus>("planned");
  const [masterSelection, setMasterSelection] = useState({ businessUnitId: "", productId: "", siteEntityId: "" });
  const [columnVisibility, setColumnVisibility] = useState<ProjectGridColumnVisibility>(INITIAL_COLUMN_VISIBILITY);
  const [pendingTaskDelete, setPendingTaskDelete] = useState<PendingTaskDelete | null>(null);
  const taskMutationReference = useRef(false);
  const copyConfirmationReference = useRef(false);
  const copyReviewTriggerReference = useRef<HTMLElement | null>(null);
  const [copyReview, setCopyReview] = useState<CopyReview | null>(null);
  const [copyReviewError, setCopyReviewError] = useState<string | null>(null);
  const [importPending, setImportPending] = useState(false);
  const importRefreshContext = useRef({ publicId, generation:0 });
  useLayoutEffect(() => {
    const context=importRefreshContext.current;
    context.publicId=publicId;context.generation++;
    return () => { context.generation++; };
  }, [publicId]);
  const [editorSession, setEditorSession] = useState<TaskEditorSession | null>(null);
  const [relationEditorRequest, setRelationEditorRequest] = useState<TaskRelationEditorRequest | null>(null);
  const [editorInitialTab, setEditorInitialTab] = useState<"task" | "memberships">("task");
  const projectTaskEditorReference = useRef<ProjectTaskEditorHandle>(null);
  const relationEditorTriggerReference = useRef<HTMLElement | null>(null);
  const editorTriggerReference = useRef<HTMLElement | null>(null);
  const editorOriginViewReference = useRef<"schedule" | "resources" | "logistics">("schedule");
  const editorOpeningReference = useRef(false);
  const deleteTriggerReference = useRef<HTMLElement | null>(null);
  const unlockTriggerReference = useRef<HTMLButtonElement | null>(null);
  const settingsTriggerReference = useRef<HTMLButtonElement | null>(null);
  const focusSettingsAfterUnlockReference = useRef(false);
  const focusUnlockAfterSettingsReference = useRef(false);
  const scheduleTabReference = useRef<HTMLButtonElement | null>(null);
  const resourceTabReference = useRef<HTMLButtonElement | null>(null);
  const logisticsTabReference = useRef<HTMLButtonElement | null>(null);
  const scopeTabReferences = useRef(new Map<string, HTMLButtonElement>());
  const scopeTaskFiltersReference = useRef(new Map<string, TaskFilterState>());
  const actionMenuReference = useRef<HTMLDetailsElement | null>(null);
  const infoPopoverReference = useRef<HTMLDetailsElement | null>(null);
  const taskSearchReference = useRef<HTMLInputElement | null>(null);
  const taskFilterTriggerReference = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!infoPopoverOpen && !actionMenuOpen) return;

    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest('dialog, [role="dialog"]')) return;

      if (infoPopoverOpen && infoPopoverReference.current && !infoPopoverReference.current.contains(target)) {
        setInfoPopoverOpen(false);
      }
      if (actionMenuOpen && actionMenuReference.current && !actionMenuReference.current.contains(target)) {
        setActionMenuOpen(false);
      }
    }

    function handleOutsideFocus(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest('dialog, [role="dialog"]')) return;

      if (infoPopoverOpen && infoPopoverReference.current && !infoPopoverReference.current.contains(target)) {
        setInfoPopoverOpen(false);
      }
      if (actionMenuOpen && actionMenuReference.current && !actionMenuReference.current.contains(target)) {
        setActionMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("focusin", handleOutsideFocus);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("focusin", handleOutsideFocus);
    };
  }, [infoPopoverOpen, actionMenuOpen]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/assigned-targets`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        if (!controller.signal.aborted && response.ok && body && typeof body === "object" && "data" in body) {
          setAssignedTargets((body as AssignedTargetsResponse).data.targets);
        }
      } catch {
        if (!controller.signal.aborted) setAssignedTargets([]);
      }
    })();
    return () => controller.abort();
  }, [publicId]);

  useEffect(() => {
    if (permission !== "edit" || permissionCheckState !== "complete" || !focusSettingsAfterUnlockReference.current) return;
    focusSettingsAfterUnlockReference.current = false;
    settingsTriggerReference.current?.focus();
  }, [permission, permissionCheckState]);

  useEffect(() => {
    if (permission !== "readonly" || permissionCheckState !== "complete" || !focusUnlockAfterSettingsReference.current) return;
    focusUnlockAfterSettingsReference.current = false;
    unlockTriggerReference.current?.focus();
  }, [permission, permissionCheckState]);

  const applySnapshot = useCallback((value: unknown): boolean => {
    if (!isSnapshot(value) || !canAcceptCanonicalSnapshot(confirmedSnapshotReference.current, value, publicId)) return false;
    const previousRevision = confirmedSnapshotReference.current?.data.project.revision ?? null;
    confirmedSnapshotReference.current = value;
    setState({ status: "ready", snapshot: value });
    if (previousRevision !== null && value.data.project.revision > previousRevision) {
      announceProjectRevision(publicId, value.data.project.revision);
    }
    setMetadataName(value.data.project.name); setMetadataDescription(value.data.project.description); setMetadataStatus(value.data.project.status);
    setMasterSelection({ businessUnitId: value.data.project.businessUnit?.id ?? "", productId: value.data.project.product?.id ?? "", siteEntityId: value.data.project.siteEntity?.id ?? "" });
    return true;
  }, [publicId, setMasterSelection, setMetadataDescription, setMetadataName, setMetadataStatus]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 404) { setState({ status: "not-found" }); return; }
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || !isSnapshot(body)) {
          setState({ status: "error" });
          notify("error", "프로젝트 정보를 불러올 수 없습니다. 다시 시도해 주세요.", "프로젝트 조회", body);
          return;
        }
        if (!applySnapshot(body)) {
          const confirmed = confirmedSnapshotReference.current;
          if (!confirmed || confirmed.data.project.publicId !== publicId) {
            setState({ status: "error" });
            notify("error", "현재 프로젝트의 정보를 확인할 수 없습니다. 다시 시도해 주세요.", "프로젝트 조회");
            return;
          }
          // A refresh may have entered loading before a stale response arrived.
          // Return to the confirmed state instead of leaving the workspace busy.
          applySnapshot(replayConfirmedSnapshot(confirmed));
        }
        try {
          const current = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, { credentials: "same-origin", signal: controller.signal });
          const currentBody: unknown = await current.json().catch(() => null);
          if (!controller.signal.aborted) {
            setPermission(current.ok ? permissionFrom(currentBody) : "readonly"); setPermissionCheckState("complete");
            if (!current.ok) notify("error", "편집 권한 조회에 실패했습니다. 읽기 전용으로 표시합니다.", "편집 권한 조회", currentBody);
          }
        } catch {
          if (!controller.signal.aborted) {
            setPermission("readonly"); setPermissionCheckState("complete");
            notify("error", "편집 권한 조회에 실패했습니다. 네트워크 연결을 확인해 주세요.", "편집 권한 조회");
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
          notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "프로젝트 조회");
        }
      }
    })();
    return () => controller.abort();
  }, [publicId, retryKey, notify, applySnapshot]);

  const canonicalProjectName = state.status === "ready" ? state.snapshot.data.project.name : null;
  useEffect(() => {
    const title = canonicalProjectName?.trim() ? `masterGantt|${canonicalProjectName}` : "masterGantt";
    document.title = title;
    return () => {
      if (window.location.pathname === `/projects/${encodeURIComponent(publicId)}` && document.title === title) {
        document.title = "masterGantt";
      }
    };
  }, [publicId, canonicalProjectName]);

  function beginRefresh(clearNotice: boolean) {
    if (clearNotice) clearToast();
    setSettingsOpen(false); setUnlockOpen(false); setPendingTaskDelete(null); setPermission("readonly"); setPermissionCheckState("checking");
    setState({ status: "loading" }); setRetryKey((key) => key + 1);
  }
  async function fetchCanonicalSnapshot(signal?:AbortSignal, currentRequest?:()=>boolean): Promise<ProjectSnapshotResponse | null> {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, { credentials: "same-origin", cache: "no-store", signal });
      const body: unknown = await response.json().catch(() => null);
      return !signal?.aborted && (!currentRequest || currentRequest()) && response.ok && isSnapshot(body) && applySnapshot(body) ? body : null;
    } catch { return null; }
  }
  async function reloadCanonicalSnapshot(): Promise<boolean> { return (await fetchCanonicalSnapshot()) !== null; }
  async function refreshImportProject(signal:AbortSignal):Promise<boolean> {
    const context=importRefreshContext.current,target=publicId,id=++context.generation;
    if(context.publicId!==target||signal.aborted)return false;
    return (await fetchCanonicalSnapshot(signal,()=>context.publicId===target&&context.generation===id))!==null;
  }

  useEffect(() => {
    const key = projectRevisionStorageKey(publicId);

    const refreshToPendingRevision = async () => {
      if (crossTabRefreshInFlightReference.current || state.status !== "ready") return;
      crossTabRefreshInFlightReference.current = true;
      try {
        while (true) {
          const currentRevision = confirmedSnapshotReference.current?.data.project.revision ?? 0;
          const targetRevision = crossTabPendingRevisionReference.current;
          if (targetRevision <= currentRevision) break;

          const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, { credentials: "same-origin", cache: "no-store" });
          const body: unknown = await response.json().catch(() => null);
          if (!response.ok || !isSnapshot(body)) {
            notify("error", "다른 탭의 변경 사항을 확인하지 못했습니다. 페이지를 새로고침해 최신 정보를 확인해 주세요.", "최신 정보 확인", body);
            break;
          }

          const fetchedRevision = body.data.project.revision;
          if (!applySnapshot(body)) {
            notify("error", "다른 탭의 변경 사항을 현재 화면에 반영하지 못했습니다. 페이지를 새로고침해 최신 정보를 확인해 주세요.", "최신 정보 확인", body);
            break;
          }
          if (fetchedRevision >= crossTabDurableCatchUpRevisionReference.current) {
            crossTabDurableCatchUpRevisionReference.current = 0;
          }
          if (fetchedRevision <= currentRevision && crossTabPendingRevisionReference.current > fetchedRevision) {
            const targetRevision = crossTabPendingRevisionReference.current;
            const durableRevision = crossTabDurableCatchUpRevisionReference.current;
            if (shouldRetireDurableProjectRevision(
              durableRevision,
              targetRevision,
              currentRevision,
              fetchedRevision,
            )) {
              crossTabPendingRevisionReference.current = Math.max(currentRevision, fetchedRevision);
              crossTabDurableCatchUpRevisionReference.current = 0;
              try {
                const storedRevision = Number(window.localStorage.getItem(key));
                if (Number.isSafeInteger(storedRevision) && storedRevision <= durableRevision) {
                  window.localStorage.removeItem(key);
                }
              } catch {
                // Server revision remains authoritative even if storage cleanup fails.
              }
              break;
            }
            notify("error", "다른 탭의 최신 변경이 아직 조회되지 않았습니다. 페이지를 새로고침해 최신 정보를 확인해 주세요.", "최신 정보 확인");
            break;
          }
        }
      } catch {
        notify("error", "다른 탭의 변경 사항을 확인하지 못했습니다. 페이지를 새로고침해 최신 정보를 확인해 주세요.", "최신 정보 확인");
      } finally {
        crossTabRefreshInFlightReference.current = false;
      }
    };

    const mergeAnnouncement = (announcedValue: unknown, source: "live" | "durable") => {
      const currentRevision = confirmedSnapshotReference.current?.data.project.revision ?? 0;
      const previousPending = crossTabPendingRevisionReference.current;
      const nextPending = mergePendingProjectRevision(
        previousPending,
        currentRevision,
        announcedValue,
      );
      crossTabPendingRevisionReference.current = nextPending;
      const announcedRevision = Number(announcedValue);
      if (source === "durable" && nextPending > previousPending) {
        crossTabDurableCatchUpRevisionReference.current = Math.max(
          crossTabDurableCatchUpRevisionReference.current,
          nextPending,
        );
      } else if (
        source === "live" &&
        Number.isSafeInteger(announcedRevision) &&
        announcedRevision >= crossTabDurableCatchUpRevisionReference.current
      ) {
        crossTabDurableCatchUpRevisionReference.current = 0;
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      mergeAnnouncement(event.newValue, "live");
      if (state.status === "ready") void refreshToPendingRevision();
    };

    window.addEventListener("storage", handleStorage);
    // The storage event is not replayed when it fires before this effect installs
    // its listener. Register first, then read the durable localStorage value so
    // both "already happened" and "happens now" announcements converge into the
    // same pending revision without an event-loss window.
    try {
      mergeAnnouncement(window.localStorage.getItem(key), "durable");
    } catch {
      // Cross-tab freshness remains best-effort; server revision is authoritative.
    }
    // A revision event may have arrived while the initial load or beginRefresh
    // was still pending. Once a canonical snapshot makes the workspace ready,
    // converge immediately to the highest queued revision.
    if (state.status === "ready") void refreshToPendingRevision();
    return () => window.removeEventListener("storage", handleStorage);
  }, [publicId, state.status, applySnapshot, notify]);

  function syncScopeUrl(taskId: string | null): void {
    const target = new URL(window.location.href);
    if (taskId) target.searchParams.set("rootTask", taskId);
    else target.searchParams.delete("rootTask");
    window.history.replaceState(window.history.state, "", target.toString());
  }

  function focusScopeTab(taskId: string | null): void {
    requestAnimationFrame(() => {
      const tab = scopeTabReferences.current.get(scopeStateKey(taskId));
      tab?.focus({ preventScroll: true });
      tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function activateScope(taskId: string | null, focus = true, rememberCurrent = true): void {
    if (rememberCurrent) scopeTaskFiltersReference.current.set(scopeStateKey(activeRootTaskId), taskFilter);
    setTaskFilter(scopeTaskFiltersReference.current.get(scopeStateKey(taskId)) ?? EMPTY_TASK_FILTER);
    setTaskFilterOpen(false);
    setActiveRootTaskId(taskId);
    syncScopeUrl(taskId);
    if (focus) focusScopeTab(taskId);
  }

  function closeScopeTab(taskId: string): void {
    const index = openScopeTaskIds.indexOf(taskId);
    if (index < 0) return;
    const nextOpen = openScopeTaskIds.filter((candidate) => candidate !== taskId);
    setOpenScopeTaskIds(nextOpen);
    if (activeRootTaskId === taskId) {
      const fallback = nextOpen[index] ?? nextOpen[index - 1] ?? null;
      activateScope(fallback, true, false);
    } else focusScopeTab(activeRootTaskId);
    scopeTaskFiltersReference.current.delete(scopeStateKey(taskId));
  }

  function handleScopeTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, current: string | null): void {
    if (event.key === "Delete" && current !== null) { event.preventDefault(); closeScopeTab(current); return; }
    const scopes: Array<string | null> = [null, ...openScopeTaskIds];
    const index = scopes.indexOf(current);
    let next: string | null | undefined;
    if (event.key === "ArrowRight") next = scopes[(index + 1) % scopes.length];
    else if (event.key === "ArrowLeft") next = scopes[(index - 1 + scopes.length) % scopes.length];
    else if (event.key === "Home") next = scopes[0];
    else if (event.key === "End") next = scopes[scopes.length - 1];
    else return;
    event.preventDefault(); activateScope(next ?? null);
  }

  function openTaskAsRoot(taskId: string): void {
    setOpenScopeTaskIds((current) => current.includes(taskId) ? current : [...current, taskId]);
    setActiveView("schedule");
    setScheduleView("gantt");
    activateScope(taskId);
  }

  function conflict(operation: string, body?: unknown) {
    setPermission("readonly");
    notify("error", "다른 편집 내용이 먼저 저장되었습니다. 최신 정보를 다시 불러옵니다. 내용을 확인한 뒤 다시 저장해 주세요.", operation, body);
    beginRefresh(false);
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUnlocking) return;
    if (!unlockPasswordValid(unlockPassword)) {
      notify("error", "편집 비밀번호를 입력해 주세요.", "편집 잠금 해제");
      setUnlockPassword(""); return;
    }
    clearToast(); setIsUnlocking(true);
    const password = unlockPassword; setUnlockPassword("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editPassword: password }),
      });
      if (response.status === 204) {
        const current = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, { credentials: "same-origin" });
        const body: unknown = await current.json().catch(() => null);
        if (current.ok && permissionFrom(body) === "edit") {
          focusSettingsAfterUnlockReference.current = true; setUnlockOpen(false); setPermission("edit"); setPermissionCheckState("complete"); notify("success", "편집 모드가 활성화되었습니다.", "편집 잠금 해제");
        } else {
          setPermission("readonly"); setPermissionCheckState("complete"); notify("error", "편집 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", "편집 잠금 해제", body);
        }
      } else {
        setPermission("readonly"); setPermissionCheckState("complete");
        const body: unknown = await response.json().catch(() => null);
        notify("error", response.status === 401 ? "편집 비밀번호가 올바르지 않습니다. 다시 확인해 주세요."
          : safeErrorCode(body) === "RATE_LIMITED" ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "편집 모드를 활성화할 수 없습니다. 잠시 후 다시 시도해 주세요.", "편집 잠금 해제", body);
      }
    } catch {
      setPermission("readonly"); setPermissionCheckState("complete"); notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "편집 잠금 해제");
    } finally { setUnlockPassword(""); setIsUnlocking(false); }
  }

  function closeSettingsAsReadonly() {
    focusUnlockAfterSettingsReference.current = true;
    setPermission("readonly");
    setPermissionCheckState("complete");
    setSettingsOpen(false);
  }

  async function changeHeaderStatus(nextStatus: ProjectStatus) {
    if (state.status !== "ready" || permission !== "edit" || permissionCheckState !== "complete" || isSavingStatus) return;
    if (nextStatus === state.snapshot.data.project.status) return;
    setIsSavingStatus(true);
    clearToast();
    try {
      const { response, body, mutation } = await patchProjectStatus(
        publicId,
        state.snapshot.data.project.revision,
        nextStatus,
      );
      if (response.ok && mutation) {
        applySnapshot(projectSnapshotFromStatusMutation(mutation));
        notify("success", `프로젝트 상태를 ${projectStatusLabel(mutation.data.project.status)}(으)로 변경했습니다.`, "프로젝트 상태 변경");
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setPermission("readonly");
        setPermissionCheckState("complete");
        notify("error", "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.", "프로젝트 상태 변경", body);
        return;
      }
      if (response.status === 412) {
        const recovered = await reloadCanonicalSnapshot();
        notify("error", recovered
          ? "다른 편집 내용이 먼저 저장되었습니다. 최신 프로젝트 상태를 반영했습니다. 확인 후 다시 변경해 주세요."
          : "다른 편집 내용이 먼저 저장되었지만 최신 프로젝트 상태를 불러오지 못했습니다. 다시 조회해 주세요.",
        "프로젝트 상태 변경", body);
        return;
      }
      await reloadCanonicalSnapshot();
      notify("error", "프로젝트 상태를 변경할 수 없습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.", "프로젝트 상태 변경", body);
    } catch {
      await reloadCanonicalSnapshot();
      notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "프로젝트 상태 변경");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== "ready" || isSavingMetadata) return;
    if (!metadataName.trim()) { notify("error", "프로젝트 이름을 입력해 주세요.", "프로젝트 정보 저장"); return; }
    setIsSavingMetadata(true); clearToast();
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": revisionTag(state.snapshot.data.project.revision) },
        body: JSON.stringify({
          name: metadataName,
          description: metadataDescription,
          status: metadataStatus,
          businessUnitId: masterSelection.businessUnitId || null,
          productId: masterSelection.productId || null,
          siteEntityId: masterSelection.siteEntityId || null,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      const snapshot = snapshotFromMetadataMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        setSettingsOpen(false); notify("success", "프로젝트 정보를 저장했습니다.", "프로젝트 정보 저장");
      } else if (response.status === 401) {
        closeSettingsAsReadonly(); notify("error", "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.", "프로젝트 정보 저장", body);
      } else if (response.status === 412) conflict("프로젝트 정보 저장", body);
      else notify("error", "프로젝트 정보를 저장할 수 없습니다. 입력을 확인한 뒤 다시 시도해 주세요.", "프로젝트 정보 저장", body);
    } catch { notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "프로젝트 정보 저장"); }
    finally { setIsSavingMetadata(false); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== "ready" || isChangingPassword) return;
    if (!newPasswordValid(newPassword)) {
      notify("error", "새 편집 비밀번호는 1~12자로 입력해 주세요.", "편집 비밀번호 변경"); setNewPassword(""); return;
    }
    setIsChangingPassword(true); clearToast();
    const password = newPassword; setNewPassword("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-password`, {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": revisionTag(state.snapshot.data.project.revision) },
        body: JSON.stringify({ newEditPassword: password }),
      });
      if (response.status === 204) {
        notify("success", "편집 비밀번호를 변경했습니다.", "편집 비밀번호 변경"); beginRefresh(false);
      } else {
        const body: unknown = await response.json().catch(() => null);
        if (response.status === 401) {
          closeSettingsAsReadonly(); notify("error", "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.", "편집 비밀번호 변경", body);
        } else if (response.status === 412) conflict("편집 비밀번호 변경", body);
        else notify("error", "편집 비밀번호를 변경할 수 없습니다. 입력을 확인한 뒤 다시 시도해 주세요.", "편집 비밀번호 변경", body);
      }
    } catch { notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "편집 비밀번호 변경"); }
    finally { setNewPassword(""); setIsChangingPassword(false); }
  }
  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true); clearToast();
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, { method: "DELETE", credentials: "same-origin" });
      if (response.status === 204) {
        closeSettingsAsReadonly(); notify("success", "편집 모드를 종료했습니다.", "편집 모드 종료");
      } else {
        const body: unknown = await response.json().catch(() => null); notify("error", "편집 모드를 종료할 수 없습니다. 잠시 후 다시 시도해 주세요.", "편집 모드 종료", body);
      }
    } catch { notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "편집 모드 종료"); }
    finally { setIsLoggingOut(false); }
  }

  async function handleTaskFailure(status: number | undefined, error: unknown, fallback: string, operation: string): Promise<string> {
    if (status === 401) { setPermission("readonly"); setPermissionCheckState("complete"); }
    const recovered = await reloadCanonicalSnapshot();
    // Recovery belongs to this request. Never remount or replay an older render's
    // snapshot: previous successful mutations remain confirmed even if GET fails.
    if (!recovered && confirmedSnapshotReference.current) {
      applySnapshot(replayConfirmedSnapshot(confirmedSnapshotReference.current));
    }
    const code = safeErrorCode(error);
    let message = fallback;
    if (status === 401) message = "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.";
    else if (status === 412) message = recovered
      ? "다른 편집 내용이 먼저 저장되었습니다. 최신 정보를 불러왔습니다. 내용을 확인한 뒤 다시 저장해 주세요."
      : "다른 편집 내용이 먼저 저장되었지만 최신 정보를 불러오지 못했습니다. 마지막 확인 일정으로 복구했습니다. 다시 조회해 주세요.";
    else if (status === 400 || status === 409 || status === 422) message = code === "MANUAL_DEPENDENCY_CONFLICT"
      ? "수동 일정이 관계 조건을 만족하지 않습니다. 요청 시작일·기간 또는 관계 설정을 확인해 주세요. 입력 내용은 유지됩니다."
      : code === "RESOURCE_ASSIGNMENT_SCHEDULE_CONFLICT"
      ? "변경된 일정이 리소스 배정 기간을 벗어납니다. 일정이나 리소스 배정 기간을 확인해 주세요. 입력 내용은 유지됩니다."
      : code === "UNSUPPORTED_SCHEDULE_STRUCTURE"
      ? "관계가 연결된 작업은 이 방법으로 변경할 수 없습니다. 최신 일정을 확인해 주세요."
      : code === "END_DURATION_MISMATCH"
      ? "일정 기간을 확인해 주세요."
      : code === "EMPTY_SUMMARY_NOT_ALLOWED" ? "선택 범위를 삭제하면 상위 요약 작업이 비게 됩니다. 상위 작업 구조를 먼저 변경해 주세요."
        : code === "SUMMARY_DELETE_UNSUPPORTED" ? "하위 작업이 있는 작업은 우클릭 메뉴에서 하위 작업 포함 삭제를 확인해 주세요."
          : code === "PARENT_CONVERSION_REQUIRED" ? "부모 작업 전환을 처리하지 못했습니다. 최신 정보를 확인한 뒤 다시 추가해 주세요."
            : code === "INVALID_PARENT_TASK" ? "마일스톤에는 하위 작업을 추가할 수 없습니다."
              : "작업 정보를 저장할 수 없습니다. 입력과 일정 제약을 확인해 주세요.";
    if (!recovered && status !== 412) message += " 최신 일정 조회에 실패하여 마지막으로 확인한 일정을 유지합니다. 다시 조회해 주세요.";
    notify("error", message, operation, error);
    return message;
  }
  async function saveTask(method: "POST" | "PATCH" | "DELETE", taskId: string | null, payload?: unknown, expectedRevision?: number, includeDescendants = false): Promise<TaskEditorSaveResult> {
    if (state.status !== "ready" || taskMutationReference.current) return { status: "failed", message: "다른 작업을 저장 중입니다. 완료 후 다시 시도해 주세요." };
    if (expectedRevision !== undefined && expectedRevision !== state.snapshot.data.project.revision) {
      return { status: "failed", conflict: true, message: "기준 Revision이 변경되었습니다. 최신 정보를 다시 불러온 뒤 검토해 주세요." };
    }
    taskMutationReference.current = true; setIsSavingTask(true); clearToast();
    const operation = method === "POST" ? "작업 추가" : method === "DELETE" ? "작업 삭제" : "작업 저장";
    try {
      const baseEndpoint = taskId === null ? `/api/projects/${encodeURIComponent(publicId)}/tasks` : `/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}`;
      const endpoint = method === "DELETE" && includeDescendants ? `${baseEndpoint}?includeDescendants=true` : baseEndpoint;
      const response = await fetch(endpoint, {
        method, credentials: "same-origin",
        headers: { ...(method === "DELETE" ? {} : { "Content-Type": "application/json" }), "If-Match": revisionTag(expectedRevision ?? state.snapshot.data.project.revision) },
        ...(method === "DELETE" ? {} : { body: JSON.stringify(payload) }),
      });
      const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
      const snapshot = snapshotFromTaskMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        const current = snapshot.data.tasks.find((task) => task.taskId === editorSession?.task.taskId);
        if (current) projectTaskEditorReference.current?.applyCanonicalSession({ task: current, calendar: snapshot.data.project.calendar, revision: snapshot.data.project.revision });
        const success = method === "POST" ? "작업을 추가했습니다." : method === "DELETE" ? "작업을 삭제했습니다." : "작업을 저장했습니다.";
        const shifted = (body as TaskMutationResponse).data.warnings.some((warning) => warning.code === "NON_WORKING_START_SHIFTED");
        const beforeTasks = new Map(state.snapshot.data.tasks.map((task) => [task.taskId, task]));
        const successors = snapshot.data.tasks.filter((task) => {
          const before = beforeTasks.get(task.taskId);
          return task.type !== "summary" && task.taskId !== taskId && before &&
            (before.start !== task.start || before.end !== task.end || before.duration !== task.duration);
        });
        const currentTask = snapshot.data.tasks.find((task) => task.taskId === taskId);
        const adjusted = currentTask?.requestedStart && currentTask.requestedStart !== currentTask.start
          ? ` 요청 시작일 ${currentTask.requestedStart} → 적용 시작일 ${currentTask.start}.` : "";
        const changed = successors.length ? ` 후행 작업 ${successors.length}건의 일정이 조정되었습니다: ${successors.slice(0, 3).map((task) => `${task.name} (${task.externalId})`).join(", ")}${successors.length > 3 ? ` 외 ${successors.length - 3}건` : ""}.` : "";
        notify("success", `${success}${shifted ? " 비근무일 시작은 다음 근무일로 조정되었습니다." : ""}${adjusted}${changed}`, operation);
        return { status: "saved" };
      }
      if (expectedRevision !== undefined) {
        if (response.status === 401) { setPermission("readonly"); setPermissionCheckState("complete"); }
        return { status: "failed", conflict: response.status === 412, message: response.status === 412 ? "기준 Revision이 변경되었습니다. 입력은 유지됩니다. 최신 정보를 명시적으로 불러온 뒤 검토해 주세요." : response.status === 401 ? "편집 권한이 만료되었습니다. 입력은 유지됩니다." : "작업 정보를 저장할 수 없습니다. 완료 조건·잠금과 입력을 확인해 주세요. 입력은 유지됩니다." };
      }
      const message = await handleTaskFailure(response.status, body, "작업을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.", operation);
      return { status: "failed", message, conflict: response.status === 412 };
    } catch {
      if (expectedRevision !== undefined) return { status: "failed", message: "네트워크 연결을 확인해 주세요. 입력은 유지되며 자동으로 다시 보내지 않습니다." };
      const message = await handleTaskFailure(undefined, null, "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", operation);
      return { status: "failed", message };
    } finally { taskMutationReference.current = false; setIsSavingTask(false); }
  }

  async function performTaskHierarchyCommand(command: TaskHierarchyCommandRequest, expectedRevision: number): Promise<{ ok: boolean; error?: string }> {
    if (state.status !== "ready" || permission !== "edit" || permissionCheckState !== "complete" || taskMutationReference.current || editorSession || settingsOpen || importPending || isSavingMetadata || isSavingStatus || isChangingPassword || isLoggingOut) return { ok:false, error:"편집 권한 또는 다른 작업의 초안·저장 상태를 확인해 주세요." };
    if (state.snapshot.data.project.revision !== expectedRevision) return { ok:false, error:"검토 이후 프로젝트가 변경되었습니다. 최신 일정에서 다시 복사해 주세요." };
    taskMutationReference.current = true; setIsSavingTask(true); clearToast();
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/task-commands`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type":"application/json", "If-Match":revisionTag(expectedRevision) }, body:JSON.stringify(command),
      });
      const body: unknown = await response.json().catch(() => null), snapshot = snapshotFromTaskMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        notify("success", "작업 구조를 변경했습니다.", "작업 메뉴"); return { ok:true };
      }
      const error = await handleTaskFailure(response.status, body, "작업 구조를 변경할 수 없습니다.", "작업 메뉴");
      return { ok:false, error };
    } catch {
      const error = await handleTaskFailure(undefined, null, "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "작업 메뉴");
      return { ok:false, error };
    } finally { taskMutationReference.current = false; setIsSavingTask(false); }
  }

  async function saveTaskHierarchyCommand(command: TaskHierarchyCommandRequest): Promise<void> {
    if (state.status !== "ready" || permission !== "edit" || permissionCheckState !== "complete" || busy || editorSession || settingsOpen || copyReview) return;
    const revision = state.snapshot.data.project.revision;
    if (command.kind === "copy") {
      try {
        const plan = previewMembershipCopy(state.snapshot.data.tasks, state.snapshot.data.links, command);
        if (plan.requiresAcknowledgement) {
          copyReviewTriggerReference.current = findTaskContextElement(document.body, command.anchorTaskId);
          setCopyReviewError(null); setCopyReview({ publicId, revision, command, plan }); return;
        }
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "INVALID_COPY_MEMBERSHIP_SNAPSHOT";
        notify("error", code === "TASK_COPY_TASK_LIMIT_EXCEEDED" ? "복사 후 프로젝트의 작업 수가 최대 5000개를 초과합니다." : code === "COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED" ? "완료 단계의 구성원·소속·관계를 온전히 보존할 수 없어 복사할 수 없습니다." : code === "COMPLETED_MILESTONE_STRUCTURE_LOCKED" ? "완료 단계의 구성이 변경되는 복사는 잠겨 있습니다." : "현재 소속 정보를 안전하게 확인할 수 없습니다. 최신 일정을 조회해 주세요.", "작업 복사", { code }); return;
      }
    }
    await performTaskHierarchyCommand(command, revision);
  }

  function closeCopyReview() {
    if (taskMutationReference.current || copyConfirmationReference.current) return;
    setCopyReview(null); setCopyReviewError(null);
  }
  async function confirmMembershipCopy() {
    if (!copyReview || copyConfirmationReference.current || state.status !== "ready") return;
    copyConfirmationReference.current = true;
    try {
      const plan = previewMembershipCopy(state.snapshot.data.tasks, state.snapshot.data.links, copyReview.command);
      if (!copyReviewMatches(copyReview, publicId, state.snapshot.data.project.revision, copyReview.command, plan)) { setCopyReviewError("검토 이후 복사 조건이 변경되었습니다. 취소 후 다시 복사해 주세요."); return; }
      const result = await performTaskHierarchyCommand({ ...copyReview.command, acknowledgedMembershipExclusions:true }, copyReview.revision);
      if (result.ok) { setCopyReview(null); setCopyReviewError(null); } else setCopyReviewError(result.error ?? "복사하지 못했습니다. 자동으로 다시 보내지 않습니다.");
    } catch { setCopyReviewError("현재 소속을 안전하게 확인할 수 없습니다. 취소 후 최신 일정에서 다시 복사해 주세요."); }
    finally { copyConfirmationReference.current = false; }
  }

  function openTaskEditor(taskId: string, initialTab: "task" | "memberships" = "task") {
    if (state.status !== "ready" || busy || editorSession || editorOpeningReference.current || settingsOpen || pendingTaskDelete) return;
    const task = state.snapshot.data.tasks.find((entry) => entry.taskId === taskId);
    if (!task) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditorInitialTab(initialTab);
    editorOriginViewReference.current = activeView;
    editorOpeningReference.current = true;
    editorTriggerReference.current = trigger;
    setEditorSession({ task: { ...task }, calendar: state.snapshot.data.project.calendar, revision: state.snapshot.data.project.revision });
  }
  function closeTaskEditor() {
    const taskId = editorSession?.task.taskId;
    const trigger = editorTriggerReference.current;
    setEditorSession(null);
    setActiveView(editorOriginViewReference.current);
    editorOpeningReference.current = false;
    requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>(".project-gantt-scroll");
      const target = trigger?.isConnected ? trigger : root && taskId ? findTaskContextElement(root, taskId) ?? root : root;
      target?.focus({ preventScroll: true });
    });
  }
  function openRelationEditor(linkId: string) {
    if (state.status !== "ready" || relationEditorRequest) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    relationEditorTriggerReference.current = trigger;
    setRelationEditorRequest({ kind: "link", linkId });
  }
  function openTaskRelationEditor(request: TaskRelationEditorRequest, trigger: HTMLElement) {
    if (state.status !== "ready" || relationEditorRequest || !editorSession) return;
    relationEditorTriggerReference.current = trigger;
    setRelationEditorRequest(request);
  }
  function closeRelationEditor() {
    const trigger = relationEditorTriggerReference.current;
    setRelationEditorRequest(null);
    relationEditorTriggerReference.current = null;
    requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>(".project-gantt-scroll");
      const target = trigger?.isConnected && !trigger.closest(".project-relation-context-menu") ? trigger : root;
      target?.focus({ preventScroll: true });
    });
  }

  async function saveEditorTask(command: ProjectTaskUpdateCommand, revision: number): Promise<TaskEditorSaveResult> {
    if (state.status !== "ready") return { status: "failed", message: "프로젝트 정보를 확인할 수 없습니다." };
    const task = state.snapshot.data.tasks.find((entry) => entry.taskId === command.taskId);
    const restriction = taskEditorReadOnlyReason(task, permission === "edit" && permissionCheckState === "complete", false);
    if (restriction) return { status: "failed", message: restriction };
    if (isSavingMetadata || isSavingStatus || isChangingPassword || isLoggingOut) return { status: "failed", message: "프로젝트 변경을 완료한 뒤 다시 시도해 주세요." };
    return saveTask("PATCH", command.taskId, command.payload, revision);
  }
  async function saveEditorMemberships(command: import("@/contracts/milestones").MilestoneMembershipCommand, expectedRevision: number): Promise<TaskEditorSaveResult> {
    if (state.status !== "ready" || permission !== "edit" || permissionCheckState !== "complete" || taskMutationReference.current) return { status: "failed", message: "편집 권한 또는 저장 상태를 확인해 주세요." };
    if (expectedRevision !== state.snapshot.data.project.revision) return { status: "failed", conflict: true, message: "기준 Revision이 변경되었습니다. 초안을 검토한 뒤 최신 정보를 다시 불러와 주세요." };
    taskMutationReference.current = true; setIsSavingTask(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/milestone-memberships`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": revisionTag(expectedRevision) }, body: JSON.stringify(command) });
      const body: unknown = await response.json().catch(() => null);
      const snapshot = snapshotFromTaskMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        const current = snapshot.data.tasks.find((task) => task.taskId === editorSession?.task.taskId);
        if (current) projectTaskEditorReference.current?.applyCanonicalSession({ task: current, calendar: snapshot.data.project.calendar, revision: snapshot.data.project.revision });
        notify("success", "소속 변경을 적용했습니다.", "완료 단계 소속");
        return { status: "saved" };
      }
      if (response.status === 401) { setPermission("readonly"); }
      return { status: "failed", conflict: response.status === 412, message: response.status === 412 ? "기준 Revision이 변경되었습니다. 초안은 유지됩니다. 최신 정보를 명시적으로 조회하여 검토해 주세요." : response.status === 401 ? "편집 권한이 만료되었습니다. 초안은 유지됩니다." : "소속 변경을 적용할 수 없습니다. 완료 단계 잠금과 입력을 확인해 주세요. 초안은 유지됩니다." };
    } catch { return { status: "failed", message: "네트워크 연결을 확인해 주세요. 검색과 초안은 유지됩니다. 자동으로 다시 보내지 않습니다." }; }
    finally { taskMutationReference.current = false; setIsSavingTask(false); }
  }
  function navigateEditorTask(taskId: string) {
    if (state.status !== "ready") return;
    const task = state.snapshot.data.tasks.find((entry) => entry.taskId === taskId);
    if (task) setEditorSession({ task: { ...task }, calendar: state.snapshot.data.project.calendar, revision: state.snapshot.data.project.revision });
  }
  function locateEditorTask(taskId: string) {
    const fromOtherView = editorOriginViewReference.current !== "schedule";
    editorOriginViewReference.current = "schedule";
    closeTaskEditor();
    if (scheduleView === "milestones" || fromOtherView) drillDashboardSchedule([taskId]);
    requestAnimationFrame(() => { const root = document.querySelector<HTMLElement>(".project-gantt-scroll"); const target = root ? findTaskContextElement(root, taskId) : null; target?.scrollIntoView({ block: "nearest", inline: "nearest" }); target?.focus({ preventScroll: true }); });
  }
  async function reloadEditorTask(taskId: string): Promise<TaskEditorSession | null> {
    const snapshot = await fetchCanonicalSnapshot();
    const task = snapshot?.data.tasks.find((entry) => entry.taskId === taskId);
    return task && snapshot ? { task: { ...task }, calendar: snapshot.data.project.calendar, revision: snapshot.data.project.revision } : null;
  }
  function createNativeTask(command: ProjectTaskCreateCommand) {
    if (state.status !== "ready" || taskMutationReference.current || pendingTaskDelete) return;
    const parent = command.parentTaskId ? state.snapshot.data.tasks.find((task) => task.taskId === command.parentTaskId) : undefined;
    if (command.parentTaskId && !parent) { notify("error", "선택한 작업을 찾을 수 없습니다. 최신 정보를 불러온 뒤 다시 시도해 주세요.", "하위 작업 추가"); return; }
    if (parent?.type === "milestone") { notify("error", "마일스톤에는 하위 작업을 추가할 수 없습니다.", "하위 작업 추가"); return; }
    const convert = parent?.type === "task" && !state.snapshot.data.tasks.some((task) => task.parentExternalId === parent.externalId);
    void saveTask("POST", null, { ...command,
      ...(command.type === "summary" ? { name: "새 요약 작업" } : { name: "새 작업", start: todayLocalDateString(), duration: 1 }),
      ...(convert ? { convertParentToSummary: true } : {}) });
  }
  function requestTaskDelete(taskId: string, trigger: HTMLElement | null) {
    if (state.status !== "ready" || permission !== "edit" || permissionCheckState !== "complete" || taskMutationReference.current || editorSession || settingsOpen) return;
    const plan = createTaskDeletePlan(state.snapshot.data.tasks, taskId);
    if (!plan) { notify("error", "삭제할 작업을 찾을 수 없습니다. 최신 정보를 다시 확인해 주세요.", "작업 삭제"); return; }
    const deleteTaskIds = [plan.taskId, ...plan.descendantTaskIds];
    if (deleteTaskIds.some((candidate) => taskHasDependencyLinks(state.snapshot.data.tasks, candidate, state.snapshot.data.links))) {
      notify("info", "관계가 연결된 작업이 삭제 범위에 포함되어 있어 삭제할 수 없습니다.", "작업 삭제");
      return;
    }
    deleteTriggerReference.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (plan.descendantTaskIds.length === 0) {
      void saveTask("DELETE", taskId);
      return;
    }
    setPendingTaskDelete({ ...plan, revision: state.snapshot.data.project.revision });
  }
  async function confirmTaskDelete() {
    const pending = pendingTaskDelete;
    if (!pending) return;
    const result = await saveTask("DELETE", pending.taskId, undefined, pending.revision, true);
    if (result.status === "saved" || result.conflict) setPendingTaskDelete(null);
  }
  function rejectNativeTaskAdd(reason: "scope" | "missing" | "milestone") {
    if (reason === "milestone") {
      notify("error", "마일스톤에는 하위 작업을 추가할 수 없습니다.", "하위 작업 추가");
      return;
    }
    if (reason === "missing") {
      notify("error", "선택한 작업을 찾을 수 없습니다. 최신 정보를 불러온 뒤 다시 시도해 주세요.", "하위 작업 추가");
      return;
    }
    notify("info", "이 화면에서는 하위 작업만 추가할 수 있습니다.", "작업 추가");
  }
  const recoverCanonicalGantt = useCallback(() => {
    setGanttResetGeneration((generation) => generation + 1);
    notify("error", "일정 화면을 최신 서버 정보로 복구했습니다.", "일정 화면 복구");
  }, [notify]);
  function saveTaskCommand(command: ProjectTaskUpdateCommand, expectedRevision?: number): Promise<TaskEditorSaveResult> {
    if (Object.keys(command.payload).length > 0) return saveTask("PATCH", command.taskId, command.payload, expectedRevision);
    return Promise.resolve({ status: "failed", message: "변경할 작업 정보가 없습니다." });
  }

  async function saveLink(
    method: "POST" | "DELETE" | "PATCH",
    sourceTaskId?: string,
    targetTaskId?: string,
    linkId?: string,
    linkPatch?: { type?: DependencyType; lag?: number },
  ): Promise<boolean> {
    if (state.status !== "ready" || permission !== "edit" || permissionCheckState !== "complete" || taskMutationReference.current) return false;
    const canonicalTasks = state.snapshot.data.tasks;
    if (method === "POST" && !canCreateSchedulingLink(canonicalTasks.find((task) => task.taskId === sourceTaskId), canonicalTasks.find((task) => task.taskId === targetTaskId))) { notify("error", MIXED_LINK_EXPLANATION, "일정 관계 연결 제한"); return false; }
    if (method !== "POST" && linkStructureLocked(state.snapshot.data.links.find((link) => link.id === linkId), canonicalTasks)) { notify("error", COMPLETED_LINK_EXPLANATION, "완료 단계 잠금"); return false; }
    taskMutationReference.current = true; setIsSavingTask(true); clearToast();
    try {
      const source = sourceTaskId ? state.snapshot.data.tasks.find((task) => task.taskId === sourceTaskId) : undefined;
      const target = targetTaskId ? state.snapshot.data.tasks.find((task) => task.taskId === targetTaskId) : undefined;
      if (method === "POST" && (!source || !target)) throw new Error("TASK_MAPPING");
      const url = method === "POST"
        ? `/api/projects/${encodeURIComponent(publicId)}/links`
        : `/api/projects/${encodeURIComponent(publicId)}/links/${encodeURIComponent(linkId ?? "")}`;
      const response = await fetch(url, {
        method, credentials: "same-origin",
        headers: {
          ...(method === "POST" || method === "PATCH" ? { "Content-Type": "application/json" } : {}),
          "If-Match": revisionTag(state.snapshot.data.project.revision),
        },
        ...(method === "POST" ? { body: JSON.stringify({
          predecessorExternalId: source!.externalId,
          successorExternalId: target!.externalId,
          type: linkPatch?.type ?? "FS",
          lag: linkPatch?.lag ?? 0,
        }) } : method === "PATCH" ? { body: JSON.stringify(linkPatch ?? {}) } : {}),
      });
      const body: unknown = await response.json().catch(() => null);
      const snapshot = snapshotFromLinkMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        const currentEditorTaskId = editorSession?.task.taskId;
        const currentEditorTask = currentEditorTaskId
          ? snapshot.data.tasks.find((task) => task.taskId === currentEditorTaskId)
          : undefined;
        if (currentEditorTask) {
          projectTaskEditorReference.current?.applyCanonicalSession({
            task: { ...currentEditorTask },
            calendar: snapshot.data.project.calendar,
            revision: snapshot.data.project.revision,
          });
        }
        notify("success", method === "POST" ? "작업 관계를 저장했습니다." : method === "PATCH" ? "작업 관계를 변경했습니다." : "작업 관계를 삭제했습니다.", "작업 관계");
        return true;
      }
      await handleTaskFailure(response.status, body, "작업 관계를 변경할 수 없습니다.", "작업 관계");
      return false;
    } catch {
      await handleTaskFailure(undefined, null, "작업 관계를 변경하지 못했습니다. 최신 서버 상태로 복구합니다.", "작업 관계");
      return false;
    } finally {
      taskMutationReference.current = false; setIsSavingTask(false);
    }
  }

  function activateWorkspaceView(view: "schedule" | "resources" | "logistics") {
    setActiveView(view);
    requestAnimationFrame(() => {
      const ref = view === "schedule" ? scheduleTabReference.current : view === "resources" ? resourceTabReference.current : logisticsTabReference.current;
      ref?.focus({ preventScroll: true });
    });
  }
  function activateScheduleView(view: "gantt" | "milestones") {
    if (scheduleView === "gantt" && view === "milestones") {
      const panel = scheduleGanttPanel.current;
      peerViewport.current = { publicId, rootTaskId: activeRootTaskId, filter: taskFilter, positions: [".project-gantt-scroll", ".wx-gantt", ".wx-chart", ".wx-table-container"].flatMap((selector) => {
        const owner = panel?.querySelector<HTMLElement>(selector);
        return owner ? [{ selector, left: owner.scrollLeft, top: owner.scrollTop }] : [];
      }) };
      const chart = panel?.querySelector<HTMLElement>(".wx-chart");
      if (chart) setPeerChartRestore({ key: `${publicId}:${activeRootTaskId ?? ""}:${JSON.stringify(taskFilter)}`, left: chart.scrollLeft, top: panel?.querySelector<HTMLElement>(".wx-gantt")?.scrollTop ?? 0 });
    }
    setScheduleView(view);
    requestAnimationFrame(() => schedulePeerReferences.current[view]?.focus({ preventScroll: true }));
  }
  function handleScheduleViewKey(event: ReactKeyboardEvent<HTMLButtonElement>, view: "gantt" | "milestones") {
    const next = event.key === "Home" ? "gantt" : event.key === "End" ? "milestones" : event.key === "ArrowLeft" || event.key === "ArrowRight" ? view === "gantt" ? "milestones" : "gantt" : null;
    if (next) { event.preventDefault(); activateScheduleView(next); }
  }
  function drillDashboardSchedule(taskIds: string[]) {
    if (busy || state.status !== "ready") return;
    if (!previousDashboardDrill) setPreviousDashboardDrill({ rootTaskId: activeRootTaskId, filter: taskFilter });
    activateScope(null, false);
    setTaskFilter({ ...EMPTY_TASK_FILTER, taskIds: [...new Set(taskIds)] });
    setActiveView("schedule"); activateScheduleView("gantt");
  }
  function restoreDashboardDrill() {
    if (!previousDashboardDrill) return;
    activateScope(previousDashboardDrill.rootTaskId, false);
    setTaskFilter(previousDashboardDrill.filter); setPreviousDashboardDrill(null);
    activateScheduleView("gantt");
  }
  function handleWorkspaceTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, current: "schedule" | "resources" | "logistics") {
    const views: Array<"schedule" | "resources" | "logistics"> = ["schedule", "resources", "logistics"];
    const idx = views.indexOf(current);
    let next: "schedule" | "resources" | "logistics" | null = null;
    if (event.key === "ArrowRight") next = views[(idx + 1) % views.length];
    else if (event.key === "ArrowLeft") next = views[(idx - 1 + views.length) % views.length];
    else if (event.key === "Home") next = views[0];
    else if (event.key === "End") next = views[views.length - 1];
    if (!next) return;
    event.preventDefault();
    activateWorkspaceView(next);
  }

  useEffect(() => {
    const saved = peerViewport.current;
    if (activeView !== "schedule" || scheduleView !== "gantt" || !saved) return;
    peerViewport.current = null;
    // Explicit ID/scope drills own their new viewport. Only a plain peer return
    // restores native DOM scroll, after Core has resized the visible frame.
    if (saved.publicId !== publicId || saved.rootTaskId !== activeRootTaskId || saved.filter !== taskFilter) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const panel = scheduleGanttPanel.current;
        if (!panel || panel.hidden) return;
        for (const position of saved.positions) {
          const owner = panel.querySelector<HTMLElement>(position.selector);
          if (owner) { owner.scrollLeft = position.left; owner.scrollTop = position.top; }
        }
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [activeView, scheduleView, publicId, activeRootTaskId, taskFilter]);

  if (state.status === "loading") return <section className="loading-state" aria-busy="true" aria-live="polite"><span className="loading-indicator" aria-hidden="true" /><p>프로젝트 정보를 불러오는 중입니다.</p></section>;
  if (state.status === "not-found") return <section className="status-page" aria-labelledby="project-not-found-heading"><p className="eyebrow">404</p><h1 id="project-not-found-heading">프로젝트를 찾을 수 없습니다.</h1><p>프로젝트 주소를 확인해 주세요.</p></section>;
  if (state.status === "error") return <section className="status-page" aria-labelledby="project-load-error-heading"><p className="eyebrow">PROJECT</p><h1 id="project-load-error-heading">프로젝트를 불러올 수 없습니다.</h1><p>네트워크 또는 서버 상태를 확인한 뒤 다시 시도해 주세요.</p><div className="standalone-actions"><button className="secondary-button" onClick={() => beginRefresh(true)} type="button">다시 시도</button></div></section>;
  const { project, tasks, links, assignments, logistics } = state.snapshot.data;
  const subtreeScope = resolveTaskSubtreeScope(tasks, activeRootTaskId);
  const scopedTaskIdSet = subtreeScope.kind === "valid" ? new Set(subtreeScope.taskIds) : null;
  const scopedTasks = subtreeScope.kind === "all"
    ? tasks
    : subtreeScope.kind === "valid"
      ? tasks.filter((task) => scopedTaskIdSet?.has(task.taskId))
      : [];
  const filteredTasks = filterTasksWithAncestors(scopedTasks, taskFilter, assignments, logistics, tasks);
  const activeFilters = activeTaskFilterCount(taskFilter);
  const quickView = getTaskQuickView(taskFilter.types);
  const visibleTaskIds = filteredTasks.tasks.map((task) => task.taskId);
  const ganttVisibleTaskIds = subtreeScope.kind === "all" && activeFilters === 0 ? null : visibleTaskIds;
  const ganttMatchingTaskIds = subtreeScope.kind === "all" && activeFilters === 0 ? null : filteredTasks.matchingTaskIds;
  const ganttSelectionBoundaryKey = JSON.stringify(taskFilter, (_key, value: unknown) =>
    Array.isArray(value) ? [...value].sort() : value);
  const subtreeScopeInvalid = subtreeScope.kind === "missing" || subtreeScope.kind === "not-summary";
  const normalizedTargetQuery = targetPickerQuery.trim().toLocaleLowerCase();
  const selectableAssignedTargets = assignedTargets.filter((target) =>
    (targetPickerKind === "all" || target.kind === targetPickerKind) &&
    (!normalizedTargetQuery || [target.name, target.code ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedTargetQuery)))
  );
  const editing = permission === "edit" && permissionCheckState === "complete";
  const busy = isSavingMetadata || isSavingStatus || isChangingPassword || isLoggingOut || isSavingTask || importPending || copyReview !== null;
  const scopeTabLabel = (taskId: string): string => {
    const task = tasks.find((candidate) => candidate.taskId === taskId);
    if (!task) return "선택한 Summary";
    return task.type === "summary" ? task.name : `${task.name} · 변경됨`;
  };
  const closeTaskFilterOnEscape = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !taskFilterOpen) return;
    event.preventDefault();
    event.stopPropagation();
    setTaskFilterOpen(false);
    requestAnimationFrame(() => taskFilterTriggerReference.current?.focus({ preventScroll: true }));
  };
  const handleContextDisclosureKeyDown = (event: ReactKeyboardEvent<HTMLDetailsElement>) => {
    const details = event.currentTarget;
    if (!details.open) return;

    if (event.key === "Escape") {
      if (event.target instanceof Element && event.target.closest("dialog")) return;
      event.preventDefault();
      event.stopPropagation();
      details.open = false;
      if (details === actionMenuReference.current) setActionMenuOpen(false);
      if (details === infoPopoverReference.current) setInfoPopoverOpen(false);
      requestAnimationFrame(() => details.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true }));
      return;
    }

    if (event.key !== "Tab") return;
    requestAnimationFrame(() => {
      if (!details.open) return;
      const activeElement = document.activeElement;
      if (activeElement instanceof Node && details.contains(activeElement)) return;
      if (activeElement instanceof Element && activeElement.closest('dialog, [role="dialog"]')) return;
      if (details === actionMenuReference.current) setActionMenuOpen(false);
      if (details === infoPopoverReference.current) setInfoPopoverOpen(false);
    });
  };
  const resetTaskFilter = () => {
    setTaskFilter(EMPTY_TASK_FILTER);
    requestAnimationFrame(() => taskSearchReference.current?.focus({ preventScroll: true }));
  };
  return <section className="project-readonly" aria-labelledby="project-heading">
    <header className="project-context-bar">
      <div className="project-context-identity">
        <div className="project-title-row">
          <h1 id="project-heading" title={project.name}>{project.name}</h1>
          {editing ? <select
            className="project-lifecycle-badge project-lifecycle-select"
            data-status={project.status}
            aria-label="프로젝트 상태 변경"
            disabled={busy || editorSession !== null || pendingTaskDelete !== null}
            value={project.status}
            onChange={(event) => void changeHeaderStatus(event.target.value as ProjectStatus)}
          >
            {PROJECT_STATUS_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select> : <span className="project-lifecycle-badge" data-status={project.status} aria-label={`프로젝트 상태: ${projectStatusLabel(project.status)}`}>{projectStatusLabel(project.status)}</span>}
          <span className={editing ? "edit-badge" : "readonly-badge"}>{editing ? "편집 중" : "읽기 전용"}</span>
          <details
            className="project-info-popover"
            ref={infoPopoverReference}
            open={infoPopoverOpen}
            onToggle={(event) => {
              const nextOpen = event.currentTarget.open;
              setInfoPopoverOpen(nextOpen);
              if (nextOpen && actionMenuOpen) setActionMenuOpen(false);
            }}
            onKeyDown={handleContextDisclosureKeyDown}
          >
            <summary aria-label="프로젝트 정보 보기">정보</summary>
            <div className="project-info-panel">
              <dl>
                <div><dt>설명</dt><dd>{project.description || "설명이 없습니다."}</dd></div>
                <div><dt>소유자</dt><dd>{ownerName}</dd></div>
                <div><dt>Revision</dt><dd>{project.revision}</dd></div>
              </dl>
            </div>
          </details>
        </div>
      </div>
      <div className="project-context-actions">
        <ProjectLinkButton projectName={project.name} projectUrl={projectUrl} />
        <ProjectExportButton publicId={publicId} expectedRevision={project.revision} />
        {editing ? <button
          ref={settingsTriggerReference}
          type="button"
          className="secondary-button"
          disabled={busy || editorSession !== null || pendingTaskDelete !== null}
          onClick={() => setSettingsOpen(true)}
        >프로젝트 설정</button> : <button
          ref={unlockTriggerReference}
          type="button"
          className="secondary-button"
          disabled={isUnlocking || permissionCheckState === "checking"}
          onClick={() => setUnlockOpen(true)}
        >{permissionCheckState === "checking" ? "권한 확인 중…" : "편집 잠금 해제"}</button>}
        <details
          className="project-action-menu"
          ref={actionMenuReference}
          open={actionMenuOpen}
          onToggle={(event) => {
            const nextOpen = event.currentTarget.open;
            setActionMenuOpen(nextOpen);
            if (nextOpen && infoPopoverOpen) setInfoPopoverOpen(false);
          }}
          onKeyDown={handleContextDisclosureKeyDown}
        >
          <summary aria-label="프로젝트 작업 더보기">더보기</summary>
          <div className="project-action-menu-panel">
            <ProjectImportButton publicId={publicId} expectedRevision={project.revision} disabled={busy || editorSession !== null || pendingTaskDelete !== null || relationEditorRequest !== null} editable={editing} onPendingChange={setImportPending} onRefreshProject={refreshImportProject} onAuthorizationExpired={() => { setPermission("readonly"); setPermissionCheckState("complete"); }} onRequestUnlock={() => setUnlockOpen(true)} onImportSuccess={applySnapshot} />
            <ProjectCopyEntry publicId={publicId} busy={busy || editorSession !== null || pendingTaskDelete !== null} onAutoOpen={() => setActionMenuOpen(true)} />
            <ProjectSaveAsTemplateButton publicId={publicId} busy={busy || editorSession !== null || pendingTaskDelete !== null} />
          </div>
        </details>
      </div>
    </header>

    <div className="project-workspace-tabs" role="tablist" aria-label="프로젝트 작업공간">
      <button ref={scheduleTabReference} id="project-tab-schedule" role="tab" type="button" aria-controls="project-panel-schedule" aria-selected={activeView === "schedule"} tabIndex={activeView === "schedule" ? 0 : -1} onClick={() => activateWorkspaceView("schedule")} onKeyDown={(event) => handleWorkspaceTabKeyDown(event, "schedule")}>일정</button>
      <button ref={resourceTabReference} id="project-tab-resources" role="tab" type="button" aria-controls="project-panel-resources" aria-selected={activeView === "resources"} tabIndex={activeView === "resources" ? 0 : -1} onClick={() => activateWorkspaceView("resources")} onKeyDown={(event) => handleWorkspaceTabKeyDown(event, "resources")}>리소스</button>
      <button ref={logisticsTabReference} id="project-tab-logistics" role="tab" type="button" aria-controls="project-panel-logistics" aria-selected={activeView === "logistics"} tabIndex={activeView === "logistics" ? 0 : -1} onClick={() => activateWorkspaceView("logistics")} onKeyDown={(event) => handleWorkspaceTabKeyDown(event, "logistics")}>물류 구성</button>
    </div>
    <div className="project-workspace-panels">
      <section
        id="project-panel-schedule"
        role="tabpanel"
        aria-labelledby="project-tab-schedule"
        hidden={activeView !== "schedule"}
        aria-busy={isSavingTask || undefined}
        className="project-schedule project-workspace-panel"
      >
        <div className="project-schedule-peer-tabs" role="tablist" aria-label="일정 보기">
          {(["gantt", "milestones"] as const).map((view) => <button key={view} type="button" role="tab" id={`project-schedule-tab-${view}`} aria-controls={`project-schedule-view-${view}`} aria-selected={scheduleView === view} tabIndex={scheduleView === view ? 0 : -1} ref={(node) => { schedulePeerReferences.current[view] = node; }} onClick={() => activateScheduleView(view)} onKeyDown={(event) => handleScheduleViewKey(event, view)}>{view === "gantt" ? "Gantt" : "완료 단계 대시보드"}</button>)}
        </div>
        <div className="project-schedule-peer-body">
        <div ref={scheduleGanttPanel} id="project-schedule-view-gantt" role="tabpanel" aria-labelledby="project-schedule-tab-gantt" aria-hidden={scheduleView !== "gantt" || undefined} inert={scheduleView !== "gantt"} className="project-schedule-peer-panel">
        {previousDashboardDrill ? <div className="resource-workload-note" role="status">완료 단계에서 명시적으로 전체 일정 범위로 이동했습니다. <button type="button" className="secondary-button" onClick={restoreDashboardDrill}>이전 Gantt 범위·조건 복원</button></div> : null}
        <div className="project-scope-tabs" role="tablist" aria-label="WBS 범위 탭">
          <div className="project-scope-tab-item" role="presentation">
            <button className="project-scope-tab" id={scopeTabId(null)} role="tab" type="button" aria-controls="project-scope-panel" aria-selected={activeRootTaskId === null} tabIndex={activeRootTaskId === null ? 0 : -1} ref={(node) => { if (node) scopeTabReferences.current.set(scopeStateKey(null), node); else scopeTabReferences.current.delete(scopeStateKey(null)); }} onClick={() => activateScope(null)} onKeyDown={(event) => handleScopeTabKeyDown(event, null)}><span className="project-scope-tab-label">전체 프로젝트</span></button>
          </div>
          {openScopeTaskIds.map((taskId) => {
            const label = scopeTabLabel(taskId);
            const task = tasks.find((candidate) => candidate.taskId === taskId);
            const invalid = !task || task.type !== "summary";
            return <div className="project-scope-tab-item" data-invalid={invalid || undefined} key={taskId} role="presentation">
              <button className="project-scope-tab" id={scopeTabId(taskId)} role="tab" type="button" aria-controls="project-scope-panel" aria-label={label} aria-selected={activeRootTaskId === taskId} tabIndex={activeRootTaskId === taskId ? 0 : -1} title={label} ref={(node) => { if (node) scopeTabReferences.current.set(scopeStateKey(taskId), node); else scopeTabReferences.current.delete(scopeStateKey(taskId)); }} onClick={() => activateScope(taskId)} onKeyDown={(event) => handleScopeTabKeyDown(event, taskId)}><span className="project-scope-tab-label">{label}</span></button>
              <button className="project-scope-tab-close" type="button" aria-label={`${label} 범위 탭 닫기`} title={`${label} 범위 탭 닫기`} onClick={() => closeScopeTab(taskId)}>×</button>
            </div>;
          })}
        </div>
        <div className="project-scope-panel" id="project-scope-panel" role="tabpanel" aria-labelledby={scopeTabId(activeRootTaskId)}>
        <div className="schedule-heading-row"><div><h2 id="schedule-heading">일정</h2><p>{scopedTasks.length === 0 ? "표시할 작업이 없습니다." : scopedTasks.every((task) => task.start === null) ? "일정이 있는 하위 작업이 없습니다." : "작업 일정을 확인하고 관리합니다."}</p></div>
          {isSavingTask ? <span className="schedule-saving" role="status">일정 저장 중…</span> : null}</div>
        <div className="project-filter-toolbar project-schedule-filter-toolbar" role="toolbar" aria-label="작업 검색과 필터" onKeyDown={closeTaskFilterOnEscape}>
          <label className="project-filter-search">
            <span className="sr-only">작업 검색</span>
            <input
              aria-label="작업명, 설명, External ID 검색"
              placeholder="작업명, 설명, External ID 검색"
              type="search"
              ref={taskSearchReference}
              value={taskFilter.query}
              onChange={(event) => setTaskFilter((current) => ({ ...current, query: event.target.value }))}
            />
          </label>
          <button className="secondary-button project-filter-trigger" type="button" aria-controls="project-task-filter-panel" aria-expanded={taskFilterOpen} ref={taskFilterTriggerReference} onClick={() => setTaskFilterOpen((open) => !open)}>
            필터{activeFilters ? ` ${activeFilters}` : ""}
          </button>
          <StageFilterPicker tasks={tasks} value={taskFilter.milestoneTaskId} onChange={(milestoneTaskId) => setTaskFilter((current) => ({ ...current, milestoneTaskId }))} />
          <div className="project-filter-quick-views" role="group" aria-label="작업 유형 빠른 보기">
            <button
              type="button"
              className={`project-filter-quick-button${quickView === "all" ? " is-active" : ""}`}
              aria-pressed={quickView === "all"}
              onClick={() => setTaskFilter((current) => applyTaskQuickView(current, "all"))}
            >
              전체
            </button>
            <button
              type="button"
              className={`project-filter-quick-button${quickView === "task" ? " is-active" : ""}`}
              aria-pressed={quickView === "task"}
              onClick={() => setTaskFilter((current) => applyTaskQuickView(current, "task"))}
            >
              Task
            </button>
            <button
              type="button"
              className={`project-filter-quick-button${quickView === "milestone" ? " is-active" : ""}`}
              aria-pressed={quickView === "milestone"}
              onClick={() => setTaskFilter((current) => applyTaskQuickView(current, "milestone"))}
            >
              Milestone
            </button>
          </div>
          {activeFilters > 0 ? <button className="secondary-button project-filter-reset" type="button" onClick={resetTaskFilter}>초기화</button> : null}
          <span className="project-filter-result" role="status">{taskFilter.milestoneTaskId !== "all" ? `유효 소속 일반 작업 ${filteredTasks.ordinaryMatchCount}개 · ` : ""}{filteredTasks.matchCount}개 일치 / {subtreeScope.kind === "valid" ? "범위" : "전체"} {scopedTasks.length}개 작업</span>
        </div>
        <div className="project-filter-panel project-task-filter-panel" id="project-task-filter-panel" hidden={!taskFilterOpen} aria-label="작업 고급 필터" onKeyDown={closeTaskFilterOnEscape}>
          <section className="project-filter-section" aria-labelledby="project-filter-text-heading">
            <h3 className="project-filter-section-title" id="project-filter-text-heading">텍스트</h3>
            <div className="project-filter-section-grid">
              <div className="project-filter-control-group">
                <label>작업명 조건<select value={taskFilter.nameOperator} onChange={(event) => setTaskFilter((current) => ({ ...current, nameOperator: event.target.value as TaskFilterState["nameOperator"] }))}><option value="contains">포함</option><option value="not-contains">포함하지 않음</option><option value="equals">같음</option></select></label>
                <label className="project-filter-control-grow">작업명<input type="text" value={taskFilter.nameQuery} onChange={(event) => setTaskFilter((current) => ({ ...current, nameQuery: event.target.value }))} /></label>
              </div>
              <div className="project-filter-control-group">
                <label>설명 조건<select value={taskFilter.descriptionOperator} onChange={(event) => setTaskFilter((current) => ({ ...current, descriptionOperator: event.target.value as TaskFilterState["descriptionOperator"] }))}><option value="contains">포함</option><option value="not-contains">포함하지 않음</option></select></label>
                <label className="project-filter-control-grow">설명<input type="text" value={taskFilter.descriptionQuery} onChange={(event) => setTaskFilter((current) => ({ ...current, descriptionQuery: event.target.value }))} /></label>
              </div>
              <div className="project-filter-control-group">
                <label>External ID 조건<select value={taskFilter.externalIdOperator} onChange={(event) => setTaskFilter((current) => ({ ...current, externalIdOperator: event.target.value as TaskFilterState["externalIdOperator"] }))}><option value="contains">포함</option><option value="equals">같음</option></select></label>
                <label className="project-filter-control-grow">External ID<input type="text" value={taskFilter.externalIdQuery} onChange={(event) => setTaskFilter((current) => ({ ...current, externalIdQuery: event.target.value }))} /></label>
              </div>
            </div>
          </section>

          <section className="project-filter-section" aria-labelledby="project-filter-schedule-heading">
            <h3 className="project-filter-section-title" id="project-filter-schedule-heading">일정 · 수치</h3>
            <div className="project-filter-section-grid project-filter-section-grid-schedule">
              <div className="project-filter-control-group project-filter-control-group-triple">
                <label>기간 조건<select value={taskFilter.dateOperator} onChange={(event) => setTaskFilter((current) => ({ ...current, dateOperator: event.target.value as TaskFilterState["dateOperator"] }))}>
                  <option value="overlap">기간과 겹침</option><option value="contained">기간 안에 완전히 포함</option><option value="start-in">시작일이 기간 안</option><option value="end-in">종료일이 기간 안</option>
                </select></label>
                <label>기간 From<input type="date" value={taskFilter.dateFrom} onChange={(event) => setTaskFilter((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
                <label>기간 To<input type="date" value={taskFilter.dateTo} onChange={(event) => setTaskFilter((current) => ({ ...current, dateTo: event.target.value }))} /></label>
              </div>
              <div className="project-filter-control-group project-filter-control-group-even">
                <label>진행률 최소<input min={0} max={100} type="number" value={taskFilter.progressMin ?? ""} onChange={(event) => setTaskFilter((current) => ({ ...current, progressMin: event.target.value === "" ? null : Number(event.target.value) }))} /></label>
                <label>진행률 최대<input min={0} max={100} type="number" value={taskFilter.progressMax ?? ""} onChange={(event) => setTaskFilter((current) => ({ ...current, progressMax: event.target.value === "" ? null : Number(event.target.value) }))} /></label>
              </div>
              <div className="project-filter-control-group project-filter-control-group-even">
                <label>기간 최소<input min={0} type="number" value={taskFilter.durationMin ?? ""} onChange={(event) => setTaskFilter((current) => ({ ...current, durationMin: event.target.value === "" ? null : Number(event.target.value) }))} /></label>
                <label>기간 최대<input min={0} type="number" value={taskFilter.durationMax ?? ""} onChange={(event) => setTaskFilter((current) => ({ ...current, durationMax: event.target.value === "" ? null : Number(event.target.value) }))} /></label>
              </div>
            </div>
          </section>

          <section className="project-filter-section" aria-labelledby="project-filter-assignment-heading">
            <h3 className="project-filter-section-title" id="project-filter-assignment-heading">유형 · 할당</h3>
            <div className="project-filter-section-grid project-filter-section-grid-assignment">
              <fieldset className="project-filter-choice-fieldset"><legend>Task type</legend>{(["task","summary","milestone"] as const).map((type) => <label key={type}><input type="checkbox" checked={taskFilter.types.includes(type)} onChange={() => setTaskFilter((current) => ({ ...current, types: current.types.includes(type) ? current.types.filter((item) => item !== type) : [...current.types, type] }))} />{type}</label>)}</fieldset>
              <fieldset className="project-filter-choice-fieldset"><legend>Schedule mode</legend>{(["auto","manual"] as const).map((mode) => <label key={mode}><input type="checkbox" checked={taskFilter.scheduleModes.includes(mode)} onChange={() => setTaskFilter((current) => ({ ...current, scheduleModes: current.scheduleModes.includes(mode) ? current.scheduleModes.filter((item) => item !== mode) : [...current.scheduleModes, mode] }))} />{mode}</label>)}</fieldset>
              <label className="project-filter-compact-control">리소스 할당<select value={taskFilter.assignmentState} onChange={(event) => setTaskFilter((current) => ({ ...current, assignmentState: event.target.value as TaskFilterState["assignmentState"] }))}>
                <option value="all">전체</option><option value="assigned">할당됨</option><option value="unassigned">미할당</option>
              </select></label>
            </div>
            {assignedTargets.length > 0 ? <fieldset className="project-filter-target-fieldset"><legend>할당 Resource / Group</legend>
              <div className="project-filter-target-controls">
                <label>대상 종류<select value={targetPickerKind} onChange={(event) => setTargetPickerKind(event.target.value as "all" | "resource" | "group")}><option value="all">전체</option><option value="resource">Resource</option><option value="group">Group</option></select></label>
                <label className="project-filter-control-grow">대상 검색<input aria-label="할당 Resource 또는 Group 이름과 code 검색" placeholder="이름 또는 code" type="search" value={targetPickerQuery} onChange={(event) => setTargetPickerQuery(event.target.value)} /></label>
                <label>다중 조건<select value={taskFilter.targetMode} onChange={(event) => setTaskFilter((current) => ({ ...current, targetMode: event.target.value as "any" | "all" }))}><option value="any">ANY</option><option value="all">ALL</option></select></label>
              </div>
              <div className="project-filter-targets">{selectableAssignedTargets.map((target) => {
                const key = `${target.kind}:${target.id}`;
                return <label key={key}><input type="checkbox" checked={taskFilter.targetIds.includes(key)} onChange={() => setTaskFilter((current) => ({ ...current, targetIds: current.targetIds.includes(key) ? current.targetIds.filter((item) => item !== key) : [...current.targetIds, key] }))} />{target.name}{target.code ? ` (${target.code})` : ""}{target.active ? "" : " · 비활성"}</label>;
              })}</div>
            </fieldset> : null}
          </section>

          {logistics && (logistics.processes.length > 0 || logistics.equipment.length > 0 || logistics.systems.length > 0) ? (
            <section className="project-filter-section" aria-labelledby="project-filter-logistics-heading">
              <h3 className="project-filter-section-title" id="project-filter-logistics-heading">물류</h3>
              {logistics.processes.length > 0 ? (
                <fieldset className="project-filter-chip-fieldset">
                  <legend>공정 필터</legend>
                  <div className="project-filter-checkbox-list">
                    {logistics.processes.map((proc) => (
                      <label key={proc.id}>
                        <input
                          type="checkbox"
                          checked={taskFilter.processIds.includes(proc.id)}
                          onChange={() =>
                            setTaskFilter((current) => ({
                              ...current,
                              processIds: current.processIds.includes(proc.id)
                                ? current.processIds.filter((id) => id !== proc.id)
                                : [...current.processIds, proc.id],
                            }))
                          }
                        />
                        <span>{proc.name} <code>({proc.code})</code></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {logistics.equipment.length > 0 ? (
                <fieldset className="project-filter-chip-fieldset">
                  <legend>설비 필터</legend>
                  <div className="project-filter-checkbox-list">
                    {logistics.equipment.map((eq) => (
                      <label key={eq.id}>
                        <input
                          type="checkbox"
                          checked={taskFilter.equipmentIds.includes(eq.id)}
                          onChange={() =>
                            setTaskFilter((current) => ({
                              ...current,
                              equipmentIds: current.equipmentIds.includes(eq.id)
                                ? current.equipmentIds.filter((id) => id !== eq.id)
                                : [...current.equipmentIds, eq.id],
                            }))
                          }
                        />
                        <span>{eq.name} <code>({eq.code})</code></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {logistics.systems.length > 0 ? (
                <fieldset className="project-filter-chip-fieldset">
                  <legend>물류 시스템 필터</legend>
                  <div className="project-filter-checkbox-list">
                    {logistics.systems.map((sys) => (
                      <label key={sys.id}>
                        <input
                          type="checkbox"
                          checked={taskFilter.systemIds.includes(sys.id)}
                          onChange={() =>
                            setTaskFilter((current) => ({
                              ...current,
                              systemIds: current.systemIds.includes(sys.id)
                                ? current.systemIds.filter((id) => id !== sys.id)
                                : [...current.systemIds, sys.id],
                            }))
                          }
                        />
                        <span>{sys.name} <code>({sys.code})</code></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </section>
          ) : null}
        </div>
        {subtreeScopeInvalid ? <div className="schedule-scope-note" role="alert">
          <strong>선택한 Summary 범위를 열 수 없습니다.</strong>{" "}
          {subtreeScope.kind === "not-summary"
            ? "선택한 작업이 더 이상 Summary가 아닙니다."
            : "선택한 Summary가 삭제되었거나 현재 프로젝트에서 찾을 수 없습니다."}{" "}
          <div className="project-scope-recovery-actions"><button className="secondary-button project-scope-recovery-button" type="button" onClick={() => activateScope(null)}>전체 프로젝트로 돌아가기</button></div>
        </div> : <ProjectGantt viewVisible={activeView === "schedule" && scheduleView === "gantt"} viewportContinuityKey={`${publicId}:${activeRootTaskId ?? ""}:${JSON.stringify(taskFilter)}`} peerViewportRestore={peerChartRestore} key={ganttResetGeneration} calendar={project.calendar} editable={editing} mutationLocked={busy || editorSession !== null || pendingTaskDelete !== null || relationEditorRequest !== null}
          projectPublicId={project.publicId}
          onCanonicalSyncFailure={recoverCanonicalGantt} links={links} onTaskAddRejected={rejectNativeTaskAdd} onTaskCreate={createNativeTask} onTaskCommand={saveTaskCommand}
          onTaskHierarchyCommand={(command) => void saveTaskHierarchyCommand(command)} projectRevision={project.revision}
          onTaskEditorOpen={openTaskEditor} onTaskOpenAsRoot={openTaskAsRoot} onRelationEditorOpen={openRelationEditor} onTaskDeleteRequest={requestTaskDelete} onLinkCreate={(source, target) => void saveLink("POST", source, target)} onLinkUpdate={(linkId, patch) => saveLink("PATCH", undefined, undefined, linkId, patch)} onLinkDelete={(linkId) => void saveLink("DELETE", undefined, undefined, linkId)} columnVisibility={columnVisibility} onColumnVisibilityChange={(columnId) => setColumnVisibility((current) => {
            const visibleColumnCount = Object.values(current).filter(Boolean).length;
            if (current[columnId] && visibleColumnCount === 1) return current;
            return { ...current, [columnId]: !current[columnId] };
          })} tasks={tasks} visibleTaskIds={ganttVisibleTaskIds} matchingTaskIds={ganttMatchingTaskIds} selectionBoundaryKey={ganttSelectionBoundaryKey} viewRootTaskId={subtreeScope.kind === "valid" ? subtreeScope.root.taskId : null} />}
        </div>
        </div>
        <div id="project-schedule-view-milestones" role="tabpanel" aria-labelledby="project-schedule-tab-milestones" hidden={scheduleView !== "milestones"} className="project-schedule-peer-panel project-milestone-panel">
          <ProjectMilestoneDashboard publicId={publicId} revision={project.revision} tasks={tasks} active={activeView === "schedule" && scheduleView === "milestones"} busy={busy || editorSession !== null || relationEditorRequest !== null || pendingTaskDelete !== null} onOpenTask={openTaskEditor} onSchedule={drillDashboardSchedule} onResources={(scope) => { if (busy || scope.projectRevision !== project.revision) return; setResourceDrill(scope); activateWorkspaceView("resources"); }} onRefreshProject={() => { void reloadCanonicalSnapshot(); }} />
        </div>
        </div>
        {copyReview ? <ProjectCopyMembershipConfirm review={copyReview} tasks={tasks} current={copyReview.publicId === publicId && copyReview.revision === project.revision && editing} pending={isSavingTask} error={copyReviewError} restoreFocusRef={copyReviewTriggerReference} onClose={closeCopyReview} onConfirm={() => void confirmMembershipCopy()} /> : null}
        {editorSession ? <ProjectTaskEditor initialTab={editorInitialTab} ref={projectTaskEditorReference} key={editorSession.task.taskId} session={editorSession}
          latestTask={tasks.find((task) => task.taskId === editorSession.task.taskId)} tasks={tasks} links={links} revision={project.revision}
          editable={editing} hasLinks={taskHasDependencyLinks(tasks, editorSession.task.taskId, links)} busy={busy}
          onSave={saveEditorTask} onAuthorizationExpired={() => { setPermission("readonly"); setPermissionCheckState("complete"); }} onMembershipSave={saveEditorMemberships} onTaskOpen={navigateEditorTask} onTaskLocate={locateEditorTask} onReload={reloadEditorTask} onRelationEditorOpen={openTaskRelationEditor}
          onRelationDelete={(id) => saveLink("DELETE", undefined, undefined, id)} onClose={closeTaskEditor} /> : null}
        {relationEditorRequest ? (
          <RelationEditorDialog
            editable={editing}
            key={relationEditorRequest.kind === "link" ? `link:${relationEditorRequest.linkId}` : `task:${relationEditorRequest.taskId}`}
            {...(relationEditorRequest.kind === "link" ? { linkId: relationEditorRequest.linkId } : { anchorTaskId: relationEditorRequest.taskId })}
            links={links}
            onClose={closeRelationEditor}
            onCreateLink={(source, target, options) => saveLink("POST", source, target, undefined, options)}
            onDeleteLink={(id) => saveLink("DELETE", undefined, undefined, id)}
            onUpdateLink={(id, patch) => saveLink("PATCH", undefined, undefined, id, patch)}
            tasks={tasks}
          />
        ) : null}
      </section>
      <section
        id="project-panel-resources"
        role="tabpanel"
        aria-labelledby="project-tab-resources"
        hidden={activeView !== "resources"}
        className="project-workspace-panel project-resource-panel"
      >
        <ProjectResourceWorkload publicId={publicId} revision={project.revision} active={activeView === "resources"} refreshDisabled={busy || editorSession !== null || relationEditorRequest !== null || pendingTaskDelete !== null} onRefreshProject={() => { if (!busy && editorSession === null && relationEditorRequest === null && pendingTaskDelete === null) void reloadCanonicalSnapshot(); }} drillScope={resourceDrill} onClearDrillScope={() => setResourceDrill(null)} />
      </section>
      <section
        id="project-panel-logistics"
        role="tabpanel"
        aria-labelledby="project-tab-logistics"
        hidden={activeView !== "logistics"}
        className="project-workspace-panel project-logistics-panel"
      >
        <ProjectLogisticsManagement
          busy={busy || editorSession !== null || relationEditorRequest !== null || pendingTaskDelete !== null}
          publicId={publicId}
          revision={project.revision}
          editable={editing}
          tasks={tasks}
          active={activeView === "logistics"}
          onStageSchedule={drillDashboardSchedule}
          onStageOpen={(taskId, tab) => { setActiveView("schedule"); openTaskEditor(taskId, tab); }}
          logistics={state.snapshot.data.logistics}
          onLogisticsMutated={(newLogistics, newProject) => {
            const current = confirmedSnapshotReference.current;
            if (current) applySnapshot({ ...current, data: { ...current.data, project: newProject, logistics: newLogistics } });
            notify("success", "물류 구성 변경 사항을 저장했습니다.", "물류 구성");
          }}
          onRequireRefresh={() => { void reloadCanonicalSnapshot(); }}
          onNavigateToSchedule={(targetFilter) => {
            activateScope(null, false);
            setActiveView("schedule");
            setScheduleView("gantt");
            if (targetFilter) {
              setTaskFilter((prev) => ({ ...prev, ...targetFilter }));
            }
          }}
          onUnauthorized={() => { setPermission("readonly"); setPermissionCheckState("complete"); }}
        />
      </section>
    </div>

    {unlockOpen && !editing ? <WorkspaceDialog
      title="편집 활성화"
      restoreFocusRef={unlockTriggerReference}
      busy={isUnlocking}
      onClose={() => { if (!isUnlocking) { setUnlockOpen(false); setUnlockPassword(""); } }}
    >
      <form className="project-form compact-form" noValidate onSubmit={unlock}>
        <p>편집 비밀번호를 확인한 뒤 현재 브라우저 세션에서 편집 모드를 활성화합니다.</p>
        <div className="form-field"><label htmlFor="unlock-edit-password">편집 비밀번호</label>
          <input autoFocus autoComplete="current-password" disabled={isUnlocking || permissionCheckState === "checking"} id="unlock-edit-password" onChange={(event) => setUnlockPassword(event.target.value)} type="password" value={unlockPassword} /></div>
        <button className="primary-button" disabled={isUnlocking || permissionCheckState === "checking"} type="submit">{isUnlocking ? "확인 중…" : "편집 활성화"}</button>
      </form>
    </WorkspaceDialog> : null}
    {pendingTaskDelete ? <WorkspaceDialog title="작업 삭제" restoreFocusRef={deleteTriggerReference} busy={isSavingTask}
      onClose={() => { if (!isSavingTask) setPendingTaskDelete(null); }}>
      <div className="project-form compact-form">
        <p><strong>{pendingTaskDelete.taskName}</strong> 작업과 하위 작업 {pendingTaskDelete.descendantTaskIds.length}개, 총 {pendingTaskDelete.descendantTaskIds.length + 1}개 작업을 삭제하시겠습니까?</p>
        <p>접힌 하위 작업을 포함하여 모든 하위 작업이 함께 삭제됩니다. 삭제 후에는 이 화면에서 되돌릴 수 없습니다.</p>
        <div className={feedbackStyles.headingActions}>
          <button autoFocus className="secondary-button" disabled={isSavingTask} onClick={() => setPendingTaskDelete(null)} type="button">취소</button>
          <button className="danger-button" disabled={isSavingTask} onClick={() => void confirmTaskDelete()} type="button">{isSavingTask ? "삭제 중…" : "하위 작업 포함 삭제"}</button>
        </div>
      </div>
    </WorkspaceDialog> : null}
    <ProjectSettingsDialog
      open={settingsOpen && editing}
      onClose={() => { if (!busy) { setSettingsOpen(false); setNewPassword(""); } }}
      busy={busy}
      restoreFocusRef={settingsTriggerReference}
      publicId={publicId}
      revision={project.revision}
      metadataName={metadataName}
      metadataDescription={metadataDescription}
      metadataStatus={metadataStatus}
      onMetadataNameChange={setMetadataName}
      onMetadataDescriptionChange={setMetadataDescription}
      onMetadataStatusChange={setMetadataStatus}
      masterSelection={masterSelection}
      onMasterSelectionChange={setMasterSelection}
      currentMaster={{ businessUnit: project.businessUnit, product: project.product, siteEntity: project.siteEntity }}
      onSaveMetadata={saveMetadata}
      isSavingMetadata={isSavingMetadata}
      newPassword={newPassword}
      onNewPasswordChange={setNewPassword}
      onChangePassword={changePassword}
      isChangingPassword={isChangingPassword}
      onLogout={() => void logout()}
      isLoggingOut={isLoggingOut}
      onCalendarSaved={reloadCanonicalSnapshot}
      onCalendarUnauthorized={() => { closeSettingsAsReadonly(); notify("error", "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.", "작업 캘린더 저장"); }}
      onCalendarConflict={(body) => conflict("작업 캘린더 저장", body)}
      notify={notify}
    />
  </section>;
}
