"use client";

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
import type { ProjectDto } from "@/contracts/projects";
import type { ResourceCatalogResponse, ResourceDto } from "@/contracts/resources";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { ProjectLogisticsDashboard } from "./project-logistics-dashboard";
import styles from "./project-logistics-management.module.css";

function isTypeCatalog(value: unknown): value is LogisticsActiveTypeCatalogResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" &&
    "equipmentTypes" in data && Array.isArray(data.equipmentTypes) &&
    "systemTypes" in data && Array.isArray(data.systemTypes) &&
    [...data.equipmentTypes, ...data.systemTypes].every((item) =>
      !!item && typeof item === "object" && typeof item.code === "string" && typeof item.name === "string");
}

export interface ProjectLogisticsManagementProps {
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
  }) => void;
  onUnauthorized: () => void;
}

type SubTab = "dashboard" | "processes" | "equipment" | "systems" | "relations";

export function ProjectLogisticsManagement({
  publicId,
  revision,
  editable,
  logistics = { processes: [], equipment: [], systems: [], systemLinks: [] },
  onLogisticsMutated,
  onRequireRefresh,
  onNavigateToSchedule,
  onUnauthorized,
}: ProjectLogisticsManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [processFilter, setProcessFilter] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [typeCatalog, setTypeCatalog] = useState<LogisticsActiveTypeCatalogResponse["data"] | null>(null);
  const [typeCatalogState, setTypeCatalogState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setTypeCatalogState("loading");
    void fetch("/api/logistics-catalog/types", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !isTypeCatalog(body)) throw new Error("invalid catalog");
        setTypeCatalog(body.data);
        setTypeCatalogState("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setTypeCatalogState("error"); });
    return () => controller.abort();
  }, []);

  const equipmentTypeLabels = useMemo(() => new Map(typeCatalog?.equipmentTypes.map((item) => [item.code, item.name]) ?? []), [typeCatalog]);
  const systemTypeLabels = useMemo(() => new Map(typeCatalog?.systemTypes.map((item) => [item.code, item.name]) ?? []), [typeCatalog]);

  // Catalog resources for assignment picker
  const [catalogResources, setCatalogResources] = useState<ResourceDto[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const catalogRequest = useRef<AbortController | null>(null);
  const [catalogKey, setCatalogKey] = useState<string | null>(null);
  const currentCatalogKey = `${publicId}:${revision}`;
  useEffect(() => () => { catalogRequest.current?.abort(); }, [currentCatalogKey]);

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
  }, [currentCatalogKey]);
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
      if (!includeInactive && !p.active) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    });
  }, [logistics.processes, includeInactive, searchQuery]);

  const filteredEquipment = useMemo(() => {
    return logistics.equipment.filter((e) => {
      if (!includeInactive && !e.active) return false;
      if (processFilter !== "all" && e.processId !== processFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q) ||
        e.manufacturer.toLowerCase().includes(q)
      );
    });
  }, [logistics.equipment, includeInactive, processFilter, searchQuery]);

  const filteredSystems = useMemo(() => {
    return logistics.systems.filter((s) => {
      if (!includeInactive && !s.active) return false;
      if (processFilter !== "all") {
        if (s.scope === "processes" && !s.processIds.includes(processFilter)) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    });
  }, [logistics.systems, includeInactive, processFilter, searchQuery]);

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
        setErrorMessage("다른 사용자에 의해 프로젝트가 갱신되었습니다. 최신 정보를 불러온 뒤 다시 시도해 주세요.");
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
        } else if (code === "EQUIPMENT_IN_USE") {
          setErrorMessage("제어 시스템에 연결된 설비이므로 삭제할 수 없습니다. 시스템 연결을 먼저 해제하거나 비활성화해 주세요.");
        } else if (code === "SYSTEM_CODE_ALREADY_EXISTS") {
          setErrorMessage("이미 동일한 시스템 코드가 존재합니다. 다른 코드를 사용해 주세요.");
        } else if (code === "SYSTEM_IN_USE") {
          setErrorMessage("설비가 연결되어 있거나 하위 시스템으로 조율 중인 시스템은 삭제할 수 없습니다. 연결을 먼저 해제해 주세요.");
        } else if (code === "RESOURCE_INACTIVE") {
          setErrorMessage("비활성화된 리소스는 새로 배정할 수 없습니다.");
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
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, tab: SubTab) => {
    const tabs: SubTab[] = ["dashboard", "processes", "equipment", "systems", "relations"];
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

  return (
    <div className={styles.logisticsContainer}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitleGroup}>
          <h2 className={styles.headerTitle}>
            물류 구성
            <span className={styles.wbsNotice} role="note">
              물류 공정은 물리적/운영 단위의 물류 흐름이며 Gantt WBS와 독립적으로 관리됩니다.
            </span>
          </h2>
          <p className={styles.headerDescription}>
            프로젝트 내 공정, 설비, 제어 및 조율 시스템과 담당자 배정 관계를 관리합니다.
          </p>
        </div>
        {!editable ? (
          <div className={styles.readonlyNotice}>
            조회 전용 모드입니다. 편집을 수행하려면 작업공간 상단의 &apos;편집 활성화&apos;를 진행해 주세요.
          </div>
        ) : null}
      </div>

      {/* Sub Navigation */}
      <div className={styles.subTabList} role="tablist" aria-label="물류 구성 세부 영역">
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

      {/* Toolbar (Filters & Actions) - Only for management subtabs */}
      {activeSubTab !== "dashboard" ? (
        <div className={styles.toolbar} role="toolbar" aria-label="물류 필터 및 도구">
          <div className={styles.filtersGroup}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="코드 또는 이름 검색"
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
                    {p.code} - {p.name}
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
                onClick={() => {
                  if (logistics.processes.length === 0) {
                    alert("설비를 등록하려면 먼저 공정을 최소 1개 이상 생성해야 합니다.");
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
                onClick={() => {
                  setErrorMessage(null);
                  setSystemModal({ open: true, mode: "create" });
                }}
              >
                + 시스템 추가
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Error Message banner if any */}
      {errorMessage ? (
        <div className={styles.errorBanner} role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Sub-panel 0: Dashboard */}
      <div
        id="panel-dashboard"
        role="tabpanel"
        aria-labelledby="subtab-dashboard"
        hidden={activeSubTab !== "dashboard"}
      >
        <ProjectLogisticsDashboard
          publicId={publicId}
          revision={revision}
          onNavigateToSchedule={onNavigateToSchedule}
        />
      </div>

      {/* Sub-panel 1: Processes */}
      <div
        id="panel-processes"
        role="tabpanel"
        aria-labelledby="subtab-processes"
        hidden={activeSubTab !== "processes"}
      >
        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>공정 코드</th>
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
                  <td colSpan={editable ? 6 : 5} className={styles.emptyState}>
                    <div className={styles.emptyStateTitle}>등록된 공정이 없습니다.</div>
                    <p>공정을 등록하여 물류 설비 및 시스템을 체계적으로 분류하세요.</p>
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((p) => {
                  const parent = p.parentProcessId ? processById.get(p.parentProcessId) : undefined;
                  return (
                    <tr key={p.id} className={!p.active ? styles.inactiveRow : undefined}>
                      <td>
                        <strong>{p.code}</strong>
                      </td>
                      <td>
                        <span className={parent ? styles.treeItemLevel1 : styles.treeItemLevel0}>
                          {parent ? "└ " : ""}
                          {p.name}
                        </span>
                      </td>
                      <td>{parent ? `${parent.name} (${parent.code})` : "-"}</td>
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
        aria-labelledby="subtab-equipment"
        hidden={activeSubTab !== "equipment"}
      >
        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>소속 공정</th>
                <th>설비 코드</th>
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
                    <div className={styles.emptyStateTitle}>등록된 설비가 없습니다.</div>
                    <p>공정에 물류 설비(Stocker, AGV, AMR 등)를 등록하고 제어 시스템을 연결하세요.</p>
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
                    <tr key={eq.id} className={!eq.active ? styles.inactiveRow : undefined}>
                      <td>{proc ? `${proc.name} (${proc.code})` : eq.processId}</td>
                      <td>
                        <strong>{eq.code}</strong>
                      </td>
                      <td>{eq.name}</td>
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
        aria-labelledby="subtab-systems"
        hidden={activeSubTab !== "systems"}
      >
        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>시스템 코드</th>
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
                  <td colSpan={editable ? 9 : 8} className={styles.emptyState}>
                    <div className={styles.emptyStateTitle}>등록된 물류 시스템이 없습니다.</div>
                    <p>제어 시스템(SCS, ACS 등) 및 상위 조율 시스템(MCS)을 등록하세요.</p>
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
                    <tr key={sys.id} className={!sys.active ? styles.inactiveRow : undefined}>
                      <td>
                        <strong>{sys.code}</strong>
                      </td>
                      <td>{sys.name}</td>
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
                                  {p ? p.name : pid}
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
        aria-labelledby="subtab-relations"
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
                    <div className={styles.emptyStateTitle}>연계된 제어·조율 관계가 없습니다.</div>
                    <p>조율 시스템(MCS)과 제어 시스템(ACS, SCS 등), 그리고 제어 설비를 연결하세요.</p>
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
                            <strong>{coordSys.name}</strong> ({coordSys.code})
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
                              <strong>{coordSys.name}</strong> ({coordSys.code})
                              <br />
                              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {pi ? `★ PI: ${pi.resourceName}` : "PI 미지정"}
                              </span>
                            </td>
                          ) : null}
                          <td>
                            <strong>{ctrlSys.name}</strong> ({ctrlSys.code})
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
                                      {e.name} ({e.code})
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
                                return owner ? `${e.code}: ${owner.resourceName}` : null;
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
          typeOptions={typeCatalog?.equipmentTypes ?? []}
          catalogState={typeCatalogState}
          busy={isSubmitting}
          onClose={() => setEquipmentModal({ open: false, mode: "create" })}
          onSubmit={async (data) => {
            const ok =
              equipmentModal.mode === "create"
                ? await executeMutation(`/api/projects/${encodeURIComponent(publicId)}/logistics/equipment`, "POST", data)
                : await executeMutation(
                    `/api/projects/${encodeURIComponent(publicId)}/logistics/equipment/${encodeURIComponent(
                      equipmentModal.target!.id,
                    )}`,
                    "PATCH",
                    data,
                  );
            if (ok) setEquipmentModal({ open: false, mode: "create" });
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
          typeOptions={typeCatalog?.systemTypes ?? []}
          catalogState={typeCatalogState}
          busy={isSubmitting}
          onClose={() => setSystemModal({ open: false, mode: "create" })}
          onSubmit={async (data) => {
            const ok =
              systemModal.mode === "create"
                ? await executeMutation(`/api/projects/${encodeURIComponent(publicId)}/logistics/systems`, "POST", data)
                : await executeMutation(
                    `/api/projects/${encodeURIComponent(publicId)}/logistics/systems/${encodeURIComponent(
                      systemModal.target!.id,
                    )}`,
                    "PATCH",
                    data,
                  );
            if (ok) setSystemModal({ open: false, mode: "create" });
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
              다른 항목과 연계되어 있거나 사용 중인 경우 삭제할 수 없으며, 대신 비활성화를 권장합니다.
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    void onSubmit({
      code: code.trim(),
      name: name.trim(),
      parentProcessId: parentProcessId || null,
      sortOrder,
      active,
    });
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
          <label className={styles.fieldLabel}>
            공정 코드 *
            <input
              className={styles.fieldInput}
              required
              autoFocus
              disabled={busy}
              placeholder="예: PROC-01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            공정명 *
            <input
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
                  {p.code} - {p.name}
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
          <button className="primary-button" type="submit" disabled={busy || !code.trim() || !name.trim()}>
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
  busy,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  equipment?: EquipmentDto;
  allProcesses: ProcessDto[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEquipmentRequest | UpdateEquipmentRequest) => Promise<void>;
}) {
  const [processId, setProcessId] = useState(equipment?.processId ?? allProcesses[0]?.id ?? "");
  const [code, setCode] = useState(equipment?.code ?? "");
  const [name, setName] = useState(equipment?.name ?? "");
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(equipment?.equipmentType ?? "stocker");
  const [managementUnit, setManagementUnit] = useState<ManagementUnit>(equipment?.managementUnit ?? "unit");
  const [quantity, setQuantity] = useState(equipment?.quantity ?? 1);
  const [manufacturer, setManufacturer] = useState(equipment?.manufacturer ?? "");
  const [model, setModel] = useState(equipment?.model ?? "");
  const [description, setDescription] = useState(equipment?.description ?? "");
  const [active, setActive] = useState(equipment ? equipment.active : true);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !processId) return;
    void onSubmit({
      processId,
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
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            소속 공정 *
            <select
              className={styles.fieldSelect}
              required
              disabled={busy}
              value={processId}
              onChange={(e) => setProcessId(e.target.value)}
            >
              {allProcesses.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            설비 유형 *
            <select
              className={styles.fieldSelect}
              required
              disabled={busy}
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value as EquipmentType)}
            >
              {EQUIPMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            설비 코드 *
            <input
              className={styles.fieldInput}
              required
              autoFocus
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
              onChange={(e) => setManagementUnit(e.target.value as ManagementUnit)}
            >
              <option value="unit">단품 (Unit)</option>
              <option value="fleet">군집 (Fleet)</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            수량 (대)
            <input
              className={styles.fieldInput}
              type="number"
              min={1}
              disabled={busy}
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
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy || !code.trim() || !name.trim()}>
            {busy ? "저장 중…" : "저장"}
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
                      <strong>{s.name}</strong> ({s.code}) - {s.systemType.toUpperCase()}
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
              const canonical = equipment.resourceRoles.find((role) => role.resourceId === item.resourceId);
              const displayName = catalogReady && res ? `${res.name} (${res.code ?? "코드없음"})` : canonical ? `${canonical.resourceName} (${canonical.resourceCode})` : "등록 정보를 확인할 수 없는 인력";
              const isInactive = catalogReady && res ? !res.active : false;

              return (
                <div
                  key={`${item.resourceId}-${item.role}`}
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
                  {r.name} ({r.code ?? "코드없음"}) {!r.active ? " · 비활성" : ""}
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
            ※ 카탈로그에 없는 인력은 리소스 관리 메뉴에서 먼저 등록해야 합니다.
          </span>
        </div>

        </fieldset>
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
  busy,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  system?: LogisticsSystemDto;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLogisticsSystemRequest | UpdateLogisticsSystemRequest) => Promise<void>;
}) {
  const [code, setCode] = useState(system?.code ?? "");
  const [name, setName] = useState(system?.name ?? "");
  const [systemType, setSystemType] = useState<LogisticsSystemType>(system?.systemType ?? "mcs");
  const [layer, setLayer] = useState<SystemLayer>(system?.layer ?? "coordinator");
  const [scope, setScope] = useState<SystemScope>(system?.scope ?? "project");
  const [vendor, setVendor] = useState(system?.vendor ?? "");
  const [description, setDescription] = useState(system?.description ?? "");
  const [active, setActive] = useState(system ? system.active : true);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    void onSubmit({
      code: code.trim(),
      name: name.trim(),
      systemType,
      layer,
      scope,
      vendor: vendor.trim(),
      description: description.trim(),
      active,
    });
  };

  return (
    <WorkspaceDialog
      title={mode === "create" ? "시스템 추가" : "시스템 수정"}
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.dialogForm} onSubmit={handleSubmit}>
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
          <label className={styles.fieldLabel}>
            시스템 유형 *
            <select
              className={styles.fieldSelect}
              required
              disabled={busy}
              value={systemType}
              onChange={(e) => setSystemType(e.target.value as LogisticsSystemType)}
            >
              {SYSTEM_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
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
        <div className={styles.dialogActions}>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="primary-button" type="submit" disabled={busy || !code.trim() || !name.trim()}>
            {busy ? "저장 중…" : "저장"}
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
                  <strong>{p.code}</strong> - {p.name}
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
          상위 조율 시스템({system.code})이 명령/작업을 조율할 하위 제어/조율 시스템을 선택합니다.
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
                  <strong>{s.code}</strong> - {s.name} ({s.layer === "coordinator" ? "조율" : "제어"})
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
              const canonical = system.resourceRoles.find((role) => role.resourceId === item.resourceId);
              const displayName = catalogReady && res ? `${res.name} (${res.code ?? "코드없음"})` : canonical ? `${canonical.resourceName} (${canonical.resourceCode})` : "등록 정보를 확인할 수 없는 인력";
              const isInactive = catalogReady && res ? !res.active : false;

              return (
                <div
                  key={`${item.resourceId}-${item.role}`}
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
                      <strong>{displayName}</strong> - {item.role === "pi" ? "책임자 (PI)" : "개발자 (Developer)"}
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
                  {r.name} ({r.code ?? "코드없음"}) {!r.active ? " · 비활성" : ""}
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
