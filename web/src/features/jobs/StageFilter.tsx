import { useWorkspace } from '../../context';
import type { JobListFilter } from '../../types';
import { cn } from '@/components/ui/utils';
import { formatStageLabel, getStageFilterValues, matchesJobFilter, normalizeStage } from './stages';

interface FilterPill {
  value: JobListFilter;
  label: string;
}

export function StageFilter() {
  const { state, dispatch } = useWorkspace();
  const filterPills: FilterPill[] = [
    { value: 'all', label: 'All' },
    ...getStageFilterValues(state.jobs).map((value) => ({
      value,
      label: formatStageLabel(value),
    })),
  ];

  function getCount(filter: JobListFilter): number {
    if (filter === 'all') return state.jobs.length;
    return state.jobs.filter((job) => matchesJobFilter(job, filter)).length;
  }

  function handleClick(filter: JobListFilter) {
    dispatch({ type: 'SET_JOB_FILTER', filter });
  }

  return (
    <div className="shrink-0 border-b border-border/70 px-3 pb-3">
      <div className="flex items-center justify-between gap-2 pt-3">
        <p className="editorial-label">Filter</p>
        <span className="text-[11px] font-medium text-muted-foreground">
          {getCount(state.jobListFilter)} shown
        </span>
      </div>

      <div className="-mx-1 mt-2 overflow-x-auto px-1">
        <div className="flex min-w-max gap-2">
          {filterPills.map((pill) => {
            const count = getCount(pill.value);
            const isActive =
              pill.value === 'all'
                ? state.jobListFilter === 'all'
                : normalizeStage(state.jobListFilter) === normalizeStage(pill.value);
            return (
              <button
                key={pill.value}
                onClick={() => handleClick(pill.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-primary/10 text-primary border-primary/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]'
                    : 'bg-white/70 text-muted-foreground border-border hover:bg-secondary/45 hover:text-foreground'
                )}
              >
                <span>{pill.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    isActive ? 'bg-primary/15 text-primary' : 'bg-secondary/80 text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
