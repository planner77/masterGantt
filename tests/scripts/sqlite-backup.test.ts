import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../../src/server/db/migrations";
import { createBackupKey, createEncryptedBackup, inspectSqliteSnapshot, readImageMigrationInventory, restoreEncryptedBackup, verifyEncryptedBackup } from "../../scripts/sqlite-backup-core.mjs";
import type { BackupManifest, VerifyBackupOptions } from "../../scripts/sqlite-backup-core.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const roots: string[] = [], connections: Database.Database[] = [];
const sourceSha = "a".repeat(40), imageDigest = "sha256:" + "b".repeat(64), stamp = Date.parse("2026-11-11T12:00:00Z");
const sensitive = "SYNTHETIC_PRIVATE_CONTENT_NEVER_STDOUT";
afterEach(() => { connections.splice(0).forEach((db) => { if (db.open) db.close(); }); roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "mastergantt-sqlite-recovery-test-")); roots.push(root);
  const projectRoot = join(root, "project"); mkdirSync(projectRoot);
  expect(spawnSync("git", ["init", projectRoot], { encoding: "utf8" }).status).toBe(0);
  writeFileSync(join(projectRoot, ".gitignore"), "backups/\n"); writeFileSync(join(projectRoot, ".dockerignore"), "backups\n");
  const migrations = join(root, "image-sql"); mkdirSync(migrations, { mode: 0o700 });
  writeFileSync(join(migrations, "0001_base.sql"), `CREATE TABLE projects(id INTEGER PRIMARY KEY,name TEXT NOT NULL,optional TEXT,payload BLOB,big INTEGER); CREATE TABLE tasks(id INTEGER PRIMARY KEY,project_id INTEGER NOT NULL REFERENCES projects(id),name TEXT NOT NULL);`);
  const source = join(root, "source.sqlite3"); const db = new Database(source); connections.push(db); db.pragma("journal_mode=WAL"); db.pragma("foreign_keys=ON"); runMigrations(db, migrations);
  db.exec(`INSERT INTO projects VALUES(1,'${sensitive}',NULL,x'0001ff',9223372036854775806); INSERT INTO tasks VALUES(1,1,'synthetic task');`);
  const { keyFile } = createBackupKey(join(root, "keys"));
  const backupRoot = join(projectRoot, "backups", "mastergantt", "synthetic-backup-001");
  const create = () => createEncryptedBackup({ projectRoot, source, root: backupRoot, keyFile, sourceSha, imageDigest, backupId: "synthetic-backup-001", imageMigrationsDirectory: migrations, now: stamp });
  const options = (extra: Partial<VerifyBackupOptions> = {}) => ({ backupRoot, keyFile, expectedSourceSha: sourceSha, expectedImageDigest: imageDigest, expectedBackupId: "synthetic-backup-001", imageMigrationsDirectory: migrations, maxAgeMs: 1000, now: stamp + 1, ...extra });
  return { root, projectRoot, migrations, source, db, keyFile, backupRoot, create, options };
}
function manifest(f: ReturnType<typeof fixture>): BackupManifest { return JSON.parse(readFileSync(join(f.backupRoot, "manifest.json"), "utf8")); }
function saveManifest(f: ReturnType<typeof fixture>, value: BackupManifest) { writeFileSync(join(f.backupRoot, "manifest.json"), JSON.stringify(value), { mode: 0o600 }); }
function checksum(file: string) { return createHash("sha256").update(readFileSync(file)).digest("hex"); }

