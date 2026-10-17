export type ExpenseRecord = { expenseId: string; expDate: string; category: string; description: string; amount: number };
export const expenseCategories = ['Payroll', 'Metal purchase', 'Rent & utilities', 'Supplies', 'Tax & permits', 'Other'];
export const expenseCategoryColors: Record<string, string> = {
  Payroll: 'var(--category-payroll)',
  'Metal purchase': 'var(--warning)',
  'Rent & utilities': 'var(--info)',
  Supplies: 'var(--success)',
  'Tax & permits': 'var(--primary-text)',
  Other: 'var(--muted-foreground)',
};
export function expenseCategory(value: string) {
  const key = value.trim().toLowerCase().replaceAll('_', ' ');
  const aliases: Record<string, string> = { 'staff salary': 'Payroll', salary: 'Payroll', payroll: 'Payroll', rent: 'Rent & utilities', utilities: 'Rent & utilities', 'rent & utilities': 'Rent & utilities', 'metal purchase': 'Metal purchase', 'gold purchase': 'Metal purchase', 'silver purchase': 'Metal purchase', supplies: 'Supplies', 'tax & permits': 'Tax & permits', other: 'Other' };
  return aliases[key] ?? (key.charAt(0).toUpperCase() + key.slice(1));
}
export function expenseCategoryColor(value: string) {
  return expenseCategoryColors[expenseCategory(value)] ?? 'var(--muted-foreground)';
}
export function selectExpenses(rows: ExpenseRecord[], filters: { query: string; categories: string[]; start: string; end: string }) {
  const query = filters.query.trim().toLowerCase();
  return rows.filter(row => (!filters.categories.length || filters.categories.includes(expenseCategory(row.category))) && (!filters.start || row.expDate >= filters.start) && (!filters.end || row.expDate <= filters.end) && [row.expenseId, row.description, row.category, expenseCategory(row.category)].some(value => value.toLowerCase().includes(query))).sort((a, b) => b.expDate.localeCompare(a.expDate) || a.expenseId.localeCompare(b.expenseId));
}
export function expenseTotals(rows: ExpenseRecord[], length = 7) {
  const totals = new Map<string, number>();
  for (const row of rows) { const key = row.expDate.slice(0, length); totals.set(key, (totals.get(key) ?? 0) + row.amount); }
  return totals;
}
export function expensesCsv(rows: ExpenseRecord[]) {
  const cell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  return '\uFEFF' + ['Date,Expense ID,Category,Description,Amount (PHP)', ...rows.map(row => [cell(row.expDate), cell(row.expenseId), cell(expenseCategory(row.category)), cell(row.description), row.amount.toFixed(2)].join(','))].join('\r\n');
}
