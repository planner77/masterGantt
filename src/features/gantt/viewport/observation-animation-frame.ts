/** U3's wall-time watchdog owns the deadline. A slow visible frame is not a
 * viewport-port tick timeout; only an actual RAF can advance its proof. */
export function observationAnimationFrame(signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted || document.visibilityState === "hidden") { resolve(false); return; }
    let done = false, frame: number | null = null;
    const finish = (animated: boolean) => {
      if (done) return;
      done = true;
      if (frame !== null) cancelAnimationFrame(frame);
      signal.removeEventListener("abort", cancel);
      document.removeEventListener("visibilitychange", visibility);
      resolve(animated);
    };
    const cancel = () => finish(false);
    const visibility = () => { if (document.visibilityState === "hidden") finish(false); };
    signal.addEventListener("abort", cancel, { once: true });
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(() => finish(true));
  });
}
