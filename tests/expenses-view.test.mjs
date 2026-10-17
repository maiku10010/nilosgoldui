import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expenseCategory, selectExpenses, expenseTotals, expensesCsv } from '../src/expensesView.ts';
const rows = [
  { expenseId: '1', expDate: '2026-10-10', category: 'Staff Salary', description: 'Workshop payroll', amount: 1000.50 },
  { expenseId: '2', expDate: '2026-10-10', category: 'Rent', description: 'Studio', amount: 2000 },
  { expenseId: '3', expDate: '2026-09-30', category: 'Utilities', description: 'Power', amount: 500 },
];
test('expense filters combine inclusive dates, multiple categories, and search without changing records', () => {
  const result = selectExpenses(rows, { query: '', categories: ['Payroll', 'Rent & utilities'], start: '2026-10-10', end: '2026-10-10' });
  assert.deepEqual(result.map(row => row.expenseId), ['1', '2']);
  assert.equal(expenseCategory(rows[0].category), 'Payroll');
  assert.equal(rows[0].category, 'Staff Salary');
  assert.equal(selectExpenses(rows, { query: 'payroll', categories: [], start: '', end: '' }).length, 1);
  assert.equal(selectExpenses(rows, { query: '', categories: [], start: '2026-11-01', end: '2026-10-01' }).length, 0);
});
test('monthly and daily totals include all filtered records, not a page', () => {
  assert.deepEqual([...expenseTotals(rows)], [['2026-10', 3000.5], ['2026-09', 500]]);
  assert.equal(expenseTotals(rows, 10).get('2026-10-10'), 3000.5);
});
test('CSV preserves decimals, quotes and newlines and neutralizes spreadsheet formulas', () => {
  const csv = expensesCsv([{ ...rows[0], description: '=SUM(1,2)\n"quoted"' }]);
  assert.ok(csv.startsWith('\uFEFFDate,Expense ID'));
  assert.ok(csv.includes('"\'=SUM(1,2)\n""quoted"""'));
  assert.ok(csv.endsWith(',1000.50'));
});
