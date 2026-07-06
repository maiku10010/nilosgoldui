import { useState, useEffect } from "react";
import { Crown, Sun, Moon } from "lucide-react";
import type { Sale, JobCost, InvEntry, Inquiry, Expense, Tab } from "../types";
import { TABS } from "../types";
import { php, pct } from "../lib/formatters";
import { BASE_URL, GOLD_PRICE, TAB_LABELS } from "../lib/constants";
import { INIT_SALES, INIT_JOB_COSTS, INIT_INVENTORY, INIT_INQUIRIES, INIT_EXPENSES } from "../data/seed";
import { KPICard } from "../components/ui/KPICard";
import { DashboardView } from "../views/DashboardView";
import { DailySalesView } from "../views/DailySalesView";
import { JobCostingView } from "../views/JobCostingView";
import { GoldInventoryView } from "../views/GoldInventoryView";
import { InquiriesView } from "../views/InquiriesView";
import { ExpensesView } from "../views/ExpensesView";
import { ProfitAnalysisView } from "../views/ProfitAnalysisView";
import { api } from "../lib/api";

export default function App() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("nilo-theme") !== "light"; }
    catch { return true; }
  });
  const [tab, setTab] = useState<Tab>("DASHBOARD");

  const [sales, setSales] = useState<Sale[]>([]);
  const [jobCosts, setJobCosts] = useState<JobCost[]>([]);
  const [inventory, setInventory] = useState<InvEntry[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Apply dark class and persist preference
// 1. DATA FETCHING EFFECT (Runs only once on mount)
  useEffect(() => {
    Promise.all([
      api.sales.getAll(),
      api.jobCosting.getAll(),
      api.inventory.getAll(),
      api.inquiries.getAll(),
      api.expenses.getAll()
    ])
      .then(([salesData, jobCostData, inventoryData, inquiriesData, expensesData]) => {
        if (Array.isArray(salesData)) setSales(salesData);
        if (Array.isArray(jobCostData)) setJobCosts(jobCostData);
        if (Array.isArray(inventoryData)) setInventory(inventoryData);
        if (Array.isArray(inquiriesData)) setInquiries(inquiriesData);
        if (Array.isArray(expensesData)) setExpenses(expensesData);
        
        setLoading(false);
      })
      .catch(err => {
        console.error("Error connecting to Goldsmith Master Control API:", err);
        setLoading(false);
      });
  }, []); // <-- Empty dependency array ensures data is only fetched once

  // 2. DARK MODE PREFERENCE EFFECT (Runs whenever 'dark' state toggles)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("nilo-theme", dark ? "dark" : "light");
    } catch (e) {
      console.warn("Could not save theme preference to localStorage:", e);
    }
  }, [dark]); // <-- Only re-runs when the 'dark' variable changes

  // Wire API endpoints — graceful fallback to seed data when server is offline
  useEffect(() => { fetch(`${BASE_URL}/sales`).then(r=>r.json()).then(d=>{ if (Array.isArray(d)) setSales(d); }).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_URL}/job_costing`).then(r=>r.json()).then(d=>{ if (Array.isArray(d)) setJobCosts(d); }).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_URL}/inventory`).then(r=>r.json()).then(d=>{ if (Array.isArray(d)) setInventory(d); }).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_URL}/inquiries`).then(r=>r.json()).then(d=>{ if (Array.isArray(d)) setInquiries(d); }).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_URL}/expenses`).then(r=>r.json()).then(d=>{ if (Array.isArray(d)) setExpenses(d); }).catch(()=>{}); }, []);

  const goldStock = Number(inventory.length > 0 ? (inventory[inventory.length - 1]?.balance ?? 0) : 0);
  const totalRev   = jobCosts.reduce((a, j) => a + j.sellingPrice, 0);
  const totalCost  = jobCosts.reduce((a, j) => a + j.totalCost, 0);
  const totalExp   = expenses.reduce((a, e) => a + e.amount, 0);
  const netProfit  = totalRev - totalCost - totalExp;
  const netMargin  = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
  const today      = new Date("2026-06-29").toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" });

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200" style={{ fontFamily:"'Inter', sans-serif" }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-sidebar border-b border-sidebar-border shadow-lg shadow-black/10 dark:shadow-black/40">
        {/* Brand + KPI + toggle row */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-sidebar-border">
          {/* Branding */}
          <div className="flex items-center gap-3 shrink-0 mr-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center shadow-md shadow-amber-900/30">
              <Crown size={17} className="text-white drop-shadow" />
            </div>
            <div>
              <div className="text-sm font-bold text-primary leading-tight tracking-wide" style={{ fontFamily:"'Playfair Display', serif" }}>
                NILO&apos;S GOLDSMITH
              </div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest leading-tight">
                Master Control System 2026
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="flex gap-2 flex-1 overflow-x-auto">
            <KPICard label="Today" value={today} />
            <KPICard label="Live Gold Price / g" value={php(GOLD_PRICE)} vc="text-primary" />
            <KPICard label="Gold Stock (Physical)" value={`${goldStock.toFixed(2)} g`} vc="text-primary" />
            <KPICard
              label="Net Profit (Jun 2026)"
              value={php(netProfit)}
              sub={`${pct(netMargin)} Margin`}
              vc="text-emerald-700 dark:text-emerald-400"
              badge={{ text:"HEALTHY", cls:"bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25" }}
            />
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-sidebar-border hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-foreground"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Tab nav */}
        <nav className="flex items-center overflow-x-auto px-5 gap-0.5 py-2">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest whitespace-nowrap transition-all ${
                tab === t
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="max-w-[1680px] mx-auto">
        {tab === "DASHBOARD"       && <DashboardView sales={sales} jobCosts={jobCosts} expenses={expenses} inquiries={inquiries} />}
        {tab === "DAILY_SALES"     && <DailySalesView sales={sales} onAdd={s => setSales(p => [s, ...p])} />}
        {tab === "JOB_COSTING"     && <JobCostingView jobCosts={jobCosts} onAdd={j => setJobCosts(p => [j, ...p])} />}
        {tab === "GOLD_INVENTORY"  && <GoldInventoryView inventory={inventory} onAdd={e => setInventory(p => [...p, e])} />}
        {tab === "INQUIRIES"       && <InquiriesView inquiries={inquiries} onAdd={i => setInquiries(p => [i, ...p])} />}
        {tab === "EXPENSES"        && <ExpensesView expenses={expenses} onAdd={e => setExpenses(p => [e, ...p])} />}
        {tab === "PROFIT_ANALYSIS" && <ProfitAnalysisView sales={sales} jobCosts={jobCosts} expenses={expenses} />}
      </main>
    </div>
  );
}
