import { describe, expect, it } from 'vitest';
import {
  analyzeGap,
  analyzeGapWithAI,
  categorizeKeyword,
  extractExperienceRequirements,
  extractPhrases,
} from '../src/services/gap.js';

describe('extractPhrases', () => {
  it('extracts known tech terms and drops generic filler', () => {
    const phrases = extractPhrases(
      'We are looking for a strong candidate with experience in TypeScript, React, and Docker. ' +
      'Must be a team player in a fast-paced environment with excellent communication skills.',
    );

    // Known tech terms kept
    expect(phrases).toContain('typescript');
    expect(phrases).toContain('react');
    expect(phrases).toContain('docker');

    // Generic filler dropped
    expect(phrases).not.toContain('looking');
    expect(phrases).not.toContain('candidate');
    expect(phrases).not.toContain('environment');
    expect(phrases).not.toContain('excellent');
  });

  it('caps output at 30 terms max', () => {
    const bigJd = Array.from({ length: 100 }, (_, i) => `technology${i}`).join(' ');
    const phrases = extractPhrases(bigJd);
    expect(phrases.length).toBeLessThanOrEqual(30);
  });

  it('keeps multi-word phrases that repeat', () => {
    const text = 'distributed systems distributed systems microservice architecture';
    const phrases = extractPhrases(text);
    expect(phrases).toContain('distributed systems');
  });

  it('preserves known single terms even when part of a phrase', () => {
    const phrases = extractPhrases('React components and React hooks');
    expect(phrases).toContain('react');
  });
});

describe('categorizeKeyword', () => {
  it('classifies common technologies into the right buckets', () => {
    expect(categorizeKeyword('TypeScript').category).toBe('language');
    expect(categorizeKeyword('React').category).toBe('framework');
    expect(categorizeKeyword('Docker').category).toBe('tool');
    expect(categorizeKeyword('AWS').category).toBe('platform');
    expect(categorizeKeyword('Agile').category).toBe('methodology');
    expect(categorizeKeyword('Mentoring').category).toBe('soft-skill');
  });

  it('returns other for unknown terms', () => {
    expect(categorizeKeyword('distributed systems').category).toBe('other');
    expect(categorizeKeyword('blockchain').category).toBe('other');
  });
});

describe('extractExperienceRequirements', () => {
  it('extracts required experience requirements', () => {
    const requirements = extractExperienceRequirements('Must have 5+ years of Python.');
    expect(requirements).toContainEqual(
      expect.objectContaining({ skill: expect.stringContaining('Python'), years: 5, isRequired: true }),
    );
  });

  it('marks preferred requirements as optional', () => {
    const requirements = extractExperienceRequirements('Preferred: 3 years of Go experience.');
    expect(requirements).toContainEqual(
      expect.objectContaining({ years: 3, isRequired: false }),
    );
  });

  it('handles mixed required and nice-to-have clauses', () => {
    const requirements = extractExperienceRequirements(
      'Minimum 5 years of Python.\nNice to have 2 years of React.',
    );
    expect(requirements.length).toBeGreaterThanOrEqual(2);
    const python = requirements.find((r) => r.skill.toLowerCase().includes('python'));
    const react = requirements.find((r) => r.skill.toLowerCase().includes('react'));
    expect(python?.isRequired).toBe(true);
    expect(react?.isRequired).toBe(false);
  });
});

