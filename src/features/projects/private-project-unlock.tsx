"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function PrivateProjectUnlock({ publicId }: Readonly<{ publicId: string }>) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const candidate = password;
    setPassword("");
    if (!candidate || new TextEncoder().encode(candidate).length > 1024) {
      setError("비밀번호를 확인해 주세요.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ editPassword: candidate }),
      });
      if (response.status === 204) {
        router.refresh();
      } else {
        setError(response.status === 401 ? "비밀번호가 올바르지 않습니다."
          : response.status === 429 ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
          : "프로젝트 잠금을 해제하지 못했습니다.");
      }
    } catch { setError("네트워크 연결을 확인해 주세요."); }
    finally { setPending(false); setPassword(""); }
  }
  return <section className="page-section project-private-lock" aria-labelledby="private-lock-title">
    <h1 id="private-lock-title">비공개 프로젝트</h1>
    <p>이 프로젝트의 일정을 열려면 프로젝트 비밀번호를 입력해 주세요. 인증하면 편집 권한도 활성화됩니다.</p>
    <form className="project-form compact-form" onSubmit={submit}>
      <div className="form-field">
        <label htmlFor="private-project-password">프로젝트 비밀번호</label>
        <input id="private-project-password" type="password" autoComplete="current-password"
          value={password} onChange={event => setPassword(event.target.value)} disabled={pending} required
          aria-invalid={Boolean(error)} aria-describedby={error ? "private-project-error" : undefined} />
      </div>
      {error ? <p id="private-project-error" role="alert">{error}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "인증 중…" : "비밀번호 확인 후 열기"}</button>
      <Link href="/" className="secondary-button" onClick={() => setPassword("")}>프로젝트 목록으로</Link>
    </form>
  </section>;
}
