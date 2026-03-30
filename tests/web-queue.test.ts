import { describe, expect, it } from 'vitest';
import { appendUniqueJobIdsToQueue } from '../web/src/lib/queues.js';

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
