import { useState } from 'react';
import { X } from 'lucide-react';
import { useWorkspace } from '../../context';
import { StageFilter } from './StageFilter';
import { JobList } from './JobList';
import { JobDetail } from './JobDetail';
import { matchesJobFilter } from './stages';

type JobPanelFilters = {
  company: string;
  title: string;
  status: string;
  notTailored: boolean;
};

const DEFAULT_FILTERS: JobPanelFilters = {
  company: '',
  title: '',
  status: 'all',
  notTailored: false,
};

export function JobsPanel() {
  const { state, dispatch } = useWorkspace();
  const [filters, setFilters] = useState<JobPanelFilters>(DEFAULT_FILTERS);

  const stageFilteredJobs =
    state.jobListFilter === 'all'
      ? state.jobs
      : state.jobs.filter((job) => matchesJobFilter(job, state.jobListFilter));

  const filteredJobs = stageFilteredJobs.filter((job) => {
    const company = filters.company.trim().toLowerCase();
    const title = filters.title.trim().toLowerCase();
    const status = filters.status.trim().toLowerCase();

    if (company && !job.company.toLowerCase().includes(company)) return false;
    if (title && !job.title.toLowerCase().includes(title)) return false;
    if (status !== 'all' && job.status !== status) return false;
    if (filters.notTailored && job.status !== 'loaded') return false;
    return true;
  });

  const anyFilterActive =
    filters.company.trim() !== ''
    || filters.title.trim() !== ''
    || filters.status !== 'all'
    || filters.notTailored
    || state.jobListFilter !== 'all';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-border/70 px-3 py-3">
        <div className="paper-pane rounded-[1.25rem] px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="editorial-label">Opportunity Queue</p>
              <h3 className="mt-1 font-[Manrope] text-base font-semibold tracking-[-0.03em] text-foreground">
                Jobs
              </h3>
            </div>
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: null })}
              className="control-chip inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
              title="Close panel"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <StageFilter />

      <div className="shrink-0 border-b border-border/70 px-3 pb-3">
        <div className="grid gap-2 pt-3 md:grid-cols-4">
          <input
            type="text"
            value={filters.company}
            onChange={(event) => setFilters((current) => ({ ...current, company: event.target.value }))}
            placeholder="Filter company…"
            className="control-chip min-w-0 rounded-full border border-border/80 bg-white/72 px-3 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
          <input
            type="text"
            value={filters.title}
            onChange={(event) => setFilters((current) => ({ ...current, title: event.target.value }))}
            placeholder="Filter role…"
            className="control-chip min-w-0 rounded-full border border-border/80 bg-white/72 px-3 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="control-chip min-w-0 rounded-full border border-border/80 bg-white/72 px-3 py-1.5 text-xs text-foreground outline-none transition-colors focus:border-ring"
          >
            <option value="all">All</option>
            <option value="loaded">Loaded</option>
            <option value="tailoring">Tailoring</option>
            <option value="tailored">Drafted</option>
            <option value="reviewed">Reviewed</option>
            <option value="error">Error</option>
          </select>
          <label className="control-chip inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/72 px-3 py-1.5 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={filters.notTailored}
              onChange={(event) => setFilters((current) => ({ ...current, notTailored: event.target.checked }))}
              className="size-3.5 rounded border-border text-primary focus:ring-primary/30"
            />
            Untailored only
          </label>
        </div>

        {anyFilterActive && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {filteredJobs.length} jobs matching
          </p>
        )}
      </div>

      <div className="flex min-h-[12rem] flex-1 flex-col overflow-hidden">
        <JobList jobs={filteredJobs} />
      </div>

      <div className="shrink-0 border-t border-border/70 bg-card/40">
        <JobDetail />
      </div>
    </div>
  );
}
