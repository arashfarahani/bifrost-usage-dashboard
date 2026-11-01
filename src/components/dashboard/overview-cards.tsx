import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  CircleDollarSign,
  Coins,
  Gauge,
  Send,
  Layers,
  Receipt,
  CheckCircle2,
  UserCheck,
  Timer,
} from "lucide-react";
import type { BudgetDTO, UsageDTO } from "@/types/dashboard";
import { money, number, percent, compactNumber } from "@/lib/utils/formatters";
export function OverviewCards({
  budget,
  usage,
}: {
  budget?: BudgetDTO;
  usage: UsageDTO | null;
}) {
  const cards = [
    {
      label: "Total budget",
      value: budget ? money(budget.limit) : "Not configured",
      icon: Wallet,
      hint: "Current budget cycle",
    },
    {
      label: "Budget used",
      value: budget ? money(budget.used) : "—",
      icon: CircleDollarSign,
      hint: "Current budget cycle",
    },
    {
      label: "Budget remaining",
      value: budget ? money(budget.remaining) : "—",
      icon: Coins,
      hint: "Current budget cycle",
    },
    {
      label: "Budget utilization",
      value: budget ? percent(budget.percentage) : "—",
      icon: Gauge,
      hint: "Current budget cycle",
    },
    {
      label: "Total requests",
      value: number(usage?.totals.requests),
      icon: Send,
      hint: "Selected period",
    },
    {
      label: "Total tokens",
      value: compactNumber(usage?.totals.totalTokens),
      icon: Layers,
      hint: `Input ${compactNumber(usage?.totals.inputTokens)} / Output ${compactNumber(usage?.totals.outputTokens)}`,
    },
    {
      label: "Total cost",
      value: money(usage?.totals.cost),
      icon: Receipt,
      hint: "Selected period · USD",
    },
    {
      label: "Success Rate",
      value:
        usage?.health.successRate == null
          ? "—"
          : `${usage.health.successRate.toFixed(2)}%`,
      icon: CheckCircle2,
      hint: "Successful gateway attempts",
    },
    {
      label: "User Success",
      value:
        usage?.health.userSuccessRate == null
          ? "—"
          : `${usage.health.userSuccessRate.toFixed(2)}%`,
      icon: UserCheck,
      hint: "Final outcome after fallbacks",
    },
    {
      label: "Avg Latency",
      value:
        usage?.health.averageLatencyMs == null
          ? "—"
          : `${number(usage.health.averageLatencyMs)} ms`,
      icon: Timer,
      hint:
        usage?.health.p95LatencyMs == null
          ? "p95 unavailable"
          : `p95 ${(usage.health.p95LatencyMs / 1000).toFixed(1)}s`,
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
      {cards.map((c) => (
        <Card
          key={c.label}
          className={`gap-0 border-border/70 py-5 shadow-sm shadow-black/[0.02] transition-colors hover:border-primary/25 ${["Total budget", "Budget used", "Budget remaining", "Budget utilization"].includes(c.label) ? "xl:col-span-3" : "xl:col-span-4"} ${c.label === "Budget remaining" ? "bg-primary/[0.035] border-primary/15" : ""}`}
        >
          <CardContent className="space-y-3 px-5">
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <span>{c.label}</span>
              <span className="bg-muted/70 rounded-lg p-2">
                <c.icon className="size-3.5" />
              </span>
            </div>
            <p
              className="text-[1.75rem] font-semibold tracking-tight tabular-nums"
              dir="auto"
            >
              {c.value}
            </p>
            <p className="text-muted-foreground text-xs">{c.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
