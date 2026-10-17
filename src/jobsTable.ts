export type JobFilter = 'all' | 'inProgress' | 'finished';
export type JobSortKey = 'jobId' | 'clientName' | 'type' | 'sellingPrice' | 'totalCost' | 'profit' | 'marginPct' | 'status';
export interface JobTableRecord {
  jobCostId: string; invoiceId: string; clientName: string; status: string;
  goldUsed: number; goldScrap?: number; goldCostPerG: number; goldCost: number; stoneCost: number; laborCost: number;
  sellingPrice: number; totalCost: number; profit: number; marginPct: number;
  sale?: { serviceType?: string };
}
export const jobId = (job: JobTableRecord) => job.invoiceId || job.jobCostId;
export const jobType = (job: JobTableRecord) => job.sale?.serviceType || '—';
export function jobGroup(status: string): JobFilter {
  const normalized = status.replaceAll('_', ' ').toLowerCase();
  if (['finished', 'paid', 'released'].includes(normalized)) return 'finished';
  if (['pending', 'approved', 'in progress', 'ongoing', 'ready for pickup'].includes(normalized)) return 'inProgress';
  return 'all';
}
export function selectJobs<T extends JobTableRecord>(jobs: T[], options: {
  query: string; filter: JobFilter; sortKey: JobSortKey; direction: 1 | -1; page: number; pageSize: number; type?: string; missingCostsOnly?: boolean;
}) {
  const query = options.query.trim().toLowerCase();
  const matching = jobs.filter(job => [jobId(job), job.clientName, jobType(job)].some(value => value.toLowerCase().includes(query))
    && (!options.type || options.type === 'all' || jobType(job).toLowerCase() === options.type.toLowerCase()));
  const missingCostsCount = matching.filter(job => job.totalCost === 0).length;
  const visibleJobs = options.missingCostsOnly ? matching.filter(job => job.totalCost === 0) : matching;
  const counts = { all: visibleJobs.length, inProgress: 0, finished: 0 };
  for (const job of visibleJobs) { const group = jobGroup(job.status); if (group !== 'all') counts[group]++; }
  const value = (job: T): string | number | null => options.sortKey === 'jobId' ? jobId(job)
    : options.sortKey === 'type' ? jobType(job)
    : options.sortKey === 'marginPct' && job.totalCost === 0 ? null : job[options.sortKey];
  const sorted = visibleJobs.filter(job => options.filter === 'all' || jobGroup(job.status) === options.filter).sort((a, b) => {
    const left = value(a), right = value(b);
    // An unrecorded cost has no meaningful margin; keep it last in either direction.
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'en', { numeric: true, sensitivity: 'base' });
    return order * options.direction || jobId(a).localeCompare(jobId(b), 'en', { numeric: true });
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / options.pageSize));
  const page = Math.max(1, Math.min(options.page, pageCount));
  const start = (page - 1) * options.pageSize;
  return { rows: sorted.slice(start, start + options.pageSize), counts, missingCostsCount, total: sorted.length, page, pageCount, start };
}
