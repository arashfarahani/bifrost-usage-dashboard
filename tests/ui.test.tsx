// @vitest-environment jsdom
import React from "react";
import { getAppName } from "@/config/branding";
import { Dashboard } from "@/components/dashboard/dashboard";
import { afterEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { AccessGate } from "@/components/access-gate";
import { ModelsTable } from "@/components/dashboard/models-table";
import { Progress } from "@/components/ui/progress";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("announces the actual budget percentage to assistive technology", () => {
  render(<Progress value={25} aria-label="Budget" />);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "25",
  );
});
it("removes fragment before sending bearer credential to the backend", async () => {
  window.history.replaceState({}, "", "/access#token=encrypted-personal-token");
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    expect(window.location.hash).toBe("");
    expect(JSON.parse(init.body as string)).toEqual({
      token: "encrypted-personal-token",
    });
    return Response.json(
      { error: { message: "لینک منقضی است" } },
      { status: 401 },
    );
  });
  render(<AccessGate />);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("لینک منقضی است"),
  );
});
it("paginates and sorts real model DTOs", () => {
  const models = Array.from({ length: 12 }, (_, i) => ({
    provider: "actual-provider",
    model: `model-${i + 1}`,
    requests: i + 1,
    inputTokens: 1,
    outputTokens: 1,
    totalTokens: 2,
    cachedTokens: null,
    cost: String(i + 1),
    percentage: 1,
  }));
  render(<ModelsTable models={models} />);
  expect(screen.getAllByRole("row")).toHaveLength(11);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getAllByRole("row")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Sort by Model" }));
  expect(screen.getAllByRole("row")).toHaveLength(11);
});
it("ranks models by highest cost and allows highest token usage first", () => {
  const metrics = {
    provider: "provider",
    requests: 1,
    inputTokens: 1,
    outputTokens: 1,
    cachedTokens: null,
    percentage: 50,
  };
  render(
    <ModelsTable
      models={[
        { ...metrics, model: "cost-leader", cost: "3", totalTokens: 2 },
        { ...metrics, model: "token-leader", cost: "1", totalTokens: 100 },
      ]}
    />,
  );
  expect(screen.getAllByRole("row")[1].textContent).toContain("cost-leader");
  fireEvent.click(screen.getByRole("button", { name: "Sort by Total tokens" }));
  expect(screen.getAllByRole("row")[1].textContent).toContain("token-leader");
});
it("shows the reset estimate in English without exposing gateway branding", () => {
  render(
    <BudgetProgress
      budgets={[]}
      selected={{
        id: "b",
        scope: "Personal key",
        limit: "30",
        used: "5",
        remaining: "25",
        percentage: 16.7,
        resetPeriod: "1M",
        lastReset: "2026-10-01T00:00:00Z",
        nextReset: "2026-10-31T20:30:00.000Z",
        nextResetEstimated: true,
        override: null,
      }}
      timezone="Asia/Tehran"
      onSelect={() => {}}
    />,
  );
  expect(screen.getByText("Next reset")).toBeDefined();
  expect(screen.getByText("Estimated")).toBeDefined();
  expect(screen.getByText(/Nov 1, 2026/)).toBeDefined();
  expect(document.body.textContent).not.toMatch(/[\u0600-\u06ff]|Bifrost/);
});

it("shows the runtime legacy name in the dashboard header", () => {
  vi.stubEnv("APP_NAME", undefined);
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Team usage portal");
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  render(<Dashboard timezone="UTC" appName={getAppName()}/>);
  expect(screen.getByRole("heading", {level:1,name:"Team usage portal"})).toBeDefined();
});
