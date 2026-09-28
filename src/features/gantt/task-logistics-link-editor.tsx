"use client";

import { useEffect, useState } from "react";
import type {
  EquipmentDto,
  LogisticsSystemDto,
  ProjectLogisticsResponse,
  ReplaceTaskLogisticsLinksRequest,
  TaskLogisticsLinkScope,
  TaskLogisticsLinksDto,
  TaskLogisticsLinksResponse,
} from "@/contracts/logistics";
import styles from "./project-task-editor.module.css";

interface Props {
  readonly taskId: string;
  readonly taskType: "task" | "summary" | "milestone";
  readonly revision: number;
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly onApplied: () => Promise<void>;
  readonly onSelectionCountChange?: (count: number) => void;
}

function projectIdFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function isValidLogisticsSnapshot(links: TaskLogisticsLinksResponse, logistics: ProjectLogisticsResponse, taskId: string, revision: number): boolean {
  const value = links?.data?.links;
  const masters = logistics?.data?.logistics;
  const strings = (value: unknown): boolean => Array.isArray(value) && value.every((item) => typeof item === "string");
  const validLinks = (items: unknown, id: string, inherited = false): boolean => Array.isArray(items) && items.every((item) =>
    item && typeof item === "object" && typeof item[id] === "string" &&
    (item.scope === "self" || item.scope === "subtree") &&
    ["equipmentCode", "equipmentName", "systemCode", "systemName"].every((key) => item[key] === undefined || typeof item[key] === "string") &&
    (!inherited || (typeof item.sourceTaskId === "string" && typeof item.sourceTaskName === "string")));
  return !!value && links.data.taskId === taskId && value.taskId === taskId && logistics?.data?.project?.revision === revision &&
    validLinks(value.directEquipmentLinks, "equipmentId") && validLinks(value.directSystemLinks, "systemId") &&
    validLinks(value.inheritedEquipmentLinks, "equipmentId", true) && validLinks(value.inheritedSystemLinks, "systemId", true) &&
    strings(value.effectiveEquipmentIds) && strings(value.effectiveSystemIds) && !!masters &&
    Array.isArray(masters.equipment) && masters.equipment.every((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.code === "string" && typeof item.equipmentType === "string" && Array.isArray(item.resourceRoles) && item.resourceRoles.every((role) => role && typeof role.resourceId === "string" && typeof role.resourceName === "string" && typeof role.role === "string" && typeof role.isPrimary === "boolean")) &&
    Array.isArray(masters.systems) && masters.systems.every((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.code === "string" && typeof item.systemType === "string" && Array.isArray(item.resourceRoles) && item.resourceRoles.every((role) => role && typeof role.resourceId === "string" && typeof role.resourceName === "string" && typeof role.role === "string" && typeof role.isPrimary === "boolean"));
}

export function TaskLogisticsLinkEditor({
  taskId,
  taskType,
  revision,
  editable,
  disabled,
  onApplied,
  onSelectionCountChange,
}: Props) {
  const [equipmentList, setEquipmentList] = useState<EquipmentDto[]>([]);
  const [systemList, setSystemList] = useState<LogisticsSystemDto[]>([]);
  const [links, setLinks] = useState<TaskLogisticsLinksDto | null>(null);

  // Draft state
  const [selectedEquipment, setSelectedEquipment] = useState<
    Map<string, TaskLogisticsLinkScope>
  >(new Map());
  const [selectedSystems, setSelectedSystems] = useState<
    Map<string, TaskLogisticsLinkScope>
  >(new Map());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [retry, setRetry] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const snapshotKey = `${taskId}:${revision}:${retry}`;
  const ready = loadedKey === snapshotKey && !loading;

  const isSummary = taskType === "summary";

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      const publicId = projectIdFromPathname(window.location.pathname);
      if (!publicId) {
        setLoading(false);
        setError("프로젝트 경로를 확인할 수 없습니다.");
        return;
      }

      try {
        setLoading(true);
        setLoadedKey(null);
        setSuccessNotice(null);
        setError(null);

        // Fetch task links and project logistics masters in parallel
        const [linksRes, logisticsRes] = await Promise.all([
          fetch(
            `/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}/logistics-links`,
            { credentials: "same-origin", cache: "no-store", signal: controller.signal },
          ),
          fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics`, {
            credentials: "same-origin",
            cache: "no-store", signal: controller.signal,
          }),
        ]);

        if (!linksRes.ok) throw new Error("links_fetch_failed");
        if (!logisticsRes.ok) throw new Error("logistics_fetch_failed");

        const linksBody = (await linksRes.json()) as TaskLogisticsLinksResponse;
        const logisticsBody = (await logisticsRes.json()) as ProjectLogisticsResponse;

        if (!isValidLogisticsSnapshot(linksBody, logisticsBody, taskId, revision)) throw new Error("invalid_snapshot");
        if (!alive) return;
        setLoadedKey(snapshotKey);

        setEquipmentList(logisticsBody.data.logistics.equipment);
        setSystemList(logisticsBody.data.logistics.systems);
        setLinks(linksBody.data.links);

        const initialEq = new Map<string, TaskLogisticsLinkScope>();
        for (const item of linksBody.data.links.directEquipmentLinks) {
          initialEq.set(item.equipmentId, item.scope);
        }
        setSelectedEquipment(initialEq);

        const initialSys = new Map<string, TaskLogisticsLinkScope>();
        for (const item of linksBody.data.links.directSystemLinks) {
          initialSys.set(item.systemId, item.scope);
        }
        setSelectedSystems(initialSys);

        const directCount =
          linksBody.data.links.directEquipmentLinks.length +
          linksBody.data.links.directSystemLinks.length;
        onSelectionCountChange?.(directCount);
      } catch {
        if (alive) {
          setError("물류 연결 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [taskId, revision, retry, snapshotKey, onSelectionCountChange]);

  const toggleEquipment = (equipmentId: string) => {
    if (!editable || disabled || saving || !ready) return;
    setSuccessNotice(null);
    setSelectedEquipment((prev) => {
      const next = new Map(prev);
      if (next.has(equipmentId)) {
        next.delete(equipmentId);
      } else {
        next.set(equipmentId, "self");
      }
      return next;
    });
  };

  const toggleEquipmentScope = (equipmentId: string) => {
    if (!editable || disabled || saving || !ready || !isSummary) return;
    setSuccessNotice(null);
    setSelectedEquipment((prev) => {
      const next = new Map(prev);
      const currentScope = next.get(equipmentId) ?? "self";
      next.set(equipmentId, currentScope === "subtree" ? "self" : "subtree");
      return next;
    });
  };

  const toggleSystem = (systemId: string) => {
    if (!editable || disabled || saving || !ready) return;
    setSuccessNotice(null);
    setSelectedSystems((prev) => {
      const next = new Map(prev);
      if (next.has(systemId)) {
        next.delete(systemId);
      } else {
        next.set(systemId, "self");
      }
      return next;
    });
  };

  const toggleSystemScope = (systemId: string) => {
    if (!editable || disabled || saving || !ready || !isSummary) return;
    setSuccessNotice(null);
    setSelectedSystems((prev) => {
      const next = new Map(prev);
      const currentScope = next.get(systemId) ?? "self";
      next.set(systemId, currentScope === "subtree" ? "self" : "subtree");
      return next;
    });
  };

  const handleSave = async () => {
    if (!editable || disabled || saving || !ready) return;
    const publicId = projectIdFromPathname(window.location.pathname);
    if (!publicId) return;

    setSaving(true);
    setError(null);
    setSuccessNotice(null);

    const payload: ReplaceTaskLogisticsLinksRequest = {
      equipmentLinks: Array.from(selectedEquipment.entries()).map(
        ([equipmentId, scope]) => ({
          equipmentId,
          scope,
        }),
      ),
      systemLinks: Array.from(selectedSystems.entries()).map(([systemId, scope]) => ({
        systemId,
        scope,
      })),
    };

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}/logistics-links`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "If-Match": `"${revision}"`,
          },
          body: JSON.stringify(payload),
          credentials: "same-origin",
        },
      );

      if (res.status === 412) {
        setError("프로젝트 개정(Revision)이 변경되었습니다. 화면을 새로고침해 주세요.");
        return;
      }
      if (res.status === 401) {
        setError("편집 권한이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "물류 연결 저장에 실패했습니다.");
        return;
      }

      setSuccessNotice("물류 연결이 성공적으로 저장되었습니다.");
      await onApplied();
      onSelectionCountChange?.(selectedEquipment.size + selectedSystems.size);
    } catch {
      setError("네트워크 오류로 물류 연결을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || (loadedKey !== snapshotKey && !error)) {
    return <p className={styles.emptyRelation} role="status">물류 연결 정보를 불러오는 중…</p>;
  }

  return (
    <div className={styles.taskFields}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {!ready && error ? <button type="button" className="secondary-button" onClick={() => setRetry((value) => value + 1)}>물류 연결 다시 시도</button> : null}
      {successNotice ? (
        <p className={styles.note} role="status">
          {successNotice}
        </p>
      ) : null}

      {/* 안내 문구 */}
      <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
        설비 및 제어시스템 연결은 WBS 일정과 독립된 물류 메타데이터입니다.
        {isSummary
          ? " 요약 작업(Summary)은 '하위 작업 포함(subtree)'을 선택해 하위 작업에 일괄 파생할 수 있습니다."
          : ""}
      </div>

      {/* 설비 연결 섹션 */}
      <fieldset className={styles.relationGroup} style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 6, padding: "0.75rem" }}>
        <legend style={{ fontWeight: 600, padding: "0 0.25rem" }}>
          관련 설비 ({selectedEquipment.size})
        </legend>

        {/* 상속된 설비 표시 */}
        {links?.inheritedEquipmentLinks && links.inheritedEquipmentLinks.length > 0 ? (
          <div style={{ marginBottom: "0.75rem", background: "var(--color-surface-subtle)", padding: "0.5rem", borderRadius: 4 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
              상위 작업으로부터 상속된 설비 ({links.inheritedEquipmentLinks.length}):
            </span>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.25rem 0 0" }}>
              {links.inheritedEquipmentLinks.map((item) => (
                <li key={item.equipmentId} style={{ fontSize: "0.8rem", padding: "0.15rem 0" }}>
                  🔹 <strong>{item.equipmentName ?? item.equipmentId}</strong>{" "}
                  <code>({item.equipmentCode})</code>{" "}
                  <span style={{ color: "var(--color-text-muted)" }}>
                    — [상위: {item.sourceTaskName}]에서 하위 적용됨
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 직접 설비 선택 리스트 */}
        {ready && equipmentList.length === 0 ? (
          <p className={styles.emptyRelation}>등록된 설비가 없습니다.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 180, overflowY: "auto" }}>
            {equipmentList.map((eq) => {
              const isChecked = selectedEquipment.has(eq.id);
              const scope = selectedEquipment.get(eq.id) ?? "self";
              const primaryOwner = eq.resourceRoles?.find((r) => r.isPrimary && r.role === "owner");

              return (
                <li
                  key={eq.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.35rem 0.25rem",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    fontSize: "0.85rem",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: editable ? "pointer" : "default" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!editable || disabled || saving || !ready}
                      onChange={() => toggleEquipment(eq.id)}
                    />
                    <span>
                      <strong>{eq.name}</strong> <code>{eq.code}</code> ({eq.equipmentType})
                      {primaryOwner ? (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                          [담당: {primaryOwner.resourceName}]
                        </span>
                      ) : null}
                    </span>
                  </label>

                  {isChecked && isSummary ? (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={scope === "subtree"}
                        disabled={!editable || disabled || saving || !ready}
                        onChange={() => toggleEquipmentScope(eq.id)}
                      />
                      <span>하위 작업 포함</span>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {/* 물류 시스템 연결 섹션 */}
      <fieldset className={styles.relationGroup} style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 6, padding: "0.75rem" }}>
        <legend style={{ fontWeight: 600, padding: "0 0.25rem" }}>
          관련 물류 시스템 ({selectedSystems.size})
        </legend>

        {/* 상속된 시스템 표시 */}
        {links?.inheritedSystemLinks && links.inheritedSystemLinks.length > 0 ? (
          <div style={{ marginBottom: "0.75rem", background: "var(--color-surface-subtle)", padding: "0.5rem", borderRadius: 4 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
              상위 작업으로부터 상속된 시스템 ({links.inheritedSystemLinks.length}):
            </span>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.25rem 0 0" }}>
              {links.inheritedSystemLinks.map((item) => (
                <li key={item.systemId} style={{ fontSize: "0.8rem", padding: "0.15rem 0" }}>
                  🔹 <strong>{item.systemName ?? item.systemId}</strong>{" "}
                  <code>({item.systemCode})</code>{" "}
                  <span style={{ color: "var(--color-text-muted)" }}>
                    — [상위: {item.sourceTaskName}]에서 하위 적용됨
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 직접 시스템 선택 리스트 */}
        {ready && systemList.length === 0 ? (
          <p className={styles.emptyRelation}>등록된 물류 시스템이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 180, overflowY: "auto" }}>
            {systemList.map((sys) => {
              const isChecked = selectedSystems.has(sys.id);
              const scope = selectedSystems.get(sys.id) ?? "self";
              const primaryPi = sys.resourceRoles?.find((r) => r.isPrimary && r.role === "pi");

              return (
                <li
                  key={sys.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.35rem 0.25rem",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    fontSize: "0.85rem",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: editable ? "pointer" : "default" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!editable || disabled || saving || !ready}
                      onChange={() => toggleSystem(sys.id)}
                    />
                    <span>
                      <strong>{sys.name}</strong> <code>{sys.code}</code> ({sys.systemType})
                      {primaryPi ? (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                          [PI: {primaryPi.resourceName}]
                        </span>
                      ) : null}
                    </span>
                  </label>

                  {isChecked && isSummary ? (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={scope === "subtree"}
                        disabled={!editable || disabled || saving || !ready}
                        onChange={() => toggleSystemScope(sys.id)}
                      />
                      <span>하위 작업 포함</span>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {/* 저장 버튼 */}
      {editable ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button
            type="button"
            className="primary-button"
            disabled={disabled || saving || !ready}
            onClick={() => void handleSave()}
          >
            {saving ? "물류 연결 저장 중..." : "물류 연결 저장"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
