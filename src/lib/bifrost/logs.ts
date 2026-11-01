import "server-only";
import { bifrostGet } from "./client";
import { logsSchema, statsSchema, type SafeLog } from "./schemas";
import { keyIdSchema } from "@/lib/auth/tokens";
import { AppError } from "@/lib/errors";
import type { z } from "zod";
import type { Range } from "@/types/dashboard";
export function scopedParams(id: string, range: Range): URLSearchParams {
  if (!keyIdSchema.safeParse(id).success) throw new AppError("INVALID_INPUT");
  return new URLSearchParams({
    virtual_key_ids: id,
    start_time: range.start,
    end_time: range.end,
  });
}
export async function readScopedStats(id: string, range: Range) {
  const result = statsSchema.safeParse(await bifrostGet("/api/logs/stats", scopedParams(id, range)));
  if (!result.success) throw new AppError("ANALYTICS_UNAVAILABLE", 503);
  return result.data;
}
export async function readScopedLogs(
  id: string,
  range: Range,
): Promise<{ logs: SafeLog[]; stats: z.infer<typeof statsSchema> }> {
  const base = scopedParams(id, range);
  const deadline = AbortSignal.timeout(25000);
  const stats = statsSchema.safeParse(
    await bifrostGet("/api/logs/stats", base, deadline),
  );
  if (!stats.success) throw new AppError("ANALYTICS_UNAVAILABLE", 503);
  if (stats.data.total_requests > 10000)
    throw new AppError("ANALYTICS_LIMIT", 422);
  const result: SafeLog[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  do {
    const params = new URLSearchParams(base);
    params.set("limit", "200");
    params.set("offset", String(result.length));
    params.set("sort_by", "timestamp");
    params.set("order", "asc");
    const page = logsSchema.safeParse(
      await bifrostGet("/api/logs", params, deadline),
    );
    if (!page.success) throw new AppError("ANALYTICS_UNAVAILABLE", 503);
    const p = page.data;
    total ??= p.pagination.total_count;
    if (total > 10000) throw new AppError("ANALYTICS_LIMIT", 422);
    if (
      total !== stats.data.total_requests ||
      p.pagination.total_count !== total ||
      p.pagination.offset !== result.length ||
      (p.logs.length === 0 && result.length < total) ||
      p.logs.length > 200
    )
      throw new AppError("ANALYTICS_UNAVAILABLE", 503);
    for (const r of p.logs) {
      if (
        r.virtual_key_id !== id ||
        seen.has(r.id) ||
        Date.parse(r.timestamp) < Date.parse(range.start) ||
        Date.parse(r.timestamp) > Date.parse(range.end)
      )
        throw new AppError("ANALYTICS_UNAVAILABLE", 503);
      seen.add(r.id);
      result.push(r);
    }
    if (result.length > total) throw new AppError("ANALYTICS_UNAVAILABLE", 503);
  } while (result.length < total);
  // PostgreSQL can serve stale materialized totals while list rows are fresh.
  // Never treat reaching that total as proof that the raw list ended.
  const probeParams = new URLSearchParams(base);
  probeParams.set("limit", "1");
  probeParams.set("offset", String(result.length));
  probeParams.set("sort_by", "timestamp");
  probeParams.set("order", "asc");
  const probe = logsSchema.safeParse(
    await bifrostGet("/api/logs", probeParams, deadline),
  );
  if (
    !probe.success ||
    probe.data.logs.length !== 0 ||
    probe.data.pagination.offset !== result.length ||
    probe.data.pagination.total_count !== total
  )
    throw new AppError("ANALYTICS_UNAVAILABLE", 503);
  // Fixed date bounds and a second count detect concurrent insertion/retention while paging.
  const final = statsSchema.safeParse(
    await bifrostGet("/api/logs/stats", base, deadline),
  );
  if (
    !final.success ||
    JSON.stringify(final.data) !== JSON.stringify(stats.data)
  )
    throw new AppError("ANALYTICS_UNAVAILABLE", 503);
  return { logs: result, stats: final.data };
}
