#!/usr/bin/env node
import { createBackupKey, createEncryptedBackup, restoreEncryptedBackup, verifyEncryptedBackup } from "./sqlite-backup-core.mjs";

function options(argv) {
  const [operation, ...args] = argv;
  if (operation === "--help" || operation === "help" || !operation) return { help: true };
  if (!["keygen", "backup", "verify", "restore"].includes(operation)) throw new Error("UNKNOWN_OPERATION");
  const values = { operation };
  const names = new Map([["project-root", "projectRoot"], ["source", "source"], ["root", "root"], ["key-file", "keyFile"], ["source-sha", "sourceSha"], ["image-digest", "imageDigest"], ["backup-id", "backupId"], ["backup-root", "backupRoot"], ["expected-source-sha", "expectedSourceSha"], ["expected-image-digest", "expectedImageDigest"], ["image-migrations", "imageMigrationsDirectory"], ["max-age-ms", "maxAgeMs"]]);
  for (const arg of args) {
    const m = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!m || !names.has(m[1]) || Object.hasOwn(values, names.get(m[1]))) throw new Error("UNKNOWN_OR_DUPLICATE_OPTION");
    values[names.get(m[1])] = m[1] === "max-age-ms" ? Number(m[2]) : m[2];
  }
  const required = operation === "keygen" ? ["root"] : operation === "backup" ? ["projectRoot", "source", "root", "keyFile", "sourceSha", "imageDigest", "backupId", "imageMigrationsDirectory"] : ["backupRoot", "keyFile", "expectedSourceSha", "expectedImageDigest", "maxAgeMs", ...(operation === "restore" ? ["root", "imageMigrationsDirectory"] : [])];
  if (required.some((key) => values[key] === undefined)) throw new Error("REQUIRED_OPTION_MISSING");
  return values;
}
try {
  const opt = options(process.argv.slice(2));
  if (opt.help) {
    console.log(`SQLite 일관 백업/격리 복원 — 로컬 전용
node scripts/verify-sqlite-recovery.mjs keygen --root=<새 private key root>
node scripts/verify-sqlite-recovery.mjs backup --project-root=<원본 project> --source=<explicit sqlite> --root=<project/backups/mastergantt/backup-id> --key-file=<분리된0600 key> --source-sha=<as-captured SHA> --image-digest=<as-captured digest> --backup-id=<opaque> --image-migrations=<as-captured image SQL>
node scripts/verify-sqlite-recovery.mjs verify --backup-root=<backup root> --key-file=<key> --expected-source-sha=<captured SHA> --expected-image-digest=<captured digest> --max-age-ms=<Owner 정책> [--backup-id=<opaque>] [--image-migrations=<선택 image SQL>]
node scripts/verify-sqlite-recovery.mjs restore (verify 인수와 --root=<새 격리 root> --image-migrations=<선택 image SQL>)
키 값/비밀번호를 argv에 넣지 않습니다. 복원은 기존 파일/운영 경로를 덮지 않습니다. image SQL prefix 검사는 실제 runtime 검증이나 offhost DR 완료가 아닙니다.`);
  } else if (opt.operation === "keygen") {
    createBackupKey(opt.root); console.log(JSON.stringify({ status: "PASS", operation: "keygen", keyFile: "backup.key", privateOutput: true }));
  } else {
    const result = opt.operation === "backup" ? await createEncryptedBackup(opt) : opt.operation === "restore" ? await restoreEncryptedBackup({ ...opt, expectedBackupId: opt.backupId }) : await verifyEncryptedBackup({ ...opt, expectedBackupId: opt.backupId });
    console.log(JSON.stringify({ status: "PASS", operation: opt.operation, backupId: result.manifest.backupId, capturedSourceSha: result.manifest.source.sha, capturedImageDigest: result.manifest.source.imageDigest, runtimeImageVerified: false, offHostVerified: false, privateOutput: true }));
  }
} catch (error) {
  const code = typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : /^[A-Z0-9_]+$/.test(error.message ?? "") ? error.message : "RECOVERY_BLOCKED";
  const fail = /(?:MISMATCH|AUTHENTICATION|INTEGRITY|FOREIGN_KEYS|UNREADABLE|INVALID|TRUNCATED)/.test(code);
  console.error(JSON.stringify({ status: fail ? "FAIL" : "BLOCKED", code, notice: "비공개 원본 오류/경로/값은 출력하지 않습니다." })); process.exitCode = 1;
}
