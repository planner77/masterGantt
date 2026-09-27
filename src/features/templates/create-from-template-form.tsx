"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type {
  InstantiateProjectTemplateResponse,
  ProjectTemplateDto,
  ProjectTemplateListResponse,
} from "@/contracts/project-templates";

const MINIMUM_PASSWORD_LENGTH = 1;
const MAXIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_OWNER_LENGTH = 100;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function todayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CreateFromTemplateForm() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ProjectTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [projectStartDate, setProjectStartDate] = useState(todayDateString());
  const [editPassword, setEditPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/project-templates?activeOnly=true", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProjectTemplateListResponse | null) => {
        if (data?.data) {
          setTemplates(data.data);
          if (data.data.length > 0) {
            setSelectedTemplateId(data.data[0].id);
            setName(`${data.data[0].name} 프로젝트`);
          }
        }
      })
      .catch(() => setError("템플릿 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const filteredTemplates = templates.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  function handleSelectTemplate(t: ProjectTemplateDto) {
    setSelectedTemplateId(t.id);
    setName(`${t.name} 프로젝트`);
    setError(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !selectedTemplateId) return;

    const issues: Record<string, string> = {};
    if (!name.trim()) issues.name = "프로젝트 이름을 입력해 주세요.";
    const normOwner = ownerName.trim();
    if (!normOwner) issues.ownerName = "소유자를 입력해 주세요.";
    else if (codePointLength(normOwner) > MAXIMUM_OWNER_LENGTH) {
      issues.ownerName = `소유자는 ${MAXIMUM_OWNER_LENGTH}자 이하여야 합니다.`;
    }
    const pwdLen = codePointLength(editPassword);
    if (pwdLen < MINIMUM_PASSWORD_LENGTH || pwdLen > MAXIMUM_PASSWORD_LENGTH) {
      issues.editPassword = "편집 비밀번호는 1~12자로 입력해 주세요.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(projectStartDate)) {
      issues.projectStartDate = "올바른 시작일자(YYYY-MM-DD)를 입력해 주세요.";
    }

    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      setError(null);
      return;
    }

    setFieldErrors({});
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/project-templates/${selectedTemplateId}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ownerName: normOwner,
          description: description.trim() || undefined,
          projectStartDate,
          editPassword,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        const msg = errorJson?.error?.message ?? "프로젝트를 생성하지 못했습니다.";
        setError(msg);
        setIsSubmitting(false);
        return;
      }

      const body: InstantiateProjectTemplateResponse = await res.json();
      const publicId = body.data?.project?.publicId;
      if (publicId) {
        router.push(`/projects/${publicId}`);
      } else {
        setError("생성된 프로젝트 정보를 확인할 수 없습니다.");
        setIsSubmitting(false);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="card-empty-state">템플릿 정보를 불러오는 중입니다…</div>;
  }

  if (templates.length === 0) {
    return (
      <div className="card-empty-state">
        <p>등록된 프로젝트 템플릿이 없습니다.</p>
        <p className="card-empty-description">
          기존 프로젝트의 [더보기] 메뉴에서 [템플릿으로 저장]을 선택하여 템플릿을 등록할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="template-instantiate-container">
      {error && (
        <div ref={errorRef} className="form-error-banner" role="alert" tabIndex={-1}>
          {error}
        </div>
      )}

      <div className="template-selection-section">
        <div className="template-search-box">
          <input
            type="search"
            placeholder="템플릿 이름 또는 설명 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="template-cards-grid" role="radiogroup" aria-label="템플릿 선택">
          {filteredTemplates.map((t) => {
            const isSelected = t.id === selectedTemplateId;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`template-card ${isSelected ? "template-card-selected" : ""}`}
                onClick={() => handleSelectTemplate(t)}
              >
                <div className="template-card-header">
                  <h3 className="template-card-title">{t.name}</h3>
                  {isSelected && <span className="badge badge-primary">선택됨</span>}
                </div>
                {t.description && <p className="template-card-description">{t.description}</p>}
                <div className="template-card-stats">
                  <span className="stat-pill">작업 {t.taskCount}</span>
                  <span className="stat-pill">마일스톤 {t.milestoneCount}</span>
                  {t.processCount > 0 && <span className="stat-pill">공정 {t.processCount}</span>}
                  {t.equipmentCount > 0 && <span className="stat-pill">설비 {t.equipmentCount}</span>}
                  {t.systemCount > 0 && <span className="stat-pill">시스템 {t.systemCount}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedTemplate && (
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="inst-project-name">
              새 프로젝트 이름 <span className="required-mark">*</span>
            </label>
            <input
              id="inst-project-name"
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              disabled={isSubmitting}
            />
            {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="inst-owner-name">
              소유자 / 담당자 <span className="required-mark">*</span>
            </label>
            <input
              id="inst-owner-name"
              type="text"
              required
              maxLength={100}
              placeholder="예: 홍길동 팀장"
              value={ownerName}
              onChange={(e) => {
                setOwnerName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, ownerName: "" }));
              }}
              disabled={isSubmitting}
            />
            {fieldErrors.ownerName && <p className="field-error">{fieldErrors.ownerName}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="inst-start-date">
              프로젝트 시작일 (기준일) <span className="required-mark">*</span>
            </label>
            <input
              id="inst-start-date"
              type="date"
              required
              value={projectStartDate}
              onChange={(e) => {
                setProjectStartDate(e.target.value);
                setFieldErrors((prev) => ({ ...prev, projectStartDate: "" }));
              }}
              disabled={isSubmitting}
            />
            <p className="field-hint">
              선택한 시작일을 기준으로 템플릿의 모든 작업 및 의존 일정이 자동 재계산됩니다.
            </p>
            {fieldErrors.projectStartDate && (
              <p className="field-error">{fieldErrors.projectStartDate}</p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="inst-password">
              편집 비밀번호 <span className="required-mark">*</span>
            </label>
            <input
              id="inst-password"
              type="password"
              required
              maxLength={12}
              placeholder="1~12자"
              value={editPassword}
              onChange={(e) => {
                setEditPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, editPassword: "" }));
              }}
              disabled={isSubmitting}
            />
            <p className="field-hint">이후 프로젝트 일정을 편집할 때 사용할 비밀번호입니다.</p>
            {fieldErrors.editPassword && <p className="field-error">{fieldErrors.editPassword}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="inst-desc">프로젝트 설명 (선택)</label>
            <textarea
              id="inst-desc"
              rows={3}
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={isSubmitting}
              onClick={() => router.back()}
            >
              취소
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "프로젝트 생성 중…" : "템플릿에서 프로젝트 생성"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
