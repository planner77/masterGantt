import Database from "better-sqlite3";
import { spawnSync } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { appendFileSync, chmodSync, closeSync, constants, createReadStream, createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("MGSQL001");
const CIPHER_FILE = "snapshot.sqlite3.aesgcm";
const MANIFEST_FILE = "manifest.json";
const MARKER_FILE = ".mastergantt-recovery-owned.json";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const validSha = (s) => typeof s === "string" && /^[a-f0-9]{40}$/.test(s);
const validDigest = (s) => typeof s === "string" && /^sha256:[a-f0-9]{64}$/.test(s);
const validHash = (s) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
const stable = (value) => JSON.stringify(value, (_key, v) => v && typeof v === "object" && !Array.isArray(v) && !Buffer.isBuffer(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
const within = (root, target) => { const r = relative(root, target); return r === "" || (r !== ".." && !r.startsWith(".." + sep) && !isAbsolute(r)); };

export class RecoveryError extends Error {
  constructor(code) { super(code); this.name = "RecoveryError"; this.code = code; }
}
function demand(ok, code) { if (!ok) throw new RecoveryError(code); }
function protectedStat(path, kind = "file", privateMode = false) {
  const absolute = resolve(path);
  demand(!absolute.split(sep).some((part) => part === ".env" || part.startsWith(".env.")), "ENV_PATH_REFUSED");
  let current = absolute.startsWith(sep) ? sep : "";
  for (const part of absolute.split(sep).filter(Boolean)) {
    current = join(current, part);
    demand(existsSync(current), "PATH_MISSING");
    demand(!lstatSync(current).isSymbolicLink(), "SYMLINK_REFUSED");
  }
  const stat = lstatSync(absolute);
  demand(kind === "file" ? stat.isFile() : stat.isDirectory(), "PATH_KIND_REFUSED");
  demand(realpathSync(absolute) === absolute, "PATH_REALPATH_MISMATCH");
  if (privateMode) {
    demand(typeof process.getuid === "function" && stat.uid === process.getuid(), "PRIVATE_OWNER_REQUIRED");
    demand((stat.mode & 0o077) === 0, "PRIVATE_MODE_REQUIRED");
  }
  return { absolute, stat };
}
function git(directory, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
  return spawnSync("git", ["-C", directory, ...args], { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
}
function outsideGit(path) {
  let existing = resolve(path);
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  protectedStat(existing, "directory");
  for (let ancestor = existing; ; ancestor = dirname(ancestor)) {
    demand(!existsSync(join(ancestor, ".git")), "GIT_DESTINATION_REFUSED");
    if (dirname(ancestor) === ancestor) break;
  }
  demand(git(existing, ["rev-parse", "--show-toplevel"]).status === 128, "GIT_DESTINATION_REFUSED");
}
function privateRoot(root, encryptedProjectRoot) {
  const full = resolve(root);
  demand(!full.split(sep).some((part) => part === ".env" || part.startsWith(".env.")), "ENV_PATH_REFUSED");
  demand(full !== dirname(full) && !within("/data", full), "OPERATING_DESTINATION_REFUSED");
  if (!encryptedProjectRoot) outsideGit(dirname(full));
  demand(!existsSync(full), "DESTINATION_EXISTS");
  protectedStat(dirname(full), "directory");
  mkdirSync(full, { mode: 0o700 });
  protectedStat(full, "directory", true);
  const nonce = randomBytes(16).toString("hex");
  writeFileSync(join(full, MARKER_FILE), stable({ tool: "mastergantt-sqlite-recovery", nonce }) + "\n", { flag: "wx", mode: 0o600 });
  return { full, nonce };
}
function backupDestination(projectRoot, root, backupId) {
  demand(typeof projectRoot === "string", "PROJECT_ROOT_REQUIRED");
  const project = protectedStat(projectRoot, "directory").absolute;
  // Only the primary checkout owns retained backups; linked/temporary worktrees do not.
  demand(lstatSync(join(project, ".git")).isDirectory(), "PRIMARY_PROJECT_REQUIRED");
  const top = git(project, ["rev-parse", "--show-toplevel"]);
  demand(top.status === 0 && top.stdout.trim() === project, "PROJECT_GIT_ROOT_REQUIRED");
  const full = resolve(root), expected = join(project, "backups", "mastergantt", backupId);
  demand(full === expected, "BACKUP_DESTINATION_REQUIRED");
  for (const path of [join(project, "backups"), dirname(full)]) if (existsSync(path)) protectedStat(path, "directory");
  for (const candidate of [full, join(full, CIPHER_FILE), join(full, MANIFEST_FILE), join(full, MARKER_FILE)]) demand(git(project, ["check-ignore", "--quiet", "--no-index", "--", relative(project, candidate)]).status === 0, "BACKUP_GIT_IGNORE_REQUIRED");
  protectedStat(join(project, ".dockerignore"));
  const rules = readFileSync(join(project, ".dockerignore"), "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  // Existing repository contract uses a literal backups rule. Refuse exception rules rather than interpreting a second ignore language.
  demand(rules.some((line) => line === "backups" || line === "backups/") && !rules.some((line) => line.startsWith("!")), "BACKUP_DOCKER_IGNORE_REQUIRED");
  for (const path of [join(project, "backups"), dirname(full)]) {
    if (!existsSync(path)) mkdirSync(path, { mode: 0o700 });
    protectedStat(path, "directory", path === dirname(full));
  }
  return project;
}
function removeOwned(root) {
  if (!existsSync(root.full)) return;
  protectedStat(root.full, "directory", true);
  const marker = JSON.parse(readFileSync(join(root.full, MARKER_FILE), "utf8"));
  demand(marker.nonce === root.nonce && marker.tool === "mastergantt-sqlite-recovery", "OWNED_CLEANUP_REFUSED");
  rmSync(root.full, { recursive: true, force: false });
}
function keyBytes(path, excludedRoot) {
  const { absolute, stat } = protectedStat(path, "file", true);
  protectedStat(dirname(absolute), "directory", true);
  outsideGit(dirname(absolute));
  demand(stat.size === 32, "KEY_SIZE_REQUIRED");
  demand(!within(resolve(excludedRoot), absolute), "KEY_SEPARATION_REQUIRED");
  return readFileSync(absolute);
}
async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}
function readLedger(db) {
  demand(Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='schema_migrations'").get()), "MIGRATION_LEDGER_MISSING");
  const ledger = db.prepare("SELECT version,name,checksum FROM schema_migrations ORDER BY version").all();
  demand(ledger.length > 0, "MIGRATION_LEDGER_EMPTY");
  ledger.forEach((entry, index) => demand(entry.version === index + 1 && typeof entry.name === "string" && new RegExp(`^${String(entry.version).padStart(4, "0")}_`).test(entry.name) && validHash(entry.checksum), "MIGRATION_LEDGER_INVALID"));
  return ledger;
}
function rowValue(value) {
  if (value === null) return ["null"];
  if (typeof value === "bigint") return ["integer", value.toString()];
  if (Buffer.isBuffer(value)) return ["blob", value.toString("base64")];
  return [typeof value, value];
}
export function inspectSqliteSnapshot(filename) {
  protectedStat(filename);
  const db = new Database(resolve(filename), { readonly: true, fileMustExist: true });
  try {
    db.pragma("query_only=ON"); db.pragma("foreign_keys=ON");
    demand(db.pragma("integrity_check", { simple: true }) === "ok", "SQLITE_INTEGRITY_FAILED");
    demand(db.pragma("foreign_key_check").length === 0, "SQLITE_FOREIGN_KEYS_FAILED");
    const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const tables = schema.filter((item) => item.type === "table");
    const data = createHash("sha256");
    for (const table of tables) {
      const columns = db.prepare(`PRAGMA table_xinfo(${quote(table.name)})`).all();
      const pk = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk).map((column) => column.name);
      const rowid = ["_rowid_", "rowid", "oid"].find((candidate) => !columns.some((column) => column.name === candidate));
      const useRowid = !pk.length && !/WITHOUT\s+ROWID/i.test(table.sql ?? "") && rowid;
      const order = pk.length ? pk.map(quote).join(",") : useRowid ? quote(rowid) : columns.filter((column) => column.hidden !== 1).map((column) => quote(column.name)).join(",");
      data.update(stable(["table", table.name, columns]));
      const statement = db.prepare(`SELECT ${useRowid ? quote(rowid) + "," : ""}* FROM ${quote(table.name)} ORDER BY ${order}`).raw(true).safeIntegers(true);
      for (const row of statement.iterate()) data.update(stable(row.map(rowValue)));
    }
    const ledger = readLedger(db);
    return { sqliteVersion: db.prepare("SELECT sqlite_version()").pluck().get(), userVersion: db.pragma("user_version", { simple: true }), journalMode: db.pragma("journal_mode", { simple: true }), schemaSha256: sha(stable(schema)), dataSha256: data.digest("hex"), ledger, ledgerSha256: sha(stable(ledger)), tableCount: tables.length };
  } catch (error) { if (error instanceof RecoveryError) throw error; throw new RecoveryError("SQLITE_SNAPSHOT_UNREADABLE"); }
  finally { db.close(); }
}
export function readImageMigrationInventory(directory) {
  const { absolute } = protectedStat(directory, "directory");
  const rows = readdirSync(absolute).filter((name) => name.endsWith(".sql")).sort().map((name) => {
    const match = /^(\d{4,})_[a-z0-9_]+\.sql$/.exec(name);
    demand(match, "IMAGE_MIGRATION_FILENAME_INVALID"); protectedStat(join(absolute, name));
    return { version: Number(match[1]), name, checksum: sha(readFileSync(join(absolute, name))) };
  });
  demand(rows.length > 0, "IMAGE_MIGRATIONS_EMPTY");
  rows.forEach((row, i) => demand(row.version === i + 1, "IMAGE_MIGRATION_SEQUENCE_INVALID"));
  return rows;
}
function compatibleInventory(ledger, files) {
  demand(files.length >= ledger.length, "IMAGE_SCHEMA_TOO_OLD");
  ledger.forEach((row, i) => demand(stable(row) === stable(files[i]), "IMAGE_MIGRATION_CHECKSUM_MISMATCH"));
  return { status: "SQL_PREFIX_VERIFIED", pendingMigrationCount: files.length - ledger.length, runtimeImageVerified: false };
}
export function assertImageMigrationCompatibility(ledger, imageMigrationsDirectory) {
  return compatibleInventory(ledger, readImageMigrationInventory(imageMigrationsDirectory));
}
function identity(manifest) {
  const result = structuredClone(manifest);
  delete result.archive.encryptedSha256;
  return Buffer.from(stable(result));
}
function validManifest(manifest) {
  demand(manifest?.schemaVersion === 1 && manifest.tool === "mastergantt-sqlite-recovery", "MANIFEST_SCHEMA_INVALID");
  demand(typeof manifest.backupId === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(manifest.backupId), "BACKUP_ID_INVALID");
  demand(validSha(manifest.source?.sha) && validDigest(manifest.source?.imageDigest) && validHash(manifest.source?.sqlInventorySha256), "MANIFEST_IMAGE_BINDING_INVALID");
  demand(Number.isFinite(Date.parse(manifest.createdAt)), "MANIFEST_TIME_INVALID");
  demand(manifest.archive?.file === CIPHER_FILE && manifest.archive.cipher === "AES-256-GCM" && validHash(manifest.archive.plaintextSha256) && validHash(manifest.archive.encryptedSha256), "MANIFEST_ARCHIVE_INVALID");
  demand(validHash(manifest.database?.schemaSha256) && validHash(manifest.database.dataSha256) && validHash(manifest.database.ledgerSha256) && Array.isArray(manifest.database.ledger), "MANIFEST_DATABASE_INVALID");
}
async function encrypt(snapshot, output, key, manifest) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv); cipher.setAAD(identity(manifest));
  const stream = createWriteStream(output, { flags: "wx", mode: 0o600 }); stream.write(Buffer.concat([MAGIC, iv]));
  await pipeline(createReadStream(snapshot), cipher, stream); appendFileSync(output, cipher.getAuthTag());
}
async function decrypt(input, output, key, manifest) {
  const { stat } = protectedStat(input, "file", true); demand(stat.size > MAGIC.length + 12 + 16, "CIPHERTEXT_TRUNCATED");
  const fd = openSync(input, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let header, tag;
  try { header = Buffer.alloc(MAGIC.length + 12); tag = Buffer.alloc(16); const { readSync } = await import("node:fs"); readSync(fd, header, 0, header.length, 0); readSync(fd, tag, 0, 16, stat.size - 16); }
  finally { closeSync(fd); }
  demand(header.subarray(0, MAGIC.length).equals(MAGIC), "CIPHERTEXT_FORMAT_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(MAGIC.length)); decipher.setAAD(identity(manifest)); decipher.setAuthTag(tag);
  try { await pipeline(createReadStream(input, { start: header.length, end: stat.size - 17 }), decipher, createWriteStream(output, { flags: "wx", mode: 0o600 })); }
  catch { throw new RecoveryError("BACKUP_AUTHENTICATION_FAILED"); }
}
function manifestAt(root) {
  const { absolute } = protectedStat(root, "directory", true);
  demand(readdirSync(absolute).every((name) => [MANIFEST_FILE, CIPHER_FILE, MARKER_FILE].includes(name)), "BACKUP_BUNDLE_UNEXPECTED_FILE");
  protectedStat(join(absolute, MANIFEST_FILE), "file", true);
  let manifest; try { manifest = JSON.parse(readFileSync(join(absolute, MANIFEST_FILE), "utf8")); } catch { throw new RecoveryError("MANIFEST_UNREADABLE"); }
  validManifest(manifest);
  return { root: absolute, manifest };
}
export function createBackupKey(root) {
  const owned = privateRoot(root);
  try { const keyFile = join(owned.full, "backup.key"); writeFileSync(keyFile, randomBytes(32), { flag: "wx", mode: 0o600 }); return { keyFile }; }
  catch (error) { removeOwned(owned); throw error; }
}
export async function createEncryptedBackup({ source, root, keyFile, sourceSha, imageDigest, backupId, imageMigrationsDirectory, projectRoot, now = Date.now() }) {
  demand(validSha(sourceSha) && validDigest(imageDigest), "SOURCE_IMAGE_BINDING_REQUIRED");
  demand(typeof backupId === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(backupId), "BACKUP_ID_INVALID");
  const sourcePath = protectedStat(source).absolute; const key = keyBytes(keyFile, root);
  const project = backupDestination(projectRoot, root, backupId);
  const owned = privateRoot(root, project);
  const scratchParent = mkdtempSync(join(tmpdir(), "mastergantt-backup-parent-"));
  const scratch = privateRoot(join(scratchParent, "snapshot"));
  const snapshot = join(scratch.full, "snapshot.sqlite3"); let db;
  try {
    db = new Database(sourcePath, { readonly: true, fileMustExist: true }); db.pragma("query_only=ON");
    const sourceJournalMode = db.pragma("journal_mode", { simple: true });
    await db.backup(snapshot); db.close(); db = null; chmodSync(snapshot, 0o600);
    const database = inspectSqliteSnapshot(snapshot);
    demand(imageMigrationsDirectory, "CAPTURED_IMAGE_SQL_REQUIRED");
    const capturedInventory = readImageMigrationInventory(imageMigrationsDirectory);
    const capturedSql = compatibleInventory(database.ledger, capturedInventory);
    demand(capturedSql.pendingMigrationCount === 0, "CAPTURED_IMAGE_LEDGER_NOT_EXACT");
    const plaintextSha256 = await hashFile(snapshot);
    const manifest = { schemaVersion: 1, tool: "mastergantt-sqlite-recovery", backupId, createdAt: new Date(now).toISOString(), source: { sha: sourceSha, imageDigest, sqlInventorySha256: sha(stable(capturedInventory)) }, sourceJournalMode, database, archive: { file: CIPHER_FILE, cipher: "AES-256-GCM", plaintextSha256, encryptedSha256: null } };
    const ciphertext = join(owned.full, CIPHER_FILE); await encrypt(snapshot, ciphertext, key, manifest); manifest.archive.encryptedSha256 = await hashFile(ciphertext);
    writeFileSync(join(owned.full, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    for (const suffix of ["", "-wal", "-shm"]) if (existsSync(snapshot + suffix)) rmSync(snapshot + suffix);
    const checked = await verifyEncryptedBackup({ backupRoot: owned.full, keyFile, expectedSourceSha: sourceSha, expectedImageDigest: imageDigest, expectedBackupId: backupId, maxAgeMs: 1, now });
    return { manifest: checked.manifest, backupRoot: owned.full, verified: true };
  } catch (error) { if (db) db.close(); removeOwned(owned); if (error instanceof RecoveryError) throw error; throw new RecoveryError("BACKUP_CREATION_FAILED"); }
  finally { removeOwned(scratch); rmdirSync(scratchParent); }
}
export async function verifyEncryptedBackup({ backupRoot, keyFile, expectedSourceSha, expectedImageDigest, expectedBackupId, imageMigrationsDirectory, maxAgeMs, now = Date.now() }) {
  const { root, manifest } = manifestAt(backupRoot);
  demand(validSha(expectedSourceSha) && validDigest(expectedImageDigest), "EXPECTED_IMAGE_BINDING_REQUIRED");
  demand(manifest.source.sha === expectedSourceSha && manifest.source.imageDigest === expectedImageDigest && (!expectedBackupId || manifest.backupId === expectedBackupId), "BACKUP_IMAGE_BINDING_MISMATCH");
  demand(Number.isSafeInteger(maxAgeMs) && maxAgeMs > 0 && Number.isFinite(now), "MAX_AGE_REQUIRED");
  const age = now - Date.parse(manifest.createdAt); demand(age >= 0 && age <= maxAgeMs, "BACKUP_STALE_OR_FUTURE");
  const key = keyBytes(keyFile, root); const ciphertext = join(root, CIPHER_FILE);
  protectedStat(ciphertext, "file", true);
  demand(await hashFile(ciphertext) === manifest.archive.encryptedSha256, "CIPHERTEXT_HASH_MISMATCH");
  const scratch = privateRoot(join(mkdtempSync(join(tmpdir(), "mastergantt-recovery-parent-")), "verify"));
  try {
    const restored = join(scratch.full, "restored.sqlite3"); await decrypt(ciphertext, restored, key, manifest);
    demand(await hashFile(restored) === manifest.archive.plaintextSha256, "PLAINTEXT_HASH_MISMATCH");
    const database = inspectSqliteSnapshot(restored);
    demand(database.schemaSha256 === manifest.database.schemaSha256 && database.dataSha256 === manifest.database.dataSha256 && database.ledgerSha256 === manifest.database.ledgerSha256 && stable(database.ledger) === stable(manifest.database.ledger), "SNAPSHOT_IDENTITY_MISMATCH");
    demand(manifest.source.sqlInventorySha256 === sha(stable(database.ledger)), "CAPTURED_SQL_INVENTORY_MISMATCH");
    const imageCompatibility = imageMigrationsDirectory ? assertImageMigrationCompatibility(database.ledger, imageMigrationsDirectory) : { status: "NOT TESTED", runtimeImageVerified: false };
    return { manifest, database, imageCompatibility, verified: true };
  } finally { removeOwned(scratch); rmdirSync(dirname(scratch.full)); }
}
export async function restoreEncryptedBackup(options) {
  const verified = await verifyEncryptedBackup(options);
  demand(options.imageMigrationsDirectory, "IMAGE_SQL_REQUIRED_FOR_RESTORE");
  const key = keyBytes(options.keyFile, options.root); const owned = privateRoot(options.root);
  try {
    const output = join(owned.full, "restored.sqlite3"); await decrypt(join(resolve(options.backupRoot), CIPHER_FILE), output, key, verified.manifest);
    demand(await hashFile(output) === verified.manifest.archive.plaintextSha256, "RESTORE_PLAINTEXT_MISMATCH");
    const database = inspectSqliteSnapshot(output);
    demand(database.schemaSha256 === verified.database.schemaSha256 && database.dataSha256 === verified.database.dataSha256 && database.ledgerSha256 === verified.database.ledgerSha256, "RESTORE_IDENTITY_MISMATCH");
    const receipt = { schemaVersion: 1, backupId: verified.manifest.backupId, source: verified.manifest.source, restoredDatabaseSha256: await hashFile(output), schemaSha256: database.schemaSha256, ledgerSha256: database.ledgerSha256, dataSha256: database.dataSha256, imageCompatibility: verified.imageCompatibility, runtimeImageVerified: false, offHostVerified: false };
    writeFileSync(join(owned.full, "restore-receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    return { ...verified, root: owned.full, databasePath: output, receipt };
  } catch (error) { removeOwned(owned); if (error instanceof RecoveryError) throw error; throw new RecoveryError("RESTORE_FAILED"); }
}
