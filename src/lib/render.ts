import { Marked } from 'marked';
import sanitizeHtmlLib from 'sanitize-html';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function looksLikeDate(html: string): boolean {
  return /^\d{4}/.test(html.replace(/<[^>]*>/g, '').trim());
}

/** Escape special HTML characters in a plain-text string. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Strip dangerous HTML from Marked output using an allowlist-based sanitizer.
 * Only the tags our custom renderer emits are allowed; attributes are restricted
 * to href on <a> and the semantic CSS classes emitted by makeRenderer().
 */
function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'hr', 'a', 'strong', 'em', 'code', 'br'],
    allowedAttributes: { a: ['href'] },
    allowedClasses: {
      h2: ['role', 'section'],
      p: ['contact', 'links', 'date'],
    },
    allowedSchemes: ['mailto', 'https', 'http'],
  });
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Build a custom marked Renderer with stateful class injection.
 * Tracks position in the document (header area, h3 context) to apply
 * semantic CSS classes that drive the typographic hierarchy.
 */
function makeRenderer() {
  // State shared across renderer calls (in document order)
  let prevToken = '';
  let h2Count = 0;

  return {
    heading({ text, depth }: { text: string; depth: number }): string {
      if (depth === 1) {
        h2Count = 0;
        prevToken = 'h1';
        return `<h1>${text}</h1>\n`;
      }
      if (depth === 2) {
        const isRole = h2Count === 0;
        h2Count++;
        prevToken = isRole ? 'role-h2' : 'section-h2';
        return `<h2 class="${isRole ? 'role' : 'section'}">${text}</h2>\n`;
      }
      if (depth === 3) {
        prevToken = 'h3';
        return `<h3>${text}</h3>\n`;
      }
      prevToken = `h${depth}`;
      return `<h${depth}>${text}</h${depth}>\n`;
    },

    paragraph({ text }: { text: string }): string {
      const prev = prevToken;
      if (prev === 'role-h2') {
        prevToken = 'contact';
        return `<p class="contact">${text}</p>\n`;
      }
      if (prev === 'contact') {
        prevToken = 'links';
        return `<p class="links">${text}</p>\n`;
      }
      if (prev === 'h3' && looksLikeDate(text)) {
        prevToken = 'date';
        return `<p class="date">${text}</p>\n`;
      }
      prevToken = 'p';
      return `<p>${text}</p>\n`;
    },
  };
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-size: 16px; }

  body {
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    background: #fff;
    color: #1f1f1f;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .resume {
    max-width: 780px;
    margin: 0 auto;
    padding: 80px 72px;
  }

  /* ── Name ─────────────────────────────────────── */

  h1 {
    font-size: 46px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: #0a0a0a;
    line-height: 1;
    margin-bottom: 10px;
  }

  /* ── Role subtitle ────────────────────────────── */

  h2.role {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #aaa;
    margin-bottom: 22px;
  }

  /* ── Contact / Links ──────────────────────────── */

  p.contact {
    font-size: 11.5px;
    color: #888;
    letter-spacing: 0.01em;
    line-height: 1.6;
    margin-bottom: 4px;
  }

  p.links {
    font-size: 11px;
    color: #c0c0c0;
    letter-spacing: 0.01em;
    line-height: 1.6;
    margin-bottom: 64px;
  }

  /* ── Section headers ──────────────────────────── */

  h2.section {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: #c0c0c0;
    margin-top: 56px;
    margin-bottom: 20px;
  }

  /* ── Job / entry titles ───────────────────────── */

  h3 {
    font-size: 14.5px;
    font-weight: 600;
    color: #0a0a0a;
    letter-spacing: -0.01em;
    line-height: 1.25;
    margin-top: 28px;
    margin-bottom: 3px;
  }

  h2.section + h3 { margin-top: 0; }

  /* ── Dates ────────────────────────────────────── */

  p.date {
    font-size: 10.5px;
    color: #bbb;
    letter-spacing: 0.05em;
    line-height: 1;
    margin-bottom: 10px;
  }

  /* ── Bullet lists ─────────────────────────────── */

  ul { list-style: none; padding: 0; margin: 0; }

  li {
    font-size: 13px;
    line-height: 1.7;
    color: #2a2a2a;
    padding-left: 18px;
    position: relative;
    margin-bottom: 5px;
  }

  li:last-child { margin-bottom: 0; }

  li::before {
    content: '—';
    position: absolute;
    left: 0;
    top: 0;
    color: #ddd;
    font-weight: 300;
    font-size: 12px;
  }

  /* ── Body text ────────────────────────────────── */

  p {
    font-size: 13px;
    line-height: 1.7;
    color: #2a2a2a;
    margin-bottom: 8px;
  }

  /* Summary / Education (first p after section header) */
  h2.section + p {
    font-size: 13.5px;
    line-height: 1.75;
    color: #333;
  }

  /* Skills content (p after h3 that isn't a date) */
  h3 + p:not(.date) {
    font-size: 12.5px;
    color: #555;
    line-height: 1.75;
    margin-top: 2px;
  }

  /* ── Links ────────────────────────────────────── */

  a { color: inherit; text-decoration: none; }

  /* ── Print ────────────────────────────────────── */

  @media print {
    @page { margin: 0.5in 0.6in; size: letter portrait; }
    body { background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .resume { padding: 0; max-width: 100%; }
    h2.section { break-after: avoid; page-break-after: avoid; }
    h3 { break-after: avoid; page-break-after: avoid; }
    li { break-inside: avoid; page-break-inside: avoid; }
    p.contact, p.links { break-after: avoid; page-break-after: avoid; }
  }
`.trim();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a tailored resume (markdown) to a styled, print-ready HTML string.
 * Open the file in Chrome and Cmd+P → Save as PDF.
 */
export function renderResumeHtml(markdown: string, pageTitle = 'Resume'): string {
  const cleaned = markdown
    .replace(/<!--[\s\S]*?-->/g, '')   // strip AI-only HTML comments
    .replace(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/g, '[$1](mailto:$1)')  // email autolinks
    .replace(/^• /gm, '- ')            // convert bullet chars to markdown list items
    .trim();

  const m = new Marked({ renderer: makeRenderer() });
  const body = sanitizeHtml(m.parse(cleaned) as string);
  const safeTitle = escapeHtml(pageTitle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
  <div class="resume">
${body.trim().split('\n').map(l => `    ${l}`).join('\n')}
  </div>
</body>
</html>`;
}
