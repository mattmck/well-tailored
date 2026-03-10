import { execSync } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { Marked } from 'marked';
import sanitizeHtmlLib from 'sanitize-html';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function looksLikeDate(html: string): boolean {
  const text = sanitizeHtmlLib(html, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
  return /^\d{4}/.test(text);
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

function isMarkdownLink(text: string): boolean {
  return /^\[[^\]]+\]\([^)]+\)$/.test(text.trim());
}

function isEmail(text: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text);
}

function isUrlLike(text: string): boolean {
  return /^(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?$/.test(text);
}

function linkifyContactSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed || isMarkdownLink(trimmed)) return trimmed;

  const unwrapped = trimmed.replace(/^<(.+)>$/, '$1');
  if (isEmail(unwrapped)) return `[${unwrapped}](mailto:${unwrapped})`;
  if (!isUrlLike(unwrapped)) return trimmed;

  const href = /^https?:\/\//i.test(unwrapped) ? unwrapped : `https://${unwrapped}`;
  return `[${unwrapped}](${href})`;
}

function normalizeContactLinks(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => {
      if (!line.includes('|')) return line;
      return line
        .split('|')
        .map((segment) => linkifyContactSegment(segment))
        .join(' | ');
    })
    .join('\n');
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
    heading(this: { parser: { parseInline(tokens: unknown[]): string } }, { tokens, text, depth }: { tokens: unknown[]; text: string; depth: number }): string {
      const inline = tokens ? this.parser.parseInline(tokens) : text;
      if (depth === 1) {
        h2Count = 0;
        prevToken = 'h1';
        return `<h1>${inline}</h1>\n`;
      }
      if (depth === 2) {
        const isRole = h2Count === 0;
        h2Count++;
        prevToken = isRole ? 'role-h2' : 'section-h2';
        return `<h2 class="${isRole ? 'role' : 'section'}">${inline}</h2>\n`;
      }
      if (depth === 3) {
        prevToken = 'h3';
        return `<h3>${inline}</h3>\n`;
      }
      prevToken = `h${depth}`;
      return `<h${depth}>${inline}</h${depth}>\n`;
    },

    paragraph(this: { parser: { parseInline(tokens: unknown[]): string } }, { tokens, text }: { tokens: unknown[]; text: string }): string {
      const inline = tokens ? this.parser.parseInline(tokens) : text;
      const prev = prevToken;
      if (prev === 'role-h2') {
        prevToken = 'contact';
        return `<p class="contact">${inline}</p>\n`;
      }
      if (prev === 'contact') {
        prevToken = 'links';
        return `<p class="links">${inline}</p>\n`;
      }
      if (prev === 'h3' && looksLikeDate(text)) {
        prevToken = 'date';
        return `<p class="date">${inline}</p>\n`;
      }
      prevToken = 'p';
      return `<p>${inline}</p>\n`;
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
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f0fbff;
    color: #111;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .resume {
    max-width: 760px;
    margin: 0 auto;
    padding: 40px 54px;
    background: #f0fbff;
  }

  /* ── Name ─────────────────────────────────────── */

  h1 {
    font-size: 23px;
    font-weight: 700;
    color: #1a6bb0;
    line-height: 1.1;
    margin-bottom: 3px;
  }

  /* ── Role subtitle ────────────────────────────── */

  h2.role {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
    color: #3f4756;
    margin-bottom: 7px;
  }

  /* ── Contact / Links ──────────────────────────── */

  p.contact {
    font-size: 11px;
    color: #333;
    line-height: 1.4;
    margin-bottom: 2px;
  }

  p.links {
    font-size: 11px;
    color: #333;
    line-height: 1.4;
    margin-bottom: 16px;
  }

  p.contact a, p.links a { color: #1a6bb0; }

  /* ── Section headers ──────────────────────────── */

  h2.section {
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
    color: #3f4756;
    margin-top: 14px;
    margin-bottom: 4px;
  }

  /* ── Job / entry titles ───────────────────────── */

  h3 {
    font-size: 11.5px;
    font-weight: 700;
    color: #708090;
    line-height: 1.3;
    margin-top: 10px;
    margin-bottom: 1px;
  }

  h2.section + h3 { margin-top: 4px; }

  /* ── Dates ────────────────────────────────────── */

  p.date {
    font-size: 11px;
    color: #444;
    line-height: 1.3;
    margin-bottom: 4px;
  }

  /* ── Bullet lists ─────────────────────────────── */

  ul { list-style: disc; padding-left: 16px; margin: 0 0 2px 0; }

  li {
    font-size: 11px;
    line-height: 1.5;
    color: #111;
    padding-left: 1px;
    margin-bottom: 1px;
  }

  li:last-child { margin-bottom: 0; }

  /* ── Body text ────────────────────────────────── */

  p {
    font-size: 11px;
    line-height: 1.5;
    color: #111;
    margin-bottom: 3px;
  }

  /* ── Links ────────────────────────────────────── */

  a { color: #1a6bb0; text-decoration: none; }

  /* ── Print ────────────────────────────────────── */

  @media print {
    @page {
      margin: 1cm;
      size: letter portrait;
      background-color: #f0fbff;
      color: #f0fbff;
    }
    html { margin: 0; }
    body {
      margin: 0;
      background-color: #f0fbff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .resume {
      max-width: 100%;
      margin: 0;
      padding: 0;
      background: #f0fbff;
    }
    h2.section { break-after: avoid; page-break-after: avoid; }
    h3 { break-after: avoid; page-break-after: avoid; }
    li { break-inside: avoid; page-break-inside: avoid; }
    p.contact, p.links { break-after: avoid; page-break-after: avoid; }
  }
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a tailored resume (markdown) to a styled, print-ready HTML string.
 * Open the file in Chrome and Cmd+P → Save as PDF.
 */
export function renderResumeHtml(markdown: string, pageTitle = 'Matthew McKnight - Resume'): string {
  const cleaned = markdown
    .replace(/<!--[\s\S]*?-->/g, '')   // strip AI-only HTML comments
    .replace(/^• /gm, '- ')            // convert bullet chars to markdown list items
    .trim();
  const normalized = normalizeContactLinks(cleaned);

  const m = new Marked({ renderer: makeRenderer() });
  const body = sanitizeHtml(m.parse(normalized) as string);
  const safeTitle = escapeHtml(pageTitle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
  <div class="resume">
${body.trim().split('\n').map(l => `    ${l}`).join('\n')}
  </div>
</body>
</html>`;
}

/**
 * Convert a tailored cover letter (markdown) to a styled, print-ready HTML string.
 */
export function renderCoverLetterHtml(markdown: string, pageTitle = 'Matthew McKnight - Cover Letter'): string {
  const m = new Marked();
  const body = sanitizeHtml(m.parse(markdown) as string);
  const safeTitle = escapeHtml(pageTitle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    ${CSS}
    .cover-letter {
      max-width: 100%;
      padding: 0;
    }
    .cover-letter p {
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 20px;
      color: #3f4756;
    }
    @media print {
      body {
        padding: 0;
      }
      .resume.cover-letter {
        margin: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="resume cover-letter">
${body.trim().split('\n').map(l => `    ${l}`).join('\n')}
  </div>
</body>
</html>`;
}

/**
 * Use the system's Google Chrome to render an HTML file to PDF.
 * This ensures the background and layout exactly match what the user sees in Chrome.
 */
export async function renderPdf(htmlPath: string, pdfPath: string): Promise<void> {
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/usr/bin/google-chrome',
  ];

  const chromePath = chromePaths.find((p) => existsSync(p));
  if (!chromePath) {
    throw new Error('Google Chrome not found. Please install Chrome to enable automatic PDF generation.');
  }

  // Use headless mode to print to PDF.
  // --print-to-pdf-no-header: removes the default browser header/footer
  const cmd = `"${chromePath}" --headless --disable-gpu --print-to-pdf="${resolve(pdfPath)}" --print-to-pdf-no-header "file://${resolve(htmlPath)}"`;

  try {
    execSync(cmd, { stdio: 'ignore' });
  } catch (err) {
    throw new Error(`Failed to generate PDF: ${err instanceof Error ? err.message : String(err)}`);
  }
}
