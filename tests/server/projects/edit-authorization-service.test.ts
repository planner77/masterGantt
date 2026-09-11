import { join } from "node:path";

import type Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import {
  EditSessionInvalidError,
  ProjectService,
  RevisionMismatchError,
  type AuthorizedEditSession,
} from "../../../src/server/projects/project-service-core";
import { handleUpdateProject } from "../../../src/server/projects/project-handlers-core";
import { handleChangeEditPassword } from "../../../src/server/projects/edit-session-handlers-core";
import type {
  PasswordHashRecord,
  PersistedPasswordRecord,
} from "../../../src/server/security/password-core";
import { hashSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const databases: Database.Database[] = [];
const publicIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];

function fixedPasswordHash(marker = 1): PasswordHashRecord {
  return {
    algorithm: "scrypt",
    salt: Buffer.alloc(16, marker),
    hash: Buffer.alloc(32, marker + 1),
    n: 32_768,
    r: 8,
    p: 3,
    keyLength: 32,
  };
}

function token(character: string) {
  const rawToken = character.repeat(43);
  return { rawToken, tokenHash: hashSessionToken(rawToken) };
}

function database(): Database.Database {
  const opened = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
  databases.push(opened);
  return opened;
}

afterEach(() => {
  for (const current of databases.splice(0)) current.close();
});

