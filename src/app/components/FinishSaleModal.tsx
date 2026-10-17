import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, LoaderCircle, Plus, X } from "lucide-react";
import { finishSaleMaterials, materialQuantityError } from "../../inventorySummary";
import { Button } from "./ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type Movement = Parameters<typeof finishSaleMaterials>[0][number];
type Props = {
  job: { jobCostId: string; invoiceId: string };
  inventory: Movement[];
  onClose: () => void;
  onFinish: (materials: { referenceId: string; quantity: number }[]) => Promise<void>;
};
const quantityLabel = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 6 });

export function FinishSaleModal({ job, inventory, onClose, onFinish }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitting = useRef(false);
  const listId = useId();
  const materials = useMemo(() => finishSaleMaterials(inventory), [inventory]);
  const selected = Object.entries(quantities).map(([key, quantity]) => {
    const material = materials.find(item => item.key === key);
    return { key, quantity, material, error: material ? materialQuantityError(quantity, material.available, material.unit) : "This material is no longer in stock. Remove it to continue." };
  });
  const hasErrors = selected.some(row => row.error);
  const addable = materials.filter(material => !Object.hasOwn(quantities, material.key));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || hasErrors) return;
    submitting.current = true;
    setIsSubmitting(true);
    setPickerOpen(false);
    setSubmitError("");
    try {
      await onFinish(selected.map(row => ({ referenceId: row.material!.referenceId, quantity: Number(row.quantity) })));
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Sale could not be finished. Please try again.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return <Dialog open onOpenChange={open => { if (!open && !submitting.current) onClose(); }}>
    <DialogContent className="finish-sale-dialog" onEscapeKeyDown={event => { if (submitting.current) event.preventDefault(); }} onInteractOutside={event => { if (submitting.current) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle className="text-xl">Finish sale</DialogTitle>
        <DialogDescription className="finish-sale-subtitle">{job.jobCostId}</DialogDescription>
      </DialogHeader>
      <form noValidate onSubmit={submit} aria-busy={isSubmitting}>
        <div className="finish-sale-body">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" role="combobox" aria-expanded={pickerOpen} aria-controls={listId} aria-label="Add material" disabled={isSubmitting} className="finish-material-picker">
                <Plus size={16} aria-hidden="true" /><span>Add material…</span><ChevronDown size={16} aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="finish-material-popover">
              <Command>
                <CommandInput placeholder="Search materials…" aria-label="Search materials" />
                <CommandList id={listId}>
                  <CommandEmpty>{!materials.length ? "No extra materials are in stock." : !addable.length ? "All available materials have been added." : "No materials match your search."}</CommandEmpty>
                  <CommandGroup>
                    {addable.map(material => <CommandItem key={material.key} value={material.key} keywords={[material.itemName, material.category, material.unit]} onSelect={() => {
                      setQuantities(current => ({ ...current, [material.key]: String(Math.min(1, material.available)) }));
                      setPickerOpen(false);
                      setSubmitError("");
                    }}><span className="min-w-0 flex-1">{material.itemName}</span><span className="whitespace-nowrap text-xs text-muted-foreground">{quantityLabel(material.available)} {material.unit} available</span></CommandItem>)}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {!selected.length ? <p className="finish-material-empty">No extra materials used</p> :
            <ul className="finish-material-list" aria-label="Selected materials">
              {selected.map(row => {
                const errorId = `${listId}-${encodeURIComponent(row.key)}-error`;
                const name = row.material?.itemName ?? "Unavailable material";
                return <li key={row.key} className="finish-material-row">
                  <div className="finish-material-name"><p>{name}</p><span>{row.material ? `${quantityLabel(row.material.available)} ${row.material.unit} available` : "No longer available"}</span></div>
                  <div className="finish-material-quantity" data-invalid={!!row.error}>
                    <input type="number" inputMode="decimal" min="0" max={row.material?.available} step="any" aria-label={`Quantity for ${name}`} aria-invalid={!!row.error} aria-describedby={row.error ? errorId : undefined} disabled={isSubmitting} value={row.quantity} onChange={event => {
                      const value = event.target.value;
                      setQuantities(current => ({ ...current, [row.key]: value }));
                      setSubmitError("");
                    }} />
                    <span>{row.material?.unit ?? "—"}</span>
                  </div>
                  <Button variant="ghost" size="icon" disabled={isSubmitting} title="Remove material" aria-label={`Remove ${name}`} onClick={() => setQuantities(current => { const next = { ...current }; delete next[row.key]; return next; })}><X size={16} aria-hidden="true" /></Button>
                  {row.error && <p id={errorId} className="finish-material-error" role="alert">{row.error}</p>}
                </li>;
              })}
            </ul>}
          <div className="finish-sale-summary"><p>Finishing this sale will:</p><ul>
            <li>{selected.length ? "Deduct selected materials from inventory" : "Use no extra materials from inventory"}</li>
            <li>Complete invoice <span className="tabular-nums">{job.invoiceId}</span></li>
            <li>Move the job to Finished</li>
          </ul></div>
          {submitError && <p role="alert" className="finish-material-error">{submitError}</p>}
        </div>
        <DialogFooter className="finish-sale-footer">
          <Button variant="secondary" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || hasErrors}>{isSubmitting && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{isSubmitting ? "Finishing sale…" : "Finish sale"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
