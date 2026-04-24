import { describe, expect, it } from 'vitest';
import { appendUniqueJobIdsToQueue, getQueueProgress } from '../web/src/lib/queues.js';

describe('appendUniqueJobIdsToQueue', () => {
  it('starts a fresh queue with the incoming ids', () => {
    const result = appendUniqueJobIdsToQueue({
      queue: [],
      runningId: null,
      total: 0,
      incomingIds: ['job-1', 'job-2'],
    });

    expect(result).toEqual({
      queue: ['job-1', 'job-2'],
      total: 2,
      added: ['job-1', 'job-2'],
    });
  });

  it('appends only new ids and preserves active work in progress', () => {
    const result = appendUniqueJobIdsToQueue({
      queue: ['job-2'],
      runningId: 'job-1',
      total: 2,
      incomingIds: ['job-1', 'job-2', 'job-3'],
    });

    expect(result).toEqual({
      queue: ['job-2', 'job-3'],
      total: 3,
      added: ['job-3'],
    });
  });
});

describe('getQueueProgress', () => {
  it('treats tailoring queues as excluding the running job', () => {
    expect(getQueueProgress({
      queue: ['job-2', 'job-3', 'job-4'],
      total: 4,
      hasRunning: true,
      queueIncludesRunning: false,
    })).toEqual({
      resolvedTotal: 4,
      currentPosition: 1,
      queuedAfterCurrent: 3,
      progress: 25,
    });
  });

  it('preserves the final position while the last tailoring job is still running', () => {
    expect(getQueueProgress({
      queue: [],
      total: 4,
      hasRunning: true,
      queueIncludesRunning: false,
    })).toEqual({
      resolvedTotal: 4,
      currentPosition: 4,
      queuedAfterCurrent: 0,
      progress: 100,
    });
  });

  it('still supports queues that include the running job', () => {
    const result = getQueueProgress({
      queue: ['job-1', 'job-2', 'job-3'],
      total: 3,
      hasRunning: true,
      queueIncludesRunning: true,
    });

    expect(result.resolvedTotal).toBe(3);
    expect(result.currentPosition).toBe(1);
    expect(result.queuedAfterCurrent).toBe(2);
    expect(result.progress).toBeCloseTo(33.33333333333333, 10);
  });
});
