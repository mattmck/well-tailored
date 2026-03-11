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

  it('uses the pageTitle in the <title> tag', () => {
    const html = renderResumeHtml(SAMPLE, 'Resume — Acme Corp');
    expect(html).toContain('<title>Resume — Acme Corp</title>');
  });
});
