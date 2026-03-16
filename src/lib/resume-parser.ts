import { ResumeSection, ResumeSectionType } from '../types/index.js';

interface DraftSection {
  heading: string;
  headingLevel: number;
  lines: string[];
}

const HEADING_PATTERN = /^(#{1,6})[ \t]+(.+?)\s*$/;

function normalizeNewlines(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collectBullets(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) => line.trim());
}

function createSectionId(baseId: string, counts: Map<string, number>): string {
  const normalizedBase = baseId || 'section';
  const seen = counts.get(normalizedBase) ?? 0;
  counts.set(normalizedBase, seen + 1);
  return seen === 0 ? normalizedBase : `${normalizedBase}-${seen + 1}`;
}

function buildSection(
  draft: DraftSection,
  counts: Map<string, number>,
  forceHeader = false,
): ResumeSection {
  const content = draft.lines.join('\n');
  const type = forceHeader ? 'header' : classifySectionType(draft.heading);
  const baseId = slugify(draft.heading) || type;

  return {
    id: createSectionId(baseId, counts),
    type,
    heading: draft.heading,
    headingLevel: draft.headingLevel,
    content,
    bullets: collectBullets(content),
  };
}

/**
 * Classify a heading string into a section type.
 */
export function classifySectionType(heading: string): ResumeSectionType {
  const lower = heading.trim().toLowerCase();

  if (/(experience|work history|employment)/i.test(lower)) {
    return 'experience';
  }
  if (/(education|academic)/i.test(lower)) {
    return 'education';
  }
  if (/(skill|technical|technologies|proficiencies|competencies)/i.test(lower)) {
    return 'skills';
  }
  if (/project/i.test(lower)) {
    return 'projects';
  }
  if (/(certification|certificate|license)/i.test(lower)) {
    return 'certifications';
  }
  if (/(summary|objective|profile|about)/i.test(lower)) {
    return 'summary';
  }

  return 'other';
}

/**
 * Parse a markdown resume into sections.
 */
export function parseResumeSections(markdown: string): ResumeSection[] {
  const normalized = normalizeNewlines(markdown);
  const lines = normalized.split('\n');
  const sections: ResumeSection[] = [];
  const counts = new Map<string, number>();

  let headerLines: string[] = [];
  let current: DraftSection | null = null;

  const flushCurrent = (): void => {
    if (!current) {
      return;
    }

    const isFirstHeadingSection = sections.length === 0;
    sections.push(buildSection(current, counts, isFirstHeadingSection && current.headingLevel === 1));
    current = null;
  };

  const flushHeader = (force = false): void => {
    if (!force && headerLines.length === 0) {
      return;
    }

    const content = headerLines.join('\n');
    sections.push({
      id: createSectionId('header', counts),
      type: 'header',
      heading: '',
      headingLevel: 0,
      content,
      bullets: collectBullets(content),
    });
    headerLines = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(HEADING_PATTERN);

    if (headingMatch) {
      if (!current) {
        flushHeader();
      } else {
        flushCurrent();
      }

      current = {
        heading: headingMatch[2],
        headingLevel: headingMatch[1].length,
        lines: [],
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  if (current) {
    flushCurrent();
  } else {
    flushHeader(true);
  }

  return sections;
}

/**
 * Reassemble sections back into markdown.
 */
export function assembleSections(sections: ResumeSection[]): string {
  return sections
    .map((section) => {
      if (section.headingLevel === 0 || !section.heading) {
        return section.content;
      }

      const headingLine = `${'#'.repeat(section.headingLevel)} ${section.heading}`;
      return section.content ? `${headingLine}\n${section.content}` : headingLine;
    })
    .filter((part, index, items) => part !== '' || index === items.length - 1)
    .join('\n');
}
