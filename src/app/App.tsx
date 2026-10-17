import { JobsTable } from "./components/JobsTable";
import { ExpensesLedger } from "./components/ExpensesLedger";
import { expenseCategories } from "../expensesView";
import { Dashboard } from "./components/Dashboard";
import { Button } from "./components/ui/button";
import { Badge, sentenceCase } from "./components/ui/badge";
import { PageHeader } from "./components/PageHeader";
import { DateRangePicker } from "./components/DateRangePicker";
import { roundTwo } from "../rounding";
import { Children, Fragment, isValidElement, useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import goldsmithLogo from "../assets/nilosgold_logo.jpg";
import {
  Search, Plus, X, Crown, TrendingDown, Download,
  Package, BarChart3, DollarSign, Gem, Sun, Moon, PenSquare, Trash2,
  ArrowUpDown, ChevronUp, ChevronDown, LayoutDashboard, BriefcaseBusiness,
  Receipt, ShieldCheck, ScrollText, PanelLeftClose, PanelLeftOpen, UserRound, LogOut, MessageSquare,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { isValidEmail, isValidPHContact, normalizeContactInput } from "../validation";
import { ContactInput } from "./components/ContactInput";
import { summarizeInventory, groupInventory } from "../inventorySummary";
import { approvalChanges, approvalFieldLabel, approvalValue } from "../approvalDiff";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "./components/ui/dropdown-menu";

// ── config ─────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "https://nilosgold.vercel.app").replace(/\/$/, "");
const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => fetch(input, { ...init, credentials: "include" });
type ToastMessage = { message: string; actionLabel?: string; onAction?: () => void };
const notify = (message: string | ToastMessage) => window.dispatchEvent(new CustomEvent("nilosgold:toast", { detail: typeof message === "string" ? { message } : message }));
// Keep existing call sites on the in-app toast surface instead of native dialogs.
const alert = notify;

function ToastHost() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setToast(typeof detail === "string" ? { message: detail } : detail);
      window.setTimeout(() => setToast(null), 5000);
    };
    window.addEventListener("nilosgold:toast", onToast);
    return () => window.removeEventListener("nilosgold:toast", onToast);
  }, []);
  if (!toast) return null;
  return <div className="fixed bottom-5 right-5 z-[100] flex max-w-sm items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-2xl" role="status" aria-live="polite"><span>{toast.message}</span>{toast.onAction && <Button variant="ghost" className="shrink-0" onClick={() => { toast.onAction?.(); setToast(null); }}>{toast.actionLabel ?? "Undo"}</Button>}</div>;
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
    month: "short", day: "numeric", year: "numeric",
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
  payments: Array.isArray(row.payments) ? row.payments.map((p: any) => ({ amount: numeric(p.amount), paidAt: p.paidAt ? String(p.paidAt).slice(0, 10) : null })) : undefined,
  balance: numeric(row.balance ?? (numeric(row.price) - numeric(row.payment))),
  receiptSentAt: row.receiptSentAt ? String(row.receiptSentAt) : null,
  status: statusLabel(row.status) as SaleStatus,
});
const selectedStatus = (sale: Sale, jobCosts: JobCost[]) => jobCosts.find(job => job.jobCostId === sale.jobCostId || job.invoiceId === sale.invoiceId)?.status ?? "Finished";
const normalizeJobCost = (row: any): JobCost => {
  const sellingPrice = roundTwo(row.sellingPrice ?? row.sales?.price ?? row.sale?.price);
  const goldCostPerG = roundTwo(numeric(row.goldCostPerG));
  const goldCost = roundTwo(row.goldCost ?? roundTwo(numeric(row.goldUsed)) * goldCostPerG);
  const totalCost = roundTwo(row.totalCost ?? goldCost + roundTwo(numeric(row.laborCost)) + roundTwo(numeric(row.stoneCost)));
  const sale = row.sales ?? row.sale;
  return { jobDate: row.jobDate ? String(row.jobDate) : undefined, jobCostId: String(row.jobCostId ?? ""), invoiceId: String(row.invoiceId ?? sale?.invoiceId ?? ""), clientName: String(row.clientName ?? sale?.client?.clientName ?? row.inquiry?.customerName ?? ""), itemName: row.itemName ?? "", deadline: row.deadline || row.deliveryDate ? String(row.deadline ?? row.deliveryDate).slice(0, 10) : "", empId: row.empId, inquiryId: row.inquiryId ?? row.inquiry?.inquiryId, status: statusLabel(row.status), sale: sale ? normalizeSale(sale) : undefined, goldUsed: roundTwo(numeric(row.goldUsed)), goldScrap: roundTwo(numeric(row.goldScrap)), goldCostPerG, goldCost, stoneCost: roundTwo(numeric(row.stoneCost)), laborCost: roundTwo(numeric(row.laborCost)), totalCost, sellingPrice, profit: roundTwo(row.profit ?? sellingPrice - totalCost), marginPct: roundTwo(row.marginPct ?? (sellingPrice ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0)) };
};
const normalizeInventory = (row: any): InvEntry => ({ id: row.referenceId, date: apiDate(row.updatedAt ?? row.date), referenceId: row.referenceId, itemName: row.itemName ?? row.referenceId, category: row.category ?? "GOLD", goldKarat: row.goldKarat == null ? null : numeric(row.goldKarat), quantityIn: numeric(row.quantityIn ?? row.goldIn), quantityOut: numeric(row.quantityOut ?? row.goldOut), quantityLoss: numeric(row.quantityLoss ?? row.scraps ?? row.scrap), balance: numeric(row.balance ?? row.totalGold), unit: row.unit ?? "grams", unitPrice: numeric(row.unitPrice) });
const normalizeInquiry = (row: any): Inquiry => ({ inquiryId: String(row.inquiryId ?? ""), date: apiDate(row.inqDate ?? row.date), customerName: String(row.customerName ?? ""), contactInfo: normalizeContactInput(String(row.contactInfo ?? "")), email: String(row.email ?? ""), details: String(row.details ?? ""), category: String(row.category ?? ""), quotedPrice: numeric(row.quotedPrice), isFullyPaid: Boolean(row.isFullyPaid), status: statusLabel(row.status) as InqStatus });
const normalizeExpense = (row: any): Expense => ({ expenseId: String(row.expenseId ?? ""), expDate: apiDate(row.expDate ?? row.date), category: String(row.category ?? ""), description: String(row.description ?? ""), amount: numeric(row.amount) });
const asRows = (value: unknown): any[] => Array.isArray(value) ? value : [];
const loadDashboardApprovals = async () => {
  const response = await apiFetch(BASE_URL + "/approvals");
  if (!response.ok) throw new Error("Approvals could not be loaded.");
  return asRows(await response.json());
};

// ── types ──────────────────────────────────────────────────────────────────
type ServiceType = "Custom" | "Repair" | "Resize" | "Cleaning";
type SaleStatus = "Ongoing" | "Paid" | "Released" | "Pending" | "Finished" | "Partial" | "Cancelled";
type InqStatus = "Yes" | "No" | "Pending" | "Approved" | "Rejected" | "Finished";

