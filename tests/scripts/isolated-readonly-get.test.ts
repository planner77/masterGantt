import { describe, expect, it } from "vitest";
import { diagnosticRoute, observedReadOnlyGet, type ObserveIsolatedApi } from "../e2e/fixtures/isolated-application-diagnostics";

const route = "/api/projects/00000000-0000-4000-8000-000000000001";
const response = (status: number) => ({ status: () => status, headers: () => ({}) });

function harness() {
  const events: string[] = [];
  const observe: ObserveIsolatedApi = async (path, method, operation) => {
    expect(path).toBe(route);
    expect(method).toBe("GET");
    events.push("start");
    try {
      const result = await operation();
      events.push("completed");
      return result;
    } catch (error) {
      // The production observer captures lifecycle, health and cgroup data
      // before propagating the first failure. Do not bypass that first call.
      events.push("captured");
      throw error;
    }
  };
  return { observe, events };
}

describe("Issue #703: observe canonical GET before one bounded ECONNRESET recovery", () => {
  it("keeps diagnostic routes relative and anonymizes the Project ID", () => {
    expect(diagnosticRoute(route)).toBe("/api/projects/[publicId]");
    expect(diagnosticRoute("http://127.0.0.1:3000" + route)).toBe("other");
    expect(diagnosticRoute(route + "?token=hidden")).toBe("other");
  });


  it("does not replay a successful canonical read", async () => {
    const { observe, events } = harness();
    let calls = 0;
    const result = await observedReadOnlyGet(observe, route, async () => {
      calls += 1;
      return response(200);
    });
    expect(result.status()).toBe(200);
    expect(calls).toBe(1);
    expect(events).toEqual(["start", "completed"]);
  });

  it("captures the first exact transport reset, then permits one GET only", async () => {
    const { observe, events } = harness();
    let calls = 0;
    const result = await observedReadOnlyGet(observe, route, async () => {
      if (++calls === 1) throw new Error("apiRequestContext.get: read ECONNRESET");
      return response(200);
    });
    expect(result.status()).toBe(200);
    expect(calls).toBe(2);
    expect(events).toEqual(["start", "captured", "start", "completed"]);
  });

  it("observes Playwright's socket hang up before one bounded read-only recovery (#860)", async () => {
    const { observe, events } = harness();
    let calls = 0;
    const result = await observedReadOnlyGet(observe, route, async () => {
      if (++calls === 1) throw new Error("apiRequestContext.get: socket hang up");
      return response(200);
    });
    expect(result.status()).toBe(200);
    expect(calls).toBe(2);
    expect(events).toEqual(["start", "captured", "start", "completed"]);
  });

  it("fails on a second socket hang up without a third GET (#860)", async () => {
    const { observe, events } = harness();
    let calls = 0;
    await expect(observedReadOnlyGet(observe, route, async () => {
      calls++;
      throw new Error("apiRequestContext.get: socket hang up");
    })).rejects.toThrow("socket hang up");
    expect(calls).toBe(2);
    expect(events).toEqual(["start", "captured", "start", "captured"]);
  });

  it("preserves the second error without a third attempt", async () => {
    const { observe, events } = harness();
    let calls = 0;
    await expect(observedReadOnlyGet(observe, route, async () => {
      calls += 1;
      throw new Error("apiRequestContext.get: read ECONNRESET");
    })).rejects.toThrow("ECONNRESET");
    expect(calls).toBe(2);
    expect(events).toEqual(["start", "captured", "start", "captured"]);
  });

  it("does not retry HTTP failures including 404/409/503", async () => {
    for (const code of [404, 409, 503]) {
      const { observe, events } = harness();
      let calls = 0;
      const result = await observedReadOnlyGet(observe, route, async () => {
        calls += 1;
        return response(code);
      });
      expect(result.status()).toBe(code);
      expect(calls).toBe(1);
      expect(events).toEqual(["start", "completed"]);
    }
  });

  it("does not retry timeouts, other errors or thrown non-Errors", async () => {
    for (const fault of [new Error("ETIMEDOUT"), new Error("ECONNREFUSED"), new Error("invalid JSON"), "ECONNRESET"]) {
      const { observe, events } = harness();
      let calls = 0;
      await expect(observedReadOnlyGet(observe, route, async () => {
        calls += 1;
        throw fault;
      })).rejects.toEqual(fault);
      expect(calls).toBe(1);
      expect(events).toEqual(["start", "captured"]);
    }
  });
});
