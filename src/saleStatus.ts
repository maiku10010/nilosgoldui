export function paymentStatus(price: number, paid: number) {
  if (price > 0 && paid <= 0) return 'Unpaid';
  if (Math.round((price - paid) * 100) > 0) return 'Partially paid';
  return 'Fully paid';
}

export function isSalesRecord(sale: { status: string; jobStatus?: string }) {
  if (['Finished', 'Paid', 'Partial', 'Released'].includes(sale.status)) return true;
  return sale.status === 'Pending' && ['In Progress', 'Ready for Pickup', 'Finished', 'Released'].includes(sale.jobStatus ?? '');
}

export function pickupLabel(status: string) {
  return status === 'Released' ? 'Taken / Released' : status === 'Finished' ? 'Finished' : status;
}
