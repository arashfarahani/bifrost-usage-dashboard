import { afterEach, expect, it, vi } from "vitest";
import { getReport } from "@/lib/bifrost/analytics";
import { parseRange } from "@/lib/utils/dates";
import { rowSchema } from "@/lib/bifrost/schemas";
const range = {
  from: "2026-10-01",
  to: "2026-10-03",
  start: "2026-09-30T20:30:00.000Z",
  end: "2026-10-03T20:29:59.999999999Z",
  timezone: "Asia/Tehran",
  grouping: "day" as const,
};
const log = (id: string, timestamp = "2026-10-01T12:00:00Z") => ({
  id,
  virtual_key_id: "vk-a",
  timestamp,
  provider: "p",
  model: "m",
  status: "success",
  cost: 0,
  token_usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
});
function upstream(rows: unknown[], reported = rows.length) {
  vi.stubGlobal("fetch", async (url: URL) =>
    Response.json(
      url.pathname.endsWith("/stats")
        ? {
            total_requests: reported,
            total_cost: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          }
        : {
            logs: rows.slice(
              Number(url.searchParams.get("offset")),
              Number(url.searchParams.get("offset")) +
                Number(url.searchParams.get("limit")),
            ),
            pagination: {
              total_count: reported,
              offset: Number(url.searchParams.get("offset")),
              limit: Number(url.searchParams.get("limit")),
            },
            has_logs: true,
          },
    ),
  );
}
afterEach(() => vi.unstubAllGlobals());
it("rejects extra raw rows hidden by stale materialized totals", async () => {
  upstream(
    Array.from({ length: 201 }, (_, i) => log(String(i))),
    200,
  );
  await expect(getReport("vk-a", range)).rejects.toMatchObject({
    code: "ANALYTICS_UNAVAILABLE",
  });
});
it("accepts upstream omitempty zeros for embeddings without discarding the report", async () => {
  const embedding = {
    ...log("one"),
    token_usage: { prompt_tokens: 10, total_tokens: 10 },
  };
  expect(rowSchema.safeParse(embedding).success).toBe(true);
  upstream([embedding]);
  const report = await getReport("vk-a", range);
  expect(report.totals).toMatchObject({
    inputTokens: 10,
    outputTokens: 0,
    totalTokens: 10,
  });
  expect(
    rowSchema.parse({ ...log("zero"), token_usage: { total_tokens: 0 } })
      .token_usage,
  ).toMatchObject({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  expect(
    rowSchema.parse({ ...log("unknown"), token_usage: null }).token_usage,
  ).toBeNull();
});
it("sends the final nanosecond of completed local days to Bifrost", () => {
  const r = parseRange(
    new URLSearchParams("from=2026-10-02&to=2026-10-02"),
    new Date("2026-10-31T00:00:00Z"),
  );
  expect(r.end).toBe("2026-10-02T20:29:59.999999999Z");
});
it("fills zero-use days between active days without bridging them", async () => {
  upstream([log("1"), log("3", "2026-10-03T12:00:00Z")]);
  const r = await getReport("vk-a", range);
  expect(r.series.map((s) => [s.date, s.requests, s.cost])).toEqual([
    ["2026-10-01", 1, "0"],
    ["2026-10-02", 0, "0"],
    ["2026-10-03", 1, "0"],
  ]);
});
it("excludes unnamed model-discovery logs from rankings without dropping them from totals", async () => {
  upstream([
    {
      ...log("discovery"),
      model: "",
      object: "list_models",
      cost: 0,
      token_usage: { total_tokens: 0 },
    },
    { ...log("named"), model: "actual-model", cost: 0.25 },
  ]);
  const report = await getReport("vk-a", range);
  expect(report.models.map((m) => m.model)).toEqual(["actual-model"]);
  expect(report.models[0].requests).toBe(1);
  expect(report.totals.requests).toBe(2);
  expect(report.totals.cost).toBe("0.25");
  expect(report.series[0].requests).toBe(2);
});
it("does not rank processing or whitespace-only model entries", async () => {
  upstream([
    { ...log("pending"), status: "processing" },
    { ...log("blank"), model: "   " },
  ]);
  const report = await getReport("vk-a", range);
  expect(report.models).toEqual([]);
  expect(report.totals.requests).toBe(2);
});
it("defaults history to seven calendar days in the configured timezone", () => {
  const reportRange = parseRange(
    new URLSearchParams(),
    new Date("2026-11-01T12:00:00Z"),
    "Asia/Tehran",
  );
  expect(reportRange.from).toBe("2026-10-26");
  expect(reportRange.to).toBe("2026-11-01");
});
