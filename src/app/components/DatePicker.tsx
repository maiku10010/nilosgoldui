import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const fromISO = (value: string) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const toISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function DatePicker({ value, onChange, min, max, label = "Date", disabled = false }: {
  value: string; onChange: (value: string) => void; min?: string; max?: string; label?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromISO(value);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="secondary" disabled={disabled} className="single-date-trigger" aria-label={`${label}: ${selected?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) ?? "Select date"}`}>
      <CalendarDays size={16} aria-hidden="true" />{selected?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) ?? "Select date"}
    </Button></PopoverTrigger>
    <PopoverContent className="single-date-popover" align="start">
      <Calendar mode="single" selected={selected} defaultMonth={selected} disabled={[...(min ? [{ before: fromISO(min)! }] : []), ...(max ? [{ after: fromISO(max)! }] : [])]} onSelect={date => { if (date) { onChange(toISO(date)); setOpen(false); } }} initialFocus />
    </PopoverContent>
  </Popover>;
}
