// ── formatters ─────────────────────────────────────────────────────────────
export const marginCls = (m: number) => {
  if (m >= 50)  return "text-emerald-700 dark:text-emerald-300 font-semibold";
  if (m >= 25)  return "text-emerald-700 dark:text-emerald-400";
  if (m >= 10)  return "text-amber-700 dark:text-amber-400";
  if (m >= 0)   return "text-orange-700 dark:text-orange-400";
  return "text-red-700 dark:text-red-400";
};

export const php = (val: any): string => {
  // 1. Safely force the input into a Number, defaulting to 0 if null/undefined/NaN
  const num = Number(val) || 0;
  
  // 2. Call .toLocaleString on the guaranteed valid number
  return `₱${num.toLocaleString('en-PH', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

export const pct = (n: number) => (isFinite(n) ? n : 0).toFixed(1) + "%";

export const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "short", day: "2-digit", year: "numeric",
  });

export const PIE_COLORS = ["#d4a017","#f59e0b","#38bdf8","#a78bfa","#ef4444"];
// ── chart data ─────────────────────────────────────────────────────────────
export const MONTHLY = [
  { month:"Jan", revenue:0, cost:0, expenses:0 },
  { month:"Feb", revenue:0, cost:0, expenses:0 },
  { month:"Mar", revenue:0, cost:0, expenses:0 },
  { month:"Apr", revenue:0, cost:0, expenses:0 },
  { month:"May", revenue:0, cost:0, expenses:0 },
];