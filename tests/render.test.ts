import { describe, it, expect } from 'vitest';
import { renderResumeHtml } from '../src/lib/render.js';

const SAMPLE = `
# Jane Doe
## Senior Engineer

<jane@example.com>  |  (555) 123-4567

linkedin.com/in/janedoe  |  github.com/janedoe

## Summary

Built things that mattered.

## Experience

### Staff Engineer | Acme Corp
<!-- tech: Go, Postgres, Kubernetes -->
2021 – 2024

• Led migration of monolith to microservices.
• Reduced p99 latency by 40%.

## Education

MIT — B.S., Computer Science
`.trim();

describe('renderResumeHtml', () => {
  it('returns a complete HTML document', () => {
    const html = renderResumeHtml(SAMPLE);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('renders the name as h1', () => {
    expect(renderResumeHtml(SAMPLE)).toContain('<h1>Jane Doe</h1>');
  });

  it('marks the role subtitle as h2.role', () => {
    expect(renderResumeHtml(SAMPLE)).toContain('<h2 class="role">Senior Engineer</h2>');
  });

  it('marks section headers as h2.section', () => {
    const html = renderResumeHtml(SAMPLE);
    expect(html).toContain('<h2 class="section">Summary</h2>');
    expect(html).toContain('<h2 class="section">Experience</h2>');
  });

  it('marks the contact line as p.contact', () => {
    const html = renderResumeHtml(SAMPLE);
    expect(html).toContain('class="contact"');
    expect(html).toContain('<a href="mailto:jane@example.com">jane@example.com</a>');
  });

  it('marks the links line as p.links', () => {
    const html = renderResumeHtml(SAMPLE);
    expect(html).toContain('class="links"');
    expect(html).toContain('<a href="https://linkedin.com/in/janedoe">linkedin.com/in/janedoe</a>');
    expect(html).toContain('<a href="https://github.com/janedoe">github.com/janedoe</a>');
  });

  it('renders markdown links instead of printing them literally', () => {
    const html = renderResumeHtml(`
# Matt McKnight
## Staff Engineer

[mcknight.matthew@gmail.com](mailto:mcknight.matthew@gmail.com) | [linkedin.com/in/matthewmcknight](https://linkedin.com/in/matthewmcknight)
    `.trim());

    expect(html).toContain('<a href="mailto:mcknight.matthew@gmail.com">mcknight.matthew@gmail.com</a>');
    expect(html).toContain('<a href="https://linkedin.com/in/matthewmcknight">linkedin.com/in/matthewmcknight</a>');
    expect(html).not.toContain('[mcknight.matthew@gmail.com]');
    expect(html).not.toContain('[linkedin.com/in/matthewmcknight]');
  });

  it('marks date paragraphs as p.date', () => {
    expect(renderResumeHtml(SAMPLE)).toContain('<p class="date">2021 – 2024</p>');
  });

  it('renders company and location in the split job layout', () => {
    const html = renderResumeHtml(`
# Jane Doe
## Senior Engineer

jane@example.com | mattmcknight.com

## Experience

### Staff Engineer | Acme Corp | Remote
2021 – 2024
    `.trim());
    expect(html).toContain('<span class="job-company">Acme Corp</span>');
    expect(html).toContain('<span class="job-location">Remote</span>');
  });

  it('strips HTML comments', () => {
    const html = renderResumeHtml(SAMPLE);
    expect(html).not.toContain('tech:');
    expect(html).not.toContain('<!--');
  });

  it('converts bullet chars to list items', () => {
    const html = renderResumeHtml(SAMPLE);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).not.toContain('•');
  });

  it('uses the pageTitle in the <title> tag when explicitly provided', () => {
    const html = renderResumeHtml(SAMPLE, 'Resume — Acme Corp');
    expect(html).toContain('<title>Resume — Acme Corp</title>');
  });

  it('derives the default title from the first H1 when no pageTitle is given', () => {
    const html = renderResumeHtml(SAMPLE);
    expect(html).toContain('<title>Jane Doe – Resume</title>');
  });

  it('falls back to generic "Resume" title when markdown has no H1', () => {
    const html = renderResumeHtml('## Summary\n\nNo name here.');
    expect(html).toContain('<title>Resume</title>');
  });

  it('uses the lighter default resume background theme', () => {
    const html = renderResumeHtml(SAMPLE);
    expect(html).toContain('background: var(--resume-background, #E5F2FF);');
    expect(html).toContain(':root { --resume-background: #E5F2FF; }');
    expect(html).toContain('html, body, .resume { background: var(--resume-background, #E5F2FF); }');
  });

  it('sets the resume background variable so print and PDF styles use the chosen theme color', () => {
    const html = renderResumeHtml(SAMPLE, undefined, false, {
      background: '#F6F0E4',
    });

    expect(html).toContain(':root { --resume-background: #F6F0E4; }');
    expect(html).toContain('@page {\n    margin: 1cm;\n    size: letter portrait;\n    background: var(--resume-background, #E5F2FF);');
    expect(html).toContain('html, body, .resume { background: var(--resume-background, #E5F2FF); }');
  });

  it('keeps compact date rows flush with the job heading', () => {
    const html = renderResumeHtml(SAMPLE, undefined, true);
    expect(html).toContain('.job-sub { margin-top: 0 !important; margin-bottom: 4px !important; }');
    expect(html).toContain('.job-sub .date { margin: 0 !important; }');
  });
});

describe('normalizeContactLinks / isUrlLike', () => {
  // Build a minimal resume with a controlled contact line so we can test
  // linkification without the rest of the rendering noise.
  function contactHtml(contactLine: string): string {
    return renderResumeHtml(
      `# Test Person\n## Engineer\n\n${contactLine}\n\n## Summary\n\nSome text.`,
    );
  }

  it('linkifies bare https:// URLs in the contact area', () => {
    const html = contactHtml('https://example.com/foo');
    expect(html).toContain('<a href="https://example.com/foo">https://example.com/foo</a>');
  });

  it('linkifies www. URLs in the contact area', () => {
    // Must include a pipe so normalizeContactLinks processes the line
    const html = contactHtml('www.example.com/in/janedoe | (555) 123-4567');
    expect(html).toContain('<a href="https://www.example.com/in/janedoe">www.example.com/in/janedoe</a>');
  });

  it('linkifies bare domain/path URLs in the contact area', () => {
    const html = contactHtml('linkedin.com/in/janedoe | github.com/janedoe');
    expect(html).toContain('<a href="https://linkedin.com/in/janedoe">linkedin.com/in/janedoe</a>');
  });

  it('does NOT linkify bare dotted identifiers like Node.js', () => {
    const html = contactHtml('Node.js | react');
    expect(html).not.toContain('<a href');
  });

  it('linkifies bare domains in the contact area when they look like actual sites', () => {
    const html = contactHtml('mattmcknight.com | github.com/janedoe');
    expect(html).toContain('<a href="https://mattmcknight.com">mattmcknight.com</a>');
  });

  it('does NOT linkify pipe-separated content after the second ## heading', () => {
    // The "Skills" section has pipes but should not be linkified.
    const html = renderResumeHtml(
      `# Dev\n## Engineer\n\ngithub.com/dev | more\n\n## Summary\n\nText.\n\n## Skills\n\nNode.js | React | Go`,
    );
    // Inside the Skills section, pipes should be literal — not linkified
    expect(html).not.toMatch(/Skills[\s\S]*?<a href/);
  });

  it('parses dash-separated h3 fallback: "Title — Company"', () => {
    const md = `# Dev\n## Engineer\n\nfoo@bar.com\n\nlinkedin.com/in/dev\n\n## Experience\n\n### Senior Engineer — Acme Corp\n2021 – 2024\n\n- Did stuff.`;
    const html = renderResumeHtml(md);
    expect(html).toContain('<span class="job-company">Acme Corp</span>');
    expect(html).toContain('class="job-header"');
  });

  it('parses dash-separated h3 with location: "Title — Company, Location"', () => {
    const md = `# Dev\n## Engineer\n\nfoo@bar.com\n\nlinkedin.com/in/dev\n\n## Experience\n\n### Senior Engineer — Acme Corp, Remote\n2021 – 2024\n\n- Did stuff.`;
    const html = renderResumeHtml(md);
    expect(html).toContain('<span class="job-company">Acme Corp</span>');
    expect(html).toContain('<span class="job-location">Remote</span>');
  });

  it('strips trailing parenthesized dates from h3 fallback', () => {
    const md = `# Dev\n## Engineer\n\nfoo@bar.com\n\nlinkedin.com/in/dev\n\n## Experience\n\n### Senior Engineer — Acme Corp (Jan 2021 – Dec 2024)\n\n- Did stuff.`;
    const html = renderResumeHtml(md);
    expect(html).toContain('<span class="job-company">Acme Corp</span>');
    expect(html).not.toContain('(Jan 2021');
  });

  it('parses "Title at Company" fallback', () => {
    const md = `# Dev\n## Engineer\n\nfoo@bar.com\n\nlinkedin.com/in/dev\n\n## Experience\n\n### Senior Engineer at Acme Corp\n2021 – 2024\n\n- Did stuff.`;
    const html = renderResumeHtml(md);
    expect(html).toContain('<span class="job-company">Acme Corp</span>');
  });

  it('renders month-abbreviated date lines with correct class', () => {
    const md = `# Dev\n## Engineer\n\nfoo@bar.com\n\nlinkedin.com/in/dev\n\n## Experience\n\n### Principal Software Engineer | Oracle\nSep '24 - Sep '25 | Remote\n\n- Did stuff.`;
    const html = renderResumeHtml(md);
    expect(html).toContain('class="date"');
    expect(html).toMatch(/Sep.+24 - Sep.+25/);
    expect(html).toContain('<span class="job-location">Remote</span>');
  });

  it('extracts location when date line has location first: "Columbia, MD | 2019 - 2021"', () => {
    const md = `# Dev\n## Engineer\n\nfoo@bar.com\n\nlinkedin.com/in/dev\n\n## Experience\n\n### Senior Engineer | Tenable\nColumbia, MD | 2019 - 2021\n\n- Did stuff.`;
    const html = renderResumeHtml(md);
    expect(html).toContain('class="date"');
    expect(html).toContain('2019 - 2021');
    expect(html).toContain('<span class="job-location">Columbia, MD</span>');
  });

  it('handles 4-pipe heading: "Title | Company | Location | Dates"', () => {
    const md = `# Dev\n## Engineer\n\nfoo@bar.com\n\nlinkedin.com/in/dev\n\n## Experience\n\n### Principal Software Engineer | Oracle | Remote | Sep '24 - Sep '25\n\n- Did stuff.`;
    const html = renderResumeHtml(md);
    expect(html).toContain('<span class="job-company">Oracle</span>');
    expect(html).toContain('<span class="job-location">Remote</span>');
    expect(html).toContain('class="date"');
    expect(html).toMatch(/Sep.+24 - Sep.+25/);
  });

  it('renders apostrophe-only year range as date: "\'09 - \'17"', () => {
    const md = `# Dev\n## Engineer\n\nfoo@bar.com\n\nlinkedin.com/in/dev\n\n## Experience\n\n### Engineer | JHUAPL\nLaurel, MD | '09 - '17\n\n- Did stuff.`;
    const html = renderResumeHtml(md);
    expect(html).toContain('class="date"');
    expect(html).toContain('<span class="job-location">Laurel, MD</span>');
  });

  it('normalizes Additional Experience entries into a single pipe-separated paragraph', () => {
    const md = [
      '# Dev',
      '## Engineer',
      '',
      'dev@example.com | linkedin.com/in/dev',
      '',
      '## Experience',
      '',
      '### Senior Engineer | Acme',
      '2022 – 2024',
      '',
      '- Built things.',
      '',
      '## Additional Experience',
      '',
      '**Software Engineer, Fearless** (2018) — Orchestrated AWS environments with Terraform.',
      '**Senior Engineer, Philips Healthcare** (2017 – 2018) — Built real-time ICU monitoring.',
      '',
      '## Education',
      '',
      'MIT — B.S., Computer Science',
    ].join('\n');
    const html = renderResumeHtml(md);
    // Entries should be joined with pipe and rendered in a single paragraph
    expect(html).toContain('Fearless');
    expect(html).toContain('Philips Healthcare');
    expect(html).toContain(' | ');
    // Should NOT be separate list items
    const liCount = (html.match(/<li>/g) || []).length;
    expect(liCount).toBe(1); // only the Experience bullet
  });

  it('preserves explicit Additional Experience bullets', () => {
    const md = [
      '# Dev',
      '## Engineer',
      '',
      'dev@example.com | linkedin.com/in/dev',
      '',
      '## Additional Experience',
      '',
      '- **Software Engineer, Fearless** (2018) — Orchestrated AWS environments with Terraform.',
      '- **Senior Engineer, Philips Healthcare** (2017 – 2018) — Built real-time ICU monitoring.',
    ].join('\n');
    const html = renderResumeHtml(md);
    expect(html).toContain('<li><strong>Software Engineer, Fearless</strong>');
    expect(html).toContain('<li><strong>Senior Engineer, Philips Healthcare</strong>');
    expect(html).not.toContain('Terraform. | <strong>Senior Engineer');
  });

  it('does NOT count ### headings toward the h2 stop-linkify threshold', () => {
    // If ### incorrectly incremented h2Count, linkification would stop
    // too early and the contact link below would not be wrapped in <a>.
    const md = [
      '# Dev',
      '## Engineer',
      '',
      '### note',                       // h3 — must NOT increment h2Count
      '',
      'github.com/dev | (555) 123-4567', // should still be linkified (h2Count still 1)
      '',
      '## Summary',
      '',
      'Text.',
    ].join('\n');
    const html = renderResumeHtml(md);
    expect(html).toContain('<a href="https://github.com/dev">github.com/dev</a>');
  });
});
