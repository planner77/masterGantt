"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import type { LocalTaskUpdateCommand } from "./command-gateway";

const SvarGantt = dynamic(
  () => import("./svar-gantt").then((module) => module.SvarGantt),
  {
    ssr: false,
    loading: () => <div className="gantt-loading" role="status">Gantt를 불러오는 중입니다.</div>,
  },
);

export function GanttDemo() {
  const [editablePreview, setEditablePreview] = useState(false);
  const [previewUpdateRequest, setPreviewUpdateRequest] = useState(0);
  const [lastCommand, setLastCommand] = useState<string>("읽기 전용 상태입니다.");

  const receiveLocalCommand = useCallback((command: LocalTaskUpdateCommand) => {
    setLastCommand(`${String(command.taskId)} 변경을 감지했습니다. 이 데모는 저장하지 않습니다.`);
  }, []);

  return (
    <section className="gantt-demo" aria-labelledby="gantt-demo-heading">
      <div className="page-heading">
        <p className="eyebrow">SVAR CORE DEMO</p>
        <h1 id="gantt-demo-heading">Gantt 최소 통합</h1>
        <p className="page-description">
          Summary, 일반 작업, milestone과 Finish-to-Start 연결을 표시하는 브라우저 전용 fixture입니다.
        </p>
      </div>

      <div className="gantt-demo-controls">
        <label className="gantt-toggle">
          <input
            checked={editablePreview}
            onChange={(event) => setEditablePreview(event.target.checked)}
            type="checkbox"
          />
          <span>로컬 편집 미리보기</span>
        </label>
        <button
          className="secondary-button gantt-preview-action"
          disabled={!editablePreview}
          onClick={() => setPreviewUpdateRequest((request) => request + 1)}
          type="button"
        >
          fixture 변경 이벤트 실행
        </button>
        <p id="gantt-preview-note">기본은 읽기 전용입니다. 미리보기 변경은 서버나 SQLite에 저장되지 않습니다.</p>
      </div>

      <div className="gantt-demo-frame" aria-describedby="gantt-preview-note">
        <SvarGantt
          editablePreview={editablePreview}
          onLocalCommand={receiveLocalCommand}
          previewUpdateRequest={previewUpdateRequest}
        />
      </div>
      <p className="gantt-command-status" aria-live="polite">{lastCommand}</p>
    </section>
  );
}
