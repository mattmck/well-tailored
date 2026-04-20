import { describe, expect, it } from 'vitest';
import { getTailorTaskMetadata } from '../web/src/lib/tasks.js';
import type { TaskRecord } from '../web/src/api/client.js';

function makeTask(inputJson: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    workspaceId: 'workspace-1',
    jobId: 'db-job-1',
    type: 'tailor',
    status: 'completed',
    inputJson,
    resultJson: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('getTailorTaskMetadata', () => {
  it('reads the frontend job id from nested task input', () => {
    const task = makeTask(JSON.stringify({
      input: {
        _frontendJobId: 'huntr-job-1',
        company: 'Acme',
        jobTitle: 'Staff Engineer',
      },
      agents: {},
    }));

    expect(getTailorTaskMetadata(task)).toEqual({
      frontendJobId: 'huntr-job-1',
      company: 'Acme',
      jobTitle: 'Staff Engineer',
    });
  });

  it('falls back to legacy top-level input and then DB job id', () => {
    expect(getTailorTaskMetadata(makeTask(JSON.stringify({ _frontendJobId: 'legacy-1' }))).frontendJobId).toBe('legacy-1');
    expect(getTailorTaskMetadata(makeTask(JSON.stringify({}))).frontendJobId).toBe('db-job-1');
  });

  it('falls back to DB job id when input json is malformed', () => {
    expect(getTailorTaskMetadata(makeTask('{')).frontendJobId).toBe('db-job-1');
  });
});
