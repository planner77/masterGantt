/** Coalesce real observation requests behind the latest canonical data queue.
 * This is an ordering barrier, never a retry of a failed observation. */
export function createProjectionObservationScheduler<T>(options: {
  queue(): Promise<unknown>;
  current(): boolean;
  observe(triggers: readonly T[]): void;
  failed?(): void;
}) {
  let pending = false, disposed = false;
  let drain = 0;
  const triggers = new Set<T>();
  const fail = () => {
    drain++; pending = false; triggers.clear();
    if (!disposed) { try { options.failed?.(); } catch { /* Diagnostics are advisory. */ } }
  };
  const current = () => {
    try { return !disposed && options.current(); } catch { fail(); return false; }
  };
  const wait = (generation: number) => {
    let queue: Promise<unknown>;
    try { queue = options.queue(); } catch { fail(); return; }
    void queue.then(() => {
      if (generation !== drain) return;
      if (!current()) { pending = false; triggers.clear(); return; }
      try { if (queue !== options.queue()) { wait(generation); return; } } catch { fail(); return; }
      pending = false;
      const requested = [...triggers]; triggers.clear();
      try { options.observe(requested); } catch { fail(); }
    }, () => { if (generation === drain) fail(); });
  };
  return {
    request(value: T) {
      if (!current()) return;
      triggers.add(value);
      if (pending) return;
      pending = true;
      wait(++drain);
    },
    dispose() { disposed = true; drain++; pending = false; triggers.clear(); },
  };
}