describe('analyzeGap (heuristic)', () => {
  it('reports a strong fit for a perfect match', () => {
    const resume = 'TypeScript React Docker AWS Kubernetes mentoring agile';
    const job = 'TypeScript React Docker AWS Kubernetes mentoring agile';
    const gap = analyzeGap(resume, job);

    expect(gap.overallFit).toBe('strong');
    expect(gap.missingKeywords).toHaveLength(0);
  });

  it('reports a weak fit for unrelated content', () => {
    const gap = analyzeGap(
      'Elementary school teacher with classroom experience.',
      'Go Kubernetes Terraform AWS platform engineer',
    );
    expect(gap.overallFit).toBe('weak');
    expect(gap.missingKeywords.length).toBeGreaterThan(0);
  });

  it('surfaces synonym-based partial matches', () => {
    const gap = analyzeGap(
      'Built React applications for analytics dashboards.',
      'Experience with React.js and TypeScript.',
    );
    expect(gap.partialMatches).toContainEqual(
      expect.objectContaining({ jdTerm: expect.any(String), relationship: 'synonym' }),
    );
  });

  it('handles empty inputs gracefully', () => {
    const gap = analyzeGap('', '');
    expect(gap.matchedKeywords).toHaveLength(0);
    expect(gap.missingKeywords).toHaveLength(0);
    expect(gap.partialMatches).toHaveLength(0);
  });

  it('produces a manageable number of keywords for a real JD', () => {
    const realJd = `
      Senior Software Engineer - Platform Team

      We're looking for a Senior Software Engineer to join our platform team.
      You'll build and maintain our core infrastructure services using TypeScript,
      Node.js, and React. Experience with AWS, Docker, Kubernetes, and Terraform
      is required. Must have 5+ years of experience with distributed systems.

      Requirements:
      - Strong proficiency in TypeScript and Node.js
      - Experience with React or similar frontend frameworks
      - Hands-on experience with AWS (EC2, S3, Lambda, ECS)
      - Docker and Kubernetes for container orchestration
      - CI/CD pipelines using GitHub Actions or Jenkins
      - PostgreSQL or similar relational databases
      - Experience with event-driven architecture and message queues (Kafka, RabbitMQ)

      Nice to have:
      - Go or Rust experience
      - Terraform for infrastructure as code
      - GraphQL API design
      - Mentoring junior engineers
    `;
    const gap = analyzeGap('Unrelated resume content here.', realJd);
    const totalKeywords = gap.matchedKeywords.length + gap.missingKeywords.length + gap.partialMatches.length;

    // Should be in the 15-30 range, NOT 993
    expect(totalKeywords).toBeLessThanOrEqual(30);
    expect(totalKeywords).toBeGreaterThan(5);
  });
});

describe('analyzeGapWithAI', () => {
  it('parses structured AI response into EnrichedGapAnalysis', async () => {
    const enriched = await analyzeGapWithAI(
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
          { term: 'Mentoring', category: 'soft-skill' },
        ],
        partialMatches: [
          { jdTerm: 'React.js', resumeTerm: 'React', relationship: 'synonym' },
        ],
        experienceRequirements: [],
        overallFit: 'moderate',
        narrative: 'Strong core overlap on React and TypeScript, with mentoring as the clearest gap.',
        tailoringHints: [
          'Lead with React dashboard work near the top of the resume.',
          'Call out TypeScript service ownership with concrete outcomes.',
        ],
      }),
    );

    expect(enriched.matchedKeywords).toHaveLength(2);
    expect(enriched.missingKeywords).toHaveLength(1);
    expect(enriched.partialMatches).toHaveLength(1);
    expect(enriched.overallFit).toBe('moderate');
    expect(enriched.narrative).toContain('React and TypeScript');
    expect(enriched.tailoringHints).toHaveLength(2);
  });

  it('falls back to heuristic when AI fails', async () => {
    const enriched = await analyzeGapWithAI(
      'TypeScript React Docker',
      'Engineer bio',
      'TypeScript React Docker AWS',
      'Engineer',
      'test-model',
      async () => { throw new Error('API unavailable'); },
    );

    expect(enriched.narrative).toContain('unavailable');
    // Should still have heuristic results
    expect(enriched.matchedKeywords.length + enriched.missingKeywords.length).toBeGreaterThan(0);
  });

  it('handles malformed AI response gracefully', async () => {
    const enriched = await analyzeGapWithAI(
      'TypeScript',
      'Bio',
      'TypeScript React',
      undefined,
      'test-model',
      async () => '{ "matchedKeywords": "not an array", "garbage": true }',
    );

    // Should not throw — malformed fields become empty arrays
    expect(Array.isArray(enriched.matchedKeywords)).toBe(true);
    expect(Array.isArray(enriched.missingKeywords)).toBe(true);
  });
});
