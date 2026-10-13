import { useId } from "react";
import { normalizeContactInput } from "../../validation";

export function ContactInput({ value, onChange, className, required = false }: {
  value: string; onChange: (value: string) => void; className?: string; required?: boolean;
}) {
  const counterId = useId();
  return <div className="space-y-1.5">
    <input type="tel" inputMode="numeric" autoComplete="tel-national" pattern="09[0-9]{9}"
      maxLength={11} required={required} className={className} value={value} aria-label="Contact number"
      placeholder="09XXXXXXXXX" aria-describedby={counterId}
      title="Enter an 11-digit Philippine mobile number starting with 09."
      onChange={event => onChange(normalizeContactInput(event.target.value))}
      onPaste={event => {
        event.preventDefault();
        const input = event.currentTarget;
        const pasted = event.clipboardData.getData("text");
        onChange(normalizeContactInput(value.slice(0, input.selectionStart ?? value.length) + pasted + value.slice(input.selectionEnd ?? value.length)));
      }} />
    <div id={counterId} className="flex justify-between gap-2 text-[10px] text-muted-foreground">
      <span>PH mobile · starts with 09</span><span className="tabular-nums" aria-live="polite">{value.length}/11</span>
    </div>
  </div>;
}
