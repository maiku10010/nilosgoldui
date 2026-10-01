import { useState, useEffect, useMemo, useRef } from "react";
import { twMerge } from "tailwind-merge";
import {
  Search, Plus, X, Crown, TrendingUp, TrendingDown,
  Package, BarChart3, DollarSign, Gem, Sun, Moon, PenSquare, Trash2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ── config ─────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "https://nilosgold.vercel.app").replace(/\/$/, "");
const GOLD_PRICE = 5450;

// ── formatters ─────────────────────────────────────────────────────────────
const marginCls = (m: number) => {
  if (m >= 50) {
    return "inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase tracking-widest border bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 min-w-[56px]";
  }
  if (m >= 25) {
    return "inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase tracking-widest border bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 min-w-[56px]";
  }
  return "inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase tracking-widest border bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 min-w-[56px]";
};

const php = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => n.toFixed(1) + "%";
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "short", day: "2-digit", year: "numeric",
  });

const numeric = (value: unknown) => Number(value ?? 0);
const apiDate = (value: unknown) => value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10);
const normalizeSale = (row: any): Sale => ({
  id: row.invoiceId,
  invoiceId: row.invoiceId,
  date: apiDate(row.salesDate ?? row.date),
  clientId: row.clientId ?? row.client?.clientId,
  clientName: row.clientName ?? row.client?.clientName ?? "",
  contactNum: row.contactNum ?? row.client?.contactNum ?? "",
  serviceType: row.serviceType ?? "Custom",
  price: numeric(row.price),
  downpayment: numeric(row.downpayment),
  balance: numeric(row.balance ?? numeric(row.price) - numeric(row.downpayment)),
  status: row.status ?? "Ongoing",
});
const normalizeJobCost = (row: any): JobCost => {
  const sellingPrice = numeric(row.sellingPrice ?? row.sale?.price);
  const goldCost = numeric(row.goldCost ?? numeric(row.goldUsed) * GOLD_PRICE);
  const totalCost = numeric(row.totalCost ?? goldCost + numeric(row.laborCost) + numeric(row.stoneCost));
  return { jobCostId: String(row.jobCostId ?? ""), invoiceId: String(row.invoiceId ?? ""), clientName: String(row.clientName ?? row.sale?.client?.clientName ?? ""), empId: row.empId, goldUsed: numeric(row.goldUsed), goldCostPerG: numeric(row.goldCostPerG ?? GOLD_PRICE), goldCost, stoneCost: numeric(row.stoneCost), laborCost: numeric(row.laborCost), totalCost, sellingPrice, profit: numeric(row.profit ?? sellingPrice - totalCost), marginPct: numeric(row.marginPct ?? (sellingPrice ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0)) };
};
const normalizeInventory = (row: any): InvEntry => ({ id: row.referenceId, date: apiDate(row.updatedAt ?? row.date), referenceId: row.referenceId, itemName: row.itemName ?? row.referenceId, goldIn: numeric(row.goldIn), goldOut: numeric(row.goldOut), scrap: numeric(row.scraps ?? row.scrap), balance: numeric(row.balance ?? row.totalGold), unit: row.unit ?? "grams" });
const normalizeInquiry = (row: any): Inquiry => ({ inquiryId: String(row.inquiryId ?? ""), date: apiDate(row.inqDate ?? row.date), customerName: String(row.customerName ?? ""), contactInfo: String(row.contactInfo ?? ""), details: String(row.details ?? ""), category: String(row.category ?? ""), quotedPrice: numeric(row.quotedPrice), status: row.status ?? "Pending" });
const normalizeExpense = (row: any): Expense => ({ expenseId: String(row.expenseId ?? ""), expDate: apiDate(row.expDate ?? row.date), category: String(row.category ?? ""), description: String(row.description ?? ""), amount: numeric(row.amount) });
const asRows = (value: unknown): any[] => Array.isArray(value) ? value : [];

// ── types ──────────────────────────────────────────────────────────────────
type ServiceType = "Custom" | "Repair" | "Resize" | "Cleaning";
type SaleStatus = "Ongoing" | "Paid" | "Released";
type InqStatus = "Yes" | "No" | "Pending";

interface Sale {
  id: string; invoiceId: string; date: string; clientId?: string;
  clientName: string; contactNum: string; serviceType: ServiceType;
  price: number; downpayment: number; balance: number; status: SaleStatus;
}
interface JobCost {
  jobCostId: string; invoiceId: string; clientName: string; empId?: string;
  goldUsed: number; goldCostPerG: number; goldCost: number;
  stoneCost: number; laborCost: number; totalCost: number;
  sellingPrice: number; profit: number; marginPct: number;
}
interface InvEntry {
  id: string; date: string; referenceId: string; itemName: string;
  goldIn: number; goldOut: number; scrap: number; balance: number; unit: string;
}
interface Inquiry {
  inquiryId: string; date: string; customerName: string; contactInfo: string;
  details: string; category: string; quotedPrice: number; status: InqStatus;
}
interface Expense {
  expenseId: string; expDate: string; category: string; description: string; amount: number;
}

const TABS = [
  "DASHBOARD", "DAILY_SALES", "JOB_COSTING", "GOLD_INVENTORY",
  "INQUIRIES", "EXPENSES", "PROFIT_ANALYSIS",
] as const;
type Tab = (typeof TABS)[number];

