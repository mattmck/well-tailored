import { describe, expect, it } from 'vitest';
import { analyzeGapWithAI } from '../src/services/gap.js';

describe('analyzeGapWithAI', () => {
  it('parses structured AI response into GapAnalysis', async () => {
    const result = await analyzeGapWithAI(
      'Built React dashboards and TypeScript services.',
      'Frontend-leaning engineer with product collaboration experience.',
      'Need React.js, TypeScript, and mentoring skills.',
      'Senior Frontend Engineer',
      'test-model',
      async () => JSON.stringify({
        matchedKeywords: [
          { term: 'React', category: 'framework' },
          { term: 'TypeScript', category: 'language' },
        ],
        missingKeywords: [
          { term: 'Mentoring', category: 'leadership' },
        ],
        partialMatches: [
          { jdTerm: 'React.js', resumeTerm: 'React', relationship: 'synonym' },
        ],
        impliedSkills: [
          { term: 'component design', category: 'architecture', rationale: 'implied by frontend dashboard work' },
        ],
        experienceRequirements: [],
        overallFit: 'moderate',
        narrative: 'Strong core overlap on React and TypeScript, with mentoring as the clearest gap.',
        exactPhrases: ['React dashboards', 'TypeScript services'],
        tailoringHints: [
          'Lead with React dashboard work near the top of the resume.',
          'Call out TypeScript service ownership with concrete outcomes.',
        ],
      }),
    );

    expect(result.matchedKeywords).toHaveLength(2);
    expect(result.missingKeywords).toHaveLength(1);
    expect(result.partialMatches).toHaveLength(1);
    expect(result.impliedSkills).toHaveLength(1);
    expect(result.impliedSkills[0].rationale).toBeTruthy();
    expect(result.overallFit).toBe('moderate');
    expect(result.narrative).toContain('React and TypeScript');
    expect(result.exactPhrases).toHaveLength(2);
    expect(result.tailoringHints).toHaveLength(2);
  });

  it('throws when AI fails', async () => {
    await expect(
      analyzeGapWithAI(
        'TypeScript React Docker',
        'Engineer bio',
        'TypeScript React Docker AWS',
        'Engineer',
        'test-model',
        async () => { throw new Error('API unavailable'); },
      ),
    ).rejects.toThrow('API unavailable');
  });

  it('handles malformed AI response fields gracefully', async () => {
    const result = await analyzeGapWithAI(
      'TypeScript',
      'Bio',
      'TypeScript React',
      undefined,
      'test-model',
      async () => '{ "matchedKeywords": "not an array", "garbage": true }',
    );

    // Malformed fields become empty arrays — should not throw
    expect(Array.isArray(result.matchedKeywords)).toBe(true);
    expect(Array.isArray(result.missingKeywords)).toBe(true);
    expect(Array.isArray(result.impliedSkills)).toBe(true);
    expect(Array.isArray(result.exactPhrases)).toBe(true);
  });

  it('uses unknown category for unrecognized category values', async () => {
    const result = await analyzeGapWithAI(
      'Resume text',
      'Bio text',
      'Job description',
      undefined,
      'test-model',
      async () => JSON.stringify({
        matchedKeywords: [{ term: 'Foo', category: 'made-up-category' }],
        missingKeywords: [],
        partialMatches: [],
        impliedSkills: [],
        experienceRequirements: [],
        overallFit: 'strong',
        narrative: '',
        exactPhrases: [],
        tailoringHints: [],
      }),
    );

    expect(result.matchedKeywords[0].category).toBe('other');
  });
});
