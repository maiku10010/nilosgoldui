import { JobsTable } from "./components/JobsTable";
import { Button } from "./components/ui/button";
import { Badge, sentenceCase } from "./components/ui/badge";
import { PageHeader } from "./components/PageHeader";
import { roundTwo } from "../rounding";
import { Fragment, useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import goldsmithLogo from "../assets/nilosgold_logo.jpg";
import {
  Search, Plus, X, Crown, TrendingUp, TrendingDown,
  Package, BarChart3, DollarSign, Gem, Sun, Moon, PenSquare, Trash2,
  ArrowUpDown, ChevronUp, ChevronDown, LayoutDashboard, BriefcaseBusiness,
  Receipt, ShieldCheck, ScrollText, PanelLeftClose, PanelLeftOpen, UserRound, LogOut, MessageSquare,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { isValidEmail, isValidPHContact, normalizeContactInput } from "../validation";
import { ContactInput } from "./components/ContactInput";
import { summarizeInventory, groupInventory } from "../inventorySummary";
import { approvalChanges, approvalValue } from "../approvalDiff";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "./components/ui/dropdown-menu";

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
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl mx-4">
      <h2 id="confirmation-title" className="text-base font-semibold">{request.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{request.message}</p>
      <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" type="button" disabled={busy} onClick={onClose} className="text-sm">Cancel</Button><Button variant="primary" type="button" disabled={busy} onClick={confirm} className="text-sm">{busy ? "Working…" : (request.confirmLabel ?? "Confirm")}</Button></div>
    </div>
  </div>;
}

// ── formatters ─────────────────────────────────────────────────────────────
const marginVariant = (margin: number) => margin >= 50 ? "success" : margin >= 25 ? "warning" : "danger";

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
const normalizeInventory = (row: any): InvEntry => ({ id: row.referenceId, date: apiDate(row.updatedAt ?? row.date), referenceId: row.referenceId, itemName: row.itemName ?? row.referenceId, category: row.category ?? "GOLD", goldKarat: row.goldKarat == null ? null : numeric(row.goldKarat), quantityIn: numeric(row.quantityIn ?? row.goldIn), quantityOut: numeric(row.quantityOut ?? row.goldOut), quantityLoss: numeric(row.quantityLoss ?? row.scraps ?? row.scrap), balance: numeric(row.balance ?? row.totalGold), unit: row.unit ?? "grams", unitPrice: numeric(row.unitPrice) });
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
  category: string; goldKarat?: number | null; quantityIn: number; quantityOut: number; quantityLoss: number; balance: number; unit: string; unitPrice: number;
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

function Modal({ title, onClose, onSubmit, children, submitLabel = "Save Entry", isSubmitting = false, submitDisabled = false }: {
  title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode;
  submitLabel?: string; isSubmitting?: boolean; submitDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-2xl shadow-ink/30 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <span className="text-xl font-semibold">{title}</span>
          <Button variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose} >
            <X size={16} />
          </Button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4 overflow-y-auto">
          {children}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}
              className="flex-1 text-sm">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting || submitDisabled}
              className="flex-1 text-sm disabled:cursor-not-allowed">
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-sans text-muted-foreground section-label mb-1">{sentenceCase(label)}</label>
      {children}
    </div>
  );
}

// Input/select base class – light: white bg, dark: near-black bg
const ic = [
  "w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
  "bg-card ",
  "border border-border",
  "text-foreground",
  "placeholder:text-muted-foreground",
  "focus:border-ring",
].join(" ");

function SearchBar({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring w-64 bg-card border border-border text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="primary" type="button" onClick={onClick}
      className="flex items-center gap-2 text-sm">
      <Plus size={13} /> {label}
    </Button>
  );
}

function AddStockChangeButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return <Button variant={compact ? "secondary" : "primary"} size={compact ? "sm" : "default"}
    onClick={event => { event.stopPropagation(); onClick(); }}>
    <Plus size={16} aria-hidden="true" />{compact ? "Add stock" : "Add stock change"}
  </Button>;
}

// Table primitives – both light and dark adaptive
const thc = [
  "px-3 py-2.5 text-left text-xs text-muted-foreground section-label font-medium whitespace-nowrap border-r border-border/50 last:border-r-0",
  "bg-muted/60",
  "border-b border-border",
].join(" ");

const tdc = [
  "px-3 py-2.5 text-xs whitespace-nowrap border-t border-border border-r border-border/50 last:border-r-0",
  "text-foreground/80",
].join(" ");

const tdr = tdc + " text-right tabular-nums";

function TRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={e => { if (onClick && !(e.target as HTMLElement).closest("button")) onClick(); }} onKeyDown={e => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }} tabIndex={onClick ? 0 : undefined} className={`hover:bg-muted/40 dark:hover:bg-muted/25 transition-colors ${onClick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}>
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
    <Button variant="ghost" type="button" onClick={() => onSort(sortKey)} className="h-auto justify-start gap-1.5 px-0 text-xs">
      {sentenceCase(label)}{active ? (sort.direction === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ArrowUpDown size={12} className="opacity-40" />}
    </Button>
  </th>;
}

function BrandLogo({ className = "" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <div className={`rounded-xl bg-primary text-primary-foreground flex items-center justify-center ${className}`}><Crown size={20} /></div>
    : <img src="/nilosgold_logo.jpg" alt="Nilo's Goldsmith" onError={() => setFailed(true)} className={`rounded-xl object-contain bg-card ${className}`} />;
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs font-sans min-w-max">{children}</table>
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
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs font-sans">
      <p className="text-muted-foreground mb-2 section-label text-xs">{tipLabel}</p>
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
  const profitTrend = useMemo(() => {
    const daily = new Map<string, number>();
    const saleDates = new Map(sales.map(sale => [sale.invoiceId, sale.date]));
    const add = (date: string, amount: number) => daily.set(date, (daily.get(date) ?? 0) + amount);
    sales.forEach(sale => add(sale.date, sale.price));
    jobCosts.forEach(job => {
      const date = saleDates.get(job.invoiceId);
      if (date) add(date, -job.totalCost);
    });
    expenses.forEach(expense => add(expense.expDate, -expense.amount));
    let cumulative = 0;
    return [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, profit: cumulative += amount }));
  }, [sales, jobCosts, expenses]);

  const totalInq = inquiries.length;
  const closedInq = inquiries.filter(i => ["Approved", "Finished", "Yes"].includes(i.status)).length;
  const convRate = totalInq > 0 ? (closedInq / totalInq) * 100 : 0;

  const recentSales = sortRecords(useMemo(() => [...sales], [sales]), salesSort).slice(0, 7);
  const recentJC = sortRecords(useMemo(() => [...jobCosts], [jobCosts]), jobSort).slice(0, 6);

  const catColors: Record<string, string> = {
    "Rent": "var(--primary)", "Staff Salary": "var(--chart-2)", "Utilities": "var(--chart-3)", "Supplies": "var(--foreground)", "Tax & Permits": "var(--chart-4)",
  };

  const cardCls = "bg-card border border-border rounded-xl p-5";

  return (
    <div className="space-y-5">
      <section aria-label="Key performance indicators" className="grid w-full grid-cols-12">
        <div className="col-span-12 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {[
            { label: "Total sales", value: php(totalSales), detail: `${sales.length} transactions` },
            { label: "Cash collected", value: php(cashCollected), detail: `${php(receivables)} outstanding` },
            { label: "Expenses", value: php(totalExpenses), detail: `${expenses.length} expenses` },
          ].map(metric => (
            <div key={metric.label} className="min-w-0 rounded-xl border border-border bg-card p-5 xl:p-6">
              <p className="text-xs font-sans section-label text-muted-foreground">{metric.label}</p>
              <p className="mt-5 break-words hero-kpi">{metric.value}</p>
              <p className="mt-3 text-xs text-muted-foreground">{metric.detail}</p>
              <p className="mt-6 text-xs text-muted-foreground">{rangeLabel}</p>
            </div>
          ))}
          {isAdmin ? <div className="relative min-w-0 overflow-hidden rounded-xl border border-border bg-card p-6">
            <p className="text-xs font-sans section-label text-muted-foreground">Net profit</p>
            <p className={`mt-4 break-words hero-kpi ${netProfit >= 0 ? "text-success " : "text-danger "}`}>{php(netProfit)}</p>
            <Badge className="mt-4" variant={netProfit >= 0 ? "success" : "danger"}>{pct(netMargin)} margin</Badge>
            <div className="mt-4 flex items-end gap-4">
              <p className="flex-1 text-xs text-muted-foreground">{rangeLabel}</p>
              <div className="h-12 w-36 shrink-0" role="img" aria-label={`Cumulative net profit trend for ${rangeLabel}`}>
                {profitTrend.length > 1 ? <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitTrend} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
                    <Area type="linear" dataKey="profit" stroke={netProfit >= 0 ? "var(--success)" : "var(--danger)"} fill={netProfit >= 0 ? "var(--success)" : "var(--danger)"} fillOpacity={0.08} strokeWidth={2} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer> : <span className="flex h-full items-center text-xs text-muted-foreground">{profitTrend.length ? "Trend needs more activity" : "No activity yet"}</span>}
              </div>
            </div>
          </div> : <div className="min-w-0 rounded-xl border border-border bg-card p-6">
            <p className="text-xs font-sans section-label text-muted-foreground">Inquiries</p>
            <p className="mt-4 hero-kpi">{totalInq}</p>
            <Badge className="mt-4">{pct(convRate)} conversion</Badge>
            <p className="mt-4 text-xs text-muted-foreground">{closedInq} closed · {rangeLabel}</p>
          </div>}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section>
          <h2 className="mb-3 text-xs font-sans section-label text-muted-foreground">Daily sales log · Recent entries</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentSales.map(s => <Button variant="secondary" key={s.id} type="button" onClick={() => onView("Sale details", s as unknown as Record<string, unknown>)} className="h-auto block whitespace-normal rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{s.clientName}</p><p className="truncate text-xs text-primary-text">{s.invoiceId}</p></div><Badge status={s.status} /></div>
              <div className="mt-3 flex justify-between gap-3"><div><p className="text-xs section-label text-muted-foreground">{s.serviceType} · {fmtDate(s.date)}</p><p className="mt-1 text-sm font-semibold tabular-nums">{php(s.price)}</p></div><span className="self-end text-xs text-muted-foreground">View</span></div>
            </Button>)}
            {!recentSales.length && <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">No sales in this timeline</div>}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-xs font-sans section-label text-muted-foreground">Job costing · Recent entries</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentJC.map(j => <Button variant="secondary" key={j.jobCostId} type="button" onClick={() => onView("Job cost details", j as unknown as Record<string, unknown>)} className="h-auto block whitespace-normal rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{j.clientName}</p><p className="truncate text-xs text-primary-text">{j.invoiceId}</p></div><Badge status={j.status} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span className="text-muted-foreground">Total cost</span><span className="text-right tabular-nums">{php(j.totalCost)}</span>{isAdmin && <><span className="text-muted-foreground">Profit</span><span className="text-right font-semibold tabular-nums text-success">{php(j.profit)}</span></>}</div>
            </Button>)}
            {!recentJC.length && <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">No job costing in this timeline</div>}
          </div>
        </section>
      </div>
      <div className="hidden">
        {/* Legacy table layout retained for existing sort wiring */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-sans text-muted-foreground section-label mb-3">
              Daily Sales Log <span className="text-primary-text/70">— Recent Entries</span>
            </p>
            <TableWrap>
              <thead><tr>
                {[["Date", "date"], ["Invoice #", "invoiceId"], ["Client", "clientName"], ["Type", "serviceType"], ["Total", "price"], ["Status", "status"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={salesSort} onSort={toggleSalesSort} />)}
              </tr></thead>
              <tbody>
                {recentSales.map(s => (
                  <TRow key={s.id} onClick={() => onView("Sale details", s as unknown as Record<string, unknown>)}>
                    <td className={tdc}>{fmtDate(s.date)}</td>
                    <td className={tdc + " text-primary-text/80 "}>{s.invoiceId}</td>
                    <td className={tdc + " font-sans font-medium"}>{s.clientName}</td>
                    <td className={tdc}>{s.serviceType}</td>
                    <td className={tdr}>{php(s.price)}</td>
                    <td className={tdc}><Badge status={s.status} /></td>
                  </TRow>
                ))}
              </tbody>
            </TableWrap>
          </div>
          <div>
            <p className="dashboard-recent-title font-sans text-muted-foreground section-label mb-3">
              Job Costing <span className="text-primary-text/70">— Recent Entries</span>
            </p>
            <TableWrap>
              <thead><tr>
                {[["Invoice #", "invoiceId"], ["Client", "clientName"], ["Gold (g)", "goldUsed"], ["Total Cost", "totalCost"], ["Selling", "sellingPrice"], ["Profit", "profit"], ["Margin", "marginPct"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={jobSort} onSort={toggleJobSort} />)}
              </tr></thead>
              <tbody>
                {recentJC.map(j => (
                  <TRow key={j.jobCostId} onClick={() => onView("Job cost details", j as unknown as Record<string, unknown>)}>
                    <td className={tdc + " text-primary-text/80 "}>{j.invoiceId}</td>
                    <td className={tdc + " font-sans font-medium"}>{j.clientName}</td>
                    <td className={tdr}>{j.goldUsed.toFixed(2)}</td>
                    <td className={tdr + " text-danger "}>{php(j.totalCost)}</td>
                    <td className={tdr + " text-warning "}>{php(j.sellingPrice)}</td>
                    <td className={tdr + " text-success font-semibold"}>{php(j.profit)}</td>
                    <td className={tdc}>
                      <Badge variant={marginVariant(j.marginPct)}>{pct(j.marginPct)}</Badge>
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
    <div className="space-y-4">
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
              <td className={tdc + " text-primary-text/80 "}>{s.invoiceId}</td>
              <td className={tdc + " font-sans font-medium"}>{s.clientName}</td>
              <td className={tdc + " text-muted-foreground"}>{s.contactNum}</td>
              <td className={tdc}>{s.serviceType}</td>
              <td className={tdr}>{php(s.price)}</td>
              <td className={tdr + " text-success "}>{php(s.payment)}</td>
              <td className={tdr + " text-warning "}>{php(s.balance)}</td>
              <td className={tdc}><Badge status={s.status} /></td>
              <td className={tdc}>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="icon" aria-label="Edit" type="button" onClick={() => { setEditingId(s.invoiceId); setForm({ invoiceId: s.invoiceId, date: s.date, clientName: s.clientName, contactNum: s.contactNum, email: s.email ?? "", serviceType: s.serviceType, price: String(s.price), payment: String(s.payment) }); setOpen(true); }} title="Edit">
                    <PenSquare size={13} />
                  </Button>
                  <Button variant="danger" size="icon" aria-label="Delete" type="button" onClick={() => onDelete(s.id)} title="Delete">
                    <Trash2 size={13} />
                  </Button>
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
function JobCostingView({ jobCosts, inquiries, inventory, selectedInquiryId, clearSelectedInquiry, onAdd, onUpdate, onDelete, onApprove, onReady, onFinish }: {
  jobCosts: JobCost[]; inquiries: Inquiry[]; selectedInquiryId: string | null; clearSelectedInquiry: () => void;
  inventory: InvEntry[];
  onAdd: (j: JobCost) => void; onUpdate: (j: JobCost) => void; onDelete: (j: JobCost) => void; onFinish: (j: JobCost, materials: { referenceId: string; quantity: number }[]) => void;
  onApprove: (j: JobCost) => void; onReady: (j: JobCost) => void;
}) {
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
  return (
    <div className="space-y-4">
      <PageHeader title="Jobs" description="Manage job costs and workshop progress." action={<AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Cost a pending inquiry" />} />
      <JobsTable jobs={jobCosts} onEdit={editJob} onDelete={onDelete} onApprove={onApprove} onReady={onReady} onFinish={finishJob} />

      {finishTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">Materials used for {finishTarget.invoiceId}</h2><p className="mt-1 text-xs text-muted-foreground">Select packaging or optional materials and enter the quantities used.</p><select aria-label="Extra inventory material" className={ic + " mt-4"} value={finishMaterialId} onChange={e => setFinishMaterialId(e.target.value)}><option value="">Select an inventory item</option>{inventory.filter(item => item.balance > 0 && item.category !== "GOLD" && item.category !== "TOOLS").map(item => <option key={item.referenceId} value={item.referenceId}>{item.itemName} · {item.category} · {item.balance} {item.unit} available</option>)}</select><div className="mt-3 max-h-64 space-y-2 overflow-auto">{inventory.filter(item => item.balance > 0 && item.category !== "GOLD" && item.category !== "TOOLS" && (!finishMaterialId || item.referenceId === finishMaterialId)).map(item => <label key={item.referenceId} className="grid grid-cols-[1fr_6rem] items-center gap-3 rounded border border-border p-2 text-sm"><span>{item.itemName} <small className="text-muted-foreground">({item.category}, {item.balance} {item.unit} available)</small></span><input aria-label={`Quantity of ${item.itemName}`} type="number" min="0" max={item.balance} step="0.01" className={ic} value={finishQuantities[item.referenceId] ?? ""} onChange={e => setFinishQuantities(v => ({ ...v, [item.referenceId]: e.target.value }))} /></label>)}{!inventory.some(item => item.balance > 0 && item.category !== "GOLD" && item.category !== "TOOLS") && <p className="text-sm text-muted-foreground">No packaging or optional material stock is available.</p>}</div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" className="text-sm" onClick={() => setFinishTarget(null)}>Cancel</Button><Button variant="primary" className="text-sm" onClick={() => { const materials = Object.entries(finishQuantities).filter(([, q]) => Number(q) > 0).map(([referenceId, q]) => ({ referenceId, quantity: Number(q) })); onFinish(finishTarget, materials); setFinishTarget(null) }}>Finish Sale</Button></div></div></div>}
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
  const blank = () => ({ date: todayISO(), referenceId: "", itemName: "", category: "GOLD", goldKarat: "", quantityIn: "", quantityOut: "", quantityLoss: "", unit: "grams", unitPrice: "" });
  const [form, setForm] = useState(blank);
  const filtered = sortRecords(useMemo(() => inventory.filter(e => (categoryFilter === "ALL" || e.category === categoryFilter) && [e.referenceId, e.itemName, e.category, e.goldKarat == null ? "" : `${e.goldKarat}k`].some(v => v.toLowerCase().includes(q.toLowerCase()))), [inventory, q, categoryFilter]), sort);
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
    setForm(f => product ? { ...blank(), date: f.date, itemName: product.itemName, category: product.category, goldKarat: product.goldKarat == null ? "" : String(product.goldKarat), unit: product.unit, unitPrice } : blank());
  };
  const addMovement = (key: string) => { setEditingId(null); selectProduct(key); setOpen(true); };
  const goldBalance = summary.goldGrams;
  const units = INVENTORY_UNITS[form.category] ?? ["pieces"];
  const closeModal = () => { setOpen(false); setEditingId(null); setSelectedProduct(""); setForm(blank()); };
  const edit = (e: InvEntry) => { setSelectedProduct(""); setEditingId(e.id); setForm({ date: e.date, referenceId: e.referenceId, itemName: e.itemName, category: e.category, goldKarat: e.goldKarat == null ? "" : String(e.goldKarat), quantityIn: String(e.quantityIn), quantityOut: String(e.quantityOut), quantityLoss: String(e.quantityLoss), unit: e.unit, unitPrice: String(e.unitPrice) }); setOpen(true); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (submittingRef.current) return;
    submittingRef.current = true; setIsSubmitting(true);
    const entry: InvEntry = { id: editingId ?? "", date: form.date, referenceId: form.referenceId, itemName: form.itemName, category: form.category, goldKarat: form.category === "GOLD" && form.goldKarat ? Number(form.goldKarat) : null, quantityIn: Number(form.quantityIn) || 0, quantityOut: Number(form.quantityOut) || 0, quantityLoss: Number(form.quantityLoss) || 0, balance: 0, unit: form.unit, unitPrice: Number(form.unitPrice) || 0 };
    if (entry.category === "GOLD" && !entry.goldKarat) { alert("Choose a gold karat from 10K to 24K."); setIsSubmitting(false); submittingRef.current = false; return; }
    if (!Number.isFinite(entry.unitPrice) || entry.unitPrice <= 0) { alert("Unit price must be greater than zero."); setIsSubmitting(false); submittingRef.current = false; return; }
    if (entry.quantityIn + entry.quantityOut + entry.quantityLoss <= 0) { alert("Enter a positive quantity for at least one movement."); setIsSubmitting(false); submittingRef.current = false; return; }
    try {
      const response = await apiFetch(`${BASE_URL}/inventory${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: entry.date, itemName: entry.itemName, category: entry.category, goldKarat: entry.goldKarat, quantityIn: entry.quantityIn, quantityOut: entry.quantityOut, quantityLoss: entry.quantityLoss, unit: entry.unit, unitPrice: entry.unitPrice }) });
      const saved = await response.json();
      if (response.status === 202) { alert(saved.message); closeModal(); setIsSubmitting(false); submittingRef.current = false; return; }
      if (!response.ok) throw new Error(saved.error ?? "Inventory entry could not be saved.");
      const result = normalizeInventory(saved); if (editingId) onUpdate(result); else onAdd(result);
    } catch (error) { alert(error instanceof Error ? error.message : "Inventory entry could not be saved."); setIsSubmitting(false); submittingRef.current = false; return; }
    closeModal(); setIsSubmitting(false); submittingRef.current = false;
  };
  return <div className="space-y-4">
    <PageHeader title="Inventory" description="Track stock, materials, and movement across your workshop." action={<AddStockChangeButton onClick={() => { setForm(blank()); setSelectedProduct(""); setEditingId(null); setOpen(true); }} />} />
    <div className="grid items-center gap-4 xl:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)]">
      <div className="space-y-2"><SearchBar value={q} onChange={setQ} placeholder="Search reference, item…" />
        <select className={ic + " w-auto"} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Filter inventory category"><option value="ALL">All categories</option>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <section aria-label="Item summary" className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground"><h3>Item summary</h3><Package size={17} className="text-primary-text" /></div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{summary.entries.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Ledger entries matching your filters</p>
        </section>
        <section aria-label="Product summary" className="rounded-xl border border-success/20 bg-success-tint p-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground"><h3>Product summary</h3><Gem size={17} className="text-success" /></div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{summary.inStock.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">in stock / {summary.products}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.quantities.length ? summary.quantities.map(([unit, quantity]) => `${quantity.toLocaleString("en-PH", { maximumFractionDigits: 3 })} ${unit}`).join(" · ") : "No stock remaining"}</p>
        </section>
      </div>
    </div>
    <div className="flex flex-wrap justify-between gap-2 rounded-lg border border-border px-4 py-3 text-xs"><span className="text-muted-foreground">Gold stock <b className="ml-2 text-foreground">{goldBalance.toLocaleString("en-PH", { maximumFractionDigits: 3 })} g</b></span><span className="text-muted-foreground">24K reference value <b className="ml-2 text-primary-text">{goldRate === null ? "Rate unavailable" : php(goldBalance * goldRate)}</b></span></div>
  <TableWrap><thead><tr>{[["Date", "date"], ["Category", "category"], ["Reference", "referenceId"], ["Item Description", "itemName"], ["In", "quantityIn"], ["Unit Price", "unitPrice"], ["Out", "quantityOut"], ["Loss / Scrap", "quantityLoss"], ["Balance", "balance"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} />)}<th className={thc}>Actions</th></tr></thead>
      <tbody>{visibleProducts.map(product => <Fragment key={product.key}>
        <tr className="border-b border-border bg-muted/30">
          <td className={tdc} colSpan={4}><Button variant="ghost" type="button" className="flex items-center gap-2 text-left" aria-expanded={expanded.has(product.key)} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(product.key)) next.delete(product.key); else next.add(product.key); return next; })}>
            {expanded.has(product.key) ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}{product.itemName}<span className="font-normal text-muted-foreground">{product.category} · {product.movements.length} movements</span>
          </Button></td>
          <td className={tdr}>{product.quantityIn.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td><td className={tdr}>—</td>
          <td className={tdr}>{product.quantityOut.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td><td className={tdr}>{product.quantityLoss.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td>
          <td className={tdr+" text-primary-text font-semibold"}>{product.balance.toLocaleString("en-PH", { maximumFractionDigits:3 })} {product.unit}</td>
          <td className={tdc}><AddStockChangeButton compact onClick={() => addMovement(product.key)} /></td>
        </tr>
        {expanded.has(product.key) && product.movements.map(e => <TRow key={e.id} onClick={()=>edit(e)}><td className={tdc}>{fmtDate(e.date)}</td><td className={tdc}><Badge>{sentenceCase(e.category)}{e.category === "GOLD" && e.goldKarat != null ? ` · ${e.goldKarat}K` : ""}</Badge></td><td className={tdc+" text-primary-text/80"}>{e.referenceId}</td><td className={tdc+" pl-8 font-sans"}>↳ {e.itemName}</td><td className={tdr}>{e.quantityIn ? `+${e.quantityIn}` : "—"}</td><td className={tdr}>{e.unitPrice ? php(e.unitPrice) : "—"}</td><td className={tdr}>{e.quantityOut ? `-${e.quantityOut}` : "—"}</td><td className={tdr}>{e.quantityLoss || "—"}</td><td className={tdr+" text-primary-text font-semibold"}>{e.balance} {e.unit}</td><td className={tdc}><div className="flex items-center gap-2"><Button variant="secondary" size="icon" aria-label="Edit" type="button" onClick={event=>{event.stopPropagation();edit(e);}} title="Edit"><PenSquare size={13}/></Button><Button variant="danger" size="icon" aria-label="Delete" type="button" onClick={event=>{event.stopPropagation();onDelete(e.id);}} title="Delete"><Trash2 size={13}/></Button></div></td></TRow>)}
      </Fragment>)}{!visibleProducts.length && <EmptyRow cols={10}/>}</tbody>
  </TableWrap>
  {
    open && <Modal title={editingId ? "Edit Inventory Entry" : "Add Stock Change"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update Entry" : "Save Entry"} isSubmitting={isSubmitting}>
      {!editingId && <FF label="Product"><select className={ic+" mb-4"} aria-label="Inventory product" value={selectedProduct} onChange={e => selectProduct(e.target.value)}><option value="">Create a new product</option>{products.map(product => <option key={product.key} value={product.key}>{product.itemName} · {product.category} · {product.unit}</option>)}</select></FF>}
      <div className="grid grid-cols-2 gap-4"><FF label="Date"><input type="date" max={todayISO()} className={ic} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></FF><FF label="Reference"><input className={ic} value={form.referenceId} readOnly placeholder="Assigned when saved" /></FF>
        <FF label="Category"><select disabled={!!selectedProduct} className={ic} value={form.category} onChange={e => { const category = e.target.value; setForm(f => ({ ...f, category, goldKarat: category === "GOLD" ? f.goldKarat : "", unit: INVENTORY_UNITS[category][0] })); }}>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select></FF>{form.category === "GOLD" && <FF label="Karat"><select disabled={!!selectedProduct} className={ic} value={form.goldKarat} onChange={e => setForm(f => ({ ...f, goldKarat: e.target.value }))} required><option value="">Select karat</option>{Array.from({ length: 15 }, (_, i) => i + 10).map(karat => <option key={karat} value={karat}>{karat}K</option>)}</select></FF>}<FF label="Unit"><select disabled={!!selectedProduct} className={ic} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>{units.map(u => <option key={u}>{u}</option>)}</select></FF>
        <div className="col-span-2"><FF label="Item Description"><input readOnly={!!selectedProduct} className={ic} value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="e.g. 18k chain, gemstone, ring box" required /></FF></div>
        <FF label={`Quantity In (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityIn} onChange={e => setForm(f => ({ ...f, quantityIn: e.target.value }))} /></FF><FF label={`Unit Price (₱ / ${form.unit})`}><input type="number" required min="0.01" step="0.01" className={ic} value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} /></FF><FF label={`Quantity Out (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityOut} onChange={e => setForm(f => ({ ...f, quantityOut: e.target.value }))} /></FF><FF label={`Loss / Scrap (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityLoss} onChange={e => setForm(f => ({ ...f, quantityLoss: e.target.value }))} /></FF>
          </div><p className="text-xs text-muted-foreground">Stock balance is calculated for each category, item, and unit.</p>
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
        <div className="space-y-4">
          <PageHeader title="Inquiries" description="Manage customer requests and prepare new jobs." action={<AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add inquiry" />} />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SearchBar value={q} onChange={setQ} placeholder="Search client, service type…" />

          </div>
          <TableWrap>
            <thead><tr>
    { [["Date", "date"], ["Inquiry ID", "inquiryId"], ["Client Name", "customerName"], ["Contact", "contactInfo"], ["Email", "email"], ["Category", "category"], ["Details", "details"], ["Quoted Price", "quotedPrice"], ["Fully Paid", "isFullyPaid"], ["Status", "status"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} />)}<th className={thc}>Actions</th>
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
            <td className={tdr + " text-warning "}>{php(i.quotedPrice)}</td>
            <td className={tdc}><Badge status={i.isFullyPaid ? "Paid" : "Pending"} /></td><td className={tdc}><Badge status={i.status} /></td>
            <td className={tdc}>
              <div className="flex items-center gap-2">
                {i.status === "Pending" && <Button variant="ghost" type="button" onClick={() => onStartCosting(i.inquiryId)} className="text-xs">Start Costing</Button>}
                {i.status === "Pending" && <Button variant="secondary" size="icon" aria-label="Edit" type="button" onClick={e => { e.stopPropagation(); setEditingId(i.inquiryId); setForm({ customerName: i.customerName, contactInfo: i.contactInfo, email: i.email, details: i.details, category: i.category, quotedPrice: String(i.quotedPrice), isFullyPaid: i.isFullyPaid, status: i.status }); setOpen(true); }} title="Edit">
                  <PenSquare size={13} />
                </Button>}
                {i.status === "Pending" && <Button variant="danger" size="icon" aria-label="Delete" type="button" onClick={() => onDelete(i.inquiryId)} title="Delete">
                  <Trash2 size={13} />
                </Button>}
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
    <div className="space-y-4">
      <PageHeader title="Expenses" description="Track operating costs and workshop spending." action={<AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add expense" />} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <SearchBar value={q} onChange={setQ} placeholder="Search category, description…" />
          <div className="flex items-center gap-2 bg-danger-tint border border-danger/20 rounded-lg px-3 py-2">
            <TrendingDown size={13} className="text-danger " />
            <span className="text-xs font-sans text-muted-foreground section-label">Total:</span>
            <span className="text-sm font-bold text-danger tabular-nums">{php(total)}</span>
          </div>
        </div>

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
                <Badge>{e.category}</Badge>
              </td>
              <td className={tdc + " font-sans text-muted-foreground max-w-[300px]"}>{e.description}</td>
              <td className={tdr + " text-danger font-semibold"}>{php(e.amount)}</td>
              <td className={tdc}>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="icon" aria-label="Edit" type="button" onClick={() => { setEditingId(e.expenseId); setForm({ expDate: e.expDate, category: e.category, description: e.description, amount: String(e.amount) }); setOpen(true); }} title="Edit">
                    <PenSquare size={13} />
                  </Button>
                  <Button variant="danger" size="icon" aria-label="Delete" type="button" onClick={() => onDelete(e.expenseId)} title="Delete">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </td>
            </TRow>
          ))}
          {!filtered.length && <EmptyRow cols={6} />}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 ">
            <td colSpan={4} className="px-3 py-3 text-xs font-sans text-muted-foreground section-label text-right">Total</td>
            <td className="px-3 py-3 text-right font-bold text-danger tabular-nums text-sm">{php(total)}</td>
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
const PIE_COLORS = ["var(--primary)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--foreground)"];

function RecordDetails({ title, record, onClose }: { title: string; record: Record<string, unknown> | null; onClose: () => void }) {
  if (!record) return null;
  const entries = Object.entries(record).filter(([key]) => key !== "id");
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()} className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button variant="secondary" size="icon" type="button" onClick={onClose} aria-label="Close details" ><X size={18} /></Button>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entries.map(([key, value]) => <div key={key} className="rounded-lg bg-muted/50 p-3">
          <dt className="mb-1 text-xs font-medium section-label text-muted-foreground">{sentenceCase(key.replace(/([A-Z])/g, " $1"))}</dt>
          <dd className="break-words text-sm font-medium">{/status|role|action/i.test(key) ? <Badge status={String(value ?? "Unknown")} /> : typeof value === "number" && /price|cost|profit|amount|balance|payment/i.test(key) ? php(value) : String(value ?? "—")}</dd>
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
  const chartData = Array.from({ length: endMonth - startMonth + 1 }, (_, offset) => {
    const monthIndex = startMonth + offset;
    const revenue = selectedSales.filter(s => Number(s.date.slice(5, 7)) - 1 === monthIndex).reduce((sum, s) => sum + s.price, 0);
    const cost = selectedJobCosts.filter(j => Number(salesByInvoice.get(j.invoiceId)?.date.slice(5, 7)) - 1 === monthIndex).reduce((sum, j) => sum + j.totalCost, 0);
    return { month: MONTH_NAMES[monthIndex].slice(0, 3), revenue, cost };
  });
  const comparisonTotals = [
    { label: "Revenue", value: totalRevenue, color: "var(--primary)" },
    { label: "Cost", value: totalCost, color: "var(--chart-2)" },
    { label: "Expenses", value: totalExp, color: "var(--chart-4)" },
  ];
  const comparisonMax = Math.max(1, ...comparisonTotals.map(item => Math.abs(item.value)));
  const rangeLabel = startMonth === endMonth
    ? `${MONTH_NAMES[startMonth]} ${selectedYear}`
    : `${MONTH_NAMES[startMonth].slice(0, 3)}–${MONTH_NAMES[endMonth].slice(0, 3)} ${selectedYear}`;

  const rankedCategories = Object.entries(selectedExpenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
    return totals;
  }, {} as Record<string, number>))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const topCategories = rankedCategories.slice(0, 5).map((category, index) => ({ ...category, color: PIE_COLORS[index] }));
  const remainingCategories = rankedCategories.slice(5);
  const otherTotal = remainingCategories.reduce((sum, category) => sum + category.value, 0);
  const expenseDonut = [
    ...topCategories,
    ...(remainingCategories.length ? [{ name: "Other", value: otherTotal, color: "var(--chart-5)" }] : []),
  ];
  const expenseShare = (value: number) => totalExp > 0 ? value / totalExp * 100 : 0;

  const byService = (["Custom", "Repair", "Resize", "Cleaning"] as ServiceType[]).map(type => {
    const jcs = selectedJobCosts.filter(j => salesByInvoice.get(j.invoiceId)?.serviceType === type);
    const margin = jcs.length ? jcs.reduce((a, j) => a + j.marginPct, 0) / jcs.length : 0;
    return { type, margin: parseFloat(margin.toFixed(1)), count: jcs.length };
  });

  const cardCls = "bg-card border border-border rounded-xl p-5";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: `Gross profit (${rangeLabel})`, val: php(grossProfit), sub: "Revenue minus job costs", cls: "text-success " },
          { label: `Total expenses (${rangeLabel})`, val: php(totalExp), sub: "Operating overhead", cls: "text-danger " },
          { label: `Net profit (${rangeLabel})`, val: php(netProfit), sub: `${pct(netMargin)} net margin`, cls: netProfit >= 0 ? "text-success " : "text-danger " },
        ].map(k => (
          <div key={k.label} className={cardCls}>
            <div className="text-xs font-sans text-muted-foreground section-label mb-2">{k.label}</div>
            <div className={`hero-kpi ${k.cls}`}>{k.val}</div>
            <div className="text-xs text-muted-foreground mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section aria-label="Monthly revenue and cost" className={cardCls + " col-span-12 min-w-0 xl:col-span-7"}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-sm font-medium">Monthly Revenue vs. Cost</h2><p className="mt-1 text-xs text-muted-foreground">{rangeLabel}</p></div>
            <div className="flex flex-wrap gap-2">
              <label className="text-xs text-muted-foreground">From
                <select aria-label="Start month" className={`${ic} ml-2 w-auto py-1.5`} value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
                  {MONTH_NAMES.map((month, i) => <option key={month} value={i} disabled={i > endMonth}>{month}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">To
                <select aria-label="End month" className={`${ic} ml-2 w-auto py-1.5`} value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>
                  {MONTH_NAMES.map((month, i) => <option key={month} value={i} disabled={i < startMonth || (selectedYear === currentYear && i > new Date().getMonth())}>{month}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">Year
                <select aria-label="Year" className={`${ic} ml-2 w-auto py-1.5`} value={selectedYear} onChange={e => { const year = Number(e.target.value); setSelectedYear(year); if (year === currentYear) { const maxMonth = new Date().getMonth(); setStartMonth(m => Math.min(m, maxMonth)); setEndMonth(m => Math.min(m, maxMonth)); } }}>
                  {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="mb-5 flex items-center gap-5 text-xs text-muted-foreground" aria-label="Chart legend">
            {comparisonTotals.slice(0, 2).map(item => <span key={item.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.label}</span>)}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart accessibilityLayer data={chartData} barGap={4} barCategoryGap="25%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickMargin={12} />
              <YAxis width={64} tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={v => "₱" + new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v)} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="cost" name="Cost" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section aria-labelledby="period-comparison-title" className={cardCls + " col-span-12 min-w-0 xl:col-span-5"}>
          <h2 id="period-comparison-title" className="text-sm font-medium">Period totals</h2>
          <p className="mt-1 text-xs text-muted-foreground">{rangeLabel}</p>
          <div className="mt-8 space-y-7">
            {comparisonTotals.map(item => <div key={item.label}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-sans section-label text-muted-foreground">{item.label}</span>
                <span className="break-words font-sans text-2xl font-medium tabular-nums">{php(item.value)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${Math.abs(item.value) / comparisonMax * 100}%`, backgroundColor: item.color }} />
              </div>
            </div>)}
          </div>
          <p className="mt-7 text-xs text-muted-foreground">Shared scale across all three totals.</p>
        </section>
      </div>

      <section aria-labelledby="expense-breakdown-title" className={cardCls}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="expense-breakdown-title" className="text-sm font-medium">Expense breakdown</h2>
            <p className="mt-1 text-xs text-muted-foreground">Top five categories · {rangeLabel}</p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" type="button" className="text-xs">See all<span className="sr-only"> expense categories</span></Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <SheetHeader className="border-b border-border p-6 pr-12">
                <SheetTitle>All expense categories</SheetTitle>
                <SheetDescription>{rangeLabel} · {php(totalExp)} total expenses. Ranked by amount; shares use the full period total.</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 overflow-y-auto px-6 pb-6">
                {rankedCategories.length ? <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-xs section-label text-muted-foreground"><th scope="col" className="py-3 text-left font-medium">Category</th><th scope="col" className="py-3 text-right font-medium">Amount</th><th scope="col" className="py-3 pl-3 text-right font-medium">Share</th></tr></thead>
                  <tbody>{rankedCategories.map((category, index) => <tr key={category.name} className="border-b border-border">
                    <th scope="row" className="py-4 pr-3 text-left font-normal"><span className="mr-2 text-xs text-muted-foreground">{index + 1}.</span>{category.name}</th>
                    <td className="py-4 text-right tabular-nums">{php(category.value)}</td>
                    <td className="py-4 pl-3 text-right tabular-nums text-muted-foreground">{expenseShare(category.value).toFixed(1)}%</td>
                  </tr>)}</tbody>
                </table> : <p className="py-8 text-sm text-muted-foreground">No expenses in this period.</p>}
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {totalExp > 0 ? <div className="mt-6 grid grid-cols-12 items-center gap-8">
          <div className="relative col-span-12 mx-auto h-[260px] w-[260px] max-w-full lg:col-span-5" role="img" aria-label={`Expense share by category: ${expenseDonut.map(category => `${category.name} ${expenseShare(category.value).toFixed(1)}%`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseDonut} cx="50%" cy="50%" innerRadius={83} outerRadius={115} paddingAngle={2} dataKey="value" nameKey="name" stroke="var(--card)" strokeWidth={2}>
                  {expenseDonut.map((category, index) => <Cell key={`${index}-${category.name}`} fill={category.color} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-14 text-center">
              <span className="text-xs section-label text-muted-foreground">Total expenses</span>
              <span className="mt-2 max-w-full break-words font-sans text-xl font-medium leading-tight tabular-nums">{php(totalExp)}</span>
            </div>
          </div>
          <div className="col-span-12 min-w-0 lg:col-span-7">
            <ol className="space-y-5">
              {topCategories.map((category, index) => <li key={category.name}>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="w-4 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1 font-medium">{category.name}</span>
                  <span className="font-sans text-lg tabular-nums">{php(category.value)}</span>
                  <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{expenseShare(category.value).toFixed(1)}%</span>
                </div>
                <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${expenseShare(category.value)}%`, backgroundColor: category.color }} /></div>
              </li>)}
            </ol>
            {remainingCategories.length > 0 && <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="h-2 w-4 shrink-0 rounded-sm bg-muted" aria-hidden="true" />
                <span className="flex-1">Other <span className="text-xs text-muted-foreground">({remainingCategories.length} categories)</span></span>
                <span className="font-sans text-lg tabular-nums">{php(otherTotal)}</span>
                <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{expenseShare(otherTotal).toFixed(1)}%</span>
              </div>
              <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-muted" style={{ width: `${expenseShare(otherTotal)}%` }} /></div>
            </div>}
          </div>
        </div> : <p className="py-12 text-center text-sm text-muted-foreground">No expense amounts to display for this period.</p>}
      </section>

      <div className={cardCls}>
        <p className="text-xs font-sans text-muted-foreground section-label mb-4">Average margin % by service type</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byService} margin={{ top: 4, right: 4, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="type" tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={v => v + "%"} />
            <Tooltip
              formatter={(v: any) => [v + "%", "Avg Margin"]}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontFamily: "Inter", fontSize: "12px", color: "var(--foreground)" }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Bar dataKey="margin" name="Margin %" radius={[4, 4, 0, 0]}>
              {byService.map((_, i) => <Cell key={i} fill={["var(--primary)", "var(--chart-2)", "var(--chart-3)", "var(--foreground)"][i]} />)}
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
    <div className="flex flex-col min-w-[148px] bg-sidebar-accent/60 border border-sidebar-border rounded-lg px-4 py-2.5 shrink-0">
      <span className="text-xs font-sans text-muted-foreground section-label mb-1">{label}</span>
      <span className={`text-sm font-semibold tabular-nums leading-tight text-foreground ${vc}`}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground mt-0.5 tabular-nums">{sub}</span>}
      {badge && (
        <Badge className="mt-1.5" status={badge.text} />
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
  return <div className="space-y-4">
    <PageHeader title="Approvals" description="Staff edits and archive requests leave records unchanged until approved." action={<Button onClick={load}>Refresh</Button>} />
    {error && <p className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{error}</p>}
    {!pending.length && !error && <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No pending requests.</div>}
    {pending.map(row => {
      const requestedAt = new Date(row.createdAt);
      const requester = row.requester?.empName ?? row.requester?.empRole ?? "Staff";
      const changes = approvalChanges(row.beforeData, row.proposedData);
      return <article key={row.requestId} className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><h3 className="font-semibold"><Badge status={row.action} /> · {sentenceCase(String(row.entityType))}</h3><Badge status="Pending" /></div><p className="mt-1 text-xs text-muted-foreground">{row.entityId} · requested by {requester} · {requestedAt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" })} · {requestedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</p></div>
          <div className="flex gap-2"><Button variant="danger" type="button" onClick={() => resolve(row, "reject")} className="text-sm">Reject</Button><Button variant="primary" type="button" onClick={() => resolve(row, "approve")} className="text-sm">Approve</Button></div>
        </div>
        {row.action === "UPDATE" && <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4"><p className="mb-3 text-xs font-semibold section-label text-muted-foreground">Requested changes</p>{changes.length ? <dl className="space-y-3">{changes.map(change => <div key={change.key} className="grid gap-1 text-sm sm:grid-cols-[minmax(9rem,0.35fr)_1fr]"><dt className="font-medium text-foreground">{change.label}</dt><dd className="flex min-w-0 flex-wrap items-center gap-2"><span className="break-words text-muted-foreground line-through decoration-danger/70">{approvalValue(change.initialValue)}</span><span aria-hidden="true" className="text-muted-foreground">→</span><span className="break-words font-medium text-foreground">{approvalValue(change.editedValue)}</span></dd></div>)}</dl> : <p className="text-sm text-muted-foreground">No value changes were detected.</p>}</div>}
      </article>
    })}
    {rows.some(row => row.status !== "PENDING") && <details className="rounded-xl border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">Recently reviewed requests</summary><div className="mt-3 space-y-2">{rows.filter(row => row.status !== "PENDING").slice(0, 15).map(row => <div key={row.requestId} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2 text-sm"><span><Badge status={row.action} /> {sentenceCase(String(row.entityType))} · {row.entityId}</span><Badge status={statusLabel(row.status)} /></div>)}</div></details>}
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
  return <div className="space-y-4">
    <PageHeader title="Audit logs" description="Recent sign-ins, changes, archive requests, and Admin decisions." action={<Button onClick={load}>Refresh</Button>} />
    {error && <p className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{error}</p>}
    <TableWrap><thead><tr>{["When", "User", "Role", "Action", "Record"].map(label => <th key={label} className={thc}>{label}</th>)}</tr></thead><tbody>
      {rows.map(row => <tr key={row.logId} className="border-b border-border align-top"><td className={tdc}>{new Date(row.createdAt).toLocaleString("en-PH")}</td><td className={tdc}>{row.actorName}</td><td className={tdc}><Badge status={row.actorRole} /></td><td className={tdc}><Badge status={row.action} /></td><td className={tdc}>{row.entityType ? row.entityType + " · " + (row.entityId ?? "—") : "—"}</td></tr>)}
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    DASHBOARD: "Dashboard", DAILY_SALES: "Sales", JOB_COSTING: "Jobs",
    INVENTORY: "Inventory", INQUIRIES: "Inquiries", EXPENSES: "Expenses",
    PROFIT_ANALYSIS: "Reports", APPROVALS: "Approvals", AUDIT_LOGS: "Audit Logs",
  };

  const NAV_ICONS = {
    DASHBOARD: LayoutDashboard, DAILY_SALES: DollarSign, JOB_COSTING: BriefcaseBusiness,
    EXPENSES: Receipt, PROFIT_ANALYSIS: BarChart3, INVENTORY: Package,
    INQUIRIES: MessageSquare, APPROVALS: ShieldCheck, AUDIT_LOGS: ScrollText,
  };
  const renderNavItem = (destination: Tab) => {
    const Icon = NAV_ICONS[destination];
    return <Button variant="ghost" key={destination} type="button" onClick={() => setTab(destination)} aria-current={tab === destination ? "page" : undefined} aria-label={TAB_LABELS[destination]} title={sidebarCollapsed ? TAB_LABELS[destination] : undefined}
      className="sidebar-nav-item">
      <Icon size={18} className="shrink-0" aria-hidden="true" />
      {!sidebarCollapsed && <span>{TAB_LABELS[destination]}</span>}
    </Button>;
  };

  return (
    <div className="dashboard-shell bg-background text-foreground" data-collapsed={sidebarCollapsed}>
      <div className="dashboard-workspace">
      <header className="dashboard-topbar">
        <div className="flex h-full items-center gap-6 px-8">
          <span className="text-xs text-muted-foreground">{today}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" type="button" aria-label="Open user menu" className="ml-auto flex shrink-0 items-center gap-3 text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary-text"><UserRound size={17} aria-hidden="true" /></span>
                <span className="hidden max-w-40 truncate text-left sm:block">{user?.empName || user?.userName || "Account"}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="break-words">{user?.empName || user?.userName || "Account"}<span className="mt-1 block"><Badge status={user?.empRole ?? "Account"} /></span></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDark(d => !d)}>{dark ? <Sun size={16} /> : <Moon size={16} />}{dark ? "Light appearance" : "Dark appearance"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void signOut(); }}><LogOut size={16} />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>


        <aside className="dashboard-sidebar">
          <div className="flex h-12 shrink-0 items-center gap-2 px-1">
            <BrandLogo className="h-10 w-10 shrink-0" />
            {!sidebarCollapsed && <span className="font-serif text-base font-semibold">Nilo&apos;s Goldsmith</span>}
          </div>
          <Button variant="ghost" type="button" onClick={() => setSidebarCollapsed(value => !value)} aria-expanded={!sidebarCollapsed} aria-controls="primary-navigation" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="sidebar-toggle">
            {sidebarCollapsed ? <PanelLeftOpen size={18} className="shrink-0" /> : <><PanelLeftClose size={18} className="shrink-0" /><span className="text-xs">Collapse sidebar</span></>}
          </Button>
          <nav id="primary-navigation" aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="space-y-1">
              {(["DASHBOARD", "DAILY_SALES", "JOB_COSTING", "EXPENSES", "PROFIT_ANALYSIS"] as Tab[]).filter(t => isAdmin || t !== "PROFIT_ANALYSIS").map(t => renderNavItem(t))}
            </div>
            <div className="mt-6 space-y-1 border-t border-sidebar-border pt-4" role="group" aria-label="Job resources">
              {!sidebarCollapsed && <p className="px-3 pb-2 text-xs section-label text-muted-foreground">Job resources</p>}
              {renderNavItem("INVENTORY")}
              {renderNavItem("INQUIRIES")}
            </div>
            {isAdmin && <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4" role="group" aria-label="Admin">
              {!sidebarCollapsed && <p className="section-label px-3 pb-2">Admin</p>}
              {renderNavItem("APPROVALS")}
              {renderNavItem("AUDIT_LOGS")}
            </div>}
          </nav>
        </aside>

        <main className="dashboard-main" key={tab}>
          <div className="dashboard-content">
          {tab === "DASHBOARD" && <PageHeader title="Dashboard" description="An overview of sales, workshop activity, and profit." action={<Button onClick={() => setTab("INQUIRIES")}>View inquiries</Button>} />}
          {tab === "DAILY_SALES" && <PageHeader title="Sales" description="Review completed sales, payments, and outstanding balances." action={<Button onClick={() => setTab("JOB_COSTING")}>View jobs</Button>} />}
          {tab === "PROFIT_ANALYSIS" && <PageHeader title="Reports" description="Understand revenue, costs, and profitability over time." action={<Button onClick={() => setReloadKey(k => k + 1)}>Refresh report</Button>} />}
          {tab === "DASHBOARD" && <div className="mb-5 flex flex-wrap gap-3">
            <KPICard label={goldInfo?.stale ? "Last gold quote / g · 24K" : "Gold price / g · 24K"} value={goldRate === null ? "Unavailable" : php(goldRate)} sub="Live gold price" vc="text-primary-text" />
            <KPICard label="Gold stock (physical)" value={`${goldStock.toFixed(2)} g`} vc="text-primary-text" />

          </div>}
        {tab === "DASHBOARD" && <DashboardView sales={visibleSales} jobCosts={visibleJobCosts} expenses={visibleExpenses} inquiries={visibleInquiries} rangeLabel={timelineLabel} isAdmin={isAdmin} onView={(title, record) => setViewRecord({ title, record })} />}
        {tab === "DAILY_SALES" && <DailySalesView sales={sales.filter(isCompletedSale)} onUpdate={s => setSales(p => p.map(item => item.invoiceId === s.invoiceId ? s : s.clientId && item.clientId === s.clientId ? { ...item, email: s.email } : item))} onDelete={id => deleteFromApi("sales", id, () => { const removed = sales.find(item => item.invoiceId === id); const linkedJob = jobCosts.find(item => item.jobCostId === removed?.jobCostId); setSales(p => p.filter(item => item.invoiceId !== id)); if (removed?.jobCostId) setJobCosts(p => p.filter(item => item.jobCostId !== removed.jobCostId)); if (linkedJob?.inquiryId) setInquiries(p => p.map(i => i.inquiryId === linkedJob.inquiryId ? { ...i, status: "Pending" } : i)); })} />}
        {tab === "JOB_COSTING" && <JobCostingView jobCosts={jobCosts} inquiries={inquiries} inventory={inventory} selectedInquiryId={selectedInquiryForCosting} clearSelectedInquiry={() => setSelectedInquiryForCosting(null)} onAdd={j => { setJobCosts(p => [j, ...p]); if (j.sale) setSales(p => [j.sale!, ...p.filter(s => s.invoiceId !== j.sale!.invoiceId)]); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Approved" } : i)); }} onUpdate={j => { setJobCosts(p => p.map(item => item.jobCostId === j.jobCostId ? j : item)); if (j.sale) setSales(p => p.map(s => s.invoiceId === j.sale!.invoiceId ? j.sale! : s)); }} onDelete={j => deleteFromApi("job-cost", j.jobCostId, () => { setJobCosts(p => p.filter(item => item.jobCostId !== j.jobCostId)); setSales(p => p.filter(s => s.invoiceId !== j.invoiceId)); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Pending" } : i)); })} onApprove={async j => { try { const response = await apiFetch(`${BASE_URL}/job-cost/${encodeURIComponent(j.jobCostId)}/approve`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Costing could not be approved."); setReloadKey(k => k + 1); } catch (error) { alert(error instanceof Error ? error.message : "Costing could not be approved."); } }} onReady={async j => { try { const response = await apiFetch(`${BASE_URL}/job-cost/${encodeURIComponent(j.jobCostId)}/ready`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Item could not be marked ready."); const reason = data.notification?.sent ? (data.notification.reason ?? "Customer notification sent.") : (data.notification?.reason ?? "Customer notification could not be sent."); alert(`Marked ready for pickup. ${reason}`); setReloadKey(k => k + 1); } catch (error) { alert(error instanceof Error ? error.message : "Item could not be marked ready."); } }} onFinish={async (j, materials) => { try { const response = await apiFetch(`${BASE_URL}/sales/${encodeURIComponent(j.invoiceId)}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: j.invoiceId, clientName: j.clientName, materials }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Sale could not be finished."); const sale = normalizeSale(data); setSales(p => [sale, ...p.filter(item => item.invoiceId !== sale.invoiceId)]); setJobCosts(p => p.map(item => item.jobCostId === j.jobCostId ? { ...item, status: "Finished", sale } : item)); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Finished" } : i)); alert("Sale completed. Confirm receipt sending from Daily Sales when ready."); } catch (error) { alert(error instanceof Error ? error.message : "Sale could not be finished."); } }} />}
        {tab === "INVENTORY" && <GoldInventoryView inventory={inventory} goldRate={goldRate} onAdd={e => { setInventory(p => [...p, e]); setReloadKey(k => k + 1); }} onUpdate={e => { setInventory(p => p.map(item => item.id === e.id ? e : item)); setReloadKey(k => k + 1); }} onDelete={id => deleteFromApi("inventory", id, () => { setInventory(p => p.filter(item => item.id !== id)); setReloadKey(k => k + 1); })} />}
        {tab === "INQUIRIES" && <InquiriesView inquiries={inquiries} onAdd={i => setInquiries(p => [i, ...p])} onUpdate={i => setInquiries(p => p.map(item => item.inquiryId === i.inquiryId ? i : item))} onDelete={id => deleteFromApi("inquiries", id, () => setInquiries(p => p.filter(item => item.inquiryId !== id)))} onStartCosting={id => { setSelectedInquiryForCosting(id); setTab("JOB_COSTING"); }} />}
        {tab === "EXPENSES" && <ExpensesView expenses={visibleExpenses} rangeLabel={timelineLabel} onAdd={e => setExpenses(p => [e, ...p])} onUpdate={e => setExpenses(p => p.map(item => item.expenseId === e.expenseId ? e : item))} onDelete={id => deleteFromApi("expenses", id, () => setExpenses(p => p.filter(item => item.expenseId !== id)))} />}
        {tab === "PROFIT_ANALYSIS" && <ProfitAnalysisView sales={sales.filter(isCompletedSale)} jobCosts={jobCosts} expenses={expenses} selectedYear={selectedYear} setSelectedYear={setSelectedYear} startMonth={startMonth} setStartMonth={setStartMonth} endMonth={endMonth} setEndMonth={setEndMonth} />}
        {tab === "APPROVALS" && isAdmin && <ApprovalQueueView onResolved={() => setReloadKey(k => k + 1)} />}
        {tab === "AUDIT_LOGS" && isAdmin && <AuditLogsView />}
          </div>
        </main>
      </div>
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
      <h1 className="text-center font-serif text-2xl font-semibold text-foreground">Nilo&apos;s Goldsmith</h1>
      <p className="text-center text-sm text-muted-foreground mt-1 mb-7">Goldsmith Accounting System</p>
      <label className="block text-sm text-foreground mb-1">Username</label>
      <input value={userName} onChange={e => setUserName(e.target.value)} className={`${ic} mb-4`} autoComplete="username" />
      <label className="block text-sm text-foreground mb-1">Password</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={`${ic} mb-5`} autoComplete="current-password" />
      {error && <p className="text-sm text-danger mb-4">{error}</p>}
      <Button variant="primary" type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  </div>;
}
