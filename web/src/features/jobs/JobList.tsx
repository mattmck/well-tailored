import { useEffect, useState } from 'react';
import { useWorkspace } from '../../context';
import type { Job } from '../../types';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  LoaderCircle,
  OctagonAlert,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { appendUniqueJobIdsToQueue } from '@/lib/queues';
import { formatStageLabel, getStageBadgeClass } from './stages';

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

function JobItem({
  job,
  selected,
  onToggleSelected,
}: {
  job: Job;
  selected: boolean;
  onToggleSelected: (selected: boolean) => void;
}) {
  const { state, dispatch } = useWorkspace();
  const isSelected = state.activeJobId === job.id;
  const jobLinks = job as Job & { jobUrl?: string; huntrUrl?: string };

  function handleClick() {
    dispatch({ type: 'SET_ACTIVE_JOB', id: job.id });
  }

  const statusIcon = getStatusIndicator(job.status);
  const warning = getScorecardWarning(job);
  const hasJobUrl = Boolean(jobLinks.jobUrl);
  const hasHuntrUrl = Boolean(jobLinks.huntrUrl);

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group cursor-pointer rounded-[1.05rem] border px-2 py-1.5 transition-all duration-200',
        isSelected
          ? 'border-primary/30 bg-primary/[0.06] shadow-[0_10px_26px_rgba(49,74,116,0.08)]'
          : 'border-border/70 bg-white/68 hover:-translate-y-0.5 hover:border-border hover:bg-white/82'
      )}
    >
      <div className="flex items-start gap-2">
        <div onClick={(event) => event.stopPropagation()} className="pt-0.5">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onToggleSelected(checked === true)}
            className="shrink-0"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight text-foreground">
              {job.company}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
              {job.title}
            </p>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                getStageBadgeClass(job.stage)
              )}
            >
              {formatStageLabel(job.stage)}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                getStatusBadgeClass(job.status)
              )}
            >
              <span className="shrink-0">{statusIcon}</span>
              {formatStatusLabel(job.status)}
            </span>

            {warning && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
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

        {(hasJobUrl || hasHuntrUrl) && (
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            {hasJobUrl && (
              <a
                href={jobLinks.jobUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open job link"
                className="inline-flex size-6 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
            {hasHuntrUrl && (
              <a
                href={jobLinks.huntrUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open Huntr link"
                className="inline-flex size-6 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        )}
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

export function JobList({ jobs }: { jobs: Job[] }) {
  const { state, dispatch } = useWorkspace();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(state.jobs.map((job) => job.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      if (next.size !== current.size) return next;
      for (const id of current) {
        if (!next.has(id)) return next;
      }
      return current;
    });
  }, [state.jobs]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      if (sortDir === 'desc') {
        // Third click: clear sort, return to original order
        setSortField(null);
        setSortDir('asc');
      } else {
        setSortDir('desc');
      }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const sortedJobs = sortJobs(jobs, sortField, sortDir);
  const allVisibleSelected = sortedJobs.length > 0 && sortedJobs.every((job) => selectedIds.has(job.id));
  const someVisibleSelected = !allVisibleSelected && sortedJobs.some((job) => selectedIds.has(job.id));

  function handleToggleVisibleJobs(checked: boolean | 'indeterminate') {
    const visibleIds = sortedJobs.map((job) => job.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked === true) {
        visibleIds.forEach((id) => next.add(id));
      } else {
        visibleIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }

  function handleToggleJobSelection(jobId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(jobId);
      } else {
        next.delete(jobId);
      }
      return next;
    });
  }

  function handleAddSelectedToQueue() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const next = appendUniqueJobIdsToQueue({
      queue: state.tailorQueue,
      runningId: state.tailorRunning,
      total: state.tailorQueueTotal,
      incomingIds: ids,
    });

    dispatch({ type: 'SET_TAILOR_QUEUE', queue: next.queue, total: next.total });
    setSelectedIds(new Set());
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-border/70 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
              onCheckedChange={handleToggleVisibleJobs}
            />
            <p className="editorial-label">Select all visible</p>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {sortedJobs.length} roles
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {allVisibleSelected ? 'All visible roles selected' : 'Select or clear visible roles'}
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
          <div className="space-y-2 p-3">
            {sortedJobs.map((job) => (
              <JobItem
                key={job.id}
                job={job}
                selected={selectedIds.has(job.id)}
                onToggleSelected={(selected) => handleToggleJobSelection(job.id, selected)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {selectedIds.size > 0 && (
        <div className="shrink-0 border-t border-border/70 bg-card/90 px-3 py-2 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleAddSelectedToQueue} className="rounded-full">
                {selectedIds.size} selected · Add to queue
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearSelection} className="rounded-full">
                Clear selection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
