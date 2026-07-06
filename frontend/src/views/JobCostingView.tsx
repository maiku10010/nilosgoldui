import { useState, useMemo } from "react";
import type { JobCost } from "../types";
import { php, pct } from "../lib/formatters";
import { BASE_URL, GOLD_PRICE, thc, tdc, tdr, ic } from "../lib/constants";
import { MarginBadge } from "../components/ui/MarginBadge";
import { Modal } from "../components/ui/Modal";
import { FormField } from "../components/ui/FormField";
import { SearchBar } from "../components/ui/SearchBar";
import { AddBtn } from "../components/ui/AddBtn";
import { TableWrap, TRow, EmptyRow } from "../components/ui/Table";

export function JobCostingView({ jobCosts, onAdd }: { jobCosts: JobCost[]; onAdd: (j: JobCost) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoiceId: "", clientName: "", empId: "", goldUsed: "", stoneCost: "", laborCost: "", sellingPrice: "" });

  const filtered = useMemo(() => jobCosts.filter(j =>
    [j.invoiceId, j.clientName, j.jobCostId].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [jobCosts, q]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      jobCostId: "JC-" + String(Date.now()).slice(-4), invoiceId: form.invoiceId,
      clientName: form.clientName, empId: form.empId, goldUsed, goldCostPerG,
      goldCost, stoneCost, laborCost, totalCost, sellingPrice, profit, marginPct,
    };
    try {
      await fetch(`${BASE_URL}/job-cost`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobCostId: entry.jobCostId, goldUsed: entry.goldUsed,
          laborCost: entry.laborCost, invoiceId: entry.invoiceId, empId: entry.empId
        })
      });
    } catch (_) { }
    onAdd(entry);
    setOpen(false);
    setForm({ invoiceId: "", clientName: "", empId: "", goldUsed: "", stoneCost: "", laborCost: "", sellingPrice: "" });
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search invoice, client…" />
        <AddBtn onClick={() => setOpen(true)} label="Add Job Cost" />
      </div>
      <TableWrap>
        <thead><tr>
          {["Job Cost ID", "Invoice #", "Client", "Gold (g)", "Gold Cost/g", "Gold Cost", "Stone Cost", "Labor Cost", "Total Cost", "Selling Price", "Profit", "Margin %"].map(h => <th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map((j, index) => {
            // 1. Defensively convert all Prisma Decimal strings into standard JavaScript numbers
            const goldUsed = Number(j.goldUsed) || 0;
            const goldCostPerG = Number(j.goldCostPerG) || 0;
            const goldCost = Number(j.goldCost) || 0;
            const stoneCost = Number(j.stoneCost) || 0;
            const laborCost = Number(j.laborCost) || 0;
            const totalCost = Number(j.totalCost) || 0;
            const sellingPrice = Number(j.sellingPrice) || 0;
            const profit = Number(j.profit) || 0;
            const marginPct = Number(j.marginPct) || 0;

            return (
              // 2. Bulletproof the list rendering key
              <TRow key={`${j.jobCostId || 'jc'}-${index}`}>
                <td className={tdc + " text-muted-foreground"}>{j.jobCostId}</td>
                <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{j.invoiceId}</td>
                <td className={tdc + " font-sans font-medium"}>{j.clientName}</td>

                {/* ✅ Hand safe, pure numbers to all your formatters */}
                <td className={tdr}>{goldUsed.toFixed(2)}</td>
                <td className={tdr}>{php(goldCostPerG)}</td>
                <td className={tdr}>{php(goldCost)}</td>
                <td className={tdr}>{php(stoneCost)}</td>
                <td className={tdr}>{php(laborCost)}</td>
                <td className={tdr + " text-red-700 dark:text-red-400"}>{php(totalCost)}</td>
                <td className={tdr + " text-amber-700 dark:text-amber-300"}>{php(sellingPrice)}</td>
                <td className={tdr + " text-emerald-700 dark:text-emerald-400 font-semibold"}>{php(profit)}</td>
                <td className={tdr}><MarginBadge margin={marginPct} /></td>
              </TRow>
            );
          })}
          {/* ✅ Ensure the empty placeholder checks your true filter state too */}
          {!filtered.length && <EmptyRow cols={12} />}
        </tbody>
      </TableWrap>
      {open && (
        <Modal title="Add Job Cost Entry" onClose={() => setOpen(false)} onSubmit={submit}>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Invoice #"><input className={ic} value={form.invoiceId} onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value }))} placeholder="INV-2026-xxx" required /></FormField>
            <FormField label="Client Name"><input className={ic} value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Full name" required /></FormField>
            <FormField label="Employee ID (opt.)"><input className={ic} value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} placeholder="EMP-xxx" /></FormField>
            <FormField label="Gold Used (g)"><input type="number" min="0" step="0.01" className={ic} value={form.goldUsed} onChange={e => setForm(f => ({ ...f, goldUsed: e.target.value }))} placeholder="0.00" /></FormField>
            <FormField label={`Gold Cost/g (auto ₱${GOLD_PRICE.toLocaleString()})`}>
              <input className={ic + " opacity-60 cursor-not-allowed"} value={`₱${GOLD_PRICE.toLocaleString()}`} readOnly />
            </FormField>
            <FormField label="Stone Cost (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.stoneCost} onChange={e => setForm(f => ({ ...f, stoneCost: e.target.value }))} placeholder="0.00" /></FormField>
            <FormField label="Labor Cost (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.laborCost} onChange={e => setForm(f => ({ ...f, laborCost: e.target.value }))} placeholder="0.00" /></FormField>
            <FormField label="Selling Price (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} placeholder="0.00" required /></FormField>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">Profit and margin % are auto-calculated on save.</p>
        </Modal>
      )}
    </div>
  );
}
