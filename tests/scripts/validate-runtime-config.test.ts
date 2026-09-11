import { describe, expect, it } from "vitest";

import { validateRuntimeConfiguration } from "../../scripts/validate-runtime-config";

describe("validateRuntimeConfiguration", () => {
  it("accepts the production container path and a canonical HTTPS origin", () => {
    expect(() => validateRuntimeConfiguration({
      databasePath: "/data/mastergantt.sqlite3",
      applicationBaseUrl: "https://gantt.example.com",
      environment: "production",
    })).not.toThrow();
  });

  it("rejects missing or insecure production application origins", () => {
    for (const applicationBaseUrl of [
      undefined,
      "http://gantt.example.com",
      "https://user@gantt.example.com",
      "https://gantt.example.com/path",
      "https://gantt.example.com?query=1",
    ]) {
      expect(() => validateRuntimeConfiguration({
        databasePath: "/data/mastergantt.sqlite3",
        applicationBaseUrl,
        environment: "production",
      })).toThrow();
    }
  });

  it("rejects a production database path outside /data", () => {
    expect(() => validateRuntimeConfiguration({
      databasePath: "/app/mastergantt.sqlite3",
      applicationBaseUrl: "https://gantt.example.com",
      environment: "production",
    })).toThrow();
  });
});
