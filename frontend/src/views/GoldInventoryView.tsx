import { useState, useMemo } from "react";
import { Package } from "lucide-react";
import type { InvEntry } from "../types";
import { php, fmtDate } from "../lib/formatters";
import { BASE_URL, thc, tdc, tdr, ic } from "../lib/constants";
import { Modal } from "../components/ui/Modal";
import { FormField } from "../components/ui/FormField";
import { SearchBar } from "../components/ui/SearchBar";
import { AddBtn } from "../components/ui/AddBtn";
import { TableWrap, TRow, EmptyRow } from "../components/ui/Table";

export function GoldInventoryView({ inventory, onAdd }: { inventory: InvEntry[]; onAdd: (e: InvEntry) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date:"", referenceId:"", itemName:"", goldIn:"", goldOut:"", scrap:"", unit:"grams" });
  const filtered = useMemo(() => inventory.filter(e =>
    [e.referenceId, e.itemName].some(v => v.toLowerCase().includes(q.toLowerCase()))
  ), [inventory, q]);
  const currentBalance = inventory.length > 0 ? inventory[inventory.length - 1].balance : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const goldIn = parseFloat(form.goldIn) || 0;
    const goldOut = parseFloat(form.goldOut) || 0;
    const scrap = parseFloat(form.scrap) || 0;
    const balance = Math.max(0, currentBalance + goldIn - goldOut - scrap);
    const entry: InvEntry = { id:String(Date.now()), date:form.date, referenceId:form.referenceId,
      itemName:form.itemName, goldIn, goldOut, scrap, balance, unit:form.unit };
    try {
      await fetch(`${BASE_URL}/inventory`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ referenceId:entry.referenceId, itemName:entry.itemName,
          quantity:goldIn||goldOut||scrap, unit:entry.unit }) });
    } catch (_) {}
    onAdd(entry);
    setOpen(false);
    setForm({ date:"", referenceId:"", itemName:"", goldIn:"", goldOut:"", scrap:"", unit:"grams" });
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
        <AddBtn onClick={() => setOpen(true)} label="Add Entry" />
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
            </TRow>
          ))}
          {!filtered.length && <EmptyRow cols={7} />}
        </tbody>
      </TableWrap>
      {open && (
        <Modal title="Add Inventory Entry" onClose={() => setOpen(false)} onSubmit={submit}>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date"><input type="date" className={ic} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required /></FormField>
            <FormField label="Reference / Invoice"><input className={ic} value={form.referenceId} onChange={e=>setForm(f=>({...f,referenceId:e.target.value}))} placeholder="PO-xxx or INV-xxx" required /></FormField>
            <div className="col-span-2"><FormField label="Item Description"><input className={ic} value={form.itemName} onChange={e=>setForm(f=>({...f,itemName:e.target.value}))} placeholder="Describe the transaction" required /></FormField></div>
            <FormField label="Gold In (g)"><input type="number" min="0" step="0.01" className={ic} value={form.goldIn} onChange={e=>setForm(f=>({...f,goldIn:e.target.value}))} placeholder="0.00" /></FormField>
            <FormField label="Gold Out (g)"><input type="number" min="0" step="0.01" className={ic} value={form.goldOut} onChange={e=>setForm(f=>({...f,goldOut:e.target.value}))} placeholder="0.00" /></FormField>
            <FormField label="Scrap (g)"><input type="number" min="0" step="0.01" className={ic} value={form.scrap} onChange={e=>setForm(f=>({...f,scrap:e.target.value}))} placeholder="0.00" /></FormField>
            <FormField label="Unit"><select className={ic} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}><option>grams</option><option>troy oz</option></select></FormField>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">Current balance: {currentBalance.toFixed(2)} g — new balance auto-calculated.</p>
        </Modal>
      )}
    </div>
  );
}
