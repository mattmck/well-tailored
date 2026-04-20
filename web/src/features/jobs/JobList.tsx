import { useState, useEffect } from 'react';
import { useWorkspace } from '../../context';
import type { Job } from '../../types';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Circle,
  LoaderCircle,
  OctagonAlert,
  Search,
  Sparkles,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/ui/utils';
import { formatStageLabel, getDisplayStage, getStageBadgeClass, matchesJobFilter } from './stages';

const STAGE_ORDER = [
  'wishlist', 'applied', 'interview', 'offer', 'rejected', 'timeout', 'old wishlist', 'manual', 'other',
] as const;

const EXPANDED_STORAGE_KEY = 'wt-expanded-stages';

function loadExpandedGroups(): Set<string> {
  try {
    const stored = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored) as string[]);
  } catch { /* ignore */ }
  // Default: only wishlist open
  return new Set(['wishlist']);
}

function saveExpandedGroups(groups: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...groups]));
  } catch { /* ignore */ }
}

function getScorecardWarning(job: Job): 'error' | 'warn' | null {
  const scorecard = job.result?.scorecard;
  if (!scorecard) return null;
  if (scorecard.verdict === 'do_not_submit' || scorecard.blockingIssues.length > 0) return 'error';
  if (scorecard.verdict === 'needs_revision') return 'warn';
  return null;
}

type SortField = 'company' | 'title' | 'status' | 'listAddedAt';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<Job['status'], number> = {
  loaded: 0, tailored: 1, reviewed: 2, tailoring: 3, error: 4,
};

