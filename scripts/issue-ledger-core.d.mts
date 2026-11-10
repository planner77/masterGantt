export declare const LOCAL_STAGES: string[];
export declare function validateLedger(index: unknown, options: {root: string; previous?: unknown; expectedSource?: string | null; expectedEnvironment?: string | null}): {status: "PASS" | "FAIL"; errors: string[]; issueCount: number; failureCount: number; eventCount: number; publicationEvidence: false};
export declare function gitLedgerBaseline(root: string, indexPath: string, base?: string): {previous: unknown; baseSha: string; bootstrap: boolean};
export declare function validateLedgerFilePrefixes(root: string, index: unknown, baseSha: string): {status: "PASS" | "FAIL"; errors: string[]; compared: number};
