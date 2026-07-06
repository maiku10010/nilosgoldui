import { useState, useMemo } from "react";
import { TrendingDown } from "lucide-react";
import type { Expense } from "../types";
import { php, fmtDate } from "../lib/formatters";
import { BASE_URL, thc, tdc, tdr, ic } from "../lib/constants";
import { Modal } from "../components/ui/Modal";
import { FormField } from "../components/ui/FormField";
import { SearchBar } from "../components/ui/SearchBar";
import { AddBtn } from "../components/ui/AddBtn";
import { TableWrap, TRow, EmptyRow } from "../components/ui/Table";

export function ExpensesView({ expenses, onAdd }: { expenses: Expense[]; onAdd: (e: Expense) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ expDate:"", category:"Rent", description:"", amount:"" });
  
  // ✅ Guard against empty fields to keep string match filter completely safe
  const filtered = useMemo(() => expenses.filter(e =>
    [(e.category || ""), (e.description || ""), (e.expenseId || "")].some(v => 
      v.toLowerCase().includes(q.toLowerCase())
    )
  ), [expenses, q]);

  // ✅ Force type coercion inside reduce accumulation so math works on numbers, not strings
  const total = useMemo(() => filtered.reduce((a, e) => a + (Number(e.amount) || 0), 0), [filtered]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entry: Expense = { expenseId:"EXP-"+String(Date.now()).slice(-4), expDate:form.expDate,
      category:form.category, description:form.description, amount:parseFloat(form.amount)||0 };
    try {
      await fetch(`${BASE_URL}/expenses`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ expenseId:entry.expenseId, category:entry.category,
          amount:entry.amount, description:entry.description, expDate:entry.expDate }) });
    } catch (_) {}
    onAdd(entry);
    setOpen(false);
    setForm({ expDate:"", category:"Rent", description:"", amount:"" });
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
        <AddBtn onClick={() => setOpen(true)} label="Add Expense" />
      </div>
      <TableWrap>
        <thead><tr>
          {["Date","Expense ID","Category","Description","Amount"].map(h=><th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map((e, index) => {
            // ✅ Clean extraction of raw numeric strings before handing to UI cells
            const amountNum = Number(e.amount) || 0;

            return (
              // ✅ Combined array index with row id ensures unique layout mapping keys
              <TRow key={`${e.expenseId || 'exp'}-${index}`}>
                <td className={tdc}>{fmtDate(e.expDate)}</td>
                <td className={tdc + " text-muted-foreground"}>{e.expenseId}</td>
                <td className={tdc}>
                  <span className="px-2 py-0.5 rounded text-[10px] border bg-muted dark:bg-slate-800/60 border-border text-muted-foreground uppercase tracking-wide">
                    {e.category}
                  </span>
                </td>
                <td className={tdc + " font-sans text-muted-foreground max-w-[300px]"}>{e.description}</td>
                
                {/* ✅ Hand safe formatted numeric values */}
                <td className={tdr + " text-red-700 dark:text-red-400 font-semibold"}>{php(amountNum)}</td>
              </TRow>
            );
          })}
          {!filtered.length && <EmptyRow cols={5} />}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 dark:bg-slate-900/50">
            <td colSpan={4} className="px-3 py-3 text-[11px] font-mono text-muted-foreground uppercase tracking-widest text-right">Total</td>
            <td className="px-3 py-3 text-right font-bold text-red-700 dark:text-red-400 tabular-nums text-sm">{php(total)}</td>
          </tr>
        </tfoot>
      </TableWrap>
      {open && (
        <Modal title="Add Expense Entry" onClose={() => setOpen(false)} onSubmit={submit}>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date"><input type="date" className={ic} value={form.expDate} onChange={e=>setForm(f=>({...f,expDate:e.target.value}))} required /></FormField>
            <FormField label="Category">
              <select className={ic} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {["Rent","Staff Salary","Utilities","Supplies","Tax & Permits","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
            </FormField>
            <div className="col-span-2"><FormField label="Description"><input className={ic} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the expense" required /></FormField></div>
            <FormField label="Amount (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" required /></FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}