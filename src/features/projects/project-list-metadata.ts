import { displayName, translate } from "../../lib/i18n";
import type { AppLocale } from "../../lib/i18n/locales";
import type { ProjectMasterItemDto } from "@/contracts/project-master";

export const PROJECT_MASTER_UNASSIGNED_LABEL = "미지정";

export function projectMasterListLabel(item: ProjectMasterItemDto | null | undefined, locale: AppLocale = "ko"): string {
  if (!item) return translate(locale, PROJECT_MASTER_UNASSIGNED_LABEL);
  const name = displayName(item, locale);
  if (!name.trim()) return translate(locale, PROJECT_MASTER_UNASSIGNED_LABEL);
  return item.active ? name : `${name} (${translate(locale, "비활성")})`;
}
