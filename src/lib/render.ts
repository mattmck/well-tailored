import { execFileSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Marked } from 'marked';
import sanitizeHtmlLib from 'sanitize-html';
import { ResumeTheme } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_RESUME_THEME: ResumeTheme = {
  background: '#E5F2FF',
  body: '#323434',
  accent: '#BE503C',
  subheading: '#364D62',
  jobTitle: '#182234',
  date: '#3B72A8',
  contact: '#323434',
  link: '#255F91',
};

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
  const commonBareTld = /^(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|dev|me|ai|app|co|us|ca|blog|info|xyz)$/i;
  // Require an explicit scheme, www., or a path component so bare dotted
  // identifiers like "Node.js" are not treated as URLs.
  return /^https?:\/\/[^\s]+$/.test(text) ||
    /^www\.(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?$/.test(text) ||
    /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\/[^\s]*$/.test(text) ||
    commonBareTld.test(text);
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
    // Use /^## / so that ### headings don't increment h2Count.
    if (/^## /.test(trimmed)) {
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
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'hr', 'a', 'strong', 'em', 'code', 'br', 'div', 'span'],
    allowedAttributes: { a: ['href'], div: ['class'], span: ['class'] },
    allowedClasses: {
      h2: ['role', 'section'],
      p: ['contact', 'links', 'date'],
      div: ['job-section', 'job-header', 'job-sub'],
      span: ['job-company', 'job-location'],
    },
    allowedSchemes: ['mailto', 'https', 'http'],
  });
}

// ---------------------------------------------------------------------------
// Job heading parser — extracts title, company, location from h3 text
// Handles pipe format (preferred) and common AI fallback formats

interface JobHeading { title: string; company: string; location: string; }

function parseJobHeading(text: string): JobHeading {
  // Preferred: "Title | Company | Location"
  const pipeParts = text.split(/\s+\|\s+/).map(s => s.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    return { title: pipeParts[0], company: pipeParts[1], location: pipeParts[2] ?? '' };
  }

  // Fallback: "Title — Company (dates)" or "Title – Company (dates)"
  // Strip trailing parenthesized content (dates the AI jammed in)
  const stripped = text.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const dashMatch = stripped.match(/^(.+?)\s+[—–-]{1,2}\s+(.+)$/);
  if (dashMatch) {
    const [, title, rest] = dashMatch;
    // rest might be "Company, City, ST" or "Company, Location" or just "Company"
    const restParts = rest.split(',').map(s => s.trim());
    if (restParts.length >= 3 && restParts[restParts.length - 1].length <= 3) {
      // "Acme, San Francisco, CA" → company="Acme", location="San Francisco, CA"
      return { title: title.trim(), company: restParts[0], location: restParts.slice(1).join(', ') };
    }
    if (restParts.length >= 2) {
      return { title: title.trim(), company: restParts.slice(0, -1).join(', '), location: restParts[restParts.length - 1] };
    }
    return { title: title.trim(), company: rest.trim(), location: '' };
  }

  // Fallback: "Title at Company" or "Title, Company"
  const atMatch = stripped.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim(), location: '' };
  }

  // No pattern matched — just a plain title
  return { title: text, company: '', location: '' };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

