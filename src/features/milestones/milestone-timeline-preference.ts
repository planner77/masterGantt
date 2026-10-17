import { normalizeMilestoneTimelinePreference, type MilestoneTimelinePreference } from "./milestone-timeline-model";

export interface MilestonePreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const milestoneTimelineStorageKey = (projectId: string): string => `mastergantt:milestone-timeline:${projectId}`;

export function readMilestoneTimelinePreference(projectId: string, storage: MilestonePreferenceStorage): { preference: MilestoneTimelinePreference; storageFailed: boolean } {
  try {
    const raw = storage.getItem(milestoneTimelineStorageKey(projectId));
    let parsed: unknown = null;
    if (raw !== null) { try { parsed = JSON.parse(raw); } catch { /* Malformed data uses the versioned default. */ } }
    return { preference: normalizeMilestoneTimelinePreference(parsed), storageFailed: false };
  } catch {
    return { preference: normalizeMilestoneTimelinePreference(null), storageFailed: true };
  }
}

export function writeMilestoneTimelinePreference(projectId: string, preference: MilestoneTimelinePreference, storage: MilestonePreferenceStorage): boolean {
  try { storage.setItem(milestoneTimelineStorageKey(projectId), JSON.stringify(normalizeMilestoneTimelinePreference(preference))); return true; }
  catch { return false; }
}
