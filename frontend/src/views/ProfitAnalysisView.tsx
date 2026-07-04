import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import type { Sale, JobCost, Expense, ServiceType } from "../types";
import { php, pct } from "../lib/formatters";
import { MONTHLY, PIE_COLORS } from "../data/seed";
import { ChartTip } from "../components/charts/ChartTip";

export function ProfitAnalysisView({ sales, jobCosts, expenses }: {
  sales: Sale[]; jobCosts: JobCost[]; expenses: Expense[];
}) {
  const totalRevenue = jobCosts.reduce((a, j) => a + j.sellingPrice, 0);
  const totalCost    = jobCosts.reduce((a, j) => a + j.totalCost, 0);
  const grossProfit  = totalRevenue - totalCost;
  const totalExp     = expenses.reduce((a, e) => a + e.amount, 0);
  const netProfit    = grossProfit - totalExp;
  const netMargin    = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const chartData = [
    ...MONTHLY,
    { month:"Jun", revenue:totalRevenue, cost:totalCost, expenses:totalExp },
  ].map(m => ({ ...m, netProfit:m.revenue - m.cost - m.expenses }));

  const expByCat = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category]||0) + e.amount; return acc;
  }, {} as Record<string,number>);
  const pieData = Object.entries(expByCat).map(([name, value]) => ({ name, value }));

  const byService = (["Custom","Repair","Resize","Cleaning"] as ServiceType[]).map(type => {
    const jcs = jobCosts.filter(j => sales.find(s => s.invoiceId === j.invoiceId && s.serviceType === type));
    const margin = jcs.length ? jcs.reduce((a, j) => a + j.marginPct, 0) / jcs.length : 0;
    return { type, margin:parseFloat(margin.toFixed(1)), count:jcs.length };
  });

  const cardCls = "bg-card border border-border rounded-xl p-5";

  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label:"Gross Profit (Jun)", val:php(grossProfit), sub:"Revenue minus job costs", cls:"text-emerald-700 dark:text-emerald-400" },
          { label:"Total Expenses (Jun)", val:php(totalExp), sub:"Operating overhead", cls:"text-red-700 dark:text-red-400" },
          { label:"Net Profit (Jun)", val:php(netProfit), sub:`${pct(netMargin)} net margin`, cls:netProfit>=0?"text-emerald-700 dark:text-emerald-400":"text-red-700 dark:text-red-400" },
        ].map(k => (
          <div key={k.label} className={cardCls}>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">{k.label}</div>
            <div className={`text-2xl font-bold tabular-nums ${k.cls}`}>{k.val}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className={cardCls + " xl:col-span-2"}>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">Monthly Revenue vs. Cost vs. Net Profit (Jan–Jun 2026)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top:4, right:4, bottom:0, left:10 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4a017" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#d4a017" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,110,80,0.15)" />
              <XAxis dataKey="month" tick={{ fill:"var(--muted-foreground)", fontSize:10, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"var(--muted-foreground)", fontSize:10, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={v=>"₱"+(v/1000)+"K"} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#d4a017" strokeWidth={2} fill="url(#gRev)" />
              <Area type="monotone" dataKey="cost" name="Job Cost" stroke="#ef4444" strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#059669" strokeWidth={2} fill="url(#gNet)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={cardCls}>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">Expense Breakdown (Jun)</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" strokeWidth={0}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background:PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[10px] text-muted-foreground font-mono">{d.name}</span>
                </div>
                <span className="text-[10px] text-foreground/80 font-mono tabular-nums">{php(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">Average Margin % by Service Type</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byService} margin={{ top:4, right:4, bottom:0, left:10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,110,80,0.15)" vertical={false} />
            <XAxis dataKey="type" tick={{ fill:"var(--muted-foreground)", fontSize:10, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:"var(--muted-foreground)", fontSize:10, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={v=>v+"%"} />
            <Tooltip
              formatter={(v: any) => [v + "%", "Avg Margin"]}
              contentStyle={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"8px", fontFamily:"JetBrains Mono", fontSize:"11px", color:"var(--foreground)" }}
              labelStyle={{ color:"var(--muted-foreground)" }}
            />
            <Bar dataKey="margin" name="Margin %" radius={[4,4,0,0]}>
              {byService.map((_, i) => <Cell key={i} fill={["#d4a017","#059669","#38bdf8","#a78bfa"][i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
