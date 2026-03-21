import type { ActiveDoc, EditorData, EditorSection } from '@/types';

// ---------------------------------------------------------------------------
// Markdown parsing utilities
// Ported from src/workbench/index-v2.html and docs/resume-editor.html
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
      flush();
      currentHeading = line;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections;
}

function toEditorSections(sections: MarkdownSection[], previousSections: EditorSection[] = []): EditorSection[] {
  return sections.map((section) => {
    const previous = previousSections.find((entry) => entry.id === section.id);
    return {
      id: section.id,
      heading: section.heading,
      content: section.content,
      accepted: previous?.accepted ?? false,
    };
  });
}

function parseResumeEditorData(markdown: string, previous?: EditorData | null): EditorData {
  const lines = markdown.split('\n');
  const contentLines: string[] = [];
  let h2Count = 0;
  let name = '';
  let role = '';
  let contact = '';
  let links = '';
  let seenPrimaryHeading = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      if (!name) {
        name = trimmed.slice(2).trim();
        seenPrimaryHeading = true;
        continue;
      }
    }

    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      h2Count += 1;
      if (h2Count === 1) {
        role = trimmed.slice(3).trim();
        continue;
      }
    }

    if (h2Count <= 1 && seenPrimaryHeading) {
      if (trimmed && name && trimmed === name) {
        continue;
      }
      if (trimmed && !contact) {
        contact = trimmed;
        continue;
      }
      if (trimmed && !links) {
        links = trimmed;
        continue;
      }
      if (!trimmed) {
        continue;
      }
    }

    if (!seenPrimaryHeading) {
      continue;
    }

    contentLines.push(line);
  }

  const previousSections = previous?.sections ?? [];

  return {
    kind: 'resume',
    header: {
      name,
      role,
      contact,
      links,
    },
    sections: toEditorSections(parseMarkdownSections(contentLines.join('\n')), previousSections),
  };
}

export function parseEditorData(
  markdown: string,
  doc: ActiveDoc,
  previous?: EditorData | null,
): EditorData {
  if (doc === 'resume') {
    return parseResumeEditorData(markdown, previous);
  }

  return {
    kind: 'generic',
    sections: toEditorSections(parseMarkdownSections(markdown), previous?.sections ?? []),
  };
}

/**
 * Reconstruct full markdown from sections by joining heading + content.
 */
export function reconstructMarkdown(sections: Array<Pick<MarkdownSection, 'heading' | 'content'>>): string {
  return sections
    .map((section) => {
      if (section.heading && section.content) return `${section.heading}\n${section.content}`;
      if (section.heading) return section.heading;
      return section.content;
    })
    .join('\n\n');
}

export function reconstructEditorData(editorData: EditorData): string {
  if (editorData.kind !== 'resume') {
    return reconstructMarkdown(editorData.sections);
  }

  const lines: string[] = [];
  const header = editorData.header ?? { name: '', role: '', contact: '', links: '' };

  if (header.name.trim()) {
    lines.push(`# ${header.name.trim()}`);
    lines.push('');
  }

  if (header.role.trim()) {
    lines.push(`## ${header.role.trim()}`);
    lines.push('');
  }

  if (header.contact.trim()) {
    lines.push(header.contact.trim());
  }

  if (header.links.trim()) {
    lines.push(header.links.trim());
  }

  if ((header.contact.trim() || header.links.trim()) && editorData.sections.length > 0) {
    lines.push('');
  }

  const sectionMarkdown = reconstructMarkdown(editorData.sections).trim();
  if (sectionMarkdown) {
    lines.push(sectionMarkdown);
  }

  return lines.join('\n').trimEnd();
}
