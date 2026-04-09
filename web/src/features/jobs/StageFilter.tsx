import { useWorkspace } from '../../context';
import type { JobListFilter } from '../../types';
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

      <div className="mt-2">
        <select
          value={state.jobListFilter}
          onChange={(event) => handleClick(event.target.value as JobListFilter)}
          className="control-chip w-full rounded-full border border-border/80 bg-white/72 px-3 py-1.5 text-xs text-foreground outline-none transition-colors focus:border-ring"
        >
          {filterPills.map((pill) => {
            const count = getCount(pill.value);
            const selected =
              pill.value === 'all'
                ? state.jobListFilter === 'all'
                : normalizeStage(state.jobListFilter) === normalizeStage(pill.value);

            return (
              <option key={pill.value} value={pill.value}>
                {selected ? 'Current: ' : ''}{pill.label} ({count})
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
