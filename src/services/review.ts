import { complete as defaultComplete } from '../lib/ai.js';
import { sectionRegenerationSystemPrompt, sectionRegenerationUserPrompt } from '../lib/prompts.js';
import { assembleSections, parseResumeSections } from '../lib/resume-parser.js';
import { ResumeSection } from '../types/index.js';

export interface RegenerateResumeSectionArgs {
  resume: string;
  bio: string;
  jobDescription: string;
  jobTitle?: string;
  sectionId: string;
  sectionHeading?: string;
  model: string;
  verbose?: boolean;
  complete?: typeof defaultComplete;
}

export interface RegenerateResumeSectionResult {
  section: ResumeSection;
  sections: ResumeSection[];
  markdown: string;
}

function normalizeSectionBody(section: ResumeSection, raw: string): string {
  let body = raw.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
  if (section.headingLevel === 0 || !section.heading) {
    return body;
  }

  const headingLine = `${'#'.repeat(section.headingLevel)} ${section.heading}`;
  if (body.startsWith(headingLine)) {
    body = body.slice(headingLine.length).replace(/^\n+/, '');
  }

  return body;
}

function rebuildSection(section: ResumeSection, content: string): ResumeSection {
  const body = normalizeSectionBody(section, content);
  const synthetic = section.headingLevel > 0 && section.heading
    ? `${'#'.repeat(section.headingLevel)} ${section.heading}\n${body}`
    : body;
  const parsed = parseResumeSections(synthetic);
  const rebuilt = parsed.find((candidate) =>
    candidate.heading === section.heading && candidate.headingLevel === section.headingLevel)
    ?? parsed[0]
    ?? {
      ...section,
      content: body,
      bullets: [],
    };

  return {
    ...section,
    content: rebuilt.content,
    bullets: rebuilt.bullets,
  };
}

export async function regenerateResumeSection(
  args: RegenerateResumeSectionArgs,
): Promise<RegenerateResumeSectionResult> {
  const sections = parseResumeSections(args.resume);
  const normalizedHeading = args.sectionHeading?.trim().toLowerCase();
  const index = sections.findIndex((section) => section.id === args.sectionId);
  const fallbackIndex = index === -1 && normalizedHeading
    ? sections.findIndex((section) => section.heading.trim().toLowerCase() === normalizedHeading)
    : -1;
  const targetIndex = index === -1 ? fallbackIndex : index;

  if (targetIndex === -1) {
    throw new Error(`Could not find resume section "${args.sectionId}".`);
  }

  const section = sections[targetIndex];
  const complete = args.complete ?? defaultComplete;
  const updatedContent = await complete(
    args.model,
    sectionRegenerationSystemPrompt(),
    sectionRegenerationUserPrompt({
      resume: args.resume,
      bio: args.bio,
      jobDescription: args.jobDescription,
      jobTitle: args.jobTitle,
      sectionHeading: section.heading,
      sectionType: section.type,
      sectionContent: section.content,
    }),
    args.verbose ?? false,
  );

  const updatedSection = rebuildSection(section, updatedContent);
  const updatedSections = sections.map((candidate, candidateIndex) =>
    candidateIndex === targetIndex ? updatedSection : candidate);

  return {
    section: updatedSection,
    sections: updatedSections,
    markdown: assembleSections(updatedSections),
  };
}
