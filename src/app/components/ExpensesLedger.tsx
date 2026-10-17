import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, Download, PenSquare, Plus, Search, Trash2 } from 'lucide-react';
import { expenseCategories, expenseCategory, expenseTotals, expensesCsv, selectExpenses, type ExpenseRecord } from '../../expensesView';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { PageHeader } from './PageHeader';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from './ui/dropdown-menu';

const money = (n: number, decimals = 2) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
const displayDate = (date: string, month = false) => new Date(date + (month ? '-01T00:00:00' : 'T00:00:00')).toLocaleDateString('en-PH', { month: 'long', ...(month ? {} : { day: 'numeric' }), year: 'numeric' });
export function ExpensesLedger({ expenses, onAdd, onEdit, onDelete }: { expenses: ExpenseRecord[]; onAdd: () => void; onEdit: (row: ExpenseRecord) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const invalidRange = !!start && !!end && start > end;
  const filtered = useMemo(() => selectExpenses(expenses, { query, categories, start, end }), [expenses, query, categories, start, end]);
  const monthly = useMemo(() => expenseTotals(filtered), [filtered]);
  const daily = useMemo(() => expenseTotals(filtered, 10), [filtered]);
  const total = filtered.reduce((sum, row) => sum + row.amount, 0);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * size, current * size);
  const options = [...new Set([...expenseCategories, ...expenses.map(row => expenseCategory(row.category))])];
  const download = () => {
    const url = URL.createObjectURL(new Blob([expensesCsv(filtered)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `expenses-${start || 'all'}-${end || 'dates'}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="space-y-4">
    <PageHeader title="Expenses" description="Track operating costs and workshop spending." action={<div className="flex items-center gap-3"><span className="expense-total-pill" title={`Filtered total: ${money(total)}`}>Total {money(total, 0)}</span><Button onClick={onAdd}><Plus size={16} />Add Expense</Button></div>} />
    <div className="expense-filters">
      <label className="expense-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search expenses" placeholder="Search expenses…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary">{categories.length ? `Categories (${categories.length})` : 'All categories'}<ChevronDown size={14} /></Button></DropdownMenuTrigger><DropdownMenuContent align="start">{options.map(category => <DropdownMenuCheckboxItem key={category} checked={categories.includes(category)} onSelect={event => event.preventDefault()} onCheckedChange={checked => { setCategories(previous => checked ? [...previous, category] : previous.filter(value => value !== category)); setPage(1); }}>{category}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
      <label className="expense-date">From<input type="date" aria-label="From date" value={start} max={end || undefined} onChange={event => { setStart(event.target.value); setPage(1); }} /></label>
      <label className="expense-date">To<input type="date" aria-label="To date" value={end} min={start || undefined} onChange={event => { setEnd(event.target.value); setPage(1); }} /></label>
      {(query || categories.length > 0 || start || end) && <Button variant="ghost" onClick={() => { setQuery(''); setCategories([]); setStart(''); setEnd(''); setPage(1); }}>Clear filters</Button>}
      <Button variant="secondary" className="ml-auto" onClick={download} disabled={!filtered.length || invalidRange}><Download size={16} />Export CSV</Button>
    </div>
    {invalidRange && <p role="alert" className="text-sm text-danger">The end date must be on or after the start date.</p>}
    <section className="expense-months" aria-label="Monthly totals for current filters"><span className="section-label">Monthly totals · current filters</span>{monthly.size ? [...monthly].map(([month, amount]) => <div key={month}><span>{displayDate(month, true)}</span><strong>{money(amount)}</strong></div>) : <p className="text-sm text-muted-foreground">No expenses in this selection.</p>}</section>
    <div className="expense-table-scroll" tabIndex={0} role="region" aria-label="Expenses grouped by date">
      <table className="expense-table"><colgroup><col style={{ width: '18%' }} /><col style={{ width: '20%' }} /><col /><col style={{ width: '18%' }} /><col style={{ width: 100 }} /></colgroup><thead><tr><th scope="col">Expense ID</th><th scope="col">Category</th><th scope="col">Description</th><th scope="col" className="expense-number">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {visible.map((row, index) => { const category = expenseCategory(row.category); const tone = expenseCategories.indexOf(category); return <Fragment key={row.expenseId}>
          {(index === 0 || visible[index - 1].expDate !== row.expDate) && <tr className="expense-day"><th colSpan={5} scope="rowgroup"><div><span>{displayDate(row.expDate)}{index === 0 && current > 1 && filtered[(current - 1) * size - 1]?.expDate === row.expDate ? ' · continued' : ''}</span><span>Daily subtotal <strong>{money(daily.get(row.expDate) ?? 0)}</strong></span></div></th></tr>}
          <tr className="expense-row"><td className="text-muted-foreground">{row.expenseId}</td><td><Badge className={`expense-category expense-category-${tone < 0 ? 5 : tone}`}>{category}</Badge></td><td>{row.description || '—'}</td><td className="expense-number font-medium">{money(row.amount)}</td><td><div className="expense-actions"><Button variant="ghost" size="icon" title="Edit expense" aria-label={`Edit expense ${row.expenseId}`} onClick={() => onEdit(row)}><PenSquare size={16} /></Button><Button variant="ghost" size="icon" title="Delete expense" aria-label={`Delete expense ${row.expenseId}`} onClick={() => onDelete(row.expenseId)}><Trash2 size={16} /></Button></div></td></tr>
        </Fragment>; })}
        {!visible.length && <tr><td colSpan={5} className="expense-empty">{expenses.length ? 'No expenses match your filters.' : 'No expenses yet. Add your first expense to get started.'}</td></tr>}
      </tbody></table>
    </div>
    <div className="expense-pagination"><p>{filtered.length ? `${(current - 1) * size + 1}–${Math.min(current * size, filtered.length)} of ${filtered.length} expenses` : '0 expenses'}</p><span className="text-xs text-muted-foreground">Daily subtotals include all matching expenses for that date.</span><label>Rows per page <select aria-label="Rows per page" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>{[20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select></label><Button variant="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button><span>Page {current} of {pages}</span><Button variant="secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button></div>
  </div>;
}
