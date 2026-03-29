import type { ActiveDoc, EditorData, EditorSection, BulletItem, JobEntry } from '@/types';

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
export function genId(): string {
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

// ---------------------------------------------------------------------------
// Date helpers (ported from old workbench)
// ---------------------------------------------------------------------------

function isDateSegment(text: string): boolean {
  const t = text.trim();
  if (/^\d{4}/.test(t)) return true;
  if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(t)) return true;
  if (/(?<!\d)[''']?\d{2}(?:\d{2})?\s*[-\u2013\u2014]\s*(?:[''']?\d{2}(?:\d{2})?|present|current)(?!\d)/i.test(t)) return true;
  return false;
}

function looksLikeDateLine(text: string): boolean {
  const t = text.trim();
  if (/^\d{4}/.test(t)) return true;
  if (/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i.test(t)) return true;
  if (/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+[''']?\d{2,4}/i.test(t)) return true;
  if (/(?<!\d)[''']?\d{2}(?:\d{2})?\s*[-\u2013\u2014]\s*(?:[''']?\d{2}(?:\d{2})?|present|current)(?!\d)/i.test(t)) return true;
  return false;
}

function looksLikeJobTitle(text: string): boolean {
  return /\b(?:engineer|developer|architect|manager|director|lead|principal|senior|staff|junior|intern|analyst|consultant|designer|scientist|administrator|coordinator|specialist|vp|chief|head|officer)\b/i.test(text.trim());
}

function splitDateLocation(text: string): { date: string; location: string } {
  if (!text.includes('|')) return { date: text.trim(), location: '' };
  const parts = text.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length === 1) return { date: parts[0], location: '' };
  const dateIdx = parts.findIndex(p => isDateSegment(p));
  if (dateIdx >= 0) {
    const date = parts[dateIdx];
    const loc = parts.filter((_, i) => i !== dateIdx).join(' | ');
    return { date, location: loc };
  }
  return { date: parts[0], location: parts.slice(1).join(' | ') };
}

// ---------------------------------------------------------------------------
// Resume markdown parser — full structured parse with jobs/bullets/text types
// ---------------------------------------------------------------------------

function parseResumeEditorData(markdown: string, previous?: EditorData | null): EditorData {
  const lines = markdown.split('\n');
  let h2Count = 0;
  let name = '';
  let role = '';
  let contact = '';
  let links = '';
  let seenPrimaryHeading = false;
  const sections: EditorSection[] = [];
  let currentSection: EditorSection | null = null;
  let currentJob: JobEntry | null = null;

  const previousSections = previous?.sections ?? [];

  for (const line of lines) {
    const trimmed = line.trim();

    // # Name
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      if (!name) {
        name = trimmed.slice(2).trim();
        seenPrimaryHeading = true;
      }
      continue;
    }

    // ## Role (first h2) or ## Section heading (subsequent h2s)
    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      h2Count++;
      if (h2Count === 1) {
        role = trimmed.slice(3).trim();
        continue;
      }
      currentJob = null;
      currentSection = {
        id: genId(),
        heading: trimmed.slice(3).trim(),
        type: 'text',
        content: '',
        items: [],
        jobs: [],
        accepted: false,
      };
      sections.push(currentSection);
      continue;
    }

    // ### Job entry heading
    if (trimmed.startsWith('### ')) {
      if (currentSection) {
        currentSection.type = 'jobs';
        const h3Text = trimmed.slice(4).trim();
        let jTitle = '', jCompany = '', jLocation = '', jDate = '';

        const pipeParts = h3Text.split(/\s*\|\s*/).filter(Boolean);
        if (pipeParts.length >= 4) {
          jTitle = pipeParts[0] ?? '';
          jCompany = pipeParts[1] ?? '';
          const tail = pipeParts.slice(2);
          const dIdx = tail.findIndex(p => isDateSegment(p));
          if (dIdx >= 0) {
            jDate = tail[dIdx];
            jLocation = tail.filter((_, k) => k !== dIdx).join(' | ');
          } else {
            jLocation = tail.join(' | ');
          }
        } else if (pipeParts.length >= 2) {
          jTitle = pipeParts[0] ?? '';
          jCompany = pipeParts[1] ?? '';
          jLocation = pipeParts[2] ?? '';
          // Extract embedded dates/locations from title/company
          for (const field of ['title', 'company'] as const) {
            const val = field === 'title' ? jTitle : jCompany;
            const parenDateMatch = val.match(/\s*\(([^)]*\d{2,4}[^)]*)\)\s*/);
            if (parenDateMatch) {
              if (!jDate) jDate = parenDateMatch[1];
              let cleaned = val.replace(parenDateMatch[0], ' ').trim();
              const dashCityMatch = cleaned.match(/\s*-\s+(.+)$/);
              if (dashCityMatch) {
                const city = dashCityMatch[1].trim();
                if (!jLocation) jLocation = city;
                else if (jLocation.length <= 3) jLocation = city + ', ' + jLocation;
                cleaned = cleaned.replace(dashCityMatch[0], '').trim();
              }
              if (field === 'title') jTitle = cleaned;
              else jCompany = cleaned;
            }
          }
        } else {
          const parenDM = h3Text.match(/\s*\(([^)]*\d{2,4}[^)]*)\)\s*/);
          const datesInParens = parenDM ? parenDM[1] : '';
          const stripped0 = h3Text.replace(/\s*\([^)]*\)\s*/, ' ').trim();
          const trailLocM = stripped0.match(/\s+-\s+(.+)$/);
          if (trailLocM && !jLocation) jLocation = trailLocM[1].trim();
          const stripped = trailLocM ? stripped0.replace(trailLocM[0], '').trim() : stripped0;
          const dashMatch = stripped.match(/^(.+?)\s+[\u2014\u2013-]{1,2}\s+(.+)$/);
          if (dashMatch) {
            jTitle = dashMatch[1].trim();
            const rest = dashMatch[2].trim();
            const restParts = rest.split(',').map(s => s.trim());
            if (restParts.length >= 3 && (restParts[restParts.length - 1]?.length ?? 0) <= 3) {
              jCompany = restParts[0] ?? '';
              if (!jLocation) jLocation = restParts.slice(1).join(', ');
            } else if (restParts.length >= 2) {
              jCompany = restParts.slice(0, -1).join(', ');
              if (!jLocation) jLocation = restParts[restParts.length - 1] ?? '';
            } else {
              jCompany = rest;
            }
          } else {
            const atMatch = stripped.match(/^(.+?)\s+at\s+(.+)$/i);
            if (atMatch) {
              jTitle = atMatch[1].trim();
              jCompany = atMatch[2].trim();
            } else {
              jTitle = h3Text;
            }
          }
          if (datesInParens) jDate = datesInParens;
        }

        // Heuristic: swap title/company if they look swapped
        if (looksLikeJobTitle(jCompany) && !looksLikeJobTitle(jTitle)) {
          const tmp = jTitle; jTitle = jCompany; jCompany = tmp;
        }

        currentJob = {
          id: genId(),
          title: jTitle,
          company: jCompany,
          location: jLocation,
          date: jDate,
          bullets: [],
        };
        currentSection.jobs.push(currentJob);
      }
      continue;
    }

    // Preamble lines (contact/links) before first section
    if (h2Count <= 1 && seenPrimaryHeading && !currentSection) {
      if (trimmed && trimmed === name) continue;
      if (trimmed && !contact) { contact = trimmed; continue; }
      if (trimmed && !links) { links = trimmed; continue; }
      if (!trimmed) continue;
    }

    if (!seenPrimaryHeading || !currentSection) continue;

    // Bullet lines
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.slice(2).trim();
      if (currentJob) {
        currentJob.bullets.push({ id: genId(), text });
      } else {
        if (currentSection.type !== 'bullets') {
          currentSection.type = 'bullets';
        }
        currentSection.items.push({ id: genId(), text });
      }
      continue;
    }

    // Date line after job heading
    if (currentJob && !currentJob.date && trimmed && looksLikeDateLine(trimmed)) {
      if (trimmed.includes('|')) {
        const { date, location } = splitDateLocation(trimmed);
        currentJob.date = date;
        if (location && !currentJob.location) currentJob.location = location;
      } else {
        currentJob.date = trimmed;
      }
      continue;
    }

    // Plain text content
    if (trimmed && currentSection.type === 'text') {
      currentSection.content += (currentSection.content ? '\n' : '') + trimmed;
    }
  }

  // Clean up: detect bullet-style text sections
  for (const sec of sections) {
    if (sec.type === 'jobs' && sec.jobs.length === 0) sec.type = 'text';
    if (sec.type === 'bullets' && sec.items.length === 0) sec.type = 'text';
    if (sec.type === 'text' && sec.content) {
      if (/^[\u2022\u00B7]\s/.test(sec.content.trim()) || /\s[\u2022\u00B7]\s/.test(sec.content)) {
        const parts = sec.content.split(/\s*[\u2022\u00B7]\s+/).filter(s => s.trim());
        if (parts.length > 1) {
          sec.type = 'bullets';
          sec.items = parts.map(t => ({ id: genId(), text: t.trim() }));
          sec.content = '';
        }
      } else if (sec.content.includes('\n- ') || sec.content.startsWith('- ')) {
        const parts = sec.content.split('\n').filter(l => l.trim());
        const allBullets = parts.every(l => l.trim().startsWith('- ') || l.trim().startsWith('* '));
        if (allBullets) {
          sec.type = 'bullets';
          sec.items = parts.map(l => ({ id: genId(), text: l.trim().replace(/^[-*]\s+/, '') }));
          sec.content = '';
        }
      }
    }
  }

  // Preserve accepted state from previous parse by matching on heading
  const mergedSections = sections.map((sec) => {
    const prev = previousSections.find(p => p.heading === sec.heading);
    return { ...sec, accepted: prev?.accepted ?? false };
  });

  return {
    kind: 'resume',
    header: { name, role, contact, links },
    sections: mergedSections,
  };
}

// ---------------------------------------------------------------------------
// Generic (cover letter) parser — simple paragraph sections
// ---------------------------------------------------------------------------

function parseGenericEditorData(markdown: string, previous?: EditorData | null): EditorData {
  if (!markdown || !markdown.trim()) {
    return { kind: 'generic', sections: [] };
  }

  const previousSections = previous?.sections ?? [];
  const lines = markdown.split('\n');
  const sections: EditorSection[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  function flush() {
    if (!currentHeading && currentLines.every(l => !l.trim())) return;
    while (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() === '') {
      currentLines.pop();
    }
    const content = currentLines.join('\n');
    const prev = previousSections.find(p => p.heading === currentHeading.replace(/^#+\s*/, ''));
    sections.push({
      id: genId(),
      heading: currentHeading.replace(/^#+\s*/, ''),
      type: 'text',
      content,
      items: [],
      jobs: [],
      accepted: prev?.accepted ?? false,
    });
    currentHeading = '';
    currentLines = [];
  }

  for (const line of lines) {
    if (line.trim().startsWith('#')) {
      flush();
      currentHeading = line;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return { kind: 'generic', sections };
}

export function parseEditorData(
  markdown: string,
  doc: ActiveDoc,
  previous?: EditorData | null,
): EditorData {
  if (doc === 'resume') {
    return parseResumeEditorData(markdown, previous);
  }
  return parseGenericEditorData(markdown, previous);
}

// ---------------------------------------------------------------------------
// Markdown serializer
// ---------------------------------------------------------------------------

export function reconstructEditorData(editorData: EditorData): string {
  if (editorData.kind !== 'resume') {
    return editorData.sections
      .map(sec => {
        const heading = sec.heading ? `## ${sec.heading}` : '';
        if (sec.type === 'bullets') {
          const items = sec.items.map(b => `- ${b.text}`).join('\n');
          return heading ? `${heading}\n\n${items}` : items;
        }
        return heading ? `${heading}\n\n${sec.content ?? ''}` : (sec.content ?? '');
      })
      .join('\n\n');
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
  if (header.contact.trim()) lines.push(header.contact.trim());
  if (header.links.trim()) lines.push(header.links.trim());
  if ((header.contact.trim() || header.links.trim()) && editorData.sections.length > 0) {
    lines.push('');
  }

  for (const sec of editorData.sections) {
    lines.push(`## ${sec.heading}`);
    lines.push('');

    if (sec.type === 'text') {
      if (sec.content) {
        lines.push(sec.content);
        lines.push('');
      }
    } else if (sec.type === 'bullets') {
      for (const b of sec.items) {
        if (b.text) lines.push(`- ${b.text}`);
      }
      lines.push('');
    } else if (sec.type === 'jobs') {
      for (const job of sec.jobs) {
        const parts = [job.title, job.company, job.location].filter(Boolean);
        if (parts.length > 0) {
          lines.push(`### ${parts.join(' | ')}`);
          lines.push('');
        }
        if (job.date) {
          lines.push(job.date);
          lines.push('');
        }
        for (const b of job.bullets) {
          if (b.text) lines.push(`- ${b.text}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n').trimEnd();
}

// Keep for any legacy callers
export function reconstructMarkdown(sections: Array<Pick<MarkdownSection, 'heading' | 'content'>>): string {
  return sections
    .map((section) => {
      if (section.heading && section.content) return `${section.heading}\n${section.content}`;
      if (section.heading) return section.heading;
      return section.content;
    })
    .join('\n\n');
}
