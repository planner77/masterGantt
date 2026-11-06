import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProjectImportPreviewDto } from "../../../src/contracts/project-import";
import { translate, type MessageParameters } from "../../../src/lib/i18n";
import { importPreviewFrom } from "../../../src/features/projects/project-import-model";
import { ProjectImportPreview } from "../../../src/features/projects/project-import-preview";

const language = vi.hoisted(() => ({ locale: "en" as "en" | "vi" }));
vi.mock("../../../src/lib/i18n/provider", () => ({ useI18n: () => ({ locale: language.locale, t: (key: string, parameters?: MessageParameters) => translate(language.locale, key, parameters) }) }));

function preview(code: string): ProjectImportPreviewDto {
  return {
    schemaVersion: "1.1", projectPublicId: "target", baseRevision: 9, previewDigest: "a".repeat(64), canCommit: true,
    sourceProject: { name: "저장 <원본>", description: "원문" },
    summary: { taskCreates: 1, linkCreates: 0, explicitMembershipCreates: 0 },
    normalizedTasks: [{
      externalId: "TASK-원문", sourceTaskId: null, name: "저장 <작업>", type: "task", parentExternalId: null, description: null, url: null, scheduleMode: "auto",
      requestedStart: "2026-10-06", start: "2026-10-06", end: "2026-10-06", duration: 1, progress: 0, status: "not_started", baselineStart: null, baselineEnd: null, baselineDuration: null,
      membership: { explicitMilestoneExternalId: null, effectiveMilestoneExternalId: null, inheritedFromExternalId: null },
    }],
    changedTasks: [], warnings: [{ code, path: "tasks[0].저장", message: "private raw upstream", externalId: "TASK-원문" }],
    targetCalendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
  };
}

describe("import warning-code presentation", () => {
  it.each([...Object.getOwnPropertyNames(Object.prototype), "UNKNOWN_WARNING"])("renders unknown code %s with a localized fallback and opaque identity", code => {
    const value = preview(code);
    expect(importPreviewFrom({ data: value })).toEqual(value);
    for (const locale of ["en", "vi"] as const) {
      language.locale = locale;
      const html = renderToStaticMarkup(createElement(ProjectImportPreview, { preview: value }));
      expect(html).toContain(`${translate(locale, "가져오기 경고")}<small>`);
      expect(html).toContain(`tasks[0].저장 · ${code}</small>`);
      expect(html).toContain("저장 &lt;원본&gt;");
      expect(html).toContain("저장 &lt;작업&gt;");
      expect(html).toContain("TASK-원문");
      expect(html).not.toContain("private raw upstream");
    }
  });
  it.each(["en", "vi"] as const)("keeps an approved warning localized in %s", locale => {
    language.locale = locale;
    const html = renderToStaticMarkup(createElement(ProjectImportPreview, { preview: preview("SCHEDULE_RECALCULATED") }));
    expect(html).toContain(`${translate(locale, "캘린더 또는 관계에 따라 일정이 재계산되었습니다.")}<small>`);
  });
});
