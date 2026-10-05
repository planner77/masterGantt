export interface E2EShardGroup {
  shard: number;
  projectedMs?: number;
  files: string[];
}

export interface E2EShardPlan {
  schemaVersion: number;
  shardCount: number;
  generatedAt?: string;
  shards: E2EShardGroup[];
}

export interface E2EShardBin {
  shard: number;
  totalMs: number;
  files: string[];
}

export interface E2EAnalyzeResult {
  shouldUpdate: boolean;
  reason: Record<string, boolean>;
  plan: {
    schemaVersion: number;
    issue: number;
    shardCount: number;
    generatedAt: string;
    estimator: string;
    sourceRunIds: string[];
    metrics: Record<string, number | number[] | boolean>;
    shards: E2EShardGroup[];
  };
  candidateShardCounts: Array<{
    shardCount: number;
    projectedCriticalMs: number;
    projectedRunnerMinutes: number;
  }>;
}

export function median(values: number[]): number;
export function listSpecFiles(rootDir?: string): string[];
export function loadHistory(historyDir: string): Map<string, unknown>;
export function lptPlan(weights: Map<string, number>, shardCount: number): E2EShardBin[];
export function selectShardFiles(args: {
  plan: E2EShardPlan | null;
  currentFiles: string[];
  shard: number;
  total: number;
}): string[] | null;
export function analyzeHistory(args: {
  historyDir: string;
  shardCount?: number;
  minRuns?: number;
  recentWindow?: number;
  imbalanceThreshold?: number;
  minBreaches?: number;
  minImprovementRatio?: number;
  minImprovementMs?: number;
  cooldownDays?: number;
  currentPlanPath?: string;
  now?: Date;
}): E2EAnalyzeResult;
