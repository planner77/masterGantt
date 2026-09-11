export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface WindowState {
  count: number;
  resetsAt: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly maximumAttempts: number,
    private readonly windowMilliseconds: number,
    private readonly maximumTrackedKeys = 1_024,
  ) {
    if (maximumAttempts < 1 || windowMilliseconds < 1 || maximumTrackedKeys < 1) {
      throw new Error("Rate limiter bounds must be positive.");
    }
  }

  consume(key: string, nowMilliseconds = Date.now()): RateLimitDecision {
    const current = this.windows.get(key);
    if (!current || nowMilliseconds >= current.resetsAt) {
      if (!current && this.windows.size >= this.maximumTrackedKeys) {
        for (const [trackedKey, state] of this.windows) {
          if (nowMilliseconds >= state.resetsAt) {
            this.windows.delete(trackedKey);
          }
        }
        if (this.windows.size >= this.maximumTrackedKeys) {
          return { allowed: false, retryAfterSeconds: 1 };
        }
      }
      this.windows.set(key, {
        count: 1,
        resetsAt: nowMilliseconds + this.windowMilliseconds,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= this.maximumAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetsAt - nowMilliseconds) / 1_000),
        ),
      };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  clear(): void {
    this.windows.clear();
  }
}

export const projectCreateRateLimiter = new FixedWindowRateLimiter(
  5,
  60 * 60 * 1_000,
);

export const UNATTRIBUTED_CREATE_RATE_KEY = "unattributed";

export const unlockGlobalRateLimiter = new FixedWindowRateLimiter(
  50,
  15 * 60 * 1_000,
  1,
);

export const unlockProjectRateLimiter = new FixedWindowRateLimiter(
  10,
  15 * 60 * 1_000,
  1_024,
);

export const UNATTRIBUTED_UNLOCK_RATE_KEY = "unattributed";
