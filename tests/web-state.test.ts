import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../web/src/state.js';
import type { Job, WorkspaceState } from '../web/src/types.js';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    company: 'Acme',
    title: 'Staff Engineer',
    jd: 'Build reliable systems',
    stage: 'wishlist',
    status: 'tailored',
    checked: false,
    scoresStale: false,
    result: null,
    error: null,
    _editorData: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    ...initialState,
    jobs: [makeJob()],
    ...overrides,
  };
}

describe('web state reducer', () => {
  it('marks scores stale on a single job', () => {
    const state = makeState();
    const next = reducer(state, { type: 'SET_JOB_SCORES_STALE', id: 'job-1', stale: true });

    expect(next.jobs[0]?.scoresStale).toBe(true);
  });

  it('tracks regrade queue totals and resets them when drained', () => {
    const state = makeState();
    const queued = reducer(state, {
      type: 'SET_REGRADE_QUEUE',
      queue: ['job-1', 'job-2'],
      total: 2,
    });
    const drained = reducer(queued, {
      type: 'SET_REGRADE_QUEUE',
      queue: [],
    });

    expect(queued.regradeQueue).toEqual(['job-1', 'job-2']);
    expect(queued.regradeQueueTotal).toBe(2);
    expect(drained.regradeQueueTotal).toBe(0);
  });
});
