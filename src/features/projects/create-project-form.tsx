"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type {
  CreateProjectRequest,
  CreateProjectResponse,
} from "@/contracts/projects";

const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_BYTES = 1024;
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
  const [description, setDescription] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (error) errorReference.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (name.trim().length === 0) {
      setError("프로젝트 이름을 입력해 주세요.");
      return;
    }
    if (codePointLength(editPassword) < MINIMUM_PASSWORD_LENGTH) {
      setError(`편집 비밀번호는 ${MINIMUM_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (new TextEncoder().encode(editPassword).byteLength > MAXIMUM_PASSWORD_BYTES) {
      setError("편집 비밀번호는 UTF-8 기준 1,024 bytes 이하여야 합니다.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const request: CreateProjectRequest = { name, description, editPassword };
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
          name="name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
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
          aria-describedby="project-password-help"
          autoComplete="new-password"
          disabled={isSubmitting}
          id="project-edit-password"
          minLength={MINIMUM_PASSWORD_LENGTH}
          name="editPassword"
          onChange={(event) => setEditPassword(event.target.value)}
          required
          type="password"
          value={editPassword}
        />
        <p id="project-password-help">
          최소 12자, UTF-8 기준 최대 1,024 bytes입니다. 서버가 최종 검증합니다.
        </p>
      </div>

      {error ? (
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
