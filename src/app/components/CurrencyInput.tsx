import { useState, type InputHTMLAttributes } from "react";
import { cleanMoneyInput, formatMoneyInput } from "../../moneyInput";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "onBlur" | "onFocus"> & {
  value: string;
  onChange: (value: string) => void;
};

export function CurrencyInput({ value, onChange, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return <div className="money-input"><span aria-hidden="true">₱</span>
    <input {...props} type="text" inputMode="decimal" value={focused ? value : formatMoneyInput(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (value && Number.isFinite(Number(value))) onChange(Number(value).toFixed(2));
      }}
      onChange={event => { const clean = cleanMoneyInput(event.target.value); if (clean !== null) onChange(clean); }}
    />
  </div>;
}
