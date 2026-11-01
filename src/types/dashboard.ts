export type Identity = {
  virtualKeyId: string;
  displayName: string;
  expiresAt: number;
  linkExpiresAt: number | null;
};
export type AccessIdentity = Omit<Identity, "expiresAt"> & {
  expiresAt: number | null;
};
export type BudgetDTO = {
  id: string;
  scope: string;
  limit: string;
  used: string;
  remaining: string;
  percentage: number | null;
  resetPeriod: string;
  lastReset: string;
  nextReset: string | null;
  nextResetEstimated: boolean;
  override: string | null;
};
export type KeyDTO = {
  name: string;
  active: true;
  expiresAt: string | null;
  budgets: BudgetDTO[];
};
export type Range = {
  from: string;
  to: string;
  start: string;
  end: string;
  timezone: string;
  grouping: "day" | "week" | "month";
};
export type Metrics = {
  requests: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  cost: string | null;
};
export type ModelDTO = Metrics & {
  provider: string;
  model: string;
  percentage: number | null;
};
export type SeriesDTO = Metrics & { date: string };
export type UsageDTO = {
  health: {
    successRate: number | null;
    userSuccessRate: number | null;
    averageLatencyMs: number | null;
    p95LatencyMs: number | null;
  };
  range: Range;
  totals: Metrics;
  models: ModelDTO[];
  providers: (Metrics & { provider: string })[];
  series: SeriesDTO[];
  empty: boolean;
  incompleteMetrics: boolean;
};
export type SessionDTO = {
  displayName: string;
  expiresAt: number;
  key: KeyDTO;
  timezone: string;
};

export type RequestVolumeDTO = {
  range: Range;
  series: {
    date: string;
    requests: number;
    success: number;
    error: number;
    cancelled: number;
  }[];
};
