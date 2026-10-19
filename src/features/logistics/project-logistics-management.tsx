"use client";
import { ContextHelp } from "@/components/ui/context-help";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  ControlRole,
  CreateEquipmentRequest,
  CreateLogisticsSystemRequest,
  CreateProcessRequest,
  EquipmentDto,
  EquipmentRole,
  EquipmentType,
  LogisticsMutationResponse,
  LogisticsActiveTypeCatalogResponse,
  LogisticsSystemDto,
  LogisticsSystemType,
  ManagementUnit,
  ProcessDto,
  ProjectLogisticsDto,
  SystemLayer,
  SystemRole,
  SystemScope,
  UpdateEquipmentRequest,
  UpdateLogisticsSystemRequest,
  UpdateProcessRequest,
} from "@/contracts/logistics";
import type { ProcessContextResponse } from "@/contracts/process-catalog";
import type { TaskTargetBindingsResponse } from "@/contracts/task-target-bindings";
import type { LogisticsTargetListResponse, LogisticsTargetUsageDto } from "@/contracts/logistics-targets";
import { LogisticsTypeField } from "./logistics-type-field";
import { taskContextLabels } from "./task-context-label";
import type { ProjectDto } from "@/contracts/projects";
import type { ResourceCatalogResponse, ResourceDto } from "@/contracts/resources";
import { IdentifierDetails } from "@/components/identifier-details";
import { logisticsName } from "./logistics-identity";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { ProjectLogisticsTargets } from "./project-logistics-targets";
import type { KpiMasterKind } from "./logistics-kpi-configuration";
import { ProjectLogisticsDashboard } from "./project-logistics-dashboard";
import { ProjectLogisticsUnified } from "./project-logistics-unified";
import type { WbsViewDimension } from "@/contracts/wbs-dashboard-views";
import type { WbsViewScheduleRequest, ResourceScheduleRequest } from "@/features/resources/resource-drill-context";
import styles from "./project-logistics-management.module.css";
import { useLogisticsViewState } from "./use-logistics-view-state";
import { isVisibleFocusTarget } from "@/features/milestones/milestone-management-model";

function developerGradeLabel(grade: ResourceDto["developerGrade"] | undefined): string {
  switch (grade) {
    case "BEGINNER": return "초급";
    case "INTERMEDIATE": return "중급";
    case "ADVANCED": return "고급";
    case "EXPERT": return "특급";
    default: return "등급 미지정";
  }
}

function isTypeCatalog(value: unknown): value is LogisticsActiveTypeCatalogResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" &&
    "equipmentTypes" in data && Array.isArray(data.equipmentTypes) &&
    "systemTypes" in data && Array.isArray(data.systemTypes) &&
    [...data.equipmentTypes, ...data.systemTypes].every((item) =>
      !!item && typeof item === "object" && typeof item.code === "string" && typeof item.name === "string");
}

import type { ProjectTaskDto } from "@/contracts/projects";

export interface ProjectLogisticsManagementProps {
  kpiSourceRefreshKey?: number;
  subview?: SubTab;
  onSubviewChange?: (view: SubTab) => void;
  onSubviewFocusUnavailable?: () => void;
  hideSubviewNavigation?: boolean;
  perspective?: import("./logistics-unified-model").LogisticsPerspective;
  onPerspectiveChange?: (view: import("./logistics-unified-model").LogisticsPerspective) => void;
  tasks?: readonly ProjectTaskDto[];
  targetOpenRequest?: {id:string;sequence:number;code?:string | null} | null;
  active?: boolean;
  busy?: boolean;
  onStageOpen?: (taskId: string, tab?: "task" | "memberships") => void;
  onTargetTaskOpen?: (taskId: string, trigger?: HTMLElement) => void;
  onKpiResourceOpen?: (resourceId: string, trigger: HTMLElement, resource?: { name: string; code: string | null }) => void;
  onStageSchedule?: (taskIds: string[]) => void;
  onWbsSchedule?: (request: WbsViewScheduleRequest) => void;
  onWbsOpenEntity?: (dimension: WbsViewDimension, id: string, trigger: HTMLElement) => void;
  wbsEntityOpenRequest?: { dimension: WbsViewDimension; id: string; sequence: number; trigger: HTMLElement } | null;
  onWbsEntityRequestHandled?: () => void;
  onResourceSchedule?: (request: ResourceScheduleRequest) => void;
  onOpenAssignment?: (taskId: string, assignmentId: string, resourceId: string, trigger: HTMLElement) => void;
  projectContext?: Pick<ProjectDto, "businessUnit" | "product" | "siteEntity">;
  publicId: string;
  revision: number;
  editable: boolean;
  logistics?: ProjectLogisticsDto;
  onLogisticsMutated: (logistics: ProjectLogisticsDto, project: ProjectDto) => void;
  onRequireRefresh: () => void;
  onNavigateToSchedule?: (filter: {
    taskIds?: string[];
    processIds?: string[];
    equipmentIds?: string[];
    systemIds?: string[];
  }, source?: { snapshotId: string; filters: import("@/contracts/logistics-dashboard").LogisticsDashboardFilterInput }) => void;
  onUnauthorized: () => void;
}

export type SubTab = "targets" | "dashboard" | "unified" | "processes" | "equipment" | "systems" | "relations";

