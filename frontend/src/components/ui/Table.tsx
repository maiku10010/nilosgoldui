import React from "react";

export function TRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="hover:bg-muted/40 dark:hover:bg-slate-800/25 transition-colors">
      {children}
    </tr>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs font-mono min-w-max">{children}</table>
    </div>
  );
}

export function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-muted-foreground text-xs">
        No matching records
      </td>
    </tr>
  );
}
