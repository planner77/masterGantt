import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isWorkingDay, workingDaysBetween } from "../../../src/domain/scheduling/calendar";
import { ResourceCalendarExceptionConflictError } from "../../../src/domain/scheduling/resource-calendar";
import {
  loadResourceCalendarExceptions,
  PersistedWorkCalendarConflictError,
  resolveProjectWorkingCalendar,
  resolveResourceWorkingCalendar,
} from "../../../src/server/calendars/calendar-resolution-core";
import { openDatabase } from "../../../src/server/db/core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { WorkCalendarRepository } from "../../../src/server/repositories/work-calendar-repository-core";

const date = "2026-10-09";
const now = "2026-09-29T00:00:00.000Z";

function fixture() {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db", "migrations") }).database;
  database.prepare(`INSERT INTO projects(public_id,name,password_kdf,password_salt,password_hash,scrypt_n,scrypt_r,scrypt_p,scrypt_key_length,created_at,updated_at)
    VALUES(?,?,'scrypt',?,?,32768,8,3,32,?,?)`).run(randomUUID(), "Resolver", Buffer.alloc(16, 1), Buffer.alloc(32, 2), now, now);
  const projectId = database.prepare("SELECT id FROM projects").pluck().get() as number;
  const catalog = new ResourceCatalogRepository(database);
  const calendars = new WorkCalendarRepository(database);
  const person = catalog.insertResource({ publicId: randomUUID(), name: "Resource", code: null, description: "", now });
  const groups = ["A", "B"].map((name) => catalog.insertGroup({ publicId: randomUUID(), name, code: null, description: "", now }));
  for (const group of groups) catalog.replaceGroupMembers(group.id, [person.id], now);
  function add(targetType: "PROJECT" | "RESOURCE_GROUP" | "RESOURCE", targetPublicId: string | null, dayType: "WORKING" | "NON_WORKING") {
    const rule = calendars.insertRule({ publicId: randomUUID(), projectId, kind: "CUSTOM", name: `${targetType} ${dayType}`,
      countryCode: null, targetType, targetPublicId, scope: "DATE_RANGE", effectiveFrom: date, effectiveTo: date, sourceVersion: null, now });
    calendars.insertDate({ calendarRuleId: rule.id, date, dayType, name: rule.name, sourceKey: null, sourceVersion: null, now });
    return rule;
  }
  return { database, projectId, person, groups, add };
}

describe("persisted resource calendar adapter", () => {
  it("applies Group/Resource WORKING overrides and never modifies Project calendar", () => {
    const { database, projectId, person, groups, add } = fixture();
    try {
      add("PROJECT", null, "NON_WORKING");
      add("RESOURCE_GROUP", groups[0].publicId, "WORKING");
      expect(isWorkingDay(date, resolveResourceWorkingCalendar(database, projectId, person.publicId))).toBe(true);
      expect(isWorkingDay(date, resolveProjectWorkingCalendar(database, projectId))).toBe(false);
      add("RESOURCE", person.publicId, "NON_WORKING");
      expect(isWorkingDay(date, resolveResourceWorkingCalendar(database, projectId, person.publicId))).toBe(false);
      expect(isWorkingDay(date, resolveProjectWorkingCalendar(database, projectId))).toBe(false);
    } finally { database.close(); }
  });

  it("deduplicates multiple Group WORKING days and preserves saved rule sources", () => {
    const { database, projectId, person, groups, add } = fixture();
    try {
      add("PROJECT", null, "NON_WORKING");
      const rules = groups.map((group) => add("RESOURCE_GROUP", group.publicId, "WORKING"));
      const calendar = resolveResourceWorkingCalendar(database, projectId, person.publicId);
      expect(workingDaysBetween(date, date, calendar)).toBe(1);
      expect(calendar.exceptions).toHaveLength(1);
      const sources = loadResourceCalendarExceptions(database, projectId);
      expect(sources.map((source) => source.ruleId).sort()).toEqual(rules.map((rule) => rule.publicId).sort());
    } finally { database.close(); }
  });

  it("fails closed on persisted Group conflict even when Resource override exists", () => {
    const { database, projectId, person, groups, add } = fixture();
    try {
      add("RESOURCE_GROUP", groups[0].publicId, "WORKING");
      add("RESOURCE_GROUP", groups[1].publicId, "NON_WORKING");
      add("RESOURCE", person.publicId, "WORKING");
      expect(() => resolveResourceWorkingCalendar(database, projectId, person.publicId)).toThrow(ResourceCalendarExceptionConflictError);
      expect(isWorkingDay(date, resolveProjectWorkingCalendar(database, projectId))).toBe(true);
    } finally { database.close(); }
  });

  it("preserves existing Project opposite-exception rejection", () => {
    const { database, projectId, person, add } = fixture();
    try {
      add("PROJECT", null, "WORKING");
      add("PROJECT", null, "NON_WORKING");
      add("RESOURCE", person.publicId, "WORKING");
      expect(() => resolveProjectWorkingCalendar(database, projectId)).toThrow(PersistedWorkCalendarConflictError);
      expect(() => resolveResourceWorkingCalendar(database, projectId, person.publicId)).toThrow(PersistedWorkCalendarConflictError);
    } finally { database.close(); }
  });
});
