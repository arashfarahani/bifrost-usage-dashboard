import { afterEach, expect, it, vi } from "vitest";
import { getModelRankings } from "@/lib/bifrost/rankings";
import { parseRange } from "@/lib/utils/dates";

const range = parseRange(new URLSearchParams("from=2026-10-01&to=2026-10-02"));
afterEach(() => vi.unstubAllGlobals());

it("loads scoped model aggregates without fetching raw logs", async () => {
  const fetcher = vi.fn(async (url: URL) => {
    expect(url.pathname).toBe("/api/logs/rankings");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      virtual_key_ids: "vk-a", start_time: range.start, end_time: range.end, all: "true",
    });
    return Response.json({ rankings: [
      { model: "anthropic/claude-haiku", provider: "openrouter", total_requests: 76,
        total_tokens: 4380616, total_cost: 0.21422173, trend: { secret: "hidden" } },
    ] });
  });
  vi.stubGlobal("fetch", fetcher);
  const models = await getModelRankings("vk-a", range);
  expect(models).toEqual([{model:"anthropic/claude-haiku",provider:"openrouter",
    requests:76,totalTokens:4380616,inputTokens:null,outputTokens:null,cachedTokens:null,
    cost:"0.21422173",percentage:100}]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("rejects multiple keys before requesting rankings", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(getModelRankings("vk-a,vk-b", range)).rejects.toMatchObject({code:"INVALID_INPUT"});
  expect(fetcher).not.toHaveBeenCalled();
});
