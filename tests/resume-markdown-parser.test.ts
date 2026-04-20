import { describe, expect, it } from 'vitest';
import { parseResumeMarkdown } from '../src/lib/resume-markdown-parser.js';

describe('parseResumeMarkdown', () => {
  it('normalizes additional experience text entries into bullets', () => {
    const parsed = parseResumeMarkdown(`# Jane Doe

## Staff Engineer

jane@example.com

## Summary

Builds systems.

## Additional Experience

**Senior Software Engineer, Johns Hopkins APL** (Sep 2009 - Oct 2017) - Built distributed systems.
**Senior Software Engineer, Philips Healthcare** (Oct 2017 - Mar 2018) - Improved ICU monitoring.
`);

    const additional = parsed.sections.find(section => section.heading === 'Additional Experience');
    expect(additional?.type).toBe('bullets');
    expect(additional?.items).toHaveLength(2);
    expect(additional?.items[0].text).toContain('Johns Hopkins APL');
    expect(additional?.items[1].text).toContain('Philips Healthcare');
  });

  it('splits compact pipe-separated additional experience entries into bullets', () => {
    const parsed = parseResumeMarkdown(`# Jane Doe

## Staff Engineer

jane@example.com

## Additional Experience

**Engineer, Acme** (2020 - 2021) - Built APIs. | **Engineer, BigCo** (2018 - 2020) - Built tools.
`);

    const additional = parsed.sections.find(section => section.heading === 'Additional Experience');
    expect(additional?.type).toBe('bullets');
    expect(additional?.items.map(item => item.text)).toEqual([
      '**Engineer, Acme** (2020 - 2021) - Built APIs.',
      '**Engineer, BigCo** (2018 - 2020) - Built tools.',
    ]);
  });
});
