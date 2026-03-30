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
