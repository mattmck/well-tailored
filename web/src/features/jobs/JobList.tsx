import { useState } from 'react';
import { useWorkspace } from '../../context';
import type { Job } from '../../types';
import { CheckCircle2, Circle, LoaderCircle, OctagonAlert, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/ui/utils';
import { formatStageLabel, getStageBadgeClass, matchesJobFilter } from './stages';

type SortField = 'company' | 'title' | 'stage' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<Job['status'], number> = {
  tailoring: 0, tailored: 1, reviewed: 2, error: 3, loaded: 4,
};

function sortJobs(jobs: Job[], field: SortField, dir: SortDir): Job[] {
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

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 px-2 pr-4 py-1.5 cursor-pointer border-b border-border/50 hover:bg-secondary/30 transition-colors',
        isSelected && 'bg-secondary border-l-2 border-l-primary pl-[6px]'
      )}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={job.checked}
          onCheckedChange={handleCheckChange}
          className="shrink-0"
        />
      </div>

      {/* Job info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0 overflow-hidden">
            <span className="block text-[13px] font-semibold text-foreground leading-tight">
              {job.company}
            </span>
          </div>
          <span
            className={cn(
              'shrink-0 inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
              getStageBadgeClass(job.stage)
            )}
          >
            {formatStageLabel(job.stage)}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="flex-1 min-w-0 overflow-hidden">
            <span className="block text-[11px] text-muted-foreground leading-tight">
              {job.title}
            </span>
          </div>
          <span
            className={cn(
              'shrink-0 inline-flex w-5 justify-center',
              job.status === 'error' && 'text-destructive',
              job.status === 'reviewed' && 'text-green-600',
              job.status === 'tailored' && 'text-primary',
              job.status === 'tailoring' && 'text-yellow-600',
              job.status === 'loaded' && 'text-muted-foreground'
            )}
          >
            {statusIcon}
          </span>
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
  const { state } = useWorkspace();
  const [sortField, setSortField] = useState<SortField>('company');
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

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Sort bar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border shrink-0">
        <span className="text-[10px] text-muted-foreground mr-1 uppercase tracking-wider">Sort</span>
        {SORT_FIELDS.map(({ field, label }) => {
          const active = sortField === field;
          return (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={cn(
                'flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors',
                active
                  ? 'bg-secondary text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              {label}
              {active && (sortDir === 'asc'
                ? <ChevronUp size={9} strokeWidth={2.5} />
                : <ChevronDown size={9} strokeWidth={2.5} />)}
            </button>
          );
        })}
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
          <div>
            {sortedJobs.map((job) => (
              <JobItem key={job.id} job={job} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
