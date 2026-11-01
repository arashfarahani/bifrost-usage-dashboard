import { afterEach, expect, it, vi } from "vitest";
import { getVirtualKey, getBudgets } from "@/lib/bifrost/governance";
import { getReport } from "@/lib/bifrost/analytics";
import { parseRange, localBucketDate } from "@/lib/utils/dates";
import { keySchema } from "@/lib/bifrost/schemas";
import { rateLimit } from "@/lib/auth/rate-limit";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("reports SSO redirects explicitly without following them or exposing their location", async () => {
  vi.stubGlobal("fetch", async (_url: URL, init: RequestInit) => {
    expect(init.redirect).toBe("manual");
    return new Response(null, {
      status: 302,
      headers: {
        location: "https://sso.example.test/oauth2/start?secret=DO-NOT-EXPOSE",
      },
    });
  });
  await expect(getVirtualKey("vk-a")).rejects.toMatchObject({
    code: "BIFROST_REDIRECT",
    status: 503,
  });
  try {
    await getVirtualKey("vk-a");
  } catch (error) {
    expect(String(error)).not.toContain("DO-NOT-EXPOSE");
  }
});
it("treats missing analytics routes as unavailable analytics rather than a missing key", async () => {
  vi.stubGlobal(
    "fetch",
    async () => new Response("not found", { status: 404 }),
  );
  const range = parseRange(
    new URLSearchParams("from=2026-10-01&to=2026-10-02"),
  );
  await expect(getReport("vk-a", range)).rejects.toMatchObject({
    code: "ANALYTICS_UNAVAILABLE",
  });
});
it("aborts a hanging Bifrost request and returns a safe timeout", async () => {
  vi.stubEnv("BIFROST_TIMEOUT_MS", "100");
  vi.stubGlobal(
    "fetch",
    (_url: URL, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal!.addEventListener(
          "abort",
          () => reject(init.signal!.reason),
          { once: true },
        );
      }),
  );
  await expect(getVirtualKey("vk-a")).rejects.toMatchObject({
    code: "BIFROST_TIMEOUT",
    status: 504,
  });
});
it("keeps no-budget explicit, ignores expired overrides and clamps overspend remaining to zero", () => {
  const raw = keySchema.parse({
    virtual_key: { id: "vk-a", name: "A", budgets: [] },
  }).virtual_key;
  expect(getBudgets(raw)).toEqual([]);
  raw.provider_configs = [
    {
      provider: "openai",
      budgets: [
        {
          id: "b",
          max_limit: 10,
          current_usage: 12,
          reset_duration: "1d",
          last_reset: "2026-10-31T00:00:00Z",
          override_amount: 5,
          override_mode: "cycles",
          override_cycles_remaining: 0,
        },
      ],
    },
  ];
  expect(getBudgets(raw)[0]).toMatchObject({
    limit: "10",
    used: "12",
    remaining: "0",
    percentage: 120,
    override: null,
  });
});
it("uses calendar boundaries through DST and Saturday-based week grouping", () => {
  const r = parseRange(
    new URLSearchParams("from=2026-03-08&to=2026-03-08"),
    new Date("2026-10-31T00:00:00Z"),
    "America/New_York",
  );
  expect(r.start).toBe("2026-03-08T05:00:00.000Z");
  expect(r.end).toBe("2026-03-09T03:59:59.999999999Z");
  expect(localBucketDate("2026-10-01", "week")).toBe("2026-09-26");
  expect(localBucketDate("2026-10-31", "month")).toBe("2026-10-01");
});
it("expires local rate counters instead of permanently blocking a credential", () => {
  vi.useFakeTimers({ now: new Date("2026-10-31T00:00:00Z") });
  rateLimit("test-bounded-counter", "test-credential", 1);
  expect(() =>
    rateLimit("test-bounded-counter", "test-credential", 1),
  ).toThrow();
  vi.advanceTimersByTime(60000);
  expect(() =>
    rateLimit("test-bounded-counter", "test-credential", 1),
  ).not.toThrow();
});
