import { describe, expect, it, vi } from 'vitest';
import {
  buildHeuristicScorecard,
  evaluateScorecard,
  scoreTailoredOutput,
} from '../src/services/scoring.js';
import { TailorInput, TailorOutput } from '../src/types/index.js';

const input: TailorInput = {
  company: 'Acme',
  jobTitle: 'Senior TypeScript Engineer',
  jobDescription: 'Build TypeScript services, APIs, observability, and scalable systems for customers.',
  resume: '# Jane Doe\n## Experience\n- Built TypeScript APIs\n- Improved observability',
  bio: 'Backend engineer focused on reliable services.',
  resumeSupplemental: 'Mentored engineers and improved delivery quality.',
};

const output: TailorOutput = {
  resume: `# Jane Doe
## Experience
### Staff Engineer | Example | Remote
2022 - Present
- Built TypeScript APIs used by 120 enterprise customers.
- Improved observability, cutting MTTR by 35%.
- Mentored 4 engineers across platform teams.`,
  coverLetter: `Acme needs a Senior TypeScript Engineer who can ship reliable services and improve developer workflows.

I have led TypeScript API work, observability improvements, and cross-team execution in environments that value practical engineering judgment.

The combination of scalable systems work and team-level influence is exactly why this role stands out to me.`,
};

describe('buildHeuristicScorecard', () => {
  it('returns keyword matches, warnings, and a bounded overall score', () => {
    const scorecard = buildHeuristicScorecard(input, output);

    expect(scorecard.overall).toBeGreaterThan(0);
    expect(scorecard.overall).toBeLessThanOrEqual(100);
    expect(scorecard.matchedKeywords).toContain('typescript');
    expect(scorecard.aiObviousnessRisk).toBeLessThan(40);
  });
});

describe('evaluateScorecard', () => {
  it('parses evaluator JSON from the model response', async () => {
    const mockComplete = vi.fn().mockResolvedValue(`{
      "overall": 84,
      "atsCompatibility": 81,
      "recruiterClarity": 86,
      "hrClarity": 80,
      "aiObviousness": 78,
      "factualRisk": 90,
      "notes": ["Strong alignment with the role.", "Could use one more product outcome."]
    }`);

    const scorecard = await evaluateScorecard(
      input,
      output,
      'gpt-4o-mini',
      undefined,
      false,
      mockComplete,
    );

    expect(scorecard.overall).toBe(84);
    expect(scorecard.notes).toHaveLength(2);
  });
});

describe('scoreTailoredOutput', () => {
  it('falls back to heuristics when evaluator scoring fails', async () => {
    const mockComplete = vi.fn().mockRejectedValue(new Error('boom'));

    const scorecard = await scoreTailoredOutput({
      input,
      output,
      scoringModel: 'gpt-4o-mini',
      complete: mockComplete,
    });

    expect(scorecard.evaluator).toBeUndefined();
    expect(scorecard.heuristic.warnings.join(' ')).toContain('Evaluator scoring failed');
  });
});