describe("#912 — real SQLite Online Backup, encryption and isolated restoration", () => {
  it("backs up an active WAL read-only, restores to a fresh root and survives reopen with NULL/BLOB/large INTEGER intact", async () => {
    const f = fixture(); expect(statSync(f.source + "-wal").size).toBeGreaterThan(0);
    const mainBefore = checksum(f.source); const stateBefore = inspectSqliteSnapshot(f.source);
    const encrypted = await f.create(); expect(checksum(f.source)).toBe(mainBefore); expect(inspectSqliteSnapshot(f.source).dataSha256).toBe(stateBefore.dataSha256);
    expect(encrypted.manifest.sourceJournalMode).toBe("wal");
    expect(readFileSync(join(f.backupRoot, "snapshot.sqlite3.aesgcm")).includes(Buffer.from(sensitive))).toBe(false);
    expect(readdirSync(f.backupRoot).some((name) => /\.sqlite3(?:-wal|-shm)?$/.test(name))).toBe(false);
    const restored = await restoreEncryptedBackup({ ...f.options(), root: join(f.root, "restored") });
    expect(restored.database.dataSha256).toBe(stateBefore.dataSha256); expect(restored.imageCompatibility.runtimeImageVerified).toBe(false); expect(restored.receipt.offHostVerified).toBe(false);
    const reopened = new Database(restored.databasePath); connections.push(reopened);
    const row = reopened.prepare("SELECT optional,payload,big FROM projects WHERE id=1").safeIntegers(true).get() as { optional: null; payload: Buffer; big: bigint };
    expect(row).toEqual({ optional: null, payload: Buffer.from([0, 1, 255]), big: BigInt("9223372036854775806") });
    reopened.prepare("INSERT INTO tasks VALUES(2,1,'restored write')").run(); reopened.close();
    const again = new Database(restored.databasePath); connections.push(again); expect(again.prepare("SELECT COUNT(*) FROM tasks").pluck().get()).toBe(2);
    expect(f.db.prepare("SELECT COUNT(*) FROM tasks").pluck().get()).toBe(1);
  });
  it("creates 0700 roots and 0600 encrypted/key/manifest/restored files while keeping key outside both payload and restore root", async () => {
    const f = fixture(); await f.create(); const r = await restoreEncryptedBackup({ ...f.options(), root: join(f.root, "restored") });
    for (const path of [f.backupRoot, dirname(f.keyFile), r.root]) expect(statSync(path).mode & 0o777).toBe(0o700);
    for (const path of [f.keyFile, join(f.backupRoot, "manifest.json"), join(f.backupRoot, "snapshot.sqlite3.aesgcm"), r.databasePath, join(r.root, "restore-receipt.json")]) expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readdirSync(f.backupRoot)).not.toContain("backup.key");
  });
  it("captures an atomic committed WAL update without changing source rows or checkpointing the source database", async () => {
    const f = fixture(); f.db.exec("CREATE TABLE pairs(id INTEGER PRIMARY KEY,value INTEGER NOT NULL); INSERT INTO pairs VALUES(1,0),(2,0)");
    const before = checksum(f.source); const pending = f.create(); f.db.transaction(() => f.db.prepare("UPDATE pairs SET value=7").run())(); await pending;
    const r = await restoreEncryptedBackup({ ...f.options(), root: join(f.root, "restore-concurrent") }); const db = new Database(r.databasePath); connections.push(db);
    const values = db.prepare("SELECT value FROM pairs ORDER BY id").pluck().all(); expect(values[0]).toBe(values[1]); expect([0, 7]).toContain(values[0]); expect(checksum(f.source)).toBe(before);
  });
  it("rejects missing backups, ciphertext loss/corruption and wrong keys without leaving a restore destination", async () => {
    const f = fixture(); await expect(verifyEncryptedBackup(f.options())).rejects.toThrow("PATH_MISSING"); await f.create();
    const cipher = join(f.backupRoot, "snapshot.sqlite3.aesgcm"), bytes = readFileSync(cipher); rmSync(cipher);
    await expect(verifyEncryptedBackup(f.options())).rejects.toThrow("PATH_MISSING"); writeFileSync(cipher, bytes, { mode: 0o600 });
    const damaged = Buffer.from(bytes); damaged[40] ^= 1; writeFileSync(cipher, damaged); await expect(verifyEncryptedBackup(f.options())).rejects.toThrow("CIPHERTEXT_HASH_MISMATCH"); writeFileSync(cipher, bytes);
    const { keyFile } = createBackupKey(join(f.root, "wrong-keys")); const output = join(f.root, "never-restore");
    await expect(restoreEncryptedBackup({ ...f.options({ keyFile }), root: output })).rejects.toThrow("BACKUP_AUTHENTICATION_FAILED"); expect(existsSync(output)).toBe(false);
  });
  it("authenticates manifest metadata so a caller cannot re-label source/image/backup or recency while keeping the ciphertext", async () => {
    const f = fixture(); await f.create(); const original = manifest(f);
    const changed = structuredClone(original); changed.backupId = "forged-but-syntactically-valid"; saveManifest(f, changed);
    await expect(verifyEncryptedBackup(f.options({ expectedBackupId: changed.backupId }))).rejects.toThrow("BACKUP_AUTHENTICATION_FAILED");
    saveManifest(f, original); const changedSource = structuredClone(original); changedSource.source.sha = "c".repeat(40); saveManifest(f, changedSource);
    await expect(verifyEncryptedBackup(f.options({ expectedSourceSha: changedSource.source.sha }))).rejects.toThrow("BACKUP_AUTHENTICATION_FAILED");
  });
  it("fails closed on stale/future backups, absent age policy and wrong captured source/image/backup binding", async () => {
    const f = fixture(); await f.create();
    await expect(verifyEncryptedBackup(f.options({ now: stamp + 1001 }))).rejects.toThrow("BACKUP_STALE_OR_FUTURE");
    await expect(verifyEncryptedBackup(f.options({ now: stamp - 1 }))).rejects.toThrow("BACKUP_STALE_OR_FUTURE");
    await expect(verifyEncryptedBackup(f.options({ maxAgeMs: 0 }))).rejects.toThrow("MAX_AGE_REQUIRED");
    for (const extra of [{ expectedSourceSha: "c".repeat(40) }, { expectedImageDigest: "sha256:" + "d".repeat(64) }, { expectedBackupId: "wrong" }]) await expect(verifyEncryptedBackup(f.options(extra))).rejects.toThrow("BACKUP_IMAGE_BINDING_MISMATCH");
  });
  it("rejects old image SQL or changed checksums before restoring and distinguishes pending target migrations from runtime verification", async () => {
    const f = fixture(); await f.create(); const empty = join(f.root, "empty-old-image"); mkdirSync(empty);
    await expect(verifyEncryptedBackup(f.options({ imageMigrationsDirectory: empty }))).rejects.toThrow("IMAGE_MIGRATIONS_EMPTY");
    const changed = join(f.root, "changed-image"); mkdirSync(changed); copyFileSync(join(f.migrations, "0001_base.sql"), join(changed, "0001_base.sql")); writeFileSync(join(changed, "0001_base.sql"), "-- changed\n", { flag: "a" });
    await expect(verifyEncryptedBackup(f.options({ imageMigrationsDirectory: changed }))).rejects.toThrow("IMAGE_MIGRATION_CHECKSUM_MISMATCH");
    writeFileSync(join(f.migrations, "0002_new.sql"), "CREATE TABLE compatible_future(id INTEGER PRIMARY KEY);");
    const verified = await verifyEncryptedBackup(f.options()); expect(verified.imageCompatibility).toEqual({ status: "SQL_PREFIX_VERIFIED", pendingMigrationCount: 1, runtimeImageVerified: false });
  });
  it("uses the existing migration engine to roll back a late failed upgrade on the restored copy and keeps the backup/source unchanged", async () => {
    const f = fixture(); await f.create(); const backupHash = checksum(join(f.backupRoot, "snapshot.sqlite3.aesgcm")); const original = inspectSqliteSnapshot(f.source);
    const r = await restoreEncryptedBackup({ ...f.options(), root: join(f.root, "migration-copy") });
    writeFileSync(join(f.migrations, "0002_partial.sql"), "CREATE TABLE must_rollback(id INTEGER PRIMARY KEY); INSERT INTO projects VALUES(2,'temporary',NULL,NULL,NULL);");
    writeFileSync(join(f.migrations, "0003_fail.sql"), "INSERT INTO no_such_table VALUES(1);");
    const db = new Database(r.databasePath); connections.push(db); db.pragma("foreign_keys=ON"); expect(() => runMigrations(db, f.migrations)).toThrow(/rolled back/); db.close();
    expect(inspectSqliteSnapshot(r.databasePath).dataSha256).toBe(original.dataSha256); expect(inspectSqliteSnapshot(r.databasePath).ledgerSha256).toBe(original.ledgerSha256);
    expect(inspectSqliteSnapshot(f.source).dataSha256).toBe(original.dataSha256); expect(checksum(join(f.backupRoot, "snapshot.sqlite3.aesgcm"))).toBe(backupHash);
  });
  it("rejects an older image against a newer DB ledger and never treats a code rollback as a schema rollback", async () => {
    const f = fixture(); const old = join(f.root, "old-image"); mkdirSync(old); copyFileSync(join(f.migrations, "0001_base.sql"), join(old, "0001_base.sql"));
    writeFileSync(join(f.migrations, "0002_upgrade.sql"), "CREATE TABLE newer_data(id INTEGER PRIMARY KEY);"); runMigrations(f.db, f.migrations); await f.create();
    await expect(verifyEncryptedBackup(f.options({ imageMigrationsDirectory: old }))).rejects.toThrow("IMAGE_SCHEMA_TOO_OLD");
    expect(f.db.prepare("SELECT MAX(version) FROM schema_migrations").pluck().get()).toBe(2);
  });
  it("rejects existing output, operating/repository paths, source/key/cipher symlinks and loose key permissions", async () => {
    const f = fixture(); await f.create(); const existing = join(f.root, "existing"); mkdirSync(existing); writeFileSync(join(existing, "untouched.txt"), "keep");
    await expect(restoreEncryptedBackup({ ...f.options(), root: existing })).rejects.toThrow("DESTINATION_EXISTS"); expect(readFileSync(join(existing, "untouched.txt"), "utf8")).toBe("keep");
    await expect(restoreEncryptedBackup({ ...f.options(), root: "/data/never-operating-restore" })).rejects.toThrow("OPERATING_DESTINATION_REFUSED");
    const sourceLink = join(f.root, "linked.sqlite3"); symlinkSync(f.source, sourceLink);
    await expect(createEncryptedBackup({ projectRoot: f.projectRoot, source: sourceLink, root: join(f.root, "unsafe"), keyFile: f.keyFile, sourceSha, imageDigest, backupId: "synthetic", imageMigrationsDirectory: f.migrations })).rejects.toThrow("SYMLINK_REFUSED");
    chmodSync(f.keyFile, 0o644); await expect(verifyEncryptedBackup(f.options())).rejects.toThrow("PRIVATE_MODE_REQUIRED"); chmodSync(f.keyFile, 0o600);
    const cipher = join(f.backupRoot, "snapshot.sqlite3.aesgcm"); rmSync(cipher); symlinkSync(f.source, cipher); await expect(verifyEncryptedBackup(f.options())).rejects.toThrow("SYMLINK_REFUSED");
  });
  it("does not colocate keys or arbitrary plaintext in the encrypted bundle", async () => {
    const f = fixture(); await f.create(); copyFileSync(f.keyFile, join(f.backupRoot, "backup.key")); chmodSync(join(f.backupRoot, "backup.key"), 0o600);
    await expect(verifyEncryptedBackup(f.options())).rejects.toThrow("BACKUP_BUNDLE_UNEXPECTED_FILE");
  });
  it("allows only the approved primary-project encrypted prefix and rejects Git/Docker exceptions or symlinked parents", async () => {
    const f = fixture();
    const config = { projectRoot: f.projectRoot, source: f.source, root: f.backupRoot, keyFile: f.keyFile, sourceSha, imageDigest, backupId: "synthetic-backup-001", imageMigrationsDirectory: f.migrations, now: stamp };
    await expect(createEncryptedBackup({ ...config, root: join(f.root, "unapproved") })).rejects.toThrow("BACKUP_DESTINATION_REQUIRED");
    writeFileSync(join(f.projectRoot, ".gitignore"), "backups/\n!backups/\n");
    await expect(createEncryptedBackup(config)).rejects.toThrow("BACKUP_GIT_IGNORE_REQUIRED");
    writeFileSync(join(f.projectRoot, ".gitignore"), "backups/\n"); writeFileSync(join(f.projectRoot, ".dockerignore"), "backups\n!backups/manifest.json\n");
    await expect(createEncryptedBackup(config)).rejects.toThrow("BACKUP_DOCKER_IGNORE_REQUIRED");
    writeFileSync(join(f.projectRoot, ".dockerignore"), "backups\n"); symlinkSync(f.root, join(f.projectRoot, "backups"));
    await expect(createEncryptedBackup(config)).rejects.toThrow("SYMLINK_REFUSED");
    expect(existsSync(f.backupRoot)).toBe(false);
  });
  it("refuses key and plaintext destinations in the original project or any Git worktree including ignored paths", async () => {
    const f = fixture(); await f.create();
    expect(() => createBackupKey(join(f.projectRoot, "new-key"))).toThrow("GIT_DESTINATION_REFUSED");
    await expect(restoreEncryptedBackup({ ...f.options(), root: join(f.projectRoot, "backups", "restore-plaintext") })).rejects.toThrow("GIT_DESTINATION_REFUSED");
    expect(() => createBackupKey(join(repository, ".prepr-reports", "should-never-be-created-912"))).toThrow("GIT_DESTINATION_REFUSED");
    mkdirSync(join(f.projectRoot, "bad-key"), { mode: 0o700 }); copyFileSync(f.keyFile, join(f.projectRoot, "bad-key", "key")); chmodSync(join(f.projectRoot, "bad-key", "key"), 0o600);
    await expect(verifyEncryptedBackup(f.options({ keyFile: join(f.projectRoot, "bad-key", "key") }))).rejects.toThrow("GIT_DESTINATION_REFUSED");
  });
  it("roundtrips quoted identifiers and WITHOUT ROWID keys deterministically and prints a successful sanitized CLI receipt", async () => {
    const f = fixture(); f.db.exec(`CREATE TABLE "odd""table"("part a" TEXT, "part b" INTEGER, payload BLOB, PRIMARY KEY("part a","part b")) WITHOUT ROWID; INSERT INTO "odd""table" VALUES('z',2,x'ff'),('a',1,NULL)`);
    const config = { projectRoot: f.projectRoot, source: f.source, root: f.backupRoot, keyFile: f.keyFile, sourceSha, imageDigest, backupId: "synthetic-backup-001", imageMigrationsDirectory: f.migrations, now: Date.now() };
    await createEncryptedBackup(config); const before = inspectSqliteSnapshot(f.source);
    const r = await restoreEncryptedBackup({ ...f.options({ now: Date.now() }), root: join(f.root, "quoted-restore") }); expect(r.database.dataSha256).toBe(before.dataSha256);
    const result = spawnSync(process.execPath, [resolve(repository, "scripts/verify-sqlite-recovery.mjs"), "verify", `--backup-root=${f.backupRoot}`, `--key-file=${f.keyFile}`, `--expected-source-sha=${sourceSha}`, `--expected-image-digest=${imageDigest}`, "--max-age-ms=60000"], { encoding: "utf8" });
    expect(result.status).toBe(0); expect(JSON.parse(result.stdout)).toMatchObject({ status: "PASS", offHostVerified: false, runtimeImageVerified: false });
    expect(result.stdout).not.toContain(sensitive); expect(result.stdout).not.toContain(f.root); expect(result.stdout).not.toContain("dataSha256");
  });
  it("executes keygen, encrypted backup, verify and fresh restore through the real CLI without exposing private artifacts", () => {
    const f = fixture(), cli = resolve(repository, "scripts/verify-sqlite-recovery.mjs"), keyRoot = join(f.root, "cli-key"), keyFile = join(keyRoot, "backup.key"), backupId = "cli-synthetic-backup", backupRoot = join(f.projectRoot, "backups", "mastergantt", backupId), restoreRoot = join(f.root, "cli-restored");
    const invoke = (args: string[]) => {
      const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
      expect(r.stderr).toBe(""); expect(r.status).toBe(0); expect(JSON.parse(r.stdout).status).toBe("PASS"); expect(r.stdout).not.toContain(f.root); expect(r.stdout).not.toContain(sensitive);
      return JSON.parse(r.stdout);
    };
    invoke(["keygen", `--root=${keyRoot}`]);
    invoke(["backup", `--project-root=${f.projectRoot}`, `--source=${f.source}`, `--root=${backupRoot}`, `--key-file=${keyFile}`, `--source-sha=${sourceSha}`, `--image-digest=${imageDigest}`, `--backup-id=${backupId}`, `--image-migrations=${f.migrations}`]);
    const common = [`--backup-root=${backupRoot}`, `--key-file=${keyFile}`, `--expected-source-sha=${sourceSha}`, `--expected-image-digest=${imageDigest}`, `--backup-id=${backupId}`, `--max-age-ms=60000`, `--image-migrations=${f.migrations}`];
    invoke(["verify", ...common]); expect(invoke(["restore", ...common, `--root=${restoreRoot}`]).offHostVerified).toBe(false);
    expect(inspectSqliteSnapshot(join(restoreRoot, "restored.sqlite3")).dataSha256).toBe(inspectSqliteSnapshot(f.source).dataSha256);
  });
  it("exposes only sanitized CLI summaries, requires explicit key-file/policy and never prints data or secret input on errors", async () => {
    const f = fixture(); await f.create(); const cli = resolve(repository, "scripts/verify-sqlite-recovery.mjs");
    const r = spawnSync(process.execPath, [cli, "verify", `--backup-root=${f.backupRoot}`, `--key-file=${f.keyFile}`, `--expected-source-sha=${sourceSha}`, `--expected-image-digest=${imageDigest}`, `--image-migrations=${f.migrations}`, "--max-age-ms=1000"], { encoding: "utf8" });
    // The non-current fixture clock must not pass the CLI recency policy.
    expect(r.status).toBe(1); expect(r.stderr).toContain("BACKUP_STALE_OR_FUTURE"); expect(r.stderr).not.toContain(sensitive); expect(r.stderr).not.toContain(f.root);
    const unknown = spawnSync(process.execPath, [cli, "verify", `--password=${sensitive}`], { encoding: "utf8" }); expect(unknown.status).toBe(1); expect(unknown.stderr).not.toContain(sensitive);
    expect(readImageMigrationInventory(f.migrations)).toHaveLength(1);
  });
});
