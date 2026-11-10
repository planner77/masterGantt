export declare function e2eSafety(args?: {env?: Record<string, string | undefined>; existing?: string[]; portFree?: boolean}): {state: "READY" | "BLOCKED"; reasons: string[]};
export declare function git(root: string, ...args: string[]): string;
export declare function resolveBase(root: string, requested?: string): { ref: string; sha: string };
export declare function sourceEvidence(root: string, base?: string): {
  baseRef: string; baseSha: string; headSha: string; workingDiffSha256: string;
  fingerprint: string; dirty: boolean; changed: string[]; contentSha256: string; indexSha256: string; fixtureSha256: string; packageLockSha256: string | null; actualMatchesHead: boolean;
};
export declare function isPathWithin(root: string, target: string): boolean;
export declare function inventory(root: string): { unit: string[]; e2e: string[]; directBySource: Record<string, string[]> };
export declare function inferRisk(paths: string[]): "LOW" | "MEDIUM" | "HIGH";
export declare function selectImpact(args: {
  changed: string[]; tests: { unit: string[]; e2e: string[]; directBySource?: Record<string, string[]> }; risk: string;
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
export declare const COMMON_CHECKS: Record<string, string[]>;
export declare function reportChecksum(report: object): string;
export declare function environmentEvidence(root: string, env?: Record<string, string | undefined>): {
  node: string; npm: string | null; osRelease: string; abi: string; platform: string; architecture: string; environmentSha256: string;
  inputs: Record<string, string | null>; fingerprint: string; invocationTraceSha256: string | null;
};
export declare function standardBuildEnvironment<T extends Record<string, string | undefined>>(env: T): Omit<T, "NEXT_DIST_DIR">;
export declare function standardBuildEnvironment(): Omit<NodeJS.ProcessEnv, "NEXT_DIST_DIR">;
export declare function publicationRequirements(source: ReturnType<typeof sourceEvidence>, selection: ReturnType<typeof selectImpact>): {common: string[]; tests: string[]; docker: boolean};
export declare function evaluateAdmission(args: {
  reports: unknown[]; source: ReturnType<typeof sourceEvidence>; environment: ReturnType<typeof environmentEvidence>;
  selection: ReturnType<typeof selectImpact>; issue?: number | null; now?: number;
}): {status: "PASS" | "BLOCKED"; publishAllowed: boolean; reasons: string[]; reportCount: number; notice: string};
export declare function runnerCoverage(kind: string, payload: unknown, root: string): Array<{path: string; passed: number; failed: number; skipped: number}>;
export declare function runnerCompletion(files: ReturnType<typeof runnerCoverage>, expectedTests: string[], requiredTests?: string[], options?: {allowDependencyBenchmarkSkip?: boolean}): {
  status: "PASS" | "BLOCKED"; missingFiles: string[]; requiredNotPassed: string[];
  notTestedFiles: Array<{path: string; skippedCases: number; status: "NOT TESTED"; reason: string}>; allowDependencyBenchmarkSkip: boolean;
  counts: {passed: number; failed: number; skipped: number};
};
export declare function approvedTestCommand(label: string, command: string[]): boolean;
