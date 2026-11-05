import { translate } from "../../lib/i18n";
import type { AppLocale } from "../../lib/i18n/locales";
import { renderResourcePlanLabel, type ResourcePlanLabelPresentation } from "../resources/resource-plan-model";

export type ResourceNavigationLabel = string | {
  kind: "resourcePlan";
  presentation: ResourcePlanLabelPresentation;
  /** The host sets this from the verified projection, never from presentation data. */
  projectEvidence: boolean;
} | {
  key: string;
  values: Record<string, string | number>;
  labels?: Record<string, string>;
};

export function renderNavigationLabel(label: ResourceNavigationLabel, locale: AppLocale): string {
  if (typeof label === "string") return label;
  if ("kind" in label) {
    const inner = renderResourcePlanLabel(label.presentation, locale);
    return label.projectEvidence
      ? translate(locale, "Project 전체 부하 근거 · {label}", { label: inner })
      : inner;
  }
  return translate(locale, label.key, { ...label.values,
    ...Object.fromEntries(Object.entries(label.labels ?? {}).map(([key, value]) => [key, translate(locale, value)])),
  });
}