describe("ProjectService W05 unlock and session consumption", () => {
  it("uses the same verification path for correct, wrong, unknown, and corrupt credentials", async () => {
    const db = database();
    const records: (PersistedPasswordRecord | undefined)[] = [];
    const verify = vi.fn(async (
      candidate: string,
      record: PersistedPasswordRecord | undefined,
    ) => {
      records.push(record);
      return candidate === "correct password" &&
        record?.algorithm === "scrypt" &&
        record.n === 32_768;
    });
    const identifiers = [...publicIds];
    const tokens = [token("A"), token("B")];
    const service = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => identifiers.shift() ?? publicIds[0],
      generateSessionToken: () => tokens.shift() ?? token("Z"),
      hashPassword: async () => fixedPasswordHash(),
      verifyPassword: verify,
    });
    const created = await service.create({
      name: "Project",
      description: "",
      editPassword: "creation password",
    });

    await expect(service.unlock(created.response.data.project.publicId, "wrong"))
      .resolves.toBeUndefined();
    await expect(service.unlock(publicIds[1], "correct password"))
      .resolves.toBeUndefined();
    db.prepare("UPDATE projects SET scrypt_n = 2 WHERE public_id = ?")
      .run(created.response.data.project.publicId);
    await expect(service.unlock(created.response.data.project.publicId, "correct password"))
      .resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledTimes(3);
    expect(records[0]).toBeDefined();
    expect(records[1]).toBeUndefined();
    expect(records[2]?.n).toBe(2);
    expect(db.prepare("SELECT count(*) FROM edit_sessions").pluck().get()).toBe(1);
  });

  it("rechecks the credential snapshot before issuing a session", async () => {
    const db = database();
    const publicId = publicIds[0];
    const base = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => publicId,
      generateSessionToken: () => token("A"),
      hashPassword: async () => fixedPasswordHash(),
    });
    await base.create({ name: "Project", description: "", editPassword: "password phrase" });
    const racing = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:01.000Z"),
      generateSessionToken: () => token("B"),
      verifyPassword: async () => {
        db.prepare("UPDATE projects SET auth_version = auth_version + 1 WHERE public_id = ?")
          .run(publicId);
        return true;
      },
    });

    await expect(racing.unlock(publicId, "password phrase")).resolves.toBeUndefined();
    expect(db.prepare("SELECT count(*) FROM edit_sessions").pluck().get()).toBe(1);
  });

  it("enforces project binding, revoke, auth version, and the exact expiry boundary without writes", async () => {
    const db = database();
    let now = new Date("2026-09-11T01:00:00.000Z");
    const ids = [...publicIds];
    const tokens = [token("A"), token("B")];
    const service = new ProjectService(db, {
      clock: () => now,
      generatePublicId: () => ids.shift() ?? publicIds[0],
      generateSessionToken: () => tokens.shift() ?? token("Z"),
      hashPassword: async () => fixedPasswordHash(),
    });
    await service.create({ name: "A", description: "", editPassword: "password phrase" });
    await service.create({ name: "B", description: "", editPassword: "password phrase" });
    const before = db.prepare("SELECT total_changes() as value").get() as { value: number };

    expect(service.getCurrentEditSession(publicIds[0], token("A").rawToken)?.data.permission).toBe("edit");
    expect(service.getCurrentEditSession(publicIds[1], token("A").rawToken)?.data.permission).toBe("readonly");
    expect(service.getCurrentEditSession(publicIds[0], undefined)?.data.permission).toBe("readonly");
    const after = db.prepare("SELECT total_changes() as value").get() as { value: number };
    expect(after.value).toBe(before.value);

    now = new Date("2026-09-11T09:00:00.000Z");
    expect(service.getCurrentEditSession(publicIds[0], token("A").rawToken)?.data.permission).toBe("readonly");
    now = new Date("2026-09-11T08:59:59.999Z");
    db.prepare("UPDATE edit_sessions SET revoked_at = ? WHERE token_hash = ?")
      .run(now.toISOString(), token("A").tokenHash);
    expect(service.getCurrentEditSession(publicIds[0], token("A").rawToken)?.data.permission).toBe("readonly");
    db.prepare("UPDATE edit_sessions SET revoked_at = NULL, auth_version = 99 WHERE token_hash = ?")
      .run(token("A").tokenHash);
    expect(service.getCurrentEditSession(publicIds[0], token("A").rawToken)?.data.permission).toBe("readonly");
    db.prepare("UPDATE edit_sessions SET auth_version = 1 WHERE token_hash = ?")
      .run(token("A").tokenHash);
    db.prepare("UPDATE projects SET scrypt_n = 2 WHERE public_id = ?").run(publicIds[0]);
    expect(service.getCurrentEditSession(publicIds[0], token("A").rawToken)?.data.permission).toBe("readonly");
  });

  it("keeps cross-project logout cookies and revokes matching sessions idempotently", async () => {
    const db = database();
    const ids = [...publicIds];
    const tokens = [token("A"), token("B")];
    const service = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => ids.shift() ?? publicIds[0],
      generateSessionToken: () => tokens.shift() ?? token("Z"),
      hashPassword: async () => fixedPasswordHash(),
    });
    await service.create({ name: "A", description: "", editPassword: "password phrase" });
    await service.create({ name: "B", description: "", editPassword: "password phrase" });

    expect(service.logout(publicIds[1], { state: "present", rawToken: token("A").rawToken }))
      .toEqual({ kind: "preserveCookie" });
    expect(service.getCurrentEditSession(publicIds[0], token("A").rawToken)?.data.permission).toBe("edit");

    db.prepare("UPDATE edit_sessions SET revoked_at = ? WHERE token_hash = ?")
      .run("2026-09-11T01:00:00.000Z", token("A").tokenHash);
    expect(service.logout(publicIds[1], { state: "present", rawToken: token("A").rawToken }))
      .toEqual({ kind: "clearCookie" });
    db.prepare("UPDATE edit_sessions SET revoked_at = NULL, expires_at = ? WHERE token_hash = ?")
      .run("2026-09-11T01:00:00.000Z", token("A").tokenHash);
    expect(service.logout(publicIds[1], { state: "present", rawToken: token("A").rawToken }))
      .toEqual({ kind: "clearCookie" });
    db.prepare("UPDATE edit_sessions SET expires_at = ?, auth_version = 99 WHERE token_hash = ?")
      .run("2026-09-11T09:00:00.000Z", token("A").tokenHash);
    expect(service.logout(publicIds[1], { state: "present", rawToken: token("A").rawToken }))
      .toEqual({ kind: "clearCookie" });
    db.prepare("UPDATE edit_sessions SET auth_version = 1 WHERE token_hash = ?")
      .run(token("A").tokenHash);
    db.prepare("UPDATE projects SET scrypt_n = 2 WHERE public_id = ?").run(publicIds[0]);
    expect(service.logout(publicIds[1], { state: "present", rawToken: token("A").rawToken }))
      .toEqual({ kind: "clearCookie" });
    db.prepare("UPDATE projects SET scrypt_n = 32768 WHERE public_id = ?").run(publicIds[0]);

    expect(service.logout(publicIds[0], { state: "present", rawToken: token("A").rawToken }))
      .toEqual({ kind: "clearCookie" });
    expect(service.logout(publicIds[0], { state: "present", rawToken: token("A").rawToken }))
      .toEqual({ kind: "clearCookie" });
    expect(service.logout(publicIds[0], { state: "absent" })).toEqual({ kind: "noCookie" });
    expect(service.getCurrentEditSession(publicIds[0], token("A").rawToken)?.data.permission).toBe("readonly");
    expect(db.prepare("SELECT revoked_at FROM edit_sessions WHERE token_hash = ?").pluck().get(token("B").tokenHash))
      .toBeNull();
  });
});

