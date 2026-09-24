"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type {
  CreateProjectRequest,
  CreateProjectResponse,
} from "@/contracts/projects";

const MINIMUM_PASSWORD_LENGTH = 1;
const MAXIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_OWNER_LENGTH = 100;
type ProjectField = "name" | "ownerName" | "editPassword";
const API_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_JSON: "입력 전송 형식을 확인한 뒤 다시 시도해 주세요.",
  INVALID_REQUEST: "프로젝트 입력값을 확인해 주세요.",
  ORIGIN_NOT_ALLOWED: "페이지 주소와 서버 설정이 일치하지 않습니다.",
  RATE_LIMITED: "프로젝트 생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  REQUEST_TOO_LARGE: "입력 데이터가 허용된 크기를 초과했습니다.",
  UNSUPPORTED_MEDIA_TYPE: "입력 전송 형식을 확인한 뒤 다시 시도해 주세요.",
};

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function errorMessage(response: unknown): string {
  if (
    typeof response === "object" &&
    response !== null &&
    "error" in response &&
    typeof response.error === "object" &&
    response.error !== null &&
    "code" in response.error &&
    typeof response.error.code === "string"
  ) {
    return API_ERROR_MESSAGES[response.error.code] ??
      "프로젝트를 만들 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "프로젝트를 만들 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

function createdPublicId(response: unknown): string | null {
  const body = response as Partial<CreateProjectResponse>;
  const publicId = body.data?.project?.publicId;
  return typeof publicId === "string" && publicId.length > 0 ? publicId : null;
}

export function CreateProjectForm() {
  const router = useRouter();
  const errorReference = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProjectField,string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (error) errorReference.current?.focus();
  }, [error]);
  function clearFieldError(field: ProjectField) {
    setFieldErrors((current) => { if (!current[field]) return current; const next = { ...current }; delete next[field]; return next; });
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const issues: Partial<Record<ProjectField,string>> = {};
    if (name.trim().length === 0) issues.name = "프로젝트 이름을 입력해 주세요.";
    const normalizedOwnerName = ownerName.trim();
    if (normalizedOwnerName.length === 0) issues.ownerName = "소유자를 입력해 주세요.";
    else if (codePointLength(normalizedOwnerName) > MAXIMUM_OWNER_LENGTH) issues.ownerName = `소유자는 ${MAXIMUM_OWNER_LENGTH}자 이하여야 합니다.`;
    const passwordLength = codePointLength(editPassword);
    if (passwordLength < MINIMUM_PASSWORD_LENGTH || passwordLength > MAXIMUM_PASSWORD_LENGTH) issues.editPassword = "편집 비밀번호는 1~12자로 입력해 주세요.";
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      setError(null);
      requestAnimationFrame(() => errorReference.current?.focus({ preventScroll: true }));
      return;
    }

    setFieldErrors({});
    setError(null);
    setIsSubmitting(true);
    const request: CreateProjectRequest = {
      name,
      description,
      ownerName: normalizedOwnerName,
      editPassword,
    };
    setEditPassword("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || response.status !== 201) {
        setError(errorMessage(body));
        return;
      }

      const publicId = createdPublicId(body);
      if (!publicId) {
        setError("프로젝트 생성 응답을 확인할 수 없습니다. 새로고침 후 다시 확인해 주세요.");
        return;
      }
      router.replace(`/projects/${encodeURIComponent(publicId)}`);
    } catch {
      setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setEditPassword("");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="project-form" noValidate onSubmit={submit}>
      <div className="form-field">
        <label htmlFor="project-name">프로젝트 이름</label>
        <input
          autoComplete="off"
          disabled={isSubmitting}
          id="project-name"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "project-name-error" : undefined}
          name="name"
          onChange={(event) => { setName(event.target.value); clearFieldError("name"); }}
          required
          value={name}
        />
        {fieldErrors.name ? <p className="form-field-error" id="project-name-error">{fieldErrors.name}</p> : null}
      </div>

      <div className="form-field">
        <label htmlFor="project-owner">소유자</label>
        <input
          autoComplete="off"
          disabled={isSubmitting}
          id="project-owner"
          aria-invalid={Boolean(fieldErrors.ownerName)}
          aria-describedby={fieldErrors.ownerName ? "project-owner-help project-owner-error" : "project-owner-help"}
          name="ownerName"
          onChange={(event) => { setOwnerName(event.target.value); clearFieldError("ownerName"); }}
          required
          value={ownerName}
        />
        <p id="project-owner-help">프로젝트 담당자를 표시하는 정보이며 계정/권한과는 연결되지 않습니다. Unicode 문자 기준 최대 100자입니다.</p>
        {fieldErrors.ownerName ? <p className="form-field-error" id="project-owner-error">{fieldErrors.ownerName}</p> : null}
      </div>

      <div className="form-field">
        <label htmlFor="project-description">설명 <span>(선택)</span></label>
        <textarea
          disabled={isSubmitting}
          id="project-description"
          name="description"
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          value={description}
        />
      </div>

      <div className="form-field">
        <label htmlFor="project-edit-password">편집 비밀번호</label>
        <input
          aria-describedby={fieldErrors.editPassword ? "project-password-help project-password-error" : "project-password-help"}
          aria-invalid={Boolean(fieldErrors.editPassword)}
          autoComplete="new-password"
          disabled={isSubmitting}
          id="project-edit-password"
          minLength={MINIMUM_PASSWORD_LENGTH}
          name="editPassword"
          onChange={(event) => { setEditPassword(event.target.value); clearFieldError("editPassword"); }}
          required
          type="password"
          value={editPassword}
        />
        <p id="project-password-help">
          1~12자, UTF-8 기준 최대 1,024 bytes입니다. 서버가 최종 검증합니다.
        </p>
        {fieldErrors.editPassword ? <p className="form-field-error" id="project-password-error">{fieldErrors.editPassword}</p> : null}
      </div>

      {Object.keys(fieldErrors).length > 0 ? <div className="form-error" ref={errorReference} role="alert" tabIndex={-1}>
        <strong>프로젝트 입력 {Object.keys(fieldErrors).length}곳을 확인해 주세요.</strong>
        <ul>{(["name", "ownerName", "editPassword"] as const).filter((field) => fieldErrors[field]).map((field) => <li key={field}><button type="button" onClick={() => document.getElementById(field === "name" ? "project-name" : field === "ownerName" ? "project-owner" : "project-edit-password")?.focus()}>{fieldErrors[field]}</button></li>)}</ul>
      </div> : error ? (
        <div className="form-error" ref={errorReference} role="alert" tabIndex={-1}>
          {error}
        </div>
      ) : null}

      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "프로젝트를 만드는 중…" : "프로젝트 만들기"}
      </button>
    </form>
  );
}
