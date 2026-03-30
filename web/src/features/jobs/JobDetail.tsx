import { useEffect, useState } from 'react';
import { useWorkspace } from '../../context';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/components/ui/utils';

export function JobDetail() {
  const { state, dispatch } = useWorkspace();
  const [expanded, setExpanded] = useState(false);

  const job = state.activeJobId
    ? state.jobs.find((j) => j.id === state.activeJobId)
    : null;

  useEffect(() => {
    setExpanded(false);
  }, [job?.id]);

  if (!job) {
    return (
      <div className="px-3 py-3 shrink-0">
        <div className="paper-pane rounded-[1.2rem] px-4 py-4">
          <p className="editorial-label">Selected Role</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a job to review and edit its source details.
          </p>
        </div>
      </div>
    );
  }
  const currentJob = job;

  function markScoresStale() {
    if (!currentJob.result) return;
    dispatch({ type: 'SET_JOB_SCORES_STALE', id: currentJob.id, stale: true });
  }

  function handleCompanyChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ type: 'UPDATE_JOB', id: currentJob.id, patch: { company: e.target.value } });
    markScoresStale();
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ type: 'UPDATE_JOB', id: currentJob.id, patch: { title: e.target.value } });
    markScoresStale();
  }

  function handleJdChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    dispatch({ type: 'UPDATE_JOB', id: currentJob.id, patch: { jd: e.target.value } });
    markScoresStale();
  }

  return (
    <div className="shrink-0 px-3 py-3">
      <div className="paper-pane flex flex-col rounded-[1.25rem] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="editorial-label">Selected Role</p>
            <h3 className="mt-1 truncate font-[Manrope] text-base font-semibold tracking-[-0.03em] text-foreground">
              {job.company}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {job.title}
            </p>
          </div>

          <span className="control-chip rounded-full px-2.5 py-1 text-[11px] font-medium text-foreground">
            {job.stage || 'Unknown stage'}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Keep the queue visible. Expand details only when you need to edit the source.
          </p>
          <button
            onClick={() => setExpanded((current) => !current)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
              expanded
                ? 'border-primary/20 bg-primary/10 text-primary'
                : 'border-border bg-white/70 text-muted-foreground hover:text-foreground'
            )}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? 'Hide details' : 'Edit details'}
          </button>
        </div>

        {expanded && (
          <div className="mt-4 flex max-h-[34vh] flex-col overflow-y-auto">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Company
                </label>
                <Input
                  value={job.company}
                  onChange={handleCompanyChange}
                  className="h-9 text-sm"
                  placeholder="Company name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Title
                </label>
                <Input
                  value={job.title}
                  onChange={handleTitleChange}
                  className="h-9 text-sm"
                  placeholder="Job title"
                />
              </div>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Job Description
              </label>
              <textarea
                value={job.jd}
                onChange={handleJdChange}
                className="paper-pane min-h-[150px] w-full flex-1 resize-none rounded-[1rem] p-3 text-sm font-mono leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                placeholder="Paste job description here…"
                spellCheck={false}
              />
            </div>

            {job.error && (
              <div className="mt-3 rounded-[0.95rem] border border-destructive/30 bg-destructive/10 px-3 py-2">
                <p className="text-xs font-medium text-destructive">Error</p>
                <p className="mt-1 text-xs text-destructive/80">{job.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
