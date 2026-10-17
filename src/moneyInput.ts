export function cleanMoneyInput(value: string): string | null {
  const clean = value.replace(/[₱,\s]/g, "");
  return /^\d*(?:\.\d{0,2})?$/.test(clean) ? clean : null;
}

export function formatMoneyInput(value: string): string {
  if (!value || !Number.isFinite(Number(value))) return value;
  return new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

export function salePaymentSummary(price: string, payment: string) {
  const total = Number(price);
  const paid = Number(payment);
  const valid = price.trim() !== "" && Number.isFinite(total) && total > 0 && Number.isFinite(paid) && paid >= 0;
  const paymentError = valid && paid > total ? "Payment cannot exceed the total price." : "";
  const balance = valid ? Math.round((total - paid) * 100) / 100 : 0;
  return { valid: valid && !paymentError, paymentError, balance };
}
