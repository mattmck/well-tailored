import { useEffect, useState } from 'react';
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
}

export function JobQueueStatus({
  runningId,
  startedAt,
  queue,
  total,
  verb,
  progressClassName,
  containerClassName,
}: JobQueueStatusProps) {
  const { state } = useWorkspace();
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

  if (!runningId) return null;

  const currentJob = state.jobs.find((job) => job.id === runningId);
  const resolvedTotal = Math.max(total, queue.length, 1);
  const remaining = Math.max(queue.length, 1);
  const currentPosition = Math.min(resolvedTotal, resolvedTotal - remaining + 1);
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