function sortJobs(jobs: Job[], field: SortField | null, dir: SortDir): Job[] {
  if (!field) return jobs;
  return [...jobs].sort((a, b) => {
    let cmp: number;
    if (field === 'status') {
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    } else if (field === 'listAddedAt') {
      return compareByAddedDate(a, b, dir);
    } else {
      cmp = (a[field] ?? '').localeCompare(b[field] ?? '');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

function getAddedTime(job: Job): number | null {
  const time = Date.parse(job.listAddedAt ?? '');
  return Number.isFinite(time) ? time : null;
}

function compareByAddedDate(a: Job, b: Job, dir: SortDir): number {
  const aTime = getAddedTime(a);
  const bTime = getAddedTime(b);

  // Jobs without Huntr timestamps should not jump to the top in either direction.
  if (aTime === null && bTime === null) return compareByStableFallback(a, b);
  if (aTime === null) return 1;
  if (bTime === null) return -1;

  const dateCmp = dir === 'asc' ? aTime - bTime : bTime - aTime;
  if (dateCmp !== 0) return dateCmp;

  const positionCmp = (a.listPosition ?? Number.MAX_SAFE_INTEGER) - (b.listPosition ?? Number.MAX_SAFE_INTEGER);
  if (positionCmp !== 0) return positionCmp;

  return compareByStableFallback(a, b);
}

function compareByStableFallback(a: Job, b: Job): number {
  const companyCmp = (a.company ?? '').localeCompare(b.company ?? '');
  if (companyCmp !== 0) return companyCmp;
  return (a.title ?? '').localeCompare(b.title ?? '');
}

function formatAddedDate(value: string | null | undefined): string | null {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(time));
}

function getStatusIndicator(status: Job['status']) {
  switch (status) {
    case 'loaded': return <Circle className="h-3.5 w-3.5" strokeWidth={2} />;
    case 'tailoring': return <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />;
    case 'tailored': return <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />;
    case 'reviewed': return <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />;
    case 'error': return <OctagonAlert className="h-3.5 w-3.5" strokeWidth={2} />;
    default: return <Circle className="h-3.5 w-3.5" strokeWidth={2} />;
  }
}

function formatStatusLabel(status: Job['status']) {
  switch (status) {
    case 'loaded': return 'Loaded';
    case 'tailoring': return 'Tailoring';
    case 'tailored': return 'Drafted';
    case 'reviewed': return 'Reviewed';
    case 'error': return 'Error';
    default: return status;
  }
}

function getStatusBadgeClass(status: Job['status']) {
  switch (status) {
    case 'loaded': return 'border-border bg-white/70 text-muted-foreground';
    case 'tailoring': return 'border-amber-500/20 bg-amber-500/10 text-amber-700';
    case 'tailored': return 'border-primary/20 bg-primary/10 text-primary';
    case 'reviewed': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700';
    case 'error': return 'border-destructive/20 bg-destructive/10 text-destructive';
    default: return 'border-border bg-white/70 text-muted-foreground';
  }
}

function JobItem({ job }: { job: Job }) {
  const { state, dispatch } = useWorkspace();
  const isSelected = state.activeJobId === job.id;
  const isJdOpen = state.activePanel === 'jd';

  function handleClick() {
    dispatch({ type: 'SET_ACTIVE_JOB', id: job.id });
    // Don't change panel state — JD stays open/closed as-is
  }

  function handleMagnifyClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isSelected && isJdOpen) {
      dispatch({ type: 'SET_ACTIVE_PANEL', panel: null });
    } else {
      dispatch({ type: 'SET_ACTIVE_JOB', id: job.id });
      dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'jd' });
    }
  }

  function handleCheckChange(checked: boolean | 'indeterminate') {
    dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { checked: checked === true } });
  }

  const statusIcon = getStatusIndicator(job.status);
  const warning = getScorecardWarning(job);
  const addedDate = formatAddedDate(job.listAddedAt);

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
          <Checkbox checked={job.checked} onCheckedChange={handleCheckChange} className="shrink-0" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">{job.company}</p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">{job.title}</p>
            </div>
            <button
              onClick={handleMagnifyClick}
              title="View job description"
              className={cn(
                'mt-0.5 shrink-0 inline-flex size-6 items-center justify-center rounded-full transition-colors',
                isSelected && isJdOpen
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/50 hover:bg-white hover:text-foreground'
              )}
            >
              <Search size={11} strokeWidth={2} />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
              getStatusBadgeClass(job.status)
            )}>
              {statusIcon}
              {formatStatusLabel(job.status)}
            </span>

            {warning && (
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                warning === 'error'
                  ? 'border-destructive/20 bg-destructive/10 text-destructive'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-700'
              )}>
                {warning === 'error' ? 'Blocking issues' : 'Needs revision'}
              </span>
            )}

            {addedDate && (
              <span className="inline-flex items-center rounded-full border border-border bg-white/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Added {addedDate}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function groupJobsByStage(jobs: Job[]): { stage: string; jobs: Job[] }[] {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const stage = getDisplayStage(job) || 'other';
    if (!groups.has(stage)) groups.set(stage, []);
    groups.get(stage)!.push(job);
  }
  return [...groups.entries()]
    .map(([stage, stageJobs]) => ({ stage, jobs: stageJobs }))
    .sort((a, b) => {
      const ai = STAGE_ORDER.indexOf(a.stage as (typeof STAGE_ORDER)[number]);
      const bi = STAGE_ORDER.indexOf(b.stage as (typeof STAGE_ORDER)[number]);
      if (ai === -1 && bi === -1) return a.stage.localeCompare(b.stage);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'company', label: 'Co.' },
  { field: 'title', label: 'Title' },
  { field: 'status', label: 'Status' },
  { field: 'listAddedAt', label: 'Added' },
];

export function JobList({ variant = 'panel' }: { variant?: 'panel' | 'sidebar' }) {
  const { state, dispatch } = useWorkspace();
  const [sortField, setSortField] = useState<SortField | null>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(loadExpandedGroups);

  // Ensure any brand-new stage that appears is collapsed (not in expandedGroups) unless it's wishlist
  // (expandedGroups already handles this by only containing explicitly expanded stages)

  useEffect(() => {
    saveExpandedGroups(expandedGroups);
  }, [expandedGroups]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'listAddedAt' ? 'desc' : 'asc');
    }
  }

  function toggleGroup(stage: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  function expandAll() {
    setExpandedGroups(new Set(groups.map((group) => group.stage)));
  }

  function collapseAll() {
    setExpandedGroups(new Set());
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredJobs = state.jobs
    .filter((job) => state.jobListFilter === 'all' || matchesJobFilter(job, state.jobListFilter))
    .filter((job) => {
      if (!normalizedSearch) return true;
      return `${job.company} ${job.title}`.toLowerCase().includes(normalizedSearch);
    });

  const groups = groupJobsByStage(filteredJobs).map((g) => ({
    ...g,
    jobs: sortJobs(g.jobs, sortField, sortDir),
  }));

  const allVisibleJobs = groups.flatMap((g) => g.jobs);
  const allVisibleChecked = allVisibleJobs.length > 0 && allVisibleJobs.every((job) => job.checked);
  const someVisibleChecked = !allVisibleChecked && allVisibleJobs.some((job) => job.checked);

  function handleToggleVisibleJobs(checked: boolean | 'indeterminate') {
    dispatch({
      type: 'SET_JOBS_CHECKED',
      ids: allVisibleJobs.map((job) => job.id),
      checked: checked === true,
    });
  }

  const jobListContent = (
    <div className="space-y-1 p-3">
      {groups.map(({ stage, jobs: groupJobs }) => {
        const isExpanded = expandedGroups.has(stage);
        return (
          <div key={stage}>
            <button
              onClick={() => toggleGroup(stage)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-black/[0.03]"
            >
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                getStageBadgeClass(stage)
              )}>
                {formatStageLabel(stage)}
              </span>
              <span className="text-[11px] text-muted-foreground">{groupJobs.length}</span>
              <div className="ml-auto text-muted-foreground/60">
                {isExpanded
                  ? <ChevronUp size={13} strokeWidth={2} />
                  : <ChevronDown size={13} strokeWidth={2} />}
              </div>
            </button>

            {isExpanded && (
              <div className="mt-1 mb-2 ml-1 space-y-2">
                {groupJobs.map((job) => <JobItem key={job.id} job={job} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={variant === 'sidebar' ? 'flex flex-col' : 'flex flex-col flex-1 min-h-0 overflow-hidden'}>
      <div className="shrink-0 border-b border-border/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allVisibleChecked ? true : someVisibleChecked ? 'indeterminate' : false}
              onCheckedChange={handleToggleVisibleJobs}
            />
            <p className="editorial-label">List</p>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {allVisibleJobs.length} roles
          </span>
        </div>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search company or role"
            className="h-9 rounded-full bg-white/75 pl-8 text-xs"
          />
        </div>

        <div className="-mx-1 mt-2 overflow-x-auto px-1">
          <div className="flex min-w-max items-center gap-2">
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
            <span className="mx-1 h-5 w-px bg-border/80" />
            <button
              type="button"
              onClick={expandAll}
              aria-label="Expand all stages"
              title="Expand all stages"
              className="inline-flex size-7 items-center justify-center rounded-full border border-border/80 bg-white/70 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
            >
              <ChevronsDown size={13} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onClick={collapseAll}
              aria-label="Collapse all stages"
              title="Collapse all stages"
              className="inline-flex size-7 items-center justify-center rounded-full border border-border/80 bg-white/70 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
            >
              <ChevronsUp size={13} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>

      {allVisibleJobs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            {state.jobs.length === 0
              ? 'No jobs loaded. Click "Load Huntr" to import jobs.'
              : 'No jobs match the current filter.'}
          </p>
        </div>
      ) : variant === 'sidebar' ? (
        jobListContent
      ) : (
        <ScrollArea className="flex-1 min-h-0">{jobListContent}</ScrollArea>
      )}
    </div>
  );
}
