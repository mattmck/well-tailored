import { useEffect, useState } from 'react';
import { useWorkspace } from '@/context';
import { Progress } from '@/components/ui/progress';
import { formatElapsed } from '@/lib/markdown';

export function TailoringStatus() {
  const { state } = useWorkspace();
  const [elapsed, setElapsed] = useState('0s');

  useEffect(() => {
    if (!state.tailorRunning || !state.tailorRunningStartedAt) {
      setElapsed('0s');
      return;
    }

    const renderElapsed = () => setElapsed(formatElapsed(state.tailorRunningStartedAt));
    renderElapsed();

    const intervalId = window.setInterval(renderElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [state.tailorRunning, state.tailorRunningStartedAt]);

  if (!state.tailorRunning) return null;

  const currentJob = state.jobs.find((job) => job.id === state.tailorRunning);
  const total = Math.max(state.tailorQueueTotal, state.tailorQueue.length, 1);
  const remaining = Math.max(state.tailorQueue.length, 1);
  const currentPosition = Math.min(total, total - remaining + 1);
  const queuedAfterCurrent = Math.max(state.tailorQueue.length - 1, 0);
  const progress = Math.max(0, Math.min(100, (currentPosition / total) * 100));

  return (
    <div className="border-b border-border bg-primary/5 px-4 py-2 shrink-0">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0">
          <span className="font-semibold text-foreground">
            Tailoring {currentJob?.company ?? 'selected job'}
          </span>
          <span className="text-muted-foreground">
            {' '}({currentPosition} of {total})
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
      <Progress value={progress} className="mt-2 h-1.5 bg-primary/15" />
    </div>
  );
}
