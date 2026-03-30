import { useWorkspace } from '@/context';
import { JobQueueStatus } from './JobQueueStatus';

export function TailoringStatus() {
  const { state } = useWorkspace();

  return (
    <JobQueueStatus
      runningId={state.tailorRunning}
      startedAt={state.tailorRunningStartedAt}
      queue={state.tailorQueue}
      total={state.tailorQueueTotal}
      verb="Tailoring"
      containerClassName="border-b border-border bg-primary/5 px-4 py-2 shrink-0"
      progressClassName="mt-2 h-1.5 bg-primary/15"
    />
  );
}
