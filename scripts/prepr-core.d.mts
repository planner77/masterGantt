export declare function git(root: string, ...args: string[]): string;
export declare function resolveBase(root: string, requested?: string): { ref: string; sha: string };
export declare function sourceEvidence(root: string, base?: string): {
  baseRef: string; baseSha: string; headSha: string; workingDiffSha256: string;
  fingerprint: string; dirty: boolean; changed: string[];
};
export declare function isPathWithin(root: string, target: string): boolean;
export declare function inventory(root: string): { unit: string[]; e2e: string[] };
export declare function inferRisk(paths: string[]): "LOW" | "MEDIUM" | "HIGH";
export declare function selectImpact(args: {
  changed: string[]; tests: { unit: string[]; e2e: string[] }; risk: string;
  includes?: string[]; excludes?: string[];
}): {
  risk: string; inferredRisk: string;
  matched: Array<{ path: string; rule: string; reason: string }>;
  unknown: Array<{ path: string; reason: string }>;
  missing: Array<{ path: string; reason: string }>;
  excluded: Array<{ path: string; reason: string; notRecommended?: boolean }>;
  selected: Array<{ path: string; kind: string; reasons: string[] }>;
  state: "READY" | "BLOCKED"; notSelectedReason: string;
};
export declare function diagnosticSubset(history: {
  failures: Array<{pr: number; runId: string | number; attempt: number; headSha: string;
    status: string; file: string; classification?: string}>;
}, existingFiles: string[], expectedPr?: number | null): {
  files: string[];
  evidence: Array<{pr: number; runId: string | number; attempt: number; headSha: string;
    status: string; file: string; classification: string}>;
  status: "READY"; attempts: number;
};
