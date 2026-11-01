// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { UsageCharts, RequestVolumeTooltip } from "@/components/dashboard/usage-charts";
import { ChartContainer } from "@/components/ui/chart";
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: ({children}: {children: React.ReactElement<{width:number; height:number}>}) => React.cloneElement(children, {width:800,height:256}) };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("exposes all histogram statuses and keeps zero-count periods accessible", () => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {} unobserve() {} disconnect() {}
  });
  const {container} = render(<UsageCharts usage={{
    range: { from: "2026-10-01", to: "2026-10-02", start: "2026-10-01T00:00:00Z", end: "2026-10-02T23:59:59Z", timezone: "UTC", grouping: "day" },
    series: [
      {date:"2026-10-01",requests:65,success:60,error:4,cancelled:1},
      {date:"2026-10-02",requests:0,success:0,error:0,cancelled:0},
    ],
  }}/>);
  const rect = (key: string) => container.querySelector(`.recharts-bar-rectangle path[fill="var(--color-${key})"]`)!;
  const success = rect("success"), error = rect("error"), cancelled = rect("cancelled");
  expect(success).not.toBeNull();
  expect(error).not.toBeNull();
  expect(cancelled).not.toBeNull();
  expect(error.getAttribute("x")).toBe(success.getAttribute("x"));
  expect(Number(error.getAttribute("y"))).toBeLessThan(Number(success.getAttribute("y")));
  expect(Number(cancelled.getAttribute("y"))).toBeLessThan(Number(error.getAttribute("y")));
  expect(Number(success.getAttribute("height")) / Number(error.getAttribute("height"))).toBeCloseTo(60 / 4);
  expect(Number(error.getAttribute("y")) + Number(error.getAttribute("height"))).toBeCloseTo(Number(success.getAttribute("y")));
  expect(container.querySelectorAll(".recharts-bar")).toHaveLength(3);
  expect(container.querySelector(".recharts-line")).toBeNull();
  expect(Number(success.getAttribute("fill-opacity"))).toBeGreaterThanOrEqual(0.9);
  expect(screen.getByText("Requests in your selected period · UTC")).toBeDefined();
  expect(screen.getByRole("list", {name:"Request statuses"}).textContent).toBe("SuccessErrorCancelled");
  expect(screen.getByText("Total 65 · Success 60 · Error 4 · Cancelled 1")).toBeDefined();
  expect(screen.getByText("Total 0 · Success 0 · Error 0 · Cancelled 0")).toBeDefined();
});

it("shows Total and every status in the tooltip even when all counts are zero", () => {
  const {container} = render(<ChartContainer config={{
    requests:{label:"Total"}, success:{label:"Success"}, error:{label:"Error"}, cancelled:{label:"Cancelled"},
  }}>
    <RequestVolumeTooltip active entry={{date:"2026-10-02",requests:0,success:0,error:0,cancelled:0}} />
  </ChartContainer>);
  for (const label of ["Total", "Success", "Error", "Cancelled"]) expect(screen.getByText(label)).toBeDefined();
  expect(within(container).getAllByText("0")).toHaveLength(4);
  expect(screen.getByText("Oct 2, 2026")).toBeDefined();
});

it("shows a mixed success/error bucket with its own tooltip colors", () => {
  const {container} = render(<ChartContainer config={{requests:{label:"Total"}}}>
    <RequestVolumeTooltip active entry={{date:"2026-10-25",requests:140,success:70,error:70,cancelled:0}} />
  </ChartContainer>);
  expect(within(container).getByText("140")).toBeDefined();
  const errorRow = within(container).getByText("Error").parentElement!;
  expect(within(errorRow).getByText("70").style.color).toBe("var(--chart-5)");
  const successRow = within(container).getByText("Success").parentElement!;
  expect(within(successRow).getByText("70").style.color).toBe("var(--chart-1)");
});
