"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import type { UsageDTO } from "@/types/dashboard";
import { number } from "@/lib/utils/formatters";
const config = { requests: { label: "Requests", color: "var(--chart-1)" } };
export function UsageCharts({ usage }: { usage: UsageDTO }) {
  return (
    <Card className="min-w-0 border-border/70 shadow-sm shadow-black/[0.02]">
      <CardHeader>
        <CardTitle>Request Volume</CardTitle>
        <CardDescription>
          Requests in your selected period · {usage.range.timezone}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart
            accessibilityLayer
            data={usage.series}
            margin={{ right: 16 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => String(v).slice(5)}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={number}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="requests"
              fill="var(--color-requests)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ChartContainer>
        <details className="text-muted-foreground mt-4 text-xs">
          <summary className="cursor-pointer">View request counts</summary>
          <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
            {usage.series.map((s) => (
              <li key={s.date} className="flex justify-between">
                <time>{s.date}</time>
                <span>{number(s.requests)}</span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
