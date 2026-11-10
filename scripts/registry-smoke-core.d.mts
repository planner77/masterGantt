export interface SmokeEndpoint {id: string; image: string; baseUrl: string}
export declare const SMOKE_CONTAINERS: readonly string[];
export declare function smokeEndpoint(inspection: unknown, name: string, expected?: SmokeEndpoint | null): SmokeEndpoint;
export declare function inspectSmokeEndpoint(name: string, expected?: SmokeEndpoint | null, inspect?: (command: string, args: string[], options: object) => {status: number | null; stdout: string; error?: unknown; signal?: string | null}): SmokeEndpoint;
export declare function validateSmokeBaseUrl(requested: string, endpoint: SmokeEndpoint): string;
