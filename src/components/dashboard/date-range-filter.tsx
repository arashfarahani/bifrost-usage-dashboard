"use client";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { presets } from "@/lib/utils/dates";
export type DateSelection = {
  from: string;
  to: string;
  grouping: "day" | "week" | "month";
};
export function DateRangeFilter({
  timezone,
  value,
  onChange,
}: {
  timezone: string;
  value: DateSelection;
  onChange: (v: DateSelection) => void;
}) {
  const ranges = presets(timezone);
  const selected =
    ranges.find((r) => r.from === value.from && r.to === value.to)?.id ??
    "custom";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        dir="ltr"
        // Custom range opens a picker rather than selecting a fixed preset.
        // Keep it selectable again after a custom range has already been applied.
        value={selected === "custom" ? "" : selected}
        onValueChange={(id) => {
          if (id === "custom") {
            setDraft({ from: parseISO(value.from), to: parseISO(value.to) });
            setOpen(true);
          } else {
            const r = ranges.find((r) => r.id === id)!;
            onChange({ from: r.from, to: r.to, grouping: value.grouping });
          }
        }}
      >
        <SelectTrigger aria-label="Reporting period" className="w-40">
          <SelectValue placeholder="Custom range" />
        </SelectTrigger>
        <SelectContent
          onCloseAutoFocus={(event) => {
            // The calendar owns focus after custom selection. Restoring focus to
            // this select would count as an outside interaction and dismiss it.
            if (open) event.preventDefault();
          }}
        >
          {ranges.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      <Popover
        open={open}
        onOpenChange={(v) => {
          if (v)
            setDraft({ from: parseISO(value.from), to: parseISO(value.to) });
          setOpen(v);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Choose a custom date range"
          >
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label="Custom date range"
          align="end"
          className="w-auto max-w-[calc(100vw-2rem)] p-2"
        >
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={1}
            locale={enUS}
            dir="ltr"
            disabled={{ after: parseISO(ranges[0].to) }}
            defaultMonth={parseISO(value.from)}
          />
          <div className="flex items-center justify-between gap-3 border-t p-2">
            <p className="text-muted-foreground text-xs">Gregorian calendar</p>
            <Button
              disabled={!draft?.from || !draft.to}
              onClick={() => {
                if (draft?.from && draft.to) {
                  onChange({
                    ...value,
                    from: format(draft.from, "yyyy-MM-dd"),
                    to: format(draft.to, "yyyy-MM-dd"),
                  });
                  setOpen(false);
                }
              }}
            >
              Apply range
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Select
        dir="ltr"
        value={value.grouping}
        onValueChange={(v) =>
          onChange({ ...value, grouping: v as DateSelection["grouping"] })
        }
      >
        <SelectTrigger className="w-28" aria-label="Chart interval">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Daily</SelectItem>
          <SelectItem value="week">Weekly</SelectItem>
          <SelectItem value="month">Monthly</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
