import { describe, expect, it } from 'vitest';
import { sortJobs } from '../web/src/features/jobs/sort.js';
import type { Job } from '../web/src/types.js';

function job(overrides: Partial<Job>): Job {
  return {
    id: overrides.id ?? 'x',
    company: overrides.company ?? '',
    title: overrides.title ?? '',
    jd: '',
    stage: overrides.stage ?? 'Applied',
    source: 'huntr',
    dbJobId: null,
    huntrId: overrides.id ?? 'x',
    listAddedAt: overrides.listAddedAt ?? null,
    listPosition: overrides.listPosition ?? null,
    boardId: null,
    status: 'loaded',
    checked: false,
    scoresStale: false,
    result: null,
    error: null,
    _editorData: null,
  };
}

describe('sortJobs — Added date', () => {
  it('uses listPosition (Huntr order) as the primary signal, ascending listPosition for desc', () => {
    // Huntr convention: listPosition 0 = top of list = most recently added.
    // So "Added desc" should surface listPosition 0 first.
    const jobs = [
      job({ id: 'c', listPosition: 2, listAddedAt: '2026-01-01T00:00:00Z' }),
      job({ id: 'a', listPosition: 0, listAddedAt: '2025-01-01T00:00:00Z' }),
      job({ id: 'b', listPosition: 1, listAddedAt: '2024-01-01T00:00:00Z' }),
    ];
    expect(sortJobs(jobs, 'listAddedAt', 'desc').map((j) => j.id)).toEqual(['a', 'b', 'c']);
    expect(sortJobs(jobs, 'listAddedAt', 'asc').map((j) => j.id)).toEqual(['c', 'b', 'a']);
  });

  it('falls back to timestamp when listPosition is unavailable', () => {
    const jobs = [
      job({ id: 'old', listAddedAt: '2025-01-01T00:00:00Z' }),
      job({ id: 'new', listAddedAt: '2026-01-01T00:00:00Z' }),
    ];
    expect(sortJobs(jobs, 'listAddedAt', 'desc').map((j) => j.id)).toEqual(['new', 'old']);
  });

  it('sends jobs missing both listPosition and timestamp to the bottom', () => {
    const jobs = [
      job({ id: 'missing' }),
      job({ id: 'ranked', listPosition: 3 }),
    ];
    expect(sortJobs(jobs, 'listAddedAt', 'desc').map((j) => j.id)).toEqual(['ranked', 'missing']);
    expect(sortJobs(jobs, 'listAddedAt', 'asc').map((j) => j.id)).toEqual(['ranked', 'missing']);
  });
});