// ── shared ui primitives ────────────────────────────────────────────────────

// Status badge: adaptive text so it reads on both light and dark
function StatusBadge({ status }: { status: string }) {
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

function Modal({ title, onClose, onSubmit, children, submitLabel = "Save Entry", isSubmitting = false, submitDisabled = false }: {
  title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode;
  submitLabel?: string; isSubmitting?: boolean; submitDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-2xl shadow-black/30 dark:shadow-black/60 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <span className="text-primary font-mono text-[11px] uppercase tracking-widest font-semibold">{title}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4 overflow-y-auto">
          {children}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || submitDisabled}
              className="flex-1 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-sm font-medium transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
              {isSubmitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{label}</label>
      {children}
    </div>
  );
}

// Input/select base class – light: white bg, dark: near-black bg
const ic = [
  "w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30",
  "bg-white dark:bg-slate-900/80",
  "border border-border",
  "text-foreground",
  "placeholder:text-muted-foreground",
  "focus:border-primary/60",
].join(" ");

function SearchBar({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 w-64 bg-white dark:bg-slate-900/60 border border-border text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-sm font-medium transition-opacity">
      <Plus size={13} /> {label}
    </button>
  );
}

// Table primitives – both light and dark adaptive
const thc = [
  "px-3 py-2.5 text-left text-[10px] text-muted-foreground uppercase tracking-widest font-medium whitespace-nowrap",
  "bg-muted/60 dark:bg-slate-900/70",
  "border-b border-border",
].join(" ");

const tdc = [
  "px-3 py-2.5 text-xs whitespace-nowrap border-t border-border",
  "text-foreground/80 dark:text-slate-300",
].join(" ");

const tdr = tdc + " text-right tabular-nums";

function TRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="hover:bg-muted/40 dark:hover:bg-slate-800/25 transition-colors">
      {children}
    </tr>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs font-mono min-w-max">{children}</table>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-muted-foreground text-xs">
        No matching records
      </td>
    </tr>
  );
}

// ── recharts helpers ────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs font-mono">
      <p className="text-muted-foreground mb-2 uppercase tracking-widest text-[10px]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {php(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── dashboard view ─────────────────────────────────────────────────────────
