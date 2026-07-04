// ── formatters ─────────────────────────────────────────────────────────────
export const marginCls = (m: number) => {
  if (m >= 50)  return "text-emerald-700 dark:text-emerald-300 font-semibold";
  if (m >= 25)  return "text-emerald-700 dark:text-emerald-400";
  if (m >= 10)  return "text-amber-700 dark:text-amber-400";
  if (m >= 0)   return "text-orange-700 dark:text-orange-400";
  return "text-red-700 dark:text-red-400";
};

export const php = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct = (n: number) => (isFinite(n) ? n : 0).toFixed(1) + "%";

export const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "short", day: "2-digit", year: "numeric",
  });
