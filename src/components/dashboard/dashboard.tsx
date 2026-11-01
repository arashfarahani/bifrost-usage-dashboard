"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Cpu, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { OverviewCards } from "./overview-cards";
import { BudgetProgress } from "./budget-progress";
import { DateRangeFilter, type DateSelection } from "./date-range-filter";
import { UsageCharts } from "./usage-charts";
import { ModelsTable } from "./models-table";
import { defaultDateSelection } from "@/lib/utils/dates";
import type { SessionDTO, UsageDTO } from "@/types/dashboard";
type Overview = {
  session: SessionDTO;
  usage: UsageDTO | null;
  analyticsError: { code: string; message: string } | null;
};
export function Dashboard({
  timezone,
  appName,
}: {
  timezone: string;
  appName: string;
}) {
  const [dates, setDates] = useState<DateSelection>(() =>
    defaultDateSelection(timezone),
  );
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [budgetId, setBudgetId] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const query = new URLSearchParams(dates).toString();
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`/api/dashboard/overview?${query}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const value = await r.json();
        if (!r.ok)
          throw new Error(
            value.error?.message ?? "Unable to load your report.",
          );
        if (!controller.signal.aborted) setData(value);
      } catch (e) {
        if (!controller.signal.aborted) {
          const message =
            e instanceof Error
              ? e.message
              : "Unable to connect to the service.";
          setError(message);
          setData(null);
          toast.error(message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query, retry]);
  async function logout() {
    setLoggingOut(true);
    try {
      const r = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error();
      window.location.replace("/");
    } catch {
      toast.error("Unable to sign out. Please try again.");
      setLoggingOut(false);
    }
  }
  const budgets = data?.session.key.budgets ?? [];
  const selected = budgets.find((b) => b.id === budgetId) ?? budgets[0];
  return (
    <div className="min-h-screen">
      <header className="bg-card/90 sticky top-0 z-30 border-b border-border/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl shadow-md shadow-primary/15">
              <Cpu className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold" dir="ltr">
                {appName}
              </h1>
              <p className="text-muted-foreground mt-1 text-xs">
                Your AI usage, in focus.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button variant="outline" disabled={loggingOut} onClick={logout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-2">
            <p className="text-primary flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em]">
              <Activity className="size-3.5" />
              WORKSPACE / PERSONAL USAGE
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {data
                ? `Welcome back, ${data.session.displayName}`
                : "Usage overview"}
            </h2>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              {data && (
                <>
                  <bdi>{data.session.key.name}</bdi>
                  <Badge variant="secondary" className="text-primary">
                    <span className="bg-primary size-1.5 rounded-full" />
                    Active
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter
              timezone={timezone}
              value={dates}
              onChange={setDates}
            />
            <Button
              size="icon"
              variant="outline"
              aria-label="Refresh report"
              disabled={loading}
              onClick={() => setRetry((v) => v + 1)}
            >
              <RefreshCw
                className={`size-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          <bdi>{dates.from}</bdi> – <bdi>{dates.to}</bdi> · Date ·{" "}
          <bdi>{timezone}</bdi>
        </p>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load report</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{error}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  Try again
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/access">Open access link</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : loading ? (
          <div
            role="status"
            aria-label="Loading your usage report"
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-48" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          </div>
        ) : (
          data && (
            <>
              <OverviewCards budget={selected} usage={data.usage} />
              <BudgetProgress
                budgets={budgets}
                selected={selected}
                onSelect={setBudgetId}
                timezone={timezone}
              />
              {data.analyticsError ? (
                <Alert>
                  <AlertTitle>Usage history unavailable</AlertTitle>
                  <AlertDescription>
                    {data.analyticsError.message}
                  </AlertDescription>
                </Alert>
              ) : (
                data.usage && (
                  <>
                    {data.usage.incompleteMetrics && (
                      <Alert>
                        <AlertDescription>
                          The LLM Gateway did not report every cost or token
                          value. Unavailable metrics are shown as a dash.
                        </AlertDescription>
                      </Alert>
                    )}
                    <ModelsTable models={data.usage.models} />
                    {data.usage.empty ? (
                      <Alert>
                        <AlertTitle>No usage yet</AlertTitle>
                        <AlertDescription>
                          No requests were recorded for this period. Logging may
                          be disabled, or older records may have expired.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <UsageCharts usage={data.usage} />
                    )}
                  </>
                )
              )}
            </>
          )
        )}
        <footer className="text-muted-foreground flex flex-wrap justify-between gap-3 border-t pt-5 text-xs leading-6">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Read-only insights · LLM Gateway
          </span>
          <span>History follows your LLM Gateway retention settings.</span>
        </footer>
      </main>
    </div>
  );
}
