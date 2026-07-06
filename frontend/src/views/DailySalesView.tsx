import { useState, useMemo } from "react";
import type { Sale, ServiceType, SaleStatus } from "../types";
import { php, fmtDate } from "../lib/formatters";
import { BASE_URL, thc, tdc, tdr, ic } from "../lib/constants";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Modal } from "../components/ui/Modal";
import { FormField } from "../components/ui/FormField";
import { SearchBar } from "../components/ui/SearchBar";
import { AddBtn } from "../components/ui/AddBtn";
import { TableWrap, TRow, EmptyRow } from "../components/ui/Table";

export function DailySalesView({ sales, onAdd }: { sales: Sale[]; onAdd: (s: Sale) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoiceId:"", date:"", clientName:"", contactNum:"",
    serviceType:"Custom" as ServiceType, price:"", downpayment:"", status:"Ongoing" as SaleStatus });

  // ✅ Wrapped in useMemo to prevent unnecessary filtering on every keystroke/render
  const filtered = useMemo(() => {
    return sales.filter((s) =>
      [s.invoiceId, s.serviceType, s.status].some((field) =>
        String(field || "").toLowerCase().includes((q || "").toLowerCase())
      )
    );
  }, [sales, q]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(form.price) || 0;
    const dp = parseFloat(form.downpayment) || 0;
    const entry: Sale = { id:String(Date.now()), invoiceId:form.invoiceId, date:form.date,
      clientName:form.clientName, contactNum:form.contactNum, serviceType:form.serviceType,
      price, downpayment:dp, balance:price-dp, status:form.status };
    try {
      await fetch(`${BASE_URL}/sales`, { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ invoiceId:entry.invoiceId, serviceType:entry.serviceType, price:entry.price,
          status:entry.status, downpayment:entry.downpayment, clientName:entry.clientName,
          contactNum:entry.contactNum, balance:entry.balance }) });
    } catch (_) {}
    onAdd(entry);
    setOpen(false);
    setForm({ invoiceId:"", date:"", clientName:"", contactNum:"", serviceType:"Custom", price:"", downpayment:"", status:"Ongoing" });
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search client, invoice, type…" />
        <AddBtn onClick={() => setOpen(true)} label="Add New Sale" />
      </div>
      <TableWrap>
        <thead><tr>
          {["Date","Invoice #","Client Name","Contact","Type","Total Price","Downpayment","Balance","Status"].map(h=><th key={h} className={thc}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map((s, index) => {
            // ✅ Safely parse backend database values into numbers before formatting
            const priceNum = Number(s.price) || 0;
            const downpaymentNum = Number(s.downpayment) || 0;
            const balanceNum = Number(s.balance) || 0;

            return (
              <TRow key={`${s.invoiceId || 'no-id'}-${index}`}>
                <td className={tdc}>{fmtDate(s.date)}</td>
                <td className={tdc + " text-primary/80 dark:text-amber-400/80"}>{s.invoiceId}</td>
                <td className={tdc + " font-sans font-medium"}>{s.clientName}</td>
                <td className={tdc + " text-muted-foreground"}>{s.contactNum}</td>
                <td className={tdc}>{s.serviceType}</td>
                
                {/* ✅ Passing safe, pure numbers directly to the formatter */}
                <td className={tdr}>{php(priceNum)}</td>
                <td className={tdr + " text-emerald-700 dark:text-emerald-400"}>{php(downpaymentNum)}</td>
                <td className={tdr + " text-amber-700 dark:text-amber-400"}>{php(balanceNum)}</td>
                
                <td className={tdc}><StatusBadge status={s.status} /></td>
              </TRow>
            );
          })}
          {!filtered.length && <EmptyRow cols={9} />}
        </tbody>
      </TableWrap>
      {open && (
        <Modal title="Add New Sale Entry" onClose={() => setOpen(false)} onSubmit={submit}>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Invoice #"><input className={ic} value={form.invoiceId} onChange={e=>setForm(f=>({...f,invoiceId:e.target.value}))} placeholder="INV-2026-xxx" required /></FormField>
            <FormField label="Date"><input type="date" className={ic} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required /></FormField>
            <FormField label="Client Name"><input className={ic} value={form.clientName} onChange={e=>setForm(f=>({...f,clientName:e.target.value}))} placeholder="Full name" required /></FormField>
            <FormField label="Contact #"><input className={ic} value={form.contactNum} onChange={e=>setForm(f=>({...f,contactNum:e.target.value}))} placeholder="09XX-XXX-XXXX" /></FormField>
            <FormField label="Service Type">
              <select className={ic} value={form.serviceType} onChange={e=>setForm(f=>({...f,serviceType:e.target.value as ServiceType}))}>
                {(["Custom","Repair","Resize","Cleaning"] as ServiceType[]).map(t=><option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select className={ic} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as SaleStatus}))}>
                {(["Ongoing","Paid","Released"] as SaleStatus[]).map(t=><option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Total Price (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="0.00" required /></FormField>
            <FormField label="Downpayment (₱)"><input type="number" min="0" step="0.01" className={ic} value={form.downpayment} onChange={e=>setForm(f=>({...f,downpayment:e.target.value}))} placeholder="0.00" /></FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}