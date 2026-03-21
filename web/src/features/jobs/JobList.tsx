import { useWorkspace } from '../../context';
import type { Job } from '../../types';
import { CheckCircle2, Circle, LoaderCircle, OctagonAlert, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/ui/utils';
import { formatStageLabel, getStageBadgeClass, matchesJobFilter } from './stages';

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
        <div className="flex items-center justify-between gap-1">
          <span className="text-[13px] font-semibold text-foreground truncate leading-tight">
            {job.company}
          </span>
          <span
            className={cn(
              'shrink-0 inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
              getStageBadgeClass(job.stage)
            )}
          >
            {formatStageLabel(job.stage)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-[11px] text-muted-foreground truncate leading-tight">
            {job.title}
          </span>
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

export function JobList() {
  const { state } = useWorkspace();

  const filteredJobs =
    state.jobListFilter === 'all'
      ? state.jobs
      : state.jobs.filter((job) => matchesJobFilter(job, state.jobListFilter));

  if (filteredJobs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">
          {state.jobs.length === 0
            ? 'No jobs loaded. Click "Load Huntr" to import jobs.'
            : 'No jobs match the current filter.'}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div>
        {filteredJobs.map((job) => (
          <JobItem key={job.id} job={job} />
        ))}
      </div>
    </ScrollArea>
  );
}
