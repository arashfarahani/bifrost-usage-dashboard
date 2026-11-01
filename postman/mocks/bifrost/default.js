/* Test-only fixtures derived from the pinned Bifrost source contract.
 * Never loaded by production code. Unknown routes deliberately return 501. */
const http = require("http");
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://test.invalid");
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "GET") return send(501, { error: "unmodeled method" });
    if (
      req.headers.authorization !==
      "Basic " + Buffer.from("test-admin:test-password").toString("base64")
    )
      return send(401, { error: "Unauthorized" });
    const match = /^\/api\/governance\/virtual-keys\/([^/]+)$/.exec(
      url.pathname,
    );
    if (match) {
      if (match[1] === "missing")
        return send(404, { error: "Virtual key not found" });
      if (match[1] === "unavailable")
        return send(503, { error: "Upstream unavailable" });
      if (!["vk-a", "vk-b", "inactive"].includes(match[1]))
        return send(404, { error: "Virtual key not found" });
      return send(200, {
        virtual_key: {
          id: match[1],
          name: "Integration fixture " + match[1],
          is_active: match[1] !== "inactive",
          value: "TEST-SECRET-MUST-BE-STRIPPED",
          provider_configs: [{provider: "fixture-provider", budgets: [
            {
              id: "test-daily",
              max_limit: 10,
              current_usage: 1,
              reset_duration: "1d",
              last_reset: "2026-10-31T00:00:00Z",
            },
          ]}],
        },
      });
    }
    if (!["/api/logs", "/api/logs/stats"].includes(url.pathname))
      return send(501, { error: "unmodeled route" });
    const key = url.searchParams.get("virtual_key_ids");
    if (
      !["vk-a", "vk-b"].includes(key) ||
      !url.searchParams.has("start_time") ||
      !url.searchParams.has("end_time")
    )
      return send(400, { error: "scope and explicit dates required" });
    const timestamp = new Date(
      (Date.parse(url.searchParams.get("start_time")) +
        Date.parse(url.searchParams.get("end_time"))) /
        2,
    ).toISOString();
    const cost = key === "vk-a" ? 0.125 : 2.5;
    if (url.pathname.endsWith("/stats"))
      return send(200, {
        total_requests: 1,
        success_rate: 100,
        user_facing_success_rate: 100,
        average_latency: 1200,
        total_cost: cost,
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      });
    return send(200, {
      logs:
        Number(url.searchParams.get("offset")) > 0
          ? []
          : [
              {
                id: key + "-request",
                virtual_key_id: key,
                timestamp,
                provider: "fixture-provider",
                model: "fixture-model",
                status: "success",
                latency: 1200,
                cost,
                token_usage: {
                  prompt_tokens: 20,
                  completion_tokens: 10,
                  total_tokens: 30,
                  prompt_tokens_details: { cached_read_tokens: 5 },
                },
                input_history: [{ content: "TEST-PRIVATE-PROMPT" }],
              },
            ],
      pagination: {
        total_count: 1,
        offset: Number(url.searchParams.get("offset")),
        limit: 200,
      },
      has_logs: true,
    });
  })
  .listen(process.env.PORT || 4500);
