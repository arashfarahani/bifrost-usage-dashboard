import { CalendarClock, Wallet } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { BudgetDTO } from "@/types/dashboard";
import { money, percent } from "@/lib/utils/formatters";
export function BudgetProgress({
  budgets,
  selected,
  onSelect,
  timezone = "Asia/Tehran",
}: {
  budgets: BudgetDTO[];
  selected?: BudgetDTO;
  onSelect: (id: string) => void;
  timezone?: string;
}) {
  const percentage = selected?.percentage;
  const color =
    percentage == null
      ? ""
      : percentage < 70
        ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
        : percentage <= 90
          ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
          : "[&_[data-slot=progress-indicator]]:bg-red-500";
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm shadow-black/[0.02]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="text-primary size-4" />
            Budget health
          </CardTitle>
          {selected && (
            <Select value={selected.id} onValueChange={onSelect}>
              <SelectTrigger
                className="max-w-full sm:w-72"
                aria-label="Select budget rule"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {budgets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.scope} / {b.resetPeriod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <CardDescription>
          Your current budget cycle is independent of the reporting period.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">
                    Available to spend
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight">
                    {money(selected.remaining)}
                  </p>
                </div>
                <p className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">
                    {money(selected.used)}
                  </span>{" "}
                  of {money(selected.limit)} used
                </p>
              </div>
              <Progress
                value={
                  percentage == null
                    ? null
                    : Math.min(100, Math.max(0, percentage))
                }
                className={`h-2.5 ${color}`}
                aria-label="Budget utilization"
              />
              <div className="text-muted-foreground flex flex-wrap justify-between gap-3 text-xs">
                <span>{percent(percentage)} utilized</span>
                <span>
                  Reset period: <bdi>{selected.resetPeriod}</bdi>
                </span>
              </div>
              {selected.override && (
                <Badge variant="secondary">
                  Active budget increase: {money(selected.override)}
                </Badge>
              )}
              {budgets.length > 1 && (
                <p className="text-muted-foreground text-xs leading-6">
                  Each budget rule applies independently. Select a rule to view
                  its balance.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm leading-7">
              No budget is configured for this key in the LLM Gateway. The limit
              and available balance are unknown.
            </p>
          )}
        </div>
        <div className="bg-primary/[0.04] flex flex-col justify-center gap-3 rounded-xl border border-primary/10 p-5">
          <div className="text-primary flex items-center gap-2">
            <CalendarClock className="size-4" />
            <h3 className="text-sm font-medium">Next reset</h3>
          </div>
          {selected?.nextReset ? (
            <>
              <p className="text-xl font-semibold tracking-tight">
                <time dateTime={selected.nextReset}>
                  {formatInTimeZone(
                    selected.nextReset,
                    timezone,
                    "MMM d, yyyy",
                  )}
                </time>
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background text-[10px]">
                  {selected.nextResetEstimated ? "Estimated" : "Scheduled"}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {timezone}
                </span>
              </div>
              <p className="text-muted-foreground text-xs leading-5">
                {selected.nextResetEstimated
                  ? "Based on the first day of next month. The actual gateway reset may differ."
                  : "Scheduled by your LLM Gateway."}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Not available without a budget rule.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
