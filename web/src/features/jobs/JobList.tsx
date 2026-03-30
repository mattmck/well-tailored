import { useState } from 'react';
import { useWorkspace } from '../../context';
import type { Job } from '../../types';
import { CheckCircle2, Circle, LoaderCircle, OctagonAlert, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/ui/utils';
import { formatStageLabel, getStageBadgeClass, matchesJobFilter } from './stages';

function getScorecardWarning(job: Job): 'error' | 'warn' | null {
  const scorecard = job.result?.scorecard;
  if (!scorecard) return null;
  if (scorecard.verdict === 'do_not_submit' || scorecard.blockingIssues.length > 0) return 'error';
  if (scorecard.verdict === 'needs_revision') return 'warn';
  return null;
}

type SortField = 'company' | 'title' | 'stage' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<Job['status'], number> = {
  tailoring: 0, tailored: 1, reviewed: 2, error: 3, loaded: 4,
};

function sortJobs(jobs: Job[], field: SortField | null, dir: SortDir): Job[] {
  if (!field) return jobs; // preserve incoming order (e.g. Huntr board order)
  return [...jobs].sort((a, b) => {
    let cmp: number;
    if (field === 'status') {
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    } else {
      cmp = (a[field] ?? '').localeCompare(b[field] ?? '');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

function getStatusIndicator(status: Job['status']) {
  switch (status) {
    case 'loaded':
      return <Circle className="h-3.5 w-3.5" strokeWidth={2} />;
    case 'tailoring':
      return <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />;
    case 'tailored':
      return <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />;
    case 'reviewed':
      return <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />;
    case 'error':
      return <OctagonAlert className="h-3.5 w-3.5" strokeWidth={2} />;
    default:
      return <Circle className="h-3.5 w-3.5" strokeWidth={2} />;
  }
}

function formatStatusLabel(status: Job['status']) {
  switch (status) {
    case 'loaded':
      return 'Loaded';
    case 'tailoring':
      return 'Tailoring';
    case 'tailored':
      return 'Drafted';
    case 'reviewed':
      return 'Reviewed';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

function getStatusBadgeClass(status: Job['status']) {
  switch (status) {
    case 'loaded':
      return 'border-border bg-white/70 text-muted-foreground';
    case 'tailoring':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700';
    case 'tailored':
      return 'border-primary/20 bg-primary/10 text-primary';
    case 'reviewed':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700';
    case 'error':
      return 'border-destructive/20 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-white/70 text-muted-foreground';
  }
}

function JobItem({ job }: { job: Job }) {
  const { state, dispatch } = useWorkspace();
  const isSelected = state.activeJobId === job.id;

  function handleClick() {
    dispatch({ type: 'SET_ACTIVE_JOB', id: job.id });
  }

  function handleCheckChange(checked: boolean | 'indeterminate') {
    dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { checked: checked === true } });
  }
  const statusIcon = getStatusIndicator(job.status);
  const warning = getScorecardWarning(job);

  return (
    <div
      onClick={handleClick}
      className={cn(
        'cursor-pointer rounded-[1.1rem] border px-3 py-3 transition-all duration-200',
        isSelected
          ? 'border-primary/30 bg-primary/[0.06] shadow-[0_10px_26px_rgba(49,74,116,0.08)]'
          : 'border-border/70 bg-white/68 hover:-translate-y-0.5 hover:border-border hover:bg-white/82'
      )}
    >
      <div className="flex items-start gap-3">
        <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
          <Checkbox
            checked={job.checked}
            onCheckedChange={handleCheckChange}
            className="shrink-0"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {job.company}
            </p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
              {job.title}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                getStageBadgeClass(job.stage)
              )}
            >
              {formatStageLabel(job.stage)}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                getStatusBadgeClass(job.status)
              )}
            >
              {statusIcon}
              {formatStatusLabel(job.status)}
            </span>

            {warning && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  warning === 'error'
                    ? 'border-destructive/20 bg-destructive/10 text-destructive'
                    : 'border-amber-500/20 bg-amber-500/10 text-amber-700'
                )}
              >
                {warning === 'error' ? 'Blocking issues' : 'Needs revision'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'company', label: 'Co.' },
  { field: 'title', label: 'Title' },
  { field: 'stage', label: 'Stage' },
  { field: 'status', label: 'Status' },
];

export function JobList() {
  const { state, dispatch } = useWorkspace();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const filteredJobs =
    state.jobListFilter === 'all'
      ? state.jobs
      : state.jobs.filter((job) => matchesJobFilter(job, state.jobListFilter));

  const sortedJobs = sortJobs(filteredJobs, sortField, sortDir);
  const allVisibleChecked = sortedJobs.length > 0 && sortedJobs.every((job) => job.checked);
  const someVisibleChecked = !allVisibleChecked && sortedJobs.some((job) => job.checked);

  function handleToggleVisibleJobs(checked: boolean | 'indeterminate') {
    dispatch({
      type: 'SET_JOBS_CHECKED',
      ids: sortedJobs.map((job) => job.id),
      checked: checked === true,
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-border/70 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allVisibleChecked ? true : someVisibleChecked ? 'indeterminate' : false}
              onCheckedChange={handleToggleVisibleJobs}
            />
            <p className="editorial-label">List</p>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {sortedJobs.length} roles
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {allVisibleChecked ? 'All visible roles selected' : 'Select or clear all visible roles'}
          </span>
        </div>

        <div className="-mx-1 mt-2 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2">
            {SORT_FIELDS.map(({ field, label }) => {
              const active = sortField === field;
              return (
                <button
                  key={field}
                  onClick={() => handleSort(field)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap',
                    active
                      ? 'bg-secondary text-foreground border-border shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                      : 'bg-white/70 text-muted-foreground border-border/80 hover:text-foreground hover:bg-secondary/40'
                  )}
                >
                  {label}
                  {active && (sortDir === 'asc'
                    ? <ChevronUp size={10} strokeWidth={2.5} />
                    : <ChevronDown size={10} strokeWidth={2.5} />)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {sortedJobs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            {state.jobs.length === 0
              ? 'No jobs loaded. Click "Load Huntr" to import jobs.'
              : 'No jobs match the current filter.'}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2.5 p-3">
            {sortedJobs.map((job) => (
              <JobItem key={job.id} job={job} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
