import { Fragment, useMemo, useState } from "react";
import { recordDay, recordDayLabel } from "../../recordDay";
import { ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, PenSquare, Search, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { jobId, jobType, selectJobs, type JobFilter, type JobSortKey, type JobTableRecord } from "../../jobsTable";

const currency = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const columns: { label: string; key: JobSortKey; numeric?: boolean }[] = [
  { label: "Job ID", key: "jobId" }, { label: "Client", key: "clientName" }, { label: "Type", key: "type" },
  { label: "Selling price", key: "sellingPrice", numeric: true }, { label: "Total cost", key: "totalCost", numeric: true },
  { label: "Profit", key: "profit", numeric: true }, { label: "Margin", key: "marginPct", numeric: true }, { label: "Status", key: "status" },
];
const filters: { label: string; value: JobFilter }[] = [
  { label: "All", value: "all" }, { label: "In progress", value: "inProgress" }, { label: "Finished", value: "finished" },
];
const typeFilters = ["Repair", "Custom", "Cleaning", "Resize"];
function Cost({ value }: { value: number | null }) {
  return value == null || value === 0 ? <span className="text-muted-foreground">—</span> : <>{currency(value)}</>;
}

export function JobsTable<T extends JobTableRecord>({ jobs, onEdit, onDelete, onApprove, onReady, onFinish }: {
  jobs: T[]; onEdit: (job: T) => void; onDelete: (job: T) => void;
  onApprove: (job: T) => void; onReady: (job: T) => void; onFinish: (job: T) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<JobFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [missingCostsOnly, setMissingCostsOnly] = useState(false);
  const [sort, setSort] = useState<{ key: JobSortKey; direction: 1 | -1 }>({ key: "jobId", direction: -1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const result = useMemo(() => selectJobs(jobs, { query, filter, type: typeFilter, missingCostsOnly, sortKey: sort.key, direction: sort.direction, page, pageSize }), [jobs, query, filter, typeFilter, missingCostsOnly, sort, page, pageSize]);
  const toggleSort = (key: JobSortKey) => {
    setSort(current => ({ key, direction: current.key === key && current.direction === 1 ? -1 : 1 }));
    setPage(1);
  };
  return <div className="space-y-4">
    <div className="jobs-filter-row">
      <div role="group" aria-label="Filter jobs by status" className="jobs-status-tabs">
        {filters.map(item => <button key={item.value} type="button"
          aria-pressed={filter === item.value} onClick={() => { setFilter(item.value); setPage(1); }}
          className={`approval-tab jobs-status-tab ${filter === item.value ? "approval-tab-active" : ""}`}>
          {item.label}<span className="tabular-nums">{result.counts[item.value]}</span>
        </button>)}
      </div>
      <div className="jobs-filter-controls">
        <label className="jobs-type-select"><span>Type:</span>
          <select aria-label="Filter jobs by type" value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(1); }}>
            <option value="all">All</option>
            {typeFilters.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <div className="relative jobs-search">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground" />
          <input aria-label="Search jobs" placeholder="Search Job ID, client, or type…" value={query}
            onChange={event => { setQuery(event.target.value); setPage(1); }}
            className="h-9 w-72 rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
    </div>
    {result.missingCostsCount > 0 && <div><Button variant="ghost" aria-pressed={missingCostsOnly} onClick={() => { setMissingCostsOnly(value => !value); setPage(1); }} className={`jobs-missing-toggle ${missingCostsOnly ? "jobs-missing-toggle-active" : ""}`}><span className="jobs-missing-dot" aria-hidden="true" />{result.missingCostsCount} jobs missing costs</Button></div>}
    <div className="jobs-table-scroll rounded-xl border border-border" role="region" aria-label="Jobs table" tabIndex={0}>
      <table className="jobs-table">
        <caption className="sr-only">Job costing. Expand a job to inspect its cost breakdown.</caption>
        <colgroup><col className="jobs-id-column" /><col className="jobs-client-column" /><col className="jobs-type-column" />
          <col /><col /><col /><col className="jobs-margin-column" /><col className="jobs-status-column" /><col className="jobs-actions-column" /></colgroup>
        <thead><tr>{columns.map(column => <th key={column.key} scope="col"
          aria-sort={sort.key === column.key ? sort.direction === 1 ? "ascending" : "descending" : "none"}>
          <Button variant="ghost" className={`h-9 w-full gap-1 px-0 text-xs text-muted-foreground ${column.numeric ? "justify-end" : "justify-start"}`}
            onClick={() => toggleSort(column.key)}>
            {column.label}{sort.key === column.key ? sort.direction === 1 ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" /> : <ArrowUpDown size={14} aria-hidden="true" className="opacity-50" />}
          </Button>
        </th>)}<th scope="col">Actions</th></tr></thead>
        <tbody>{result.rows.map((job, index) => {
          const id = jobId(job), isExpanded = expanded.has(job.jobCostId);
          const detailsId = `job-breakdown-${encodeURIComponent(job.jobCostId)}`;
          return <Fragment key={job.jobCostId}>
            {(index === 0 || recordDay(result.rows[index - 1].jobDate) !== recordDay(job.jobDate)) && <tr className="record-day"><th colSpan={9} scope="rowgroup">{recordDayLabel(recordDay(job.jobDate))}{index === 0 && result.continuedDay ? ' · continued' : ''}</th></tr>}
            <tr>
              <td><div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-expanded={isExpanded} aria-controls={detailsId} aria-label={`${isExpanded ? "Hide" : "Show"} cost breakdown for ${id}`}
                  onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(job.jobCostId)) next.delete(job.jobCostId); else next.add(job.jobCostId); return next; })}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </Button>
                <Tooltip><TooltipTrigger asChild><span className="job-id" tabIndex={0}>{id}</span></TooltipTrigger><TooltipContent>{id}</TooltipContent></Tooltip>
              </div></td>
              <td><span className="block truncate font-medium" title={job.clientName}>{job.clientName}</span></td>
              <td>{jobType(job)}</td>
              <td className="text-right">{currency(job.sellingPrice)}</td>
              <td className="text-right"><Cost value={job.totalCost} /></td>
              <td className={`text-right ${job.profit < 0 ? "text-danger" : "text-success"}`}>{currency(job.profit)}</td>
              <td className="text-right">{job.totalCost === 0 ? <span className="text-muted-foreground">—</span> : <Badge variant={job.marginPct >= 50 ? "success" : job.marginPct >= 25 ? "warning" : "danger"}>{job.marginPct.toFixed(2)}%</Badge>}</td>
              <td><Badge status={job.status} className="min-w-24 whitespace-nowrap" /></td>
              <td><div className="flex items-center gap-1">
                <div className="table-row-actions"><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={`Edit job ${id}`} onClick={() => onEdit(job)}><PenSquare size={16} /></Button></TooltipTrigger><TooltipContent>Edit job</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="row-action-delete" aria-label={`Delete job ${id}`} onClick={() => onDelete(job)}><Trash2 size={16} /></Button></TooltipTrigger><TooltipContent>Delete job</TooltipContent></Tooltip></div>
                {job.status === "Pending" && <Button variant="secondary" size="sm" onClick={() => onApprove(job)}>Approve</Button>}
                {["Approved", "In Progress"].includes(job.status) && <Button variant="secondary" size="sm" onClick={() => onReady(job)}>Mark ready</Button>}
                {job.status === "Ready for Pickup" && <Button variant="secondary" size="sm" onClick={() => onFinish(job)}>Finish sale</Button>}
              </div></td>
            </tr>
            {isExpanded && <tr id={detailsId} className="jobs-breakdown-row"><td colSpan={9}>
              <section aria-label={`Cost breakdown for ${id}`} className="jobs-breakdown-card">
                <h2>Cost breakdown</h2>
                <div className="jobs-breakdown-grid">
                  <section><h3>Materials</h3><dl><div><dt>Gold used</dt><dd>{job.goldUsed === 0 ? <span className="text-muted-foreground">—</span> : `${job.goldUsed.toFixed(2)} g`}</dd></div><div><dt>Gold scrap</dt><dd>{!job.goldScrap ? <span className="text-muted-foreground">—</span> : `${job.goldScrap.toFixed(2)} g`}</dd></div><div><dt>Gold price / g</dt><dd><Cost value={job.goldCostPerG} /></dd></div><div><dt>Gold cost</dt><dd><Cost value={job.goldCost} /></dd></div></dl></section>
                  <section><h3>Labor &amp; stone</h3><dl><div><dt>Labor</dt><dd><Cost value={job.laborCost} /></dd></div><div><dt>Stone</dt><dd><Cost value={job.stoneCost} /></dd></div><div><dt>Labor &amp; stone total</dt><dd><Cost value={job.laborCost + (job.stoneCost ?? 0)} /></dd></div></dl></section>
                  <section><h3>Pricing</h3><dl><div><dt>Selling price</dt><dd>{currency(job.sellingPrice)}</dd></div><div><dt>Total cost</dt><dd><Cost value={job.totalCost} /></dd></div><div><dt>Profit</dt><dd className={job.profit < 0 ? "text-danger" : "text-success"}>{currency(job.profit)}</dd></div><div><dt>Margin</dt><dd>{job.totalCost === 0 ? <span className="text-muted-foreground">—</span> : <Badge variant={job.marginPct >= 50 ? "success" : job.marginPct >= 25 ? "warning" : "danger"}>{job.marginPct.toFixed(2)}%</Badge>}</dd></div></dl></section>
                </div>
                {job.status === "Approved" && <Button variant="secondary" className="mt-4" onClick={() => onFinish(job)}>Finish sale</Button>}
              </section>
            </td></tr>}
          </Fragment>;
        })}{!result.total && <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">No jobs match these filters.</td></tr>}</tbody>
      </table>
    </div>
    <div className="jobs-pagination flex items-center justify-between gap-4 text-xs text-muted-foreground">
      <p role="status" aria-live="polite">{result.total ? `${result.start + 1}–${result.start + result.rows.length} of ${result.total} jobs` : "0 jobs"}</p>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-md border border-border bg-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">{[10, 25, 50].map(size => <option key={size}>{size}</option>)}</select></label>
        <nav aria-label="Jobs pagination" className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>Previous</Button>
          <span>Page {result.page} of {result.pageCount}</span>
          <Button variant="secondary" size="sm" disabled={result.page === result.pageCount} onClick={() => setPage(result.page + 1)}>Next</Button>
        </nav>
      </div>
    </div>
  </div>;
}
