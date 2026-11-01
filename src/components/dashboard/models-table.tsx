"use client";
import { useState } from "react";
import Decimal from "decimal.js";
import { ArrowUpDown, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ModelDTO } from "@/types/dashboard";
import { money, number, percent } from "@/lib/utils/formatters";
export function ModelsTable({ models }: { models: ModelDTO[] }) {
  const [sort, setSort] = useState<keyof ModelDTO>("cost");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const sorted = [...models].sort((a, b) => {
    const x = a[sort],
      y = b[sort];
    if (x == null && y == null) return a.model.localeCompare(b.model);
    if (x == null) return 1;
    if (y == null) return -1;
    const n =
      sort === "provider" || sort === "model"
        ? String(x).localeCompare(String(y))
        : new Decimal(x).cmp(new Decimal(y));
    return (ascending ? n : -n) || a.model.localeCompare(b.model);
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const columns: { key: keyof ModelDTO; label: string }[] = [
    { key: "model", label: "Model" },
    { key: "provider", label: "Provider" },
    { key: "requests", label: "Requests" },
    { key: "inputTokens", label: "Input tokens" },
    { key: "outputTokens", label: "Output tokens" },
    { key: "totalTokens", label: "Total tokens" },
    { key: "cost", label: "Cost" },
    { key: "percentage", label: "Cost share" },
  ];
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm shadow-black/[0.02]">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="text-primary size-4" />
            Model usage
          </CardTitle>
          <Badge variant="secondary">{number(models.length)} models</Badge>
        </div>
        <CardDescription>
          Your models ranked by cost. Sort any metric to explore consumption.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!models.length ? (
          <p className="text-muted-foreground py-10 text-center">
            No model usage recorded for this period.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12 text-xs">#</TableHead>
                  {columns.map((c) => (
                    <TableHead
                      key={c.key}
                      aria-sort={
                        sort === c.key
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ms-2 whitespace-nowrap text-xs"
                        aria-label={`Sort by ${c.label}`}
                        onClick={() => {
                          setAscending(
                            sort === c.key
                              ? !ascending
                              : ["model", "provider"].includes(c.key),
                          );
                          setSort(c.key);
                          setPage(0);
                        }}
                      >
                        {c.label}
                        <ArrowUpDown className="size-3" />
                      </Button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted
                  .slice(currentPage * 10, currentPage * 10 + 10)
                  .map((m, index) => (
                    <TableRow
                      key={JSON.stringify([m.provider, m.model])}
                      className="h-16"
                    >
                      <TableCell className="text-muted-foreground text-xs tabular-nums">
                        {String(currentPage * 10 + index + 1).padStart(2, "0")}
                      </TableCell>
                      {columns.map((c) => (
                        <TableCell
                          key={c.key}
                          className={`whitespace-nowrap tabular-nums ${c.key === "model" ? "font-medium" : ""}`}
                        >
                          {c.key === "provider" ? (
                            <Badge variant="outline" className="font-normal">
                              {m.provider}
                            </Badge>
                          ) : c.key === "model" ? (
                            m.model
                          ) : c.key === "cost" ? (
                            <span className="font-medium">{money(m.cost)}</span>
                          ) : c.key === "percentage" ? (
                            <div className="flex min-w-28 items-center gap-3">
                              <Progress
                                value={m.percentage}
                                className="h-1.5 w-16"
                                aria-label={`${m.model} cost share`}
                              />
                              <span className="text-muted-foreground text-xs">
                                {percent(m.percentage)}
                              </span>
                            </div>
                          ) : (
                            number(m[c.key] as number | null)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            <div className="mt-5 flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                Page {number(currentPage + 1)} of {number(pageCount)}
              </p>
              <div className="flex gap-1">
                <Button
                  aria-label="Previous page"
                  size="icon"
                  variant="outline"
                  disabled={!currentPage}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  aria-label="Next page"
                  size="icon"
                  variant="outline"
                  disabled={currentPage + 1 >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
