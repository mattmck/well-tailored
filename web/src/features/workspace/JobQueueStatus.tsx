import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { useWorkspace } from '@/context';
import { formatElapsed } from '@/lib/markdown';
import { getQueueProgress } from '@/lib/queues';

interface JobQueueStatusProps {
  runningId: string | null;
  startedAt: number;
  queue: string[];
  total: number;
  verb: string;
  detail?: string;
  progressClassName: string;
  containerClassName: string;
  queueIncludesRunning?: boolean;
}

export function JobQueueStatus({
  runningId,
  startedAt,
  queue,
  total,
  verb,
  detail,
  progressClassName,
  containerClassName,
  queueIncludesRunning = true,
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
  const {
    resolvedTotal,
    currentPosition,
    queuedAfterCurrent,
    progress,
  } = getQueueProgress({
    queue,
    total,
    hasRunning: Boolean(runningId),
    queueIncludesRunning,
  });

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
          {detail && (
            <span className="text-muted-foreground">
              {' '}· {detail}
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
