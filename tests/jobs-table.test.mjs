import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectJobs, jobId, jobGroup, jobType } from '../src/jobsTable.ts';
const job = (id, overrides = {}) => ({ jobCostId: `internal-${id}`, invoiceId: `JOB-${id}`, clientName: `Client ${id}`, status: 'In Progress', goldUsed: 2, goldCostPerG: 500, goldCost: 1000, stoneCost: 0, laborCost: 100, sellingPrice: 2000, totalCost: 1100, profit: 900, marginPct: 45, sale: { serviceType: 'Repair' }, ...overrides });
const options = { query: '', filter: 'all', sortKey: 'jobId', direction: 1, page: 1, pageSize: 10 };

test('active job filters include pending, approved and ready jobs without a completed sale', () => {
  const jobs = ['Pending', 'Approved', 'In Progress', 'Ready for Pickup', 'Finished', 'Cancelled'].map((status, i) => job(i, { status, sale: undefined }));
  const result = selectJobs(jobs, { ...options, filter: 'inProgress' });
  assert.equal(result.total, 4);
  assert.deepEqual(result.counts, { all: 6, inProgress: 4, finished: 1 });
  assert.equal(jobGroup('IN_PROGRESS'), 'inProgress');
  assert.equal(jobGroup('FINISHED'), 'finished');
});

test('search combines client, visible ID and service type, then counts and filters', () => {
  const jobs = [job(1), job(2, { status: 'Finished', sale: { serviceType: 'Custom' } }), job(3, { status: 'Finished' })];
  const result = selectJobs(jobs, { ...options, query: ' repair ', filter: 'finished' });
  assert.deepEqual(result.rows.map(jobId), ['JOB-3']);
  assert.deepEqual(result.counts, { all: 2, inProgress: 1, finished: 1 });
  assert.equal(selectJobs(jobs, { ...options, query: 'Client 2' }).total, 1);
  assert.equal(jobId(job(1, { invoiceId: '' })), 'internal-1');
});

test('sorts the full result numerically before pagination without changing input', () => {
  const jobs = Array.from({ length: 23 }, (_, i) => job(i + 1, { profit: (23 - i) * 100 }));
  const result = selectJobs(jobs, { ...options, sortKey: 'profit', page: 2 });
  assert.equal(result.total, 23);
  assert.equal(result.pageCount, 3);
  assert.equal(result.rows[0].profit, 1100);
  assert.equal(result.rows.length, 10);
  assert.equal(jobs[0].profit, 2300);
  assert.deepEqual(selectJobs([job(10), job(2)], options).rows.map(jobId), ['JOB-2', 'JOB-10']);
});

test('clamps pages after deletion and handles empty search results', () => {
  const result = selectJobs([job(1)], { ...options, page: 4 });
  assert.equal(result.page, 1);
  assert.equal(result.rows.length, 1);
  const empty = selectJobs([job(1)], { ...options, query: 'missing', page: 4 });
  assert.equal(empty.page, 1); assert.equal(empty.pageCount, 1); assert.equal(empty.total, 0);
  assert.deepEqual(empty.rows, []);
});

test('unrecorded margins stay last in both directions instead of masquerading as 100%', () => {
  const jobs = [job(1, { totalCost: 0, marginPct: 100 }), job(2, { marginPct: -10 }), job(3, { marginPct: 75 })];
  assert.deepEqual(selectJobs(jobs, { ...options, sortKey: 'marginPct' }).rows.map(jobId), ['JOB-2', 'JOB-3', 'JOB-1']);
  assert.deepEqual(selectJobs(jobs, { ...options, sortKey: 'marginPct', direction: -1 }).rows.map(jobId), ['JOB-3', 'JOB-2', 'JOB-1']);
});

test('type and missing-cost filters compose while reporting the missing-cost count', () => {
  const jobs = [
    job(1, { totalCost: 0, sale: { serviceType: 'Repair' } }),
    job(2, { sale: { serviceType: 'Custom' } }),
    job(3, { totalCost: 0, sale: { serviceType: 'Resize' } }),
  ];
  const result = selectJobs(jobs, { ...options, type: 'Resize', missingCostsOnly: true });
  assert.equal(result.missingCostsCount, 1);
  assert.deepEqual(result.rows.map(jobId), ['JOB-3']);
  const byType = selectJobs(jobs, { ...options, type: 'custom' });
  assert.equal(byType.total, 1);
  assert.equal(byType.missingCostsCount, 0);
});

test('job type labels and filters use the persisted costing type ahead of invoice metadata', () => {
  const record = job(1, { serviceType: 'Cleaning', sale: { serviceType: 'Repair' } });
  assert.equal(jobType(record), 'Cleaning');
  const options = { query: '', filter: 'all', sortKey: 'jobId', direction: 1, page: 1, pageSize: 25 };
  const filtered = selectJobs([record], { ...options, type: 'Cleaning' });
  assert.equal(filtered.total, 1);
  assert.equal(selectJobs([record], { ...options, type: 'Repair' }).total, 0);
});
