import "server-only";
import { z } from "zod";
import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { bifrostGet } from "./client";
import { scopedParams } from "./logs";
import { count } from "./schemas";
import { localBucketDate } from "@/lib/utils/dates";
import { AppError } from "@/lib/errors";
import type { Range, RequestVolumeDTO } from "@/types/dashboard";

const histogramSchema = z.object({
  bucket_size_seconds: z.number().int().positive().max(30 * 86400),
  buckets: z.array(z.object({ timestamp: z.iso.datetime({ offset: true }), count, success: count, error: count, cancelled: count })).max(2000),
});

export async function getRequestVolume(id: string, range: Range): Promise<RequestVolumeDTO> {
  // Validate the identity before launching any requests.
  scopedParams(id, range);
  // Upstream buckets use UTC boundaries and pick their own interval. Query each
  // calendar period separately so Tehran's half-hour offset cannot move counts
  // across local days. Bound concurrency and the entire report's duration.
  const periods = new Map<string, { from: string; to: string }>();
  for (let day = parseISO(range.from); format(day, "yyyy-MM-dd") <= range.to; day = addDays(day, 1)) {
    const date = format(day, "yyyy-MM-dd");
    const label = localBucketDate(date, range.grouping);
    const current = periods.get(label);
    periods.set(label, { from: current?.from ?? date, to: date });
  }
  const entries = [...periods.entries()];
  const series: RequestVolumeDTO["series"] = new Array(entries.length);
  const cancellation = new AbortController();
  const deadline = AbortSignal.any([AbortSignal.timeout(25000), cancellation.signal]);
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      if (deadline.aborted) throw new AppError("BIFROST_TIMEOUT", 504);
      const index = next++;
      const [date, period] = entries[index];
      const after = format(addDays(parseISO(period.to), 1), "yyyy-MM-dd");
      const start = Math.max(Date.parse(range.start), +fromZonedTime(`${period.from}T00:00:00`, range.timezone));
      const end = Math.min(Date.parse(range.end), +fromZonedTime(`${after}T00:00:00`, range.timezone) - 1);
      const params = scopedParams(id, { ...range, start: new Date(start).toISOString(), end: new Date(end).toISOString().replace(/\.999Z$/, ".999999999Z") });
      // Preserve the inclusive nanosecond bound on the final selected period.
      if (period.to === range.to) params.set("end_time", range.end);
      let raw;
      try { raw = await bifrostGet("/api/logs/histogram", params, deadline); }
      catch (error) {
        if (error instanceof AppError && error.code === "KEY_NOT_FOUND") throw new AppError("ANALYTICS_UNAVAILABLE", 503);
        throw error;
      }
      const parsed = histogramSchema.safeParse(raw);
      if (!parsed.success) throw new AppError("ANALYTICS_UNAVAILABLE", 503);
      const seen = new Set<number>();
      const totals = { requests: 0, success: 0, error: 0, cancelled: 0 };
      for (const bucket of parsed.data.buckets) {
        const timestamp = Date.parse(bucket.timestamp);
        if (seen.has(timestamp) || timestamp > end || timestamp + parsed.data.bucket_size_seconds * 1000 <= start)
          throw new AppError("ANALYTICS_UNAVAILABLE", 503);
        seen.add(timestamp);
        totals.requests += bucket.count;
        totals.success += bucket.success;
        totals.error += bucket.error;
        totals.cancelled += bucket.cancelled;
        if (!Object.values(totals).every(Number.isSafeInteger))
          throw new AppError("ANALYTICS_UNAVAILABLE", 503);
      }
      series[index] = { date, ...totals };
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
  } catch (error) {
    cancellation.abort();
    throw error;
  }
  return { range, series };
}
