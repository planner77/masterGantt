import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { installE2eSqlObserver, measureSqlExecution } from "../../../src/server/db/e2e-sql-observer-core";
import { withApiRequestLogging } from "../../../src/server/http/request-context-core";
import { createStructuredLogger } from "../../../src/server/logging/logger-core";

function recordedLogger() {
  const events: Array<Record<string, unknown>> = [];
  const append = (line: string) => { events.push(JSON.parse(line) as Record<string, unknown>); };
  return {
    events,
    logger: createStructuredLogger({
      level: "debug", environment: "test",
      sink: { debug: append, info: append, warn: append, error: append },
    }),
  };
}

describe("Issue #751 isolated SQLite request profiling", () => {
  it("counts actual native queries and elapsed times without exposing SQL or arguments", async () => {
    const { events, logger } = recordedLogger();
    const db = openDatabase({
      filename: ":memory:", migrationsDirectory: "db/migrations", migrate: false,
    }).database;
    try {
      installE2eSqlObserver(db);
      const response = await withApiRequestLogging(
        new Request("http://localhost/api/test-sql-observer/resource-dashboard"),
        { route: "/api/test-sql-observer/resource-dashboard", logger, observeSqlMetrics: true },
        () => {
          expect(db.prepare("SELECT 4 AS value").pluck().get()).toBe(4);
          db.prepare("CREATE TABLE example (value INTEGER)").run();
          db.prepare("INSERT INTO example(value) VALUES (?)").run(28);
          const values = [...db.prepare("SELECT value FROM example").iterate()] as Array<{ value: number }>;
          expect(values).toEqual([{ value: 28 }]);
          return new Response("ok", { status: 200 });
        },
      );
      expect(response.status).toBe(200);
      const event = events.find(row => row.event === "http_request_completed");
      expect(event?.sqlStatementCount).toBe(4);
      expect(event?.sqlErrorCount).toBe(0);
      expect(typeof event?.sqlExecutionMs).toBe("number");
      expect(JSON.stringify(event)).not.toMatch(/SELECT 4|CREATE TABLE|INSERT INTO|example/);
    } finally { db.close(); }
  });

  it("keeps the original thrown error and counts failed SQL without leaking query text", async () => {
    const { events, logger } = recordedLogger();
    const db = openDatabase({
      filename: ":memory:", migrationsDirectory: "db/migrations", migrate: false,
    }).database;
    try {
      installE2eSqlObserver(db);
      const response = await withApiRequestLogging(
        new Request("http://localhost/api/test-sql-observer/assignment-targets"),
        { route: "/api/test-sql-observer/assignment-targets", logger, observeSqlMetrics: true },
        () => {
          db.prepare("CREATE TABLE constraint_probe (value INTEGER NOT NULL)").run();
          expect(() => db.prepare("INSERT INTO constraint_probe (value) VALUES (?)").run(null)).toThrow();
          return new Response("still enforced", { status: 409 });
        },
      );
      expect(response.status).toBe(409);
      const event = events.find(row => row.event === "http_request_completed");
      expect(event?.sqlErrorCount).toBe(1);
      expect(event?.sqlStatementCount).toBe(2);
      expect(JSON.stringify(event)).not.toContain("constraint_probe");
    } finally { db.close(); }
  });

  it("leaves normal requests uninstrumented and tracks exceptions monotonically", async () => {
    const metrics = { calls: 0, executionMs: 0, errors: 0 };
    const failure = new Error("original");
    let elapsed = 0;
    expect(() => measureSqlExecution(
      () => { throw failure; }, metrics, true, () => ++elapsed,
    )).toThrow(failure);
    expect(metrics).toEqual({ calls: 1, executionMs: 1, errors: 1 });

    const { logger, events } = recordedLogger();
    await withApiRequestLogging(new Request("http://localhost/api/x"),
      { route: "/api/x", logger }, () => new Response("ok"));
    expect(events.at(-1)).not.toHaveProperty("sqlStatementCount");
  });
});