function makeRenderer() {
  const state = {
    prevToken: '',
    h2Count: 0,
    inJobSection: false,
    pendingJobLocation: '',
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
        const parsed = parseJobHeading(text);
        state.pendingJobLocation = parsed.location;
        const titleHtml = escapeHtml(parsed.title);
        const companyHtml = parsed.company ? `<span class="job-company">${escapeHtml(parsed.company)}</span>` : '';
        return `${prefix}<div class="job-section">\n<div class="job-header">\n<h3>${titleHtml}</h3>\n${companyHtml}\n</div>\n`;
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
        const locationHtml = state.pendingJobLocation
          ? `<span class="job-location">${escapeHtml(state.pendingJobLocation)}</span>`
          : '';
        state.pendingJobLocation = '';
        return `<div class="job-header job-sub">\n<p class="date">${inline}</p>\n${locationHtml}\n</div>\n`;
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
// Compact CSS overrides — injected when content is slightly over one page.
// Tightens spacing without touching font sizes to keep readability.
const COMPACT_CSS = `
  @page { margin: 0.65cm !important; }
  li, p { line-height: 1.4 !important; margin-bottom: 2px !important; }
  h2.section { margin-top: 10px !important; margin-bottom: 3px !important; }
  h3 { margin-top: 7px !important; margin-bottom: 1px !important; }
  .job-header { margin-top: 7px !important; }
  .job-sub { margin-top: 0 !important; margin-bottom: 4px !important; }
  .job-sub .date { margin: 0 !important; }
  p.links { margin-bottom: 10px !important; }
  ul { margin: 0 0 1px 0 !important; }
`;

const SAFE_CSS_COLOR = /^(?:#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([^)]+\)|[a-zA-Z]{1,30})$/;

function safeColor(value: string, fallback: string): string {
  return SAFE_CSS_COLOR.test(value.trim()) ? value.trim() : fallback;
}

function buildThemeCss(theme?: Partial<ResumeTheme>): string {
  const merged = { ...DEFAULT_RESUME_THEME, ...theme };
  const resolved = {
    background: safeColor(merged.background, DEFAULT_RESUME_THEME.background),
    body: safeColor(merged.body, DEFAULT_RESUME_THEME.body),
    accent: safeColor(merged.accent, DEFAULT_RESUME_THEME.accent),
    subheading: safeColor(merged.subheading, DEFAULT_RESUME_THEME.subheading),
    jobTitle: safeColor(merged.jobTitle, DEFAULT_RESUME_THEME.jobTitle),
    date: safeColor(merged.date, DEFAULT_RESUME_THEME.date),
    contact: safeColor(merged.contact, DEFAULT_RESUME_THEME.contact),
    link: safeColor(merged.link, DEFAULT_RESUME_THEME.link),
  };
  return `
html, body, .resume { background: ${resolved.background}; }
body, li, p, ul { color: ${resolved.body}; }
h1, h2.section { color: ${resolved.accent}; }
h2.role, .job-company { color: ${resolved.subheading}; }
h3 { color: ${resolved.jobTitle}; }
p.date, .job-location { color: ${resolved.date}; }
p.contact, p.links { color: ${resolved.contact}; }
p.contact a, p.links a, a { color: ${resolved.link}; }
`;
}

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
  theme?: Partial<ResumeTheme>,
): Promise<boolean> {
  writeFileSync(htmlPath, renderResumeHtml(markdown, title, false, theme), 'utf8');
  await renderPdf(htmlPath, pdfPath);

  const pages = getPdfPageCount(pdfPath);
  if (pages <= 1) return true;

  // Slightly over — retry with compact CSS
  writeFileSync(htmlPath, renderResumeHtml(markdown, title, true, theme), 'utf8');
  await renderPdf(htmlPath, pdfPath);
  return getPdfPageCount(pdfPath) <= 1;
}

export function renderResumeHtml(
  markdown: string,
  pageTitle?: string,
  compact = false,
  theme?: Partial<ResumeTheme>,
): string {
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
    .replace('{{CSS}}', readTemplate('resume.css') + '\n' + buildThemeCss(theme) + (compact ? '\n' + COMPACT_CSS : ''))
    .replace('{{BODY}}', indentedBody);
}

/**
 * Convert a tailored cover letter (markdown) to a styled, print-ready HTML string.
 */
export function renderCoverLetterHtml(
  markdown: string,
  pageTitle?: string,
  theme?: Partial<ResumeTheme>,
): string {
  const resolvedTitle = pageTitle ?? (extractH1(markdown) ? `${extractH1(markdown)} – Cover Letter` : 'Cover Letter');
  const m = new Marked();
  const body = sanitizeHtml(m.parse(markdown) as string);
  const safeTitle = escapeHtml(resolvedTitle);

  const indentedBody = body.trim().split('\n').map(l => `    ${l}`).join('\n');
  const css = readTemplate('resume.css') + '\n' + buildThemeCss(theme) + '\n' + readTemplate('cover-letter.css');

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
