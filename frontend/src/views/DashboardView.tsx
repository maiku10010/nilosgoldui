import { useMemo } from "react";
import { DollarSign, TrendingUp, BarChart3, Gem } from "lucide-react";
import type { Sale, JobCost, Expense, Inquiry } from "../types";
import { php, pct, fmtDate } from "../lib/formatters";
import { thc, tdc, tdr } from "../lib/constants";
import { StatusBadge } from "../components/ui/StatusBadge";
import { MarginBadge } from "../components/ui/MarginBadge";
import { TableWrap, TRow } from "../components/ui/Table";

export function DashboardView({ sales, jobCosts, expenses, inquiries }: {
  sales: Sale[]; jobCosts: JobCost[]; expenses: Expense[]; inquiries: Inquiry[];
}) {
  const totalSales = useMemo(() => sales.reduce((a, s) => a + (Number(s.price) || 0), 0), [sales]);
  const cashCollected = useMemo(() => sales.reduce((a, s) => a + (Number(s.downpayment) || 0), 0), [sales]);
  const receivables = totalSales - cashCollected;

  const totalRevenue = useMemo(() =>
    jobCosts.reduce((a, j) => a + (Number((j as any).sellingPrice) || 0), 0), [jobCosts]);

  const totalJobCost = useMemo(() =>
    jobCosts.reduce((a, j) => a + (Number((j as any).totalCost) || Number(j.laborCost) || 0), 0), [jobCosts]);
  const grossProfit = totalRevenue - totalJobCost;
  const avgMargin = useMemo(() =>
    jobCosts.length ? jobCosts.reduce((a, j) => a + (Number(j.marginPct) || 0), 0) / jobCosts.length : 0, [jobCosts]);

  const totalExpenses = useMemo(() => expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0), [expenses]);
  const expByCat = useMemo(() => expenses.reduce((acc, e) => {
    const amt = Number(e.amount) || 0;
    acc[e.category] = (acc[e.category] || 0) + amt; return acc;
  }, {} as Record<string, number>), [expenses]);

  const netProfit = grossProfit - totalExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const totalInq = inquiries.length;
  const closedInq = inquiries.filter(i => i.status === "Yes").length;
  const convRate = totalInq > 0 ? (closedInq / totalInq) * 100 : 0;

  const recentSales = useMemo(() =>
    [...sales].sort((a, b) => {
      const dateA = String((a as any).date || "");
      const dateB = String((b as any).date || "");
      return dateB.localeCompare(dateA);
    }).slice(0, 7), [sales]);
  const recentJC = useMemo(() => [...jobCosts].slice(0, 6), [jobCosts]);

  const catColors: Record<string, string> = {
    "Rent": "#d4a017", "Staff Salary": "#f59e0b", "Utilities": "#38bdf8", "Supplies": "#a78bfa", "Tax & Permits": "#ef4444",
  };

  const cardCls = "bg-card border border-border rounded-xl p-5";

  return (
    <div className="p-5 space-y-5">
      {/* 4-column KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Daily Sales */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={13} className="text-primary shrink-0" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Daily Sales Summary</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Total Sales", val: php(totalSales), cls: "text-amber-700 dark:text-amber-300 font-semibold" },
              { label: "Cash Collected", val: php(cashCollected), cls: "text-emerald-700 dark:text-emerald-400" },
              { label: "Receivables", val: php(receivables), cls: "text-amber-700 dark:text-amber-400" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">{r.label}</span>
                <span className={`text-sm tabular-nums ${r.cls}`}>{r.val}</span>
              </div>
            ))}
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Total Transactions</span>
              <span className="text-xl font-bold text-foreground tabular-nums">{sales.length}</span>
            </div>
          </div>
        </div>

        {/* Gross Profit */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Gross Profit</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Total Revenue", val: php(totalRevenue), cls: "text-amber-700 dark:text-amber-300" },
              { label: "Total Job Cost", val: php(totalJobCost), cls: "text-red-700 dark:text-red-400" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">{r.label}</span>
                <span className={`text-sm tabular-nums ${r.cls}`}>{r.val}</span>
              </div>
            ))}
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Gross Profit</span>
              <span className="text-base tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">{php(grossProfit)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Avg Margin</span>
              <span className="text-sm tabular-nums text-emerald-700 dark:text-emerald-300">{pct(avgMargin)}</span>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={13} className="text-muted-foreground shrink-0" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Total Expenses</span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(expByCat).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: catColors[cat] ?? "#64748b" }} />
                  {cat}
                </span>
                <span className="text-xs tabular-nums text-foreground/80 dark:text-slate-300">{php(amt)}</span>
              </div>
            ))}
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-foreground/70 font-medium">Total</span>
              <span className="text-base tabular-nums text-red-700 dark:text-red-400 font-bold">{php(totalExpenses)}</span>
            </div>
          </div>
        </div>

        {/* Net Profit + Funnel */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-3">
            <Gem size={13} className="text-primary shrink-0" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Net Profit</span>
          </div>
          <div className="mb-4">
            <div className={`text-2xl font-bold tabular-nums ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {php(netProfit)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{pct(netMargin)} net margin</div>
          </div>
          <div className="h-px bg-border mb-4" />
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Inquiry Funnel</div>
          <div className="space-y-2">
            {[
              { label: "Total Inquiries", val: totalInq, w: 100, color: "#d4a017" },
              { label: "Closed / Won", val: closedInq, w: convRate, color: "#059669" },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">{r.label}</span>
                  <span className="text-xs text-foreground font-semibold tabular-nums">{r.val}</span>
                </div>
                <div className="w-full bg-muted dark:bg-slate-800 rounded-full h-1">
                  <div className="h-1 rounded-full" style={{ width: `${r.w}%`, background: r.color }} />
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1">
              <span className="text-[11px] text-foreground/70 font-medium">Conversion Rate</span>
              <span className="text-sm text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">{pct(convRate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">
            Daily Sales Log <span className="text-primary/70">— Recent Entries</span>
          </p>
          <TableWrap>
            <thead><tr>
              {["Date", "Invoice #", "Client", "Type", "Total", "Status"].map(h => <th key={h} className={thc}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recentSales.map((s, index) => {
                const priceNum = Number(s.price) || 0;
                
                // ✅ Safe raw parsing to strip timestamp strings and prevent offset calculation errors
                const cleanDateString = s.date ? String(s.date).split("T")[0] : "";

                return (
                  <TRow key={`${s.invoiceId || 'no-id'}-${index}`}>
                    <td className={tdc}>{fmtDate(cleanDateString)}</td>
                    <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{s.invoiceId}</td>
                    <td className={tdc + " font-sans font-medium"}>{s.clientName}</td>
                    <td className={tdc}>{s.serviceType}</td>
                    <td className={tdr}>{php(priceNum)}</td>
                    <td className={tdc}><StatusBadge status={s.status} /></td>
                  </TRow>
                );
              })}
            </tbody>
          </TableWrap>
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">
            Job Costing <span className="text-primary/70">— Recent Entries</span>
          </p>
          <TableWrap>
            <thead><tr>
              {["Invoice #", "Client", "Gold (g)", "Total Cost", "Selling", "Profit", "Margin"].map(h => <th key={h} className={thc}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recentJC.map((j, index) => {
                const gold = Number(j.goldUsed) || 0;
                const cost = Number(j.totalCost) || 0;
                const selling = Number(j.sellingPrice) || 0;
                const profit = Number(j.profit) || 0;
                const margin = Number(j.marginPct) || 0;

                return (
                  <TRow key={`${j.jobCostId || j.invoiceId || 'jc'}-${index}`}>
                    <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{j.invoiceId}</td>
                    <td className={tdc + " font-sans font-medium"}>{j.clientName}</td>
                    <td className={tdr}>{gold.toFixed(2)}</td>
                    <td className={tdr + " text-red-700 dark:text-red-400"}>{php(cost)}</td>
                    <td className={tdr + " text-amber-700 dark:text-amber-300"}>{php(selling)}</td>
                    <td className={tdr + " text-emerald-700 dark:text-emerald-400 font-semibold"}>{php(profit)}</td>
                    <td className={tdr}><MarginBadge margin={margin} /></td>
                  </TRow>
                );
              })}
            </tbody>
          </TableWrap>
        </div>
      </div>
    </div>
  );
}