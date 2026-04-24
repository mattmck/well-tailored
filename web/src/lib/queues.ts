export interface AppendJobIdsOptions {
  queue: string[];
  runningId: string | null;
  total: number;
  incomingIds: string[];
}

export interface AppendJobIdsResult {
  queue: string[];
  total: number;
  added: string[];
}

export interface QueueProgressOptions {
  queue: string[];
  total: number;
  hasRunning: boolean;
  queueIncludesRunning?: boolean;
}

export interface QueueProgressResult {
  resolvedTotal: number;
  currentPosition: number;
  queuedAfterCurrent: number;
  progress: number;
}

export function appendUniqueJobIdsToQueue({
  queue,
  runningId,
  total,
  incomingIds,
}: AppendJobIdsOptions): AppendJobIdsResult {
  const existing = new Set(queue);
  if (runningId) {
    existing.add(runningId);
  }

  const added = incomingIds.filter((id) => {
    if (existing.has(id)) return false;
    existing.add(id);
    return true;
  });

  if (added.length === 0) {
    return { queue, total, added: [] };
  }

  const nextQueue = [...queue, ...added];
  const activeCount = queue.length + (runningId ? 1 : 0);

  return {
    queue: nextQueue,
    total: Math.max(total, activeCount) + added.length,
    added,
  };
}

export function getQueueProgress({
  queue,
  total,
  hasRunning,
  queueIncludesRunning = true,
}: QueueProgressOptions): QueueProgressResult {
  const activeCount = queue.length + (hasRunning && !queueIncludesRunning ? 1 : 0);
  const resolvedTotal = Math.max(total, activeCount, hasRunning ? 1 : 0);
  const remainingIncludingCurrent = hasRunning ? activeCount : 0;
  const currentPosition = hasRunning
    ? Math.max(1, resolvedTotal - remainingIncludingCurrent + 1)
    : 0;
  const queuedAfterCurrent = Math.max(
    queueIncludesRunning ? queue.length - (hasRunning ? 1 : 0) : queue.length,
    0,
  );
  const progress = hasRunning && resolvedTotal > 0
    ? Math.max(0, Math.min(100, (currentPosition / resolvedTotal) * 100))
    : 0;

  return {
    resolvedTotal,
    currentPosition,
    queuedAfterCurrent,
    progress,
  };
}
