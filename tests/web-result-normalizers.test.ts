import { describe, expect, it } from 'vitest';
import { normalizeTailorResult } from '../web/src/lib/result-normalizers.js';

describe('normalizeTailorResult', () => {
  it('keeps heuristic-only scorecards displayable', () => {
    const result = normalizeTailorResult({
      output: {
        resume: '# Resume',
        coverLetter: 'Cover letter',
      },
      scorecard: {
        heuristic: {
          overall: 76,
          keywordAlignment: 82,
          quantifiedImpact: 70,
          structure: 88,
          coverLetterSpecificity: 72,
          aiObviousnessRisk: 18,
          warnings: ['Evaluator scoring failed: timeout'],
        },
      },
      gapAnalysis: {
        matched: ['typescript'],
        missing: ['react'],
        partial: [],
        fitRating: 'good',
      },
    });

    expect(result?.scorecard?.overall).toBe(76);
    expect(result?.scorecard?.documents[0]?.label).toBe('Resume');
    expect(result?.scorecard?.categories.map((category) => category.name)).toContain('Keyword Alignment');
    expect(result?.scorecard?.notes).toContain('Evaluator scoring failed: timeout');
  });
});
