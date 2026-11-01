import {
  addDays,
  addMonths,
  startOfMonth,
  startOfWeek,
  format,
  parseISO,
  subMonths,
  differenceInCalendarDays,
} from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { Range } from "@/types/dashboard";
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = parseISO(v);
    return !Number.isNaN(+d) && format(d, "yyyy-MM-dd") === v;
  });
const querySchema = z
  .object({
    from: day,
    to: day,
    grouping: z.enum(["day", "week", "month"]).default("day"),
  })
  .strict();
export function nextMonthlyReset(timezone: string, now = new Date()): string {
  const localDay = parseISO(formatInTimeZone(now, timezone, "yyyy-MM-dd"));
  const nextMonth = format(startOfMonth(addMonths(localDay, 1)), "yyyy-MM-dd");
  return fromZonedTime(`${nextMonth}T00:00:00`, timezone).toISOString();
}
export function presets(timezone: string, now = new Date()) {
  const today = parseISO(formatInTimeZone(now, timezone, "yyyy-MM-dd"));
  const f = (d: Date) => format(d, "yyyy-MM-dd");
  return [
    { id: "today", label: "Today", from: f(today), to: f(today) },
    {
      id: "yesterday",
      label: "Yesterday",
      from: f(addDays(today, -1)),
      to: f(addDays(today, -1)),
    },
    {
      id: "7d",
      label: "Last 7 days",
      from: f(addDays(today, -6)),
      to: f(today),
    },
    {
      id: "30d",
      label: "Last 30 days",
      from: f(addDays(today, -29)),
      to: f(today),
    },
    {
      id: "month",
      label: "This month",
      from: f(startOfMonth(today)),
      to: f(today),
    },
    {
      id: "lastMonth",
      label: "Last month",
      from: f(startOfMonth(subMonths(today, 1))),
      to: f(addDays(startOfMonth(today), -1)),
    },
  ];
}
export function defaultDateSelection(timezone: string, now = new Date()) {
  const range = presets(timezone, now).find((preset) => preset.id === "7d")!;
  return { from: range.from, to: range.to, grouping: "day" as const };
}
export function parseRange(
  params: URLSearchParams,
  now = new Date(),
  timezone = process.env.APP_TIMEZONE ?? "Asia/Tehran",
): Range {
  for (const k of params.keys())
    if (params.getAll(k).length !== 1) throw new AppError("INVALID_INPUT");
  const defaults = defaultDateSelection(timezone, now);
  const raw = Object.fromEntries(params);
  if (!params.size) {
    raw.from = defaults.from;
    raw.to = defaults.to;
  }
  const p = querySchema.safeParse(raw);
  if (!p.success) throw new AppError("INVALID_INPUT");
  const { from, to, grouping } = p.data;
  const diff = differenceInCalendarDays(parseISO(to), parseISO(from));
  if (
    diff < 0 ||
    diff > 365 ||
    to > formatInTimeZone(now, timezone, "yyyy-MM-dd")
  )
    throw new AppError("INVALID_INPUT");
  const start = fromZonedTime(`${from}T00:00:00`, timezone);
  const after = fromZonedTime(
    `${format(addDays(parseISO(to), 1), "yyyy-MM-dd")}T00:00:00`,
    timezone,
  );
  return {
    from,
    to,
    start: start.toISOString(),
    // Bifrost compares inclusive RFC3339Nano bounds against Go timestamps.
    end:
      +after <= +now
        ? new Date(+after - 1000)
            .toISOString()
            .replace(/\.\d{3}Z$/, ".999999999Z")
        : now.toISOString(),
    timezone,
    grouping,
  };
}
export function bucketDate(timestamp: string, range: Range): string {
  return localBucketDate(
    formatInTimeZone(timestamp, range.timezone, "yyyy-MM-dd"),
    range.grouping,
  );
}
export function localBucketDate(
  day: string,
  grouping: Range["grouping"],
): string {
  const local = parseISO(day);
  return format(
    grouping === "week"
      ? startOfWeek(local, { weekStartsOn: 6 })
      : grouping === "month"
        ? startOfMonth(local)
        : local,
    "yyyy-MM-dd",
  );
}
