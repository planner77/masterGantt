"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { normalizeMilestoneTimelinePreference } from "./milestone-timeline-model";
import { readMilestoneTimelinePreference, writeMilestoneTimelinePreference } from "./milestone-timeline-preference";

function preferenceStore(projectId: string) {
  const serverSnapshot = { preference: normalizeMilestoneTimelinePreference(null), storageFailed: false };
  let snapshot = serverSnapshot, initialized = false;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getServerSnapshot: () => serverSnapshot,
    getSnapshot() {
      if (!initialized && typeof window !== "undefined") {
        initialized = true;
        try { snapshot = readMilestoneTimelinePreference(projectId, window.localStorage); }
        catch { snapshot = { preference: serverSnapshot.preference, storageFailed: true }; }
      }
      return snapshot;
    },
    set(showMilestones: boolean) {
      const preference = normalizeMilestoneTimelinePreference({ version: 1, showMilestones });
      let storageFailed = false;
      try { storageFailed = !writeMilestoneTimelinePreference(projectId, preference, window.localStorage); }
      catch { storageFailed = true; }
      // Memory remains authoritative for this mount even when persistence fails.
      initialized = true; snapshot = { preference, storageFailed };
      for (const listener of listeners) listener();
    },
  };
}

/** Only explicit commands persist; filters, scopes and temporary reveals do not. */
export function useMilestoneTimelinePreference(projectId: string, onStorageFailure: () => void) {
  const [holder, setHolder] = useState(() => ({ projectId, store: preferenceStore(projectId) }));
  if (holder.projectId !== projectId) setHolder({ projectId, store: preferenceStore(projectId) });
  const { store } = holder;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const notified = useRef(new Set<string>());
  const callback = useRef(onStorageFailure);
  useLayoutEffect(() => { callback.current = onStorageFailure; }, [onStorageFailure]);
  useEffect(() => {
    if (snapshot.storageFailed && !notified.current.has(projectId)) { notified.current.add(projectId); callback.current(); }
  }, [projectId, snapshot.storageFailed]);
  return { preference: snapshot.preference, setShowMilestones: store.set };
}
