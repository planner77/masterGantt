import type { ResourceDto, ResourceGroupDto } from "@/contracts/resources";
import type { AppLocale } from "../../lib/i18n/locales";

export function filterResources(resources: readonly ResourceDto[], query: string): ResourceDto[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...resources];
  return resources.filter((resource) => {
    const nameMatch = resource.name.toLowerCase().includes(term);
    const codeMatch = typeof resource.code === "string" && resource.code.toLowerCase().includes(term);
    return nameMatch || codeMatch || resource.id.toLowerCase().includes(term);
  });
}

export function filterGroups(groups: readonly ResourceGroupDto[], query: string, locale: AppLocale = "ko"): ResourceGroupDto[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...groups];
  return groups.filter((group) => {
    const translatedName = group.translations?.[locale];
    const nameMatch = group.name.toLowerCase().includes(term) ||
      (typeof translatedName === "string" && translatedName.toLowerCase().includes(term));
    const codeMatch = typeof group.code === "string" && group.code.toLowerCase().includes(term);
    return nameMatch || codeMatch || group.id.toLowerCase().includes(term);
  });
}
