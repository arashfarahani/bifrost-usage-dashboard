"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RequestVolumeDTO } from "@/types/dashboard";
import { number } from "@/lib/utils/formatters";
const config = {
  requests: { label: "Total", color: "var(--chart-2)" },
  success: { label: "Success", color: "var(--chart-1)" },
  error: { label: "Error", color: "var(--chart-5)" },
  cancelled: { label: "Cancelled", color: "var(--muted-foreground)" },
};
const statuses = ["success", "error", "cancelled"] as const;
type Point = RequestVolumeDTO["series"][number];

// Include Total in the tooltip without plotting it as another series.
export function RequestVolumeTooltip({ active, entry }: { active?: boolean; entry?: Point }) {
  return (
    <ChartTooltipContent
      active={active}
      label={entry ? format(parseISO(entry.date), "MMM d, yyyy") : undefined}
      className="min-w-48 gap-3 rounded-lg p-4 text-sm"
      formatter={(value, name) => {
        const key = name as keyof typeof config;
        const color = config[key].color;
        return (
          <>
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground flex flex-1 items-center justify-between gap-6">
              <span>{config[key].label}</span>
              <span className="font-medium tabular-nums" style={{ color }}>{number(Number(value))}</span>
            </span>
          </>
        );
      }}
      payload={entry ? (["requests", ...statuses] as const).map((key) => ({
        dataKey: key,
        graphicalItemId: key,
        name: key,
        value: entry[key],
        color: config[key].color,
        payload: entry,
      })) : []}
    />
  );
}
export function UsageCharts({ usage }: { usage: RequestVolumeDTO }) {
  return (
    <Card className="min-w-0 border-border/70 shadow-sm shadow-black/[0.02]">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Request Volume</CardTitle>
          <CardDescription className="mt-2">
            Requests in your selected period · {usage.range.timezone}
          </CardDescription>
        </div>
        <ul aria-label="Request statuses" className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {statuses.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: config[key].color }} />
              {config[key].label}
            </li>
          ))}
        </ul>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full sm:h-64">
          <BarChart
            accessibilityLayer
            data={usage.series}
            barCategoryGap="8%"
            margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(String(value)), "MMM d")}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              minTickGap={48}
            />
            <YAxis
              tickFormatter={number}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={44}
            />
            <ChartTooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }}
              content={({ active, payload }) => (
                <RequestVolumeTooltip active={active} entry={payload?.[0]?.payload as Point | undefined} />
              )}
            />
            <Bar
              name="Success"
              dataKey="success"
              stackId="requests"
              fill="var(--color-success)"
              fillOpacity={0.9}
              maxBarSize={56}
              isAnimationActive={false}
            />
            <Bar
              name="Error"
              dataKey="error"
              stackId="requests"
              fill="var(--color-error)"
              fillOpacity={0.9}
              maxBarSize={56}
              isAnimationActive={false}
            />
            <Bar
              name="Cancelled"
              dataKey="cancelled"
              stackId="requests"
              fill="var(--color-cancelled)"
              fillOpacity={0.65}
              maxBarSize={56}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
        <details className="text-muted-foreground mt-4 text-xs">
          <summary className="cursor-pointer">View request counts</summary>
          <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
            {usage.series.map((s) => (
              <li key={s.date} className="flex flex-wrap justify-between gap-3">
                <time>{s.date}</time>
                <span>
                  Total {number(s.requests)} · Success {number(s.success)} · Error {number(s.error)} · Cancelled {number(s.cancelled)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
