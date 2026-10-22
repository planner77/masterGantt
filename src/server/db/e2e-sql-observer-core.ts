import { performance } from "node:perf_hooks";
import type Database from "better-sqlite3";

import { getRequestContext, type SqlRequestMetrics } from "../http/request-context-core";

/** E2E-only, per HTTP request and SQL statement execution. Never persist SQL or bind values. */
export function measureSqlExecution<T>(
  action: () => T,
  metrics: SqlRequestMetrics | undefined,
  count = true,
  now: () => number = performance.now.bind(performance),
): T {
  if (!metrics) return action();
  const started = now();
  if (count) metrics.calls += 1;
  try { return action(); }
  catch (error) { metrics.errors += 1; throw error; }
  finally { metrics.executionMs += Math.max(0, now() - started); }
}

/**
 * better-sqlite3 methods require a native Statement receiver. Proxy all native
 * methods with this=target and return the proxy for fluent mutators, retaining
 * query behavior. Opt-in is applied only on disposable test-server connections.
 */
export function observeStatement<T extends object>(
  statement: T,
  current: () => SqlRequestMetrics | undefined,
): T {
  const proxy: T = new Proxy(statement, {
    get(target, name) {
      const value: unknown = Reflect.get(target, name, target);
      if (typeof value !== "function") return value;
      const method = value as (...args: unknown[]) => unknown;
      if (name === "get" || name === "all" || name === "run") {
        return (...args: unknown[]) => measureSqlExecution(
          () => method.apply(target, args), current(),
        );
      }
      if (name === "iterate") {
        return (...args: unknown[]) => {
          const metrics = current();
          const iterator = measureSqlExecution(
            () => method.apply(target, args) as Iterator<unknown>, metrics,
          );
          return {
            [Symbol.iterator]() { return this; },
            next() { return measureSqlExecution(() => iterator.next(), metrics, false); },
            return(returnValue?: unknown) {
              return iterator.return
                ? measureSqlExecution(() => iterator.return!(returnValue), metrics, false)
                : { done: true, value: returnValue };
            },
          };
        };
      }
      return (...args: unknown[]) => {
        const result = method.apply(target, args);
        return result === target ? proxy : result;
      };
    },
  });
  return proxy;
}

export function installE2eSqlObserver(database: Database.Database): void {
  const original = database.prepare.bind(database);
  const prepared = ((sql: string) => observeStatement(
    original(sql), () => getRequestContext()?.sqlMetrics,
  )) as typeof database.prepare;
  // No global monkey patch: only the disposable db connection returned by getDatabase().
  Object.defineProperty(database, "prepare", {
    value: prepared, configurable: true, writable: true,
  });
}
