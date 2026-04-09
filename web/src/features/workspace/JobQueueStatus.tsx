import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useWorkspace } from '@/context';
import { formatElapsed } from '@/lib/markdown';

interface JobQueueStatusProps {
  runningId: string | null;
  startedAt: number;
  queue: string[];
  total: number;
  verb: string;
  progressClassName: string;
  containerClassName: string;
  summary?: { tailored: number; failed: number } | null;
}

export function JobQueueStatus({
  runningId,
  startedAt,
  queue,
  total,
  verb,
  progressClassName,
  containerClassName,
  summary = null,
}: JobQueueStatusProps) {
  const { state, dispatch } = useWorkspace();
  const [elapsed, setElapsed] = useState('0s');

  useEffect(() => {
    if (!runningId || !startedAt) {
      setElapsed('0s');
      return;
    }

    const renderElapsed = () => setElapsed(formatElapsed(startedAt));
    renderElapsed();

    const intervalId = window.setInterval(renderElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [runningId, startedAt]);

  if (!runningId) {
    if (!summary) return null;

    const hasFailures = summary.failed > 0;
    return (
      <div className={containerClassName}>
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <span className="font-semibold text-foreground">
              Run complete: {summary.tailored} tailored, {summary.failed} failed
            </span>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_TAILOR_SUMMARY', summary: null })}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/80 hover:text-foreground"
            aria-label="Dismiss tailoring summary"
            title="Dismiss tailoring summary"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className={hasFailures ? 'mt-1 text-[11px] text-amber-700' : 'mt-1 text-[11px] text-emerald-700'}>
          {hasFailures ? 'Some jobs need attention before retrying.' : 'All queued jobs finished successfully.'}
        </div>
      </div>
    );
  }

  const currentJob = state.jobs.find((job) => job.id === runningId);
  const resolvedTotal = Math.max(total, queue.length, 1);
  const queuedCount = queue.length;
  const currentPosition = Math.min(resolvedTotal, resolvedTotal - queuedCount + 1);
  const queuedAfterCurrent = Math.max(queue.length - 1, 0);
  const progress = Math.max(0, Math.min(100, (currentPosition / resolvedTotal) * 100));

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0">
          <span className="font-semibold text-foreground">
            {verb} {currentJob?.company ?? 'selected job'}
          </span>
          <span className="text-muted-foreground">
            {' '}({currentPosition} of {resolvedTotal})
          </span>
          {currentJob?.title && (
            <span className="text-muted-foreground">
              {' '}· {currentJob.title}
            </span>
          )}
        </div>
        <div className="shrink-0 text-muted-foreground">
          {elapsed}{queuedAfterCurrent > 0 ? ` · ${queuedAfterCurrent} queued` : ''}
        </div>
      </div>
      <Progress value={progress} className={progressClassName} />
    </div>
  );
}
