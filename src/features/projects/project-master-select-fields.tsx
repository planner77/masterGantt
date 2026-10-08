"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectMasterItemDto, ProjectMasterSelectionResponse } from "@/contracts/project-master";

export interface ProjectMasterSelectionValue {
  businessUnitId: string;
  productId: string;
  siteEntityId: string;
}

function isCatalog(value: unknown): value is ProjectMasterSelectionResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" &&
    "revision" in data && typeof data.revision === "number" &&
    "businessUnits" in data && Array.isArray(data.businessUnits) &&
    "products" in data && Array.isArray(data.products) &&
    "siteEntities" in data && Array.isArray(data.siteEntities) &&
    "relations" in data && Array.isArray(data.relations);
}

export function useProjectMasterSelectionCatalog() {
  const [catalog, setCatalog] = useState<ProjectMasterSelectionResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [generation, setGeneration] = useState(0);

  const reload = useCallback(() => {
    setState("loading");
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/project-master/catalog", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || !isCatalog(body)) {
          setState("error");
          return;
        }
        setCatalog(body);
        setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    })();
    return () => controller.abort();
  }, [generation]);

  return { catalog, state, reload };
}

function options(active: readonly ProjectMasterItemDto[], current?: ProjectMasterItemDto | null): ProjectMasterItemDto[] {
  if (!current || active.some((item) => item.id === current.id)) return [...active];
  return [current, ...active];
}

/** Preserve a legacy selection for display, but never suggest new children of an inactive parent. */
export function linkedProjectMasterChoices(
  active: readonly ProjectMasterItemDto[],
  linkedIds: ReadonlySet<string>,
  current: ProjectMasterItemDto | null | undefined,
  parentActive: boolean,
): ProjectMasterItemDto[] {
  return options(parentActive ? active.filter((item) => linkedIds.has(item.id)) : [], current);
}

export function ProjectMasterSelectFields({
  value,
  onChange,
  disabled,
  catalog,
  current,
}: Readonly<{
  value: ProjectMasterSelectionValue;
  onChange: (value: ProjectMasterSelectionValue) => void;
  disabled: boolean;
  catalog: ProjectMasterSelectionResponse;
  current?: {
    businessUnit?: ProjectMasterItemDto | null;
    product?: ProjectMasterItemDto | null;
    siteEntity?: ProjectMasterItemDto | null;
  };
}>) {
  const [notice, setNotice] = useState<string | null>(null);
  const linkedProducts = new Set(catalog.data.relations.filter((r) =>
    r.businessUnitId === value.businessUnitId && r.siteEntityId === null).map((r) => r.productId));
  const linkedSites = new Set(catalog.data.relations.filter((r) =>
    r.businessUnitId === value.businessUnitId && r.productId === value.productId &&
    r.siteEntityId !== null).map((r) => r.siteEntityId));
  const selectedBusinessUnit = current?.businessUnit?.id === value.businessUnitId
    ? current.businessUnit
    : catalog.data.businessUnits.find((item) => item.id === value.businessUnitId);
  const selectedProduct = current?.product?.id === value.productId
    ? current.product
    : catalog.data.products.find((item) => item.id === value.productId);
  const fields = [
    {
      key: "businessUnitId" as const,
      id: "project-business-unit",
      label: "사업부",
      items: options(catalog.data.businessUnits, current?.businessUnit),
    },
    {
      key: "productId" as const,
      id: "project-product",
      label: "제품",
      items: linkedProjectMasterChoices(
        catalog.data.products, linkedProducts,
        current?.product?.id === value.productId ? current.product : null,
        selectedBusinessUnit?.active === true,
      ),
    },
    {
      key: "siteEntityId" as const,
      id: "project-site-entity",
      label: "사업장/법인",
      items: linkedProjectMasterChoices(
        catalog.data.siteEntities, linkedSites,
        current?.siteEntity?.id === value.siteEntityId ? current.siteEntity : null,
        selectedBusinessUnit?.active === true && selectedProduct?.active === true,
      ),
    },
  ];

  const handleChange = (key: keyof ProjectMasterSelectionValue, selected: string) => {
    if (key === "businessUnitId") {
      if (selected === value.businessUnitId) return;
      setNotice(value.productId || value.siteEntityId
        ? "사업부가 변경되어 하위 제품·사업장 선택을 해제했습니다."
        : null);
      onChange({ businessUnitId: selected, productId: "", siteEntityId: "" });
    } else if (key === "productId") {
      if (selected === value.productId) return;
      setNotice(value.siteEntityId ? "제품이 변경되어 사업장/법인 선택을 해제했습니다." : null);
      onChange({ ...value, productId: selected, siteEntityId: "" });
    } else {
      setNotice(null);
      onChange({ ...value, siteEntityId: selected });
    }
  };
  return <div>
    <div className="project-master-field-grid">
    {fields.map((field) => (
      <div className="form-field" key={field.key}>
        <label htmlFor={field.id}>{field.label} <span>(선택)</span></label>
        <select
          id={field.id}
          disabled={disabled || (field.key === "productId" && !value.businessUnitId) ||
            (field.key === "siteEntityId" && (!value.businessUnitId || !value.productId))}
          value={value[field.key]}
          onChange={(event) => handleChange(field.key, event.target.value)}
        >
          <option value="">미지정</option>
          {field.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.code}){item.active ? "" : " · 비활성"}
            </option>
          ))}
        </select>
      </div>
    ))}
    </div>
    {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
  </div>;
}