function DashboardView({ sales, jobCosts, expenses, inquiries }: {
  sales: Sale[]; jobCosts: JobCost[]; expenses: Expense[]; inquiries: Inquiry[];
}) {
  const totalSales    = useMemo(() => sales.reduce((a, s) => a + s.price, 0), [sales]);
  const cashCollected = useMemo(() => sales.reduce((a, s) => a + s.downpayment, 0), [sales]);
  const receivables   = totalSales - cashCollected;

  const totalRevenue  = useMemo(() => jobCosts.reduce((a, j) => a + j.sellingPrice, 0), [jobCosts]);
  const totalJobCost  = useMemo(() => jobCosts.reduce((a, j) => a + j.totalCost, 0), [jobCosts]);
  const grossProfit   = totalRevenue - totalJobCost;
  const avgMargin     = useMemo(() =>
    jobCosts.length ? jobCosts.reduce((a, j) => a + j.marginPct, 0) / jobCosts.length : 0, [jobCosts]);

  const totalExpenses = useMemo(() => expenses.reduce((a, e) => a + e.amount, 0), [expenses]);
  const expByCat      = useMemo(() => expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount; return acc;
  }, {} as Record<string, number>), [expenses]);

  const netProfit   = grossProfit - totalExpenses;
  const netMargin   = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const totalInq    = inquiries.length;
  const closedInq   = inquiries.filter(i => i.status === "Yes").length;
  const convRate    = totalInq > 0 ? (closedInq / totalInq) * 100 : 0;

  const recentSales = useMemo(() =>
    [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7), [sales]);
  const recentJC    = useMemo(() => [...jobCosts].slice(0, 6), [jobCosts]);

  const catColors: Record<string, string> = {
    "Rent":"#d4a017","Staff Salary":"#f59e0b","Utilities":"#38bdf8","Supplies":"#a78bfa","Tax & Permits":"#ef4444",
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
              { label:"Total Sales", val:php(totalSales), cls:"text-amber-700 dark:text-amber-300 font-semibold" },
              { label:"Cash Collected", val:php(cashCollected), cls:"text-emerald-700 dark:text-emerald-400" },
              { label:"Receivables", val:php(receivables), cls:"text-amber-700 dark:text-amber-400" },
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
              { label:"Total Revenue", val:php(totalRevenue), cls:"text-amber-700 dark:text-amber-300" },
              { label:"Total Job Cost", val:php(totalJobCost), cls:"text-red-700 dark:text-red-400" },
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
              { label:"Total Inquiries", val:totalInq, w:100, color:"#d4a017" },
              { label:"Closed", val:closedInq, w:convRate, color:"#059669" },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">{r.label}</span>
                  <span className="text-xs text-foreground font-semibold tabular-nums">{r.val}</span>
                </div>
                <div className="w-full bg-muted dark:bg-slate-800 rounded-full h-1">
                  <div className="h-1 rounded-full" style={{ width:`${r.w}%`, background:r.color }} />
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
              {["Date","Invoice #","Client","Type","Total","Status"].map(h=><th key={h} className={thc}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recentSales.map(s => (
                <TRow key={s.id}>
                  <td className={tdc}>{fmtDate(s.date)}</td>
                  <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{s.invoiceId}</td>
                  <td className={tdc + " font-sans font-medium"}>{s.clientName}</td>
                  <td className={tdc}>{s.serviceType}</td>
                  <td className={tdr}>{php(s.price)}</td>
                  <td className={tdc}><StatusBadge status={s.status} /></td>
                </TRow>
              ))}
            </tbody>
          </TableWrap>
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">
            Job Costing <span className="text-primary/70">— Recent Entries</span>
          </p>
          <TableWrap>
            <thead><tr>
              {["Invoice #","Client","Gold (g)","Total Cost","Selling","Profit","Margin"].map(h=><th key={h} className={thc}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recentJC.map(j => (
                <TRow key={j.jobCostId}>
                  <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{j.invoiceId}</td>
                  <td className={tdc + " font-sans font-medium"}>{j.clientName}</td>
                  <td className={tdr}>{j.goldUsed.toFixed(2)}</td>
                  <td className={tdr + " text-red-700 dark:text-red-400"}>{php(j.totalCost)}</td>
                  <td className={tdr + " text-amber-700 dark:text-amber-300"}>{php(j.sellingPrice)}</td>
                  <td className={tdr + " text-emerald-700 dark:text-emerald-400 font-semibold"}>{php(j.profit)}</td>
                  <td className={tdc}>
                    <span className={marginCls(j.marginPct)}>{pct(j.marginPct)}</span>
                  </td>
                </TRow>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </div>
    </div>
  );
}

// ── daily sales ─────────────────────────────────────────────────────────────
function DailySalesView({ sales, onAdd, onUpdate, onDelete }: { sales: Sale[]; onAdd: (s: Sale) => void; onUpdate: (s: Sale) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ invoiceId:"", date:"", clientName:"", contactNum:"",
    serviceType:"Custom" as ServiceType, price:"", downpayment:"", status:"Ongoing" as SaleStatus });

  const filtered = useMemo(() => sales.filter(s =>
    [s.clientName, s.invoiceId, s.serviceType, s.status].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [sales, q]);

  const resetForm = () => setForm({ invoiceId:"", date:"", clientName:"", contactNum:"", serviceType:"Custom", price:"", downpayment:"", status:"Ongoing" });
  const closeModal = () => { setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const price = parseFloat(form.price) || 0;
    const dp = parseFloat(form.downpayment) || 0;
    const entry: Sale = { id: editingId ?? String(Date.now()), invoiceId:form.invoiceId, date:form.date,
      clientName:form.clientName, contactNum:form.contactNum, serviceType:form.serviceType,
      price, downpayment:dp, balance:price-dp, status:form.status };
    try {
      await fetch(`${BASE_URL}/sales`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ invoiceId:entry.invoiceId, serviceType:entry.serviceType, price:entry.price,
          status:entry.status, downpayment:entry.downpayment, clientName:entry.clientName,
          contactNum:entry.contactNum, balance:entry.balance }) });
    } catch (_) {}
    if (editingId) {
      onUpdate(entry);
    } else {
      onAdd(entry);
    }
    closeModal();
    setIsSubmitting(false);
    submittingRef.current = false;
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search client, invoice, type…" />
        <AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add New Sale" />
      </div>
      <TableWrap>
        <thead><tr>
          {['Date','Invoice #','Client Name','Contact','Type','Total Price','Downpayment','Balance','Status','Actions'].map(h=><th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map(s => (
            <TRow key={s.id}>
              <td className={tdc}>{fmtDate(s.date)}</td>
              <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{s.invoiceId}</td>
              <td className={tdc + " font-sans font-medium"}>{s.clientName}</td>
              <td className={tdc + " text-muted-foreground"}>{s.contactNum}</td>
              <td className={tdc}>{s.serviceType}</td>
              <td className={tdr}>{php(s.price)}</td>
              <td className={tdr + " text-emerald-700 dark:text-emerald-400"}>{php(s.downpayment)}</td>
              <td className={tdr + " text-amber-700 dark:text-amber-400"}>{php(s.balance)}</td>
              <td className={tdc}><StatusBadge status={s.status} /></td>
              <td className={tdc}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setEditingId(s.id); setForm({ invoiceId:s.invoiceId, date:s.date, clientName:s.clientName, contactNum:s.contactNum, serviceType:s.serviceType, price:String(s.price), downpayment:String(s.downpayment), status:s.status }); setOpen(true); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                    <PenSquare size={13} />
                  </button>
                  <button type="button" onClick={() => onDelete(s.id)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </TRow>
          ))}
          {!filtered.length && <EmptyRow cols={10} />}
        </tbody>
      </TableWrap>
      {open && (
        <Modal title={editingId ? "Edit Sale Entry" : "Add New Sale Entry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Entry" : "Save Entry"} isSubmitting={isSubmitting}>
          <div className="grid grid-cols-2 gap-4">
            <FF label="Invoice #"><input className={ic} value={form.invoiceId} onChange={e=>setForm(f=>({...f,invoiceId:e.target.value}))} placeholder="INV-2026-xxx" required /></FF>
            <FF label="Date"><input type="date" className={ic} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required /></FF>
            <FF label="Client Name"><input className={ic} value={form.clientName} onChange={e=>setForm(f=>({...f,clientName:e.target.value}))} placeholder="Full name" required /></FF>
            <FF label="Contact #"><input className={ic} value={form.contactNum} onChange={e=>setForm(f=>({...f,contactNum:e.target.value}))} placeholder="09XX-XXX-XXXX" /></FF>
            <FF label="Service Type">
              <select className={ic} value={form.serviceType} onChange={e=>setForm(f=>({...f,serviceType:e.target.value as ServiceType}))}>
                {(["Custom","Repair","Resize","Cleaning"] as ServiceType[]).map(t=><option key={t}>{t}</option>)}
              </select>
            </FF>
            <FF label="Status">
              <select className={ic} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as SaleStatus}))}>
                {(["Ongoing","Paid","Released"] as SaleStatus[]).map(t=><option key={t}>{t}</option>)}
              </select>
            </FF>
            <FF label="Total Price (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="0.00" required /></FF>
            <FF label="Downpayment (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.downpayment} onChange={e=>setForm(f=>({...f,downpayment:e.target.value}))} placeholder="0.00" /></FF>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── job costing ─────────────────────────────────────────────────────────────
function JobCostingView({ jobCosts, onAdd, onUpdate, onDelete }: { jobCosts: JobCost[]; onAdd: (j: JobCost) => void; onUpdate: (j: JobCost) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ invoiceId:"", clientName:"", empId:"", goldUsed:"", stoneCost:"", laborCost:"", sellingPrice:"" });

  const filtered = useMemo(() => jobCosts.filter(j =>
    [j.invoiceId, j.clientName, j.jobCostId].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [jobCosts, q]);

  const resetForm = () => setForm({ invoiceId:"", clientName:"", empId:"", goldUsed:"", stoneCost:"", laborCost:"", sellingPrice:"" });
  const closeModal = () => { setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const goldUsed = parseFloat(form.goldUsed) || 0;
    const goldCostPerG = GOLD_PRICE;
    const goldCost = goldUsed * goldCostPerG;
    const stoneCost = parseFloat(form.stoneCost) || 0;
    const laborCost = parseFloat(form.laborCost) || 0;
    const totalCost = goldCost + stoneCost + laborCost;
    const sellingPrice = parseFloat(form.sellingPrice) || 0;
    const profit = sellingPrice - totalCost;
    const marginPct = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    const entry: JobCost = {
      jobCostId: editingId ?? "JC-"+String(Date.now()).slice(-4), invoiceId:form.invoiceId,
      clientName:form.clientName, empId:form.empId, goldUsed, goldCostPerG,
      goldCost, stoneCost, laborCost, totalCost, sellingPrice, profit, marginPct,
    };
    try {
      await fetch(`${BASE_URL}/job-cost`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ jobCostId:entry.jobCostId, goldUsed:entry.goldUsed,
          laborCost:entry.laborCost, invoiceId:entry.invoiceId, empId:entry.empId }) });
    } catch (_) {}
    if (editingId) {
      onUpdate(entry);
    } else {
      onAdd(entry);
    }
    closeModal();
    setIsSubmitting(false);
    submittingRef.current = false;
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search invoice, client…" />
        <AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add Job Cost" />
      </div>
      <TableWrap>
        <thead><tr>
          {["Job Cost ID","Invoice #","Client","Gold (g)","Gold Cost/g","Gold Cost","Stone Cost","Labor Cost","Total Cost","Selling Price","Profit","Margin %"].map(h=><th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map(j => (
            <TRow key={j.jobCostId}>
              <td className={tdc + " text-muted-foreground"}>{j.jobCostId}</td>
              <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{j.invoiceId}</td>
              <td className={tdc + " font-sans font-medium"}>{j.clientName}</td>
              <td className={tdr}>{j.goldUsed.toFixed(2)}</td>
              <td className={tdr}>{php(j.goldCostPerG)}</td>
              <td className={tdr}>{php(j.goldCost)}</td>
              <td className={tdr}>{php(j.stoneCost)}</td>
              <td className={tdr}>{php(j.laborCost)}</td>
              <td className={tdr + " text-red-700 dark:text-red-400"}>{php(j.totalCost)}</td>
              <td className={tdr + " text-amber-700 dark:text-amber-300"}>{php(j.sellingPrice)}</td>
              <td className={tdr + " text-emerald-700 dark:text-emerald-400 font-semibold"}>{php(j.profit)}</td>
              <td className={tdc}>
                <span className={marginCls(j.marginPct)}>{pct(j.marginPct)}</span>
              </td>
              <td className={tdc}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setEditingId(j.jobCostId); setForm({ invoiceId:j.invoiceId, clientName:j.clientName, empId:j.empId ?? "", goldUsed:String(j.goldUsed), stoneCost:String(j.stoneCost), laborCost:String(j.laborCost), sellingPrice:String(j.sellingPrice) }); setOpen(true); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                    <PenSquare size={13} />
                  </button>
                  <button type="button" onClick={() => onDelete(j.jobCostId)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </TRow>
          ))}
          {!filtered.length && <EmptyRow cols={13} />}
        </tbody>
      </TableWrap>
      {open && (
        <Modal title={editingId ? "Edit Job Cost Entry" : "Add Job Cost Entry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Entry" : "Save Entry"} isSubmitting={isSubmitting}>
          <div className="grid grid-cols-2 gap-4">
            <FF label="Invoice #"><input className={ic} value={form.invoiceId} onChange={e=>setForm(f=>({...f,invoiceId:e.target.value}))} placeholder="INV-2026-xxx" required /></FF>
            <FF label="Client Name"><input className={ic} value={form.clientName} onChange={e=>setForm(f=>({...f,clientName:e.target.value}))} placeholder="Full name" required /></FF>
            <FF label="Employee ID (opt.)"><input className={ic} value={form.empId} onChange={e=>setForm(f=>({...f,empId:e.target.value}))} placeholder="EMP-xxx" /></FF>
            <FF label="Gold Used (g)"><input type="number" min="0" step="0.01" className={ic} value={form.goldUsed} onChange={e=>setForm(f=>({...f,goldUsed:e.target.value}))} placeholder="0.00" /></FF>
            <FF label={`Gold Cost/g (auto ₱${GOLD_PRICE.toLocaleString()})`}>
              <input className={ic + " opacity-60 cursor-not-allowed"} value={`₱${GOLD_PRICE.toLocaleString()}`} readOnly />
            </FF>
            <FF label="Stone Cost (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.stoneCost} onChange={e=>setForm(f=>({...f,stoneCost:e.target.value}))} placeholder="0.00" /></FF>
            <FF label="Labor Cost (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.laborCost} onChange={e=>setForm(f=>({...f,laborCost:e.target.value}))} placeholder="0.00" /></FF>
            <FF label="Selling Price (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.sellingPrice} onChange={e=>setForm(f=>({...f,sellingPrice:e.target.value}))} placeholder="0.00" required /></FF>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">Profit and margin % are auto-calculated on save.</p>
        </Modal>
      )}
    </div>
  );
}

// ── gold inventory ──────────────────────────────────────────────────────────
function GoldInventoryView({ inventory, onAdd, onUpdate, onDelete }: { inventory: InvEntry[]; onAdd: (e: InvEntry) => void; onUpdate: (e: InvEntry) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ date:"", referenceId:"", itemName:"", goldIn:"", goldOut:"", scrap:"", unit:"grams" });
  const filtered = useMemo(() => inventory.filter(e =>
    [e.referenceId, e.itemName].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [inventory, q]);
  const currentBalance = inventory.length > 0 ? inventory[inventory.length - 1].balance : 0;

  const resetForm = () => setForm({ date:"", referenceId:"", itemName:"", goldIn:"", goldOut:"", scrap:"", unit:"grams" });
  const closeModal = () => { setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const goldIn = parseFloat(form.goldIn) || 0;
    const goldOut = parseFloat(form.goldOut) || 0;
    const scrap = parseFloat(form.scrap) || 0;
    const balance = Math.max(0, currentBalance + goldIn - goldOut - scrap);
    const entry: InvEntry = { id: editingId ?? String(Date.now()), date:form.date, referenceId:form.referenceId,
      itemName:form.itemName, goldIn, goldOut, scrap, balance, unit:form.unit };
    try {
      await fetch(`${BASE_URL}/inventory`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ referenceId:entry.referenceId, goldIn:entry.goldIn,
          goldOut:entry.goldOut, scraps:entry.scrap, totalGold:entry.balance, unit:entry.unit }) });
    } catch (_) {}
    if (editingId) {
      onUpdate(entry);
    } else {
      onAdd(entry);
    }
    closeModal();
    setIsSubmitting(false);
    submittingRef.current = false;
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <SearchBar value={q} onChange={setQ} placeholder="Search reference, item…" />
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            <Package size={13} className="text-primary" />
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Balance:</span>
            <span className="text-sm font-bold text-primary tabular-nums">{currentBalance.toFixed(2)} g</span>
          </div>
        </div>
        <AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add Entry" />
      </div>
      <TableWrap>
        <thead><tr>
          {["Date","Reference / Invoice","Item Description","Gold In (g)","Gold Out (g)","Scrap (g)","Balance (g)"].map(h=><th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map(e => (
            <TRow key={e.id}>
              <td className={tdc}>{fmtDate(e.date)}</td>
              <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{e.referenceId}</td>
              <td className={tdc + " font-sans"}>{e.itemName}</td>
              <td className={tdr + (e.goldIn > 0 ? " text-emerald-700 dark:text-emerald-400" : " text-muted-foreground")}>{e.goldIn > 0 ? "+"+e.goldIn.toFixed(2) : "—"}</td>
              <td className={tdr + (e.goldOut > 0 ? " text-red-700 dark:text-red-400" : " text-muted-foreground")}>{e.goldOut > 0 ? "-"+e.goldOut.toFixed(2) : "—"}</td>
              <td className={tdr + (e.scrap > 0 ? " text-amber-700 dark:text-amber-400" : " text-muted-foreground")}>{e.scrap > 0 ? e.scrap.toFixed(2) : "—"}</td>
              <td className={tdr + " text-primary font-semibold"}>{e.balance.toFixed(2)}</td>
              <td className={tdc}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setEditingId(e.id); setForm({ date:e.date, referenceId:e.referenceId, itemName:e.itemName, goldIn:String(e.goldIn), goldOut:String(e.goldOut), scrap:String(e.scrap), unit:e.unit }); setOpen(true); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                    <PenSquare size={13} />
                  </button>
                  <button type="button" onClick={() => onDelete(e.id)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </TRow>
          ))}
          {!filtered.length && <EmptyRow cols={8} />}
        </tbody>
      </TableWrap>
      {open && (
        <Modal title={editingId ? "Edit Inventory Entry" : "Add Inventory Entry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Entry" : "Save Entry"} isSubmitting={isSubmitting}>
          <div className="grid grid-cols-2 gap-4">
            <FF label="Date"><input type="date" className={ic} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required /></FF>
            <FF label="Reference / Invoice"><input className={ic} value={form.referenceId} onChange={e=>setForm(f=>({...f,referenceId:e.target.value}))} placeholder="PO-xxx or INV-xxx" required /></FF>
            <div className="col-span-2"><FF label="Item Description"><input className={ic} value={form.itemName} onChange={e=>setForm(f=>({...f,itemName:e.target.value}))} placeholder="Describe the transaction" required /></FF></div>
            <FF label="Gold In (g)"><input type="number" min="0" step="0.01" className={ic} value={form.goldIn} onChange={e=>setForm(f=>({...f,goldIn:e.target.value}))} placeholder="0.00" /></FF>
            <FF label="Gold Out (g)"><input type="number" min="0" step="0.01" className={ic} value={form.goldOut} onChange={e=>setForm(f=>({...f,goldOut:e.target.value}))} placeholder="0.00" /></FF>
            <FF label="Scrap (g)"><input type="number" min="0" step="0.01" className={ic} value={form.scrap} onChange={e=>setForm(f=>({...f,scrap:e.target.value}))} placeholder="0.00" /></FF>
            <FF label="Unit"><select className={ic} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}><option>grams</option><option>troy oz</option></select></FF>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">Current balance: {currentBalance.toFixed(2)} g — new balance auto-calculated.</p>
        </Modal>
      )}
    </div>
  );
}

