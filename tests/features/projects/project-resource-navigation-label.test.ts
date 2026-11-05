import { describe, expect, it } from "vitest";
import { renderResourcePlanLabel, type ResourcePlanLabelPresentation } from "../../../src/features/resources/resource-plan-model";
import { renderNavigationLabel, type ResourceNavigationLabel } from "../../../src/features/projects/project-resource-navigation-label";

const presentation: ResourcePlanLabelPresentation = {
  owners: [{ name: "설정" }, { name: "원본 그룹", translations: { en: "Managed group", vi: "Nhóm quản lý" } }],
  periodId: "all", projectReference: false, trail: [],
};

describe("Project Resource navigation label presentation", () => {
  it.each([
    ["ko", "Project 전체 부하 근거 · 설정 / 원본 그룹 · 현재 기간"],
    ["en", "Project-wide load evidence · 설정 / Managed group · Current period"],
    ["vi", "Cơ sở tải toàn Project · 설정 / Nhóm quản lý · Kỳ hiện tại"],
  ] as const)("%s: retains Project evidence semantics around the localized Plan label", (locale, expected) => {
    expect(renderNavigationLabel({ kind: "resourcePlan", presentation, projectEvidence: true }, locale)).toBe(expected);
  });

  it.each(["ko", "en", "vi"] as const)("%s: a selected scope has no Project evidence wrapper, even with a reference caption", locale => {
    const selected = { ...presentation, projectReference: true };
    expect(renderNavigationLabel({ kind: "resourcePlan", presentation: selected, projectEvidence: false }, locale))
      .toBe(renderResourcePlanLabel(selected, locale));
  });

  it("re-renders one saved descriptor without changing its owners, dates or scope flag", () => {
    const label: ResourceNavigationLabel = { kind: "resourcePlan", projectEvidence: true,
      presentation: { ...presentation, trail: [{ date: "2032-01-02", name: "완료" }] } };
    const original = JSON.stringify(label);
    const ko = renderNavigationLabel(label, "ko"), en = renderNavigationLabel(label, "en"), vi = renderNavigationLabel(label, "vi");
    expect(ko).toContain("Project 전체 부하 근거");
    expect(en).toContain("Project-wide load evidence");
    expect(vi).toContain("Cơ sở tải toàn Project");
    for (const text of [ko, en, vi]) {
      expect(text).toContain("설정");
      expect(text).toContain("완료");
    }
    expect(en).toContain("Jan 2, 2032");
    expect(en).not.toBe(vi);
    expect(JSON.stringify(label)).toBe(original);
  });

  it("keeps opaque fallback strings and existing fixed-label parameters unchanged", () => {
    expect(renderNavigationLabel("설정", "en")).toBe("설정");
    expect(renderNavigationLabel({ key: "Project 전체 부하 근거 · {label}", values: { label: "완료 (TASK-ID)" } }, "en"))
      .toBe("Project-wide load evidence · 완료 (TASK-ID)");
  });
});
