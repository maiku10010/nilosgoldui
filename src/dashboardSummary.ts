export type DashboardSale = { invoiceId: string; date: string; status: string; price: number; payment: number; payments?: { amount: number; paidAt: string | null }[] };
export type DashboardJob = { jobCostId: string; invoiceId: string; jobDate?: string; clientName: string; status: string; totalCost: number; sellingPrice: number; profit: number; sale?: { serviceType: string; date?: string } };
type Expense = { expDate: string; amount: number };
const dateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export function dashboardSummary(sales: DashboardSale[], jobs: DashboardJob[], expenses: Expense[], now = new Date()) {
  const year = now.getFullYear(), month = now.getMonth(), day = now.getDate();
  const completed = sales.filter(s => ['finished', 'paid', 'released'].includes(s.status.toLowerCase()));
  const costs = new Map(jobs.map(j => [j.invoiceId, j.totalCost]));
  const payments = sales.flatMap(s => s.payments === undefined ? [{ amount: s.payment, paidAt: s.date }] : s.payments);
  const period = (start: string, end: string) => {
    const within = (date: string | null) => !!date && date.slice(0, 10) >= start && date.slice(0, 10) <= end;
    const rows = completed.filter(s => within(s.date));
    const revenue = rows.reduce((sum, s) => sum + s.price, 0);
    const cost = rows.reduce((sum, s) => sum + (costs.get(s.invoiceId) ?? 0), 0);
    const spending = expenses.filter(e => within(e.expDate)).reduce((sum, e) => sum + e.amount, 0);
    return { revenue, cost, expenses: spending, cash: payments.filter(p => within(p.paidAt)).reduce((sum, p) => sum + p.amount, 0), profit: revenue - cost - spending, count: rows.length };
  };
  const previous = new Date(year, month - 1, 1);
  const current = period(dateKey(year, month, 1), dateKey(year, month, day));
  const prior = period(dateKey(previous.getFullYear(), previous.getMonth(), 1), dateKey(previous.getFullYear(), previous.getMonth(), Math.min(day, new Date(year, month, 0).getDate())));
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(year, month - 5 + i, 1);
    const end = i === 5 ? day : new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return { label: date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' }), ...period(dateKey(date.getFullYear(), date.getMonth(), 1), dateKey(date.getFullYear(), date.getMonth(), end)) };
  });
  const trend = Array.from({ length: day }, (_, i) => ({ day: i + 1, profit: period(dateKey(year, month, 1), dateKey(year, month, i + 1)).profit }));
  const recent = [...jobs].sort((a, b) => (b.jobDate ?? b.sale?.date ?? '').localeCompare(a.jobDate ?? a.sale?.date ?? '')).slice(0, 8);
  const active = jobs.filter(j => ['pending', 'approved', 'in progress', 'ready for pickup'].includes(j.status.toLowerCase().replaceAll('_', ' ')));
  return { current, prior, months, trend, recent, active, undatedPayments: payments.filter(p => !p.paidAt).length };
}
