import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type Props = { startDate: string; endDate: string; onChange: (start: string, end: string) => void; label?: string };
const fromISO = (value: string) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const toISO = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const format = (value: string) => fromISO(value)?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) ?? "";

export function DateRangePicker({ startDate, endDate, onChange, label = "Date range" }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const selected = useMemo<DateRange | undefined>(() => {
    const from = fromISO(startDate);
    if (!from) return undefined;
    return { from, to: fromISO(endDate) };
  }, [startDate, endDate]);
  const display = !startDate && !endDate ? "All time" : `${startDate ? format(startDate) : "Beginning"} – ${endDate ? format(endDate) : "Present"}`;
  const apply = (start: string, end: string) => { onChange(start, end); setOpen(false); setCustom(false); };
  const preset = (name: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (name === "All time") return apply("", "");
    if (name === "Custom") { setCustom(true); return; }
    const from = new Date(today);
    if (name === "This month") from.setDate(1);
    if (name === "Last 30 days") from.setDate(from.getDate() - 29);
    if (name === "Year to date") { from.setMonth(0, 1); }
    apply(toISO(from), toISO(today));
  };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="secondary" aria-label={`${label}: ${display}`} className="date-range-trigger"><CalendarDays size={16} /><span>{display}</span><ChevronDown size={14} /></Button></PopoverTrigger>
    <PopoverContent align="end" className="date-range-popover">
      <div className="date-range-presets" aria-label="Date range presets">{["This month", "Last 30 days", "Year to date", "All time", "Custom"].map(item => <Button key={item} variant={item === "Custom" && custom ? "primary" : "ghost"} size="sm" onClick={() => preset(item)}>{item}</Button>)}</div>
      {custom && <Calendar mode="range" numberOfMonths={2} selected={selected} onSelect={range => {
        if (!range?.from) { onChange("", ""); return; }
        const start = toISO(range.from);
        const end = range.to ? toISO(range.to) : "";
        onChange(start, end);
        if (range.to) { setOpen(false); setCustom(false); }
      }} />}
    </PopoverContent>
  </Popover>;
}
