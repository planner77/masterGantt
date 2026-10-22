import { describe, expect, it } from "vitest";

import {
  isolatedReadOnlyWarmupPaths,
  isolatedWarmupStage,
} from "../e2e/fixtures/isolated-route-warmup";

const missing = "00000000-0000-4000-8000-000000000001";

describe("Issue #751 / #622 disposable Next cold route warm-up", () => {
  it("compiles both sequential editor GET endpoints once before test-body timing", () => {
    const paths = isolatedReadOnlyWarmupPaths(missing);
    expect(paths).toContain("/api/projects/" + missing + "/assigned-targets");
    expect(paths).toContain("/api/projects/" + missing + "/assignment-targets");
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.indexOf("/api/projects/" + missing + "/assigned-targets"))
      .toBeLessThan(paths.indexOf("/api/projects/" + missing + "/assignment-targets"));
    expect(isolatedWarmupStage("/api/projects/" + missing + "/assigned-targets")).toBe("next_assigned_targets_warmup");
    expect(isolatedWarmupStage("/api/projects/" + missing + "/assignment-targets")).toBe("next_assignment_targets_warmup");
  });
  it("uses a disposable project and never probes mutations or credentials", () => {
    const paths = isolatedReadOnlyWarmupPaths(missing);
    expect(paths.every(path => path.startsWith("/") && !/[?#]/.test(path))).toBe(true);
    expect(paths.some(path => /\/assignments$|\/target-bindings$|\/unlock$|\/logout$/i.test(path))).toBe(false);
    expect(() => isolatedReadOnlyWarmupPaths("real-project")).toThrow();
    expect(isolatedWarmupStage("/api/projects/" + missing + "/tasks")).toBeNull();
  });
});
