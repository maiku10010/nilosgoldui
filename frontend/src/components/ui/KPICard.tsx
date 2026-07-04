import React from "react";

export function KPICard({ label, value, sub, badge, vc = "" }: {
  label: string; value: string; sub?: string;
  badge?: { text: string; cls: string }; vc?: string;
}) {
  return (
    <div className="flex flex-col min-w-[148px] bg-sidebar-accent/60 dark:bg-slate-900/50 border border-sidebar-border rounded-lg px-4 py-2.5 shrink-0">
      <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{label}</span>
      <span className={`text-sm font-semibold tabular-nums leading-tight text-foreground ${vc}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{sub}</span>}
      {badge && (
        <span className={`mt-1.5 text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded w-fit ${badge.cls}`}>
          {badge.text}
        </span>
      )}
    </div>
  );
}
