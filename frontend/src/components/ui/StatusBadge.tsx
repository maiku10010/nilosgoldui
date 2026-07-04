import React from "react";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Ongoing: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Paid:    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    Released:"bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
    Yes:     "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    No:      "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
    Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-widest border ${map[status] ?? "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30"}`}>
      {status}
    </span>
  );
}
