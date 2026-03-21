import { useWorkspace } from '../../context';
import { Input } from '@/components/ui/input';

export function JobDetail() {
  const { state, dispatch } = useWorkspace();

  const job = state.activeJobId
    ? state.jobs.find((j) => j.id === state.activeJobId)
    : null;

  if (!job) {
    return (
      <div className="px-3 py-4 shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          Select a job to view details
        </p>
      </div>
    );
  }

  function handleCompanyChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ type: 'UPDATE_JOB', id: job!.id, patch: { company: e.target.value } });
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ type: 'UPDATE_JOB', id: job!.id, patch: { title: e.target.value } });
  }

  function handleJdChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    dispatch({ type: 'UPDATE_JOB', id: job!.id, patch: { jd: e.target.value } });
  }

  return (
    <div className="shrink-0 max-h-[48%] min-h-[220px] overflow-hidden p-2 flex flex-col gap-2">
      {/* Company + Title row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Company
          </label>
          <Input
            value={job.company}
            onChange={handleCompanyChange}
            className="h-7 text-xs px-2"
            placeholder="Company name"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Title
          </label>
          <Input
            value={job.title}
            onChange={handleTitleChange}
            className="h-7 text-xs px-2"
            placeholder="Job title"
          />
        </div>
      </div>

      {/* Stage display */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Stage
        </label>
        <div className="text-xs text-foreground px-2 py-1 bg-secondary/30 rounded-md border border-border">
          {job.stage || '—'}
        </div>
      </div>

      {/* JD textarea */}
      <div className="flex flex-col gap-1 flex-1 min-h-0">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Job Description
        </label>
        <textarea
          value={job.jd}
          onChange={handleJdChange}
          className="bg-card border border-border rounded-md text-xs font-mono leading-relaxed p-2 w-full flex-1 min-h-[140px] resize-none outline-none focus:border-ring transition-colors text-foreground placeholder:text-muted-foreground overflow-y-auto"
          placeholder="Paste job description here…"
          spellCheck={false}
        />
      </div>

      {/* Error display */}
      {job.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-2 py-1.5">
          <p className="text-xs text-destructive font-medium">Error</p>
          <p className="text-xs text-destructive/80 mt-0.5">{job.error}</p>
        </div>
      )}
    </div>
  );
}
