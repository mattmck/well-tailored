import { describe, expect, it } from 'vitest';
import { getJobDocumentMarkdown, getJobDocumentsForRegrade } from '../web/src/lib/job-documents.js';
import type { Job } from '../web/src/types.js';

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
    error: null,
    _editorData: null,
    result: {
      output: {
        resume: '# Resume\n\nOriginal resume',
        coverLetter: 'Original cover letter',
      },
    },
    ...overrides,
  };
}

describe('job document helpers', () => {
  it('uses resume editor data only for resume-derived content', () => {
    const job = makeJob({
      _editorData: {
        kind: 'resume',
        header: {
          name: 'Jane Doe',
          role: 'Staff Engineer',
          contact: 'jane@example.com',
          links: 'example.com',
        },
        sections: [
          {
            id: 'summary',
            heading: 'Summary',
            type: 'text',
            content: 'Edited resume summary',
            items: [],
            jobs: [],
            accepted: false,
          },
        ],
      },
    });

    expect(getJobDocumentMarkdown(job, 'resume')).toContain('Edited resume summary');
    expect(getJobDocumentMarkdown(job, 'cover')).toBe('Original cover letter');

    expect(getJobDocumentsForRegrade(job)).toEqual({
      resume: expect.stringContaining('Edited resume summary'),
      coverLetter: 'Original cover letter',
    });
  });

  it('uses cover editor data only for cover-letter-derived content', () => {
    const job = makeJob({
      _editorData: {
        kind: 'generic',
        sections: [
          {
            id: 'body',
            heading: 'Opening',
            type: 'text',
            content: 'Edited cover letter opening',
            items: [],
            jobs: [],
            accepted: false,
          },
        ],
      },
    });

    expect(getJobDocumentMarkdown(job, 'resume')).toBe('# Resume\n\nOriginal resume');
    expect(getJobDocumentMarkdown(job, 'cover')).toContain('Edited cover letter opening');

    expect(getJobDocumentsForRegrade(job)).toEqual({
      resume: '# Resume\n\nOriginal resume',
      coverLetter: expect.stringContaining('Edited cover letter opening'),
    });
  });
});