interface Sale {
  payments?: { amount: number; paidAt: string | null }[];
  id: string; invoiceId: string; date: string; clientId?: string; jobCostId?: string;
  clientName: string; contactNum: string; email?: string; serviceType: ServiceType;
  price: number; payment: number; balance: number; status: SaleStatus; receiptSentAt?: string | null;
}
interface JobCost {
  jobDate?: string;
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

function Modal({ title, onClose, onSubmit, children, submitLabel = "Save entry", isSubmitting = false, submitDisabled = false, className = "", formClassName = "" }: {
  title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode;
  submitLabel?: string; isSubmitting?: boolean; submitDisabled?: boolean; className?: string; formClassName?: string;
}) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const handleFieldChange = (event: React.FormEvent<HTMLFormElement>) => {
    const control = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (typeof control.checkValidity !== "function" || !control.willValidate) return;
    const field = control.closest<HTMLElement>(".form-field");
    if (!field?.dataset.field) return;
    setFieldErrors(current => {
      const next = { ...current };
      if (control.validity.valid) delete next[field.dataset.field!];
      else next[field.dataset.field!] = control.validationMessage;
      return next;
    });
  };
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const controls = Array.from(event.currentTarget.elements) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>;
    const invalid = controls.filter(control => control.willValidate && !control.validity.valid);
    if (invalid.length) {
      event.preventDefault();
      const next: Record<string, string> = {};
      for (const control of invalid) {
        const field = control.closest<HTMLElement>(".form-field");
        if (field?.dataset.field) next[field.dataset.field] = control.validationMessage;
      }
      setFieldErrors(next);
      invalid[0].focus();
      return;
    }
    onSubmit(event);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className={`bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-2xl shadow-ink/30 max-h-[90vh] flex flex-col ${className}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <span className="text-xl font-semibold">{title}</span>
          <Button variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose} >
            <X size={16} />
          </Button>
        </div>
        <form noValidate onSubmit={handleFormSubmit} onChangeCapture={handleFieldChange} className={`p-6 space-y-4 overflow-y-auto ${formClassName}`}>
          <FieldErrorsContext.Provider value={fieldErrors}>{children}</FieldErrorsContext.Provider>
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

const FieldErrorsContext = createContext<Record<string, string>>({});
function requiresValue(node: React.ReactNode): boolean {
  return Children.toArray(node).some(child => isValidElement<{ required?: boolean; children?: React.ReactNode }>(child) && (child.props.required || requiresValue(child.props.children)));
}
function FF({ label, children, helper }: { label: string; children: React.ReactNode; helper?: string }) {
  const fieldErrors = useContext(FieldErrorsContext);
  const fieldKey = sentenceCase(label);
  const error = fieldErrors[fieldKey];
  const required = requiresValue(children);
  return (
    <div className="form-field" data-field={fieldKey}>
      <label className="block text-xs font-sans text-muted-foreground section-label mb-1">{fieldKey}{required && <span className="required-marker" aria-hidden="true"> *</span>}</label>
      {children}
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
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

function SortableHeader({ label, sortKey, sort, onSort, align = "left" }: {
  label: string; sortKey: string; sort: SortSpec; onSort: (key: string) => void; align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return <th className={thc + (align === "right" ? " text-right" : "")} aria-sort={active ? (sort.direction === 1 ? "ascending" : "descending") : "none"}>
    <Button variant="ghost" type="button" onClick={() => onSort(sortKey)} className={`h-auto gap-1.5 px-0 text-xs ${align === "right" ? "ml-auto justify-end" : "justify-start"}`}>
      {sentenceCase(label)}{active ? (sort.direction === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ArrowUpDown size={12} className="opacity-40" />}
    </Button>
  </th>;
}

function BrandLogo({ className = "" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <div className={`rounded-xl bg-primary text-primary-foreground flex items-center justify-center ${className}`}><Crown size={20} /></div>
    : <img src={goldsmithLogo} alt="Nilo's Goldsmith" onError={() => setFailed(true)} className={`rounded-xl object-contain bg-card ${className}`} />;
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
// ── daily sales ─────────────────────────────────────────────────────────────
function DailySalesView({ sales, jobCosts, onUpdate, onDelete, onJobs }: { sales: Sale[]; jobCosts: JobCost[]; onUpdate: (s: Sale) => void; onDelete: (id: string) => void; onJobs: () => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortSpec>({ key: "date", direction: -1 });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const toggleSort = (key: string) => setSort(s => ({ key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ invoiceId: "", date: "", clientName: "", contactNum: "", email: "", serviceType: "Custom" as ServiceType, price: "", payment: "" });

  const invalidRange = !!startDate && !!endDate && startDate > endDate;
  const filtered = sortRecords(useMemo(() => sales.filter(s =>
    (!startDate || s.date >= startDate) && (!endDate || s.date <= endDate) && (typeFilter === "All" || s.serviceType === typeFilter) &&
    [s.clientName, s.invoiceId, s.serviceType, s.status].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [sales, q, startDate, endDate, typeFilter]), sort);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleSales = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const typeCounts = useMemo(() => {
    const base = sales.filter(s => (!startDate || s.date >= startDate) && (!endDate || s.date <= endDate) && [s.clientName, s.invoiceId, s.serviceType, s.status].some(v => v.toLowerCase().includes(q.toLowerCase())));
    return Object.fromEntries(["All", "Repair", "Custom", "Cleaning", "Resize"].map(type => [type, type === "All" ? base.length : base.filter(s => s.serviceType === type).length])) as Record<string, number>;
  }, [sales, startDate, endDate, q]);
  const totalSales = filtered.reduce((sum, sale) => sum + sale.price, 0);
  const collected = filtered.reduce((sum, sale) => sum + sale.payment, 0);
  const outstanding = filtered.reduce((sum, sale) => sum + sale.balance, 0);
  const selectedJob = selectedSale ? jobCosts.find(job => job.jobCostId === selectedSale.jobCostId || job.invoiceId === selectedSale.invoiceId) : undefined;
  const hasBalance = (balance: number) => roundTwo(balance) > 0;
  const balanceValue = (balance: number) => !hasBalance(balance) ? <span className="text-muted-foreground">—</span> : <span className="text-warning tabular-nums">{php(balance)}</span>;
  const formatContact = (value: string) => { const digits = value.replace(/\D/g, ""); return digits.length === 11 && digits.startsWith("09") ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : value || "—"; };
  const downloadCsv = () => {
    const cell = (value: string | number) => { const raw = String(value); const safe = /^[=+@\-]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };
    const rows = [["Date", "Invoice", "Client", "Contact", "Type", "Total", "Collected", "Balance", "Status"], ...filtered.map(s => [s.date, s.invoiceId, s.clientName, s.contactNum, s.serviceType, s.price.toFixed(2), s.payment.toFixed(2), s.balance.toFixed(2), s.status])];
    const url = URL.createObjectURL(new Blob([rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = `sales-${startDate || "all"}-${endDate || "dates"}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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

  return <div className="space-y-4">
      <PageHeader title="Sales" description="Sales appear here after an approved job costing is finished" action={<div className="expense-filters">
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); setPage(1); }} label="Sales date range" />
        <Button variant="secondary" onClick={downloadCsv} disabled={!filtered.length || invalidRange}><Download size={16} />Export CSV</Button>
      </div>} />
      {invalidRange && <p role="alert" className="text-sm text-danger">The end date must be on or after the start date.</p>}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Sales summary for current filters">
        {[{ label: "Total sales", value: totalSales }, { label: "Collected", value: collected }].map(item => <div key={item.label} className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{item.label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{php(item.value)}</div></div>)}
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Outstanding balance</div><div className="mt-1 text-xl font-semibold tabular-nums">{balanceValue(outstanding)}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Number of invoices</div><div className="mt-1 text-xl font-semibold tabular-nums">{filtered.length.toLocaleString()}</div></div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Filter sales by type">{["All", "Repair", "Custom", "Cleaning", "Resize"].map(type => <Button key={type} variant={typeFilter === type ? "secondary" : "ghost"} aria-pressed={typeFilter === type} onClick={() => { setTypeFilter(type); setPage(1); }} className="text-sm">{type}<span className="ml-1 rounded bg-muted px-1.5 text-xs tabular-nums">{typeCounts[type] ?? 0}</span></Button>)}</div><SearchBar value={q} onChange={value => { setQ(value); setPage(1); }} placeholder="Search client, invoice, type…" /></div>
      <div className="max-h-[calc(100vh-25rem)] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[1080px] text-xs font-sans">
        <thead className="sticky top-0 z-10"><tr>
          {[["Date", "date"], ["Invoice #", "invoiceId"], ["Client", "clientName"], ["Contact", "contactNum"], ["Type", "serviceType"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} />)}
          {[["Total price", "price"], ["Collected", "payment"], ["Balance", "balance"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} align="right" />)}
          <th className={thc}>Job status</th><th className={thc}>Payment</th><th className={thc}>Actions</th>
        </tr></thead>
        <tbody>{visibleSales.map(s => <TRow key={s.id} onClick={() => setSelectedSale(s)}>
          <td className={tdc + " h-11 !py-1"}>{fmtDate(s.date)}</td><td className={tdc + " h-11 !py-1 text-muted-foreground"}><Button variant="ghost" className="h-8 px-1 font-mono text-xs" onClick={event => { event.stopPropagation(); setSelectedSale(s); }}>{s.invoiceId}</Button></td><td className={tdc + " h-11 !py-1 font-medium"}>{s.clientName}</td><td className={tdc + " h-11 !py-1 text-muted-foreground"}>{formatContact(s.contactNum)}</td>
          <td className={tdc + " h-11 !py-1"}><Badge variant="neutral">{sentenceCase(s.serviceType)}</Badge></td><td className={tdr + " h-11 !py-1"}>{php(s.price)}</td><td className={tdr + " h-11 !py-1"}>{php(s.payment)}</td><td className={tdr + " h-11 !py-1"}>{balanceValue(s.balance)}</td><td className={tdc + " h-11 !py-1"}><Badge status={selectedStatus(s, jobCosts)} /></td><td className={tdc + " h-11 !py-1"}><Badge variant={hasBalance(s.balance) ? "warning" : "success"}>{hasBalance(s.balance) ? "Balance due" : "Paid in full"}</Badge></td>
          <td className={tdc + " h-11 !py-1"}><div className="table-row-actions"><Button variant="ghost" size="icon" aria-label="Edit sale" type="button" onClick={event => { event.stopPropagation(); setEditingId(s.invoiceId); setForm({ invoiceId: s.invoiceId, date: s.date, clientName: s.clientName, contactNum: s.contactNum, email: s.email ?? "", serviceType: s.serviceType, price: String(s.price), payment: String(s.payment) }); setOpen(true); }} title="Edit"><PenSquare size={16} /></Button><Button variant="ghost" size="icon" className="row-action-delete" aria-label="Delete sale" type="button" onClick={event => { event.stopPropagation(); onDelete(s.id); }} title="Delete"><Trash2 size={16} /></Button></div></td>
        </TRow>)}{!visibleSales.length && <EmptyRow cols={11} />}</tbody>
      </table></div>
      <div className="expense-pagination"><p>{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} invoices` : "0 invoices"}</p><label>Rows per page <select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label><Button variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage} of {pages}</span><Button variant="secondary" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
      <Sheet open={!!selectedSale} onOpenChange={open => { if (!open) setSelectedSale(null); }}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {selectedSale && <><SheetHeader className="border-b border-border pb-4 pr-10"><SheetTitle>Invoice {selectedSale.invoiceId}</SheetTitle><SheetDescription>{fmtDate(selectedSale.date)} · {sentenceCase(selectedSale.serviceType)}</SheetDescription></SheetHeader><div className="space-y-6 px-1">
          <section><h3 className="text-sm font-semibold">Client information</h3><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Client</dt><dd>{selectedSale.clientName || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Contact</dt><dd>{formatContact(selectedSale.contactNum)}</dd></div><div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all">{selectedSale.email || "—"}</dd></div></dl></section>
          <section><h3 className="text-sm font-semibold">Invoice summary</h3><dl className="mt-3 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Total</dt><dd className="tabular-nums">{php(selectedSale.price)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Collected</dt><dd className="tabular-nums">{php(selectedSale.payment)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Balance</dt><dd>{balanceValue(selectedSale.balance)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Job status</dt><dd><Badge status={selectedStatus(selectedSale, jobCosts)} /></dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payment</dt><dd><Badge variant={hasBalance(selectedSale.balance) ? "warning" : "success"}>{hasBalance(selectedSale.balance) ? "Balance due" : "Paid in full"}</Badge></dd></div></dl></section>
          <section><h3 className="text-sm font-semibold">Payment history</h3>{(selectedSale.payments?.length ? selectedSale.payments : selectedSale.payment > 0 ? [{ amount: selectedSale.payment, paidAt: selectedSale.date }] : []).length ? <ul className="mt-3 divide-y divide-border">{(selectedSale.payments?.length ? selectedSale.payments : selectedSale.payment > 0 ? [{ amount: selectedSale.payment, paidAt: selectedSale.date }] : []).map((payment, index) => <li key={`${payment.paidAt ?? "undated"}-${index}`} className="flex justify-between gap-3 py-3 text-sm"><span>{payment.paidAt ? fmtDate(payment.paidAt) : "Date unavailable"}</span><span className="font-medium tabular-nums">{php(payment.amount)}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No payments recorded yet.</p>}</section>
          <section><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Linked job costing</h3>{selectedJob && <Button variant="ghost" onClick={onJobs}>Open jobs</Button>}</div>{selectedJob ? <dl className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm"><div><dt className="text-xs text-muted-foreground">Job ID</dt><dd className="font-mono">{selectedJob.jobCostId}</dd></div><div><dt className="text-xs text-muted-foreground">Item</dt><dd>{selectedJob.itemName || "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Job cost</dt><dd className="tabular-nums">{php(selectedJob.totalCost)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Profit</dt><dd className="tabular-nums">{php(selectedJob.profit)}</dd></div></dl> : <p className="mt-3 text-sm text-muted-foreground">No linked job costing record.</p>}</section>
        </div></>}
      </SheetContent></Sheet>
      {open && (
        <Modal title="Edit finished sale" onClose={closeModal} onSubmit={submit} submitLabel="Update sale" isSubmitting={isSubmitting}>
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
  </div>;
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
  const liveGoldCost = roundTwo(Math.max(0, Number(form.goldUsed) || 0) * Math.max(0, Number(form.goldCostPerG) || 0));
  const liveTotalCost = roundTwo(liveGoldCost + Math.max(0, Number(form.stoneCost) || 0) + Math.max(0, Number(form.laborCost) || 0));
  const liveSellingPrice = Math.max(0, Number(form.sellingPrice) || 0);
  const liveProfit = roundTwo(liveSellingPrice - liveTotalCost);
  const liveMargin = liveSellingPrice > 0 ? roundTwo(liveProfit / liveSellingPrice * 100) : null;
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
      {open && <Modal title={editingId ? "Edit job costing" : "Cost a pending inquiry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update costing" : "Save pending costing"} isSubmitting={isSubmitting} className="job-costing-modal max-w-6xl" formClassName="job-costing-form">
        <div className="job-costing-layout">
          <div className="job-costing-fields">
            <section className="job-costing-group"><div className="job-costing-group-heading"><h2>Client &amp; service</h2><p>Choose the inquiry and add workshop details.</p></div><div className="job-costing-field-grid">
              {!editingId && <FF label="Pending inquiry"><select className={ic} value={form.inquiryId} onChange={e => selectInquiry(e.target.value)} required><option value="">Select an inquiry</option>{pendingInquiries.map(i => <option key={i.inquiryId} value={i.inquiryId}>{i.customerName} · {i.category} · {i.inquiryId}</option>)}</select></FF>}
              {editingId && <FF label="Reference"><input className={`${ic} read-only-field`} value={form.invoiceId} readOnly /></FF>}
              <FF label="Client name"><input className={`${ic} read-only-field`} value={form.clientName} readOnly placeholder="Select a pending inquiry" required /></FF>
              {!editingId && <FF label="Service type"><select className={ic} value={form.serviceType} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value as ServiceType }))}>{(["Custom", "Repair", "Resize", "Cleaning"] as ServiceType[]).map(t => <option key={t}>{t}</option>)}</select></FF>}
              <FF label="Employee ID (optional)" helper="Leave blank to assign available staff."><input className={ic} value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} placeholder="Optional" /></FF>
              <FF label="Item name (optional)"><input className={ic} value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="e.g. Gold ring" maxLength={120} /></FF>
              <FF label="Delivery date / deadline (optional)"><input type="date" min={todayISO()} className={ic} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></FF>
            </div></section>
            <section className="job-costing-group"><div className="job-costing-group-heading"><h2>Materials</h2><p>Enter material use and workshop costs.</p></div><div className="job-costing-field-grid">
              <FF label="Gold used (g)"><input type="number" min="0" step="0.001" className={ic} value={form.goldUsed} onChange={e => setForm(f => ({ ...f, goldUsed: e.target.value }))} required /></FF>
              <FF label="Gold scrap (g, optional)"><input type="number" min="0" step="0.001" className={ic} value={form.goldScrap} onChange={e => setForm(f => ({ ...f, goldScrap: e.target.value }))} /></FF>
              <FF label="Gold price per g (₱)"><input type="number" min="0.01" step="0.01" className={ic} value={form.goldCostPerG} onChange={e => setForm(f => ({ ...f, goldCostPerG: e.target.value }))} required /></FF>
              <FF label="Stone cost (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.stoneCost} onChange={e => setForm(f => ({ ...f, stoneCost: e.target.value }))} required /></FF>
              <FF label="Labor cost (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.laborCost} onChange={e => setForm(f => ({ ...f, laborCost: e.target.value }))} required /></FF>
            </div></section>
            <section className="job-costing-group"><div className="job-costing-group-heading"><h2>Pricing</h2><p>Set the quoted selling price for this job.</p></div><div className="job-costing-field-grid">
              <FF label="Selling price (₱)"><input type="number" min="0.01" step="0.01" className={ic} value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} required /></FF>
            </div><p className="mt-3 text-xs text-muted-foreground">Invoice number and job costing ID are assigned automatically.</p></section>
          </div>
          <aside className="job-costing-summary" aria-live="polite" aria-label="Live job costing summary"><p className="section-label">Live summary</p><h2>Job estimate</h2><dl>
            <div><dt>Total cost</dt><dd>{php(liveTotalCost)}</dd></div>
            <div><dt>Profit</dt><dd className={liveProfit < 0 ? "text-danger" : "text-success"}>{php(liveProfit)}</dd></div>
            <div><dt>Margin</dt><dd>{liveMargin === null ? <span className="text-muted-foreground">—</span> : <Badge variant={marginVariant(liveMargin)}>{pct(liveMargin)}</Badge>}</dd></div>
          </dl><p className="job-costing-summary-note">Updates as you enter materials, costs, and selling price.</p></aside>
        </div>
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
  const [showLowStock, setShowLowStock] = useState(false);
  const blank = () => ({ date: todayISO(), referenceId: "", itemName: "", category: "GOLD", goldKarat: "", quantityIn: "", quantityOut: "", quantityLoss: "", unit: "grams", unitPrice: "" });
  const [form, setForm] = useState(blank);
  const products = useMemo(() => groupInventory(inventory), [inventory]);
  const reorderLevel = (product: { category: string; unit: string }) => product.category === "GOLD" ? 10 : product.category === "SILVER" ? 100 : product.category === "GEMSTONES" ? 20 : 10;
  const stockProducts = useMemo(() => products.filter(product => (categoryFilter === "ALL" || product.category === categoryFilter) && [product.itemName, product.category, product.goldKarat == null ? "" : `${product.goldKarat}k`].some(value => value.toLowerCase().includes(q.toLowerCase())) && (!showLowStock || product.balance < reorderLevel(product))), [products, categoryFilter, q, showLowStock]);
  const filtered = useMemo(() => inventory.filter(e => stockProducts.some(product => product.key === (e.category === "GOLD" ? `GOLD:${e.goldKarat ?? "unknown"}:grams` : JSON.stringify([e.category, e.unit, e.itemName.trim().toLowerCase()])))), [inventory, stockProducts]);
  const visibleProducts = groupInventory(sortRecords(inventory, sort), filtered);
  const totalGold = products.filter(product => product.category === "GOLD").reduce((sum, product) => sum + Math.max(0, product.balance), 0);
  const totalSilver = products.filter(product => product.category === "SILVER").reduce((sum, product) => sum + Math.max(0, product.balance), 0);
  const gemstones = products.filter(product => product.category === "GEMSTONES" && product.unit === "pieces").reduce((sum, product) => sum + Math.max(0, product.balance), 0);
  const estimate = goldRate === null ? null : totalGold * goldRate;
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
    <div className="inventory-stats-grid">{[["Total gold on hand", `${totalGold.toLocaleString("en-PH", { maximumFractionDigits: 3 })} g`, "Gold across all karats"], ["Estimated value", estimate === null ? "Rate unavailable" : php(estimate), "Based on current 24K gold price × gold grams"], ["Silver", `${totalSilver.toLocaleString("en-PH", { maximumFractionDigits: 3 })} g`, "Silver on hand"], ["Gemstones", `${gemstones.toLocaleString("en-PH", { maximumFractionDigits: 3 })} pcs`, "Counted by piece"]].map(([label, value, note]) => <section key={label} className="inventory-stat"><p className="section-label">{label}</p><p className="inventory-stat-value">{value}</p><p className="inventory-stat-note">{note}</p></section>)}</div>
    <div className="flex flex-wrap items-center gap-3"><SearchBar value={q} onChange={setQ} placeholder="Search material or item…" /><select className={ic + " w-auto"} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Filter inventory category"><option value="ALL">All categories</option>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select><label className="inline-flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showLowStock} onChange={e => setShowLowStock(e.target.checked)} /> Show low stock only</label><span className="ml-auto text-xs text-muted-foreground">{filtered.length.toLocaleString()} movement records</span></div>
    <section aria-labelledby="stock-levels-heading"><div className="mb-3"><h2 id="stock-levels-heading" className="text-base font-semibold">Stock levels</h2><p className="mt-1 text-xs text-muted-foreground">Current material balance by category and karat.</p></div><div className="inventory-stock-grid">{stockProducts.filter(product => ["GOLD", "SILVER", "GEMSTONES"].includes(product.category)).map(product => { const level = reorderLevel(product); const low = product.balance < level; const percent = Math.min(100, Math.max(0, product.balance / level * 100)); return <article key={product.key} className="inventory-stock-card"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{product.itemName}</p><p className="mt-1 text-xs text-muted-foreground">{sentenceCase(product.category)} {product.goldKarat != null ? `· ${product.goldKarat}K` : ""}</p></div>{low && <Badge variant="warning">Low stock</Badge>}</div><p className="mt-5 inventory-stock-value">{product.balance.toLocaleString("en-PH", { maximumFractionDigits: 3 })} <span>{product.unit === "grams" ? "g" : product.unit}</span></p><div className="inventory-progress"><span style={{ width: `${percent}%` }} /></div><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>Reorder at {level} {product.unit === "grams" ? "g" : product.unit}</span><AddStockChangeButton compact onClick={() => addMovement(product.key)} /></div></article>})}{!stockProducts.some(product => ["GOLD", "SILVER", "GEMSTONES"].includes(product.category)) && <p className="text-sm text-muted-foreground">No metal or gemstone stock matches these filters.</p>}</div></section>
  <section aria-labelledby="ledger-heading"><div className="mb-3"><h2 id="ledger-heading" className="text-base font-semibold">Inventory movement ledger</h2><p className="mt-1 text-xs text-muted-foreground">Movement records grouped by material.</p></div><TableWrap><thead><tr>{[["Date", "date"], ["Reference", "referenceId"], ["Item", "itemName"], ["In (units)", "quantityIn"], ["Out (units)", "quantityOut"], ["Loss (units)", "quantityLoss"], ["Balance (units)", "balance"]].map(([h, k]) => <SortableHeader key={h} label={h} sortKey={k} sort={sort} onSort={toggleSort} />)}<th className={thc}>Actions</th></tr></thead>
      <tbody>{visibleProducts.map(product => <Fragment key={product.key}>
        <tr className="border-b border-border bg-muted/30">
          <td className={tdc} colSpan={3}><Button variant="ghost" type="button" className="flex items-center gap-2 text-left" aria-expanded={expanded.has(product.key)} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(product.key)) next.delete(product.key); else next.add(product.key); return next; })}>
            {expanded.has(product.key) ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}{product.itemName}<span className="ml-2 font-normal text-muted-foreground">{sentenceCase(product.category)}{product.goldKarat != null ? ` · ${product.goldKarat}K` : ""}</span><Badge variant="neutral">{product.balance.toLocaleString("en-PH", { maximumFractionDigits: 3 })} {product.unit === "grams" ? "g" : product.unit}</Badge>
          </Button></td>
          <td className={tdr}>{product.quantityIn.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td><td className={tdr}>{product.quantityOut.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td><td className={tdr}>{product.quantityLoss.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td>
          <td className={tdr+" text-primary-text font-semibold"}>{product.balance.toLocaleString("en-PH", { maximumFractionDigits:3 })}</td>
          <td className={tdc}><AddStockChangeButton compact onClick={() => addMovement(product.key)} /></td>
        </tr>
        {expanded.has(product.key) && <tr className="inventory-child-header"><th colSpan={3}>Movement</th><th>In ({product.unit === "grams" ? "g" : product.unit})</th><th>Out ({product.unit === "grams" ? "g" : product.unit})</th><th>Loss ({product.unit === "grams" ? "g" : product.unit})</th><th>Balance ({product.unit === "grams" ? "g" : product.unit})</th><th>Actions</th></tr>}
        {expanded.has(product.key) && product.movements.map(e => <TRow key={e.id} onClick={()=>edit(e)}><td className={tdc} colSpan={3}>{fmtDate(e.date)} · <span className="text-primary-text/80">{e.referenceId}</span></td><td className={tdr}>{e.quantityIn ? `+${e.quantityIn}` : "—"}</td><td className={tdr}>{e.quantityOut ? `-${e.quantityOut}` : "—"}</td><td className={tdr}>{e.quantityLoss || "—"}</td><td className={tdr+" text-primary-text font-semibold"}>{e.balance}</td><td className={tdc}><div className="table-row-actions"><Button variant="ghost" size="icon" aria-label="Edit inventory entry" type="button" onClick={event=>{event.stopPropagation();edit(e);}} title="Edit"><PenSquare size={16}/></Button><Button variant="ghost" size="icon" className="row-action-delete" aria-label="Delete inventory entry" type="button" onClick={event=>{event.stopPropagation();onDelete(e.id);}} title="Delete"><Trash2 size={16}/></Button></div></td></TRow>)}
      </Fragment>)}{!visibleProducts.length && <EmptyRow cols={10}/>}</tbody>
  </TableWrap></section>
  {
    open && <Modal title={editingId ? "Edit inventory entry" : "Add stock change"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update entry" : "Save entry"} isSubmitting={isSubmitting}>
      {!editingId && <FF label="Product"><select className={ic+" mb-4"} aria-label="Inventory product" value={selectedProduct} onChange={e => selectProduct(e.target.value)}><option value="">Create a new product</option>{products.map(product => <option key={product.key} value={product.key}>{product.itemName} · {product.category} · {product.unit}</option>)}</select></FF>}
      <div className="grid grid-cols-2 gap-4"><FF label="Date"><input type="date" max={todayISO()} className={ic} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></FF><FF label="Reference"><input className={`${ic} read-only-field`} value={form.referenceId} readOnly placeholder="Assigned when saved" /></FF>
        <FF label="Category"><select disabled={!!selectedProduct} className={ic} value={form.category} onChange={e => { const category = e.target.value; setForm(f => ({ ...f, category, goldKarat: category === "GOLD" ? f.goldKarat : "", unit: INVENTORY_UNITS[category][0] })); }}>{INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select></FF>{form.category === "GOLD" && <FF label="Karat"><select disabled={!!selectedProduct} className={ic} value={form.goldKarat} onChange={e => setForm(f => ({ ...f, goldKarat: e.target.value }))} required><option value="">Select karat</option>{Array.from({ length: 15 }, (_, i) => i + 10).map(karat => <option key={karat} value={karat}>{karat}K</option>)}</select></FF>}<FF label="Unit"><select disabled={!!selectedProduct} className={ic} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>{units.map(u => <option key={u}>{u}</option>)}</select></FF>
        <div className="col-span-2"><FF label="Item Description"><input readOnly={!!selectedProduct} className={ic} value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="e.g. 18k chain, gemstone, ring box" required /></FF></div>
        <FF label={`Quantity In (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityIn} onChange={e => setForm(f => ({ ...f, quantityIn: e.target.value }))} /></FF><FF label={`Unit Price (₱ / ${form.unit})`}><input type="number" required min="0.01" step="0.01" className={ic} value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} /></FF><FF label={`Quantity Out (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityOut} onChange={e => setForm(f => ({ ...f, quantityOut: e.target.value }))} /></FF><FF label={`Loss / Scrap (${form.unit})`}><input type="number" min="0" step="0.01" className={ic} value={form.quantityLoss} onChange={e => setForm(f => ({ ...f, quantityLoss: e.target.value }))} /></FF>
          </div><p className="text-xs text-muted-foreground">Stock balance is calculated for each category, item, and unit.</p>
        </Modal>}
      </div>;
}

      // ── inquiries ───────────────────────────────────────────────────────────────
function InquiriesView({ inquiries, onAdd, onUpdate, onDelete, onStartCosting }: { inquiries: Inquiry[]; onAdd: (i: Inquiry) => void; onUpdate: (i: Inquiry) => void; onDelete: (id: string) => void; onStartCosting: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortSpec>({ key: "date", direction: -1 });
  const [activeStatus, setActiveStatus] = useState("All");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const toggleSort = (key: string) => setSort(s => ({ key, direction: s.key === key ? (s.direction === 1 ? -1 : 1) : 1 }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ customerName: "", contactInfo: "", email: "", details: "", category: "", quotedPrice: "", isFullyPaid: false, status: "Pending" as InqStatus });
  const statusForTab = (inquiry: Inquiry, tab: string) => {
    if (tab === "All") return true;
    if (tab === "Pending") return inquiry.status === "Pending" && inquiry.quotedPrice <= 0;
    if (tab === "Quoted") return inquiry.status === "Pending" && inquiry.quotedPrice > 0;
    if (tab === "Converted to job") return ["Approved", "Finished"].includes(inquiry.status);
    return ["Rejected", "Cancelled"].includes(inquiry.status);
  };
  const tabs = ["All", "Pending", "Quoted", "Converted to job", "Closed"];
  const counts = Object.fromEntries(tabs.map(tab => [tab, inquiries.filter(inquiry => statusForTab(inquiry, tab)).length]));
  const filtered = sortRecords(useMemo(() => inquiries.filter(i =>
    statusForTab(i, activeStatus) && [i.customerName, i.category, i.details, i.email, i.inquiryId].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [inquiries, q, activeStatus]), sort);

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

  return <div className="space-y-4">
    <PageHeader title="Inquiries" description="Manage customer requests and prepare new jobs." action={<AddBtn onClick={() => { resetForm(); setEditingId(null); setOpen(true); }} label="Add inquiry" />} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Inquiry status" className="flex flex-wrap gap-2">
        {tabs.map(tab => <Button key={tab} role="tab" aria-selected={activeStatus === tab} variant={activeStatus === tab ? "secondary" : "ghost"} onClick={() => setActiveStatus(tab)} className="gap-2 text-sm">{tab}<span className="text-xs tabular-nums text-muted-foreground">{counts[tab]}</span></Button>)}
      </div>
      <SearchBar value={q} onChange={setQ} placeholder="Search client, service type…" />
    </div>
    {inquiries.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><MessageSquare size={22} /></div>
      <h2 className="text-xl font-semibold">No inquiries yet</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">Customer requests will appear here so you can review and prepare jobs.</p>
      <Button variant="primary" className="mt-5" onClick={() => { resetForm(); setEditingId(null); setOpen(true); }}>Add Inquiry</Button>
    </div> : !filtered.length ? <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">No inquiries match these filters.</div> : <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full table-fixed text-xs font-sans">
        <thead><tr>
          <SortableHeader label="Date" sortKey="date" sort={sort} onSort={toggleSort} />
          <SortableHeader label="Client" sortKey="customerName" sort={sort} onSort={toggleSort} />
          <SortableHeader label="Category" sortKey="category" sort={sort} onSort={toggleSort} />
          <SortableHeader label="Quoted price" sortKey="quotedPrice" sort={sort} onSort={toggleSort} />
          <th className={thc}>Paid</th><SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} /><th className={thc + " w-56 text-right"}>Actions</th>
        </tr></thead>
        <tbody>{filtered.map(i => <TRow key={i.inquiryId} onClick={() => setSelectedInquiry(i)}>
          <td className={tdc}>{fmtDate(i.date)}</td>
          <td className={tdc + " truncate font-medium"} title={i.customerName}>{i.customerName}</td>
          <td className={tdc + " truncate"} title={i.category}>{i.category}</td>
          <td className={tdr}>{php(i.quotedPrice)}</td>
          <td className={tdc}><Badge variant={i.isFullyPaid ? "success" : "neutral"} status={i.isFullyPaid ? "Fully Paid" : "Unpaid"} /></td>
          <td className={tdc}><Badge status={i.status} /></td>
          <td className={tdc + " text-right"}><div className="flex items-center justify-end gap-1">
            {i.status === "Pending" && <Button variant="secondary" type="button" onClick={event => { event.stopPropagation(); onStartCosting(i.inquiryId); }} className="whitespace-nowrap text-xs">Convert to job</Button>}
            {i.status === "Pending" && <div className="table-row-actions"><Button variant="ghost" size="icon" aria-label="Edit inquiry" type="button" onClick={event => { event.stopPropagation(); setEditingId(i.inquiryId); setForm({ customerName: i.customerName, contactInfo: i.contactInfo, email: i.email, details: i.details, category: i.category, quotedPrice: String(i.quotedPrice), isFullyPaid: i.isFullyPaid, status: i.status }); setOpen(true); }} title="Edit"><PenSquare size={16} /></Button><Button variant="ghost" size="icon" className="row-action-delete" aria-label="Delete inquiry" type="button" onClick={event => { event.stopPropagation(); onDelete(i.inquiryId); }} title="Delete"><Trash2 size={16} /></Button></div>}
          </div></td>
        </TRow>)}</tbody>
      </table>
    </div>}
    <Sheet open={!!selectedInquiry} onOpenChange={open => { if (!open) setSelectedInquiry(null); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {selectedInquiry && <>
          <SheetHeader className="border-b border-border pb-4 pr-10">
            <SheetTitle>{selectedInquiry.customerName}</SheetTitle>
            <SheetDescription>{selectedInquiry.category} · {fmtDate(selectedInquiry.date)}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-1">
            <div className="flex flex-wrap gap-2"><Badge variant={selectedInquiry.isFullyPaid ? "success" : "neutral"} status={selectedInquiry.isFullyPaid ? "Fully Paid" : "Unpaid"} /><Badge status={selectedInquiry.status} /></div>
            <dl className="space-y-4">
              <div><dt className="text-xs text-muted-foreground">Contact</dt><dd className="mt-1 text-sm font-medium">{selectedInquiry.contactInfo || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1 break-all text-sm font-medium">{selectedInquiry.email || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Details</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{selectedInquiry.details || "No details provided."}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Quoted price</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{php(selectedInquiry.quotedPrice)}</dd></div>
            </dl>
            {selectedInquiry.status === "Pending" && <Button variant="secondary" className="w-full" onClick={() => { const id = selectedInquiry.inquiryId; setSelectedInquiry(null); onStartCosting(id); }}>Convert to job</Button>}
          </div>
        </>}
      </SheetContent>
    </Sheet>
      { open && (
        <Modal title={editingId ? "Edit inquiry" : "Add new inquiry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update entry" : "Save entry"} isSubmitting={isSubmitting}>
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
      )}
  </div>;
}

// ── expenses ────────────────────────────────────────────────────────────────
function ExpensesView({ expenses, onAdd, onUpdate, onDelete }: { expenses: Expense[]; onAdd: (e: Expense) => void; onUpdate: (e: Expense) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ expDate: "", category: "", description: "", amount: "" });
  const resetForm = () => setForm({ expDate: todayISO(), category: "", description: "", amount: "" });
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
      <ExpensesLedger expenses={expenses} onAdd={() => { resetForm(); setEditingId(null); setOpen(true); }} onEdit={entry => { setEditingId(entry.expenseId); setForm({ expDate: entry.expDate, category: entry.category, description: entry.description, amount: String(entry.amount) }); setOpen(true); }} onDelete={onDelete} />
      {open && (
        <Modal title={editingId ? "Edit expense entry" : "Add expense entry"} onClose={closeModal} onSubmit={submit} submitLabel={editingId ? "Update entry" : "Save entry"} isSubmitting={isSubmitting}>
          <div className="grid grid-cols-2 gap-4">
            <FF label="Date"><input type="date" max={todayISO()} className={ic} value={form.expDate} onChange={e => setForm(f => ({ ...f, expDate: e.target.value }))} required /></FF>
            <FF label="Category">
              <select className={ic} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required>
                <option value="">Select category</option>{[...new Set([...expenseCategories, "Rent", "Staff Salary", "Utilities", ...(form.category ? [form.category] : [])])].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FF>
            <div className="col-span-2"><FF label="Description"><input className={ic} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the expense" required /></FF></div>
            <FF label="Amount"><div className="money-input"><span aria-hidden="true">₱</span><input type="number" min="0.01" step="0.01" className={`${ic} pl-8`} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required /></div></FF>
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

function ProfitAnalysisView({ sales, jobCosts, expenses }: { sales: Sale[]; jobCosts: JobCost[]; expenses: Expense[] }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const invalidRange = !!startDate && !!endDate && startDate > endDate;
  const inSelectedPeriod = (date: string) => (!startDate || date.slice(0, 10) >= startDate) && (!endDate || date.slice(0, 10) <= endDate);
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
  const dates = [...selectedSales.map(sale => sale.date), ...selectedExpenses.map(expense => expense.expDate)].sort();
  const firstMonth = (startDate || dates[0] || todayISO()).slice(0, 7);
  const lastMonth = (endDate || dates[dates.length - 1] || todayISO()).slice(0, 7);
  const [firstYear, firstNumber] = firstMonth.split("-").map(Number);
  const [lastYear, lastNumber] = lastMonth.split("-").map(Number);
  const chartData = Array.from({ length: Math.max(0, (lastYear - firstYear) * 12 + lastNumber - firstNumber + 1) }, (_, offset) => {
    const date = new Date(firstYear, firstNumber - 1 + offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const revenue = selectedSales.filter(s => s.date.startsWith(key)).reduce((sum, s) => sum + s.price, 0);
    const cost = selectedJobCosts.filter(j => salesByInvoice.get(j.invoiceId)?.date.startsWith(key)).reduce((sum, j) => sum + j.totalCost, 0);
    return { month: date.toLocaleDateString("en-PH", { month: "short", year: "numeric" }), revenue, cost };
  });
  const comparisonTotals = [
    { label: "Revenue", value: totalRevenue, color: "var(--primary)" },
    { label: "Cost", value: totalCost, color: "var(--chart-2)" },
    { label: "Expenses", value: totalExp, color: "var(--chart-4)" },
  ];
  const comparisonMax = Math.max(1, ...comparisonTotals.map(item => Math.abs(item.value)));
  const rangeLabel = startDate || endDate ? `${startDate ? fmtDate(startDate) : "Beginning"} – ${endDate ? fmtDate(endDate) : "Present"}` : "All dates";

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
            <div><h2 className="text-sm font-medium">Monthly revenue vs. cost</h2><p className="mt-1 text-xs text-muted-foreground">{rangeLabel}</p></div>
            <div className="expense-filters">
              <DateRangePicker startDate={startDate} endDate={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); }} label="Report date range" />
              {(startDate || endDate) && <Button variant="ghost" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear filters</Button>}
              {invalidRange && <p role="alert" className="text-sm text-danger">The end date must be on or after the start date.</p>}
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
function ApprovalQueueView({ onResolved }: { onResolved: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => apiFetch(BASE_URL + "/approvals").then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Approval requests could not be loaded.");
    setRows(asRows(data)); setError("");
  }).catch(err => setError(err instanceof Error ? err.message : "Approval requests could not be loaded."));
  useEffect(() => { void load(); }, []);
  const relativeTime = (value: string) => {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };
  const undo = async (row: any) => {
    try {
      const response = await apiFetch(`${BASE_URL}/approvals/${encodeURIComponent(row.requestId)}/undo`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The approval could not be undone.");
      notify(data.message ?? "Approval undone."); await load(); onResolved();
    } catch (err) { notify(err instanceof Error ? err.message : "The approval could not be undone."); }
  };
  const resolve = async (row: any, action: "approve" | "reject", note = "") => {
    try {
      const response = await apiFetch(BASE_URL + "/approvals/" + encodeURIComponent(row.requestId) + "/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Approval could not be completed.");
      if (action === "approve") notify({ message: data.message ?? "Change approved.", actionLabel: "Undo", onAction: () => { void undo(data.request ?? row); } });
      else notify(data.message ?? "Change rejected.");
      await load();
      onResolved();
    } catch (err) { alert(err instanceof Error ? err.message : "Approval could not be completed."); }
  };
  const counts = { PENDING: rows.filter(row => row.status === "PENDING").length, APPROVED: rows.filter(row => row.status === "APPROVED").length, REJECTED: rows.filter(row => row.status === "REJECTED").length };
  const visibleRows = rows.filter(row => row.status === activeTab);
  const pendingVisible = visibleRows.filter(row => row.status === "PENDING");
  const toggleSelection = (requestId: string) => setSelected(current => { const next = new Set(current); next.has(requestId) ? next.delete(requestId) : next.add(requestId); return next; });
  const approveSelected = async () => {
    const targets = pendingVisible.filter(row => selected.has(row.requestId));
    if (!targets.length) return;
    setBusy(true);
    let completed = 0;
    for (const row of targets) { try { await resolve(row, "approve"); completed++; } catch { /* individual errors are toasted */ } }
    setSelected(new Set()); setBusy(false);
    if (completed > 1) notify(`${completed} requests approved.`);
  };
  return <div className="space-y-4">
    <PageHeader title="Approvals" description="Staff edits and archive requests leave records unchanged until approved." action={<Button variant="secondary" onClick={load}>Refresh</Button>} />
    {error && <p className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
      <div role="tablist" aria-label="Approval status" className="flex gap-1">{(["PENDING", "APPROVED", "REJECTED"] as const).map(status => <button key={status} role="tab" aria-selected={activeTab === status} onClick={() => { setActiveTab(status); setSelected(new Set()); }} className={`approval-tab ${activeTab === status ? "approval-tab-active" : ""}`}>{sentenceCase(status)} <span>{counts[status]}</span></button>)}</div>
      {activeTab === "PENDING" && <Button variant="secondary" disabled={!selected.size || busy} onClick={() => void approveSelected}>Approve selected{selected.size ? ` (${selected.size})` : ""}</Button>}
    </div>
    {!visibleRows.length && !error && <div className="rounded-xl border border-border bg-card p-10 text-center"><p className="text-base font-medium">All caught up</p><p className="mt-1 text-sm text-muted-foreground">There are no {sentenceCase(activeTab).toLowerCase()} approval requests.</p></div>}
    {visibleRows.map(row => {
      const requester = row.requester?.empName ?? row.requester?.empRole ?? "Staff";
      const changes = approvalChanges(row.beforeData, row.proposedData);
      return <article key={row.requestId} className="rounded-xl border border-border bg-card p-5 approval-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            {row.status === "PENDING" && <input aria-label={`Select ${row.entityId}`} type="checkbox" checked={selected.has(row.requestId)} onChange={() => toggleSelection(row.requestId)} className="mt-1" />}
            <div><div className="flex flex-wrap items-center gap-2"><Badge variant={row.action === "DELETE" ? "danger" : "neutral"}>{sentenceCase(row.action)}</Badge><a href={`#record-${encodeURIComponent(row.entityId)}`} className="font-medium text-primary-text underline underline-offset-2">{sentenceCase(String(row.entityType))} · {row.entityId}</a><Badge status={row.status}>{sentenceCase(row.status)}</Badge></div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span className="approval-avatar" aria-hidden="true">{requester.slice(0, 1).toUpperCase()}</span><span>{requester}</span><span aria-hidden="true">·</span><time dateTime={row.createdAt} title={new Date(row.createdAt).toLocaleString("en-PH")}>{relativeTime(row.createdAt)}</time></div></div>
          </div>
          {row.status === "PENDING" && <div className="flex gap-2"><Button variant="secondary" type="button" onClick={() => { setRejecting(row); setRejectReason(""); }} className="text-sm">Reject</Button><Button variant="primary" type="button" onClick={() => void resolve(row, "approve")} className="text-sm">Approve</Button></div>}
        </div>
        {row.action === "UPDATE" && <div className="mt-4 overflow-x-auto rounded-lg border border-border"><table className="approval-diff"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>{changes.length ? changes.map(change => <tr key={change.key}><th scope="row">{change.label}</th><td className="approval-before">{approvalValue(change.initialValue, change.key)}</td><td className="approval-after">{approvalValue(change.editedValue, change.key)}</td></tr>) : <tr><td colSpan={3} className="text-muted-foreground">No value changes were detected.</td></tr>}</tbody></table></div>}
      </article>
    })}
    {rejecting && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reject-title"><div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"><h2 id="reject-title" className="text-base font-semibold">Reject request</h2><label className="mt-4 block text-sm text-muted-foreground" htmlFor="reject-reason">Reason <span className="text-xs">(optional)</span></label><textarea id="reject-reason" value={rejectReason} onChange={event => setRejectReason(event.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm" placeholder="Explain why this request was rejected" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" onClick={() => { void resolve(rejecting, "reject", rejectReason); setRejecting(null); }}>Reject</Button></div></div></div>}
  </div>;
}

function AuditLogsView() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [userFilter, setUserFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [recordFilter, setRecordFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAuthEvents, setShowAuthEvents] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const load = () => apiFetch(BASE_URL + "/audit-logs?limit=200").then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Audit logs could not be loaded.");
    setRows(asRows(data)); setError("");
  }).catch(err => setError(err instanceof Error ? err.message : "Audit logs could not be loaded."));
  useEffect(() => { void load(); }, []);
  const actionLabel = (action: string) => ({ POST: "Created", PUT: "Updated", PATCH: "Updated", DELETE: "Deleted", LOGIN: "Logged in", LOGOUT: "Logged out", LOGIN_FAILED: "Login failed", POST_REQUESTED: "Creation requested", PUT_REQUESTED: "Update requested", DELETE_REQUESTED: "Deletion requested", APPROVAL_APPROVED: "Request approved", APPROVAL_REJECTED: "Request rejected", APPROVAL_UNDONE: "Approval undone" } as Record<string, string>)[action] ?? sentenceCase(action);
  const actionVariant = (action: string) => ["POST", "LOGIN", "APPROVAL_APPROVED"].includes(action) ? "success" as const : ["DELETE", "DELETE_REQUESTED", "LOGIN_FAILED", "APPROVAL_REJECTED"].includes(action) ? "danger" as const : ["POST_REQUESTED", "PUT_REQUESTED", "PATCH", "PUT"].includes(action) ? "warning" as const : "neutral" as const;
  const authEvent = (action: string) => ["LOGIN", "LOGOUT", "LOGIN_FAILED"].includes(action);
  const recordNames: Record<string, string> = { SALE: "Sale", JOB_COST: "Job", EXPENSE: "Expense", INVENTORY: "Inventory item", INQUIRY: "Inquiry", CLIENT: "Client", EMPLOYEE: "Employee", APPROVAL: "Approval" };
  const recordIcon = (type: string) => ({ SALE: Receipt, JOB_COST: BriefcaseBusiness, EXPENSE: DollarSign, INVENTORY: Package, INQUIRY: MessageSquare, CLIENT: UserRound, EMPLOYEE: UserRound, APPROVAL: ShieldCheck } as Record<string, typeof Receipt>)[type] ?? ScrollText;
  const findRecordId = (value: any, type: string, depth = 0): string | null => {
    if (!value || typeof value !== "object" || depth > 5) return null;
    const keys: Record<string, string[]> = { SALE: ["invoiceId"], JOB_COST: ["jobCostId"], EXPENSE: ["expenseId"], INVENTORY: ["referenceId"], INQUIRY: ["inquiryId"], CLIENT: ["clientId"], EMPLOYEE: ["empId"] };
    for (const key of keys[type] ?? []) if (typeof value[key] === "string" && value[key]) return value[key];
    for (const child of Object.values(value)) { const found = findRecordId(child, type, depth + 1); if (found) return found; }
    return null;
  };
  const relativeTime = (value: string) => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (!Number.isFinite(seconds)) return "—";
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return fmtDate(value.slice(0, 10));
  };
  const users = [...new Set(rows.map(row => String(row.actorName ?? "Unknown user")))].sort();
  const roles = [...new Set(rows.map(row => String(row.actorRole ?? "Unknown")))].sort();
  const actions = [...new Set(rows.map(row => actionLabel(String(row.action ?? ""))))].sort();
  const recordTypes = [...new Set(rows.map(row => String(row.entityType ?? "Other")))].sort();
  const filtered = rows.filter(row => {
    const action = String(row.action ?? "");
    const date = String(row.createdAt ?? "").slice(0, 10);
    return (showAuthEvents || !authEvent(action)) && (userFilter === "All" || row.actorName === userFilter) && (roleFilter === "All" || row.actorRole === roleFilter) && (actionFilter === "All" || actionLabel(action) === actionFilter) && (recordFilter === "All" || (row.entityType ?? "Other") === recordFilter) && (!startDate || date >= startDate) && (!endDate || date <= endDate);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const toggleExpanded = (id: string) => setExpanded(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const renderDiff = (row: any) => {
    const details = row.details && typeof row.details === "object" ? row.details : {};
    const before = details.before && typeof details.before === "object" ? details.before : {};
    const after = details.after && typeof details.after === "object" ? details.after : details.body && typeof details.body === "object" ? details.body : {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]) && !["id", "createdAt", "updatedAt", "deletedAt"].includes(key));
    return <div className="mt-2 overflow-x-auto rounded-lg border border-border"><table className="w-full text-xs"><thead><tr><th className={thc}>Field</th><th className={thc}>Before</th><th className={thc}>After</th></tr></thead><tbody>
      {keys.map(key => <tr key={key} className="border-t border-border"><th scope="row" className="px-3 py-2 text-left font-medium">{approvalFieldLabel(key)}</th><td className="px-3 py-2 text-danger">{approvalValue(before[key], key)}</td><td className="px-3 py-2 text-success">{approvalValue(after[key], key)}</td></tr>)}
      {!keys.length && <tr><td colSpan={3} className="px-3 py-4 text-muted-foreground">{details.before === undefined ? "No previous values were recorded for this event." : "No field changes were recorded."}</td></tr>}
    </tbody></table></div>;
  };
  return <div className="space-y-4">
    <PageHeader title="Audit logs" description="Recent sign-ins, changes, archive requests, and Admin decisions." action={<Button variant="secondary" onClick={load}>Refresh</Button>} />
    {error && <p className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{error}</p>}
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      <select className={ic + " w-auto"} aria-label="Filter by user" value={userFilter} onChange={event => { setUserFilter(event.target.value); setPage(1); }}><option>All</option>{users.map(user => <option key={user}>{user}</option>)}</select>
      <select className={ic + " w-auto"} aria-label="Filter by role" value={roleFilter} onChange={event => { setRoleFilter(event.target.value); setPage(1); }}><option>All</option>{roles.map(role => <option key={role}>{role}</option>)}</select>
      <select className={ic + " w-auto"} aria-label="Filter by action type" value={actionFilter} onChange={event => { setActionFilter(event.target.value); setPage(1); }}><option>All</option>{actions.map(action => <option key={action}>{action}</option>)}</select>
      <select className={ic + " w-auto"} aria-label="Filter by record type" value={recordFilter} onChange={event => { setRecordFilter(event.target.value); setPage(1); }}><option>All</option>{recordTypes.map(type => <option key={type} value={type}>{recordNames[type] ?? sentenceCase(type)}</option>)}</select>
      <DateRangePicker startDate={startDate} endDate={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); setPage(1); }} label="Audit date range" />
      <label className="ml-auto inline-flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showAuthEvents} onChange={event => { setShowAuthEvents(event.target.checked); setPage(1); }} />Show auth events</label>
    </div>
    <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[850px] text-xs font-sans"><thead className="sticky top-0 z-10"><tr>{["When", "User", "Role", "Action", "Record"].map(label => <th key={label} className={thc}>{label}</th>)}</tr></thead><tbody>
      {visible.map(row => {
        const action = String(row.action ?? "");
        const type = String(row.entityType ?? "");
        const Icon = recordIcon(type);
        const recordId = row.entityId ?? findRecordId(row.details?.after, type) ?? findRecordId(row.details?.body, type);
        const expandedRow = expanded.has(row.logId);
        return <Fragment key={row.logId}><TRow onClick={() => toggleExpanded(row.logId)}>
          <td className={tdc} title={new Date(row.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "medium" })}>{relativeTime(row.createdAt)}<span className="ml-2 text-muted-foreground">{fmtDate(String(row.createdAt).slice(0, 10))}</span></td>
          <td className={tdc + " font-medium"}>{row.actorName || "Unknown user"}</td><td className={tdc}><Badge variant="neutral" status={sentenceCase(String(row.actorRole ?? "Unknown"))} /></td>
          <td className={tdc}><Badge variant={actionVariant(action)} status={actionLabel(action)} /></td>
          <td className={tdc}><button type="button" aria-expanded={expandedRow} onClick={event => { event.stopPropagation(); toggleExpanded(row.logId); }} className="inline-flex items-center gap-2 text-primary hover:underline"><Icon size={14} aria-hidden="true" />{recordNames[type] ?? (type ? sentenceCase(type) : "System event")} {recordId ?? "—"}</button></td>
        </TRow>{expandedRow && <tr className="bg-muted/20"><td colSpan={5} className="px-4 pb-4"><div className="text-xs text-muted-foreground">{row.details?.path ?? "System event"}{row.details?.statusCode ? ` · HTTP ${row.details.statusCode}` : ""}</div>{renderDiff(row)}</td></tr>}</Fragment>;
      })}
      {!visible.length && !error && <EmptyRow cols={5} />}
    </tbody></table></div>
    <div className="expense-pagination"><p>{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} events` : "0 events"}</p><label>Rows per page <select aria-label="Audit rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label><Button variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage} of {pages}</span><Button variant="secondary" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
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
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [goldLoading, setGoldLoading] = useState(true);
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
    setDataLoading(true); setDataError("");
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
        else setDataError("Dashboard data could not be loaded.");
      }).finally(() => { if (active) setDataLoading(false); });
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
      finally { if (active) setGoldLoading(false); }
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

          {tab === "PROFIT_ANALYSIS" && <PageHeader title="Reports" description="Understand revenue, costs, and profitability over time." action={<Button variant="secondary" onClick={() => setReloadKey(k => k + 1)}>Refresh report</Button>} />}
        {tab === "DASHBOARD" && <Dashboard sales={sales} jobCosts={jobCosts} expenses={expenses} loading={dataLoading} error={dataError} isAdmin={isAdmin} goldRate={goldRate} goldStock={goldStock} goldLoading={goldLoading} goldStale={goldInfo?.stale ?? true} loadApprovals={loadDashboardApprovals} onJobs={() => setTab("JOB_COSTING")} onApprovals={() => setTab("APPROVALS")} onRetry={() => setReloadKey(k => k + 1)} onView={(title, record) => setViewRecord({ title, record })} />}
        {tab === "DAILY_SALES" && <DailySalesView sales={sales.filter(isCompletedSale)} jobCosts={jobCosts} onJobs={() => setTab("JOB_COSTING")} onUpdate={s => setSales(p => p.map(item => item.invoiceId === s.invoiceId ? s : s.clientId && item.clientId === s.clientId ? { ...item, email: s.email } : item))} onDelete={id => deleteFromApi("sales", id, () => { const removed = sales.find(item => item.invoiceId === id); const linkedJob = jobCosts.find(item => item.jobCostId === removed?.jobCostId); setSales(p => p.filter(item => item.invoiceId !== id)); if (removed?.jobCostId) setJobCosts(p => p.filter(item => item.jobCostId !== removed.jobCostId)); if (linkedJob?.inquiryId) setInquiries(p => p.map(i => i.inquiryId === linkedJob.inquiryId ? { ...i, status: "Pending" } : i)); })} />}
        {tab === "JOB_COSTING" && <JobCostingView jobCosts={jobCosts} inquiries={inquiries} inventory={inventory} selectedInquiryId={selectedInquiryForCosting} clearSelectedInquiry={() => setSelectedInquiryForCosting(null)} onAdd={j => { setJobCosts(p => [j, ...p]); if (j.sale) setSales(p => [j.sale!, ...p.filter(s => s.invoiceId !== j.sale!.invoiceId)]); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Approved" } : i)); }} onUpdate={j => { setJobCosts(p => p.map(item => item.jobCostId === j.jobCostId ? j : item)); if (j.sale) setSales(p => p.map(s => s.invoiceId === j.sale!.invoiceId ? j.sale! : s)); }} onDelete={j => deleteFromApi("job-cost", j.jobCostId, () => { setJobCosts(p => p.filter(item => item.jobCostId !== j.jobCostId)); setSales(p => p.filter(s => s.invoiceId !== j.invoiceId)); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Pending" } : i)); })} onApprove={async j => { try { const response = await apiFetch(`${BASE_URL}/job-cost/${encodeURIComponent(j.jobCostId)}/approve`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Costing could not be approved."); setReloadKey(k => k + 1); } catch (error) { alert(error instanceof Error ? error.message : "Costing could not be approved."); } }} onReady={async j => { try { const response = await apiFetch(`${BASE_URL}/job-cost/${encodeURIComponent(j.jobCostId)}/ready`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Item could not be marked ready."); const reason = data.notification?.sent ? (data.notification.reason ?? "Customer notification sent.") : (data.notification?.reason ?? "Customer notification could not be sent."); alert(`Marked ready for pickup. ${reason}`); setReloadKey(k => k + 1); } catch (error) { alert(error instanceof Error ? error.message : "Item could not be marked ready."); } }} onFinish={async (j, materials) => { try { const response = await apiFetch(`${BASE_URL}/sales/${encodeURIComponent(j.invoiceId)}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: j.invoiceId, clientName: j.clientName, materials }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Sale could not be finished."); const sale = normalizeSale(data); setSales(p => [sale, ...p.filter(item => item.invoiceId !== sale.invoiceId)]); setJobCosts(p => p.map(item => item.jobCostId === j.jobCostId ? { ...item, status: "Finished", sale } : item)); setInquiries(p => p.map(i => i.inquiryId === j.inquiryId ? { ...i, status: "Finished" } : i)); alert("Sale completed. Confirm receipt sending from Daily Sales when ready."); } catch (error) { alert(error instanceof Error ? error.message : "Sale could not be finished."); } }} />}
        {tab === "INVENTORY" && <GoldInventoryView inventory={inventory} goldRate={goldRate} onAdd={e => { setInventory(p => [...p, e]); setReloadKey(k => k + 1); }} onUpdate={e => { setInventory(p => p.map(item => item.id === e.id ? e : item)); setReloadKey(k => k + 1); }} onDelete={id => deleteFromApi("inventory", id, () => { setInventory(p => p.filter(item => item.id !== id)); setReloadKey(k => k + 1); })} />}
        {tab === "INQUIRIES" && <InquiriesView inquiries={inquiries} onAdd={i => setInquiries(p => [i, ...p])} onUpdate={i => setInquiries(p => p.map(item => item.inquiryId === i.inquiryId ? i : item))} onDelete={id => deleteFromApi("inquiries", id, () => setInquiries(p => p.filter(item => item.inquiryId !== id)))} onStartCosting={id => { setSelectedInquiryForCosting(id); setTab("JOB_COSTING"); }} />}
        {tab === "EXPENSES" && <ExpensesView expenses={expenses} onAdd={e => setExpenses(p => [e, ...p])} onUpdate={e => setExpenses(p => p.map(item => item.expenseId === e.expenseId ? e : item))} onDelete={id => deleteFromApi("expenses", id, () => setExpenses(p => p.filter(item => item.expenseId !== id)))} />}
        {tab === "PROFIT_ANALYSIS" && <ProfitAnalysisView sales={sales.filter(isCompletedSale)} jobCosts={jobCosts} expenses={expenses} />}
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
