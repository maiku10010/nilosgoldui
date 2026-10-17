import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardSummary, daysOpen } from '../src/dashboardSummary.ts';
const sale = (invoiceId, date, overrides = {}) => ({ invoiceId, date, status: 'Finished', price: 1000, payment: 1000, ...overrides });
test('month-to-date uses completed revenue, associated costs, expenses and payment dates', () => {
  const result = dashboardSummary([sale('old', '2026-09-05', { payments: [{ amount: 400, paidAt: '2026-10-03' }] }), sale('new', '2026-10-02', { payments: [{ amount: 600, paidAt: null }] }), sale('pending', '2026-10-01', { status: 'Pending', payments: [{ amount: 200, paidAt: '2026-10-01' }] })], [{ invoiceId: 'new', totalCost: 300, status: 'Finished' }], [{ expDate: '2026-10-01', amount: 100 }], new Date(2026, 9, 17));
  assert.equal(result.current.revenue, 1000);
  assert.equal(result.current.cash, 600);
  assert.equal(result.current.profit, 600);
  assert.equal(result.undatedPayments, 1);
  assert.equal(result.prior.revenue, 1000);
});
test('six-month window crosses years, fills empty months and excludes future sales', () => {
  const result = dashboardSummary([sale('a', '2025-12-10'), sale('b', '2026-01-20')], [], [], new Date(2026, 0, 17));
  assert.equal(result.months.length, 6);
  assert.equal(result.months[4].revenue, 1000);
  assert.equal(result.months[5].revenue, 0);
  assert.equal(result.prior.revenue, 1000);
});
test('previous period caps at month end and activity sorts by actual job date', () => {
  const jobs = Array.from({ length: 10 }, (_, i) => ({ jobCostId: String(i), jobDate: `2026-03-${String(i + 1).padStart(2, '0')}`, status: i ? 'In Progress' : 'Finished' }));
  const result = dashboardSummary([sale('a', '2026-02-28')], jobs, [], new Date(2026, 2, 31));
  assert.equal(result.prior.revenue, 1000);
  assert.equal(result.recent.length, 8);
  assert.equal(result.recent[0].jobCostId, '9');
  assert.equal(result.active.length, 9);
});
test('active jobs sort oldest first and days open uses calendar days', () => {
  const jobs = [
    { jobCostId: 'new', jobDate: '2026-10-15', status: 'In Progress' },
    { jobCostId: 'old', jobDate: '2026-10-01', status: 'In Progress' },
    { jobCostId: 'undated', status: 'In Progress' },
  ];
  const result = dashboardSummary([], jobs, [], new Date(2026, 9, 17));
  assert.deepEqual(result.active.map(job => job.jobCostId), ['old', 'new', 'undated']);
  assert.equal(daysOpen('2026-10-10', new Date(2026, 9, 17)), 7);
  assert.equal(daysOpen(undefined, new Date(2026, 9, 17)), null);
});
