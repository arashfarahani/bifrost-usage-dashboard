import "server-only";
import Decimal from "decimal.js";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { ModelDTO, Range } from "@/types/dashboard";
import { bifrostGet } from "./client";
import { scopedParams } from "./logs";
import { count, number } from "./schemas";

const schema = z.object({
  rankings: z.array(z.object({
    model: z.string().trim().min(1).max(256),
    provider: z.string().trim().min(1).max(256),
    total_requests: count,
    total_tokens: count,
    total_cost: number,
  })),
});

export async function getModelRankings(id: string, range: Range): Promise<ModelDTO[]> {
  const params = scopedParams(id, range);
  params.set("all", "true");
  const raw = await bifrostGet("/api/logs/rankings", params).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "KEY_NOT_FOUND")
      throw new AppError("ANALYTICS_UNAVAILABLE", 503);
    throw error;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AppError("ANALYTICS_UNAVAILABLE", 503);
  const rows = parsed.data.rankings;
  const total = rows.reduce((sum, row) => sum.plus(row.total_cost), new Decimal(0));
  return rows.map((row) => ({
    model: row.model,
    provider: row.provider,
    requests: row.total_requests,
    totalTokens: row.total_tokens,
    inputTokens: null,
    outputTokens: null,
    cachedTokens: null,
    cost: new Decimal(row.total_cost).toString(),
    percentage: total.isZero() ? null : new Decimal(row.total_cost).div(total).mul(100).toNumber(),
  }));
}
