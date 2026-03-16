import { describe, expect, it } from 'vitest';
import {
  assembleSections,
  classifySectionType,
  parseResumeSections,
} from '../src/lib/resume-parser.js';

function normalizeTrailingNewlines(value: string): string {
  return value.replace(/\n+$/g, '');
}

describe('parseResumeSections', () => {
  it('parses a standard resume into typed sections', () => {
    const markdown = `# Jane Doe
jane@example.com

## Summary
Builder of reliable systems.

## Experience
- Led platform work

## Education
B.S. Computer Science

## Technical Skills
TypeScript, React, Docker`;

    const sections = parseResumeSections(markdown);

    expect(sections.map((section) => section.type)).toEqual([
      'header',
      'summary',
      'experience',
      'education',
      'skills',
    ]);
    expect(sections[0].heading).toBe('Jane Doe');
    expect(sections[2].bullets).toEqual(['- Led platform work']);
  });

  it('round-trips cleanly through assembleSections', () => {
    const markdown = `# Jane Doe
Austin, TX

## Summary
Builder of reliable systems.

## Experience
### Senior Engineer | Example Co | Remote
2022 - Present
- Improved release throughput by 40%.
- Mentored 4 engineers.

## Skills
* TypeScript
* Node.js
`;

    const reparsed = assembleSections(parseResumeSections(markdown));

    expect(normalizeTrailingNewlines(reparsed)).toBe(normalizeTrailingNewlines(markdown));
  });

  it('treats a document with no headings as a single header section', () => {
    const markdown = 'Jane Doe\nAustin, TX\nTypeScript engineer';
    const sections = parseResumeSections(markdown);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      type: 'header',
      heading: '',
      headingLevel: 0,
      content: markdown,
    });
  });

  it('captures mixed heading levels', () => {
    const markdown = `# Jane Doe
## Experience
### Staff Engineer | Example | Remote
- Built things`;
    const sections = parseResumeSections(markdown);

    expect(sections.map((section) => section.headingLevel)).toEqual([1, 2, 3]);
  });

  it('extracts dash and asterisk bullets', () => {
    const markdown = `## Experience
- Led platform work
* Mentored engineers
Not a bullet`;
    const [section] = parseResumeSections(markdown);

    expect(section.bullets).toEqual([
      '- Led platform work',
      '* Mentored engineers',
    ]);
  });

  it('generates ids from headings and handles special characters', () => {
    const markdown = `## Technical Skills & Tools
TypeScript, React

## Technical Skills & Tools
Docker, AWS`;
    const sections = parseResumeSections(markdown);

    expect(sections[0].id).toBe('technical-skills-tools');
    expect(sections[1].id).toBe('technical-skills-tools-2');
  });

  it('preserves experience entry formatting through round-trip', () => {
    const markdown = `## Experience
### Senior Software Engineer | Acme Corp | Austin, TX
Jan 2021 - Dec 2024
- Led migration of monolith to microservices.
- Improved observability across services.`;

    const assembled = assembleSections(parseResumeSections(markdown));

    expect(assembled).toBe(markdown);
  });
});

describe('classifySectionType', () => {
  it('classifies known section headings', () => {
    expect(classifySectionType('Professional Experience')).toBe('experience');
    expect(classifySectionType('Education')).toBe('education');
    expect(classifySectionType('Technical Skills & Tools')).toBe('skills');
    expect(classifySectionType('Key Projects')).toBe('projects');
    expect(classifySectionType('Certifications & Licenses')).toBe('certifications');
    expect(classifySectionType('Profile Summary')).toBe('summary');
    expect(classifySectionType('Community Work')).toBe('other');
  });
});
