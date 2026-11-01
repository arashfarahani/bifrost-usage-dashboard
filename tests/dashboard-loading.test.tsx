// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Dashboard } from "@/components/dashboard/dashboard";
vi.mock("@/components/dashboard/usage-charts", () => ({ UsageCharts: () => <div>Loaded request volume</div> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("renders totals before requesting details and keeps them when model loading fails", async () => {
  let failModels!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { failModels = resolve; });
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url.split("?")[0]);
    if (url.startsWith("/api/dashboard/models")) return pending;
    if (url.startsWith("/api/dashboard/charts")) return Response.json({ range: { timezone: "UTC" }, series: [] });
    return Response.json({
session: { displayName: "Arash", key: { name: "Personal", budgets: [] } }, usage: {
        totals: { requests: 65, totalTokens: 718, inputTokens: 694, outputTokens: 24, cost: "10.38" },
        health: { successRate: 100, userSuccessRate: 100, averageLatencyMs: 9791, p95LatencyMs: null },
        empty: false, incompleteMetrics: false, models: [], series: []
}, analyticsError: null
});
  });
  render(<Dashboard timezone="UTC" appName="Usage" />);
  await screen.findByText("718");
  await screen.findByText("Loaded request volume");
  expect(screen.getByRole("status", { name: "Loading model usage" })).toBeDefined();
  expect(calls[0]).toBe("/api/dashboard/overview");
  expect(calls).toContain("/api/dashboard/models");
  failModels(Response.json({ error: { message: "Model details timed out." } }, { status: 504 }));
  await waitFor(() => expect(screen.getByText("Model details timed out.")).toBeDefined());
  expect(screen.getByText("718")).toBeDefined();
});
