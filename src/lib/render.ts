import { execFileSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { Marked } from 'marked';
import sanitizeHtmlLib from 'sanitize-html';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readTemplate(name: string): string {
  return readFileSync(join(__dirname, '../templates', name), 'utf8');
}

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
// Public API
// ---------------------------------------------------------------------------

/** Extract the first H1 heading text from a markdown string, if present. */
function extractH1(markdown: string): string | undefined {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

/**
 * Convert a tailored resume (markdown) to a styled, print-ready HTML string.
 */
export function renderResumeHtml(markdown: string, pageTitle?: string): string {
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
  const indentedBody = body.trim().split('\n').map(l => `    ${l}`).join('\n');

  return readTemplate('resume.html')
    .replace('{{TITLE}}', safeTitle)
    .replace('{{CSS}}', readTemplate('resume.css'))
    .replace('{{BODY}}', indentedBody);
}

/**
 * Convert a tailored cover letter (markdown) to a styled, print-ready HTML string.
 */
export function renderCoverLetterHtml(markdown: string, pageTitle?: string): string {
  const resolvedTitle = pageTitle ?? (extractH1(markdown) ? `${extractH1(markdown)} – Cover Letter` : 'Cover Letter');
  const m = new Marked();
  const body = sanitizeHtml(m.parse(markdown) as string);
  const safeTitle = escapeHtml(resolvedTitle);

  const indentedBody = body.trim().split('\n').map(l => `    ${l}`).join('\n');
  const css = readTemplate('resume.css') + '\n' + readTemplate('cover-letter.css');

  return readTemplate('cover-letter.html')
    .replace('{{TITLE}}', safeTitle)
    .replace('{{CSS}}', css)
    .replace('{{BODY}}', indentedBody);
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
