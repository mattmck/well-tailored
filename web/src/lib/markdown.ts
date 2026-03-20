// ---------------------------------------------------------------------------
// Markdown parsing utilities
// Ported from src/workbench/index-v2.html
// ---------------------------------------------------------------------------

export interface MarkdownSection {
  id: string;
  heading: string;
  content: string;
}

/** Generate a short random id */
function sid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** HTML entity escaping */
export function escHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format elapsed time as "Xm XXs" or "Xs" */
export function formatElapsed(startedAt: number): string {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

/** Convert URLs and emails in pipe-separated text into anchor tags */
export function linkify(text: string): string {
  return (text || '')
    .split(/\s*[|•·]\s*/)
    .map((seg) => {
      const t = seg.trim();
      if (!t) return '';
      if (t.includes('@')) return `<a href="mailto:${escHtml(t)}">${escHtml(t)}</a>`;
      if (t.match(/^(https?:\/\/|www\.)/i)) {
        const href = t.startsWith('http') ? t : 'https://' + t;
        return `<a href="${escHtml(href)}">${escHtml(t)}</a>`;
      }
      if (t.match(/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i)) {
        return `<a href="https://${escHtml(t)}">${escHtml(t)}</a>`;
      }
      return escHtml(t);
    })
    .join(' &nbsp;|&nbsp; ');
}

/**
 * Parse markdown into sections split by heading lines (# or ##).
 * Each section has an id, the heading line (with # prefix), and the content
 * that follows until the next heading.
 */
export function parseMarkdownSections(markdown: string): MarkdownSection[] {
  if (!markdown || !markdown.trim()) return [];

  const lines = markdown.split('\n');
  const sections: MarkdownSection[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  function flush() {
    if (currentHeading || currentLines.length > 0) {
      // Trim trailing blank lines from content
      while (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() === '') {
        currentLines.pop();
      }
      sections.push({
        id: sid(),
        heading: currentHeading,
        content: currentLines.join('\n'),
      });
    }
    currentHeading = '';
    currentLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      // It's a heading line — flush previous section and start a new one
      flush();
      currentHeading = line;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections;
}

/**
 * Reconstruct full markdown from sections by joining heading + content.
 */
export function reconstructMarkdown(sections: MarkdownSection[]): string {
  return sections
    .map((s) => {
      if (s.heading && s.content) return `${s.heading}\n${s.content}`;
      if (s.heading) return s.heading;
      return s.content;
    })
    .join('\n\n');
}
