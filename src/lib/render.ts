import { execFileSync } from 'child_process';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
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
  // Require an explicit scheme, www., or a path component so bare dotted
  // identifiers like "Node.js" are not treated as URLs.
  return /^https?:\/\/[^\s]+$/.test(text) ||
    /^www\.(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?$/.test(text) ||
    /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\/[^\s]*$/.test(text);
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
  const lines = markdown.split('\n');
  let h2Count = 0;

  const processed = lines.map((line) => {
    const trimmed = line.trim();

    // The first ## is the role subtitle; contact/links follow it.
    // Only treat content as body (and skip linkification) once we hit
    // the second ## (the first real section heading).
    if (trimmed.startsWith('##')) {
      h2Count++;
    }

    if (h2Count >= 2 || !line.includes('|')) {
      return line;
    }

    return line
      .split('|')
      .map((segment) => linkifyContactSegment(segment))
      .join(' | ');
  });

  return processed.join('\n');
}

/**
 * Strip dangerous HTML from Marked output using an allowlist-based sanitizer.
 */
function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'hr', 'a', 'strong', 'em', 'code', 'br', 'div'],
    allowedAttributes: { a: ['href'], div: ['class'] },
    allowedClasses: {
      h2: ['role', 'section'],
      p: ['contact', 'links', 'date'],
      div: ['job-section'],
    },
    allowedSchemes: ['mailto', 'https', 'http'],
  });
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

