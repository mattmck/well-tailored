import type { EditorData, EditorJobEntry, EditorSection } from '../repositories/resume.js';

/** Generate a short random id. */
function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

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

function splitImplicitBullets(content: string): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const lines = trimmed.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  if (trimmed.includes('|')) {
    return trimmed.split(/\s+\|\s+/).map(part => part.trim()).filter(Boolean);
  }
  return [];
}

function normalizeSection(section: EditorSection): EditorSection {
  if (
    section.type === 'text' &&
    /additional\s+experience/i.test(section.heading) &&
    section.content.trim()
  ) {
    const items = splitImplicitBullets(section.content);
    if (items.length > 0) {
      return {
        ...section,
        type: 'bullets',
        content: '',
        items: items.map(text => ({ id: genId(), text })),
      };
    }
  }

  return section;
}

export function parseResumeMarkdown(markdown: string): EditorData {
  const lines = markdown.split('\n');
  let h2Count = 0;
  let name = '';
  let role = '';
  let contact = '';
  let links = '';
  let seenPrimaryHeading = false;
  const sections: EditorSection[] = [];
  let currentSection: EditorSection | null = null;
  let currentJob: EditorJobEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      if (!name) {
        name = trimmed.slice(2).trim();
        seenPrimaryHeading = true;
      }
      continue;
    }

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
        accepted: true,
      };
      sections.push(currentSection);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      if (currentSection) {
        currentSection.type = 'jobs';
        const h3Text = trimmed.slice(4).trim();
        let jTitle: string;
        let jCompany = '';
        let jLocation = '';
        let jDate = '';

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

        if (looksLikeJobTitle(jCompany) && !looksLikeJobTitle(jTitle)) {
          const tmp = jTitle;
          jTitle = jCompany;
          jCompany = tmp;
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

    if (h2Count <= 1 && seenPrimaryHeading && !currentSection) {
      if (trimmed && trimmed === name) continue;
      if (trimmed && !contact) {
        contact = trimmed;
        continue;
      }
      if (trimmed && !links) {
        links = trimmed;
        continue;
      }
      if (!trimmed) continue;
    }

    if (!seenPrimaryHeading || !currentSection) continue;

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

    if (trimmed && currentSection.type === 'text') {
      currentSection.content += (currentSection.content ? '\n' : '') + trimmed;
    }
  }

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

  return {
    kind: 'resume',
    header: { name, role, contact, links },
    sections: sections.map(normalizeSection),
  };
}
