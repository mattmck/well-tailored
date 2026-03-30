import { useWorkspace } from '@/context';
import { JobQueueStatus } from './JobQueueStatus';

export function RegradingStatus() {
  const { state } = useWorkspace();

  return (
    <JobQueueStatus
      runningId={state.regradeRunning}
      startedAt={state.regradeRunningStartedAt}
      queue={state.regradeQueue}
      total={state.regradeQueueTotal}
      verb="Re-grading"
      containerClassName="border-b border-border bg-amber-500/5 px-4 py-2 shrink-0"
      progressClassName="mt-2 h-1.5 bg-amber-500/15"
    />
  );
}
