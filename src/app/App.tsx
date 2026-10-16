import { roundTwo } from "../rounding";
import { Fragment, useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import goldsmithLogo from "../assets/nilosgold_logo.jpg";
import {
  Search, Plus, X, Crown, TrendingUp, TrendingDown,
  Package, BarChart3, DollarSign, Gem, Sun, Moon, PenSquare, Trash2,
  ArrowUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { isValidEmail, isValidPHContact, normalizeContactInput } from "../validation";
import { ContactInput } from "./components/ContactInput";
import { summarizeInventory, groupInventory } from "../inventorySummary";
import { approvalChanges, approvalValue } from "../approvalDiff";

// ── config ─────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "https://nilosgold.vercel.app").replace(/\/$/, "");
const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => fetch(input, { ...init, credentials: "include" });
const notify = (message: string) => window.dispatchEvent(new CustomEvent("nilosgold:toast", { detail: message }));
// Keep existing call sites on the in-app toast surface instead of native dialogs.
const alert = notify;

function ToastHost() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const onToast = (event: Event) => {
      setMessage(String((event as CustomEvent).detail ?? ""));
      window.setTimeout(() => setMessage(""), 4200);
    };
    window.addEventListener("nilosgold:toast", onToast);
    return () => window.removeEventListener("nilosgold:toast", onToast);
  }, []);
  if (!message) return null;
  return <div className="fixed bottom-5 right-5 z-[100] max-w-sm rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-2xl" role="status" aria-live="polite">{message}</div>;
}

type ConfirmationRequest = { title: string; message: string; confirmLabel?: string; onConfirm: () => void | Promise<void> };
const ConfirmationContext = createContext<(request: ConfirmationRequest) => void>(() => undefined);
const useConfirmation = () => useContext(ConfirmationContext);

function ConfirmationDialog({ request, onClose }: { request: ConfirmationRequest; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => { setBusy(true); try { await request.onConfirm(); onClose(); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl mx-4">
      <h2 id="confirmation-title" className="text-base font-semibold">{request.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{request.message}</p>
      <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg bg-muted px-4 py-2 text-sm">Cancel</button><button type="button" disabled={busy} onClick={confirm} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">{busy ? "Working…" : (request.confirmLabel ?? "Confirm")}</button></div>
    </div>
  </div>;
}

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
const pct = (n: number) => n.toFixed(2) + "%";
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "short", day: "2-digit", year: "numeric",
  });
const todayISO = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
};

const numeric = (value: unknown) => Number(value ?? 0);
const apiDate = (value: unknown) => value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10);
const statusLabel = (value: unknown): string => {
  const labels: Record<string, string> = {
    PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", FINISHED: "Finished",
    IN_PROGRESS: "In Progress", READY_FOR_PICKUP: "Ready for Pickup", CANCELLED: "Cancelled", PARTIAL: "Partial", PAID: "Paid",
  };
  const status = String(value ?? "Pending");
  return labels[status] ?? status;
};
const isCompletedSale = (sale: Sale) => ["Finished", "Paid", "Released"].includes(sale.status);
const normalizeSale = (row: any): Sale => ({
  id: row.invoiceId,
  invoiceId: row.invoiceId,
  jobCostId: row.jobCostId ?? row.job?.jobCostId,
  date: apiDate(row.salesDate ?? row.date),
  clientId: row.clientId ?? row.client?.clientId,
  clientName: row.clientName ?? row.client?.clientName ?? "",
  contactNum: normalizeContactInput(row.contactNum ?? row.client?.contactNum ?? ""),
  email: row.email ?? row.client?.email ?? "",
  serviceType: row.serviceType ?? "Custom",
  price: numeric(row.price),
  payment: numeric(row.payment),
  balance: numeric(row.balance ?? (numeric(row.price) - numeric(row.payment))),
  receiptSentAt: row.receiptSentAt ? String(row.receiptSentAt) : null,
  status: statusLabel(row.status) as SaleStatus,
});
const normalizeJobCost = (row: any): JobCost => {
  const sellingPrice = roundTwo(row.sellingPrice ?? row.sales?.price ?? row.sale?.price);
  const goldCostPerG = roundTwo(numeric(row.goldCostPerG));
  const goldCost = roundTwo(row.goldCost ?? roundTwo(numeric(row.goldUsed)) * goldCostPerG);
  const totalCost = roundTwo(row.totalCost ?? goldCost + roundTwo(numeric(row.laborCost)) + roundTwo(numeric(row.stoneCost)));
  const sale = row.sales ?? row.sale;
  return { jobCostId: String(row.jobCostId ?? ""), invoiceId: String(row.invoiceId ?? sale?.invoiceId ?? ""), clientName: String(row.clientName ?? sale?.client?.clientName ?? row.inquiry?.customerName ?? ""), itemName: row.itemName ?? "", deadline: row.deadline || row.deliveryDate ? String(row.deadline ?? row.deliveryDate).slice(0, 10) : "", empId: row.empId, inquiryId: row.inquiryId ?? row.inquiry?.inquiryId, status: statusLabel(row.status), sale: sale ? normalizeSale(sale) : undefined, goldUsed: roundTwo(numeric(row.goldUsed)), goldScrap: roundTwo(numeric(row.goldScrap)), goldCostPerG, goldCost, stoneCost: roundTwo(numeric(row.stoneCost)), laborCost: roundTwo(numeric(row.laborCost)), totalCost, sellingPrice, profit: roundTwo(row.profit ?? sellingPrice - totalCost), marginPct: roundTwo(row.marginPct ?? (sellingPrice ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0)) };
};
const normalizeInventory = (row: any): InvEntry => ({ id: row.referenceId, date: apiDate(row.updatedAt ?? row.date), referenceId: row.referenceId, itemName: row.itemName ?? row.referenceId, category: row.category ?? "GOLD", quantityIn: numeric(row.quantityIn ?? row.goldIn), quantityOut: numeric(row.quantityOut ?? row.goldOut), quantityLoss: numeric(row.quantityLoss ?? row.scraps ?? row.scrap), balance: numeric(row.balance ?? row.totalGold), unit: row.unit ?? "grams", unitPrice: numeric(row.unitPrice) });
const normalizeInquiry = (row: any): Inquiry => ({ inquiryId: String(row.inquiryId ?? ""), date: apiDate(row.inqDate ?? row.date), customerName: String(row.customerName ?? ""), contactInfo: normalizeContactInput(String(row.contactInfo ?? "")), email: String(row.email ?? ""), details: String(row.details ?? ""), category: String(row.category ?? ""), quotedPrice: numeric(row.quotedPrice), isFullyPaid: Boolean(row.isFullyPaid), status: statusLabel(row.status) as InqStatus });
const normalizeExpense = (row: any): Expense => ({ expenseId: String(row.expenseId ?? ""), expDate: apiDate(row.expDate ?? row.date), category: String(row.category ?? ""), description: String(row.description ?? ""), amount: numeric(row.amount) });
const asRows = (value: unknown): any[] => Array.isArray(value) ? value : [];

// ── types ──────────────────────────────────────────────────────────────────
type ServiceType = "Custom" | "Repair" | "Resize" | "Cleaning";
type SaleStatus = "Ongoing" | "Paid" | "Released" | "Pending" | "Finished" | "Partial" | "Cancelled";
type InqStatus = "Yes" | "No" | "Pending" | "Approved" | "Rejected" | "Finished";

interface Sale {
  id: string; invoiceId: string; date: string; clientId?: string; jobCostId?: string;
  clientName: string; contactNum: string; email?: string; serviceType: ServiceType;
  price: number; payment: number; balance: number; status: SaleStatus; receiptSentAt?: string | null;
}
interface JobCost {
  jobCostId: string; invoiceId: string; clientName: string; itemName: string; deadline: string; empId?: string;
  inquiryId?: string; status: string; sale?: Sale;
  goldUsed: number; goldScrap: number; goldCostPerG: number; goldCost: number;
  stoneCost: number; laborCost: number; totalCost: number;
  sellingPrice: number; profit: number; marginPct: number;
}
interface InvEntry {
  id: string; date: string; referenceId: string; itemName: string;
  category: string; quantityIn: number; quantityOut: number; quantityLoss: number; balance: number; unit: string; unitPrice: number;
}
interface Inquiry {
  inquiryId: string; date: string; customerName: string; contactInfo: string; email: string;
  details: string; category: string; quotedPrice: number; isFullyPaid: boolean; status: InqStatus;
}
interface Expense {
  expenseId: string; expDate: string; category: string; description: string; amount: number;
}

const TABS = [
  "DASHBOARD", "DAILY_SALES", "JOB_COSTING", "INVENTORY",
  "INQUIRIES", "EXPENSES", "PROFIT_ANALYSIS", "APPROVALS", "AUDIT_LOGS",
] as const;
type Tab = (typeof TABS)[number];

// ── shared ui primitives ────────────────────────────────────────────────────

// Status badge: adaptive text so it reads on both light and dark
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Ongoing: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    Released: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
    Finished: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    Approved: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    "Ready for Pickup": "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
    Yes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    No: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
    Rejected: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
    Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    "In Progress": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Partial: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Cancelled: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
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
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-sm font-medium transition-opacity">
      <Plus size={13} /> {label}
    </button>
  );
}

function AddStockChangeButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return <button type="button" onClick={event => { event.stopPropagation(); onClick(); }}
    className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${compact
      ? "gap-1 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] text-primary hover:bg-primary/10"
      : "gap-2 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"}`}>
    <Plus size={compact ? 12 : 16} aria-hidden="true" />{compact ? "Add stock" : "Add Stock Change"}
  </button>;
}

// Table primitives – both light and dark adaptive
const thc = [
  "px-3 py-2.5 text-left text-[10px] text-muted-foreground uppercase tracking-widest font-medium whitespace-nowrap border-r border-border/50 last:border-r-0",
  "bg-muted/60 dark:bg-slate-900/70",
  "border-b border-border",
].join(" ");

const tdc = [
  "px-3 py-2.5 text-xs whitespace-nowrap border-t border-border border-r border-border/50 last:border-r-0",
  "text-foreground/80 dark:text-slate-300",
].join(" ");

const tdr = tdc + " text-right tabular-nums";

function TRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={e => { if (onClick && !(e.target as HTMLElement).closest("button")) onClick(); }} onKeyDown={e => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }} tabIndex={onClick ? 0 : undefined} className={`hover:bg-muted/40 dark:hover:bg-slate-800/25 transition-colors ${onClick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : ""}`}>
      {children}
    </tr>
  );
}

type SortSpec = { key: string; direction: 1 | -1 };
function sortRecords<T extends object>(rows: T[], sort: SortSpec): T[] {
  return [...rows].sort((a, b) => {
    const left = (a as any)[sort.key];
    const right = (b as any)[sort.key];
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true, sensitivity: "base" });
    return comparison * sort.direction;
  });
}

function SortableHeader({ label, sortKey, sort, onSort }: {
  label: string; sortKey: string; sort: SortSpec; onSort: (key: string) => void;
}) {
  const active = sort.key === sortKey;
  return <th className={thc} aria-sort={active ? (sort.direction === 1 ? "ascending" : "descending") : "none"}>
    <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
      {label}{active ? (sort.direction === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ArrowUpDown size={12} className="opacity-40" />}
    </button>
  </th>;
}

function BrandLogo({ className = "" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <div className={`rounded-xl bg-primary text-primary-foreground flex items-center justify-center ${className}`}><Crown size={20} /></div>
    : <img src="/nilosgold_logo.jpg" alt="Nilo's Goldsmith" onError={() => setFailed(true)} className={`rounded-xl object-contain bg-white ${className}`} />;
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
  const tipLabel = payload[0]?.payload?.period ?? label;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs font-mono">
      <p className="text-muted-foreground mb-2 uppercase tracking-widest text-[10px]">{tipLabel}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {php(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── dashboard view ─────────────────────────────────────────────────────────
function DashboardView({ sales, jobCosts, expenses, inquiries, rangeLabel, onView, isAdmin }: {
  sales: Sale[]; jobCosts: JobCost[]; expenses: Expense[]; inquiries: Inquiry[];
  isAdmin: boolean;
  rangeLabel: string; onView: (title: string, record: Record<string, unknown>) => void;
}) {
  const [salesSort, setSalesSort] = useState<SortSpec>({ key: "date", direction: -1 });
  const [jobSort, setJobSort] = useState<SortSpec>({ key: "invoiceId", direction: -1 });
  const toggleSalesSort = (key: string) => setSalesSort(s => ({ key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
  const toggleJobSort = (key: string) => setJobSort(s => ({ key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
  const totalSales = useMemo(() => sales.reduce((a, s) => a + s.price, 0), [sales]);
  const cashCollected = useMemo(() => sales.reduce((a, s) => a + s.payment, 0), [sales]);
  const receivables = totalSales - cashCollected;

  const totalRevenue = useMemo(() => sales.reduce((a, s) => a + s.price, 0), [sales]);
  const totalJobCost = useMemo(() => jobCosts.reduce((a, j) => a + j.totalCost, 0), [jobCosts]);
  const grossProfit = totalRevenue - totalJobCost;
  const avgMargin = useMemo(() =>
    jobCosts.length ? jobCosts.reduce((a, j) => a + j.marginPct, 0) / jobCosts.length : 0, [jobCosts]);

  const totalExpenses = useMemo(() => expenses.reduce((a, e) => a + e.amount, 0), [expenses]);
  const expByCat = useMemo(() => expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount; return acc;
  }, {} as Record<string, number>), [expenses]);

  const netProfit = grossProfit - totalExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const totalInq = inquiries.length;
  const closedInq = inquiries.filter(i => ["Approved", "Finished", "Yes"].includes(i.status)).length;
  const convRate = totalInq > 0 ? (closedInq / totalInq) * 100 : 0;

  const recentSales = sortRecords(useMemo(() => [...sales], [sales]), salesSort).slice(0, 7);
  const recentJC = sortRecords(useMemo(() => [...jobCosts], [jobCosts]), jobSort).slice(0, 6);

  const catColors: Record<string, string> = {
    "Rent": "#1746a2", "Staff Salary": "#d4a017", "Utilities": "#496bb2", "Supplies": "#111318", "Tax & Permits": "#b18a16",
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
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Sales Summary · {rangeLabel}</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Total Sales", val: php(totalSales), cls: "text-amber-700 dark:text-amber-300 font-semibold" },
              { label: "Cash Collected", val: php(cashCollected), cls: "text-emerald-700 dark:text-emerald-400" },
              { label: "Collectibles", val: php(receivables), cls: "text-amber-700 dark:text-amber-400" },
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
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Revenue and Job Cost · {rangeLabel}</span>
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
            {isAdmin && <div className="h-px bg-border" />}
            {isAdmin && <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Gross Profit</span>
              <span className="text-base tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">{php(grossProfit)}</span>
            </div>}
            {isAdmin && <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Avg Margin</span>
              <span className="text-sm tabular-nums text-emerald-700 dark:text-emerald-300">{pct(avgMargin)}</span>
            </div>}
            {/*
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Gross Profit</span>
              <span className="text-base tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">{php(grossProfit)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Avg Margin</span>
              <span className="text-sm tabular-nums text-emerald-700 dark:text-emerald-300">{pct(avgMargin)}</span>
            </div>
            */}
          </div>
        </div>

        {/* Expenses */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={13} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Expenses · {rangeLabel}</span>
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
          {isAdmin && <>
            <div className="flex items-center gap-2 mb-3">
              <Gem size={13} className="text-primary shrink-0" />
              <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Net Profit · {rangeLabel}</span>
            </div>
            <div className="mb-4">
              <div className={`text-2xl font-bold tabular-nums ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                {php(netProfit)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{pct(netMargin)} net margin</div>
            </div>
            <div className="h-px bg-border mb-4" />
          </>}
          {!isAdmin && <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Inquiry Funnel</div>}
          <div className="space-y-2">
            {[
              { label: "Total Inquiries", val: totalInq, w: 100, color: "#d4a017" },
              { label: "Closed", val: closedInq, w: convRate, color: "#059669" },
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section>
          <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-muted-foreground">Daily Sales Log · Recent Entries</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentSales.map(s => <button key={s.id} type="button" onClick={() => onView("Sale details", s as unknown as Record<string, unknown>)} className="rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{s.clientName}</p><p className="truncate text-xs text-primary">{s.invoiceId}</p></div><StatusBadge status={s.status} /></div>
              <div className="mt-3 flex justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.serviceType} · {fmtDate(s.date)}</p><p className="mt-1 text-sm font-semibold tabular-nums">{php(s.price)}</p></div><span className="self-end text-[10px] text-muted-foreground">View</span></div>
            </button>)}
            {!recentSales.length && <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">No sales in this timeline</div>}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-muted-foreground">Job Costing · Recent Entries</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentJC.map(j => <button key={j.jobCostId} type="button" onClick={() => onView("Job cost details", j as unknown as Record<string, unknown>)} className="rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{j.clientName}</p><p className="truncate text-xs text-primary">{j.invoiceId}</p></div><StatusBadge status={j.status} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span className="text-muted-foreground">Total cost</span><span className="text-right tabular-nums">{php(j.totalCost)}</span>{isAdmin && <><span className="text-muted-foreground">Profit</span><span className="text-right font-semibold tabular-nums text-emerald-700">{php(j.profit)}</span></>}</div>
            </button>)}
            {!recentJC.length && <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">No job costing in this timeline</div>}
          </div>
        </section>
      </div>
      <div className="hidden">
        {/* Legacy table layout retained for existing sort wiring */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">
              Daily Sales Log <span className="text-primary/70">— Recent Entries</span>
            </p>
            <TableWrap>
              <thead><tr>
                {[["Date", "date"], ["Invoice #", "invoiceId"], ["Client", "clientName"], ["Type", "serviceType"], ["Total", "price"], ["Status", "status"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={salesSort} onSort={toggleSalesSort} />)}
              </tr></thead>
              <tbody>
                {recentSales.map(s => (
                  <TRow key={s.id} onClick={() => onView("Sale details", s as unknown as Record<string, unknown>)}>
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
            <p className="dashboard-recent-title font-mono text-muted-foreground uppercase tracking-widest mb-3">
              Job Costing <span className="text-primary/70">— Recent Entries</span>
            </p>
            <TableWrap>
              <thead><tr>
                {[["Invoice #", "invoiceId"], ["Client", "clientName"], ["Gold (g)", "goldUsed"], ["Total Cost", "totalCost"], ["Selling", "sellingPrice"], ["Profit", "profit"], ["Margin", "marginPct"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={jobSort} onSort={toggleJobSort} />)}
              </tr></thead>
              <tbody>
                {recentJC.map(j => (
                  <TRow key={j.jobCostId} onClick={() => onView("Job cost details", j as unknown as Record<string, unknown>)}>
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
    </div>
  );
}

// ── daily sales ─────────────────────────────────────────────────────────────
function DailySalesView({ sales, onUpdate, onDelete }: { sales: Sale[]; onUpdate: (s: Sale) => void; onDelete: (id: string) => void }) {
  const requestConfirmation = useConfirmation();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortSpec>({ key: "date", direction: -1 });
  const toggleSort = (key: string) => setSort(s => ({ key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ invoiceId: "", date: "", clientName: "", contactNum: "", email: "", serviceType: "Custom" as ServiceType, price: "", payment: "" });

  const filtered = sortRecords(useMemo(() => sales.filter(s =>
    [s.clientName, s.invoiceId, s.serviceType, s.status].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [sales, q]), sort);

  const resetForm = () => setForm({ invoiceId: "", date: todayISO(), clientName: "", contactNum: "", email: "", serviceType: "Custom", price: "", payment: "" });
  const closeModal = () => { setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (!editingId) throw new Error("Finish an approved job costing to create a Daily Sales entry.");
      const price = Number(form.price); const payment = Number(form.payment);
      if (form.email.trim() && !isValidEmail(form.email)) throw new Error("Enter a valid customer email address.");
      if (!isValidPHContact(form.contactNum)) throw new Error("Enter a valid Philippine contact number (11 digits starting with 09).");
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(payment) || payment < 0 || payment > price) throw new Error("Payment must be zero or greater and no greater than the total price.");
      const response = await apiFetch(`${BASE_URL}/sales/${encodeURIComponent(editingId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: form.invoiceId, date: form.date, serviceType: form.serviceType, price,
          payment, clientName: form.clientName, contactNum: form.contactNum, email: form.email.trim()
        })
      });
      const saved = await response.json();
      if (response.status === 202) { alert(saved.message); closeModal(); setIsSubmitting(false); submittingRef.current = false; return; }
      if (!response.ok) throw new Error(saved.error ?? "Sale could not be saved");
      onUpdate(normalizeSale(saved));
    } catch (error) { alert(error instanceof Error ? error.message : "Sale could not be saved"); setIsSubmitting(false); submittingRef.current = false; return; }
    closeModal();
    setIsSubmitting(false);
    submittingRef.current = false;
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search client, invoice, type…" />
        <p className="text-xs text-muted-foreground">Sales appear here after an approved job costing is finished.</p>
      </div>
      <TableWrap>
        <thead><tr>
          {[["Date", "date"], ["Invoice #", "invoiceId"], ["Client Name", "clientName"], ["Contact", "contactNum"], ["Type", "serviceType"], ["Total Price", "price"], ["Payment", "payment"], ["Balance", "balance"], ["Status", "status"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} />)}<th className={thc}>Actions</th>
        </tr></thead>
        <tbody>
          {filtered.map(s => (
            <TRow key={s.id} onClick={() => { setEditingId(s.invoiceId); setForm({ invoiceId: s.invoiceId, date: s.date, clientName: s.clientName, contactNum: s.contactNum, email: s.email ?? "", serviceType: s.serviceType, price: String(s.price), payment: String(s.payment) }); setOpen(true); }}>
              <td className={tdc}>{fmtDate(s.date)}</td>
              <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{s.invoiceId}</td>
              <td className={tdc + " font-sans font-medium"}>{s.clientName}</td>
              <td className={tdc + " text-muted-foreground"}>{s.contactNum}</td>
              <td className={tdc}>{s.serviceType}</td>
              <td className={tdr}>{php(s.price)}</td>
              <td className={tdr + " text-emerald-700 dark:text-emerald-400"}>{php(s.payment)}</td>
              <td className={tdr + " text-amber-700 dark:text-amber-400"}>{php(s.balance)}</td>
              <td className={tdc}><StatusBadge status={s.status} /></td>
              <td className={tdc}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setEditingId(s.invoiceId); setForm({ invoiceId: s.invoiceId, date: s.date, clientName: s.clientName, contactNum: s.contactNum, email: s.email ?? "", serviceType: s.serviceType, price: String(s.price), payment: String(s.payment) }); setOpen(true); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
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
        <Modal title="Edit Finished Sale" onClose={closeModal} onSubmit={submit} submitLabel="Update Sale" isSubmitting={isSubmitting}>
          <div className="grid grid-cols-2 gap-4">
            <FF label="Invoice #"><input className={ic} value={form.invoiceId} readOnly /></FF>
            <FF label="Date"><input type="date" max={todayISO()} className={ic} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></FF>
            <FF label="Client Name"><input className={ic} value={form.clientName} readOnly /></FF>
            <FF label="Contact #"><ContactInput className={ic} value={form.contactNum} onChange={contactNum => setForm(f => ({ ...f, contactNum }))} required /></FF>
            <FF label="Service Type">
              <select className={ic} value={form.serviceType} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value as ServiceType }))}>
                {(["Custom", "Repair", "Resize", "Cleaning"] as ServiceType[]).map(t => <option key={t}>{t}</option>)}
              </select>
            </FF>
            <FF label="Total Price (₱)"><input type="number" min="0.01" step="0.01" className={ic} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" required /></FF>
            <FF label="Payment (₱)"><input type="number" min="0" max={form.price || undefined} step="0.01" className={ic} value={form.payment} onChange={e => setForm(f => ({ ...f, payment: e.target.value }))} placeholder="0.00" /></FF>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── job costing ─────────────────────────────────────────────────────────────
function JobCostingView({ jobCosts, inquiries, inventory, selectedInquiryId, clearSelectedInquiry, onAdd, onUpdate, onDelete, onApprove, onReady, onFinish, rangeLabel }: {
  jobCosts: JobCost[]; inquiries: Inquiry[]; selectedInquiryId: string | null; clearSelectedInquiry: () => void;
  inventory: InvEntry[];
  onAdd: (j: JobCost) => void; onUpdate: (j: JobCost) => void; onDelete: (j: JobCost) => void; onFinish: (j: JobCost, materials: { referenceId: string; quantity: number }[]) => void;
  onApprove: (j: JobCost) => void; onReady: (j: JobCost) => void; rangeLabel: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortSpec>({ key: "invoiceId", direction: -1 });
  const toggleSort = (key: string) => setSort(s => ({ key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finishTarget, setFinishTarget] = useState<JobCost | null>(null);
  const [finishQuantities, setFinishQuantities] = useState<Record<string, string>>({});
  const [finishMaterialId, setFinishMaterialId] = useState("");
  const submittingRef = useRef(false);
  const pendingInquiries = inquiries.filter(i => i.status === "Pending");
  const blankForm = () => ({ inquiryId: "", invoiceId: "", clientName: "", itemName: "", deadline: "", contactNum: "", empId: "", serviceType: "Custom" as ServiceType, goldUsed: "", goldScrap: "", goldCostPerG: "", stoneCost: "", laborCost: "", sellingPrice: "" });
  const [form, setForm] = useState(blankForm);
  const selectInquiry = (inquiryId: string) => {
    const inquiry = pendingInquiries.find(item => item.inquiryId === inquiryId);
    setForm(f => ({ ...f, inquiryId, clientName: inquiry?.customerName ?? "", contactNum: inquiry?.contactInfo ?? "", sellingPrice: inquiry ? String(inquiry.quotedPrice) : "" }));
  };
  useEffect(() => {
    if (!selectedInquiryId) return;
    const inquiry = pendingInquiries.find(item => item.inquiryId === selectedInquiryId);
    setEditingId(null);
    setForm({ ...blankForm(), inquiryId: selectedInquiryId, clientName: inquiry?.customerName ?? "", contactNum: inquiry?.contactInfo ?? "", sellingPrice: inquiry ? String(inquiry.quotedPrice) : "" });
    setOpen(true);
    clearSelectedInquiry();
  }, [selectedInquiryId]);

  const filtered = sortRecords(useMemo(() => jobCosts.filter(j =>
    [j.invoiceId, j.clientName, j.jobCostId].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [jobCosts, q]), sort);
  const resetForm = () => setForm(blankForm());
  const editJob = (j: JobCost) => {
    setEditingId(j.jobCostId);
    setForm({ inquiryId: j.inquiryId ?? "", invoiceId: j.invoiceId, clientName: j.clientName, itemName: j.itemName, deadline: j.deadline, contactNum: j.sale?.contactNum ?? "", empId: j.empId ?? "", serviceType: j.sale?.serviceType ?? "Custom", goldUsed: String(j.goldUsed), goldScrap: String(j.goldScrap), goldCostPerG: String(j.goldCostPerG), stoneCost: String(j.stoneCost), laborCost: String(j.laborCost), sellingPrice: String(j.sellingPrice) });
    setOpen(true);
  };
  const closeModal = () => { setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const goldUsed = roundTwo(form.goldUsed);
    const goldScrap = roundTwo(form.goldScrap || 0);
    const goldCostPerG = roundTwo(form.goldCostPerG);
    const stoneCost = roundTwo(form.stoneCost || 0);
    const laborCost = roundTwo(form.laborCost);
    const sellingPrice = roundTwo(form.sellingPrice);
    if (![goldUsed, goldScrap, stoneCost, laborCost].every(Number.isFinite) || goldUsed < 0 || goldScrap < 0 || stoneCost < 0 || laborCost < 0 || !Number.isFinite(goldCostPerG) || goldCostPerG <= 0 || !Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      alert("Enter valid costs and a selling price greater than zero.");
      setIsSubmitting(false); submittingRef.current = false; return;
    }
    if (form.deadline && form.deadline < todayISO()) {
      alert("Delivery date must be today or later.");
      setIsSubmitting(false); submittingRef.current = false; return;
    }
    try {
      const payload = editingId
        ? { invoiceId: form.invoiceId, clientName: form.clientName, itemName: form.itemName, deadline: form.deadline || undefined, empId: form.empId || undefined, goldUsed, goldScrap, goldCostPerG, stoneCost, laborCost, sellingPrice }
        : { inquiryId: form.inquiryId, clientName: form.clientName, itemName: form.itemName, deadline: form.deadline || undefined, contactNum: form.contactNum, empId: form.empId || undefined, serviceType: form.serviceType, goldUsed, goldScrap, goldCostPerG, stoneCost, laborCost, sellingPrice };
      if (!editingId && !form.inquiryId) throw new Error("Choose a pending inquiry before creating job costing.");
      const response = await apiFetch(`${BASE_URL}/job-cost${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.status === 202) { alert(data.message); closeModal(); return; }
      if (!response.ok) throw new Error(data.error ?? "Job costing could not be saved.");
      const saved = normalizeJobCost(data);
      if (editingId) onUpdate(saved); else onAdd(saved);
      closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Job costing could not be saved.");
    } finally {
      setIsSubmitting(false); submittingRef.current = false;
    }
  };

  const finishJob = (job: JobCost) => {
    if (!job.invoiceId) return;
    setFinishTarget(job); setFinishQuantities({}); setFinishMaterialId("");
  };
  const fields = (job: JobCost) => [
    ["Job Cost ID", job.jobCostId], ["Invoice #", job.invoiceId], ["Client", job.clientName],
    ["Gold Used", `${job.goldUsed.toFixed(2)} g`], ["Gold Cost / g", php(job.goldCostPerG)],
    ["Gold Cost", php(job.goldCost)], ["Stone Cost", php(job.stoneCost)], ["Labor Cost", php(job.laborCost)],
    ["Total Cost", php(job.totalCost)], ["Selling Price", php(job.sellingPrice)], ["Profit", php(job.profit)],
    ["Margin", pct(job.marginPct)], ["Status", job.status],
  ];

  return (
    <div className="p-5 space-y-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Job Costing · {rangeLabel}</p>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search invoice, client, or job ID…" />
        <AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Cost a Pending Inquiry" />
      </div>

      <div className="hidden 2xl:block overflow-hidden rounded-xl border border-border">
        <table className="w-full table-fixed text-[10px] font-mono">
          <thead><tr>{[["Job Cost ID", "jobCostId"], ["Invoice #", "invoiceId"], ["Client", "clientName"], ["Gold g", "goldUsed"], ["Gold / g", "goldCostPerG"], ["Gold Cost", "goldCost"], ["Stone", "stoneCost"], ["Labor", "laborCost"], ["Total Cost", "totalCost"], ["Selling", "sellingPrice"], ["Profit", "profit"], ["Margin", "marginPct"], ["Status", "status"]].map(([label, key]) => <th key={key} className="border-b border-border bg-muted/60 px-1 py-2 text-left text-[9px] font-medium uppercase leading-tight tracking-wide text-muted-foreground"><button type="button" className="inline-flex items-center gap-0.5" onClick={() => toggleSort(key)}>{label}{sort.key === key ? (sort.direction === 1 ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ArrowUpDown size={9} className="opacity-40" />}</button></th>)}<th className="border-b border-border bg-muted/60 px-1 py-2 text-left text-[9px] uppercase text-muted-foreground">Actions</th></tr></thead>
          <tbody>{filtered.map(j => <TRow key={j.jobCostId} onClick={() => editJob(j)}>
            <td className="break-all border-t border-border px-1 py-2 text-muted-foreground">{j.jobCostId}</td>
            <td className="break-all border-t border-border px-1 py-2 text-primary/80">{j.invoiceId || "—"}</td>
            <td className="truncate border-t border-border px-1 py-2 font-sans font-medium" title={j.clientName}>{j.clientName}</td>
            <td className="border-t border-border px-1 py-2 text-right tabular-nums">{j.goldUsed.toFixed(2)}</td>
            <td className="border-t border-border px-1 py-2 text-right tabular-nums">{php(j.goldCostPerG)}</td>
            <td className="border-t border-border px-1 py-2 text-right tabular-nums">{php(j.goldCost)}</td>
            <td className="border-t border-border px-1 py-2 text-right tabular-nums">{php(j.stoneCost)}</td>
            <td className="border-t border-border px-1 py-2 text-right tabular-nums">{php(j.laborCost)}</td>
            <td className="border-t border-border px-1 py-2 text-right tabular-nums text-red-700">{php(j.totalCost)}</td>
            <td className="border-t border-border px-1 py-2 text-right tabular-nums text-amber-700">{php(j.sellingPrice)}</td>
            <td className="border-t border-border px-1 py-2 text-right tabular-nums text-emerald-700">{php(j.profit)}</td>
            <td className="border-t border-border px-1 py-2 text-center"><span className={marginCls(j.marginPct)}>{pct(j.marginPct)}</span></td>
            <td className="border-t border-border px-1 py-2"><StatusBadge status={j.status} /></td>
            <td className="border-t border-border px-1 py-2"><div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => editJob(j)} className="rounded p-1 text-muted-foreground hover:bg-muted" title="Edit"><PenSquare size={12} /></button>
              {j.status === "Pending" && <button type="button" onClick={e => { e.stopPropagation(); onApprove(j); }} className="rounded px-1.5 py-1 text-[9px] font-semibold text-blue-700 hover:bg-blue-500/10">Approve</button>}
              {["Approved", "In Progress"].includes(j.status) && <button type="button" onClick={e => { e.stopPropagation(); onReady(j); }} className="rounded px-1.5 py-1 text-[9px] font-semibold text-sky-700 hover:bg-sky-500/10">Ready</button>}
              {["Approved", "Ready for Pickup"].includes(j.status) && <button type="button" onClick={e => { e.stopPropagation(); finishJob(j); }} className="rounded px-1.5 py-1 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-500/10">Finish</button>}
              <button type="button" onClick={() => onDelete(j)} className="rounded p-1 text-muted-foreground hover:bg-muted" title="Delete"><Trash2 size={12} /></button>
            </div></td>
          </TRow>)}{!filtered.length && <EmptyRow cols={14} />}</tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 2xl:hidden">
        {filtered.map(j => <article key={j.jobCostId} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div><div className="text-sm font-semibold">{j.clientName}</div><div className="text-xs text-primary">{j.invoiceId || "Invoice pending"}</div></div>
            <StatusBadge status={j.status} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {fields(j).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="break-words text-xs font-medium tabular-nums">{value}</dd></div>)}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => editJob(j)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Edit</button>
            {j.status === "Pending" && <button type="button" onClick={() => onApprove(j)} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs text-white">Approve Costing</button>}
            {["Approved", "In Progress"].includes(j.status) && <button type="button" onClick={() => onReady(j)} className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs text-white">Ready for Pickup</button>}
            {["Approved", "Ready for Pickup"].includes(j.status) && <button type="button" onClick={() => finishJob(j)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white">Finish Sale</button>}
            <button type="button" onClick={() => onDelete(j)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Delete</button>
          </div>
        </article>)}
        {!filtered.length && <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">No matching records</div>}
      </div>

      {finishTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">Materials used for {finishTarget.invoiceId}</h2><p className="mt-1 text-xs text-muted-foreground">Select packaging or optional materials and enter the quantities used.</p><select aria-label="Extra inventory material" className={ic + " mt-4"} value={finishMaterialId} onChange={e => setFinishMaterialId(e.target.value)}><option value="">Select an inventory item</option>{inventory.filter(item => item.balance > 0 && item.category !== "GOLD" && item.category !== "TOOLS").map(item => <option key={item.referenceId} value={item.referenceId}>{item.itemName} · {item.category} · {item.balance} {item.unit} available</option>)}</select><div className="mt-3 max-h-64 space-y-2 overflow-auto">{inventory.filter(item => item.balance > 0 && item.category !== "GOLD" && item.category !== "TOOLS" && (!finishMaterialId || item.referenceId === finishMaterialId)).map(item => <label key={item.referenceId} className="grid grid-cols-[1fr_6rem] items-center gap-3 rounded border border-border p-2 text-sm"><span>{item.itemName} <small className="text-muted-foreground">({item.category}, {item.balance} {item.unit} available)</small></span><input aria-label={`Quantity of ${item.itemName}`} type="number" min="0" max={item.balance} step="0.01" className={ic} value={finishQuantities[item.referenceId] ?? ""} onChange={e => setFinishQuantities(v => ({ ...v, [item.referenceId]: e.target.value }))} /></label>)}{!inventory.some(item => item.balance > 0 && item.category !== "GOLD" && item.category !== "TOOLS") && <p className="text-sm text-muted-foreground">No packaging or optional material stock is available.</p>}</div><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => setFinishTarget(null)}>Cancel</button><button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" onClick={() => { const materials = Object.entries(finishQuantities).filter(([, q]) => Number(q) > 0).map(([referenceId, q]) => ({ referenceId, quantity: Number(q) })); onFinish(finishTarget, materials); setFinishTarget(null) }}>Finish Sale</button></div></div></div>}
      {open && <Modal title={editingId ? "Edit Job Costing" : "Cost a Pending Inquiry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Costing" : "Save Pending Costing"} isSubmitting={isSubmitting}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!editingId && <FF label="Pending Inquiry"><select className={ic} value={form.inquiryId} onChange={e => selectInquiry(e.target.value)} required><option value="">Select an inquiry</option>{pendingInquiries.map(i => <option key={i.inquiryId} value={i.inquiryId}>{i.customerName} · {i.category} · {i.inquiryId}</option>)}</select></FF>}
          {editingId && <FF label="Invoice #"><input className={ic} value={form.invoiceId} readOnly /></FF>}
          <FF label="Client Name"><input className={ic} value={form.clientName} readOnly placeholder="Select a pending inquiry" required /></FF>
          {!editingId && <FF label="Service Type"><select className={ic} value={form.serviceType} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value as ServiceType }))}>{(["Custom", "Repair", "Resize", "Cleaning"] as ServiceType[]).map(t => <option key={t}>{t}</option>)}</select></FF>}
          <FF label="Employee ID (optional)"><input className={ic} value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} placeholder="Leave blank to assign available staff" /></FF>
          <FF label="Gold Used (g)"><input type="number" min="0" step="0.001" className={ic} value={form.goldUsed} onChange={e => setForm(f => ({ ...f, goldUsed: e.target.value }))} required /></FF><FF label="Gold Scrap (g)"><input type="number" min="0" step="0.001" className={ic} value={form.goldScrap} onChange={e => setForm(f => ({ ...f, goldScrap: e.target.value }))} /></FF>
          <FF label="Gold Cost / Price per g (₱)"><input type="number" min="0.01" step="0.01" className={ic} value={form.goldCostPerG} onChange={e => setForm(f => ({ ...f, goldCostPerG: e.target.value }))} required /></FF>
          <FF label="Stone Cost (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.stoneCost} onChange={e => setForm(f => ({ ...f, stoneCost: e.target.value }))} required /></FF>
          <FF label="Labor Cost (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.laborCost} onChange={e => setForm(f => ({ ...f, laborCost: e.target.value }))} required /></FF>
          <FF label="Item Name (optional)"><input className={ic} value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="e.g. Gold ring" maxLength={120} /></FF>
          <FF label="Delivery Date / Deadline (optional)"><input type="date" min={todayISO()} className={ic} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></FF>
          <FF label="Selling Price (₱)"><input type="number" min="0.01" step="0.01" className={ic} value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} required /></FF>
        </div>
        <p className="text-xs text-muted-foreground">Invoice number and job costing ID are assigned automatically. Profit and margin are calculated from these costs.</p>
      </Modal>}
    </div>
  );
}

// ── multi-category inventory ────────────────────────────────────────────────
const INVENTORY_CATEGORIES = ["GOLD", "SILVER", "GEMSTONES", "BOXES", "PACKAGING", "FINDINGS", "TOOLS"];
const INVENTORY_UNITS: Record<string, string[]> = { GOLD: ["grams", "troy oz"], SILVER: ["grams"], GEMSTONES: ["carats", "pieces"], BOXES: ["boxes", "pieces"], PACKAGING: ["pieces", "boxes"], FINDINGS: ["pieces", "grams"], TOOLS: ["pieces"] };
function GoldInventoryView({ inventory, goldRate, onAdd, onUpdate, onDelete }: { inventory: InvEntry[]; goldRate: number | null; onAdd: (e: InvEntry) => void; onUpdate: (e: InvEntry) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortSpec>({ key: "date", direction: -1 });
  const toggleSort = (key: string) => setSort(s => ({ key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const blank = () => ({ date: todayISO(), referenceId: "", itemName: "", category: "GOLD", quantityIn: "", quantityOut: "", quantityLoss: "", unit: "grams", unitPrice: "" });
  const [form, setForm] = useState(blank);
  const filtered = sortRecords(useMemo(() => inventory.filter(e => (categoryFilter === "ALL" || e.category === categoryFilter) && [e.referenceId, e.itemName, e.category].some(v => v.toLowerCase().includes(q.toLowerCase()))), [inventory, q, categoryFilter]), sort);
  const summary = useMemo(() => summarizeInventory(inventory, filtered), [inventory, filtered]);
  const products = useMemo(() => groupInventory(inventory), [inventory]);
  const visibleProducts = groupInventory(sortRecords(inventory, sort), filtered);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState("");
  const selectProduct = (key: string) => {
    setSelectedProduct(key);
    const product = products.find(p => p.key === key);
    const latest = product && [...product.movements]
      .sort((a, b) => b.date.localeCompare(a.date) || b.referenceId.localeCompare(a.referenceId))
      .find(row => row.unitPrice > 0);
    const unitPrice = latest ? (latest.unitPrice / (latest.unit === "troy oz" && product?.unit === "grams" ? 31.1034768 : 1)).toFixed(2) : "";
    setForm(f => product ? { ...blank(), date: f.date, itemName: product.itemName, category: product.category, unit: product.unit, unitPrice } : blank());
  };
  const addMovement = (key: string) => { setEditingId(null); selectProduct(key); setOpen(true); };
  const goldBalance = summary.goldGrams;
  const units = INVENTORY_UNITS[form.category] ?? ["pieces"];
  const closeModal = () => { setOpen(false); setEditingId(null); setSelectedProduct(""); setForm(blank()); };
  const edit = (e: InvEntry) => { setSelectedProduct(""); setEditingId(e.id); setForm({ date: e.date, referenceId: e.referenceId, itemName: e.itemName, category: e.category, quantityIn: String(e.quantityIn), quantityOut: String(e.quantityOut), quantityLoss: String(e.quantityLoss), unit: e.unit, unitPrice: String(e.unitPrice) }); setOpen(true); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (submittingRef.current) return;
    submittingRef.current = true; setIsSubmitting(true);
    const entry: InvEntry = { id: editingId ?? "", date: form.date, referenceId: form.referenceId, itemName: form.itemName, category: form.category, quantityIn: Number(form.quantityIn) || 0, quantityOut: Number(form.quantityOut) || 0, quantityLoss: Number(form.quantityLoss) || 0, balance: 0, unit: form.unit, unitPrice: Number(form.unitPrice) || 0 };
    if (!Number.isFinite(entry.unitPrice) || entry.unitPrice <= 0) { alert("Unit price must be greater than zero."); setIsSubmitting(false); submittingRef.current = false; return; }
    if (entry.quantityIn + entry.quantityOut + entry.quantityLoss <= 0) { alert("Enter a positive quantity for at least one movement."); setIsSubmitting(false); submittingRef.current = false; return; }
    try {
      const response = await apiFetch(`${BASE_URL}/inventory${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: entry.date, itemName: entry.itemName, category: entry.category, quantityIn: entry.quantityIn, quantityOut: entry.quantityOut, quantityLoss: entry.quantityLoss, unit: entry.unit, unitPrice: entry.unitPrice }) });
      const saved = await response.json();
      if (response.status === 202) { alert(saved.message); closeModal(); setIsSubmitting(false); submittingRef.current = false; return; }
      if (!response.ok) throw new Error(saved.error ?? "Inventory entry could not be saved.");
      const result = normalizeInventory(saved); if (editingId) onUpdate(result); else onAdd(result);
    } catch (error) { alert(error instanceof Error ? error.message : "Inventory entry could not be saved."); setIsSubmitting(false); submittingRef.current = false; return; }
    closeModal(); setIsSubmitting(false); submittingRef.current = false;
  };
  return <div className="p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-lg font-semibold">Inventory overview</h2><p className="mt-1 text-xs text-muted-foreground">Track stock, materials, and movement across your workshop.</p></div>
      <AddStockChangeButton onClick={() => { setForm(blank()); setSelectedProduct(""); setEditingId(null); setOpen(true); }} />
    </div>
    <div className="grid items-center gap-4 xl:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)]">
      <div className="space-y-2"><SearchBar value={q} onChange={setQ} placeholder="Search reference, item…" />
        <select className={ic + " w-auto"} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Filter inventory category"><option value="ALL">All categories</option>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <section aria-label="Item Summary" className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground"><h3>Item Summary</h3><Package size={17} className="text-primary" /></div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{summary.entries.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Ledger entries matching your filters</p>
        </section>
        <section aria-label="Product Summary" className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground"><h3>Product Summary</h3><Gem size={17} className="text-emerald-600" /></div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{summary.inStock.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">in stock / {summary.products}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.quantities.length ? summary.quantities.map(([unit, quantity]) => `${quantity.toLocaleString("en-PH", { maximumFractionDigits: 3 })} ${unit}`).join(" · ") : "No stock remaining"}</p>
        </section>
      </div>
    </div>
    <div className="flex flex-wrap justify-between gap-2 rounded-lg border border-border px-4 py-3 text-xs"><span className="text-muted-foreground">Gold stock <b className="ml-2 text-foreground">{goldBalance.toLocaleString("en-PH", { maximumFractionDigits: 3 })} g</b></span><span className="text-muted-foreground">24K reference value <b className="ml-2 text-primary">{goldRate === null ? "Rate unavailable" : php(goldBalance * goldRate)}</b></span></div>
  <TableWrap><thead><tr>{[["Date", "date"], ["Category", "category"], ["Reference", "referenceId"], ["Item Description", "itemName"], ["In", "quantityIn"], ["Unit Price", "unitPrice"], ["Out", "quantityOut"], ["Loss / Scrap", "quantityLoss"], ["Balance", "balance"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} />)}<th className={thc}>Actions</th></tr></thead>
      <tbody>{visibleProducts.map(product => <Fragment key={product.key}>
        <tr className="border-b border-border bg-muted/30">
          <td className={tdc} colSpan={4}><button type="button" className="flex items-center gap-2 text-left font-semibold" aria-expanded={expanded.has(product.key)} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(product.key)) next.delete(product.key); else next.add(product.key); return next; })}>
            {expanded.has(product.key) ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}{product.itemName}<span className="font-normal text-muted-foreground">{product.category} · {product.movements.length} movements</span>
          </button></td>
          <td className={tdr}>{product.quantityIn.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td><td className={tdr}>—</td>
          <td className={tdr}>{product.quantityOut.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td><td className={tdr}>{product.quantityLoss.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td>
          <td className={tdr+" text-primary font-semibold"}>{product.balance.toLocaleString("en-PH", { maximumFractionDigits:3 })} {product.unit}</td>
          <td className={tdc}><AddStockChangeButton compact onClick={() => addMovement(product.key)} /></td>
        </tr>
        {expanded.has(product.key) && product.movements.map(e => <TRow key={e.id} onClick={()=>edit(e)}><td className={tdc}>{fmtDate(e.date)}</td><td className={tdc}><span className="rounded bg-primary/10 px-2 py-1 text-[10px] uppercase">{e.category}</span></td><td className={tdc+" text-primary/80"}>{e.referenceId}</td><td className={tdc+" pl-8 font-sans"}>↳ {e.itemName}</td><td className={tdr}>{e.quantityIn ? `+${e.quantityIn}` : "—"}</td><td className={tdr}>{e.unitPrice ? php(e.unitPrice) : "—"}</td><td className={tdr}>{e.quantityOut ? `-${e.quantityOut}` : "—"}</td><td className={tdr}>{e.quantityLoss || "—"}</td><td className={tdr+" text-primary font-semibold"}>{e.balance} {e.unit}</td><td className={tdc}><div className="flex items-center gap-2"><button type="button" onClick={event=>{event.stopPropagation();edit(e);}} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Edit"><PenSquare size={13}/></button><button type="button" onClick={event=>{event.stopPropagation();onDelete(e.id);}} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Delete"><Trash2 size={13}/></button></div></td></TRow>)}
      </Fragment>)}{!visibleProducts.length && <EmptyRow cols={10}/>}</tbody>
  </TableWrap>
  {
    open && <Modal title={editingId ? "Edit Inventory Entry" : "Add Stock Change"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Entry" : "Save Entry"} isSubmitting={isSubmitting}>
      {!editingId && <FF label="Product"><select className={ic+" mb-4"} aria-label="Inventory product" value={selectedProduct} onChange={e => selectProduct(e.target.value)}><option value="">Create a new product</option>{products.map(product => <option key={product.key} value={product.key}>{product.itemName} · {product.category} · {product.unit}</option>)}</select></FF>}
      <div className="grid grid-cols-2 gap-4"><FF label="Date"><input type="date" max={todayISO()} className={ic} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></FF><FF label="Reference"><input className={ic} value={form.referenceId} readOnly placeholder="Assigned when saved" /></FF>
        <FF label="Category"><select disabled={!!selectedProduct} className={ic} value={form.category} onChange={e => { const category = e.target.value; setForm(f => ({ ...f, category, unit: INVENTORY_UNITS[category][0] })); }}>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select></FF><FF label="Unit"><select disabled={!!selectedProduct} className={ic} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>{units.map(u => <option key={u}>{u}</option>)}</select></FF>
        <div className="col-span-2"><FF label="Item Description"><input readOnly={!!selectedProduct} className={ic} value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="e.g. 18k chain, gemstone, ring box" required /></FF></div>
        <FF label={`Quantity In (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityIn} onChange={e => setForm(f => ({ ...f, quantityIn: e.target.value }))} /></FF><FF label={`Unit Price (₱ / ${form.unit})`}><input type="number" required min="0.01" step="0.01" className={ic} value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} /></FF><FF label={`Quantity Out (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityOut} onChange={e => setForm(f => ({ ...f, quantityOut: e.target.value }))} /></FF><FF label={`Loss / Scrap (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityLoss} onChange={e => setForm(f => ({ ...f, quantityLoss: e.target.value }))} /></FF>
          </div><p className="text-[10px] text-muted-foreground">Stock balance is calculated for each category, item, and unit.</p>
        </Modal>}
      </div>;
}

      // ── inquiries ───────────────────────────────────────────────────────────────
      function InquiriesView({inquiries, onAdd, onUpdate, onDelete, onStartCosting}: {inquiries: Inquiry[]; onAdd: (i: Inquiry) => void; onUpdate: (i: Inquiry) => void; onDelete: (id: string) => void; onStartCosting: (id: string) => void }) {
  const [q, setQ] = useState("");
      const [sort, setSort] = useState<SortSpec>({key: "date", direction: -1 });
  const toggleSort = (key: string) => setSort(s => ({key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
        const [open, setOpen] = useState(false);
        const [editingId, setEditingId] = useState<string | null>(null);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const submittingRef = useRef(false);
        const [form, setForm] = useState({customerName: "", contactInfo: "", email: "", details: "", category: "", quotedPrice: "", isFullyPaid: false, status: "Pending" as InqStatus });
  const filtered = sortRecords(useMemo(() => inquiries.filter(i =>
    [i.customerName, i.category, i.details, i.email, i.inquiryId].some(v => v.toLowerCase().includes(q.toLowerCase()))
        ), [inquiries, q]), sort);

  const resetForm = () => setForm({customerName: "", contactInfo: "", email: "", details: "", category: "", quotedPrice: "", isFullyPaid: false, status: "Pending" });
  const closeModal = () => {setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
          e.preventDefault();
        if (submittingRef.current) return;
        submittingRef.current = true;
        setIsSubmitting(true);
        const entry: Inquiry = {
          inquiryId: editingId ?? "",
      date: editingId ? (inquiries.find(i => i.inquiryId === editingId)?.date ?? todayISO()) : todayISO(), customerName: form.customerName,
        contactInfo: form.contactInfo, email: form.email, details: form.details, category: form.category,
        quotedPrice: parseFloat(form.quotedPrice) || 0, isFullyPaid: form.isFullyPaid, status: form.status
    };
        try {
      if (!isValidPHContact(form.contactInfo)) throw new Error("Enter a valid Philippine contact number (11 digits starting with 09).");
        if (form.email && !isValidEmail(form.email)) throw new Error("Enter a valid email address.");
        const response = await apiFetch(`${BASE_URL}/inquiries${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, {
          method: editingId ? "PUT" : "POST", headers: {"Content-Type": "application/json" },
        body: JSON.stringify({
          date: entry.date, customerName: entry.customerName,
        contactInfo: entry.contactInfo, email: entry.email, details: entry.details, category: entry.category,
        quotedPrice: entry.quotedPrice, isFullyPaid: entry.isFullyPaid
        })
      });
        const data = await response.json();
        if (response.status === 202) {alert(data.message); closeModal(); setIsSubmitting(false); submittingRef.current = false; return; }
        if (!response.ok) throw new Error(data.error ?? "Inquiry could not be saved");
        Object.assign(entry, normalizeInquiry(data));
    } catch (error) {alert(error instanceof Error ? error.message : "Inquiry could not be saved"); setIsSubmitting(false); submittingRef.current = false; return; }
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
            <SearchBar value={q} onChange={setQ} placeholder="Search client, service type…" />
            <AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add Inquiry" />
          </div>
          <TableWrap>
            <thead><tr>
    { [["Date", "date"], ["Inquiry ID", "inquiryId"], ["Client Name", "customerName"], ["Contact", "contactInfo"], ["Email", "email"], ["Category", "category"], ["Details", "details"], ["Quoted Price", "quotedPrice"], ["Fully Paid", "isFullyPaid"], ["Status", "status"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} />) } <th className={thc}>Actions</th>
        </tr ></thead >
      <tbody>
        {filtered.map(i => (
          <TRow key={i.inquiryId} onClick={() => { if (i.status === "Pending") { setEditingId(i.inquiryId); setForm({ customerName: i.customerName, contactInfo: i.contactInfo, email: i.email, details: i.details, category: i.category, quotedPrice: String(i.quotedPrice), isFullyPaid: i.isFullyPaid, status: i.status }); setOpen(true); } }}>
            <td className={tdc}>{fmtDate(i.date)}</td>
            <td className={tdc + " text-muted-foreground"}>{i.inquiryId}</td>
            <td className={tdc + " font-sans font-medium"}>{i.customerName}</td>
            <td className={tdc + " text-muted-foreground"}>{i.contactInfo}</td>
            <td className={tdc + " text-muted-foreground"}>{i.email}</td>
            <td className={tdc}>{i.category}</td>
            <td className={tdc + " font-sans max-w-[200px] truncate text-muted-foreground"}>{i.details}</td>
            <td className={tdr + " text-amber-700 dark:text-amber-300"}>{php(i.quotedPrice)}</td>
            <td className={tdc}>{i.isFullyPaid ? "Yes" : "No"}</td><td className={tdc}><StatusBadge status={i.status} /></td>
            <td className={tdc}>
              <div className="flex items-center gap-2">
                {i.status === "Pending" && <button type="button" onClick={() => onStartCosting(i.inquiryId)} className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20">Start Costing</button>}
                {i.status === "Pending" && <button type="button" onClick={e => { e.stopPropagation(); setEditingId(i.inquiryId); setForm({ customerName: i.customerName, contactInfo: i.contactInfo, email: i.email, details: i.details, category: i.category, quotedPrice: String(i.quotedPrice), isFullyPaid: i.isFullyPaid, status: i.status }); setOpen(true); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                  <PenSquare size={13} />
                </button>}
                {i.status === "Pending" && <button type="button" onClick={() => onDelete(i.inquiryId)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Delete">
                  <Trash2 size={13} />
                </button>}
              </div>
            </td>
          </TRow>
        ))}
        {!filtered.length && <EmptyRow cols={11} />}
      </tbody>
      </TableWrap >
      { open && (
        <Modal title={editingId ? "Edit Inquiry" : "Add New Inquiry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Entry" : "Save Entry"} isSubmitting={isSubmitting}>
          <div className="grid grid-cols-2 gap-4">
            <FF label="Customer Name"><input className={ic} value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Full name" required /></FF>
            <FF label="Contact Info"><ContactInput className={ic} value={form.contactInfo} onChange={contactInfo => setForm(f => ({ ...f, contactInfo }))} required /></FF>
            <FF label="Email for receipt / pickup"><input type="email" className={ic} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="customer@example.com" /></FF>
            <FF label="Service Type">
              <select className={ic} aria-label="Service Type" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required>
                <option value="" disabled>Select service type</option>
                {form.category && !["Custom", "Repair", "Resize", "Cleaning"].includes(form.category) && <option value={form.category}>{form.category} (existing)</option>}
                {["Custom", "Repair", "Resize", "Cleaning"].map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </FF>
            <FF label="Quoted Price (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.quotedPrice} onChange={e => setForm(f => ({ ...f, quotedPrice: e.target.value }))} placeholder="0.00" required /></FF>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.isFullyPaid} onChange={e => setForm(f => ({ ...f, isFullyPaid: e.target.checked }))} /> Fully Paid</label><div className="col-span-2"><FF label="Details / Notes"><textarea className={ic + " h-20 resize-none"} value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} placeholder="Describe the customer's request…" /></FF></div>
            <p className="self-end text-xs text-muted-foreground">Status changes automatically as the inquiry moves through costing and sales.</p>
          </div >
        </Modal >
      )
  }
    </div >
  );
}

// ── expenses ────────────────────────────────────────────────────────────────
function ExpensesView({ expenses, onAdd, onUpdate, onDelete, rangeLabel }: { expenses: Expense[]; onAdd: (e: Expense) => void; onUpdate: (e: Expense) => void; onDelete: (id: string) => void; rangeLabel: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortSpec>({ key: "expDate", direction: -1 });
  const toggleSort = (key: string) => setSort(s => ({ key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ expDate: "", category: "Rent", description: "", amount: "" });
  const filtered = sortRecords(useMemo(() => expenses.filter(e =>
    [e.category, e.description, e.expenseId].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [expenses, q]), sort);
  const total = useMemo(() => filtered.reduce((a, e) => a + e.amount, 0), [filtered]);

  const resetForm = () => setForm({ expDate: todayISO(), category: "Rent", description: "", amount: "" });
  const closeModal = () => { setOpen(false); setEditingId(null); resetForm(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const entry: Expense = {
      expenseId: editingId ?? "", expDate: form.expDate,
      category: form.category, description: form.description, amount: parseFloat(form.amount) || 0
    };
    try {
      const response = await apiFetch(`${BASE_URL}/expenses${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId: entry.expenseId, category: entry.category,
          amount: entry.amount, description: entry.description, expDate: entry.expDate
        })
      });
      const saved = await response.json();
      if (response.status === 202) { alert(saved.message); closeModal(); setIsSubmitting(false); submittingRef.current = false; return; }
      if (!response.ok) throw new Error(saved.error ?? "Expense could not be saved");
      entry.expenseId = saved.expenseId; entry.expDate = apiDate(saved.expDate ?? saved.date);
    } catch (error) { alert(error instanceof Error ? error.message : "Expense could not be saved"); setIsSubmitting(false); submittingRef.current = false; return; }
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
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Expenses · {rangeLabel}</p>
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
          {[["Date", "expDate"], ["Expense ID", "expenseId"], ["Category", "category"], ["Description", "description"], ["Amount", "amount"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} />)}<th className={thc}>Actions</th>
        </tr></thead>
        <tbody>
          {filtered.map(e => (
            <TRow key={e.expenseId} onClick={() => { setEditingId(e.expenseId); setForm({ expDate: e.expDate, category: e.category, description: e.description, amount: String(e.amount) }); setOpen(true); }}>
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
                  <button type="button" onClick={() => { setEditingId(e.expenseId); setForm({ expDate: e.expDate, category: e.category, description: e.description, amount: String(e.amount) }); setOpen(true); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
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
            <FF label="Date"><input type="date" max={todayISO()} className={ic} value={form.expDate} onChange={e => setForm(f => ({ ...f, expDate: e.target.value }))} required /></FF>
            <FF label="Category">
              <select className={ic} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {["Rent", "Staff Salary", "Utilities", "Supplies", "Tax & Permits", "Other"].map(c => <option key={c}>{c}</option>)}
              </select>
            </FF>
            <div className="col-span-2"><FF label="Description"><input className={ic} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the expense" required /></FF></div>
            <FF label="Amount (₱)"><input type="number" min="0.01" step="0.01" className={ic} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required /></FF>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── profit analysis ─────────────────────────────────────────────────────────
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PIE_COLORS = ["#1746a2", "#d4a017", "#496bb2", "#e2bb4e", "#111318"];

function RecordDetails({ title, record, onClose }: { title: string; record: Record<string, unknown> | null; onClose: () => void }) {
  if (!record) return null;
  const entries = Object.entries(record).filter(([key]) => key !== "id");
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()} className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-lg p-2 hover:bg-muted"><X size={18} /></button>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entries.map(([key, value]) => <div key={key} className="rounded-lg bg-muted/50 p-3">
          <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</dt>
          <dd className="break-words text-sm font-medium">{typeof value === "number" && /price|cost|profit|amount|balance|payment/i.test(key) ? php(value) : String(value ?? "—")}</dd>
        </div>)}
      </dl>
    </section>
  </div>;
}

function ProfitAnalysisView({ sales, jobCosts, expenses, selectedYear, setSelectedYear, startMonth, setStartMonth, endMonth, setEndMonth }: {
  sales: Sale[]; jobCosts: JobCost[]; expenses: Expense[];
  selectedYear: number; setSelectedYear: (year: number) => void;
  startMonth: number; setStartMonth: (month: number) => void;
  endMonth: number; setEndMonth: (month: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = new Set(Array.from({ length: 11 }, (_, i) => currentYear - i));
    [...sales.map(s => s.date), ...expenses.map(e => e.expDate)].forEach(date => {
      const year = Number(date.slice(0, 4));
      if (Number.isInteger(year) && year <= currentYear) years.add(year);
    });
    return [...years].sort((a, b) => b - a);
  }, [currentYear, sales, expenses]);
  const inSelectedPeriod = (date: string) => {
    const [year, month] = date.slice(0, 10).split("-").map(Number);
    return year === selectedYear && month - 1 >= startMonth && month - 1 <= endMonth;
  };
  const selectedSales = sales.filter(s => inSelectedPeriod(s.date));
  const salesByInvoice = new Map(sales.map(s => [s.invoiceId, s]));
  const selectedJobCosts = jobCosts.filter(j => {
    const sale = salesByInvoice.get(j.invoiceId);
    return Boolean(sale && inSelectedPeriod(sale.date));
  });
  const selectedExpenses = expenses.filter(e => inSelectedPeriod(e.expDate));
  const totalRevenue = selectedSales.reduce((a, s) => a + s.price, 0);
  const totalCost = selectedJobCosts.reduce((a, j) => a + j.totalCost, 0);
  const grossProfit = totalRevenue - totalCost;
  const totalExp = selectedExpenses.reduce((a, e) => a + e.amount, 0);
  const netProfit = grossProfit - totalExp;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const daysInSelectedMonth = new Date(selectedYear, startMonth + 1, 0).getDate();
  const chartData = startMonth === endMonth
    ? Array.from({ length: Math.ceil(daysInSelectedMonth / 7) }, (_, index) => {
      const fromDay = index * 7 + 1;
      const toDay = Math.min(fromDay + 6, daysInSelectedMonth);
      const belongsToWeek = (date: string) => Number(date.slice(8, 10)) >= fromDay && Number(date.slice(8, 10)) <= toDay;
      const revenue = selectedSales.filter(s => belongsToWeek(s.date)).reduce((sum, s) => sum + s.price, 0);
      const cost = selectedJobCosts.filter(j => belongsToWeek(salesByInvoice.get(j.invoiceId)?.date ?? "")).reduce((sum, j) => sum + j.totalCost, 0);
      const weekExpenses = selectedExpenses.filter(e => belongsToWeek(e.expDate)).reduce((sum, e) => sum + e.amount, 0);
      return { month: `W${index + 1}`, period: `Week ${index + 1} · ${MONTH_NAMES[startMonth]} ${fromDay}–${toDay}`, revenue, cost, netProfit: revenue - cost - weekExpenses };
    })
    : Array.from({ length: endMonth - startMonth + 1 }, (_, offset) => {
      const monthIndex = startMonth + offset;
      const revenue = selectedSales.filter(s => Number(s.date.slice(5, 7)) - 1 === monthIndex).reduce((sum, s) => sum + s.price, 0);
      const cost = selectedJobCosts.filter(j => Number(salesByInvoice.get(j.invoiceId)?.date.slice(5, 7)) - 1 === monthIndex).reduce((sum, j) => sum + j.totalCost, 0);
      const monthExpenses = selectedExpenses.filter(e => Number(e.expDate.slice(5, 7)) - 1 === monthIndex).reduce((sum, e) => sum + e.amount, 0);
      return { month: MONTH_NAMES[monthIndex].slice(0, 3), revenue, cost, netProfit: revenue - cost - monthExpenses };
    });
  const rangeLabel = startMonth === endMonth
    ? `${MONTH_NAMES[startMonth]} ${selectedYear}`
    : `${MONTH_NAMES[startMonth].slice(0, 3)}–${MONTH_NAMES[endMonth].slice(0, 3)} ${selectedYear}`;

  const expByCat = selectedExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount; return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(expByCat).map(([name, value]) => ({ name, value }));

  const byService = (["Custom", "Repair", "Resize", "Cleaning"] as ServiceType[]).map(type => {
    const jcs = selectedJobCosts.filter(j => salesByInvoice.get(j.invoiceId)?.serviceType === type);
    const margin = jcs.length ? jcs.reduce((a, j) => a + j.marginPct, 0) / jcs.length : 0;
    return { type, margin: parseFloat(margin.toFixed(1)), count: jcs.length };
  });

  const cardCls = "bg-card border border-border rounded-xl p-5";

  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: `Gross Profit (${rangeLabel})`, val: php(grossProfit), sub: "Revenue minus job costs", cls: "text-emerald-700 dark:text-emerald-400" },
          { label: `Total Expenses (${rangeLabel})`, val: php(totalExp), sub: "Operating overhead", cls: "text-red-700 dark:text-red-400" },
          { label: `Net Profit (${rangeLabel})`, val: php(netProfit), sub: `${pct(netMargin)} net margin`, cls: netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400" },
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
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">{startMonth === endMonth ? "Weekly" : "Monthly"} Revenue vs. Cost vs. Net Profit ({rangeLabel})</p>
            <div className="flex flex-wrap gap-2">
              <label className="text-[10px] text-muted-foreground">From
                <select aria-label="Start month" className={`${ic} ml-2 w-auto py-1.5`} value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
                  {MONTH_NAMES.map((month, i) => <option key={month} value={i} disabled={i > endMonth}>{month}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-muted-foreground">To
                <select aria-label="End month" className={`${ic} ml-2 w-auto py-1.5`} value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>
                  {MONTH_NAMES.map((month, i) => <option key={month} value={i} disabled={i < startMonth || (selectedYear === currentYear && i > new Date().getMonth())}>{month}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-muted-foreground">Year
                <select aria-label="Year" className={`${ic} ml-2 w-auto py-1.5`} value={selectedYear} onChange={e => { const year = Number(e.target.value); setSelectedYear(year); if (year === currentYear) { const maxMonth = new Date().getMonth(); setStartMonth(m => Math.min(m, maxMonth)); setEndMonth(m => Math.min(m, maxMonth)); } }}>
                  {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1746a2" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#1746a2" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4a017" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#d4a017" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={v => "₱" + (v / 1000) + "K"} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1746a2" strokeWidth={2} fill="url(#gRev)" />
              <Area type="monotone" dataKey="cost" name="Job Cost" stroke="#111318" strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#d4a017" strokeWidth={2} fill="url(#gNet)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={cardCls}>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">Expense Breakdown ({rangeLabel})</p>
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
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
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
          <BarChart data={byService} margin={{ top: 4, right: 4, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="type" tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={v => v + "%"} />
            <Tooltip
              formatter={(v: any) => [v + "%", "Avg Margin"]}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontFamily: "JetBrains Mono", fontSize: "11px", color: "var(--foreground)" }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Bar dataKey="margin" name="Margin %" radius={[4, 4, 0, 0]}>
              {byService.map((_, i) => <Cell key={i} fill={["#1746a2", "#d4a017", "#496bb2", "#111318"][i]} />)}
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

function ApprovalQueueView({ onResolved }: { onResolved: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const load = () => apiFetch(BASE_URL + "/approvals").then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Approval requests could not be loaded.");
    setRows(asRows(data));
  }).catch(err => setError(err instanceof Error ? err.message : "Approval requests could not be loaded."));
  useEffect(() => { void load(); }, []);
  const resolve = async (row: any, action: "approve" | "reject") => {
    const note = action === "reject" ? window.prompt("Optional reason for rejecting this change:") : "";
    if (action === "reject" && note === null) return;
    try {
      const response = await apiFetch(BASE_URL + "/approvals/" + encodeURIComponent(row.requestId) + "/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Approval could not be completed.");
      alert(data.message);
      await load();
      onResolved();
    } catch (err) { alert(err instanceof Error ? err.message : "Approval could not be completed."); }
  };
  const pending = rows.filter(row => row.status === "PENDING");
  return <div className="p-5 space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Admin Approval Queue</h2><p className="text-sm text-muted-foreground">Staff edits and archive requests leave records unchanged until approved.</p></div><button type="button" onClick={load} className="rounded-lg border border-border px-3 py-2 text-sm">Refresh</button></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!pending.length && !error && <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No pending requests.</div>}
    {pending.map(row => {
      const requestedAt = new Date(row.createdAt);
      const requester = row.requester?.empName ?? row.requester?.empRole ?? "Staff";
      const changes = approvalChanges(row.beforeData, row.proposedData);
      return <article key={row.requestId} className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><h3 className="font-semibold">{row.action} · {String(row.entityType).replaceAll("_", " ")}</h3><StatusBadge status="Pending" /></div><p className="mt-1 text-xs text-muted-foreground">{row.entityId} · requested by {requester} · {requestedAt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" })} · {requestedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => resolve(row, "reject")} className="rounded-lg border border-border px-3 py-2 text-sm">Reject</button><button type="button" onClick={() => resolve(row, "approve")} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Approve</button></div>
        </div>
        {row.action === "UPDATE" && <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested changes</p>{changes.length ? <dl className="space-y-3">{changes.map(change => <div key={change.key} className="grid gap-1 text-sm sm:grid-cols-[minmax(9rem,0.35fr)_1fr]"><dt className="font-medium text-foreground">{change.label}</dt><dd className="flex min-w-0 flex-wrap items-center gap-2"><span className="break-words text-muted-foreground line-through decoration-red-400/70">{approvalValue(change.initialValue)}</span><span aria-hidden="true" className="text-muted-foreground">→</span><span className="break-words font-medium text-foreground">{approvalValue(change.editedValue)}</span></dd></div>)}</dl> : <p className="text-sm text-muted-foreground">No value changes were detected.</p>}</div>}
      </article>
    })}
    {rows.some(row => row.status !== "PENDING") && <details className="rounded-xl border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">Recently reviewed requests</summary><div className="mt-3 space-y-2">{rows.filter(row => row.status !== "PENDING").slice(0, 15).map(row => <div key={row.requestId} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2 text-sm"><span>{row.action} {row.entityType} · {row.entityId}</span><StatusBadge status={statusLabel(row.status)} /></div>)}</div></details>}
  </div>;
}

function AuditLogsView() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const load = () => apiFetch(BASE_URL + "/audit-logs?limit=150").then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Audit logs could not be loaded.");
    setRows(asRows(data)); setError("");
  }).catch(err => setError(err instanceof Error ? err.message : "Audit logs could not be loaded."));
  useEffect(() => { void load(); }, []);
  return <div className="p-5 space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Audit Logs</h2><p className="text-sm text-muted-foreground">Recent sign-ins, changes, archive requests, and Admin decisions.</p></div><button type="button" onClick={load} className="rounded-lg border border-border px-3 py-2 text-sm">Refresh</button></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <TableWrap><thead><tr>{["When", "User", "Role", "Action", "Record"].map(label => <th key={label} className={thc}>{label}</th>)}</tr></thead><tbody>
      {rows.map(row => <tr key={row.logId} className="border-b border-border align-top"><td className={tdc}>{new Date(row.createdAt).toLocaleString("en-PH")}</td><td className={tdc}>{row.actorName}</td><td className={tdc}>{row.actorRole}</td><td className={tdc}><StatusBadge status={row.action} /></td><td className={tdc}>{row.entityType ? row.entityType + " · " + (row.entityId ?? "—") : "—"}</td></tr>)}
      {!rows.length && !error && <EmptyRow cols={5} />}
    </tbody></TableWrap>
  </div>;
}

// ── app ────────────────────────────────────────────────────────────────────
function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("nilo-theme-v2") === "dark"; }
    catch { return false; }
  });
  const [tab, setTab] = useState<Tab>("DASHBOARD");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(0);
  const [endMonth, setEndMonth] = useState(new Date().getMonth());
  const [viewRecord, setViewRecord] = useState<{ title: string; record: Record<string, unknown> } | null>(null);
  const [selectedInquiryForCosting, setSelectedInquiryForCosting] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [jobCosts, setJobCosts] = useState<JobCost[]>([]);
  const [inventory, setInventory] = useState<InvEntry[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goldRate, setGoldRate] = useState<number | null>(null);
  const [goldInfo, setGoldInfo] = useState<{ source: string; updatedAt: string; stale: boolean; warning?: string; fxUpdatedAt?: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const isAdmin = String(user?.empRole ?? "").toLowerCase() === "admin";

  // Apply dark class and persist preference
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("nilo-theme-v2", dark ? "dark" : "light"); } catch { }
  }, [dark]);

  // Restore the server-side session before loading any business data.
  useEffect(() => {
    let active = true;
    apiFetch(BASE_URL + "/auth/me").then(async response => {
      if (!response.ok) return null;
      return (await response.json()).user ?? null;
    }).then(foundUser => { if (active) setUser(foundUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user?.empId) {
      setSales([]); setJobCosts([]); setInventory([]); setInquiries([]); setExpenses([]);
      return;
    }
    let active = true;
    const load = async (path: string) => {
      const response = await apiFetch(BASE_URL + path);
      const data = await response.json();
      if (response.status === 401) throw Object.assign(new Error(data.error ?? "Session expired."), { unauthorized: true });
      if (!response.ok) throw new Error(data.error ?? "Data could not be loaded.");
      return data;
    };
    Promise.all([load("/sales"), load("/job-cost"), load("/inventory"), load("/inquiries"), load("/expenses")])
      .then(([salesRows, jobRows, inventoryRows, inquiryRows, expenseRows]) => {
        if (!active) return;
        setSales(asRows(salesRows).map(normalizeSale)); setJobCosts(asRows(jobRows).map(normalizeJobCost));
        setInventory(asRows(inventoryRows).map(normalizeInventory)); setInquiries(asRows(inquiryRows).map(normalizeInquiry));
        setExpenses(asRows(expenseRows).map(normalizeExpense));
      })
      .catch(error => {
        if (!active) return;
        if ((error as { unauthorized?: boolean }).unauthorized) { setUser(null); setAuthReady(true); }
        else console.error("Could not load application data:", error);
      });
    return () => { active = false; };
  }, [user?.empId, reloadKey]);

  useEffect(() => {
    if (!user?.empId) { setGoldRate(null); setGoldInfo(null); return; }
    let active = true;
    const loadGoldRate = async () => {
      try {
        const response = await apiFetch(BASE_URL + "/gold/price");
        const data = await response.json();
        if (!response.ok || data.currency !== "PHP" || !Number.isFinite(Number(data.ratePerGram)) || Number(data.ratePerGram) <= 0 || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("Gold pricing is unavailable. Enter a verified rate manually for job costing.");
        if (active) {
          setGoldRate(Number(data.ratePerGram));
          setGoldInfo({ source: data.source, updatedAt: data.updatedAt, stale: Boolean(data.stale), warning: data.warning, fxUpdatedAt: data.fxUpdatedAt });
        }
      } catch { if (active) { setGoldRate(null); setGoldInfo(null); } }
    };
    void loadGoldRate();
    const timer = window.setInterval(loadGoldRate, 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?.empId]);

  useEffect(() => {
    if (user && !isAdmin && ["PROFIT_ANALYSIS", "APPROVALS", "AUDIT_LOGS"].includes(tab)) setTab("DASHBOARD");
  }, [user, isAdmin, tab]);

  const deleteFromApi = async (resource: string, id: string, remove: () => void) => {
    setConfirmation({
      title: "Delete record", message: "This action will archive the record and may affect linked records. Continue?", confirmLabel: "Delete", onConfirm: async () => {
        try {
          const response = await apiFetch(`${BASE_URL}/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
          const data = await response.json();
          if (response.status === 202) { alert(data.message ?? "Sent to an Administrator for approval."); return; }
          if (!response.ok) throw new Error(data.error ?? "Delete failed");
          remove();
        } catch (error) { alert(error instanceof Error ? error.message : "Delete failed"); }
      }
    });
  };
  const requestConfirmation = (request: ConfirmationRequest) => setConfirmation(request);

  const signOut = async () => {
    try {
      const response = await apiFetch(`${BASE_URL}/auth/logout`, { method: "POST" });
      if (!response.ok) throw new Error((await response.json()).error ?? "Sign out could not be confirmed.");
    } catch (error) {
      alert(error instanceof Error ? `${error.message} The local session has been cleared.` : "The local session has been cleared.");
    } finally {
      setUser(null);
      setSales([]); setJobCosts([]); setInventory([]); setInquiries([]); setExpenses([]);
      setAuthReady(true);
    }
  };

  if (!authReady) return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Restoring your secure session…</div>;
  if (!user) return <LoginScreen onLogin={foundUser => { setUser(foundUser); setAuthReady(true); }} />;

  const inTimeline = (date: string) => {
    const [year, month] = date.slice(0, 10).split("-").map(Number);
    return year === selectedYear && month - 1 >= startMonth && month - 1 <= endMonth;
  };
  const visibleSales = sales.filter(s => isCompletedSale(s) && inTimeline(s.date));
  const salesByInvoice = new Map(visibleSales.map(s => [s.invoiceId, s]));
  const visibleJobCosts = jobCosts.filter(j => {
    const sale = salesByInvoice.get(j.invoiceId);
    return Boolean(sale && inTimeline(sale.date));
  });
  const visibleExpenses = expenses.filter(e => inTimeline(e.expDate));
  const visibleInquiries = inquiries.filter(i => inTimeline(i.date));
  const timelineLabel = startMonth === endMonth
    ? `${MONTH_NAMES[startMonth]} ${selectedYear}`
    : `${MONTH_NAMES[startMonth].slice(0, 3)}–${MONTH_NAMES[endMonth].slice(0, 3)} ${selectedYear}`;
  const goldStock = summarizeInventory(inventory, inventory).goldGrams;
  const totalRev = visibleSales.reduce((a, s) => a + s.price, 0);
  const totalCost = visibleJobCosts.reduce((a, j) => a + j.totalCost, 0);
  const totalExp = visibleExpenses.reduce((a, e) => a + e.amount, 0);
  const netProfit = totalRev - totalCost - totalExp;
  const netMargin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
  const today = new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  const TAB_LABELS: Record<Tab, string> = {
    DASHBOARD: "Dashboard", DAILY_SALES: "Daily Sales", JOB_COSTING: "Job Costing",
    INVENTORY: "Inventory", INQUIRIES: "Inquiries", EXPENSES: "Expenses",
    PROFIT_ANALYSIS: "Profit Analysis", APPROVALS: "Approvals", AUDIT_LOGS: "Audit Logs",
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-sidebar border-b border-sidebar-border shadow-lg shadow-black/10 dark:shadow-black/40">
        {/* Brand + KPI + toggle row */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-sidebar-border">
          {/* Branding */}
          <div className="flex items-center gap-3 shrink-0 mr-2">
            <BrandLogo className="w-10 h-10 shadow-sm" />
            <div>
              <div className="text-sm font-bold text-primary leading-tight tracking-wide" style={{ fontFamily: "'Playfair Display', serif" }}>
                NILO&apos;S GOLDSMITH
              </div>
              <div className="text-xs font-mono text-muted-foreground tracking-wide leading-tight">
                Goldsmith Accounting System
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="flex gap-2 flex-1 overflow-x-auto">
            <KPICard label="Today" value={today} />
            <KPICard label={goldInfo?.stale ? "Last Gold Quote / g · 24K" : "Gold Price / g · 24K"} value={goldRate === null ? "Unavailable" : php(goldRate)} sub="Live Gold Price" vc="text-primary" />
            <KPICard label="Gold Stock (Physical)" value={`${goldStock.toFixed(2)} g`} vc="text-primary" />
            {isAdmin && <KPICard
              label={`Net Profit (${timelineLabel})`}
              value={php(netProfit)}
              sub={`${pct(netMargin)} Margin`}
              vc="text-emerald-700 dark:text-emerald-400"
              badge={netProfit >= 0
                ? { text: "HEALTHY", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25" }
                : { text: "REVIEW", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/25" }}
            />}
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-sidebar-border hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-foreground"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button type="button" onClick={signOut} className="shrink-0 rounded-lg border border-sidebar-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors">Sign out</button>
        </div>

        {/* Tab nav*/}
        <nav className="flex items-center overflow-x-auto px-5 gap-0.5 py-2">
          {TABS.filter(t => isAdmin || !["PROFIT_ANALYSIS", "APPROVALS", "AUDIT_LOGS"].includes(t)).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest whitespace-nowrap transition-all ${tab === t
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
        {tab === "DASHBOARD" && <DashboardView sales={visibleSales} jobCosts={visibleJobCosts} expenses={visibleExpenses} inquiries={visibleInquiries} rangeLabel={timelineLabel} isAdmin={isAdmin} onView={(title, record) => setViewRecord({ title, record })} />}
        {tab === "DAILY_SALES" && <DailySalesView sales={sales.filter(isCompletedSale)} onUpdate={s => setSales(p => p.map(item => item.invoiceId === s.invoiceId ? s : s.clientId && item.clientId === s.clientId ? { ...item, email: s.email } : item))} onDelete={id => deleteFromApi("sales", id, () => { const removed = sales.find(item => item.invoiceId === id); const linkedJob = jobCosts.find(item => item.jobCostId === removed?.jobCostId); setSales(p => p.filter(item => item.invoiceId !== id)); if (removed?.jobCostId) setJobCosts(p => p.filter(item => item.jobCostId !== removed.jobCostId)); if (linkedJob?.inquiryId) setInquiries(p => p.map(i => i.inquiryId === linkedJob.inquiryId ? { ...i, status: "Pending" } : i)); })} />}
        {tab === "JOB_COSTING" && <JobCostingView jobCosts={visibleJobCosts} inquiries={inquiries} inventory={inventory} selectedInquiryId={selectedInquiryForCosting} clearSelectedInquiry={() => setSelectedInquiryForCosting(null)} rangeLabel={timelineLabel} onAdd={j => { setJobCosts(p => [j, ...p]); if (j.sale) setSales(p => [j.sale!, ...p.filter(s => s.invoiceId !== j.sale!.invoiceId)]); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Approved" } : i)); }} onUpdate={j => { setJobCosts(p => p.map(item => item.jobCostId === j.jobCostId ? j : item)); if (j.sale) setSales(p => p.map(s => s.invoiceId === j.sale!.invoiceId ? j.sale! : s)); }} onDelete={j => deleteFromApi("job-cost", j.jobCostId, () => { setJobCosts(p => p.filter(item => item.jobCostId !== j.jobCostId)); setSales(p => p.filter(s => s.invoiceId !== j.invoiceId)); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Pending" } : i)); })} onApprove={async j => { try { const response = await apiFetch(`${BASE_URL}/job-cost/${encodeURIComponent(j.jobCostId)}/approve`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Costing could not be approved."); setReloadKey(k => k + 1); } catch (error) { alert(error instanceof Error ? error.message : "Costing could not be approved."); } }} onReady={async j => { try { const response = await apiFetch(`${BASE_URL}/job-cost/${encodeURIComponent(j.jobCostId)}/ready`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Item could not be marked ready."); const reason = data.notification?.sent ? (data.notification.reason ?? "Customer notification sent.") : (data.notification?.reason ?? "Customer notification could not be sent."); alert(`Marked ready for pickup. ${reason}`); setReloadKey(k => k + 1); } catch (error) { alert(error instanceof Error ? error.message : "Item could not be marked ready."); } }} onFinish={async (j, materials) => { try { const response = await apiFetch(`${BASE_URL}/sales/${encodeURIComponent(j.invoiceId)}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: j.invoiceId, clientName: j.clientName, materials }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Sale could not be finished."); const sale = normalizeSale(data); setSales(p => [sale, ...p.filter(item => item.invoiceId !== sale.invoiceId)]); setJobCosts(p => p.map(item => item.jobCostId === j.jobCostId ? { ...item, status: "Finished", sale } : item)); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Finished" } : i)); alert("Sale completed. Confirm receipt sending from Daily Sales when ready."); } catch (error) { alert(error instanceof Error ? error.message : "Sale could not be finished."); } }} />}
        {tab === "INVENTORY" && <GoldInventoryView inventory={inventory} goldRate={goldRate} onAdd={e => { setInventory(p => [...p, e]); setReloadKey(k => k + 1); }} onUpdate={e => { setInventory(p => p.map(item => item.id === e.id ? e : item)); setReloadKey(k => k + 1); }} onDelete={id => deleteFromApi("inventory", id, () => { setInventory(p => p.filter(item => item.id !== id)); setReloadKey(k => k + 1); })} />}
        {tab === "INQUIRIES" && <InquiriesView inquiries={inquiries} onAdd={i => setInquiries(p => [i, ...p])} onUpdate={i => setInquiries(p => p.map(item => item.inquiryId === i.inquiryId ? i : item))} onDelete={id => deleteFromApi("inquiries", id, () => setInquiries(p => p.filter(item => item.inquiryId !== id)))} onStartCosting={id => { setSelectedInquiryForCosting(id); setTab("JOB_COSTING"); }} />}
        {tab === "EXPENSES" && <ExpensesView expenses={visibleExpenses} rangeLabel={timelineLabel} onAdd={e => setExpenses(p => [e, ...p])} onUpdate={e => setExpenses(p => p.map(item => item.expenseId === e.expenseId ? e : item))} onDelete={id => deleteFromApi("expenses", id, () => setExpenses(p => p.filter(item => item.expenseId !== id)))} />}
        {tab === "PROFIT_ANALYSIS" && <ProfitAnalysisView sales={sales.filter(isCompletedSale)} jobCosts={jobCosts} expenses={expenses} selectedYear={selectedYear} setSelectedYear={setSelectedYear} startMonth={startMonth} setStartMonth={setStartMonth} endMonth={endMonth} setEndMonth={setEndMonth} />}
        {tab === "APPROVALS" && isAdmin && <ApprovalQueueView onResolved={() => setReloadKey(k => k + 1)} />}
        {tab === "AUDIT_LOGS" && isAdmin && <AuditLogsView />}
      </main>
      <RecordDetails title={viewRecord?.title ?? "Record details"} record={viewRecord?.record ?? null} onClose={() => setViewRecord(null)} />
      {confirmation && <ConfirmationDialog request={confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}

export default function App() {
  return <ConfirmationContext.Provider value={request => {
    // The provider is kept available to nested action components; AppContent owns the visible dialog.
    void request;
  }}><AppContent /><ToastHost /></ConfirmationContext.Provider>;
}

function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await apiFetch(`${BASE_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in");
      onLogin(data.user);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl">
      <BrandLogo className="mx-auto mb-4 h-14 w-14 border border-border p-1" />
      <h1 className="text-center text-2xl font-semibold text-foreground">Nilo&apos;s Goldsmith</h1>
      <p className="text-center text-sm text-muted-foreground mt-1 mb-7">Goldsmith Accounting System</p>
      <label className="block text-sm text-foreground mb-1">Username</label>
      <input value={userName} onChange={e => setUserName(e.target.value)} className={`${ic} mb-4`} autoComplete="username" />
      <label className="block text-sm text-foreground mb-1">Password</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={`${ic} mb-5`} autoComplete="current-password" />
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </div>;
}