describe("ProjectService W05 protected mutations", () => {
  function authorized(result: ReturnType<ProjectService["authorize"]>): AuthorizedEditSession {
    if (result.kind !== "authorized") throw new Error("expected authorization");
    return result.authorization;
  }

  it("updates metadata atomically with one revision and a canonical permission-free snapshot", async () => {
    const db = database();
    const service = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => publicIds[0],
      generateSessionToken: () => token("A"),
      hashPassword: async () => fixedPasswordHash(),
    });
    await service.create({ name: "Before", description: "Old", editPassword: "password phrase" });
    const auth = authorized(service.authorize(publicIds[0], token("A").rawToken));
    const response = service.updateMetadata(auth, 1, { name: "After", description: "New" });

    expect(response.data).toMatchObject({
      project: { publicId: publicIds[0], name: "After", description: "New", revision: 2 },
      tasks: [],
      links: [],
      warnings: [],
      operation: { kind: "projectMetadata", changedFields: ["name", "description"] },
    });
    expect(response.data).not.toHaveProperty("permission");
    expect(() => service.updateMetadata(auth, 1, { name: "Lost" }))
      .toThrow(RevisionMismatchError);
    expect(db.prepare("SELECT name, revision FROM projects").get()).toEqual({ name: "After", revision: 2 });
  });

  it("rejects a persisted noncanonical Project row at PATCH and password handler boundaries", async () => {
    const db = database();
    const hash = vi.fn(async () => fixedPasswordHash());
    const service = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => publicIds[0],
      generateSessionToken: () => token("A"),
      hashPassword: hash,
    });
    await service.create({ name: "Before", description: "Old", editPassword: "password phrase" });
    const legacyId = "legacy-project-id";
    db.prepare("UPDATE projects SET public_id = ? WHERE public_id = ?")
      .run(legacyId, publicIds[0]);
    const before = db.prepare(
      `SELECT name, description, revision, auth_version, password_salt,
        (SELECT count(*) FROM edit_sessions) AS session_count
       FROM projects`,
    ).get();

    expect(service.authorize(legacyId, token("A").rawToken)).toEqual({
      kind: "projectNotFound",
    });
    const patchResponse = await handleUpdateProject(
      new Request(`https://gantt.example.com/api/projects/${legacyId}`, {
        method: "PATCH",
        headers: {
          Origin: "https://gantt.example.com",
          "Content-Type": "application/json",
          Cookie: `__Host-mastergantt_edit=${token("A").rawToken}`,
          "If-Match": '"1"',
        },
        body: JSON.stringify({ name: "Must not write" }),
      }),
      legacyId,
      {
        service,
        applicationBaseUrl: "https://gantt.example.com",
        environment: "production",
        requestId: () => "request-id",
      },
    );
    const passwordResponse = await handleChangeEditPassword(
      new Request(`https://gantt.example.com/api/projects/${legacyId}/edit-password`, {
        method: "PUT",
        headers: {
          Origin: "https://gantt.example.com",
          "Content-Type": "application/json",
          Cookie: `__Host-mastergantt_edit=${token("A").rawToken}`,
          "If-Match": '"1"',
        },
        body: JSON.stringify({ newEditPassword: "new password phrase" }),
      }),
      legacyId,
      {
        service,
        applicationBaseUrl: "https://gantt.example.com",
        environment: "production",
        requestId: () => "request-id",
      },
    );

    expect(patchResponse.status).toBe(404);
    expect(passwordResponse.status).toBe(404);
    expect(hash).toHaveBeenCalledTimes(1);
    expect(db.prepare(
      `SELECT name, description, revision, auth_version, password_salt,
        (SELECT count(*) FROM edit_sessions) AS session_count
       FROM projects`,
    ).get()).toEqual(before);
  });

  it("performs final session validation before revision validation", async () => {
    const db = database();
    const service = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => publicIds[0],
      generateSessionToken: () => token("A"),
      hashPassword: async () => fixedPasswordHash(),
    });
    await service.create({ name: "Before", description: "", editPassword: "password phrase" });
    const auth = authorized(service.authorize(publicIds[0], token("A").rawToken));
    db.prepare("UPDATE edit_sessions SET revoked_at = ?").run("2026-09-11T01:00:00.000Z");
    db.prepare("UPDATE projects SET revision = 2").run();
    expect(() => service.updateMetadata(auth, 1, { name: "No" }))
      .toThrow(EditSessionInvalidError);
    expect(db.prepare("SELECT name FROM projects").pluck().get()).toBe("Before");
  });

  it("reads the final expiry clock after the immediate transaction lock", async () => {
    const db = database();
    const base = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => publicIds[0],
      generateSessionToken: () => token("A"),
      hashPassword: async () => fixedPasswordHash(),
    });
    await base.create({ name: "Before", description: "", editPassword: "password phrase" });
    const auth = authorized(base.authorize(publicIds[0], token("A").rawToken));
    const hash = vi.fn(async () => {
      expect(db.inTransaction).toBe(false);
      return fixedPasswordHash(8);
    });
    const racing = new ProjectService(db, {
      clock: () => db.inTransaction
        ? new Date("2026-09-11T09:00:00.000Z")
        : new Date("2026-09-11T08:59:59.999Z"),
      generateSessionToken: () => token("C"),
      hashPassword: hash,
    });

    expect(() => racing.updateMetadata(auth, 1, { name: "Must not write" }))
      .toThrow(EditSessionInvalidError);
    await expect(racing.rotatePassword(auth, 1, "new password phrase"))
      .rejects.toBeInstanceOf(EditSessionInvalidError);
    expect(hash).toHaveBeenCalledOnce();
    expect(db.prepare("SELECT name, revision, auth_version, password_salt FROM projects").get())
      .toEqual({
        name: "Before",
        revision: 1,
        auth_version: 1,
        password_salt: Buffer.alloc(16, 1),
      });
  });

  it("rotates password material, revision, auth version, all sessions, and caller token atomically", async () => {
    const db = database();
    const tokens = [token("A"), token("B"), token("C"), token("D")];
    const service = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => publicIds[0],
      generateSessionToken: () => tokens.shift() ?? token("Z"),
      hashPassword: async (value) => fixedPasswordHash(value === "new password phrase" ? 8 : 1),
      verifyPassword: async (candidate, record) =>
        (candidate === "password phrase" && record?.hash.equals(Buffer.alloc(32, 2))) ||
        (candidate === "new password phrase" && record?.hash.equals(Buffer.alloc(32, 9))) ||
        false,
    });
    await service.create({ name: "Project", description: "", editPassword: "password phrase" });
    await service.unlock(publicIds[0], "password phrase");
    const first = authorized(service.authorize(publicIds[0], token("A").rawToken));
    const rotated = await service.rotatePassword(first, 1, "new password phrase");

    expect(rotated).toEqual({ rawSessionToken: token("C").rawToken, revision: 2 });
    expect(service.authorize(publicIds[0], token("A").rawToken).kind).toBe("unauthorized");
    expect(service.authorize(publicIds[0], token("B").rawToken).kind).toBe("unauthorized");
    expect(service.authorize(publicIds[0], token("C").rawToken).kind).toBe("authorized");
    await expect(service.unlock(publicIds[0], "password phrase")).resolves.toBeUndefined();
    await expect(service.unlock(publicIds[0], "new password phrase")).resolves.toEqual({
      rawSessionToken: token("D").rawToken,
    });
    expect(db.prepare("SELECT auth_version, revision, password_salt FROM projects").get())
      .toEqual({ auth_version: 2, revision: 2, password_salt: Buffer.alloc(16, 8) });
  });

  it("rolls password rotation back when the new session insert fails", async () => {
    const db = database();
    const tokens = [token("A"), token("C")];
    const service = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => publicIds[0],
      generateSessionToken: () => tokens.shift() ?? token("Z"),
      hashPassword: async (value) => fixedPasswordHash(value.startsWith("new") ? 8 : 1),
    });
    await service.create({ name: "Project", description: "", editPassword: "password phrase" });
    const auth = authorized(service.authorize(publicIds[0], token("A").rawToken));
    db.exec(`CREATE TRIGGER reject_rotated_session BEFORE INSERT ON edit_sessions
      WHEN NEW.auth_version = 2 BEGIN SELECT RAISE(ABORT, 'fault'); END`);

    await expect(service.rotatePassword(auth, 1, "new password phrase")).rejects.toThrow();
    expect(db.prepare("SELECT auth_version, revision, password_salt FROM projects").get())
      .toEqual({ auth_version: 1, revision: 1, password_salt: Buffer.alloc(16, 1) });
    expect(service.authorize(publicIds[0], token("A").rawToken).kind).toBe("authorized");
  });

  it("rejects stale revisions before hashing and revalidates session first after hashing", async () => {
    const db = database();
    const base = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:00.000Z"),
      generatePublicId: () => publicIds[0],
      generateSessionToken: () => token("A"),
      hashPassword: async () => fixedPasswordHash(),
    });
    await base.create({ name: "Project", description: "", editPassword: "password phrase" });
    const hash = vi.fn(async () => {
      db.prepare("UPDATE edit_sessions SET revoked_at = ?").run("2026-09-11T01:00:00.000Z");
      db.prepare("UPDATE projects SET revision = revision + 1").run();
      return fixedPasswordHash(8);
    });
    const racing = new ProjectService(db, {
      clock: () => new Date("2026-09-11T01:00:01.000Z"),
      generateSessionToken: () => token("C"),
      hashPassword: hash,
    });
    const auth = authorized(racing.authorize(publicIds[0], token("A").rawToken));

    await expect(racing.rotatePassword(auth, 2, "new password phrase"))
      .rejects.toBeInstanceOf(RevisionMismatchError);
    expect(hash).not.toHaveBeenCalled();
    await expect(racing.rotatePassword(auth, 1, "new password phrase"))
      .rejects.toBeInstanceOf(EditSessionInvalidError);
    expect(db.prepare("SELECT auth_version, password_salt FROM projects").get())
      .toEqual({ auth_version: 1, password_salt: Buffer.alloc(16, 1) });
  });
});
