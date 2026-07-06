import { useState, useMemo } from "react";
import type { Inquiry, InqStatus } from "../types";
import { php, fmtDate } from "../lib/formatters";
import { BASE_URL, thc, tdc, tdr, ic } from "../lib/constants";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Modal } from "../components/ui/Modal";
import { FormField } from "../components/ui/FormField";
import { SearchBar } from "../components/ui/SearchBar";
import { AddBtn } from "../components/ui/AddBtn";
import { TableWrap, TRow, EmptyRow } from "../components/ui/Table";

export function InquiriesView({ inquiries, onAdd }: { inquiries: Inquiry[]; onAdd: (i: Inquiry) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customerName:"", contactInfo:"", details:"", category:"", quotedPrice:"", status:"Pending" as InqStatus });
  
  // ✅ Guard against null/undefined fields during string operations in search
  const filtered = useMemo(() => inquiries.filter(i =>
    [(i.customerName || ""), (i.category || ""), (i.details || ""), (i.inquiryId || "")].some(v => 
      v.toLowerCase().includes(q.toLowerCase())
    )
  ), [inquiries, q]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entry: Inquiry = { inquiryId:"INQ-"+String(Date.now()).slice(-4),
      date:new Date().toISOString().slice(0,10), customerName:form.customerName,
      contactInfo:form.contactInfo, details:form.details, category:form.category,
      quotedPrice:parseFloat(form.quotedPrice)||0, status:form.status };
    try {
      await fetch(`${BASE_URL}/inquiries`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ inquiryId:entry.inquiryId, customerName:entry.customerName,
          contactInfo:entry.contactInfo, details:entry.details, category:entry.category,
          quotedPrice:entry.quotedPrice, status:entry.status }) });
    } catch (_) {}
    onAdd(entry);
    setOpen(false);
    setForm({ customerName:"", contactInfo:"", details:"", category:"", quotedPrice:"", status:"Pending" });
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search client, category…" />
        <AddBtn onClick={() => setOpen(true)} label="Add Inquiry" />
      </div>
      <TableWrap>
        <thead><tr>
          {["Date","Inquiry ID","Client Name","Contact","Category","Details","Quoted Price","Status"].map(h=><th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map((i, index) => {
            // ✅ Coerce the price safely into a standard JavaScript number
            const priceNum = Number(i.quotedPrice) || 0;

            return (
              // ✅ Combine the ID with loop index to ensure a unique key prop
              <TRow key={`${i.inquiryId || 'inq'}-${index}`}>
                <td className={tdc}>{fmtDate(i.date)}</td>
                <td className={tdc + " text-muted-foreground"}>{i.inquiryId}</td>
                <td className={tdc + " font-sans font-medium"}>{i.customerName}</td>
                <td className={tdc + " text-muted-foreground"}>{i.contactInfo}</td>
                <td className={tdc}>{i.category}</td>
                <td className={tdc + " font-sans max-w-[200px] truncate text-muted-foreground"}>{i.details}</td>
                
                {/* ✅ Hand safe numeric primitive to the currency formatter */}
                <td className={tdr + " text-amber-700 dark:text-amber-300"}>{php(priceNum)}</td>
                <td className={tdc}><StatusBadge status={i.status} /></td>
              </TRow>
            );
          })}
          {!filtered.length && <EmptyRow cols={8} />}
        </tbody>
      </TableWrap>
      {open && (
        <Modal title="Add New Inquiry" onClose={() => setOpen(false)} onSubmit={submit}>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Customer Name"><input className={ic} value={form.customerName} onChange={e=>setForm(f=>({...f,customerName:e.target.value}))} placeholder="Full name" required /></FormField>
            <FormField label="Contact Info"><input className={ic} value={form.contactInfo} onChange={e=>setForm(f=>({...f,contactInfo:e.target.value}))} placeholder="09XX-XXX-XXXX" /></FormField>
            <FormField label="Product Category"><input className={ic} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Custom Ring" required /></FormField>
            <FormField label="Quoted Price (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.quotedPrice} onChange={e=>setForm(f=>({...f,quotedPrice:e.target.value}))} placeholder="0.00" /></FormField>
            <div className="col-span-2"><FormField label="Details / Notes"><textarea className={ic + " h-20 resize-none"} value={form.details} onChange={e=>setForm(f=>({...f,details:e.target.value}))} placeholder="Describe the customer's request…" /></FormField></div>
            <FormField label="Status">
              <select className={ic} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as InqStatus}))}>
                {(["Pending","Yes","No"] as InqStatus[]).map(t=><option key={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}