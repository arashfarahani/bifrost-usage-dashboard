import { afterEach, expect, it, vi } from "vitest";
import { getSummary } from "@/lib/bifrost/analytics";
const range = {
  from: "2026-10-01", to: "2026-10-02", start: "2026-09-30T20:30:00.000Z",
  end: "2026-10-02T20:29:59.999999999Z", timezone: "Asia/Tehran", grouping: "day" as const,
};
afterEach(() => vi.unstubAllGlobals());
it("loads authoritative totals without fetching raw logs, even above the detail limit", async () => {
  const fetcher = vi.fn(async (url: URL) => {
    expect(url.pathname).toBe("/api/logs/stats");
    expect(url.searchParams.get("virtual_key_ids")).toBe("vk-a");
    expect(url.searchParams.get("start_time")).toBe(range.start);
    expect(url.searchParams.get("end_time")).toBe(range.end);
    return Response.json({
      total_requests: 15000, total_cost: 10.38, prompt_tokens: 4800000,
      completion_tokens: 74800, total_tokens: 4874800, success_rate: 100,
      user_facing_success_rate: 100, average_latency: 9791, secret: "NEVER-EXPOSE"
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const summary = await getSummary("vk-a", range);
  expect(summary.totals).toMatchObject({ requests: 15000, totalTokens: 4874800, inputTokens: 4800000, outputTokens: 74800, cost: "10.38" });
  expect(summary.health).toMatchObject({ successRate: 100, averageLatencyMs: 9791, p95LatencyMs: null });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(summary)).not.toMatch(/NEVER-EXPOSE|vk-a/);
});
it("rejects identity injection before a summary request", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(getSummary("vk-a,vk-b", range)).rejects.toBeDefined();
  expect(fetcher).not.toHaveBeenCalled();
});

it("uses a scoped histogram without reading logs and strips upstream fields", async () => {
  const { getRequestVolume } = await import("@/lib/bifrost/histogram");
  vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
    expect(url.pathname).toBe("/api/logs/histogram");
    expect(url.searchParams.get("virtual_key_ids")).toBe("vk-a");
    return Response.json({
      bucket_size_seconds: 3600, buckets: [
        { timestamp: url.searchParams.get("start_time"), count: 20, success: 15, error: 4, cancelled: 1, secret: "hidden" },
        { timestamp: new Date(Date.parse(url.searchParams.get("start_time")!) + 3600000).toISOString(), count: 45, success: 45, error: 0, cancelled: 0 },
      ]
    });
  }));
  const result = await getRequestVolume("vk-a", range);
  expect(result.series).toEqual([{ date: "2026-10-01", requests: 65, success: 60, error: 4, cancelled: 1 }, { date: "2026-10-02", requests: 65, success: 60, error: 4, cancelled: 1 }]);
  expect(JSON.stringify(result)).not.toMatch(/hidden|vk-a/);
});
it("rejects malformed or out-of-range histogram buckets", async () => {
  const { getRequestVolume } = await import("@/lib/bifrost/histogram");
  vi.stubGlobal("fetch", async () => Response.json({ bucket_size_seconds: 86400, buckets: [{ timestamp: "2020-01-01T00:00:00Z", count: 99 }] }));
  await expect(getRequestVolume("vk-a", range)).rejects.toMatchObject({ code: "ANALYTICS_UNAVAILABLE" });
});

it("limits histogram concurrency and preserves Tehran's inclusive calendar boundaries", async () => {
  const { getRequestVolume } = await import("@/lib/bifrost/histogram");
  let active = 0, peak = 0;
  const queries: URLSearchParams[] = [];
  vi.stubGlobal("fetch", async (url: URL) => {
    active++; peak = Math.max(peak, active); queries.push(url.searchParams);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return Response.json({ bucket_size_seconds: 3600, buckets: [] });
  });
  const expanded = { ...range, to: "2026-10-10", end: "2026-10-10T20:29:59.999999999Z" };
  const result = await getRequestVolume("vk-a", expanded);
  expect(result.series).toHaveLength(10);
  expect(peak).toBe(4);
  expect(queries[0].get("start_time")).toBe(range.start);
  expect(queries[0].get("end_time")).toBe("2026-10-01T20:29:59.999999999Z");
  expect(queries[1].get("start_time")).toBe("2026-10-01T20:30:00.000Z");
  expect(queries[9].get("end_time")).toBe(expanded.end);
});
it.each([["week", 3], ["month", 1]] as const)("queries %s calendar groups directly", async (grouping, total) => {
  const { getRequestVolume } = await import("@/lib/bifrost/histogram");
  const fetcher = vi.fn(async () => Response.json({ bucket_size_seconds: 3600, buckets: [] }));
  vi.stubGlobal("fetch", fetcher);
  const result = await getRequestVolume("vk-a", { ...range, to: "2026-10-10", end: "2026-10-10T20:29:59.999999999Z", grouping });
  expect(result.series).toHaveLength(total);
  expect(fetcher).toHaveBeenCalledTimes(total);
});

it("preserves zero status counts and rejects missing status metrics", async () => {
  const { getRequestVolume } = await import("@/lib/bifrost/histogram");
  vi.stubGlobal("fetch", async (url: URL) => Response.json({
    bucket_size_seconds: 3600,
    buckets: [{ timestamp: url.searchParams.get("start_time"), count: 0, success: 0, error: 0, cancelled: 0 }],
  }));
  const report = await getRequestVolume("vk-a", range);
  expect(report.series[0]).toEqual({date:range.from,requests:0,success:0,error:0,cancelled:0});
  vi.stubGlobal("fetch", async (url: URL) => Response.json({
    bucket_size_seconds: 3600, buckets: [{timestamp: url.searchParams.get("start_time"),count:5}],
  }));
  await expect(getRequestVolume("vk-a", range)).rejects.toMatchObject({code:"ANALYTICS_UNAVAILABLE"});
});
