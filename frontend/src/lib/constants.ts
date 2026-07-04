import type { Tab } from "../types";

// ── config ─────────────────────────────────────────────────────────────────
export const BASE_URL = "http://localhost:3000";
export const GOLD_PRICE = 5450;

// ── tab labels ──────────────────────────────────────────────────────────────
export const TAB_LABELS: Record<Tab, string> = {
  DASHBOARD: "Dashboard",
  DAILY_SALES: "Daily Sales",
  JOB_COSTING: "Job Costing",
  GOLD_INVENTORY: "Gold Inventory",
  INQUIRIES: "Inquiries",
  EXPENSES: "Expenses",
  PROFIT_ANALYSIS: "Profit Analysis",
};

// ── table class strings ─────────────────────────────────────────────────────
export const thc = [
  "px-3 py-2.5 text-left text-[10px] text-muted-foreground uppercase tracking-widest font-medium whitespace-nowrap",
  "bg-muted/60 dark:bg-slate-900/70",
  "border-b border-border",
].join(" ");

export const tdc = [
  "px-3 py-2.5 text-xs whitespace-nowrap border-t border-border",
  "text-foreground/80 dark:text-slate-300",
].join(" ");

export const tdr = tdc + " text-right tabular-nums";

// Same as tdr but no text-color — use for cells that apply dynamic color classes
export const tdrPlain = "px-3 py-2.5 text-xs whitespace-nowrap border-t border-border text-right tabular-nums";

// ── input class string ──────────────────────────────────────────────────────
export const ic = [
  "w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30",
  "bg-white dark:bg-slate-900/80",
  "border border-border",
  "text-foreground",
  "placeholder:text-muted-foreground",
  "focus:border-primary/60",
].join(" ");