function makeRenderer() {
  const state = {
    prevToken: '',
    h2Count: 0,
    inJobSection: false,
  };

  const closeJobSection = () => {
    if (state.inJobSection) {
      state.inJobSection = false;
      return '</div>\n';
    }
    return '';
  };

  const renderer = {
    heading(this: { parser: { parseInline(tokens: unknown[]): string } }, { tokens, text, depth }: { tokens: unknown[]; text: string; depth: number }): string {
      const inline = tokens ? this.parser.parseInline(tokens) : text;
      
      let prefix = '';
      if (depth === 1) {
        state.h2Count = 0;
        state.prevToken = 'h1';
        return `<h1>${inline}</h1>\n`;
      }
      
      if (depth === 2) {
        const isRole = state.h2Count === 0;
        state.h2Count++;
        prefix = closeJobSection();
        state.inJobSection = true;
        state.prevToken = isRole ? 'role-h2' : 'section-h2';
        return `${prefix}<div class="job-section">\n<h2 class="${isRole ? 'role' : 'section'}">${inline}</h2>\n`;
      }
      
      if (depth === 3) {
        prefix = closeJobSection();
        state.inJobSection = true;
        state.prevToken = 'h3';
        return `${prefix}<div class="job-section">\n<h3>${inline}</h3>\n`;
      }
      
      state.prevToken = `h${depth}`;
      return `<h${depth}>${inline}</h${depth}>\n`;
    },

    paragraph(this: { parser: { parseInline(tokens: unknown[]): string } }, { tokens, text }: { tokens: unknown[]; text: string }): string {
      const inline = tokens ? this.parser.parseInline(tokens) : text;
      const prev = state.prevToken;
      if (prev === 'role-h2') {
        state.prevToken = 'contact';
        return `<p class="contact">${inline}</p>\n`;
      }
      if (prev === 'contact') {
        state.prevToken = 'links';
        return `<p class="links">${inline}</p>\n`;
      }
      if (prev === 'h3' && looksLikeDate(text)) {
        state.prevToken = 'date';
        return `<p class="date">${inline}</p>\n`;
      }
      state.prevToken = 'p';
      return `<p>${inline}</p>\n`;
    }
  };

  return { renderer, closeJobSection };
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-size: 16px; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #B7CCE0;
    color: #323434;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .resume {
    max-width: 760px;
    margin: 0 auto;
    padding: 40px 54px;
    background: #B7CCE0;
  }

  .job-section {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* ── Typography ───────────────────────────────── */

  h1 { font-size: 23px; font-weight: 700; color: #BE503C; line-height: 1.1; margin-bottom: 3px; }
  h2.role { font-size: 14px; font-weight: 700; color: #364D62; margin-bottom: 7px; }
  p.contact, p.links { font-size: 11px; color: #323434; line-height: 1.4; }
  p.links { margin-bottom: 16px; }
  p.contact a, p.links a { color: #255F91; }
  h2.section { font-size: 13.5px; font-weight: 700; color: #BE503C; margin-top: 14px; margin-bottom: 4px; }
  h3 { font-size: 11.5px; font-weight: 700; color: #182234; line-height: 1.3; margin-top: 10px; margin-bottom: 1px; }
  h2.section + .job-section h3, h2.section + h3 { margin-top: 4px; }
  p.date { font-size: 11px; color: #3B72A8; line-height: 1.3; margin-bottom: 4px; }
  ul { list-style: disc; padding-left: 16px; margin: 0 0 2px 0; color: #323434; }
  li, p { font-size: 11px; line-height: 1.5; color: #323434; margin-bottom: 3px; }
  a { color: #255F91; text-decoration: none; }

  /* ── Print ────────────────────────────────────── */

  @media print {
    @page { size: letter portrait; }
    body { background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .resume { padding: 0; max-width: 100%; }
    
    @page {
      margin: 1cm;
      size: letter portrait;
      background-color: #B7CCE0;
      background: #B7CCE0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html { padding: 0; background-color: #B7CCE0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0;
      padding: 0;
      background-color: #B7CCE0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .resume {
      max-width: 100%;
      margin: 0;
      padding: 0;
      background: transparent;
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

/** Extract the first H1 heading text from a markdown string, if present. */
function extractH1(markdown: string): string | undefined {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

/**
 * Convert a tailored resume (markdown) to a styled, print-ready HTML string.
 */
// Compact CSS overrides — injected when content is slightly over one page.
// Tightens spacing without touching font sizes to keep readability.
const COMPACT_CSS = `
  @page { margin: 0.65cm !important; }
  li, p { line-height: 1.4 !important; margin-bottom: 2px !important; }
  h2.section { margin-top: 10px !important; margin-bottom: 3px !important; }
  h3 { margin-top: 7px !important; margin-bottom: 1px !important; }
  p.links { margin-bottom: 10px !important; }
  ul { margin: 0 0 1px 0 !important; }
`;

/**
 * Read the page count of a PDF file.
 * Works with Chrome headless --print-to-pdf output.
 */
export function getPdfPageCount(pdfPath: string): number {
  const content = readFileSync(pdfPath, 'latin1');
  const match = content.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Generate a resume PDF, retrying with compact spacing if content overflows one page.
 * Overwrites htmlPath with the compact HTML when compaction is applied.
 * Returns true if the final PDF fits on one page.
 */
export async function renderResumePdfFit(
  markdown: string,
  title: string,
  htmlPath: string,
  pdfPath: string,
): Promise<boolean> {
  writeFileSync(htmlPath, renderResumeHtml(markdown, title), 'utf8');
  await renderPdf(htmlPath, pdfPath);

  const pages = getPdfPageCount(pdfPath);
  if (pages <= 1) return true;

  // Slightly over — retry with compact CSS
  writeFileSync(htmlPath, renderResumeHtml(markdown, title, true), 'utf8');
  await renderPdf(htmlPath, pdfPath);
  return getPdfPageCount(pdfPath) <= 1;
}

export function renderResumeHtml(markdown: string, pageTitle?: string, compact = false): string {
  const resolvedTitle = pageTitle ?? (extractH1(markdown) ? `${extractH1(markdown)} – Resume` : 'Resume');
  const cleaned = markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^• /gm, '- ')
    .trim();
  const normalized = normalizeContactLinks(cleaned);

  const { renderer, closeJobSection } = makeRenderer();
  const m = new Marked({ renderer: renderer as any });
  let body = sanitizeHtml(m.parse(normalized) as string);
  
  // Close any open job-section wrapper
  body += closeJobSection();

  const safeTitle = escapeHtml(resolvedTitle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${CSS}${compact ? COMPACT_CSS : ''}</style>
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
export function renderCoverLetterHtml(markdown: string, pageTitle?: string): string {
  const resolvedTitle = pageTitle ?? (extractH1(markdown) ? `${extractH1(markdown)} – Cover Letter` : 'Cover Letter');
  const m = new Marked();
  const body = sanitizeHtml(m.parse(markdown) as string);
  const safeTitle = escapeHtml(resolvedTitle);

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
      color: #323434;
    }
    @media print {
      body {
        padding: 1.2cm 1.5cm;
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
 */
export async function renderPdf(htmlPath: string, pdfPath: string): Promise<void> {
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/usr/bin/google-chrome',
  ];

  const chromePath = chromePaths.find((p) => existsSync(p));
  if (!chromePath) {
    throw new Error('Google Chrome not found.');
  }

  try {
    execFileSync(
      chromePath,
      [
        '--headless',
        '--disable-gpu',
        `--print-to-pdf=${resolve(pdfPath)}`,
        '--print-to-pdf-no-header',
        '--no-pdf-header-footer',
        pathToFileURL(resolve(htmlPath)).href,
      ],
      { stdio: 'ignore' }
    );
  } catch (err) {
    throw new Error(`Failed to generate PDF: ${err instanceof Error ? err.message : String(err)}`);
  }
}
