export declare class RecoveryError extends Error { code: string; constructor(code: string); }
export interface MigrationRecord { version: number; name: string; checksum: string; }
export interface SnapshotIdentity { sqliteVersion: string; userVersion: number; journalMode: string; schemaSha256: string; dataSha256: string; ledger: MigrationRecord[]; ledgerSha256: string; tableCount: number; }
export interface BackupManifest { schemaVersion: 1; tool: "mastergantt-sqlite-recovery"; backupId: string; createdAt: string; source: {sha: string; imageDigest: string; sqlInventorySha256: string}; sourceJournalMode: string; database: SnapshotIdentity; archive: {file: string; cipher: "AES-256-GCM"; plaintextSha256: string; encryptedSha256: string}; }
export interface BackupOptions { projectRoot: string; source: string; root: string; keyFile: string; sourceSha: string; imageDigest: string; backupId: string; imageMigrationsDirectory: string; now?: number; }
export interface VerifyBackupOptions { backupRoot: string; keyFile: string; expectedSourceSha: string; expectedImageDigest: string; expectedBackupId?: string; imageMigrationsDirectory?: string; maxAgeMs: number; now?: number; }
export interface SqlCompatibility { status: "SQL_PREFIX_VERIFIED" | "NOT TESTED"; pendingMigrationCount?: number; runtimeImageVerified: false; }
export interface VerifiedBackup { manifest: BackupManifest; database: SnapshotIdentity; imageCompatibility: SqlCompatibility; verified: true; }
export declare function inspectSqliteSnapshot(filename: string): SnapshotIdentity;
export declare function readImageMigrationInventory(directory: string): MigrationRecord[];
export declare function assertImageMigrationCompatibility(ledger: MigrationRecord[], imageMigrationsDirectory: string): SqlCompatibility;
export declare function createBackupKey(root: string): {keyFile: string};
export declare function createEncryptedBackup(options: BackupOptions): Promise<{manifest: BackupManifest; backupRoot: string; verified: true}>;
export declare function verifyEncryptedBackup(options: VerifyBackupOptions): Promise<VerifiedBackup>;
export declare function restoreEncryptedBackup(options: VerifyBackupOptions & {root: string; imageMigrationsDirectory: string}): Promise<VerifiedBackup & {root: string; databasePath: string; receipt: {schemaVersion: 1; backupId: string; source: BackupManifest["source"]; restoredDatabaseSha256: string; schemaSha256: string; ledgerSha256: string; dataSha256: string; imageCompatibility: SqlCompatibility; runtimeImageVerified: false; offHostVerified: false}}>;
