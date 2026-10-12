"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProjectTemplateDto } from "@/contracts/project-templates";

interface SubmissionProps {
  readonly onBeginSubmission?: () => boolean;
  readonly onEndSubmission?: () => void;
}
type Field = "name" | "ownerName" | "projectStartDate" | "editPassword";
const fieldIds: Record<Field, string> = { name: "inst-project-name", ownerName: "inst-owner-name", projectStartDate: "inst-start-date", editPassword: "inst-password" };
function templateProjectName(name: string): string {
  return Array.from(`${name} 프로젝트`).slice(0, 200).join("");
}
function todayDateString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function templatesFromResponse(value: unknown): ProjectTemplateDto[] | null {
  if (!value || typeof value !== "object" || !("data" in value) || !Array.isArray(value.data)) return null;
  const counts = ["taskCount", "milestoneCount", "processCount", "equipmentCount", "systemCount"];
  const ids = new Set<string>();
  for (const item of value.data) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.name !== "string" || typeof item.description !== "string" || counts.some((field) => typeof item[field] !== "number" || !Number.isFinite(item[field]) || item[field] < 0)) return null;
    ids.add(item.id);
  }
  return value.data;
}

export function CreateFromTemplateForm({ onBeginSubmission, onEndSubmission }: SubmissionProps = {}) {
  const router = useRouter();
  const submissionRef = useRef(false);
  const suggestedName = useRef<string | null>(null);
  const [templates, setTemplates] = useState<ProjectTemplateDto[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [projectStartDate, setProjectStartDate] = useState(todayDateString());
  const [editPassword, setEditPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoadState("loading");
      try {
        const response = await fetch("/api/project-templates?activeOnly=true", { cache: "no-store", signal: controller.signal });
        const body: unknown = await response.json();
        const list = templatesFromResponse(body);
        if (!response.ok || list === null) throw new Error("invalid_template_list");
        if (controller.signal.aborted) return;
        setTemplates(list);
        if (list.length > 0 && suggestedName.current === null) {
          const suggestion = templateProjectName(list[0].name);
          suggestedName.current = suggestion;
          setSelectedTemplateId(list[0].id);
          setName(suggestion);
        }
        setLoadState("ready");
      } catch {
        if (!controller.signal.aborted) setLoadState("error");
      }
    })();
    return () => controller.abort();
  }, [retry]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const filteredTemplates = templates.filter((item) => `${item.name} ${item.description}`.toLocaleLowerCase("ko").includes(search.trim().toLocaleLowerCase("ko")));
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);
  const ready = loadState === "ready";

  function selectTemplate(item: ProjectTemplateDto) {
    if (submissionRef.current || !ready) return;
    const previousSuggestion = suggestedName.current;
    const nextSuggestion = templateProjectName(item.name);
    setName((current) => current === previousSuggestion ? nextSuggestion : current);
    suggestedName.current = nextSuggestion;
    setSelectedTemplateId(item.id);
    setError(null);
  }
  function clearFieldError(field: Field) {
    setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; });
    setError(null);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionRef.current || !ready || !selectedTemplate) return;
    const issues: Partial<Record<Field, string>> = {};
    if (!name.trim()) issues.name = "프로젝트 이름을 입력해 주세요.";
    else if (Array.from(name.trim()).length > 200) issues.name = "프로젝트 이름은 200자 이하여야 합니다.";
    const owner = ownerName.trim();
    if (!owner) issues.ownerName = "소유자를 입력해 주세요.";
    else if (Array.from(owner).length > 100) issues.ownerName = "소유자는 100자 이하여야 합니다.";
    if (Array.from(editPassword).length < 1 || Array.from(editPassword).length > 12) issues.editPassword = "편집 비밀번호는 1~12자로 입력해 주세요.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(projectStartDate)) issues.projectStartDate = "올바른 시작일자(YYYY-MM-DD)를 입력해 주세요.";
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      setError(null);
      const first = (Object.keys(fieldIds) as Field[]).find((field) => issues[field]);
      requestAnimationFrame(() => { if (first) document.getElementById(fieldIds[first])?.focus(); });
      return;
    }
    if (onBeginSubmission && !onBeginSubmission()) return;
    submissionRef.current = true;
    setIsSubmitting(true); setFieldErrors({}); setError(null);
    const request = { name: name.trim(), ownerName: owner, description: description.trim() || undefined, projectStartDate, editPassword };
    setEditPassword("");
    try {
      const response = await fetch(`/api/project-templates/${encodeURIComponent(selectedTemplate.id)}/instantiate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(typeof body?.error?.message === "string" ? body.error.message : "프로젝트를 생성하지 못했습니다."); return; }
      const publicId = body?.data?.project?.publicId;
      if (typeof publicId !== "string" || !publicId) { setError("생성된 프로젝트 정보를 확인할 수 없습니다."); return; }
      router.push(`/projects/${encodeURIComponent(publicId)}`);
    } catch { setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setEditPassword(""); submissionRef.current = false; setIsSubmitting(false); onEndSubmission?.(); }
  }

  if (loadState === "loading") return <p
    className="card-empty-state"
    role="status">템플릿 정보를 불러오는 중입니다…</p>;
  if (loadState === "error") return <div
    className="card-empty-state">
    <p
      className="form-error"
      role="alert">템플릿 목록을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
    <div className="standalone-actions"><button
      className="secondary-button"
      type="button"
      onClick={() => { setLoadState("loading"); setRetry((value) => value + 1); }}>템플릿 목록 다시 시도</button></div>
  </div>;
  if (templates.length === 0) return <div
    className="card-empty-state">
    <p>등록된 프로젝트 템플릿이 없습니다.</p>
    <p
      className="card-empty-description">기존 프로젝트의 [더보기] 메뉴에서 [템플릿으로 저장]을 선택하여 템플릿을 등록할 수 있습니다.</p>
  </div>;

  return <div
    className="template-instantiate-container">
    <div
      className="template-selection-section">
      <label
        className="template-search-box">템플릿 검색<input
          type="search"
          disabled={isSubmitting}
          placeholder="템플릿 이름 또는 설명 검색…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="search-input"
        />
      </label>
      <div
        className="template-search-status">
        <span
          role="status">검색 결과 {filteredTemplates.length}개 / 전체 {templates.length}개</span>
        {search ? <button
          className="secondary-button"
          disabled={isSubmitting}
          type="button"
          onClick={() => setSearch("")}>검색 초기화</button> : null}
      </div>
      <fieldset
        className="template-picker"
        disabled={isSubmitting}>
        <legend>템플릿 선택</legend>
        {filteredTemplates.length === 0 ? <p
          className="card-empty-description">검색 조건에 맞는 템플릿이 없습니다.</p> : null}
        <div
          className="template-cards-grid">
          {filteredTemplates.map((item) => {
            const selected = item.id === selectedTemplateId;
            return <label
              key={item.id}
              className={`template-card ${selected ? "template-card-selected" : ""}`}>
              <span
                className="template-card-header">
                <input
                  type="radio"
                  name="project-template"
                  value={item.id}
                  checked={selected}
                  onChange={() => selectTemplate(item)}
                  aria-label={item.name}
                />
                <strong
                  className="template-card-title">
                  {item.name}
                </strong>
                {selected ? <span
                  className="badge badge-primary">선택됨</span> : null}
              </span>
              {item.description ? <span
                className="template-card-description">
                {item.description}
              </span> : null}
              <span
                className="template-card-stats">
                <span
                  className="stat-pill">작업 {item.taskCount}
                </span>
                <span
                  className="stat-pill">Milestone {item.milestoneCount}
                </span>
                {item.processCount > 0 ? <span
                  className="stat-pill">공정 {item.processCount}
                </span> : null}{item.equipmentCount > 0 ? <span
                  className="stat-pill">설비 {item.equipmentCount}
                </span> : null}{item.systemCount > 0 ? <span
                  className="stat-pill">시스템 {item.systemCount}
                </span> : null}
              </span>
            </label>;
          })}
        </div>
      </fieldset>
    </div>
    {selectedTemplate ? <>
      <div
        className="template-selected-summary"
        role="note">
        <strong>선택한 템플릿: {selectedTemplate.name}
        </strong>
        {!filteredTemplates.some((item) => item.id === selectedTemplateId) ? <p>현재 검색 결과에 없는 템플릿입니다. 생성은 이 선택을 기준으로 진행합니다.</p> : null}
      </div>
      <form
        className="project-form"
        onSubmit={handleSubmit}
        noValidate>
        {error ? <div
          ref={errorRef}
          className="form-error"
          role="alert"
          tabIndex={-1}>
          {error}
        </div> : null}
        <div
          className="form-field">
          <label htmlFor="inst-project-name">새 프로젝트 이름 *</label>
          <input
            id="inst-project-name" required
            maxLength={200}
            value={name}
            onChange={(event) => { setName(event.target.value); clearFieldError("name"); }}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "inst-project-name-error" : undefined}
          />
          {fieldErrors.name ? <p
            className="form-field-error"
            id="inst-project-name-error">
            {fieldErrors.name}
          </p> : null}
        </div>
        <div
          className="form-field">
          <label htmlFor="inst-owner-name">소유자 / 담당자 *</label>
          <input
            id="inst-owner-name" required
            maxLength={100}
            placeholder="예: 홍길동 팀장"
            value={ownerName}
            onChange={(event) => { setOwnerName(event.target.value); clearFieldError("ownerName"); }}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.ownerName)}
            aria-describedby={fieldErrors.ownerName ? "inst-owner-name-error" : undefined}
          />
          {fieldErrors.ownerName ? <p
            className="form-field-error"
            id="inst-owner-name-error">
            {fieldErrors.ownerName}
          </p> : null}
        </div>
        <div
          className="form-field">
          <label htmlFor="inst-start-date">프로젝트 시작일 (기준일) *</label>
          <input
            id="inst-start-date"
            type="date" required
            value={projectStartDate}
            onChange={(event) => { setProjectStartDate(event.target.value); clearFieldError("projectStartDate"); }}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.projectStartDate)}
            aria-describedby={`inst-date-help${fieldErrors.projectStartDate ? " inst-start-date-error" : ""}`}
          />
          <p
            id="inst-date-help">선택한 기준일로 템플릿 프로젝트를 생성합니다.</p>
          {fieldErrors.projectStartDate ? <p
            className="form-field-error"
            id="inst-start-date-error">
            {fieldErrors.projectStartDate}
          </p> : null}
        </div>
        <div
          className="form-field">
          <label htmlFor="inst-password">편집 비밀번호 *</label>
          <input
            id="inst-password"
            type="password"
            autoComplete="new-password" required
            placeholder="1~12자"
            value={editPassword}
            onChange={(event) => { setEditPassword(event.target.value); clearFieldError("editPassword"); }}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.editPassword)}
            aria-describedby={`inst-password-help${fieldErrors.editPassword ? " inst-password-error" : ""}`}
          />
          <p
            id="inst-password-help">이후 프로젝트 일정을 편집할 때 사용할 비밀번호입니다. 1~12자로 입력해 주세요.</p>
          {fieldErrors.editPassword ? <p
            className="form-field-error"
            id="inst-password-error">
            {fieldErrors.editPassword}
          </p> : null}
        </div>
        <div
          className="form-field">
          <label htmlFor="inst-desc">프로젝트 설명 (선택)</label>
          <textarea
            id="inst-desc"
            rows={3}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div
          className="template-form-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={isSubmitting}
            onClick={() => router.back()}>취소</button>
          <button
            type="submit"
            className="primary-button"
            disabled={isSubmitting || !ready}>
            {isSubmitting ? "프로젝트 생성 중…" : "템플릿에서 프로젝트 생성"}
          </button>
        </div>
      </form>
    </> : null}
  </div>;
}
