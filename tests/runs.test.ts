import { describe, expect, it, vi } from 'vitest';
import { runTailorWorkflow } from '../src/services/runs.js';
import { TailorInput } from '../src/types/index.js';

const MOCK_GAP_RESPONSE = JSON.stringify({
  matchedKeywords: [{ term: 'TypeScript', category: 'language' }],
  missingKeywords: [{ term: 'React', category: 'framework' }],
  partialMatches: [],
  impliedSkills: [],
  experienceRequirements: [],
  overallFit: 'moderate',
  narrative: 'Solid TypeScript match, React missing.',
  exactPhrases: ['TypeScript React AWS'],
  tailoringHints: ['Add React to skills section.'],
});

describe('runTailorWorkflow', () => {
  it('returns diff and gap analysis alongside generated artifacts', async () => {
    const input: TailorInput = {
      company: 'Acme',
      jobTitle: 'Senior TypeScript Engineer',
      jobDescription: 'TypeScript React AWS mentoring',
      resume: '# Jane Doe\n## Experience\n- Built internal tools',
      bio: 'Engineer focused on platform work.',
    };

    const mockComplete = vi.fn()
      .mockResolvedValueOnce('# Jane Doe\n## Experience\n- Built TypeScript tools on AWS')
      .mockResolvedValueOnce('Acme needs a Senior TypeScript Engineer.')
      .mockResolvedValueOnce(MOCK_GAP_RESPONSE);

    const result = await runTailorWorkflow({
      input,
      agents: {
        tailoringProvider: 'auto',
        tailoringModel: 'gpt-4o-mini',
        scoringProvider: 'auto',
        scoringModel: 'gpt-4o-mini',
      },
      includeScoring: false,
      complete: mockComplete,
    });

    expect(result.diff).toBeDefined();
    expect(result.diff?.stats.added).toBeGreaterThan(0);
    expect(result.gapAnalysis).toBeDefined();
    expect(result.gapAnalysis?.missingKeywords.some((kw) => kw.term === 'React')).toBe(true);
    expect(result.gapAnalysis?.exactPhrases).toBeDefined();
    expect(result.artifacts.resumeHtml).toContain('<!DOCTYPE html>');
  });
});
