import { afterEach, describe, expect, it, vi } from "vitest";
import { getVirtualKey } from "@/lib/bifrost/governance";
import { getReport } from "@/lib/bifrost/analytics";
import { parseRange } from "@/lib/utils/dates";
const range = {
  from: "2026-10-01",
  to: "2026-10-02",
  start: "2026-09-30T20:30:00.000Z",
  end: "2026-10-02T20:29:59.999999999Z",
  timezone: "Asia/Tehran",
  grouping: "day" as const,
};
function row(id: string, key = "vk-a") {
  return {
    id,
    virtual_key_id: key,
    timestamp: "2026-10-01T12:00:00Z",
    provider: "openai",
    model: "model-live",
    status: "success",
    cost: 0.000002,
    latency: 1200,
    token_usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      prompt_tokens_details: { cached_read_tokens: 2 },
    },
    input_history: [{ content: "SECRET PROMPT" }],
    raw_response: "SECRET RESPONSE",
  };
}
function serve(logs = [row("1"), row("2")], total = logs.length) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL, init: RequestInit) => {
      expect(url.searchParams.get("virtual_key_ids")).toBe("vk-a");
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("manual");
      expect(init.cache).toBe("no-store");
      return Response.json(
        url.pathname.endsWith("/stats")
          ? {
              total_requests: total,
              success_rate: 100,
              user_facing_success_rate: 100,
              average_latency: 1200,
              total_cost: 0.000004,
              prompt_tokens: 20,
              completion_tokens: 10,
              total_tokens: 30,
            }
          : {
              logs: logs.slice(
                Number(url.searchParams.get("offset")),
                Number(url.searchParams.get("offset")) +
                  Number(url.searchParams.get("limit")),
              ),
              pagination: {
                total_count: total,
                offset: Number(url.searchParams.get("offset")),
                limit: 200,
              },
              has_logs: true,
            },
      );
    }),
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("Bifrost isolation and safe projection", () => {
  it("reads a key by ID, applies active override, preserves independent rules and strips secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL, init: RequestInit) => {
        expect(url.pathname).toBe("/api/governance/virtual-keys/vk-a");
        expect(init.headers).toMatchObject({
          Authorization: "Basic dGVzdC1hZG1pbjp0ZXN0LXBhc3N3b3Jk",
        });
        return Response.json({
          virtual_key: {
            id: "vk-a",
            name: "Actual Key",
            is_active: true,
            value: "NEVER-EXPOSE",
            provider_configs: [
              {
                provider: "openai",
                budgets: [
                  {
                    id: "daily",
                    max_limit: 10,
                    current_usage: 3,
                    reset_duration: "1d",
                    last_reset: "2026-10-01T00:00:00Z",
                    override_amount: 5,
                    override_mode: "cycles",
                    override_cycles_remaining: 1,
                  },
                  {
                    id: "month",
                    max_limit: 50,
                    current_usage: 7,
                    reset_duration: "1M",
                    last_reset: "2026-10-01T00:00:00Z",
                  },
                ],
              },
            ],
          },
        });
      }),
    );
    const k = await getVirtualKey("vk-a");
    expect(k.budgets).toHaveLength(2);
    expect(k.budgets[0]).toMatchObject({
      limit: "15",
      used: "3",
      remaining: "12",
      percentage: 20,
    });
    expect(JSON.stringify(k)).not.toContain("NEVER-EXPOSE");
    expect(k.name).toBe("Actual Key");
  });
  it.each([
    [404, "KEY_NOT_FOUND"],
    [401, "BIFROST_AUTH"],
    [500, "BIFROST_UNAVAILABLE"],
    [429, "RATE_LIMITED"],
  ])("maps upstream %s safely", async (status, code) => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("INTERNAL SECRET", { status: Number(status) }),
    );
    await expect(getVirtualKey("vk-a")).rejects.toMatchObject({ code });
  });
  it.each([{ is_active: false }, { expires_at: "2000-01-01T00:00:00Z" }])(
    "denies inactive or expired keys %j",
    async (attrs) => {
      vi.stubGlobal("fetch", async () =>
        Response.json({ virtual_key: { id: "vk-a", name: "A", ...attrs } }),
      );
      await expect(getVirtualKey("vk-a")).rejects.toMatchObject({
        status: 403,
      });
    },
  );
  it("rejects ID substitution in gateway response", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ virtual_key: { id: "vk-b", name: "B" } }),
    );
    await expect(getVirtualKey("vk-a")).rejects.toMatchObject({
      code: "UPSTREAM_SCHEMA",
    });
  });
  it("aggregates actual scoped rows precisely and emits no raw content or IDs", async () => {
    serve();
    const r = await getReport("vk-a", range);
    expect(r.totals).toMatchObject({
      requests: 2,
      inputTokens: 20,
      outputTokens: 10,
      totalTokens: 30,
      cost: "0.000004",
      cachedTokens: 4,
    });
    expect(r.models[0]).toMatchObject({
      provider: "openai",
      model: "model-live",
      requests: 2,
    });
    expect(r.series).toHaveLength(2);
    expect(JSON.stringify(r)).not.toMatch(
      /SECRET|virtual_key_id|vk-a|input_history|raw_response/,
    );
  });
  it("rejects cross-user rows", async () => {
    serve([row("1", "vk-b")]);
    await expect(getReport("vk-a", range)).rejects.toMatchObject({
      code: "ANALYTICS_UNAVAILABLE",
    });
  });
  it("rejects duplicate rows and incomplete pagination", async () => {
    serve([row("1"), row("1")]);
    await expect(getReport("vk-a", range)).rejects.toMatchObject({
      code: "ANALYTICS_UNAVAILABLE",
    });
    serve([], 10);
    await expect(getReport("vk-a", range)).rejects.toMatchObject({
      code: "ANALYTICS_UNAVAILABLE",
    });
  });
  it("rejects silently truncated analytics", async () => {
    serve([], 10001);
    await expect(getReport("vk-a", range)).rejects.toMatchObject({
      code: "ANALYTICS_LIMIT",
    });
  });
  it("rejects comma scope injection before any request", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(getReport("vk-a,vk-b", range)).rejects.toBeDefined();
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects rows outside the requested date range", async () => {
    const r = row("1");
    r.timestamp = "2020-01-01T00:00:00Z";
    serve([r]);
    await expect(getReport("vk-a", range)).rejects.toMatchObject({
      code: "ANALYTICS_UNAVAILABLE",
    });
  });
});
describe("local date boundaries", () => {
  it("converts Tehran dates to UTC with inclusive end matching Bifrost", () => {
    expect(
      parseRange(
        new URLSearchParams("from=2026-10-01&to=2026-10-02"),
        new Date("2026-10-31T12:00:00Z"),
      ),
    ).toMatchObject(range);
  });
  it.each([
    "from=2026-02-30&to=2026-03-01",
    "from=2026-10-02&to=2026-10-01",
    "from=2020-01-01&to=2026-10-01",
    "virtualKeyId=vk-b",
    "from=2026-01-01&from=2026-01-02&to=2026-01-03",
  ])("rejects invalid or scope query %s", (query) => {
    expect(() => parseRange(new URLSearchParams(query))).toThrow();
  });
});

it("uses scoped gateway health stats and derives p95 from verified metadata", async () => {
  serve();
  expect((await getReport("vk-a", range)).health).toEqual({
    successRate: 100,
    userSuccessRate: 100,
    averageLatencyMs: 1200,
    p95LatencyMs: 1200,
  });
});
