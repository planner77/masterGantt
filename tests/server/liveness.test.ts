import { describe, expect, it } from "vitest";

import { getLiveness } from "../../src/server/health/liveness-core";

describe("liveness", () => {
  it("returns a stable public health payload", () => {
    expect(getLiveness()).toEqual({ status: "ok" });
  });
});