// ── inquiries ───────────────────────────────────────────────────────────────
function InquiriesView({ inquiries, onAdd, onUpdate, onDelete }: { inquiries: Inquiry[]; onAdd: (i: Inquiry) => void; onUpdate: (i: Inquiry) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ customerName:"", contactInfo:"", details:"", category:"", quotedPrice:"", status:"Pending" as InqStatus });
  const filtered = useMemo(() => inquiries.filter(i =>
    [i.customerName, i.category, i.details, i.inquiryId].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [inquiries, q]);

  const resetForm = () => setForm({ customerName:"", contactInfo:"", details:"", category:"", quotedPrice:"", status:"Pending" });
  const closeModal = () => { setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const entry: Inquiry = { inquiryId: editingId ?? "INQ-"+String(Date.now()).slice(-4),
      date: editingId ? (inquiries.find(i => i.inquiryId === editingId)?.date ?? new Date().toISOString().slice(0,10)) : new Date().toISOString().slice(0,10), customerName:form.customerName,
      contactInfo:form.contactInfo, details:form.details, category:form.category,
      quotedPrice:parseFloat(form.quotedPrice)||0, status:form.status };
    try {
      await fetch(`${BASE_URL}/inquiries`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ inquiryId:entry.inquiryId, customerName:entry.customerName,
          contactInfo:entry.contactInfo, details:entry.details, category:entry.category,
          quotedPrice:entry.quotedPrice, status:entry.status }) });
    } catch (_) {}
    if (editingId) {
      onUpdate(entry);
    } else {
      onAdd(entry);
    }
    closeModal();
    setIsSubmitting(false);
    submittingRef.current = false;
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search client, category…" />
        <AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add Inquiry" />
      </div>
      <TableWrap>
        <thead><tr>
          {["Date","Inquiry ID","Client Name","Contact","Category","Details","Quoted Price","Status"].map(h=><th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map(i => (
            <TRow key={i.inquiryId}>
              <td className={tdc}>{fmtDate(i.date)}</td>
              <td className={tdc + " text-muted-foreground"}>{i.inquiryId}</td>
              <td className={tdc + " font-sans font-medium"}>{i.customerName}</td>
              <td className={tdc + " text-muted-foreground"}>{i.contactInfo}</td>
              <td className={tdc}>{i.category}</td>
              <td className={tdc + " font-sans max-w-[200px] truncate text-muted-foreground"}>{i.details}</td>
              <td className={tdr + " text-amber-700 dark:text-amber-300"}>{php(i.quotedPrice)}</td>
              <td className={tdc}><StatusBadge status={i.status} /></td>
              <td className={tdc}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setEditingId(i.inquiryId); setForm({ customerName:i.customerName, contactInfo:i.contactInfo, details:i.details, category:i.category, quotedPrice:String(i.quotedPrice), status:i.status }); setOpen(true); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                    <PenSquare size={13} />
                  </button>
                  <button type="button" onClick={() => onDelete(i.inquiryId)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </TRow>
          ))}
          {!filtered.length && <EmptyRow cols={9} />}
        </tbody>
      </TableWrap>
      {open && (
        <Modal title={editingId ? "Edit Inquiry" : "Add New Inquiry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Entry" : "Save Entry"} isSubmitting={isSubmitting}>
          <div className="grid grid-cols-2 gap-4">
            <FF label="Customer Name"><input className={ic} value={form.customerName} onChange={e=>setForm(f=>({...f,customerName:e.target.value}))} placeholder="Full name" required /></FF>
            <FF label="Contact Info"><input className={ic} value={form.contactInfo} onChange={e=>setForm(f=>({...f,contactInfo:e.target.value}))} placeholder="09XX-XXX-XXXX" /></FF>
            <FF label="Product Category"><input className={ic} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Custom Ring" required /></FF>
            <FF label="Quoted Price (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.quotedPrice} onChange={e=>setForm(f=>({...f,quotedPrice:e.target.value}))} placeholder="0.00" /></FF>
            <div className="col-span-2"><FF label="Details / Notes"><textarea className={ic + " h-20 resize-none"} value={form.details} onChange={e=>setForm(f=>({...f,details:e.target.value}))} placeholder="Describe the customer's request…" /></FF></div>
            <FF label="Status">
              <select className={ic} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as InqStatus}))}>
                {(["Pending","Yes","No"] as InqStatus[]).map(t=><option key={t}>{t}</option>)}
              </select>
            </FF>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── expenses ────────────────────────────────────────────────────────────────
