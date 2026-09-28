import type { ResourceDto, ResourceGroupDto } from "@/contracts/resources";

export function filterResources(resources: readonly ResourceDto[], query: string): ResourceDto[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...resources];
  return resources.filter((resource) => {
    const nameMatch = resource.name.toLowerCase().includes(term);
    const codeMatch = typeof resource.code === "string" && resource.code.toLowerCase().includes(term);
    return nameMatch || codeMatch;
  });
}

export function filterGroups(groups: readonly ResourceGroupDto[], query: string): ResourceGroupDto[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...groups];
  return groups.filter((group) => {
    const nameMatch = group.name.toLowerCase().includes(term);
    const codeMatch = typeof group.code === "string" && group.code.toLowerCase().includes(term);
    return nameMatch || codeMatch;
  });
}
