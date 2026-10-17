import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight } from 'lucide-react';
import { dashboardSummary, daysOpen, type DashboardJob, type DashboardSale } from '../../dashboardSummary';
import { Badge, sentenceCase } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { PageHeader } from './PageHeader';

const pesos = (n: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n);
function Loading({ label }: { label: string }) { return <div role="status" aria-label={`Loading ${label}`} className="space-y-3 py-5"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-10 w-full" /><Skeleton className="h-5 w-3/4" /></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="dashboard-empty">{children}</p>; }
type Approval = { requestId: string; entityType: string; action: string; status: string };
type Props = {
  sales: DashboardSale[]; jobCosts: DashboardJob[]; expenses: { expDate: string; amount: number }[];
  loading: boolean; error: string; isAdmin: boolean; goldRate: number | null; goldStock: number; goldLoading: boolean; goldStale: boolean;
  onView: (title: string, record: Record<string, unknown>) => void; onJobs: () => void; onApprovals: () => void; onRetry: () => void;
  loadApprovals: () => Promise<Approval[]>;
};
export function Dashboard(props: Props) {
  const { sales, jobCosts, expenses, loading, error, isAdmin } = props;
  const summary = useMemo(() => dashboardSummary(sales, jobCosts, expenses), [sales, jobCosts, expenses]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(isAdmin);
  const [approvalError, setApprovalError] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setApprovalLoading(true);
    props.loadApprovals().then(rows => { if (active) { setApprovals(rows.filter(r => r.status === 'PENDING')); setApprovalError(false); } })
      .catch(() => { if (active) setApprovalError(true); }).finally(() => { if (active) setApprovalLoading(false); });
    return () => { active = false; };
  }, [isAdmin, props.loadApprovals]);
  const metrics = [
    { key: 'revenue', label: 'Total Sales', empty: 'No completed sales this month' },
    { key: 'cash', label: 'Cash Collected', empty: 'No payments this month' },
    { key: 'expenses', label: 'Expenses', empty: 'No expenses this month' },
    { key: 'profit', label: 'Net Profit', empty: 'No financial activity this month' },
  ] as const;
  return <div className="dashboard-overview">
    <PageHeader title="Dashboard" description={`${new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })} · Month to date`} action={<div className="gold-strip">
      {props.goldLoading ? <Skeleton className="h-8 w-48" /> : <span><i className={props.goldRate !== null && !props.goldStale ? 'live-dot' : 'live-dot unavailable'} />{props.goldRate === null ? 'Gold price unavailable' : `${props.goldStale ? 'Last quote' : 'Live'} · ${pesos(props.goldRate)}/g · 24K`}</span>}
      <span>{loading ? <Skeleton className="h-5 w-24" /> : error ? 'Stock unavailable' : `Gold stock · ${props.goldStock.toFixed(2)} g`}</span>
    </div>} />
    {error && <div role="alert" className="rounded-lg bg-danger-tint p-4 text-danger">{error} <Button variant="secondary" onClick={props.onRetry}>Retry</Button></div>}
    <div className="dashboard-kpis">
      {metrics.map(({ key, label, empty }) => {
        const hero = key === 'profit', value = summary.current[key], delta = value - summary.prior[key];
        const restricted = hero && !isAdmin;
        const formatted = pesos(value);
        const favorable = key === 'expenses' ? delta < 0 : delta > 0;
        const trendColor = key === 'expenses' ? 'var(--warning)' : hero ? value < 0 ? 'var(--danger)' : 'var(--success)' : key === 'cash' ? 'var(--info)' : 'var(--navy)';
        return <section key={key} className={`dashboard-kpi ${hero ? 'dashboard-kpi-hero' : ''}`} aria-label={label}>
          <h2 className="section-label">{label}</h2>
          {loading ? <Loading label={label} /> : error ? <Empty>Unavailable</Empty> : restricted ? <Empty>Available to admins</Empty> : <>
            <div className={`dashboard-kpi-number ${hero ? value < 0 ? 'text-danger' : 'text-success' : ''}`} style={{ '--number-width': Math.max(4, formatted.length * .64) } as CSSProperties}>{formatted}</div>
            {hero && <div className="dashboard-kpi-context"><Badge variant={value < 0 ? 'danger' : 'success'}>{summary.current.revenue ? `${(value / summary.current.revenue * 100).toFixed(1)}% margin` : 'No sales recorded'}</Badge></div>}
            {value === 0 && (!hero || (!summary.current.count && !summary.current.expenses && !summary.current.cash)) && <p className="dashboard-kpi-empty">{empty}</p>}
            <div className="dashboard-kpi-sparkline" role="img" aria-label={`${label} over the last six months`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.months}><Area type="monotone" dataKey={key} stroke={trendColor} fill={trendColor} fillOpacity={0.12} strokeWidth={2} dot={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
            <p className={`dashboard-delta ${delta === 0 ? 'text-muted-foreground' : favorable ? 'text-success' : 'text-danger'}`} title={`Same period last month: ${pesos(summary.prior[key])}`}>{delta > 0 ? '+' : ''}{pesos(delta)} <span className="text-muted-foreground">vs last month</span></p>
          </>}
        </section>;
      })}
    </div>
    <p className="text-xs text-muted-foreground">Compared with the same period last month. Revenue and job costs reflect completed sales.{summary.undatedPayments > 0 ? ' Payments without a date are excluded from cash totals.' : ''}</p>
    <section className="dashboard-panel" aria-labelledby="revenue-heading">
      <div className="dashboard-block-heading"><div><h2 id="revenue-heading">Revenue vs costs</h2><p>Last six months · Completed sales, job costs, and expenses</p></div><div className="chart-legend"><span><i className="revenue-key" />Revenue</span><span><i className="cost-key" />Job cost</span><span><i className="expenses-key" />Expenses</span></div></div>
      {loading ? <Loading label="monthly chart" /> : error ? <Empty>Chart unavailable. Retry loading the dashboard.</Empty> : !isAdmin ? <Empty>Financial comparisons are available to admins.</Empty> : !summary.months.some(m => m.count || m.expenses) ? <Empty>No completed sales or expenses in the last six months. Your revenue and costs will appear here.</Empty> : <div className="dashboard-chart" role="img" aria-label="Monthly revenue, job cost and expenses bar chart">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.months} margin={{ top: 12, right: 8, bottom: 0, left: 12 }} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} /><YAxis width={64} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={n => new Intl.NumberFormat('en-PH', { notation: 'compact' }).format(n)} /><Tooltip formatter={(value: number) => pesos(value)} contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)', borderRadius: 8 }} /><Bar dataKey="revenue" name="Revenue" fill="var(--navy)" radius={[4, 4, 0, 0]} maxBarSize={32} /><Bar dataKey="cost" name="Job cost" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} maxBarSize={32} /><Bar dataKey="expenses" name="Expenses" fill="var(--warning)" radius={[4, 4, 0, 0]} maxBarSize={32} /></BarChart></ResponsiveContainer>
      </div>}
    </section>
    <div className="dashboard-bottom">
      <section className="dashboard-panel min-w-0" aria-labelledby="activity-heading"><div className="dashboard-block-heading"><div><h2 id="activity-heading">Recent activity</h2><p>The latest eight jobs</p></div><Button variant="ghost" onClick={props.onJobs}>View all jobs</Button></div>
        {loading ? <Loading label="recent activity" /> : error ? <Empty>Activity unavailable.</Empty> : !summary.recent.length ? <Empty>No jobs yet. New workshop jobs will appear here.</Empty> : <div className="overflow-x-auto"><table className="dashboard-activity"><thead><tr>{['Client', 'Type', 'Amount', 'Profit', 'Status', ''].map((label, i) => <th key={i} scope="col" className={i === 2 || i === 3 ? 'text-right' : ''}>{label || <span className="sr-only">Actions</span>}</th>)}</tr></thead><tbody>{summary.recent.map(job => <tr key={job.jobCostId}><td title={job.clientName}>{job.clientName || 'Unnamed client'}</td><td>{job.sale?.serviceType ?? '—'}</td><td>{pesos(job.sellingPrice)}</td><td className={job.profit < 0 ? 'text-danger' : ''}>{isAdmin ? pesos(job.profit) : '—'}</td><td><Badge status={job.status}>{sentenceCase(job.status)}</Badge></td><td><Button variant="ghost" className="dashboard-view-button" aria-label={`View job for ${job.clientName}`} onClick={() => props.onView('Job details', { ...job })}>View <ChevronRight size={14} aria-hidden="true" /></Button></td></tr>)}</tbody></table></div>}
      </section>
      <section className="dashboard-panel" aria-labelledby="attention-heading"><div className="dashboard-block-heading"><div><h2 id="attention-heading">Needs attention</h2><p>Keep the workshop moving</p></div></div>
        {loading ? <Loading label="in-progress jobs" /> : error ? <Empty>Jobs unavailable.</Empty> : <><div className="attention-title"><h3>In-progress jobs</h3><Badge variant="neutral">{summary.active.length}</Badge></div>{!summary.active.length ? <Empty>No jobs need attention.</Empty> : <ul className="attention-list">{summary.active.slice(0, 4).map(job => { const age = daysOpen(job.jobDate ?? job.sale?.date); return <li key={job.jobCostId}><button onClick={() => props.onView('Job details', { ...job })}><span>{job.clientName || 'Unnamed client'}</span><span className={`attention-age ${age !== null && age > 7 ? 'attention-age-overdue' : ''}`}>{age === null ? 'Date unavailable' : `${age} ${age === 1 ? 'day' : 'days'}`}</span></button></li>; })}</ul>}<Button variant="ghost" onClick={props.onJobs}>View jobs</Button></>}
        <div className="attention-approvals"><div className="attention-title"><h3>Pending approvals</h3>{isAdmin && !approvalLoading && !approvalError && <Badge variant="warning">{approvals.length}</Badge>}</div>{!isAdmin ? <Empty>Approvals are managed by admins.</Empty> : approvalLoading ? <Loading label="pending approvals" /> : approvalError ? <Empty>Approvals could not be loaded.</Empty> : !approvals.length ? <Empty>All caught up. No pending approvals.</Empty> : <ul className="attention-list">{approvals.slice(0, 3).map(row => <li key={row.requestId}><button onClick={props.onApprovals}>{sentenceCase(row.action)} · {sentenceCase(row.entityType.replaceAll('_', ' '))}</button></li>)}</ul>}{isAdmin && <Button variant="ghost" onClick={props.onApprovals}>Review approvals</Button>}</div>
      </section>
    </div>
  </div>;
}
