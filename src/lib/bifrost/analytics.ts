import "server-only";
import Decimal from "decimal.js";
import type { Metrics, ModelDTO, Range, UsageDTO } from "@/types/dashboard";
import { bucketDate, localBucketDate } from "@/lib/utils/dates";
import { readScopedLogs, readScopedStats } from "./logs";
import { type SafeLog, statsSchema } from "./schemas";
import type { z } from "zod";
import { addDays, format, parseISO } from "date-fns";
import { AppError } from "@/lib/errors";
function aggregate(rows: SafeLog[]): Metrics {
  const tokenKnown = rows.every((r) => r.token_usage != null);
  const costKnown = rows.every((r) => r.cost != null);
  const sum = (key: "prompt_tokens" | "completion_tokens" | "total_tokens") =>
    rows.reduce((n, r) => n + (r.token_usage?.[key] ?? 0), 0);
  const cached = rows.every(
    (r) =>
      r.token_usage?.prompt_tokens_details?.cached_read_tokens != null ||
      r.token_usage?.prompt_tokens_details?.cached_tokens != null,
  );
  return {
    requests: rows.length,
    inputTokens: tokenKnown ? sum("prompt_tokens") : null,
    outputTokens: tokenKnown ? sum("completion_tokens") : null,
    totalTokens: tokenKnown ? sum("total_tokens") : null,
    cachedTokens: cached
      ? rows.reduce(
          (n, r) =>
            n +
            (r.token_usage?.prompt_tokens_details?.cached_read_tokens ??
              r.token_usage?.prompt_tokens_details?.cached_tokens ??
              0),
          0,
        )
      : null,
    cost: costKnown
      ? rows.reduce((n, r) => n.plus(r.cost!), new Decimal(0)).toString()
      : null,
  };
}
function groups(rows: SafeLog[], key: (r: SafeLog) => string) {
  const map = new Map<string, SafeLog[]>();
  for (const r of rows) {
    const k = key(r);
    const g = map.get(k) ?? [];
    g.push(r);
    map.set(k, g);
  }
  return [...map.entries()];
}
export async function getReport(id: string, range: Range): Promise<UsageDTO> {
  let rows: SafeLog[];
  let stats: z.infer<typeof statsSchema>;
  try {
    ({ logs: rows, stats } = await readScopedLogs(id, range));
  } catch (error) {
    if (error instanceof AppError && error.code === "KEY_NOT_FOUND")
      throw new AppError("ANALYTICS_UNAVAILABLE", 503);
    throw error;
  }
  const totals = aggregate(rows);
  const latencies = rows
    .map((r) => r.latency)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
  // Match gateway rankings: only terminal attempts with a recorded model.
  // Model-discovery calls have an empty model and remain in overall totals.
  const rankedRows = rows.filter(
    (r) =>
      r.model.trim() && ["success", "error", "cancelled"].includes(r.status),
  );
  const models: ModelDTO[] = groups(rankedRows, (r) =>
    JSON.stringify([r.provider, r.model]),
  ).map(([, rs]) => {
    const m = aggregate(rs);
    return {
      ...m,
      provider: rs[0].provider || "Unknown",
      model: rs[0].model,
      percentage:
        totals.cost && m.cost && new Decimal(totals.cost).gt(0)
          ? new Decimal(m.cost).div(totals.cost).mul(100).toNumber()
          : null,
    };
  });
  const providers = groups(rows, (r) => r.provider).map(([provider, rs]) => ({
    provider: provider || "Unknown",
    ...aggregate(rs),
  }));
  const buckets = new Map(groups(rows, (r) => bucketDate(r.timestamp, range)));
  const dates = new Set<string>();
  for (
    let d = parseISO(range.from);
    format(d, "yyyy-MM-dd") <= range.to;
    d = addDays(d, 1)
  ) {
    const day = format(d, "yyyy-MM-dd");
    dates.add(localBucketDate(day, range.grouping));
  }
  const series = [...dates]
    .sort()
    .map((date) => ({ date, ...aggregate(buckets.get(date) ?? []) }));
  return {
    range,
    health: {
      successRate: rows.length ? (stats.success_rate ?? null) : null,
      userSuccessRate: rows.length
        ? (stats.user_facing_success_rate ?? null)
        : null,
      averageLatencyMs: rows.length ? (stats.average_latency ?? null) : null,
      p95LatencyMs:
        latencies.length && latencies.length === rows.length
          ? latencies[Math.ceil(latencies.length * 0.95) - 1]
          : null,
    },
    totals,
    models,
    providers,
    series,
    empty: rows.length === 0,
    incompleteMetrics: totals.cost === null || totals.totalTokens === null,
  };
}

// Gateway aggregates do not depend on nullable per-request metadata or log pagination.
export async function getSummary(id: string, range: Range): Promise<UsageDTO> {
  let stats;
  try {
    stats = await readScopedStats(id, range);
  } catch (error) {
    if (error instanceof AppError && error.code === "KEY_NOT_FOUND")
      throw new AppError("ANALYTICS_UNAVAILABLE", 503);
    throw error;
  }
  return {
    range,
    totals: {
      requests: stats.total_requests,
      inputTokens: stats.prompt_tokens,
      outputTokens: stats.completion_tokens,
      totalTokens: stats.total_tokens,
      cachedTokens: null,
      cost: new Decimal(stats.total_cost).toString(),
    },
    health: {
      successRate: stats.total_requests ? (stats.success_rate ?? null) : null,
      userSuccessRate: stats.total_requests ? (stats.user_facing_success_rate ?? null) : null,
      averageLatencyMs: stats.total_requests ? (stats.average_latency ?? null) : null,
      p95LatencyMs: null,
    },
    models: [], providers: [], series: [],
    empty: stats.total_requests === 0,
    incompleteMetrics: false,
  };
}
