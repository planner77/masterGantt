export declare class BatchError extends Error { code: string; constructor(code: string, message: string); }
export interface BatchIntent {
  repository: string; issue: number; branch: string; method: "api" | "git";
  mainSha: string; expectedHead: string | null;
}
export interface BatchChange {
  path: string; action: "upsert" | "delete"; mode: string; sha: string | null;
  previousMode: string | null; previousSha: string | null; size: number | null;
}
export interface BatchManifest extends BatchIntent {
  schema: "mastergantt-pr-batch-v1"; localHead: string; localTree: string; baseTree: string;
  publishParents: string[]; sourceFingerprint: string; changes: BatchChange[];
}
export interface PreparedBatch {
  status: "PASS"; scope: "LOCAL_STRUCTURE_ONLY"; operation: "prepare";
  manifestSha256: string; manifest: BatchManifest; remoteEvidence: string;
  requiredCi: "NOT TESTED"; approval: "NOT TESTED"; boundary: string;
}
export interface BatchObservation {
  schema: "mastergantt-pr-batch-observation-v1"; repository: string; branch: string; mainSha: string;
  remote: { state: "PRESENT" | "ABSENT" | "UNKNOWN"; headSha: string | null; treeSha: string | null };
  candidate: { headSha: string; treeSha: string; parentShas: string[] };
}
export interface BatchVerification {
  status: "PASS"; scope: "LOCAL_STRUCTURE_ONLY"; operation: "verify"; phase: "before" | "after";
  manifestSha256: string; repository: string; branch: string; localHead: string;
  candidateHead: string; remoteHead: string | null; treeSha: string;
  remoteEvidence: string; requiredCi: "NOT TESTED"; approval: "NOT TESTED"; boundary: string;
}
export declare function manifestDigest(manifest: unknown): string;
export declare function prepareBatch(root: string, options: BatchIntent): PreparedBatch;
export declare function verifyBatch(root: string, prepared: unknown, observation: unknown,
  options: { phase: "before" | "after"; manifestSha256: string }): BatchVerification;
