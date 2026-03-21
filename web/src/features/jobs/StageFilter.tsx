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
    <div className="flex flex-wrap gap-1 px-2 py-2 border-b border-border shrink-0">
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
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary border-primary/40'
                : 'bg-card text-muted-foreground border-border hover:bg-secondary/50 hover:text-foreground'
            )}
          >
            <span>{pill.label}</span>
            <span
              className={cn(
                'rounded-full px-1 text-[10px] font-semibold',
                isActive ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