export function ProjectLogisticsManagement({
  kpiSourceRefreshKey = 0, subview, onSubviewChange, onSubviewFocusUnavailable, hideSubviewNavigation = false, perspective, onPerspectiveChange,
  wbsEntityOpenRequest, onWbsEntityRequestHandled, onWbsSchedule, onWbsOpenEntity,
  targetOpenRequest, tasks = [], active = true, busy = false, onStageOpen, onStageSchedule, onTargetTaskOpen, onResourceSchedule, onOpenAssignment, onKpiResourceOpen,
  publicId,
  projectContext,
  revision,
  editable,
  logistics = { processes: [], equipment: [], systems: [], systemLinks: [] },
  onLogisticsMutated,
  onRequireRefresh,
  onNavigateToSchedule,
  onUnauthorized,
}: ProjectLogisticsManagementProps) {
  const [localSubTab, setLocalSubTab] = useState<SubTab>("dashboard");
  const activeSubTab = subview ?? localSubTab;
  function setActiveSubTab(view: SubTab) { setLocalSubTab(view); onSubviewChange?.(view); }
  const [targetRequestSequence, setTargetRequestSequence] = useState<number | null>(null);
  const [unifiedTargetRequest, setUnifiedTargetRequest] = useState<{ id: string; sequence: number; code?: string | null } | null>(null);
  const unifiedTargetTrigger = useRef<HTMLElement | null>(null);
  const [kpiOrigin, setKpiOrigin] = useState<{ trigger: HTMLElement; revision: number; kind: KpiMasterKind; id: string } | null>(null);
  function returnToKpi() {
    const origin = kpiOrigin;
    setKpiOrigin(null);
    setUnifiedTargetRequest(null);
    setActiveSubTab("dashboard");
    requestAnimationFrame(() => {
      if (origin?.revision === revision && isVisibleFocusTarget(origin.trigger)) origin.trigger.focus({ preventScroll: true });
      else {
        const fallback = document.querySelector<HTMLElement>('[data-testid="logistics-kpi-configuration"] summary');
        if (isVisibleFocusTarget(fallback)) fallback.focus({ preventScroll: true });
        else onSubviewFocusUnavailable?.();
      }
    });
  }
  function openKpiMaster(kind: KpiMasterKind, id: string, trigger: HTMLElement, resource?: { name: string; code: string | null }) {
    if (busy || isSubmitting) return;
    if (kind === "resource") { onKpiResourceOpen?.(id, trigger, resource); return; }
    if (kind === "workArea") {
      // WorkArea is configured through its existing process occurrence mapping.
      const processId = trigger.dataset.processId;
      if (!processId || !logistics.processes.some(row => row.id === processId)) return;
      setKpiOrigin({ trigger, revision, kind: "process", id: processId });
      setActiveSubTab("processes");
      requestAnimationFrame(() => document.getElementById(`logistics-master-process-${processId}`)?.focus({ preventScroll: false }));
      return;
    }
    const candidates = kind === "process" ? logistics.processes : kind === "equipment" ? logistics.equipment : kind === "system" ? logistics.systems : null;
    if (kind !== "target" && !candidates?.some(row => row.id === id)) return;
    setKpiOrigin({ trigger, revision, kind, id });
    if (kind === "target") {
      setUnifiedTargetRequest({ id, sequence: Date.now() });
      setActiveSubTab("targets");
    } else {
      const view = kind === "process" ? "processes" : kind === "equipment" ? "equipment" : "systems";
      setActiveSubTab(view);
      requestAnimationFrame(() => document.getElementById(`logistics-master-${kind}-${id}`)?.focus({ preventScroll: false }));
    }
  }

  if (targetOpenRequest && targetRequestSequence !== targetOpenRequest.sequence) {
    setTargetRequestSequence(targetOpenRequest.sequence);
    setUnifiedTargetRequest(null);
    setLocalSubTab("targets");
  }
  function returnToUnified() {
    setUnifiedTargetRequest(null);
    setActiveSubTab("unified");
    requestAnimationFrame(() => {
      const trigger = unifiedTargetTrigger.current;
      if (isVisibleFocusTarget(trigger)) trigger.focus({ preventScroll: true });
      else {
        const tab = document.getElementById("subtab-unified");
        if (isVisibleFocusTarget(tab)) tab.focus({ preventScroll: true });
        else onSubviewFocusUnavailable?.();
      }
    });
  }
  const [searchQuery, setSearchQuery] = useLogisticsViewState(activeSubTab, "");
  const [processFilter, setProcessFilter] = useLogisticsViewState<string>(activeSubTab, "all");
  const [includeInactive, setIncludeInactive] = useLogisticsViewState(activeSubTab, false);
  const [typeCatalog, setTypeCatalog] = useState<LogisticsActiveTypeCatalogResponse["data"] | null>(null);
  const [typeCatalogState, setTypeCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const typeCatalogRequest = useRef<AbortController | null>(null);
  const requestTypeCatalog = useCallback(async (controller: AbortController) => {
    const response = await fetch("/api/logistics-catalog/types", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isTypeCatalog(body)) throw new Error("invalid catalog");
    return body.data;
  }, []);
  const retryTypeCatalog = useCallback(async () => {
    typeCatalogRequest.current?.abort();
    const controller = new AbortController();
    typeCatalogRequest.current = controller;
    setTypeCatalogState("loading");
    try {
      const data = await requestTypeCatalog(controller);
      if (controller.signal.aborted) return;
      setTypeCatalog(data);
      setTypeCatalogState("ready");
    } catch {
      if (!controller.signal.aborted) setTypeCatalogState("error");
    }
  }, [requestTypeCatalog]);
  useEffect(() => {
    const controller = new AbortController();
    typeCatalogRequest.current = controller;
    void requestTypeCatalog(controller)
      .then((data) => {
        if (controller.signal.aborted) return;
        setTypeCatalog(data);
        setTypeCatalogState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setTypeCatalogState("error");
      });
    return () => controller.abort();
  }, [requestTypeCatalog]);

  const equipmentTypeLabels = useMemo(() => new Map(typeCatalog?.equipmentTypes.map((item) => [item.code, item.name]) ?? []), [typeCatalog]);
  const systemTypeLabels = useMemo(() => new Map(typeCatalog?.systemTypes.map((item) => [item.code, item.name]) ?? []), [typeCatalog]);

  // Catalog resources for assignment picker
  const [catalogResources, setCatalogResources] = useState<ResourceDto[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const catalogRequest = useRef<AbortController | null>(null);
  const [catalogKey, setCatalogKey] = useState<string | null>(null);
  const currentCatalogKey = `${publicId}:${revision}`;
  useEffect(() => () => { catalogRequest.current?.abort(); }, [currentCatalogKey, setCatalogResources, setCatalogKey, setCatalogState]);

  // Dialog states
  const [processModal, setProcessModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    target?: ProcessDto;
  }>({ open: false, mode: "create" });

  const [equipmentModal, setEquipmentModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    target?: EquipmentDto;
  }>({ open: false, mode: "create" });

  const [equipmentSystemsModal, setEquipmentSystemsModal] = useState<{
    open: boolean;
    equipment?: EquipmentDto;
  }>({ open: false });

  const [equipmentRolesModal, setEquipmentRolesModal] = useState<{
    open: boolean;
    equipment?: EquipmentDto;
    revision?: number;
  }>({ open: false });

  const [systemModal, setSystemModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    target?: LogisticsSystemDto;
  }>({ open: false, mode: "create" });

  const [systemProcessesModal, setSystemProcessesModal] = useState<{
    open: boolean;
    system?: LogisticsSystemDto;
  }>({ open: false });

  const [systemChildrenModal, setSystemChildrenModal] = useState<{
    open: boolean;
    system?: LogisticsSystemDto;
  }>({ open: false });

  const [systemRolesModal, setSystemRolesModal] = useState<{
    open: boolean;
    system?: LogisticsSystemDto;
    revision?: number;
  }>({ open: false });

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    open: boolean;
    entityKind: "process" | "equipment" | "system";
    id: string;
    name: string;
  }>({ open: false, entityKind: "process", id: "", name: "" });

  const [sourceImpact, setSourceImpact] = useState<{ revision:number; name:string; targetNames:string[]; taskIds:string[]; legacyCount:number|null; apply:()=>Promise<void> }|null>(null);
  const sourcePreviewRequest = useRef<AbortController|null>(null);
  useEffect(() => () => { sourcePreviewRequest.current?.abort(); }, [publicId,revision]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch catalog resources when needed
  const fetchResourceCatalog = useCallback(async () => {
    catalogRequest.current?.abort();
    const controller = new AbortController();
    catalogRequest.current = controller;

    setCatalogState("loading");
    try {
      const res = await fetch("/api/resources", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
      const body: ResourceCatalogResponse = await res.json();
      if (!res.ok || !Array.isArray(body?.data?.resources) || !body.data.resources.every((resource) => resource && typeof resource.id === "string" && typeof resource.name === "string" && typeof resource.active === "boolean" && (resource.code === null || typeof resource.code === "string"))) throw new Error("catalog");
      if (controller.signal.aborted) return;
      setCatalogResources(body.data.resources);
      setCatalogKey(currentCatalogKey);
      setCatalogState("ready");
    } catch {
      if (!controller.signal.aborted) setCatalogState("error");
    }
  }, [currentCatalogKey, setCatalogResources, setCatalogKey, setCatalogState]);
  const catalogReady = catalogState === "ready" && catalogKey === currentCatalogKey;

  // Lookup maps
  const processById = useMemo(() => {
    const map = new Map<string, ProcessDto>();
    for (const p of logistics.processes) {
      map.set(p.id, p);
    }
    return map;
  }, [logistics.processes]);

  const systemById = useMemo(() => {
    const map = new Map<string, LogisticsSystemDto>();
    for (const s of logistics.systems) {
      map.set(s.id, s);
    }
    return map;
  }, [logistics.systems]);

  // Filtered collections
  const filteredProcesses = useMemo(() => {
    return logistics.processes.filter((p) => {
      if (kpiOrigin?.revision === revision && kpiOrigin.kind === "process" && kpiOrigin.id === p.id) return true;
      if (!includeInactive && !p.active) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [logistics.processes, includeInactive, searchQuery, kpiOrigin, revision]);

  const filteredEquipment = useMemo(() => {
    return logistics.equipment.filter((e) => {
      if (kpiOrigin?.revision === revision && kpiOrigin.kind === "equipment" && kpiOrigin.id === e.id) return true;
      if (!includeInactive && !e.active) return false;
      if (processFilter !== "all" && e.processId !== processFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
  return (
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q) ||
        e.manufacturer.toLowerCase().includes(q)
      );
    });
  }, [logistics.equipment, includeInactive, processFilter, searchQuery, kpiOrigin, revision]);

  const filteredSystems = useMemo(() => {
    return logistics.systems.filter((s) => {
      if (kpiOrigin?.revision === revision && kpiOrigin.kind === "system" && kpiOrigin.id === s.id) return true;
      if (!includeInactive && !s.active) return false;
      if (processFilter !== "all") {
        if (s.scope === "processes" && !s.processIds.includes(processFilter)) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    });
  }, [logistics.systems, includeInactive, processFilter, searchQuery, kpiOrigin, revision]);

  // Generic mutation executor
  const executeMutation = async (
    endpoint: string,
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    body?: unknown,
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(endpoint, {
        method,
        credentials: "same-origin",
        headers: {
          Origin: window.location.origin,
          "If-Match": `"${revision}"`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 204) {
        onRequireRefresh();
        return true;
      }

      const json: unknown = await res.json().catch(() => null);

      if (res.ok) {
        const mutation = json as LogisticsMutationResponse;
        if (mutation?.data?.logistics && mutation?.data?.project) {
          onLogisticsMutated(mutation.data.logistics, mutation.data.project);
        } else {
          onRequireRefresh();
        }
        return true;
      }

      if (res.status === 401 || res.status === 403) {
        onUnauthorized();
        setErrorMessage("편집 권한이 만료되었습니다. 상단의 편집 활성화를 다시 진행해 주세요.");
      } else if (res.status === 412) {
        const err = json as { error?: { code?: string } };
        setErrorMessage(err?.error?.code === "PROCESS_CATALOG_REVISION_MISMATCH"
          ? "공정 기준정보가 변경되었습니다. WorkArea 목록을 다시 조회하고 연결을 확인한 뒤 저장해 주세요."
          : "다른 사용자에 의해 프로젝트가 갱신되었습니다. 최신 정보를 불러온 뒤 다시 시도해 주세요.");
        onRequireRefresh();
      } else if (res.status === 409) {
        const err = json as { error?: { code?: string; message?: string } };
        const code = err?.error?.code;
        if (code === "PROCESS_CODE_ALREADY_EXISTS") {
          setErrorMessage("이미 동일한 공정 코드가 존재합니다. 다른 코드를 사용해 주세요.");
        } else if (code === "PROCESS_IN_USE") {
          setErrorMessage("하위 공정, 소속 설비 또는 시스템이 매핑되어 있어 삭제할 수 없습니다. 대신 비활성화를 사용해 주세요.");
        } else if (code === "EQUIPMENT_CODE_ALREADY_EXISTS") {
          setErrorMessage("이미 동일한 설비 코드가 존재합니다. 다른 코드를 사용해 주세요.");
        } else if (code === "EQUIPMENT_WORK_AREA_IN_USE") {
          setErrorMessage("Task 또는 Target에서 참조 중인 설비의 WorkArea 연결은 변경할 수 없습니다. 기존 연결과 입력한 초안은 유지됩니다.");
        } else if (code === "EQUIPMENT_IN_USE") {
          setErrorMessage("제어 시스템에 연결된 설비이므로 삭제할 수 없습니다. 시스템 연결을 먼저 해제하거나 비활성화해 주세요.");
        } else if (code === "SYSTEM_CODE_ALREADY_EXISTS") {
          setErrorMessage("이미 동일한 시스템 코드가 존재합니다. 다른 코드를 사용해 주세요.");
        } else if (code === "SYSTEM_IN_USE") {
          setErrorMessage("설비가 연결되어 있거나 하위 시스템으로 조율 중인 시스템은 삭제할 수 없습니다. 연결을 먼저 해제해 주세요.");
        } else if (code === "RESOURCE_INACTIVE") {
          setErrorMessage("비활성화된 리소스는 새로 배정할 수 없습니다.");
        } else if (code === "DEVELOPER_GRADE_REQUIRED") {
          setErrorMessage("개발자 역할을 배정하려면 리소스 관리에서 개발자 등급을 먼저 지정해야 합니다.");
        } else if (code === "CYCLE_DETECTED") {
          setErrorMessage("시스템 조율 관계에서 순환(사이클)이 감지되었습니다. 방향성 연계(DAG) 규칙을 확인해 주세요.");
        } else {
          setErrorMessage(err?.error?.message ?? "요청을 처리할 수 없습니다 (충돌 발생).");
        }
      } else {
        const err = json as { error?: { message?: string } };
        setErrorMessage(err?.error?.message ?? "서버 처리 중 오류가 발생했습니다.");
      }
      return false;
    } catch {
      setErrorMessage("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sub-tab button keyboard navigation
  async function previewInstanceEdit(kind:"equipment"|"system", id:string, name:string, apply:()=>Promise<void>) {
    if (!editable || isSubmitting || busy) return;
    sourcePreviewRequest.current?.abort();
    const controller = new AbortController(); sourcePreviewRequest.current=controller;
    setIsSubmitting(true); setErrorMessage(null);
    try {
      const matching: Array<{id:string;name:string}> = [];
      let offset=0;
      while (true) {
        const res=await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/targets?limit=100&offset=${offset}`,{credentials:"same-origin",cache:"no-store",signal:controller.signal});
        if(!res.ok)throw new Error();
        const data=(await res.json() as LogisticsTargetListResponse).data;
        if(data.projectRevision!==revision)throw new Error();
        matching.push(...data.targets.filter(t=>t.members.some(m=>m.kind===kind&&m.entityId===id)).map(t=>({id:t.id,name:`${t.name} (${t.code})`})));
        offset+=data.targets.length;if(offset>=data.total)break;if(!data.targets.length||offset>10000)throw new Error();
      }
      const candidateTaskIds=new Set<string>();const taskIds=new Set<string>();let legacyCount:number|null=null;
      for(const target of matching){
        const res=await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/targets/${encodeURIComponent(target.id)}/usage`,{credentials:"same-origin",cache:"no-store",signal:controller.signal});
        if(!res.ok)throw new Error();const usage=(await res.json() as {data:LogisticsTargetUsageDto}).data;
        if(usage.projectRevision!==revision||usage.targetId!==target.id)throw new Error();
        for(const row of usage.relatedTasks)candidateTaskIds.add(row.taskId);
        legacyCount=Math.max(legacyCount??0,usage.members.find(m=>m.kind===kind&&m.entityId===id)?.directTaskCount??0);
      }
      // Target usage is a candidate set: an ACS-only subset must not imply AMR impact.
      if(candidateTaskIds.size>1000)throw new Error();
      for(const taskId of candidateTaskIds){
        const res=await fetch(`/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}/target-bindings`,{credentials:"same-origin",cache:"no-store",signal:controller.signal});
        if(!res.ok)throw new Error();const data=(await res.json() as TaskTargetBindingsResponse).data;
        if(data.projectRevision!==revision||data.taskId!==taskId)throw new Error();
        if((kind==="equipment"?data.effective.effectiveEquipmentIds:data.effective.effectiveSystemIds).includes(id))taskIds.add(taskId);
      }
      if(!controller.signal.aborted)setSourceImpact({revision,name:`${name} (ID: ${id})`,targetNames:matching.map(t=>t.name),taskIds:[...taskIds],legacyCount,apply});
    }catch{if(!controller.signal.aborted){setErrorMessage("공유 인스턴스의 Target/작업 사용처를 확인하지 못해 원본 저장을 차단했습니다. 초안은 유지됩니다. 최신 정보를 다시 조회해 주세요.");setSourceImpact({revision:-1,name:`${name} (ID: ${id})`,targetNames:[],taskIds:[],legacyCount:null,apply:async()=>{}});}}
    finally{if(sourcePreviewRequest.current===controller)setIsSubmitting(false);}
  }

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, tab: SubTab) => {
    const tabs: SubTab[] = ["dashboard", "unified", "targets", "processes", "equipment", "systems", "relations"];
    const idx = tabs.indexOf(tab);
    let nextTab: SubTab | null = null;
    if (e.key === "ArrowRight") {
      nextTab = tabs[(idx + 1) % tabs.length];
    } else if (e.key === "ArrowLeft") {
      nextTab = tabs[(idx - 1 + tabs.length) % tabs.length];
    } else if (e.key === "Home") {
      nextTab = tabs[0];
    } else if (e.key === "End") {
      nextTab = tabs[tabs.length - 1];
    }
    if (nextTab) {
      e.preventDefault();
      setActiveSubTab(nextTab);
      const btn = document.getElementById(`subtab-${nextTab}`);
      btn?.focus();
      btn?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  };

      const wbsEntityTrigger = useRef<HTMLElement | null>(null);
  const handledWbsRequest = useRef<number | null>(null);
  const wbsCrossRequest = useRef(false);
  const wbsModalObservedOpen = useRef(false);
  const openWbsEntity = useCallback((dimension: WbsViewDimension, id: string, trigger: HTMLElement) => {
    if (!editable || busy || isSubmitting) return;
    wbsEntityTrigger.current = trigger;
    if (dimension === "equipment") { const target = logistics.equipment.find(row => row.id === id); if (target) setEquipmentModal({open:true,mode:"edit",target}); }
    if (dimension === "system") { const target = logistics.systems.find(row => row.id === id); if (target) setSystemModal({open:true,mode:"edit",target}); }
    if (dimension === "process") { const target = logistics.processes.find(row => row.id === id); if (target) setProcessModal({open:true,mode:"edit",target}); }
  }, [editable,busy,isSubmitting,logistics]);
  useEffect(() => {
    if (!wbsEntityOpenRequest || handledWbsRequest.current === wbsEntityOpenRequest.sequence || busy || !editable || isSubmitting) return;
    handledWbsRequest.current = wbsEntityOpenRequest.sequence;
    wbsCrossRequest.current = true;
    openWbsEntity(wbsEntityOpenRequest.dimension,wbsEntityOpenRequest.id,wbsEntityOpenRequest.trigger);
  }, [wbsEntityOpenRequest,busy,editable,isSubmitting,openWbsEntity]);
  useEffect(() => {
    if (processModal.open || equipmentModal.open || systemModal.open) {if(wbsEntityTrigger.current)wbsModalObservedOpen.current=true; return;}
    if (!wbsEntityTrigger.current || !wbsModalObservedOpen.current) return;
    wbsModalObservedOpen.current=false;
    const trigger=wbsEntityTrigger.current; wbsEntityTrigger.current=null;
    if (wbsCrossRequest.current) {wbsCrossRequest.current=false;onWbsEntityRequestHandled?.();}
    else requestAnimationFrame(() => {if (isVisibleFocusTarget(trigger)) trigger.focus({preventScroll:true});});
  }, [processModal.open,equipmentModal.open,systemModal.open,onWbsEntityRequestHandled]);
  return (
    <div className={styles.logisticsContainer}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headingRow}>
            <h2 className={styles.headerTitle}>물류 구성</h2><span className={styles.wbsNotice}>Gantt WBS와 독립</span>
            <ContextHelp label="물류 구성 도움말">
              <p>프로젝트 내 공정, 설비, 제어 및 조율 시스템과 담당자 배정 관계를 관리합니다.</p>
              <p>물류 공정은 물리적/운영 단위의 물류 흐름이며 Gantt WBS와 독립적으로 관리됩니다.</p>
            </ContextHelp>
          </div>
        </div>
        {!editable ? (
          <div className={styles.readonlyNotice}>
            조회 전용 모드입니다. 편집을 수행하려면 작업공간 상단의 &apos;편집 활성화&apos;를 진행해 주세요.
          </div>
        ) : null}
      </div>

      {/* Sub Navigation */}
      <div style={hideSubviewNavigation ? { display: "none" } : undefined} hidden={hideSubviewNavigation} className={styles.subTabList} role="tablist" aria-label="물류 구성 세부 영역">
        <button
          id="subtab-dashboard"
          className={styles.subTabButton}
          role="tab"
          type="button"
          aria-selected={activeSubTab === "dashboard"}
          aria-controls="panel-dashboard"
          tabIndex={activeSubTab === "dashboard" ? 0 : -1}
          onClick={() => setActiveSubTab("dashboard")}
          onKeyDown={(e) => handleTabKeyDown(e, "dashboard")}
        >
          KPI 대시보드
        </button>
        <button id="subtab-unified" className={styles.subTabButton} role="tab" type="button"
          aria-selected={activeSubTab === "unified"} aria-controls="panel-unified" tabIndex={activeSubTab === "unified" ? 0 : -1}
          onClick={() => setActiveSubTab("unified")} onKeyDown={e => handleTabKeyDown(e, "unified")}>
          통합 조회
        </button>
        <button id="subtab-targets" className={styles.subTabButton} role="tab" type="button" aria-selected={activeSubTab === "targets"} aria-controls="panel-targets" tabIndex={activeSubTab === "targets" ? 0 : -1} onClick={() => setActiveSubTab("targets")} onKeyDown={e => handleTabKeyDown(e, "targets")}>물류 대상(Target)</button>
        <button
          id="subtab-processes"
          className={styles.subTabButton}
          role="tab"
          type="button"
          aria-selected={activeSubTab === "processes"}
          aria-controls="panel-processes"
          tabIndex={activeSubTab === "processes" ? 0 : -1}
          onClick={() => setActiveSubTab("processes")}
          onKeyDown={(e) => handleTabKeyDown(e, "processes")}
        >
          공정 관리
          <span className={styles.countBadge}>{logistics.processes.length}</span>
        </button>
        <button
          id="subtab-equipment"
          className={styles.subTabButton}
          role="tab"
          type="button"
          aria-selected={activeSubTab === "equipment"}
          aria-controls="panel-equipment"
          tabIndex={activeSubTab === "equipment" ? 0 : -1}
          onClick={() => setActiveSubTab("equipment")}
          onKeyDown={(e) => handleTabKeyDown(e, "equipment")}
        >
          설비 관리
          <span className={styles.countBadge}>{logistics.equipment.length}</span>
        </button>
        <button
          id="subtab-systems"
          className={styles.subTabButton}
          role="tab"
          type="button"
          aria-selected={activeSubTab === "systems"}
          aria-controls="panel-systems"
          tabIndex={activeSubTab === "systems" ? 0 : -1}
          onClick={() => setActiveSubTab("systems")}
          onKeyDown={(e) => handleTabKeyDown(e, "systems")}
        >
          물류 시스템
          <span className={styles.countBadge}>{logistics.systems.length}</span>
        </button>
        <button
          id="subtab-relations"
          className={styles.subTabButton}
          role="tab"
          type="button"
          aria-selected={activeSubTab === "relations"}
          aria-controls="panel-relations"
          tabIndex={activeSubTab === "relations" ? 0 : -1}
          onClick={() => setActiveSubTab("relations")}
          onKeyDown={(e) => handleTabKeyDown(e, "relations")}
        >
          제어·조율 관계
        </button>
      </div>

      <div id="panel-targets" role="tabpanel" aria-labelledby={hideSubviewNavigation ? undefined : "subtab-targets"} hidden={activeSubTab !== "targets"}>
        {unifiedTargetRequest && !kpiOrigin ? <button type="button" className={styles.subTabButton} onClick={returnToUnified}>통합 조회로 돌아가기</button> : null}
        <ProjectLogisticsTargets openRequest={unifiedTargetRequest ?? targetOpenRequest} projectContext={projectContext} publicId={publicId} revision={revision} active={active && activeSubTab === "targets"} editable={editable} busy={busy} logistics={logistics} types={typeCatalog} onTypesChanged={()=>void retryTypeCatalog()} tasks={tasks} onMutated={onRequireRefresh} onUnauthorized={onUnauthorized} onOpenTask={onTargetTaskOpen} onOpenInstance={(kind,id)=>{if(!editable||busy||isSubmitting)return;if(kind==="equipment"){const target=logistics.equipment.find(e=>e.id===id);if(target)setEquipmentModal({open:true,mode:"edit",target});}else{const target=logistics.systems.find(e=>e.id===id);if(target)setSystemModal({open:true,mode:"edit",target});}}}/>
      </div>
      {/* Toolbar (Filters & Actions) - Only for management subtabs */}
      {activeSubTab !== "dashboard" && activeSubTab !== "unified" && activeSubTab !== "targets" ? (
        <div className={styles.toolbar} role="toolbar" aria-label="물류 필터 및 도구">
          <div className={styles.filtersGroup}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="이름, 코드 또는 ID 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="물류 항목 검색"
            />
            {activeSubTab === "equipment" || activeSubTab === "systems" ? (
              <select
                className={styles.selectInput}
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
                aria-label="공정 필터"
              >
                <option value="all">전체 공정</option>
                {logistics.processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {logisticsName(p, logistics.processes)}
                  </option>
                ))}
              </select>
            ) : null}
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              비활성 항목 포함
            </label>
          </div>

          <div className={styles.actionsGroup}>
            {editable && activeSubTab === "processes" ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setProcessModal({ open: true, mode: "create" });
                }}
              >
                + 공정 추가
              </button>
            ) : null}
            {editable && activeSubTab === "equipment" ? (
              <button
                className="primary-button"
                type="button"
                disabled={busy || isSubmitting}
                onClick={() => {
                  if (logistics.processes.length === 0) {
                    setErrorMessage("설비를 등록하려면 먼저 공정을 최소 1개 이상 생성해야 합니다.");
                    return;
                  }
                  setErrorMessage(null);
                  setEquipmentModal({ open: true, mode: "create" });
                }}
              >
                + 설비 추가
              </button>
            ) : null}
            {editable && activeSubTab === "systems" ? (
              <button
                className="primary-button"
                type="button"
                disabled={busy || isSubmitting}
                onClick={() => {
                  setErrorMessage(null);
                  setSystemModal({ open: true, mode: "create" });
                }}
              >
                + 시스템 추가
              </button>
            ) : null}
          </div>
          {editable && activeSubTab === "equipment" && logistics.processes.length === 0 ? <p className={styles.workAreaHint}>설비를 추가하려면 기준정보의 공정&amp;WorkArea에서 주 관리 공정을 먼저 등록해 주세요. Target은 필요하지 않습니다.</p> : null}
        </div>
      ) : null}

      {typeCatalogState === "error" ? (
        <div className={styles.errorBanner} role="alert">
          물류 유형 목록을 불러오지 못했습니다. 유형을 확인하기 전에는 설비/시스템 유형을 저장할 수 없습니다.
          <button className="secondary-button" type="button" onClick={() => void retryTypeCatalog()}>유형 목록 다시 시도</button>
        </div>
      ) : null}

      {/* Error Message banner if any */}
      {errorMessage ? (
        <div className={styles.errorBanner} role="alert">
          {errorMessage}
        </div>
      ) : null}

      {kpiOrigin && activeSubTab !== "dashboard" ? <button type="button" className={styles.subTabButton} onClick={returnToKpi}>KPI로 돌아가기</button> : null}

      {/* Sub-panel 0: Dashboard */}
      <div
        id="panel-dashboard"
        role="tabpanel"
        aria-labelledby={hideSubviewNavigation ? undefined : "subtab-dashboard"}
        hidden={activeSubTab !== "dashboard"}
      >
        <ProjectLogisticsDashboard
          sourceRefreshKey={kpiSourceRefreshKey}
          busy={busy || isSubmitting}
          logistics={logistics} onOpenTask={onTargetTaskOpen} onOpenAssignment={editable ? onOpenAssignment : undefined} onOpenMaster={openKpiMaster}
          tasks={tasks} active={active && activeSubTab === "dashboard"} onStageOpen={onStageOpen} onStageSchedule={onStageSchedule}
          publicId={publicId}
          revision={revision}
          onNavigateToSchedule={onNavigateToSchedule}
        />
      </div>

      <div id="panel-unified" role="tabpanel" aria-labelledby={hideSubviewNavigation ? undefined : "subtab-unified"} hidden={activeSubTab !== "unified"}>
        <ProjectLogisticsUnified perspective={perspective} onPerspectiveChange={onPerspectiveChange} publicId={publicId} revision={revision}
          active={active && activeSubTab === "unified"} busy={busy || isSubmitting} editable={editable}
          logistics={logistics} onWbsSchedule={onWbsSchedule} onWbsOpenEntity={(dimension,id,trigger) => { if (["equipment","system","process"].includes(dimension)) openWbsEntity(dimension,id,trigger); else onWbsOpenEntity?.(dimension,id,trigger); }} onOpenTask={onTargetTaskOpen} onOpenAssignment={onOpenAssignment}
          onOpenMilestone={taskId => onStageOpen?.(taskId)} onResourceSchedule={onResourceSchedule}
          onOpenTarget={(id, trigger, code) => {
            if (!editable || busy || isSubmitting) return;
            unifiedTargetTrigger.current = trigger;
            setUnifiedTargetRequest({ id, code, sequence: Date.now() });
            setActiveSubTab("targets");
          }} />
      </div>

      {/* Sub-panel 1: Processes */}
      <div
        id="panel-processes"
        role="tabpanel"
        aria-labelledby={hideSubviewNavigation ? undefined : "subtab-processes"}
        hidden={activeSubTab !== "processes"}
      >
        <div className={styles.tableContainer}>
          <table className={`${styles.dataTable} ${styles.processTable}`}>
            <thead>
              <tr>
                <th>공정명</th>
                <th>상위 공정</th>
                <th>정렬 순서</th>
                <th>상태</th>
                {editable ? <th>관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 5 : 4} className={styles.emptyState}>
                    <div className={styles.emptyStateTitle}>등록된 공정이 없습니다.<ContextHelp label="공정 등록 도움말">공정을 등록하여 물류 설비 및 시스템을 체계적으로 분류하세요.</ContextHelp></div>
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((p) => {
                  const parent = p.parentProcessId ? processById.get(p.parentProcessId) : undefined;
                  return (
                    <tr key={p.id} id={`logistics-master-process-${p.id}`} tabIndex={-1} className={!p.active ? styles.inactiveRow : undefined}>
                      <td>
                        <span className={parent ? styles.treeItemLevel1 : styles.treeItemLevel0}>
                          {parent ? "└ " : ""}
                          <strong>{p.name.trim() || "이름 확인 필요"}</strong>
                        </span>
                        <IdentifierDetails identifiers={[{ label: "공정 코드", value: p.code }, { label: "공정 ID", value: p.id }]} />
                      </td>
                      <td>{parent ? logisticsName(parent, logistics.processes) : "-"}</td>
                      <td>{p.sortOrder}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            p.active ? styles.badgeSuccess : styles.badgeInactive
                          }`}
                        >
                          {p.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      {editable ? (
                        <td>
                          <div className={styles.actionsGroup}>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setProcessModal({ open: true, mode: "edit", target: p });
                              }}
                            >
                              수정
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setDeleteConfirmModal({
                                  open: true,
                                  entityKind: "process",
                                  id: p.id,
                                  name: `${p.name} (${p.code})`,
                                });
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-panel 2: Equipment */}
      <div
        id="panel-equipment"
        role="tabpanel"
        aria-labelledby={hideSubviewNavigation ? undefined : "subtab-equipment"}
        hidden={activeSubTab !== "equipment"}
      >
        <div className={styles.tableContainer}>
          <table className={`${styles.dataTable} ${styles.equipmentTable}`}>
            <thead>
              <tr>
                <th>주 관리 공정</th>
                <th>연결 WorkArea</th>
                <th>설비명</th>
                <th>유형</th>
                <th>단위/수량</th>
                <th>주 담당자 / 공동 담당자</th>
                <th>제어 시스템</th>
                <th>상태</th>
                {editable ? <th>관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 9 : 8} className={styles.emptyState}>
                    <div className={styles.emptyStateTitle}>등록된 설비가 없습니다.<ContextHelp label="설비 등록 도움말">공정에 물류 설비(Stocker, AGV, AMR 등)를 등록하고 제어 시스템을 연결하세요.</ContextHelp></div>
                  </td>
                </tr>
              ) : (
                filteredEquipment.map((eq) => {
                  const proc = processById.get(eq.processId);
                  const primaryRole = eq.resourceRoles.find((r) => r.isPrimary);
                  const otherRoles = eq.resourceRoles.filter((r) => !r.isPrimary);
                  const primarySystemLink = eq.controlSystems.find((s) => s.controlRole === "primary");
                  const primarySys = primarySystemLink ? systemById.get(primarySystemLink.systemId) : undefined;
                  const supportingSysCount = eq.controlSystems.filter((s) => s.controlRole === "supporting").length;

                  return (
                    <tr key={eq.id} id={`logistics-master-equipment-${eq.id}`} tabIndex={-1} className={!eq.active ? styles.inactiveRow : undefined}>
                      <td>{proc ? logisticsName(proc, logistics.processes) : "공정 참조 확인 필요"}</td>
                      <td>{eq.workAreaLinks?.length ? `${eq.workAreaLinks.length}개` : "미연결"}</td>
                      <td><strong>{eq.name.trim() || "이름 확인 필요"}</strong><IdentifierDetails identifiers={[{ label: "설비 코드", value: eq.code }, { label: "설비 ID", value: eq.id }]} /></td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                          {equipmentTypeLabels.get(eq.equipmentType) ?? eq.equipmentType}
                        </span>
                      </td>
                      <td>
                        {eq.managementUnit === "fleet" ? "Fleet" : "Unit"} ({eq.quantity}대)
                      </td>
                      <td>
                        {primaryRole ? (
                          <span className={`${styles.roleTag} ${styles.roleTagPrimary}`}>
                            ★ {primaryRole.resourceName} ({primaryRole.role})
                            {!primaryRole.active ? " · 비활성" : ""}
                          </span>
                        ) : null}
                        {otherRoles.map((r) => (
                          <span key={r.resourceId} className={styles.roleTag}>
                            {r.resourceName} ({r.role})
                            {!r.active ? " · 비활성" : ""}
                          </span>
                        ))}
                        {eq.resourceRoles.length === 0 ? (
                          <span style={{ color: "var(--text-muted)" }}>미지정</span>
                        ) : null}
                      </td>
                      <td>
                        {primarySys ? (
                          <span className={`${styles.badge} ${styles.badgePrimary}`}>
                            ★ {primarySys.name}
                          </span>
                        ) : null}
                        {supportingSysCount > 0 ? (
                          <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ marginLeft: "0.25rem" }}>
                            +{supportingSysCount}
                          </span>
                        ) : null}
                        {!primarySys && supportingSysCount === 0 ? (
                          <span style={{ color: "var(--text-muted)" }}>미연결</span>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            eq.active ? styles.badgeSuccess : styles.badgeInactive
                          }`}
                        >
                          {eq.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      {editable ? (
                        <td>
                          <div className={styles.actionsGroup}>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setEquipmentModal({ open: true, mode: "edit", target: eq });
                              }}
                            >
                              수정
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setEquipmentSystemsModal({ open: true, equipment: eq });
                              }}
                            >
                              제어시스템
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                void fetchResourceCatalog();
                                setEquipmentRolesModal({ open: true, equipment: eq, revision });
                              }}
                            >
                              담당자
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setDeleteConfirmModal({
                                  open: true,
                                  entityKind: "equipment",
                                  id: eq.id,
                                  name: `${eq.name} (${eq.code})`,
                                });
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-panel 3: Systems */}
      <div
        id="panel-systems"
        role="tabpanel"
        aria-labelledby={hideSubviewNavigation ? undefined : "subtab-systems"}
        hidden={activeSubTab !== "systems"}
      >
        <div className={styles.tableContainer}>
          <table className={`${styles.dataTable} ${styles.systemTable}`}>
            <thead>
              <tr>
                <th>시스템명</th>
                <th>유형</th>
                <th>계층</th>
                <th>적용 범위</th>
                <th>주 책임자(PI) / 개발자</th>
                <th>연계 현황</th>
                <th>상태</th>
                {editable ? <th>관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredSystems.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 8 : 7} className={styles.emptyState}>
                    <div className={styles.emptyStateTitle}>등록된 물류 시스템이 없습니다.<ContextHelp label="시스템 등록 도움말">제어 시스템(SCS, ACS 등) 및 상위 조율 시스템(MCS)을 등록하세요.</ContextHelp></div>
                  </td>
                </tr>
              ) : (
                filteredSystems.map((sys) => {
                  const primaryRole = sys.resourceRoles.find((r) => r.isPrimary);
                  const otherRoles = sys.resourceRoles.filter((r) => !r.isPrimary);
                  const controlledEqCount = logistics.equipment.filter((e) =>
                    e.controlSystems.some((cs) => cs.systemId === sys.id),
                  ).length;

                  return (
                    <tr key={sys.id} id={`logistics-master-system-${sys.id}`} tabIndex={-1} className={!sys.active ? styles.inactiveRow : undefined}>
                      <td><strong>{sys.name.trim() || "이름 확인 필요"}</strong><IdentifierDetails identifiers={[{ label: "시스템 코드", value: sys.code }, { label: "시스템 ID", value: sys.id }]} /></td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                          {systemTypeLabels.get(sys.systemType) ?? sys.systemType}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            sys.layer === "coordinator" ? styles.badgePrimary : styles.badgeNeutral
                          }`}
                        >
                          {sys.layer === "coordinator" ? "조율 (Coordinator)" : "제어 (Controller)"}
                        </span>
                      </td>
                      <td>
                        {sys.scope === "project" ? (
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>프로젝트 공통</span>
                        ) : (
                          <span>
                            {sys.processIds.map((pid) => {
                              const p = processById.get(pid);
                              return (
                                <span key={pid} className={styles.roleTag}>
                                  {p ? logisticsName(p, logistics.processes) : "공정 참조 확인 필요"}
                                </span>
                              );
                            })}
                            {sys.processIds.length === 0 ? (
                              <span style={{ color: "var(--text-muted)" }}>미지정</span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td>
                        {primaryRole ? (
                          <span className={`${styles.roleTag} ${styles.roleTagPrimary}`}>
                            ★ {primaryRole.resourceName} ({primaryRole.role})
                            {!primaryRole.active ? " · 비활성" : ""}
                          </span>
                        ) : null}
                        {otherRoles.map((r) => (
                          <span key={r.resourceId} className={styles.roleTag}>
                            {r.resourceName} ({r.role})
                            {!r.active ? " · 비활성" : ""}
                          </span>
                        ))}
                        {sys.resourceRoles.length === 0 ? (
                          <span style={{ color: "var(--text-muted)" }}>미지정</span>
                        ) : null}
                      </td>
                      <td>
                        {sys.layer === "coordinator" ? (
                          <span>하위 조율: {sys.coordinatedSystemIds.length}개 시스템</span>
                        ) : (
                          <span>제어 설비: {controlledEqCount}대</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            sys.active ? styles.badgeSuccess : styles.badgeInactive
                          }`}
                        >
                          {sys.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      {editable ? (
                        <td>
                          <div className={styles.actionsGroup}>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setSystemModal({ open: true, mode: "edit", target: sys });
                              }}
                            >
                              수정
                            </button>
                            {sys.scope === "processes" ? (
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => {
                                  setErrorMessage(null);
                                  setSystemProcessesModal({ open: true, system: sys });
                                }}
                              >
                                공정매핑
                              </button>
                            ) : null}
                            {sys.layer === "coordinator" ? (
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => {
                                  setErrorMessage(null);
                                  setSystemChildrenModal({ open: true, system: sys });
                                }}
                              >
                                하위연계
                              </button>
                            ) : null}
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                void fetchResourceCatalog();
                                setSystemRolesModal({ open: true, system: sys, revision });
                              }}
                            >
                              PI/개발자
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setDeleteConfirmModal({
                                  open: true,
                                  entityKind: "system",
                                  id: sys.id,
                                  name: `${sys.name} (${sys.code})`,
                                });
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-panel 4: Relations */}
      <div
        id="panel-relations"
        role="tabpanel"
        aria-labelledby={hideSubviewNavigation ? undefined : "subtab-relations"}
        hidden={activeSubTab !== "relations"}
      >
        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>상위 조율 시스템 (Coordinator)</th>
                <th>하위 제어 시스템 (Controller)</th>
                <th>제어 대상 설비 (Equipment)</th>
                <th>주 담당자 (PI / Owner)</th>
              </tr>
            </thead>
            <tbody>
              {logistics.systems.filter((s) => s.layer === "coordinator").length === 0 &&
              logistics.systems.filter((s) => s.layer === "controller").length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyState}>
                    <div className={styles.emptyStateTitle}>연계된 제어·조율 관계가 없습니다.<ContextHelp label="제어·조율 관계 도움말">조율 시스템(MCS)과 제어 시스템(ACS, SCS 등), 그리고 제어 설비를 연결하세요.</ContextHelp></div>
                  </td>
                </tr>
              ) : (
                logistics.systems
                  .filter((s) => s.layer === "coordinator")
                  .map((coordSys) => {
                    const childSys = coordSys.coordinatedSystemIds
                      .map((cid) => systemById.get(cid))
                      .filter((s): s is LogisticsSystemDto => !!s);
                    const pi = coordSys.resourceRoles.find((r) => r.isPrimary);

                    if (childSys.length === 0) {
                      return (
                        <tr key={coordSys.id}>
                          <td>
                            <strong>{logisticsName(coordSys, logistics.systems)}</strong>
                          </td>
                          <td style={{ color: "var(--text-muted)" }}>연계된 하위 시스템 없음</td>
                          <td>-</td>
                          <td>{pi ? `★ ${pi.resourceName} (PI)` : "-"}</td>
                        </tr>
                      );
                    }

                    return childSys.map((ctrlSys, idx) => {
                      const controlledEq = logistics.equipment.filter((e) =>
                        e.controlSystems.some((cs) => cs.systemId === ctrlSys.id),
                      );
                      const ctrlPi = ctrlSys.resourceRoles.find((r) => r.isPrimary);

                      return (
                        <tr key={`${coordSys.id}-${ctrlSys.id}`}>
                          {idx === 0 ? (
                            <td rowSpan={childSys.length}>
                              <strong>{logisticsName(coordSys, logistics.systems)}</strong>
                              <br />
                              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {pi ? `★ PI: ${pi.resourceName}` : "PI 미지정"}
                              </span>
                            </td>
                          ) : null}
                          <td>
                            <strong>{logisticsName(ctrlSys, logistics.systems)}</strong>
                            {ctrlPi ? ` [PI: ${ctrlPi.resourceName}]` : ""}
                          </td>
                          <td>
                            {controlledEq.length > 0 ? (
                              <div>
                                {controlledEq.map((e) => {
                                  const cs = e.controlSystems.find((item) => item.systemId === ctrlSys.id);
                                  const isPrimaryCtrl = cs?.controlRole === "primary";
                                  return (
                                    <span
                                      key={e.id}
                                      className={`${styles.badge} ${
                                        isPrimaryCtrl ? styles.badgePrimary : styles.badgeNeutral
                                      }`}
                                      style={{ marginRight: "0.25rem", marginBottom: "0.2rem" }}
                                    >
                                      {isPrimaryCtrl ? "★ " : ""}
                                      {logisticsName(e, logistics.equipment)}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>제어 설비 없음</span>
                            )}
                          </td>
                          <td>
                            {controlledEq
                              .map((e) => {
                                const owner = e.resourceRoles.find((r) => r.isPrimary);
                                return owner ? `${e.name}: ${owner.resourceName}` : null;
                              })
                              .filter(Boolean)
                              .join(", ") || "-"}
                          </td>
                        </tr>
                      );
                    });
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- DIALOGS --- */}

      {/* 1. Process Create/Edit Dialog */}
      {processModal.open ? (
        <ProcessDialog
          mode={processModal.mode}
          process={processModal.target}
          allProcesses={logistics.processes}
          busy={isSubmitting}
          onClose={() => setProcessModal({ open: false, mode: "create" })}
          onSubmit={async (data) => {
            const ok =
              processModal.mode === "create"
                ? await executeMutation(`/api/projects/${encodeURIComponent(publicId)}/logistics/processes`, "POST", data)
                : await executeMutation(
                    `/api/projects/${encodeURIComponent(publicId)}/logistics/processes/${encodeURIComponent(
                      processModal.target!.id,
                    )}`,
                    "PATCH",
                    data,
                  );
            if (ok) setProcessModal({ open: false, mode: "create" });
          }}
        />
      ) : null}

      {/* 2. Equipment Create/Edit Dialog */}
      {equipmentModal.open ? (
        <EquipmentDialog
          mode={equipmentModal.mode}
          equipment={equipmentModal.target}
          allProcesses={logistics.processes}
          publicId={publicId}
          revision={revision}
          editable={editable && !busy}
          errorMessage={errorMessage}
          onUnauthorized={onUnauthorized}
          typeOptions={typeCatalog?.equipmentTypes ?? []}
          catalogState={typeCatalogState}
          onRetryTypes={() => void retryTypeCatalog()}
          busy={isSubmitting}
          onClose={() => setEquipmentModal({ open: false, mode: "create" })}
          onSubmit={async (data) => {
            if(equipmentModal.mode === "edit" && equipmentModal.target){
              const entity=equipmentModal.target;
              await previewInstanceEdit("equipment",entity.id,entity.name,async()=>{if(await executeMutation(`/api/projects/${encodeURIComponent(publicId)}/logistics/equipment/${encodeURIComponent(entity.id)}`,"PATCH",data)){setSourceImpact(null);setEquipmentModal({open:false,mode:"create"});}});
              return;
            }
            if(await executeMutation(`/api/projects/${encodeURIComponent(publicId)}/logistics/equipment`,"POST",data))setEquipmentModal({open:false,mode:"create"});
          }}
        />
      ) : null}

      {/* 3. Equipment Systems Dialog */}
      {equipmentSystemsModal.open && equipmentSystemsModal.equipment ? (
        <EquipmentSystemsDialog
          equipment={equipmentSystemsModal.equipment}
          allSystems={logistics.systems.filter((s) => s.layer === "controller")}
          busy={isSubmitting}
          onClose={() => setEquipmentSystemsModal({ open: false })}
          onSubmit={async (systems) => {
            const ok = await executeMutation(
              `/api/projects/${encodeURIComponent(publicId)}/logistics/equipment/${encodeURIComponent(
                equipmentSystemsModal.equipment!.id,
              )}/systems`,
              "PUT",
              { systems },
            );
            if (ok) setEquipmentSystemsModal({ open: false });
          }}
        />
      ) : null}

      {/* 4. Equipment Roles Dialog */}
      {equipmentRolesModal.open && equipmentRolesModal.equipment ? (
        <EquipmentRolesDialog
          equipment={equipmentRolesModal.equipment}
          catalogResources={catalogResources}
          catalogReady={catalogReady && equipmentRolesModal.revision === revision}
          catalogState={equipmentRolesModal.revision !== revision ? "stale" : catalogState}
          onRetry={() => void fetchResourceCatalog()}
          busy={isSubmitting}
          onClose={() => setEquipmentRolesModal({ open: false })}
          onSubmit={async (roles) => {
            if (!editable || !catalogReady || isSubmitting || equipmentRolesModal.revision !== revision) return;
            const ok = await executeMutation(
              `/api/projects/${encodeURIComponent(publicId)}/logistics/equipment/${encodeURIComponent(
                equipmentRolesModal.equipment!.id,
              )}/resource-roles`,
              "PUT",
              { roles },
            );
            if (ok) setEquipmentRolesModal({ open: false });
          }}
        />
      ) : null}

      {/* 5. System Create/Edit Dialog */}
      {systemModal.open ? (
        <SystemDialog
          mode={systemModal.mode}
          system={systemModal.target}
          allProcesses={logistics.processes}
          revision={revision}
          editable={editable && !busy}
          errorMessage={errorMessage}
          typeOptions={typeCatalog?.systemTypes ?? []}
          catalogState={typeCatalogState}
          onRetryTypes={() => void retryTypeCatalog()}
          busy={isSubmitting}
          onClose={() => setSystemModal({ open: false, mode: "create" })}
          onSubmit={async (data) => {
            if(systemModal.mode === "edit" && systemModal.target){
              const entity=systemModal.target;
              await previewInstanceEdit("system",entity.id,entity.name,async()=>{if(await executeMutation(`/api/projects/${encodeURIComponent(publicId)}/logistics/systems/${encodeURIComponent(entity.id)}`,"PATCH",data)){setSourceImpact(null);setSystemModal({open:false,mode:"create"});}});
              return;
            }
            if(await executeMutation(`/api/projects/${encodeURIComponent(publicId)}/logistics/systems`,"POST",data))setSystemModal({open:false,mode:"create"});
          }}
        />
      ) : null}

      {/* 6. System Processes Mapping Dialog */}
      {systemProcessesModal.open && systemProcessesModal.system ? (
        <SystemProcessesDialog
          system={systemProcessesModal.system}
          allProcesses={logistics.processes}
          busy={isSubmitting}
          onClose={() => setSystemProcessesModal({ open: false })}
          onSubmit={async (processIds) => {
            const ok = await executeMutation(
              `/api/projects/${encodeURIComponent(publicId)}/logistics/systems/${encodeURIComponent(
                systemProcessesModal.system!.id,
              )}/processes`,
              "PUT",
              { processIds },
            );
            if (ok) setSystemProcessesModal({ open: false });
          }}
        />
      ) : null}

      {/* 7. System Children Coordinated Dialog */}
      {systemChildrenModal.open && systemChildrenModal.system ? (
        <SystemChildrenDialog
          system={systemChildrenModal.system}
          allSystems={logistics.systems.filter((s) => s.id !== systemChildrenModal.system!.id)}
          busy={isSubmitting}
          onClose={() => setSystemChildrenModal({ open: false })}
          onSubmit={async (childSystemIds) => {
            const ok = await executeMutation(
              `/api/projects/${encodeURIComponent(publicId)}/logistics/systems/${encodeURIComponent(
                systemChildrenModal.system!.id,
              )}/children`,
              "PUT",
              { childSystemIds },
            );
            if (ok) setSystemChildrenModal({ open: false });
          }}
        />
      ) : null}

      {/* 8. System Roles Dialog */}
      {systemRolesModal.open && systemRolesModal.system ? (
        <SystemRolesDialog
          system={systemRolesModal.system}
          catalogResources={catalogResources}
          catalogReady={catalogReady && systemRolesModal.revision === revision}
          catalogState={systemRolesModal.revision !== revision ? "stale" : catalogState}
          onRetry={() => void fetchResourceCatalog()}
          busy={isSubmitting}
          onClose={() => setSystemRolesModal({ open: false })}
          onSubmit={async (roles) => {
            if (!editable || !catalogReady || isSubmitting || systemRolesModal.revision !== revision) return;
            const ok = await executeMutation(
              `/api/projects/${encodeURIComponent(publicId)}/logistics/systems/${encodeURIComponent(
                systemRolesModal.system!.id,
              )}/resource-roles`,
              "PUT",
              { roles },
            );
            if (ok) setSystemRolesModal({ open: false });
          }}
        />
      ) : null}

      {sourceImpact?<WorkspaceDialog title="공유 인스턴스 변경 확인" onClose={()=>{if(!isSubmitting)setSourceImpact(null);}} busy={isSubmitting}>
        <div className={styles.dialogForm}><p>{sourceImpact.name} · 원본 인스턴스를 변경하면 아래 Target와 작업에서 같은 변경을 읽습니다. 구성원 연결 해제와 원본 수정은 별개입니다.</p>
        {sourceImpact.revision>=0?<><p>공유 Target {sourceImpact.targetNames.length}개 · Target 경로의 관련 작업 {sourceImpact.taskIds.length}개 · 기존 직접 작업 연결 {sourceImpact.legacyCount??"미산정"}개</p>
        <ul>{sourceImpact.targetNames.map((name,i)=><li key={i}>{name}</li>)}</ul><ul>{sourceImpact.taskIds.map(id=><li key={id}>{taskContextLabels(tasks)[id]??id} · 작업 ID {id}</li>)}</ul></>:null}
        {sourceImpact.revision!==revision?<p role="alert">기준 정보가 변경되었습니다. 취소 후 사용처를 다시 확인하세요.</p>:null}
        {errorMessage?<p role="alert">{errorMessage}</p>:null}
        <div className={styles.dialogActions}><button type="button" className="secondary-button" disabled={isSubmitting} onClick={()=>setSourceImpact(null)}>원본 변경 취소</button><button type="button" className="primary-button" disabled={isSubmitting||!editable||busy||sourceImpact.revision!==revision} onClick={()=>void sourceImpact.apply()}>공유 사용처 확인 후 원본 저장</button></div></div>
      </WorkspaceDialog>:null}
      {/* 9. Delete Confirmation Dialog */}
      {deleteConfirmModal.open ? (
        <WorkspaceDialog
          title="삭제 확인"
          busy={isSubmitting}
          onClose={() => setDeleteConfirmModal({ open: false, entityKind: "process", id: "", name: "" })}
        >
          <div className={styles.dialogForm}>
            <p>
              다음 항목을 삭제하시겠습니까?
              <br />
              <strong>{deleteConfirmModal.name}</strong>
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              이 작업은 원본 항목을 삭제합니다. Target 구성원 연결 해제와는 다릅니다. 다른 항목과 연계되어 있거나 사용 중이면 삭제할 수 없으며, 대신 비활성화를 사용해 주세요.
            </p>
            <div className={styles.dialogActions}>
              <button
                className="secondary-button"
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeleteConfirmModal({ open: false, entityKind: "process", id: "", name: "" })}
              >
                취소
              </button>
              <button
                className="primary-button"
                type="button"
                style={{ backgroundColor: "var(--status-error)" }}
                disabled={isSubmitting}
                onClick={async () => {
                  let path = "";
                  if (deleteConfirmModal.entityKind === "process") {
                    path = `/api/projects/${encodeURIComponent(publicId)}/logistics/processes/${encodeURIComponent(
                      deleteConfirmModal.id,
                    )}`;
                  } else if (deleteConfirmModal.entityKind === "equipment") {
                    path = `/api/projects/${encodeURIComponent(publicId)}/logistics/equipment/${encodeURIComponent(
                      deleteConfirmModal.id,
                    )}`;
                  } else if (deleteConfirmModal.entityKind === "system") {
                    path = `/api/projects/${encodeURIComponent(publicId)}/logistics/systems/${encodeURIComponent(
                      deleteConfirmModal.id,
                    )}`;
                  }
                  const ok = await executeMutation(path, "DELETE");
                  if (ok) {
                    setDeleteConfirmModal({ open: false, entityKind: "process", id: "", name: "" });
                  }
                }}
              >
                {isSubmitting ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </WorkspaceDialog>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------
// Dialog Component Sub-definitions
// -------------------------------------------------------------

function ProcessDialog({
  mode,
  process,
  allProcesses,
  busy,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  process?: ProcessDto;
  allProcesses: ProcessDto[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProcessRequest | UpdateProcessRequest) => Promise<void>;
}) {
  const [code, setCode] = useState(process?.code ?? "");
  const [name, setName] = useState(process?.name ?? "");
  const [parentProcessId, setParentProcessId] = useState<string>(process?.parentProcessId ?? "");
  const [sortOrder, setSortOrder] = useState<number>(process?.sortOrder ?? 0);
  const [active, setActive] = useState<boolean>(process ? process.active : true);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const target = mode === "create" ? nameInputRef.current : codeInputRef.current;
    target?.focus({ preventScroll: true });
  }, [mode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (mode === "edit" && !code.trim())) return;

    const common = {
      name: name.trim(),
      parentProcessId: parentProcessId || null,
      sortOrder,
      active,
    };
    void onSubmit(mode === "create" ? common : { code: code.trim(), ...common });
  };

  const eligibleParents = allProcesses.filter((p) => p.id !== process?.id);

  return (
    <WorkspaceDialog
      title={mode === "create" ? "공정 추가" : "공정 수정"}
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          {mode === "edit" ? (
            <label className={styles.fieldLabel}>
              공정 코드 *
              <input
                ref={codeInputRef}
                className={styles.fieldInput}
                required
                disabled={busy}
                placeholder="예: PROC-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          ) : null}
          <label className={styles.fieldLabel}>
            공정명 *
            <input
              ref={nameInputRef}
              className={styles.fieldInput}
              required
              disabled={busy}
              placeholder="예: 입고 공정"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            상위 공정
            <select
              className={styles.fieldSelect}
              disabled={busy}
              value={parentProcessId}
              onChange={(e) => setParentProcessId(e.target.value)}
            >
              <option value="">(최상위 공정)</option>
              {eligibleParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {logisticsName(p, allProcesses)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            정렬 순서
            <input
              className={styles.fieldInput}
              type="number"
              disabled={busy}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </label>
          <label className={`${styles.fieldLabel} ${styles.formFieldFull}`}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                disabled={busy}
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              활성 상태 (체크 해제 시 비활성화)
            </span>
          </label>
        </div>
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={busy || !name.trim() || (mode === "edit" && !code.trim())}
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

function EquipmentDialog({
  mode,
  equipment,
  allProcesses,
  typeOptions,
  catalogState,
  onRetryTypes,
  busy: pending,
  publicId, revision, editable, errorMessage, onUnauthorized,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  equipment?: EquipmentDto;
  allProcesses: ProcessDto[];
  typeOptions: { code: string; name: string }[];
  catalogState: "loading" | "ready" | "error";
  onRetryTypes: () => void;
  busy: boolean;
  publicId: string;
  revision: number;
  editable: boolean;
  errorMessage: string | null;
  onUnauthorized: () => void;
  onClose: () => void;
  onSubmit: (data: CreateEquipmentRequest | UpdateEquipmentRequest) => Promise<void>;
}) {
  const [processId, setProcessId] = useState(equipment?.processId ?? allProcesses[0]?.id ?? "");
  const [code, setCode] = useState(equipment?.code ?? "");
  const [name, setName] = useState(equipment?.name ?? "");
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(equipment?.equipmentType ?? typeOptions[0]?.code ?? "");
  const [managementUnit, setManagementUnit] = useState<ManagementUnit>(equipment?.managementUnit ?? "unit");
  const [quantity, setQuantity] = useState(equipment?.quantity ?? 1);
  const [manufacturer, setManufacturer] = useState(equipment?.manufacturer ?? "");
  const [model, setModel] = useState(equipment?.model ?? "");
  const [description, setDescription] = useState(equipment?.description ?? "");
  const [active, setActive] = useState(equipment ? equipment.active : true);

  const [draftRevision] = useState(revision);
  const [workAreaLinks, setWorkAreaLinks] = useState<Array<{ processId: string; workAreaId: string }>>(equipment?.workAreaLinks ?? []);
  const linkKey = (link: { processId: string; workAreaId: string }) => `${link.processId}:${link.workAreaId}`;
  const selectedLinkKeys = workAreaLinks.map(linkKey);
  const [context, setContext] = useState<ProcessContextResponse["data"] | null>(null);
  const [contextState, setContextState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [initialDraft] = useState(() => JSON.stringify({ processId, code, name, equipmentType, managementUnit, quantity, manufacturer, model, description, active, workAreaLinks: [...selectedLinkKeys].sort() }));
  const dirty = initialDraft !== JSON.stringify({ processId, code, name, equipmentType, managementUnit, quantity, manufacturer, model, description, active, workAreaLinks: [...selectedLinkKeys].sort() });
  const stale = draftRevision !== revision;
  const busy = pending || !editable || stale;
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/process-context`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) onUnauthorized();
        if (!response.ok) throw new Error();
        const result = await response.json() as ProcessContextResponse;
        if (result.data.projectRevision !== draftRevision || !Array.isArray(result.data.workAreas) || !Array.isArray(result.data.occurrences) || !Array.isArray(result.data.mappings)) throw new Error();
        if (!controller.signal.aborted) { setContext(result.data); setContextState("ready"); }
      } catch { if (!controller.signal.aborted) setContextState("error"); }
    })();
    return () => controller.abort();
  }, [publicId, draftRevision, retry, onUnauthorized]);
  function requestClose() {
    if (pending) return;
    if (dirty) setDiscardPrompt(true);
    else onClose();
  }
  const workAreaOptions = context?.mappings.flatMap(mapping => {
    const process = allProcesses.find(item => item.id === mapping.processId);
    if (!process) return [];
    return context.workAreas.filter(area => area.occurrenceId === mapping.occurrenceId).map(area => ({
      processId: mapping.processId,
      workAreaId: area.id,
      name: area.name,
      owner: process.name,
      code: area.code,
      active: area.active && (mapping.workAreaSelectionActive ?? mapping.active) && process.active && !!context.occurrences.find(item => item.id === area.occurrenceId && item.active),
    }));
  }) ?? [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || contextState !== "ready" || catalogState !== "ready" || !equipmentType || !context || !code.trim() || !name.trim() || !processId) return;
    void onSubmit({
      processId,
      workAreaLinks,
      processCatalogRevision: context.processCatalogRevision,
      code: code.trim(),
      name: name.trim(),
      equipmentType,
      managementUnit,
      quantity,
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      description: description.trim(),
      active,
    });
  };

  return (
    <WorkspaceDialog
      title={mode === "create" ? "설비 추가" : "설비 수정"}
      controlledEscape
      busy={pending}
      onClose={requestClose}
      onEscape={() => discardPrompt ? setDiscardPrompt(false) : requestClose()}
    >
      <form className={`${styles.dialogForm} ${styles.equipmentForm}`} onSubmit={handleSubmit}>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {stale ? <p role="alert">프로젝트 정보가 변경되었습니다. 초안을 보존하고 있습니다. 취소 후 다시 열어 최신 정보를 확인해 주세요.</p> : !editable ? <p role="alert">편집 권한을 확인해 주세요. 입력한 초안은 유지됩니다.</p> : null}
        {discardPrompt ? <div role="alert" className={styles.errorBanner}><p>저장하지 않은 설비 변경을 폐기할까요?</p><button className="secondary-button" type="button" autoFocus disabled={pending} onClick={() => setDiscardPrompt(false)}>계속 편집</button><button className="secondary-button" type="button" disabled={pending} onClick={onClose}>변경 폐기</button></div> : null}
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            주 관리 공정 *
            <select
              className={styles.fieldSelect}
              required
              disabled={busy}
              value={processId}
              onChange={(e) => setProcessId(e.target.value)}
            >
              {allProcesses.map((p) => (
                <option key={p.id} value={p.id}>
                  {logisticsName(p, allProcesses)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={`${styles.workAreaPicker} ${styles.formFieldFull}`} disabled={busy || contextState !== "ready"}>
            <legend>연결 WorkArea (선택)</legend>
            <p className={styles.workAreaHint}>선택 {workAreaLinks.length}개 · 미연결도 정상입니다. 주 관리 공정과 다른 공정의 구역도 연결할 수 있습니다.</p>
            <p className={styles.workAreaHint}>연결 해제는 설비 원본이나 수량을 삭제하지 않습니다.</p>
            {contextState === "loading" ? <p role="status">WorkArea 목록을 불러오는 중…</p> : null}
            {contextState === "error" ? <p role="alert">WorkArea 목록을 확인할 수 없어 저장할 수 없습니다. 초안은 유지됩니다.</p> : null}
            {contextState === "ready" ? <>
              <button type="button" className="secondary-button" disabled={busy || !workAreaLinks.length} onClick={() => setWorkAreaLinks([])}>전체 연결 해제</button>
              <div className={styles.workAreaOptions}>
                {workAreaOptions.filter(area => area.active || selectedLinkKeys.includes(linkKey(area))).map(area => <label key={linkKey(area)} className={styles.workAreaOption}>
                  <input type="checkbox" checked={selectedLinkKeys.includes(linkKey(area))} disabled={busy || (!area.active && !selectedLinkKeys.includes(linkKey(area)))} onChange={event => setWorkAreaLinks(links => event.target.checked ? [...links.filter(link => link.workAreaId !== area.workAreaId), { processId: area.processId, workAreaId: area.workAreaId }] : links.filter(link => linkKey(link) !== linkKey(area)))} />
                  <span>{area.name} — {area.owner} · {area.code}{area.active ? "" : " (비활성)"}</span>
                </label>)}
                {workAreaLinks.filter(link => !workAreaOptions.some(area => linkKey(area) === linkKey(link))).map(link => <label key={linkKey(link)} className={styles.workAreaOption}><input type="checkbox" checked disabled={busy} onChange={() => setWorkAreaLinks(links => links.filter(value => linkKey(value) !== linkKey(link)))} /><span>확인할 수 없는 WorkArea · {link.workAreaId} · {link.processId}</span></label>)}
              </div>
              {!workAreaOptions.length && !workAreaLinks.length ? <p>등록된 WorkArea가 없습니다. 미연결 상태로 저장할 수 있습니다.</p> : null}
            </> : null}
          </fieldset>
          <button type="button" className="secondary-button" disabled={busy || contextState === "loading"} onClick={() => { setContextState("loading"); setRetry(value => value + 1); }}>WorkArea 목록 다시 조회</button>
          <LogisticsTypeField kind="설비" value={equipmentType} existingValue={equipment?.equipmentType} options={typeOptions} state={catalogState} busy={busy} onChange={setEquipmentType} onRetry={onRetryTypes} />
          <label className={styles.fieldLabel}>
            설비 코드 *
            <input
              className={styles.fieldInput}
              required
              autoFocus
              ref={input => { input?.setAttribute("autofocus", ""); }}
              disabled={busy}
              placeholder="예: STK-01, AGV-F1"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            설비명 *
            <input
              className={styles.fieldInput}
              required
              disabled={busy}
              placeholder="예: 1번 스토커"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            관리 단위
            <select
              className={styles.fieldSelect}
              disabled={busy}
              value={managementUnit}
              onChange={(e) => { const unit = e.target.value as ManagementUnit; setManagementUnit(unit); if (unit === "unit") setQuantity(1); }}
            >
              <option value="unit">단품 (Unit)</option>
              <option value="fleet">군집 (Fleet)</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            수량 (대) · 단품은 1대
            <input
              className={styles.fieldInput}
              type="number"
              min={1}
              step={1}
              required
              disabled={busy || managementUnit === "unit"}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </label>
          <label className={styles.fieldLabel}>
            제조사
            <input
              className={styles.fieldInput}
              disabled={busy}
              placeholder="제조사명"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            모델명
            <input
              className={styles.fieldInput}
              disabled={busy}
              placeholder="모델명"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          <label className={`${styles.fieldLabel} ${styles.formFieldFull}`}>
            설명
            <textarea
              className={styles.fieldTextarea}
              disabled={busy}
              placeholder="설비 상세 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className={`${styles.fieldLabel} ${styles.formFieldFull}`}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                disabled={busy}
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              활성 상태 (체크 해제 시 비활성화)
            </span>
          </label>
        </div>
        {!code.trim() || !name.trim() || !processId ? <p className={styles.workAreaHint}>저장하려면 주 관리 공정, 설비 코드와 설비명을 입력해 주세요.</p> : null}
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={pending} onClick={requestClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy || contextState !== "ready" || catalogState !== "ready" || !equipmentType || !code.trim() || !name.trim() || !processId}>
            {pending ? "저장 중…" : catalogState === "error" ? "유형 조회 실패" : "저장"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

function EquipmentSystemsDialog({
  equipment,
  allSystems,
  busy,
  onClose,
  onSubmit,
}: {
  equipment: EquipmentDto;
  allSystems: LogisticsSystemDto[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (systems: { systemId: string; controlRole: ControlRole }[]) => Promise<void>;
}) {
  const [mappings, setMappings] = useState<Map<string, ControlRole>>(() => {
    const map = new Map<string, ControlRole>();
    for (const item of equipment.controlSystems) {
      map.set(item.systemId, item.controlRole);
    }
    return map;
  });

  const toggleSystem = (sysId: string, checked: boolean) => {
    const next = new Map(mappings);
    if (checked) {
      // default role is supporting if already has primary, else primary
      const hasPrimary = Array.from(next.values()).includes("primary");
      next.set(sysId, hasPrimary ? "supporting" : "primary");
    } else {
      next.delete(sysId);
    }
    setMappings(next);
  };

  const setRole = (sysId: string, role: ControlRole) => {
    const next = new Map(mappings);
    if (role === "primary") {
      // only 1 primary allowed
      for (const [k, v] of next.entries()) {
        if (v === "primary") next.set(k, "supporting");
      }
    }
    next.set(sysId, role);
    setMappings(next);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result: { systemId: string; controlRole: ControlRole }[] = [];
    for (const [systemId, controlRole] of mappings.entries()) {
      result.push({ systemId, controlRole });
    }
    void onSubmit(result);
  };

  return (
    <WorkspaceDialog
      title={`제어 시스템 설정 - ${equipment.name}`}
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
          설비를 제어하는 제어 시스템(Controller)을 선택하고 주 제어 시스템(Primary, 최대 1개)을 지정합니다.
        </p>
        <div style={{ display: "grid", gap: "0.5rem", maxHeight: "320px", overflowY: "auto" }}>
          {allSystems.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>등록된 제어 시스템이 없습니다.</p>
          ) : (
            allSystems.map((s) => {
              const isSelected = mappings.has(s.id);
              const currentRole = mappings.get(s.id);
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.5rem",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius)",
                    background: isSelected ? "var(--surface-subtle)" : "transparent",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={isSelected}
                      onChange={(e) => toggleSystem(s.id, e.target.checked)}
                    />
                    <span>
                      <strong>{logisticsName(s, allSystems)}</strong> - {s.systemType.toUpperCase()}
                    </span>
                  </label>
                  {isSelected ? (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <input
                          type="radio"
                          name={`role-${s.id}`}
                          disabled={busy}
                          checked={currentRole === "primary"}
                          onChange={() => setRole(s.id, "primary")}
                        />
                        주 제어 (Primary)
                      </label>
                      <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <input
                          type="radio"
                          name={`role-${s.id}`}
                          disabled={busy}
                          checked={currentRole === "supporting"}
                          onChange={() => setRole(s.id, "supporting")}
                        />
                        보조 (Supporting)
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

function EquipmentRolesDialog({
  equipment,
  catalogResources,
  catalogReady,
  catalogState,
  onRetry,
  busy,
  onClose,
  onSubmit,
}: {
  equipment: EquipmentDto;
  catalogResources: ResourceDto[];
  catalogReady: boolean;
  catalogState: "idle" | "loading" | "ready" | "error" | "stale";
  onRetry: () => void;
  busy: boolean;
  onClose: () => void;
  onSubmit: (roles: { resourceId: string; role: EquipmentRole; isPrimary?: boolean }[]) => Promise<void>;
}) {
  const [selectedRoles, setSelectedRoles] = useState<
    Array<{
      resourceId: string;
      role: EquipmentRole;
      isPrimary: boolean;
    }>
  >(() => {
    return equipment.resourceRoles.map((r) => ({
      resourceId: r.resourceId,
      role: r.role,
      isPrimary: r.isPrimary,
    }));
  });

  const [addResourceId, setAddResourceId] = useState("");
  const [addRole, setAddRole] = useState<EquipmentRole>("owner");
  const [addIsPrimary, setAddIsPrimary] = useState(false);

  const resourceById = useMemo(() => {
    const map = new Map<string, ResourceDto>();
    for (const r of catalogResources) {
      map.set(r.id, r);
    }
    return map;
  }, [catalogResources]);

  function selectedIdentity(resourceId: string) {
    const res = resourceById.get(resourceId);
    const canonical = equipment.resourceRoles.find(role => role.resourceId === resourceId);
    const name = catalogReady && res ? res.name : canonical?.resourceName ?? "등록 정보를 확인할 수 없는 인력";
    const code = catalogReady && res ? res.code : canonical?.resourceCode;
    const duplicateName = catalogReady && res
      ? catalogResources.some(other => other.id !== resourceId && other.name === res.name)
      : canonical && equipment.resourceRoles.some(other => other.resourceId !== resourceId && other.resourceName === canonical.resourceName && selectedRoles.some(selected => selected.resourceId === other.resourceId));
    return { name: duplicateName ? `${name} (${code || resourceId})` : name, code };
  }

  const handleAdd = () => {
    if (busy || !catalogReady) return;
    if (!addResourceId) return;
    const exists = selectedRoles.some((r) => r.resourceId === addResourceId && r.role === addRole);
    if (exists) {
      alert("이미 동일한 리소스와 역할 조합이 추가되어 있습니다.");
      return;
    }
    const res = resourceById.get(addResourceId);
    if (res && !res.active) {
      alert("비활성화된 리소스는 새로 배정할 수 없습니다.");
      return;
    }

    let next = [...selectedRoles];
    if (addIsPrimary) {
      // primary is only 1
      next = next.map((r) => ({ ...r, isPrimary: false }));
    }
    next.push({
      resourceId: addResourceId,
      role: addRole,
      isPrimary: addIsPrimary,
    });
    setSelectedRoles(next);
    setAddResourceId("");
    setAddIsPrimary(false);
  };

  const handleRemove = (index: number) => {
    if (busy || !catalogReady) return;
    setSelectedRoles(selectedRoles.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (index: number) => {
    if (busy || !catalogReady) return;
    const target = selectedRoles[index];
    if (target.role !== "owner") {
      alert("주 담당자(Primary)는 '설비 담당(owner)' 역할에만 지정 가능합니다.");
      return;
    }
    setSelectedRoles(
      selectedRoles.map((r, i) => ({
        ...r,
        isPrimary: i === index ? !r.isPrimary : false,
      })),
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || !catalogReady) return;
    void onSubmit(selectedRoles);
  };

  return (
    <WorkspaceDialog
      title={`설비 담당자 배정 - ${equipment.name}`}
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
        {!catalogReady ? <div>
          <p role={catalogState === "error" || catalogState === "stale" ? "alert" : "status"}>
            {catalogState === "stale" ? "프로젝트 정보가 변경되어 이전 배정을 저장할 수 없습니다. 취소 후 담당자 배정을 다시 열어 최신 정보를 확인해 주세요." : catalogState === "error" ? "리소스 목록을 불러오지 못했습니다. 기존 배정은 유지되며 최신 목록 확인 전에는 저장할 수 없습니다." : "리소스 목록을 불러오는 중…"}
          </p>
          {catalogState === "error" ? <button type="button" className="secondary-button" onClick={onRetry}>리소스 목록 다시 시도</button> : null}
        </div> : null}
        <fieldset disabled={busy || !catalogReady} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
          리소스 카탈로그에서 인력을 선택하여 설비 담당자(Owner) 또는 참여자(Contributor)로 배정합니다.
          <br />
          주 담당자(★ Primary)는 최대 1명의 Owner에만 지정 가능합니다.
        </p>

        {/* Existing assigned roles */}
        <div style={{ display: "grid", gap: "0.4rem", maxHeight: "200px", overflowY: "auto" }}>
          {selectedRoles.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>배정된 담당자가 없습니다.</p>
          ) : (
            selectedRoles.map((item, idx) => {
              const res = resourceById.get(item.resourceId);
              const { name: displayName } = selectedIdentity(item.resourceId);
              const isInactive = catalogReady && res ? !res.active : false;

              return (
                <div
                  key={`${item.resourceId}-${item.role}`}
                  data-role-resource-id={item.resourceId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.45rem 0.65rem",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius)",
                    background: item.isPrimary ? "var(--action-selected-subtle)" : "var(--surface-panel)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>
                      {item.isPrimary ? "★ " : ""}
                      <strong>{displayName}</strong> - {item.role === "owner" ? "설비 담당(Owner)" : "참여(Contributor)"}
                    </span>
                    {isInactive ? (
                      <span className={`${styles.badge} ${styles.badgeInactive}`}>비활성</span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {item.role === "owner" ? (
                      <button
                        className="secondary-button"
                        type="button"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => handleSetPrimary(idx)}
                      >
                        {item.isPrimary ? "주 담당 해제" : "주 담당 지정"}
                      </button>
                    ) : null}
                    <button
                      className="secondary-button"
                      type="button"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "var(--status-error)" }}
                      onClick={() => handleRemove(idx)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add new role section */}
        <div
          style={{
            borderTop: "1px solid var(--border-default)",
            paddingTop: "0.75rem",
            display: "grid",
            gap: "0.5rem",
          }}
        >
          <strong style={{ fontSize: "0.85rem" }}>새 담당자 추가</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <select
              className={styles.fieldSelect}
              style={{ minWidth: "200px" }}
              value={addResourceId}
              onChange={(e) => setAddResourceId(e.target.value)}
            >
              <option value="">(리소스 선택)</option>
              {catalogResources.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.active}>
                  {catalogResources.filter(item => item.name === r.name).length > 1 ? `${r.name} (${r.code ?? r.id})` : r.name} · {developerGradeLabel(r.developerGrade)} {!r.active ? " · 비활성" : ""}
                </option>
              ))}
            </select>
            <select
              className={styles.fieldSelect}
              value={addRole}
              onChange={(e) => {
                const r = e.target.value as EquipmentRole;
                setAddRole(r);
                if (r !== "owner") setAddIsPrimary(false);
              }}
            >
              <option value="owner">설비 담당 (Owner)</option>
              <option value="contributor">참여 (Contributor)</option>
            </select>
            {addRole === "owner" ? (
              <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={addIsPrimary}
                  onChange={(e) => setAddIsPrimary(e.target.checked)}
                />
                주 담당자 (Primary)
              </label>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              disabled={!addResourceId}
              onClick={handleAdd}
            >
              추가
            </button>
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            ※ 카탈로그에 없는 인력은 리소스 관리 메뉴에서 먼저 등록해야 합니다. Developer는 개발자 등급이 지정된 리소스만 새로 배정할 수 있습니다.
          </span>
        </div>

        </fieldset>
        <section aria-label="배정된 인력 식별 정보" style={{ display: "grid", gap: "0.4rem", minWidth: 0 }}>
          {selectedRoles.map(item => {
            const { name, code } = selectedIdentity(item.resourceId);
            return <IdentifierDetails key={`${item.resourceId}-${item.role}`} label={`${name} 식별 정보`} identifiers={[
              { label: "리소스 ID", value: item.resourceId },
              ...(code ? [{ label: "리소스 코드", value: code }] : []),
            ]} />;
          })}
        </section>
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy || !catalogReady}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

function SystemDialog({
  mode,
  system,
  allProcesses,
  typeOptions,
  catalogState,
  onRetryTypes,
  revision, editable, errorMessage,
  busy: pending,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  system?: LogisticsSystemDto;
  allProcesses: ProcessDto[];
  typeOptions: { code: string; name: string }[];
  catalogState: "loading" | "ready" | "error";
  onRetryTypes: () => void;
  revision: number;
  editable: boolean;
  errorMessage: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLogisticsSystemRequest | UpdateLogisticsSystemRequest) => Promise<void>;
}) {
  const [code, setCode] = useState(system?.code ?? "");
  const [name, setName] = useState(system?.name ?? "");
  const [systemType, setSystemType] = useState<LogisticsSystemType>(system?.systemType ?? typeOptions[0]?.code ?? "");
  const [layer, setLayer] = useState<SystemLayer>(system?.layer ?? "coordinator");
  const [scope, setScope] = useState<SystemScope>(system?.scope ?? "project");
  const [processIds, setProcessIds] = useState<string[]>(system?.processIds ?? []);
  const [vendor, setVendor] = useState(system?.vendor ?? "");
  const [description, setDescription] = useState(system?.description ?? "");
  const [active, setActive] = useState(system ? system.active : true);

  const [draftRevision] = useState(revision);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const discardTrigger = useRef<HTMLElement | null>(null);
  function continueEditing() {
    setDiscardPrompt(false);
    requestAnimationFrame(() => {
      if (isVisibleFocusTarget(discardTrigger.current)) discardTrigger.current.focus({ preventScroll: true });
    });
  }
  const [initialDraft] = useState(() => JSON.stringify({ code, name, systemType, layer, scope, processIds: [...processIds].sort(), vendor, description, active }));
  const dirty = initialDraft !== JSON.stringify({ code, name, systemType, layer, scope, processIds: [...processIds].sort(), vendor, description, active });
  const stale = draftRevision !== revision;
  const busy = pending || !editable || stale;
  const needsProcesses = scope === "processes" && processIds.length === 0;
  function requestClose() {
    if (pending) return;
    if (dirty) {
      discardTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDiscardPrompt(true);
    }
    else onClose();
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || catalogState !== "ready" || !systemType || !code.trim() || !name.trim() || needsProcesses) return;
    void onSubmit({
      code: code.trim(),
      name: name.trim(),
      systemType,
      layer,
      scope,
      processIds: scope === "processes" ? processIds : [],
      vendor: vendor.trim(),
      description: description.trim(),
      active,
    });
  };

  return (
    <WorkspaceDialog
      title={mode === "create" ? "시스템 추가" : "시스템 수정"}
      controlledEscape
      busy={pending}
      onClose={requestClose}
      onEscape={() => discardPrompt ? continueEditing() : requestClose()}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {stale ? <p role="alert">프로젝트 정보가 변경되었습니다. 초안을 보존하고 있습니다. 취소 후 다시 열어 최신 정보를 확인해 주세요.</p> : !editable ? <p role="alert">편집 권한을 확인해 주세요. 입력한 초안은 유지됩니다.</p> : null}
        {discardPrompt ? <div role="alert" className={styles.errorBanner}><p>저장하지 않은 시스템 변경을 폐기할까요?</p><button className="secondary-button" type="button" autoFocus ref={button => { button?.focus({ preventScroll: true }); }} disabled={pending} onClick={continueEditing}>계속 편집</button><button className="secondary-button" type="button" disabled={pending} onClick={onClose}>변경 폐기</button></div> : null}
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            시스템 코드 *
            <input
              className={styles.fieldInput}
              required
              autoFocus
              disabled={busy}
              placeholder="예: MCS-01, ACS-01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            시스템명 *
            <input
              className={styles.fieldInput}
              required
              disabled={busy}
              placeholder="예: 통합 반송 조율 시스템"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <LogisticsTypeField kind="시스템" value={systemType} existingValue={system?.systemType} options={typeOptions} state={catalogState} busy={busy} onChange={setSystemType} onRetry={onRetryTypes} />
          <label className={styles.fieldLabel}>
            계층 (Layer) *
            <select
              className={styles.fieldSelect}
              required
              disabled={busy}
              value={layer}
              onChange={(e) => setLayer(e.target.value as SystemLayer)}
            >
              <option value="coordinator">조율 계층 (Coordinator - e.g. MCS)</option>
              <option value="controller">제어 계층 (Controller - e.g. ACS, SCS)</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            적용 범위 (Scope) *
            <select
              className={styles.fieldSelect}
              required
              disabled={busy}
              value={scope}
              onChange={(e) => setScope(e.target.value as SystemScope)}
            >
              <option value="project">프로젝트 공통 (Project)</option>
              <option value="processes">복수 공정 한정 (Processes)</option>
            </select>
          </label>
          {scope === "processes" ? <fieldset className={`${styles.workAreaPicker} ${styles.formFieldFull}`} disabled={busy} aria-describedby="system-process-selection-status">
            <legend>담당 공정 (1개 이상 필수)</legend>
            <p id="system-process-selection-status" className={styles.workAreaHint}>{allProcesses.length ? `선택 ${processIds.length}개 · 시스템 관할 범위만 설정하며 Task의 공정은 변경하지 않습니다.` : "등록된 공정이 없습니다. 주 관리 공정을 먼저 등록하거나 프로젝트 공통 범위를 선택해 주세요."}</p>
            <div className={styles.workAreaOptions}>
              {allProcesses.filter(process => process.active || processIds.includes(process.id)).map(process => <label key={process.id} className={styles.workAreaOption}>
                <input type="checkbox" checked={processIds.includes(process.id)} onChange={event => setProcessIds(ids => event.target.checked ? [...ids, process.id] : ids.filter(id => id !== process.id))} />
                <span>{process.code} — {process.name}{process.active ? "" : " (비활성 기존 공정)"}</span>
              </label>)}
            </div>
            {needsProcesses && allProcesses.length > 0 ? <p className={styles.workAreaHint}>복수 공정 한정 범위로 저장하려면 담당 공정을 1개 이상 선택해 주세요.</p> : null}
          </fieldset> : null}
          <label className={styles.fieldLabel}>
            벤더사
            <input
              className={styles.fieldInput}
              disabled={busy}
              placeholder="공급/개발 벤더사"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </label>
          <label className={`${styles.fieldLabel} ${styles.formFieldFull}`}>
            설명
            <textarea
              className={styles.fieldTextarea}
              disabled={busy}
              placeholder="시스템 상세 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className={`${styles.fieldLabel} ${styles.formFieldFull}`}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                disabled={busy}
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              활성 상태 (체크 해제 시 비활성화)
            </span>
          </label>
        </div>
        {!code.trim() || !name.trim() ? <p className={styles.workAreaHint}>저장하려면 시스템 코드와 시스템명을 입력해 주세요.</p> : null}
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={pending} onClick={requestClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy || catalogState !== "ready" || !systemType || !code.trim() || !name.trim() || needsProcesses}>
            {pending ? "저장 중…" : catalogState === "error" ? "유형 조회 실패" : "저장"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

function SystemProcessesDialog({
  system,
  allProcesses,
  busy,
  onClose,
  onSubmit,
}: {
  system: LogisticsSystemDto;
  allProcesses: ProcessDto[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (processIds: string[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(system.processIds));

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(Array.from(selectedIds));
  };

  return (
    <WorkspaceDialog
      title={`담당 공정 설정 - ${system.name}`}
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
          이 시스템이 관할하는 공정을 다중 선택합니다.
        </p>
        <div style={{ display: "grid", gap: "0.5rem", maxHeight: "280px", overflowY: "auto" }}>
          {allProcesses.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>등록된 공정이 없습니다.</p>
          ) : (
            allProcesses.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={selectedIds.has(p.id)}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                />
                <span>
                  <strong>{logisticsName(p, allProcesses)}</strong>
                </span>
              </label>
            ))
          )}
        </div>
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

function SystemChildrenDialog({
  system,
  allSystems,
  busy,
  onClose,
  onSubmit,
}: {
  system: LogisticsSystemDto;
  allSystems: LogisticsSystemDto[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (childSystemIds: string[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(system.coordinatedSystemIds));

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(Array.from(selectedIds));
  };

  return (
    <WorkspaceDialog
      title={`하위 조율 시스템 연계 - ${system.name}`}
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
          상위 조율 시스템({system.name})이 명령/작업을 조율할 하위 제어/조율 시스템을 선택합니다.
          <br />
          순환 연계(DAG cycle)는 서버에서 자동으로 검증 및 방지됩니다.
        </p>
        <div style={{ display: "grid", gap: "0.5rem", maxHeight: "280px", overflowY: "auto" }}>
          {allSystems.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>연계 가능한 다른 시스템이 없습니다.</p>
          ) : (
            allSystems.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={selectedIds.has(s.id)}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                />
                <span>
                  <strong>{logisticsName(s, allSystems)}</strong> ({s.layer === "coordinator" ? "조율" : "제어"})
                </span>
              </label>
            ))
          )}
        </div>
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

function SystemRolesDialog({
  system,
  catalogResources,
  catalogReady,
  catalogState,
  onRetry,
  busy,
  onClose,
  onSubmit,
}: {
  system: LogisticsSystemDto;
  catalogResources: ResourceDto[];
  catalogReady: boolean;
  catalogState: "idle" | "loading" | "ready" | "error" | "stale";
  onRetry: () => void;
  busy: boolean;
  onClose: () => void;
  onSubmit: (roles: { resourceId: string; role: SystemRole; isPrimary?: boolean }[]) => Promise<void>;
}) {
  const [selectedRoles, setSelectedRoles] = useState<
    Array<{
      resourceId: string;
      role: SystemRole;
      isPrimary: boolean;
    }>
  >(() => {
    return system.resourceRoles.map((r) => ({
      resourceId: r.resourceId,
      role: r.role,
      isPrimary: r.isPrimary,
    }));
  });

  const [addResourceId, setAddResourceId] = useState("");
  const [addRole, setAddRole] = useState<SystemRole>("pi");
  const [addIsPrimary, setAddIsPrimary] = useState(false);

  const resourceById = useMemo(() => {
    const map = new Map<string, ResourceDto>();
    for (const r of catalogResources) {
      map.set(r.id, r);
    }
    return map;
  }, [catalogResources]);

  function selectedIdentity(resourceId: string) {
    const res = resourceById.get(resourceId);
    const canonical = system.resourceRoles.find(role => role.resourceId === resourceId);
    const name = catalogReady && res ? res.name : canonical?.resourceName ?? "등록 정보를 확인할 수 없는 인력";
    const code = catalogReady && res ? res.code : canonical?.resourceCode;
    const duplicateName = catalogReady && res
      ? catalogResources.some(other => other.id !== resourceId && other.name === res.name)
      : canonical && system.resourceRoles.some(other => other.resourceId !== resourceId && other.resourceName === canonical.resourceName && selectedRoles.some(selected => selected.resourceId === other.resourceId));
    return { name: duplicateName ? `${name} (${code || resourceId})` : name, code };
  }

  const handleAdd = () => {
    if (busy || !catalogReady) return;
    if (!addResourceId) return;
    const exists = selectedRoles.some((r) => r.resourceId === addResourceId && r.role === addRole);
    if (exists) {
      alert("이미 동일한 리소스와 역할 조합이 추가되어 있습니다.");
      return;
    }
    const res = resourceById.get(addResourceId);
    if (res && !res.active) {
      alert("비활성화된 리소스는 새로 배정할 수 없습니다.");
      return;
    }
    if (addRole === "developer" && !res?.developerGrade) {
      alert("개발자 역할을 배정하려면 리소스 관리에서 개발자 등급을 먼저 지정해 주세요.");
      return;
    }

    let next = [...selectedRoles];
    if (addIsPrimary) {
      next = next.map((r) => ({ ...r, isPrimary: false }));
    }
    next.push({
      resourceId: addResourceId,
      role: addRole,
      isPrimary: addIsPrimary,
    });
    setSelectedRoles(next);
    setAddResourceId("");
    setAddIsPrimary(false);
  };

  const handleRemove = (index: number) => {
    if (busy || !catalogReady) return;
    setSelectedRoles(selectedRoles.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (index: number) => {
    if (busy || !catalogReady) return;
    const target = selectedRoles[index];
    if (target.role !== "pi") {
      alert("주 책임자(Primary)는 'PI(책임자)' 역할에만 지정 가능합니다.");
      return;
    }
    setSelectedRoles(
      selectedRoles.map((r, i) => ({
        ...r,
        isPrimary: i === index ? !r.isPrimary : false,
      })),
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || !catalogReady) return;
    void onSubmit(selectedRoles);
  };

  return (
    <WorkspaceDialog
      title={`시스템 PI/개발자 배정 - ${system.name}`}
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
        {!catalogReady ? <div>
          <p role={catalogState === "error" || catalogState === "stale" ? "alert" : "status"}>
            {catalogState === "stale" ? "프로젝트 정보가 변경되어 이전 배정을 저장할 수 없습니다. 취소 후 담당자 배정을 다시 열어 최신 정보를 확인해 주세요." : catalogState === "error" ? "리소스 목록을 불러오지 못했습니다. 기존 배정은 유지되며 최신 목록 확인 전에는 저장할 수 없습니다." : "리소스 목록을 불러오는 중…"}
          </p>
          {catalogState === "error" ? <button type="button" className="secondary-button" onClick={onRetry}>리소스 목록 다시 시도</button> : null}
        </div> : null}
        <fieldset disabled={busy || !catalogReady} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
          리소스 카탈로그에서 인력을 선택하여 시스템 책임자(PI) 또는 개발자(Developer)로 배정합니다.
          <br />
          주 책임자(★ Primary)는 최대 1명의 PI에만 지정 가능합니다.
        </p>

        {/* Existing roles */}
        <div style={{ display: "grid", gap: "0.4rem", maxHeight: "200px", overflowY: "auto" }}>
          {selectedRoles.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>배정된 인력이 없습니다.</p>
          ) : (
            selectedRoles.map((item, idx) => {
              const res = resourceById.get(item.resourceId);
              const { name: displayName } = selectedIdentity(item.resourceId);
              const gradeText = developerGradeLabel(res?.developerGrade);
              const isInactive = catalogReady && res ? !res.active : false;

              return (
                <div
                  key={`${item.resourceId}-${item.role}`}
                  data-role-resource-id={item.resourceId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.45rem 0.65rem",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius)",
                    background: item.isPrimary ? "var(--action-selected-subtle)" : "var(--surface-panel)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>
                      {item.isPrimary ? "★ " : ""}
                      <strong>{displayName}</strong> - {item.role === "pi" ? "책임자 (PI)" : `개발자 (Developer) · ${gradeText}`}
                    </span>
                    {isInactive ? (
                      <span className={`${styles.badge} ${styles.badgeInactive}`}>비활성</span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {item.role === "pi" ? (
                      <button
                        className="secondary-button"
                        type="button"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => handleSetPrimary(idx)}
                      >
                        {item.isPrimary ? "주 책임 해제" : "주 책임 지정"}
                      </button>
                    ) : null}
                    <button
                      className="secondary-button"
                      type="button"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "var(--status-error)" }}
                      onClick={() => handleRemove(idx)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add role */}
        <div
          style={{
            borderTop: "1px solid var(--border-default)",
            paddingTop: "0.75rem",
            display: "grid",
            gap: "0.5rem",
          }}
        >
          <strong style={{ fontSize: "0.85rem" }}>새 인력 추가</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <select
              className={styles.fieldSelect}
              style={{ minWidth: "200px" }}
              value={addResourceId}
              onChange={(e) => setAddResourceId(e.target.value)}
            >
              <option value="">(리소스 선택)</option>
              {catalogResources.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.active}>
                  {catalogResources.filter(item => item.name === r.name).length > 1 ? `${r.name} (${r.code ?? r.id})` : r.name} {!r.active ? " · 비활성" : ""}
                </option>
              ))}
            </select>
            <select
              className={styles.fieldSelect}
              value={addRole}
              onChange={(e) => {
                const r = e.target.value as SystemRole;
                setAddRole(r);
                if (r !== "pi") setAddIsPrimary(false);
              }}
            >
              <option value="pi">책임자 (PI)</option>
              <option value="developer">개발자 (Developer)</option>
            </select>
            {addRole === "pi" ? (
              <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={addIsPrimary}
                  onChange={(e) => setAddIsPrimary(e.target.checked)}
                />
                주 책임자 (Primary)
              </label>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              disabled={!addResourceId}
              onClick={handleAdd}
            >
              추가
            </button>
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            ※ 카탈로그에 없는 인력은 리소스 관리 메뉴에서 먼저 등록해야 합니다.
          </span>
        </div>

        </fieldset>
        <section aria-label="배정된 인력 식별 정보" style={{ display: "grid", gap: "0.4rem", minWidth: 0 }}>
          {selectedRoles.map(item => {
            const { name, code } = selectedIdentity(item.resourceId);
            return <IdentifierDetails key={`${item.resourceId}-${item.role}`} label={`${name} 식별 정보`} identifiers={[
              { label: "리소스 ID", value: item.resourceId },
              ...(code ? [{ label: "리소스 코드", value: code }] : []),
            ]} />;
          })}
        </section>
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy || !catalogReady}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}
