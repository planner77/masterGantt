import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("domain execution boundary", () => {
  it("uses only relative scheduling imports and no instant or external I/O APIs", () => {
    const directory = resolve("src/domain/scheduling");
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".ts"))) {
      const source = readFileSync(resolve(directory, file), "utf8");
      const imports = [...source.matchAll(/(?:from\s+|import\s*\()(["'])([^"']+)\1/g)].map((match) => match[2]);
      expect(imports.every((specifier) => /^\.\/[a-z-]+$/.test(specifier)), file).toBe(true);
      expect(source, file).not.toMatch(/\b(?:Date|Intl|process|fetch|XMLHttpRequest|require)\s*[.(]|Math\.random/);
    }
  });

  it("returns identical results in UTC, Seoul and DST/timezone date-boundary environments", () => {
    const script = `
      const { createWorkingCalendar, scheduleLeaf, workingDaysBetween } = require('./src/domain/scheduling/index.ts');
      const calendar = createWorkingCalendar({timezone:'Asia/Seoul',weekendDays:[6,0],holidays:[{date:'2026-03-09'}]});
      const starts = ['2026-03-06','2026-03-08','2026-10-30','2026-11-01','2028-02-28','2000-02-28','2100-02-26'];
      const result = starts.map(requestedStart => scheduleLeaf({type:'task',requestedStart,duration:3},calendar));
      result.push(workingDaysBetween('2026-03-06','2026-03-10',calendar));
      process.stdout.write(JSON.stringify(result));
    `;
    const results = ["UTC", "Asia/Seoul", "America/New_York", "Europe/Berlin", "Pacific/Apia"].map((timezone) =>
      execFileSync(process.execPath, ["--import", "tsx", "-e", script], {
        cwd: process.cwd(), env: { ...process.env, TZ: timezone }, encoding: "utf8", timeout: 15_000,
      }),
    );
    for (const result of results) expect(result).toBe(results[0]);
    const parsed = JSON.parse(results[0]);
    expect(parsed[0]).toMatchObject({ start: "2026-03-06", end: "2026-03-11" });
    expect(parsed[1]).toMatchObject({ requestedStart: "2026-03-08", start: "2026-03-10", end: "2026-03-12" });
    expect(parsed[3]).toMatchObject({ requestedStart: "2026-11-01", start: "2026-11-02", end: "2026-11-04" });
  });
});
