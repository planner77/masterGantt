import type { DeveloperGrade, ResourceRole } from "@/contracts/resources";

export const membershipRoles: ReadonlyArray<{ value: ResourceRole; label: string }> = [
  { value: "PI", label: "PI" }, { value: "DEVELOPER", label: "개발자" }, { value: "EQUIPMENT_OWNER", label: "설비 담당" },
];
export const membershipGrades: ReadonlyArray<{ value: DeveloperGrade; label: string }> = [
  { value: "BEGINNER", label: "초급" }, { value: "INTERMEDIATE", label: "중급" }, { value: "ADVANCED", label: "고급" }, { value: "EXPERT", label: "특급" },
];
export type MembershipFilters = { q: string; role: string; grade: string; groupId: string; registration: string; usage: string; active: string };
export const emptyMembershipFilters: MembershipFilters = { q: "", role: "", grade: "", groupId: "", registration: "", usage: "", active: "" };
export function membershipQuery(scope: "project" | "catalog", filters: MembershipFilters, offset: number): string {
  const query = new URLSearchParams({ scope, offset: String(offset), limit: "50" });
  for (const [key, value] of Object.entries(filters)) if (value.trim()) query.set(key, value.trim());
  return query.toString();
}
export function membershipError(status: number, code?: string): string {
  if (status === 401) return "편집 세션이 만료되었습니다. 프로젝트 편집 잠금을 다시 해제해 주세요.";
  if (status === 403) return "이 프로젝트의 리소스를 변경할 권한이 없습니다.";
  if (status === 412) return "프로젝트 또는 공용 리소스가 변경되었습니다. 최신 목록을 불러온 뒤 다시 검토해 주세요.";
  if (code === "PROJECT_RESOURCE_IN_USE") return "작업 배정 또는 책임 역할에서 사용 중이므로 등록을 해제할 수 없습니다. 기존 사용을 먼저 정리해 주세요.";
  if (code === "RESOURCE_INACTIVE") return "비활성 리소스는 새로 등록할 수 없습니다. 공용 리소스 관리자에게 확인해 주세요.";
  return "리소스 목록을 확인하지 못했습니다. 다시 불러온 후 시도해 주세요.";
}
