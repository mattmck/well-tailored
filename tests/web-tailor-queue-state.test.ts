import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../web/src/state.js';

describe('tailor queue state', () => {
  it('preserves tailoring totals while the last queued job is still running', () => {
    const state = {
      ...initialState,
      tailorQueue: ['job-1'],
      tailorQueueTotal: 4,
      tailorRunning: 'job-4',
    };

    const runningLastJob = reducer(state, {
      type: 'SET_TAILOR_QUEUE',
      queue: [],
    });
    const completed = reducer(runningLastJob, {
      type: 'SET_TAILOR_RUNNING',
      id: null,
    });

    expect(runningLastJob.tailorQueueTotal).toBe(4);
    expect(completed.tailorQueueTotal).toBe(0);
  });
});
