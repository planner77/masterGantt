"use client";

import { useEffect, useState } from "react";

import type { ProjectSnapshotResponse } from "@/contracts/projects";

type ViewState =
  | { status: "loading" }
  | { status: "ready"; snapshot: ProjectSnapshotResponse }
  | { status: "not-found" }
  | { status: "error" };

function isSnapshot(value: unknown): value is ProjectSnapshotResponse {
  if (typeof value !== "object" || value === null || !("data" in value)) return false;
  const data = value.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("project" in data) ||
    typeof data.project !== "object" ||
    data.project === null
  ) {
    return false;
  }

  const project = data.project;
  return (
    "name" in project &&
    typeof project.name === "string" &&
    "description" in project &&
    typeof project.description === "string" &&
    "revision" in project &&
    typeof project.revision === "number" &&
    "calendar" in project &&
    typeof project.calendar === "object" &&
    project.calendar !== null &&
    "timezone" in project.calendar &&
    typeof project.calendar.timezone === "string" &&
    "holidays" in project.calendar &&
    Array.isArray(project.calendar.holidays) &&
    "tasks" in data &&
    Array.isArray(data.tasks) &&
    "links" in data &&
    Array.isArray(data.links)
  );
}

export function ProjectReadonlyView({ publicId }: Readonly<{ publicId: string }>) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 404) {
          setState({ status: "not-found" });
          return;
        }
        const body: unknown = await response.json().catch(() => null);
        setState(response.ok && isSnapshot(body) ? { status: "ready", snapshot: body } : { status: "error" });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [publicId, retryKey]);

  function retry() {
    setState({ status: "loading" });
    setRetryKey((key) => key + 1);
  }

  if (state.status === "loading") {
    return (
      <section className="loading-state" aria-busy="true" aria-live="polite">
        <span className="loading-indicator" aria-hidden="true" />
        <p>프로젝트 정보를 불러오는 중입니다.</p>
      </section>
    );
  }

  if (state.status === "not-found") {
    return (
      <section className="status-page" aria-labelledby="project-not-found-heading">
        <p className="eyebrow">404</p>
        <h1 id="project-not-found-heading">프로젝트를 찾을 수 없습니다.</h1>
        <p>프로젝트 주소를 확인해 주세요.</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="status-page" aria-labelledby="project-load-error-heading">
        <p className="eyebrow">PROJECT</p>
        <h1 id="project-load-error-heading">프로젝트를 불러올 수 없습니다.</h1>
        <p>네트워크 또는 서버 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <button className="secondary-button" onClick={retry} type="button">
          다시 시도
        </button>
      </section>
    );
  }

  const { project, tasks, links } = state.snapshot.data;
  return (
    <section className="project-readonly" aria-labelledby="project-heading">
      <div className="project-readonly-heading">
        <div>
          <p className="eyebrow">PROJECT</p>
          <h1 id="project-heading">{project.name}</h1>
          <p className="page-description">{project.description || "설명이 없습니다."}</p>
        </div>
        <span className="readonly-badge">읽기 전용</span>
      </div>

      <dl className="project-facts">
        <div><dt>Revision</dt><dd>{project.revision}</dd></div>
        <div><dt>시간대</dt><dd>{project.calendar.timezone}</dd></div>
        <div><dt>휴일</dt><dd>{project.calendar.holidays.length}일</dd></div>
        <div><dt>작업</dt><dd>{tasks.length}개</dd></div>
        <div><dt>연결</dt><dd>{links.length}개</dd></div>
      </dl>

      <section className="schedule-empty" aria-labelledby="schedule-heading">
        <h2 id="schedule-heading">일정</h2>
        <p>
          {tasks.length === 0
            ? "아직 등록된 작업이 없습니다."
            : "일정 데이터가 준비되었습니다. 상세 Gantt 표시는 후속 작업에서 제공합니다."}
        </p>
      </section>
    </section>
  );
}