function ExpensesView({ expenses, onAdd, onUpdate, onDelete }: { expenses: Expense[]; onAdd: (e: Expense) => void; onUpdate: (e: Expense) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ expDate:"", category:"Rent", description:"", amount:"" });
  const filtered = useMemo(() => expenses.filter(e =>
    [e.category, e.description, e.expenseId].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [expenses, q]);
  const total = useMemo(() => filtered.reduce((a, e) => a + e.amount, 0), [filtered]);

  const resetForm = () => setForm({ expDate:"", category:"Rent", description:"", amount:"" });
  const closeModal = () => { setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const entry: Expense = { expenseId: editingId ?? "EXP-"+String(Date.now()).slice(-4), expDate:form.expDate,
      category:form.category, description:form.description, amount:parseFloat(form.amount)||0 };
    try {
      await fetch(`${BASE_URL}/expenses`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ expenseId:entry.expenseId, category:entry.category,
          amount:entry.amount, description:entry.description, expDate:entry.expDate }) });
    } catch (_) {}
    if (editingId) {
      onUpdate(entry);
    } else {
      onAdd(entry);
    }
    closeModal();
    setIsSubmitting(false);
    submittingRef.current = false;
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <SearchBar value={q} onChange={setQ} placeholder="Search category, description…" />
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <TrendingDown size={13} className="text-red-600 dark:text-red-400" />
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Total:</span>
            <span className="text-sm font-bold text-red-700 dark:text-red-400 tabular-nums">{php(total)}</span>
          </div>
        </div>
        <AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add Expense" />
      </div>
      <TableWrap>
        <thead><tr>
          {["Date","Expense ID","Category","Description","Amount"].map(h=><th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map(e => (
            <TRow key={e.expenseId}>
              <td className={tdc}>{fmtDate(e.expDate)}</td>
              <td className={tdc + " text-muted-foreground"}>{e.expenseId}</td>
              <td className={tdc}>
                <span className="px-2 py-0.5 rounded text-[10px] border bg-muted dark:bg-slate-800/60 border-border text-muted-foreground uppercase tracking-wide">
                  {e.category}
                </span>
              </td>
              <td className={tdc + " font-sans text-muted-foreground max-w-[300px]"}>{e.description}</td>
              <td className={tdr + " text-red-700 dark:text-red-400 font-semibold"}>{php(e.amount)}</td>
              <td className={tdc}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setEditingId(e.expenseId); setForm({ expDate:e.expDate, category:e.category, description:e.description, amount:String(e.amount) }); setOpen(true); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                    <PenSquare size={13} />
                  </button>
                  <button type="button" onClick={() => onDelete(e.expenseId)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </TRow>
          ))}
          {!filtered.length && <EmptyRow cols={6} />}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 dark:bg-slate-900/50">
            <td colSpan={4} className="px-3 py-3 text-[11px] font-mono text-muted-foreground uppercase tracking-widest text-right">Total</td>
            <td className="px-3 py-3 text-right font-bold text-red-700 dark:text-red-400 tabular-nums text-sm">{php(total)}</td>
          </tr>
        </tfoot>
      </TableWrap>
      {open && (
        <Modal title={editingId ? "Edit Expense Entry" : "Add Expense Entry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Entry" : "Save Entry"} isSubmitting={isSubmitting}>
          <div className="grid grid-cols-2 gap-4">
            <FF label="Date"><input type="date" className={ic} value={form.expDate} onChange={e=>setForm(f=>({...f,expDate:e.target.value}))} required /></FF>
            <FF label="Category">
              <select className={ic} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {["Rent","Staff Salary","Utilities","Supplies","Tax & Permits","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
            </FF>
            <div className="col-span-2"><FF label="Description"><input className={ic} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the expense" required /></FF></div>
            <FF label="Amount (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" required /></FF>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── profit analysis ─────────────────────────────────────────────────────────
const MONTHLY = [
  { month:"Jan", revenue:285000, cost:201000, expenses:68000 },
  { month:"Feb", revenue:322000, cost:227000, expenses:70000 },
  { month:"Mar", revenue:398000, cost:278000, expenses:72500 },
  { month:"Apr", revenue:778000, cost:478000, expenses:76500 },
  { month:"May", revenue:445000, cost:312000, expenses:74000 },
];
const PIE_COLORS = ["#d4a017","#f59e0b","#38bdf8","#a78bfa","#ef4444"];

function ProfitAnalysisView({ sales, jobCosts, expenses }: {
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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

// ── header kpi card ─────────────────────────────────────────────────────────
function KPICard({ label, value, sub, badge, vc = "" }: {
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

// ── app ────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("nilo-user") || "null"); } catch { return null; } });
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

  // Apply dark class and persist preference
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("nilo-theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);

  // Wire API endpoints — graceful fallback to seed data when server is offline
  useEffect(() => { fetch(`${BASE_URL}/sales`).then(r=>r.ok ? r.json() : Promise.reject(r)).then(rows=>setSales(asRows(rows).map(normalizeSale))).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_URL}/job-cost`).then(r=>r.ok ? r.json() : Promise.reject(r)).then(rows=>setJobCosts(asRows(rows).map(normalizeJobCost))).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_URL}/inventory`).then(r=>r.ok ? r.json() : Promise.reject(r)).then(rows=>setInventory(asRows(rows).map(normalizeInventory))).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_URL}/inquiries`).then(r=>r.ok ? r.json() : Promise.reject(r)).then(rows=>setInquiries(asRows(rows).map(normalizeInquiry))).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_URL}/expenses`).then(r=>r.ok ? r.json() : Promise.reject(r)).then(rows=>setExpenses(asRows(rows).map(normalizeExpense))).catch(()=>{}); }, []);

  if (!user) return <LoginScreen onLogin={setUser} />;

  const goldStock  = inventory.length > 0 ? inventory[inventory.length - 1].balance : 0;
  const totalRev   = jobCosts.reduce((a, j) => a + j.sellingPrice, 0);
  const totalCost  = jobCosts.reduce((a, j) => a + j.totalCost, 0);
  const totalExp   = expenses.reduce((a, e) => a + e.amount, 0);
  const netProfit  = totalRev - totalCost - totalExp;
  const netMargin  = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
  const today      = new Date().toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" });

  const TAB_LABELS: Record<Tab, string> = {
    DASHBOARD:"Dashboard", DAILY_SALES:"Daily Sales", JOB_COSTING:"Job Costing",
    GOLD_INVENTORY:"Gold Inventory", INQUIRIES:"Inquiries", EXPENSES:"Expenses",
    PROFIT_ANALYSIS:"Profit Analysis",
  };

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
        {tab === "DAILY_SALES"     && <DailySalesView sales={sales} onAdd={s => setSales(p => [s, ...p])} onUpdate={s => setSales(p => p.map(item => item.id === s.id ? s : item))} onDelete={id => setSales(p => p.filter(item => item.id !== id))} />}
        {tab === "JOB_COSTING"     && <JobCostingView jobCosts={jobCosts} onAdd={j => setJobCosts(p => [j, ...p])} onUpdate={j => setJobCosts(p => p.map(item => item.jobCostId === j.jobCostId ? j : item))} onDelete={id => setJobCosts(p => p.filter(item => item.jobCostId !== id))} />}
        {tab === "GOLD_INVENTORY"  && <GoldInventoryView inventory={inventory} onAdd={e => setInventory(p => [...p, e])} onUpdate={e => setInventory(p => p.map(item => item.id === e.id ? e : item))} onDelete={id => setInventory(p => p.filter(item => item.id !== id))} />}
        {tab === "INQUIRIES"       && <InquiriesView inquiries={inquiries} onAdd={i => setInquiries(p => [i, ...p])} onUpdate={i => setInquiries(p => p.map(item => item.inquiryId === i.inquiryId ? i : item))} onDelete={id => setInquiries(p => p.filter(item => item.inquiryId !== id))} />}
        {tab === "EXPENSES"        && <ExpensesView expenses={expenses} onAdd={e => setExpenses(p => [e, ...p])} onUpdate={e => setExpenses(p => p.map(item => item.expenseId === e.expenseId ? e : item))} onDelete={id => setExpenses(p => p.filter(item => item.expenseId !== id))} />}
        {tab === "PROFIT_ANALYSIS" && <ProfitAnalysisView sales={sales} jobCosts={jobCosts} expenses={expenses} />}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in");
      localStorage.setItem("nilo-user", JSON.stringify(data.user));
      localStorage.setItem("nilo-token", data.token);
      onLogin(data.user);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-amber-500/20 bg-slate-900 p-8 shadow-2xl">
      <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center"><Crown className="text-white" /></div>
      <h1 className="text-center text-xl font-semibold text-white">Nilo&apos;s Goldsmith</h1>
      <p className="text-center text-xs text-slate-400 mt-1 mb-7">Master Control System</p>
      <label className="block text-xs text-slate-300 mb-1">Username</label>
      <input value={userName} onChange={e=>setUserName(e.target.value)} className="w-full mb-4 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white outline-none focus:border-amber-400" autoComplete="username" />
      <label className="block text-xs text-slate-300 mb-1">Password</label>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full mb-5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white outline-none focus:border-amber-400" autoComplete="current-password" />
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </div>;
}
